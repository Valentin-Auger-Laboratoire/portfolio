/* Bras robotique plan : moteur (sans dépendance).
   Cinématique directe, cinématique inverse (analytique et numérique), jacobienne, manipulabilité,
   espace de travail, trajectoires (profil trapézoïdal, articulaire ou cartésien) et couples statiques.
   Utilisable dans le navigateur (window.Robot) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Robot = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // arm = { L: [l1, l2, l3], lim: [[min, max] (rad), …] }, q = [q1, q2, q3] (angles relatifs)
  // ---------- Cinématique directe ----------
  function fk(arm, q) {
    const pts = [[0, 0]];
    let x = 0, y = 0, a = 0;
    for (let i = 0; i < arm.L.length; i++) {
      a += q[i];
      x += arm.L[i] * Math.cos(a); y += arm.L[i] * Math.sin(a);
      pts.push([x, y]);
    }
    return { pts, x, y, phi: a };
  }

  // ---------- Jacobienne (position de l'outil, et orientation) ----------
  // J[0][j] = ∂x/∂qj, J[1][j] = ∂y/∂qj, J[2][j] = ∂φ/∂qj = 1
  function jacobian(arm, q) {
    const n = arm.L.length, f = fk(arm, q), J = [new Array(n), new Array(n), new Array(n).fill(1)];
    for (let j = 0; j < n; j++) {
      const [px, py] = f.pts[j];
      J[0][j] = -(f.y - py); J[1][j] = f.x - px;
    }
    return J;
  }
  // Manipulabilité de Yoshikawa w = √det(J·Jᵀ) (partie position) et ellipse de manipulabilité
  function manipulability(arm, q) {
    const J = jacobian(arm, q), n = arm.L.length;
    let a = 0, b = 0, c = 0;
    for (let j = 0; j < n; j++) { a += J[0][j] * J[0][j]; b += J[0][j] * J[1][j]; c += J[1][j] * J[1][j]; }
    const det = a * c - b * b, tr = a + c, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
    const angle = Math.abs(b) < 1e-14 ? (a >= c ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b);
    return { w: Math.sqrt(Math.max(0, det)), axes: [Math.sqrt(l1), Math.sqrt(l2)], angle };
  }

  const inLimits = (arm, q) => q.every((v, i) => !arm.lim || (v >= arm.lim[i][0] - 1e-9 && v <= arm.lim[i][1] + 1e-9));

  // ---------- Cinématique inverse analytique (3 axes, orientation φ de l'outil imposée) ----------
  // Renvoie les deux solutions (coude haut / coude bas) ou null si la cible est hors d'atteinte
  function ikAnalytic(arm, x, y, phi) {
    const [l1, l2, l3] = arm.L;
    const wx = x - l3 * Math.cos(phi), wy = y - l3 * Math.sin(phi); // centre du poignet
    const r2 = wx * wx + wy * wy, c2 = (r2 - l1 * l1 - l2 * l2) / (2 * l1 * l2);
    if (c2 > 1 + 1e-12 || c2 < -1 - 1e-12) return null;
    const cc = Math.max(-1, Math.min(1, c2));
    return [1, -1].map((s) => {
      const q2 = s * Math.acos(cc);
      const q1 = Math.atan2(wy, wx) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
      const q3 = wrap(phi - q1 - q2);
      return [wrap(q1), q2, q3];
    });
  }

  // ---------- Cinématique inverse numérique (moindres carrés amortis, Levenberg-Marquardt) ----------
  // Cherche q tel que l'outil atteigne (x, y), et φ si wOri > 0 ; respecte les butées
  function ikNumeric(arm, x, y, phi, q0, opts = {}) {
    const n = arm.L.length, lambda = opts.lambda || 0.05, wOri = opts.wOri === undefined ? 0 : opts.wOri, iters = opts.iters || 200;
    let q = q0.slice(), it = 0, err = Infinity;
    const history = [];
    for (; it < iters; it++) {
      const f = fk(arm, q);
      const e = [x - f.x, y - f.y, wOri ? wOri * wrap(phi - f.phi) : 0];
      err = Math.hypot(e[0], e[1]);
      history.push(err);
      if (err < (opts.tol || 1e-9) && (!wOri || Math.abs(e[2]) < 1e-9)) break;
      const J = jacobian(arm, q);
      const rows = wOri ? 3 : 2;
      if (wOri) J[2] = J[2].map((v) => v * wOri);
      // Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e
      const A = Array.from({ length: rows }, (_, i) => Array.from({ length: rows }, (_, k) => {
        let s = 0; for (let j = 0; j < n; j++) s += J[i][j] * J[k][j];
        return s + (i === k ? lambda * lambda : 0);
      }));
      const v = solve(A, e.slice(0, rows));
      for (let j = 0; j < n; j++) {
        let d = 0; for (let i = 0; i < rows; i++) d += J[i][j] * v[i];
        q[j] += d;
        if (arm.lim) q[j] = Math.max(arm.lim[j][0], Math.min(arm.lim[j][1], q[j]));
      }
    }
    return { q, iters: it, err, history, ok: err < (opts.okTol || 1e-6) };
  }
  // Pivot de Gauss (petits systèmes)
  function solve(A, b) {
    const n = A.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }

  // ---------- Espace de travail (échantillonnage des angles dans les butées) ----------
  function workspace(arm, steps = 40) {
    const out = [];
    const rec = (i, q) => {
      if (i === arm.L.length) { const f = fk(arm, q); out.push([f.x, f.y]); return; }
      const [a, b] = arm.lim[i];
      for (let k = 0; k <= steps; k++) rec(i + 1, [...q, a + ((b - a) * k) / steps]);
    };
    rec(0, []);
    return out;
  }
  // rayon atteignable sans butées : [|l1 − l2 − l3|⁺, l1 + l2 + l3]
  function reach(arm) {
    const L = arm.L, s = L.reduce((a, b) => a + b, 0), m = Math.max(...L);
    return [Math.max(0, 2 * m - s), s];
  }

  // ---------- Profil de vitesse trapézoïdal ----------
  // distance D, vitesse max V, accélération A ; renvoie la durée et s(t) ∈ [0, D]
  function trapezoid(D, V, A) {
    D = Math.abs(D);
    if (D === 0) return { T: 0, s: () => 0, v: () => 0, tAcc: 0, vPeak: 0 };
    let tA = V / A, dA = 0.5 * A * tA * tA, T, vp = V;
    if (2 * dA >= D) { tA = Math.sqrt(D / A); vp = A * tA; T = 2 * tA; } // profil triangulaire
    else T = 2 * tA + (D - 2 * dA) / V;
    const s = (t) => {
      if (t <= 0) return 0; if (t >= T) return D;
      if (t < tA) return 0.5 * A * t * t;
      if (t > T - tA) { const u = T - t; return D - 0.5 * A * u * u; }
      return 0.5 * A * tA * tA + vp * (t - tA);
    };
    const v = (t) => (t <= 0 || t >= T ? 0 : t < tA ? A * t : t > T - tA ? A * (T - t) : vp);
    return { T, s, v, tAcc: tA, vPeak: vp };
  }
  // Trajectoire point à point. mode 'joint' : chaque axe interpolé (synchronisé sur l'axe le plus lent)
  // mode 'cart' : l'outil suit la ligne droite, angles par cinématique inverse à chaque instant
  function planMove(arm, qA, target, opts) {
    const { mode, vJ, aJ, vC, aC, elbow } = opts;
    if (mode === 'joint') {
      const sols = ikAnalytic(arm, target.x, target.y, target.phi);
      if (!sols) return null;
      const qB = closest(sols.filter((s) => inLimits(arm, s)), qA, elbow);
      if (!qB) return null;
      const dq = qB.map((v, i) => wrap(v - qA[i]));
      const dmax = Math.max(...dq.map(Math.abs));
      const prof = trapezoid(dmax, vJ, aJ);
      return { T: prof.T, at: (t) => { const u = dmax ? prof.s(t) / dmax : 1; return qA.map((v, i) => v + dq[i] * u); } };
    }
    const A = fk(arm, qA), dx = target.x - A.x, dy = target.y - A.y, dphi = wrap(target.phi - A.phi);
    const D = Math.hypot(dx, dy) || Math.abs(dphi) * 0.1;
    const prof = trapezoid(D, vC, aC);
    // vérifier que toute la ligne est atteignable, en suivant la branche de départ
    // on garde la branche de départ (même signe du coude) tout le long de la ligne
    const branch = qA[1] >= 0 ? 0 : 1;
    const qAt = (u) => {
      const s = ikAnalytic(arm, A.x + dx * u, A.y + dy * u, A.phi + dphi * u);
      return s ? s[branch] : null;
    };
    for (let k = 0; k <= 50; k++) { const q = qAt(k / 50); if (!q || !inLimits(arm, q)) return { blocked: k / 50 }; }
    return { T: prof.T, at: (t) => { const u = D ? prof.s(t) / D : 1; return qAt(u); } };
  }
  // « coude haut » : la solution dont le coude est le plus haut (y du coude ∝ sin q1)
  const elbowY = (q) => Math.sin(q[0]);
  function pickElbow(sols, elbow) {
    if (!sols || !sols.length) return null;
    const s = sols.slice().sort((a, b) => elbowY(b) - elbowY(a));
    return elbow === 'down' ? s[s.length - 1] : s[0];
  }
  function closest(sols, q, elbow) {
    if (!sols.length) return null;
    if (elbow === 'up' || elbow === 'down') return pickElbow(sols, elbow);
    const d = (s) => s.reduce((a, v, i) => a + Math.abs(wrap(v - q[i])), 0);
    return sols.slice().sort((a, b) => d(a) - d(b))[0];
  }

  // ---------- Couples statiques dus à la pesanteur ----------
  // masses des segments (réparties, centre au milieu) m[i], charge utile en bout, moteurs aux articulations M[i]
  // couple au moteur j = Σ (poids en aval) × bras de levier horizontal par rapport à l'articulation j
  function gravityTorques(arm, q, masses, payload, motorMass = [], g = 9.81) {
    const f = fk(arm, q), n = arm.L.length, out = new Array(n).fill(0);
    const loads = []; // [x, masse]
    for (let i = 0; i < n; i++) {
      loads.push({ x: (f.pts[i][0] + f.pts[i + 1][0]) / 2, m: masses[i], seg: i });
      if (i > 0 && motorMass[i]) loads.push({ x: f.pts[i][0], m: motorMass[i], seg: i - 0.5 });
    }
    loads.push({ x: f.x, m: payload, seg: n });
    for (let j = 0; j < n; j++) {
      const xj = f.pts[j][0];
      out[j] = loads.filter((l) => l.seg >= j).reduce((s, l) => s + l.m * g * (l.x - xj), 0);
    }
    return out; // N·m, positif = le moteur doit tenir contre une rotation vers le bas
  }

  return { DEG, wrap, pickElbow, fk, jacobian, manipulability, inLimits, ikAnalytic, ikNumeric, solve, workspace, reach, trapezoid, planMove, closest, gravityTorques };
});
