// ─── Firebase Admin SDK init + writers ────────────────────────────────────
// Authenticatie via service-account JSON in env-var FIREBASE_SERVICE_ACCOUNT
// (gezet als GitHub Actions secret). Schrijft naar dezelfde Firestore-paden
// die de client leest: artifacts/{appId}/public/data/...

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APP_ID = process.env.LIVE_APP_ID || 'thuisbingo-global';

let _db = null;
export function getDb() {
    if (_db) return _db;

    if (!getApps().length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env-var ontbreekt');
        let creds;
        try { creds = JSON.parse(raw); }
        catch (err) { throw new Error('FIREBASE_SERVICE_ACCOUNT is geen valide JSON: ' + err.message); }
        initializeApp({ credential: cert(creds) });
    }
    _db = getFirestore();
    return _db;
}

function pathDoc(...segments) {
    const db = getDb();
    return db.doc(['artifacts', APP_ID, 'public', 'data', ...segments].join('/'));
}

// ─── liveConfig: kill-switch ──────────────────────────────────────────────
export async function ensureLiveConfig() {
    const ref = pathDoc('live_config', 'main');
    const snap = await ref.get();
    if (!snap.exists) {
        // Eerste run: default = uit. Beheerder zet handmatig op true via Firebase console.
        await ref.set({
            enabled: false,
            lastUpdate: new Date().toISOString(),
            killSwitchNote: 'Zet enabled=true om de Live-tegel zichtbaar te maken. Bij twijfel: terug op false.',
        });
        console.log('[fs] live_config/main aangemaakt met enabled=false');
    }
}

// ─── liveMatches: hele lijst in 1 document ────────────────────────────────
export async function writeMatches(matches) {
    const ref = pathDoc('live_matches', 'current');
    await ref.set({
        matches,
        lastUpdate: new Date().toISOString(),
        count: matches.length,
    });
}

// ─── liveTeams: 1 document per FIFA-code ──────────────────────────────────
export async function readTeam(fifaCode) {
    const ref = pathDoc('live_teams', fifaCode);
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
}

export async function writeTeam(fifaCode, data) {
    const ref = pathDoc('live_teams', fifaCode);
    await ref.set({
        ...data,
        refreshedAt: new Date().toISOString(),
        source: 'openai',
    });
}
