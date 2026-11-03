// =====================================================================
//  Choix d'un roulement : moteur de calcul (sans interface).
//  Méthode normalisée (ISO 281) :
//    charge dynamique équivalente   P = fs · (X·Fr + Y·Fa)
//    durée de vie de base           L10 = (C / P)^p        (millions de tours)
//                                   p = 3 (billes), 10/3 (rouleaux)
//    en heures                      L10h = 10^6 · L10 / (60 · n)
//    à une fiabilité donnée         Lnh = a1 · L10h
//    capacité nécessaire            C_req = P · (60 · n · Lh / (a1 · 10^6))^(1/p)
//    sécurité statique              s0 = C0 / P0
//  Pour un roulement rigide à billes, X et Y viennent du tableau usuel en
//  fonction de Fa / C0. Forces en N, C et C0 en kN.
// =====================================================================
(function (root) {
  'use strict';

  // Roulement rigide à billes, jeu normal : Fa/C0 -> e, Y (X = 0,56 si Fa/Fr > e)
  const BALL_TABLE = [
    [0.014, 0.19, 2.30], [0.028, 0.22, 1.99], [0.056, 0.26, 1.71], [0.084, 0.28, 1.55],
    [0.11, 0.30, 1.45], [0.17, 0.34, 1.31], [0.28, 0.38, 1.15], [0.42, 0.42, 1.04], [0.56, 0.44, 1.00],
  ];
  // Facteur de fiabilité a1
  const A1 = { 90: 1, 95: 0.64, 96: 0.55, 97: 0.47, 98: 0.37, 99: 0.25 };

  // Valeurs indicatives de catalogues courants (à vérifier chez le fabricant)
  const CATALOG = [
    { ref: '6204', type: 'ball', d: 20, D: 47, B: 14, C: 13.5, C0: 6.55 },
    { ref: '6205', type: 'ball', d: 25, D: 52, B: 15, C: 14.8, C0: 7.8 },
    { ref: '6206', type: 'ball', d: 30, D: 62, B: 16, C: 20.3, C0: 11.2 },
    { ref: '6304', type: 'ball', d: 20, D: 52, B: 15, C: 16.8, C0: 7.8 },
    { ref: '6305', type: 'ball', d: 25, D: 62, B: 17, C: 23.4, C0: 11.6 },
    { ref: '6306', type: 'ball', d: 30, D: 72, B: 19, C: 29.6, C0: 16 },
    { ref: 'NU 204', type: 'cyl', d: 20, D: 47, B: 14, C: 29, C0: 25 },
    { ref: 'NU 205', type: 'cyl', d: 25, D: 52, B: 15, C: 32.5, C0: 27 },
    { ref: 'NU 206', type: 'cyl', d: 30, D: 62, B: 16, C: 44, C0: 36.5 },
  ];

  function ballXY(fr, fa, c0N) {
    if (fa <= 0) return { X: 1, Y: 0, e: null, ratio: 0 };
    const r = fa / c0N;
    const T = BALL_TABLE;
    let e, Y;
    if (r <= T[0][0]) { e = T[0][1]; Y = T[0][2]; }
    else if (r >= T[T.length - 1][0]) { e = T[T.length - 1][1]; Y = T[T.length - 1][2]; }
    else {
      for (let i = 1; i < T.length; i++) if (r <= T[i][0]) {
        const k = (r - T[i - 1][0]) / (T[i][0] - T[i - 1][0]);
        e = T[i - 1][1] + k * (T[i][1] - T[i - 1][1]);
        Y = T[i - 1][2] + k * (T[i][2] - T[i - 1][2]);
        break;
      }
    }
    return fa / fr > e ? { X: 0.56, Y, e, ratio: r } : { X: 1, Y: 0, e, ratio: r };
  }

  function lifeHours(C, P, pExp, n) { return (Math.pow(C / P, pExp) * 1e6) / (60 * n); }

  function select(p) {
    const issues = [];
    const err = (code, v) => issues.push({ lvl: 'err', code, v });
    const warn = (code, v) => issues.push({ lvl: 'warn', code, v });
    const nonneg = (x) => Number.isFinite(x) && x >= 0;
    if (!nonneg(p.fr)) err('fr');
    if (!nonneg(p.fa)) err('fa');
    if (nonneg(p.fr) && nonneg(p.fa) && p.fr + p.fa === 0) err('noLoad');
    if (!(Number.isFinite(p.n) && p.n > 0)) err('n');
    if (!(Number.isFinite(p.lh) && p.lh > 0)) err('lh');
    if (!(Number.isFinite(p.C) && p.C > 0)) err('C');
    if (!(Number.isFinite(p.C0) && p.C0 > 0)) err('C0');
    if (!(Number.isFinite(p.fs) && p.fs >= 1)) err('fs');
    if (!(p.rel in A1)) err('rel');
    if (p.type === 'manual' && !(Number.isFinite(p.X) && p.X >= 0 && Number.isFinite(p.Y) && p.Y >= 0)) err('xy');
    if (issues.length) return { ok: false, issues };

    const C = p.C * 1000, C0 = p.C0 * 1000;
    let X, Y, e = null, ratio = null, pExp, P0;
    if (p.type === 'ball') {
      ({ X, Y, e, ratio } = ballXY(p.fr, p.fa, C0)); pExp = 3;
      P0 = Math.max(p.fr, 0.6 * p.fr + 0.5 * p.fa);
      if (ratio > 0.5) warn('bigAxial');
    } else if (p.type === 'cyl') {
      X = 1; Y = 0; pExp = 10 / 3; P0 = p.fr;
      if (p.fa > 0) warn('cylAxial');
    } else {
      X = p.X; Y = p.Y; pExp = p.roller ? 10 / 3 : 3; P0 = Math.max(p.fr, X * p.fr + Y * p.fa);
    }
    const P = p.fs * (X * p.fr + Y * p.fa);
    if (P <= 0) return { ok: false, issues: [{ lvl: 'err', code: 'noLoad' }] };
    const a1 = A1[p.rel];
    const L10 = Math.pow(C / P, pExp);
    const L10h = (L10 * 1e6) / (60 * p.n);
    const Lnh = a1 * L10h;
    const Creq = P * Math.pow((60 * p.n * p.lh) / (a1 * 1e6), 1 / pExp) / 1000;  // kN
    const s0 = C0 / (p.fs * P0);
    const ok = Lnh >= p.lh;
    if (!ok) warn('short');
    if (s0 < 1) err('static', s0); else if (s0 < 2) warn('staticLow', s0);
    if (P > 0.5 * C) warn('heavy');
    return { ok: true, issues, X, Y, e, ratio, pExp, P, P0, a1, L10, L10h, Lnh, Creq, s0, enough: ok, margin: Lnh / p.lh };
  }

  // Durée de vie (h) en fonction de la charge radiale, même rapport Fa/Fr
  function sweep(p, nPts) {
    const out = [];
    const fr0 = Math.max(p.fr, 1);
    for (let i = 0; i <= nPts; i++) {
      const fr = fr0 * (0.2 + (2.8 * i) / nPts);
      const r = select({ ...p, fr, fa: (p.fa * fr) / fr0 });
      if (r.ok) out.push({ fr, h: r.Lnh });
    }
    return out;
  }

  const api = { select, sweep, ballXY, lifeHours, CATALOG, A1, BALL_TABLE };
  root.Roulements = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
