// Tests du moteur RLC (node tests/test.js)
'use strict';
const R = require('../rlc.js');
let n = 0, ko = 0; const fails = [];
function ok(c, m) { n++; if (!c) { ko++; fails.push(m); } }
const near = (a, b, t) => Math.abs(a - b) <= t;
const rel = (a, b, t) => Math.abs(a - b) <= t * Math.max(Math.abs(a), Math.abs(b), 1e-300);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const U = (a, b) => a + (b - a) * rnd();

// ------------------------------------------------------------ valeurs du TP
const d = R.derived(R.TP);
ok(near(d.f0, 1591.549, 1e-3), 'f₀ = 1/(2π√(LC)) ≈ 1 592 Hz');
ok(near(d.Q, 20 / 3, 1e-12), 'Q = √(L/C)/(R + R_GBF) = 1000/150 ≈ 6,67');
ok(near(R.derived(Object.assign({}, R.TP, { R: 10000 })).Q, 1000 / 10050, 1e-12), 'R = 10 kΩ : Q ≈ 0,1');
ok(R.voltRes(R.derived(Object.assign({}, R.TP, { R: 10000 })).Q) === null, 'R = 10 kΩ : pas de résonance en tension (Q < 1/√2)');
{ const s = R.sine(R.TP, 10, 5); ok(near(s.Uc, 5, 1e-3) && near(s.phiC, 0, 1e-3), 'f = 10 Hz ≪ f₀ : u_C = e, en phase'); }
{ const s = R.sine(R.TP, 1e5, 5); ok(s.Uc < 2e-3 && near(Math.abs(s.phiC), Math.PI, 3e-3), 'f = 100 kHz ≫ f₀ : u_C ≈ 1,3 mV, en opposition de phase'); }
{ const s = R.sine(R.TP, d.f0, 5); ok(near(s.I, 5 / 150, 1e-12) && near(s.Uc, 5 * d.Q, 1e-9) && near(s.Uout, 5 * (100 / 150), 1e-9), 'à f₀ : I = E/R_t, U_C = Q·E, sortie du générateur = E·R/R_t'); }

// ------------------------------------------------------------ régime sinusoïdal : formules complexes = formules réduites
for (let k = 0; k < 200; k++) {
  const p = { R: U(1, 5000), Rg: 50, r: U(0, 50), L: U(0.001, 1), C: U(1e-9, 1e-5) }, dd = R.derived(p), f = dd.f0 * Math.exp(U(-3, 3)), E = U(0.1, 10);
  const s = R.sine(p, f, E), x = s.x;
  ok(rel(s.Uc / E, R.gainC(x, dd.Q), 1e-10) && rel((s.I * dd.Rt) / E, R.gainI(x, dd.Q), 1e-10) && near(s.phiC, R.phaseC(x, dd.Q), 1e-10), 'formules complexes = formules réduites (tirage ' + k + ')');
}
// ------------------------------------------------------------ résonances
for (const Q of [0.1, 0.5, 0.7, 0.72, 1, 2, 3, 5, 6.67, 50]) {
  // maximum numérique de U_C/E
  let bx = 0, bv = 0; for (let x = 1e-4; x < 3; x += 1e-5) { const v = R.gainC(x, Q); if (v > bv) { bv = v; bx = x; } }
  const vr = R.voltRes(Q);
  if (Q > Math.SQRT1_2) ok(vr && near(vr.x, bx, 2e-5) && rel(vr.peak, bv, 1e-8), 'Q = ' + Q + ' : résonance en tension en x = √(1 − 1/2Q²) = ' + (vr ? vr.x.toFixed(4) : '—'));
  else ok(vr === null && bx < 1e-3, 'Q = ' + Q + ' : pas de résonance en tension, U_C décroît');
  // intensité : maximum en x = 1 quel que soit Q, bande passante Δx = 1/Q
  let ix = 0, iv = 0; for (let x = 1e-3; x < 5; x += 1e-4) { const v = R.gainI(x, Q); if (v > iv) { iv = v; ix = x; } }
  ok(near(ix, 1, 2e-4) && near(iv, 1, 1e-8), 'Q = ' + Q + ' : résonance en intensité en x = 1');
  const b = R.band(Q);
  ok(near(R.gainI(b.lo, Q), Math.SQRT1_2, 1e-12) && near(R.gainI(b.hi, Q), Math.SQRT1_2, 1e-12) && near(b.width, 1 / Q, 1e-12) && near(b.lo * b.hi, 1, 1e-12), 'Q = ' + Q + ' : bande passante Δω = ω₀/Q, x₋·x₊ = 1');
  ok(near(R.phaseC(1, Q), -Math.PI / 2, 1e-12), 'Q = ' + Q + ' : u_C en quadrature à ω₀');
}
// ------------------------------------------------------------ régime libre : Runge-Kutta = solution exacte
for (const Rv of [10000, 1850, 2000 - 150, 100, 0.5, 10]) {
  const p = Object.assign({}, R.TP, { R: Rv }), dd = R.derived(p), t1 = Math.min(10 * dd.tau, 0.05);
  const s = R.simulate(p, () => 0, t1, Math.min(t1 / 20000, 1 / (dd.f0 * 500)), [5, 0], 10);
  let worst = 0; s.t.forEach((t, k) => (worst = Math.max(worst, Math.abs(s.uc[k] - R.free(p, 5, t)))));
  ok(worst < 1e-6, 'régime libre Q = ' + dd.Q.toFixed(3) + ' : Runge-Kutta = solution exacte (écart ' + worst.toExponential(1) + ' V)');
}
{
  // régime critique exact (Q = 1/2) et continuité de la solution exacte autour de Q = 1/2
  const p = Object.assign({}, R.TP, { R: 2000 - 50 }); ok(near(R.derived(p).Q, 0.5, 1e-12), 'R = 1 950 Ω : régime critique, Q = 1/2');
  const s = R.simulate(p, () => 0, 0.01, 1e-6, [5, 0], 10); let w = 0; s.t.forEach((t, k) => (w = Math.max(w, Math.abs(s.uc[k] - R.free(p, 5, t))))); ok(w < 1e-6, 'régime critique : Runge-Kutta = (1 + αt)e^(−αt)');
  const a = R.free(Object.assign({}, R.TP, { R: 1950 - 1e-6 }), 5, 1e-3), b = R.free(p, 5, 1e-3), c = R.free(Object.assign({}, R.TP, { R: 1950 + 1e-6 }), 5, 1e-3);
  ok(near(a, b, 1e-6) && near(c, b, 1e-6), 'solution exacte continue autour du régime critique');
}
{
  // pseudo-période et décroissance de l'enveloppe
  const p = R.TP, dd = R.derived(p), wd = Math.sqrt(dd.w0 ** 2 - dd.alpha ** 2), s = R.simulate(p, () => 0, 0.01, 1e-6, [5, 0], 1), z = [];
  for (let k = 1; k < s.uc.length; k++) if (s.uc[k - 1] > 0 && s.uc[k] <= 0) z.push(s.t[k - 1] + (s.uc[k - 1] / (s.uc[k - 1] - s.uc[k])) * (s.t[k] - s.t[k - 1]));
  const Tm = (z[z.length - 1] - z[0]) / (z.length - 1);
  ok(rel(Tm, (2 * Math.PI) / wd, 1e-5), 'pseudo-période mesurée = 2π/ω_d (' + (Tm * 1e3).toFixed(4) + ' ms)');
  ok(rel(R.free(p, 5, 2 * Math.PI / wd * 3) / 5, Math.exp(-dd.alpha * 2 * Math.PI / wd * 3), 1e-9), 'enveloppe en e^(−αt), α = R_t/2L');
}
// ------------------------------------------------------------ échelon et sinus forcé par simulation
{
  const p = R.TP, s = R.simulate(p, () => 5, 0.01, 1e-6, [0, 0], 10); let w = 0; s.t.forEach((t, k) => (w = Math.max(w, Math.abs(s.uc[k] - R.step(p, 5, t))))); ok(w < 1e-6, 'échelon : Runge-Kutta = solution exacte');
}
for (const f of [300, 1591.55, 1700, 5000]) {
  const p = R.TP, dd = R.derived(p), w = 2 * Math.PI * f, t1 = 12 * dd.tau + 5 / f, s = R.simulate(p, (t) => 5 * Math.cos(w * t), t1, 1 / (f * 2000), [0, 0], 1);
  let mx = 0; const T = 1 / f; for (let k = 0; k < s.t.length; k++) if (s.t[k] > t1 - 2 * T) mx = Math.max(mx, Math.abs(s.uc[k]));
  ok(rel(mx, R.sine(p, f, 5).Uc, 2e-3), 'sinus ' + f + ' Hz : amplitude simulée = formule (' + mx.toFixed(3) + ' / ' + R.sine(p, f, 5).Uc.toFixed(3) + ' V)');
}
// ------------------------------------------------------------ signal carré (photo du banc : 24,88 Hz)
{
  const p = R.TP, sq = R.square(p, 24.88, 5, 2), T = 1 / 24.88;
  const at = (t) => { let k = 0; while (k < sq.t.length - 1 && sq.t[k + 1] < t) k++; return sq.uc[k]; };
  ok(near(at(0.3 * T), at(1.3 * T), 1e-3), 'carré : régime périodique établi');
  ok(near(at(0.49 * T), 5, 1e-3) && near(at(0.99 * T), -5, 1e-3), 'carré à 24,88 Hz : u_C se stabilise sur ±E avant chaque front');
  let mx = -Infinity; for (let k = 0; k < sq.t.length; k++) if (sq.t[k] < T / 2) mx = Math.max(mx, sq.uc[k]);
  const dd = R.derived(p), wd = Math.sqrt(dd.w0 ** 2 - dd.alpha ** 2);
  ok(rel(mx, 5 + 10 * Math.exp(-dd.alpha * Math.PI / wd), 1e-3), 'carré : premier dépassement = E + 2E·e^(−απ/ω_d) (' + mx.toFixed(3) + ' V)');
}

console.log(n - ko + ' / ' + n + ' tests réussis');
if (ko) { fails.forEach((f) => console.log('ÉCHEC : ' + f)); process.exit(1); }
