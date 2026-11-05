// Tests de la simulation : node tests/test.js
const T = require('../transporteur.js');
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', n, i === undefined ? '' : i); } };
// constantes reprises du programme final
check('MAX_SPEED = int(5·255/9) = 141', T.PROG.MAX_SPEED === 141);
check('seuil 15 cm, delay(150), delay(5000)', T.PROG.seuil === 15 && T.PROG.delayLoop === 0.15 && T.PROG.delayStop === 5);
check('broches du code', JSON.stringify(T.PROG.pins) === JSON.stringify({ directionA: 12, directionB: 13, speedA: 3, speedB: 11, in2: 8, in3: 4, ultrasonic: 6, ledR: 2 }));
// parcours
for (const k of ['doux', 'serre']) { T.createSim({ track: k }); check('parcours fermé ' + k, T.TRACK.length > 400); }
T.createSim({ track: 'doux' }); check('rayon mini du parcours doux > 30 cm', T.minRadius(T.TRACK) > 30, T.minRadius(T.TRACK));
T.createSim({ track: 'serre' }); check('rayon mini du virage serré ≈ 20 cm', Math.abs(T.minRadius(T.TRACK) - 20) < 3, T.minRadius(T.TRACK));
// moteurs : zone morte, vitesse croissante
check('zone morte', T.wheelSpeed(20, 9) === 0);
check('vitesse croissante', T.wheelSpeed(255, 9) > T.wheelSpeed(141, 9) && T.wheelSpeed(141, 9) > T.wheelSpeed(141, 7));
// table de décision du programme 2022 (fonctions g, d, av)
{
  // robot posé hors de la ligne : les deux capteurs voient du blanc → tout droit
  const s0 = T.createSim({ prog: '2022', noise: false }); s0.st.x = -50; s0.st.y = -50; s0.step(0.005);
  check('blanc/blanc → tout droit', s0.io.act === 'av' && s0.io.pwmA === 141 && s0.io.pwmB === 141);
  const run = T.createSim({ prog: '2022' });
  const seen = {};
  for (let i = 0; i < 4000; i++) { run.step(0.005); if (run.io.act !== '—') seen[run.io.act + (run.st.L ? 'L' : '') + (run.st.R ? 'R' : '')] = [run.io.pwmA, run.io.pwmB]; }
  const gk = Object.keys(seen).filter((k) => k.startsWith('g')), dk = Object.keys(seen).filter((k) => k.startsWith('d'));
  check('g() : moteur A à 141, B à 0', gk.length > 0 && gk.every((k) => seen[k][0] === 141 && seen[k][1] === 0), seen);
  check('d() : moteur A à 0, B à 141', dk.length > 0 && dk.every((k) => seen[k][0] === 0 && seen[k][1] === 141), seen);
}
// série : mêmes messages que le programme
{
  const s = T.createSim({ prog: '2022' }).run(3);
  const m = new Set(s.serial.map((l) => l.m.replace(/^\d+ cm$/, 'N cm')));
  check('messages série du programme', ['Tourner à gauche', 'Tourner à droite', 'Continuer tout droit', 'N cm'].every((x) => m.has(x)), [...m]);
  // période de boucle ≈ 150 ms + écho
  const times = s.serial.filter((l) => /cm$/.test(l.m)).map((l) => l.t);
  const dts = times.slice(1).map((x, i) => x - times[i]);
  const mean = dts.reduce((a, b) => a + b, 0) / dts.length;
  check('période de boucle 150 à 180 ms', mean > 0.15 && mean < 0.18, mean);
}
// suivi de ligne
const S = (o, t) => T.summary(T.createSim(o).run(t || 60));
{
  const a = S({ prog: '2022' }), b = S({ prog: '2026' });
  check('2022 suit le parcours doux à la consigne du code', !a.lost && a.offLine === 0 && a.laps > 1.5, a);
  check('2026 aussi, avec un écart plus faible', !b.lost && b.maxOff < a.maxOff, [a.maxOff, b.maxOff]);
  check('2022 perd la ligne à PWM 200', S({ prog: '2022', pwmMax: 200 }).lost);
  check('2026 tient à PWM 255', !S({ prog: '2026', pwmMax: 255 }).lost);
  check('2022 perd la ligne dans le virage serré', S({ prog: '2022', track: 'serre' }).lost);
  check('2026 tient le virage serré', !S({ prog: '2026', track: 'serre' }).lost);
  check('pile faible : plus lent', S({ prog: '2026', vbat: 7 }).meanV < b.meanV);
}
// obstacles
{
  const box = () => [T.obstacleOnTrack(150, 8, {}, 'doux')];
  const a = S({ prog: '2022', obstacles: box() }, 40), b = S({ prog: '2026', obstacles: box() }, 40);
  check('2022 : arrêts répétés devant la boîte', a.stops >= 3, a.stops);
  check('2022 : il finit par la toucher (redémarre avant de mesurer)', a.collisions > 0, a);
  check('2026 : un seul arrêt, aucun contact', b.stops === 1 && b.collisions === 0, b);
  check('2026 : reste à distance', b.minGap > 8, b.minGap);
  const h22 = S({ prog: '2022', obstacles: [T.obstacleOnTrack(150, 6, { from: 0, to: 12 }, 'doux')] }, 40);
  check('main qui passe : arrêt puis reprise', h22.stops >= 1 && h22.laps > 1, h22);
  const tis = T.createSim({ prog: '2022', obstacles: [T.obstacleOnTrack(300, 10, { absorb: true }, 'doux')] }).run(30);
  check('cible absorbante : mesures à 0 cm', tis.serial.some((l) => l.m === '0 cm'));
  check('cible absorbante : le 2022 s’arrête loin d’elle', T.summary(tis).stops >= 1 && T.summary(tis).minGap > 15, T.summary(tis));
  const t26 = T.createSim({ prog: '2026', obstacles: [T.obstacleOnTrack(300, 10, { absorb: true }, 'doux')] }).run(30);
  check('2026 : arrêt prudent annoncé', t26.serial.some((l) => /invalide/.test(l.m)));
}
// LED : fixe en 2022, clignotante en 2026
{
  const s = T.createSim({ prog: '2026', obstacles: [T.obstacleOnTrack(150, 8, {}, 'doux')] });
  const v = []; for (let i = 0; i < 8000; i++) { s.step(0.005); if (s.io.act === 'stop') v.push(s.io.led); }
  let changes = 0; for (let i = 1; i < v.length; i++) if (v[i] !== v[i - 1]) changes++;
  check('2026 : LED clignotante à l’arrêt', changes > 4, changes);
  const s2 = T.createSim({ prog: '2022', obstacles: [T.obstacleOnTrack(150, 8, {}, 'doux')] });
  let onSteps = 0, offDuringStop = 0; for (let i = 0; i < 8000; i++) { s2.step(0.005); if (s2.io.phase === 'delay(5000)') { if (s2.io.led) onSteps++; else offDuringStop++; } }
  check('2022 : LED fixe pendant delay(5000)', onSteps > 100 && offDuringStop === 0, [onSteps, offDuringStop]);
}
console.log(ok + ' réussis, ' + ko + ' échoués');
process.exit(ko ? 1 : 0);
