/* Simulateur de pendules : moteur physique (sans dépendance).
   Intégration Runge-Kutta d'ordre 4, pendule simple (amorti, forcé), pendule double,
   pendules couplés par un ressort, et calculs d'une horloge à balancier.
   Utilisable dans le navigateur (window.Pendules) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Pendules = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const G0 = 9.80665; // pesanteur normale (m/s²)
  const DEG = Math.PI / 180;

  // ---------- Intégrateur RK4 ----------
  // deriv(t, y, p) renvoie dy/dt ; y est un tableau de nombres
  function rk4(deriv, y, t, h, p) {
    const n = y.length, tmp = new Array(n);
    const k1 = deriv(t, y, p);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + (h / 2) * k1[i];
    const k2 = deriv(t + h / 2, tmp, p);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + (h / 2) * k2[i];
    const k3 = deriv(t + h / 2, tmp, p);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
    const k4 = deriv(t + h, tmp, p);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return out;
  }

  // ---------- Intégrale elliptique complète de 1re espèce (moyenne arithmético-géométrique) ----------
  function ellipK(k) {
    if (k >= 1) return Infinity;
    let a = 1, b = Math.sqrt(1 - k * k);
    for (let i = 0; i < 40 && Math.abs(a - b) > 1e-16 * a; i++) { const an = (a + b) / 2; b = Math.sqrt(a * b); a = an; }
    return Math.PI / (2 * a);
  }

  // ---------- Pendule simple ----------
  // p = { g, L, gamma (amortissement, 1/s), F (forçage, rad/s²), wd (pulsation du forçage, rad/s) }
  // θ'' = −(g/L)·sin θ − γ·θ' + F·cos(ωd·t)
  function simpleDeriv(t, y, p) {
    return [y[1], -(p.g / p.L) * Math.sin(y[0]) - (p.gamma || 0) * y[1] + (p.F || 0) * Math.cos((p.wd || 0) * t)];
  }
  // même pendule, avec l'approximation des petits angles (sin θ ≈ θ)
  function linearDeriv(t, y, p) {
    return [y[1], -(p.g / p.L) * y[0] - (p.gamma || 0) * y[1] + (p.F || 0) * Math.cos((p.wd || 0) * t)];
  }
  function simpleEnergy(y, p) {
    const m = p.m || 1;
    const U = m * p.g * p.L * (1 - Math.cos(y[0])), K = 0.5 * m * p.L * p.L * y[1] * y[1];
    return { K, U, E: K + U };
  }
  const periodSmall = (L, g) => 2 * Math.PI * Math.sqrt(L / g);
  // période exacte pour une amplitude θ0 (rad) : T = 4·√(L/g)·K(sin(θ0/2))
  const periodExact = (L, g, theta0) => 4 * Math.sqrt(L / g) * ellipK(Math.abs(Math.sin(theta0 / 2)));
  // formule de Borda : T ≈ T0·(1 + θ0²/16)
  const periodBorda = (L, g, theta0) => periodSmall(L, g) * (1 + (theta0 * theta0) / 16);
  // Période mesurée sur la simulation : temps entre passages par 0 dans le même sens (interpolés)
  function measurePeriod(deriv, y0, p, h, tmax) {
    let y = y0.slice(), t = 0;
    const cross = [];
    while (t < tmax && cross.length < 6) {
      const yn = rk4(deriv, y, t, h, p);
      if (y[0] < 0 && yn[0] >= 0) cross.push(t + (h * -y[0]) / (yn[0] - y[0]));
      y = yn; t += h;
    }
    if (cross.length < 2) return NaN;
    return (cross[cross.length - 1] - cross[0]) / (cross.length - 1);
  }
  // Résonance (modèle linéarisé) : amplitude du régime permanent pour un forçage F·cos(ωt)
  const resonanceAmp = (w0, gamma, F, w) => F / Math.sqrt((w0 * w0 - w * w) ** 2 + (gamma * w) ** 2);
  const resonancePeak = (w0, gamma) => (gamma * gamma < 2 * w0 * w0 ? Math.sqrt(w0 * w0 - (gamma * gamma) / 2) : 0);
  const qualityFactor = (w0, gamma) => (gamma > 0 ? w0 / gamma : Infinity);

  // ---------- Pendule double (masses ponctuelles) ----------
  // y = [θ1, ω1, θ2, ω2], angles mesurés depuis la verticale
  function doubleDeriv(t, y, p) {
    const [a1, w1, a2, w2] = y, { g, L1, L2, m1, m2 } = p, gam = p.gamma || 0;
    const d = a1 - a2, sd = Math.sin(d), cd = Math.cos(d);
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
    const dw1 = (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) - 2 * sd * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cd)) / (L1 * den);
    const dw2 = (2 * sd * (w1 * w1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) + w2 * w2 * L2 * m2 * cd)) / (L2 * den);
    return [w1, dw1 - gam * w1, w2, dw2 - gam * w2];
  }
  function doublePositions(y, p) {
    const x1 = p.L1 * Math.sin(y[0]), y1 = -p.L1 * Math.cos(y[0]);
    return { x1, y1, x2: x1 + p.L2 * Math.sin(y[2]), y2: y1 - p.L2 * Math.cos(y[2]) };
  }
  function doubleEnergy(y, p) {
    const [a1, w1, a2, w2] = y, { g, L1, L2, m1, m2 } = p;
    const K = 0.5 * m1 * L1 * L1 * w1 * w1 + 0.5 * m2 * (L1 * L1 * w1 * w1 + L2 * L2 * w2 * w2 + 2 * L1 * L2 * w1 * w2 * Math.cos(a1 - a2));
    const U = -(m1 + m2) * g * L1 * Math.cos(a1) - m2 * g * L2 * Math.cos(a2);
    return { K, U, E: K + U };
  }
  // pulsations des deux modes propres pour les petites oscillations (masses et longueurs quelconques)
  function doubleModes(p) {
    const { g, L1, L2, m1, m2 } = p, M = m1 + m2;
    // M·L1²·θ1'' + m2·L1·L2·θ2'' + M·g·L1·θ1 = 0 ; m2·L1·L2·θ1'' + m2·L2²·θ2'' + m2·g·L2·θ2 = 0
    const a = M * L1 * L1, b = m2 * L1 * L2, c = m2 * L2 * L2, k1 = M * g * L1, k2 = m2 * g * L2;
    // det(K − ω²·Mmat) = 0 → (a c − b²) λ² − (a k2 + c k1) λ + k1 k2 = 0
    const A = a * c - b * b, B = -(a * k2 + c * k1), C = k1 * k2;
    const disc = Math.sqrt(B * B - 4 * A * C);
    return [Math.sqrt((-B - disc) / (2 * A)), Math.sqrt((-B + disc) / (2 * A))];
  }

  // ---------- Pendules couplés par un ressort ----------
  // deux pendules identiques (L, m), ressort de raideur k fixé au niveau des masses (petits écarts)
  // θi'' = −(g/L)·sin θi − (k/m)·(θi − θj) − γ·θi'
  function coupledDeriv(t, y, p) {
    const [a1, w1, a2, w2] = y, c = p.k / p.m, gam = p.gamma || 0, w = p.g / p.L;
    return [w1, -w * Math.sin(a1) - c * (a1 - a2) - gam * w1, w2, -w * Math.sin(a2) - c * (a2 - a1) - gam * w2];
  }
  function coupledModes(p) {
    const w1 = Math.sqrt(p.g / p.L), w2 = Math.sqrt(p.g / p.L + (2 * p.k) / p.m);
    return { w1, w2, beat: (2 * Math.PI) / (w2 - w1), exchange: Math.PI / (w2 - w1) };
  }
  function coupledEnergy(y, p) {
    const e1 = simpleEnergy([y[0], y[1]], p).E, e2 = simpleEnergy([y[2], y[3]], p).E;
    const spring = 0.5 * p.k * p.L * p.L * (y[0] - y[2]) ** 2;
    return { e1, e2, spring, E: e1 + e2 + spring };
  }

  // ---------- Horloge à balancier ----------
  // Balancier « qui bat la seconde » : chaque alternance dure 1 s, la période vaut 2 s
  const secondsPendulumLength = (g) => g / (Math.PI * Math.PI);
  // pesanteur selon la latitude (formule internationale de 1967), en m/s²
  const gravityAtLatitude = (latDeg) => {
    const s = Math.sin(latDeg * DEG), s2 = Math.sin(2 * latDeg * DEG);
    return 9.780327 * (1 + 0.0053024 * s * s - 0.0000058 * s2 * s2);
  };
  // coefficients de dilatation linéique (1/K), valeurs usuelles
  const MATERIALS = { acier: 11.5e-6, laiton: 19e-6, invar: 1.2e-6, bois: 4e-6, aluminium: 23e-6 };
  // Marche d'une horloge (s/jour, positive = avance) réglée pour battre la seconde à 20 °C, au lieu de réglage
  // p = { gRef, g, L0 (longueur réglée), dL (m, réglage), alpha, dT (°C), amp (rad), ampRef (rad) }
  function clockRate(p) {
    const L = (p.L0 + (p.dL || 0)) * (1 + (p.alpha || 0) * (p.dT || 0));
    const amp = p.amp || 0, ampRef = p.ampRef === undefined ? amp : p.ampRef;
    const Tref = periodExact(p.L0, p.gRef, ampRef); // période au réglage (par construction : 2 s)
    const T = periodExact(L, p.g, amp);
    const total = 86400 * (Tref / T - 1);
    // contributions séparées (chacune seule)
    const part = (L2, g2, a2) => 86400 * (Tref / periodExact(L2, g2, a2) - 1);
    return {
      period: T, total,
      thermal: part(p.L0 * (1 + (p.alpha || 0) * (p.dT || 0)), p.gRef, ampRef),
      length: part(p.L0 + (p.dL || 0), p.gRef, ampRef),
      gravity: part(p.L0, p.g, ampRef),
      amplitude: part(p.L0, p.gRef, amp),
    };
  }
  // Longueur qui donne une période T0 à l'amplitude amp (pour régler l'horloge) : T ∝ √L
  const lengthForPeriod = (T0, g, amp) => { const T1 = periodExact(1, g, amp); return (T0 / T1) ** 2; };
  // Rouages : roue d'échappement de 30 dents (1 tour/min) jusqu'aux aiguilles
  const TRAIN = { escapeTeeth: 30, toMinute: [[8, 64], [8, 60]], toHour: [[10, 40], [8, 24]] };
  const trainRatio = (pairs) => pairs.reduce((r, [a, b]) => (r * b) / a, 1);

  // ---------- Autres intégrateurs (comparaison des méthodes) ----------
  // Euler explicite (ordre 1)
  function euler(deriv, y, t, h, p) { const k = deriv(t, y, p); return y.map((v, i) => v + h * k[i]); }
  // Heun, ou Euler amélioré (ordre 2)
  function heun(deriv, y, t, h, p) {
    const k1 = deriv(t, y, p), ye = y.map((v, i) => v + h * k1[i]), k2 = deriv(t + h, ye, p);
    return y.map((v, i) => v + (h / 2) * (k1[i] + k2[i]));
  }
  // Euler-Cromer, ou Euler semi-implicite (ordre 1, symplectique) : vitesse d'abord, puis position
  function cromer(deriv, y, t, h, p) {
    const w = y[1] + h * deriv(t, y, p)[1];
    return [y[0] + h * w, w];
  }
  // Verlet vitesse (ordre 2, symplectique)
  function verlet(deriv, y, t, h, p) {
    const a0 = deriv(t, y, p)[1];
    const th = y[0] + h * y[1] + 0.5 * h * h * a0;
    const wHalf = y[1] + 0.5 * h * a0;
    const a1 = deriv(t + h, [th, wHalf], p)[1];
    return [th, y[1] + 0.5 * h * (a0 + a1)];
  }
  const METHODS = {
    euler: { step: euler, order: 1 }, cromer: { step: cromer, order: 1 }, heun: { step: heun, order: 2 },
    verlet: { step: verlet, order: 2 }, rk4: { step: rk4, order: 4 },
  };
  function integrate(method, deriv, y0, p, h, tEnd) {
    const st = METHODS[method].step;
    let y = y0.slice(), t = 0;
    const n = Math.round(tEnd / h);
    for (let i = 0; i < n; i++) { y = st(deriv, y, t, h, p); t += h; }
    return y;
  }

  // ---------- Pivot de Gauss (pivot partiel) ----------
  function gaussSolve(A, b) {
    const n = A.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-300) throw new Error('matrice singulière');
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }
  // Moindres carrés : y ≈ Σ cj·φj(x), équations normales (ΦᵀΦ)c = Φᵀy résolues par le pivot de Gauss
  function leastSquares(xs, ys, basis) {
    const m = basis.length, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
    xs.forEach((x, i) => {
      const phi = basis.map((f) => f(x));
      for (let j = 0; j < m; j++) { b[j] += phi[j] * ys[i]; for (let k = 0; k < m; k++) A[j][k] += phi[j] * phi[k]; }
    });
    return gaussSolve(A, b);
  }
  // Pente d'une droite par moindres carrés (pour l'ordre de convergence en log-log)
  const slope = (xs, ys) => leastSquares(xs, ys, [() => 1, (x) => x])[1];

  // ---------- Intégration numérique ----------
  function quad(rule, f, a, b, n) {
    const h = (b - a) / n;
    let s = 0;
    if (rule === 'rect') { for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h); return s * h; }
    if (rule === 'trap') { s = (f(a) + f(b)) / 2; for (let i = 1; i < n; i++) s += f(a + i * h); return s * h; }
    if (rule === 'simpson') {
      if (n % 2) n++;
      const hs = (b - a) / n;
      s = f(a) + f(b);
      for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * hs);
      return (s * hs) / 3;
    }
    throw new Error('méthode inconnue');
  }
  // Période exacte écrite comme une intégrale : T = 4·√(L/g)·∫₀^{π/2} dφ / √(1 − k²·sin²φ), k = sin(θ0/2)
  function periodByQuadrature(L, g, theta0, rule, n) {
    const k = Math.sin(theta0 / 2);
    return 4 * Math.sqrt(L / g) * quad(rule, (ph) => 1 / Math.sqrt(1 - k * k * Math.sin(ph) ** 2), 0, Math.PI / 2, n);
  }

  return {
    euler, heun, cromer, verlet, METHODS, integrate, gaussSolve, leastSquares, slope, quad, periodByQuadrature,
    G0, DEG, rk4, ellipK,
    simpleDeriv, linearDeriv, simpleEnergy, periodSmall, periodExact, periodBorda, measurePeriod,
    resonanceAmp, resonancePeak, qualityFactor,
    doubleDeriv, doublePositions, doubleEnergy, doubleModes,
    coupledDeriv, coupledModes, coupledEnergy,
    secondsPendulumLength, gravityAtLatitude, MATERIALS, clockRate, lengthForPeriod, TRAIN, trainRatio,
  };
});
