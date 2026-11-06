/* Drone en tangage (banc de TP type « drone didactique » à un axe) : moteur de simulation, refait de zéro en 2026.
   Bras pivotant de 2 × 20 cm, une hélice à chaque bout. Valeurs physiques SUPPOSÉES (ordres de grandeur) :
   J = 0,012 kg·m², frottement 0,004 N·m·s/rad, poussée F = kT·ω² (3 N à 1 000 rad/s), moteurs du 1er ordre τm = 60 ms,
   butées à ±45°, commande des moteurs u ∈ [0, 1], gaz de base 25 %.
   Contient : modèle non linéaire, capteurs (gyromètre biaisé et bruité, accéléromètre bruité par les vibrations),
   estimation (intégration, accéléromètre seul, filtre complémentaire, filtre de Kalman angle + biais),
   commande (PID simple, cascade position → vitesse comme sur le banc, retour d'état LQR avec action intégrale),
   analyse fréquentielle (Bode, marges), identification par moindres carrés (modèle ARX), perturbations.
   Utilisable dans le navigateur (window.Drone) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Drone = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEG = Math.PI / 180, G = 9.81;
  const P0 = { J: 0.012, f: 0.004, Lb: 0.2, kT: 3e-6, wmax: 1000, tau: 0.06, gas: 0.25, stop: 45 * DEG, kG: 0, delay: 0.005 };
  // gain de couple linéaire : u1 = gaz − d, u2 = gaz + d → C = Lb·kT·(ω2² − ω1²) = 4·Lb·kT·gaz·ωmax²·d (exact en régime établi)
  const Ku = (p) => 4 * p.Lb * p.kT * p.gas * p.wmax * p.wmax;
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = r(); if (u < 1e-300) u = 1e-300; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  // ---------------------------------------------------------------- nombres complexes et fonctions de transfert (analyse)
  const C = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }, abs: (a) => Math.hypot(a[0], a[1]), arg: (a) => Math.atan2(a[1], a[0]) };
  const R = (x) => [x, 0];
  // procédé linéarisé : angle / commande différentielle d
  function plant(p, w) { const s = [0, w]; const mech = C.add(C.add(C.mul(R(p.J), C.mul(s, s)), C.mul(R(p.f), s)), R(p.kG)); const mot = C.add(C.mul(R(p.tau), s), R(1)); const del = [Math.cos(-w * p.delay), Math.sin(-w * p.delay)]; return C.mul(C.div(R(Ku(p)), C.mul(mech, mot)), del); }
  function pid(c, w) { const s = [0, w]; let v = R(c.Kp); if (c.Ki) v = C.add(v, C.div(R(c.Ki), s)); if (c.Kd) v = C.add(v, C.div(C.mul(R(c.Kd), s), C.add(C.mul(R(c.Tf || 0.02), s), R(1)))); return v; }
  // boucle ouverte : 'pid' (une boucle sur l'angle) ou 'cascade' (boucle de vitesse interne fermée, puis boucle d'angle)
  function openLoop(p, ctl, w) {
    const P = plant(p, w);
    if (ctl.mode === 'pid') return C.mul(pid(ctl.ang, w), P);
    const s = [0, w], Pw = C.mul(P, s), Li = C.mul(pid(ctl.rate, w), Pw), Ti = C.div(Li, C.add(R(1), Li));
    return C.mul(C.mul(pid(ctl.ang, w), Ti), C.div(R(1), s));
  }
  // marges : pulsation de coupure (|L| = 1), marge de phase ; pulsation où la phase vaut −180°, marge de gain
  function margins(p, ctl) {
    const N = 4000, w0 = 0.01, w1 = 2000, ws = [], L = [];
    let prevPh = null;
    for (let k = 0; k <= N; k++) {
      const w = w0 * Math.pow(w1 / w0, k / N), l = openLoop(p, ctl, w); let a = C.arg(l);
      if (prevPh !== null) { while (a - prevPh > Math.PI) a -= 2 * Math.PI; while (a - prevPh < -Math.PI) a += 2 * Math.PI; }
      prevPh = a; ws.push(w); L.push([C.abs(l), a]);
    }
    let wc = null, pm = null, w180 = null, gm = null;
    const norm = (deg) => { let x = deg % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; };
    for (let k = 1; k <= N; k++) if (wc === null && L[k - 1][0] >= 1 && L[k][0] < 1) { const t = Math.log(L[k - 1][0]) / (Math.log(L[k - 1][0]) - Math.log(L[k][0])); wc = ws[k - 1] * Math.pow(ws[k] / ws[k - 1], t); pm = norm((L[k - 1][1] + t * (L[k][1] - L[k - 1][1])) / DEG + 180); }
    // marge de gain : première traversée de −180° (modulo 360°) au-delà de la coupure, phase décroissante
    const ph = (k) => { let x = (L[k][1] / DEG) % 360; if (x > 0) x -= 360; return x; }; // dans ]−360, 0]
    for (let k = 1; k <= N; k++) {
      if (wc !== null && ws[k] < wc) continue;
      const a0 = ph(k - 1), a1 = ph(k);
      if (a0 > -180 && a1 <= -180 && a0 - a1 < 180) { const t = (a0 + 180) / (a0 - a1); w180 = ws[k - 1] * Math.pow(ws[k] / ws[k - 1], t); const mag = L[k - 1][0] * Math.pow(L[k][0] / L[k - 1][0], t); gm = -20 * Math.log10(mag); break; }
    }
    return { wc, pm, w180, gm, ws, L };
  }

  // ---------------------------------------------------------------- petites matrices (LQR)
  const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const madd = (A, B, s = 1) => A.map((r, i) => r.map((v, j) => v + s * B[i][j]));
  const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  function inv(A) { const n = A.length, M = A.map((r, i) => r.concat(eye(n)[i])); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; } } return M.map((r) => r.slice(n)); }
  // modèle d'état linéarisé : x = [θ, θ', m (commande vue par les moteurs), z = ∫(θc − θ)]
  function stateModel(p) { const k = Ku(p); return { A: [[0, 1, 0, 0], [-p.kG / p.J, -p.f / p.J, k / p.J, 0], [0, 0, -1 / p.tau, 0], [-1, 0, 0, 0]], B: [[0], [0], [1 / p.tau], [0]] }; }
  // LQR à temps discret (période dt) : itération de l'équation de Riccati
  function lqr(p, q, rw, dt) {
    const { A, B } = stateModel(p), n = 4, Ad = madd(eye(n), A.map((r) => r.map((v) => v * dt))), Bd = B.map((r) => r.map((v) => v * dt));
    const Q = [[q[0], 0, 0, 0], [0, q[1], 0, 0], [0, 0, q[2], 0], [0, 0, 0, q[3]]]; let Pm = Q, K = null, res = Infinity;
    for (let it = 0; it < 20000; it++) {
      const BtP = mm(tr(Bd), Pm), S = madd([[rw]], mm(BtP, Bd)); K = mm(inv(S), mm(BtP, Ad));
      const Pn = madd(Q, madd(mm(mm(tr(Ad), Pm), Ad), mm(mm(tr(mm(BtP, Ad)), inv(S)), mm(BtP, Ad)), -1));
      res = Math.max(...Pn.flat().map((v, i) => Math.abs(v - Pm.flat()[i]))); Pm = Pn; if (res < 1e-11) break;
    }
    const Acl = madd(Ad, mm(Bd, K), -1);
    return { K: K[0], P: Pm, res, Acl, dt };
  }
  // rayon spectral (puissances itérées sur une matrice réelle : plus grand |valeur propre| estimé)
  function spectralRadius(A) { let v = A.map(() => [1]), lam = 0; for (let k = 0; k < 4000; k++) { const w = mm(A, v), n = Math.hypot(...w.flat()); lam = Math.pow(n, 1); v = w.map((r) => [r[0] / n]); } return lam; }

  // ---------------------------------------------------------------- simulation temps réel (pas fin 1 ms, régulation à 200 Hz)
  // o : { p, ctl: { mode: 'pid'|'cascade'|'lqr', ang:{Kp,Ki,Kd}, rate:{Kp,Ki,Kd}, lqr:{q, r}, antiWindup }, est: 'true'|'gyro'|'acc'|'comp'|'kalman',
  //       ref(t) (rad), T, dist: { gust: [t, durée, couple], mass: [t, couple], prop: [t, perte] }, noise: bool, seed, comp: { tc }, kal: { q, qb, r } }
  const CTL0 = { mode: 'cascade', ang: { Kp: 3, Ki: 0, Kd: 0 }, rate: { Kp: 0.16, Ki: 0.15, Kd: 0, Tf: 0.02 }, antiWindup: true, lqr: { q: [1000, 15, 0, 25], r: 1 } };
  function simulate(o) {
    const p = Object.assign({}, P0, o.p || {}), ctl = Object.assign({}, CTL0, o.ctl || {}), r = rng(o.seed || 1), T = o.T || 10, dtc = 0.005, h = 0.001;
    const ref = o.ref || ((t) => (t > 0.5 ? 20 * DEG : 0)), dist = o.dist || {}, noise = o.noise !== false;
    const comp = Object.assign({ tc: 0.5 }, o.comp || {}), kal = Object.assign({ q: 1e-5, qb: 1e-6, r: 2.5e-3 }, o.kal || {});
    let th = (o.th0 || 0) * DEG, w = 0, w1 = p.gas * p.wmax, w2 = w1, u1 = p.gas, u2 = p.gas;
    let bias = noise ? 0.03 : 0, iA = 0, iR = 0, prevE = 0, dF = 0, est = th, kx = [th, 0], kP = [[1e-3, 0], [0, 1e-2]], z = 0, gyroInt = th;
    let K = null; if (ctl.mode === 'lqr') K = lqr(p, ctl.lqr.q, ctl.lqr.r, dtc).K;
    const out = { t: [], th: [], ref: [], est: [], acc: [], gyro: [], u1: [], u2: [], w1: [], w2: [], d: [], bias: [], kbias: [] };
    let nextC = 0, d = 0, acc = 0, gyro = 0, pending = [], lastAccMeas = 0;
    const steps = Math.round(T / h);
    for (let k = 0; k <= steps; k++) {
      const t = k * h;
      // perturbations
      let Cd = 0; if (dist.gust && t >= dist.gust[0] && t < dist.gust[0] + dist.gust[1]) Cd += dist.gust[2];
      if (dist.mass && t >= dist.mass[0]) Cd += -dist.mass[1] * Math.cos(th);
      const eff2 = dist.prop && t >= dist.prop[0] ? 1 - dist.prop[1] : 1;
      // dynamique (Euler semi-implicite au pas de 1 ms)
      const F1 = p.kT * w1 * w1, F2 = eff2 * p.kT * w2 * w2;
      let acc_ang = (p.Lb * (F2 - F1) - p.f * w - p.kG * Math.sin(th) + Cd) / p.J;
      w += acc_ang * h; th += w * h;
      if (th > p.stop) { th = p.stop; if (w > 0) w = -0.2 * w; } if (th < -p.stop) { th = -p.stop; if (w < 0) w = -0.2 * w; }
      w1 += ((u1 * p.wmax) - w1) * h / p.tau; w2 += ((u2 * p.wmax) - w2) * h / p.tau;
      if (noise) bias += 0.002 * Math.sqrt(h) * gauss(r);
      // régulation à 200 Hz
      if (t >= nextC - 1e-12) {
        nextC += dtc;
        gyro = w + (noise ? bias + 0.02 * gauss(r) : 0);
        const vib = noise ? (0.03 + 0.08 * (w1 + w2) / (2 * p.wmax)) * gauss(r) : 0;
        acc = th + vib + 0.02 * acc_ang / G; // capteur à 2 cm de l'axe : l'accélération tangentielle fausse la mesure
        lastAccMeas = acc;
        gyroInt += gyro * dtc;
        // estimation
        const a = comp.tc / (comp.tc + dtc); const compEst = a * ((o._comp === undefined ? (o._comp = th) : o._comp) + gyro * dtc) + (1 - a) * acc; o._comp = compEst;
        // Kalman (angle, biais du gyromètre)
        kx = [kx[0] + (gyro - kx[1]) * dtc, kx[1]]; const F = [[1, -dtc], [0, 1]];
        let Pp = mm(mm(F, kP), tr(F)); Pp[0][0] += kal.q; Pp[1][1] += kal.qb;
        const S = Pp[0][0] + kal.r, Kk = [Pp[0][0] / S, Pp[1][0] / S], innov = acc - kx[0];
        kx = [kx[0] + Kk[0] * innov, kx[1] + Kk[1] * innov]; kP = [[(1 - Kk[0]) * Pp[0][0], (1 - Kk[0]) * Pp[0][1]], [Pp[1][0] - Kk[1] * Pp[0][0], Pp[1][1] - Kk[1] * Pp[0][1]]];
        est = o.est === 'gyro' ? gyroInt : o.est === 'acc' ? acc : o.est === 'comp' ? compEst : o.est === 'true' ? th : kx[0];
        const rateMeas = o.est === 'kalman' || o.est === undefined ? gyro - kx[1] : o.est === 'true' ? w : gyro;
        const thc = ref(t), e = thc - est;
        // commande
        if (ctl.mode === 'pid') {
          // dérivée filtrée (même filtre 1/(1 + Tf·p) que dans l'analyse fréquentielle), appliquée à la vitesse mesurée
          dF = dF + (rateMeas - dF) * dtc / (dtc + (ctl.ang.Tf || 0.02));
          d = ctl.ang.Kp * e + ctl.ang.Ki * iA - (ctl.ang.Kd || 0) * dF;
          const sat = Math.max(-p.gas, Math.min(p.gas, d)); if (!ctl.antiWindup || sat === d || Math.sign(e) !== Math.sign(d)) iA += e * dtc; d = sat;
        } else if (ctl.mode === 'cascade') {
          let wr = ctl.ang.Kp * e + ctl.ang.Ki * iA; wr = Math.max(-3, Math.min(3, wr)); iA += e * dtc;
          if (ctl.antiWindup && Math.abs(ctl.ang.Kp * e + ctl.ang.Ki * iA) > 3) iA -= e * dtc;
          const er = wr - rateMeas; d = ctl.rate.Kp * er + ctl.rate.Ki * iR;
          const sat = Math.max(-p.gas, Math.min(p.gas, d)); if (!ctl.antiWindup || sat === d || Math.sign(er) !== Math.sign(d)) iR += er * dtc; d = sat;
        } else {
          z += (thc - est) * dtc;
          const m = (w2 - w1) / (2 * p.wmax); // état moteur : mesuré par les capteurs de vitesse des hélices (infrarouge sur le banc)
          d = -(K[0] * (est - thc) + K[1] * rateMeas + K[2] * m + K[3] * z);
          d = Math.max(-p.gas, Math.min(p.gas, d));
        }
        // retard de calcul/transmission : la commande est appliquée au pas suivant
        pending.push([t + p.delay, d]);
        if (k % 10 === 0 || true) { out.t.push(t); out.th.push(th); out.ref.push(thc); out.est.push(est); out.acc.push(acc); out.gyro.push(gyro); out.u1.push(u1); out.u2.push(u2); out.w1.push(w1); out.w2.push(w2); out.d.push(d); out.bias.push(bias); out.kbias.push(kx[1]); }
      }
      while (pending.length && pending[0][0] <= t + 1e-12) { const dd = pending.shift()[1]; u1 = Math.max(0, Math.min(1, p.gas - dd)); u2 = Math.max(0, Math.min(1, p.gas + dd)); }
    }
    delete o._comp;
    return out;
  }
  // indicateurs d'une réponse indicielle (échelon de θ0 à θ1 à l'instant ts)
  function stepInfo(out, ts, th1, th0) {
    const i0 = out.t.findIndex((t) => t >= ts), amp = th1 - (th0 || 0), y = out.th.map((v) => (v - (th0 || 0)) / amp);
    let peak = -Infinity, tr = null, t5 = null; for (let k = i0; k < y.length; k++) { peak = Math.max(peak, y[k]); if (tr === null && y[k] >= 0.9) tr = out.t[k] - ts; }
    for (let k = y.length - 1; k >= i0; k--) if (Math.abs(y[k] - 1) > 0.05) { t5 = (k + 1 < y.length ? out.t[k + 1] : out.t[k]) - ts; break; }
    if (t5 === null) t5 = 0;
    const n = Math.max(1, Math.floor(0.1 * (y.length - i0)));
    const fin = y.slice(-n).reduce((s, v) => s + v, 0) / n;
    return { overshoot: Math.max(0, (peak - 1) * 100), tr, t5, err: (1 - fin) * Math.abs(amp) / DEG };
  }

  // ---------------------------------------------------------------- identification (modèle ARX du 2e ordre sur la vitesse angulaire)
  // essai : commande différentielle en signal binaire pseudo-aléatoire (SBPA), mesure du gyromètre.
  // vitesse(p)/d(p) = Ku / ((J p + f)(τ p + 1))  →  y_k = a1·y_{k-1} + a2·y_{k-2} + b1·u_{k-1} + b2·u_{k-2}
  function identify(o) {
    const p = Object.assign({}, P0, o.p || {}), r = rng(o.seed || 7); let dt = 0.005, n = Math.round((o.T || 60) / dt); const amp = o.amp || 0.006, noise = o.noise === undefined ? 0.02 : o.noise;
    let th = 0, w = 0, w1 = p.gas * p.wmax, w2 = w1, u = 0, y = [], U = [], hold = 0, hit = false; const nRaw = n;
    for (let k = 0; k < nRaw; k++) {
      if (hold-- <= 0) { u = (r() < 0.5 ? -1 : 1) * amp; hold = 20 + Math.floor(r() * 80); }
      // petit retour de position très lent pour garder le bras loin des butées (n'intervient qu'au-delà de ±25°)
      const guard = Math.abs(th) > 25 * DEG ? -0.05 * Math.sign(th) : 0, ui = u + guard;
      for (let s = 0; s < 5; s++) { const h = dt / 5, F1 = p.kT * w1 * w1, F2 = p.kT * w2 * w2; w += ((p.Lb * (F2 - F1) - p.f * w - p.kG * Math.sin(th)) / p.J) * h; th += w * h; if (Math.abs(th) > p.stop) hit = true; w1 += ((p.gas - ui) * p.wmax - w1) * h / p.tau; w2 += ((p.gas + ui) * p.wmax - w2) * h / p.tau; }
      U.push(ui); y.push(w + noise * gauss(r));
    }
    // sous-échantillonnage à 50 Hz (moyenne de 4 mesures, filtre anti-repliement) : à 200 Hz deux échantillons voisins
    // sont presque égaux et les moindres carrés sont mal conditionnés
    const D = o.decim || 4, yd = [], Ud = []; for (let k = 0; k + D <= y.length; k += D) { let a = 0; for (let j = 0; j < D; j++) a += y[k + j]; yd.push(a / D); Ud.push(U[k]); }
    y = yd; U = Ud; dt = dt * D; n = y.length;
    // moindres carrés ordinaires, puis variables instrumentales (le bruit de mesure biaise les moindres carrés quand
    // les sorties passées servent de régresseurs ; les instruments sont les sorties d'un modèle simulé, non bruitées)
    const Phi = [], Y = []; for (let k = 2; k < n; k++) { Phi.push([y[k - 1], y[k - 2], U[k - 1], U[k - 2]]); Y.push([y[k]]); }
    const ls = mm(inv(mm(tr(Phi), Phi)), mm(tr(Phi), Y)).map((v) => v[0]);
    let thv = ls.slice();
    if (o.method !== 'ls') for (let it = 0; it < 5; it++) {
      const x = [0, 0]; for (let k = 2; k < n; k++) x.push(thv[0] * x[k - 1] + thv[1] * x[k - 2] + thv[2] * U[k - 1] + thv[3] * U[k - 2]);
      if (!x.every(Number.isFinite)) break;
      const Z = []; for (let k = 2; k < n; k++) Z.push([x[k - 1], x[k - 2], U[k - 1], U[k - 2]]);
      const nv = mm(inv(mm(tr(Z), Phi)), mm(tr(Z), Y)).map((v) => v[0]);
      if (!nv.every(Number.isFinite)) break; thv = nv;
    }
    const conv = (q) => {
      const [a1, a2, b1, b2] = q, disc = a1 * a1 + 4 * a2, z1 = (a1 + Math.sqrt(Math.max(0, disc))) / 2, z2 = (a1 - Math.sqrt(Math.max(0, disc))) / 2;
      const s1 = Math.log(Math.abs(z1)) / dt, s2 = Math.log(Math.abs(z2)) / dt, gain = (b1 + b2) / (1 - a1 - a2);
      const pm = Math.max(s1, s2), pmot = Math.min(s1, s2), f = Ku(p) / gain; // pôle mécanique (lent), pôle moteur (rapide)
      return { a1, a2, b1, b2, f, J: f / -pm, tau: -1 / pmot };
    };
    // choix du modèle : celui dont la simulation libre colle le mieux à la MESURE (ce qu'on peut faire sur le vrai banc)
    const simErr = (q) => { if (!q.every(Number.isFinite)) return Infinity; const x = [y[0], y[1]]; let e = 0; for (let k = 2; k < n; k++) { const v = q[0] * x[k - 1] + q[1] * x[k - 2] + q[2] * U[k - 1] + q[3] * U[k - 2]; x.push(v); e += (v - y[k]) ** 2; } return Number.isFinite(e) ? e : Infinity; };
    const eIV = simErr(thv), eLS = simErr(ls), useIV = o.method !== 'ls' && eIV <= eLS;
    const est = conv(useIV ? thv : ls), estLS = conv(ls), estIV = conv(thv), { a1, a2, b1, b2 } = est, JId = est.J, fId = est.f, tauId = est.tau;
    // qualité : ajustement en simulation libre du modèle identifié, comparé à la vitesse vraie (sans bruit)
    const ys = [y[0], y[1]]; for (let k = 2; k < n; k++) ys.push(a1 * ys[k - 1] + a2 * ys[k - 2] + b1 * U[k - 1] + b2 * U[k - 2]);
    const truth = []; { let w_ = 0, wa = p.gas * p.wmax, wb = wa; for (let k = 0; k < n; k++) { truth.push(w_); for (let s2 = 0; s2 < 5; s2++) { const h = dt / 5; w_ += ((p.Lb * p.kT * (wb * wb - wa * wa) - p.f * w_ - p.kG * 0) / p.J) * h; wa += ((p.gas - U[k]) * p.wmax - wa) * h / p.tau; wb += ((p.gas + U[k]) * p.wmax - wb) * h / p.tau; } } }
    let se = 0, sy = 0; for (let k = 0; k < n; k++) { se += (ys[k] - truth[k]) ** 2; sy += truth[k] ** 2; }
    return { ls: estLS, iv: estIV, method: useIV ? 'iv' : 'ls', a1, a2, b1, b2, J: JId, f: fId, tau: tauId, fit: 100 * (1 - Math.sqrt(se / sy)), y, U, ys, dt, hit, truth: { J: p.J, f: p.f, tau: p.tau } };
  }
  return { DEG, P0, CTL0, Ku, plant, pid, openLoop, margins, stateModel, lqr, spectralRadius, simulate, stepInfo, identify, rng, gauss, C };
});
