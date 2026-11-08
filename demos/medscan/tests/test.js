/* Vérifications du moteur JS de la démo MedScan : node tests/test.js */
'use strict';
const M = require('../medscan.js');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('ÉCHEC : ' + m); } };
const u = M.rng(0);

// Otsu = maximum de la variance inter-classes (recherche exhaustive)
const x = []; for (let i = 0; i < 5000; i++) x.push(50 + 8 * u.normal()); for (let i = 0; i < 3000; i++) x.push(150 + 10 * u.normal());
const s = M.otsu(x);
const vi = (t) => { const a = x.filter((v) => v < t), b = x.filter((v) => v >= t); const ma = a.reduce((p, q) => p + q, 0) / a.length, mb = b.reduce((p, q) => p + q, 0) / b.length; return a.length * b.length * (ma - mb) ** 2; };
let best = 0, tb = 0; for (let t = 60; t <= 140; t += 0.1) { const v = vi(t); if (v > best) { best = v; tb = t; } }
ok(Math.abs(s - tb) < 1, `Otsu ${s.toFixed(1)} = exhaustif ${tb.toFixed(1)}`);
// Moyenne locale = calcul direct
const N = 12, im = Float64Array.from({ length: N * N }, () => u.normal());
for (const r of [1, 2]) {
  const ml = M.moyenneLocale(im, N, r); let err = 0;
  for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
    let sm = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) sm += im[Math.min(N - 1, Math.max(0, y + dy)) * N + Math.min(N - 1, Math.max(0, xx + dx))];
    err = Math.max(err, Math.abs(sm / (2 * r + 1) ** 2 - ml[y * N + xx]));
  }
  ok(err < 1e-12, `moyenne locale r=${r}`);
}
// Composantes et ouverture
const m = new Uint8Array(100); [[1, 1], [1, 2], [2, 1], [2, 2], [3, 3], [6, 6], [6, 7], [7, 6], [7, 7]].forEach(([a, b]) => { m[a * 10 + b] = 1; });
ok(M.composantes(m, 10).nb === 2, '8-connexité : 2 régions');
const uU = new Uint8Array(54); for (let y = 1; y < 5; y++) { uU[y * 9 + 1] = 1; uU[y * 9 + 7] = 1; } for (let xx = 1; xx < 8; xx++) uU[4 * 9 + xx] = 1;
ok(M.composantes(uU, 9).nb === 1, 'forme en U : une seule région');
const q = new Uint8Array(100); for (let y = 2; y < 7; y++) for (let xx = 2; xx < 7; xx++) q[y * 10 + xx] = 1; q[9] = 1;
const o = M.ouverture(q, 10); ok(!o[9] && o[44], 'ouverture : pixel isolé retiré, carré gardé');
// Détection
const mod = M.modeleSain(M.sujetsSains(20), 128);
for (let g = 0; g < 6; g++) ok(M.detecter(M.coupe([], { graine: 500 + g, decalage: u() - 0.5 }).image, mod).regions.length === 0, `aucune fausse alerte (sujet sain ${g})`);
[[50, 45, 6, 35], [80, 82, 4, -30], [64, 40, 5, 25], [45, 80, 3, 40]].forEach(([cy, cx, r, c], g) => {
  const cp = M.coupe([{ cy, cx, r, contraste: c }], { graine: 700 + g }), d = M.detecter(cp.image, mod);
  ok(d.regions.length === 1, `lésion ${g} détectée une fois`);
  ok(d.regions.length === 1 && Math.abs(d.regions[0].centre[0] - cy) < 1.5 && Math.abs(d.regions[0].centre[1] - cx) < 1.5, `lésion ${g} localisée`);
  ok(d.regions.length === 1 && d.regions[0].type === (c > 0 ? 'hyper' : 'hypo'), `lésion ${g} type`);
  ok(M.dice(d.masque, cp.vrai) > 0.55, `lésion ${g} Dice ${M.dice(d.masque, cp.vrai).toFixed(2)}`);
});
ok(M.detecter(M.coupe([{ cy: 60, cx: 60, r: 1.5, contraste: 8 }], { graine: 9 }).image, mod).regions.length === 0, 'limite de détection');
console.log(`${n} vérifications, ${bad} échec(s)`);
process.exit(bad ? 1 : 0);
