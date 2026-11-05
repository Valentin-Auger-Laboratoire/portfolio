// Tests : node tests/test.js
const B = require('../basket.js');
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', n, i === undefined ? '' : i); } };
const near = (a, b, e) => Math.abs(a - b) <= e;
check('78 points', B.POINTS.length === 78);
check('½ρCₓS = 0,0136 kg/m', near(B.kOf('quad', 0.47), 0.0136, 0.0001));
check('k 2024 = 4,37·10⁻⁵', B.kOf('2024') === 4.37e-5);
check('Reynolds à 8 m/s ≈ 1,3·10⁵', near(B.reynolds(8), 1.32e5, 0.01e5));
check('traînée à 8 m/s = 14 % du poids', near(B.dragRatio(8, 'quad', 0.47) * 100, 14.2, 0.3));
// sans frottement : solution exacte de la parabole
{
  const r = B.shoot({ v0: 9, angle: 50, model: 'sans', dt: 0.001 }), a = (50 * Math.PI) / 180;
  const yAt = (x) => 1.8 + x * Math.tan(a) - (9.81 * x * x) / (2 * 81 * Math.cos(a) ** 2);
  check('parabole exacte', r.pts.filter((_, i) => i % 50 === 0).every(([x, y]) => near(y, yAt(x), 1e-6)));
  check('sommet exact', near(r.apex, 1.8 + (9 * Math.sin(a)) ** 2 / (2 * 9.81), 1e-4));
}
// tableau de docs/valeurs.md
const ref = { 40: [9.29, 9.30, 9.85, 10.01], 45: [9.02, 9.02, 9.59, 9.76], 50: [8.93, 8.93, 9.52, 9.69], 55: [9.00, 9.00, 9.65, 9.84], 60: [9.26, 9.26, 9.99, 10.21] };
for (const a of Object.keys(ref)) {
  const got = [B.requiredSpeed(+a, 'sans'), B.requiredSpeed(+a, '2024'), B.requiredSpeed(+a, 'quad', 0.47), B.requiredSpeed(+a, 'quad', 0.6)];
  got.forEach((v, i) => check('vitesse nécessaire ' + a + '° (col ' + i + ')', near(v, ref[a][i], 0.02), [v, ref[a][i]]));
}
check('meilleur angle vers 50°', [40, 45, 55, 60].every((a) => B.requiredSpeed(a, 'quad', 0.47) > B.requiredSpeed(50, 'quad', 0.47)));
{
  const w = B.speedWindow(50, 'quad', 0.47);
  check('marge de vitesse < ±0,1 m/s', (w.hi - w.lo) / 2 < 0.1 && w.lo < w.vc && w.vc < w.hi, w);
  check('tir à la vitesse nécessaire = panier', B.shoot({ v0: w.vc, angle: 50, model: 'quad', Cx: 0.47 }).result === 'panier');
  check('0,2 m/s de moins = court', B.shoot({ v0: w.vc - 0.2, angle: 50, model: 'quad', Cx: 0.47 }).result === 'court');
  check('0,2 m/s de plus = long', B.shoot({ v0: w.vc + 0.2, angle: 50, model: 'quad', Cx: 0.47 }).result === 'long');
}
check('modèle 2024 (7,1 m/s, 45°) : bien trop court', B.shoot({ v0: 7.1, angle: 45, model: '2024' }).result !== 'panier');
check('Cₓ = 0,6 demande ~0,17 m/s de plus à 50°', near(B.requiredSpeed(50, 'quad', 0.6) - B.requiredSpeed(50, 'quad', 0.47), 0.17, 0.03));
// calage sur les points
{
  const a = B.fitPoints({ angle: 45, model: 'sans' }), b = B.fitPoints({ angle: 45, model: 'quad', Cx: 0.47 });
  check('vy₀ calé ≈ 7,0 à 7,5 m/s', a.vy0 > 6.8 && a.vy0 < 7.6 && b.vy0 > 6.8 && b.vy0 < 7.6, [a.vy0, b.vy0]);
  check('écart du calage ≈ 3 cm (numérisation)', a.rms < 0.04 && b.rms < 0.045, [a.rms, b.rms]);
  check('lâcher vers 0,95–1,05 s', a.tr > 0.94 && a.tr < 1.06 && b.tr > 0.94 && b.tr < 1.06);
  check('les deux modèles collent aussi bien (Cₓ non identifiable)', Math.abs(a.rms - b.rms) < 0.015);
}
console.log(ok + ' réussis, ' + ko + ' échoués');
process.exit(ko ? 1 : 0);
