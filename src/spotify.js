let access_token, refresh_token, last_token_refresh_time, global_device_id, player;

// initialize player
window.onSpotifyWebPlaybackSDKReady = function(){
    player = new Spotify.Player({
        name: 'Music Party',
        getOAuthToken: async cb => {
            await testTokenValidity();
            cb(access_token);
        }
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => { console.error(message); });
    player.addListener('authentication_error', ({ message }) => { console.error(message); });
    player.addListener('account_error', ({ message }) => { console.error(message); });
    player.addListener('playback_error', ({ message }) => { console.error(message); });
    
    // Playback status updates
    player.addListener('player_state_changed', state => {
        console.log(state);
        onPlayerStateChange(state);
    });

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        global_device_id = device_id;
        setRepeat();
        toggleShuffle();
    });

    // not ready
    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
    });

    // connect to player
    player.connect();
};

window.addEventListener("load", function(){
    chrome.storage.sync.get(['access_token', 'refresh_token', 'last_token_refresh_time'], async function(objects){
        access_token = objects.access_token;
        refresh_token = objects.refresh_token;
        last_token_refresh_time = objects.last_token_refresh_time;

        await testTokenValidity();
        
    });
});

chrome.runtime.onMessage.addListener(function(msg, sender, response){
    if (msg.recipient === 'spotify'){
        console.log(msg);

        if (msg.command === 'spotifySearch'){
            search(msg.query)
            .then(function(tracks){
                response({'response': "success", tracks: tracks});
            });

            return true
        }
    }
});

async function spotifyLogin(){
    // code verifier
    function dec2hex(dec) {
        return ('0' + dec.toString(16)).substr(-2)
      }
      
    function generateRandomString() {
    var array = new Uint32Array(56/2);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec2hex).join('');
    }

    // code challenger
    function sha256(plain) { // returns promise ArrayBuffer
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return window.crypto.subtle.digest('SHA-256', data);
      }
      
    function base64urlencode(a) {
        var str = "";
        var bytes = new Uint8Array(a);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return btoa(str)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        }
    
    async function challenge_from_verifier(v) {
        hashed = await sha256(v);
        base64encoded = base64urlencode(hashed);
        return base64encoded;
    }

    function generateState(){
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let array = new Uint8Array(40);
        window.crypto.getRandomValues(array);
        array = array.map(x => validChars.charCodeAt(x % validChars.length));
        const randomState = String.fromCharCode.apply(null, array);
        return randomState;
    }

    
    const verifier = generateRandomString();
    const challenge = await challenge_from_verifier(verifier);
    const redirect_uri = chrome.identity.getRedirectURL('spotify_cb/');
    const state = generateState();
    const client_id = 'a1c309e78e4c4cac8eb5f87d7f74a3c4'
    const scope = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state'
    chrome.storage.sync.set({'state': state});

    console.log({'verifier:': verifier, 'challenge': challenge, 'state': state, 'redirect_uri': redirect_uri});

    let authURL = new URL('https://accounts.spotify.com/authorize');
    authURL.searchParams.append('client_id', client_id);
    authURL.searchParams.append('response_type', 'code');
    authURL.searchParams.append('redirect_uri', redirect_uri);
    authURL.searchParams.append('code_challenge_method', 'S256');
    authURL.searchParams.append('code_challenge', challenge);
    authURL.searchParams.append('state', state);
    authURL.searchParams.append('scope', scope);

    console.log(authURL.toString());

    chrome.identity.launchWebAuthFlow({'url': authURL.toString(), 'interactive': true}, async function(redirect_url){
        // console.log(redirect_url);
        if(typeof(redirect_url) === undefined){
            console.error('auth error');
            return;
        }

        // extract token
        var params = redirect_url.replace(chrome.identity.getRedirectURL('spotify_cb/?'), '').split('&');
        // console.log(params);

        // check state
        if(params[1].replace('state=', '') !== state){
            // reject request and stop authentication flow
            console.error('state does not match');
            return;
        }

        const code = params[0].replace('code=', '');

        // get access token
        const tokenPromise = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: 'client_id=' + client_id +
                '&grant_type=authorization_code' +
                '&code=' + encodeURIComponent(code) +
                '&redirect_uri=' + redirect_uri + 
                '&code_verifier=' + verifier
        });
        
        json = await tokenPromise.json();
        console.log(json);

        access_token = json.access_token;
        refresh_token = json.refresh_token;
        last_token_refresh_time = Date.now() + json.expires_in * 1000;

        chrome.storage.sync.set({
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            last_token_refresh_time: last_token_refresh_time
        }, function(){
            console.log('tokens saved to storage');
        });

        return true
    });
}

async function requestNewToken(){
    let body = new URLSearchParams();
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', refresh_token);
    body.append('client_id', 'a1c309e78e4c4cac8eb5f87d7f74a3c4');

    let json;

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        body: body
    });

    json = await response.json()
    console.log(json)

    if (response.status === 400){
        await spotifyLogin();
        return true
    } else{
        access_token = json.access_token;
        refresh_token = json.refresh_token;
        last_token_refresh_time = Date.now() + json.expires_in * 1000;
        
        chrome.storage.sync.set({
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            last_token_refresh_time: last_token_refresh_time
        }, function(){
            console.log('tokens saved to storage');
        });
    }
}

async function testTokenValidity(){
    if (access_token === undefined || refresh_token === undefined){
        console.log({'access_token': access_token, 'refresh_token': refresh_token});
        await spotifyLogin();
        return;
    } else if (Date.now() >= last_token_refresh_time){
        console.log('requesting new token');
        await requestNewToken();
        return;
    } else {
        console.log('Tokens valid');
        return
    }
}

async function onPlayerStateChange(state){
    // set shuffle and repeat
    if (state.shuffle === true){
        toggleShuffle(false);
    };
    if (state.repeat_mode !== 0){
        setRepeat('off');
    }

    // test if song has ended
    // if (
    //     this.state
    //     && state.track_window.previous_tracks.find(x => x.id === state.track_window.current_track.id)
    //     && !this.state.paused
    //     && state.paused
    //     ) {
    //     console.log('Track ended');
    //     this.setTrackEnd(true);
    //   }
    // this.state = state;
}

async function getUserPlayback(){
    await testTokenValidity();

    let response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + access_token,
        }
    });

    const json = await response.json();
    return json;
}

async function startPlayback(uris, position_ms=0){
    await testTokenValidity();

    let options = {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    }

    if(uris !== undefined){
        options.body = JSON.stringify({
            'uris': uris,
            'position_ms': position_ms
        });
    }

    let url = new URL('https://api.spotify.com/v1/me/player/play');
    url.searchParams.append('device_id', global_device_id);

    console.log(options)

    const response = await fetch(url, options);

    if (response.status === 400){
        console.error(await response.json());
    }
}

async function pausePlayback(){
    await testTokenValidity();
    
    const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });
}

async function seekPlayback(position_ms){
    await testTokenValidity();

    let url = new URL('https://api.spotify.com/v1/me/player/seek');
    url.searchParams.append('position_ms', position_ms);

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });
}

async function toggleShuffle(toggle=false){
    await testTokenValidity();

    let url = new URL('https://api.spotify.com/v1/me/player/shuffle');
    url.searchParams.append('state', toggle);

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });
}

async function setRepeat(state='off'){
    await testTokenValidity();

    let url = new URL('https://api.spotify.com/v1/me/player/repeat');
    url.searchParams.append('state', state);

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });
}

async function search(query){
    await testTokenValidity();

    let url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.append('q', query);
    url.searchParams.append('type', 'track');
    let response;

    response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });

    if (response.status === 200){
        return await response.json();

    } else {
        console.error('search fetch error');
    }
}