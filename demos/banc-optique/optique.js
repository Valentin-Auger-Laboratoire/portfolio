/* Banc d'optique : lentilles, conditions de Gauss, diffraction (refait de zéro en 2026, d'après un TP d'optique).
   Unités : longueurs du banc en mm, longueurs d'onde en nm, largeurs de fente en µm (converties dans chaque fonction).
   - Verres : formule de Sellmeier (coefficients du catalogue Schott pour N-BK7, F2, N-SF11 ; Malitson 1965 pour la silice).
   - Banc : lentilles minces en optique paraxiale, matrices de transfert (ABCD), conjugaison de Descartes,
     flou géométrique sur l'écran limité par les montures, faisceau laser gaussien (paramètre q).
   - Conditions de Gauss : tracé de rayons EXACT (loi de Snell-Descartes vectorielle) dans des lentilles épaisses
     à faces sphériques, comparé au tracé paraxial (sin θ ≈ θ) ; aberration sphérique, chromatisme, doublet achromatique.
   - Diffraction : Fraunhofer avec angles exacts ou petits angles, Fresnel pour la fente (intégrales de Fresnel),
     trou circulaire (Bessel J1), fentes d'Young, réseau.
   Utilisable dans le navigateur (window.Optique) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Optique = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ---------------------------------------------------------------- verres (Sellmeier, λ en µm)
  const GLASS = {
    BK7: { name: 'N-BK7', B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] },
    F2: { name: 'F2', B: [1.34533359, 0.209073176, 0.937357162], C: [0.00997743871, 0.0470450767, 111.886764] },
    SF11: { name: 'N-SF11', B: [1.73759695, 0.313747346, 1.89878101], C: [0.013188707, 0.0623068142, 155.23629] },
    SiO2: { name: 'silice', B: [0.6961663, 0.4079426, 0.8974794], C: [0.0684043 ** 2, 0.1162414 ** 2, 9.896161 ** 2] },
  };
  function nGlass(g, lnm) {
    const G = typeof g === 'string' ? GLASS[g] : g, l2 = (lnm / 1000) ** 2;
    let s = 1; for (let i = 0; i < 3; i++) s += (G.B[i] * l2) / (l2 - G.C[i]);
    return Math.sqrt(s);
  }
  const LINES = { F: 486.1327, d: 587.5618, C: 656.2725 }; // raies de Fraunhofer F (H), d (He), C (H)
  function abbe(g) { return (nGlass(g, LINES.d) - 1) / (nGlass(g, LINES.F) - nGlass(g, LINES.C)); }
  // lasers et lampes courants du TP
  const LASERS = [
    { id: 'v405', nm: 405 }, { id: 'b450', nm: 450 }, { id: 'g532', nm: 532 }, { id: 'na589', nm: 589.3 }, { id: 'r633', nm: 632.8 }, { id: 'r650', nm: 650 },
  ];
  // couleur approchée d'une longueur d'onde (pour l'affichage seulement)
  function rgbOf(lnm) {
    let r = 0, g = 0, b = 0; const l = lnm;
    if (l >= 380 && l < 440) { r = -(l - 440) / 60; b = 1; }
    else if (l < 490) { g = (l - 440) / 50; b = 1; }
    else if (l < 510) { g = 1; b = -(l - 510) / 20; }
    else if (l < 580) { r = (l - 510) / 70; g = 1; }
    else if (l < 645) { r = 1; g = -(l - 645) / 65; }
    else if (l <= 780) { r = 1; }
    let f = 1; if (l < 420) f = 0.3 + (0.7 * (l - 380)) / 40; else if (l > 700) f = 0.3 + (0.7 * (780 - l)) / 80;
    return [r, g, b].map((v) => Math.round(255 * Math.pow(Math.max(0, v) * f, 0.8)));
  }

  // ---------------------------------------------------------------- matrices de transfert 2×2 [A, B, C, D] (rayon [y, u])
  const mul = (P, Q) => [P[0] * Q[0] + P[1] * Q[2], P[0] * Q[1] + P[1] * Q[3], P[2] * Q[0] + P[3] * Q[2], P[2] * Q[1] + P[3] * Q[3]];
  const freeM = (d) => [1, d, 0, 1];
  const lensM = (f) => [1, 0, -1 / f, 1];
  // matrice du plan x = a au plan x = b (a < b) en traversant les lentilles minces { x, f } situées entre les deux
  function systemM(lenses, a, b) {
    let M = [1, 0, 0, 1], x = a;
    lenses.filter((L) => L.x > a + 1e-9 && L.x <= b + 1e-9).sort((p, q) => p.x - q.x).forEach((L) => { M = mul(freeM(L.x - x), M); M = mul(lensM(L.f), M); x = L.x; });
    return mul(freeM(b - x), M);
  }
  // image finale par la matrice : objet en xo, lentilles ; renvoie position de l'image (Infinity si à l'infini), grandissement, réelle ou non
  function imageABCD(lenses, xo) {
    if (!lenses.length) return { x: xo, g: 1, real: false };
    const xl = Math.max(...lenses.map((L) => L.x)), M = systemM(lenses, xo, xl);
    if (Math.abs(M[3]) < 1e-12) return { x: Infinity, g: Infinity, real: false, M };
    const d = -M[1] / M[3]; return { x: xl + d, g: M[0] + d * M[2], real: d > 0, M };
  }
  // conjugaison de Descartes lentille après lentille (pour la construction : images intermédiaires)
  function conjugate(p, f) { // p = OA (algébrique), renvoie OA'
    if (!isFinite(p)) return f;
    const v = 1 / f + 1 / p; return Math.abs(v) < 1e-15 ? Infinity : 1 / v;
  }
  function imageChain(lenses, xo, h, u0) {
    const Ls = lenses.slice().sort((a, b) => a.x - b.x), steps = [];
    let x = xo, y = h, ang = u0 || 0; // ang : angle (de propagation) des rayons venant d'un objet à l'infini (rad)
    for (const L of Ls) {
      let xi, yi;
      if (!isFinite(x)) { xi = L.x + L.f; yi = L.f * ang; } // objet à l'infini : image dans le plan focal image
      else {
        const p = x - L.x, pp = conjugate(p, L.f);
        if (!isFinite(pp)) { ang = -y / L.f; xi = Infinity; yi = Infinity; } // objet au foyer objet
        else { xi = L.x + pp; yi = (y * pp) / p; }
      }
      steps.push({ lens: L, x: xi, h: yi, real: isFinite(xi) && xi > L.x, virtualObject: isFinite(x) && x > L.x });
      x = xi; y = yi;
    }
    return steps;
  }
  // intervalle d'angles [umin, umax] des rayons issus du point (xo, y) qui passent toutes les montures (diamètre D)
  function admitted(lenses, xo, y, uLim) {
    let lo = -(uLim || 0.5), hi = uLim || 0.5;
    for (const L of lenses.slice().sort((a, b) => a.x - b.x)) {
      if (L.x <= xo) continue;
      const M = systemM(lenses, xo, L.x - 1e-9); // juste avant la lentille
      const A = M[0], B = M[1], r = L.D / 2; // hauteur = A·y + B·u, doit rester dans ±r
      if (Math.abs(B) < 1e-12) { if (Math.abs(A * y) > r) return null; continue; }
      let u1 = (-r - A * y) / B, u2 = (r - A * y) / B; if (u1 > u2) [u1, u2] = [u2, u1];
      lo = Math.max(lo, u1); hi = Math.min(hi, u2); if (lo >= hi) return null;
    }
    return [lo, hi];
  }
  // objet à l'infini (rayons d'angle u) : position de l'image finale (A = 0) et sa hauteur
  function imageInf(lenses, u) {
    const Ls = lenses.slice().sort((a, b) => a.x - b.x); if (!Ls.length) return { x: Infinity, h: Infinity };
    const x0 = Ls[0].x - 1, xl = Ls[Ls.length - 1].x, M = systemM(Ls, x0, xl);
    if (Math.abs(M[2]) < 1e-12) return { x: Infinity, h: Infinity, afocal: true, G: M[3] };
    const d = -M[0] / M[2]; return { x: xl + d, h: (M[1] + d * M[3]) * u, real: d > 0 };
  }
  // rayons parallèles d'angle u partant du plan x0 : intervalle des hauteurs [ymin, ymax] qui passent toutes les montures
  function admittedY(lenses, x0, u) {
    let lo = -1e3, hi = 1e3;
    for (const L of lenses.slice().sort((a, b) => a.x - b.x)) {
      if (L.x <= x0) continue; const M = systemM(lenses, x0, L.x - 1e-9), A = M[0], B = M[1], r = L.D / 2;
      if (Math.abs(A) < 1e-12) { if (Math.abs(B * u) > r) return null; continue; }
      let y1 = (-r - B * u) / A, y2 = (r - B * u) / A; if (y1 > y2) [y1, y2] = [y2, y1]; lo = Math.max(lo, y1); hi = Math.min(hi, y2); if (lo >= hi) return null;
    }
    return [lo, hi];
  }
  // ce que montre l'écran : pour un objet en xo, écran en xs
  function onScreen(lenses, xo, xs, yObj) {
    const M = systemM(lenses, xo, xs), y = yObj || 0, ad = admitted(lenses.filter((L) => L.x < xs), xo, y);
    if (!ad) return { lit: false, A: M[0], B: M[1] };
    const [lo, hi] = ad, uc = (lo + hi) / 2;
    return { lit: true, A: M[0], B: M[1], center: M[0] * y + M[1] * uc, blur: Math.abs(M[1]) * (hi - lo), du: hi - lo };
  }
  // faisceau gaussien : q complexe [re, im] ; w(z) à partir de 1/q = 1/R − i λ/(π w²)
  function qProp(q, M) { // (A q + B) / (C q + D)
    const nr = M[0] * q[0] + M[1], ni = M[0] * q[1], dr = M[2] * q[0] + M[3], di = M[2] * q[1], den = dr * dr + di * di;
    return [(nr * dr + ni * di) / den, (ni * dr - nr * di) / den];
  }
  function wOf(q, lmm) { const den = q[0] * q[0] + q[1] * q[1], im = -q[1] / den; return Math.sqrt(lmm / (Math.PI * -im)); }
  // rayon du faisceau le long du banc ; laser : col (waist w0 mm) en xs, λ en nm
  function gaussBeam(lenses, xs, w0, lnm, xs2) {
    const lmm = lnm * 1e-6, zR = (Math.PI * w0 * w0) / lmm; let q = [0, zR], x = xs; const pts = [];
    const Ls = lenses.filter((L) => L.x > xs).sort((a, b) => a.x - b.x), stops = Ls.map((L) => L.x).concat([xs2]);
    for (const xe of stops) {
      const n = 60; for (let k = 0; k <= n; k++) { const xx = x + ((xe - x) * k) / n, qq = qProp(q, freeM(xx - x)); pts.push([xx, wOf(qq, lmm)]); }
      q = qProp(q, freeM(xe - x)); x = xe;
      const L = Ls.find((L) => Math.abs(L.x - xe) < 1e-9); if (L) q = qProp(q, lensM(L.f));
    }
    // col après le dernier élément : z tel que Re(q + z) = 0
    return { pts, q, waistAt: x - q[0], waistW: Math.sqrt((q[1] * lmm) / Math.PI), zR: q[1] };
  }
  // méthode de Bessel : objet–écran D, lentille f ; positions de la lentille donnant une image nette
  function besselPositions(D, f) { const disc = D * D - 4 * D * f; if (disc < 0) return null; const s = Math.sqrt(disc); return [(D - s) / 2, (D + s) / 2]; }
  const besselF = (D, d) => (D * D - d * d) / (4 * D);
  // moindres carrés y = a x + b
  function linfit(xs, ys) {
    const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
    const a = sxy / sxx, b = my - a * mx, res = ys.map((y, i) => y - a * xs[i] - b), s2 = n > 2 ? res.reduce((s, r) => s + r * r, 0) / (n - 2) : 0;
    return { a, b, ua: Math.sqrt(s2 / sxx), ub: Math.sqrt(s2 * (1 / n + (mx * mx) / sxx)), r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1 };
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  // latitude de mise au point : positions de l'écran (autour de l'image xi) où le flou reste < eps
  function focusLatitude(lenses, xo, xi, eps) {
    const blur = (xs) => { const o = onScreen(lenses, xo, xs); return o.lit ? o.blur : Infinity; };
    const edge = (dir) => { let a = 0, b = dir * 1; while (blur(xi + b) < eps && Math.abs(b) < 1e4) b *= 2; for (let k = 0; k < 50; k++) { const m = (a + b) / 2; if (blur(xi + m) < eps) a = m; else b = m; } return a; };
    return [edge(-1), edge(1)];
  }
  // expérience de Bessel simulée : l'opérateur cherche l'image nette (latitude), lit la règle au mm ; Monte-Carlo
  function besselMC(o) {
    const opt = Object.assign({ D: 600, f: 100, Dl: 40, eps: 0.5, ruler: 1, n: 2000, seed: 5 }, o || {});
    const P = besselPositions(opt.D, opt.f); if (!P) return null;
    // latitude sur la position de la LENTILLE (écran fixe) : flou < eps
    const lat = P.map((xl) => {
      const blur = (x) => { const o2 = onScreen([{ x, f: opt.f, D: opt.Dl }], 0, opt.D); return o2.lit ? o2.blur : Infinity; };
      const edge = (dir) => { let a = 0, b = dir * 0.5; while (blur(xl + b) < opt.eps && Math.abs(b) < 1e3) b *= 2; for (let k = 0; k < 50; k++) { const m = (a + b) / 2; if (blur(xl + m) < opt.eps) a = m; else b = m; } return a; };
      return [edge(-1), edge(1)];
    });
    const r = rng(opt.seed), fs = [], round = (v) => Math.round(v / opt.ruler) * opt.ruler;
    for (let k = 0; k < opt.n; k++) {
      const x1 = round(P[0] + lat[0][0] + r() * (lat[0][1] - lat[0][0])), x2 = round(P[1] + lat[1][0] + r() * (lat[1][1] - lat[1][0]));
      const D = round(opt.D + (r() - 0.5) * opt.ruler); fs.push(besselF(D, x2 - x1));
    }
    const m = fs.reduce((s, v) => s + v, 0) / fs.length, sd = Math.sqrt(fs.reduce((s, v) => s + (v - m) ** 2, 0) / (fs.length - 1));
    return { positions: P, latitude: lat, mean: m, sd, fs, opt };
  }

  // ---------------------------------------------------------------- tracé de rayons exact (plan méridien)
  // surfaces : { x (sommet), R (rayon signé, Infinity = plan), n (indice APRÈS la surface), D (diamètre utile) }
  function refract(d, N, n1, n2) { // d unitaire, N normale unitaire orientée contre d
    const ci = -(N[0] * d[0] + N[1] * d[1]), eta = n1 / n2, k = 1 - eta * eta * (1 - ci * ci);
    if (k < 0) return null; // réflexion totale
    const a = eta * ci - Math.sqrt(k); return [eta * d[0] + a * N[0], eta * d[1] + a * N[1]];
  }
  function hitSurface(P, d, S) {
    if (!isFinite(S.R)) { if (Math.abs(d[0]) < 1e-15) return null; const t = (S.x - P[0]) / d[0]; return { t, p: [S.x, P[1] + t * d[1]], N: [-1, 0] }; }
    const C = [S.x + S.R, 0], o = [P[0] - C[0], P[1] - C[1]], b = o[0] * d[0] + o[1] * d[1], c = o[0] * o[0] + o[1] * o[1] - S.R * S.R, disc = b * b - c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc), t1 = -b - s, t2 = -b + s;
    // on garde l'intersection du côté du sommet
    const p1 = [P[0] + t1 * d[0], P[1] + t1 * d[1]], p2 = [P[0] + t2 * d[0], P[1] + t2 * d[1]];
    const pick = Math.abs(p1[0] - S.x) <= Math.abs(p2[0] - S.x) ? [t1, p1] : [t2, p2];
    let N = [(pick[1][0] - C[0]) / S.R, (pick[1][1] - C[1]) / S.R]; // normale (vers la droite au sommet si R > 0 : vers −x)
    if (N[0] * d[0] + N[1] * d[1] > 0) N = [-N[0], -N[1]];
    return { t: pick[0], p: pick[1], N };
  }
  // trace un rayon (point de départ P, direction d) à travers les surfaces ; n0 indice initial
  function traceExact(surfs, P, d, n0) {
    let n = n0 || 1, p = P.slice(), dir = d.slice(); const path = [p.slice()];
    for (const S of surfs) {
      const h = hitSurface(p, dir, S); if (!h || h.t < -1e-9) return { ok: false, path, why: 'miss' };
      if (Math.abs(h.p[1]) > S.D / 2 + 1e-12) { path.push(h.p); return { ok: false, path, why: 'stop' }; }
      const nd = refract(dir, h.N, n, S.n); path.push(h.p); if (!nd) return { ok: false, path, why: 'tir' };
      const L = Math.hypot(nd[0], nd[1]); dir = [nd[0] / L, nd[1] / L]; p = h.p; n = S.n;
    }
    return { ok: true, path, p, d: dir };
  }
  // tracé paraxial (même système de surfaces) : y, u (angle réduit) ; refraction n'u' = n u − y (n' − n)/R
  function traceParaxial(surfs, y0, u0, x0, n0) {
    let y = y0, u = u0, x = x0, n = n0 || 1;
    for (const S of surfs) { y += u * (S.x - x); x = S.x; const c = isFinite(S.R) ? 1 / S.R : 0; u = (n * u - y * (S.n - n) * c) / S.n; n = S.n; }
    return { y, u, x };
  }
  // foyer image paraxial : tirage (BFL) depuis la dernière surface et focale (depuis le plan principal)
  function paraxialFocus(surfs) { const r = traceParaxial(surfs, 1e-6, 0, surfs[0].x - 10); return { bfl: -r.y / r.u, xF: r.x - r.y / r.u, f: -1e-6 / r.u }; }
  const sag = (R, h) => (isFinite(R) ? R - Math.sign(R) * Math.sqrt(R * R - h * h) : 0);
  // lentille simple : forme ∈ 'bi' (biconvexe symétrique), 'pc' (plan-convexe, face bombée vers la lumière), 'cp' (face plane vers la lumière), 'bic' (biconcave)
  function singlet(o) {
    const opt = Object.assign({ shape: 'pc', f: 100, D: 30, glass: 'BK7', x: 0, edge: 2 }, o || {}), nd = nGlass(opt.glass, LINES.d), K = 1 / opt.f / (nd - 1);
    let R1, R2;
    if (opt.shape === 'bi') { R1 = 2 / K; R2 = -R1; }
    else if (opt.shape === 'pc') { R1 = 1 / K; R2 = Infinity; }
    else if (opt.shape === 'cp') { R1 = Infinity; R2 = -1 / K; }
    else { R1 = 2 / K; R2 = -R1; } // biconcave : K < 0 donne R1 < 0
    const h = opt.D / 2, s1 = sag(R1, h), s2 = sag(R2, h);
    const e = Math.max(opt.edge + s1 - s2, opt.edge * 0.6); // épaisseur au centre (bord ≥ edge)
    return { R1, R2, e, glass: opt.glass, D: opt.D, x: opt.x, kind: 'singlet', shape: opt.shape, fTarget: opt.f };
  }
  // doublet achromatique collé (verres a = crown, b = flint), focale f à la raie d (calcul en lentilles minces accolées)
  function achromat(o) {
    const opt = Object.assign({ f: 100, D: 30, a: 'BK7', b: 'F2', x: 0 }, o || {}), Va = abbe(opt.a), Vb = abbe(opt.b), P = 1 / opt.f;
    const Pa = (P * Va) / (Va - Vb), Pb = (-P * Vb) / (Va - Vb), Ka = Pa / (nGlass(opt.a, LINES.d) - 1), Kb = Pb / (nGlass(opt.b, LINES.d) - 1);
    const R1 = 2 / Ka, R2 = -R1, h = opt.D / 2;
    const make = (c3) => { const R3 = 1 / c3, e1 = Math.max(1.5 + sag(R1, h) - sag(R2, h), 1.5), e2 = Math.max(1.5 + sag(R2, h) - sag(R3, h), 1.5); return { R1, R2, R3, e1, e2, a: opt.a, b: opt.b, D: opt.D, x: opt.x, kind: 'achromat', Pa, Pb, Va, Vb, fTarget: opt.f }; };
    // départ : lentilles minces accolées ; puis on corrige la courbure de la dernière face par tracé paraxial ÉPAIS
    // pour que les foyers F (486 nm) et C (656 nm) coïncident exactement, et on remet la focale à f par homothétie
    const gap = (c3) => { const L = make(c3); return paraxialFocus(surfacesOf(L, LINES.F)).xF - paraxialFocus(surfacesOf(L, LINES.C)).xF; };
    let c0 = 1 / R2 - Kb, c1 = c0 * 1.02 + 1e-5, g0 = gap(c0), g1 = gap(c1);
    for (let k = 0; k < 40 && Math.abs(g1) > 1e-12; k++) { const c2 = c1 - (g1 * (c1 - c0)) / (g1 - g0); c0 = c1; g0 = g1; c1 = c2; g1 = gap(c1); }
    const L = make(c1), sc = opt.f / paraxialFocus(surfacesOf(L, LINES.d)).f;
    ['R1', 'R2', 'R3', 'e1', 'e2'].forEach((k) => { L[k] *= sc; }); L.thinR3 = 1 / (1 / R2 - Kb);
    return L;
  }
  function surfacesOf(L, lnm) {
    if (L.kind === 'achromat') { const na = nGlass(L.a, lnm), nb = nGlass(L.b, lnm); return [{ x: L.x, R: L.R1, n: na, D: L.D }, { x: L.x + L.e1, R: L.R2, n: nb, D: L.D }, { x: L.x + L.e1 + L.e2, R: L.R3, n: 1, D: L.D }]; }
    const n = nGlass(L.glass, lnm); return [{ x: L.x, R: L.R1, n, D: L.D }, { x: L.x + L.e, R: L.R2, n: 1, D: L.D }];
  }
  // focale épaisse (formule des opticiens) pour la lentille simple, à comparer au tracé paraxial
  function thickLensF(R1, R2, e, n) { const c1 = isFinite(R1) ? 1 / R1 : 0, c2 = isFinite(R2) ? 1 / R2 : 0, P = (n - 1) * (c1 - c2 + ((n - 1) * e * c1 * c2) / n); return { f: 1 / P, bfl: (1 / P) * (1 - ((n - 1) * e * c1) / n) }; }
  // faisceau parallèle de hauteur h et d'incidence alpha (rad) : intersection avec l'axe (alpha = 0) ou avec un plan xs
  function rayParallel(L, lnm, h, alpha, x0) {
    const s = surfacesOf(L, lnm), xs = x0 === undefined ? L.x - 40 : x0;
    // le rayon passe à la hauteur h dans le plan de la première face (sommet) : départ en xs
    const d = [Math.cos(alpha), Math.sin(alpha)], P = [xs, h - Math.tan(alpha) * (L.x - xs)];
    return traceExact(s, P, d, 1);
  }
  // aberration sphérique longitudinale : écart entre l'intersection avec l'axe du rayon de hauteur h et le foyer paraxial
  function longAberration(L, lnm, hs) {
    const pf = paraxialFocus(surfacesOf(L, lnm));
    return hs.map((h) => { const r = rayParallel(L, lnm, h, 0); if (!r.ok || Math.abs(r.d[1]) < 1e-15) return NaN; const xc = r.p[0] - (r.p[1] * r.d[0]) / r.d[1]; return xc - pf.xF; });
  }
  // impacts dans le plan x = xp d'un faisceau de nRays rayons sur la pupille (± hmax), incidence alpha
  function spot(L, lnm, hmax, alpha, xp, nRays) {
    const N = nRays || 41, out = [];
    for (let k = 0; k < N; k++) { const h = -hmax + (2 * hmax * k) / (N - 1), r = rayParallel(L, lnm, h, alpha); if (!r.ok) continue; out.push({ h, y: r.p[1] + ((xp - r.p[0]) * r.d[1]) / r.d[0], ang: Math.asin(r.d[1]) }); }
    return out;
  }
  // meilleur plan (rms minimal) au voisinage du foyer paraxial — recherche par section dorée
  function bestFocus(L, lnm, hmax, alpha) {
    const pf = paraxialFocus(surfacesOf(L, lnm)), rms = (xp) => { const s = spot(L, lnm, hmax, alpha, xp, 61); if (s.length < 3) return Infinity; const m = s.reduce((a, p) => a + p.y, 0) / s.length; return Math.sqrt(s.reduce((a, p) => a + (p.y - m) ** 2, 0) / s.length); };
    let a = pf.xF - Math.max(5, 0.2 * Math.abs(pf.f)), b = pf.xF + 2; const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a), fc = rms(c), fd = rms(d);
    for (let k = 0; k < 80; k++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = rms(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = rms(d); } }
    const x = (a + b) / 2; return { x, rms: rms(x), rmsParax: rms(pf.xF), xF: pf.xF };
  }
  // plus grand angle d'incidence sur une surface (pour juger l'approximation sin θ ≈ θ)
  function maxIncidence(L, lnm, hmax, alpha) {
    const s = surfacesOf(L, lnm); let m = 0;
    for (const h of [-hmax, hmax]) {
      const r0 = rayParallel(L, lnm, h, alpha); if (!r0.path) continue;
      let p = r0.path[0], d = [Math.cos(alpha), Math.sin(alpha)], n = 1;
      for (const S of s) { const hh = hitSurface(p, d, S); if (!hh) break; m = Math.max(m, Math.acos(Math.min(1, -(hh.N[0] * d[0] + hh.N[1] * d[1])))); const nd = refract(d, hh.N, n, S.n); if (!nd) break; d = nd; p = hh.p; n = S.n; }
    }
    return m;
  }
  // focale paraxiale en fonction de λ (chromatisme)
  function focalVsLambda(L, ls) { return ls.map((l) => { const pf = paraxialFocus(surfacesOf(L, l)); return { l, f: pf.f, xF: pf.xF }; }); }

  // ---------------------------------------------------------------- réfraction : dioptre plan, prisme, fibre optique
  // coefficients de Fresnel en intensité (onde polarisée s ou p) ; θ1 en rad ; réflexion totale → R = 1
  function fresnelRT(n1, n2, th) {
    const s1 = Math.sin(th), s2 = (n1 / n2) * s1; if (Math.abs(s2) >= 1) return { Rs: 1, Rp: 1, R: 1, T: 0, tir: true, th2: NaN };
    const c1 = Math.cos(th), th2 = Math.asin(s2), c2 = Math.cos(th2);
    const rs = (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2), rp = (n2 * c1 - n1 * c2) / (n2 * c1 + n1 * c2);
    const Rs = rs * rs, Rp = rp * rp; return { Rs, Rp, R: (Rs + Rp) / 2, T: 1 - (Rs + Rp) / 2, tir: false, th2 };
  }
  const criticalAngle = (n1, n2) => (n1 > n2 ? Math.asin(n2 / n1) : NaN);
  const brewster = (n1, n2) => Math.atan(n2 / n1);
  // prisme d'angle au sommet A (rad), indice n, incidence i (rad) : déviation D = i + i′ − A
  function prism(A, n, i) {
    const r1 = Math.asin(Math.sin(i) / n), r2 = A - r1, s = n * Math.sin(r2);
    if (Math.abs(s) >= 1) return { ok: false, r1, r2 };
    const i2 = Math.asin(s); return { ok: true, r1, r2, i2, D: i + i2 - A };
  }
  const prismDmin = (A, n) => 2 * Math.asin(n * Math.sin(A / 2)) - A;
  const prismN = (A, Dmin) => Math.sin((A + Dmin) / 2) / Math.sin(A / 2); // mesure de l'indice au minimum de déviation
  // fibre à saut d'indice : cœur n1, gaine n2, milieu extérieur n0
  function fiber(n1, n2, n0) {
    const NA = Math.sqrt(Math.max(0, n1 * n1 - n2 * n2)), c = 299792458;
    const acc = NA / (n0 || 1) >= 1 ? Math.PI / 2 : Math.asin(NA / (n0 || 1));
    const dtPerM = (n1 * (n1 - n2)) / (c * n2); // écart de temps entre le rayon axial et le rayon le plus incliné (s/m)
    return { NA, acc, thc: Math.asin(n2 / n1), dtPerM, rate: (L) => 1 / (2 * dtPerM * L) }; // débit maximal ≈ 1/(2Δt)
  }
  // trajet d'un rayon dans la fibre (vue en coupe) : entrée au centre avec l'angle θ0 dans l'air ; renvoie les points (m) et la puissance restante
  function fiberPath(n1, n2, n0, th0, rCore, L, maxBounces) {
    const th1 = Math.asin((n0 * Math.sin(th0)) / n1), inc = Math.PI / 2 - Math.abs(th1), pts = [[0, 0]];
    let x = 0, y = 0, dir = Math.sign(th1) || 1, P = 1, k = 0; const t = Math.tan(Math.abs(th1));
    if (t < 1e-12) return { pts: [[0, 0], [L, 0]], P: 1, bounces: 0, inc: Math.PI / 2 };
    const fr = fresnelRT(n1, n2, inc);
    while (x < L && k < (maxBounces || 4000)) { const dy = dir > 0 ? rCore - y : y + rCore, dx = dy / t; if (x + dx > L) { y += dir * t * (L - x); x = L; pts.push([x, y]); break; } x += dx; y = dir * rCore; pts.push([x, y]); P *= fr.R; dir = -dir; k++; }
    return { pts, P, bounces: k, inc, tir: fr.tir };
  }

  // ---------------------------------------------------------------- diffraction
  // intégrales de Fresnel C(x), S(x) : série pour |x| < 3, développement asymptotique au-delà
  function fresnelCS(x) {
    const ax = Math.abs(x), sg = x < 0 ? -1 : 1;
    if (ax < 3) {
      let C = 0, S = 0; const a = (Math.PI / 2) * ax * ax; let term = ax; // terme générique : (−1)^n a^{2n} x / (2n)! etc.
      // C = Σ (−1)^n (π/2)^{2n} x^{4n+1} / ((2n)! (4n+1)) ; S = Σ (−1)^n (π/2)^{2n+1} x^{4n+3} / ((2n+1)! (4n+3))
      let tc = ax, ts = ax * a; // tc = (π/2)^{2n} x^{4n+1}/(2n)!, ts = (π/2)^{2n+1} x^{4n+3}/(2n+1)!
      for (let n = 0; n < 60; n++) {
        C += (n % 2 ? -1 : 1) * tc / (4 * n + 1); S += (n % 2 ? -1 : 1) * ts / (4 * n + 3);
        tc *= (a * a) / ((2 * n + 1) * (2 * n + 2)); ts *= (a * a) / ((2 * n + 2) * (2 * n + 3));
        if (Math.abs(tc) < 1e-17 && Math.abs(ts) < 1e-17) break;
      }
      void term; return [sg * C, sg * S];
    }
    if (ax < 5) { // entre 3 et 5 : C(3), S(3) par la série puis intégration de Simpson (le développement asymptotique n'est pas assez précis ici)
      const c3 = fresnelCS(3 - 1e-12), n = 600, h = (ax - 3) / n; let C = 0, S = 0;
      for (let k = 0; k <= n; k++) { const t = 3 + k * h, w = k === 0 || k === n ? 1 : k % 2 ? 4 : 2, ph = (Math.PI * t * t) / 2; C += w * Math.cos(ph); S += w * Math.sin(ph); }
      return [sg * (c3[0] + (C * h) / 3), sg * (c3[1] + (S * h) / 3)];
    }
    const z = Math.PI * ax * ax, iz2 = 1 / (z * z);
    // f, g auxiliaires (Abramowitz & Stegun 7.3.27–28, développement asymptotique)
    let f = 0, g = 0, tf = 1, tg = 1;
    for (let k = 0; k < 12; k++) {
      f += tf; g += tg;
      const nf = -tf * (4 * k + 1) * (4 * k + 3) * iz2, ng = -tg * (4 * k + 3) * (4 * k + 5) * iz2;
      if (Math.abs(nf) > Math.abs(tf)) break; tf = nf; tg = ng;
    }
    f /= Math.PI * ax; g /= Math.PI * z * ax;
    const s = Math.sin(z / 2), c = Math.cos(z / 2);
    return [sg * (0.5 + f * s - g * c), sg * (0.5 - f * c - g * s)];
  }
  // Bessel J1 (approximations polynomiales classiques, précision ~1e-8)
  function besselJ1(x) {
    const ax = Math.abs(x);
    if (ax < 8) {
      const y = x * x;
      const a = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
      const b = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
      return a / b;
    }
    const z = 8 / ax, y = z * z, xx = ax - 2.356194491;
    const p = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
    const q = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
    const r = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
    return x < 0 ? -r : r;
  }
  const sinc = (b) => (Math.abs(b) < 1e-8 ? 1 - (b * b) / 6 : Math.sin(b) / b);
  // sin θ pour un point de l'écran à l'abscisse x (mm), écran à D (mm) : exact ou petits angles (sin θ ≈ tan θ = x/D)
  const sinTheta = (x, D, small) => (small ? x / D : x / Math.hypot(x, D));
  // o : { type: 'slit'|'hair'|'hole'|'young'|'grating', a (µm), b (µm, entraxe), N (fentes éclairées), lpmm (traits/mm), lnm, D (mm), model: 'exact'|'small'|'fresnel' }
  function intensity(x, o) {
    const l = o.lnm * 1e-6, s = sinTheta(x, o.D, o.model === 'small'), a = o.a * 1e-3;
    if ((o.type === 'slit' || o.type === 'hair') && o.model === 'fresnel') { // Fresnel paraxial (1D)
      const k = Math.sqrt(2 / (l * o.D)), A = fresnelCS(k * (a / 2 - x)), B = fresnelCS(k * (-a / 2 - x));
      // intensité rapportée à l'onde incidente (1 = pas d'obstacle). Cheveu : on garde la figure de la fente (principe de
      // Babinet avec un faisceau laser de taille finie : hors du faisceau direct, cheveu et fente donnent la même figure)
      return ((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2) / 2;
    }
    if (o.type === 'slit' || o.type === 'hair') return sinc((Math.PI * a * s) / l) ** 2;
    if (o.type === 'hole') { const v = (Math.PI * a * s) / l; return Math.abs(v) < 1e-8 ? 1 : ((2 * besselJ1(v)) / v) ** 2; }
    if (o.type === 'young' || o.type === 'youngHoles') {
      // formule de Fresnel I = I1 + I2 + 2√(I1 I2) cos φ, φ = 2π b sin θ / λ (r = I2/I1), dans l'enveloppe de diffraction d'une fente ou d'un trou ; normalisée à 1
      const b = o.b * 1e-3, r = o.r === undefined ? 1 : o.r, phi = (2 * Math.PI * b * s) / l, inter = (1 + r + 2 * Math.sqrt(r) * Math.cos(phi)) / (1 + Math.sqrt(r)) ** 2;
      const v = (Math.PI * a * s) / l, env = o.type === 'young' ? sinc(v) ** 2 : Math.abs(v) < 1e-8 ? 1 : ((2 * besselJ1(v)) / v) ** 2;
      return env * inter;
    }
    if (o.type === 'grating') {
      const p = 1 / o.lpmm, N = o.N || 50, w = p / 2, g = (Math.PI * p * s) / l, sg = Math.sin(g);
      const arr = Math.abs(sg) < 1e-9 ? 1 : (Math.sin(N * g) / (N * sg)) ** 2; return sinc((Math.PI * w * s) / l) ** 2 * arr;
    }
    return 0;
  }
  // facteur de contraste Γ = (Imax − Imin)/(Imax + Imin) pour deux ondes d'intensités I1 et I2 = r·I1
  const contrast = (r) => (2 * Math.sqrt(r)) / (1 + r);
  // spectre d'une lampe blanche (pondérations égales de 400 à 700 nm) : [λ, poids]
  function whiteSpectrum(n) { const N = n || 31, out = []; for (let k = 0; k < N; k++) out.push([400 + (300 * k) / (N - 1), 1 / N]); return out; }
  // diamètre apparent (rad) d'un astre de diamètre d à la distance D (mêmes unités) et vu à travers une lunette de grossissement G
  const apparent = (d, D) => 2 * Math.atan(d / (2 * D));
  // largeur de la tache centrale (distance entre les deux premiers minima) : exacte et petits angles
  function centralWidth(o) {
    const l = o.lnm * 1e-6, a = o.a * 1e-3, k = o.type === 'hole' ? 1.2196698912665045 : 1, s = (k * l) / a;
    const approx = 2 * k * l * o.D / a; if (s >= 1) return { exact: Infinity, approx, theta: NaN };
    const th = Math.asin(s); return { exact: 2 * o.D * Math.tan(th), approx, theta: th };
  }
  // positions des ordres d'un réseau (mm sur l'écran) : sin θk = k λ / p
  function gratingOrders(o) { const l = o.lnm * 1e-6, p = 1 / o.lpmm, out = []; for (let k = -10; k <= 10; k++) { const s = (k * l) / p; if (Math.abs(s) >= 1) continue; const th = Math.asin(s); out.push({ k, theta: th, x: o.D * Math.tan(th), xSmall: (k * l * o.D) / p }); } return out; }
  // nombre de Fresnel a²/(λD) (demi-largeur) : Fraunhofer valable si ≪ 1
  const fresnelNumber = (o) => ((o.a * 1e-3 / 2) ** 2) / (o.lnm * 1e-6 * o.D);
  // mesure d'un cheveu : on mesure L à la règle (u(L)), D (u(D)) ; a = 2 λ D / L
  function hairMeasure(L, D, lnm, uL, uD) { const a = (2 * lnm * 1e-6 * D) / L; return { a: a * 1e3, ua: a * 1e3 * Math.sqrt((uL / L) ** 2 + (uD / D) ** 2) }; }

  return {
    GLASS, nGlass, LINES, abbe, LASERS, rgbOf,
    mul, freeM, lensM, systemM, imageABCD, conjugate, imageChain, imageInf, admittedY, admitted, onScreen, qProp, wOf, gaussBeam,
    besselPositions, besselF, linfit, rng, focusLatitude, besselMC,
    refract, hitSurface, traceExact, traceParaxial, paraxialFocus, sag, singlet, achromat, surfacesOf, thickLensF, rayParallel, longAberration, spot, bestFocus, maxIncidence, focalVsLambda,
    fresnelRT, criticalAngle, brewster, prism, prismDmin, prismN, fiber, fiberPath,
    fresnelCS, besselJ1, sinc, sinTheta, intensity, contrast, whiteSpectrum, apparent, centralWidth, gratingOrders, fresnelNumber, hairMeasure,
  };
});
