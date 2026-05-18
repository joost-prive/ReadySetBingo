// ─── i18n (internationalisatie) ───────────────────────────────────────────
// Minimalistische t()-functie met data-i18n attributen voor HTML en
// directe lookup voor JS. Talen worden lazy ge-importeerd.
//
// Gebruik:
//   t('home.tile.generate')                 // → "Genereer kaarten"
//   t('win.lekker', { name: 'Joost' })       // simple {{var}} interpolatie
//   await setLang('en')                       // wisselt taal en re-rendert DOM
//   applyDomTranslations()                    // vervangt alle [data-i18n] elementen
//
// Strings worden in nl.js / en.js gedefinieerd als geneste objecten;
// punten in de key navigeren door de structuur.

import nl from './nl.js';

const LANGS = {
    nl: () => Promise.resolve({ default: nl }),
    en: () => import('./en.js'),
};

const SUPPORTED = Object.keys(LANGS);
const STORAGE_KEY = 'bingoLang';
const FALLBACK = 'nl';

let currentLang = FALLBACK;
let dict = nl;

function detectInitialLang() {
    // Default = Nederlands. Browser-taal wordt NIET meer gebruikt zodat
    // ook bezoekers met een EN-browser standaard NL te zien krijgen.
    // Alleen een eerdere expliciete keuze (in localStorage) overschrijft dit.
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (e) { /* ignore */ }
    return FALLBACK;
}

function lookup(key) {
    const parts = String(key || '').split('.');
    let node = dict;
    for (const p of parts) {
        if (node && typeof node === 'object' && p in node) node = node[p];
        else return undefined;
    }
    return node;
}

function interpolate(str, vars) {
    if (!vars || typeof str !== 'string') return str;
    return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

/**
 * Vertaal een key. Onbekende keys vallen terug op de key zelf,
 * zodat ontbrekende vertalingen direct zichtbaar zijn.
 */
export function t(key, vars) {
    const val = lookup(key);
    if (val === undefined) return key;
    if (Array.isArray(val)) return val;  // bv. winMessages
    return interpolate(val, vars);
}

export function getLang() { return currentLang; }
export function supportedLangs() { return SUPPORTED.slice(); }

/**
 * Wissel actieve taal. Laadt het JSON-dict lazy en re-rendert
 * alle [data-i18n] elementen + dispatcht 'langchange'-event.
 */
export async function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = FALLBACK;
    if (lang === currentLang) return;
    const mod = await LANGS[lang]();
    dict = mod.default;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    document.documentElement.lang = lang;
    applyDomTranslations();
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

/**
 * Loopt door alle elementen met data-i18n="key" en zet hun .textContent
 * op de vertaling. Voor attributen: data-i18n-attr="placeholder:key,title:key".
 */
export function applyDomTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        const val = t(key);
        if (typeof val === 'string') el.textContent = val;
    });
    root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const spec = el.getAttribute('data-i18n-attr');
        if (!spec) return;
        spec.split(',').forEach(pair => {
            const [attr, key] = pair.split(':').map(s => s.trim());
            if (!attr || !key) return;
            const val = t(key);
            if (typeof val === 'string') el.setAttribute(attr, val);
        });
    });
}

// Init: detecteer taal, set documentation language, en pas DOM aan zodra die er is.
// LET OP: currentLang blijft hier op FALLBACK staan. setLang() moet zelf de
// wisseling doen, anders bailt setLang() vroeg uit met "we zijn al die taal"
// terwijl dict nog op de statische NL-import staat (= UI/switcher-mismatch).
const initialLang = detectInitialLang();
document.documentElement.lang = initialLang;

if (initialLang !== FALLBACK) {
    // Async laden zonder DOM te blokkeren.
    setLang(initialLang).catch(() => { /* val terug op NL */ });
} else {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyDomTranslations());
    } else {
        applyDomTranslations();
    }
}

// Expose voor console / debugging en HTML-handlers.
window.i18n = { t, setLang, getLang, supportedLangs, applyDomTranslations };

// ─── Lang-switch UI ───────────────────────────────────────────────────────
// Auto-bindt de knoppen in <div id="lang-switch"> aan setLang() en houdt
// aria-pressed in sync met de actieve taal.
function bindLangSwitcher() {
    const root = document.getElementById('lang-switch');
    if (!root) return;
    root.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const lang = btn.getAttribute('data-lang');
            if (!lang || lang === currentLang) return;
            await setLang(lang);
        });
    });
    syncLangSwitcher();
    window.addEventListener('langchange', syncLangSwitcher);
}
function syncLangSwitcher() {
    const root = document.getElementById('lang-switch');
    if (!root) return;
    root.querySelectorAll('.lang-btn').forEach(btn => {
        btn.setAttribute('aria-pressed', btn.getAttribute('data-lang') === currentLang ? 'true' : 'false');
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLangSwitcher);
} else {
    bindLangSwitcher();
}
