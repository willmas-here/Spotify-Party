let globalPartyCode;
let globalPartyAttributes;
let queue;
let currentIndex;
let currentLoc;
let currentStatus;
let database;
let queueNotUpdated;

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
            globalPartyCode = result.partyCode;
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
            chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'browser', 'queueObj': queue}, function(searchResponse){
                console.log(searchResponse);
                response({'response': 'success'});
            });
        }

        if(msg.command === 'leaveParty'){
            leaveParty();
            response({'response': 'success'});
        }

        if(msg.command === 'togglePlay'){
            updateStatus();
        }
    }
});

async function createParty(){
    // refs
    const attributesRef = database.ref('parties/attributes/');
    const queuesRef = database.ref('parties/queues/');
    const stateRef = database.ref('parties/state/');
    const usersRef = database.ref('parties/users/');

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

    globalPartyCode = tempPartyCode

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
        await attributesRef.child(globalPartyCode).set(attributes)
        await queuesRef.child(globalPartyCode).set(true);
        await stateRef.child(globalPartyCode).set(state)
        await usersRef.child(globalPartyCode).set(users)
    } catch(err) {
        console.error(err)
    }
    addFirebaseListeners();
    
    // open party screen - do it in popup
    chrome.storage.sync.set({inParty: true, partyCode:globalPartyCode},function(){
        console.log('Party Code ' + globalPartyCode + ' saved to storage', response => console.log(response));
    });
    
    return globalPartyCode
}

async function joinParty(inputPartyCode){
    // TODO: check if party exists


    // set user = true
    const uid = firebase.auth().currentUser.uid;

    database.ref('parties/users/').child(inputPartyCode).child(uid).set(true)
    .then(() => console.log('set user'))

    // set db listeners
    globalPartyCode = inputPartyCode;
    addFirebaseListeners();

    chrome.storage.sync.set({inParty: true, partyCode: globalPartyCode}, function(){
        console.log('Party Code ' + globalPartyCode + ' saved to storage');
    });

    chrome.runtime.sendMessage({'command': 'partyJoined','recipient': 'popup'});
}

function leaveParty(){
    // set user = false
    const uid = firebase.auth().currentUser.uid;

    database.ref('users/').child(globalPartyCode).child(uid).remove()
    .then(() => console.log('removed user'))

    // remove db listeners
    const attributesRef = database.ref('parties/attributes/').child(globalPartyCode);
    const queueRef = database.ref('parties/queues/').child(globalPartyCode);
    const stateRef = database.ref('parties/state/').child(globalPartyCode);
    const usersRef = database.ref('parties/users/').child(globalPartyCode);
    attributesRef.off('value');
    queueRef.off('value');
    stateRef.off('value');
    usersRef.off('value');

    attributes = null;
    queue = null;
    state = null;
    users = null;

    // disconnect spotify player
    player.disconnect();

    chrome.storage.sync.set({inParty: false, partyCode: null});

    chrome.runtime.sendMessage({'command': 'leaveParty', 'recipient': 'browser'});
    chrome.runtime.sendMessage({'command': 'leaveParty', 'recipient': 'popup'});
}

function addFirebaseListeners(){
    const attributesRef = database.ref('parties/attributes/').child(globalPartyCode);
    const queueRef = database.ref('parties/queues/').child(globalPartyCode);
    const stateRef = database.ref('parties/state/').child(globalPartyCode);
    const stateIndexRef = stateRef.child('current_index');
    const stateLocRef = stateRef.child('current_loc');
    const stateStatusRef = stateRef.child('status');
    const usersRef = database.ref('parties/users/').child(globalPartyCode);
    attributesRef.on('value', (snapshot) => onAttributesChange(snapshot));
    queueRef.on('value', (snapshot) => onQueueChange(snapshot));
    stateIndexRef.on('value', (snapshot) => onStateIndexChange(snapshot));
    stateLocRef.on('value', (snapshot) => onStateLocChange(snapshot));
    stateStatusRef.on('value', (snapshot) => onStateStatusChange(snapshot));
    usersRef.on('value', (snapshot) => onUserChange(snapshot));
}

function onAttributesChange(snapshot){
    globalPartyAttributes = snapshot.val()
}

function onQueueChange(snapshot){
    try{
        queue = snapshot.val();

        if (currentStatus === 'play'){
            let uris = []
            queue.slice(currentIndex).forEach(element => {
                uris.push(element.track_obj.uri);
            });
            startPlayback(uris, currentLoc);
        };
        
        chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'browser','queueObj': queue}, function(response){
            console.log(response);
        });
    } catch(err) {
        queue = undefined;
        console.error(err)
    }
}

function onStateIndexChange(snapshot){
    currentIndex = snapshot.val();

    // change player
    if (currentStatus === 'play'){
        let uris = []
        queue.slice(currentIndex).forEach(element => {
            uris.push(element.track_obj.uri);
        });
        startPlayback(uris, currentLoc);
    } else {
        queueNotUpdated = true;
    }
}

function onStateLocChange(snapshot){
    currentLoc = snapshot.val();

    seekPlayback(currentLoc)
}

function onStateStatusChange(snapshot){
    currentStatus = snapshot.val()

    if (queueNotUpdated === false){
        if (currentStatus === 'play'){
            player.resume();
            chrome.runtime.sendMessage({'command': 'onPlay', 'recipient': 'browser'})
        } else {
            player.pause();
            chrome.runtime.sendMessage({'command': 'onPause', 'recipient': 'browser'})
        }
    } else {
        if (currentStatus === 'play'){
            let uris = []
            queue.slice(currentIndex).forEach(element => {
                uris.push(element.track_obj.uri);
            });
            startPlayback(uris, currentLoc);
            queueNotUpdated = false;
        } else {
            queueNotUpdated = true;
        }
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

    updatePosition();

    const partyQueueRef = database.ref('parties/queues/' + globalPartyCode);
    partyQueueRef.child(queueIndex).set(queueItem);
    
}

async function updateStatus(){
    const stateRef = database.ref('parties/state/').child(globalPartyCode);
    const stateStatusRef = stateRef.child('status');

    // set state
    if (currentStatus === 'play'){
        stateStatusRef.set('pause');
    } else if (currentStatus === 'pause'){
        stateStatusRef.set('play');
    };

    // set position
    updatePosition();
    
}

async function updatePosition(){
    const stateRef = database.ref('parties/state/').child(globalPartyCode);
    const stateLocRef = stateRef.child('current_loc');

    const state = await player.getCurrentState();
    if (!state){
        console.error('User is not playing music right now');
    }

    stateLocRef.set(state.position);

}