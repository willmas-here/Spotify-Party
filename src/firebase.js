window.addEventListener("load", function(){
    var firebaseConfig = {
        apiKey: "AIzaSyD1LfJs-oLbdjM3muYUj_77QVPd0V5_ziU",
        authDomain: "music-party-extension.firebaseapp.com",
        databaseURL: "https://music-party-extension-default-rtdb.firebaseio.com",
        projectId: "music-party-extension",
        storageBucket: "music-party-extension.appspot.com",
        messagingSenderId: "820681518759",
        appId: "1:820681518759:web:466f5ec39d4334b5b53582",
        measurementId: "G-1R0PHNW4YX"
    };
    
    firebase.initializeApp(firebaseConfig);
    console.log(firebase);

    firebase.auth().signInAnonymously();

    firebase.auth().onAuthStateChanged(firebaseUser => {
        console.log(firebaseUser);
    });

    database = firebase.database();

    // if in party
    chrome.storage.sync.get(['inParty']['partyCode'], function(result) {
        if(result.inParty === true){
            partyCode = result.partyCode;
            addFirebaseListeners();
        }
    });    
});

chrome.runtime.onMessage.addListener(function(msg, sender, response){
    if (msg.recipient === 'firebase'){
        console.log(msg);
        
        if(msg.command === "createParty"){
            createParty()
            .then(function(partyCode){
                response({'response': "success", partyCode: partyCode});
            });
            return true;
        };
        
        if(msg.command === "joinParty"){
            const joinPromise = joinParty(msg.partyCode);
            joinPromise.then(function(){
                response({'response': "success"});
            })
        };

        if(msg.command === "addToQueue"){
            // add to queue
            addToQueue(msg.trackObj);
            response({'response': 'success'});
        };

        if(msg.command === 'openBrowser'){
            chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'browser', 'queueObj': queue}, function(response){
                console.log(response);
                response({'response': 'success'});
            });
        }

        if(msg.command === 'leaveParty'){
            leaveParty();
            response({'response': 'success'});
        }
    }
});

async function createParty(){
    // refs
    const attributesRef = database.ref('attributes/');
    const queuesRef = database.ref('queues/');
    const stateRef = database.ref('state/');
    const usersRef = database.ref('users/');

    // make a code (test to make sure unique)

    const snapshot = await attributesRef.get();
    if (!snapshot.exists())
        console.log("No data available");

    let validCode = false;
    let tempPartyCode = 0;

    while (!validCode){
        tempPartyCode = Math.floor(Math.random() * (1000000-100000) + 100000);

        if(!snapshot.child(tempPartyCode).exists()){
            validCode = true;
            console.log("Party Code =", tempPartyCode)
        } else
            console.log(tempPartyCode, "already exists");
    }

    partyCode = tempPartyCode

    // create party in db
    const uid = firebase.auth().currentUser.uid;
    const attributes = {
        "host": uid,
        "permissions": {
            "change_queue": "everybody",
            "change_state": "everybody"
        },
        "time_created": Date.now()
    };

    const state = {
        "status": "pause",
        "current_index": "0",
        "current_loc": "0"
    };

    const users = {
        [uid]: true
    };

    try {
        await attributesRef.child(partyCode).set(attributes)
        await queuesRef.child(partyCode).set(true);
        await stateRef.child(partyCode).set(state)
        await usersRef.child(partyCode).set(users)
    } catch(err) {
        console.error(err)
    }
    addFirebaseListeners();
    
    // open party screen - do it in popup
    chrome.storage.sync.set({inParty: true, partyCode:partyCode},function(){
        console.log('Party Code ' + partyCode + ' saved to storage')
    });
    
    return partyCode
}

async function joinParty(partyCode){
    // set user = true
    const uid = firebase.auth().currentUser.uid;

    database.ref('users/').child(partyCode).child(uid).set(true)
    .then(() => console.log('set user'))

    // set db listeners
    addFirebaseListeners();
}

function leaveParty(){
    // set user = false
    const uid = firebase.auth().currentUser.uid;

    database.ref('users/').child(partyCode).child(uid).remove()
    .then(() => console.log('removed user'))

    // remove db listeners
    const attributesRef = database.ref('attributes/').child(partyCode);
    const queueRef = database.ref('queues/').child(partyCode);
    const stateRef = database.ref('state/').child(partyCode);
    const usersRef = database.ref('users/').child(partyCode);
    attributesRef.off('value');
    queueRef.off('value');
    stateRef.off('value');
    usersRef.off('value');

    attributes = null;
    queue = null;
    state = null;
    users = null;

    chrome.storage.sync.set({inParty: false, partyCode: null});

    chrome.runtime.sendMessage({'command': 'leaveParty', 'recipient': 'browser'});
    chrome.runtime.sendMessage({'command': 'leaveParty', 'recipient': 'popup'});
}

function addFirebaseListeners(){
    const attributesRef = database.ref('attributes/').child(partyCode);
    const queueRef = database.ref('queues/').child(partyCode);
    const stateRef = database.ref('state/').child(partyCode);
    const usersRef = database.ref('users/').child(partyCode);
    attributesRef.on('value', (snapshot) => onAttributesChange(snapshot));
    queueRef.on('value', (snapshot) => onQueueChange(snapshot));
    stateRef.on('value', (snapshot) => onStateChange(snapshot));
    usersRef.on('value', (snapshot) => onUserChange(snapshot));
}

function onAttributesChange(snapshot){
    attributes = snapshot.val()
}

function onQueueChange(snapshot){
    try{
        queue = snapshot.val();
        
        chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'browser','queueObj': queue}, function(response){
            console.log(response);
        });
    } catch(err) {
        queue = undefined;
        console.error(err)
    }
}

function onStateChange(snapshot){
    state = snapshot.val();

    if (state.status === 'play'){
        // play music
        let uris = []
        queue.slice(state.current_index).forEach(element => {
            uris.push(element.track_obj.uri);
        });
        startPlayback(uris, state.current_loc);
    } else {
        // pause music
        pausePlayback();
    }


}

function onUserChange(snapshot){
    users = snapshot.val()
}

function addToQueue(trackObj){
    // get last index
    let queueIndex;
    if (typeof(queue) === "object"){
        queueIndex = Object.keys(queue).length;
    } else {
        queueIndex = 0;
    }

    // update new index
    const queueItem = {
        'track_obj': trackObj,
        'user': firebase.auth().currentUser.uid
    };

    const partyQueueRef = database.ref('queues/' + partyCode);
    partyQueueRef.child(queueIndex).set(queueItem);
}

function updateStatePause(){
    
}

function updateState(status, current_loc, current_index){
    let newState = {};

    if (typeof(status) !== undefined){
        newState.status = status;
    }

    if (typeof(current_loc) !== undefined){
        newState.current_loc = current_loc;
    }

    if (typeof(current_index) !== undefined){
        newState.current_index = current_index;
    }


    if (status === 'pause'){
        //save current loc
    }
    
    console.log(newState);
    database.ref('state/').child(partyCode).update(newState);
}