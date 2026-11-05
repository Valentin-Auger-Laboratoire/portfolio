/* Transporteur autonome : simulation du robot suiveur de ligne (vue de dessus) et de ses deux programmes.
   - « 2022 » : portage fidèle de code/programme_final/programme_final.ino (mêmes broches, mêmes délais, même logique).
   - « 2026 » : la version corrigée décrite dans la relecture du README (boucle non bloquante, mesure avant de repartir,
     mesures invalides filtrées, LED clignotante, recherche de ligne, virages progressifs).
   Unités : cm, s. Utilisable dans le navigateur (window.Transporteur) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Transporteur = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ constantes du programme 2022
  const PROG = {
    input_voltage: 9, nominal_voltage: 5,
    MAX_SPEED: Math.trunc((5 * 255) / 9), // 141
    LOW_SPEED: 0,
    pins: { directionA: 12, directionB: 13, speedA: 3, speedB: 11, in2: 8, in3: 4, ultrasonic: 6, ledR: 2 },
    seuil: 15, delayLoop: 0.150, delayStop: 5.0,
  };

  // ------------------------------------------------------------------ table et parcours
  const TABLE = { w: 240, h: 150 };
  const LINE_W = 1.9; // ruban adhésif noir de 19 mm
  const CTRL = [[45, 32], [150, 30], [205, 38], [218, 72], [200, 112], [160, 118], [128, 92], [98, 76], [70, 100], [40, 112], [22, 78], [26, 46]];
  // spline de Catmull-Rom fermée, échantillonnée finement
  function buildTrack(ctrl, perSeg) {
    const pts = [], n = ctrl.length;
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      for (let k = 0; k < perSeg; k++) {
        const t = k / perSeg, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    const s = [0];
    for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; s.push(s[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    return { pts, s, length: s[pts.length] };
  }
  // parcours : ellipse « en haricot » (un virage serré, une contre-courbe), échantillonnée finement
  function paramTrack(f, n) {
    const pts = []; for (let i = 0; i < n; i++) pts.push(f((2 * Math.PI * i) / n));
    const s = [0]; for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; s.push(s[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    return { pts, s, length: s[n] };
  }
  const SHAPES = { doux: { a: 88, b: 56, d: 0 }, serre: { a: 92, b: 50, d: 10 } };
  const makeTrack = (k) => { const S = SHAPES[k] || SHAPES.doux; return paramTrack((t) => [120 + S.a * Math.cos(t), 75 + S.b * Math.sin(t) - S.d * Math.cos(2 * t)], 480); };
  const TRACKS = { doux: makeTrack('doux'), serre: makeTrack('serre') };
  let TRACK = TRACKS.doux;
  // distance d'un point à la ligne + abscisse curviligne du point le plus proche
  function nearest(track, x, y) {
    let best = Infinity, bs = 0;
    const P = track.pts, n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      let u = ((x - a[0]) * dx + (y - a[1]) * dy) / L2; u = Math.max(0, Math.min(1, u));
      const px = a[0] + u * dx, py = a[1] + u * dy, d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; bs = track.s[i] + u * Math.sqrt(L2); }
    }
    return { d: best, s: bs };
  }
  // rayon de courbure minimal du parcours (pour information)
  function minRadius(track) {
    let r = Infinity; const P = track.pts, n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[(i - 3 + n) % n], b = P[i], c = P[(i + 3) % n];
      const A = Math.hypot(b[0] - a[0], b[1] - a[1]), B = Math.hypot(c[0] - b[0], c[1] - b[1]), Cc = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
      if (area > 1e-9) r = Math.min(r, (A * B * Cc) / (4 * area));
    }
    return r;
  }

  // ------------------------------------------------------------------ robot
  // châssis : roues motrices à l'arrière (voie 13 cm), capteurs de ligne 9 cm devant l'essieu (écartés de 3,6 cm),
  // télémètre à ultrasons à l'avant (11 cm), cône de ±15°
  const ROBOT = { track: 13, sensX: 9, sensY: 1.8, usX: 11, cone: (15 * Math.PI) / 180, len: 17, wid: 12, rear: 4, Kv: 4.2, tau: 0.12, deadV: 1.2, range: 400 };
  // vitesse d'une roue (cm/s) en régime établi pour une consigne PWM et une tension de pile
  const wheelSpeed = (pwm, vbat) => { const V = (vbat * pwm) / 255; return V < ROBOT.deadV ? 0 : ROBOT.Kv * (V - ROBOT.deadV) * 1.31; };

  // ------------------------------------------------------------------ ultrasons
  // rayons dans le cône vers les obstacles (rectangles) et les murs de la pièce ; cible absorbante → pas d'écho → 0
  function rayRect(ox, oy, dx, dy, r) {
    let tmin = -Infinity, tmax = Infinity;
    for (const [o, d, lo, hi] of [[ox, dx, r.x, r.x + r.w], [oy, dy, r.y, r.y + r.h]]) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return Infinity; }
      else { let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
    }
    return tmax >= Math.max(0, tmin) ? Math.max(0, tmin) : Infinity;
  }
  function measure(st, world) {
    const c = Math.cos(st.th), s = Math.sin(st.th);
    const ox = st.x + ROBOT.usX * c, oy = st.y + ROBOT.usX * s;
    let best = Infinity, absorb = false;
    for (let k = -3; k <= 3; k++) {
      const a = st.th + (k / 3) * ROBOT.cone, dx = Math.cos(a), dy = Math.sin(a);
      for (const ob of world.obstacles) { const t = rayRect(ox, oy, dx, dy, ob); if (t < best) { best = t; absorb = !!ob.absorb; } }
      // murs de la pièce, 60 cm autour de la table
      const room = { x: -60, y: -60, w: TABLE.w + 120, h: TABLE.h + 120 };
      const tw = (() => { let t = Infinity; for (const [o, d, lo, hi] of [[ox, dx, room.x, room.x + room.w], [oy, dy, room.y, room.y + room.h]]) { if (d > 1e-12) t = Math.min(t, (hi - o) / d); else if (d < -1e-12) t = Math.min(t, (lo - o) / d); } return t; })();
      if (tw < best) { best = tw; absorb = false; }
    }
    if (absorb || best > ROBOT.range) return { cm: 0, true: best }; // pas d'écho : la bibliothèque renvoie 0
    // MeasureInCentimeters renvoie un entier (durée / 29 / 2)
    return { cm: Math.max(1, Math.round(best + (world.noise ? world.noise() * 0.6 : 0))), true: best };
  }
  const echoTime = (cm) => (cm > 0 ? (cm * 58) / 1e6 : 0.025) + 0.0003; // durée de la mesure (s), délai max si pas d'écho

  // ------------------------------------------------------------------ programmes
  // Chaque programme est une petite machine à états cadencée par le temps simulé.
  // Il lit les capteurs (st.L, st.R), commande pwmA (moteur droit), pwmB (moteur gauche) et la LED.
  function prog2022() {
    // reproduit loop() : lecture ligne → moteurs → mesure → delay(150) → (si ≤ 15 : stop, LED, delay(5000)) sinon LED off
    let wake = 0, phase = 'loop', pending = null;
    return {
      name: '2022',
      step(t, st, io, world, log) {
        if (t < wake) return;
        if (phase === 'loop') {
          const in1 = st.L, in4 = st.R;
          if (in1 && !in4) { log('Tourner à gauche'); io.pwmA = PROG.MAX_SPEED; io.pwmB = PROG.LOW_SPEED; io.act = 'g'; }
          else if (!in1 && in4) { log('Tourner à droite'); io.pwmA = PROG.LOW_SPEED; io.pwmB = PROG.MAX_SPEED; io.act = 'd'; }
          else { log('Continuer tout droit'); io.pwmA = PROG.MAX_SPEED; io.pwmB = PROG.MAX_SPEED; io.act = 'av'; }
          const m = measure(st, world); io.dist = m.cm; pending = m.cm;
          log(m.cm + ' cm');
          wake = t + echoTime(m.cm) + PROG.delayLoop; phase = 'decide'; io.phase = 'delay(150)';
        } else if (phase === 'decide') {
          if (pending <= PROG.seuil) { io.led = 1; io.pwmA = PROG.LOW_SPEED; io.pwmB = PROG.LOW_SPEED; io.act = 'stop'; wake = t + PROG.delayStop; world.stats.stops++; io.phase = 'delay(5000)'; }
          else if (pending >= 16) { io.led = 0; }
          phase = 'loop';
        }
      },
    };
  }
  function prog2026() {
    // non bloquant : ligne lue toutes les 10 ms, distance toutes les 60 ms ; on mesure avant de repartir ;
    // 3 mesures invalides de suite = capteur en défaut (arrêt prudent) ; hystérésis 15 / 20 cm ; LED clignotante 2 Hz ;
    // virage progressif (roue intérieure à 35 %) ; ligne perdue → on tourne du côté où on l'a vue en dernier.
    let tLine = 0, tUs = 0, d = 999, invalid = 0, stopped = false, lastSide = 0, lostSince = null, mode = 'suivi';
    const SLOW = Math.round(PROG.MAX_SPEED * 0.35);
    return {
      name: '2026',
      step(t, st, io, world, log) {
        if (t >= tUs) {
          const m = measure(st, world); tUs = t + 0.06;
          if (m.cm === 0) { invalid++; } else { invalid = 0; d = m.cm; }
          io.dist = m.cm;
          if (!stopped && (d <= PROG.seuil || invalid >= 3)) { stopped = true; world.stats.stops++; log(invalid >= 3 ? 'Mesure invalide : arrêt prudent' : 'Obstacle à ' + d + ' cm : arrêt'); }
          else if (stopped && invalid < 3 && d >= 20) { stopped = false; log('Voie libre (' + d + ' cm) : je repars'); }
        }
        io.led = stopped ? (Math.floor(t * 4) % 2) : 0;
        if (t < tLine) return;
        tLine = t + 0.01;
        if (stopped) { io.pwmA = 0; io.pwmB = 0; io.act = 'stop'; mode = 'obstacle'; io.phase = 'obstacle'; return; }
        const L = st.L, R = st.R;
        if (L && !R) { lastSide = 1; lostSince = null; io.pwmA = PROG.MAX_SPEED; io.pwmB = SLOW; io.act = 'g'; mode = 'suivi'; }
        else if (!L && R) { lastSide = -1; lostSince = null; io.pwmA = SLOW; io.pwmB = PROG.MAX_SPEED; io.act = 'd'; mode = 'suivi'; }
        else if (L && R) { lostSince = null; io.pwmA = PROG.MAX_SPEED; io.pwmB = PROG.MAX_SPEED; io.act = 'av'; mode = 'suivi'; }
        else {
          // les deux capteurs voient du blanc : normal si la ligne passe entre eux ; si cela dure, on la cherche
          if (lostSince === null) lostSince = t;
          if (t - lostSince > 0.35 && lastSide !== 0) { mode = 'recherche'; io.act = lastSide > 0 ? 'g' : 'd'; io.pwmA = lastSide > 0 ? PROG.MAX_SPEED : 0; io.pwmB = lastSide > 0 ? 0 : PROG.MAX_SPEED; }
          else { io.pwmA = PROG.MAX_SPEED; io.pwmB = PROG.MAX_SPEED; io.act = 'av'; mode = 'suivi'; }
        }
        io.mode = mode; io.phase = mode;
      },
    };
  }

  // ------------------------------------------------------------------ simulation
  // opt : { prog: '2022'|'2026', vbat, pwmMax, obstacles: [{x,y,w,h,absorb,from,to}], start (s sur la ligne), seed, noise }
  function createSim(opt) {
    const o = Object.assign({ prog: '2022', vbat: 9, pwmMax: PROG.MAX_SPEED, obstacles: [], seed: 4, noise: true, track: 'doux' }, opt || {});
    TRACK = TRACKS[o.track] || TRACKS.doux;
    const saveMax = PROG.MAX_SPEED;
    let seed = o.seed;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    // départ posé sur la ligne, orienté dans le sens du parcours
    const s0 = o.start || 0, i0 = Math.floor((s0 / TRACK.length) * TRACK.pts.length) % TRACK.pts.length;
    const a = TRACK.pts[i0], b = TRACK.pts[(i0 + 2) % TRACK.pts.length];
    const th0 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const st = { x: a[0] - ROBOT.sensX * Math.cos(th0) * 0.5, y: a[1] - ROBOT.sensX * Math.sin(th0) * 0.5, th: th0, vL: 0, vR: 0, L: 0, R: 0 };
    const io = { pwmA: 0, pwmB: 0, led: 0, dist: 0, act: '—', mode: 'suivi', phase: '—' };
    const world = { obstacles: [], noise: o.noise ? gauss : null, stats: { stops: 0, collisions: 0, offLine: 0, lost: false, dist: 0, maxOff: 0, minGap: Infinity } };
    const prog = o.prog === '2026' ? prog2026() : prog2022();
    const serial = [];
    const log = (m) => { serial.push({ t: sim.t, m }); if (serial.length > 400) serial.shift(); };
    let progress = 0, lastS = nearest(TRACK, st.x + ROBOT.sensX * Math.cos(st.th), st.y + ROBOT.sensX * Math.sin(st.th)).s, wasOff = false, inCollision = false;
    const sim = {
      t: 0, st, io, world, serial, opt: o,
      get laps() { return progress / TRACK.length; },
      sensorPos() {
        const c = Math.cos(st.th), s = Math.sin(st.th);
        return { L: [st.x + ROBOT.sensX * c - ROBOT.sensY * s, st.y + ROBOT.sensX * s + ROBOT.sensY * c], R: [st.x + ROBOT.sensX * c + ROBOT.sensY * s, st.y + ROBOT.sensX * s - ROBOT.sensY * c] };
      },
      corners() {
        const c = Math.cos(st.th), s = Math.sin(st.th), f = ROBOT.len - ROBOT.rear, r = -ROBOT.rear, w = ROBOT.wid / 2;
        return [[f, w], [f, -w], [r, -w], [r, w]].map(([u, v]) => [st.x + u * c - v * s, st.y + u * s + v * c]);
      },
      step(dt) {
        PROG.MAX_SPEED = o.pwmMax;
        world.obstacles = o.obstacles.filter((ob) => (ob.from === undefined || sim.t >= ob.from) && (ob.to === undefined || sim.t < ob.to));
        // capteurs de ligne : HIGH sur le noir (le repère « gauche » est à +y du robot, sens trigonométrique)
        const sp = sim.sensorPos();
        st.L = nearest(TRACK, sp.L[0], sp.L[1]).d <= LINE_W / 2 ? 1 : 0;
        st.R = nearest(TRACK, sp.R[0], sp.R[1]).d <= LINE_W / 2 ? 1 : 0;
        prog.step(sim.t, st, io, world, log);
        PROG.MAX_SPEED = saveMax;
        // moteurs : A = droit, B = gauche, réponse du premier ordre, zone morte
        const k = 1 - Math.exp(-dt / ROBOT.tau);
        st.vR += (wheelSpeed(io.pwmA, o.vbat) - st.vR) * k;
        st.vL += (wheelSpeed(io.pwmB, o.vbat) - st.vL) * k;
        const v = (st.vL + st.vR) / 2, w = (st.vR - st.vL) / ROBOT.track;
        const nx = st.x + v * Math.cos(st.th) * dt, ny = st.y + v * Math.sin(st.th) * dt;
        // collision avec un obstacle : le robot est bloqué (il pousse contre)
        const test = { x: nx, y: ny, th: st.th + w * dt };
        const c = Math.cos(test.th), s = Math.sin(test.th), f = ROBOT.len - ROBOT.rear;
        const nose = [[f, 0], [f, ROBOT.wid / 2], [f, -ROBOT.wid / 2]].map(([u, vv]) => [nx + u * c - vv * s, ny + u * s + vv * c]);
        const hit = world.obstacles.some((ob) => nose.some(([px, py]) => px >= ob.x && px <= ob.x + ob.w && py >= ob.y && py <= ob.y + ob.h));
        if (hit) { if (!inCollision) { world.stats.collisions++; inCollision = true; log('!! contact avec l’obstacle'); } }
        else { inCollision = false; st.x = nx; st.y = ny; st.th = test.th; world.stats.dist += Math.abs(v) * dt; }
        // écart à la ligne (mesuré au milieu des capteurs) et progression le long du parcours
        const mx = st.x + ROBOT.sensX * Math.cos(st.th), my = st.y + ROBOT.sensX * Math.sin(st.th), nr = nearest(TRACK, mx, my);
        world.stats.maxOff = Math.max(world.stats.maxOff, nr.d);
        const off = nr.d > 6; if (off && !wasOff) world.stats.offLine++; wasOff = off;
        if (nr.d > 25) world.stats.lost = true;
        let ds = nr.s - lastS; if (ds > TRACK.length / 2) ds -= TRACK.length; if (ds < -TRACK.length / 2) ds += TRACK.length;
        if (Math.abs(ds) < 20) progress += ds; lastS = nr.s;
        for (const ob of world.obstacles) { const g = Math.max(0, Math.max(ob.x - mx, mx - ob.x - ob.w, ob.y - my, my - ob.y - ob.h)); world.stats.minGap = Math.min(world.stats.minGap, g); }
        sim.t += dt;
      },
      run(T, dt) { const h = dt || 0.005; while (sim.t < T && !world.stats.lost) sim.step(h); return sim; },
    };
    return sim;
  }
  // un obstacle carré posé sur la ligne à l'abscisse s (cm)
  function obstacleOnTrack(s, size, extra, trackName) {
    if (trackName) TRACK = TRACKS[trackName];
    const i = Math.floor((s / TRACK.length) * TRACK.pts.length) % TRACK.pts.length, p = TRACK.pts[i];
    return Object.assign({ x: p[0] - size / 2, y: p[1] - size / 2, w: size, h: size }, extra || {});
  }
  // résumé d'un essai
  function summary(sim) {
    const S = sim.world.stats;
    return { laps: sim.laps, stops: S.stops, collisions: S.collisions, offLine: S.offLine, lost: S.lost, maxOff: S.maxOff, minGap: S.minGap, meanV: S.dist / Math.max(sim.t, 1e-9), t: sim.t };
  }

  return { PROG, TABLE, LINE_W, TRACKS, get TRACK() { return TRACK; }, ROBOT, nearest, minRadius, wheelSpeed, measure, echoTime, createSim, obstacleOnTrack, summary, buildTrack };
});
