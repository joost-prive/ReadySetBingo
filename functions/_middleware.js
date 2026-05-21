// ─── Cloudflare Pages middleware: SEO/GEO voor WK-domeinen ─────────────────
// Draait vóór elke request. Twee functies:
//   1. /robots.txt en /sitemap.xml dynamisch genereren per host (WK-only).
//   2. Voor worldcupbingo2026.nl/.com de <head> van index.html verrijken
//      met title, meta description, canonical, hreflang, OG- en Twitter-tags
//      en vast wc-mode op <body> zetten (voorkomt FOUC + JS-afhankelijkheid
//      voor bots/LLM-crawlers die geen of beperkt JS draaien).
//
// Niet-WK-domeinen (thuisbingo.nl etc.) blijven volledig ongewijzigd.

const WC_NL  = 'worldcupbingo2026.nl';
const WC_COM = 'worldcupbingo2026.com';

const URL_NL  = `https://${WC_NL}/`;
const URL_COM = `https://${WC_COM}/`;

const isWCHost  = (h) => h.endsWith(WC_NL) || h.endsWith(WC_COM);
const isComHost = (h) => h.endsWith(WC_COM);

const META = {
    nl: {
        title:       'WK Bingo 2026 — gratis online bingo bij het FIFA WK',
        description: 'Speel gratis WK Bingo 2026 tijdens het FIFA WK in Verenigde Staten, Canada en Mexico (juni–juli 2026). Solo of met vrienden via kamercode, zonder installatie of account.',
        locale:      'nl_NL',
        siteName:    'WK Bingo 2026',
        lang:        'nl',
    },
    en: {
        title:       'World Cup Bingo 2026 — free online bingo for the FIFA World Cup',
        description: 'Play free World Cup Bingo 2026 during the FIFA World Cup in the USA, Canada and Mexico (June–July 2026). Solo or with friends via room code, no install or account.',
        locale:      'en_US',
        siteName:    'World Cup Bingo 2026',
        lang:        'en',
    },
};

function buildRobots(host) {
    const sitemap = `https://${host}/sitemap.xml`;
    return [
        'User-agent: *',
        'Allow: /',
        '',
        '# Expliciete toestemming voor LLM/AI-search crawlers',
        'User-agent: GPTBot',
        'Allow: /',
        '',
        'User-agent: OAI-SearchBot',
        'Allow: /',
        '',
        'User-agent: ChatGPT-User',
        'Allow: /',
        '',
        'User-agent: PerplexityBot',
        'Allow: /',
        '',
        'User-agent: ClaudeBot',
        'Allow: /',
        '',
        'User-agent: Claude-Web',
        'Allow: /',
        '',
        'User-agent: Google-Extended',
        'Allow: /',
        '',
        'User-agent: Applebot-Extended',
        'Allow: /',
        '',
        `Sitemap: ${sitemap}`,
        '',
    ].join('\n');
}

function buildSitemap() {
    const today = new Date().toISOString().slice(0, 10);
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${URL_NL}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="nl"        href="${URL_NL}"/>
    <xhtml:link rel="alternate" hreflang="en"        href="${URL_COM}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${URL_COM}"/>
  </url>
  <url>
    <loc>${URL_COM}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="nl"        href="${URL_NL}"/>
    <xhtml:link rel="alternate" hreflang="en"        href="${URL_COM}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${URL_COM}"/>
  </url>
</urlset>
`;
}

function headExtras(m, canonical) {
    return `
    <meta name="description" content="${m.description}">
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" hreflang="nl"        href="${URL_NL}">
    <link rel="alternate" hreflang="en"        href="${URL_COM}">
    <link rel="alternate" hreflang="x-default" href="${URL_COM}">
    <meta property="og:title"       content="${m.title}">
    <meta property="og:description" content="${m.description}">
    <meta property="og:url"         content="${canonical}">
    <meta property="og:type"        content="website">
    <meta property="og:locale"      content="${m.locale}">
    <meta property="og:site_name"   content="${m.siteName}">
    <meta name="twitter:card"        content="summary_large_image">
    <meta name="twitter:title"       content="${m.title}">
    <meta name="twitter:description" content="${m.description}">
`;
}

export const onRequest = async (context) => {
    const { request, next } = context;
    const url = new URL(request.url);
    const host = (url.hostname || '').toLowerCase();
    const wc = isWCHost(host);

    // ── /robots.txt en /sitemap.xml dynamisch (alleen op WK-domeinen) ──
    if (wc && url.pathname === '/robots.txt') {
        return new Response(buildRobots(host), {
            headers: {
                'content-type': 'text/plain; charset=utf-8',
                'cache-control': 'public, max-age=3600',
            },
        });
    }
    if (wc && url.pathname === '/sitemap.xml') {
        return new Response(buildSitemap(), {
            headers: {
                'content-type': 'application/xml; charset=utf-8',
                'cache-control': 'public, max-age=3600',
            },
        });
    }

    // ── Doorpakken naar de statische asset ──
    const response = await next();

    // Alleen HTML rewriten op WK-domeinen
    if (!wc) return response;
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return response;

    const isCom = isComHost(host);
    const m = isCom ? META.en : META.nl;
    const canonical = isCom ? URL_COM : URL_NL;

    return new HTMLRewriter()
        .on('html', {
            element(el) {
                if (isCom) el.setAttribute('lang', 'en');
            },
        })
        .on('body', {
            element(el) {
                const cls = el.getAttribute('class') || '';
                const classes = cls.split(/\s+/).filter(Boolean);
                if (!classes.includes('wc-mode')) classes.push('wc-mode');
                el.setAttribute('class', classes.join(' '));
            },
        })
        .on('title', {
            element(el) {
                el.setInnerContent(m.title);
            },
        })
        .on('head', {
            element(el) {
                el.append(headExtras(m, canonical), { html: true });
            },
        })
        .transform(response);
};
