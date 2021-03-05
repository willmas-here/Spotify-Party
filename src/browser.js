window.addEventListener('load', function(){
    document.getElementById("back-btn").addEventListener("click", function(){});
    document.getElementById("forward-btn").addEventListener("click", function(){});
    document.getElementById("play-btn").addEventListener("click", togglePlay);

    document.getElementById("search-form").addEventListener("submit", searchSongs);

    document.getElementById("settings-btn").addEventListener("click", openSettings, true);
    document.getElementById("options-btn").addEventListener("click", function(){
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    document.getElementById("menu").style.display = "none";

    // load queue
    chrome.runtime.sendMessage({'command': 'openBrowser'})
});

chrome.runtime.onMessage.addListener(function(msg, sender, response){
    console.log(msg);

    if (msg.command === 'updateQueue'){
        const queueObj = msg.queueObj;
        // delete existing queue
        const queueItems = document.getElementsByClassName('queue-item-container');

        while (queueItems.length > 0) {
            queueItems.item(0).remove();
        }

        // populate queue
        queueObj.forEach((element, i) => {
            let queueItemContainer = document.createElement('div');
            queueItemContainer.className = "queue-item-container";
            queueItemContainer.id = "queue-container-" + decodeURIComponent(element.track_id);

            let queueItemIndex = document.createElement('p');
            queueItemIndex.className = "queue-item index";
            queueItemIndex.innerText = i;

            let queueItemTitle = document.createElement('p');
            queueItemTitle.className = "queue-item title";
            queueItemTitle.innerText = decodeURIComponent(element.title);

            let queueItemArtist = document.createElement('p');
            queueItemArtist.className = "queue-item artist";
            queueItemArtist.innerText = decodeURIComponent(element.artist);

            let queueItemUser = document.createElement('p');
            queueItemUser.className = "queue-item user";
            queueItemUser.innerText = decodeURIComponent(element.user);

            queueItemContainer.appendChild(queueItemIndex);
            queueItemContainer.appendChild(queueItemTitle);
            queueItemContainer.appendChild(queueItemArtist);
            queueItemContainer.appendChild(queueItemUser);

            document.getElementById('queue-container').appendChild(queueItemContainer);
        });
    }
});

function togglePlay(){
    // update firebase play/pause
    // spotify play/pause
}

function searchSongs(e){
    e.preventDefault();
    const query = document.getElementById("search-text").value

    const searchItems = document.getElementsByClassName('results-item container');

    while (searchItems.length > 0) {
        searchItems.item(0).remove();
    }
    
    chrome.runtime.sendMessage({'command': 'spotifySearch', 'query': query}, function(response){
        console.log(response);

        if (response.response !== "success"){
            console.error("Search Failed")
        };

        const searchResults = response.tracks.tracks.items;
        console.log(searchResults);

        const resultsContainer = document.getElementById('results-container');

        searchResults.forEach(element => {
            let resultItemContainer = document.createElement('div');
            resultItemContainer.className = "results-item container";
            resultItemContainer.id = "results-container-" + element.id

            let title = document.createElement('p');
            title.className = "results-item title";
            title.innerText = element.name;

            let artistStr = '';
            for (let index = 0; index < element.artists.length; index++) {
                if (index == 0){
                    artistStr = element.artists[index].name;
                } else {
                    artistStr += ", " + element.artists[index].name;
                }
            }

            let artist = document.createElement('p');
            artist.className = "results-item artist";
            artist.innerText = artistStr;

            let btn = document.createElement('button');
            btn.innerText = "Add";
            btn.className = "results-item add-btn";
            btn.id = "results-btn-" + element.id;

            btn.addEventListener('click', () => addToQueue({
                'artist': artistStr,
                'title': element.name,
                'track_id': element.id
            }))

            resultItemContainer.appendChild(title);
            resultItemContainer.appendChild(artist);
            resultItemContainer.appendChild(btn);
            
            resultsContainer.appendChild(resultItemContainer);
            
        });
    })
}

function addToQueue(trackObj){
    chrome.runtime.sendMessage({'command': 'addToQueue', 'trackObj': trackObj})
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