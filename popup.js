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