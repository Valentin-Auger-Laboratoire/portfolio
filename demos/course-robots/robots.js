/* Course de robots autonomes : moteur de simulation (refait de zéro en 2026, d'après une course de robots en TP).
   - Robot à deux roues motrices (modèle unicycle), disque de 5 cm de rayon, voie 10 cm, 0,25 m/s maxi.
   - Capteurs : pare-chocs (contact + côté), 5 télémètres infrarouges (0°, ±45°, ±90°, portée 40 cm, bruit), codeurs des roues.
   - Odométrie : les codeurs comptent ce que les roues font tourner, même quand le robot est bloqué contre un mur (glissement),
     avec une erreur d'étalonnage du diamètre des roues et un bruit par pas → la position estimée dérive.
   - Caméra au plafond : position (x, y, cap) à 5 Hz, quantifiée au pixel (2 cm), bruitée ; fusion odométrie + caméra par
     filtre de Kalman étendu.
   - Cinq stratégies : couleurs des murs (la règle de la course du TP : noir = milieu, rouge = bord), rebond aléatoire,
     suivi de mur (régulateur PD), Bug2, champ de potentiel.
   Utilisable dans le navigateur (window.Robots) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Robots = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TAU = 2 * Math.PI;
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = r(); if (u < 1e-300) u = 1e-300; return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }

  const ROBOT = { r: 0.05, b: 0.1, vmax: 0.25, irRange: 0.4, irSigma: 0.008, irAngles: [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2] };

  // ---------------------------------------------------------------- pistes (mètres). Murs = segments [x1, y1, x2, y2]
  function box(x, y, w, h) { return [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]]; }
  function track(kind) {
    const W = 4, H = 1.2, walls = box(0, 0, W, H), colors = ['red', 'red', 'red', 'red'];
    const add = (segs, c) => { walls.push(...segs); segs.forEach(() => colors.push(c)); };
    add([[0, 0.6, 3.3, 0.6]], 'black'); // barrière centrale noire : on part en bas, on fait demi-tour au bout, on revient en haut
    const t = { W, H, walls, colors, checkX: 3.3, finish: { x: 0.4, yMin: 0.6 }, goal: [0.25, 0.9], starts: [[0.2, 0.12], [0.2, 0.24], [0.2, 0.36], [0.2, 0.48]], kind };
    // obstacles collés au bord : rouges ; collés à la barrière centrale : noirs (même règle que les murs)
    if (kind === 'obstacles') { add(box(1.2, 0.0, 0.15, 0.22), 'red'); add(box(2.3, 0.38, 0.15, 0.22), 'black'); add(box(1.7, 0.6, 0.15, 0.2), 'black'); add(box(2.8, 0.98, 0.15, 0.22), 'red'); }
    if (kind === 'chicane') { add([[1.0, 0, 1.0, 0.25], [2.2, 0, 2.2, 0.25], [2.4, 1.2, 2.4, 0.95]], 'red'); add([[1.6, 0.6, 1.6, 0.35], [1.4, 0.6, 1.4, 0.85]], 'black'); }
    // points de passage (champ de potentiel)
    t.waypoints = [[3.65, 0.3], [3.65, 0.9], [0.25, 0.9]];
    return t;
  }

  // ---------------------------------------------------------------- géométrie
  function closestOnSeg(px, py, s) {
    const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy;
    let u = L2 > 0 ? ((px - s[0]) * dx + (py - s[1]) * dy) / L2 : 0; u = Math.max(0, Math.min(1, u));
    return [s[0] + u * dx, s[1] + u * dy];
  }
  // distance du point (x, y) le long de la direction a jusqu'au premier mur ou robot (Infinity si rien)
  function raycastHit(x, y, a, walls, discs) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity, idx = -1;
    walls.forEach((s, i) => {
      const ex = s[2] - s[0], ey = s[3] - s[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) return;
      const wx = s[0] - x, wy = s[1] - y, t = (wx * ey - wy * ex) / den, u = (wx * dy - wy * dx) / den;
      if (t >= 0 && u >= 0 && u <= 1 && t < best) { best = t; idx = i; }
    });
    for (const c of discs || []) {
      const fx = x - c[0], fy = y - c[1], bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - c[2] * c[2], disc = bq * bq - cq;
      if (disc >= 0) { const t = -bq - Math.sqrt(disc); if (t >= 0 && t < best) { best = t; idx = -2; } }
    }
    return { d: best, idx }; // idx : mur touché, −2 : un autre robot, −1 : rien
  }
  const raycast = (x, y, a, walls, discs) => raycastHit(x, y, a, walls, discs).d;

  // ---------------------------------------------------------------- filtre de Kalman étendu (x, y, θ)
  function ekfInit(p) { return { x: p.slice(), P: [[1e-6, 0, 0], [0, 1e-6, 0], [0, 0, 1e-6]] }; }
  function ekfPredict(f, ds, dth, q) {
    const th = f.x[2] + dth / 2, c = Math.cos(th), s = Math.sin(th);
    f.x[0] += ds * c; f.x[1] += ds * s; f.x[2] = wrap(f.x[2] + dth);
    const F = [[1, 0, -ds * s], [0, 1, ds * c], [0, 0, 1]], P = f.P;
    const FP = F.map((r) => [0, 1, 2].map((j) => r[0] * P[0][j] + r[1] * P[1][j] + r[2] * P[2][j]));
    const N = FP.map((r) => [0, 1, 2].map((j) => r[0] * F[j][0] + r[1] * F[j][1] + r[2] * F[j][2]));
    const qs = q.ds * Math.abs(ds) + 1e-9, qt = q.dth * Math.abs(ds) + 1e-9;
    N[0][0] += qs * c * c; N[1][1] += qs * s * s; N[0][1] += qs * c * s; N[1][0] += qs * c * s; N[2][2] += qt;
    f.P = N;
  }
  function inv3(m) {
    const [a, b, c] = m[0], [d, e, g] = m[1], [h, i, k] = m[2];
    const A = e * k - g * i, B = -(d * k - g * h), C = d * i - e * h, det = a * A + b * B + c * C;
    return [[A / det, -(b * k - c * i) / det, (b * g - c * e) / det], [B / det, (a * k - c * h) / det, -(a * g - c * d) / det], [C / det, -(a * i - b * h) / det, (a * e - b * d) / det]];
  }
  function ekfUpdate(f, z, R) {
    const P = f.P, S = P.map((r, i) => r.map((v, j) => v + (i === j ? R[i] : 0))), Si = inv3(S);
    const K = P.map((r) => [0, 1, 2].map((j) => r[0] * Si[0][j] + r[1] * Si[1][j] + r[2] * Si[2][j]));
    const y = [z[0] - f.x[0], z[1] - f.x[1], wrap(z[2] - f.x[2])];
    for (let i = 0; i < 3; i++) f.x[i] += K[i][0] * y[0] + K[i][1] * y[1] + K[i][2] * y[2];
    f.x[2] = wrap(f.x[2]);
    f.P = P.map((r, i) => r.map((v, j) => v - (K[i][0] * P[0][j] + K[i][1] * P[1][j] + K[i][2] * P[2][j])));
  }

  // ---------------------------------------------------------------- stratégies : (capteurs, état, outils) → { v, w }
  const V = ROBOT.vmax;
  const CTRL = {
    // 0. couleurs (la règle du TP) : capteur de couleur à l'avant ; noir = barrière du milieu → s'en écarter par la droite,
    //    rouge = bord de la piste → s'en écarter par la gauche. Au contact : recule, puis tourne du bon côté.
    colors(s, m) {
      if (m.phase === 'back') { if (s.t >= m.until) { m.phase = 'turn'; m.until = s.t + (Math.PI / 4) / 2.5; } return { v: -0.5 * V, w: 0 }; }
      if (m.phase === 'turn') { if (s.t >= m.until) m.phase = 'go'; return { v: 0.1 * V, w: 2.5 * m.dir }; }
      if (s.bump) { m.phase = 'back'; m.until = s.t + 0.3; m.dir = s.bumpColor === 'black' ? -1 : 1; return { v: -0.5 * V, w: 0 }; }
      if (s.color === 'black' && s.colorDist < 0.12) return { v: 0.6 * V, w: -2.2 };
      if (s.color === 'red' && s.colorDist < 0.12) return { v: 0.6 * V, w: 2.2 };
      return { v: V, w: 0 };
    },
    // 1. rebond aléatoire : tout droit ; au choc, recule 0,4 s puis tourne d'un angle au hasard, du côté opposé au choc
    bounce(s, m, k) {
      if (m.phase === 'back') { if (s.t >= m.until) { m.phase = 'turn'; m.until = s.t + (Math.PI / 3 + k.r() * (2 * Math.PI / 3)) / 2.5; } return { v: -0.6 * V, w: 0 }; }
      if (m.phase === 'turn') { if (s.t >= m.until) m.phase = 'go'; return { v: 0, w: 2.5 * m.dir }; }
      if (s.bump) { m.phase = 'back'; m.until = s.t + 0.4; m.dir = s.bumpSide > 0 ? -1 : 1; return { v: -0.6 * V, w: 0 }; }
      return { v: V, w: 0 };
    },
    // 2. suivi de mur à droite : régulateur PD sur la distance au mur, virage sur place si l'avant est bouché
    wall(s, m) {
      const ref = 0.12, dR = Math.min(s.ir[4], s.ir[2] * Math.SQRT1_2 + 0.02), front = s.ir[0];
      if (s.bump) { m.back = s.t + 0.25; }
      if (m.back && s.t < m.back) return { v: -0.5 * V, w: 1.5 };
      if (front < 0.16 || s.ir[1] < 0.1) return { v: 0.02, w: 2.2 };
      if (dR > 0.35) return { v: 0.7 * V, w: -0.7 * V / 0.16 }; // plus de mur : on tourne à droite pour le retrouver
      const e = dR - ref, de = m.e === undefined ? 0 : (e - m.e) / s.dt; m.e = e;
      return { v: V * (front < 0.3 ? 0.6 : 1), w: Math.max(-3, Math.min(3, -9 * e - 0.6 * de)) };
    },
    // 3. Bug2 : va vers le but ; si bloqué, contourne (obstacle à droite) jusqu'à retrouver la droite départ-but plus près du but
    bug2(s, m, k) {
      const [x, y, th] = s.est, g = k.track.goal;
      if (!m.line) m.line = { a: [x, y], b: g.slice() };
      const dg = Math.hypot(g[0] - x, g[1] - y);
      const lx = m.line.b[0] - m.line.a[0], ly = m.line.b[1] - m.line.a[1], L = Math.hypot(lx, ly);
      const offLine = Math.abs((x - m.line.a[0]) * ly - (y - m.line.a[1]) * lx) / L;
      if (m.mode !== 'follow') {
        if (s.ir[0] < 0.15 || s.ir[1] < 0.1 || s.ir[2] < 0.1 || s.bump) { m.mode = 'follow'; m.hit = dg; m.t0 = s.t; return { v: 0, w: 2 }; }
        const e = wrap(Math.atan2(g[1] - y, g[0] - x) - th);
        return { v: V * Math.max(0, Math.cos(e)) * Math.min(1, dg / 0.2 + 0.2), w: Math.max(-3, Math.min(3, 4 * e)) };
      }
      if (s.t - m.t0 > 1.5 && offLine < 0.04 && dg < m.hit - 0.1 && s.ir[0] > 0.25) { m.mode = 'go'; m.e = undefined; return { v: 0.5 * V, w: 0 }; }
      return CTRL.wall(s, m);
    },
    // 4. champ de potentiel : attraction vers le point de passage courant + répulsion des télémètres
    potential(s, m, k) {
      const [x, y, th] = s.est, wps = k.track.waypoints; if (m.i === undefined) m.i = 0;
      let g = wps[Math.min(m.i, wps.length - 1)];
      if (Math.hypot(g[0] - x, g[1] - y) < 0.15 && m.i < wps.length - 1) { m.i++; g = wps[m.i]; }
      let fx = (g[0] - x), fy = (g[1] - y); const n = Math.hypot(fx, fy) || 1; fx /= n; fy /= n;
      ROBOT.irAngles.forEach((a, i) => { const d = s.ir[i]; if (d < 0.3) { const rep = 0.012 * (1 / d - 1 / 0.3) / (d * d); fx -= rep * Math.cos(th + a); fy -= rep * Math.sin(th + a); } });
      if (s.bump) { m.back = s.t + 0.3; }
      if (m.back && s.t < m.back) return { v: -0.5 * V, w: 0.8 };
      const e = wrap(Math.atan2(fy, fx) - th);
      return { v: V * Math.max(0, Math.cos(e)), w: Math.max(-3, Math.min(3, 3.5 * e)) };
    },
  };
  const ALGOS = Object.keys(CTRL);

  // ---------------------------------------------------------------- course
  // o : { track, robots: [{ algo, color, loc: 'true'|'odom'|'ekf' }], seed, tMax, dt, odo: { scale, sigma }, cam: { hz, px, sigma, sigmaTh }, record }
  function race(o) {
    const opt = Object.assign({ track: 'u', seed: 1, tMax: 180, dt: 0.02, record: false, every: 5 }, o || {});
    const odo = Object.assign({ scaleL: 1.004, scaleR: 0.997, sigma: 0.01 }, opt.odo || {});
    const cam = Object.assign({ hz: 5, px: 0.02, sigma: 0.008, sigmaTh: 0.08 }, opt.cam || {});
    const T = track(opt.track), r = rng(opt.seed);
    const bots = opt.robots.map((b, i) => {
      const p = [T.starts[i][0], T.starts[i][1], 0];
      return { algo: b.algo, loc: b.loc || 'ekf', color: b.color, p, odom: p.slice(), ekf: ekfInit(p), mem: {}, bump: false, bumpSide: 0, hits: 0, dist: 0, check: false, done: null, err: [], trace: [] };
    });
    const k = { r, track: T }, camPeriod = 1 / cam.hz;
    let nextCam = 0; const frames = [];
    for (let step = 0; step * opt.dt <= opt.tMax; step++) {
      const t = step * opt.dt;
      if (bots.every((b) => b.done !== null)) break;
      const camNow = t >= nextCam; if (camNow) nextCam += camPeriod;
      for (const b of bots) {
        if (b.done !== null) continue;
        const discs = bots.filter((o2) => o2 !== b).map((o2) => [o2.p[0], o2.p[1], ROBOT.r]);
        const ir = ROBOT.irAngles.map((a) => { const d = raycast(b.p[0], b.p[1], b.p[2] + a, T.walls, discs) - ROBOT.r; return d > ROBOT.irRange ? Infinity : Math.max(0, d + ROBOT.irSigma * gauss(r)); });
        if (camNow) { const z = [Math.round(b.p[0] / cam.px) * cam.px + cam.sigma * gauss(r), Math.round(b.p[1] / cam.px) * cam.px + cam.sigma * gauss(r), wrap(b.p[2] + cam.sigmaTh * gauss(r))]; ekfUpdate(b.ekf, z, [cam.sigma ** 2 + cam.px ** 2 / 12, cam.sigma ** 2 + cam.px ** 2 / 12, cam.sigmaTh ** 2]); b.cam = z; }
        const est = b.loc === 'true' ? b.p : b.loc === 'odom' ? b.odom : b.ekf.x;
        const fh = raycastHit(b.p[0], b.p[1], b.p[2], T.walls, discs), color = fh.idx >= 0 ? T.colors[fh.idx] : fh.idx === -2 ? 'robot' : null;
        let { v, w } = CTRL[b.algo]({ t, dt: opt.dt, ir, bump: b.bump, bumpSide: b.bumpSide, bumpColor: b.bumpColor, color, colorDist: fh.d - ROBOT.r, est }, b.mem, k);
        // saturation des roues
        let vl = v - (w * ROBOT.b) / 2, vr = v + (w * ROBOT.b) / 2; const sat = Math.max(1, Math.abs(vl) / V, Math.abs(vr) / V); vl /= sat; vr /= sat;
        // codeurs : ce que les roues ont fait tourner (erreur d'étalonnage + bruit)
        const el = vl * opt.dt * odo.scaleL * (1 + odo.sigma * gauss(r)), er = vr * opt.dt * odo.scaleR * (1 + odo.sigma * gauss(r));
        const ds = (el + er) / 2, dth = (er - el) / ROBOT.b;
        { const th = b.odom[2] + dth / 2; b.odom[0] += ds * Math.cos(th); b.odom[1] += ds * Math.sin(th); b.odom[2] = wrap(b.odom[2] + dth); }
        ekfPredict(b.ekf, ds, dth, { ds: (odo.sigma ** 2 + 0.03 ** 2) * 0.05, dth: 0.05 });
        // mouvement réel (modèle unicycle exact sur le pas)
        const vv = (vl + vr) / 2, ww = (vr - vl) / ROBOT.b, x0 = b.p[0], y0 = b.p[1];
        if (Math.abs(ww) < 1e-9) { b.p[0] += vv * opt.dt * Math.cos(b.p[2]); b.p[1] += vv * opt.dt * Math.sin(b.p[2]); }
        else { const R = vv / ww, th2 = b.p[2] + ww * opt.dt; b.p[0] += R * (Math.sin(th2) - Math.sin(b.p[2])); b.p[1] -= R * (Math.cos(th2) - Math.cos(b.p[2])); }
        b.p[2] = wrap(b.p[2] + ww * opt.dt);
        // contacts : murs puis autres robots (le pare-chocs se déclenche, le robot est repoussé, les roues patinent)
        let bump = false, side = 0, bcol = null;
        T.walls.forEach((s, wi) => { const q = closestOnSeg(b.p[0], b.p[1], s), dx = b.p[0] - q[0], dy = b.p[1] - q[1], d = Math.hypot(dx, dy); if (d < ROBOT.r) { b.p[0] = q[0] + (dx / (d || 1e-9)) * ROBOT.r; b.p[1] = q[1] + (dy / (d || 1e-9)) * ROBOT.r; bump = true; side = wrap(Math.atan2(-dy, -dx) - b.p[2]); bcol = T.colors[wi]; } });
        for (const o2 of bots) { if (o2 === b) continue; const dx = b.p[0] - o2.p[0], dy = b.p[1] - o2.p[1], d = Math.hypot(dx, dy); if (d < 2 * ROBOT.r) { const push = 2 * ROBOT.r - d; b.p[0] += (dx / (d || 1e-9)) * push; b.p[1] += (dy / (d || 1e-9)) * push; bump = true; side = wrap(Math.atan2(-dy, -dx) - b.p[2]); bcol = bcol || 'robot'; } }
        if (bump && !b.bump) b.hits++;
        b.bump = bump; b.bumpSide = side; b.bumpColor = bcol;
        b.dist += Math.hypot(b.p[0] - x0, b.p[1] - y0);
        if (b.p[0] > T.checkX) b.check = true;
        if (b.check && b.p[0] < T.finish.x && b.p[1] > T.finish.yMin) b.done = t;
        if (step % 10 === 0) b.err.push(Math.hypot(est[0] - b.p[0], est[1] - b.p[1]));
        if (opt.record && step % opt.every === 0) b.trace.push([t, b.p[0], b.p[1], b.p[2], est[0], est[1], est[2], ir.slice(), b.bump ? 1 : 0, b.mem.mode || b.mem.phase || '']);
      }
      if (opt.record && camNow) frames.push([t, bots.map((b) => (b.cam ? b.cam.slice() : null))]);
    }
    const res = bots.map((b, i) => ({ i, algo: b.algo, loc: b.loc, color: b.color, time: b.done, hits: b.hits, dist: b.dist, errRms: Math.sqrt(b.err.reduce((s2, e) => s2 + e * e, 0) / Math.max(1, b.err.length)), errEnd: b.err[b.err.length - 1] || 0, trace: b.trace }));
    const order = res.filter((x) => x.time !== null).sort((a, b) => a.time - b.time).map((x) => x.i);
    return { track: T, bots: res, order, frames, dt: opt.dt };
  }
  // statistiques sur plusieurs courses (un seul robot par course, pour mesurer la stratégie seule)
  function stats(algo, loc, n, o) {
    const out = { done: 0, times: [], hits: [], err: [] };
    for (let k = 0; k < n; k++) { const r = race(Object.assign({ robots: [{ algo, loc }], seed: 100 + k }, o || {})).bots[0]; if (r.time !== null) { out.done++; out.times.push(r.time); } out.hits.push(r.hits); out.err.push(r.errRms); }
    const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
    return { algo, loc, n, rate: out.done / n, tMean: mean(out.times), tMin: out.times.length ? Math.min(...out.times) : NaN, hits: mean(out.hits), err: mean(out.err) };
  }
  return { ROBOT, track, closestOnSeg, raycast, raycastHit, wrap, rng, gauss, ekfInit, ekfPredict, ekfUpdate, CTRL, ALGOS, race, stats };
});
