export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const playlistId = searchParams.get('id');

    if (!playlistId) {
        return json({ error: 'Ontbrekend playlist ID' }, 400);
    }

    // Haal de publieke Spotify-webpagina op en parse de tracklijst daaruit
    const pageRes = await fetch(`https://open.spotify.com/playlist/${playlistId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        },
    });

    if (!pageRes.ok) {
        return json({ error: `Spotify pagina niet bereikbaar (${pageRes.status})` }, 502);
    }

    const html = await pageRes.text();

    // Spotify rendert data in een __NEXT_DATA__ script-tag
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
        return json({ error: 'Geen trackdata gevonden op Spotify-pagina. Probeer een publieke playlist.' }, 502);
    }

    let data;
    try {
        data = JSON.parse(match[1]);
    } catch {
        return json({ error: 'Kon Spotify-data niet verwerken.' }, 502);
    }

    // Zoek tracks in de geneste JSON-structuur
    const tracks = extractTracks(data);

    if (tracks.length === 0) {
        return json({ error: 'Geen nummers gevonden. Controleer of de playlist publiek is.' }, 404);
    }

    // Naam en afbeelding ophalen
    const name  = findDeep(data, 'name',  v => typeof v === 'string' && v.length > 0) || 'Playlist';
    const image = findDeep(data, 'url',   v => typeof v === 'string' && v.includes('mosaic.scdn.co')) ||
                  findDeep(data, 'url',   v => typeof v === 'string' && v.includes('i.scdn.co')) || '';

    return json({ id: playlistId, name, image, tracks });
}

function extractTracks(obj) {
    const tracks = [];
    const seen   = new Set();

    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }

        // Spotify's track object heeft altijd name + artists
        if (node.name && node.artists && Array.isArray(node.artists)) {
            const key = node.name + '|' + (node.artists[0]?.name || '');
            if (!seen.has(key)) {
                seen.add(key);
                tracks.push({ name: node.name, artist: node.artists[0]?.name || '' });
            }
            return;
        }
        Object.values(node).forEach(walk);
    }

    walk(obj);
    return tracks;
}

function findDeep(obj, key, test) {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
        for (const v of obj) { const r = findDeep(v, key, test); if (r) return r; }
        return null;
    }
    for (const [k, v] of Object.entries(obj)) {
        if (k === key && test(v)) return v;
        const r = findDeep(v, key, test);
        if (r) return r;
    }
    return null;
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
