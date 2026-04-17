export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const code  = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
        return html(`<h2>Fout</h2><p>Spotify gaf een fout terug: ${error || 'geen code ontvangen'}</p>`);
    }

    const clientId     = context.env.SPOTIFY_CLIENT_ID;
    const clientSecret = context.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri  = 'https://ready-set-bingo.pages.dev/api/spotify-callback';

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type':  'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
        },
        body: new URLSearchParams({
            grant_type:   'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return html(`<h2>Fout bij token ophalen</h2><pre>${err}</pre>`);
    }

    const { refresh_token } = await tokenRes.json();

    return html(`
        <h2>✅ Gelukt!</h2>
        <p>Kopieer deze refresh token en sla hem op als Cloudflare secret:</p>
        <pre style="background:#f0f0f0;padding:12px;word-break:break-all">${refresh_token}</pre>
        <p>Voer dit commando uit in je terminal:</p>
        <pre style="background:#f0f0f0;padding:12px">wrangler pages secret put SPOTIFY_REFRESH_TOKEN --project-name=ready-set-bingo</pre>
        <p>Plak dan de token hierboven als waarde.</p>
    `);
}

function html(body) {
    return new Response(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px">${body}</body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
    );
}
