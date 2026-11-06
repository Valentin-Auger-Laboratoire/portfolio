/* Ski et snowboard : physique de la glisse et prévention des blessures (projet personnel, 2026).
   Tout est calculé à partir de modèles physiques simples et vérifié par tests/test.js.
   Valeurs physiologiques (seuils de lésion) : ordres de grandeur de la littérature, ILLUSTRATIFS.
   Ce n'est ni un outil médical, ni un outil de réglage de fixations (réservé à un technicien certifié, norme ISO 11088).
   Utilisable dans le navigateur (window.Hiver) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Hiver = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const g = 9.81, DEG = Math.PI / 180;
  // ---------------------------------------------------------------- outils
  const rhoAir = (alt) => 1.225 * Math.exp(-alt / 8500); // atmosphère isotherme simplifiée (hauteur d'échelle 8,5 km)
  function erf(x) { // Abramowitz & Stegun 7.1.26 (erreur < 1,5e-7)
    const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return s * y;
  }
  const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

  // ---------------------------------------------------------------- 1. glisse : descente rectiligne
  // m dv/dt = m g (sin α − μ cos α) − ½ ρ CdA v²
  const driveAcc = (alpha, mu) => g * (Math.sin(alpha) - mu * Math.cos(alpha));
  function terminalSpeed(m, alpha, mu, CdA, rho) { const a = driveAcc(alpha, mu); return a <= 0 ? 0 : Math.sqrt((2 * m * a) / (rho * CdA)); }
  // solution exacte depuis l'arrêt : v = vt tanh(a t / vt), s = vt²/a ln cosh(a t / vt)
  function straightExact(m, alpha, mu, CdA, rho, t) { const a = driveAcc(alpha, mu), vt = terminalSpeed(m, alpha, mu, CdA, rho); return { v: vt * Math.tanh((a * t) / vt), s: ((vt * vt) / a) * Math.log(Math.cosh((a * t) / vt)) }; }
  // piste : suite de tronçons { L (m, le long de la pente), deg } ; intégration RK4 en temps ; arrêt si la vitesse s'annule
  function runPiste(o) {
    const opt = Object.assign({ m: 75, mu: 0.06, CdA: 0.45, alt: 2000, v0: 1, dt: 0.02, segs: [] }, o || {}), rho = rhoAir(opt.alt), k = (0.5 * rho * opt.CdA) / opt.m;
    const Ltot = opt.segs.reduce((s, q) => s + q.L, 0), alphaAt = (s) => { let acc = 0; for (const q of opt.segs) { acc += q.L; if (s <= acc) return q.deg * DEG; } return opt.segs[opt.segs.length - 1].deg * DEG; };
    const f = (s, v) => driveAcc(alphaAt(s), opt.mu) * (v > 0 || driveAcc(alphaAt(s), opt.mu) > 0 ? 1 : 0) - k * v * Math.abs(v);
    let t = 0, s = 0, v = opt.v0, vmax = v; const out = { t: [0], s: [0], v: [v], z: [0] }; let z = 0;
    while (s < Ltot && t < 3600) {
      const dt = opt.dt, k1v = f(s, v), k1s = v, k2v = f(s + (dt / 2) * k1s, v + (dt / 2) * k1v), k2s = v + (dt / 2) * k1v, k3v = f(s + (dt / 2) * k2s, v + (dt / 2) * k2v), k3s = v + (dt / 2) * k2v, k4v = f(s + dt * k3s, v + dt * k3v), k4s = v + dt * k3v;
      const ds = (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s); v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v); z -= ds * Math.sin(alphaAt(s)); s += ds; t += dt;
      if (v <= 0) { v = 0; out.t.push(t); out.s.push(s); out.v.push(0); out.z.push(z); out.stopped = true; break; }
      if (s >= Ltot) { // dernier pas : on revient exactement à la fin de la piste (interpolation linéaire)
        const sp = out.s[out.s.length - 1], f2 = (Ltot - sp) / (s - sp), vp = out.v[out.v.length - 1], zp = out.z[out.z.length - 1], tp = out.t[out.t.length - 1];
        t = tp + f2 * (t - tp); v = vp + f2 * (v - vp); z = zp + f2 * (z - zp); s = Ltot;
      }
      vmax = Math.max(vmax, v); out.t.push(t); out.s.push(s); out.v.push(v); out.z.push(z);
    }
    return Object.assign(out, { T: t, vmax, Ltot, drop: -z, rho });
  }
  // énergie cinétique ramenée à une hauteur de chute équivalente : h = v² / 2g
  const equivHeight = (v) => (v * v) / (2 * g);
  // ---------------------------------------------------------------- 1. glisse : virage coupé
  // rayon de cotation (géométrie du ski) par la flèche : d = ((spatule + talon)/2 − patin)/2, R ≈ c²/(8 d) (c = longueur de carre)
  function sidecutRadius(c, tip, waist, tail) { const d = ((tip + tail) / 2 - waist) / 2; return (c * c) / (8 * d) + d / 2; }
  // virage parfaitement coupé, ski posé sur la carre avec un angle θ : R = R_sc cos θ (formule de Howe)
  const carvedRadius = (Rsc, theta) => Rsc * Math.cos(theta);
  // équilibre du virage coupé sur le plat : tan φ = v²/(g R) avec φ ≈ θ ⇒ sin θ = v²/(g R_sc) ; impossible si v² > g R_sc
  function carveAngle(v, Rsc) { const s = (v * v) / (g * Rsc); return s >= 1 ? NaN : Math.asin(s); }
  const carveMaxSpeed = (Rsc) => Math.sqrt(g * Rsc);
  const loadFactor = (v, R) => Math.sqrt(1 + ((v * v) / (g * R)) ** 2); // facteur de charge (poids apparent / poids)

  // ---------------------------------------------------------------- 2. genou : chute en torsion et fixation
  // ski + chaussure (inertie I autour de l'axe du tibia) ; la neige applique un couple Ms(t) ;
  // fixation (raideur kb) en série avec la jambe (raideur kl) ; la fixation libère quand son couple dépasse Mrel.
  function twistFall(o) {
    const p = Object.assign({ I: 0.35, kb: 1500, kl: 110, c: 3, Mrel: 70, Mpeak: 120, rise: 0.05, hold: 0.25, T: 0.6, dt: 1e-4 }, o || {});
    const ks = (p.kb * p.kl) / (p.kb + p.kl), Ms = (t) => (t < p.rise ? p.Mpeak * (t / p.rise) : t < p.rise + p.hold ? p.Mpeak : Math.max(0, p.Mpeak * (1 - (t - p.rise - p.hold) / p.rise)));
    let phi = 0, w = 0, released = false, tRel = null, peakLeg = 0; const out = { t: [], snow: [], leg: [] };
    for (let t = 0; t <= p.T; t += p.dt) {
      let Mleg = released ? 0 : Math.max(0, ks * phi + p.c * w); // couple transmis à la jambe (= couple dans la fixation)
      if (!released && Mleg >= p.Mrel) { released = true; tRel = t; peakLeg = Math.max(peakLeg, p.Mrel); Mleg = 0; } // la fixation ne transmet jamais plus que son seuil
      const acc = (Ms(t) - Mleg) / p.I; w += acc * p.dt; phi += w * p.dt; // Euler semi-implicite
      peakLeg = Math.max(peakLeg, Mleg);
      if (Math.round(t / p.dt) % 20 === 0) { out.t.push(t); out.snow.push(Ms(t)); out.leg.push(released ? 0 : Math.max(0, Mleg)); }
      if (released && phi > 3) break;
    }
    return Object.assign(out, { released, tRel, peakLeg, ks, p });
  }

  // ---------------------------------------------------------------- 3. poignet : chute sur la main tendue
  // masse effective m tombant à v0 sur la main ; bras + paume (raideur ka) en série avec la neige (ks) ;
  // protège-poignet : couche absorbante à force de plateau Fp sur une course e (en série) puis rigide
  function seriesSolve(x, k1, F2, k3) { // déplacement total x réparti entre ressorts linéaires k1, k3 et un élément F2(x2) croissant : force commune
    const lin = 1 / (1 / k1 + 1 / k3); if (!F2) return lin * x;
    let lo = 0, hi = x; for (let i = 0; i < 60; i++) { const x2 = (lo + hi) / 2, F = F2(x2), xr = F / lin; if (x2 + xr > x) hi = x2; else lo = x2; }
    return F2((lo + hi) / 2);
  }
  function wristImpact(o) {
    const p = Object.assign({ m: 6, v0: 3.4, ka: 60000, ks: 2e6, damp: 0.12, prot: false, Fp: 700, e: 0.012, dt: 2e-5 }, o || {});
    const foam = p.prot ? (x) => (x < 0.001 ? (p.Fp * x) / 0.001 : x < p.e ? p.Fp : p.Fp + 4e6 * (x - p.e)) : null;
    const kEff = 1 / (1 / p.ka + 1 / p.ks), c = 2 * p.damp * Math.sqrt(kEff * p.m);
    let x = 0, v = p.v0, t = 0, peak = 0; const out = { t: [], F: [] };
    while (t < 0.2) { const Fel = seriesSolve(x, p.ka, foam, p.ks), F = Math.max(0, Fel + c * v * Math.min(1, Math.max(0, x) / 0.002)); /* amortissement progressif au contact (pas de saut de force à t = 0) */ const a = -F / p.m; v += a * p.dt; x += v * p.dt; t += p.dt; peak = Math.max(peak, F); if (Math.round(t / p.dt) % 10 === 0) { out.t.push(t); out.F.push(F); } if (x < 0 && v < 0) break; }
    return Object.assign(out, { peak, E: 0.5 * p.m * p.v0 * p.v0, p });
  }

  // ---------------------------------------------------------------- 4. tête et casque
  // tête (masse m, rayon R) ; mousse EPS d'épaisseur h : contrainte de plateau σp jusqu'à la densification εd ;
  // aire de contact d'une calotte sphérique écrasée de x : A = π (2 R x − x²) ; surface d'impact de raideur ks en série
  function helmetForce(xf, q) { const eps = xf / q.h, A = Math.PI * (2 * q.R * xf - xf * xf), s = eps < q.ed ? q.sp : q.sp * Math.exp(10 * (eps - q.ed)); return Math.max(0, A) * s; }
  function headImpact(o) {
    const p = Object.assign({ m: 5, v: 5.42, helmet: true, h: 0.025, sp: 0.55e6, ed: 0.65, R: 0.12, ks: 5e6, kHead: 6e6, dt: 1e-6 }, o || {});
    let x = 0, v = p.v, t = 0, peakA = 0, xfMax = 0; const out = { t: [], a: [] };
    const force = (xx) => { if (xx <= 0) return 0; if (!p.helmet) return (1 / (1 / p.kHead + 1 / p.ks)) * xx; let lo = 0, hi = Math.min(xx, p.h * 0.999); // mousse + surface en série
      for (let i = 0; i < 50; i++) { const xf = (lo + hi) / 2, F = helmetForce(xf, p), xr = F / p.ks + F / 4e7; if (xf + xr > xx) hi = xf; else lo = xf; } xfMax = Math.max(xfMax, lo); return helmetForce(lo, p); };
    while (t < 0.05) { const F = force(x), a = F / p.m; v -= a * p.dt; x += v * p.dt; t += p.dt; peakA = Math.max(peakA, a); if (Math.round(t / p.dt) % 20 === 0) { out.t.push(t); out.a.push(a / g); } if (v < 0 && x <= 0) break; if (v < -p.v) break; }
    const hicv = hic(out.a, out.t[1] - out.t[0], 0.015);
    return Object.assign(out, { peakG: peakA / g, HIC: hicv.HIC, hicWin: hicv, crush: xfMax, crushFrac: xfMax / p.h, pAIS3: pAIS3(hicv.HIC), p });
  }
  // HIC (critère de blessure à la tête) : max sur [t1, t2] (durée ≤ win) de (t2 − t1) · [ (1/(t2 − t1)) ∫ a dt ]^2,5 ; a en g, t en s
  function hic(aG, dt, win) {
    const n = aG.length, cum = new Float64Array(n + 1); for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + aG[i] * dt;
    const wmax = Math.max(1, Math.round(win / dt)); let best = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j <= Math.min(n, i + wmax); j++) { const T = (j - i) * dt, m = (cum[j] - cum[i]) / T; if (m <= 0) continue; const v = T * Math.pow(m, 2.5); if (v > best) { best = v; b1 = i * dt; b2 = j * dt; } }
    return { HIC: best, t1: b1, t2: b2 };
  }
  // probabilité de lésion crânienne grave (AIS ≥ 3) selon la courbe de Prasad & Mertz (reprise par la NHTSA)
  const pAIS3 = (H) => (H <= 0 ? 0 : normCdf((Math.log(H) - 7.45231) / 0.73998));

  // ---------------------------------------------------------------- 5. avalanche : détecteur de victimes (DVA)
  // la balise émet un champ magnétique de dipôle (457 kHz) : B = k (3 (m·r̂) r̂ − m) / r³ ; on travaille dans le plan horizontal
  function dipole(x, y, xv, yv, ang, depth) {
    const rx = x - xv, ry = y - yv, rz = depth || 0, r = Math.hypot(rx, ry, rz), mx = Math.cos(ang), my = Math.sin(ang), md = (mx * rx + my * ry) / r;
    const r3 = r * r * r; return [(3 * md * (rx / r) - mx) / r3, (3 * md * (ry / r) - my) / r3, (3 * md * (rz / r)) / r3, r];
  }
  // recherche « en suivant les lignes de champ » : à chaque pas, on avance dans la direction du champ horizontal, avec le sens qui fait monter le signal
  function fluxSearch(o) {
    const p = Object.assign({ x0: 0, y0: 0, xv: 30, yv: 20, ang: 0.6, depth: 1, step: 0.5, stop: 2, maxSteps: 4000 }, o || {});
    let x = p.x0, y = p.y0; const path = [[x, y]]; let L = 0, prevDir = null;
    for (let k = 0; k < p.maxSteps; k++) {
      const B = dipole(x, y, p.xv, p.yv, p.ang, p.depth), bh = Math.hypot(B[0], B[1]); if (Math.hypot(x - p.xv, y - p.yv) < p.stop) break;
      let d = [B[0] / bh, B[1] / bh]; const mag = (xx, yy) => { const q = dipole(xx, yy, p.xv, p.yv, p.ang, p.depth); return Math.hypot(q[0], q[1], q[2]); };
      if (prevDir) { if (d[0] * prevDir[0] + d[1] * prevDir[1] < 0) d = [-d[0], -d[1]]; } else if (mag(x + d[0] * p.step, y + d[1] * p.step) < mag(x - d[0] * p.step, y - d[1] * p.step)) d = [-d[0], -d[1]];
      x += d[0] * p.step; y += d[1] * p.step; L += p.step; path.push([x, y]); prevDir = d;
    }
    return { path, L, straight: Math.hypot(p.xv - p.x0, p.yv - p.y0) };
  }
  // distance affichée par un DVA qui suppose qu'on est dans l'axe du dipôle (|B| = 2/r³) : exacte dans l'axe, SURESTIMÉE ailleurs (jusqu'à ×1,26 sur le côté)
  function shownDistance(x, y, xv, yv, ang, depth) { const B = dipole(x, y, xv, yv, ang, depth); return Math.cbrt(2 / Math.hypot(B[0], B[1], B[2])); }
  // courbe de survie des victimes ensevelies (points approchés d'après Brugger et al., 2001)
  const SURV = [[0, 1], [18, 0.91], [35, 0.34], [90, 0.27], [130, 0.03], [180, 0.01]];
  function survival(tmin) { if (tmin <= 0) return 1; for (let i = 1; i < SURV.length; i++) if (tmin <= SURV[i][0]) { const [t0, p0] = SURV[i - 1], [t1, p1] = SURV[i]; return p0 + ((p1 - p0) * (tmin - t0)) / (t1 - t0); } return SURV[SURV.length - 1][1]; }
  // durée totale d'un sauvetage par un compagnon : recherche (marche lente sur l'avalanche), localisation fine, sondage, pelletage
  // pelletage : environ 12 min pour 1 m de profondeur avec un seul sauveteur, le volume croît vite avec la profondeur (ordre de grandeur) ; n sauveteurs : ÷ n^0,8
  function rescueTime(o) { const p = Object.assign({ L: 60, walk: 0.5, first: 2, fine: 1.5, probe: 1, depth: 1, n: 1 }, o || {}); const tSearch = p.L / p.walk / 60, dig = (6 * p.depth * (1 + p.depth)) / Math.pow(p.n, 0.8); return { first: p.first, tSearch, fine: p.fine, probe: p.probe, dig, total: p.first + tSearch + p.fine + p.probe + dig }; }

  // ---------------------------------------------------------------- 6. froid : refroidissement éolien
  // indice de refroidissement éolien (Environnement Canada / JAG-TI 2001) ; T en °C, V en km/h (≥ 4,8)
  function windChill(T, V) { if (V < 4.8) return T; const v = Math.pow(V, 0.16); return 13.12 + 0.6215 * T - 11.37 * v + 0.3965 * T * v; }
  // catégories de risque (Environnement Canada) : gelure possible en …
  function chillRisk(W) { if (W > -10) return 0; if (W > -28) return 1; if (W > -40) return 2; if (W > -48) return 3; if (W > -55) return 4; return 5; }

  return {
    g, DEG, rhoAir, erf, normCdf, rng,
    driveAcc, terminalSpeed, straightExact, runPiste, equivHeight, sidecutRadius, carvedRadius, carveAngle, carveMaxSpeed, loadFactor,
    twistFall, wristImpact, seriesSolve, helmetForce, headImpact, hic, pAIS3,
    dipole, fluxSearch, shownDistance, SURV, survival, rescueTime, windChill, chillRisk,
  };
});
