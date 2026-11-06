/* Tests du moteur hiver.js : node tests/test.js */
'use strict';
const H = require('../hiver.js'), D = H.DEG;
let n = 0, bad = 0;
function ok(c, msg) { n++; if (!c) { bad++; console.log('ÉCHEC : ' + msg); } }
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' ≠ ' + b + ')');
const r = H.rng(7), U = (a, b) => a + (b - a) * r();

// outils
near(H.rhoAir(0), 1.225, 1e-12, 'ρ au niveau de la mer'); near(H.rhoAir(2000), 1.225 * Math.exp(-2000 / 8500), 1e-12, 'ρ à 2 000 m');
near(H.erf(1), 0.8427007929, 2e-7, 'erf(1)'); near(H.normCdf(0), 0.5, 1e-9, 'Φ(0)'); near(H.normCdf(1.959964), 0.975, 1e-6, 'Φ(1,96)');
// 1. glisse
for (let k = 0; k < 40; k++) {
  const m = U(50, 100), a = U(8, 35) * D, mu = U(0.03, 0.1), C = U(0.15, 0.7), alt = U(0, 3000), rho = H.rhoAir(alt), vt = H.terminalSpeed(m, a, mu, C, rho);
  near(m * H.driveAcc(a, mu), 0.5 * rho * C * vt * vt, 1e-9 * m * 10, 'vitesse limite : poids moteur = traînée #' + k);
  const L = 600, run = H.runPiste({ m, mu, CdA: C, alt, v0: 1e-6, dt: 0.005, segs: [{ L, deg: a / D }] }), ex = H.straightExact(m, a, mu, C, rho, run.T);
  near(run.v[run.v.length - 1], ex.v, 2e-3 * ex.v, 'piste uniforme : RK4 = solution exacte (vitesse) #' + k); near(run.drop, L * Math.sin(a), 1e-6 * L + 0.05, 'dénivelé = L sin α #' + k);
}
ok(H.terminalSpeed(75, 2 * D, 0.06, 0.4, 1) === 0, 'pente trop faible : pas de mouvement entretenu');
{ const run = H.runPiste({ v0: 10, segs: [{ L: 500, deg: 1 }] }); ok(run.stopped, 'faux plat : le skieur s’arrête'); }
near(H.equivHeight(50 / 3.6), 9.833, 0.01, '50 km/h = chute de 9,8 m');
near(H.sidecutRadius(1.6, 0.12, 0.07, 0.10), 1.6 * 1.6 / (8 * 0.02) + 0.02 / 2, 1e-12, 'rayon de cotation par la flèche');
for (let k = 0; k < 50; k++) { const R = U(6, 25), v = U(1, 0.99 * Math.sqrt(9.81 * R)), th = H.carveAngle(v, R); near(Math.tan(th), (v * v) / (9.81 * H.carvedRadius(R, th)), 1e-9, 'virage coupé : tan θ = v²/(g R_sc cos θ) #' + k); }
ok(isNaN(H.carveAngle(13, 15)), 'au-delà de √(g R_sc), le virage coupé pur est impossible'); near(H.carveMaxSpeed(15) * 3.6, 43.67, 0.01, 'ski R = 15 m : 43,7 km/h maxi en coupé'); near(H.loadFactor(10, 10.19), Math.hypot(1, 100 / (9.81 * 10.19)), 1e-12, 'facteur de charge');
// 2. genou
for (let k = 0; k < 60; k++) { const Mrel = U(20, 160), Mpeak = U(20, 200), f = H.twistFall({ Mrel, Mpeak, rise: U(0.01, 0.2), hold: U(0.01, 0.4), dt: 2e-4 }); ok(f.peakLeg <= Mrel + 1e-9, 'la jambe ne reçoit jamais plus que le seuil de la fixation #' + k); if (!f.released) ok(f.peakLeg < Mrel, 'pas de déclenchement : couple resté sous le seuil'); }
ok(!H.twistFall({ Mrel: 70, Mpeak: 150, rise: 0.005, hold: 0.005 }).released, 'pic très court : l’inertie du ski et l’élasticité évitent un déclenchement intempestif');
ok(!H.twistFall({ Mrel: 70, Mpeak: 35, rise: 0.2, hold: 0.5, T: 1 }).released, 'virage normal : pas de déclenchement');
ok(H.twistFall({ Mrel: 30, Mpeak: 35, rise: 0.2, hold: 0.5, T: 1 }).released, 'réglage trop faible : déclenchement en virage normal');
{ const f = H.twistFall({ Mrel: 1e9, Mpeak: 80, rise: 2, hold: 2, T: 3.9 }); near(f.leg[f.leg.length - 1], 80, 1, 'charge lente sans déclenchement : la jambe reprend tout le couple'); }
// 3. poignet
{ const p = { m: 6, v0: 3.4, ka: 60000, ks: 1e12, damp: 0, prot: false, dt: 1e-6 }, w = H.wristImpact(p); near(w.peak, 3.4 * Math.sqrt(60000 * 6), 3, 'impact linéaire sans amortissement : F = v √(k m)'); near(w.E, 0.5 * 6 * 3.4 * 3.4, 1e-12, 'énergie de chute');
  ok(H.wristImpact({ prot: true }).peak < H.wristImpact({ prot: false }).peak, 'protège-poignet : pic réduit'); ok(H.wristImpact({ ks: 4e4 }).peak < H.wristImpact({ ks: 2e6 }).peak, 'neige molle : pic réduit');
  near(H.seriesSolve(0.01, 1000, null, 1000), 5, 1e-12, 'ressorts en série'); }
// 4. tête et casque
{ const aC = new Array(1000).fill(0); for (let i = 0; i < 100; i++) aC[i] = 100; near(H.hic(aC, 1e-4, 0.015).HIC, 0.01 * Math.pow(100, 2.5), 1e-6, 'HIC d’une impulsion rectangulaire 100 g / 10 ms = 1 000');
  const nb = H.headImpact({ helmet: false, kHead: 1e12, ks: 6e6, dt: 2e-7 }); near(nb.peakG, (5.42 * Math.sqrt(6e6 / 5)) / 9.81, 1, 'tête nue, contact linéaire : a = v √(k/m)');
  const en = H.headImpact({ v: 5.42 }); ok(en.peakG < 250, 'casque à 5,42 m/s sur surface rigide : sous 250 g (critère EN 1077) (' + en.peakG.toFixed(0) + ' g)'); ok(en.peakG < H.headImpact({ v: 5.42, helmet: false }).peakG, 'casque : pic réduit');
  const f50 = H.headImpact({ v: 50 / 3.6 }); ok(f50.peakG > 250 && f50.crushFrac > 0.65, 'à 50 km/h la mousse arrive à densification : le casque ne suffit plus');
  near(H.pAIS3(1000), 0.2307, 0.003, 'probabilité AIS ≥ 3 pour HIC 1 000'); ok(H.pAIS3(500) < H.pAIS3(1000) && H.pAIS3(1000) < H.pAIS3(2000), 'probabilité croissante avec le HIC');
  ok(H.headImpact({ v: 8.3, ks: 5e4, helmet: false }).peakG < H.headImpact({ v: 8.3, ks: 5e6, helmet: false }).peakG, 'neige poudreuse : choc bien plus doux que la glace'); }
// 5. avalanche
{ const ax = H.dipole(5, 0, 0, 0, 0, 0), eq = H.dipole(0, 5, 0, 0, 0, 0); near(Math.hypot(ax[0], ax[1], ax[2]), 2 / 125, 1e-15, 'dipôle : axe 2/r³'); near(Math.hypot(eq[0], eq[1], eq[2]), 1 / 125, 1e-15, 'dipôle : côté 1/r³');
  for (let k = 0; k < 60; k++) { const o = { x0: U(0, 10), y0: U(0, 10), xv: U(20, 50), yv: U(10, 50), ang: U(0, Math.PI), depth: U(0.5, 2) }, s = H.fluxSearch(o), e = s.path[s.path.length - 1];
    ok(Math.hypot(e[0] - o.xv, e[1] - o.yv) < 2.6, 'recherche par lignes de champ : victime atteinte #' + k); ok(s.L >= s.straight - 2.6, 'le chemin n’est pas plus court que la ligne droite #' + k);
    const x = U(-30, 30), y = U(-30, 30), dd = H.shownDistance(x, y, 0, 0, o.ang, 0), rr = Math.hypot(x, y); ok(dd >= rr - 1e-9 && dd <= rr * Math.cbrt(2) + 1e-9, 'distance affichée entre r et 1,26 r #' + k); }
  near(H.survival(18), 0.91, 1e-12, 'survie à 18 min'); near(H.survival(35), 0.34, 1e-12, 'survie à 35 min'); let mono = true; for (let t = 0; t < 200; t += 0.5) if (H.survival(t + 0.5) > H.survival(t) + 1e-12) mono = false; ok(mono, 'courbe de survie décroissante');
  const rt = H.rescueTime({ L: 60 }); near(rt.total, rt.first + rt.tSearch + rt.fine + rt.probe + rt.dig, 1e-12, 'durée de sauvetage'); near(H.rescueTime({ depth: 1 }).dig, 12, 1e-12, 'pelletage 1 m seul : 12 min'); ok(H.rescueTime({ depth: 1, n: 3 }).dig < 6, 'à 3 sauveteurs, pelletage plus court'); }
// 6. froid
near(H.windChill(0, 20), -5.24, 0.01, 'refroidissement éolien 0 °C, 20 km/h'); near(H.windChill(-10, 50), -21.77, 0.01, 'refroidissement éolien −10 °C, 50 km/h'); near(H.windChill(-5, 3), -5, 0, 'vent < 4,8 km/h : pas de correction');
[[-5, 0], [-15, 1], [-30, 2], [-45, 3], [-50, 4], [-60, 5]].forEach(([w, c]) => ok(H.chillRisk(w) === c, 'catégorie de risque ' + w));
console.log(n + ' vérifications, ' + bad + ' échec(s)');
process.exit(bad ? 1 : 0);
