// Tests de la simulation : node tests/test.js
const B = require('../balneo.js');
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', n, i === undefined ? '' : i); } };
const near = (a, b, e) => Math.abs(a - b) <= e;
// données réelles
check('48 mesures', B.MESURES.A.length + B.MESURES.B.length === 48);
check('période médiane 10,63 s', near(B.PERIODE, 10.63, 0.01), B.PERIODE);
check('pente de la série B ≈ 0,06–0,07 °C/min', B.PENTE_B * 60 > 0.055 && B.PENTE_B * 60 < 0.075, B.PENTE_B * 60);
check('régression exacte sur une droite', near(B.linfit([[0, 1], [1, 3], [2, 5]]).b, 2, 1e-12));
// capteur et message
check('pas de 0,0625 °C', near(B.ds18b20(23.03, true) / 0.0625, Math.round(B.ds18b20(23.03, true) / 0.0625), 1e-12));
check('sonde débranchée = −127', B.ds18b20(30, false) === -127);
check('println à 2 décimales', B.println(23.0625) === '23.06' && B.println(-127) === '-127.00');
// programme 2023 : règle exacte du code
{
  const s = B.createSim({ prog: '2023', pool: 'bassin', T0: 19.5, noise: 0 }); s.step(0.5);
  check('2023 : T ≤ 20 → relais HIGH', s.io.relais === 1);
  const s2 = B.createSim({ prog: '2023', pool: 'bassin', T0: 20.5 }); s2.step(0.5);
  check('2023 : T > 20 → relais LOW', s2.io.relais === 0);
  const s3 = B.createSim({ prog: '2023', pool: 'maquette' }).run(200, 0.5);
  const dts = s3.out.msgs.slice(1).map((m, i) => m.t - s3.out.msgs[i].t);
  check('2023 : un message toutes les 10,63 s', dts.every((d) => near(d, B.PERIODE, 0.51)), dts.slice(0, 3));
  check('2023 : messages au format 23.06', s3.out.msgs.every((m) => /^-?\d+\.\d\d$/.test(m.m)));
}
// la maquette rejoue la série B
{
  const s = B.createSim({ prog: '2023', pool: 'maquette' }).run(320, 0.5);
  let e = 0; for (const [x, v] of B.SERIE_B) { const i = s.out.t.findIndex((u) => u >= x); e += (s.out.T[i] - v) ** 2; }
  check('maquette : écart à la série B < 0,08 °C', Math.sqrt(e / B.SERIE_B.length) < 0.08, Math.sqrt(e / B.SERIE_B.length));
  check('maquette : puissance déduite positive et faible', B.MAQ.P > 0 && B.MAQ.P < 20, B.MAQ.P);
}
// scénarios
const run = (prog, pool, f, o) => { const P = B.POOLS[pool]; return B.summary(B.createSim(Object.assign({ prog, pool, fault: f && { type: f, t: P.horizon / 3 } }, o || {})).run(P.horizon, 2)); };
{
  const a = run('2023', 'bassin'), b = run('2026', 'bassin');
  check('2023 : le bassin n’atteint jamais 32 °C', a.maxT < 32 && a.comfort === 0, a);
  check('2026 : le bassin reste dans 32–36 °C la plupart du temps', b.comfort > 0.7 && b.maxT < 36.5, b);
  const c = run('2023', 'bassin', 'sonde'), d = run('2026', 'bassin', 'sonde');
  check('2023 + sonde débranchée : l’eau dépasse 45 °C', c.maxT > 45, c.maxT);
  check('2026 + sonde débranchée : chauffe coupée, alerte', d.maxT < 36.5 && d.alarms.includes('sonde') && d.relais === 0, d);
  const e = run('2026', 'bassin', 'relais');
  check('2026 + relais collé : alerte de surchauffe (mais pas de coupure possible)', e.alarms.includes('surchauffe') && e.maxT > 38, e);
  const f = run('2026', 'bassin', 'froid');
  check('2026 + eau froide : retour dans la plage', f.T >= 31.5 && f.T <= 36.5, f.T);
  const g = run('2026', 'bassin', null, { lo: 30, hi: 33 });
  check('2026 : consignes réglables', g.maxT < 33.5, g.maxT);
}
{
  // hystérésis : le 2026 commute bien moins souvent que ne le ferait un seuil unique
  const s = B.createSim({ prog: '2026', pool: 'bassin' }).run(86400, 2);
  let sw = 0; for (let i = 1; i < s.out.relais.length; i++) if (s.out.relais[i] !== s.out.relais[i - 1]) sw++;
  check('2026 : peu de commutations du relais sur 24 h', sw > 2 && sw < 40, sw);
  const s2 = B.createSim({ prog: '2023', pool: 'bassin', Tamb: 18 }).run(86400, 2);
  let sw2 = 0; for (let i = 1; i < s2.out.relais.length; i++) if (s2.out.relais[i] !== s2.out.relais[i - 1]) sw2++;
  check('2023 : le relais claque autour de 20 °C', sw2 > 3 * sw, [sw2, sw]);
}
console.log(ok + ' réussis, ' + ko + ' échoués');
process.exit(ko ? 1 : 0);
