// Tests de la course de robots (node tests/test.js)
'use strict';
const R = require('../robots.js');
let n = 0, ko = 0; const fails = [];
function ok(c, m) { n++; if (!c) { ko++; fails.push(m); } }
const near = (a, b, t) => Math.abs(a - b) <= t;

// ------------------------------------------------------------ géométrie
ok(near(R.wrap(3 * Math.PI), Math.PI, 1e-12) || near(R.wrap(3 * Math.PI), -Math.PI, 1e-12), 'wrap(3π) = ±π');
ok(near(R.wrap(-0.5 + 4 * Math.PI), -0.5, 1e-12), 'wrap ramène dans ]−π, π]');
{ const q = R.closestOnSeg(2, 3, [0, 0, 4, 0]); ok(q[0] === 2 && q[1] === 0, 'point le plus proche sur un segment'); const e = R.closestOnSeg(-1, 1, [0, 0, 4, 0]); ok(e[0] === 0 && e[1] === 0, 'point le plus proche : extrémité'); }
{
  const T = R.track('u'), r = R.rng(5);
  for (let k = 0; k < 200; k++) {
    const x = 0.1 + 3.8 * r(), y = 0.05 + 0.5 * r(); // couloir du bas : murs y = 0 et y = 0,6 (barrière, x < 3,3)
    if (x > 3.25) continue;
    ok(near(R.raycast(x, y, -Math.PI / 2, T.walls), y, 1e-9) && near(R.raycast(x, y, Math.PI / 2, T.walls), 0.6 - y, 1e-9), 'télémètre vertical : distance exacte aux murs (tirage ' + k + ')');
  }
  ok(near(R.raycast(1, 0.3, Math.PI / 4, T.walls), 0.3 * Math.SQRT2, 1e-9), 'télémètre à 45° : 0,3·√2');
  ok(near(R.raycast(1, 0.3, 0, [], [[1.5, 0.3, 0.05]]), 0.45, 1e-9), 'télémètre sur un autre robot : 0,5 − 0,05');
}
{ const T = R.track('u'); const h = R.raycastHit(1, 0.3, Math.PI / 2, T.walls), g = R.raycastHit(1, 0.3, -Math.PI / 2, T.walls);
  ok(T.colors[h.idx] === 'black' && T.colors[g.idx] === 'red', 'capteur de couleur : barrière du milieu noire, bord rouge');
  ok(T.colors.length === T.walls.length, 'une couleur par mur');
  for (const tr of ['obstacles', 'chicane']) { const U = R.track(tr); ok(U.colors.length === U.walls.length && U.colors.every((c) => c === 'red' || c === 'black'), tr + ' : murs rouges ou noirs uniquement'); } }
// ------------------------------------------------------------ filtre de Kalman
{
  const f = R.ekfInit([0, 0, 0]), o = [0, 0, 0];
  for (let k = 0; k < 100; k++) { R.ekfPredict(f, 0.01, 0.005, { ds: 0.001, dth: 0.01 }); const th = o[2] + 0.0025; o[0] += 0.01 * Math.cos(th); o[1] += 0.01 * Math.sin(th); o[2] += 0.005; }
  ok(near(f.x[0], o[0], 1e-12) && near(f.x[1], o[1], 1e-12) && near(f.x[2], o[2], 1e-12), 'prédiction du filtre = odométrie');
  const tr0 = f.P[0][0] + f.P[1][1]; R.ekfUpdate(f, [o[0] + 0.01, o[1], o[2]], [1e-4, 1e-4, 1e-3]);
  ok(f.P[0][0] + f.P[1][1] < tr0, 'la mesure de la caméra réduit l\'incertitude');
  ok(near(f.P[0][1], f.P[1][0], 1e-12) && f.P[0][0] > 0 && f.P[1][1] > 0 && f.P[2][2] > 0, 'covariance symétrique, diagonale positive');
  const g = R.ekfInit([0, 0, 0]); g.P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; R.ekfUpdate(g, [1, 2, 0.3], [1, 1, 1]); ok(near(g.x[0], 0.5, 1e-12) && near(g.x[1], 1, 1e-12) && near(g.x[2], 0.15, 1e-12), 'mêmes variances : estimation à mi-chemin');
}
// ------------------------------------------------------------ cinématique et odométrie
{
  const r = R.race({ robots: [{ algo: 'wall', loc: 'odom' }], seed: 3, odo: { scaleL: 1, scaleR: 1, sigma: 0 }, cam: { sigma: 0, sigmaTh: 0 } }).bots[0];
  ok(r.hits === 0 && r.errEnd < 0.01, 'codeurs parfaits et aucun choc : l\'odométrie suit le robot (' + (r.errEnd * 1000).toFixed(2) + ' mm en fin de course)');
}
{
  const a = R.race({ robots: [{ algo: 'bounce' }], seed: 9 }).bots[0], b = R.race({ robots: [{ algo: 'bounce' }], seed: 9 }).bots[0];
  ok(a.time === b.time && a.hits === b.hits && a.dist === b.dist, 'même graine → même course');
}
// ------------------------------------------------------------ contacts
for (const tr of ['u', 'obstacles', 'chicane']) {
  const res = R.race({ track: tr, robots: [{ algo: 'colors', color: 'o' }, { algo: 'bounce' }, { algo: 'wall' }, { algo: 'potential' }], seed: 11, record: true, every: 1, tMax: 60 }), T = res.track;
  let minWall = Infinity, minPair = Infinity;
  const L = Math.min(...res.bots.map((b) => b.trace.length));
  for (let k = 0; k < L; k++) {
    const P = res.bots.map((b) => b.trace[k]);
    for (const p of P) for (const s of T.walls) { const q = R.closestOnSeg(p[1], p[2], s); minWall = Math.min(minWall, Math.hypot(p[1] - q[0], p[2] - q[1])); }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) minPair = Math.min(minPair, Math.hypot(P[i][1] - P[j][1], P[i][2] - P[j][2]));
  }
  ok(minWall >= R.ROBOT.r - 0.01, tr + ' : aucun robot ne traverse un mur (distance mini ' + (minWall * 100).toFixed(1) + ' cm)');
  ok(minPair >= 2 * R.ROBOT.r - 0.02, tr + ' : les robots ne se chevauchent pas (entraxe mini ' + (minPair * 100).toFixed(1) + ' cm)');
}
// ------------------------------------------------------------ arrivée
{
  const T = R.track('u'); ok(T.checkX > 3 && T.finish.x < 0.5, 'l\'arrivée exige d\'avoir fait demi-tour au bout de la piste');
  const r = R.race({ robots: [{ algo: 'wall' }], seed: 2, record: true, every: 1 }).bots[0];
  ok(r.time !== null && r.trace.some((p) => p[1] > T.checkX) && r.trace[r.trace.length - 1][1] < T.finish.x && r.trace[r.trace.length - 1][2] > 0.6, 'le suivi de mur passe le point de contrôle puis franchit l\'arrivée en haut');
}
// ------------------------------------------------------------ stratégies (20 courses chacune)
const N = 20;
for (const tr of ['u', 'obstacles', 'chicane']) {
  const w = R.stats('wall', 'ekf', N, { track: tr }), b = R.stats('bounce', 'ekf', N, { track: tr });
  ok(w.rate === 1, tr + ' : le suivi de mur termine toutes les courses');
  ok(b.rate < 0.6 && b.hits > 10 * Math.max(1, w.hits), tr + ' : le rebond aléatoire termine rarement (' + (b.rate * 100).toFixed(0) + ' %) et se cogne beaucoup (' + b.hits.toFixed(0) + ' chocs)');
  const pe = R.stats('potential', 'ekf', N, { track: tr }), po = R.stats('potential', 'odom', N, { track: tr }), pt = R.stats('potential', 'true', N, { track: tr });
  ok(pt.rate === 1 && pe.rate === 1, tr + ' : champ de potentiel bien localisé → toujours à l\'arrivée');
  ok(po.rate < pe.rate, tr + ' : avec l\'odométrie seule, le champ de potentiel échoue (' + (po.rate * 100).toFixed(0) + ' %)');
  ok(pe.err < po.err / 20, tr + ' : la caméra et le filtre de Kalman divisent l\'erreur de position (' + (po.err * 100).toFixed(1) + ' cm → ' + (pe.err * 1000).toFixed(1) + ' mm)');
  ok(pe.tMean < w.tMean, tr + ' : bien localisé, le champ de potentiel est plus rapide que le suivi de mur (' + pe.tMean.toFixed(1) + ' s / ' + w.tMean.toFixed(1) + ' s)');
  const g = R.stats('bug2', 'ekf', N, { track: tr }); ok(g.rate === 1, tr + ' : Bug2 termine toutes les courses');
  const c = R.stats('colors', 'odom', N, { track: tr }); ok(c.rate === 1, tr + ' : la règle des couleurs termine toutes les courses sans aucune localisation (' + c.tMean.toFixed(1) + ' s, ' + c.hits.toFixed(0) + ' chocs)');
  ok(c.hits < b.hits / 2, tr + ' : la couleur évite la moitié des chocs du rebond aléatoire au moins');
}
{ const o = R.stats('potential', 'odom', 10, { odo: { scaleL: 1, scaleR: 1, sigma: 0 } }); ok(o.rate === 1, 'codeurs parfaits : l\'odométrie seule suffirait (preuve que c\'est la dérive qui fait échouer)'); }

console.log(n - ko + ' / ' + n + ' tests réussis');
if (ko) { fails.forEach((f) => console.log('ÉCHEC : ' + f)); process.exit(1); }
