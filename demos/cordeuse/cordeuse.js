/* Cordeuse de raquette asservie en effort : moteur de la démo (TP de sciences de l'ingénieur, CPGE TSI, septembre 2024).
   Chaîne d'énergie : moteur à courant continu → vis sans fin → roue de 29 dents → pignon de 15 dents → grande roue (≈ 60 dents,
   la roue que j'ai modifiée) → pignon de chaîne → chaîne → poussoir → ressort calibré → chariot → mors → corde.
   Chaîne d'information : potentiomètre linéaire sur l'écrasement λ du ressort → tension mesurée T = Kr·λ → carte (correcteur P) → hacheur → moteur.
   Hypothèses (valeurs NON mesurées, réglables) : moteur 12 V, R = 0,8 Ω, k = 0,03 V·s/rad ; vis Ø 10 mm, module 0,8 ; frottement 0,1 ;
   pignon de chaîne Ø 30 mm ; courant nominal 4 A ; ressort 10 N/mm ; corde 2 N/mm ; potentiomètre 30 mm, 10 bits ; chariot sans masse (quasi-statique).
   Utilisable dans le navigateur (window.Cordeuse) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Cordeuse = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEFAULTS = {
    starts: 1, zWorm: 29, zPinion: 15, zBig: 60, // vis (nombre de filets), roue de vis, pignon, grande roue
    module: 0.8, dWorm: 10, mu: 0.1, etaGear: 0.95, // mm, mm, frottement vis/roue, rendement de l'engrenage droit
    U: 12, R: 0.8, k: 0.03, Jm: 6e-5, In: 4, // moteur : V, Ω, V·s/rad (= N·m/A), kg·m², courant nominal (A)
    rChain: 0.015, Kr: 10, kc: 2, // m, N/mm, N/mm
    Kp: 0.5, Tset: 250, potStroke: 30, potBits: 10, // V/N, N, mm, bits
  };
  const DEG = Math.PI / 180;
  // vis sans fin : angle d'hélice γ, angle de frottement φ, rendement direct et inverse, irréversibilité (γ < φ)
  function worm(p) {
    const pa = Math.PI * p.module * p.starts; // pas de l'hélice (mm)
    const g = Math.atan(pa / (Math.PI * p.dWorm)), phi = Math.atan(p.mu);
    const etaD = Math.tan(g) / Math.tan(g + phi); // vis motrice
    const etaR = g > phi ? Math.tan(g - phi) / Math.tan(g) : 0; // roue motrice (0 : irréversible)
    return { gamma: g / DEG, phi: phi / DEG, etaD, etaR, selfLocking: g <= phi };
  }
  // rapport de réduction N = ω_moteur / ω_grande roue
  const ratio = (p) => (p.zWorm / p.starts) * (p.zBig / p.zPinion);
  function derived(p) {
    const w = worm(p), N = ratio(p), eta = w.etaD * p.etaGear, etaBack = w.etaR * p.etaGear;
    const Cstall = (p.k * p.U) / p.R; // couple de démarrage du moteur
    const Fmax = (Cstall * N * eta) / p.rChain; // effort maximal sur la chaîne (moteur calé, quelques secondes au plus)
    const Fnom = (p.k * p.In * N * eta) / p.rChain; // effort tenu au courant nominal (sans surchauffer le moteur)
    const w0 = p.U / p.k; // vitesse à vide du moteur (rad/s)
    const vChain = ((w0 / N) * p.rChain) * 1000; // vitesse de chaîne à vide (mm/s)
    const kEff = 1 / (1 / p.kc + 1 / p.Kr); // raideur vue par la chaîne (N/mm) : corde et ressort en série
    const res = (p.Kr * p.potStroke) / 2 ** p.potBits; // résolution de la mesure de tension (N)
    const Tsensor = p.Kr * p.potStroke; // tension maximale mesurable (potentiomètre en butée)
    return { N, eta, etaBack, w, Cstall, Fmax, Fnom, w0, vChain, kEff, res, Tsensor };
  }
  // état : mu (mm, avance de la chaîne), om (rad/s, moteur)
  // tension : T = kEff·μ (μ ≥ 0) ; écrasement du ressort λ = T/Kr ; allongement de la corde = T/kc
  function simulate(p0, scen) {
    const p = Object.assign({}, DEFAULTS, p0), d = derived(p), s = Object.assign({ t1: 8, dt: 1e-4, cut: null, release: null, every: 50 }, scen || {});
    let mu = 0, om = 0, t = 0, back = false;
    const out = { t: [], T: [], Tmes: [], U: [], mu: [], i: [], om: [], lambda: [] };
    const q = (T) => Math.round(T / d.res) * d.res; // mesure quantifiée (CAN)
    let k = 0;
    while (t <= s.t1 + 1e-12) {
      const T = Math.max(0, d.kEff * mu), lam = Math.min(T / p.Kr, p.potStroke), Tm = q(p.Kr * lam);
      let U;
      if (s.cut !== null && t >= s.cut) U = null; // coupure : moteur débranché (courant nul)
      else if (s.release !== null && t >= s.release) { back = true; U = mu > 0.05 ? -p.U : 0; } // retour du chariot
      else U = Math.max(-p.U, Math.min(p.U, p.Kp * (p.Tset - Tm)));
      const Cload = (T * p.rChain) / d.N; // couple de la charge ramené au moteur, sans pertes (N·m)
      let i = 0, Cm = 0;
      if (U !== null) { i = (U - p.k * om) / p.R; Cm = p.k * i; }
      // frottement de la vis : en traction (ω > 0) le moteur fournit Cload/η ; en retour (ω < 0) la charge fournit Cload·η_retour
      const fwd = Cload / d.eta, rev = Cload * d.etaBack;
      let acc;
      if (om > 1e-9) acc = (Cm - fwd) / p.Jm;
      else if (om < -1e-9) acc = (Cm - rev) / p.Jm;
      else if (Cm > fwd) acc = (Cm - fwd) / p.Jm;
      else if (Cm < rev) acc = (Cm - rev) / p.Jm;
      else acc = 0; // adhérence : la vis tient la charge
      let omN = om + acc * s.dt;
      if ((om > 0 && omN < 0) || (om < 0 && omN > 0)) omN = 0; // passage par zéro : on s'arrête (adhérence possible)
      om = omN;
      mu += ((om / d.N) * p.rChain * 1000) * s.dt;
      if (mu < 0) { mu = 0; if (om < 0) om = 0; }
      if (k++ % s.every === 0) { out.t.push(t); out.T.push(T); out.Tmes.push(Tm); out.U.push(U === null ? 0 : U); out.mu.push(mu); out.i.push(i); out.om.push(om); out.lambda.push(lam); }
      t += s.dt;
    }
    // indicateurs : temps pour atteindre 95 % de la consigne, valeur finale, erreur statique
    const iEnd = s.release !== null ? out.t.findIndex((x) => x >= s.release) - 1 : s.cut !== null ? out.t.findIndex((x) => x >= s.cut) - 1 : out.t.length - 1;
    const t95 = out.t[out.T.findIndex((T) => T >= 0.95 * p.Tset)];
    const Tend = out.T[iEnd > 0 ? iEnd : out.t.length - 1];
    return Object.assign(out, { d, p, t95: t95 === undefined ? null : t95, Tend, err: p.Tset - Tend, Tfinal: out.T[out.T.length - 1] });
  }
  // erreur statique théorique du correcteur P avec une vis qui adhère : le moteur s'arrête dès que k·U/R ≤ Cload/η
  // k·Kp·e/R = T·r/(N·η) avec T = Tset − e  →  e = Tset·a/(1 + a), a = r·R/(N·η·k·Kp)
  function staticError(p0) { const p = Object.assign({}, DEFAULTS, p0), d = derived(p), a = (p.rChain * p.R) / (d.N * d.eta * p.k * p.Kp); return (p.Tset * a) / (1 + a); }

  return { DEFAULTS, worm, ratio, derived, simulate, staticError };
});
