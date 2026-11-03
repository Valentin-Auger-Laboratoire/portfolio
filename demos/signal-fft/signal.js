// =====================================================================
//  Moteur de calcul de la démo web « Chaîne de mesure / FFT ».
//  Portage JavaScript fidèle des fonctions MATLAB corrigées du dépôt
//  github.com/Valentin-Auger-Laboratoire/signal-fft-matlab
//  (gene_signal, deform_signal, echelle_reference, correcte*).
// =====================================================================
(function (root) {
  'use strict';

  const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const rms = (x) => Math.sqrt(mean(x.map((v) => v * v)));

  // DFT directe (N ≤ 200 : largement assez rapide). Renvoie {re, im}.
  function dft(x) {
    const N = x.length, re = new Array(N).fill(0), im = new Array(N).fill(0);
    for (let k = 0; k < N; k++) {
      let r = 0, i = 0;
      for (let n = 0; n < N; n++) {
        const a = (-2 * Math.PI * k * n) / N;
        r += x[n] * Math.cos(a);
        i += x[n] * Math.sin(a);
      }
      re[k] = r; im[k] = i;
    }
    return { re, im };
  }

  // gene_signal.m : s = M + Σ Ai·sin(2π·Fi·t), t ∈ [0, 1 s[
  function geneSignal(M, Ai, Fi, fe) {
    const N = Math.round(fe), t = [], s = [];
    for (let n = 0; n < N; n++) {
      const tn = n / fe;
      t.push(tn);
      let v = M;
      for (let j = 0; j < Ai.length; j++) v += Ai[j] * Math.sin(2 * Math.PI * Fi[j] * tn);
      s.push(v);
    }
    return { t, s };
  }

  // deform_signal.m
  function deform(s, choix, P0, P1) {
    switch (choix) {
      case 1: return s.map((v) => v + P0);
      case 2: return s.map((v) => P1 * v);
      case 3: return s.map((v) => P1 * v + P0);
      case 4: return s.map((v) => P1 * (v + P0));
      case 5: return s.map((v) => P0 * Math.exp(P1 * v));
      case 6: return s.map((v) => P0 + P1 * sign(v) * Math.log(1 + Math.abs(v)));
      default: return s.slice();
    }
  }

  // echelle_reference.m : facteur d'échelle signé par rapport au signal de référence
  function echelleReference(x, Ai, Fi, fe) {
    const effRef = Math.sqrt(Ai.reduce((a, v) => a + v * v, 0) / 2);
    if (effRef === 0) throw new Error('ref');
    const N = x.length, X = dft(x);
    let i = 0;
    for (let j = 1; j < Ai.length; j++) if (Math.abs(Ai[j]) > Math.abs(Ai[i])) i = j;
    const k = Math.round((Fi[i] * N) / fe);
    // real(X(k) / X_ref) avec X_ref = -1i·Ai·N/2  →  signe de (−Im X(k) · Ai)
    const signe = sign(-X.im[k] * Ai[i]);
    const m = mean(x);
    return (signe * rms(x.map((v) => v - m))) / effRef;
  }

  // Rapport complexe Xd(k)/Xb(k) réduit à un gain réel signé : |r|·sign(Re r)
  function gainSigne(Xd, Xb, k) {
    const dr = Xd.re[k], di = Xd.im[k], br = Xb.re[k], bi = Xb.im[k];
    const den = br * br + bi * bi;
    const rr = (dr * br + di * bi) / den, ri = (di * br - dr * bi) / den;
    return Math.hypot(rr, ri) * sign(rr);
  }

  // Indice (0-based) du pic AC dominant du signal de base, hors composante continue
  function picAC(Xb, N) {
    let best = -1, idx = -1;
    for (let k = 1; k < Math.floor(N / 2); k++) {
      const m = Math.hypot(Xb.re[k], Xb.im[k]);
      if (m > best) { best = m; idx = k; }
    }
    if (idx < 0 || best < 1e-9) throw new Error('harmonique');
    return idx;
  }

  function bisection(f, a, b) {
    let fa = f(a);
    for (let it = 0; it < 200; it++) {
      const m = (a + b) / 2, fm = f(m);
      if (Math.abs(b - a) < 1e-14 * Math.max(1, Math.abs(m))) return m;
      if (sign(fm) === sign(fa)) { a = m; fa = fm; } else { b = m; }
    }
    return (a + b) / 2;
  }

  // Chaîne complète pour une déformation donnée (= un fichier correcte*.m)
  function analyser(p) {
    const { M, Ai, Fi, fe, choix, P0, P1 } = p;
    const { t, s: sTemp } = geneSignal(M, Ai, Fi, fe);
    const N = sTemp.length, m = mean(sTemp);
    const plusUn = choix >= 2 && choix <= 4;           // GAIN, GAIN+OFFSET, OFFSET+GAIN
    const sBase = sTemp.map((v) => v - m + (plusUn ? 1 : 0));
    const sDef = deform(sBase, choix, P0, P1);
    const Xd = dft(sDef), Xb = dft(sBase);
    let est = {}, sCorr;

    if (choix === 1) {                                  // correcteOFFSET.m
      est.P0 = Xd.re[0] / N;
      sCorr = sDef.map((v) => v - est.P0);
    } else if (choix === 2) {                           // correcteGAIN.m
      est.P1 = gainSigne(Xd, Xb, 0);
      if (est.P1 === 0) throw new Error('gain');
      sCorr = sDef.map((v) => v / est.P1);
    } else if (choix === 3) {                           // correcteGAIN_OFFSET.m
      const k = picAC(Xb, N);
      est.P1 = gainSigne(Xd, Xb, k);
      if (est.P1 === 0) throw new Error('gain');
      est.P0 = Xd.re[0] / N - est.P1;
      sCorr = sDef.map((v) => (v - est.P0) / est.P1);
    } else if (choix === 4) {                           // correcteOFFSET_GAIN.m
      const k = picAC(Xb, N);
      est.P1 = gainSigne(Xd, Xb, k);
      if (est.P1 === 0) throw new Error('gain');
      est.P0 = Xd.re[0] / N / est.P1 - 1;
      sCorr = sDef.map((v) => v / est.P1 - est.P0);
    } else if (choix === 5) {                           // correcteExponentielle.m
      if (sDef.some((v) => v === 0)) throw new Error('P0');
      const y = sDef.map((v) => Math.log(Math.abs(v)));
      const my = mean(y);
      est.P0 = sign(sDef[0]) * Math.exp(my);
      const yc = y.map((v) => v - my);
      est.P1 = echelleReference(yc, Ai, Fi, fe);
      if (est.P1 === 0) throw new Error('P1');
      sCorr = yc.map((v) => v / est.P1);
    } else if (choix === 6) {                           // correcteLogarithmique.m
      est.P0 = mean(sDef);
      const g = sDef.map((v) => v - est.P0);
      const s1 = sign(echelleReference(g, Ai, Fi, fe));
      if (s1 === 0) throw new Error('P1');
      const effRef = Math.sqrt(Ai.reduce((a, v) => a + v * v, 0) / 2);
      const gmax = Math.max(...g.map(Math.abs));
      const ecart = (q) => rms(g.map((v) => Math.exp(Math.abs(v) / q) - 1)) - effRef;
      const pMin = gmax / 300;
      let pMax = gmax;
      while (ecart(pMax) > 0) pMax *= 2;
      est.P1 = s1 * bisection(ecart, pMin, pMax);
      sCorr = g.map((v) => { const u = v / est.P1; return sign(u) * (Math.exp(Math.abs(u)) - 1); });
    }

    const erreur = rms(sCorr.map((v, n) => v - sBase[n]));
    return { t, sBase, sDef, sCorr, Xd, Xb, N, est, erreur };
  }

  root.SignalFFT = { geneSignal, deform, dft, echelleReference, analyser };
  if (typeof module !== 'undefined') module.exports = root.SignalFFT;
})(typeof window !== 'undefined' ? window : globalThis);
