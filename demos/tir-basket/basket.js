/* Trajectoire d'un tir de basket à 3 points : trois modèles de frottement et les points mesurés.
   Valeurs : docs/valeurs.md du dépôt trajectoire-tir-basket (ballon taille 7, air à 20 °C, terrain FIBA).
   - « sans » : poids seul ;
   - « 2024 » : modèle d'origine, force −k·|v|·v avec k = 6πηr = 4,37·10⁻⁵ kg/s (coefficient de Stokes) ;
   - « quadratique » : −½ρCₓS·|v|·v, la traînée réelle à Re ≈ 10⁵.
   Les points mesurés sont la hauteur relative y(t) ; l'échelle verticale a été calée sur g (voir data/LISEZMOI.md).
   Utilisable dans le navigateur (window.Basket) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Basket = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = { m: 0.624, r: 0.124, rho: 1.2, eta: 1.8e-5, g: 9.81, h0: 1.8, hoopH: 3.05, hoopX: 6.75, hoopD: 0.45 };
  C.S = Math.PI * C.r * C.r;
  C.kStokes = 4.37e-5; // valeur du code de 2024 (6πηr ; 6π·1,8·10⁻⁵·0,124 donne 4,2·10⁻⁵)
  const POINTS = [[0.0000, 0.000], [0.0333, 0.000], [0.0667, 0.000], [0.1000, 0.000], [0.1333, 0.000], [0.1667, 0.000], [0.2000, 0.000], [0.2333, 0.000], [0.2667, 0.049], [0.3000, 0.049], [0.3333, 0.049], [0.3667, 0.049], [0.4000, 0.049], [0.4333, 0.049], [0.4667, 0.049], [0.5000, 0.049], [0.5333, 0.007], [0.5667, 0.000], [0.6000, 0.000], [0.6333, -0.005], [0.6667, -0.024], [0.7000, 0.042], [0.7333, 0.037], [0.7667, 0.137], [0.8000, 0.186], [0.8333, 0.305], [0.8667, 0.450], [0.9000, 0.639], [0.9333, 0.777], [0.9667, 0.936], [1.0000, 1.087], [1.0333, 1.258], [1.0667, 1.462], [1.1000, 1.712], [1.1333, 1.910], [1.1667, 2.089], [1.2000, 2.262], [1.2333, 2.489], [1.2667, 2.621], [1.3000, 2.753], [1.3333, 2.931], [1.3667, 3.027], [1.4000, 3.134], [1.4333, 3.242], [1.4667, 3.322], [1.5000, 3.408], [1.5333, 3.461], [1.5667, 3.518], [1.6000, 3.523], [1.6333, 3.606], [1.6667, 3.628], [1.7000, 3.615], [1.7333, 3.603], [1.7667, 3.618], [1.8000, 3.615], [1.8333, 3.603], [1.8667, 3.525], [1.9000, 3.481], [1.9333, 3.415], [1.9667, 3.310], [2.0000, 3.286], [2.0333, 3.154], [2.0667, 3.022], [2.1000, 2.892], [2.1333, 2.768], [2.1667, 2.675], [2.2000, 2.487], [2.2333, 2.348], [2.2667, 2.198], [2.3000, 1.940], [2.3333, 1.808], [2.3667, 1.671], [2.4000, 1.424], [2.4333, 1.163], [2.4667, 0.874], [2.5000, 0.660], [2.5333, 0.374], [2.5667, 0.112]];
  const rad = (d) => (d * Math.PI) / 180;
  // coefficient k de la force −k·|v|·v selon le modèle
  const kOf = (model, Cx) => (model === 'sans' ? 0 : model === '2024' ? C.kStokes : 0.5 * C.rho * (Cx === undefined ? 0.47 : Cx) * C.S);
  function deriv(s, k) { const v = Math.hypot(s[2], s[3]), a = (k * v) / C.m; return [s[2], s[3], -a * s[2], -C.g - a * s[3]]; }
  function rk4(s, k, h) {
    const a = deriv(s, k), b = deriv(s.map((x, i) => x + (h / 2) * a[i]), k), c = deriv(s.map((x, i) => x + (h / 2) * b[i]), k), d = deriv(s.map((x, i) => x + h * c[i]), k);
    return s.map((x, i) => x + (h / 6) * (a[i] + 2 * b[i] + 2 * c[i] + d[i]));
  }
  // trajectoire depuis (0, h0) ; arrêt au sol ou au-delà de 9 m
  function shoot(o) {
    const k = kOf(o.model, o.Cx), h = o.dt || 0.002, al = rad(o.angle);
    let s = [0, o.h0 === undefined ? C.h0 : o.h0, o.v0 * Math.cos(al), o.v0 * Math.sin(al)], t = 0;
    const pts = [[0, s[1], 0]];
    let cross = null, apex = s[1];
    for (let i = 0; i < 20000; i++) {
      const n = rk4(s, k, h); t += h;
      if (n[1] > apex) apex = n[1];
      // passage descendant à la hauteur du cercle
      if (!cross && s[3] < 0 && s[1] >= C.hoopH && n[1] < C.hoopH) { const u = (s[1] - C.hoopH) / (s[1] - n[1]); cross = { x: s[0] + u * (n[0] - s[0]), t: t - h + u * h, vx: n[2], vy: n[3] }; }
      s = n; pts.push([s[0], s[1], t]);
      if (s[1] < 0 || s[0] > 25) break;
    }
    const margin = C.hoopD / 2 - C.r; // jeu entre le ballon et le cercle (≈ 10 cm)
    let result = 'court', miss = null;
    if (cross) { miss = cross.x - C.hoopX; result = Math.abs(miss) <= margin ? 'panier' : miss < 0 ? 'court' : 'long'; }
    else if (apex < C.hoopH) result = 'basse';
    const entry = cross ? (Math.atan2(-cross.vy, cross.vx) * 180) / Math.PI : null;
    return { pts, cross, apex, result, miss, entry, margin, k };
  }
  // vitesse qui envoie le centre du ballon au centre du cercle (dichotomie)
  function requiredSpeed(angle, model, Cx, h0) {
    let lo = 4, hi = 20;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, r = shoot({ v0: m, angle, model, Cx, h0, dt: 0.004 }); if (r.cross ? r.cross.x < C.hoopX : r.apex < C.hoopH) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  // fenêtre de vitesses qui marquent à un angle donné
  function speedWindow(angle, model, Cx, h0) {
    const vc = requiredSpeed(angle, model, Cx, h0), edge = (target) => { let lo = 4, hi = 20; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2, r = shoot({ v0: m, angle, model, Cx, h0, dt: 0.004 }); if (r.cross ? r.cross.x < target : r.apex < C.hoopH) lo = m; else hi = m; } return (lo + hi) / 2; };
    const mg = C.hoopD / 2 - C.r;
    return { vc, lo: edge(C.hoopX - mg), hi: edge(C.hoopX + mg) };
  }
  // carte de réussite angle × vitesse
  function successMap(model, Cx, h0, a0 = 30, a1 = 70, v0 = 7, v1 = 12, na = 41, nv = 51) {
    const grid = [];
    for (let i = 0; i < na; i++) { const a = a0 + ((a1 - a0) * i) / (na - 1), row = []; for (let j = 0; j < nv; j++) { const v = v0 + ((v1 - v0) * j) / (nv - 1); row.push(shoot({ v0: v, angle: a, model, Cx, h0, dt: 0.005 }).result === 'panier' ? 1 : 0); } grid.push(row); }
    return { grid, a0, a1, v0, v1, na, nv };
  }
  // hauteur relative au lâcher pour comparer aux points : y(t − tr) − h0, avec vy0 = v0·sin α
  function relHeight(o, tr) {
    const r = shoot(Object.assign({}, o, { dt: 0.002 }));
    return (t) => { if (t < tr) return null; const tt = t - tr; const p = r.pts.find((q) => q[2] >= tt); return p ? p[1] - (o.h0 === undefined ? C.h0 : o.h0) : null; };
  }
  // calage : instant de lâcher et hauteur au lâcher pris sur la courbe, vy0 ajusté par moindres carrés (angle fixé)
  // calage sur les points : instant de lâcher tr (0,90 à 1,06 s) et vy₀ ajustés par moindres carrés, angle fixé ;
  // la hauteur au lâcher est prise sur la courbe mesurée
  const TR = 0.967;
  function fitPoints(o) {
    const interp = (t) => { for (let i = 1; i < POINTS.length; i++) if (POINTS[i][0] >= t) { const [t0, y0] = POINTS[i - 1], [t1, y1] = POINTS[i]; return y0 + ((y1 - y0) * (t - t0)) / (t1 - t0); } return POINTS[POINTS.length - 1][1]; };
    const err = (v0, tr) => { const yr = interp(tr), f = relHeight(Object.assign({}, o, { v0 }), tr); let s = 0, n = 0; for (const [t, y] of POINTS) { if (t < tr + 0.03) continue; const m = f(t); if (m !== null) { s += (m + yr - y) ** 2; n++; } } return n ? Math.sqrt(s / n) : 1e9; };
    let best = { rms: Infinity };
    for (let tr = 0.9; tr <= 1.0601; tr += 0.01) {
      let lo = 6, hi = 16; for (let i = 0; i < 40; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (err(a, tr) < err(b, tr)) hi = b; else lo = a; }
      const v0 = (lo + hi) / 2, r = err(v0, tr); if (r < best.rms) best = { v0, rms: r, tr, yr: interp(tr) };
    }
    best.vy0 = best.v0 * Math.sin(rad(o.angle)); return best;
  }
  const reynolds = (v) => (C.rho * v * 2 * C.r) / C.eta;
  const dragRatio = (v, model, Cx) => (kOf(model, Cx) * v * v) / (C.m * C.g);
  return { C, POINTS, kOf, shoot, requiredSpeed, speedWindow, successMap, relHeight, fitPoints, reynolds, dragRatio, TR };
});
