/* Vérifications du moteur JS de la démo VitalWatch : node tests/test.js */
'use strict';
const V = require('../vitalwatch.js');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('ÉCHEC : ' + m); } };

// NEWS2 : mêmes bornes que le test Python
[[[15, 97, false, 120, 70, true, 37], 0], [[8, 97, false, 120, 70, true, 37], 3], [[9, 97, false, 120, 70, true, 37], 1], [[21, 97, false, 120, 70, true, 37], 2],
  [[25, 97, false, 120, 70, true, 37], 3], [[15, 91, false, 120, 70, true, 37], 3], [[15, 93, false, 120, 70, true, 37], 2], [[15, 95, false, 120, 70, true, 37], 1],
  [[15, 97, true, 120, 70, true, 37], 2], [[15, 97, false, 90, 70, true, 37], 3], [[15, 97, false, 101, 70, true, 37], 1], [[15, 97, false, 220, 70, true, 37], 3],
  [[15, 97, false, 120, 40, true, 37], 3], [[15, 97, false, 120, 51, true, 37], 0], [[15, 97, false, 120, 111, true, 37], 2], [[15, 97, false, 120, 131, true, 37], 3],
  [[15, 97, false, 120, 70, false, 37], 3], [[15, 97, false, 120, 70, true, 35], 3], [[15, 97, false, 120, 70, true, 38.5], 1], [[15, 97, false, 120, 70, true, 39.1], 2],
  [[26, 90, true, 85, 135, false, 39.5], 19]].forEach(([a, s]) => ok(V.news2(...a).score === s, `NEWS2 ${a} = ${s}`));
const nv = (...a) => { const r = V.news2(...a); return V.niveau(r.score, r.detail); };
ok(nv(15, 97, false, 120, 70, false, 37) === 'basmoyen' && nv(22, 94, false, 105, 95, true, 37) === 'moyen' && nv(26, 90, true, 85, 135, false, 39.5) === 'eleve', 'niveaux');

const msg = (seq, v) => JSON.stringify(Object.assign({ seq, t: seq * 10, fc: 72, fr: 15, spo2: 97, pas: 120, temp: 37, oxygene: false, conscience: 'A' }, v));
const cliniques = (vals, o) => { const m = new V.Moniteur(o); vals.forEach((v, i) => m.recevoir(i * 10, msg(i, { spo2: v }))); return m.journal.filter((j) => j.genre === 'clinique'); };
ok(cliniques([97, 97, 97, 88, 88, 97, 97, 97]).length === 0, 'pic de 20 s : pas d’alarme');
ok(cliniques([97, 97, 88, 88, 88, 88, 88, 97]).filter((j) => j.cle === 'alarme').length === 1, 'désaturation de 50 s : alarme');
const osc = [97, 97, 88, 88, 88, 88]; for (let i = 0; i < 10; i++) osc.push(91, 89);
ok(cliniques(osc).length === 1, 'hystérésis : une seule alarme');
ok(cliniques(osc, { persistance: 0, hysteresis: false }).length > 8, 'sans persistance ni hystérésis : l’alarme clignote');
ok(cliniques(osc, { persistance: 0 }).length === 1, 'l’hystérésis seule suffit à éviter le clignotement');
const ma = new V.Moniteur(); for (let i = 0; i < 20; i++) { const b = i >= 5 && i < 12; ma.recevoir(i * 10, msg(i, { spo2: b ? 50 : 97, fc: b ? 10 : 72 })); }
ok(!ma.journal.some((j) => j.genre === 'clinique') && ma.journal.some((j) => j.cle === 'capteur'), 'artefact : technique, pas clinique');
const mb = new V.Moniteur({ artefacts: false }); for (let i = 0; i < 20; i++) { const b = i >= 5 && i < 12; mb.recevoir(i * 10, msg(i, { spo2: b ? 50 : 97, fc: b ? 10 : 72 })); }
ok(mb.journal.some((j) => j.genre === 'clinique'), 'sans reconnaissance d’artefact : fausse alarme clinique');

// Réseau
const msgs = V.simulerCapteur({ scenario: 'sepsis', duree: 4 * 3600, graine: 3 });
const liv = V.reseau(msgs, { perte: 0, gigue: 0 });
const ref = JSON.stringify(V.surveiller(liv).journal);
const u = V.rng(9), melange = liv.map(([a, m]) => [a + 15 * u(), m]).sort((x, y) => x[0] - y[0]);
ok(JSON.stringify(V.surveiller(melange).journal) === ref, 'désordre : même journal');
const l2 = V.reseau(msgs, { perte: 0.1, graine: 5 }); ok(V.surveiller(l2).perdus === msgs.length - l2.length, 'pertes comptées');
ok(V.surveiller(V.reseau(V.simulerCapteur({ duree: 3600 }), { perte: 0, coupures: [[1200, 200]] })).journal.some((j) => j.cle === 'liaisonPerdue'), 'coupure 200 s');
ok(!V.surveiller(V.reseau(V.simulerCapteur({ duree: 3600 }), { perte: 0, coupures: [[1200, 40]] })).journal.some((j) => j.cle === 'liaisonPerdue'), 'coupure 40 s : rien');
// Scénarios
for (let g = 0; g < 5; g++) ok(V.surveiller(V.reseau(V.simulerCapteur({ graine: g }), { graine: g })).journal.length === 0, `stable : aucune alerte (${g})`);
const s = V.surveiller(V.reseau(V.simulerCapteur({ scenario: 'sepsis' })));
const tn = s.journal.find((j) => j.genre === 'news2' && j.val[1] === 'eleve').t, ta = s.journal.find((j) => j.genre === 'clinique').t;
ok(tn < ta - 15 * 60, `sepsis : NEWS2 élevé ${Math.round((ta - tn) / 60)} min avant la 1re alarme`);
ok(V.surveiller(V.reseau(V.simulerCapteur({ consciencePerdueA: 3600 }))).journal.some((j) => j.genre === 'news2' && j.val[1] === 'basmoyen'), 'perte de conscience : bas-moyen');
console.log(`${n} vérifications, ${bad} échec(s)`);
process.exit(bad ? 1 : 0);
