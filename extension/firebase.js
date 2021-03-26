let partyCode;
let globalPartyAttributes;
let queue;
let currentIndex;
let currentLoc;
let currentStatus;
let database;
let functions;
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

    // firebase.auth().signInAnonymously();

    firebase.auth().onAuthStateChanged(firebaseUser => onAuthStateChanged(firebaseUser));

    database = firebase.database();
    functions = firebase.functions();

    // if in party
    chrome.storage.sync.get(['inParty']['partyCode'], function(result) {
        if(result.inParty === true){
            partyCode = result.partyCode;
            addFirebaseListeners();
            player.connect();
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
            chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'browser', 'queueObj': queue, 'currentIndex': currentIndex}, function(resp){
                console.log(resp);
                response({'response': 'success'});
            });
            if (currentStatus === 'play'){
                chrome.runtime.sendMessage({'command': 'onPlay', 'recipient': 'browser'});
            } else {
                chrome.runtime.sendMessage({'command': 'onPause', 'recipient': 'browser'});
            };
        }

        if(msg.command === 'openPopup'){
            chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'popup', 'queueObj': queue, 'currentIndex': currentIndex}, function(resp){
                console.log(resp);
                response({'response': 'success'});
            });
            if (currentStatus === 'play'){
                chrome.runtime.sendMessage({'command': 'onPlay', 'recipient': 'popup'});
            } else {
                chrome.runtime.sendMessage({'command': 'onPause', 'recipient': 'popup'});
            };
        }

        if(msg.command === 'leaveParty'){
            leaveParty();
            response({'response': 'success'});
        }

        if(msg.command === 'togglePlay'){
            updateStatus();
        }

        if (msg.command === 'skipNext'){
            const stateRef = database.ref('parties/state/').child(partyCode);
            const stateIndexRef = stateRef.child('current_index');
            const stateLocRef = stateRef.child('current_loc');

            stateIndexRef.set(currentIndex + 1);
            stateLocRef.set(0);
        }

        if (msg.command === 'skipPrevious'){
            const stateRef = database.ref('parties/state/').child(partyCode);
            const stateIndexRef = stateRef.child('current_index');
            const stateLocRef = stateRef.child('current_loc');

            stateIndexRef.set(currentIndex - 1);
            stateLocRef.set(0);
        }

        if (msg.command === 'signIn'){
            signIn();

        }

        if (msg.command === 'signOut'){
            chrome.storage.sync.get(['inParty'], (objects) => {
                if (objects.inParty === true){
                    leaveParty();
                };
            });
            firebase.auth().signOut().then(() => {
                chrome.runtime.sendMessage({'command': 'signedOut', 'recipient': 'popup'})
            });
        }
    }
});

function signIn(){
    var googleAuthProvider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().useDeviceLanguage();
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    firebase.auth()
        .signInWithPopup(googleAuthProvider)
        .then((result) => {
            var credential = result.credential;
            var token = credential.accessToken;
            var user = result.user;

        }).catch((error) => {
            var errorCode = error.code;
            var errorMessage = error.message;
            var email = error.email;
            var credential = error.credential;

            console.error(error);
        })    
}

function onAuthStateChanged(user){
    if (user) {
        const userRef = database.ref('users/').child(user.uid)
        userRef.set({'displayName': user.displayName});

        chrome.storage.sync.set({signedIn: true, uid: user.uid, displayName: user.displayName});

        chrome.runtime.sendMessage({'command': 'signedIn', 'recipient': 'popup'});
    } else {
        chrome.storage.sync.set({signedIn: false, uid: null, displayName: null});
    }
}

async function createParty(){
    try{
        const result = await firebase.functions().httpsCallable('createParty')();
        partyCode = result.data.partyCode;
        addFirebaseListeners();
    } catch (err) {
        console.error(err);
        return
    };
    
    // open party screen - do it in popup
    chrome.storage.sync.set({inParty: true, partyCode:partyCode},function(){
        console.log('Party Code ' + partyCode + ' saved to storage', response => console.log(response));
    });

    player.connect();
    transferPlayback();
    
    return partyCode
}

async function joinParty(inputPartyCode){
    // TODO: Input Validation

    try {
        const result = await firebase.functions().httpsCallable('joinParty')({
            partyCode: parseInt(inputPartyCode)
        });
        partyCode = result.data.partyCode;
        addFirebaseListeners();
    } catch (err) {
        console.error(err);
        return
    }

    chrome.storage.sync.set({inParty: true, partyCode: partyCode}, function(){
        console.log('Party Code ' + partyCode + ' saved to storage');
    });

    player.connect();
    transferPlayback();

    chrome.runtime.sendMessage({'command': 'partyJoined','recipient': 'popup'});
}

function leaveParty(){
    // set user = false
    const uid = firebase.auth().currentUser.uid;

    database.ref('parties/users/').child(partyCode).child(uid).remove()
    .then(() => console.log('removed user'))

    // remove db listeners
    const attributesRef = database.ref('parties/attributes/').child(partyCode);
    const queueRef = database.ref('parties/queues/').child(partyCode);
    const stateRef = database.ref('parties/state/').child(partyCode);
    const usersRef = database.ref('parties/users/').child(partyCode);
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
    const attributesRef = database.ref('parties/attributes/').child(partyCode);
    const queueRef = database.ref('parties/queues/').child(partyCode);
    const stateRef = database.ref('parties/state/').child(partyCode);
    const stateIndexRef = stateRef.child('current_index');
    const stateLocRef = stateRef.child('current_loc');
    const stateStatusRef = stateRef.child('status');
    const usersRef = database.ref('parties/users/').child(partyCode);
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
        
        chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'browser','queueObj': queue, 'currentIndex': currentIndex});
        chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'popup','queueObj': queue, 'currentIndex': currentIndex});
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

    chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'browser','queueObj': queue, 'currentIndex': currentIndex});
    chrome.runtime.sendMessage({'command': 'updateQueue', 'recipient': 'popup','queueObj': queue, 'currentIndex': currentIndex});
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
            chrome.runtime.sendMessage({'command': 'onPlay', 'recipient': 'browser'});
            chrome.runtime.sendMessage({'command': 'onPlay', 'recipient': 'popup'});
        } else {
            player.pause();
            chrome.runtime.sendMessage({'command': 'onPause', 'recipient': 'browser'});
            chrome.runtime.sendMessage({'command': 'onPause', 'recipient': 'popup'});
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
        'user': {
            'uid': firebase.auth().currentUser.uid,
            'displayName': firebase.auth().currentUser.displayName
        }
    };

    updatePosition();

    const partyQueueRef = database.ref('parties/queues/' + partyCode);
    partyQueueRef.child(queueIndex).set(queueItem);
    
}

async function updateStatus(){
    const stateRef = database.ref('parties/state/').child(partyCode);
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
    const stateRef = database.ref('parties/state/').child(partyCode);
    const stateLocRef = stateRef.child('current_loc');

    const state = await player.getCurrentState();
    if (!state){
        console.error('User is not playing music right now');
    } else {
        stateLocRef.set(state.position);
    }
}