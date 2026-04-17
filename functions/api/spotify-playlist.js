export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const playlistId = searchParams.get('id');

    if (!playlistId) {
        return json({ error: 'Ontbrekend playlist ID' }, 400);
    }

    const clientId     = context.env.SPOTIFY_CLIENT_ID;
    const clientSecret = context.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return json({ error: 'Spotify credentials niet geconfigureerd' }, 500);
    }

    // Client Credentials token ophalen
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
        },
        body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        return json({ error: `Token mislukt (${tokenRes.status}): ${errText}` }, 500);
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        return json({ error: 'Geen access_token ontvangen', detail: tokenData }, 500);
    }
    const token = tokenData.access_token;

    // Stap 1: playlist-metadata + eerste 100 tracks via fields-parameter
    // (vermijdt de /tracks sub-endpoint die 403 geeft)
    const firstUrl = `https://api.spotify.com/v1/playlists/${playlistId}` +
        `?fields=name%2Cimages%2Ctracks(items(track(name%2Cartists(name)%2Cis_local))%2Cnext%2Ctotal)`;

    const plRes = await fetch(firstUrl, {
        headers: { Authorization: 'Bearer ' + token },
    });

    if (!plRes.ok) {
        const errText = await plRes.text();
        const status = plRes.status === 404 ? 404 : 502;
        return json({ error: `Playlist ophalen mislukt (${plRes.status}): ${errText}` }, status);
    }

    const pl = await plRes.json();

    let tracks = (pl.tracks?.items || []).filter(i => i.track?.name && !i.track.is_local);
    let nextUrl = pl.tracks?.next || null;

    // Vervolgpagina's ophalen via de next-URL die Spotify zelf aanlevert
    while (nextUrl) {
        const r = await fetch(nextUrl, { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) {
            const errText = await r.text();
            return json({ error: `Pagina ophalen mislukt (${r.status}): ${errText}` }, 502);
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
