// Tests de la cordeuse (node tests/test.js)
'use strict';
const C = require('../cordeuse.js');
const D = C.DEFAULTS;
let n = 0, ko = 0; const fails = [];
function ok(c, m) { n++; if (!c) { ko++; fails.push(m); } }
const near = (a, b, t) => Math.abs(a - b) <= t;
const rel = (a, b, t) => Math.abs(a - b) <= t * Math.max(Math.abs(a), Math.abs(b), 1e-300);
const P = (o) => Object.assign({}, D, o);

// ------------------------------------------------------------ réducteur
ok(C.ratio(D) === 116, 'rapport : (29 / 1 filet) × (60 / 15) = 116');
ok(C.ratio(P({ starts: 2 })) === 58, 'vis à 2 filets : rapport divisé par 2');
for (const z of [20, 33, 45, 60, 75, 90]) ok(rel(C.ratio(P({ zBig: z })), (29 * z) / 15, 1e-15), 'rapport proportionnel aux dents de la grande roue (Z = ' + z + ')');
// vis sans fin : rendement et irréversibilité
for (const [st, mu, dw] of [[1, 0.1, 10], [2, 0.1, 10], [1, 0.05, 10], [3, 0.1, 10], [1, 0.15, 8], [2, 0.2, 12]]) {
  const w = C.worm(P({ starts: st, mu, dWorm: dw })), g = Math.atan((Math.PI * 0.8 * st) / (Math.PI * dw)), phi = Math.atan(mu);
  ok(rel(w.etaD, Math.tan(g) / Math.tan(g + phi), 1e-12), 'rendement direct tan γ / tan(γ + φ) (' + st + ' filet(s), μ = ' + mu + ')');
  ok(w.selfLocking === (g <= phi), 'irréversible si et seulement si γ ≤ φ (' + st + ' filet(s), μ = ' + mu + ')');
  ok(w.selfLocking ? w.etaR === 0 : rel(w.etaR, Math.tan(g - phi) / Math.tan(g), 1e-12), 'rendement inverse (' + st + ' filet(s), μ = ' + mu + ')');
  ok(!w.selfLocking || w.etaD < 0.5, 'vis irréversible → rendement direct < 50 % (' + st + ' filet(s), μ = ' + mu + ')');
}
ok(C.worm(D).selfLocking && !C.worm(P({ starts: 2 })).selfLocking, 'valeurs par défaut : 1 filet irréversible, 2 filets réversible');

// ------------------------------------------------------------ grandeurs dérivées
{
  const d = C.derived(D);
  ok(rel(d.Fnom, (0.03 * 4 * 116 * d.eta) / 0.015, 1e-12), 'effort au courant nominal = k·I·N·η / r');
  ok(rel(d.Fmax / d.Fnom, 12 / 0.8 / 4, 1e-12), 'effort de calage / effort nominal = I_calage / I_nominal');
  ok(rel(d.vChain, (400 / 116) * 15, 1e-12), 'vitesse de chaîne à vide = ω₀/N · r');
  ok(rel(d.kEff, 1 / (1 / 2 + 1 / 10), 1e-12), 'corde et ressort en série : 1/k = 1/k_corde + 1/K_r');
  ok(rel(d.res, (10 * 30) / 1024, 1e-12), 'résolution de la tension = K_r × course du potentiomètre / 2¹⁰');
  ok(d.Fnom > D.Tset, 'ma roue de 60 dents : effort nominal (' + d.Fnom.toFixed(0) + ' N) au-dessus de la consigne de 250 N');
  ok(C.derived(P({ zBig: 30 })).Fnom < D.Tset, 'roue de 30 dents : effort nominal (' + C.derived(P({ zBig: 30 })).Fnom.toFixed(0) + ' N) insuffisant pour 250 N');
}
for (const z of [20, 40, 60, 80]) { const a = C.derived(P({ zBig: z })), b = C.derived(P({ zBig: z + 10 })); ok(b.Fnom > a.Fnom && b.vChain < a.vChain && rel(a.Fnom * a.vChain, b.Fnom * b.vChain, 1e-12), 'Z ' + z + ' → ' + (z + 10) + ' : plus d\'effort, moins de vitesse, produit constant'); }

// ------------------------------------------------------------ simulation de la mise en tension
{
  const s = C.simulate({}, { t1: 8 });
  ok(s.t95 !== null && s.t95 > 1 && s.t95 < 6, 'mise en tension : 95 % de la consigne en ' + (s.t95 || 0).toFixed(2) + ' s');
  ok(near(s.err, C.staticError({}), s.d.res + 0.05), 'erreur statique simulée (' + s.err.toFixed(2) + ' N) = théorie (' + C.staticError({}).toFixed(2) + ' N) à la résolution près');
  ok(s.T.every((T) => T <= D.Tset + 0.5), 'pas de dépassement de la consigne (chaîne lente, correcteur P)');
  ok(s.Tmes.every((T) => near(T / s.d.res, Math.round(T / s.d.res), 1e-9)), 'mesure quantifiée par le convertisseur 10 bits');
  ok(s.U.every((u) => u <= 12 + 1e-12 && u >= -12 - 1e-12), 'tension moteur saturée à ±12 V');
  const iEnd = s.i[s.i.length - 1], eEnd = D.Tset - s.Tmes[s.Tmes.length - 1];
  ok(near(iEnd, (D.Kp * eEnd) / D.R, 1e-9) && iEnd > 1, 'à l\'arrêt, le correcteur P garde un courant Kp·e/R = ' + iEnd.toFixed(2) + ' A (le moteur chauffe sans tourner)');
}
for (const Kp of [0.1, 0.25, 0.5]) { const s = C.simulate({ Kp }, { t1: 15 }); ok(near(s.err, C.staticError({ Kp }), s.d.res + 0.05), 'erreur statique Kp = ' + Kp + ' V/N : ' + s.err.toFixed(2) + ' N (théorie ' + C.staticError({ Kp }).toFixed(2) + ')'); }
for (const Kp of [1, 2, 5]) { const s = C.simulate({ Kp }, { t1: 15 }); ok(s.err >= -s.d.res - 0.05 && s.err <= C.staticError({ Kp }) + s.d.res + 0.05, 'Kp = ' + Kp + ' V/N : l\'élan du moteur réduit l\'écart sous la valeur maximale (' + s.err.toFixed(2) + ' ≤ ' + C.staticError({ Kp }).toFixed(2) + ' N)'); }
{ let prev = Infinity; for (const Kp of [0.1, 0.3, 1, 3]) { const e = C.staticError({ Kp }); ok(e < prev, 'erreur statique plus petite quand Kp augmente (' + Kp + ')'); prev = e; } }
{ let prev = 0; for (const z of [20, 30, 45, 60, 90]) { const s = C.simulate({ zBig: z }, { t1: 12 }); ok(s.t95 > prev, 'plus de dents → mise en tension plus lente (Z = ' + z + ', ' + s.t95.toFixed(2) + ' s)'); prev = s.t95; } }
// ------------------------------------------------------------ coupure de courant et retour du chariot
{
  const a = C.simulate({}, { t1: 8, cut: 5 }); ok(near(a.Tfinal, a.Tend, 1e-9), 'coupure de courant, vis à 1 filet : la tension est conservée (' + a.Tfinal.toFixed(1) + ' N)');
  const b = C.simulate({ starts: 2 }, { t1: 8, cut: 5 }); ok(b.Tfinal < 5 && b.Tend > 200, 'coupure de courant, vis à 2 filets : la corde se détend (' + b.Tend.toFixed(0) + ' → ' + b.Tfinal.toFixed(1) + ' N)');
  const r = C.simulate({}, { t1: 10, release: 5 }); ok(r.Tfinal < 0.2 && r.mu[r.mu.length - 1] < 0.1, 'second appui : le chariot revient en position avant');
}
{
  // à vide (corde très souple), la chaîne avance à la vitesse prévue
  const s = C.simulate({ kc: 0.001, Tset: 1e6 }, { t1: 2 }); const k = s.t.length - 1, v = (s.mu[k] - s.mu[k - 10]) / (s.t[k] - s.t[k - 10]);
  ok(rel(v, s.d.vChain, 0.01), 'à vide : vitesse de chaîne simulée ' + v.toFixed(1) + ' mm/s = ' + s.d.vChain.toFixed(1) + ' mm/s');
}
{
  // équilibre des couples à vitesse constante : courant = charge ramenée / (k·η)
  const s = C.simulate({ kc: 0.5, Kp: 100 }, { t1: 3, every: 1 }); const k = s.t.findIndex((t) => t > 1.5), T = s.T[k], i = s.i[k], acc = (s.om[k + 1] - s.om[k]) / 1e-4;
  ok(rel(0.03 * i, (T * 0.015) / (s.d.N * s.d.eta) + D.Jm * acc, 1e-6), 'en traction : k·i = T·r/(N·η) + J·dω/dt (' + i.toFixed(3) + ' A)');
}

console.log(n - ko + ' / ' + n + ' tests réussis');
if (ko) { fails.forEach((f) => console.log('ÉCHEC : ' + f)); process.exit(1); }
