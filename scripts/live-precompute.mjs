// ═══════════════════════════════════════════════════════════════════════════
// LIVE: PRE-WK — precompute cron entrypoint
// ───────────────────────────────────────────────────────────────────────────
// Loopt 3× per dag (GitHub Actions). Stappen:
//   1. ESPN scoreboard ophalen voor interlands binnen 48 uur
//   2. Voor onbekende landen → OpenAI gpt-4o-mini bevragen (max N per run)
//   3. Schrijven naar Firestore (artifacts/{appId}/public/data/live_*)
//
// Fail-modus: als ESPN faalt → script exit 1, oude Firestore-data blijft staan.
// Als OpenAI faalt voor 1 land → dat land krijgt minimale fallback-data
// (alleen landnaam), match blijft speelbaar met general voetbal-pool.
//
// Reversibility: workflow disablen (.github/workflows/live-precompute.yml)
// stopt verdere writes onmiddellijk. Bestaande Firestore-data weggooien
// kan via Firebase console of `firebase firestore:delete --recursive ...`.
// ═══════════════════════════════════════════════════════════════════════════

import { fetchInterlandMatches } from './lib/espn.mjs';
import { fetchTeamMetadata }     from './lib/openai-team.mjs';
import { ensureLiveConfig, writeMatches, readTeam, writeTeam } from './lib/firestore.mjs';

// ─── Tuning ────────────────────────────────────────────────────────────────
const WINDOW_HOURS         = 48;       // tijd-venster vanaf nu
const TEAM_CACHE_DAYS      = 14;       // her-fetch land hooguit elke 14 dagen
const MAX_OPENAI_PER_RUN   = 15;       // veiligheidsrem: max N nieuwe landen per run
const MAX_MATCHES          = 40;       // safety: kap als ESPN te veel teruggeeft

async function main() {
    const t0 = Date.now();
    console.log('▶ live-precompute start', new Date().toISOString());

    // 0. liveConfig garanderen (default: enabled=false; admin zet handmatig aan)
    await ensureLiveConfig();

    // 1. ESPN fetch
    const now = new Date();
    const until = new Date(now.getTime() + WINDOW_HOURS * 3600 * 1000);
    let matches;
    try {
        matches = await fetchInterlandMatches(now, until);
        console.log(`✔ ESPN: ${matches.length} interlands gevonden`);
    } catch (err) {
        console.error('✘ ESPN-fetch faalde:', err.message);
        process.exit(1);
    }

    // Kap & valideer
    matches = matches.filter(m => m.team1?.fifaCode && m.team2?.fifaCode);
    if (matches.length > MAX_MATCHES) {
        console.warn(`⚠ ${matches.length} > ${MAX_MATCHES}, kap naar ${MAX_MATCHES}`);
        matches = matches.slice(0, MAX_MATCHES);
    }
    if (matches.length === 0) {
        console.log('ℹ Geen interlands binnen window — schrijf lege lijst (client toont "geen wedstrijden").');
        await writeMatches([]);
        return;
    }

    // 2. Unieke FIFA-codes, check cache, fetch ontbrekende landen via OpenAI
    const uniqueCodes = [...new Set(matches.flatMap(m => [m.team1.fifaCode, m.team2.fifaCode]))];
    console.log(`ℹ Landen in window: ${uniqueCodes.length} (${uniqueCodes.join(', ')})`);

    const cacheCutoff = new Date(Date.now() - TEAM_CACHE_DAYS * 86400 * 1000);
    const toFetch = [];

    for (const code of uniqueCodes) {
        const existing = await readTeam(code);
        if (existing && existing.refreshedAt && new Date(existing.refreshedAt) > cacheCutoff) {
            // Vers genoeg, skip
            continue;
        }
        toFetch.push(code);
    }
    console.log(`ℹ Te (her)fetchen: ${toFetch.length} landen`);

    const fetchBudget = Math.min(toFetch.length, MAX_OPENAI_PER_RUN);
    if (toFetch.length > MAX_OPENAI_PER_RUN) {
        console.warn(`⚠ Rate-limit: ${toFetch.length} landen nodig maar slechts ${MAX_OPENAI_PER_RUN} per run. Rest komt volgende cron.`);
    }

    let okCount = 0, failCount = 0;
    for (let i = 0; i < fetchBudget; i++) {
        const code = toFetch[i];
        const sampleMatch = matches.find(m => m.team1.fifaCode === code || m.team2.fifaCode === code);
        const fallbackName = sampleMatch
            ? (sampleMatch.team1.fifaCode === code ? sampleMatch.team1.name : sampleMatch.team2.name)
            : code;
        try {
            const meta = await fetchTeamMetadata(code, fallbackName);
            if (meta) {
                await writeTeam(code, meta);
                console.log(`  ✔ ${code} → ${meta.woorden.length} termen`);
                okCount++;
            } else {
                console.warn(`  ✘ ${code}: geen data (OpenAI uit / parse-fail)`);
                failCount++;
            }
        } catch (err) {
            console.warn(`  ✘ ${code}: ${err.message}`);
            failCount++;
        }
    }

    // 3. Match-lijst schrijven (altijd, ook als sommige landen ontbreken — client heeft fallback)
    await writeMatches(matches);

    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✔ klaar in ${dt}s — matches:${matches.length} teams_fetched:${okCount} fails:${failCount}`);
}

main().catch(err => {
    console.error('✘ FATAL:', err);
    process.exit(1);
});
