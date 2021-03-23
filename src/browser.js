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
    document.getElementById('leave-btn').addEventListener('click', function(){
        chrome.runtime.sendMessage({command: 'leaveParty', recipient: 'browser'});
    })

    document.getElementById("menu").style.display = "none";

    // load queue
    chrome.runtime.sendMessage({'command': 'openBrowser', 'recipient': 'firebase'})
});

chrome.runtime.onMessage.addListener(function(msg, sender, response){
    if (msg.recipient === 'browser'){
        console.log(msg);

        if (msg.command === 'updateQueue'){
            updateQueue(msg.queueObj);
            response({'response': 'success'});
        }

        if (msg.command === 'leaveParty'){
            window.close()
            response({'response': 'success'});
        }
    }
});

function togglePlay(){
    chrome.runtime.sendMessage({'command': 'togglePlay', 'recipient': 'firebase'});
}

function searchSongs(e){
    e.preventDefault();
    const query = document.getElementById("search-text").value

    const searchItems = document.getElementsByClassName('results-item container');

    while (searchItems.length > 0) {
        searchItems.item(0).remove();
    }
    
    chrome.runtime.sendMessage({'command': 'spotifySearch', 'recipient': 'spotify', 'query': query}, function(response){
        console.log(response);

        if (response.response !== "success"){
            console.error("Search Failed")
        };

        const searchResults = response.tracks.tracks.items;
        console.log(searchResults);

        const resultsContainer = document.getElementById('results-container');

        searchResults.forEach((element) => {
            let resultItemContainer = document.createElement('div');
            resultItemContainer.className = "results-item container";
            resultItemContainer.id = "results-container-" + element.id

            let title = document.createElement('p');
            title.className = "results-item title";
            title.innerText = element.name;

            let artistStr = element.artists[0].name;
            for (let index = 1; index < element.artists.length; index++) {
                artistStr += ", " + element.artists[index].name;
            }

            let artist = document.createElement('p');
            artist.className = "results-item artist";
            artist.innerText = artistStr;

            let btn = document.createElement('button');
            btn.innerText = "Add";
            btn.className = "results-item add-btn";
            btn.id = "results-btn-" + element.id;

            btn.addEventListener('click', () => addToQueue(element))

            resultItemContainer.appendChild(title);
            resultItemContainer.appendChild(artist);
            resultItemContainer.appendChild(btn);
            
            resultsContainer.appendChild(resultItemContainer);
            
        });
    })
}

function addToQueue(trackObj){
    chrome.runtime.sendMessage({'command': 'addToQueue', 'recipient': 'firebase', 'trackObj': trackObj});
}

function updateQueue(queueObj){
    // delete existing queue
    const queueItems = document.getElementsByClassName('queue-item-container');

    while (queueItems.length > 0) {
        queueItems.item(0).remove();
    }

    // populate queue
    queueObj.forEach((element, i) => {
        let queueItemContainer = document.createElement('div');
        queueItemContainer.className = "queue-item-container";
        queueItemContainer.id = "queue-container-" + element.track_obj.id + '-' + i;

        let queueItemIndex = document.createElement('p');
        queueItemIndex.className = "queue-item index";
        queueItemIndex.innerText = i+1;

        let queueItemTitle = document.createElement('p');
        queueItemTitle.className = "queue-item title";
        queueItemTitle.innerText = element.track_obj.name;

        
        let artistStr = element.track_obj.artists[0].name;
        for (let index = 1; index < element.track_obj.artists.length; index++) {
            artistStr += ", " + element.track_obj.artists[index].name;
        }
        let queueItemArtist = document.createElement('p');
        queueItemArtist.className = "queue-item artist";
        queueItemArtist.innerText = artistStr;

        let queueItemUser = document.createElement('p');
        queueItemUser.className = "queue-item user";
        queueItemUser.innerText = element.user;

        queueItemContainer.appendChild(queueItemIndex);
        queueItemContainer.appendChild(queueItemTitle);
        queueItemContainer.appendChild(queueItemArtist);
        queueItemContainer.appendChild(queueItemUser);

        document.getElementById('queue-container').appendChild(queueItemContainer);
    });
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