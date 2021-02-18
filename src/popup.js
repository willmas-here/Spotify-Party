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
        main.style.display = "grid";
    }
};

function joinParty(){
    changePage('join');
    console.log('join party');   
};

function createParty(){
    // create a room
    // join the room
    changePage('main');
    console.log('create party');    
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

window.addEventListener('load', function(){
    document.getElementById("create-btn").addEventListener("click", createParty);
    document.getElementById("join-btn").addEventListener("click", joinParty);
    document.getElementById("settings-btn").addEventListener("click", openSettings, true);
    
    document.getElementById("settings-menu").style.display = "none";
    changePage('menu');
});