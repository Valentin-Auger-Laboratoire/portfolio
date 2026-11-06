// Tests du drone en tangage (node tests/test.js)
'use strict';
const D = require('../drone.js');
const DEG = D.DEG, P = D.P0;
let n = 0, ko = 0; const fails = [];
function ok(c, m) { n++; if (!c) { ko++; fails.push(m); } }
const near = (a, b, t) => Math.abs(a - b) <= t;
const rel = (a, b, t) => Math.abs(a - b) <= t * Math.max(Math.abs(a), Math.abs(b));

// ------------------------------------------------------------ modèle
ok(near(D.Ku(P), 0.6, 1e-12), 'gain de couple 4·Lb·kT·gaz·ωmax² = 0,6 N·m par unité de commande');
for (const g of [0.15, 0.25, 0.4]) for (const d of [0.02, 0.05, 0.1]) { const p = Object.assign({}, P, { gas: g }), w1 = (g - d) * p.wmax, w2 = (g + d) * p.wmax; ok(rel(p.Lb * p.kT * (w2 * w2 - w1 * w1), D.Ku(p) * d, 1e-12), 'commande symétrique : le couple est exactement linéaire en d (gaz ' + g + ', d ' + d + ')'); }
{
  // boucle ouverte (sans régulation) : réponse du bras à un couple constant = solution exacte du 1er ordre en vitesse
  const p = Object.assign({}, P, { delay: 0 }), o = D.simulate({ p, noise: false, ctl: { mode: 'pid', ang: { Kp: 0, Ki: 0, Kd: 0 } }, ref: () => 0, T: 3, dist: { gust: [0, 10, 0.004] } });
  const k = o.t.findIndex((t) => t >= 2), wExact = (0.004 / p.f) * (1 - Math.exp((-p.f / p.J) * 2)), wSim = (o.th[k + 1] - o.th[k - 1]) / (o.t[k + 1] - o.t[k - 1]);
  ok(rel(wSim, wExact, 0.01), 'couple constant : vitesse du bras = solution exacte (' + wSim.toFixed(4) + ' / ' + wExact.toFixed(4) + ' rad/s)');
}
{
  const o = D.simulate({ noise: false, ctl: { mode: 'pid', ang: { Kp: 0, Ki: 0, Kd: 0 } }, ref: () => 0, T: 4, dist: { gust: [0, 10, 0.3] } });
  ok(Math.max(...o.th) <= P.stop + 1e-9, 'butée mécanique à 45° respectée');
}
// ------------------------------------------------------------ analyse fréquentielle
{
  const w = 2.7, Pj = D.plant(Object.assign({}, P, { delay: 0 }), w), s = w; // |P| = Ku / (|J s² + f s| · |τ s + 1|)
  const mag = D.Ku(P) / (Math.hypot(-P.J * s * s, P.f * s) * Math.hypot(1, P.tau * s));
  ok(rel(D.C.abs(Pj), mag, 1e-12), 'module du procédé = formule exacte');
  const m = D.margins(P, D.CTL0);
  ok(m.pm > 40 && m.pm < 90 && m.gm > 6, 'cascade par défaut : marge de phase ' + m.pm.toFixed(0) + '°, marge de gain ' + m.gm.toFixed(1) + ' dB');
  ok(near(D.C.abs(D.openLoop(P, D.CTL0, m.wc)), 1, 1e-3), '|L(jωc)| = 1 à la pulsation de coupure');
  // marges vérifiées en simulation : on multiplie le gain de boucle par la marge de gain calculée
  const dev = (ctl) => { const o = D.simulate({ ctl, noise: false, T: 12, ref: (t) => (t > 0.5 ? 5 * DEG : 0) }); const k0 = o.t.findIndex((t) => t > 8); let mx = 0; for (let k = k0; k < o.th.length; k++) mx = Math.max(mx, Math.abs(o.th[k] - 5 * DEG)); return mx / DEG; };
  const gP = D.margins(P, { mode: 'pid', ang: { Kp: 0.2, Ki: 0, Kd: 0.09 } }).gm, kP = Math.pow(10, gP / 20);
  ok(dev({ mode: 'pid', ang: { Kp: 0.2 * 0.8 * kP, Ki: 0, Kd: 0.09 * 0.8 * kP } }) < 0.05 && dev({ mode: 'pid', ang: { Kp: 0.2 * 1.2 * kP, Ki: 0, Kd: 0.09 * 1.2 * kP } }) > 0.5, 'PID : simulation stable à 0,8 × la marge de gain calculée, oscillante à 1,2 × (marge ' + gP.toFixed(1) + ' dB)');
  const kC = Math.pow(10, m.gm / 20), casc = (f) => ({ mode: 'cascade', ang: { Kp: 3 * f * kC, Ki: 0 }, rate: { Kp: 0.16, Ki: 0.15 } });
  ok(dev(casc(0.8)) < 0.05 && dev(casc(1.5)) > 1, 'cascade : stable à 0,8 × la marge, oscillante à 1,5 × (la limite de vitesse retarde un peu l\'instabilité)');
}
// ------------------------------------------------------------ régulation
{
  const s = D.stepInfo(D.simulate({ noise: false, T: 8 }), 0.5, 20 * DEG);
  ok(s.overshoot < 5 && s.t5 < 1 && Math.abs(s.err) < 0.1, 'cascade : échelon de 20° en ' + s.t5.toFixed(2) + ' s, dépassement ' + s.overshoot.toFixed(1) + ' %, erreur ' + s.err.toFixed(2) + '°');
  const l = D.stepInfo(D.simulate({ noise: false, T: 8, ctl: { mode: 'lqr' } }), 0.5, 20 * DEG);
  ok(l.overshoot < 8 && l.t5 < 1 && Math.abs(l.err) < 0.5, 'LQR : échelon de 20° en ' + l.t5.toFixed(2) + ' s, dépassement ' + l.overshoot.toFixed(1) + ' %');
  const pd = D.stepInfo(D.simulate({ noise: false, T: 8, ctl: { mode: 'pid', ang: { Kp: 0.2, Ki: 0, Kd: 0.09 } } }), 0.5, 20 * DEG);
  ok(pd.t5 > s.t5, 'PID simple plus lent que la cascade (' + pd.t5.toFixed(2) + ' s / ' + s.t5.toFixed(2) + ' s)');
}
{
  // hélice qui perd 20 % de poussée : seule une action intégrale annule l'erreur
  const dist = { prop: [1, 0.2] }, fin = (ctl) => { const o = D.simulate({ ctl, noise: false, T: 15, ref: () => 0, dist }); return Math.abs(o.th[o.th.length - 1]) / DEG; };
  const pd = fin({ mode: 'pid', ang: { Kp: 0.2, Ki: 0, Kd: 0.09 } }), cas = fin(D.CTL0), lq = fin({ mode: 'lqr' }), casP = fin({ mode: 'cascade', ang: { Kp: 3, Ki: 0 }, rate: { Kp: 0.16, Ki: 0 } });
  ok(pd > 1, 'hélice affaiblie, PD : erreur permanente de ' + pd.toFixed(2) + '°');
  ok(casP > 0.5, 'hélice affaiblie, cascade sans intégrale : erreur de ' + casP.toFixed(2) + '°');
  ok(cas < 0.1 && lq < 0.1, 'hélice affaiblie, cascade PI et LQR intégral : erreur annulée (' + cas.toFixed(3) + '° / ' + lq.toFixed(3) + '°)');
  // erreur du PD prévue par l'équilibre des couples : 0,8·(g + d)² = (g − d)²  →  d = g·(1 − √0,8)/(1 + √0,8), e = d / Kp
  const dEq = (P.gas * (1 - Math.sqrt(0.8))) / (1 + Math.sqrt(0.8)), ePred = dEq / 0.2 / DEG;
  ok(rel(pd, ePred, 0.02), 'erreur du PD = commande d\'équilibre / Kp (' + pd.toFixed(3) + '° / ' + ePred.toFixed(3) + '° prévu)');
}
{
  // rafale : la cascade la rejette mieux que le PID simple
  const peak = (ctl) => { const o = D.simulate({ ctl, noise: false, T: 6, ref: () => 0, dist: { gust: [1, 0.3, 0.05] } }); return Math.max(...o.th.map(Math.abs)) / DEG; };
  const a = peak({ mode: 'pid', ang: { Kp: 0.2, Ki: 0, Kd: 0.09 } }), b = peak(D.CTL0);
  ok(b < a, 'rafale de 0,05 N·m pendant 0,3 s : écart maxi ' + b.toFixed(1) + '° en cascade contre ' + a.toFixed(1) + '° en PID simple');
}
{
  // anti-emballement : avec une saturation, l'intégrale bloquée réduit le dépassement
  const big = (aw) => D.stepInfo(D.simulate({ noise: false, T: 10, ctl: { mode: 'pid', ang: { Kp: 0.6, Ki: 0.6, Kd: 0.15 }, antiWindup: aw }, ref: (t) => (t > 0.5 ? 20 * DEG : -20 * DEG), th0: -20 }), 0.5, 20 * DEG, -20 * DEG).overshoot;
  const a = big(false), b = big(true); ok(b < a, 'échelon de 80° saturant : dépassement ' + b.toFixed(1) + ' % avec anti-emballement, ' + a.toFixed(1) + ' % sans');
}
// ------------------------------------------------------------ capteurs et estimation
{
  const res = {}; for (const e of ['true', 'gyro', 'acc', 'comp', 'kalman']) { const o = D.simulate({ est: e, T: 30, ref: () => 10 * DEG, seed: 3 }); const k0 = o.t.findIndex((t) => t > 20); let s2 = 0, c = 0; for (let k = k0; k < o.th.length; k++) { s2 += (o.th[k] - 10 * DEG) ** 2; c++; } res[e] = Math.sqrt(s2 / c) / DEG; }
  ok(res.gyro > 5, 'gyromètre intégré seul : le biais fait dériver l\'angle (' + res.gyro.toFixed(1) + '°)');
  ok(res.kalman < 1 && res.comp < 1.5, 'fusion : erreur ' + res.kalman.toFixed(2) + '° (Kalman), ' + res.comp.toFixed(2) + '° (complémentaire)');
  ok(res.kalman < res.gyro / 10, 'Kalman au moins 10 fois meilleur que le gyromètre intégré');
}
{
  const o = D.simulate({ T: 40, ref: () => 0, seed: 5 }), k = o.t.length - 1;
  ok(near(o.kbias[k], o.bias[k], 0.01), 'Kalman : biais du gyromètre estimé (' + o.kbias[k].toFixed(4) + ' / ' + o.bias[k].toFixed(4) + ' rad/s)');
}
{
  // filtre complémentaire : sans bruit, suit l'angle vrai
  const o = D.simulate({ est: 'comp', noise: false, T: 8 }); const s = D.stepInfo(o, 0.5, 20 * DEG); ok(Math.abs(s.err) < 0.5, 'filtre complémentaire sans bruit : erreur finale ' + s.err.toFixed(2) + '°');
}
// ------------------------------------------------------------ LQR
{
  const l = D.lqr(P, [1000, 15, 0, 25], 1, 0.005);
  ok(l.res < 1e-9, 'équation de Riccati résolue (résidu ' + l.res.toExponential(1) + ')');
  ok(D.spectralRadius(l.Acl) < 1, 'boucle fermée LQR stable (rayon spectral ' + D.spectralRadius(l.Acl).toFixed(4) + ' < 1)');
  const l2 = D.lqr(P, [4000, 15, 0, 25], 1, 0.005); ok(l2.K[0] > l.K[0], 'pondérer plus l\'angle augmente le gain sur l\'angle');
  ok(l.P.every((r, i) => r.every((v, j) => near(v, l.P[j][i], 1e-6 * Math.max(1, Math.abs(v))))), 'matrice de Riccati symétrique');
}
// ------------------------------------------------------------ identification
{
  const id0 = D.identify({ noise: 0 });
  ok(rel(id0.J, P.J, 0.05) && rel(id0.tau, P.tau, 0.08) && rel(id0.f, P.f, 0.2), 'identification sans bruit : J = ' + id0.J.toFixed(4) + ', τ = ' + (id0.tau * 1000).toFixed(0) + ' ms, f = ' + id0.f.toFixed(4));
  let goodIV = 0, badLS = 0;
  for (const seed of [7, 8, 9, 10, 11]) { const id = D.identify({ noise: 0.02, seed }); if (rel(id.J, P.J, 0.05) && rel(id.tau, P.tau, 0.2)) goodIV++; if (!rel(id.ls.tau, P.tau, 0.5)) badLS++; ok(!id.hit, 'identification : le bras ne touche pas les butées (tirage ' + seed + ')'); }
  ok(goodIV >= 4, 'bruit de mesure : variables instrumentales justes ' + goodIV + ' fois sur 5 (J à 5 %, τ à 20 %)');
  ok(badLS >= 4, 'bruit de mesure : moindres carrés ordinaires biaisés sur τ ' + badLS + ' fois sur 5');
}

console.log(n - ko + ' / ' + n + ' tests réussis');
if (ko) { fails.forEach((f) => console.log('ÉCHEC : ' + f)); process.exit(1); }
