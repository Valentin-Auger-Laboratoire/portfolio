/* Circuit RLC série : moteur de la démo (TP de physique, CPGE TSI, mars 2024).
   Montage : générateur (résistance interne Rg = 50 Ω) → R → bobine L (résistance r) → condensateur C ; voie 1 = sortie du générateur,
   voie 2 = tension u_C aux bornes du condensateur. Valeurs du TP : L = 0,1 H, C = 100 nF (f₀ ≈ 1 592 Hz), R = 100 Ω ou 10 kΩ.
   - régime sinusoïdal forcé : formules exactes (amplitude complexe) ;
   - signal carré et régime libre : équation différentielle résolue par Runge-Kutta d'ordre 4, comparée aux solutions exactes dans les tests.
   Utilisable dans le navigateur (window.RLC) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.RLC = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TP = { R: 100, Rg: 50, r: 0, L: 0.1, C: 100e-9 }; // valeurs du montage du TP
  // grandeurs caractéristiques
  function derived(p) {
    const Rt = p.R + p.Rg + (p.r || 0), w0 = 1 / Math.sqrt(p.L * p.C), Q = Math.sqrt(p.L / p.C) / Rt;
    return { Rt, w0, f0: w0 / (2 * Math.PI), Q, alpha: Rt / (2 * p.L), tau: (2 * p.L) / Rt };
  }
  // régime sinusoïdal forcé, e(t) = E·cos(ωt) (force électromotrice du générateur)
  // u_C = E / (1 − x² + j·x/Q) ; i = jCω·u_C ; sortie du générateur = e − Rg·i
  function sine(p, f, E) {
    const d = derived(p), x = (2 * Math.PI * f) / d.w0, dr = 1 - x * x, di = x / d.Q, den = dr * dr + di * di;
    const ucr = (E * dr) / den, uci = (-E * di) / den; // E/(dr + j·di)
    const w = 2 * Math.PI * f, ir = -w * p.C * uci, ii = w * p.C * ucr; // i = jωC·u_C
    const outr = E - p.Rg * ir, outi = -p.Rg * ii;
    return { x, Uc: Math.hypot(ucr, uci), phiC: Math.atan2(uci, ucr), I: Math.hypot(ir, ii), phiI: Math.atan2(ii, ir), Uout: Math.hypot(outr, outi), phiOut: Math.atan2(outi, outr) };
  }
  // formules réduites (en fonction de x = ω/ω₀ et Q)
  const gainC = (x, Q) => 1 / Math.sqrt((1 - x * x) ** 2 + (x / Q) ** 2); // U_Cm / E_m
  const gainI = (x, Q) => 1 / Math.sqrt(1 + Q * Q * (x - 1 / x) ** 2); // I_m / (E_m / R_t)
  const phaseC = (x, Q) => -Math.atan2(x / Q, 1 - x * x); // de 0 à −π
  // résonance en tension : existe seulement si Q > 1/√2, en x_r = √(1 − 1/(2Q²)), pic Q/√(1 − 1/(4Q²))
  const voltRes = (Q) => (Q > Math.SQRT1_2 ? { x: Math.sqrt(1 - 1 / (2 * Q * Q)), peak: Q / Math.sqrt(1 - 1 / (4 * Q * Q)) } : null);
  // bande passante en intensité (I ≥ I_max/√2) : x± = √(1 + 1/(4Q²)) ± 1/(2Q), donc Δω = ω₀/Q
  const band = (Q) => { const a = Math.sqrt(1 + 1 / (4 * Q * Q)), b = 1 / (2 * Q); return { lo: a - b, hi: a + b, width: 2 * b }; };

  // équation du circuit : L·di/dt = e(t) − R_t·i − u_C ; C·du_C/dt = i
  function simulate(p, e, t1, dt, y0, every) {
    const d = derived(p), L = p.L, C = p.C, n = Math.ceil(t1 / dt), h = t1 / n, k = every || 1;
    let uc = y0 ? y0[0] : 0, i = y0 ? y0[1] : 0;
    const f = (t, u, j) => [j / C, (e(t) - d.Rt * j - u) / L];
    const T = [0], U = [uc], Iv = [i];
    for (let s = 0; s < n; s++) {
      const t = s * h;
      const k1 = f(t, uc, i), k2 = f(t + h / 2, uc + (h / 2) * k1[0], i + (h / 2) * k1[1]), k3 = f(t + h / 2, uc + (h / 2) * k2[0], i + (h / 2) * k2[1]), k4 = f(t + h, uc + h * k3[0], i + h * k3[1]);
      uc += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); i += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      if ((s + 1) % k === 0) { T.push((s + 1) * h); U.push(uc); Iv.push(i); }
    }
    return { t: T, uc: U, i: Iv };
  }
  // solution exacte du régime libre (e = 0), u_C(0) = U0, i(0) = 0 : décharge du condensateur
  function free(p, U0, t) {
    const d = derived(p), a = d.alpha, w0 = d.w0;
    if (a < w0 * (1 - 1e-12)) { const wd = Math.sqrt(w0 * w0 - a * a); return U0 * Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t)); }
    if (a > w0 * (1 + 1e-12)) { const s = Math.sqrt(a * a - w0 * w0), r1 = -a + s, r2 = -a - s; return (U0 * (r1 * Math.exp(r2 * t) - r2 * Math.exp(r1 * t))) / (r1 - r2); }
    return U0 * (1 + a * t) * Math.exp(-a * t);
  }
  // réponse à un échelon E (condensateur déchargé au départ) = E − libre(U0 = E)
  const step = (p, E, t) => E - free(p, E, t);
  // signal carré ±E de fréquence f : régime périodique établi (on simule jusqu'à ce que deux périodes se superposent)
  function square(p, f, E, nPer) {
    const d = derived(p), T = 1 / f, dt = Math.min(T / 4000, 1 / (d.f0 * 400)), e = (t) => ((t % T) < T / 2 ? E : -E);
    let y = [0, 0], warm = 0;
    // préchauffage : plusieurs constantes de temps
    const tw = Math.max(0, Math.ceil((8 * d.tau) / T)) * T;
    if (tw > 0) { const s = simulate(p, e, tw, dt, y, Math.ceil(tw / dt)); y = [s.uc[s.uc.length - 1], s.i[s.i.length - 1]]; warm = tw; }
    const n = nPer || 2, out = simulate(p, (t) => e(t + warm), n * T, dt, y, Math.max(1, Math.round(n * T / dt / 3000)));
    return { t: out.t, uc: out.uc, i: out.i, e: out.t.map((t) => e(t + warm)), dt };
  }

  return { TP, derived, sine, gainC, gainI, phaseC, voltRes, band, simulate, free, step, square };
});
