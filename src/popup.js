window.addEventListener('load', function(){
    // main buttons event listeners
    document.getElementById("create-btn").addEventListener("click", createParty);
    document.getElementById("join-btn").addEventListener("click", joinParty);
    document.getElementById("settings-btn").addEventListener("click", openSettings, true);
    document.getElementById("queue-btn").addEventListener("click", function(){
        window.open(chrome.runtime.getURL('browser.html'));
    })
    document.getElementById('join-form').addEventListener("submit", submitForm);

    // options menu event listeners
    document.getElementById("options-btn").addEventListener("click", function(){
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    // hiding things
    document.getElementById("settings-menu").style.display = "none";
    
    // if in party
    chrome.storage.sync.get(['inParty'], function(result) {
        if(result.hasOwnProperty('inParty')){
            changePage('main');
        } else {
            changePage('menu');
        }
    });    
});

function changePage(newPage) {
    const menu = document.getElementById("menu");
    const join = document.getElementById("join");
    const main = document.getElementById("main");

    menu.style.display = "none";
    join.style.display = "none";
    main.style.display = "none";

    if (newPage == 'menu') {
        menu.style.display = "flex";
    } else if (newPage == 'join') {
        join.style.display = "flex";
    } else if (newPage == 'main') {
        initMain();
        main.style.display = "grid";
    }
};

function initMain() {
    chrome.storage.sync.get(['partyCode'], function(result) {
        document.getElementById("party-code").innerText = result.partyCode;
    });
}

function joinParty(){
    changePage('join');
    console.log('join party');   
};

function createParty(){
    chrome.runtime.sendMessage({command: "createParty"}, function(response){
        console.log(response);
        if(response.response !== 'success'){
            console.error('Create Party Failed')
        }
        changePage('main');
        console.log('create party');    
    });
};

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
    chrome.runtime.sendMessage({command: "joinParty", partyCode: code}, function(response){
        console.log(response);
    })
    
    //join
}