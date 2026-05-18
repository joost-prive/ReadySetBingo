        import { initializeApp }                                    from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged }
                                                                    from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
        import { getFirestore, doc, onSnapshot, setDoc, getDoc, updateDoc, runTransaction, arrayUnion } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
        import { mulberry32, seededShuffle, strHash, escapeHtml, hexToRgba, compressImage } from "./utils.js";
        import "./dialog.js";  // side-effects: registreert window.bingoAlert/Confirm/Prompt
        import { defaultData, winMessages } from "./data/default-data.js";
        import { FIFA_TO_ISO, flagSpan, WK_TEAMS, WK_GROEPEN, WK_GROEPSWEDSTRIJDEN, WK_KNOCKOUT_WEDSTRIJDEN, teamName, teamWoorden, teamNickname, formatMatchDate, matchFase, translateWord, isVoetbalTerm } from "./data/wk-data.js";
        import { t, setLang, getLang, supportedLangs, applyDomTranslations } from "./i18n/i18n.js";

        // ─── Firebase config ───────────────────────────────────────────────────────
        const manualConfig = {
            apiKey:            "AIzaSyDBbP4qumd_CMTnLr3xKPhyROofHU-AZeo",
            authDomain:        "bingego.firebaseapp.com",
            projectId:         "bingego",
            storageBucket:     "bingego.firebasestorage.app",
            messagingSenderId: "966088068254",
            appId:             "1:966088068254:web:8a234421149fb008b9bf8f"
        };

        // → js/data/default-data.js (defaultData, winMessages)


        // ─── State ────────────────────────────────────────────────────────────────
        let appData = {}, appOrder = [];
        let currentWords = [], winningLines = new Set();
        let db, auth, docRef;
        let isLocalMode = false;
        let refreshesLeft = 3;
        let _currentGameWords = null; // word pool for current game (null = use TV appData)
        const myAppId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'thuisbingo-global';

        // Schermen waarbij de info-knop zichtbaar is
        const TV_SCREENS = new Set(['screen-select', 'screen-game']);

        // ─── Navigatie ────────────────────────────────────────────────────────────
        function switchScreen(id) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            // Info-knop alleen bij TV Bingo
            document.getElementById('btn-info-header')
                    .classList.toggle('visible', TV_SCREENS.has(id));
        }

        window.goHome = () => switchScreen('screen-home');
        window.goTo   = (id) => switchScreen(id);

        // ─── Directe start vanuit localStorage ───────────────────────────────────
        function initFromLocal() {
            isLocalMode = true;
            const saved = localStorage.getItem('bingoData');
            if (saved) {
                try {
                    const p = JSON.parse(saved);
                    appData  = p.programs || defaultData;
                    appOrder = p.order    || Object.keys(appData).sort();
                } catch {
                    appData  = JSON.parse(JSON.stringify(defaultData));
                    appOrder = Object.keys(appData).sort();
                }
            } else {
                appData  = JSON.parse(JSON.stringify(defaultData));
                appOrder = Object.keys(appData).sort();
            }
            populateSelects();
            switchScreen('screen-home');
        }

        // ─── Firebase init (achtergrond, blokkeert UI niet) ───────────────────────
        async function initFirebase() {
            if (!window.location.protocol.startsWith('http')) return; // lokaal bestand
            try {
                const config = typeof window.__firebase_config !== 'undefined'
                    ? JSON.parse(window.__firebase_config) : manualConfig;
                const app = initializeApp(config);
                auth = getAuth(app);
                db   = getFirestore(app);
                docRef = doc(db, 'artifacts', myAppId, 'public', 'data', 'bingeGoV1', 'lists');
                try {
                    if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token)
                        await signInWithCustomToken(auth, window.__initial_auth_token);
                    else
                        await signInAnonymously(auth);
                } catch {
                    // auth mislukt → offline-badge tonen, localStorage blijft actief
                    document.getElementById('offline-badge').style.display = 'inline-block';
                    return;
                }
                onAuthStateChanged(auth, user => { if (user) setupRealtimeListener(); });
            } catch {
                document.getElementById('offline-badge').style.display = 'inline-block';
            }
        }

        function startLocalMode() { /* legacy */ initFromLocal(); }

        function saveToLocal() {
            if (isLocalMode) localStorage.setItem('bingoData', JSON.stringify({ programs: appData, order: appOrder }));
        }

        function setupRealtimeListener() {
            isLocalMode = false; // Firebase is beschikbaar
            document.getElementById('offline-badge').style.display = 'none';
            onSnapshot(docRef, async snap => {
                if (snap.exists()) {
                    const d = snap.data();
                    if (d.programs && d.order) { appData = d.programs; appOrder = d.order; }
                    else {
                        appData  = d.data || defaultData;
                        appOrder = Object.keys(appData).sort();
                        try { await setDoc(docRef, { programs: appData, order: appOrder }); } catch {}
                    }
                } else {
                    appData  = JSON.parse(JSON.stringify(defaultData));
                    appOrder = Object.keys(appData).sort();
                    try { await setDoc(docRef, { programs: appData, order: appOrder }); } catch {}
                }
                populateSelects(); // stil de dropdowns bijwerken, geen schermwissel
            }, err => {
                console.error(err);
                isLocalMode = true;
                document.getElementById('offline-badge').style.display = 'inline-block';
            });
        }

        // ─── Selects vullen ───────────────────────────────────────────────────────
        const programSelect  = document.getElementById('program-select');
        const categorySelect = document.getElementById('category-select');
        const startBtn       = document.getElementById('start-btn');

        function populateSelects() {
            programSelect.innerHTML = `<option value="">${t('tv.choosePgmOpt')}</option>`;
            (appOrder || []).forEach(prog => {
                if (!appData[prog]) return;
                const o = document.createElement('option');
                o.value = o.innerText = prog;
                programSelect.appendChild(o);
            });

            const adminSel   = document.getElementById('admin-prog-select');
            const prevAdmin  = adminSel.value;
            adminSel.innerHTML = `<option value="">${t('admin.newProgramOpt')}</option>`;
            (appOrder || []).forEach(prog => {
                if (!appData[prog]) return;
                const o = document.createElement('option');
                o.value = o.innerText = prog;
                adminSel.appendChild(o);
            });
            if (prevAdmin && appData[prevAdmin]) adminSel.value = prevAdmin;
        }
        window.populateSelects = populateSelects;

        programSelect.addEventListener('change', e => {
            const prog = e.target.value;
            categorySelect.innerHTML = '';
            categorySelect.disabled  = true;
            startBtn.disabled        = true;
            if (!prog || !appData[prog]) return;
            const cats = Object.keys(appData[prog]);
            if (cats.length === 1) {
                const o = document.createElement('option');
                o.value = o.innerText = cats[0];
                categorySelect.appendChild(o);
                categorySelect.value = cats[0];
                startBtn.disabled = false;
            } else {
                const ph = document.createElement('option');
                ph.value = ''; ph.innerText = t('tv.chooseScenarioOpt');
                categorySelect.appendChild(ph);
                cats.forEach(cat => {
                    const o = document.createElement('option');
                    o.value = o.innerText = cat;
                    categorySelect.appendChild(o);
                });
                categorySelect.disabled = false;
            }
        });
        categorySelect.addEventListener('change', e => { startBtn.disabled = !e.target.value; });

        // ─── Game logic ───────────────────────────────────────────────────────────
        window.startGame = function() {
            const tvType = document.getElementById('tv-type-select').value;
            if (tvType === 'eigen' || tvType === 'ingezonden') {
                // Get word pool from the matching card set
                const progSel = document.getElementById(tvType === 'eigen' ? 'tv-eigen-prog-select' : 'tv-ingezonden-prog-select');
                const catSel  = document.getElementById(tvType === 'eigen' ? 'tv-eigen-cat-select'  : 'tv-ingezonden-cat-select');
                const progVal = progSel.value;
                const catVal  = catSel.value;
                if (!progVal || !catVal) { alert(t('tv.errChooseFirst')); return; }
                // Find the matching card set
                const allCards = loadMyCards().filter(cs => cs.soort === 'tv');
                const match = allCards.find(cs => cs.programma === progVal && cs.categorie === catVal);
                if (!match || !match.words || !match.words.length) { alert(t('tv.errNoWords')); return; }
                startGameWithWords(progVal + ' – ' + catVal, match.words);
                return;
            }
            const prog = programSelect.value, cat = categorySelect.value;
            _currentGameWords = null; // TV standaard: use appData
            refreshesLeft = 3; updateRefreshUI();
            generateNewWords(prog, cat);
            document.getElementById('game-title').innerText = prog;
            winningLines.clear();
            document.getElementById('bingo-lines').innerHTML = '';
            switchScreen('screen-game');
        };

        function generateNewWords(prog, cat) {
            let pool = [...appData[prog][cat]];
            while (pool.length < 16) pool = pool.concat(pool);
            const selection = [];
            for (let i = 0; i < 16; i++) {
                const idx = Math.floor(Math.random() * pool.length);
                selection.push(pool[idx]);
                pool.splice(idx, 1);
            }
            currentWords = selection;
            winningLines.clear();
            document.getElementById('bingo-lines').innerHTML = '';
            renderGrid();
        }

        function renderGrid() {
            const grid = document.getElementById('bingo-grid');
            grid.innerHTML = '';
            currentWords.forEach(word => {
                const cell = document.createElement('div');
                cell.className = 'bingo-cell flash';
                cell.innerText = word;
                cell.onclick   = () => toggleCell(cell);
                grid.appendChild(cell);
            });
            setTimeout(() => document.querySelectorAll('.bingo-cell').forEach(c => c.classList.remove('flash')), 500);
        }

        window.refreshCard = function() {
            if (refreshesLeft <= 0) return;
            refreshesLeft--; updateRefreshUI();
            if (_currentGameWords) {
                // Scenario or custom word pool
                let pool = [..._currentGameWords];
                while (pool.length < 16) pool = pool.concat(pool);
                currentWords = pickRandom(pool, 16);
                winningLines.clear();
                document.getElementById('bingo-lines').innerHTML = '';
                renderGrid();
            } else {
                generateNewWords(programSelect.value, categorySelect.value);
            }
        };

        function updateRefreshUI() {
            document.getElementById('shuffle-count').innerText = refreshesLeft;
            document.getElementById('btn-shuffle').disabled    = refreshesLeft <= 0;
        }

        function toggleCell(cell) {
            if (navigator.vibrate) navigator.vibrate(20);
            cell.classList.toggle('checked');
            checkForBingo();
        }

        function checkForBingo() {
            const cells    = document.querySelectorAll('#bingo-grid .bingo-cell');
            const linesEl  = document.getElementById('bingo-lines');
            const size     = 4;
            let newBingo   = false;

            const check = (indices, id, cls) => {
                if (indices.every(i => cells[i].classList.contains('checked')) && !winningLines.has(id)) {
                    winningLines.add(id);
                    newBingo = true;
                    const l = document.createElement('div');
                    l.className = `strike-line ${cls}`;
                    linesEl.appendChild(l);
                }
            };

            for (let i = 0; i < size; i++) {
                check([0,1,2,3].map(j => i*size+j), `row-${i}`, `strike-row-${i}`);
                check([0,1,2,3].map(j => j*size+i), `col-${i}`, `strike-col-${i}`);
            }
            check([0,5,10,15], 'diag-1', 'strike-diag-1');
            check([3,6,9,12],  'diag-2', 'strike-diag-2');

            if (newBingo) {
                if (navigator.vibrate) navigator.vibrate([100,50,100]);
                document.getElementById('bingo-win-msg').innerText =
                    (() => { const wm = t('winMessages'); return wm[Math.floor(Math.random() * wm.length)]; })();
                document.getElementById('bingo-overlay').classList.add('show');
            }
        }

        window.closeOverlay = () => document.getElementById('bingo-overlay').classList.remove('show');
        window.resetGame    = () => switchScreen('screen-select');

        // ─── Admin ────────────────────────────────────────────────────────────────
        window.openAdminLogin = function() {
            document.getElementById('login-overlay').classList.add('show');
            document.getElementById('admin-password').value = '';
            document.getElementById('admin-password').focus();
        };
        window.closeLogin = () => document.getElementById('login-overlay').classList.remove('show');
        window.checkLogin = function() {
            if (document.getElementById('admin-password').value === "poema") {
                closeLogin(); showAdmin();
            } else { alert(t('alerts.passwordWrong')); }
        };

        const adminProgSel  = document.getElementById('admin-prog-select');
        const adminProgInput = document.getElementById('admin-prog-input');
        const adminCatSel   = document.getElementById('admin-cat-select');
        const adminCatInput = document.getElementById('admin-cat-input');
        const wordEditor    = document.getElementById('word-editor');

        function showAdmin() {
            resetAdminInputs(); populateSelects();
            switchScreen('screen-admin');
        }

        window.adminSelectProgram = function() {
            const prog = adminProgSel.value;
            if (!prog) {
                adminProgInput.value = ''; adminProgInput.disabled = false;
                document.getElementById('admin-prog-actions').style.display = 'none';
                document.getElementById('admin-cat-container').style.display = 'block';
                adminCatSel.innerHTML = `<option value="">${t('admin.firstSaveProgram')}</option>`;
                adminCatSel.disabled = true;
                adminCatInput.value = ''; adminCatInput.disabled = false;
                document.getElementById('admin-word-container').style.display = 'block';
                wordEditor.value = '';
            } else {
                adminProgInput.value = prog; adminProgInput.disabled = true;
                document.getElementById('admin-prog-actions').style.display = 'flex';
                document.getElementById('admin-cat-container').style.display = 'block';
                adminCatSel.disabled = false;
                loadAdminCats(prog);
            }
        };

        function loadAdminCats(prog) {
            adminCatSel.innerHTML = `<option value="">${t('admin.newCatOpt')}</option>`;
            adminCatSel.value = ''; adminCatInput.value = ''; adminCatInput.disabled = false;
            document.getElementById('btn-del-cat').style.display = 'none';
            document.getElementById('admin-word-container').style.display = 'block';
            wordEditor.value = '';
            if (appData[prog]) Object.keys(appData[prog]).forEach(cat => {
                const o = document.createElement('option');
                o.value = o.innerText = cat; adminCatSel.appendChild(o);
            });
        }

        window.adminSelectCategory = function() {
            const prog = adminProgSel.value, cat = adminCatSel.value;
            if (!cat) {
                adminCatInput.value = ''; adminCatInput.disabled = false;
                adminCatInput.placeholder = 'Typ naam van nieuwe categorie...';
                adminCatInput.focus();
                document.getElementById('btn-del-cat').style.display = 'none';
                document.getElementById('admin-word-container').style.display = 'block';
                wordEditor.value = '';
            } else {
                adminCatInput.value = cat; adminCatInput.disabled = true;
                document.getElementById('btn-del-cat').style.display = 'inline-block';
                document.getElementById('admin-word-container').style.display = 'block';
                wordEditor.value = (appData[prog][cat] || []).join('\n');
            }
        };

        window.saveAdminData = async function() {
            const prog  = adminProgInput.value.trim();
            const cat   = adminCatInput.value.trim();
            const words = wordEditor.value.split('\n').map(w => w.trim()).filter(Boolean);
            if (!prog || !cat) return alert(t('alerts.fillProgCat'));
            if (!words.length) return alert(t('alerts.fillOneWord'));
            if (!appData[prog]) { appData[prog] = {}; if (!appOrder.includes(prog)) appOrder.push(prog); }
            appData[prog][cat] = words;
            if (isLocalMode) { saveToLocal(); alert(t('alerts.savedLocal')); refreshAdminAfterSave(prog, cat); return; }
            try {
                await setDoc(docRef, { programs: appData, order: appOrder }, { merge: true });
                alert(t('alerts.savedDb'));
                refreshAdminAfterSave(prog, cat);
            } catch(e) { alert(t('alerts.errSave', { msg: e.message })); }
        };

        function refreshAdminAfterSave(prog, cat) {
            populateSelects();
            adminProgSel.value = prog;
            loadAdminCats(prog);
            adminCatSel.value = cat;
            window.adminSelectCategory();
        }

        window.moveProgram = async function(dir) {
            const prog = adminProgSel.value; if (!prog) return;
            const idx  = appOrder.indexOf(prog); if (idx === -1) return;
            if (dir === -1 && idx > 0)                    [appOrder[idx], appOrder[idx-1]] = [appOrder[idx-1], appOrder[idx]];
            else if (dir === 1 && idx < appOrder.length-1) [appOrder[idx], appOrder[idx+1]] = [appOrder[idx+1], appOrder[idx]];
            else return;
            if (isLocalMode) { saveToLocal(); populateSelects(); adminProgSel.value = prog; return; }
            try { await setDoc(docRef, { programs: appData, order: appOrder }, { merge: true }); populateSelects(); adminProgSel.value = prog; }
            catch(e) { alert(t('alerts.errMove', { msg: e.message })); }
        };

        window.deleteProgram = async function() {
            const prog = adminProgSel.value;
            if (!await bingoConfirm(t('admin.delete') + ` "${prog}"?`, { title: t('admin.deleteProgramConfirm'), icon: '🗑️', type: 'error', okLabel: t('admin.deleteAction') })) return;
            delete appData[prog]; appOrder = appOrder.filter(p => p !== prog);
            if (isLocalMode) { saveToLocal(); populateSelects(); resetAdminInputs(); return; }
            await setDoc(docRef, { programs: appData, order: appOrder });
            populateSelects(); resetAdminInputs();
        };

        window.deleteCategory = async function() {
            const prog = adminProgSel.value, cat = adminCatSel.value;
            if (!await bingoConfirm(t('admin.delete') + ` "${cat}"?`, { title: t('admin.deleteCatConfirm'), icon: '🗑️', type: 'error', okLabel: t('admin.deleteAction') })) return;
            delete appData[prog][cat];
            if (isLocalMode) { saveToLocal(); loadAdminCats(prog); return; }
            await setDoc(docRef, { programs: appData, order: appOrder });
            loadAdminCats(prog);
        };

        function resetAdminInputs() {
            adminProgInput.value = ''; adminCatInput.value = ''; wordEditor.value = '';
            document.getElementById('admin-prog-actions').style.display  = 'none';
            document.getElementById('admin-cat-container').style.display  = 'none';
            document.getElementById('admin-word-container').style.display = 'none';
        }

        window.closeAdmin = function() { populateSelects(); switchScreen('screen-select'); };

        // ─── Info overlay ─────────────────────────────────────────────────────────
        window.openInfo  = () => document.getElementById('info-overlay').classList.add('show');
        window.closeInfo = () => document.getElementById('info-overlay').classList.remove('show');

        // ─── Genereer Bingo-kaarten ───────────────────────────────────────────────
        // "Eerste rij" = 1 lijn compleet (hor/vert/diag), "Zesde rij" = 6 lijnen compleet, enz.

        let genGridSize = 4;
        let genMode     = 'print';
        let genAllLines = []; // alle individuele lijnpatronen voor het huidige grid

        const ORDINALS_NL = ['Eerste','Tweede','Derde','Vierde','Vijfde',
                             'Zesde','Zevende','Achtste','Negende','Tiende','Elfde','Twaalfde'];

        // Geeft alle lijnpatronen terug voor een n×n grid (rijen, kolommen, diagonalen)
        function buildAllLines(n) {
            const lines = [];
            for (let r = 0; r < n; r++)
                lines.push(Array.from({length:n}, (_,j) => r*n+j));       // rijen
            for (let c = 0; c < n; c++)
                lines.push(Array.from({length:n}, (_,j) => j*n+c));       // kolommen
            lines.push(Array.from({length:n}, (_,i) => i*n+i));           // diag ↘
            lines.push(Array.from({length:n}, (_,i) => i*n+(n-1-i)));     // diag ↙
            return lines;  // totaal: 2n+2 lijnen
        }

        // Moment waarop een specifieke lijn compleet is (= max oproepnr van die cellen)
        function lineMoment(card, cells, callOrder) {
            return Math.max(...cells.map(i => callOrder[card[i]] ?? Infinity));
        }

        // Moment waarop de k-de lijn compleet is (k=1 = eerste bingo, k=2 = tweede, enz.)
        // Sorteert alle lijn-momenten oplopend en pakt de k-de
        function nthBingoMoment(card, k, callOrder) {
            const moments = genAllLines.map(cells => lineMoment(card, cells, callOrder));
            moments.sort((a, b) => a - b);
            return moments[k - 1] ?? Infinity;
        }

        // Moment waarop alle vakjes zijn afgestreept
        function fullCardMoment(card, callOrder) {
            return Math.max(...card.map(w => callOrder[w] ?? Infinity));
        }

        // Alle trigger-momenten voor een kaart (voor maxSim check)
        function triggerMoments(card, callOrder, cfg) {
            const moments = new Set();
            for (const [typeId, tc] of Object.entries(cfg.types)) {
                if (!tc.active) continue;
                const m = typeId === 'full'
                    ? fullCardMoment(card, callOrder)
                    : nthBingoMoment(card, parseInt(typeId.slice(1)), callOrder);
                if (isFinite(m)) moments.add(m);
            }
            return moments;
        }

        // Herbouw de Type Bingo-tabel op basis van de huidige gridgrootte
        function rebuildTypesTable() {
            genAllLines = buildAllLines(genGridSize);
            const maxLines = genAllLines.length; // 2n+2

            const tbody = document.getElementById('gen-types-tbody');
            tbody.innerHTML = '';

            for (let k = 1; k <= maxLines; k++) {
                const tr = tbody.insertRow();
                tr.innerHTML = `
                    <td>${ORDINALS_NL[k-1]} rij
                        <span style="font-size:.68rem;color:var(--text-muted);">(${k} lijn${k!==1?'en':''} vol)</span>
                    </td>
                    <td style="text-align:center;">
                        <input type="checkbox" class="gen-type-cb" data-type="n${k}" onchange="toggleMinField(this)">
                    </td>
                    <td>
                        <input type="number" id="min-n${k}" min="1" placeholder="–" disabled
                               style="width:78px!important;padding:5px 7px!important;margin:0!important;font-size:.8rem!important;">
                    </td>`;
            }
            // Volle kaart
            const trFull = tbody.insertRow();
            trFull.innerHTML = `
                <td>Volle kaart</td>
                <td style="text-align:center;">
                    <input type="checkbox" class="gen-type-cb" data-type="full" onchange="toggleMinField(this)">
                </td>
                <td>
                    <input type="number" id="min-full" min="1" placeholder="–" disabled
                           style="width:78px!important;padding:5px 7px!important;margin:0!important;font-size:.8rem!important;">
                </td>`;
        }

        window.setGridSize = function(size) {
            genGridSize = size;
            document.querySelectorAll('.gen-tog-btn').forEach(b => {
                if (b.dataset.val === '4' || b.dataset.val === '5')
                    b.classList.toggle('active', b.dataset.val === String(size));
            });
            rebuildTypesTable();
            document.getElementById('gen-words-hint').textContent = `(min. ${size*size} woorden)`;
        };

        window.setGenMode = function(mode) {
            genMode = mode;
            document.querySelectorAll('.gen-tog-btn').forEach(b => {
                if (b.dataset.val === 'print' || b.dataset.val === 'online')
                    b.classList.toggle('active', b.dataset.val === mode);
            });
            updateAntalVis();
        };

        function updateAntalVis() {
            const orderKnown = document.getElementById('gen-order-known').checked;
            const show = genMode === 'print' || (genMode === 'online' && orderKnown);
            document.getElementById('gen-antal-wrap').style.display = show ? 'flex' : 'none';
        }

        window.onOrderKnownChange = function() {
            const on = document.getElementById('gen-order-known').checked;
            document.getElementById('gen-config-panel').style.display = on ? 'block' : 'none';
            updateAntalVis();
        };

        window.toggleMinField = function(cb) {
            const inp = document.getElementById('min-' + cb.dataset.type);
            if (!inp) return;
            inp.disabled = !cb.checked;
            if (!cb.checked) inp.value = '';
        };

        window.toggleMaxBingo = function() {
            const on  = document.getElementById('gen-max-enabled').checked;
            const inp = document.getElementById('gen-max-bingo');
            inp.disabled = !on;
            inp.style.opacity = on ? '1' : '0.35';
        };

        // Kies n willekeurige woorden uit de pool (met herhaling als pool < n)
        // Optioneel: weightFn(word) → gewicht > 0; trekt dan unieke gewogen items.
        function pickRandom(words, n, weightFn) {
            if (!weightFn) {
                let pool = [...words];
                while (pool.length < n) pool = pool.concat(pool);
                const result = [];
                for (let i = 0; i < n; i++) {
                    const idx = Math.floor(Math.random() * pool.length);
                    result.push(pool.splice(idx, 1)[0]);
                }
                return result;
            }
            // Gewogen, zonder teruglegging
            const available = words.map(w => ({ value: w, weight: Math.max(0, weightFn(w)) }));
            const result = [];
            while (result.length < n && available.length > 0) {
                const total = available.reduce((s, it) => s + it.weight, 0);
                if (total <= 0) break;
                let r = Math.random() * total;
                let idx = 0;
                for (let i = 0; i < available.length; i++) {
                    r -= available[i].weight;
                    if (r <= 0) { idx = i; break; }
                }
                result.push(available[idx].value);
                available.splice(idx, 1);
            }
            return result;
        }

        // Gewicht voor WK-bingo: algemene voetbaltermen wegen 0,5 t.o.v. wedstrijdrelevante termen.
        // isVoetbalTerm herkent zowel NL als EN-versie (de pool kan vertaalde woorden bevatten).
        function wkTermWeight(word) {
            return isVoetbalTerm(word, WK_VOETBAL_TERMEN) ? 0.5 : 1;
        }

        // Valideer een kandidaat-kaart tegen alle constraints
        function isValidCard(card, callOrder, cfg, existingSets, bingoCounts) {
            if (cfg.orderKnown) {
                for (const [typeId, tc] of Object.entries(cfg.types)) {
                    if (!tc.active || !tc.minNum) continue;
                    const m = typeId === 'full'
                        ? fullCardMoment(card, callOrder)
                        : nthBingoMoment(card, parseInt(typeId.slice(1)), callOrder);
                    if (m < tc.minNum) return false;
                }
            }
            if (cfg.noSame) {
                if (existingSets.has([...card].sort().join('\x00'))) return false;
            }
            if (cfg.orderKnown && cfg.maxSim > 0) {
                for (const m of triggerMoments(card, callOrder, cfg)) {
                    if ((bingoCounts[m] || 0) + 1 > cfg.maxSim) return false;
                }
            }
            return true;
        }

        // Concrete adviezen bij mislukken
        function buildAdvice(words, cfg, failedAt) {
            const N = words.length;
            const n = genGridSize;
            const maxLines = genAllLines.length;
            const tips = [];

            if (cfg.orderKnown) {
                for (const [typeId, tc] of Object.entries(cfg.types)) {
                    if (!tc.active || !tc.minNum) continue;
                    let expected;
                    if (typeId === 'full') {
                        expected = Math.round(N * 0.94);
                    } else {
                        const k = parseInt(typeId.slice(1));
                        // k-de bingo valt ruwweg op: N · (k + n - 1) / (maxLines + n)
                        expected = Math.round(N * (k + n - 1) / (maxLines + n));
                    }
                    if (tc.minNum > expected) {
                        const label = typeId === 'full' ? 'Volle kaart' : `${ORDINALS_NL[parseInt(typeId.slice(1))-1]} rij`;
                        tips.push(`"${label}": min. ${tc.minNum} is te streng (schatting ~${expected}). Probeer ≤&nbsp;${Math.round(expected * 0.85)}.`);
                    }
                }
                if (cfg.maxSim > 0) {
                    const activeCount = Object.values(cfg.types).filter(t => t.active).length;
                    const rough = Math.ceil(failedAt * activeCount / N) + 1;
                    if (rough > cfg.maxSim)
                        tips.push(`"Max tegelijk bingo" ${cfg.maxSim} is te laag. Met ${failedAt} kaarten en ${activeCount} actieve types, probeer&nbsp;${rough}.`);
                }
            }
            if (N < n * n * 2)
                tips.push(`Meer woorden helpt: nu ${N}, ideaal ≥&nbsp;${n*n*2}.`);
            if (!tips.length)
                tips.push('Versoepel de min-nummers, verhoog max-tegelijk-bingo, of voeg meer woorden toe.');
            return tips;
        }

        window.generateBingoCards = async function() {
            const words = document.getElementById('gen-words').value
                          .split('\n').map(w => w.trim()).filter(Boolean);
            const cellCount = genGridSize * genGridSize;

            if (words.length < cellCount) {
                showGenErr(`Minimaal ${cellCount} woorden nodig voor ${genGridSize}×${genGridSize}. Nu: ${words.length}.`);
                return;
            }

            const orderKnown = document.getElementById('gen-order-known').checked;
            const showAntal  = genMode === 'print' || (genMode === 'online' && orderKnown);
            const numCards   = showAntal
                ? Math.max(1, Math.min(500, parseInt(document.getElementById('gen-num-cards').value) || 10))
                : 1;

            const callOrder = {};
            words.forEach((w, i) => { callOrder[w] = i + 1; });

            const cfg = { orderKnown, noSame: true, maxSim: 0, types: {} };
            if (orderKnown) {
                cfg.noSame = document.getElementById('gen-no-same').checked;
                if (document.getElementById('gen-max-enabled').checked)
                    cfg.maxSim = parseInt(document.getElementById('gen-max-bingo').value) || 2;
                document.querySelectorAll('.gen-type-cb').forEach(cb => {
                    const id  = cb.dataset.type;
                    const inp = document.getElementById('min-' + id);
                    cfg.types[id] = {
                        active: cb.checked,
                        minNum: cb.checked && inp?.value ? parseInt(inp.value) : 0,
                    };
                });
            }

            document.getElementById('gen-progress').style.display = 'block';
            document.getElementById('gen-error').style.display    = 'none';
            document.getElementById('gen-output').style.display   = 'none';
            await new Promise(r => setTimeout(r, 15));

            const MAX_TRIES    = 8000;
            const cards        = [];
            const existingSets = new Set();
            const bingoCounts  = {};

            try {
                for (let c = 0; c < numCards; c++) {
                    if (c % 20 === 0) {
                        document.getElementById('gen-prog-txt').textContent = `${c}/${numCards}`;
                        await new Promise(r => setTimeout(r, 0));
                    }
                    let card = null;
                    for (let t = 0; t < MAX_TRIES; t++) {
                        const cand = pickRandom(words, cellCount);
                        if (isValidCard(cand, callOrder, cfg, existingSets, bingoCounts)) {
                            card = cand; break;
                        }
                    }
                    if (!card) {
                        const tips = buildAdvice(words, cfg, c + 1);
                        showGenErr(
                            `Kon kaart #${c+1} niet genereren na ${MAX_TRIES} pogingen.<br><br>` +
                            `<strong>Suggesties:</strong><br>` +
                            tips.map(t => '• ' + t).join('<br>')
                        );
                        document.getElementById('gen-progress').style.display = 'none';
                        return;
                    }
                    cards.push(card);
                    if (cfg.noSame) existingSets.add([...card].sort().join('\x00'));
                    if (orderKnown && cfg.maxSim > 0) {
                        for (const m of triggerMoments(card, callOrder, cfg))
                            bingoCounts[m] = (bingoCounts[m] || 0) + 1;
                    }
                }
            } catch(e) {
                showGenErr('Fout: ' + e.message);
                document.getElementById('gen-progress').style.display = 'none';
                return;
            }

            document.getElementById('gen-progress').style.display = 'none';
            renderGenCards(cards);
        };

        function showGenErr(html) {
            const el = document.getElementById('gen-error');
            el.innerHTML = '⚠️ ' + html;
            el.style.display = 'block';
        }

        // ─── Kaartthema's ────────────────────────────────────────────────────────

        const BUILTIN_THEMES = [
            { id:'default', name:'Standaard',    bg:null,      cellBg:null,      cellColor:null,      headColor:null,     builtIn:true },
            { id:'hitsig',  name:'Paars', bg:'#9F1F96', cellBg:'#FFFFFF', cellColor:'#351C75', headColor:'#FFFFFF', builtIn:true },
            { id:'nacht',   name:'Nacht',        bg:'#1a1a2e', cellBg:'#FFFFFF', cellColor:'#1a1a2e', headColor:'#FFFFFF', builtIn:true },
        ];

        let _activeThemeId = localStorage.getItem('genTheme') || 'default';

        function getThemes() {
            const custom = JSON.parse(localStorage.getItem('bingoThemes') || '[]');
            return [...BUILTIN_THEMES, ...custom];
        }

        function getActiveTheme() {
            return getThemes().find(t => t.id === _activeThemeId) || BUILTIN_THEMES[0];
        }

        function setActiveTheme(id) {
            _activeThemeId = id;
            localStorage.setItem('genTheme', id);
            renderThemePicker();
        }

        let _currentThemeTab = 'standaard';

        window.setThemeTab = function(tab) {
            _currentThemeTab = tab;
            ['standaard','eigen','ingezonden'].forEach(t => {
                const btn = document.getElementById('theme-tab-btn-' + t);
                if (btn) btn.classList.toggle('active', t === tab);
            });
            renderThemePicker();
        };

        function buildMiniCard(theme) {
            const bg        = theme.bg        || '#f3f0ff';
            const cellBg    = theme.cellBg    || '#ffffff';
            const cellColor = theme.cellColor || '#333';
            const headColor = theme.headColor || '#fff';
            const title     = theme.title     || theme.name;
            const subtitle  = theme.subtitle  || '';
            const footer    = theme.footer    || '';
            const isActive  = theme.id === _activeThemeId;

            const cells = Array(8).fill(0).map(() =>
                `<div class="theme-mini-card-cell" style="background:${cellBg};"></div>`
            ).join('');

            return `<div class="theme-mini-card${isActive ? ' selected' : ''}"
                         style="background:${bg};"
                         onclick="selectThemeFromPicker('${theme.id}')">
                        <div class="theme-mini-card-header" style="background:${bg};color:${headColor};">
                            <div class="theme-mini-card-title">${title}</div>
                            ${subtitle ? `<div class="theme-mini-card-sub">${subtitle}</div>` : ''}
                        </div>
                        <div class="theme-mini-card-grid">${cells}</div>
                        ${footer ? `<div class="theme-mini-card-footer" style="background:${bg};color:${headColor};">${footer}</div>` : ''}
                        <div class="theme-mini-card-name" style="background:rgba(0,0,0,.07);color:${bg === '#f3f0ff' ? '#333' : headColor};display:flex;align-items:center;justify-content:space-between;gap:4px;">
                            <span>${theme.name}</span>
                            <div style="display:flex;gap:3px;">
                                ${theme.builtIn
                                    ? `<button onclick="event.stopPropagation();openInlineThemeForm('${theme.id}',true)" style="width:auto;padding:2px 6px;font-size:.6rem;margin:0;border-radius:4px;">✏️ Aanpassen</button>`
                                    : `<button onclick="event.stopPropagation();openInlineThemeForm('${theme.id}',false)" style="width:auto;padding:2px 6px;font-size:.6rem;margin:0;border-radius:4px;">✏️</button>
                                       <button onclick="event.stopPropagation();deleteTheme('${theme.id}')" style="width:auto;padding:2px 6px;font-size:.6rem;margin:0;background:rgba(255,51,51,.15);color:#e05555;border-radius:4px;">🗑</button>`
                                }
                            </div>
                        </div>
                    </div>`;
        }

        function renderThemePicker() {
            const grid  = document.getElementById('gen-theme-grid');
            const empty = document.getElementById('gen-theme-empty');
            if (!grid) return;

            const custom = JSON.parse(localStorage.getItem('bingoThemes') || '[]');

            let themes = [];
            if (_currentThemeTab === 'standaard') {
                themes = BUILTIN_THEMES;
            } else if (_currentThemeTab === 'eigen') {
                themes = custom;
            }

            grid.innerHTML = themes.map(t => buildMiniCard(t)).join('');
            if (empty) empty.style.display = themes.length ? 'none' : '';

            // Voeg "+ Nieuw" knop toe onderaan bij Eigen-tab (verwijder eerst eventuele oude)
            const oldAddBtn = document.getElementById('gen-theme-add-btn');
            if (oldAddBtn) oldAddBtn.remove();
            if (_currentThemeTab === 'eigen') {
                const addBtn = document.createElement('button');
                addBtn.id = 'gen-theme-add-btn';
                addBtn.style.cssText = 'width:100%;margin-top:4px;padding:8px;font-size:.78rem;background:rgba(255,255,255,.08);color:var(--text-muted);border-radius:8px;';
                addBtn.textContent = '+ Nieuw eigen thema';
                addBtn.onclick = () => openInlineThemeForm(null);
                grid.parentElement.insertBefore(addBtn, grid.nextSibling);
            }
        }

        window.selectThemeFromPicker = function(id) {
            setActiveTheme(id);
            // Pre-vul generator-tekstvelden met thema-standaardteksten (alleen als veld nog leeg is)
            const theme = getThemes().find(t => t.id === id);
            if (theme) {
                const titleEl    = document.getElementById('gen-design-title');
                const subtitleEl = document.getElementById('gen-design-subtitle');
                const footerEl   = document.getElementById('gen-design-footer');
                if (titleEl    && !titleEl.value    && theme.title)    titleEl.value    = theme.title;
                if (subtitleEl && !subtitleEl.value && theme.subtitle) subtitleEl.value = theme.subtitle;
                if (footerEl   && !footerEl.value   && theme.footer)   footerEl.value   = theme.footer;
            }
            renderThemePicker();
        };

        window.updateActiveThemePreview = function() { /* niet meer nodig */ };

        // Sluit het inline themaformulier en herstel de koptekst-box
        window.closeInlineThemeForm = function() {
            const form = document.getElementById('theme-form');
            const wrap = document.getElementById('gen-theme-form-wrap');
            if (form) form.style.display = 'none';
            if (wrap) {
                wrap.style.display = 'none';
                // Zet het form terug naar screen-themes zodat het daar ook werkt
                const st = document.getElementById('screen-themes');
                if (st && form) st.appendChild(form);
            }
            const kb = document.getElementById('gen-koptekst-box');
            if (kb) kb.style.display = '';
            renderGenPreview();
        };

        // Inline thema-formulier openen vanuit de picker
        window.openInlineThemeForm = function(id, copyFromBuiltin = false) {
            const wrap = document.getElementById('gen-theme-form-wrap');
            if (!wrap) return;

            // Verberg koptekst-box zodat teksten niet dubbel lijken
            const kb = document.getElementById('gen-koptekst-box');
            if (kb) kb.style.display = 'none';

            // Verplaats het theme-form (dat normaal in screen-themes staat) naar de wrap
            const form = document.getElementById('theme-form');
            if (form) {
                wrap.innerHTML = '';
                wrap.appendChild(form);
                wrap.style.display = '';
                form.style.display = 'block';
            }

            if (copyFromBuiltin) {
                openThemeForm(id);
                _editingThemeId = null;
                const formTitle = document.getElementById('theme-form-title');
                if (formTitle) formTitle.textContent = 'Aanpassen als Eigen thema';
            } else {
                openThemeForm(id);
            }

            wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        function renderThemePills() {
            renderThemePicker();
        }

        function renderThemeList() {
            const list = document.getElementById('theme-list');
            if (!list) return;
            list.innerHTML = '';
            getThemes().forEach(theme => {
                const item = document.createElement('div');
                item.className = 'theme-item';
                item.innerHTML = `
                    <div class="theme-item-swatch" style="background:${theme.bg || 'rgba(255,255,255,.08)'};"></div>
                    <span class="theme-item-name">${theme.name}</span>
                    ${!theme.builtIn
                        ? `<button onclick="openThemeForm('${theme.id}')" style="width:auto;padding:5px 10px;font-size:.72rem;margin:0;background:rgba(255,255,255,.08);color:var(--text-muted);border-radius:6px;">✏️</button>
                           <button onclick="deleteTheme('${theme.id}')" style="width:auto;padding:5px 10px;font-size:.72rem;margin:0;background:rgba(255,51,51,.15);color:#fca5a5;border-radius:6px;">🗑</button>`
                        : `<span style="font-size:.6rem;color:var(--text-muted);padding:3px 7px;background:rgba(255,255,255,.06);border-radius:4px;">Ingebouwd</span>`
                    }`;
                list.appendChild(item);
            });
        }

        let _editingThemeId = null;

        // ─── Thema afbeeldingen ───────────────────────────────────────────────────

        let _themeImages = [];
        let _cardBgImage = null;

        // hexToRgba, compressImage → utils.js

        function initThemeImgPreview() {
            const preview = document.getElementById('theme-img-preview');
            if (!preview) return;
            const bgColor = document.getElementById('tf-bg').value;
            preview.style.background = bgColor;
            if (_cardBgImage) {
                preview.style.backgroundImage = `url(${_cardBgImage})`;
                preview.style.backgroundSize = 'cover';
                preview.style.backgroundPosition = 'center';
            } else {
                preview.style.backgroundImage = '';
            }
            const body = document.getElementById('theme-img-grid-body');
            body.innerHTML = '';
            body.style.gridTemplateColumns = 'repeat(4,1fr)';
            for (let i = 0; i < 16; i++) {
                const cell = document.createElement('div');
                cell.className = 'theme-img-grid-cell';
                body.appendChild(cell);
            }
            preview.querySelectorAll('.theme-img-handle').forEach(el => el.remove());
            _themeImages.forEach(img => addImgHandle(preview, img));
        }

        function addImgHandle(preview, imgData) {
            const handle = document.createElement('div');
            handle.className = 'theme-img-handle';
            handle.style.cssText = `left:${imgData.x}%;top:${imgData.y}%;width:${imgData.w}%;`;
            const imgEl = document.createElement('img');
            imgEl.src = imgData.src;
            imgEl.draggable = false;
            imgEl.style.transform = `rotate(${imgData.deg || 0}deg)`;
            imgEl.style.transformOrigin = 'center center';
            handle.appendChild(imgEl);

            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                handle.setPointerCapture(e.pointerId);
                const pRect = preview.getBoundingClientRect();
                const hRect = handle.getBoundingClientRect();
                const ox = e.clientX - hRect.left;
                const oy = e.clientY - hRect.top;

                const onMove = (ev) => {
                    const pW = pRect.width, pH = pRect.height;
                    const iW = handle.offsetWidth, iH = handle.offsetHeight;
                    let nx = Math.max(0, Math.min(ev.clientX - pRect.left - ox, pW - iW));
                    let ny = Math.max(0, Math.min(ev.clientY - pRect.top  - oy, pH - iH));
                    handle.style.left = (nx / pW * 100) + '%';
                    handle.style.top  = (ny / pH * 100) + '%';
                };
                const onUp = () => {
                    const d = _themeImages.find(i => i.id === imgData.id);
                    if (d) { d.x = parseFloat(handle.style.left); d.y = parseFloat(handle.style.top); }
                    handle.removeEventListener('pointermove', onMove);
                    handle.removeEventListener('pointerup',   onUp);
                };
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup',   onUp);
            });

            preview.appendChild(handle);
        }

        window.updateThemePreviewBg = function(val) {
            const p = document.getElementById('theme-img-preview');
            if (p) p.style.background = val;
        };

        window.updateThemePreviewTexts = function() {
            const hdr = document.querySelector('#theme-img-preview .theme-img-grid-header');
            const ftr = document.querySelector('#theme-img-preview .theme-img-grid-footer');
            const title    = document.getElementById('tf-title')?.value || '';
            const subtitle = document.getElementById('tf-subtitle')?.value || '';
            const footer   = document.getElementById('tf-footer')?.value || '';
            const headColor = document.getElementById('tf-headColor')?.value || '#ffffff';
            if (hdr) {
                hdr.style.color = headColor;
                hdr.innerHTML = title
                    ? `<div style="font-size:.55rem;font-weight:800;line-height:1.2;">${title}</div>${subtitle ? `<div style="font-size:.42rem;opacity:.8;">${subtitle}</div>` : ''}`
                    : '';
            }
            if (ftr) {
                ftr.style.color = headColor;
                ftr.innerHTML = footer
                    ? `<div style="font-size:.45rem;font-weight:700;">${footer}</div>`
                    : '';
            }
        };

        window.uploadCardBgImage = function() {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    compressImage(ev.target.result, file.type, (src) => {
                        _cardBgImage = src;
                        updateCardBgUI();
                        initThemeImgPreview();
                    });
                };
                reader.readAsDataURL(file);
            };
            input.click();
        };

        window.clearCardBgImage = function() {
            _cardBgImage = null;
            updateCardBgUI();
            initThemeImgPreview();
        };

        function updateCardBgUI() {
            const preview = document.getElementById('tf-cardbg-preview');
            const clearBtn = document.getElementById('tf-cardbg-clear');
            const opRow = document.getElementById('tf-cellopacity-row');
            if (preview) preview.style.backgroundImage = _cardBgImage ? `url(${_cardBgImage})` : '';
            if (preview) preview.style.backgroundSize = 'cover';
            if (clearBtn) clearBtn.style.display = _cardBgImage ? '' : 'none';
            if (opRow) opRow.style.display = _cardBgImage ? '' : 'none';
        }

        window.addThemeImage = function() {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    compressImage(ev.target.result, file.type, (src, ar) => {
                        const imgData = { id: 'ti_' + Date.now(), src, x: 5, y: 5, w: 30, ar, deg: 0 };
                        _themeImages.push(imgData);
                        const preview = document.getElementById('theme-img-preview');
                        addImgHandle(preview, imgData);
                        renderThemeImgList();
                    });
                };
                reader.readAsDataURL(file);
            };
            input.click();
        };

        function renderThemeImgList() {
            const list = document.getElementById('tf-img-list');
            if (!list) return;
            list.innerHTML = '';
            if (!_themeImages.length) {
                list.innerHTML = '<p style="font-size:.75rem;color:var(--text-muted);margin:0 0 8px;">Sleep afbeeldingen in de preview om ze te positioneren.</p>';
                return;
            }
            _themeImages.forEach(img => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
                row.innerHTML = `
                    <img src="${img.src}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;transform:rotate(${img.deg||0}deg);">
                    <div style="flex:1;">
                        <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:2px;">Grootte: <span id="sz-${img.id}">${Math.round(img.w)}</span>% &nbsp;·&nbsp; Hoek: <span id="rot-${img.id}">${Math.round(img.deg||0)}</span>°</div>
                        <input type="range" min="5" max="85" value="${img.w}"
                               oninput="resizeThemeImage('${img.id}',this.value)"
                               style="width:100%;margin:0 0 4px;padding:0;height:16px;">
                        <input type="range" min="-180" max="180" value="${img.deg||0}"
                               oninput="rotateThemeImage('${img.id}',this.value)"
                               style="width:100%;margin:0;padding:0;height:16px;">
                    </div>
                    <button onclick="removeThemeImage('${img.id}')" style="width:auto;padding:5px 8px;font-size:.72rem;margin:0;background:rgba(255,51,51,.15);color:#fca5a5;border-radius:6px;">🗑</button>`;
                list.appendChild(row);
            });
        }

        window.resizeThemeImage = function(id, val) {
            const img = _themeImages.find(i => i.id === id);
            if (!img) return;
            img.w = parseFloat(val);
            const lbl = document.getElementById('sz-' + id);
            if (lbl) lbl.textContent = Math.round(val);
            const preview = document.getElementById('theme-img-preview');
            if (preview) {
                const handle = preview.querySelector(`[data-imgid="${id}"]`);
                if (handle) handle.style.width = val + '%';
            }
            // Re-render handle with updated width via data attribute approach
            preview.querySelectorAll('.theme-img-handle').forEach((h, i) => {
                if (_themeImages[i]?.id === id) h.style.width = val + '%';
            });
        };

        window.rotateThemeImage = function(id, val) {
            const img = _themeImages.find(i => i.id === id);
            if (!img) return;
            img.deg = parseFloat(val);
            const lbl = document.getElementById('rot-' + id);
            if (lbl) lbl.textContent = Math.round(val) + '°';
            const preview = document.getElementById('theme-img-preview');
            if (preview) {
                preview.querySelectorAll('.theme-img-handle').forEach((h, idx) => {
                    if (_themeImages[idx]?.id === id) {
                        const imgEl = h.querySelector('img');
                        if (imgEl) imgEl.style.transform = `rotate(${val}deg)`;
                    }
                });
            }
        };

        window.removeThemeImage = function(id) {
            _themeImages = _themeImages.filter(i => i.id !== id);
            initThemeImgPreview();
            renderThemeImgList();
        };

        // ─────────────────────────────────────────────────────────────────────────

        window.openThemeForm = function(id) {
            _editingThemeId = id;
            const theme = id ? getThemes().find(t => t.id === id) : null;
            document.getElementById('tf-name').value = theme?.name || '';
            document.getElementById('tf-bg').value = theme?.bg || '#9F1F96';
            document.getElementById('tf-cellBg').value = theme?.cellBg || '#FFFFFF';
            document.getElementById('tf-cellColor').value = theme?.cellColor || '#351C75';
            document.getElementById('tf-headColor').value = theme?.headColor || '#FFFFFF';
            document.getElementById('tf-title').value    = theme?.title    || '';
            document.getElementById('tf-subtitle').value = theme?.subtitle || '';
            document.getElementById('tf-footer').value   = theme?.footer   || '';
            document.getElementById('theme-form-title').textContent = id ? 'Thema bewerken' : 'Nieuw thema';
            _themeImages = theme?.images ? JSON.parse(JSON.stringify(theme.images)) : [];
            _cardBgImage = theme?.cardBgImage || null;
            const opSlider = document.getElementById('tf-cell-opacity');
            const opLbl    = document.getElementById('tf-cell-opacity-lbl');
            if (opSlider) { const op = theme?.cellBgOpacity ?? 100; opSlider.value = op; if (opLbl) opLbl.textContent = op + '%'; }
            setTimeout(() => updateCardBgUI(), 60);
            const form = document.getElementById('theme-form');
            form.style.display = 'block';
            form.scrollIntoView({ behavior:'smooth', block:'start' });
            setTimeout(() => { initThemeImgPreview(); renderThemeImgList(); updateThemePreviewTexts(); }, 50);
        };

        window.saveThemeForm = function() {
            const name = document.getElementById('tf-name').value.trim();
            if (!name) { alert(t('alerts.themeName')); return; }
            const custom = JSON.parse(localStorage.getItem('bingoThemes') || '[]');
            const newTheme = {
                id:        _editingThemeId || ('c_' + Date.now()),
                name,
                bg:        document.getElementById('tf-bg').value,
                cellBg:    document.getElementById('tf-cellBg').value,
                cellColor: document.getElementById('tf-cellColor').value,
                headColor: document.getElementById('tf-headColor').value,
                title:     document.getElementById('tf-title').value.trim(),
                subtitle:  document.getElementById('tf-subtitle').value.trim(),
                footer:    document.getElementById('tf-footer').value.trim(),
                images:       _themeImages,
                cardBgImage:  _cardBgImage || null,
                cellBgOpacity: _cardBgImage ? parseInt(document.getElementById('tf-cell-opacity')?.value || '100') : 100,
            };
            if (_editingThemeId) {
                const idx = custom.findIndex(t => t.id === _editingThemeId);
                if (idx >= 0) custom[idx] = newTheme; else custom.push(newTheme);
            } else {
                custom.push(newTheme);
            }
            localStorage.setItem('bingoThemes', JSON.stringify(custom));
            // Sluit inline form als die in de picker staat
            const wrap = document.getElementById('gen-theme-form-wrap');
            if (wrap && wrap.contains(document.getElementById('theme-form'))) {
                wrap.style.display = 'none';
                const screenThemes = document.getElementById('screen-themes');
                if (screenThemes) screenThemes.appendChild(document.getElementById('theme-form'));
                // Herstel koptekst-box
                const kb = document.getElementById('gen-koptekst-box');
                if (kb) kb.style.display = '';
            }
            document.getElementById('theme-form').style.display = 'none';
            // Activeer het nieuw opgeslagen thema als het een nieuw eigen thema is
            if (!_editingThemeId) {
                const allCustom = JSON.parse(localStorage.getItem('bingoThemes') || '[]');
                const newest = allCustom[allCustom.length - 1];
                if (newest) { setActiveTheme(newest.id); _currentThemeTab = 'eigen'; }
            }
            renderThemeList();
            renderThemePills();
        };

        window.deleteTheme = async function(id) {
            if (!await bingoConfirm(t('alerts.themeDeleteConfirm'), { title: t('alerts.themeDeleteTitle'), icon: '🗑️', type: 'error', okLabel: t('admin.deleteAction') })) return;
            const custom = JSON.parse(localStorage.getItem('bingoThemes') || '[]').filter(t => t.id !== id);
            localStorage.setItem('bingoThemes', JSON.stringify(custom));
            if (_activeThemeId === id) setActiveTheme('default');
            renderThemeList();
            renderThemePills();
        };

        function renderGenCards(cards) {
            const container = document.getElementById('gen-cards-container');
            container.innerHTML = '';
            const n        = genGridSize;
            const theme    = getFormDraftTheme() || getActiveTheme();
            const title    = (document.getElementById('gen-design-title')?.value.trim()    || theme.title    || '').replace(/\n/g,'<br>');
            const subtitle = (document.getElementById('gen-design-subtitle')?.value.trim() || theme.subtitle || '').replace(/\n/g,'<br>');
            const footer   = (document.getElementById('gen-design-footer')?.value.trim()   || theme.footer   || '').replace(/\n/g,'<br>');
            const themed   = !!theme.bg;

            cards.forEach((card, i) => {
                const el = document.createElement('div');
                el.className = 'gen-card' + (themed ? ' themed' : '');

                if (themed) {
                    el.style.background = theme.bg;
                    if (theme.cardBgImage) {
                        el.style.backgroundImage = `url(${theme.cardBgImage})`;
                        el.style.backgroundSize = 'cover';
                        el.style.backgroundPosition = 'center';
                    }

                    if (title || subtitle) {
                        const hdr = document.createElement('div');
                        hdr.className = 'gen-card-header';
                        hdr.style.color = theme.headColor;
                        if (title)    hdr.innerHTML += `<div class="gen-card-main-title">${title}</div>`;
                        if (subtitle) hdr.innerHTML += `<div class="gen-card-sub-title">${subtitle}</div>`;
                        el.appendChild(hdr);
                    }

                    const body = document.createElement('div');
                    body.className = 'gen-card-body';
                    body.style.gridTemplateColumns = `repeat(${n},1fr)`;
                    card.forEach(word => {
                        const cell = document.createElement('div');
                        cell.className = 'gen-card-cell';
                        const cellBg = theme.cardBgImage
                            ? hexToRgba(theme.cellBg, (theme.cellBgOpacity ?? 100) / 100)
                            : theme.cellBg;
                        cell.style.cssText = `background:${cellBg};color:${theme.cellColor};border:none;`;
                        cell.textContent = word;
                        body.appendChild(cell);
                    });
                    el.appendChild(body);

                    const ftr = document.createElement('div');
                    ftr.className = 'gen-card-footer';
                    ftr.style.color = theme.headColor;
                    ftr.innerHTML = `<span>Kaart ${i+1}</span>${footer ? `<span>${footer}</span>` : ''}`;
                    el.appendChild(ftr);

                    // Afbeeldingen over de kaart heen
                    (theme.images || []).forEach(img => {
                        const imgEl = document.createElement('img');
                        imgEl.src = img.src;
                        imgEl.style.cssText = `position:absolute;left:${img.x}%;top:${img.y}%;width:${img.w}%;transform:rotate(${img.deg||0}deg);transform-origin:center;pointer-events:none;z-index:5;display:block;`;
                        el.appendChild(imgEl);
                    });

                } else {
                    const grid = document.createElement('div');
                    grid.className = 'gen-card-grid';
                    grid.style.gridTemplateColumns = `repeat(${n},1fr)`;
                    card.forEach(word => {
                        const cell = document.createElement('div');
                        cell.className = 'gen-card-cell';
                        cell.textContent = word;
                        grid.appendChild(cell);
                    });
                    const lbl = title ? `Kaart ${i+1} — ${title}` : `Kaart ${i+1}`;
                    el.innerHTML = `<div class="gen-card-title">${lbl}</div>`;
                    el.appendChild(grid);
                    if (footer) {
                        const ftrEl = document.createElement('div');
                        ftrEl.style.cssText = 'font-size:.6rem;color:var(--text-muted);margin-top:6px;text-align:center;';
                        ftrEl.textContent = footer;
                        el.appendChild(ftrEl);
                    }
                }

                container.appendChild(el);
            });

            const count = cards.length;
            document.getElementById('gen-output-title').textContent =
                `${count} kaart${count !== 1 ? 'en' : ''} gegenereerd`;
            document.getElementById('gen-print-btn').style.display = genMode === 'print' ? '' : 'none';
            document.getElementById('gen-output').style.display = 'block';
        }

        window.printBingoCards = function() {
            const cards = document.querySelectorAll('.gen-card');
            if (!cards.length) return;
            const n        = genGridSize;
            const fs       = n === 5 ? '9' : '11';
            const theme    = getActiveTheme();
            const title    = (document.getElementById('gen-design-title')?.value.trim()    || theme.title    || '').replace(/\n/g,'<br>');
            const subtitle = (document.getElementById('gen-design-subtitle')?.value.trim() || theme.subtitle || '').replace(/\n/g,'<br>');
            const footer   = (document.getElementById('gen-design-footer')?.value.trim()   || theme.footer   || '').replace(/\n/g,'<br>');
            const themed   = !!theme.bg;

            let rows = '';
            cards.forEach((card, i) => {
                const words = [...card.querySelectorAll('.gen-card-cell')].map(c => c.textContent);
                const cells = words.map(w => `<div class="c">${w}</div>`).join('');
                const label = `Kaart ${i+1}`;

                if (themed) {
                    const hdr = (title || subtitle)
                        ? `<div class="ct" style="background:${theme.bg};color:${theme.headColor};text-align:center;padding:5px 8px;">
                               ${title    ? `<div style="font-size:9pt;font-weight:800;letter-spacing:.3px;">${title}</div>`    : ''}
                               ${subtitle ? `<div style="font-size:6pt;opacity:.85;margin-top:1px;">${subtitle}</div>` : ''}
                           </div>`
                        : '';
                    const ftr = `<div class="cf" style="background:${theme.bg};color:${theme.headColor};">
                                     <span>${label}</span>${footer ? `<span>${footer}</span>` : ''}
                                 </div>`;
                    const imgOverlays = (theme.images || []).map(img =>
                        `<img src="${img.src}" style="position:absolute;left:${img.x}%;top:${img.y}%;width:${img.w}%;transform:rotate(${img.deg||0}deg);transform-origin:center;pointer-events:none;z-index:5;display:block;">`
                    ).join('');
                    const cardBgStyle = theme.cardBgImage
                        ? `background-image:url(${theme.cardBgImage});background-size:cover;background-position:center;`
                        : '';
                    const printCellBg = theme.cardBgImage
                        ? hexToRgba(theme.cellBg, (theme.cellBgOpacity ?? 100) / 100)
                        : theme.cellBg;
                    const cellsStyled = words.map(w => `<div class="c" style="background:${printCellBg};color:${theme.cellColor};">${w}</div>`).join('');
                    rows += `<div class="card" style="border-color:${theme.bg};position:relative;${cardBgStyle}">
                                 ${hdr}
                                 <div class="cg" style="grid-template-columns:repeat(${n},1fr);background:${theme.bg};">${cellsStyled}</div>
                                 ${ftr}
                                 ${imgOverlays}
                             </div>`;
                } else {
                    const lbl = title ? `${label} — ${title}` : label;
                    rows += `<div class="card">
                                 <div class="ct">${lbl}</div>
                                 <div class="cg" style="grid-template-columns:repeat(${n},1fr);">${cells}</div>
                                 ${footer ? `<div class="cf" style="color:#555;">${footer}</div>` : ''}
                             </div>`;
                }
            });

            const cellStyle = themed
                ? `background:${theme.cellBg};color:${theme.cellColor};border:none;`
                : `background:#fff;color:#000;border:1px solid #ccc;`;
            const fontLink = `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&display=swap');`;

            const win = window.open('', '_blank');
            win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
${themed ? fontLink : ''}
body{font-family:${themed ? "'Montserrat'" : 'Arial'},sans-serif;margin:0;padding:8mm;background:#fff;color:#000;}
h1{font-size:13pt;text-align:center;margin-bottom:6mm;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm;}
.card{border:2px solid #bbb;border-radius:8px;overflow:hidden;page-break-inside:avoid;display:flex;flex-direction:column;}
.ct{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#555;padding:5px 8px 4px;}
.cg{display:grid;gap:3px;flex:1;aspect-ratio:1/1;padding:0 4px 4px;}
.c{border-radius:4px;padding:3px;text-align:center;font-size:${fs}pt;${cellStyle}
   display:flex;align-items:center;justify-content:center;
   word-break:break-word;hyphens:auto;line-height:1.2;font-weight:600;}
.cf{display:flex;justify-content:space-between;align-items:center;padding:3px 8px 5px;font-size:6pt;font-weight:700;letter-spacing:.3px;}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@media print{@page{size:A4;margin:10mm;} .grid{gap:6mm;}}
</style></head><body>
<h1>Bingo-kaarten</h1>
<div class="grid">${rows}</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`);
            win.document.close();
        };

        // Initialiseer tabel bij laden
        rebuildTypesTable();

        // mulberry32, seededShuffle, strHash → utils.js

        // ─── Hash routing ─────────────────────────────────────────────────────────
        const _origSwitchScreen = switchScreen;
        switchScreen = function(id) {
            _origSwitchScreen(id);
            const hash = id.replace('screen-', '');
            history.replaceState(null, '', window.location.pathname + window.location.search + '#' + hash);
        };
        window.goHome = () => switchScreen('screen-home');
        window.goTo   = (id) => switchScreen(id);

        // ─── Mijn Kaarten (localStorage) ─────────────────────────────────────────
        function loadMyCards() {
            try { return JSON.parse(localStorage.getItem('myCards') || '[]'); } catch { return []; }
        }
        function saveMyCardsList(arr) { localStorage.setItem('myCards', JSON.stringify(arr)); }

        function addCardSet(title, cards, size, source, extra = {}) {
            const list = loadMyCards();
            const cs = {
                id: 'cs-' + Date.now(), title, cards, size, count: cards.length, source, created: Date.now(),
                words:     extra.words     || [],
                soort:     extra.soort     || null,
                thema:     extra.thema     || null,
                programma: extra.programma || null,
                categorie: extra.categorie || null,
                publiek:   extra.publiek   || false,
            };
            list.unshift(cs);
            saveMyCardsList(list);
            return cs;
        }

        window.deleteCardSet = function(id) {
            saveMyCardsList(loadMyCards().filter(cs => cs.id !== id));
            renderMyCards();
        };

        function renderMyCards() {
            const list = loadMyCards();
            const container = document.getElementById('mycards-list');
            const empty     = document.getElementById('mycards-empty');
            container.innerHTML = '';
            if (!list.length) { empty.style.display = 'block'; return; }
            empty.style.display = 'none';
            list.forEach(cs => {
                const d = new Date(cs.created);
                const dateStr = d.toLocaleDateString('nl-NL', { day:'numeric', month:'short', year:'numeric' });
                const icon = cs.source === 'spotify' ? '🎵' : cs.source === 'scenario' ? '🎪' : '🎲';
                const soortBadge = cs.soort === 'tv' ? '<span class="mycard-badge">📺 TV</span>'
                                 : cs.soort === 'scenario' ? '<span class="mycard-badge">🎪 Scenario</span>'
                                 : '';
                const publiekBadge = cs.publiek ? '<span class="mycard-badge" style="background:rgba(45,212,191,.2);color:#2dd4bf;">🌐</span>' : '';
                const shareBtn = (cs.words && cs.words.length)
                    ? `<button class="mycard-btn-share" onclick="shareCardSet('${cs.id}')">🔗</button>`
                    : '';
                const div = document.createElement('div');
                div.className = 'mycard-item';
                div.innerHTML = `
                    <div class="mycard-icon">${icon}</div>
                    <div class="mycard-info">
                        <div class="mycard-title-text">${soortBadge}${publiekBadge}${cs.title}</div>
                        <div class="mycard-meta-text">${cs.count} kaart${cs.count !== 1 ? 'en' : ''} · ${cs.size}×${cs.size} · ${dateStr}</div>
                    </div>
                    <div class="mycard-actions">
                        <button class="mycard-btn-play" onclick="playCardSet('${cs.id}')">▶ Spelen</button>
                        ${shareBtn}
                        <button class="mycard-btn-del"  onclick="deleteCardSet('${cs.id}')">🗑</button>
                    </div>`;
                container.appendChild(div);
            });
        }

        // Render mycards when that screen is opened
        const _origGoTo = window.goTo;
        window.goTo = function(id) {
            if (id === 'screen-mycards')    renderMyCards();
            if (id === 'screen-generate')   { genWizardInit(); renderThemePills(); }
            if (id === 'screen-themes')     renderThemeList();
            if (id === 'screen-ingezonden') renderIngezonden();
            if (id === 'screen-scenario')   initScenTypeSelect();
            if (id === 'screen-select')     initTvTypeSelect();
            _origGoTo(id);
        };
        window.goHome = () => { window.goTo('screen-home'); };

        // Save current generated cards to Mijn Kaarten
        let _currentGenCards   = [];
        let _currentGenTitle   = '';

        window.saveCardsToMyCards = async function(source) {
            const cards = source === 'spotify' ? spotifyGeneratedCards : _currentGenCards;
            if (!cards || !cards.length) { alert(t('alerts.noCardsToSave')); return; }
            const n     = source === 'spotify' ? spotifyGridSize_sp : genGridSize;
            const defaultTitle = source === 'spotify'
                ? (spotifyPlaylistData?.name || 'Spotify Bingo')
                : 'Bingo ' + new Date().toLocaleDateString('nl-NL', { day:'numeric', month:'long' });
            const title = await bingoPrompt(t('alerts.cardSetName'), defaultTitle, { title: t('alerts.saveTitle'), icon: '💾', okLabel: t('common.save') });
            if (title === null) return;
            let extra = {};
            if (source === 'manual') {
                const soort     = document.getElementById('gen-soort').value || null;
                const programma = document.getElementById('gen-tv-programma')?.value.trim() || null;
                const categorie = document.getElementById('gen-tv-categorie')?.value.trim() || null;
                const thema     = document.getElementById('gen-scenario-thema')?.value.trim() || null;
                const words     = document.getElementById('gen-words').value.split('\n').map(w => w.trim()).filter(Boolean);
                extra = { soort, programma, categorie, thema, publiek: genPubliek, words };
            }
            addCardSet(title.trim() || defaultTitle, cards, n, source, extra);
            alert(t('alerts.savedInMyCards', { count: cards.length }));
        };

        // Patch renderGenCards to also store cards in _currentGenCards
        const _origRenderGenCards = renderGenCards;
        renderGenCards = function(cards) {
            _currentGenCards = cards;
            _origRenderGenCards(cards);
        };

        // ─── Card picker & Saved game ─────────────────────────────────────────────
        let _activeCardSet = null;
        let _activeCardNum = 0;
        let savedWinningLines = new Set();

        window.playCardSet = function(id) {
            const list = loadMyCards();
            _activeCardSet = list.find(cs => cs.id === id);
            if (!_activeCardSet) return;
            document.getElementById('cardpicker-title').textContent = _activeCardSet.title;
            const grid = document.getElementById('cardpicker-grid');
            grid.innerHTML = '';
            for (let i = 0; i < _activeCardSet.count; i++) {
                const btn = document.createElement('button');
                btn.className = 'cardpicker-btn';
                btn.textContent = `Kaart ${i + 1}`;
                const idx = i;
                btn.onclick = () => pickAndPlayCard(idx);
                grid.appendChild(btn);
            }
            switchScreen('screen-card-picker');
        };

        window.pickAndPlayCard = function(cardIdx) {
            _activeCardNum = cardIdx;
            const cs = _activeCardSet;
            const words = cs.cards[cardIdx];
            const n = cs.size;

            document.getElementById('saved-game-title').textContent =
                `${cs.title} — Kaart ${cardIdx + 1}`;

            const nextBtn = document.getElementById('saved-btn-shuffle');
            nextBtn.textContent = cardIdx + 1 < cs.count ? '→' : '↩';
            nextBtn.title = cardIdx + 1 < cs.count ? 'Volgende kaart' : 'Terug naar kaart 1';

            savedWinningLines = new Set();
            document.getElementById('saved-bingo-lines').innerHTML = '';

            const grid = document.getElementById('saved-bingo-grid');
            grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
            grid.innerHTML = '';
            words.forEach(word => {
                const cell = document.createElement('div');
                cell.className = 'bingo-cell flash';
                cell.style.whiteSpace = 'pre-line';
                cell.innerText = word;
                cell.onclick = () => toggleSavedCell(cell, n);
                grid.appendChild(cell);
            });
            setTimeout(() => grid.querySelectorAll('.bingo-cell').forEach(c => c.classList.remove('flash')), 500);
            switchScreen('screen-saved-game');
        };

        window.savedNextCard = function() {
            if (!_activeCardSet) return;
            const next = (_activeCardNum + 1) % _activeCardSet.count;
            pickAndPlayCard(next);
        };

        function toggleSavedCell(cell, gridSize) {
            if (navigator.vibrate) navigator.vibrate(20);
            cell.classList.toggle('checked');
            checkSavedBingo(gridSize);
        }

        function checkSavedBingo(n) {
            const grid    = document.getElementById('saved-bingo-grid');
            const cells   = grid.querySelectorAll('.bingo-cell');
            const linesEl = document.getElementById('saved-bingo-lines');
            let newBingo  = false;

            const check = (indices, id, cls) => {
                if (savedWinningLines.has(id)) return;
                if (indices.every(i => cells[i]?.classList.contains('checked'))) {
                    savedWinningLines.add(id);
                    newBingo = true;
                    const l = document.createElement('div');
                    l.className = `strike-line ${cls}`;
                    linesEl.appendChild(l);
                }
            };

            for (let i = 0; i < n; i++) {
                check(Array.from({length:n}, (_,j) => i*n+j), `row-${i}`, `strike-row-${i}`);
                check(Array.from({length:n}, (_,j) => j*n+i), `col-${i}`, `strike-col-${i}`);
            }
            check(Array.from({length:n}, (_,i) => i*n+i),       'diag-1', 'strike-diag-1');
            check(Array.from({length:n}, (_,i) => i*n+(n-1-i)), 'diag-2', 'strike-diag-2');

            if (newBingo) {
                if (navigator.vibrate) navigator.vibrate([100,50,100]);
                document.getElementById('bingo-win-msg').innerText =
                    (() => { const wm = t('winMessages'); return wm[Math.floor(Math.random() * wm.length)]; })();
                document.getElementById('bingo-overlay').classList.add('show');
            }
        }

        // ─── Spotify Bingo ────────────────────────────────────────────────────────
        let spotifyPlaylistData   = null;
        let spotifyGridSize_sp    = 4;
        let spotifyGeneratedCards = [];

        function showSpotifyStatus(msg, type) {
            const el = document.getElementById('spotify-status');
            el.className = 'spotify-status-box ' + (type || 'loading');
            el.textContent = msg;
            el.style.display = 'block';
        }

        window.spotifyLoadManual = function() {
            const raw = document.getElementById('spotify-manual-input').value.trim();
            if (!raw) { showSpotifyStatus('Plak eerst songnamen.', 'error'); return; }

            const tracks = raw.split('\n')
                .map(line => {
                    line = line.replace(/^\d+[\.\)]\s*/, '').trim();
                    const parts = line.split('\t');
                    return { name: parts[0].trim(), artist: parts[1]?.trim() || '' };
                })
                .filter(t => t.name.length > 0);

            if (tracks.length < 16) {
                showSpotifyStatus(`Minimaal 16 nummers nodig, je hebt er ${tracks.length}.`, 'error');
                return;
            }

            spotifyPlaylistData = {
                id:     'manual-' + Date.now(),
                name:   'Handmatige lijst',
                image:  '',
                tracks,
            };
            document.getElementById('spotify-status').style.display = 'none';
            renderSpotifyStep2();
        };

        function renderSpotifyStep2() {
            const pl = spotifyPlaylistData;
            document.getElementById('spotify-pl-name').textContent = pl.name;
            document.getElementById('spotify-pl-meta').textContent = pl.tracks.length + ' nummers';
            const img = document.getElementById('spotify-pl-img');
            img.src = pl.image; img.style.display = pl.image ? '' : 'none';

            const preview = document.getElementById('spotify-tracks-preview');
            preview.innerHTML = '';
            pl.tracks.slice(0, 50).forEach((t, i) => {
                const row = document.createElement('div');
                row.className = 'spotify-track-row';
                row.innerHTML =
                    `<span class="spotify-track-num">${i+1}</span>` +
                    `<span class="spotify-track-name">${t.name}</span>` +
                    `<span class="spotify-track-artist">${t.artist}</span>`;
                preview.appendChild(row);
            });
            if (pl.tracks.length > 50) {
                const more = document.createElement('div');
                more.style.cssText = 'text-align:center;color:var(--text-muted);font-size:.72rem;padding:4px 0;';
                more.textContent = `+ ${pl.tracks.length - 50} meer nummers`;
                preview.appendChild(more);
            }
            document.getElementById('spotify-step1').style.display = 'none';
            document.getElementById('spotify-step2').style.display = 'block';
            document.getElementById('spotify-step3').style.display = 'none';
        }

        window.setSpotifyGrid = function(n) {
            spotifyGridSize_sp = n;
            document.querySelectorAll('[data-spval]').forEach(b =>
                b.classList.toggle('active', b.dataset.spval === String(n)));
        };

        window.spotifyReset = function() {
            spotifyPlaylistData = null;
            document.getElementById('spotify-step1').style.display = 'block';
            document.getElementById('spotify-step2').style.display = 'none';
            document.getElementById('spotify-step3').style.display = 'none';
            document.getElementById('spotify-status').style.display = 'none';
        };

        window.spotifyShowStep2 = function() {
            document.getElementById('spotify-step2').style.display = 'block';
            document.getElementById('spotify-step3').style.display = 'none';
        };

        window.generateSpotifyCards = async function() {
            const pl = spotifyPlaylistData;
            if (!pl) return;
            const includeArtist = document.getElementById('spotify-include-artist').checked;
            const words = pl.tracks.map(t => includeArtist && t.artist ? t.name + '\n' + t.artist : t.name);
            const n = spotifyGridSize_sp, cellCount = n * n;
            const numCards = Math.max(1, Math.min(200,
                parseInt(document.getElementById('spotify-num-cards').value) || 10));

            const errEl = document.getElementById('spotify-gen-error');
            if (words.length < cellCount) {
                errEl.textContent = `⚠️ Minimaal ${cellCount} nummers nodig voor ${n}×${n}. Lijst heeft er ${words.length}.`;
                errEl.style.display = 'block'; return;
            }
            errEl.style.display = 'none';
            document.getElementById('spotify-gen-progress').style.display = 'block';
            await new Promise(r => setTimeout(r, 15));

            const cards = [], seed0 = strHash(pl.id);
            for (let c = 0; c < numCards; c++) {
                if (c % 20 === 0) {
                    document.getElementById('spotify-gen-prog-txt').textContent = `${c}/${numCards}`;
                    await new Promise(r => setTimeout(r, 0));
                }
                cards.push(seededShuffle(words, seed0 + c * 1000003).slice(0, cellCount));
            }
            document.getElementById('spotify-gen-progress').style.display = 'none';
            spotifyGeneratedCards = cards;

            const container = document.getElementById('spotify-cards-container');
            container.innerHTML = '';
            cards.forEach((card, i) => {
                const el = document.createElement('div'); el.className = 'gen-card';
                const grid = document.createElement('div');
                grid.className = 'gen-card-grid';
                grid.style.gridTemplateColumns = `repeat(${n},1fr)`;
                card.forEach(w => {
                    const cell = document.createElement('div');
                    cell.className = 'gen-card-cell'; cell.style.whiteSpace = 'pre-line';
                    cell.textContent = w; grid.appendChild(cell);
                });
                el.innerHTML = `<div class="gen-card-title">Kaart ${i+1}</div>`;
                el.appendChild(grid); container.appendChild(el);
            });
            document.getElementById('spotify-output-title').textContent =
                `${numCards} kaart${numCards !== 1 ? 'en' : ''} gegenereerd`;
            document.getElementById('spotify-step2').style.display = 'none';
            document.getElementById('spotify-step3').style.display = 'block';
        };

        // ─── Init: restore screen from hash ──────────────────────────────────────
        (function initExtras() {
            const hash = window.location.hash.replace('#', '');
            const knownScreens = ['home','select','game','admin','generate','mycards',
                                  'spotify','scenario','wk','card-picker','saved-game','themes','ingezonden'];
            if (hash && knownScreens.includes(hash)) {
                sessionStorage.setItem('restoreScreen', 'screen-' + hash);
            }
        })();

        // (dark mode verwijderd — altijd light)

        // ─── Scenario Bingo ──────────────────────────────────────────────────────
        const SCENARIO_THEMES = {
            kermis: {
                label: 'Kermis',
                words: [
                    'Irritante Pubers', 'Mini Hondje', 'Scoot Mobiel', 'Minderjarig en Rokend',
                    'Houtkrul', 'Knal Erwten', 'Trainings Pak', 'Zichtbaar ondergoed',
                    'Opgespoten lippen', 'Grote Knuffel', 'Ruzie', 'Gouden Ketting',
                    'Vetrol', 'Te dik en toch vreten', 'Verveelde mannen',
                    'Roken achter Kinderwagen', 'Huilend Kind', 'Gapende Kermis Werker',
                    'Suiker Spin', 'Te strakke Kleren', 'Panter Print', 'Haar Extensions',
                    'Anabolen man', 'Bont Kraagje'
                ]
            },
            festival: {
                label: 'Festival',
                words: [
                    'Lauwe halve liter', 'Glitter op de wangen', 'Wildplasser tegen het hek',
                    'Mensen op de schouders', "Ik ben m'n vrienden kwijt", 'Iemand met een opblaasdier',
                    'Verloren slipper in de modder', 'Zonnebril in de stromende regen',
                    'Heuptasje schuin over de borst', 'Iemand die slaapt in het gras',
                    'Muntjes vinden op de grond', 'Eindeloze rij voor de dixi',
                    'Vreemdeling die een aansteker zoekt', 'Stoflongen van het dansen',
                    'Kleurrijke regenponcho', 'De "trein" door het publiek',
                    'Witte zonnebrandneus', 'Groepje met matchende shirts',
                    'Crowdsurfer in de problemen', 'Luid vals meezingen',
                    'Biergooier in de nek', 'Iemand met een vlaggenstok',
                    'Modderige witte sneakers'
                ]
            },
            trouwerij: {
                label: 'Trouwerij',
                words: [
                    'Vader huilt bij binnenkomst', 'Speech duurt te lang', 'Kind steelt de show',
                    'Iemand in het wit die dat niet mag', 'Neven die te vroeg dronken zijn',
                    'Disco knuffel op de dansvloer', 'Ongemakkelijke ex aan tafel',
                    'Naam vergeten op tafelindeling', 'Buffet eerder op dan gepland',
                    'Onbekende familie kust je', 'Foute grap in de speech',
                    'Fotograaf staat steeds in de weg', 'Moeder huilt bij het ja-woord',
                    'Confetti overal behalve op het stel', 'Bruid kwijt na de ceremonie',
                    'Slechte dj die niemand kent', 'Huwelijksaankondiging als verrassing',
                    'Tafelschikking leidt tot ruzie', 'Bloemen die omvallen',
                    'Drankje omgegooid op outfit', 'Laatste dans eindigt chaotisch',
                    'Kind dat de openingsdans verstoort', 'Bruidstaart scheef gesneden',
                    'Gasten die te vroeg naar huis gaan'
                ]
            },
            verjaardag: {
                label: 'Verjaardag',
                words: [
                    'Cadeautje dubbel', 'Iemand vergeet de verjaardag', 'Kaarsje opnieuw aansteken',
                    'Kind huilt bij het zingen', 'Taart staat scheef', 'Ballonnen al leeg',
                    'Oom die te veel vertelt', 'Speelgoed kapot bij uitpakken',
                    'Wachten tot iedereen er is', 'Slingers die al loshangen',
                    'Cadeaupapier overal op de grond', 'Iemand houdt niet van taart',
                    'Kaarsjes die niet willen uitblazen', 'Foto mislukt steeds',
                    'Verrassing uitgelekt', 'Geld als cadeau met excuus',
                    'Gasten die te vroeg weggaan', 'Fles fris omgevallen',
                    'Iedereen zingt vals', 'Cadeau zonder naam erbij',
                    'Slingers in het eten', 'Jarige vergeet eigen leeftijd',
                    'Taart te vroeg aangesneden', 'Feestmuts die niemand opzet'
                ]
            }
        };

        let scenarioGridSize = 4;
        let _scenarioCards   = [];

        // Legacy stubs — het scenario-scherm gebruikt nu directe start-knoppen
        window.scenarioThemeChange = function() {};
        window.updateScenHint = function() {};

        // setScenarioGrid is nog bruikbaar vanuit generator-context maar scen-words is verwijderd;
        // de functie blijft beschikbaar voor de grid-size state.
        window.setScenarioGrid = function(size) {
            scenarioGridSize = size;
            document.querySelectorAll('[data-scval]').forEach(b =>
                b.classList.toggle('active', parseInt(b.dataset.scval) === size));
        };

        // generateScenarioCards is verplaatst naar het generator-scherm (saveCardsToMyCards met soort=scenario).
        // Deze legacy stub doet niets meer maar voorkomt fouten als hij toch wordt aangeroepen.
        window.generateScenarioCards = async function() {
            alert(t('alerts.useGenerator'));
            return;
            /* legacy code below is unreachable but preserved for reference
            const count = 0;
            const container = null;
            const n = scenarioGridSize; */
        };

        window.saveScenarioCards = async function() {
            if (!_scenarioCards.length) { alert(t('alerts.noCardsToSave')); return; }
            // This legacy function is kept for backward compatibility (old scenario screen had textarea generator).
            // It is not used by the new play screen.
            const defaultTitle = 'Scenario Bingo';
            const title        = await bingoPrompt(t('alerts.cardSetName'), defaultTitle, { title: t('alerts.saveTitle'), icon: '💾', okLabel: t('common.save') });
            if (title === null) return;
            addCardSet(title.trim() || defaultTitle, _scenarioCards, scenarioGridSize, 'scenario', { soort: 'scenario', publiek: false });
            alert(t('alerts.savedInMyCards', { count: _scenarioCards.length }));
        };

        // ─── Generator: Soort & Publiek ───────────────────────────────────────────
        let genPubliek = false;

        window.onGenSoortChange = function() {
            const val = document.getElementById('gen-soort').value;
            document.getElementById('gen-context-tv').style.display       = val === 'tv'       ? 'block' : 'none';
            document.getElementById('gen-context-scenario').style.display = val === 'scenario' ? 'block' : 'none';
        };

        window.setGenPubliek = function(val) {
            genPubliek = val;
            document.getElementById('gen-prive-btn').classList.toggle('active', !val);
            document.getElementById('gen-publiek-btn').classList.toggle('active', val);
        };

        // ─── TV Bingo: type select ────────────────────────────────────────────────
        function initTvTypeSelect() {
            const sel = document.getElementById('tv-type-select');
            // Remove dynamic options, keep standaard
            while (sel.options.length > 1) sel.remove(1);
            const myCards = loadMyCards();
            const hasTvEigen      = myCards.some(cs => cs.soort === 'tv');
            const hasTvIngezonden = myCards.some(cs => cs.soort === 'tv' && cs.publiek === true);
            if (hasTvEigen) {
                const o = document.createElement('option');
                o.value = 'eigen'; o.textContent = t('tv.ownCardsOption');
                sel.appendChild(o);
            }
            if (hasTvIngezonden) {
                const o = document.createElement('option');
                o.value = 'ingezonden'; o.textContent = t('tv.submittedOption');
                sel.appendChild(o);
            }
            sel.value = 'standaard';
            onTvTypeChange();
        }

        window.onTvTypeChange = function() {
            const val = document.getElementById('tv-type-select').value;
            document.getElementById('tv-standaard-wrap').style.display   = val === 'standaard' ? 'block' : 'none';
            document.getElementById('tv-eigen-wrap').style.display       = val === 'eigen'     ? 'block' : 'none';
            document.getElementById('tv-ingezonden-wrap').style.display  = val === 'ingezonden'? 'block' : 'none';
            document.getElementById('start-btn').disabled = true;
            if (val === 'eigen')      populateTvEigenSelects(false);
            if (val === 'ingezonden') populateTvEigenSelects(true);
        };

        function populateTvEigenSelects(ingezondenOnly) {
            const myCards = loadMyCards().filter(cs => cs.soort === 'tv' && cs.programma && cs.categorie
                                                    && (!ingezondenOnly || cs.publiek === true));
            const progSuffix = ingezondenOnly ? 'ingezonden' : 'eigen';
            const progSel = document.getElementById('tv-' + progSuffix + '-prog-select');
            const catSel  = document.getElementById('tv-' + progSuffix + '-cat-select');

            const progNames = [...new Set(myCards.map(cs => cs.programma))];
            progSel.innerHTML = `<option value="">${t('tv.choosePgmOpt')}</option>`;
            progNames.forEach(p => {
                const o = document.createElement('option');
                o.value = o.textContent = p;
                progSel.appendChild(o);
            });
            catSel.innerHTML = `<option value="">${t('tv.chooseScenarioOpt')}</option>`;
            catSel.disabled = true;
            document.getElementById('start-btn').disabled = true;
        }

        window.onTvEigenProgChange = function() {
            _fillTvCatSelect('eigen');
        };

        window.onTvIngezondenProgChange = function() {
            _fillTvCatSelect('ingezonden');
        };

        function _fillTvCatSelect(suffix) {
            const progSel = document.getElementById('tv-' + suffix + '-prog-select');
            const catSel  = document.getElementById('tv-' + suffix + '-cat-select');
            const prog = progSel.value;
            catSel.innerHTML = `<option value="">${t('tv.chooseScenarioOpt')}</option>`;
            catSel.disabled = true;
            document.getElementById('start-btn').disabled = true;
            if (!prog) return;
            const ingezondenOnly = suffix === 'ingezonden';
            const myCards = loadMyCards().filter(cs => cs.soort === 'tv' && cs.programma === prog
                                                    && (!ingezondenOnly || cs.publiek === true));
            const cats = [...new Set(myCards.map(cs => cs.categorie).filter(Boolean))];
            if (cats.length === 1) {
                const o = document.createElement('option');
                o.value = o.textContent = cats[0];
                catSel.appendChild(o);
                catSel.value = cats[0];
                document.getElementById('start-btn').disabled = false;
            } else {
                cats.forEach(cat => {
                    const o = document.createElement('option');
                    o.value = o.textContent = cat;
                    catSel.appendChild(o);
                });
                catSel.disabled = false;
                catSel.addEventListener('change', () => {
                    document.getElementById('start-btn').disabled = !catSel.value;
                }, { once: true });
            }
        }

        // ─── Scenario Bingo: nieuw speelscherm ───────────────────────────────────
        function initScenTypeSelect() {
            const sel = document.getElementById('scen-type-select');
            while (sel.options.length > 1) sel.remove(1);
            const myCards = loadMyCards();
            const hasEigen      = myCards.some(cs => cs.soort === 'scenario');
            const hasIngezonden = myCards.some(cs => cs.soort === 'scenario' && cs.publiek === true);
            if (hasEigen) {
                const o = document.createElement('option');
                o.value = 'eigen'; o.textContent = '🃏 Eigen thema\'s';
                sel.appendChild(o);
            }
            if (hasIngezonden) {
                const o = document.createElement('option');
                o.value = 'ingezonden'; o.textContent = '📬 Ingezonden';
                sel.appendChild(o);
            }
            sel.value = 'standaard';
            onScenTypeChange();
        }

        window.onScenTypeChange = function() {
            const val = document.getElementById('scen-type-select').value;
            document.getElementById('scen-standaard-wrap').style.display   = val === 'standaard'  ? 'block' : 'none';
            document.getElementById('scen-eigen-wrap').style.display       = val === 'eigen'      ? 'block' : 'none';
            document.getElementById('scen-ingezonden-wrap').style.display  = val === 'ingezonden' ? 'block' : 'none';
            document.getElementById('scen-start-btn').disabled = true;

            if (val === 'eigen' || val === 'ingezonden') {
                const ingezondenOnly = val === 'ingezonden';
                const myCards = loadMyCards().filter(cs => cs.soort === 'scenario'
                                                        && cs.thema
                                                        && (!ingezondenOnly || cs.publiek === true));
                const selId = val === 'eigen' ? 'scen-eigen-theme-select' : 'scen-ingezonden-theme-select';
                const themeSel = document.getElementById(selId);
                themeSel.innerHTML = '<option value="">-- Kies een thema --</option>';
                [...new Set(myCards.map(cs => cs.thema))].forEach(thema => {
                    const o = document.createElement('option');
                    o.value = o.textContent = thema;
                    themeSel.appendChild(o);
                });
            }
        };

        window.onScenThemeChange = function() {
            const val = document.getElementById('scen-type-select').value;
            let hasVal = false;
            if (val === 'standaard') {
                hasVal = !!document.getElementById('scen-theme-play').value;
            } else if (val === 'eigen') {
                hasVal = !!document.getElementById('scen-eigen-theme-select').value;
            } else if (val === 'ingezonden') {
                hasVal = !!document.getElementById('scen-ingezonden-theme-select').value;
            }
            document.getElementById('scen-start-btn').disabled = !hasVal;
        };

        window.startScenarioGame = function() {
            const val = document.getElementById('scen-type-select').value;
            let words = [], title = 'Scenario Bingo';

            if (val === 'standaard') {
                const key = document.getElementById('scen-theme-play').value;
                if (!key) return;
                const theme = SCENARIO_THEMES[key];
                words = theme ? [...theme.words] : [];
                title = (theme ? theme.label : key) + ' Bingo';
            } else {
                const ingezondenOnly = val === 'ingezonden';
                const selId = val === 'eigen' ? 'scen-eigen-theme-select' : 'scen-ingezonden-theme-select';
                const thema = document.getElementById(selId).value;
                if (!thema) return;
                const myCards = loadMyCards().filter(cs => cs.soort === 'scenario' && cs.thema === thema
                                                        && (!ingezondenOnly || cs.publiek === true));
                if (!myCards.length || !myCards[0].words || !myCards[0].words.length) {
                    alert(t('alerts.noWordlistTheme')); return;
                }
                words = [...myCards[0].words];
                title = thema + ' Bingo';
            }

            startGameWithWords(title, words);
        };

        // ─── startGameWithWords (gedeeld) ────────────────────────────────────────
        function startGameWithWords(title, words) {
            let pool = [...words];
            while (pool.length < 16) pool = pool.concat(pool);
            _currentGameWords = words; // store for reshuffle
            refreshesLeft = 3; updateRefreshUI();
            currentWords = pickRandom(pool, 16);
            document.getElementById('game-title').innerText = title;
            winningLines.clear();
            document.getElementById('bingo-lines').innerHTML = '';
            renderGrid();
            switchScreen('screen-game');
        }
        window.startGameWithWords = startGameWithWords;

        // ─── Ingezonden kaarten ───────────────────────────────────────────────────
        function renderIngezonden() {
            const list      = loadMyCards().filter(cs => cs.publiek === true);
            const container = document.getElementById('ingezonden-list');
            const empty     = document.getElementById('ingezonden-empty');
            if (!container) return;
            container.innerHTML = '';
            if (!list.length) { empty.style.display = 'block'; return; }
            empty.style.display = 'none';
            list.forEach(cs => {
                const d = new Date(cs.created);
                const dateStr = d.toLocaleDateString('nl-NL', { day:'numeric', month:'short', year:'numeric' });
                const icon = cs.soort === 'tv' ? '📺' : cs.soort === 'scenario' ? '🎪' : '🎲';
                const div = document.createElement('div');
                div.className = 'mycard-item';
                div.innerHTML = `
                    <div class="mycard-icon">${icon}</div>
                    <div class="mycard-info">
                        <div class="mycard-title-text">${cs.title}</div>
                        <div class="mycard-meta-text">${cs.count} kaart${cs.count !== 1 ? 'en' : ''} · ${cs.size}×${cs.size} · ${dateStr}</div>
                    </div>
                    <div class="mycard-actions">
                        <button class="mycard-btn-play" onclick="playCardSet('${cs.id}')">▶ Spelen</button>
                        ${(cs.words && cs.words.length) ? `<button class="mycard-btn-share" onclick="shareCardSet('${cs.id}')">🔗</button>` : ''}
                    </div>`;
                container.appendChild(div);
            });
        }

        // ─── Share link ───────────────────────────────────────────────────────────
        window.shareCardSet = function(id) {
            const cs = loadMyCards().find(cs => cs.id === id);
            if (!cs || !cs.words || !cs.words.length) {
                alert(t('alerts.noWordlistShare')); return;
            }
            const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
                words: cs.words, size: cs.size, title: cs.title
            }))));
            const url = window.location.origin + window.location.pathname + '?play=' + payload;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => bingoAlert(t('alerts.linkCopied'), { title: t('alerts.shareTitle'), icon: '🔗', type: 'success' }));
            } else {
                bingoPrompt(t('alerts.copyLink'), url, { title: t('alerts.shareTitle'), icon: '🔗', okLabel: t('common.continue') });
            }
        };

        // ─── Share param afhandeling ──────────────────────────────────────────────
        (function checkShareParam() {
            const params = new URLSearchParams(window.location.search);
            const play = params.get('play');
            if (!play) return;
            try {
                const data = JSON.parse(decodeURIComponent(escape(atob(play))));
                if (data.words && data.words.length) {
                    setTimeout(() => {
                        startGameWithWords(data.title || 'Gedeelde Bingo', data.words);
                        history.replaceState(null, '', window.location.pathname);
                    }, 100);
                }
            } catch(e) { console.warn('Invalid share link', e); }
        })();

        // ─── WK BINGO 2026 ────────────────────────────────────────────────────────

        const WK_VOETBAL_TERMEN = [
            'Corner', 'Gele kaart', 'Rode kaart', 'Buitenspel', 'Strafschop',
            'VAR-check', 'Vrije trap', 'Voorzet', 'Schitterend schot', 'Keeper redt',
            'Op en neer', 'Wissel', 'Afgekeurd', 'Uittrap', 'Inworp',
            'Tackle', 'Fluitconcert', 'Redding', 'Eigen doelpunt', 'Paal',
            'laat', 'Naar de grond', 'In de muur', 'Kopduel', 'Counter',
            'Schwalbe', 'Zijlijn', 'Pijnlijk', 'Slotfase', 'Eenrichtingsverkeer',
            'Balverlies', 'Lange bal', 'buitenkant voet', 'korte hoek', 'sliding',
            'vuisten', 'achterlijn', 'kruising', 'rebound', 'poule',
            'debutant', 'verrassing', 'knockout'
        ];

        // → js/data/wk-data.js (FIFA_TO_ISO, flagSpan, WK_TEAMS, WK_GROEPEN, WK_GROEPSWEDSTRIJDEN, WK_KNOCKOUT_WEDSTRIJDEN)


        // ─── WK State ────────────────────────────────────────────────────────────
        let wkCurrentWords    = [];
        let wkRefreshesLeft   = 3;
        let wkWinningLines    = new Set();
        let wkCurrentMatchId  = null;
        let wkCurrentPoule    = 'A';
        let wkCurrentTab      = 'groep';
        let wkMatchStartTs    = 0;       // timestamp van match-start
        let wkMatchBingosLogged = 0;     // aantal bingo's al gelogd in deze match
        let _html2canvasPromise = null;  // lazy load cache

        // ─── WK Stats (localStorage) ─────────────────────────────────────────────
        const WK_STATS_KEY     = 'wkBingoStats';
        const WK_PLAYER_KEY    = 'wkPlayerName';

        function loadWkStats() {
            try {
                const raw = localStorage.getItem(WK_STATS_KEY);
                if (!raw) return { totalLines: 0, fastestSec: null, perMatch: {} };
                const p = JSON.parse(raw);
                return {
                    totalLines: p.totalLines || 0,
                    fastestSec: p.fastestSec ?? null,
                    perMatch:   p.perMatch   || {}
                };
            } catch {
                return { totalLines: 0, fastestSec: null, perMatch: {} };
            }
        }

        function saveWkStats(stats) {
            try { localStorage.setItem(WK_STATS_KEY, JSON.stringify(stats)); } catch {}
        }

        function getWkPlayerName() {
            return localStorage.getItem(WK_PLAYER_KEY) || '';
        }

        function setWkPlayerName(name) {
            try { localStorage.setItem(WK_PLAYER_KEY, name); } catch {}
        }

        async function ensureWkPlayerName() {
            // Naam wordt nu inline gevraagd bij openen WK-scherm.
            // Deze fallback is alleen nog voor het geval iemand op Deel klikt zonder naam.
            let name = getWkPlayerName();
            if (name) return name;
            const answer = await bingoPrompt(t('alerts.nameQuestion'), '', { title: t('alerts.yourName'), icon: '✏️', okLabel: t('common.save') });
            name = (answer || '').trim();
            if (name) {
                setWkPlayerName(name);
                renderWkNameUI();
            }
            return name;
        }

        // Toon óf de invul-prompt óf de naam-chip, afhankelijk van of er al een naam is.
        function renderWkNameUI() {
            const name      = getWkPlayerName();
            const promptEl  = document.getElementById('wk-name-prompt');
            const chipEl    = document.getElementById('wk-name-chip');
            const chipName  = document.getElementById('wk-name-chip-name');
            if (!promptEl || !chipEl) return;

            if (name) {
                promptEl.style.display = 'none';
                chipEl.style.display   = 'inline-flex';
                chipName.textContent   = name;
            } else {
                promptEl.style.display = 'block';
                chipEl.style.display   = 'none';
            }
        }

        window.wkSavePlayerName = function() {
            const input = document.getElementById('wk-name-input');
            const name = (input.value || '').trim();
            if (!name) {
                input.focus();
                return;
            }
            setWkPlayerName(name);
            renderWkNameUI();
        };

        window.wkEditPlayerName = function() {
            const input = document.getElementById('wk-name-input');
            input.value = getWkPlayerName();
            document.getElementById('wk-name-prompt').style.display = 'block';
            document.getElementById('wk-name-chip').style.display   = 'none';
            setTimeout(() => { input.focus(); input.select(); }, 50);
        };

        // Registreert een nieuwe bingo-lijn in stats
        function recordWkBingo(matchId, secondsSinceStart) {
            if (!matchId) return;
            const stats = loadWkStats();
            stats.totalLines = (stats.totalLines || 0) + 1;

            const m = stats.perMatch[matchId] || { lines: 0, firstBingoSec: null, lastPlayed: 0, plays: 0 };
            m.lines = (m.lines || 0) + 1;
            m.lastPlayed = Date.now();
            if (m.firstBingoSec == null || secondsSinceStart < m.firstBingoSec) {
                m.firstBingoSec = secondsSinceStart;
            }
            stats.perMatch[matchId] = m;

            if (stats.fastestSec == null || secondsSinceStart < stats.fastestSec) {
                stats.fastestSec = secondsSinceStart;
            }
            saveWkStats(stats);
        }

        // Markeert een wedstrijd als "gespeeld" zodra een vakje wordt aangetikt
        function recordWkMatchEngaged(matchId) {
            if (!matchId) return;
            const stats = loadWkStats();
            const m = stats.perMatch[matchId] || { lines: 0, firstBingoSec: null, lastPlayed: 0, plays: 0 };
            if (!m._engagedThisSession) {
                m.plays = (m.plays || 0) + 1;
                m._engagedThisSession = true; // wordt bij reload niet bewaard, dat is ok
                m.lastPlayed = Date.now();
                stats.perMatch[matchId] = m;
                saveWkStats(stats);
            }
        }

        function formatWkDuration(sec) {
            if (sec == null) return '–';
            if (sec < 60) return sec + 's';
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return m + 'm ' + (s < 10 ? '0' + s : s) + 's';
        }

        function wkMatchById(matchId) {
            return WK_GROEPSWEDSTRIJDEN.find(m => m.id === matchId)
                || WK_KNOCKOUT_WEDSTRIJDEN.find(m => m.id === matchId);
        }

        function wkMatchLabel(matchId) {
            const match = wkMatchById(matchId);
            if (!match) return matchId;
            if (match.team1 === 'TBD') return matchFase(match.fase) || matchId;
            return getTeamLabel(match.team1) + ' – ' + getTeamLabel(match.team2);
        }

        // ─── WK Stats-scherm render ──────────────────────────────────────────────
        window.initWkStatsScreen = function() {
            const stats = loadWkStats();
            const entries = Object.entries(stats.perMatch);
            const matchesWithBingo = entries.filter(([, m]) => (m.lines || 0) > 0).length;
            const matchesPlayed    = entries.filter(([, m]) => (m.plays || 0) > 0).length;

            document.getElementById('wkst-total-lines').textContent        = stats.totalLines || 0;
            document.getElementById('wkst-matches-with-bingo').textContent = matchesWithBingo;
            document.getElementById('wkst-fastest').textContent            = formatWkDuration(stats.fastestSec);
            document.getElementById('wkst-matches-played').textContent     = matchesPlayed;

            const hasAny = entries.some(([, m]) => (m.plays || 0) > 0 || (m.lines || 0) > 0);
            document.getElementById('wkst-empty').style.display            = hasAny ? 'none'  : 'block';
            document.getElementById('wkst-matches-section').style.display  = hasAny ? 'block' : 'none';

            if (!hasAny) return;

            const list = document.getElementById('wkst-matches-list');
            list.innerHTML = '';
            entries
                .filter(([, m]) => (m.plays || 0) > 0 || (m.lines || 0) > 0)
                .sort((a, b) => (b[1].lastPlayed || 0) - (a[1].lastPlayed || 0))
                .forEach(([matchId, m]) => {
                    const match = wkMatchById(matchId);
                    const teams = wkMatchLabel(matchId);
                    const fase  = matchFase(match?.fase || '');
                    const datum = formatMatchDate(match?.datum || '');
                    const row = document.createElement('div');
                    row.className = 'wk-stats-match-row';
                    row.innerHTML = `
                        <div style="min-width:0;flex:1;">
                            <div class="wk-stats-match-teams">${teams}</div>
                            <div class="wk-stats-match-meta">${[fase, datum].filter(Boolean).join(' · ')}</div>
                        </div>
                        <div class="wk-stats-match-numbers">
                            <span title="Lijnen">🎯 ${m.lines || 0}</span>
                            <span title="Snelste bingo">⚡ ${formatWkDuration(m.firstBingoSec)}</span>
                        </div>`;
                    list.appendChild(row);
                });
        };

        window.wkResetStats = async function() {
            if (!await bingoConfirm(t('alerts.wkResetConfirm'), { title: t('alerts.wkResetTitle'), icon: '⚠️', type: 'error', okLabel: t('alerts.wkResetAction') })) return;
            localStorage.removeItem(WK_STATS_KEY);
            initWkStatsScreen();
        };

        // ─── WK Share screenshot (html2canvas, lazy load) ────────────────────────
        function loadHtml2Canvas() {
            if (_html2canvasPromise) return _html2canvasPromise;
            _html2canvasPromise = new Promise((resolve, reject) => {
                if (window.html2canvas) return resolve(window.html2canvas);
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                s.onload  = () => resolve(window.html2canvas);
                s.onerror = () => reject(new Error('Kon html2canvas niet laden'));
                document.head.appendChild(s);
            });
            return _html2canvasPromise;
        }

        function buildWkShareCard() {
            const matchId = wkCurrentMatchId;
            const match   = wkMatchById(matchId);
            const player  = getWkPlayerName() || 'Speler';

            document.getElementById('wk-share-match-title').textContent =
                wkMatchLabel(matchId);

            const metaParts = [];
            if (match?.fase)  metaParts.push(matchFase(match.fase));
            if (match?.datum) metaParts.push(formatMatchDate(match.datum));
            document.getElementById('wk-share-meta').textContent = metaParts.join(' · ') || 'WK Bingo 2026';

            document.getElementById('wk-share-player').textContent = '🏆 ' + player;

            const grid = document.getElementById('wk-share-grid');
            grid.innerHTML = '';
            const liveCells = document.querySelectorAll('#wk-bingo-grid .bingo-cell');
            liveCells.forEach(live => {
                const c = document.createElement('div');
                c.className = 'wk-share-cell' + (live.classList.contains('checked') ? ' checked' : '');
                c.textContent = live.textContent;
                grid.appendChild(c);
            });
        }

        // Bouwt de PNG-blob van de bingo share-card (lazy: html2canvas wordt on-demand geladen).
        async function wkBuildShareBlob() {
            await ensureWkPlayerName();
            buildWkShareCard();
            const html2canvas = await loadHtml2Canvas();
            const node = document.getElementById('wk-share-render');
            const canvas = await html2canvas(node, {
                backgroundColor: null,
                scale: 2,
                logging: false,
                useCORS: true
            });
            return await new Promise((resolve) => canvas.toBlob(b => resolve(b), 'image/png'));
        }

        // Schrijft de PNG-blob naar het clipboard. Niet alle browsers ondersteunen
        // ClipboardItem voor afbeeldingen (iOS Safari < 16, oudere Firefox); dan: false.
        async function wkCopyBlobToClipboard(blob) {
            if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                return true;
            } catch (e) {
                console.warn('Clipboard image write mislukt:', e);
                return false;
            }
        }

        window.wkShareBingo = function() {
            const errEl = document.getElementById('wk-share-choice-error');
            if (errEl) errEl.textContent = '';
            // Reset label-state (kunnen na vorige sessie nog op '✅/⏳' staan)
            const waLabel = document.querySelector('#wk-share-choice-whatsapp .wk-share-choice-label');
            const cpLabel = document.querySelector('#wk-share-choice-copy .wk-share-choice-label');
            if (waLabel) waLabel.textContent = t('wkShare.whatsapp');
            if (cpLabel) cpLabel.textContent = t('wkShare.copy');
            document.getElementById('wk-share-choice-whatsapp').disabled = false;
            document.getElementById('wk-share-choice-copy').disabled = false;
            document.getElementById('wk-share-choice-modal').classList.add('show');
        };

        window.wkCloseShareChoice = function() {
            document.getElementById('wk-share-choice-modal').classList.remove('show');
        };

        window.wkShareDoCopy = async function() {
            const btn   = document.getElementById('wk-share-choice-copy');
            const label = btn.querySelector('.wk-share-choice-label');
            const errEl = document.getElementById('wk-share-choice-error');
            errEl.textContent = '';
            btn.disabled = true;
            const original = label.textContent;
            label.textContent = t('wkShare.busy');
            try {
                const blob = await wkBuildShareBlob();
                if (!blob) throw new Error('Genereren mislukt');
                const ok = await wkCopyBlobToClipboard(blob);
                if (ok) {
                    label.textContent = t('wkShare.copied');
                } else {
                    const matchLabel = wkMatchLabel(wkCurrentMatchId).replace(/[^\w-]+/g, '_');
                    triggerDownload(blob, `WKBingo_${matchLabel}.png`);
                    label.textContent = t('wkShare.saved');
                }
                setTimeout(() => {
                    label.textContent = original;
                    btn.disabled = false;
                    wkCloseShareChoice();
                }, 1300);
            } catch (e) {
                console.error('Share copy fout:', e);
                errEl.textContent = t('wkShare.copyFailed');
                label.textContent = original;
                btn.disabled = false;
            }
        };

        window.wkShareDoWhatsApp = async function() {
            const btn   = document.getElementById('wk-share-choice-whatsapp');
            const label = btn.querySelector('.wk-share-choice-label');
            const errEl = document.getElementById('wk-share-choice-error');
            errEl.textContent = '';
            btn.disabled = true;
            const original = label.textContent;
            label.textContent = t('wkShare.busy');
            try {
                const blob = await wkBuildShareBlob();
                if (!blob) throw new Error('Genereren mislukt');
                // Zet de afbeelding op het clipboard (om in WhatsApp te plakken).
                // Als clipboard-image niet werkt: download als fallback.
                const copied = await wkCopyBlobToClipboard(blob);
                if (!copied) {
                    const matchLabel = wkMatchLabel(wkCurrentMatchId).replace(/[^\w-]+/g, '_');
                    triggerDownload(blob, `WKBingo_${matchLabel}.png`);
                }
                const tekst = t('wkShare.whatsappText', { match: wkMatchLabel(wkCurrentMatchId) });
                const url = `https://wa.me/?text=${encodeURIComponent(tekst)}`;
                window.open(url, '_blank', 'noopener');
                label.textContent = copied ? t('wkShare.pasteInChat') : t('wkShare.saved');
                setTimeout(() => {
                    label.textContent = original;
                    btn.disabled = false;
                    wkCloseShareChoice();
                }, 1600);
            } catch (e) {
                console.error('Share WhatsApp fout:', e);
                errEl.textContent = t('wkShare.shareFailed');
                label.textContent = original;
                btn.disabled = false;
            }
        };

        function triggerDownload(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ─── WK MULTIPLAYER (kamer + live leaderboard) ─────────────────────────
        // ═══════════════════════════════════════════════════════════════════════

        // ─── State ──
        let wkRoomCode      = null;     // huidige kamer-code (null = solo)
        let wkRoomData      = null;     // laatste snapshot
        let wkRoomUnsub     = null;     // onSnapshot unsubscribe
        let wkRoomMyUid     = null;     // cached uid binnen deze kamer
        let wkRoomLastStatus = null;    // om transitions te detecteren
        let _wkScoreWriteTimer = null;  // debounce timer voor score-writes

        // ─── Helpers ──
        function wkRoomDocRef(code) {
            return doc(db, 'artifacts', myAppId, 'public', 'data', 'wkRooms', code);
        }

        function wkGenerateRoomCode() {
            return String(Math.floor(1000 + Math.random() * 9000));
        }

        function wkShuffleArray(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        function wkCanMultiplayer() {
            return !!(db && auth && auth.currentUser);
        }

        function wkUpdateMpOfflineNote() {
            const note = document.getElementById('wk-mp-offline-note');
            const join = document.getElementById('wk-mp-join-btn');
            if (!note || !join) return;
            const can = wkCanMultiplayer();
            note.classList.toggle('show', !can);
            join.disabled = !can;
            // Per-wedstrijd "Met vrienden"-knoppen worden binnen wkOpenCreateModal afgevangen
            // (wkCanMultiplayer()-check), dus die hoeven hier niet apart geblokkeerd te worden.
        }

        // ─── Modals ──
        // Keuze-modal: opent na klik op een wedstrijd, vraagt Solo of Met vrienden
        window.wkOpenMatchActionModal = function(matchId) {
            const m = wkMatchById(matchId);
            if (!m) return;

            const titleEl = document.getElementById('wk-match-action-title');
            const subEl   = document.getElementById('wk-match-action-sub');
            const btnSolo = document.getElementById('wk-match-action-solo');
            const btnMP   = document.getElementById('wk-match-action-multi');

            const isTBD = m.team1 === 'TBD';
            titleEl.textContent = isTBD
                ? m.fase
                : `${getTeamLabel(m.team1)}  vs  ${getTeamLabel(m.team2)}`;
            const subParts = [];
            if (m.datum) subParts.push(`📅 ${formatMatchDate(m.datum)}`);
            if (m.stad)  subParts.push(`📍 ${m.stad}`);
            subEl.textContent = subParts.join('   ·   ');

            // Multi-knop alleen actief als multiplayer kan
            const canMP = wkCanMultiplayer();
            btnMP.disabled = !canMP;
            btnMP.title = canMP ? '' : 'Multiplayer vereist een internetverbinding';

            btnSolo.onclick = () => {
                wkCloseMatchActionModal();
                startWkGame(matchId);
            };
            btnMP.onclick = () => {
                if (!canMP) return;
                wkCloseMatchActionModal();
                wkOpenCreateModal(matchId);
            };

            document.getElementById('wk-match-action-modal').classList.add('show');
        };

        window.wkCloseMatchActionModal = function() {
            document.getElementById('wk-match-action-modal').classList.remove('show');
        };

        // Opent de create-kamer modal voor een vooraf-gekozen wedstrijd.
        // De select #wk-create-match-select is een verborgen value-holder die
        // wkConfirmCreateRoom later uitleest.
        window.wkOpenCreateModal = function(matchId) {
            if (!wkCanMultiplayer()) return;
            const name = getWkPlayerName();
            if (!name) {
                alert(t('alerts.wkFillName'));
                document.getElementById('wk-name-input')?.focus();
                return;
            }

            const sel       = document.getElementById('wk-create-match-select');
            const matchInfo = document.getElementById('wk-create-match-info');

            sel.innerHTML = `<option value="${matchId}" selected></option>`;

            if (matchInfo) {
                const m = wkMatchById(matchId);
                const label = m
                    ? (m.team1 === 'TBD' ? m.fase : `${getTeamLabel(m.team1)} – ${getTeamLabel(m.team2)}`)
                    : matchId;
                const datum = m && m.datum ? ` <span class="wk-create-match-datum">📅 ${formatMatchDate(m.datum)}</span>` : '';
                matchInfo.innerHTML = `<span class="wk-create-match-label">${t('alerts.match')}:</span> <strong>${label}</strong>${datum}`;
                matchInfo.style.display = '';
            }

            document.getElementById('wk-create-error').textContent = '';
            document.getElementById('wk-create-confirm-btn').disabled = false;
            document.getElementById('wk-create-modal').classList.add('show');
        };

        window.wkCloseCreateModal = function() {
            document.getElementById('wk-create-modal').classList.remove('show');
        };

        window.wkOpenJoinModal = function() {
            if (!wkCanMultiplayer()) return;
            const name = getWkPlayerName();
            if (!name) {
                alert(t('alerts.wkFillName'));
                document.getElementById('wk-name-input')?.focus();
                return;
            }
            document.getElementById('wk-join-code-input').value = '';
            document.getElementById('wk-join-error').textContent = '';
            document.getElementById('wk-join-confirm-btn').disabled = false;
            document.getElementById('wk-join-modal').classList.add('show');
            setTimeout(() => document.getElementById('wk-join-code-input').focus(), 50);
        };

        window.wkCloseJoinModal = function() {
            document.getElementById('wk-join-modal').classList.remove('show');
        };

        // ─── Kamer maken ──
        window.wkConfirmCreateRoom = async function() {
            const btn   = document.getElementById('wk-create-confirm-btn');
            const errEl = document.getElementById('wk-create-error');
            errEl.textContent = '';
            btn.disabled = true;

            try {
                const matchId = document.getElementById('wk-create-match-select').value;
                const myName  = getWkPlayerName() || 'Speler';
                const myUid   = auth.currentUser.uid;

                // Kies 16 unieke woorden uit de pool
                const pool = getWordPool(matchId);
                if (pool.length < 16) {
                    errEl.textContent = t('alerts.noWordsMatch');
                    btn.disabled = false;
                    return;
                }
                const words = pickRandom(pool, 16, wkTermWeight);
                const myOrder = wkShuffleArray([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);

                // Vind een unieke code (max 6 pogingen)
                let code = null;
                for (let i = 0; i < 6; i++) {
                    const c = wkGenerateRoomCode();
                    const snap = await getDoc(wkRoomDocRef(c));
                    if (!snap.exists()) { code = c; break; }
                }
                if (!code) {
                    errEl.textContent = 'Kan geen vrije code vinden, probeer opnieuw.';
                    btn.disabled = false;
                    return;
                }

                const now = Date.now();
                const roomData = {
                    matchId,
                    hostUid:    myUid,
                    createdAt:  now,
                    status:     'lobby',
                    startedAt:  null,
                    words,
                    players: {
                        [myUid]: {
                            name:          myName,
                            joinedAt:      now,
                            cardOrder:     myOrder,
                            score:         0,
                            bingos:        0,
                            firstBingoSec: null,
                            lastUpdate:    now
                        }
                    }
                };

                await setDoc(wkRoomDocRef(code), roomData);
                wkCloseCreateModal();
                wkEnterRoom(code);
            } catch (err) {
                console.error('Kamer maken mislukt:', err);
                errEl.textContent = 'Kamer maken mislukt. Probeer opnieuw.';
                btn.disabled = false;
            }
        };

        // ─── Kamer joinen ──
        window.wkConfirmJoinRoom = async function() {
            const btn   = document.getElementById('wk-join-confirm-btn');
            const errEl = document.getElementById('wk-join-error');
            const code  = (document.getElementById('wk-join-code-input').value || '').trim();
            errEl.textContent = '';

            if (!/^\d{4}$/.test(code)) {
                errEl.textContent = 'Voer een 4-cijferige code in.';
                return;
            }
            btn.disabled = true;

            try {
                const ref = wkRoomDocRef(code);
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    errEl.textContent = 'Kamer niet gevonden.';
                    btn.disabled = false;
                    return;
                }
                const data = snap.data();
                if (data.status === 'finished') {
                    errEl.textContent = 'Deze kamer is al afgesloten.';
                    btn.disabled = false;
                    return;
                }

                const myUid  = auth.currentUser.uid;
                const myName = getWkPlayerName() || 'Speler';

                // Late join is OK. Als speler al bestaat (rejoin) → behoud voortgang.
                const existing = data.players?.[myUid];
                if (!existing) {
                    const myOrder = wkShuffleArray([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
                    const now = Date.now();
                    await updateDoc(ref, {
                        ['players.' + myUid]: {
                            name:          myName,
                            joinedAt:      now,
                            cardOrder:     myOrder,
                            score:         0,
                            bingos:        0,
                            firstBingoSec: null,
                            lastUpdate:    now
                        }
                    });
                }

                wkCloseJoinModal();
                wkEnterRoom(code);
            } catch (err) {
                console.error('Joinen mislukt:', err);
                errEl.textContent = 'Joinen mislukt. Probeer opnieuw.';
                btn.disabled = false;
            }
        };

        // ─── Kamer betreden + live updates ──
        function wkEnterRoom(code) {
            wkRoomCode    = code;
            wkRoomMyUid   = auth.currentUser.uid;
            wkRoomLastStatus = null;

            // Verberg solo-elementen
            document.getElementById('wk-selector').style.display = 'none';
            document.getElementById('wk-mp-card').style.display  = 'none';
            document.getElementById('wk-lobby').style.display    = 'block';

            // Live abonnement
            if (wkRoomUnsub) { try { wkRoomUnsub(); } catch {} }
            wkRoomUnsub = onSnapshot(wkRoomDocRef(code), snap => {
                if (!snap.exists()) {
                    wkLeaveRoom('Kamer verwijderd.');
                    return;
                }
                wkRoomData = snap.data();
                wkOnRoomUpdate();
            }, err => {
                console.error('Room snapshot fout:', err);
                wkLeaveRoom('Verbinding met kamer verloren.');
            });
        }

        function wkOnRoomUpdate() {
            const data = wkRoomData;
            if (!data) return;

            // Status-transitie: lobby → playing → in game
            if (data.status === 'lobby') {
                renderWkLobby();
                // Verberg game-view
                document.getElementById('wk-game').style.display  = 'none';
                document.getElementById('wk-lobby').style.display = 'block';
            } else if (data.status === 'playing') {
                // Eerste keer dat we 'playing' zien → start game-view
                if (wkRoomLastStatus !== 'playing') {
                    wkEnterRoomGame();
                }
                renderWkLeaderboard();
            } else if (data.status === 'finished') {
                renderWkFinishScreen();
            }

            wkRoomLastStatus = data.status;
        }

        // ─── Lobby render ──
        function renderWkLobby() {
            const data    = wkRoomData;
            const match   = wkMatchById(data.matchId);
            const isHost  = data.hostUid === wkRoomMyUid;
            const players = Object.entries(data.players || {});
            const lobby   = document.getElementById('wk-lobby');

            lobby.innerHTML = `
                <div class="wk-lobby">
                    <div class="wk-lobby-header">
                        <div class="wk-lobby-label">Kamercode — deel met vrienden</div>
                        <div class="wk-lobby-code">${wkRoomCode}</div>
                        <div class="wk-lobby-match">${wkMatchLabel(data.matchId)}</div>
                        <div class="wk-lobby-meta">${[matchFase(match?.fase), formatMatchDate(match?.datum)].filter(Boolean).join(' · ')}</div>
                    </div>

                    <div class="wk-lobby-players-title">Spelers (${players.length})</div>
                    <div class="wk-lobby-players">
                        ${players.map(([uid, p]) => `
                            <div class="wk-lobby-player ${uid === wkRoomMyUid ? 'is-me' : ''}">
                                <span class="wk-lobby-player-name">${escapeHtml(p.name)}</span>
                                ${uid === data.hostUid ? '<span class="wk-lobby-player-tag">Host</span>' : ''}
                            </div>
                        `).join('')}
                    </div>

                    <div class="wk-lobby-buttons">
                        <button class="wk-mp-btn secondary" onclick="wkLeaveRoomConfirm()">Verlaat kamer</button>
                        ${isHost
                            ? `<button class="wk-mp-btn primary" ${players.length < 1 ? 'disabled' : ''} onclick="wkHostStart()">⚽ Start (${players.length})</button>`
                            : `<div class="wk-lobby-waiting">⏳ Wacht op host…</div>`}
                    </div>
                </div>
            `;
        }

        // escapeHtml → utils.js

        window.wkHostStart = async function() {
            if (!wkRoomCode || !wkRoomData) return;
            if (wkRoomData.hostUid !== wkRoomMyUid) return;
            try {
                await updateDoc(wkRoomDocRef(wkRoomCode), {
                    status:    'playing',
                    startedAt: Date.now()
                });
            } catch (err) {
                console.error('Start mislukt:', err);
                alert(t('alerts.wkStartFailed'));
            }
        };

        window.wkLeaveRoomConfirm = async function() {
            if (await bingoConfirm(t('alerts.wkLeaveConfirm'), { title: t('alerts.wkLeaveTitle'), icon: '🚪', type: 'error', okLabel: t('alerts.wkLeaveAction') })) {
                wkLeaveRoom();
            }
        };

        function wkLeaveRoom(reason) {
            if (wkRoomUnsub) { try { wkRoomUnsub(); } catch {} }
            wkRoomUnsub = null;
            wkRoomCode  = null;
            wkRoomData  = null;
            wkRoomMyUid = null;
            wkRoomLastStatus = null;
            if (_wkScoreWriteTimer) { clearTimeout(_wkScoreWriteTimer); _wkScoreWriteTimer = null; }

            document.getElementById('wk-lobby').style.display    = 'none';
            document.getElementById('wk-game').style.display     = 'none';
            document.getElementById('wk-selector').style.display = 'block';
            document.getElementById('wk-mp-card').style.display  = 'block';
            document.getElementById('wk-leaderboard').style.display = 'none';

            if (reason) alert(reason);
        }

        // ─── In-game (kamer-modus) ──
        function wkEnterRoomGame() {
            const data  = wkRoomData;
            const match = wkMatchById(data.matchId);
            const me    = data.players?.[wkRoomMyUid];
            if (!me) return;

            wkCurrentMatchId = data.matchId;

            // Bouw mijn kaart uit gedeelde woorden + mijn order
            wkCurrentWords  = me.cardOrder.map(i => data.words[i]);
            wkWinningLines.clear();
            document.getElementById('wk-bingo-lines').innerHTML = '';

            // Match-titel
            const isTBD = match?.team1 === 'TBD';
            const title = isTBD ? (matchFase(match?.fase) || data.matchId)
                                : getTeamLabel(match.team1) + ' vs ' + getTeamLabel(match.team2);
            document.getElementById('wk-match-title').textContent = title;

            // Refreshes uit zetten in kamer-modus (anders zou je je bingokans 'overhusselen')
            wkRefreshesLeft = 0;
            wkUpdateRefreshUI();
            const shuffleBtn = document.getElementById('wk-btn-shuffle');
            if (shuffleBtn) shuffleBtn.style.display = 'none';

            // Stats: match-start = room-start (één tijdslijn voor iedereen)
            wkMatchStartTs = data.startedAt || Date.now();
            wkMatchBingosLogged = (me.bingos || 0);

            wkRenderGrid();

            // Verberg lobby, toon game + leaderboard
            document.getElementById('wk-lobby').style.display       = 'none';
            document.getElementById('wk-selector').style.display    = 'none';
            document.getElementById('wk-mp-card').style.display     = 'none';
            document.getElementById('wk-game').style.display        = 'block';
            document.getElementById('wk-leaderboard').style.display = 'block';
            document.getElementById('wk-leaderboard-code').textContent = wkRoomCode;

            // Host krijgt "Beëindig wedstrijd"-knop in leaderboard
            const isHost = data.hostUid === wkRoomMyUid;
            document.getElementById('wk-host-finish-btn').style.display = isHost ? 'block' : 'none';

            // "Andere wedstrijd"-knop vervangen door "Verlaat kamer"
            const backBtn = document.getElementById('wk-game-back-btn');
            backBtn.textContent = '🚪 Verlaat kamer';
            backBtn.onclick = wkLeaveRoomConfirm;
        }

        function renderWkLeaderboard() {
            const data = wkRoomData;
            const listEl = document.getElementById('wk-leaderboard-list');
            if (!data || !listEl) return;

            const players = Object.entries(data.players || {}).map(([uid, p]) => ({ uid, ...p }));

            // Sorteer: eerst spelers met bingo (op firstBingoSec asc), daarna op score desc
            players.sort((a, b) => {
                const aHas = a.firstBingoSec != null;
                const bHas = b.firstBingoSec != null;
                if (aHas && bHas) return a.firstBingoSec - b.firstBingoSec;
                if (aHas) return -1;
                if (bHas) return 1;
                return (b.score || 0) - (a.score || 0);
            });

            listEl.innerHTML = players.map((p, idx) => `
                <div class="wk-leaderboard-row ${p.uid === wkRoomMyUid ? 'is-me' : ''}">
                    <span class="wk-leaderboard-rank">${idx + 1}</span>
                    <span class="wk-leaderboard-name">${escapeHtml(p.name)}</span>
                    <span class="wk-leaderboard-score">${p.score || 0}/16${p.bingos > 0 ? ` <span class="wk-leaderboard-bingo">⚽${p.bingos}</span>` : ''}</span>
                </div>
            `).join('');
        }

        // ─── Score schrijven (gedebouncet) ──
        function scheduleWkScoreWrite() {
            if (!wkRoomCode || !wkRoomMyUid) return;
            if (_wkScoreWriteTimer) clearTimeout(_wkScoreWriteTimer);
            _wkScoreWriteTimer = setTimeout(flushWkScore, 1500);
        }

        async function flushWkScore() {
            _wkScoreWriteTimer = null;
            if (!wkRoomCode || !wkRoomMyUid) return;
            const cells = document.querySelectorAll('#wk-bingo-grid .bingo-cell.checked');
            const score = cells.length;
            try {
                await updateDoc(wkRoomDocRef(wkRoomCode), {
                    ['players.' + wkRoomMyUid + '.score']:      score,
                    ['players.' + wkRoomMyUid + '.lastUpdate']: Date.now()
                });
            } catch (err) {
                console.warn('Score write mislukt:', err);
            }
        }

        // Schrijf bingo direct (geen debounce — moment is belangrijk voor leaderboard)
        async function writeWkBingoToRoom(totalBingos, firstBingoSec) {
            if (!wkRoomCode || !wkRoomMyUid) return;
            try {
                const patch = {
                    ['players.' + wkRoomMyUid + '.bingos']:     totalBingos,
                    ['players.' + wkRoomMyUid + '.lastUpdate']: Date.now()
                };
                // Alleen firstBingoSec schrijven als dit de eerste is
                const me = wkRoomData?.players?.[wkRoomMyUid];
                if (firstBingoSec != null && (!me || me.firstBingoSec == null)) {
                    patch['players.' + wkRoomMyUid + '.firstBingoSec'] = firstBingoSec;
                }
                await updateDoc(wkRoomDocRef(wkRoomCode), patch);
            } catch (err) {
                console.warn('Bingo write mislukt:', err);
            }
        }

        // ─── Eindscherm ──
        function renderWkFinishScreen() {
            const data    = wkRoomData;
            const match   = wkMatchById(data.matchId);
            const players = Object.entries(data.players || {}).map(([uid, p]) => ({ uid, ...p }));
            players.sort((a, b) => {
                const aHas = a.firstBingoSec != null;
                const bHas = b.firstBingoSec != null;
                if (aHas && bHas) return a.firstBingoSec - b.firstBingoSec;
                if (aHas) return -1;
                if (bHas) return 1;
                return (b.score || 0) - (a.score || 0);
            });

            const lobby = document.getElementById('wk-lobby');
            const medals = ['🥇', '🥈', '🥉'];
            const cls    = ['gold', 'silver', 'bronze'];

            lobby.innerHTML = `
                <div class="wk-finish-card">
                    <div class="wk-finish-title">🏁 Eindstand</div>
                    <div class="wk-finish-sub">${wkMatchLabel(data.matchId)}</div>
                    <div class="wk-finish-podium">
                        ${players.map((p, idx) => `
                            <div class="wk-finish-row ${idx < 3 ? cls[idx] : ''}">
                                <span class="wk-finish-medal">${idx < 3 ? medals[idx] : (idx + 1) + '.'}</span>
                                <span class="wk-finish-name">${escapeHtml(p.name)}${p.uid === wkRoomMyUid ? ' (jij)' : ''}</span>
                                <span class="wk-finish-time">
                                    ${p.firstBingoSec != null
                                        ? '⚽ ' + formatWkDuration(p.firstBingoSec)
                                        : '<span class="wk-finish-nobingo">' + (p.score || 0) + '/16</span>'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <button class="wk-mp-btn primary" style="width:100%;" onclick="wkLeaveRoom()">Sluiten</button>
            `;
            lobby.style.display = 'block';
            document.getElementById('wk-game').style.display        = 'none';
            document.getElementById('wk-leaderboard').style.display = 'none';
        }

        window.wkHostFinish = async function() {
            if (!wkRoomCode || !wkRoomData) return;
            if (wkRoomData.hostUid !== wkRoomMyUid) return;
            try {
                await updateDoc(wkRoomDocRef(wkRoomCode), { status: 'finished' });
            } catch (err) {
                console.error('Afsluiten mislukt:', err);
            }
        };

        // ─── WK functies ─────────────────────────────────────────────────────────

        function getTeamLabel(code) {
            return teamName(code);
        }

        function getWordPool(matchId) {
            // Zoek in groepswedstrijden en knockout
            let match = WK_GROEPSWEDSTRIJDEN.find(m => m.id === matchId)
                     || WK_KNOCKOUT_WEDSTRIJDEN.find(m => m.id === matchId);
            if (!match) return WK_VOETBAL_TERMEN.map(translateWord);

            const t1words = teamWoorden(match.team1);  // al taal-aware
            const t2words = teamWoorden(match.team2);
            const extra   = (match.extra || []).map(translateWord);
            const general = WK_VOETBAL_TERMEN.map(translateWord);

            // Dedupliceer
            return [...new Set([...general, ...t1words, ...t2words, ...extra])];
        }

        window.initWkScreen = function() {
            // Naam-UI tonen (prompt of chip)
            renderWkNameUI();
            // Enter in naam-input = opslaan
            const nameInput = document.getElementById('wk-name-input');
            if (nameInput && !nameInput._wkBound) {
                nameInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { e.preventDefault(); wkSavePlayerName(); }
                });
                nameInput._wkBound = true;
            }

            // Multiplayer beschikbaarheid checken
            wkUpdateMpOfflineNote();

            // Enter-toets bindings voor modals
            const joinInput = document.getElementById('wk-join-code-input');
            if (joinInput && !joinInput._wkBound) {
                joinInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { e.preventDefault(); wkConfirmJoinRoom(); }
                });
                // Klik op overlay-achtergrond sluit modal
                document.getElementById('wk-join-modal').addEventListener('click', e => {
                    if (e.target.id === 'wk-join-modal') wkCloseJoinModal();
                });
                document.getElementById('wk-create-modal').addEventListener('click', e => {
                    if (e.target.id === 'wk-create-modal') wkCloseCreateModal();
                });
                document.getElementById('wk-match-action-modal').addEventListener('click', e => {
                    if (e.target.id === 'wk-match-action-modal') wkCloseMatchActionModal();
                });
                joinInput._wkBound = true;
            }

            // Render poule-tabs
            const tabsEl = document.getElementById('wk-poule-tabs');
            tabsEl.innerHTML = '';
            'ABCDEFGHIJKL'.split('').forEach(letter => {
                const btn = document.createElement('button');
                btn.className = 'wk-poule-tab' + (letter === wkCurrentPoule ? ' active' : '');
                btn.textContent = letter;
                btn.onclick = () => setWkPoule(letter);
                tabsEl.appendChild(btn);
            });
            renderWkPouleMatches(wkCurrentPoule);
            renderWkKnockoutMatches();
        };

        window.setWkTab = function(tab) {
            wkCurrentTab = tab;
            document.querySelectorAll('.wk-tab').forEach((b, i) => {
                b.classList.toggle('active', (i === 0 && tab === 'groep') || (i === 1 && tab === 'knockout'));
            });
            document.getElementById('wk-groep-view').style.display   = tab === 'groep'   ? 'block' : 'none';
            document.getElementById('wk-knockout-view').style.display = tab === 'knockout'? 'block' : 'none';
        };

        window.setWkPoule = function(poule) {
            wkCurrentPoule = poule;
            document.querySelectorAll('.wk-poule-tab').forEach(b => {
                b.classList.toggle('active', b.textContent === poule);
            });
            renderWkPouleMatches(poule);
        };

        function renderWkPouleMatches(poule) {
            const container = document.getElementById('wk-poule-matches');
            const titleEl   = document.getElementById('wk-poule-title');
            const groep = WK_GROEPEN[poule];
            if (!groep) return;

            const teamNames = groep.teams.map(t => teamName(t)).join(' · ');
            titleEl.textContent = 'Poule ' + poule + ' — ' + teamNames;

            container.innerHTML = '';
            const matches = WK_GROEPSWEDSTRIJDEN.filter(m => m.poule === poule);
            matches.forEach(match => {
                container.appendChild(buildMatchItem(match));
            });
        }

        function renderWkKnockoutMatches() {
            const container = document.getElementById('wk-knockout-matches');
            container.innerHTML = '';

            const rounds = [
                { label: 'Ronde van 32',  fase: 'Ronde van 32' },
                { label: 'Achtste finale', fase: 'Achtste finale' },
                { label: 'Kwartfinale',   fase: 'Kwartfinale' },
                { label: 'Halve finale',  fase: 'Halve finale' },
                { label: '3e / 4e plaats',fase: '3e/4e plaats' },
                { label: 'Finale',        fase: 'Finale' },
            ];

            rounds.forEach(round => {
                const matches = WK_KNOCKOUT_WEDSTRIJDEN.filter(m => m.fase === round.fase);
                if (!matches.length) return;
                const heading = document.createElement('div');
                heading.className = 'wk-round-heading';
                heading.textContent = round.label;
                container.appendChild(heading);
                matches.forEach(match => container.appendChild(buildMatchItem(match)));
            });
        }

        function getTeamLabelRight(code) {
            return teamName(code);
        }

        // options.onClick: (matchId) => void, override default wk-keuze-modal flow
        function buildMatchItem(match, options) {
            const isTBD = match.team1 === 'TBD';
            const t1 = WK_TEAMS[match.team1];
            const t2 = WK_TEAMS[match.team2];
            const t1Flag = isTBD ? '<span class="wk-flag-fallback">⚽</span>' : flagSpan(match.team1);
            const t2Flag = isTBD ? '<span class="wk-flag-fallback">⚽</span>' : flagSpan(match.team2);
            const t1Name = isTBD ? '?' : teamName(match.team1);
            const t2Name = isTBD ? '?' : teamName(match.team2);
            const t1Code = isTBD ? '?' : match.team1;
            const t2Code = isTBD ? '?' : match.team2;

            const onClick = (options && options.onClick) || ((id) => wkOpenMatchActionModal(id));

            const item = document.createElement('div');
            item.className = 'wk-match-item';
            item.onclick = () => onClick(match.id);
            item.innerHTML =
                `<div class="wk-team-sticker t1${isTBD ? ' tbd' : ''}">
                    ${isTBD ? '' : `<span class="wk-team-code-badge">${t1Code}</span>`}
                    <span class="wk-team-flag">${t1Flag}</span>
                    <span class="wk-team-name">${t1Name}</span>
                </div>
                <span class="wk-match-vs">vs</span>
                <div class="wk-team-sticker t2${isTBD ? ' tbd' : ''}">
                    ${isTBD ? '' : `<span class="wk-team-code-badge">${t2Code}</span>`}
                    <span class="wk-team-flag">${t2Flag}</span>
                    <span class="wk-team-name">${t2Name}</span>
                </div>
                <div class="wk-match-meta">
                    ${match.datum ? `<span>📅 ${formatMatchDate(match.datum)}</span>` : ''}
                    ${match.stad  ? `<span>📍 ${match.stad}</span>`  : ''}
                </div>`;
            return item;
        }

        window.startWkGame = function(matchId) {
            wkCurrentMatchId = matchId;
            const match = WK_GROEPSWEDSTRIJDEN.find(m => m.id === matchId)
                       || WK_KNOCKOUT_WEDSTRIJDEN.find(m => m.id === matchId);
            if (!match) return;

            const isTBD = match.team1 === 'TBD';
            const title = isTBD
                ? matchFase(match.fase)
                : getTeamLabel(match.team1) + ' vs ' + getTeamLabel(match.team2);

            document.getElementById('wk-match-title').innerHTML = title;

            wkRefreshesLeft = 3;
            wkUpdateRefreshUI();

            const pool = getWordPool(matchId);
            wkCurrentWords = pickRandom(pool, 16, wkTermWeight);
            wkWinningLines.clear();
            document.getElementById('wk-bingo-lines').innerHTML = '';

            // Solo-modus: zorg dat kamer-elementen verborgen zijn (kan blijven hangen na exit)
            document.getElementById('wk-leaderboard').style.display = 'none';
            const shuffleBtn = document.getElementById('wk-btn-shuffle');
            if (shuffleBtn) shuffleBtn.style.display = '';
            const backBtn = document.getElementById('wk-game-back-btn');
            if (backBtn) {
                backBtn.textContent = t('alerts.otherMatch');
                backBtn.onclick = wkBackToSelector;
            }

            // Stats: nieuwe match-sessie
            wkMatchStartTs = Date.now();
            wkMatchBingosLogged = 0;
            // Reset _engagedThisSession flag voor deze match in stats
            const _stats = loadWkStats();
            if (_stats.perMatch[matchId]) {
                delete _stats.perMatch[matchId]._engagedThisSession;
                saveWkStats(_stats);
            }

            wkRenderGrid();

            document.getElementById('wk-selector').style.display = 'none';
            document.getElementById('wk-game').style.display     = 'block';
        };

        window.wkBackToSelector = function() {
            document.getElementById('wk-game').style.display     = 'none';
            document.getElementById('wk-selector').style.display = 'block';
            document.getElementById('wk-mp-card').style.display  = 'block';
            document.getElementById('wk-leaderboard').style.display = 'none';
            wkCurrentMatchId = null;

            // Reset game-back-knop (kan zijn overgenomen door kamer-modus)
            const backBtn = document.getElementById('wk-game-back-btn');
            if (backBtn) {
                backBtn.textContent = t('alerts.otherMatch');
                backBtn.onclick = wkBackToSelector;
            }
            // Shuffle-knop weer zichtbaar
            const shuffleBtn = document.getElementById('wk-btn-shuffle');
            if (shuffleBtn) shuffleBtn.style.display = '';
        };

        window.wkRefreshCard = function() {
            if (wkRefreshesLeft <= 0) return;
            wkRefreshesLeft--;
            wkUpdateRefreshUI();
            if (wkCurrentMatchId) {
                const pool = getWordPool(wkCurrentMatchId);
                wkCurrentWords = pickRandom(pool, 16, wkTermWeight);
            }
            wkWinningLines.clear();
            document.getElementById('wk-bingo-lines').innerHTML = '';
            wkRenderGrid();
        };

        function wkUpdateRefreshUI() {
            document.getElementById('wk-shuffle-count').textContent = wkRefreshesLeft;
            document.getElementById('wk-btn-shuffle').disabled      = wkRefreshesLeft <= 0;
        }

        function wkRenderGrid() {
            const grid = document.getElementById('wk-bingo-grid');
            grid.innerHTML = '';
            wkCurrentWords.forEach(word => {
                const cell = document.createElement('div');
                cell.className = 'bingo-cell flash';
                cell.textContent = word;
                cell.onclick = () => toggleWkCell(cell);
                grid.appendChild(cell);
            });
            setTimeout(() => grid.querySelectorAll('.bingo-cell').forEach(c => c.classList.remove('flash')), 500);
        }

        window.toggleWkCell = function(cell) {
            if (navigator.vibrate) navigator.vibrate(20);
            cell.classList.toggle('checked');
            recordWkMatchEngaged(wkCurrentMatchId);
            checkWkBingo();
            // In kamer-modus: live score syncen (gedebouncet)
            if (wkRoomCode) scheduleWkScoreWrite();
        };

        function checkWkBingo() {
            const cells    = document.querySelectorAll('#wk-bingo-grid .bingo-cell');
            const linesEl  = document.getElementById('wk-bingo-lines');
            const size     = 4;
            let newBingo   = false;
            let newLinesThisCheck = 0;

            const check = (indices, id, cls) => {
                if (indices.every(i => cells[i]?.classList.contains('checked')) && !wkWinningLines.has(id)) {
                    wkWinningLines.add(id);
                    newBingo = true;
                    newLinesThisCheck++;
                    const l = document.createElement('div');
                    l.className = `strike-line ${cls}`;
                    linesEl.appendChild(l);
                }
            };

            for (let i = 0; i < size; i++) {
                check([0,1,2,3].map(j => i*size+j), `row-${i}`, `strike-row-${i}`);
                check([0,1,2,3].map(j => j*size+i), `col-${i}`, `strike-col-${i}`);
            }
            check([0,5,10,15], 'diag-1', 'strike-diag-1');
            check([3,6,9,12],  'diag-2', 'strike-diag-2');

            if (newBingo) {
                if (navigator.vibrate) navigator.vibrate([100,50,100]);

                // Stats: log elke nieuwe lijn met tijd sinds match-start
                const secsSinceStart = wkMatchStartTs
                    ? Math.max(1, Math.round((Date.now() - wkMatchStartTs) / 1000))
                    : null;
                const wasFirstBingo = (wkMatchBingosLogged === 0);
                for (let i = 0; i < newLinesThisCheck; i++) {
                    recordWkBingo(wkCurrentMatchId, secsSinceStart);
                    wkMatchBingosLogged++;
                }

                // Kamer-modus: schrijf bingo direct naar Firestore (geen debounce)
                if (wkRoomCode) {
                    // Forceer ook een score-flush zodat 'score' = aantal afgestreepte vakjes klopt
                    if (_wkScoreWriteTimer) { clearTimeout(_wkScoreWriteTimer); _wkScoreWriteTimer = null; }
                    flushWkScore();
                    writeWkBingoToRoom(
                        wkMatchBingosLogged,
                        wasFirstBingo ? secsSinceStart : null
                    );
                }

                // Show WK goal overlay instead of generic bingo overlay
                const goalMessages = t('wkGoal.subs');
                document.getElementById('wk-goal-sub').textContent = goalMessages[Math.floor(Math.random() * goalMessages.length)];
                const overlay = document.getElementById('wk-goal-overlay');
                overlay.style.display = 'flex';
                overlay.classList.add('show');
            }
        }

        window.closeWkGoal = function() {
            const overlay = document.getElementById('wk-goal-overlay');
            overlay.classList.remove('show');
            overlay.style.display = 'none';
        };

        // ─── Hook initWkScreen in goTo ───────────────────────────────────────────
        const _prevGoTo = window.goTo;
        window.goTo = function(id) {
            if (id === 'screen-wk')       initWkScreen();
            if (id === 'screen-wk-stats') initWkStatsScreen();
            if (id === 'screen-borrel')   initBbSelector();
            _prevGoTo(id);
        };
        window.goHome = () => { window.goTo('screen-home'); };

        // ─── Generator Wizard ─────────────────────────────────────────────────────
        let genWizardStep = 1;
        const GEN_WIZARD_STEPS = [
            { label: '1' },
            { label: '2' },
            { label: '3' },
            { label: '4' },
            { label: '5' },
            { label: '6' },
        ];

        function genWizardInit() {
            genWizardStep = 1;
            // Reset option-card states
            document.getElementById('gen-opt-print')?.classList.add('selected');
            document.getElementById('gen-opt-online')?.classList.remove('selected');
            document.getElementById('gen-opt-4x4')?.classList.add('selected');
            document.getElementById('gen-opt-5x5')?.classList.remove('selected');
            // Volgorde default op Nee
            setOrderKnown(false);
            // Verberg output en foutmeldingen van een vorige sessie
            const out = document.getElementById('gen-output');
            if (out) out.style.display = 'none';
            const err = document.getElementById('gen-error');
            if (err) err.style.display = 'none';
            const prog = document.getElementById('gen-progress');
            if (prog) prog.style.display = 'none';
            showGenStep(1);
        }

        function showGenStep(step) {
            for (let i = 1; i <= 6; i++) {
                const el = document.getElementById('gen-step-' + i);
                if (el) el.style.display = i === step ? '' : 'none';
            }
            const prevBtn = document.getElementById('gen-prev-btn');
            const nextBtn = document.getElementById('gen-next-btn');
            if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : '';
            if (nextBtn) {
                nextBtn.style.display = step === 6 ? 'none' : '';
            }
            const nav = document.getElementById('gen-wizard-nav');
            if (nav) nav.style.display = step === 6 ? 'none' : '';

            // Stap 4: render preview
            if (step === 4) {
                renderThemePicker();
                renderGenPreview();
            }

            updateGenWizardBar(step);
        }

        function updateGenWizardBar(currentStep) {
            const bar = document.getElementById('gen-wizard-bar');
            if (!bar) return;
            bar.innerHTML = '';
            for (let i = 1; i <= 6; i++) {
                if (i > 1) {
                    const conn = document.createElement('div');
                    conn.className = 'gen-wizard-connector' + (i <= currentStep ? ' done' : '');
                    bar.appendChild(conn);
                }
                const dot = document.createElement('div');
                dot.className = 'gen-wizard-step-dot' +
                    (i === currentStep ? ' active' : i < currentStep ? ' done' : '');
                dot.textContent = i < currentStep ? '✓' : i;
                bar.appendChild(dot);
            }
        }

        window.genWizardNext = function() {
            if (!validateGenStep(genWizardStep)) return;
            if (genWizardStep < 6) {
                genWizardStep++;
                showGenStep(genWizardStep);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        window.genWizardPrev = function() {
            if (genWizardStep > 1) {
                genWizardStep--;
                showGenStep(genWizardStep);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        function showStepWarning(elId, msg, color) {
            const el = document.getElementById(elId);
            if (!el) return;
            el.textContent = msg;
            el.style.color = color || 'var(--danger)';
            clearTimeout(el._warnTimer);
            el._warnTimer = setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 4000);
        }

        function validateGenStep(step) {
            if (step === 3) {
                const words = (document.getElementById('gen-words')?.value || '')
                    .split('\n').map(w => w.trim()).filter(Boolean);
                const minWords = genGridSize * genGridSize;
                if (words.length < minWords) {
                    const hint = document.getElementById('gen-words-hint');
                    if (hint) {
                        hint.textContent = `⚠️ Voer minimaal ${minWords} woorden in (je hebt er ${words.length}).`;
                        hint.style.color = 'var(--danger)';
                        setTimeout(() => { hint.textContent = `Vul minimaal ${minWords} woorden in, één per regel.`; hint.style.color = ''; }, 3000);
                    }
                    return false;
                }
                // Waarschuwing (niet blokkerend) als je precies het minimum hebt
                if (words.length === minWords) {
                    showStepWarning('gen-words-hint',
                        `⚠️ Je hebt precies het minimum (${minWords} woorden). Meer woorden zorgen voor meer variatie tussen de kaarten.`,
                        'var(--brand-primary)');
                }
            }
            if (step === 4) {
                const title = document.getElementById('gen-design-title')?.value.trim() ||
                              (getFormDraftTheme() || getActiveTheme()).title || '';
                if (!title) {
                    showStepWarning('gen-design-title-warn',
                        '⚠️ Je hebt nog geen koptekst ingevuld. Je kaarten krijgen dan geen titel.',
                        'var(--brand-primary)');
                    // Niet blokkerend — gebruiker mag doorgaan
                }
            }
            return true;
        }

        window.setOrderKnown = function(known) {
            const checkbox = document.getElementById('gen-order-known');
            if (checkbox) checkbox.checked = known;
            document.getElementById('gen-opt-order-no')?.classList.toggle('selected', !known);
            document.getElementById('gen-opt-order-yes')?.classList.toggle('selected', known);
            onOrderKnownChange();
        };

        // Tijdelijke testknop: vult woordenlijst met Nederlandse steden
        window.fillTestWords = function() {
            const words = ['Groningen','Amsterdam','Eindhoven','Assen','Emmen','Emmeloord','Drunen','Vught','Cromvoirt','Arnhem','Nijmegen','Apeldoorn','Ouddorp','Den Haag','Dordrecht','Rotterdam','Venray','Maastricht','Heerlen','Haaren','Werkhoven','Wijk bij Duurstede','Urk','Volendam'];
            document.getElementById('gen-words').value = words.join('\n');
            window.updateWordCounter();
        }

        // Woordteller in stap 3
        window.updateWordCounter = function() {
            const textarea = document.getElementById('gen-words');
            const counter  = document.getElementById('gen-word-counter');
            if (!textarea || !counter) return;
            const words = textarea.value.split('\n').map(w => w.trim()).filter(Boolean);
            const min   = genGridSize * genGridSize;
            counter.textContent = `${words.length} woord${words.length !== 1 ? 'en' : ''} (minimaal ${min})`;
            counter.style.color = words.length >= min ? 'var(--teal)' : 'var(--text-muted)';
        };

        // Lees thema live uit het formulier als dat open staat (draft, nog niet opgeslagen)
        function getFormDraftTheme() {
            const wrap = document.getElementById('gen-theme-form-wrap');
            if (!wrap || wrap.style.display === 'none' || !wrap.children.length) return null;
            const bg        = document.getElementById('tf-bg')?.value        || null;
            const cellBg    = document.getElementById('tf-cellBg')?.value    || null;
            const cellColor = document.getElementById('tf-cellColor')?.value || null;
            const headColor = document.getElementById('tf-headColor')?.value || null;
            if (!bg) return null;
            return {
                bg, cellBg, cellColor, headColor,
                title:       document.getElementById('tf-title')?.value.trim()    || '',
                subtitle:    document.getElementById('tf-subtitle')?.value.trim() || '',
                footer:      document.getElementById('tf-footer')?.value.trim()   || '',
                cardBgImage: _cardBgImage || null,
                images:      _themeImages || [],
            };
        }

        let _previewShuffleIdx = 0;

        // Voorbeeld-kaart in stap 4 — window.renderGenPreview zodat onclick-attribuut het bereikt
        window.renderGenPreview = function(shuffle) {
            const container = document.getElementById('gen-preview-card');
            if (!container) return;
            const theme = getFormDraftTheme() || getActiveTheme();
            let words = (document.getElementById('gen-words')?.value || '')
                .split('\n').map(w => w.trim()).filter(Boolean);
            const n     = genGridSize;
            const title = document.getElementById('gen-design-title')?.value.trim()    || theme.title    || '';
            const sub   = document.getElementById('gen-design-subtitle')?.value.trim() || theme.subtitle || '';
            const ftr   = document.getElementById('gen-design-footer')?.value.trim()   || theme.footer   || '';

            const bg        = theme.bg        || 'rgba(255,255,255,.07)';
            const cellBg    = theme.cellBg    || 'rgba(255,255,255,.1)';
            const cellColor = theme.cellColor || 'var(--text-main)';
            const headColor = theme.headColor || 'var(--text-main)';

            if (shuffle) _previewShuffleIdx++;
            const needed = n * n;
            while (words.length > 0 && words.length < needed) words = words.concat(words);
            const offset = words.length >= needed ? (_previewShuffleIdx * needed) % words.length : 0;
            const previewWords = [];
            for (let i = 0; i < needed; i++) {
                previewWords.push(words.length ? words[(offset + i) % words.length] : '–');
            }

            // Cellen: alleen tekst, geen afbeeldingen in cellen
            const cells = previewWords.map(w =>
                `<div style="background:${cellBg};color:${cellColor};border-radius:4px;padding:2px;text-align:center;font-size:.55rem;font-weight:600;line-height:1.2;display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;overflow:hidden;"><span style="word-break:break-word;">${w}</span></div>`
            ).join('');

            // Afbeeldingen als overlay op de kaart (net zoals de echte gegenereerde kaart)
            const imgs = (theme.images && theme.images.length) ? theme.images : [];
            const imgOverlays = imgs.map(img =>
                `<img src="${img.src}" style="position:absolute;left:${img.x}%;top:${img.y}%;width:${img.w}%;transform:rotate(${img.deg||0}deg);transform-origin:center;pointer-events:none;z-index:5;display:block;">`
            ).join('');

            const cardBgStyle = (theme.cardBgImage || _cardBgImage)
                ? `background-image:url(${theme.cardBgImage || _cardBgImage});background-size:cover;background-position:center;`
                : '';

            // Newlines in teksten → <br>
            const titleHtml = title.replace(/\n/g,'<br>');
            const subHtml   = sub.replace(/\n/g,'<br>');
            const ftrHtml   = ftr.replace(/\n/g,'<br>');

            container.innerHTML = `
                <div style="position:relative;background:${bg};${cardBgStyle}border-radius:10px;overflow:hidden;max-width:280px;margin:0 auto;">
                    ${(titleHtml || subHtml) ? `<div style="background:${bg};color:${headColor};padding:7px 10px 4px;text-align:center;">
                        ${titleHtml ? `<div style="font-size:.75rem;font-weight:800;">${titleHtml}</div>` : ''}
                        ${subHtml   ? `<div style="font-size:.58rem;opacity:.85;">${subHtml}</div>` : ''}
                    </div>` : ''}
                    <div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:3px;padding:4px 6px;background:${bg};">${cells}</div>
                    <div style="background:${bg};color:${headColor};padding:4px 10px;display:flex;justify-content:space-between;font-size:.6rem;font-weight:700;">
                        <span>Voorbeeld</span>${ftrHtml ? `<span>${ftrHtml}</span>` : ''}
                    </div>
                    ${imgOverlays}
                </div>`;
        };

        // Override setGenMode om ook de option-cards bij te werken
        const _origSetGenMode = window.setGenMode;
        window.setGenMode = function(mode) {
            if (_origSetGenMode) _origSetGenMode(mode);
            document.getElementById('gen-opt-print')?.classList.toggle('selected', mode === 'print');
            document.getElementById('gen-opt-online')?.classList.toggle('selected', mode === 'online');
            const wrap = document.getElementById('gen-antal-wrap');
            if (wrap) wrap.style.display = mode === 'print' ? '' : 'none';
        };

        // Override setGridSize om ook option-cards bij te werken
        const _origSetGridSize = window.setGridSize;
        window.setGridSize = function(size) {
            if (_origSetGridSize) _origSetGridSize(size);
            document.getElementById('gen-opt-4x4')?.classList.toggle('selected', size === 4);
            document.getElementById('gen-opt-5x5')?.classList.toggle('selected', size === 5);
        };

        // ═══════════════════════════════ BORRELBINGO ═══════════════════════════════
        // Term-roulette met strafpunten. Werkende multiplayer via Firestore.
        // Datapad: artifacts/{appId}/public/data/borrelRooms/{4-cijferige-code}
        // Datamodel: { matchId, hostUid, status, words, players:{uid:{name,term,joinedAt,...}}, claimEvents:[{uid,term,ts}] }
        // Strafpunt-regel: ≥2 niet-eigen claims op zelfde term binnen 5 sec → eigenaar +1.

        let bbRoomCode = null;
        let bbRoomData = null;
        let bbRoomUnsub = null;
        let bbRoomMyUid = null;
        let bbPrevPenalties = null; // voor hit-flash: vorige score per uid

        function bbRoomDocRef(code) {
            return doc(db, 'artifacts', myAppId, 'public', 'data', 'borrelRooms', code);
        }
        function bbGenerateRoomCode() {
            return String(Math.floor(1000 + Math.random() * 9000));
        }
        function bbCanMultiplayer() {
            return !!(db && auth && auth.currentUser);
        }
        function bbSetPlayerName(name) {
            try { localStorage.setItem('wkPlayerName', name); } catch {}
        }
        function bbGetPlayerName() {
            // Hergebruik bestaande WK naam-helper als die er is, anders localStorage
            if (typeof getWkPlayerName === 'function') {
                const n = getWkPlayerName();
                if (n) return n;
            }
            try { return localStorage.getItem('wkPlayerName') || ''; } catch { return ''; }
        }

        // NB: retourneert HTML (SVG-vlaggen via flag-icons), niet plain text.
        // Alle call-sites schrijven dit naar innerHTML.
        function bbMatchLabel(matchId) {
            const m = (typeof WK_GROEPSWEDSTRIJDEN !== 'undefined' && WK_GROEPSWEDSTRIJDEN.find(x => x.id === matchId))
                   || (typeof WK_KNOCKOUT_WEDSTRIJDEN !== 'undefined' && WK_KNOCKOUT_WEDSTRIJDEN.find(x => x.id === matchId));
            if (!m) return matchId || '';
            const flag1 = (typeof flagSpan === 'function') ? flagSpan(m.team1) : '';
            const flag2 = (typeof flagSpan === 'function') ? flagSpan(m.team2) : '';
            return `${flag1} ${teamName(m.team1)} vs ${teamName(m.team2)} ${flag2}`.trim();
        }

        // ─── Wedstrijdselector op screen-borrel ───
        let bbCurrentTab   = 'groep';
        let bbCurrentPoule = 'A';

        function initBbSelector() {
            const tabsEl = document.getElementById('bb-poule-tabs');
            if (!tabsEl) return;
            // Reset tab-state visueel
            tabsEl.innerHTML = '';
            'ABCDEFGHIJKL'.split('').forEach(letter => {
                const btn = document.createElement('button');
                btn.className = 'wk-poule-tab' + (letter === bbCurrentPoule ? ' active' : '');
                btn.textContent = letter;
                btn.onclick = () => setBbPoule(letter);
                tabsEl.appendChild(btn);
            });
            renderBbPouleMatches(bbCurrentPoule);
            renderBbKnockoutMatches();
        }

        window.setBbTab = function(tab) {
            bbCurrentTab = tab;
            // Update alleen de tabs in screen-borrel
            document.querySelectorAll('#screen-borrel .wk-tab').forEach((b, i) => {
                b.classList.toggle('active', (i === 0 && tab === 'groep') || (i === 1 && tab === 'knockout'));
            });
            document.getElementById('bb-groep-view').style.display    = tab === 'groep'    ? 'block' : 'none';
            document.getElementById('bb-knockout-view').style.display = tab === 'knockout' ? 'block' : 'none';
        };

        window.setBbPoule = function(poule) {
            bbCurrentPoule = poule;
            document.querySelectorAll('#bb-poule-tabs .wk-poule-tab').forEach(b => {
                b.classList.toggle('active', b.textContent === poule);
            });
            renderBbPouleMatches(poule);
        };

        function renderBbPouleMatches(poule) {
            const container = document.getElementById('bb-poule-matches');
            const titleEl   = document.getElementById('bb-poule-title');
            const groep = WK_GROEPEN[poule];
            if (!container || !groep) return;

            const teamNames = groep.teams.map(t => teamName(t)).join(' · ');
            titleEl.textContent = 'Poule ' + poule + ' — ' + teamNames;

            container.innerHTML = '';
            WK_GROEPSWEDSTRIJDEN
                .filter(m => m.poule === poule)
                .forEach(match => {
                    container.appendChild(buildMatchItem(match, { onClick: (id) => bbOpenCreateModal(id) }));
                });
        }

        function renderBbKnockoutMatches() {
            const container = document.getElementById('bb-knockout-matches');
            if (!container) return;
            container.innerHTML = '';

            const rounds = [
                { label: 'Ronde van 32',  fase: 'Ronde van 32' },
                { label: 'Achtste finale', fase: 'Achtste finale' },
                { label: 'Kwartfinale',   fase: 'Kwartfinale' },
                { label: 'Halve finale',  fase: 'Halve finale' },
                { label: '3e / 4e plaats',fase: '3e/4e plaats' },
                { label: 'Finale',        fase: 'Finale' },
            ];
            rounds.forEach(round => {
                // BorrelBingo had TBD-wedstrijden bewust uitgesloten in de oude dropdown
                // (term-roulette werkt minder lekker zonder bekende teams). Consistent gehouden.
                const matches = WK_KNOCKOUT_WEDSTRIJDEN.filter(m => m.fase === round.fase && m.team1 !== 'TBD');
                if (!matches.length) return;
                const heading = document.createElement('div');
                heading.className = 'wk-round-heading';
                heading.textContent = round.label;
                container.appendChild(heading);
                matches.forEach(match => {
                    container.appendChild(buildMatchItem(match, { onClick: (id) => bbOpenCreateModal(id) }));
                });
            });
        }

        // ─── Modals openen/sluiten ───
        // Opent de create-kamer modal voor een vooraf-gekozen wedstrijd.
        // De select #bb-create-match-select is een verborgen value-holder die
        // bbConfirmCreateRoom later uitleest.
        window.bbOpenCreateModal = function(matchId) {
            if (!bbCanMultiplayer()) {
                document.getElementById('bb-mp-offline-note').classList.add('show');
                return;
            }

            const sel       = document.getElementById('bb-create-match-select');
            const matchInfo = document.getElementById('bb-create-match-info');

            sel.innerHTML = `<option value="${matchId}" selected></option>`;

            if (matchInfo) {
                const label = bbMatchLabel(matchId);
                const m = (WK_GROEPSWEDSTRIJDEN.find(x => x.id === matchId))
                       || (WK_KNOCKOUT_WEDSTRIJDEN.find(x => x.id === matchId));
                const datum = m && m.datum ? ` <span class="wk-create-match-datum">📅 ${formatMatchDate(m.datum)}</span>` : '';
                matchInfo.innerHTML = `<span class="wk-create-match-label">${t('alerts.match')}:</span> <strong>${label}</strong>${datum}`;
                matchInfo.style.display = '';
            }

            document.getElementById('bb-create-name-input').value = bbGetPlayerName();
            document.getElementById('bb-create-error').textContent = '';
            document.getElementById('bb-create-confirm-btn').disabled = false;
            document.getElementById('bb-create-modal').classList.add('show');
        };
        window.bbCloseCreateModal = function() {
            document.getElementById('bb-create-modal').classList.remove('show');
        };
        window.bbOpenJoinModal = function() {
            if (!bbCanMultiplayer()) {
                document.getElementById('bb-mp-offline-note').classList.add('show');
                return;
            }
            document.getElementById('bb-join-name-input').value = bbGetPlayerName();
            document.getElementById('bb-join-code-input').value = '';
            document.getElementById('bb-join-error').textContent = '';
            document.getElementById('bb-join-confirm-btn').disabled = false;
            document.getElementById('bb-join-modal').classList.add('show');
        };
        window.bbCloseJoinModal = function() {
            document.getElementById('bb-join-modal').classList.remove('show');
        };

        // ─── Kamer maken ───
        window.bbConfirmCreateRoom = async function() {
            const btn   = document.getElementById('bb-create-confirm-btn');
            const errEl = document.getElementById('bb-create-error');
            errEl.textContent = '';
            btn.disabled = true;
            try {
                const myName = (document.getElementById('bb-create-name-input').value || '').trim();
                if (!myName) { errEl.textContent = 'Vul je naam in.'; btn.disabled = false; return; }
                bbSetPlayerName(myName);
                const matchId = document.getElementById('bb-create-match-select').value;
                if (!matchId) { errEl.textContent = 'Kies een wedstrijd.'; btn.disabled = false; return; }
                const myUid = auth.currentUser.uid;
                const pool  = (typeof getWordPool === 'function') ? getWordPool(matchId) : [];
                if (!pool || pool.length < 4) {
                    errEl.textContent = 'Onvoldoende termen voor deze wedstrijd.'; btn.disabled = false; return;
                }
                let code = null;
                for (let i = 0; i < 8; i++) {
                    const c = bbGenerateRoomCode();
                    const snap = await getDoc(bbRoomDocRef(c));
                    if (!snap.exists()) { code = c; break; }
                }
                if (!code) { errEl.textContent = 'Kan geen vrije code vinden.'; btn.disabled = false; return; }
                const now = Date.now();
                const roomData = {
                    matchId,
                    hostUid:   myUid,
                    createdAt: now,
                    status:    'lobby',
                    startedAt: null,
                    endedAt:   null,
                    words:     pool.slice(),
                    players: {
                        [myUid]: { name: myName, term: null, joinedAt: now, lastUpdate: now }
                    },
                    claimEvents: []
                };
                await setDoc(bbRoomDocRef(code), roomData);
                bbCloseCreateModal();
                bbEnterRoom(code);
            } catch (err) {
                console.error('BB kamer maken mislukt:', err);
                errEl.textContent = 'Kamer maken mislukt.';
                btn.disabled = false;
            }
        };

        // ─── Kamer joinen ───
        window.bbConfirmJoinRoom = async function() {
            const btn   = document.getElementById('bb-join-confirm-btn');
            const errEl = document.getElementById('bb-join-error');
            errEl.textContent = '';
            const code = (document.getElementById('bb-join-code-input').value || '').trim();
            if (!/^\d{4}$/.test(code)) { errEl.textContent = 'Voer een 4-cijferige code in.'; return; }
            const myName = (document.getElementById('bb-join-name-input').value || '').trim();
            if (!myName) { errEl.textContent = 'Vul je naam in.'; return; }
            bbSetPlayerName(myName);
            btn.disabled = true;
            try {
                const ref = bbRoomDocRef(code);
                const snap = await getDoc(ref);
                if (!snap.exists()) { errEl.textContent = 'Kamer niet gevonden.'; btn.disabled = false; return; }
                const data = snap.data();
                if (data.status === 'finished') { errEl.textContent = 'Deze kamer is al afgesloten.'; btn.disabled = false; return; }
                const myUid = auth.currentUser.uid;
                const now = Date.now();
                if (!data.players?.[myUid]) {
                    await updateDoc(ref, {
                        ['players.' + myUid]: { name: myName, term: null, joinedAt: now, lastUpdate: now }
                    });
                } else {
                    await updateDoc(ref, {
                        ['players.' + myUid + '.name']: myName,
                        ['players.' + myUid + '.lastUpdate']: now
                    });
                }
                bbCloseJoinModal();
                bbEnterRoom(code);
            } catch (err) {
                console.error('BB joinen mislukt:', err);
                errEl.textContent = 'Joinen mislukt.';
                btn.disabled = false;
            }
        };

        // ─── Kamer betreden + live updates ───
        function bbEnterRoom(code) {
            bbRoomCode  = code;
            bbRoomMyUid = auth.currentUser.uid;
            document.getElementById('bb-mp-card').style.display = 'none';
            const sel = document.getElementById('bb-selector');
            if (sel) sel.style.display = 'none';
            document.getElementById('bb-lobby').style.display   = 'block';
            if (bbRoomUnsub) { try { bbRoomUnsub(); } catch {} }
            bbRoomUnsub = onSnapshot(bbRoomDocRef(code), snap => {
                if (!snap.exists()) { bbLeaveRoom('Kamer verwijderd.'); return; }
                bbRoomData = snap.data();
                bbOnRoomUpdate();
            }, err => {
                console.error('BB snapshot fout:', err);
                bbLeaveRoom('Verbinding met kamer verloren.');
            });
        }

        function bbOnRoomUpdate() {
            const data = bbRoomData;
            if (!data) return;
            const lob = document.getElementById('bb-lobby');
            const gam = document.getElementById('bb-game');
            const fin = document.getElementById('bb-finish');
            if (data.status === 'lobby') {
                bbRenderLobby(); lob.style.display='block'; gam.style.display='none'; fin.style.display='none';
            } else if (data.status === 'playing') {
                bbRenderGame();  lob.style.display='none';  gam.style.display='block'; fin.style.display='none';
            } else if (data.status === 'finished') {
                bbRenderFinish(); lob.style.display='none'; gam.style.display='none'; fin.style.display='block';
            }
        }

        function bbLeaveRoom(reason) {
            if (bbRoomUnsub) { try { bbRoomUnsub(); } catch {} }
            bbRoomUnsub = null;
            bbRoomCode  = null;
            bbRoomData  = null;
            bbRoomMyUid = null;
            bbPrevPenalties = null;
            const lob = document.getElementById('bb-lobby');
            const gam = document.getElementById('bb-game');
            const fin = document.getElementById('bb-finish');
            if (lob) lob.style.display = 'none';
            if (gam) gam.style.display = 'none';
            if (fin) fin.style.display = 'none';
            const mp = document.getElementById('bb-mp-card');
            if (mp) mp.style.display = '';
            const sel = document.getElementById('bb-selector');
            if (sel) sel.style.display = '';
            if (reason) alert(reason);
        }
        window.bbLeaveRoom = function() { bbLeaveRoom(); };

        // ─── Speler-rij HTML helper ───
        function bbPlayerRowHtml(uid, p, hostUid, myUid, opts) {
            opts = opts || {};
            const isMe   = uid === myUid;
            const isHost = uid === hostUid;
            const termHtml = p.term
                ? `<span class="bb-tag-term">"${p.term}"</span>`
                : `<span class="bb-tag-term pending">nog geen term</span>`;
            const penaltyHtml = opts.showPenalty
                ? `<span class="bb-tag-penalty">${opts.penalty || 0}</span>`
                : '';
            const cls = [
                'bb-player-row',
                isMe ? 'is-me' : '',
                opts.tappable ? 'is-tappable' : ''
            ].filter(Boolean).join(' ');
            const dataAttrs = opts.tappable
                ? `data-uid="${uid}" onclick="bbOnClaimClick(this)"`
                : '';
            return `
                <div class="${cls}" ${dataAttrs}>
                    <div class="bb-player-row-left">
                        ${isHost ? '<span class="bb-tag-host">👑</span>' : ''}
                        <span class="bb-player-row-name">${p.name}${isMe ? ' (jij)' : ''}</span>
                    </div>
                    <div class="bb-player-row-right">
                        ${termHtml}
                        ${penaltyHtml}
                    </div>
                </div>`;
        }

        // ─── Reset-term-knop (hergebruikt in lobby en spel) ───
        // Geeft de speler max 3x een nieuwe term, mits er nog een vrije is.
        const BB_MAX_RESETS = 3;
        function bbResetTermBtnHtml(me, noOtherFreeTerm) {
            const used = me?.resetsUsed || 0;
            const left = Math.max(0, BB_MAX_RESETS - used);
            const disabled = left === 0 || noOtherFreeTerm;
            const label = left === 0
                ? t('borrel.resetNoLeft')
                : noOtherFreeTerm
                    ? t('borrel.resetWithNoFree', { left })
                    : t('borrel.resetWithLeft', { left });
            return `
                <button class="wk-mp-btn secondary bb-reset-term-btn" id="bb-reset-mine-btn"
                        onclick="bbResetMyTerm()"
                        ${disabled ? 'disabled' : ''}
                        style="width:100%;margin-top:6px;">
                    ${label}
                </button>
            `;
        }

        // ─── Spelregels-blok (hergebruikt in lobby en spel) ───
        function bbRulesCardHtml() {
            return `
                <div class="bb-rules-card">
                    <div class="bb-rules-card-title">${t('borrel.rulesTitle')}</div>
                    <ul>
                        <li>${t('borrel.rule1')}</li>
                        <li>${t('borrel.rule2')}</li>
                        <li>${t('borrel.rule3')}</li>
                        <li>${t('borrel.rule4')}</li>
                    </ul>
                </div>
            `;
        }

        // ─── Lobby renderen ───
        function bbRenderLobby() {
            const data = bbRoomData;
            const myUid = bbRoomMyUid;
            const isHost = data.hostUid === myUid;
            const me = data.players?.[myUid];
            const hasTerm = !!me?.term;
            const playersArr = Object.entries(data.players || {});
            const usedTerms = new Set(playersArr.map(([,p]) => p.term).filter(Boolean));
            const freeTerms = (data.words || []).filter(w => !usedTerms.has(w));
            const allHaveTerm = playersArr.length > 0 && playersArr.every(([, p]) => !!p.term);
            const missingTermCount = playersArr.filter(([, p]) => !p.term).length;
            const enoughPlayers = playersArr.length >= 2;
            const canStart = enoughPlayers && allHaveTerm;

            let waitingMsg = '';
            if (!enoughPlayers) {
                waitingMsg = 'Wachten tot ten minste 2 spelers in de kamer zijn…';
            } else if (!allHaveTerm) {
                waitingMsg = `Wachten tot iedereen een term heeft gepakt (nog ${missingTermCount} ${missingTermCount === 1 ? 'speler' : 'spelers'})…`;
            }

            document.getElementById('bb-lobby').innerHTML = `
                <div class="wk-lobby">
                    <div class="wk-lobby-header">
                        <div class="wk-lobby-label">Kamercode</div>
                        <div class="wk-lobby-code">${bbRoomCode}</div>
                        <div class="wk-lobby-match">${bbMatchLabel(data.matchId)}</div>
                        <div class="wk-lobby-meta">${isHost ? 'Jij bent de host' : 'Wachten op host'}</div>
                    </div>

                    ${bbRulesCardHtml()}

                    <div class="bb-section-title">Spelers (${playersArr.length})</div>
                    <div class="wk-lobby-players">
                        ${playersArr.map(([uid, p]) => bbPlayerRowHtml(uid, p, data.hostUid, myUid)).join('')}
                    </div>

                    ${!hasTerm ? `
                        <button class="wk-mp-btn primary bb-claim-term-btn" id="bb-claim-mine-btn"
                                onclick="bbClaimMyTerm()"
                                ${freeTerms.length === 0 ? 'disabled' : ''}>
                            ${t('borrel.claimTerm')}${freeTerms.length === 0 ? t('borrel.claimTermNoFree') : ''}
                        </button>
                    ` : `
                        <div class="bb-section-title" style="margin-top:14px;">Jouw term</div>
                        <div class="bb-my-card">
                            <div class="bb-my-card-label">Toegewezen aan jou</div>
                            <div class="bb-my-card-value">"${me.term}"</div>
                        </div>
                        ${bbResetTermBtnHtml(me, freeTerms.length === 0)}
                    `}

                    ${isHost ? `
                        <div class="wk-lobby-buttons">
                            <button class="wk-mp-btn primary" id="bb-start-btn"
                                    onclick="bbStartGame()"
                                    ${!canStart ? 'disabled' : ''}>
                                ▶ Start spel
                            </button>
                            <button class="wk-mp-btn secondary" onclick="bbLeaveRoom()">Verlaat</button>
                        </div>
                        ${waitingMsg ? `<div class="wk-lobby-waiting">${waitingMsg}</div>` : ''}
                    ` : `
                        <div class="wk-lobby-buttons">
                            <button class="wk-mp-btn secondary" onclick="bbLeaveRoom()">Verlaat</button>
                        </div>
                        <div class="wk-lobby-waiting">${waitingMsg || 'Wachten op host om het spel te starten…'}</div>
                    `}
                </div>
            `;
        }

        // ─── "Pak m'n term" via atomic transaction ───
        window.bbClaimMyTerm = async function() {
            if (!bbRoomCode || !bbRoomData) return;
            const ref = bbRoomDocRef(bbRoomCode);
            const myUid = bbRoomMyUid;
            const btn = document.getElementById('bb-claim-mine-btn');
            if (btn) btn.disabled = true;
            try {
                await runTransaction(db, async (txn) => {
                    const snap = await txn.get(ref);
                    if (!snap.exists()) throw new Error('Kamer bestaat niet meer');
                    const data = snap.data();
                    if (data.players?.[myUid]?.term) return;
                    const used = new Set(Object.values(data.players || {}).map(p => p.term).filter(Boolean));
                    const free = (data.words || []).filter(w => !used.has(w));
                    if (free.length === 0) throw new Error('Geen vrije term meer');
                    const chosen = free[Math.floor(Math.random() * free.length)];
                    txn.update(ref, {
                        ['players.' + myUid + '.term']: chosen,
                        ['players.' + myUid + '.lastUpdate']: Date.now()
                    });
                });
            } catch (err) {
                console.error('BB pak term mislukt:', err);
                alert(err.message || 'Term toewijzen mislukt');
                if (btn) btn.disabled = false;
            }
        };

        // ─── "Andere term" via atomic transaction (max 3× per speler) ───
        window.bbResetMyTerm = async function() {
            if (!bbRoomCode || !bbRoomData) return;
            const ref = bbRoomDocRef(bbRoomCode);
            const myUid = bbRoomMyUid;
            const btn = document.getElementById('bb-reset-mine-btn');
            if (btn) btn.disabled = true;
            try {
                await runTransaction(db, async (txn) => {
                    const snap = await txn.get(ref);
                    if (!snap.exists()) throw new Error('Kamer bestaat niet meer');
                    const data = snap.data();
                    const me = data.players?.[myUid];
                    if (!me) throw new Error('Je bent niet in deze kamer');
                    const usedSoFar = me.resetsUsed || 0;
                    if (usedSoFar >= BB_MAX_RESETS) throw new Error('Geen resets meer beschikbaar');
                    // Vrije termen, exclusief huidige eigen term (anders kan dezelfde getrokken worden)
                    const used = new Set(
                        Object.entries(data.players || {})
                            .filter(([uid]) => uid !== myUid)
                            .map(([, p]) => p.term)
                            .filter(Boolean)
                    );
                    if (me.term) used.add(me.term);
                    const free = (data.words || []).filter(w => !used.has(w));
                    if (free.length === 0) throw new Error('Geen andere vrije term beschikbaar');
                    const chosen = free[Math.floor(Math.random() * free.length)];
                    txn.update(ref, {
                        ['players.' + myUid + '.term']: chosen,
                        ['players.' + myUid + '.resetsUsed']: usedSoFar + 1,
                        ['players.' + myUid + '.lastUpdate']: Date.now()
                    });
                });
            } catch (err) {
                console.error('BB reset term mislukt:', err);
                alert(err.message || 'Reset term mislukt');
                if (btn) btn.disabled = false;
            }
        };

        // ─── Start spel (alleen host) ───
        window.bbStartGame = async function() {
            if (!bbRoomCode || !bbRoomData) return;
            if (bbRoomData.hostUid !== bbRoomMyUid) return;
            const players = Object.values(bbRoomData.players || {});
            if (players.length < 2) return;
            const missing = players.filter(p => !p.term).length;
            if (missing > 0) {
                alert(t('alerts.bbWaitTerms', { count: missing, label: missing === 1 ? t('alerts.bbPlayerHas') : t('alerts.bbPlayersHave') }));
                return;
            }
            try {
                await updateDoc(bbRoomDocRef(bbRoomCode), {
                    status: 'playing',
                    startedAt: Date.now()
                });
            } catch (err) {
                console.error('BB start mislukt:', err);
                alert(t('alerts.bbStartFailed'));
            }
        };

        // ─── Strafpunten-calculator (deterministisch, op basis van events) ───
        function bbCalculatePenalties(data) {
            const WINDOW_MS = 5000;
            const penalties = {};
            // Wie heeft welke term?
            const termOwner = {};
            for (const [uid, p] of Object.entries(data.players || {})) {
                penalties[uid] = 0;
                if (p.term) termOwner[p.term] = uid;
            }
            const events = data.claimEvents || [];
            // Groepeer per term
            const byTerm = {};
            for (const ev of events) {
                if (!byTerm[ev.term]) byTerm[ev.term] = [];
                byTerm[ev.term].push(ev);
            }
            // Per term: cluster claims binnen 5s, ≥2 unieke niet-eigen claimers = +1
            for (const term in byTerm) {
                const owner = termOwner[term];
                if (!owner) continue;
                const evs = byTerm[term].slice().sort((a,b) => a.ts - b.ts);
                let i = 0;
                while (i < evs.length) {
                    const start = evs[i].ts;
                    const cluster = [evs[i]];
                    let j = i + 1;
                    while (j < evs.length && evs[j].ts - start <= WINDOW_MS) {
                        cluster.push(evs[j]); j++;
                    }
                    const validClaimers = new Set(cluster.filter(e => e.uid !== owner).map(e => e.uid));
                    if (validClaimers.size >= 2) penalties[owner]++;
                    i = j;
                }
            }
            return penalties;
        }

        // ─── Term-tegel HTML (spelmodus) ───
        function bbTileHtml(uid, p, myUid, penalty) {
            if (!p.term) return '';
            const isMine = uid === myUid;
            const cls = ['bb-tile', isMine ? 'is-mine' : ''].filter(Boolean).join(' ');
            // data-uid op alle tegels (ook eigen) zodat hit-flash ze kan selecteren;
            // onclick alleen op niet-eigen tegels.
            const clickAttr = isMine ? '' : `onclick="bbOnClaimClick(this)"`;
            const ownerLabel = isMine ? 'JIJ' : p.name;
            const ownerCls = isMine ? 'bb-tile-owner is-mine-tag' : 'bb-tile-owner';
            const penaltyHtml = penalty > 0
                ? `<span class="bb-tile-penalty">${penalty}</span>`
                : '';
            return `
                <div class="${cls}" data-uid="${uid}" ${clickAttr}>
                    <span class="${ownerCls}">${ownerLabel}</span>
                    ${penaltyHtml}
                    <div class="bb-tile-term">${p.term}</div>
                </div>`;
        }

        // ─── Spel renderen ───
        function bbRenderGame() {
            const data = bbRoomData;
            const myUid = bbRoomMyUid;
            const isHost = data.hostUid === myUid;
            const me = data.players?.[myUid];
            const penalties = bbCalculatePenalties(data);
            const playersArr = Object.entries(data.players || {});
            const tilePlayers = playersArr
                .filter(([, p]) => !!p.term)
                .sort(([, a], [, b]) => a.term.localeCompare(b.term, 'nl'));

            // Detecteer hits sinds vorige render: welke eigenaar kreeg er strafpunten bij?
            // bbPrevPenalties = null bij eerste render in deze kamer: dan niet flashen.
            const hits = [];
            if (bbPrevPenalties) {
                for (const [uid] of playersArr) {
                    const prev = bbPrevPenalties[uid] || 0;
                    const cur  = penalties[uid] || 0;
                    if (cur > prev) hits.push({ uid, delta: cur - prev });
                }
            }
            bbPrevPenalties = { ...penalties };

            document.getElementById('bb-game').innerHTML = `
                <div class="wk-lobby" style="padding:12px 14px;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <div>
                            <div class="wk-lobby-label" style="margin:0;">Kamer</div>
                            <div style="font-family:'Anton',sans-serif;font-size:1.4rem;letter-spacing:4px;color:#c8102e;">${bbRoomCode}</div>
                        </div>
                        <div style="font-family:'Bebas Neue',sans-serif;font-size:.78rem;color:#3d2914;text-align:right;letter-spacing:1px;line-height:1.2;">${bbMatchLabel(data.matchId)}</div>
                    </div>
                </div>

                ${bbRulesCardHtml()}

                <div class="bb-my-card">
                    <div class="bb-my-card-label">Jouw term</div>
                    ${me?.term
                        ? `<div class="bb-my-card-value">"${me.term}"</div>`
                        : `<div class="bb-my-card-value pending">Geen term — pak er een via "Verlaat" → opnieuw joinen</div>`}
                    <span class="bb-my-card-penalty">${penalties[myUid] || 0} strafpunten</span>
                </div>
                ${me?.term ? bbResetTermBtnHtml(me, (() => {
                    const used = new Set(playersArr.map(([,p]) => p.term).filter(Boolean));
                    return (data.words || []).filter(w => !used.has(w)).length === 0;
                })()) : ''}

                <div class="bb-section-title">Tik op de term die de commentator noemt</div>
                <div class="bb-tile-grid">
                    ${tilePlayers.map(([uid, p]) => bbTileHtml(uid, p, myUid, penalties[uid] || 0)).join('')}
                </div>

                <div class="wk-leaderboard" style="margin-top:14px;">
                    <div class="wk-leaderboard-title">
                        <span>🏆 De stand</span>
                        <span class="wk-leaderboard-code">${bbRoomCode}</span>
                    </div>
                    <div class="wk-leaderboard-list">
                        ${bbStandHtml(playersArr, penalties, myUid)}
                    </div>
                </div>

                ${isHost ? `
                    <button class="wk-mp-btn primary" style="width:100%;margin-top:14px;padding:10px;font-size:.85rem;"
                            onclick="bbHostFinish()">🏁 Beëindig spel</button>
                ` : ''}
                <button class="wk-mp-btn secondary" style="width:100%;margin-top:8px;padding:10px;font-size:.85rem;"
                        onclick="bbLeaveRoom()">Verlaat kamer</button>
            `;

            // Hit-flash op de getroffen tegels + drijvende "+N!" badge.
            // Loopt na innerHTML-render zodat de animation opnieuw triggert.
            hits.forEach(({ uid, delta }) => {
                const tile = document.querySelector(`#bb-game .bb-tile[data-uid="${uid}"]`);
                if (!tile) return;
                tile.classList.remove('bb-tile-hit');
                void tile.offsetWidth; // force reflow → animation herstart
                tile.classList.add('bb-tile-hit');
                const badge = document.createElement('div');
                badge.className = 'bb-tile-hit-badge';
                badge.textContent = `+${delta}!`;
                tile.appendChild(badge);
                setTimeout(() => {
                    badge.remove();
                    tile.classList.remove('bb-tile-hit');
                }, 1500);
            });
        }

        function bbStandHtml(playersArr, penalties, myUid) {
            const ranked = playersArr
                .map(([uid, p]) => ({ uid, name: p.name, term: p.term, score: penalties[uid] || 0 }))
                .filter(x => x.term)
                .sort((a, b) => b.score - a.score);
            if (ranked.length === 0) {
                return `<div style="font-family:'Playfair Display',serif;font-style:italic;color:#8b6914;padding:6px;">Nog geen termen toegewezen.</div>`;
            }
            const rankEmojis = ['🥇','🥈','🥉'];
            return ranked.map((r, i) => `
                <div class="wk-leaderboard-row ${r.uid === myUid ? 'is-me' : ''}">
                    <span class="wk-leaderboard-rank">${rankEmojis[i] || (i+1)}</span>
                    <span class="wk-leaderboard-name">${r.name}${r.uid === myUid ? ' (jij)' : ''}</span>
                    <span class="wk-leaderboard-score">${r.score}</span>
                </div>
            `).join('');
        }

        // ─── Speler tikt op iemand → claim event wegschrijven ───
        window.bbOnClaimClick = async function(el) {
            if (!bbRoomCode || !bbRoomData) return;
            const uid = el.getAttribute('data-uid');
            const term = bbRoomData.players?.[uid]?.term;
            if (!term) return;
            if (uid === bbRoomMyUid) return; // eigen claim telt niet
            el.classList.remove('claim-flash'); void el.offsetWidth; el.classList.add('claim-flash');
            try {
                await updateDoc(bbRoomDocRef(bbRoomCode), {
                    claimEvents: arrayUnion({ uid: bbRoomMyUid, term, ts: Date.now() })
                });
            } catch (err) {
                console.error('BB claim wegschrijven mislukt:', err);
            }
        };

        // ─── Host beëindigt spel ───
        window.bbHostFinish = async function() {
            if (!bbRoomCode || !bbRoomData) return;
            if (bbRoomData.hostUid !== bbRoomMyUid) return;
            if (!confirm('Spel beëindigen voor iedereen?')) return;
            try {
                await updateDoc(bbRoomDocRef(bbRoomCode), {
                    status: 'finished',
                    endedAt: Date.now()
                });
            } catch (err) {
                console.error('BB finish mislukt:', err);
            }
        };

        // ─── Eindscherm ───
        function bbRenderFinish() {
            const data = bbRoomData;
            const penalties = bbCalculatePenalties(data);
            const playersArr = Object.entries(data.players || {});
            document.getElementById('bb-finish').innerHTML = `
                <div class="wk-finish-card">
                    <div style="font-family:'Anton',sans-serif;font-size:1.8rem;color:#fbbf24;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">🍻 Eindstand</div>
                    <div style="font-family:'Playfair Display',serif;font-style:italic;color:#fef9e7;font-size:.9rem;">Wie kreeg de meeste strafpunten?</div>
                </div>
                <div class="wk-leaderboard" style="margin-top:0;">
                    <div class="wk-leaderboard-title">
                        <span>🏆 Eindstand</span>
                        <span class="wk-leaderboard-code">${bbRoomCode}</span>
                    </div>
                    <div class="wk-leaderboard-list">
                        ${bbStandHtml(playersArr, penalties, bbRoomMyUid)}
                    </div>
                </div>
                <button class="wk-mp-btn primary" style="width:100%;margin-top:14px;padding:10px;font-size:.85rem;"
                        onclick="bbLeaveRoom()">Sluit kamer</button>
            `;
        }

        // ─── Start ────────────────────────────────────────────────────────────────
        initFromLocal();   // direct home tonen vanuit localStorage
        initFirebase();    // Firebase op achtergrond (stille sync)
