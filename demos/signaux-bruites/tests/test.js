/* Vérifications du moteur de la démo « Signaux bruités » : node tests/test.js */
'use strict';
const S = require('../signaux.js');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('ÉCHEC : ' + m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m} (${a} ≠ ${b})`);

// simu_sys.m : les 4 formules, x ≤ 0 remplacé par 1e-6
near(S.simuSys([2], 1, 3, 6)[0], 12, 1e-12, 'linéaire 3·2 + 6');
near(S.simuSys([Math.E], 2, 2, 1)[0], 3, 1e-12, 'log 2·ln(e) + 1');
near(S.simuSys([1], 3, 5, -0.4)[0], 5 * Math.exp(-0.4), 1e-12, 'exp 5·e^(−0,4)');
near(S.simuSys([4], 4, 0.5, 3)[0], 6, 1e-12, 'puissance 3·4^0,5');
near(S.simuSys([0], 2, 1, 0)[0], Math.log(1e-6), 1e-9, 'x = 0 → 1e-6 (sécurité du log)');
let err = false; try { S.simuSys([1], 9, 1, 1); } catch (e) { err = true; } ok(err, 'type inconnu → erreur');

// bruit.m : moyenne, écart-type, loi uniforme sur [−σ, σ]
{
  const h = S.Hasard(11), g = S.bruit(100000, 0.7, 1, h), u = S.bruit(100000, 0.7, 2, h);
  const m = (v) => v.reduce((s, x) => s + x, 0) / v.length, sd = (v) => Math.sqrt(v.reduce((s, x) => s + (x - m(v)) ** 2, 0) / v.length);
  near(m(g), 0, 0.01, 'gaussien centré'); near(sd(g), 0.7, 0.01, 'gaussien σ');
  near(sd(u), 0.7 / Math.sqrt(3), 0.01, 'uniforme : σ/√3'); ok(u.every((v) => Math.abs(v) <= 0.7), 'uniforme dans [−σ, σ]');
  ok(Math.abs(g.filter((v) => Math.abs(v) < 1.96 * 0.7).length / g.length - 0.95) < 0.005, '95 % à ±1,96σ');
  near(S.densiteBruit(0, 1, 1), 1 / Math.sqrt(2 * Math.PI), 1e-12, 'densité gaussienne'); near(S.densiteBruit(0.3, 1, 2), 0.5, 1e-12, 'densité uniforme');
}

// polyfit et R²
{
  const p = S.polyfit1([1, 2, 3, 4], [3, 5, 7, 9]);
  near(p[0], 2, 1e-12, 'pente'); near(p[1], 1, 1e-12, 'ordonnée');
  near(S.r2([1, 2, 3], [1, 2, 3]), 1, 1e-15, 'R² parfait');
}

// Sans bruit, les deux méthodes retrouvent exactement les paramètres (y > 0)
const x = S.linspace(0.1, 10, 200);
for (const [t, p0, p1] of [[1, 3, 6], [2, 2, 1], [3, 5, -0.4], [3, 1, 0.3], [4, 1.5, 2], [4, -0.5, 4]]) {
  const y = S.simuSys(x, t, p0, p1);
  const o = S.estimerOrigine(x, y, t), c = S.estimerCorrige(x, y, t);
  near(o.p0, p0, 1e-8, `origine sans bruit, modèle ${t} p0`); near(o.p1, p1, 1e-8, `origine sans bruit, modèle ${t} p1`);
  near(c.p0, p0, 1e-7, `corrigé sans bruit, modèle ${t} p0`); near(c.p1, p1, 1e-7, `corrigé sans bruit, modèle ${t} p1`);
  ok(S.analyseOrigine(x, y).meilleur === t && S.analyseCorrigee(x, y).meilleur === t, `bon modèle choisi sans bruit (${t})`);
}

// Loi de Student
near(S.studentQuantile(0.975, 10), 2.228138852, 1e-6, 't(0,975 ; 10)');
near(S.studentQuantile(0.975, 198), 1.972017478, 1e-6, 't(0,975 ; 198)');
near(S.studentQuantile(0.975, 1), 12.70620474, 1e-4, 't(0,975 ; 1)');
near(S.studentCdf(0, 5), 0.5, 1e-12, 'symétrie de Student');

// Linéaire : intervalle de confiance = formule exacte de la régression linéaire
{
  const h = S.Hasard(4), y = S.simuSys(x, 1, 3, 6).map((v) => v + 2 * h.randn());
  const c = S.estimerCorrige(x, y, 1);
  const mx = x.reduce((s, v) => s + v, 0) / x.length, sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  near(c.se0, c.sigma / Math.sqrt(sxx), 1e-10, 'écart-type de la pente');
  near(c.se1, c.sigma * Math.sqrt(1 / x.length + mx * mx / sxx), 1e-10, 'écart-type de l\'ordonnée');
  near(c.sigma, 2, 0.25, 'σ estimé ≈ σ vrai');
}

// Monte-Carlo : la version corrigée est sans biais et ses intervalles couvrent ~95 %
const base = { n: 200, xmin: 0.1, xmax: 10, typeBruit: 1, mu: 0, graine: 3, modele: 0 };
{
  const r = S.monteCarlo({ ...base, type: 1, p0: 3, p1: 6, sigma: 2 }, 1500).r;
  ok(Math.abs(r.couv0 - 0.95) < 0.02 && Math.abs(r.couv1 - 0.95) < 0.02, `couverture linéaire ≈ 95 % (${r.couv0}, ${r.couv1})`);
}
{
  const r = S.monteCarlo({ ...base, type: 3, p0: 5, p1: -0.4, sigma: 0.5 }, 400).r;
  ok(Math.abs(r.cor0.biais) < 0.05 && Math.abs(r.cor1.biais) < 0.005, `exp décroissante : corrigé sans biais (${r.cor0.biais}, ${r.cor1.biais})`);
  ok(Math.abs(r.ori0.biais) > 1, `exp décroissante : méthode d'origine très biaisée (p0 ${r.ori0.biais})`);
  ok(Math.abs(r.couv0 - 0.95) < 0.04 && Math.abs(r.couv1 - 0.95) < 0.04, `exp : couverture ≈ 95 % (${r.couv0}, ${r.couv1})`);
  ok(r.bonCor > 0.95 && r.bonOri < 0.2, `exp : bon modèle reconnu (corrigé ${r.bonCor}, origine ${r.bonOri})`);
}
{
  const r = S.monteCarlo({ ...base, type: 4, p0: 1.5, p1: 2, sigma: 3 }, 400).r;
  ok(Math.abs(r.cor0.biais) < 0.02 && Math.abs(r.cor1.biais) < 0.05, `puissance : corrigé sans biais (${r.cor0.biais}, ${r.cor1.biais})`);
  ok(Math.abs(r.ori1.biais) > 0.5, `puissance : origine biaisée (p1 ${r.ori1.biais})`);
  ok(r.bonCor > 0.95 && r.bonOri < 0.2, `puissance : bon modèle (corrigé ${r.bonCor}, origine ${r.bonOri})`);
}
{
  // bruit non centré (μ = 1) : la pente reste juste, l'ordonnée absorbe μ
  const r = S.monteCarlo({ ...base, type: 1, p0: 3, p1: 6, sigma: 2, mu: 1 }, 400).r;
  near(r.cor1.biais, 1, 0.1, 'μ = 1 : biais de l\'ordonnée = μ'); near(r.cor0.biais, 0, 0.02, 'μ = 1 : pente non biaisée');
}

// Les valeurs ≤ 0 remplacées par 1e-4 : comptées
{
  const y = [1, -2, 0, 3], e = S.estimerOrigine([1, 2, 3, 4], y, 3);
  ok(e.coupes === 2, 'deux valeurs ≤ 0 remplacées');
}

// Test des suites : résidus de bruit → p grand ; résidus en forme de courbe → p minuscule
{
  const h = S.Hasard(9), r = Array.from({ length: 200 }, () => h.randn());
  ok(S.testSuites(r).p > 0.01, 'résidus aléatoires acceptés');
  const courbe = x.map((v) => (v - 5) ** 2 - 8);
  ok(S.testSuites(courbe).p < 1e-6, 'résidus structurés détectés');
  const y = S.simuSys(x, 3, 1, 0.3).map((v) => v + 0.5 * h.randn());
  ok(S.estimerCorrige(x, y, 1).suites.p < 1e-3, 'droite sur une exponentielle : résidus non aléatoires');
  ok(S.estimerCorrige(x, y, 3).suites.p > 1e-3, 'bon modèle : résidus aléatoires');
}

// Simulation complète : l'IHM d'origine montrait un autre tirage de bruit que celui ajouté
{
  const s = S.simuler({ ...base, type: 1, p0: 3, p1: 6, sigma: 2 });
  ok(s.x.length === 200 && s.y.every((v, i) => Math.abs(v - s.ySys[i] - s.b[i]) < 1e-12), 'y = système + bruit');
  ok(s.bAffiche.some((v, i) => v !== s.b[i]), 'bruit affiché par l\'IHM ≠ bruit ajouté');
  const s2 = S.simuler({ ...base, type: 1, p0: 3, p1: 6, sigma: 2 });
  ok(s2.y.every((v, i) => v === s.y[i]), 'même graine → même tirage');
  const f = S.simuler({ ...base, type: 3, p0: 5, p1: -0.4, sigma: 0.5, modele: 3 });
  ok(f.choixOri.type === 3 && f.choixCor.type === 3, 'modèle forcé');
}

// CSV : aller-retour au format de l'IHM
{
  const s = S.simuler({ ...base, n: 30, type: 2, p0: 2, p1: 1, sigma: 0.3 });
  const d = S.lireCSV(S.csv(s));
  ok(d && d.x.length === 30 && Math.abs(d.y[7] - s.y[7]) < 1e-8, 'CSV relu');
  const d2 = S.lireCSV('X;Signal_Bruite\n1;2,5\n2;3\n3;4');
  ok(d2 && d2.y[0] === 2.5, 'CSV de somme.m avec point-virgule et virgule décimale');
}

console.log(`${n - bad} / ${n} vérifications réussies`);
process.exit(bad ? 1 : 0);
