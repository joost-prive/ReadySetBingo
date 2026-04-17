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
        return json({ error: 'Spotify token ophalen mislukt' }, 500);
    }

    const { access_token } = await tokenRes.json();

    // Playlist ophalen inclusief eerste pagina tracks (vermijdt de /tracks sub-endpoint)
    const plRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}?limit=100`,
        { headers: { Authorization: 'Bearer ' + access_token } }
    );

    if (!plRes.ok) {
        const errText = await plRes.text();
        const status = plRes.status === 404 ? 404 : 502;
        return json({ error: `Afspeellijst ophalen mislukt (${plRes.status}): ${errText}` }, status);
    }

    const pl = await plRes.json();

    // Eerste pagina tracks uit playlist-response
    let tracks = (pl.tracks?.items || []).filter(i => i.track && i.track.name && !i.track.is_local);
    let nextUrl = pl.tracks?.next || null;

    // Vervolgpagina's ophalen indien aanwezig
    while (nextUrl) {
        const r = await fetch(nextUrl, { headers: { Authorization: 'Bearer ' + access_token } });
        if (!r.ok) {
            const errText = await r.text();
            return json({ error: `Tracks ophalen mislukt (${r.status}): ${errText}` }, 502);
        }
        const d = await r.json();
        tracks = tracks.concat((d.items || []).filter(i => i.track && i.track.name && !i.track.is_local));
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
