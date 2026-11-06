// Tests de la maison connectée (node tests/test.js)
'use strict';
const M = require('../maison.js');
let n = 0, ko = 0; const fails = [];
function ok(c, m) { n++; if (!c) { ko++; fails.push(m); } }
const near = (a, b, t) => Math.abs(a - b) <= t;

// ------------------------------------------------------------ capteur et formule du programme
for (let T = -10; T <= 60; T += 2.5) ok(near(M.tempFromAdc(M.adcFromT(T)), T, 1e-9), 'formule du programme = inverse exact du capteur à ' + T + ' °C');
ok(near(M.adcFromT(25), 511.5, 1e-9), 'à 25 °C, R = R0 : mi-échelle (511,5 points)');
ok(M.tempFromAdc(0) === -273.15 && M.tempFromAdc(1023) === -273.15, 'sonde débranchée (0) ou en court-circuit (1023) : la formule donne −273,15 °C');
{ const d = M.tempFromAdc(Math.round(M.adcFromT(25)) + 1) - M.tempFromAdc(Math.round(M.adcFromT(25))); ok(Math.abs(d) > 0.06 && Math.abs(d) < 0.1, 'résolution vers 25 °C : ' + Math.abs(d).toFixed(3) + ' °C par point du convertisseur'); }
{ // const int R0 = 100000 sur un Arduino Uno (int de 16 bits) : 100000 → −31072 ; le résultat ne change pas car R0 se simplifie
  const r16 = ((100000 + 32768) % 65536) - 32768; ok(r16 === -31072, 'int de 16 bits : 100000 devient ' + r16);
  const f = (a, r0) => { let R = 1023.0 / a - 1.0; R = r0 * R; return 1.0 / (Math.log(R / r0) / M.B + 1 / 298.15) - 273.15; };
  ok([100, 300, 511, 700, 900].every((a) => Math.abs(f(a, r16) - f(a, 100000)) < 1e-9), 'avec R0 = −31072 la température est identique : R0 se simplifie dans R/R0'); }
ok(M.f2(26.004) === '26.00' && M.f2(-273.15) === '-273.15', 'affichage à 2 décimales comme print(float)');

// ------------------------------------------------------------ programme 2022 : chaîne de if / else
const c = (T, s) => M.ctrl2022(T, s || { fan: 0, heat: 0 });
ok(c(25).out.heat === 1 && c(25).out.fan === 0, 'T ≤ 26 : chauffage allumé');
ok(c(27).out.heat === 0 && c(27).out.fan === 0, '26,1 < T ≤ 29,9 : tout éteint');
ok(c(31).out.fan === 1 && c(31).out.heat === 0, 'T > 30 : ventilateur allumé');
ok(c(26.05, { fan: 0, heat: 1 }).out.heat === 1 && c(26.05, { fan: 0, heat: 0 }).out.heat === 0, '26 < T ≤ 26,1 : aucun if vrai, l\'état précédent reste');
ok(c(29.95, { fan: 1, heat: 0 }).out.fan === 1 && c(29.95, { fan: 0, heat: 0 }).out.fan === 0, '29,9 < T ≤ 30 : aucun if vrai, l\'état précédent reste');
ok(c(25).wait === 2100 && c(26.05).wait === 1100, 'durée d\'un passage : 2,1 s dans un if, 1,1 s dans les trous');
ok(c(-273.15).out.heat === 1, 'sonde débranchée : −273,15 ≤ 26, le chauffage s\'allume');
// ------------------------------------------------------------ programme 2026
const d = (a, s, cfg) => M.ctrl2026(a, s || { fan: 0, heat: 0 }, cfg);
ok(d(0).fault && d(0).heat === 0 && d(1023).fault && d(1023).heat === 0, '2026 : sonde débranchée ou en court-circuit → défaut, tout coupé');
{ const a = (T) => Math.round(M.adcFromT(T)); ok(d(a(24.5)).heat === 1 && d(a(25.5), { fan: 0, heat: 1 }).heat === 1 && d(a(25.5), { fan: 0, heat: 0 }).heat === 0 && d(a(26.5), { fan: 0, heat: 1 }).heat === 0, '2026 : hystérésis du chauffage 25 / 26 °C');
  ok(d(a(30.5)).fan === 1 && d(a(29.5), { fan: 1, heat: 0 }).fan === 1 && d(a(28.5), { fan: 1, heat: 0 }).fan === 0, '2026 : hystérésis du ventilateur 29 / 30 °C');
  ok(d(a(40), { fan: 0, heat: 1 }, { hOn: 50, hOff: 60 }).fan === 0, '2026 : jamais chauffage et ventilateur ensemble'); }
// ------------------------------------------------------------ écran LCD
ok(M.lcdWrite('-273.15         ', '26.43') === '26.4315         ', 'LCD 2022 : la ligne n\'est pas effacée, il reste des caractères (« 26.4315 »)');
ok(M.lcdWrite('                ', '26.43').trim() === '26.43', 'LCD : affichage normal sur une ligne vide');

// ------------------------------------------------------------ simulations
for (const scen of ['winter', 'mild', 'summer']) {
  const a = M.simulate({ scen, version: '2022' }), b = M.simulate({ scen, version: '2026' });
  ok(a.switches > 10 * b.switches, scen + ' : le relais 2022 claque (' + a.switches + ' commutations) contre ' + b.switches + ' en 2026');
  ok(a.both === 0 && b.both === 0, scen + ' : jamais chauffage et ventilateur ensemble');
  ok(b.Tmin > 24 || scen === 'summer' ? true : b.Tmin > 21, scen + ' : la pièce reste au chaud en hiver');
}
{
  const a = M.simulate({ scen: 'summer', version: '2022', unplug: 3 * 3600 }), b = M.simulate({ scen: 'summer', version: '2026', unplug: 3 * 3600 });
  ok(a.Tmax > 50, 'sonde débranchée en été, 2022 : le chauffage tourne, la pièce monte à ' + a.Tmax.toFixed(1) + ' °C');
  ok(b.fault && b.Tmax < 40 && b.lcd[b.lcd.length - 1].startsWith('DEFAUT'), '2026 : défaut affiché, chauffage coupé (' + b.Tmax.toFixed(1) + ' °C au plus)');
}
{
  // maquette thermique : chauffage toujours allumé, extérieur constant → T tend vers Text + Ph/G
  const s = M.simulate({ ext: () => 10, T0: 10, version: '2026', cfg: { hOn: 200, hOff: 300, fOn: 400, fOff: 390 }, noise: 0, hours: 30 });
  ok(near(s.T[s.T.length - 1], 10 + 20 / 1, 0.05), 'régime permanent : T = Text + P/G = 30 °C (' + s.T[s.T.length - 1].toFixed(3) + ')');
  const k = s.t.findIndex((t) => t >= 4000); ok(near(s.T[k], 10 + 20 * (1 - Math.exp(-s.t[k] / 4000)), 0.05), 'constante de temps C/G = 4 000 s');
}
{ const a = M.simulate({ scen: 'winter', version: '2022', noise: 0 }), b = M.simulate({ scen: 'winter', version: '2022', noise: 1 }); ok(b.switches > 3 * a.switches, 'c\'est le bruit de mesure qui fait claquer le relais 2022 (' + a.switches + ' sans bruit, ' + b.switches + ' avec)'); }

console.log(n - ko + ' / ' + n + ' tests réussis');
if (ko) { fails.forEach((f) => console.log('ÉCHEC : ' + f)); process.exit(1); }
