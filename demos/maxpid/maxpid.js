/* MaxPID : modélisation d'un axe asservi (cinématique, moteur à courant continu, boucle fermée).
   - Cinématique : fermeture géométrique OA + AC + CB + BO = 0 et système vis-écrou (docs/valeurs.md du dépôt).
   - Moteur : valeurs de la fiche (2024) ; l'inertie J et le frottement f sont SUPPOSÉS / calés (comme dans le dépôt).
   - Boucle fermée sur l'angle du bras : AJOUT de 2026 (il n'y avait pas de correcteur dans le travail de 2024).
   Utilisable dans le navigateur (window.MaxPID) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.MaxPID = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

  // ------------------------------------------------------------------ cinématique (mm, rad, tours)
  const GEO = { a: 69.5, b: 82, c: 80, p: 4 };
  const S2 = GEO.a ** 2 + GEO.b ** 2 + GEO.c ** 2; // 17 954,25 mm²
  // points du schéma : O origine, A = (a, 0), B = (0, b), C = A + c(cos θ, sin θ)
  const points = (th) => ({ O: [0, 0], A: [GEO.a, 0], B: [0, GEO.b], C: [GEO.a + GEO.c * Math.cos(th), GEO.c * Math.sin(th)] });
  const xOf = (th, s2) => Math.sqrt((s2 || S2) + 2 * GEO.c * (GEO.a * Math.cos(th) - GEO.b * Math.sin(th)));
  const X0 = xOf(0);
  const betaOf = (th) => (X0 - xOf(th)) / GEO.p; // tours, β = 0 pour θ = 0
  const betaRounded = (th) => 0.25 * (170 - Math.sqrt(18000 + 160 * (69.5 * Math.cos(th) - 82 * Math.sin(th)))); // formule arrondie du sujet
  const dxdth = (th) => (GEO.c * (-GEO.a * Math.sin(th) - GEO.b * Math.cos(th))) / xOf(th); // mm/rad
  const dbetadth = (th) => -dxdth(th) / GEO.p; // tours/rad
  // inverse : θ(β) par Newton (départ donné ou dichotomie)
  function thetaOf(beta, law, guess) {
    const f = law || betaOf;
    let lo = -0.5, hi = 2.6;
    for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (f(m) < beta) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function linfit(xs, ys) {
    const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const b = sxy / sxx; return { slope: b, icpt: my - b * mx };
  }
  // tableau θ(β) pour β = 0 … 26 tours (loi exacte et formule arrondie)
  function table() {
    const betas = [...Array(27).keys()];
    const exact = betas.map((b) => deg(thetaOf(b))), rounded = betas.map((b) => deg(thetaOf(b, betaRounded)));
    const fit = linfit(betas, rounded);
    const maxDev = Math.max(...betas.map((b, i) => Math.abs(rounded[i] - (fit.slope * b + fit.icpt))));
    return { betas, exact, rounded, fit, maxDev, excel: { slope: 3.4121, icpt: 3.9088 } };
  }

  // ------------------------------------------------------------------ moteur (fiche) et modèle 2024
  const MOTOR = { U: 12, R: 9.5, L: 0.82e-3, Ke: 60 / (2 * Math.PI * 953), Kt: 0.00962, I0: 0.02, J: 1.0e-6, nLoad: 8700 };
  MOTOR.Winf = (MOTOR.U - MOTOR.R * MOTOR.I0) / MOTOR.Ke;
  MOTOR.f = (MOTOR.Kt * MOTOR.I0) / MOTOR.Winf;
  const tauM = (m) => (m.J * m.R) / (m.Ke * m.Kt + m.f * m.R);
  // ce que montrait le Simscape de 2024 (lu sur les captures) : ~0,63 A sous 12 V, vitesse en rampe ≈ 0,83 rad/s²
  const SIMSCAPE_2024 = { R: 12 / 0.63, J: (MOTOR.Kt * 0.63) / 0.83, L: MOTOR.L };

  // démarrage sous tension constante : intégration du courant exacte sur le pas (τe = L/R très petit)
  function motorStep(o) {
    const m = Object.assign({}, MOTOR, o || {});
    const T = m.T || 0.5, dt = m.dt || 2e-5, every = Math.max(1, Math.round((m.sample || 1e-3) / dt));
    let i = 0, w = 0; const out = { t: [], i: [], w: [], U: m.U };
    const te = m.L / m.R;
    for (let k = 0, t = 0; t <= T; k++, t = k * dt) {
      if (k % every === 0) { out.t.push(t); out.i.push(i); out.w.push(w); }
      const iInf = (m.U - m.Ke * w) / m.R; i = iInf + (i - iInf) * Math.exp(-dt / te);
      w += ((m.Kt * i - m.f * w - (m.Cr || 0)) / m.J) * dt;
    }
    out.iMax = Math.max(...out.i); out.wEnd = out.w[out.w.length - 1];
    const w63 = 0.632 * out.wEnd, k63 = out.w.findIndex((v) => v >= w63); out.t63 = k63 >= 0 ? out.t[k63] : null;
    out.tau = tauM(m);
    return out;
  }

  // ------------------------------------------------------------------ axe complet et boucle fermée (AJOUT 2026)
  // moteur entraînant directement la vis (1 tour moteur = 1 tour de vis) ; bras de masse m (kg) au rayon Lc (m) ;
  // rendement vis-écrou η ; mesure de θ par potentiomètre (10 bits sur 0–100°) ; tension saturée à ±12 V.
  const ARM = { m: 0.1, Lc: 0.15, Jarm: 2e-4, eta: 0.5, g: 9.81 }; // valeurs SUPPOSÉES (bras et masse non donnés dans le travail de 2024)
  // courant nécessaire pour tenir le bras immobile à l'angle θ (A), à comparer au courant de démarrage U/R
  function holdCurrent(thDeg, arm) {
    const A = Object.assign({}, ARM, arm || {}), th = rad(thDeg), r = 1 / (2 * Math.PI * dbetadth(th));
    return (A.m * A.g * A.Lc * Math.cos(th) * r) / A.eta / MOTOR.Kt;
  }
  function axisSim(o) {
    const m = Object.assign({}, MOTOR, o.motor || {}), A = Object.assign({}, ARM, o.arm || {});
    const T = o.T || 2, dt = o.dt || 5e-5, every = Math.max(1, Math.round((o.sample || 2e-3) / dt));
    const Ts = o.Ts || 1e-3; // période du correcteur
    const ctl = Object.assign({ mode: 'P', Kp: 1.0, Ki: 0, Umax: 12 }, o.ctl || {}); // Kp en V/°
    let th = rad(o.th0 === undefined ? 20 : o.th0), w = 0, i = 0, u = 0, integ = 0, nextCtl = 0;
    const out = { t: [], th: [], ref: [], u: [], i: [], w: [] };
    const q = 100 / 1024; // pas du potentiomètre (°)
    const te = m.L / m.R;
    for (let k = 0, t = 0; t <= T; k++, t = k * dt) {
      const ref = typeof o.ref === 'function' ? o.ref(t) : o.ref;
      if (t >= nextCtl - 1e-12) {
        nextCtl += Ts;
        const meas = Math.round(deg(th) / q) * q, e = ref - meas;
        if (ctl.mode === 'open') u = ctl.Uopen || 0;
        else {
          let v = ctl.Kp * e + (ctl.mode === 'PI' ? ctl.Ki * integ : 0);
          const sat = Math.max(-ctl.Umax, Math.min(ctl.Umax, v));
          // anti-emballement : on n'intègre que si la commande n'est pas saturée dans le même sens
          if (ctl.mode === 'PI' && (sat === v || Math.sign(e) !== Math.sign(v))) integ += e * Ts;
          u = sat;
        }
      }
      // réduction : dθ/dβ (rad de bras par rad moteur)
      const r = 1 / (2 * Math.PI * dbetadth(th));
      const tauG = A.m * A.g * A.Lc * Math.cos(th); // couple de pesanteur sur le bras (N·m)
      const Jeq = m.J + (A.Jarm + A.m * A.Lc * A.Lc) * r * r;
      const load = (tauG * r) / A.eta;
      const iInf = (u - m.Ke * w) / m.R; i = iInf + (i - iInf) * Math.exp(-dt / te);
      let acc = (m.Kt * i - m.f * w - load) / Jeq;
      w += acc * dt; th += w * r * dt;
      // butées mécaniques du bras
      if (th < rad(0)) { th = rad(0); if (w < 0) w = 0; }
      if (th > rad(92)) { th = rad(92); if (w > 0) w = 0; }
      if (k % every === 0) { out.t.push(t); out.th.push(deg(th)); out.ref.push(ref); out.u.push(u); out.i.push(i); out.w.push(w); }
    }
    return out;
  }
  // indicateurs d'une réponse indicielle
  function stepInfo(out, ref, th0) {
    const n = out.t.length, d = ref - th0, last = out.th[n - 1];
    const peak = d >= 0 ? Math.max(...out.th) : Math.min(...out.th);
    const over = Math.max(0, ((peak - ref) / d) * 100);
    let ts = null; for (let k = n - 1; k >= 0; k--) if (Math.abs(out.th[k] - last) > 0.05 * Math.abs(d)) { ts = out.t[Math.min(n - 1, k + 1)]; break; }
    const k90 = out.th.findIndex((v) => (d >= 0 ? v >= th0 + 0.9 * d : v <= th0 + 0.9 * d));
    return { final: last, err: ref - last, overshoot: over, t5: ts === null ? 0 : ts, t90: k90 >= 0 ? out.t[k90] : null, iMax: Math.max(...out.i.map(Math.abs)) };
  }

  return { GEO, S2, X0, points, xOf, betaOf, betaRounded, dbetadth, thetaOf, linfit, table, MOTOR, SIMSCAPE_2024, tauM, motorStep, ARM, holdCurrent, axisSim, stepInfo, rad, deg };
});
