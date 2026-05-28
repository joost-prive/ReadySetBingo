// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS — generieke GA4 click-tracking via data-attributen
// ───────────────────────────────────────────────────────────────────────────
// Doel: zonder per-knop-code zien wat gebruikers aanklikken (welke tegel,
// welke wedstrijd, welke speelvorm). Hangt aan de al-geladen gtag.js uit
// index.html (G-QC1Q49WDL6).
//
// Gebruik:
//   1) Declaratief — voeg attributen toe op het klikbare element:
//        <div data-track="tile_click" data-track-tile="wk">…</div>
//      Elke `data-track-*` wordt een GA4-event-parameter (kebab→snake_case).
//
//   2) Programmatisch — vanuit JS (bijv. modal-knoppen met dynamische data):
//        window.track('match_action', { action: 'bingo-solo', match_id: 'X' });
//
// Reversibility: bestand kan geheel verwijderd worden + de script-tag in
// index.html + de data-track-* attributen. Dan zijn alle sporen weg.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    function send(name, params) {
        if (typeof window.gtag !== 'function') return;
        try {
            window.gtag('event', name, params || {});
        } catch (e) {
            // Tracking mag nooit de app breken
        }
    }

    // Expose voor programmatische calls (modal-knoppen, async flows, etc.)
    window.track = send;

    // camelCase → snake_case. "trackMatchId" (na strip "track") → "match_id"
    function dataKeyToParam(key) {
        const rest = key.slice(5);
        if (!rest) return null;
        return rest.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }

    // Delegated listener in capture-phase: vangt clicks ook als een inner
    // handler stopPropagation aanroept.
    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-track]');
        if (!el) return;
        const name = el.dataset.track;
        if (!name) return;

        const params = {};
        for (const key in el.dataset) {
            if (key === 'track') continue;
            if (!key.startsWith('track')) continue;
            const paramName = dataKeyToParam(key);
            if (!paramName) continue;
            const value = el.dataset[key];
            if (value === '' || value == null) continue;
            params[paramName] = value;
        }
        send(name, params);
    }, true);
}());
