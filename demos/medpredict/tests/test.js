/* Vérifications du moteur JS de la démo MedPredict : node tests/test.js */
'use strict';
const M = require('../medpredict.js');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('ÉCHEC : ' + m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m} (${a} ≠ ${b})`);

// Mêmes résultats que le code Python du dépôt sur le parc d'exemple
const d = M.lireCSV(M.EXEMPLE);
ok(d.durees.length === 40 && d.panne.filter(Boolean).length === 24, '40 appareils, 24 pannes');
const f = M.ajusterWeibull(d.durees, d.panne);
near(f.beta, 3.594677970999644, 1e-9, 'β = Python');
near(f.eta, 4180.324224956502, 1e-6, 'η = Python');
near(M.mtbf(f.beta, f.eta), 3766.612679517375, 1e-6, 'MTBF = Python');
near(M.dureeBp(10, f.beta, f.eta), 2235.2683580040616, 1e-6, 'B10 = Python');
const o = M.intervalleOptimal(f.beta, f.eta, 150, 1200);
near(o.T, 1869.1423396342425, 1e-3, 'âge optimal = Python');
near(o.cout, 0.11184691012431508, 1e-9, 'coût optimal = Python');
// Formules
near(M.gamma(5), 24, 1e-9, 'Γ(5) = 24'); near(M.gamma(1.5), Math.sqrt(Math.PI) / 2, 1e-12, 'Γ(1,5)');
near(M.fiabilite(4200, 2.3, 4200), Math.exp(-1), 1e-15, 'R(η) = e⁻¹');
near(M.fiabilite(M.dureeBp(10, 2.3, 4200), 2.3, 4200), 0.9, 1e-12, 'R(B10) = 90 %');
near(M.mtbf(1, 500), 500, 1e-9, 'exponentielle : MTBF = η');
// Estimation sur de grands parcs générés
for (const [b, e] of [[0.8, 1500], [2.3, 4200], [4, 6000]]) {
  const g = M.genererParc(20000, b, e, 3 * e, 7);
  const r = M.ajusterWeibull(g.durees, g.panne);
  ok(Math.abs(r.beta - b) / b < 0.04 && Math.abs(r.eta - e) / e < 0.04, `estimation avec censure (${b}, ${e}) → ${r.beta.toFixed(3)}, ${r.eta.toFixed(0)}`);
}
// Optimum = recherche exhaustive ; cas où le préventif ne sert à rien
for (const b of [1.8, 2.3, 4]) {
  const r = M.intervalleOptimal(b, 4200, 150, 1200);
  let best = Infinity; for (let T = 100; T < 12000; T += 2) best = Math.min(best, M.coutHoraire(T, b, 4200, 150, 1200));
  ok(Math.abs(r.cout - best) / best < 1e-3, `optimum β ${b}`);
}
ok(M.intervalleOptimal(1, 4200, 150, 1200) === null && M.intervalleOptimal(0.7, 4200, 150, 1200) === null, 'β ≤ 1 : pas de préventif');
ok(M.intervalleOptimal(2.3, 4200, 1200, 1200) === null, 'préventif aussi cher que la panne : inutile');
// Kaplan-Meier et CSV
const km = M.kaplanMeier([5, 3, 9, 1, 7], [true, true, true, true, true]);
ok(JSON.stringify(km.ys.map((x) => +x.toFixed(10))) === JSON.stringify([0.8, 0.6, 0.4, 0.2, 0]), 'Kaplan-Meier sans censure');
const c = M.lireCSV('a;12,5;panne\nb;abc;panne\nc;30;en_service');
ok(c.durees.length === 2 && c.erreurs.length === 1 && c.durees[0] === 12.5, 'CSV point-virgule, virgule décimale, ligne invalide');
console.log(`${n} vérifications, ${bad} échec(s)`);
process.exit(bad ? 1 : 0);
