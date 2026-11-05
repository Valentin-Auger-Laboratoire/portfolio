// Tests du moteur de la démo (node tests/test.js) : mêmes résultats que simulation.py du dépôt generatrice-eolienne-arduino.
'use strict';
const E = require('../eolienne.js');
let n = 0, ko = 0;
function ok(cond, msg) { n++; if (!cond) { ko++; console.log('ÉCHEC : ' + msg); } }
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// constantes du montage
ok(near(E.K.rapport, 4.3, 1e-12), 'pont 33 k / 10 k = ×4,3');
ok(E.GUSTS.length === 8, '8 composantes de rafales');
ok(E.can(0) === 0 && E.can(-3) === 0 && E.can(5) === 1023 && E.can(9) === 1023 && E.can(2.5) === 511, 'CAN 10 bits borné 0–1023');
ok(E.wind(10, 5, 0) === 5, 'vent constant');
let wmin = Infinity; for (let t = 0; t < 300; t += 0.1) wmin = Math.min(wmin, E.wind(t, 2, 1.5)); ok(wmin >= 0, 'vent jamais négatif');

// cas de référence de simulation.py : 5 m/s en rafales, 120 s
const ref = E.summary(5, 1, 120);
ok(ref.ch24 === 608, '2024 : 608 commutations (obtenu ' + ref.ch24 + ')');
ok(ref.ch26 === 30, '2026 : 30 commutations (obtenu ' + ref.ch26 + ')');
ok(near(ref.over5, 0.07, 0.005), 'A0 > 5 V environ 7 % du temps (obtenu ' + (ref.over5 * 100).toFixed(2) + ' %)');

// tableau de comparaison
for (const [m, a, b] of [[3, 554, 16], [4, 552, 28], [6, 579, 26], [8, 623, 7]]) {
  const r = E.summary(m, 1, 120); ok(r.ch24 === a && r.ch26 === b, m + ' m/s : ' + a + ' / ' + b + ' (obtenu ' + r.ch24 + ' / ' + r.ch26 + ')');
}
// vent constant : effet stroboscopique (20 Hz lu toutes les 100 ms) → presque toujours le même point de la sinusoïde
const cst = E.summary(5, 0, 120);
ok(cst.ch24 === 6 && cst.ch26 === 0, 'vent constant 5 m/s : 6 / 0 (obtenu ' + cst.ch24 + ' / ' + cst.ch26 + ')');

// 2026 : hystérésis 3,0 / 2,5 V et 2 s minimum entre deux commutations
{
  const s = E.createSim({ mean: 5, gust: 1 }); let prev = s.r26, lastT = -10, gapOk = true, hystOk = true;
  while (s.t < 120) {
    s.step();
    if (s.r26 !== prev) {
      if (s.t - lastT < 2.0 - 1e-9) gapOk = false;
      if (s.r26 && !(s.m26 > 3.0)) hystOk = false;
      if (!s.r26 && !(s.m26 < 2.5)) hystOk = false;
      lastT = s.t; prev = s.r26;
    }
  }
  ok(gapOk, '2026 : au moins 2 s entre deux commutations');
  ok(hystOk, '2026 : fermeture au-dessus de 3,0 V, ouverture sous 2,5 V');
  ok(s.buf.length === 8, '2026 : moyenne sur 8 mesures');
}
// 2024 : seuil analogRead > 100, une lecture toutes les 100 ms, format du moniteur série
{
  const s = E.createSim({ mean: 5, gust: 1 }); let reads = 0, prev = s.next24, thrOk = true;
  while (s.t < 10) { s.step(); if (s.next24 !== prev) { reads++; prev = s.next24; if (s.r24 !== (s.raw24 > 100)) thrOk = false; } }
  ok(reads === 100, '2024 : 100 lectures en 10 s (obtenu ' + reads + ')');
  ok(thrOk, '2024 : relais = analogRead > 100');
  ok(s.serial24.every((l) => /^Tension lue: \d{1,4}$/.test(l.m)), '2024 : « Tension lue: N »');
  ok(s.serial26.every((l) => /^\d+,\d+\.\d\d,\d+\.\d\d,[01]$/.test(l.m)), '2026 : CSV t_ms,tension,moyenne,relais');
  ok(s.serial26.length === 20, '2026 : une ligne toutes les 0,5 s');
}
// redressement : jamais de tension sur A0 au-delà de 5 V en 2026 jusqu'à 12 m/s de moyenne
{
  const s = E.createSim({ mean: 12, gust: 1 }); let maxA0 = 0;
  while (s.t < 60) { s.step(); maxA0 = Math.max(maxA0, (s.vc * E.K.rBas) / (E.K.rHaut + E.K.rBas)); }
  ok(maxA0 < 5, '2026 : A0 < 5 V même à 12 m/s (max ' + maxA0.toFixed(2) + ' V)');
}
// puissance
ok(near(E.power(0.2, 5), 0.4712, 5e-4), 'P(20 cm, 5 m/s, Cp 0,2) ≈ 0,47 W');
ok(near(E.power(0.2, 10) / E.power(0.2, 5), 8, 1e-12), 'P en v³');
ok(near(E.power(0.4, 5) / E.power(0.2, 5), 4, 1e-12), 'P en D²');
ok(E.power(0.2, 5, 0) === 0, 'Cp = 0 → 0');

console.log(n - ko + ' / ' + n + ' tests réussis');
process.exit(ko ? 1 : 0);
