// ═══════════════════════════════════════════════════════════════════════════
// LIVE: PRE-WK
// ───────────────────────────────────────────────────────────────────────────
// Client-side logica voor de Live: pre-WK feature. Leest interland-wedstrijden
// uit Firestore (geschreven door scripts/live-precompute.mjs via GitHub Actions
// cron), toont ze in screen-live en laat de gebruiker Bingo of BorrelBingo
// spelen met de termen van beide landen.
//
// Reversibility: bestand kan geheel verwijderd worden + de LIVE-FEATURE
// markers in index.html / app.js + Firestore collecties live_config /
// live_matches / live_teams. Dan zijn alle sporen weg.
//
// Aanpak: bij aanklikken van een live-match injecteren we runtime een
// synthetische match in WK_GROEPSWEDSTRIJDEN en de bijbehorende landen in
// WK_TEAMS (alleen als ze er nog niet zijn — bestaande WK-curatie blijft
// onaangeroerd). Daarna hergebruiken we de bestaande WK/Borrel-flows
// (startWkGame, wkOpenCreateModal, bbOpenCreateModal). Geen duplicatie.
// ═══════════════════════════════════════════════════════════════════════════

import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { WK_TEAMS, WK_GROEPSWEDSTRIJDEN, flagSpan } from "./data/wk-data.js";
import { t } from "./i18n/i18n.js";

// ─── State ─────────────────────────────────────────────────────────────────
let _db = null;
let _appId = null;
let _matchesCache = null;        // laatste snapshot van /live_matches/current
let _teamsCache = {};            // FIFA-code → teamdata (geladen uit /live_teams/{code})
let _unsubMatches = null;        // current matches listener
let _unsubConfig = null;         // kill-switch listener

// ─── Helpers ───────────────────────────────────────────────────────────────
function liveDoc(...segments) {
    return doc(_db, 'artifacts', _appId, 'public', 'data', ...segments);
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
        c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function safeId(s) {
    return String(s).replace(/[^A-Za-z0-9_-]/g, '_');
}

function formatKickoff(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return ''; }
}

function statusLabel(status) {
    if (status === 'IN_PROGRESS') return '🔴 LIVE';
    if (status === 'FINISHED')    return 'FT';
    if (status === 'POSTPONED')   return '⏸ Uitgesteld';
    return '';
}

// ─── Boot: kill-switch listener + tegel-zichtbaarheid ─────────────────────
export function liveBootstrap(ctx) {
    if (!ctx || !ctx.db || !ctx.appId) return;
    _db = ctx.db;
    _appId = ctx.appId;

    if (_unsubConfig) { try { _unsubConfig(); } catch {} }

    const cfgRef = liveDoc('live_config', 'main');
    _unsubConfig = onSnapshot(cfgRef, snap => {
        const enabled = snap.exists() && snap.data() && snap.data().enabled === true;
        const tile = document.getElementById('live-tile');
        if (tile) tile.style.display = enabled ? '' : 'none';
    }, err => {
        // Document bestaat nog niet of geen rechten → tegel blijft uit (default).
        console.warn('[live] config snapshot fail:', err && err.message ? err.message : err);
    });
}

// ─── Scherm-init (aangeroepen vanuit goTo-hook in app.js) ─────────────────
window.initLiveScreen = function() {
    const listEl   = document.getElementById('live-matches-list');
    const updateEl = document.getElementById('live-last-update');
    if (!listEl) return;

    listEl.innerHTML = `<div class="live-loading">${escapeHtml(t('live.loading') || 'Wedstrijden laden…')}</div>`;
    if (updateEl) updateEl.textContent = '';

    if (!_db) {
        listEl.innerHTML = `<div class="live-empty">${escapeHtml(t('live.offline') || '⚠ Wedstrijden zijn alleen online beschikbaar.')}</div>`;
        return;
    }

    if (_unsubMatches) { try { _unsubMatches(); } catch {} }

    const matchesRef = liveDoc('live_matches', 'current');
    _unsubMatches = onSnapshot(matchesRef, snap => {
        if (!snap.exists()) {
            _matchesCache = null;
            listEl.innerHTML = `<div class="live-empty">${escapeHtml(t('live.noneNow') || 'Geen interlands binnen 48 uur.')}</div>`;
            if (updateEl) updateEl.textContent = '';
            return;
        }
        _matchesCache = snap.data();
        renderMatches();
    }, err => {
        console.error('[live] matches snapshot fail:', err);
        listEl.innerHTML = `<div class="live-error">${escapeHtml(t('live.error') || 'Wedstrijden ophalen mislukt.')}</div>`;
    });
};

// ─── Render lijst ─────────────────────────────────────────────────────────
function renderMatches() {
    const listEl   = document.getElementById('live-matches-list');
    const updateEl = document.getElementById('live-last-update');
    if (!listEl || !_matchesCache) return;

    if (updateEl) {
        const ts = _matchesCache.lastUpdate;
        if (ts) {
            const d = new Date(ts);
            updateEl.textContent = (t('live.lastUpdate') || 'Bijgewerkt:') + ' ' +
                d.toLocaleString(undefined, { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        } else {
            updateEl.textContent = '';
        }
    }

    const matches = Array.isArray(_matchesCache.matches) ? _matchesCache.matches : [];
    if (matches.length === 0) {
        listEl.innerHTML = `<div class="live-empty">${escapeHtml(t('live.noneNow') || 'Geen interlands binnen 48 uur.')}</div>`;
        return;
    }

    listEl.innerHTML = matches.map(matchItemHtml).join('');
    matches.forEach(m => {
        const el = document.getElementById('live-m-' + safeId(m.id));
        if (el) {
            el.onclick = () => window.liveOpenModal(m.id);
            el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); window.liveOpenModal(m.id); } };
        }
    });
}

function matchItemHtml(m) {
    const t1 = m.team1 || {}, t2 = m.team2 || {};
    const t1flag = flagSpan(t1.fifaCode);
    const t2flag = flagSpan(t2.fifaCode);
    const t1name = escapeHtml(t1.name || t1.fifaCode || '?');
    const t2name = escapeHtml(t2.name || t2.fifaCode || '?');
    const status = statusLabel(m.status);
    const kickoff = formatKickoff(m.kickoffUtc);

    return `
        <div class="live-match-item" id="live-m-${safeId(m.id)}" role="button" tabindex="0">
            <div class="live-match-row">
                <div class="live-match-team">${t1flag} <span class="live-match-team-name">${t1name}</span></div>
                <div class="live-match-vs">vs</div>
                <div class="live-match-team">${t2flag} <span class="live-match-team-name">${t2name}</span></div>
            </div>
            <div class="live-match-meta">
                ${kickoff ? `<span>📅 ${escapeHtml(kickoff)}</span>` : ''}
                ${m.competition ? `<span>🏆 ${escapeHtml(m.competition)}</span>` : ''}
                ${status ? `<span class="live-match-status">${status}</span>` : ''}
            </div>
        </div>
    `;
}

// ─── Modal ────────────────────────────────────────────────────────────────
window.liveOpenModal = function(matchId) {
    if (!_matchesCache) return;
    const m = (_matchesCache.matches || []).find(x => x.id === matchId);
    if (!m) return;

    const t1n = (m.team1 && m.team1.name) || (m.team1 && m.team1.fifaCode) || '?';
    const t2n = (m.team2 && m.team2.name) || (m.team2 && m.team2.fifaCode) || '?';
    document.getElementById('live-match-action-title').textContent = `${t1n}  vs  ${t2n}`;

    const sub = [];
    const k = formatKickoff(m.kickoffUtc);
    if (k) sub.push('📅 ' + k);
    if (m.competition) sub.push('🏆 ' + m.competition);
    if (m.venue) sub.push('📍 ' + m.venue);
    document.getElementById('live-match-action-sub').textContent = sub.join('   ·   ');

    const canMP = typeof window.wkCanMultiplayer === 'function' ? window.wkCanMultiplayer() : false;
    const btnMP = document.getElementById('live-action-bingo-mp');
    btnMP.disabled = !canMP;
    btnMP.title = canMP ? '' : (t('live.mpOffline') || 'Multiplayer vereist een internetverbinding');

    document.getElementById('live-action-bingo-solo').onclick = () => liveStart(m, 'bingo-solo');
    btnMP.onclick = () => { if (canMP) liveStart(m, 'bingo-mp'); };
    document.getElementById('live-action-borrel').onclick = () => liveStart(m, 'borrel');

    document.getElementById('live-match-action-modal').classList.add('show');
};

window.liveCloseModal = function() {
    document.getElementById('live-match-action-modal').classList.remove('show');
};

// ─── Inject runtime team + match data, dan delegate naar bestaande flows ─
async function ensureLiveTeam(teamObj) {
    if (!teamObj || !teamObj.fifaCode) return;
    const code = teamObj.fifaCode;
    if (WK_TEAMS[code]) return;            // bestaande curatie blijft heilig
    if (_teamsCache[code]) {
        WK_TEAMS[code] = _teamsCache[code];
        return;
    }
    try {
        const snap = await getDoc(liveDoc('live_teams', code));
        if (snap.exists()) {
            const d = snap.data() || {};
            const teamData = {
                naam:     d.naam     || teamObj.name || code,
                vlag:     '⚽',                 // niet gebruikt — render via flagSpan
                nickname: d.nickname || '',
                woorden:  Array.isArray(d.woorden) ? d.woorden : []
            };
            _teamsCache[code] = teamData;
            WK_TEAMS[code] = teamData;
            return;
        }
    } catch (err) {
        console.warn('[live] team fetch fail', code, err);
    }
    // Fallback: enkel de naam — match start nog steeds (general pool + naam)
    WK_TEAMS[code] = {
        naam: teamObj.name || code,
        vlag: '⚽',
        nickname: '',
        woorden: [teamObj.name || code]
    };
}

function ensureLiveMatch(m) {
    const syntheticId = 'LIVE-' + m.id;
    if (WK_GROEPSWEDSTRIJDEN.find(x => x.id === syntheticId)) return syntheticId;

    const extra = [];
    if (m.competition) extra.push(m.competition);

    WK_GROEPSWEDSTRIJDEN.push({
        id:    syntheticId,
        fase:  'Interland',
        poule: '',
        team1: m.team1.fifaCode,
        team2: m.team2.fifaCode,
        datum: m.kickoffUtc
            ? new Date(m.kickoffUtc).toLocaleDateString('nl-NL', { day:'numeric', month:'short' })
            : '',
        stad:  m.venue || '',
        extra
    });
    return syntheticId;
}

async function liveStart(m, mode) {
    window.liveCloseModal();

    // Beide teams runtime-laden
    await Promise.all([ ensureLiveTeam(m.team1), ensureLiveTeam(m.team2) ]);
    const syntheticId = ensureLiveMatch(m);

    if (mode === 'bingo-solo') {
        // Direct naar WK-scherm en start de game (selector → game sub-view)
        window.goTo('screen-wk');
        // Klein delay zodat initWkScreen klaar is met renderen, dan game tonen
        setTimeout(() => { try { window.startWkGame(syntheticId); } catch (e) { console.error(e); } }, 0);
    } else if (mode === 'bingo-mp') {
        window.goTo('screen-wk');
        setTimeout(() => { try { window.wkOpenCreateModal(syntheticId); } catch (e) { console.error(e); } }, 0);
    } else if (mode === 'borrel') {
        window.goTo('screen-borrel');
        setTimeout(() => { try { window.bbOpenCreateModal(syntheticId); } catch (e) { console.error(e); } }, 0);
    }
}
