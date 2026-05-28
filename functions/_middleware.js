// ─── Cloudflare Pages middleware: SEO/GEO voor WK-domeinen ─────────────────
// Draait vóór elke request. Drie functies:
//   1. /robots.txt, /sitemap.xml en /llms.txt dynamisch per host (WK-only).
//   2. Voor worldcupbingo2026.nl/.com de <head> van index.html verrijken met
//      title, meta description, canonical, hreflang, OG-tags, Twitter-tags
//      en JSON-LD (WebApplication, SportsEvent, FAQPage).
//      Daarnaast wc-mode al server-side op <body> (geen FOUC).
//   3. Een FAQ-blok injecteren in een placeholder (#wc-faq) op de homepage,
//      tegelijk in HTML (subtiel zichtbaar) én als FAQPage JSON-LD.
//
// Niet-WK-domeinen (thuisbingo.nl etc.) blijven volledig ongewijzigd.
// Eén bron-van-waarheid voor de FAQ-content (FAQ-constant hieronder); HTML
// en JSON-LD worden er beide uit gegenereerd zodat ze niet uit elkaar lopen.

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
        faqLabel:    'Veelgestelde vragen',
        homeLabel:   'Home',
        sportsName:  'FIFA Wereldkampioenschap voetbal 2026',
        usaName:     'Verenigde Staten',
    },
    en: {
        title:       'World Cup Bingo 2026 — free online bingo for the FIFA World Cup',
        description: 'Play free World Cup Bingo 2026 during the FIFA World Cup in the USA, Canada and Mexico (June–July 2026). Solo or with friends via room code, no install or account.',
        locale:      'en_US',
        siteName:    'World Cup Bingo 2026',
        lang:        'en',
        faqLabel:    'Frequently asked questions',
        homeLabel:   'Home',
        sportsName:  'FIFA World Cup 2026',
        usaName:     'United States',
    },
};

// ── FAQ-content: bron-van-waarheid voor zowel <dl> in de HTML als FAQPage
//    JSON-LD. Wijzigingen alleen hier doen om drift te voorkomen.
const FAQ = {
    nl: [
        { q: 'Wat is WK Bingo 2026?',
          a: "WK Bingo 2026 is een gratis online bingospel dat je speelt tijdens wedstrijden van het FIFA WK in Verenigde Staten, Canada en Mexico (11 juni – 19 juli 2026). Bij elke wedstrijd krijg je een bingokaart met scenario's die in de wedstrijd kunnen voorkomen." },
        { q: 'Is WK Bingo gratis?',
          a: 'Ja, volledig gratis. Geen abonnement, geen advertenties en geen in-app aankopen.' },
        { q: 'Heb ik een account of installatie nodig?',
          a: 'Nee. WK Bingo werkt direct in je browser op telefoon, tablet en computer. Geen download of registratie nodig.' },
        { q: 'Kan ik met vrienden spelen?',
          a: 'Ja. Eén speler maakt een kamer met een wedstrijd, deelt de 4-cijferige kamercode, en iedereen die de code invult speelt mee op dezelfde wedstrijd met een eigen kaart. Een live leaderboard houdt de stand bij.' },
        { q: "Op welke wedstrijden kun je bingo'en?",
          a: 'Alle 104 wedstrijden van het toernooi — groepsfase, achtste finales, kwartfinales, halve finales, troostfinale en finale. Je kiest een wedstrijd uit het schema en start het spel rond de aftrap.' },
    ],
    en: [
        { q: 'What is World Cup Bingo 2026?',
          a: 'World Cup Bingo 2026 is a free online bingo game you play during matches of the FIFA World Cup in the United States, Canada and Mexico (11 June – 19 July 2026). Each match gives you a bingo card with scenarios that may occur in the game.' },
        { q: 'Is World Cup Bingo free?',
          a: 'Yes, completely free. No subscription, no ads and no in-app purchases.' },
        { q: 'Do I need an account or installation?',
          a: 'No. World Cup Bingo runs directly in your browser on phone, tablet and desktop. No download or registration required.' },
        { q: 'Can I play with friends?',
          a: 'Yes. One player creates a room for a match, shares the 4-digit room code, and everyone who enters the code plays the same match on their own card. A live leaderboard tracks the standings.' },
        { q: 'Which matches can I play bingo on?',
          a: 'All 104 matches of the tournament — group stage, round of 16, quarter-finals, semi-finals, third-place match and final. Pick a match from the schedule and start the game around kick-off.' },
    ],
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

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// JSON in <script type="application/ld+json"> mag geen letterlijke "</" bevatten,
// anders kan de parser het script vroegtijdig sluiten. We vervangen elke "<"
// in de JSON door zijn unicode-escape (backslash-u-0-0-3-c).
function safeJsonScript(obj) {
    const json = JSON.stringify(obj).replace(/</g, '\\u003c');
    return `<script type="application/ld+json">${json}</script>`;
}

function buildJsonLd(m, isCom, canonical, faq) {
    const webApp = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': m.siteName,
        'alternateName': isCom ? 'WK Bingo 2026' : 'World Cup Bingo 2026',
        'url': canonical,
        'description': m.description,
        'applicationCategory': 'GameApplication',
        'operatingSystem': 'Web',
        'browserRequirements': 'Requires JavaScript. Requires HTML5.',
        'inLanguage': isCom ? 'en' : 'nl',
        'isAccessibleForFree': true,
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR' },
        'about': { '@type': 'SportsEvent', 'name': 'FIFA World Cup 2026' },
    };
    const sportsEvent = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        'name': m.sportsName,
        'startDate': '2026-06-11',
        'endDate': '2026-07-19',
        'eventStatus': 'https://schema.org/EventScheduled',
        'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
        'sport': 'Football (Soccer)',
        'location': [
            { '@type': 'Country', 'name': m.usaName },
            { '@type': 'Country', 'name': 'Canada' },
            { '@type': 'Country', 'name': 'Mexico' },
        ],
        'organizer': { '@type': 'Organization', 'name': 'FIFA', 'url': 'https://www.fifa.com/' },
    };
    const faqPage = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': faq.map(({ q, a }) => ({
            '@type': 'Question',
            'name': q,
            'acceptedAnswer': { '@type': 'Answer', 'text': a },
        })),
    };
    return [webApp, sportsEvent, faqPage].map(safeJsonScript).join('\n    ');
}

function headExtras(m, canonical, isCom, faq) {
    return `
    <link rel="preconnect" href="https://images.pexels.com">
    <link rel="preload" as="image" fetchpriority="high" href="https://images.pexels.com/photos/14813312/pexels-photo-14813312.jpeg?auto=compress&cs=tinysrgb&w=1000&h=600">
    <meta name="description" content="${escapeHtml(m.description)}">
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" hreflang="nl"        href="${URL_NL}">
    <link rel="alternate" hreflang="en"        href="${URL_COM}">
    <link rel="alternate" hreflang="x-default" href="${URL_COM}">
    <meta property="og:title"       content="${escapeHtml(m.title)}">
    <meta property="og:description" content="${escapeHtml(m.description)}">
    <meta property="og:url"         content="${canonical}">
    <meta property="og:type"        content="website">
    <meta property="og:locale"      content="${m.locale}">
    <meta property="og:site_name"   content="${escapeHtml(m.siteName)}">
    <meta name="twitter:card"        content="summary_large_image">
    <meta name="twitter:title"       content="${escapeHtml(m.title)}">
    <meta name="twitter:description" content="${escapeHtml(m.description)}">
    ${buildJsonLd(m, isCom, canonical, faq)}
`;
}

function buildFaqInner(m, faq) {
    const items = faq
        .map(({ q, a }) => `<dt>${escapeHtml(q)}</dt><dd>${escapeHtml(a)}</dd>`)
        .join('');
    return `<summary>${escapeHtml(m.faqLabel)}</summary><dl>${items}</dl>`;
}

function buildLlmsTxt(m, isCom, canonical, faq) {
    const otherUrl = isCom ? URL_NL : URL_COM;
    const otherLang = isCom ? 'Dutch' : 'English';
    const faqMd = faq.map(({ q, a }) => `### ${q}\n\n${a}\n`).join('\n');
    return `# ${m.siteName}

> ${m.description}

## About

${m.siteName} is a free, browser-based bingo game built specifically for the FIFA World Cup 2026, hosted by the United States, Canada and Mexico from 11 June to 19 July 2026. Each of the 104 tournament matches has its own bingo card with on-pitch scenarios; players mark squares live during the broadcast.

- URL: ${canonical}
- Languages: Dutch (${URL_NL}), English (${URL_COM})
- Price: Free, no account, no installation, no ads
- Author/operator: Joost van de Ven (independent project)
- Source: https://github.com/joost-prive/ReadySetBingo

## Features

- **Solo mode** — one bingo card per match, played in the browser.
- **Multiplayer rooms** — host creates a room for a specific match and shares a 4-digit code; up to dozens of players can join with their own card. Live leaderboard.
- **All 104 matches** — group stage through final, including all knock-out rounds.
- **Two languages** — Dutch interface on ${URL_NL}, English interface on ${URL_COM}.
- **No registration** — start playing immediately; player name is optional and stored locally.

## Tournament context

- **Event:** FIFA World Cup 2026
- **Dates:** 11 June 2026 – 19 July 2026
- **Hosts:** United States, Canada, Mexico
- **Teams:** 48 nations
- **Format:** Group stage (12 groups of 4) + Round of 32 + Round of 16 + Quarter-finals + Semi-finals + Third-place match + Final

## FAQ

${faqMd}
## Other language

The ${otherLang} version of this site is available at ${otherUrl}.
`;
}

export const onRequest = async (context) => {
    const { request, next } = context;
    const url = new URL(request.url);
    const host = (url.hostname || '').toLowerCase();
    const wc = isWCHost(host);
    const isCom = isComHost(host);
    const m = isCom ? META.en : META.nl;
    const canonical = isCom ? URL_COM : URL_NL;
    const faq = isCom ? FAQ.en : FAQ.nl;

    // ── /robots.txt, /sitemap.xml en /llms.txt dynamisch (WK-only) ──
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
    if (wc && url.pathname === '/llms.txt') {
        return new Response(buildLlmsTxt(m, isCom, canonical, faq), {
            headers: {
                'content-type': 'text/plain; charset=utf-8',
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
                el.append(headExtras(m, canonical, isCom, faq), { html: true });
            },
        })
        // FAQ-placeholder vullen op de homepage. Bestaat het element niet
        // (andere pagina/screen), dan firet de handler simpelweg niet.
        .on('#wc-faq', {
            element(el) {
                el.setInnerContent(buildFaqInner(m, faq), { html: true });
            },
        })
        .transform(response);
};
