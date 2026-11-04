/* Détection des battements cardiaques sur un ECG : moteur (sans dépendance).
   Filtres de Butterworth (transformation bilinéaire, filtrage aller-retour sans déphasage),
   algorithme de Pan et Tompkins (1985) avec seuils adaptatifs, recherche arrière et rejet des ondes T,
   évaluation contre des annotations (tolérance de 150 ms, comme la norme ANSI/AAMI EC57),
   variabilité de la fréquence cardiaque, classification simple des battements et générateur d'ECG synthétique.
   Outil pédagogique : ce n'est pas un dispositif médical.
   Utilisable dans le navigateur (window.ECG) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.ECG = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Filtres ----------
  // biquad de Butterworth (2e ordre) : coefficients normalisés [b0, b1, b2, a1, a2]
  function butter2(type, fc, fs) {
    const K = Math.tan((Math.PI * fc) / fs), K2 = K * K, q = Math.SQRT2, norm = 1 / (1 + q * K + K2);
    if (type === 'low') return [K2 * norm, 2 * K2 * norm, K2 * norm, 2 * (K2 - 1) * norm, (1 - q * K + K2) * norm];
    return [norm, -2 * norm, norm, 2 * (K2 - 1) * norm, (1 - q * K + K2) * norm];
  }
  function biquad(x, c) {
    const [b0, b1, b2, a1, a2] = c, y = new Float64Array(x.length);
    let x1 = x[0], x2 = x[0], y1 = 0, y2 = 0;
    // démarrage sans transitoire : on suppose le signal constant avant le début
    const dc = (b0 + b1 + b2) / (1 + a1 + a2);
    y1 = y2 = dc * x[0];
    for (let n = 0; n < x.length; n++) {
      const v = b0 * x[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[n]; y2 = y1; y1 = v; y[n] = v;
    }
    return y;
  }
  // filtrage aller-retour : pas de retard, réponse en module au carré
  function filtfilt(x, c) { const f = biquad(x, c); f.reverse(); const g = biquad(f, c); g.reverse(); return g; }
  const bandpass = (x, fs, lo, hi) => filtfilt(filtfilt(x, butter2('high', lo, fs)), butter2('low', hi, fs));
  const highpass = (x, fs, fc) => filtfilt(x, butter2('high', fc, fs));
  // module de la réponse en fréquence d'un biquad (pour vérification)
  function biquadGain(c, f, fs) {
    const w = (2 * Math.PI * f) / fs, [b0, b1, b2, a1, a2] = c;
    const re = (a, b, cc) => a + b * Math.cos(w) + cc * Math.cos(2 * w), im = (a, b, cc) => -(b * Math.sin(w) + cc * Math.sin(2 * w));
    return Math.hypot(re(b0, b1, b2), im(b0, b1, b2)) / Math.hypot(re(1, a1, a2), im(1, a1, a2));
  }

  // ---------- Pan-Tompkins ----------
  // x : signal en mV ; renvoie les étapes intermédiaires et les positions des pics R (en échantillons)
  function panTompkins(x, fs, opts = {}) {
    const n = x.length;
    const bp = bandpass(x, fs, opts.lo || 5, opts.hi || 15);
    // dérivée sur 5 points (centrée)
    const der = new Float64Array(n);
    for (let i = 2; i < n - 2; i++) der[i] = (-bp[i - 2] - 2 * bp[i - 1] + 2 * bp[i + 1] + bp[i + 2]) * (fs / 8);
    const sq = der.map((v) => v * v);
    // intégration sur une fenêtre glissante de 150 ms (centrée)
    const W = Math.round(0.15 * fs), half = W >> 1, mwi = new Float64Array(n);
    let acc = 0;
    for (let i = 0; i < n + half; i++) {
      if (i < n) acc += sq[i];
      if (i - W >= 0) acc -= sq[i - W];
      const c = i - half;
      if (c >= 0 && c < n) mwi[c] = acc / W;
    }
    // pics candidats : maxima locaux du signal intégré, espacés d'au moins 200 ms
    const refr = Math.round(0.2 * fs), cand = [];
    for (let i = 1; i < n - 1; i++) {
      if (mwi[i] > mwi[i - 1] && mwi[i] >= mwi[i + 1]) {
        if (cand.length && i - cand[cand.length - 1] < refr) { if (mwi[i] > mwi[cand[cand.length - 1]]) cand[cand.length - 1] = i; }
        else cand.push(i);
      }
    }
    // seuils initiaux sur les 2 premières secondes
    const init = Math.min(n, 2 * fs);
    let mx = 0, mean = 0;
    for (let i = 0; i < init; i++) { mx = Math.max(mx, mwi[i]); mean += mwi[i]; }
    mean /= init;
    let SPKI = 0.25 * mx, NPKI = 0.5 * mean, THR1 = NPKI + 0.25 * (SPKI - NPKI), THR2 = 0.5 * THR1;
    const qrs = [], noise = [], rr = [], rrOk = [], thrHist = [];
    let rrAvg1 = fs, rrAvg2 = fs, lastSlope = null;
    const slopeAt = (i) => { let m = 0; for (let k = Math.max(2, i - Math.round(0.075 * fs)); k <= Math.min(n - 3, i + Math.round(0.075 * fs)); k++) m = Math.max(m, Math.abs(der[k])); return m; };
    const accept = (i, back) => {
      if (qrs.length) {
        const d = i - qrs[qrs.length - 1];
        rr.push(d); if (rr.length > 8) rr.shift();
        rrAvg1 = rr.reduce((a, b) => a + b, 0) / rr.length;
        if (d > 0.92 * rrAvg2 && d < 1.16 * rrAvg2) { rrOk.push(d); if (rrOk.length > 8) rrOk.shift(); }
        if (rrOk.length) rrAvg2 = rrOk.reduce((a, b) => a + b, 0) / rrOk.length; else rrAvg2 = rrAvg1;
      }
      qrs.push(i); lastSlope = slopeAt(i);
      SPKI = back ? 0.25 * mwi[i] + 0.75 * SPKI : 0.125 * mwi[i] + 0.875 * SPKI;
    };
    let pendingNoise = []; // pics de bruit depuis le dernier QRS (pour la recherche arrière)
    for (const i of cand) {
      // recherche arrière : trop longtemps sans QRS
      if (qrs.length >= 2 && i - qrs[qrs.length - 1] > 1.66 * rrAvg2) {
        const best = pendingNoise.filter((k) => mwi[k] > THR2 && k - qrs[qrs.length - 1] > refr).sort((a, b) => mwi[b] - mwi[a])[0];
        if (best !== undefined) { accept(best, true); pendingNoise = pendingNoise.filter((k) => k > best); }
      }
      const pk = mwi[i];
      if (pk > THR1 && (!qrs.length || i - qrs[qrs.length - 1] > refr)) {
        // onde T ? (moins de 360 ms après le QRS précédent et pente deux fois plus faible)
        if (qrs.length && i - qrs[qrs.length - 1] < 0.36 * fs && slopeAt(i) < 0.5 * lastSlope) { NPKI = 0.125 * pk + 0.875 * NPKI; noise.push(i); pendingNoise.push(i); }
        else { accept(i, false); pendingNoise = []; }
      } else { NPKI = 0.125 * pk + 0.875 * NPKI; noise.push(i); pendingNoise.push(i); }
      THR1 = NPKI + 0.25 * (SPKI - NPKI); THR2 = 0.5 * THR1;
      // rythme irrégulier : seuils abaissés de moitié
      if (rr.length >= 8 && (rrAvg1 < 0.92 * rrAvg2 || rrAvg1 > 1.16 * rrAvg2)) { THR1 *= 0.5; THR2 = 0.5 * THR1; }
      thrHist.push([i, THR1, THR2]);
    }
    // position du pic R : maximum de |signal sans ligne de base| autour du pic intégré
    const base = highpass(x, fs, 0.5);
    const polarity = Math.sign(qrs.slice(0, 50).reduce((s, i) => { let best = 0; for (let k = Math.max(0, i - 25); k < Math.min(n, i + 25); k++) if (Math.abs(base[k]) > Math.abs(best)) best = base[k]; return s + best; }, 0)) || 1;
    const R = qrs.map((i) => {
      let best = i, bv = -Infinity;
      const w = Math.round(0.08 * fs);
      for (let k = Math.max(0, i - w); k < Math.min(n, i + w); k++) { const v = polarity * base[k]; if (v > bv) { bv = v; best = k; } }
      return best;
    });
    return { bp, der, sq, mwi, base, qrsMwi: qrs, noise, R, thrHist, thresholds: { SPKI, NPKI, THR1, THR2 } };
  }

  // ---------- Évaluation contre des annotations ----------
  // tolérance 150 ms ; chaque annotation est associée à au plus une détection
  function evaluate(det, ref, fs, tolS = 0.15, from = 0, to = Infinity) {
    const tol = Math.round(tolS * fs);
    const d = det.filter((v) => v >= from && v < to), r = ref.filter((v) => v >= from && v < to);
    let i = 0, j = 0, tp = 0;
    const fn = [], fp = [], pairs = [];
    while (i < r.length && j < d.length) {
      if (Math.abs(r[i] - d[j]) <= tol) {
        // la détection suivante est-elle plus proche de cette annotation ?
        if (j + 1 < d.length && Math.abs(r[i] - d[j + 1]) < Math.abs(r[i] - d[j])) { fp.push(d[j]); j++; continue; }
        pairs.push([r[i], d[j]]); tp++; i++; j++;
      } else if (d[j] < r[i]) { fp.push(d[j]); j++; }
      else { fn.push(r[i]); i++; }
    }
    while (i < r.length) fn.push(r[i++]);
    while (j < d.length) fp.push(d[j++]);
    const err = pairs.map(([a, b]) => ((b - a) / fs) * 1000);
    const meanErr = err.length ? err.reduce((s, v) => s + Math.abs(v), 0) / err.length : NaN;
    return { tp, fn: fn.length, fp: fp.length, se: tp / (tp + fn.length), ppv: tp / (tp + fp.length), fnList: fn, fpList: fp, meanAbsErrMs: meanErr, pairs };
  }

  // ---------- Variabilité de la fréquence cardiaque ----------
  function hrv(R, fs, labels) {
    const rr = [];
    for (let k = 1; k < R.length; k++) {
      // intervalles NN : entre deux battements normaux seulement (si les étiquettes sont connues)
      if (labels && (labels[k] !== 'N' || labels[k - 1] !== 'N')) continue;
      rr.push(((R[k] - R[k - 1]) / fs) * 1000);
    }
    if (rr.length < 3) return null;
    const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
    const sdnn = Math.sqrt(rr.reduce((a, b) => a + (b - mean) ** 2, 0) / (rr.length - 1));
    let s = 0, c50 = 0;
    for (let k = 1; k < rr.length; k++) { const d = rr[k] - rr[k - 1]; s += d * d; if (Math.abs(d) > 50) c50++; }
    const rmssd = Math.sqrt(s / (rr.length - 1));
    return { n: rr.length, meanRR: mean, hr: 60000 / mean, sdnn, rmssd, pnn50: (100 * c50) / (rr.length - 1), rr };
  }

  // ---------- Classification simple des battements ----------
  // N normal, S précoce à QRS fin (supraventriculaire probable), V morphologie anormale (ventriculaire probable)
  function classify(x, fs, R) {
    const base = highpass(x, fs, 0.5), w0 = Math.round(0.25 * fs), w1 = Math.round(0.4 * fs);
    const win = (r) => { const out = new Float64Array(w0 + w1); for (let k = -w0; k < w1; k++) out[k + w0] = base[Math.max(0, Math.min(base.length - 1, r + k))]; return out; };
    // gabarit : médiane, point par point, des 30 premiers battements
    const first = R.slice(1, 31).map(win), L = w0 + w1, tpl = new Float64Array(L);
    for (let k = 0; k < L; k++) { const col = first.map((b) => b[k]).sort((a, b) => a - b); tpl[k] = col[col.length >> 1] || 0; }
    // corrélation sur la zone du QRS (±100 ms)
    const qa = w0 - Math.round(0.1 * fs), qb = w0 + Math.round(0.1 * fs);
    const corr = (b) => { let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = qb - qa; for (let k = qa; k < qb; k++) { sx += b[k]; sy += tpl[k]; sxx += b[k] * b[k]; syy += tpl[k] * tpl[k]; sxy += b[k] * tpl[k]; } const num = sxy - (sx * sy) / m, den = Math.sqrt((sxx - (sx * sx) / m) * (syy - (sy * sy) / m)); return den > 0 ? num / den : 0; };
    const out = [];
    const rrs = R.map((r, k) => (k ? r - R[k - 1] : NaN));
    for (let k = 0; k < R.length; k++) {
      const c = corr(win(R[k]));
      // RR moyen des 8 intervalles précédents
      const prev = rrs.slice(Math.max(1, k - 8), k).filter(Number.isFinite);
      const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : rrs[k];
      const pre = rrs[k], post = k + 1 < R.length ? rrs[k + 1] : NaN;
      const premature = Number.isFinite(pre) && prev.length >= 3 && pre < 0.85 * avg;
      const pause = Number.isFinite(post) && post > 1.1 * avg;
      let label = 'N';
      if (k > 0 && c < 0.75) label = 'V';
      else if (premature && (pause || pre < 0.75 * avg)) label = 'S';
      out.push({ label, corr: c, rrPre: pre / fs, premature });
    }
    return { beats: out, template: tpl, w0 };
  }

  // ---------- Événements du rythme (indications, pas un diagnostic) ----------
  function rhythmEvents(R, fs, labels) {
    const ev = [];
    for (let k = 1; k < R.length; k++) {
      const rr = (R[k] - R[k - 1]) / fs;
      if (rr > 2) ev.push({ type: 'pause', at: R[k - 1], value: rr });
    }
    // fenêtres de 10 battements : fréquence moyenne et irrégularité
    for (let k = 10; k < R.length; k += 5) {
      const seg = []; for (let j = k - 9; j <= k; j++) seg.push((R[j] - R[j - 1]) / fs);
      const m = seg.reduce((a, b) => a + b, 0) / seg.length, hr = 60 / m;
      const cv = Math.sqrt(seg.reduce((a, b) => a + (b - m) ** 2, 0) / seg.length) / m;
      if (hr > 100) ev.push({ type: 'tachy', at: R[k - 9], value: hr });
      if (hr < 50) ev.push({ type: 'brady', at: R[k - 9], value: hr });
      if (cv > 0.15) ev.push({ type: 'irregular', at: R[k - 9], value: cv });
    }
    if (labels) labels.forEach((l, k) => { if (l === 'V') ev.push({ type: 'pvc', at: R[k] }); if (l === 'S') ev.push({ type: 'pac', at: R[k] }); });
    // regrouper les événements de même type qui se suivent
    ev.sort((a, b) => a.at - b.at);
    const merged = [];
    for (const e of ev) {
      const last = merged.slice().reverse().find((m) => m.type === e.type);
      if (last && (e.type === 'tachy' || e.type === 'brady' || e.type === 'irregular') && e.at - last.end < 5 * fs) { last.end = e.at; last.count++; last.value = e.type === 'brady' ? Math.min(last.value, e.value) : Math.max(last.value, e.value); }
      else merged.push(Object.assign({ end: e.at, count: 1 }, e));
    }
    return merged.sort((a, b) => a.at - b.at);
  }

  // ---------- ECG synthétique ----------
  // somme d'ondes gaussiennes P, Q, R, S, T par battement ; extrasystoles ventriculaires, bruits réglables
  function synth(opts = {}) {
    const fs = opts.fs || 360, dur = opts.dur || 60, hr = opts.hr || 70, n = Math.round(dur * fs);
    let seed = opts.seed || 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const x = new Float64Array(n), truth = [];
    const rr0 = 60 / hr;
    let t = 0.6, prevRR = rr0;
    const add = (tc, a, w) => { const i0 = Math.max(0, Math.floor((tc - 5 * w) * fs)), i1 = Math.min(n - 1, Math.ceil((tc + 5 * w) * fs)); for (let i = i0; i <= i1; i++) { const u = (i / fs - tc) / w; x[i] += a * Math.exp(-0.5 * u * u); } };
    while (t < dur - 0.6) {
      const pvc = opts.pvcRate && rnd() < opts.pvcRate && truth.length > 3 && truth[truth.length - 1][1] === 'N';
      if (pvc) {
        // extrasystole ventriculaire : précoce, QRS large, pas d'onde P, T inversée, puis repos compensateur
        const tv = t - 0.4 * prevRR;
        add(tv, 1.3 * (opts.amp || 1), 0.035); add(tv + 0.06, -0.5 * (opts.amp || 1), 0.03); add(tv + 0.3, -0.35, 0.06);
        truth.push([Math.round(tv * fs), 'V']);
        // repos compensateur : le battement suivant tombe deux intervalles après le dernier battement normal
        t = truth[truth.length - 2][0] / fs + 2 * prevRR;
        continue;
      }
      const A = opts.amp || 1, qt = 0.25 * Math.sqrt(prevRR);
      add(t - 0.16, 0.12 * A, 0.025); add(t - 0.03, -0.12 * A, 0.01); add(t, A, 0.011); add(t + 0.03, -0.25 * A, 0.011); add(t + qt, 0.3 * A, 0.05);
      truth.push([Math.round(t * fs), 'N']);
      // variabilité : arythmie respiratoire (0,25 Hz) + bruit
      const rr = rr0 * (1 + (opts.hrv || 0.04) * Math.sin(2 * Math.PI * 0.25 * t) + 0.01 * gauss());
      prevRR = rr; t += rr;
    }
    for (let i = 0; i < n; i++) {
      const ti = i / fs;
      x[i] += (opts.wander || 0) * Math.sin(2 * Math.PI * 0.3 * ti) + (opts.hum || 0) * Math.sin(2 * Math.PI * 50 * ti) + (opts.noise || 0) * gauss();
    }
    return { x, fs, truth };
  }

  return { butter2, biquad, filtfilt, bandpass, highpass, biquadGain, panTompkins, evaluate, hrv, classify, rhythmEvents, synth };
});
