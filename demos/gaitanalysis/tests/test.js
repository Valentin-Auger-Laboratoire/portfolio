/* Vérifications du moteur JS de la démo GaitAnalysis : node tests/test.js */
'use strict';
const M = require('../marche.js');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('ÉCHEC : ' + m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m} (${a} ≠ ${b})`);

// Gabarits : mêmes valeurs que le Python (gaitanalysis/marche.py)
near(M.gabarit('hanche', 0), 33, 1e-12, 'hanche à l’attaque du talon = 33°');
near(M.gabarit('genou', 0.72), 61.000000000098446, 1e-9, 'genou au pic = Python');
near(M.gabarit('cheville', 0.63), -14.646647167633873, 1e-9, 'cheville = Python');
near(M.gabarit('hanche', 0.37), -3.879313677161714, 1e-9, 'hanche = Python');
for (const a of M.ARTICULATIONS) near(M.gabarit(a, 0.3), M.gabarit(a, 1.3), 1e-12, `${a} périodique`);
const rom = {}; for (const a of M.ARTICULATIONS) { let mn = 1e9, mx = -1e9; for (let i = 0; i <= 100000; i++) { const v = M.gabarit(a, i / 100000); mn = Math.min(mn, v); mx = Math.max(mx, v); } rom[a] = mx - mn; }

// Détection des attaques du talon
for (let g = 0; g < 5; g++) {
  const s = M.simuler({ n: 25, cv: 0.05, bruit: 0.5, graine: g });
  const vrai = s.verite.attaques.slice(1), det = M.detecterAttaques(s.hanche_droit, s.fe);
  ok(det.length === vrai.length, `nombre d'attaques (graine ${g}) ${det.length}/${vrai.length}`);
  ok(det.every((d, i) => Math.abs(d - vrai[i]) < 0.015), `précision < 15 ms (graine ${g})`);
}
// ROM sans bruit = gabarit, symétrie, cadence
let r = M.analyser(M.simuler({ n: 15, cv: 0, fe: 500 }));
for (const a of M.ARTICULATIONS) { near(r[a].droit, rom[a], 0.2, `ROM ${a} droit`); ok(r[a].symetrie < 0.5, `symétrie ${a}`); }
near(r.dureeFoulee, 1.1, 1e-3, 'durée de foulée'); near(r.cadence, 120 / 1.1, 0.1, 'cadence');
// Genou raide, variabilité
r = M.analyser(M.simuler(Object.assign({}, M.SCENARIOS.genou_raide_droit)));
ok(r.genou.droit < 0.7 * r.genou.gauche && r.genou.symetrie > 30 && r.hanche.symetrie < 2, 'genou raide repéré, hanche symétrique');
for (const cv of [0.02, 0.08]) { r = M.analyser(M.simuler({ n: 200, cv, graine: 11 })); ok(Math.abs(r.cv - cv * 100) < 0.25 * cv * 100 + 0.3, `variabilité ${cv * 100} %`); }
// Marge de stabilité : formule et valeur théorique
near(M.margeStabilite(0.01, 0, 0.08, 0.9), 0.07, 1e-12, 'MoS = bord − CoM');
r = M.analyser(M.simuler({ n: 10, cv: 0, fe: 1000 }));
const w = 2 * Math.PI / 1.1, th = 0.08 - 0.02 * Math.sqrt(1 + (w / Math.sqrt(9.81 / 0.9)) ** 2);
near(r.mosMin, th, 3e-4, 'MoS théorique');
ok(M.analyser(M.simuler(Object.assign({}, M.SCENARIOS.instable))).mosMin < 0, 'scénario instable : marge négative');
near(M.indiceSymetrie(60, 40), 40, 1e-12, 'indice de symétrie');
console.log(`${n} vérifications, ${bad} échec(s)`);
process.exit(bad ? 1 : 0);
