window.addEventListener("load", function(){
    chrome.storage.sync.get(['access_token', 'refresh_token'], function(objects){
        access_token = objects.access_token;
        refresh_token = objects.refresh_token;
    });
    
});

chrome.runtime.onMessage.addListener(function(msg, sender, response){
    console.log(msg);

    if (msg.command === 'spotifySearch'){
        search(msg.query)
        .then(function(tracks){
            response({response: "success", tracks: tracks});
        });

        return true
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
    const scope = 'streaming user-read-playback-state user-modify-playback-state'
    chrome.storage.sync.set({'state': state});

    console.log('verifier:', verifier);
    console.log('challenge:', challenge);
    console.log('state:', state);
    console.log('redirect_uri:', redirect_uri)

    let authURL = new URL('https://accounts.spotify.com/authorize');
    authURL.searchParams.append('client_id', client_id);
    authURL.searchParams.append('response_type', 'code');
    authURL.searchParams.append('redirect_uri', redirect_uri);
    authURL.searchParams.append('code_challenge_method', 'S256');
    authURL.searchParams.append('code_challenge', challenge);
    authURL.searchParams.append('state', state);
    authURL.searchParams.append('scope', scope);

    console.log(authURL.toString());

    chrome.identity.launchWebAuthFlow({'url': authURL.toString(), 'interactive': true}, function(redirect_url){
        console.log(redirect_url);
        if(typeof(redirect_url) === undefined){
            console.error('auth error');
            return;
        }

        // extract token
        var params = redirect_url.replace(chrome.identity.getRedirectURL('spotify_cb/?'), '').split('&');
        console.log(params);

        // check state
        if(params[1].replace('state=', '') !== state){
            // reject request and stop authentication flow
            console.error('state does not match');
            return;
        }

        const code = params[0].replace('code=', '');

        // get access token
        const tokenPromise = fetch('https://accounts.spotify.com/api/token', {
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

        tokenPromise
        .then(response => response.json())
        .then(json => {
            console.log(json);
            access_token = json.access_token;
            refresh_token = json.refresh_token;
            chrome.storage.sync.set({
                access_token: json.access_token,
                refresh_token: json.refresh_token,
            }, function(){
                console.log('tokens saved to storage');
            });
        })
        .catch(error => console.log(error))

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
        chrome.storage.sync.set({
            access_token: json.access_token,
            refresh_token: json.refresh_token,
        }, function(){
            console.log('tokens saved to storage');
        });
    }
}

async function getUserPlayback(){
    let response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + access_token,
        }
    });
    
    if (response.status === 401){
        console.error(await response.json());

        await requestNewToken();

        response = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token,
            }
        });
    }

    const json = await response.json();
    return json;
}

async function startPlayback(uris, position_ms=0){
    let options = {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    }

    if(uris !== undefined){
        options.body = {
            'uris': uris,
            'position_ms': position_ms
        }
    }

    const response = await fetch('https://api.spotify.com/v1/me/player/play', options);

    if (response.status === 401){
        console.error(await response.json());

        await requestNewToken();

        await fetch('https://api.spotify.com/v1/me/player/play', options);
    }
}

async function pausePlayback(){
    const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });

    if (response.status === 401){
        console.error(await response.json());
        
        await requestNewToken();
        
        await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });
    }
}

async function seekPlayback(position_ms){
    let url = new URL('https://api.spotify.com/v1/me/player/seek');
    url.searchParams.append('position_ms', position_ms);

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });

    if (response.status === 401){
        console.error(await response.json());
        await requestNewToken();

        await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        });
    }
}

async function toggleShuffle(toggle=false){
    let url = new URL('https://api.spotify.com/v1/me/player/shuffle');
    url.searchParams.append('state', toggle);
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    });
    if (response.status === 401){
        console.error(await response.json());
        await requestNewToken();

        await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        });
    }
}

async function search(query){
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

    } else if (response.status === 401){
        await requestNewToken()
        response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        });
        return await response.json();
    } else {
        console.error('search fetch error');
    }
}