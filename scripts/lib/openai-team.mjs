// ─── OpenAI team-metadata fetcher ─────────────────────────────────────────
// Vraagt gpt-4o-mini om een gestructureerde JSON-respons met de bingo-termen
// voor een land. Mirror van de WK_TEAMS-structuur: 5 spelers, bijnaam,
// hoofdstad, grootste club.
//
// Cost-cap defense in depth:
//   1. Per call gebruiken we max ~500 input + 300 output tokens (gpt-4o-mini)
//   2. Aanroeper rate-limit'd via MAX_CALLS_PER_RUN in precompute-script
//   3. OpenAI project budget hard cap ($2/maand) → laatste vangnet
//
// Response-format: JSON-schema afgedwongen, dus we vertrouwen op valide JSON.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.warn('[openai] OPENAI_API_KEY ontbreekt — team-fetches worden overgeslagen');
}

const SCHEMA = {
    name: 'football_team_bingo_terms',
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['naam', 'nickname', 'hoofdstad', 'club', 'spelers'],
        properties: {
            naam:      { type: 'string', description: 'Landnaam in het Nederlands' },
            nickname:  { type: 'string', description: 'Bijnaam van het nationale elftal in oorspronkelijke taal (bv. "Oranje", "La Roja")' },
            hoofdstad: { type: 'string', description: 'Hoofdstad in het Nederlands' },
            club:      { type: 'string', description: 'De grootste of bekendste voetbalclub uit dit land' },
            spelers: {
                type: 'array',
                description: '5 bekendste huidige nationale-team spelers (voornaam + achternaam, of korte stadionnaam zoals Messi)',
                items: { type: 'string' },
                minItems: 5,
                maxItems: 5,
            },
        },
    },
    strict: true,
};

/**
 * Haalt team-metadata op voor een land via gpt-4o-mini.
 * @param {string} fifaCode   bv. "NED"
 * @param {string} fallbackName  landnaam zoals ESPN 'm geeft (bv. "Netherlands")
 * @returns {Promise<{naam,nickname,hoofdstad,club,spelers,woorden} | null>}
 */
export async function fetchTeamMetadata(fifaCode, fallbackName) {
    if (!OPENAI_API_KEY) return null;

    const prompt = `Geef de bingo-termen voor het nationale voetbalelftal van ${fallbackName || fifaCode} (FIFA-code: ${fifaCode}).
- Spelers: kies 5 momenteel bekende internationals (geen gepensioneerden).
- Nickname: gebruikelijke bijnaam in de oorspronkelijke taal of veelgebruikt in NL media.
- Hoofdstad en grootste/bekendste club: in het Nederlands.
Antwoord strikt volgens het JSON-schema.`;

    const body = {
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'Je bent een voetbal-expert die korte feitelijke bingo-termen levert. Antwoord uitsluitend in valide JSON volgens het schema.' },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        temperature: 0.3,
        max_tokens: 400,
    };

    let res;
    try {
        res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (err) {
        console.warn(`[openai] network fail voor ${fifaCode}:`, err.message);
        return null;
    }

    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.warn(`[openai] ${fifaCode}: HTTP ${res.status} ${txt.slice(0, 200)}`);
        return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        console.warn(`[openai] ${fifaCode}: empty content`);
        return null;
    }

    let parsed;
    try { parsed = JSON.parse(content); }
    catch (err) {
        console.warn(`[openai] ${fifaCode}: JSON parse fail —`, content.slice(0, 200));
        return null;
    }

    // Stel `woorden` samen volgens WK_TEAMS-structuur:
    //  [5 spelers, nickname, hoofdstad, club] → 8 specifieke termen per land
    const spelers   = Array.isArray(parsed.spelers) ? parsed.spelers.slice(0, 5) : [];
    const woorden   = [...spelers];
    if (parsed.nickname)  woorden.push(parsed.nickname);
    if (parsed.hoofdstad) woorden.push(parsed.hoofdstad);
    if (parsed.club)      woorden.push(parsed.club);

    return {
        naam:      parsed.naam      || fallbackName || fifaCode,
        nickname:  parsed.nickname  || '',
        hoofdstad: parsed.hoofdstad || '',
        club:      parsed.club      || '',
        spelers,
        woorden,   // wat live.js straks naar WK_TEAMS[code].woorden mappt
    };
}
