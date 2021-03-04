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

    // spotify auth
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

    if(msg.command === ""){

    };

    
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
    let partyCode = 0;

    while (!validCode){
        partyCode = Math.floor(Math.random() * (10000000-100000) + 100000);

        if(!snapshot.child(partyCode).exists()){
            validCode = true;
            console.log("Party Code =", partyCode)
        } else
            console.log(partyCode, "already exists");
    }

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

    const queues = {
        "0": false
    };

    const status = {
        "status": "pause",
        "current_track": "0",
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

    queuesRef.child(partyCode).set(queues)
    .then(function(){
        console.log('Queue successfully set');
    })
    .catch(function(error) {
        console.log('Queue set error', error);
    });

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
    
    // open party screen - do it in popup
    chrome.storage.sync.set({inParty: true, partyCode:partyCode},function(){
        console.log('Party Code ' + partyCode + ' saved to storage')
    });
    return partyCode
}

async function joinParty(partyCode){
    // joinParty
}