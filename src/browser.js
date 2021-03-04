window.addEventListener('load', function(){
    document.getElementById("back-btn").addEventListener("click", function(){});
    document.getElementById("forward-btn").addEventListener("click", function(){});
    document.getElementById("play-btn").addEventListener("click", togglePlay);

    document.getElementById("settings-btn").addEventListener("click", openSettings, true);
    document.getElementById("options-btn").addEventListener("click", function(){
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    document.getElementById("menu").style.display = "none";
});

function togglePlay(){
    // update firebase play/pause
    // spotify play/pause
}

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