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
            
            getQueue();
        }
    });    
});

chrome.runtime.onMessage.addListener(function(msg, sender, response){
    console.log(msg);
    
    if(msg.command === "createParty"){
        createParty()
        .then(function(partyCode){
            response({response: "success", partyCode: partyCode});
        });
        return true
    };
    
    if(msg.command === "joinParty"){
        const partyCode = msg.partyCode;
        const joinPromise = joinParty(partyCode);
        joinPromise.then(function(){
            response({response: "success"})
        })
    };

    if(msg.command === "addToQueue"){
        // add to queue
        addToQueue(msg.trackObj);
    };

    if(msg.command === 'openBrowser'){
        getQueue();
    }
});

async function createParty(){
    // refs
    const attributesRef = database.ref('attributes/');
    const queuesRef = database.ref('queues/');
    const statusRef = database.ref('status/');
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
            "change_status": "everybody"
        },
        "time_created": Date.now()
    };

    const status = {
        "status": "pause",
        "current_index": "0",
        "current_loc": "0"
    };

    const users = {
        [uid]: true
    };

    attributesRef.child(partyCode).set(attributes)
    .then(function(){
        console.log('Attributes successfully set');
    })
    .catch(function(error) {
        console.log('Attributes set error', error);
    });

    // queuesRef.child(partyCode).set(queues)
    // .then(function(){
    //     console.log('Queue successfully set');
    // })
    // .catch(function(error) {
    //     console.log('Queue set error', error);
    // });

    statusRef.child(partyCode).set(status)
    .then(function(){
        console.log('Status successfully set');
    })
    .catch(function(error) {
        console.log('Status set error', error);
    });

    usersRef.child(partyCode).set(users)
    .then(function(){
        console.log('Users successfully set');
    })
    .catch(function(error) {
        console.log('Users set error', error);
    });

    getQueue();
    
    // open party screen - do it in popup
    chrome.storage.sync.set({inParty: true, partyCode:partyCode},function(){
        console.log('Party Code ' + partyCode + ' saved to storage')
    });
    
    return partyCode
}

async function joinParty(partyCode){
    // set db stuffs
    const uid = firebase.auth().currentUser.uid;

    database.ref('users/').child(partyCode).child(uid).set(true)
    .then(() => console.log('set user'))

    // get db stuffs
    addFirebaseListeners();
}

function leaveParty(){

}

function addFirebaseListeners(){
    const attributesRef = database.ref('attributes/').child(partyCode);
    const queueRef = database.ref('queues/').child(partyCode);
    const statusRef = database.ref('status/').child(partyCode);
    const usersRef = database.ref('users/').child(partyCode);
    attributesRef.on('value', (snapshot) => getAttributes(snapshot));
    queueRef.on('value', (snapshot) => getQueue(snapshot));
    statusRef.on('value', (snapshot) => getStatus(snapshot));
    usersRef.on('value', (snapshot) => getUsers(snapshot));
}

function getAttributes(snapshot){
    attributes = snapshot.val()
}

function getQueue(snapshot){
    queue = snapshot.val();
    
    chrome.runtime.sendMessage({'command': 'updateQueue', 'queueObj': queue}, function(response){
        console.log(response);
    });
}

function getStatus(snapshot){
    status = snapshot.val();
}

function getUsers(snapshot){
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
        'artist': encodeURIComponent(trackObj.artist),
        'title': encodeURIComponent(trackObj.title),
        'track_id': encodeURIComponent(trackObj.track_id),
        'user': firebase.auth().currentUser.uid
    };

    const partyQueueRef = database.ref('queues/' + partyCode);
    partyQueueRef.child(queueIndex).set(queueItem);
}