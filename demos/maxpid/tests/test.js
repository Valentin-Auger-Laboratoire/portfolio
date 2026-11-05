// Tests : node tests/test.js
const M = require('../maxpid.js');
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', n, i === undefined ? '' : i); } };
const near = (a, b, e) => Math.abs(a - b) <= e;
// cinématique (valeurs de docs/valeurs.md)
check('a²+b²+c² = 17 954,25', near(M.S2, 17954.25, 1e-9));
check('x(0) = 170,51 mm', near(M.X0, 170.51, 0.005));
for (const d of [0, 15, 30, 45, 60, 75, 90]) {
  const th = M.rad(d), P = M.points(th);
  check('fermeture géométrique à ' + d + '°', near(Math.hypot(P.C[0] - P.B[0], P.C[1] - P.B[1]), M.xOf(th), 1e-9));
  check('β(θ(β)) = β à ' + d + '°', near(M.thetaOf(M.betaOf(th)), th, 1e-9));
  const h = 1e-6; check('dβ/dθ dérivée numérique à ' + d + '°', near(M.dbetadth(th), (M.betaOf(th + h) - M.betaOf(th - h)) / (2 * h), 1e-4));
}
const TB = M.table();
check('pente des moindres carrés 3,4121 °/tour', near(TB.fit.slope, 3.4121, 5e-4), TB.fit.slope);
check('ordonnée à l’origine 7,32°', near(TB.fit.icpt, 7.32, 0.01), TB.fit.icpt);
check('décalage du tableur = une pente', near(TB.fit.icpt - TB.excel.icpt, TB.fit.slope, 0.01));
check('loi non linéaire : écart max ≈ 6,4°', near(TB.maxDev, 6.4, 0.1), TB.maxDev);
const d = TB.exact.map((e, i) => Math.abs(e - TB.rounded[i]));
check('écart arrondi / exact entre 0,56 et 0,95°', near(Math.min(...d), 0.56, 0.01) && near(Math.max(...d), 0.95, 0.01), [Math.min(...d), Math.max(...d)]);
check('course : 26 tours ≈ 92°', near(TB.exact[26], 92, 1.5), TB.exact[26]);
// moteur
const a = M.motorStep({ T: 1 });
check('Ke = 60/(2π·953)', near(M.MOTOR.Ke, 0.010020, 1e-6));
check('courant de démarrage ≈ U/R = 1,26 A', near(a.iMax, 1.26, 0.02), a.iMax);
check('τm ≈ 97 ms', near(a.tau, 0.097, 0.002) && near(a.t63, 0.097, 0.003), [a.tau, a.t63]);
check('courant à vide ≈ 20 mA en régime', near(a.i[a.i.length - 1], 0.02, 0.002), a.i[a.i.length - 1]);
check('vitesse à vide ≈ 11 200 tr/min > 8 700 de la fiche', a.wEnd * 60 / (2 * Math.PI) > 11000);
const s = M.motorStep(Object.assign({}, M.SIMSCAPE_2024, { T: 10, sample: 0.01, dt: 2e-4 }));
check('modèle 2024 : courant ≈ 0,63 A', near(s.i[s.i.length - 1], 0.63, 0.01));
check('modèle 2024 : rampe ≈ 8,3 rad/s à 10 s', near(s.w[s.w.length - 1], 8.3, 0.2), s.w[s.w.length - 1]);
check('inertie ×2 → τm ×2', near(M.motorStep({ J: 2e-6 }).tau, 2 * a.tau, 0.002));
// boucle fermée
const run = (mode, Kp, Ki, m) => M.stepInfo(M.axisSim({ ref: 60, th0: 20, T: 3, ctl: { mode, Kp, Ki }, arm: { m } }), 60, 20);
const p0 = run('P', 0.1, 0, 0), p1 = run('P', 0.1, 0, 0.1), pi1 = run('PI', 0.15, 0.15, 0.1);
check('P sans charge : erreur nulle', Math.abs(p0.err) < 0.3, p0.err);
check('P avec masse : erreur statique', p1.err > 5, p1.err);
check('PI avec masse : erreur annulée', Math.abs(pi1.err) < 0.3, pi1.err);
check('PI : dépassement modéré', pi1.overshoot < 20, pi1.overshoot);
check('courant de maintien croissant avec la masse', M.holdCurrent(20, { m: 0.2 }) > M.holdCurrent(20, { m: 0.1 }));
check('courant de maintien nul à 90°', near(M.holdCurrent(90, { m: 0.2 }), 0, 0.02));
const heavy = M.axisSim({ ref: 20, th0: 20, T: 2, ctl: { mode: 'PI', Kp: 0.15, Ki: 0.15 }, arm: { m: 0.3 } });
check('bras trop lourd : il tombe en butée basse et le moteur ne peut plus le relever', M.holdCurrent(0, { m: 0.3 }) > M.MOTOR.U / M.MOTOR.R && heavy.th[heavy.th.length - 1] < 1, heavy.th[heavy.th.length - 1]);
check('tension saturée à ±12 V', M.axisSim({ ref: 90, th0: 0, T: 1, ctl: { mode: 'P', Kp: 1 }, arm: { m: 0 } }).u.every((v) => Math.abs(v) <= 12));
console.log(ok + ' réussis, ' + ko + ' échoués');
process.exit(ko ? 1 : 0);
