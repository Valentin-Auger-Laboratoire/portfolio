// =====================================================================
//  Analyse d'un aileron arrière par éléments finis : moteur (sans interface).
//  - Charge aérodynamique : appui F = ½·ρ·v²·S·Cl, réparti sur l'envergure
//    (uniforme ou elliptique).
//  - Section : profil NACA 4 chiffres (plein ou creux à peau d'épaisseur t),
//    aire et moment quadratique calculés par intégration numérique.
//  - Structure : poutre d'Euler-Bernoulli discrétisée en éléments finis à
//    2 nœuds (flèche v et rotation θ par nœud), posée ou encastrée sur deux
//    supports ; résolution K·u = F par élimination de Gauss.
//  Unités internes : N, m, Pa.
// =====================================================================
(function (root) {
  'use strict';

  const MATERIALS = {
    alu: { E: 69e9, Re: 276e6, rho: 2700 },        // aluminium 6061-T6
    carbon: { E: 70e9, Re: 600e6, rho: 1600 },     // stratifié carbone quasi isotrope (indicatif)
    steel: { E: 210e9, Re: 235e6, rho: 7850 },     // acier S235
    pla: { E: 3.5e9, Re: 50e6, rho: 1240 },        // PLA imprimé (maquette, indicatif)
  };

  // ---------- Profil NACA 4 chiffres ----------
  // épaisseur relative t (ex. 0,12), cambrure m (ex. 0,04) à la position p (ex. 0,4)
  function nacaThickness(x, t) {
    return 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  }
  function nacaCamber(x, m, p) {
    if (m === 0 || p === 0) return 0;
    return x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x);
  }
  function nacaOutline(code, n) {
    const m = code.m, p = code.p, t = code.t, up = [], lo = [];
    for (let i = 0; i <= n; i++) {
      const x = (1 - Math.cos((Math.PI * i) / n)) / 2;
      const yt = nacaThickness(x, t), yc = nacaCamber(x, m, p);
      up.push([x, yc + yt]); lo.push([x, yc - yt]);
    }
    return { up, lo };
  }
  // Propriétés de section pour une corde c (m) ; skin = épaisseur de peau (m) ou 0 pour plein.
  // Flexion sous charge verticale : moment quadratique autour de l'axe horizontal passant par le centre de gravité.
  function section(code, c, skin) {
    const N = 400;
    let A = 0, Sy = 0, Iy0 = 0, ymaxU = -Infinity, ymaxL = Infinity;
    const strips = [];
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N, dx = c / N;
      const yt = nacaThickness(x, code.t) * c, yc = nacaCamber(x, code.m, code.p) * c;
      const yU = yc + yt, yL = yc - yt;
      ymaxU = Math.max(ymaxU, yU); ymaxL = Math.min(ymaxL, yL);
      strips.push({ dx, yU, yL });
    }
    const add = (h, yMid, dx, sgn) => { A += sgn * h * dx; Sy += sgn * h * dx * yMid; Iy0 += sgn * dx * (h ** 3 / 12 + h * yMid * yMid); };
    for (const s of strips) {
      const h = s.yU - s.yL, ym = (s.yU + s.yL) / 2;
      add(h, ym, s.dx, 1);
      if (skin > 0 && h > 2 * skin) add(h - 2 * skin, ym, s.dx, -1);
    }
    const yG = Sy / A;
    const I = Iy0 - A * yG * yG;
    return { A, I, yG, cTop: ymaxU - yG, cBot: yG - ymaxL, hMax: Math.max(...strips.map((s) => s.yU - s.yL)) };
  }

  // ---------- Solveur linéaire (Gauss avec pivot partiel) ----------
  function solve(K, F) {
    const n = F.length, A = K.map((r, i) => [...r, F[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      const d = A[c][c];
      if (Math.abs(d) < 1e-30) throw new Error('singular');
      for (let r = c + 1; r < n; r++) {
        const f = A[r][c] / d;
        if (f !== 0) for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = A[r][n]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
    return x;
  }

  // ---------- Poutre en éléments finis ----------
  // nodes : abscisses (m) triées ; w(x) : charge répartie (N/m, positive vers le bas) ;
  // supports : [{x, type: 'pin'|'fixed'}] (doivent coïncider avec des nœuds) ; EI (N·m²)
  function beamFE(nodes, wFn, supports, EI) {
    const nn = nodes.length, nd = 2 * nn;
    const K = Array.from({ length: nd }, () => new Array(nd).fill(0));
    const F = new Array(nd).fill(0);
    for (let e = 0; e < nn - 1; e++) {
      const L = nodes[e + 1] - nodes[e], k = EI / L ** 3;
      const ke = [[12, 6 * L, -12, 6 * L], [6 * L, 4 * L * L, -6 * L, 2 * L * L], [-12, -6 * L, 12, -6 * L], [6 * L, 2 * L * L, -6 * L, 4 * L * L]];
      // charge linéaire entre w1 et w2 (vecteur de forces consistant), vers le bas = négatif
      const w1 = -wFn(nodes[e]), w2 = -wFn(nodes[e + 1]);
      const fe = [L * (7 * w1 + 3 * w2) / 20, L * L * (3 * w1 + 2 * w2) / 60, L * (3 * w1 + 7 * w2) / 20, -L * L * (2 * w1 + 3 * w2) / 60];
      const idx = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
      for (let i = 0; i < 4; i++) { F[idx[i]] += fe[i]; for (let j = 0; j < 4; j++) K[idx[i]][idx[j]] += k * ke[i][j]; }
    }
    const K0 = K.map((r) => r.slice()), F0 = F.slice();
    const fixedDofs = [];
    for (const s of supports) {
      const i = nodes.findIndex((x) => Math.abs(x - s.x) < 1e-9);
      if (i < 0) throw new Error('support not on node');
      fixedDofs.push(2 * i); if (s.type === 'fixed') fixedDofs.push(2 * i + 1);
    }
    for (const d of fixedDofs) { for (let j = 0; j < nd; j++) { K[d][j] = 0; K[j][d] = 0; } K[d][d] = 1; F[d] = 0; }
    const u = solve(K, F);
    // réactions = K0·u − F0 aux ddl bloqués
    const R = (d) => K0[d].reduce((s, kij, j) => s + kij * u[j], 0) - F0[d];
    const reactions = supports.map((s) => { const i = nodes.findIndex((x) => Math.abs(x - s.x) < 1e-9); return { x: s.x, F: R(2 * i), M: s.type === 'fixed' ? R(2 * i + 1) : 0 }; });
    // moments aux nœuds par équilibre : M(x) = Σ des efforts à gauche (réactions + charge)
    const v = nodes.map((_, i) => u[2 * i]), th = nodes.map((_, i) => u[2 * i + 1]);
    return { u, v, th, reactions };
  }

  // Effort tranchant et moment par intégration de la charge et des réactions (de gauche à droite)
  function internalForces(nodes, wFn, reactions) {
    const T = [], M = [];
    let t = 0, m = 0;
    const rs = reactions.slice().sort((a, b) => a.x - b.x);
    let ri = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (i > 0) {
        const L = nodes[i] - nodes[i - 1], w1 = wFn(nodes[i - 1]), w2 = wFn(nodes[i]);
        // charge vers le bas : dT/dx = −w, dM/dx = T
        const dT = -((w1 + w2) / 2) * L;
        m += t * L - L * L * (2 * w1 + w2) / 6;
        t += dT;
      }
      // réactions appliquées au nœud (après avoir pris la charge à gauche)
      while (ri < rs.length && Math.abs(rs[ri].x - nodes[i]) < 1e-9) { t += rs[ri].F; m -= rs[ri].M; ri++; }
      T.push(t); M.push(m);
    }
    return { T, M };
  }

  // =================================================================
  //  Analyse complète
  //  p = { span, chord (m), naca:'2412', skin (mm, 0 = plein), material,
  //        speed (km/h), cl, rho, dist:'uniform'|'elliptic', supportGap (m),
  //        support:'pin'|'fixed', ne (éléments) }
  // =================================================================
  function parseNaca(s) {
    const m4 = /^(\d)(\d)(\d{2})$/.exec(String(s).trim());
    if (!m4) return null;
    const m = +m4[1] / 100, p = +m4[2] / 10, t = +m4[3] / 100;
    if (t <= 0 || t > 0.4 || (m > 0 && p === 0)) return null;
    return { m, p, t };
  }

  function analyse(p) {
    const issues = [];
    const err = (code, v) => issues.push({ lvl: 'err', code, v });
    const warn = (code, v) => issues.push({ lvl: 'warn', code, v });
    const pos = (x) => Number.isFinite(x) && x > 0;
    const code = parseNaca(p.naca);
    if (!code) err('naca');
    if (!pos(p.span)) err('span');
    if (!pos(p.chord)) err('chord');
    if (!(Number.isFinite(p.skin) && p.skin >= 0)) err('skin');
    if (!MATERIALS[p.material]) err('material');
    if (!pos(p.speed)) err('speed');
    if (!(Number.isFinite(p.cl) && p.cl > 0 && p.cl < 4)) err('cl');
    if (!(pos(p.supportGap) && p.supportGap <= p.span)) err('gap');
    if (issues.length) return { ok: false, issues };

    const mat = MATERIALS[p.material];
    const sec = section(code, p.chord, p.skin / 1000);
    if (p.skin > 0 && 2 * p.skin / 1000 >= sec.hMax) err('skinThick');
    if (issues.length) return { ok: false, issues };
    const EI = mat.E * sec.I;

    // charge aérodynamique
    const rho = p.rho || 1.225, vms = p.speed / 3.6;
    const q = 0.5 * rho * vms * vms;
    const Ftot = q * p.span * p.chord * p.cl;            // appui total (N)
    const b2 = p.span / 2;
    const w0 = p.dist === 'elliptic' ? (4 * Ftot) / (Math.PI * p.span) : Ftot / p.span;
    const wAero = (x) => { const y = x - b2; return p.dist === 'elliptic' ? w0 * Math.sqrt(Math.max(0, 1 - (y / b2) ** 2)) : w0; };
    const wSelf = sec.A * mat.rho * 9.81;                 // poids propre (N/m)
    const wFn = (x) => wAero(x) + wSelf;

    // maillage : nœuds réguliers + nœuds aux supports
    const ne = Math.max(20, Math.min(400, p.ne || 120));
    const xs = new Set();
    for (let i = 0; i <= ne; i++) xs.add(+(p.span * i / ne).toFixed(9));
    const sL = b2 - p.supportGap / 2, sR = b2 + p.supportGap / 2;
    xs.add(+sL.toFixed(9)); xs.add(+sR.toFixed(9));
    const nodes = [...xs].sort((a, b) => a - b);
    const type = p.support === 'fixed' ? 'fixed' : 'pin';
    const supports = [{ x: +sL.toFixed(9), type }, { x: +sR.toFixed(9), type }];
    const fe = beamFE(nodes, wFn, supports, EI);
    const { T, M } = internalForces(nodes, wFn, fe.reactions);

    const sig = M.map((m) => (Math.abs(m) * Math.max(sec.cTop, sec.cBot)) / sec.I);
    const iV = fe.v.reduce((bi, v, i) => (Math.abs(v) > Math.abs(fe.v[bi]) ? i : bi), 0);
    const iS = sig.reduce((bi, s, i) => (s > sig[bi] ? i : bi), 0);
    const sigMax = sig[iS], vMax = fe.v[iV];
    const SF = mat.Re / sigMax;
    const mass = sec.A * mat.rho * p.span;
    const Mmax = M.reduce((a, m) => (Math.abs(m) > Math.abs(a) ? m : a), 0);
    const totalLoad = Ftot + wSelf * p.span;

    if (SF < 1) err('yield', SF); else if (SF < 1.5) warn('lowSF', SF);
    if (Math.abs(vMax) / p.span > 1 / 100) warn('flex', Math.abs(vMax) * 1000);
    if (p.supportGap < 0.3 * p.span) warn('overhang');
    if (p.material === 'pla' && p.speed > 60) warn('pla');

    return {
      ok: true, issues, code, sec, EI, mat, q, Ftot, wSelf, totalLoad, mass, nodes,
      w: nodes.map(wFn), v: fe.v, th: fe.th, T, M, sig, reactions: fe.reactions,
      vMax, xvMax: nodes[iV], sigMax, xsigMax: nodes[iS], Mmax, SF, supports,
    };
  }

  const api = { analyse, section, parseNaca, nacaOutline, nacaThickness, beamFE, internalForces, solve, MATERIALS };
  root.Aileron = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
