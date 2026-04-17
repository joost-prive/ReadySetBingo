export async function onRequestGet(context) {
    const clientId    = context.env.SPOTIFY_CLIENT_ID;
    const redirectUri = 'https://ready-set-bingo.pages.dev/api/spotify-callback';

    const params = new URLSearchParams({
        client_id:     clientId,
        response_type: 'code',
        redirect_uri:  redirectUri,
        scope:         'playlist-read-private playlist-read-collaborative',
    });

    return Response.redirect(
        'https://accounts.spotify.com/authorize?' + params.toString(),
        302
    );
}
