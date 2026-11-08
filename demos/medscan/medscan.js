/* MedScan : portage JavaScript du moteur Python (medscan/analyse.py et fantome.py).
   Images stockées en Float64Array ligne par ligne (index = y * taille + x). */
(function (racine) {
  'use strict';
  const TAILLE = 128;

  function rng(graine) {
    let a = graine >>> 0;
    const u = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let r = null;
    u.normal = () => { if (r !== null) { const v = r; r = null; return v; } let x, y, s; do { x = 2 * u() - 1; y = 2 * u() - 1; s = x * x + y * y; } while (!s || s >= 1); const m = Math.sqrt(-2 * Math.log(s) / s); r = y * m; return x * m; };
    return u;
  }

  const dansEllipse = (y, x, cy, cx, ry, rx) => ((y - cy) / ry) ** 2 + ((x - cx) / rx) ** 2 <= 1;

  // Coupe de synthèse : lésions = [{cy, cx, r, contraste}]
  function coupe(lesions = [], o = {}) {
    const p = Object.assign({ bruit: 6, graine: 0, taille: TAILLE, decalage: 0 }, o), n = p.taille, c = n / 2, u = rng(p.graine);
    const im = new Float64Array(n * n), vrai = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = 10;
      if (dansEllipse(y, x, c, c, 0.42 * n, 0.36 * n)) v = 200;
      if (dansEllipse(y, x, c, c, 0.39 * n, 0.33 * n)) v = 110;
      for (const sx of [-1, 1]) if (dansEllipse(y, x, c - 4, c + sx * (6 + p.decalage), 9, 4)) v = 40;
      for (const l of lesions) if (dansEllipse(y, x, l.cy, l.cx, l.r, l.r)) { v += l.contraste; vrai[y * n + x] = 1; }
      im[y * n + x] = Math.min(255, Math.max(0, v + p.bruit * u.normal()));
    }
    return { image: im, vrai, taille: n };
  }

  function sujetsSains(nb = 20, graine = 100, o = {}) {
    const u = rng(graine), out = [];
    for (let i = 0; i < nb; i++) out.push(coupe([], Object.assign({}, o, { graine: graine + i + 1, decalage: u() - 0.5 })).image);
    return out;
  }

  function otsu(x, bins = 256) {
    let mn = Infinity, mx = -Infinity; for (const v of x) { if (v < mn) mn = v; if (v > mx) mx = v; }
    const h = new Float64Array(bins), lg = (mx - mn) / bins || 1;
    for (const v of x) h[Math.min(bins - 1, Math.floor((v - mn) / lg))]++;
    const tot = x.length; let w0 = 0, m = 0, mt = 0;
    for (let k = 0; k < bins; k++) mt += h[k] / tot * (mn + (k + 0.5) * lg);
    let best = -1, kb = 0;
    for (let k = 0; k < bins; k++) {
      const p = h[k] / tot; w0 += p; m += p * (mn + (k + 0.5) * lg);
      const den = w0 * (1 - w0); if (den <= 0) continue;
      const v = (mt * w0 - m) ** 2 / den; if (v > best) { best = v; kb = k; }
    }
    return mn + (kb + 1) * lg;
  }

  function moyenneLocale(im, n, r) { // images intégrales, bords répliqués
    const N = n + 2 * r, S = new Float64Array((N + 1) * (N + 1));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = im[Math.min(n - 1, Math.max(0, y - r)) * n + Math.min(n - 1, Math.max(0, x - r))];
      S[(y + 1) * (N + 1) + x + 1] = v + S[y * (N + 1) + x + 1] + S[(y + 1) * (N + 1) + x] - S[y * (N + 1) + x];
    }
    const k = 2 * r + 1, out = new Float64Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      out[y * n + x] = (S[(y + k) * (N + 1) + x + k] - S[y * (N + 1) + x + k] - S[(y + k) * (N + 1) + x] + S[y * (N + 1) + x]) / (k * k);
    return out;
  }

  function morpho(m, n, et) { // érosion (et = true) ou dilatation 3×3, bords à 0
    const out = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = et ? 1 : 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx, w = yy >= 0 && yy < n && xx >= 0 && xx < n ? m[yy * n + xx] : 0;
        if (et && !w) v = 0; if (!et && w) v = 1;
      }
      out[y * n + x] = v;
    }
    return out;
  }
  const eroder = (m, n) => morpho(m, n, true), dilater = (m, n) => morpho(m, n, false);
  const ouverture = (m, n) => dilater(eroder(m, n), n);

  function composantes(m, n) { // 8-connexité, union-find
    const lab = new Int32Array(n * n), parent = [0];
    const trouver = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!m[y * n + x]) continue;
      const v = [];
      for (const [dy, dx] of [[-1, -1], [-1, 0], [-1, 1], [0, -1]]) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && xx < n && lab[yy * n + xx]) v.push(lab[yy * n + xx]); }
      if (!v.length) { parent.push(parent.length); lab[y * n + x] = parent.length - 1; }
      else { const r = Math.min(...v.map(trouver)); lab[y * n + x] = r; v.forEach((q) => { parent[trouver(q)] = r; }); }
    }
    const racines = new Map();
    for (let i = 0; i < n * n; i++) if (lab[i]) { const r = trouver(lab[i]); if (!racines.has(r)) racines.set(r, racines.size + 1); lab[i] = racines.get(r); }
    return { lab, nb: racines.size };
  }

  function modeleSain(images, n, r = 2) {
    const lis = images.map((im) => moyenneLocale(im, n, r)), N = n * n, moy = new Float64Array(N), et = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (const l of lis) s += l[i]; moy[i] = s / lis.length; let q = 0; for (const l of lis) q += (l[i] - moy[i]) ** 2; et[i] = Math.sqrt(q / (lis.length - 1)) + 1e-6; }
    return { moy, et, r, n, corps: otsu(moy) };
  }

  function detecter(im, mod, o = {}) {
    const seuil = o.seuil || 5, surfaceMin = o.surfaceMin || 12, mm = o.mm || 1, n = mod.n, N = n * n;
    const l = moyenneLocale(im, n, mod.r), z = new Float64Array(N), brut = new Uint8Array(N);
    for (let i = 0; i < N; i++) { z[i] = (l[i] - mod.moy[i]) / mod.et[i]; brut[i] = Math.abs(z[i]) > seuil && mod.moy[i] > mod.corps ? 1 : 0; }
    const masque = ouverture(brut, n), { lab, nb } = composantes(masque, n), final = new Uint8Array(N), regions = [];
    for (let k = 1; k <= nb; k++) {
      let aire = 0, sy = 0, sx = 0, c = 0, zmax = 0;
      for (let i = 0; i < N; i++) if (lab[i] === k) { aire++; sy += Math.floor(i / n); sx += i % n; c += im[i] - mod.moy[i]; zmax = Math.max(zmax, Math.abs(z[i])); }
      if (aire < surfaceMin) continue;
      for (let i = 0; i < N; i++) if (lab[i] === k) final[i] = 1;
      regions.push({ aire, aireMm2: aire * mm * mm, centre: [sy / aire, sx / aire], contraste: c / aire, type: c > 0 ? 'hyper' : 'hypo', zmax });
    }
    regions.sort((a, b) => b.aire - a.aire);
    return { masque: final, z, regions };
  }

  function dice(a, b) { let s = 0, i2 = 0; for (let i = 0; i < a.length; i++) { s += a[i] + b[i]; if (a[i] && b[i]) i2++; } return s ? 2 * i2 / s : 1; }

  const api = { TAILLE, rng, coupe, sujetsSains, otsu, moyenneLocale, eroder, dilater, ouverture, composantes, modeleSain, detecter, dice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.MedScan = api;
})(typeof window !== 'undefined' ? window : globalThis);
