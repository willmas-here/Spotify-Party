window.addEventListener('load', function(){
    document.getElementById("settings-btn").addEventListener("click", openSettings, true);

    document.getElementById("menu").style.display = "none";
})

function openSettings(){
    document.getElementById("menu").style.display = "block";

    document.getElementById("main").addEventListener("click", closeSettings, true);
    console.log('settings opened');
}

function closeSettings(){
    document.getElementById("menu").style.display = "none";
    document.getElementById("main").removeEventListener("click", closeSettings, true);
    console.log('settings closed');
}