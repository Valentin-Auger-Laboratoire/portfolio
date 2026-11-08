/* Vision-ECG : moteur de la démo web (portage JavaScript du code Python du dépôt).
   1) imprime un ECG de synthèse sur papier millimétré (image RGBA, sans canvas, donc identique
      dans le navigateur et dans Node) ; 2) le numérise à partir des seuls pixels ;
   3) mesure FC, RR, SDNN, amplitude R, durée du QRS. ECG fictif : aucune donnée de patient. */
(function (racine) {
  'use strict';
  const VITESSE = 25, GAIN = 10; // mm/s, mm/mV
  // [position relative au pic R (s), amplitude (mV), largeur (s)]
  const ONDES = { P: [-0.20, 0.15, 0.025], Q: [-0.03, -0.12, 0.010], R: [0.0, 1.2, 0.012], S: [0.03, -0.25, 0.012], T: [0.30, 0.35, 0.045] };

  function rng(graine) { let a = (graine >>> 0) + 0x9E3779B9; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(u) { let s = null; return () => { if (s !== null) { const r = s; s = null; return r; } let a = 0, b = 0; while (a === 0) a = u(); b = u(); const m = Math.sqrt(-2 * Math.log(a)); s = m * Math.sin(2 * Math.PI * b); return m * Math.cos(2 * Math.PI * b); }; }

  function battements(duree, fc, irregularite = 0, graine = 0, debut = 0.6) {
    const n = gauss(rng(graine)), r = []; let t = debut;
    while (t < duree - 0.4) { r.push(t); t += Math.max(0.3, 60 / fc * (1 + irregularite * n())); }
    return r;
  }
  function tension(t, pics, largeurQrs = 1) {
    let v = 0;
    for (const tr of pics) {
      if (Math.abs(t - tr) > 0.6) continue; // contributions négligeables au-delà
      for (const nom in ONDES) {
        const [pos, amp, larg] = ONDES[nom], k = 'QRS'.includes(nom) ? largeurQrs : 1;
        const z = (t - tr - pos * ('QS'.includes(nom) ? k : 1)) / (larg * k);
        v += amp * Math.exp(-0.5 * z * z);
      }
    }
    return v;
  }

  // --- Image RGBA et tracé de traits de 2 px ---
  function Image_(w, h, fond) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { d[4 * i] = fond[0]; d[4 * i + 1] = fond[1]; d[4 * i + 2] = fond[2]; d[4 * i + 3] = 255; }
    return { width: w, height: h, data: d };
  }
  function px(im, x, y, c) { if (x < 0 || y < 0 || x >= im.width || y >= im.height) return; const i = 4 * (y * im.width + x); im.data[i] = c[0]; im.data[i + 1] = c[1]; im.data[i + 2] = c[2]; }
  function trait(im, pts, c) { // polyligne de 2 px d'épaisseur
    for (let s = 1; s < pts.length; s++) {
      const [x0, y0] = pts[s - 1], [x1, y1] = pts[s], n = Math.max(1, Math.ceil(2 * Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        px(im, x - 1, y - 1, c); px(im, x, y - 1, c); px(im, x - 1, y, c); px(im, x, y, c);
      }
    }
  }

  function imprimer(o = {}) {
    const duree = o.duree ?? 10, fc = o.fc ?? 72, irr = o.irregularite ?? 0, lq = o.largeurQrs ?? 1, ppm = o.pxParMm ?? 8, graine = o.graine ?? 0;
    const hmm = o.hauteurMm ?? 40, bruit = o.bruitMv ?? 0, taches = o.bruitPixels ?? 0, marge = 10;
    const lmm = marge + duree * VITESSE, w = Math.round(lmm * ppm), h = Math.round(hmm * ppm);
    const im = Image_(w, h, [255, 246, 246]);
    const fort = [240, 170, 170], fin = [250, 215, 215];
    for (let i = 0; i <= Math.floor(lmm); i++) { const x = Math.round(i * ppm), c = i % 5 ? fin : fort; for (let y = 0; y < h; y++) { px(im, x, y, c); if (!(i % 5)) px(im, x + 1, y, c); } }
    for (let j = 0; j <= Math.floor(hmm); j++) { const y = Math.round(j * ppm), c = j % 5 ? fin : fort; for (let x = 0; x < w; x++) { px(im, x, y, c); if (!(j % 5)) px(im, x, y + 1, c); } }
    const base = h * 0.6, mv = ppm * GAIN, noir = [20, 20, 20];
    const x0 = 2 * ppm, x1 = (2 + 0.2 * VITESSE) * ppm;
    trait(im, [[0, base], [x0, base], [x0, base - mv], [x1, base - mv], [x1, base], [marge * ppm, base]], noir);
    const pics = battements(duree, fc, irr, graine), nz = gauss(rng(graine + 1)), t = [], v = [], pts = [];
    for (let x = Math.round(marge * ppm); x < w; x++) {
      const tt = (x / ppm - marge) / VITESSE, vv = tension(tt, pics, lq) + bruit * nz();
      t.push(tt); v.push(vv); pts.push([x, base - vv * mv]);
    }
    trait(im, pts, noir);
    if (taches > 0) { // grain de numérisation : quelques pixels modifiés au hasard
      const u = rng(graine + 7);
      for (let i = 0; i < taches * w * h; i++) { const x = Math.floor(u() * w), y = Math.floor(u() * h), g = 160 + Math.floor(u() * 95); px(im, x, y, [g + 5, g, g]); }
    }
    const rr = pics.slice(1).map((p, i) => p - pics[i]);
    const p1 = pics[1] ?? pics[0], iso = mediane(Array.from({ length: 13 }, (_, i) => tension(p1 - (0.07 + 0.05 * i / 12), pics, lq)));
    return { image: im, verite: { picsR: pics, fc: 60 / moyenne(rr), pxParMm: ppm, t, v, marge, base, amplitudeR: tension(p1, pics, lq) - iso } };
  }

  // --- Outils numériques (mêmes conventions que numpy) ---
  const moyenne = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const ecartType = (a, ddof = 0) => { const m = moyenne(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - ddof)); };
  function percentile(a, q) { const s = Float64Array.from(a).sort(), p = (s.length - 1) * q / 100, i = Math.floor(p); return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * (p - i) : s[i]; }
  const mediane = (a) => percentile(a, 50);
  function gradient(v) { const n = v.length, d = new Float64Array(n); if (n < 2) return d; d[0] = v[1] - v[0]; d[n - 1] = v[n - 1] - v[n - 2]; for (let i = 1; i < n - 1; i++) d[i] = (v[i + 1] - v[i - 1]) / 2; return d; }
  function interp(x, xp, fp) { const r = new Float64Array(x.length); let j = 0; for (let i = 0; i < x.length; i++) { const xi = x[i]; if (xi <= xp[0]) { r[i] = fp[0]; continue; } if (xi >= xp[xp.length - 1]) { r[i] = fp[fp.length - 1]; continue; } while (xp[j + 1] < xi) j++; r[i] = fp[j] + (fp[j + 1] - fp[j]) * (xi - xp[j]) / (xp[j + 1] - xp[j]); } return r; }

  // --- Extraction ---
  function masques(im) {
    const { width: w, height: h, data: d } = im, trace = new Uint8Array(w * h), grille = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = d[4 * i], g = d[4 * i + 1], b = d[4 * i + 2];
      if (r < 110 && g < 110 && b < 110) trace[i] = 1;
      else if (r > 200 && g < 235 && r - g > 15) grille[i] = 1;
    }
    return { trace, grille, w, h };
  }
  function pasGrille(m) {
    const { grille, w, h } = m, prof = new Float64Array(w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) prof[x] += grille[y * w + x];
    const mu = moyenne(prof); for (let x = 0; x < w; x++) prof[x] -= mu;
    const kmax = Math.min(w - 1, 1100), ac = new Float64Array(kmax + 1);
    for (let k = 0; k <= kmax; k++) { let s = 0; for (let x = 0; x + k < w; x++) s += prof[x] * prof[x + k]; ac[k] = s; }
    const a0 = ac[0] || 1; for (let k = 0; k <= kmax; k++) ac[k] /= a0;
    let k = -1;
    for (let i = 3; i < Math.min(200, Math.floor(w / 4)); i++) if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1] && ac[i] > 0.1) { k = i; break; }
    if (k < 0) throw new Error('grille introuvable');
    let k5 = Math.round(5 * k), best = k5;
    for (let i = Math.max(k5 - 3, 1); i <= Math.min(k5 + 3, kmax - 1); i++) if (ac[i] > ac[best]) best = i;
    k5 = best;
    const a = ac[k5 - 1], b = ac[k5], c = ac[k5 + 1], den = a - 2 * b + c;
    return { pxParMm: (k5 + (den ? 0.5 * (a - c) / den : 0)) / 5, ac, k1: k, k5 };
  }
  function courbe(m, ecartMin = 3) {
    const { trace, w, h } = m, moy = new Float64Array(w).fill(NaN), haut = new Float64Array(w), bas = new Float64Array(w), nb = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      let n = 0, s = 0, hi = h, lo = -1;
      for (let y = 0; y < h; y++) if (trace[y * w + x]) { n++; s += y; if (y < hi) hi = y; lo = y; }
      nb[x] = n; haut[x] = hi; bas[x] = lo; if (n) moy[x] = s / n;
    }
    const base = mediane(Array.from(moy).filter((x) => !Number.isNaN(x))), y = Float64Array.from(moy);
    for (let x = 0; x < w; x++) {
      if (!nb[x]) continue;
      if (moy[x] < base - ecartMin) y[x] = haut[x] + 0.5; else if (moy[x] > base + ecartMin) y[x] = bas[x] - 0.5;
    }
    return y;
  }
  function etalonnage(y, ppm) {
    const z = Array.from(y.slice(0, Math.floor(10 * ppm))).filter((x) => !Number.isNaN(x));
    return { base: percentile(z, 90), haut: percentile(z, 10), px: percentile(z, 90) - percentile(z, 10) };
  }
  function numeriser(im) {
    const m = masques(im), g = pasGrille(m), ppm = g.pxParMm, y0 = courbe(m), et = etalonnage(y0, ppm);
    const debut = Math.round(10 * ppm), y = y0.slice(debut), ok = [], vals = [];
    y.forEach((v, i) => { if (!Number.isNaN(v)) { ok.push(i); vals.push(v); } });
    if (ok.length < 10) throw new Error('tracé introuvable');
    const yy = interp(Array.from(y, (_, i) => i), ok, vals), base = mediane(yy), pmv = ppm * GAIN;
    const v = Array.from(yy, (q) => (base - q) / pmv), t = v.map((_, i) => i / ppm / VITESSE);
    return { t, v, info: { pxParMm: ppm, gainMesure: et.px / ppm, etalonnage: et, debut, baseImage: base, grille: g }, masques: m, yImage: y0 };
  }
  function reechantillonner(t, v, fe = 250) {
    const tt = []; for (let i = 0; i * (1 / fe) < t[t.length - 1]; i++) tt.push(i / fe);
    return { t: tt, v: Array.from(interp(tt, t, v)) };
  }
  function energie(v, fe = 250) {
    const d = gradient(v), k = Math.round(0.1 * fe), e2 = d.map((x) => (x * fe) ** 2), n = v.length, e = new Float64Array(n), dec = Math.floor((k - 1) / 2);
    const cum = new Float64Array(n + 1); for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + e2[i];
    for (let i = 0; i < n; i++) { const a = Math.max(0, i + dec - k + 1), b = Math.min(n - 1, i + dec); e[i] = (cum[b + 1] - cum[a]) / k; } // convolve(..., 'same')
    return e;
  }
  function detecterR(v, fe = 250) {
    const e = energie(v, fe), seuil = 0.3 * percentile(e, 99), pics = [], refr = Math.round(0.25 * fe);
    let i = 0;
    while (i < e.length) {
      if (e[i] > seuil) {
        const fin = Math.min(v.length, i + Math.round(0.15 * fe)), debut = Math.max(0, i - Math.round(0.05 * fe));
        let j = debut; for (let q = debut; q < fin; q++) if (v[q] > v[j]) j = q;
        if (!pics.length || j - pics[pics.length - 1] > refr) pics.push(j);
        i = j + refr;
      } else i++;
    }
    return { pics, energie: e, seuil };
  }
  function dureeQrs(v, pics, fe = 250) {
    const d = gradient(v).map((x) => Math.abs(x * fe)), dur = [];
    for (const p of pics) {
      const a = Math.max(0, p - Math.round(0.12 * fe)), b = Math.min(v.length, p + Math.round(0.12 * fe)), seg = Array.from(d.slice(a, b));
      if (seg.length < 5) continue;
      const mx = Math.max(...seg), idx = seg.map((x, i) => (x > 0.15 * mx ? i : -1)).filter((i) => i >= 0);
      dur.push((idx[idx.length - 1] - idx[0]) / fe);
    }
    return dur.length ? mediane(dur) : NaN;
  }
  function amplitudeR(v, pics, fe = 250) {
    const h = [];
    for (const p of pics) { const a = p - Math.round(0.12 * fe), b = p - Math.round(0.07 * fe); if (a >= 0) h.push(v[p] - mediane(v.slice(a, b))); }
    return h.length ? mediane(h) : NaN;
  }
  function analyser(im) {
    const num = numeriser(im), rs = reechantillonner(num.t, num.v), det = detecterR(rs.v), fe = 250;
    const inst = det.pics.map((p) => rs.t[p]), rr = inst.slice(1).map((x, i) => x - inst[i]);
    const fc = rr.length ? 60 / moyenne(rr) : NaN, qrs = dureeQrs(rs.v, det.pics) * 1000;
    const cv = rr.length > 2 ? ecartType(rr) / moyenne(rr) : 0;
    return {
      ...num.info, nbBattements: det.pics.length, instantsR: inst, rr, fc, rrMoyenMs: rr.length ? moyenne(rr) * 1000 : NaN,
      sdnnMs: rr.length > 2 ? ecartType(rr, 1) * 1000 : NaN, amplitudeRMv: amplitudeR(rs.v, det.pics), qrsMs: qrs,
      rythme: cv > 0.08 ? 'irregulier' : 'regulier', cv, frequence: fc < 60 ? 'bradycardie' : fc > 100 ? 'tachycardie' : 'normale', qrs: qrs >= 120 ? 'elargi' : 'fin',
      signal: rs, brut: { t: num.t, v: num.v }, detection: det, fe, numerisation: num,
    };
  }

  const api = { VITESSE, GAIN, ONDES, rng, battements, tension, imprimer, masques, pasGrille, courbe, etalonnage, numeriser, reechantillonner, energie, detecterR, dureeQrs, amplitudeR, analyser, percentile, mediane, ecartType, interp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.VisionECG = api;
})(typeof window !== 'undefined' ? window : globalThis);
