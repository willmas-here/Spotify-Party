window.addEventListener('load', function(){
    // main buttons event listeners
    document.getElementById('signin-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({'command': 'signIn', 'recipient': 'firebase'});
    })
    document.getElementById("create-btn").addEventListener("click", createParty);
    document.getElementById("join-btn").addEventListener("click", joinParty);
    document.getElementById("settings-btn").addEventListener("click", openSettings, true);
    document.getElementById("queue-btn").addEventListener("click", function(){
        window.open(chrome.runtime.getURL('browser.html'));
    })
    document.getElementById('join-form').addEventListener("submit", submitForm);
    
    document.getElementById('leave-btn').addEventListener('click', function() {
        chrome.runtime.sendMessage({command: 'leaveParty', recipient: 'firebase'});
    });
    document.getElementById('logout-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({'command': 'signOut', 'recipient': 'firebase'});
    })
    document.getElementById('play-btn').addEventListener('click', () => chrome.runtime.sendMessage({'command': 'togglePlay', 'recipient': 'firebase'}))
    document.getElementById('back-btn').addEventListener('click', () => chrome.runtime.sendMessage({'command': 'skipPrevious', 'recipient': 'firebase'}))
    document.getElementById('forward-btn').addEventListener('click', () => chrome.runtime.sendMessage({'command': 'skipNext', 'recipient': 'firebase'}))

    // hiding things
    document.getElementById("settings-menu").style.display = "none";
    
    // if in party or signed out
    chrome.storage.sync.get(['inParty', 'signedIn'], function(result) {
        console.log(result)
        if(result.inParty === true){
            changePage('main');
        } else if(result.signedIn !== true){
            changePage('signin');
        } else {
            changePage('menu');
        }
    });
});

chrome.runtime.onMessage.addListener(function(msg, sender, response){
    if (msg.recipient === 'popup'){
        console.log(msg)

        if (msg.command === 'leaveParty'){
            leaveParty();
            response({'response': 'success'});
        }

        if (msg.command === 'partyJoined'){
            changePage('main');
            response({'response': 'success'});
        }

        if (msg.command === 'signedIn'){
            changePage('menu');
        }

        if (msg.command === 'signedOut'){
            changePage('signin');
        }

        if (msg.command === 'onPlay'){
            document.getElementById('play-icon').className = 'far fa-pause-circle';
            response({'response': 'success'});
        }

        if (msg.command === 'onPause'){
            document.getElementById('play-icon').className = 'far fa-play-circle';
            response({'response': 'success'});
        }

        if (msg.command === 'updateQueue'){
            updateQueue(msg.queueObj, msg.currentIndex);
            response({'response': 'success'});
        }
    }
})

function changePage(newPage) {
    const menu = document.getElementById("menu");
    const join = document.getElementById("join");
    const main = document.getElementById("main");
    const signin = document.getElementById('signin');

    menu.style.display = "none";
    join.style.display = "none";
    main.style.display = "none";
    signin.style.display = 'none';

    if (newPage == 'menu') {
        menu.style.display = "flex";
    } else if (newPage == 'join') {
        join.style.display = "flex";
    } else if (newPage == 'main') {
        initMain();
        main.style.display = "grid";
    } else if (newPage === 'signin') {
        signin.style.display = 'flex';
    }
    console.log('Changed Page to ' + newPage)
};

function initMain() {
    chrome.storage.sync.get(['partyCode'], function(result) {
        document.getElementById("party-code").innerText = 'Party Code: ' + result.partyCode;
    });
    chrome.runtime.sendMessage({'command': 'openPopup', 'recipient': 'firebase'})
}

function joinParty(){
    changePage('join');
    console.log('join party');   
};

function createParty(){
    chrome.runtime.sendMessage({command: "createParty", recipient: 'firebase'}, function(response){
        console.log(response);
        if(response.response !== 'success'){
            console.error('Create Party Failed')
        }
        changePage('main');
        console.log('create party');    
    });
};

function leaveParty(){
    changePage('menu');
}

function openSettings(){
    document.getElementById("settings-menu").style.display = "block";

    document.getElementById("content").addEventListener("click", closeSettings, true);
    console.log('settings opened');
}

function closeSettings(){
    document.getElementById("settings-menu").style.display = "none";
    document.getElementById("content").removeEventListener("click", closeSettings, true);
    console.log('settings closed');
}

function submitForm(e){
    e.preventDefault();

    const code = document.forms['join-form']["code"].value
    console.log('Code: ' + code)

    // TODO: form validation - show message


    // send to background script to join
    chrome.runtime.sendMessage({command: "joinParty", recipient: 'firebase', partyCode: code}, function(response){
        console.log(response);
    })
    
    //join
}

function updateQueue(queueObj, currentIndex){
    if(queueObj === true){
        // no song in queue
        queueObj = new Array(0);
    }

    console.log(queueObj);

    document.getElementById('title').innerText = queueObj[currentIndex].track_obj.name;

    let artistStr = queueObj[currentIndex].track_obj.artists[0].name;
    for (let index = 1; index < queueObj[currentIndex].track_obj.artists.length; index++) {
        artistStr += ", " + queueObj[currentIndex].track_obj.artists[index].name;
    }
    document.getElementById('artist').innerText = artistStr;

    document.getElementById('art').setAttribute('src', queueObj[currentIndex].track_obj.album.images[1].url)

    // skip btn edge cases
    const forwardBtn = document.getElementById('forward-btn')
    const backBtn = document.getElementById('back-btn')
    if (currentIndex <= 0){
        // disable skip previous
        backBtn.disabled = true;
    } else {
        // enable skip previous
        backBtn.disabled = false;
    }
    if (currentIndex >= queueObj.length - 1){
        // disable skip next
        forwardBtn.disabled = true;
    } else {
        // enable skip next
        forwardBtn.disabled = false;
    }
}