export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const playlistId = searchParams.get('id');

    if (!playlistId) {
        return json({ error: 'Ontbrekend playlist ID' }, 400);
    }

    const clientId     = context.env.SPOTIFY_CLIENT_ID;
    const clientSecret = context.env.SPOTIFY_CLIENT_SECRET;
    const refreshToken = context.env.SPOTIFY_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
        return json({ error: 'Spotify credentials niet geconfigureerd' }, 500);
    }

    // Token ophalen: refresh token (gebruiker) heeft voorrang boven client credentials
    let access_token;
    if (refreshToken) {
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type':  'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
            },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                refresh_token: refreshToken,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            return json({ error: `Token refresh mislukt (${res.status}): ${err}` }, 500);
        }
        access_token = (await res.json()).access_token;
    } else {
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type':  'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
            },
            body: 'grant_type=client_credentials',
        });
        if (!res.ok) {
            const err = await res.text();
            return json({ error: `Client credentials mislukt (${res.status}): ${err}` }, 500);
        }
        access_token = (await res.json()).access_token;
    }

    if (!access_token) {
        return json({ error: 'Geen access token ontvangen' }, 500);
    }

    // Playlist ophalen
    const plRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}`,
        { headers: { Authorization: 'Bearer ' + access_token } }
    );

    if (!plRes.ok) {
        const err = await plRes.text();
        return json({ error: `Playlist ophalen mislukt (${plRes.status}): ${err}` }, plRes.status === 404 ? 404 : 502);
    }

    const pl = await plRes.json();

    // Tracks ophalen
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    while (nextUrl) {
        const r = await fetch(nextUrl, { headers: { Authorization: 'Bearer ' + access_token } });
        if (!r.ok) {
            const err = await r.text();
            return json({ error: `Tracks ophalen mislukt (${r.status}): ${err}` }, 502);
        }
        const d = await r.json();
        tracks = tracks.concat((d.items || []).filter(i => i.track?.name && !i.track.is_local));
        nextUrl = d.next || null;
    }

    return json({
        id:     playlistId,
        name:   pl.name,
        image:  pl.images?.[0]?.url || '',
        tracks: tracks.map(i => ({
            name:   i.track.name,
            artist: i.track.artists?.[0]?.name || '',
        })),
    });
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
