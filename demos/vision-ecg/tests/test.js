/* Vérifications du moteur JS de la démo Vision-ECG : node tests/test.js */
'use strict';
const E = require('../visionecg.js');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('ÉCHEC : ' + m); } };
const ecartMax = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));

// Outils : mêmes conventions que numpy
ok(E.percentile([1, 2, 3, 4], 90) === 3.7 && E.mediane([5, 1, 3]) === 3, 'percentile linéaire (numpy)');
ok(Math.abs(E.ecartType([1, 2, 3, 4], 1) - 1.2909944487) < 1e-9, 'écart-type ddof=1');
// Grille : pixels par mm retrouvés, y compris pour des résolutions non entières
for (const p of [6, 8, 10.5, 12]) { const g = E.pasGrille(E.masques(E.imprimer({ duree: 6, pxParMm: p }).image)).pxParMm; ok(Math.abs(g - p) / p < 0.01, `grille ${p} px/mm -> ${g.toFixed(3)}`); }
// Étalonnage 10 mm/mV
for (const p of [6, 8, 12]) { const gm = E.numeriser(E.imprimer({ duree: 6, pxParMm: p }).image).info.gainMesure; ok(Math.abs(gm - 10) < 0.4, `étalonnage (${p} px/mm) : ${gm.toFixed(2)}`); }
// Numérisation fidèle hors QRS
for (const p of [8, 12]) {
  const { image, verite } = E.imprimer({ duree: 8, fc: 70, pxParMm: p, graine: 4 }), d = E.numeriser(image);
  const vt = E.interp(d.t, verite.t, verite.v); let s = 0, c = 0;
  d.t.forEach((t, i) => { if (verite.picsR.every((r) => Math.abs(t - r) > 0.06)) { s += (vt[i] - d.v[i]) ** 2; c++; } });
  const rms = Math.sqrt(s / c); ok(rms < 0.02, `erreur de numérisation hors QRS (${p} px/mm) : ${rms.toFixed(4)} mV`);
}
// Fréquence, battements, pics, amplitude
for (const fc of [45, 60, 72, 100, 140]) for (let g = 0; g < 2; g++) {
  const { image, verite } = E.imprimer({ fc, graine: g }), r = E.analyser(image);
  ok(r.nbBattements === verite.picsR.length, `FC ${fc} : ${r.nbBattements} battements / ${verite.picsR.length}`);
  if (r.nbBattements !== verite.picsR.length) continue;
  ok(Math.abs(r.fc - verite.fc) < 1, `FC ${fc} : ${r.fc.toFixed(1)}`);
  ok(ecartMax(r.instantsR, verite.picsR) < 0.012, `FC ${fc} : pics R à moins de 12 ms`);
  ok(Math.abs(r.amplitudeRMv - verite.amplitudeR) < 0.06, `FC ${fc} : amplitude R ${r.amplitudeRMv.toFixed(3)} / ${verite.amplitudeR.toFixed(3)}`);
}
ok(E.analyser(E.imprimer({ fc: 45 }).image).frequence === 'bradycardie', 'bradycardie reconnue');
ok(E.analyser(E.imprimer({ fc: 130 }).image).frequence === 'tachycardie', 'tachycardie reconnue');
// Rythme irrégulier et SDNN
for (let g = 0; g < 3; g++) {
  const { image, verite } = E.imprimer({ fc: 90, irregularite: 0.18, graine: 10 + g }), r = E.analyser(image);
  const rr = verite.picsR.slice(1).map((x, i) => x - verite.picsR[i]), vrai = E.ecartType(rr, 1) * 1000;
  ok(r.rythme === 'irregulier', `rythme irrégulier reconnu (tirage ${g})`);
  ok(Math.abs(r.sdnnMs - vrai) < 8, `SDNN ${r.sdnnMs.toFixed(0)} / ${vrai.toFixed(0)} ms`);
}
ok(E.analyser(E.imprimer({ fc: 75, graine: 3 }).image).rythme === 'regulier', 'rythme régulier reconnu');
// QRS
const q = [1, 1.6, 2.4].map((k) => E.analyser(E.imprimer({ fc: 65, largeurQrs: k }).image).qrsMs);
ok(q[0] < q[1] && q[1] < q[2], `durée du QRS croissante ${q.map(Math.round)}`);
ok(q[0] < 110 && q[2] >= 120, 'QRS fin / QRS élargi');
// Robustesse : bruit du tracé, grain de l'image
{ const { image, verite } = E.imprimer({ fc: 80, bruitMv: 0.02, graine: 6 }), r = E.analyser(image); ok(r.nbBattements === verite.picsR.length && Math.abs(r.fc - verite.fc) < 1.5, 'tracé bruité'); }
{ const { image, verite } = E.imprimer({ fc: 80, bruitPixels: 0.002, graine: 6 }), r = E.analyser(image); ok(r.nbBattements === verite.picsR.length && Math.abs(r.fc - verite.fc) < 1.5, 'grain de numérisation'); }
// Image sans grille : erreur claire
{ const im = E.imprimer({ duree: 3 }).image; for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 1] > 110) { im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; }
  let msg = ''; try { E.analyser(im); } catch (e) { msg = e.message; } ok(msg === 'grille introuvable', 'image sans grille refusée'); }
// Déterminisme
ok(JSON.stringify(E.analyser(E.imprimer({ fc: 72, graine: 2 }).image).instantsR) === JSON.stringify(E.analyser(E.imprimer({ fc: 72, graine: 2 }).image).instantsR), 'même graine : même résultat');
console.log(`${n} vérifications, ${bad} échec(s)`);
process.exit(bad ? 1 : 0);
