import { t } from './i18n/i18n.js';

// ─── Panini-dialoog (vervangt alert/confirm/prompt) ───────────────────────
// Heuristiek: leid een passende titel + icoon af uit de boodschap zelf,
// zodat oude alert()-strings zonder aanpassing al een mooie dialoog krijgen.
export function bingoDialogClassify(msg) {
    const m = String(msg || '');
    if (/^fout\b|mislukt|onjuist|verkeerd|fout bij|kan niet/i.test(m))
        return { title: t('dialog.titleError'),   icon: '⚠️', type: 'error' };
    if (/opgeslagen|gelukt|kopieer|gekopieerd|^link gekopi/i.test(m))
        return { title: t('dialog.titleSuccess'), icon: '✅', type: 'success' };
    if (/^geen\b|leeg|niets|onbekend/i.test(m))
        return { title: t('dialog.titleInfo'),    icon: '🤔', type: 'info' };
    if (/^vul\b|^kies\b|^geef\b|^voer\b|eerst|minimaal/i.test(m))
        return { title: t('dialog.titleFill'),    icon: '✏️', type: 'info' };
    return { title: t('dialog.titleDefault'),     icon: '🎯', type: 'info' };
}

let _bingoDialogActive = null;
export function bingoDialogClose(result) {
    const ov = document.getElementById('bingo-dialog-overlay');
    if (!ov) return;
    ov.classList.remove('show');
    if (_bingoDialogActive) {
        const fn = _bingoDialogActive;
        _bingoDialogActive = null;
        fn(result);
    }
}

export function bingoDialog({ message, kind = 'alert', defaultValue = '', title, icon, type, okLabel, cancelLabel }) {
    return new Promise(resolve => {
        const ov   = document.getElementById('bingo-dialog-overlay');
        const dlg  = document.getElementById('bingo-dialog');
        const tEl  = document.getElementById('bingo-dialog-title');
        const iEl  = document.getElementById('bingo-dialog-icon');
        const mEl  = document.getElementById('bingo-dialog-message');
        const inp  = document.getElementById('bingo-dialog-input');
        const acts = document.getElementById('bingo-dialog-actions');
        if (!ov) { resolve(kind === 'confirm' ? false : (kind === 'prompt' ? null : undefined)); return; }

        // Als er al een dialoog open is: sluit die eerst (resolve met null/false/undefined)
        if (_bingoDialogActive) bingoDialogClose(kind === 'confirm' ? false : (kind === 'prompt' ? null : undefined));

        const cls = bingoDialogClassify(message);
        const useTitle = title || cls.title;
        const useIcon  = icon  != null ? icon  : cls.icon;
        const useType  = type  || cls.type;

        dlg.classList.remove('type-error','type-success','type-info');
        dlg.classList.add('type-' + useType);
        tEl.textContent = useTitle;
        if (useIcon) { iEl.textContent = useIcon; iEl.style.display = ''; }
        else { iEl.style.display = 'none'; }
        mEl.textContent = message || '';

        inp.style.display = 'none';
        inp.value = '';
        acts.innerHTML = '';

        const finish = (val) => {
            document.removeEventListener('keydown', onKey, true);
            bingoDialogClose(val);
        };
        _bingoDialogActive = resolve;

        const mkBtn = (label, cssClass, onClick) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = cssClass;
            b.textContent = label;
            b.onclick = onClick;
            return b;
        };

        if (kind === 'prompt') {
            inp.style.display = '';
            inp.value = defaultValue || '';
            setTimeout(() => { inp.focus(); inp.select(); }, 50);
            acts.appendChild(mkBtn(cancelLabel || t('common.cancel'), 'secondary', () => finish(null)));
            acts.appendChild(mkBtn(okLabel || t('common.ok'), 'primary', () => finish(inp.value)));
        } else if (kind === 'confirm') {
            acts.appendChild(mkBtn(cancelLabel || t('common.cancel'), 'secondary', () => finish(false)));
            acts.appendChild(mkBtn(okLabel || t('common.ok'), 'primary', () => finish(true)));
        } else {
            acts.appendChild(mkBtn(okLabel || t('common.ok'), 'primary', () => finish(undefined)));
        }

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(kind === 'confirm' ? false : (kind === 'prompt' ? null : undefined));
            } else if (e.key === 'Enter') {
                // Enter alleen voor alert + prompt; voor confirm laten we expliciete keuze
                if (kind === 'alert') { e.preventDefault(); finish(undefined); }
                else if (kind === 'prompt') { e.preventDefault(); finish(inp.value); }
            }
        };
        document.addEventListener('keydown', onKey, true);

        ov.classList.add('show');
    });
}

// Public helpers
window.bingoAlert   = (msg, opts = {}) => bingoDialog({ message: msg, kind: 'alert',   ...opts });
window.bingoConfirm = (msg, opts = {}) => bingoDialog({ message: msg, kind: 'confirm', ...opts });
window.bingoPrompt  = (msg, def = '', opts = {}) => bingoDialog({ message: msg, kind: 'prompt', defaultValue: def, ...opts });

// Override native alert: alle bestaande alert()-calls krijgen automatisch de Panini-stijl.
window.alert = (msg) => { bingoDialog({ message: String(msg ?? ''), kind: 'alert' }); };

// Klik op overlay-achtergrond sluit dialoog (gedraagt zich als Annuleren / OK voor alert)
(function bindBingoDialogBackdrop() {
    const ov = document.getElementById('bingo-dialog-overlay');
    if (!ov || ov._bound) return;
    ov.addEventListener('click', e => {
        if (e.target.id === 'bingo-dialog-overlay') {
            bingoDialogClose(undefined);
        }
    });
    ov._bound = true;
})();
