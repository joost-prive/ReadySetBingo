// ─── Pure helpers ─────────────────────────────────────────────────────────
// Deze module bevat side-effect-loze functies die door meerdere features
// gebruikt worden: seeded RNG, hash, kleur en image compression.

// Seeded RNG (deterministisch shufflen voor reproduceerbare kaarten)
export function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export function seededShuffle(arr, seed) {
    const rng = mulberry32(seed >>> 0);
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function strHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
}

export function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[ch]);
}

export function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${opacity})`;
}

export function compressImage(src, mimeType, callback) {
    const img = new Image();
    img.onload = () => {
        const max = 600;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > max || h > max) {
            if (w > h) { h = Math.round(h * max / w); w = max; }
            else       { w = Math.round(w * max / h); h = max; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const keepAlpha = (mimeType === 'image/png' || mimeType === 'image/webp');
        if (!keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        callback(c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', keepAlpha ? undefined : 0.78), w / h);
    };
    img.src = src;
}
