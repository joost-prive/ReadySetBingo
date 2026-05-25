// ─── ESPN scoreboard wrapper ──────────────────────────────────────────────
// Onge­documenteerd publiek endpoint (geen key, geen quota), dezelfde data
// die op espn.com/soccer/schedule staat. We halen interland-wedstrijden op
// uit twee leagues: 'fifa.friendly' (vriendschappelijke interlands) en
// 'fifa.worldq.uefa' / overige WK-kwalificaties — voor nu alleen friendly,
// breidbaar via LEAGUES-array.
//
// Risico: endpoint kan zonder waarschuwing breken. Caller behoort oude
// Firestore-data te bewaren als fetch faalt.

const LEAGUES = [
    'fifa.friendly',
    'fifa.worldq.uefa',
    'fifa.worldq.concacaf',
    'fifa.worldq.conmebol',
    'fifa.worldq.afc',
    'fifa.worldq.caf',
    'fifa.worldq.ofc',
];

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

/**
 * Haalt interland-wedstrijden binnen het opgegeven window op.
 * @param {Date} fromDate
 * @param {Date} toDate
 * @returns {Promise<Array>} genormaliseerde matches
 */
export async function fetchInterlandMatches(fromDate, toDate) {
    const all = [];
    for (const league of LEAGUES) {
        try {
            const matches = await fetchLeagueScoreboard(league, fromDate, toDate);
            all.push(...matches);
        } catch (err) {
            console.warn(`[espn] league ${league} fetch failed:`, err.message);
        }
    }
    // Dedupliceren op id (sommige matches kunnen via meerdere league-views terugkomen)
    const seen = new Set();
    return all.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    }).sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
}

async function fetchLeagueScoreboard(league, fromDate, toDate) {
    // ESPN-endpoint accepteert ?dates=YYYYMMDD-YYYYMMDD
    const datesParam = `${ymd(fromDate)}-${ymd(toDate)}`;
    const url = `${BASE}/${league}/scoreboard?dates=${datesParam}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'bingego-cron/1.0 (+https://worldcupbingo2026.nl)' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const events = Array.isArray(data.events) ? data.events : [];
    return events.flatMap(ev => normalizeEvent(ev, league)).filter(Boolean);
}

function normalizeEvent(ev, league) {
    try {
        const comp = (ev.competitions && ev.competitions[0]) || {};
        const competitors = comp.competitors || [];
        if (competitors.length !== 2) return null;

        const t1 = parseCompetitor(competitors.find(c => c.homeAway === 'home') || competitors[0]);
        const t2 = parseCompetitor(competitors.find(c => c.homeAway === 'away') || competitors[1]);
        if (!t1 || !t2) return null;

        const kickoffUtc = ev.date || comp.date || null;
        const venue = (comp.venue && (comp.venue.fullName || comp.venue.address?.city)) || '';

        let status = 'SCHEDULED';
        const st = ev.status && ev.status.type && ev.status.type.state;
        if (st === 'in')   status = 'IN_PROGRESS';
        if (st === 'post') status = 'FINISHED';
        if (ev.status && ev.status.type && ev.status.type.name === 'STATUS_POSTPONED') status = 'POSTPONED';

        const competitionName = (ev.league && ev.league.name) ||
                                (ev.league && ev.league.shortName) ||
                                leaguePretty(league);

        return {
            id: 'ESPN-' + ev.id,
            kickoffUtc,
            status,
            competition: competitionName,
            venue,
            team1: t1,
            team2: t2,
            source: 'espn',
        };
    } catch (err) {
        console.warn('[espn] normalize fail:', err.message);
        return null;
    }
}

function parseCompetitor(c) {
    if (!c || !c.team) return null;
    const team = c.team;
    // Voorkeur: 3-letter FIFA-code via abbreviation (vaak ISO-3) of triCode-detectie
    let fifaCode = (team.abbreviation || '').toUpperCase();
    if (!fifaCode || fifaCode.length !== 3) {
        // Fallback: probeer uit team.location of name
        fifaCode = guessFifaCode(team.displayName || team.name || team.location || '');
    }
    return {
        fifaCode: fifaCode || null,
        name:     team.displayName || team.name || team.location || '',
        logo:     team.logo || null,
    };
}

// Mini-fallback voor codes die ESPN soms anders schrijft (uitbreidbaar)
const NAME_TO_FIFA = {
    'Netherlands':'NED', 'Holland':'NED', 'England':'ENG', 'Scotland':'SCO',
    'Germany':'GER', 'Spain':'ESP', 'Portugal':'POR', 'France':'FRA',
    'United States':'USA', 'USA':'USA', 'Mexico':'MEX', 'Canada':'CAN',
    'Belgium':'BEL', 'Italy':'ITA', 'Croatia':'CRO', 'Switzerland':'SUI',
    'Denmark':'DEN', 'Sweden':'SWE', 'Norway':'NOR', 'Poland':'POL',
    'Brazil':'BRA', 'Argentina':'ARG', 'Uruguay':'URU', 'Colombia':'COL',
    'Japan':'JPN', 'South Korea':'KOR', 'Korea Republic':'KOR',
    'Australia':'AUS', 'Iran':'IRN', 'Saudi Arabia':'SAU', 'Qatar':'QAT',
};
function guessFifaCode(name) {
    if (!name) return null;
    if (NAME_TO_FIFA[name]) return NAME_TO_FIFA[name];
    return null;
}

function ymd(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}

function leaguePretty(slug) {
    if (slug === 'fifa.friendly') return 'International Friendly';
    if (slug.startsWith('fifa.worldq.')) return 'World Cup Qualifying';
    return slug;
}
