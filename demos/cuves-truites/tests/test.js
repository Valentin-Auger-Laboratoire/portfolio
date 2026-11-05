// Tests : node tests/test.js
const M = require('../truites.js');
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', n, i === undefined ? '' : i); } };
const near = (a, b, e) => Math.abs(a - b) <= e;
// formules du programme de 2023
for (const T of [3, 12, 17, 20, 24]) check('thermistance aller-retour ' + T + ' °C', near(M.tempOfAdc(M.adcOfTemp(T)), T, 0.35), M.tempOfAdc(M.adcOfTemp(T)));
check('thermistance débranchée = −273,15 °C', M.tempOfAdc(0) === -273.15);
check('remplissage 2023 : cuve pleine 98,5 %', near(M.fill2023(30), 98.5, 1e-9));
check('remplissage 2023 : cuve vide 92,5 %', near(M.fill2023(150), 92.5, 1e-9));
check('remplissage 2023 : écho nul = 100 %', M.fill2023(0) === 100);
check('remplissage 2026 : pleine 100 %, vide 0 %', near(M.fill2026(30), 100, 1e-9) && near(M.fill2026(150), 0, 1e-9));
check('turbidité : 311 points = 1783,44 NTU (photo)', M.fmt2(M.ntuOfV(311 * 5 / 1024)) === '1783.44');
check('turbidité : 5 V donne −3651 NTU', near(M.ntuOfV(5), -3651.4, 0.1));
check('turbidité : aller-retour dans la plage', near(M.ntuOfV(M.vOfNtu(500)), 500, 1e-6) && M.vOfNtu(500) > 2.5 && M.vOfNtu(500) < 4.2);
// lecture Processing (values.length > 0 puis values[0..2])
{
  const r = M.parse2023('18.42,99.60,1.95', { v1: 0, v2: 0, v3: 0 });
  check('trame complète', r.v1 === 18.42 && r.v2 === 99.6 && r.v3 === 1.95 && !r.error);
  const p = M.parse2023('100.00,1783.44', { v1: 0, v2: 0, v3: 0 });
  check('trame à 2 champs : décalage + exception, v3 inchangé', p.v1 === 100 && p.v2 === 1783.44 && p.v3 === 0 && /OutOfBounds/.test(p.error));
  check('premier champ perdu', M.cutFrame('22.10,100.00,1783.44', 'first') === '100.00,1783.44');
}
// trame 2026 vérifiée
{
  const f = M.frame2026(0, 18.4, 85, 6, 1, 'OK'), r = M.parse2026(f);
  check('trame 2026 relue', r.tank === 0 && r.T === 18.4 && r.F === 85 && r.valve === 1);
  check('trame 2026 tronquée rejetée', M.parse2026(f.slice(3)).error === 'rejetée' && M.parse2026(f.slice(0, -4)).error === 'rejetée');
  check('trame 2026 altérée rejetée', M.parse2026(f.replace('18.40', '18.41')).error === 'rejetée');
}
// reconstitution de l'écran de la photo
{
  const s = M.createSim({ prog: '2023', scenario: 'photo' }).run(0.5);
  check('écran de la photo : Température 100, Remplissage 1783,44, Turbidité 0', s.disp.v1 === 100 && s.disp.v2 === 1783.44 && s.disp.v3 === 0, s.disp);
}
// scénarios sur 24 h
const run = (prog, sc) => M.summary(M.createSim({ prog, scenario: sc }).run(24));
{
  const a = run('2023', 'normal'), b = run('2026', 'normal');
  check('2023 : sans électrovanne, les cuves baissent', a.minLevel < 60, a.minLevel);
  check('2026 : électrovanne → jamais sous 79 %', b.minLevel > 79, b.minLevel);
  check('2023 : remplissage affiché toujours > 90 %', M.createSim({ prog: '2023', scenario: 'normal', loss: 0 }).run(24).out.shownFill.every((v) => v > 90));
  const c = run('2023', 'chaud'), d = run('2026', 'chaud');
  check('journée chaude : > 20 °C sans alerte en 2023', c.maxT > 20 && c.alarms.length === 0);
  check('journée chaude : alerte 20 °C en 2026', d.alarms.includes('t20'));
  check('fuite : la cuve 3 se vide en 2023', run('2023', 'fuite').minLevel < 5);
  check('fuite : compensée en 2026', run('2026', 'fuite').minLevel > 75);
  check('mousse : alerte écho en 2026', run('2026', 'mousse').alarms.includes('echo'));
  check('thermistance : −273,15 affiché en 2023', run('2023', 'debranche').disp.v1 === -273.15);
  check('thermistance : alerte sonde en 2026', run('2026', 'debranche').alarms.includes('sonde'));
  check('nourrissage : alerte turbidité en 2026', run('2026', 'nourrissage').alarms.includes('turb'));
  check('eau claire : turbidité négative affichée en 2023', run('2023', 'normal').disp.v3 < 0);
  check('pertes série : exceptions en 2023, rejets en 2026', a.errors > 0 && b.rejected > 0 && b.errors === 0);
}
console.log(ok + ' réussis, ' + ko + ' échoués');
process.exit(ko ? 1 : 0);
