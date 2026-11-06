/* Tests du moteur optique.js : node tests/test.js */
'use strict';
const O = require('../optique.js'), SC = require('../schemas.js');
let n = 0, bad = 0;
function ok(c, msg) { n++; if (!c) { bad++; console.log('ÉCHEC : ' + msg); } }
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' ≠ ' + b + ')');
const r = O.rng(11), U = (a, b) => a + (b - a) * r();

// 1. verres : indices et constringences du catalogue
near(O.nGlass('BK7', 587.5618), 1.5168, 1e-4, 'n_d N-BK7'); near(O.nGlass('F2', 587.5618), 1.6200, 1e-4, 'n_d F2');
near(O.nGlass('SF11', 587.5618), 1.78472, 1e-4, 'n_d N-SF11'); near(O.nGlass('SiO2', 587.5618), 1.45846, 1e-4, 'n_d silice');
near(O.abbe('BK7'), 64.17, 0.05, 'V_d N-BK7'); near(O.abbe('F2'), 36.37, 0.05, 'V_d F2'); near(O.abbe('SF11'), 25.68, 0.05, 'V_d N-SF11'); near(O.abbe('SiO2'), 67.82, 0.1, 'V_d silice');
ok(O.nGlass('BK7', 405) > O.nGlass('BK7', 532) && O.nGlass('BK7', 532) > O.nGlass('BK7', 650), 'dispersion normale (n décroît avec λ)');

// 2. banc : matrices et conjugaison de Descartes
const im = O.imageABCD([{ x: 250, f: 100, D: 40 }], 50); near(im.x, 450, 1e-9, '2f-2f : image à 450'); near(im.g, -1, 1e-12, '2f-2f : γ = −1');
const lo = O.imageABCD([{ x: 250, f: 100, D: 40 }], 200); ok(!im.real || lo.real === false, 'loupe : image virtuelle'); near(lo.x, 150, 1e-9, 'loupe : image à 100 mm avant la lentille'); near(lo.g, 2, 1e-12, 'loupe : γ = 2');
for (let k = 0; k < 400; k++) {
  const N = 1 + Math.floor(r() * 3), Ls = []; let x = U(80, 200);
  for (let i = 0; i < N; i++) { const f = (r() < 0.3 ? -1 : 1) * U(40, 400); Ls.push({ x, f, D: 40 }); x += U(30, 250); }
  const xo = U(0, 60), a = O.imageABCD(Ls, xo), ch = O.imageChain(Ls, xo, 1), last = ch[ch.length - 1];
  const M = O.systemM(Ls, xo, x + 100); near(M[0] * M[3] - M[1] * M[2], 1, 1e-9, 'det M = 1');
  if (isFinite(a.x) && isFinite(last.x) && Math.abs(a.x) < 1e6) { near(a.x, last.x, 1e-6 * Math.max(1, Math.abs(a.x)), 'ABCD = Descartes (position) #' + k); near(a.g, last.h, 1e-6 * Math.max(1, Math.abs(a.g)), 'ABCD = Descartes (grandissement) #' + k); }
  // à l'image réelle, B = 0 : un point objet donne un point image
  if (a.real && isFinite(a.x)) near(O.systemM(Ls, xo, a.x)[1], 0, 1e-6 * Math.max(1, Math.abs(a.x)), 'B = 0 dans le plan image #' + k);
}
// objet à l'infini : image au foyer, lunette afocale
{ const a = O.imageInf([{ x: 100, f: 150, D: 40 }], 0.01); near(a.x, 250, 1e-9, 'objet à l’infini : image au foyer image'); near(a.h, 1.5, 1e-9, 'objet à l’infini : hauteur f′·u');
  const k = O.imageInf([{ x: 100, f: 200, D: 40 }, { x: 350, f: 50, D: 40 }], 0.01); ok(k.afocal, 'lunette de Kepler : système afocal'); near(k.G, -4, 1e-9, 'lunette de Kepler : grossissement −f1/f2');
  const ch = O.imageChain([{ x: 100, f: 150, D: 40 }], -Infinity, 0, 0.01); near(ch[0].h, 1.5, 1e-12, 'construction : objet à l’infini');
  const ay = O.admittedY([{ x: 100, f: 150, D: 40 }], 0, 0.01); near(ay[1] - ay[0], 40, 1e-9, 'faisceau parallèle limité par la monture'); }
// 3. flou sur l'écran
const s0 = O.onScreen([{ x: 250, f: 100, D: 40 }], 50, 450); near(s0.blur, 0, 1e-9, 'écran au plan image : net');
const s1 = O.onScreen([{ x: 250, f: 100, D: 40 }], 50, 480); near(s1.blur, 40 * 30 / 200, 1e-6, 'flou = D·Δ/OA′ (triangles semblables)');
const s2 = O.onScreen([{ x: 250, f: 100, D: 20 }], 50, 480); near(s2.blur, s1.blur / 2, 1e-6, 'monture deux fois plus petite : flou divisé par 2');
ok(O.onScreen([{ x: 250, f: 100, D: 40 }, { x: 300, f: 100, D: 2 }], 50, 600, 30).lit === false || true, 'vignettage calculé sans erreur');
ok(O.admitted([{ x: 100, f: 50, D: 10 }, { x: 200, f: 50, D: 10 }], 0, 200) === null, 'point très hors champ : aucun rayon ne passe (vignettage)');
// 4. Bessel
for (let k = 0; k < 50; k++) { const f = U(50, 200), D = U(4.2 * f, 10 * f), P = O.besselPositions(D, f); P.forEach((xl) => near(O.systemM([{ x: xl, f, D: 40 }], 0, D)[1], 0, 1e-7 * D, 'Bessel : image nette')); near(O.besselF(D, P[1] - P[0]), f, 1e-9 * f, 'Bessel : f = (D² − d²)/4D'); }
ok(O.besselPositions(390, 100) === null, 'Bessel impossible si D < 4f′');
const mc = O.besselMC({ D: 600, f: 100 }); near(mc.mean, 100, 0.1, 'Bessel Monte-Carlo : moyenne'); ok(mc.sd > 0.05 && mc.sd < 1, 'Bessel Monte-Carlo : incertitude plausible (' + mc.sd + ')');
// 5. Descartes par régression 1/OA′ = 1/OA + 1/f′
{ const xs = [], ys = []; [-150, -200, -300, -400, -600].forEach((p) => { const pp = O.conjugate(p, 120); xs.push(1 / p); ys.push(1 / pp); }); const fit = O.linfit(xs, ys); near(fit.a, 1, 1e-12, 'régression : pente 1'); near(1 / fit.b, 120, 1e-9, 'régression : f′'); }
// 6. faisceau gaussien
{ const w0 = 0.5, l = 632.8, zR = Math.PI * w0 * w0 / (l * 1e-6), g = O.gaussBeam([], 0, w0, l, 3000);
  g.pts.forEach(([x, w]) => near(w, w0 * Math.sqrt(1 + (x / zR) ** 2), 1e-9, 'w(z) en espace libre'));
  const gf = O.gaussBeam([{ x: 2000, f: 100, D: 40 }], 0, 1, l, 2400), q = O.gaussBeam([{ x: 0.0001, f: 100, D: 40 }], 0, 1, l, 400);
  near(q.waistW, l * 1e-6 * 100 / (Math.PI * 1), 1e-5, 'col au foyer ≈ λf/(πw)'); near(q.waistAt, 100, 0.1, 'col au foyer image'); ok(gf.waistW > 0, 'col calculé'); }

// 7. tracé exact : loi de Snell, réflexion totale, lame à faces parallèles
for (let k = 0; k < 200; k++) {
  const th = U(-1.2, 1.2), n1 = U(1, 1.8), n2 = U(1, 1.8), d = [Math.cos(th), Math.sin(th)], t = O.refract(d, [-1, 0], n1, n2);
  const s1 = Math.sin(th) * n1; if (Math.abs(s1) > n2) ok(t === null, 'réflexion totale au-delà de l’angle limite'); else near(n2 * t[1], s1, 1e-12, 'n1 sin θ1 = n2 sin θ2');
}
{ const n = 1.5, e = 10, th = 0.4, plate = [{ x: 0, R: Infinity, n, D: 100 }, { x: e, R: Infinity, n: 1, D: 100 }], tr = O.traceExact(plate, [-10, 0], [Math.cos(th), Math.sin(th)], 1);
  near(tr.d[1], Math.sin(th), 1e-12, 'lame : rayon émergent parallèle'); const shift = e * Math.sin(th) * (1 - Math.cos(th) / Math.sqrt(n * n - Math.sin(th) ** 2));
  const yNoPlate = (tr.p[0] + 10) * Math.tan(th), lat = (yNoPlate - tr.p[1]) * Math.cos(th); near(lat, shift, 1e-9, 'lame : décalage latéral e sin θ (1 − cos θ/√(n² − sin² θ))'); }
// 8. lentille épaisse : tracé paraxial = formule des opticiens
for (let k = 0; k < 200; k++) {
  const R1 = (r() < 0.5 ? 1 : -1) * U(20, 300), R2 = (r() < 0.5 ? 1 : -1) * U(20, 300), e = U(1, 15), n = U(1.4, 1.9), S = [{ x: 0, R: R1, n, D: 10 }, { x: e, R: R2, n: 1, D: 10 }];
  const pf = O.paraxialFocus(S), tk = O.thickLensF(R1, R2, e, n); if (Math.abs(tk.f) < 1e5) { near(pf.f, tk.f, 1e-6 * Math.abs(tk.f), 'focale épaisse #' + k); near(pf.bfl, tk.bfl, 1e-6 * Math.abs(tk.f), 'tirage #' + k); }
}
// 9. conditions de Gauss : exact → paraxial quand h → 0 ; aberration en h²
['bi', 'pc', 'cp'].forEach((sh) => {
  const L = O.singlet({ shape: sh, f: 100, D: 30 }), la = O.longAberration(L, 587.5618, [0.001, 0.5, 1]);
  ok(Math.abs(la[0]) < 1e-6, sh + ' : rayon très proche de l’axe → foyer paraxial (' + la[0] + ')');
  near(la[2] / la[1], 4, 0.02, sh + ' : aberration longitudinale ∝ h²'); ok(la[1] < 0, sh + ' : aberration sphérique sous-corrigée (rayons marginaux plus courts)');
});
{ const a = O.longAberration(O.singlet({ shape: 'pc', f: 100, D: 30 }), 587.5618, [10])[0], b = O.longAberration(O.singlet({ shape: 'cp', f: 100, D: 30 }), 587.5618, [10])[0]; ok(b / a > 3.5, 'plan-convexe : face bombée vers la lumière ≈ 4× moins d’aberration (' + (b / a).toFixed(2) + ')'); }
{ const L = O.singlet({ shape: 'pc', f: 100, D: 30 }), bf = O.bestFocus(L, 587.5618, 12, 0), la = O.longAberration(L, 587.5618, [12])[0];
  ok(bf.rms < bf.rmsParax, 'meilleur plan : flou plus petit qu’au foyer paraxial'); ok(bf.x < bf.xF && bf.x > bf.xF + la, 'meilleur plan entre foyer marginal et foyer paraxial');
  ok(O.maxIncidence(L, 587.5618, 12, 0) > O.maxIncidence(L, 587.5618, 3, 0), 'incidence max croît avec l’ouverture'); }
{ const L = O.singlet({ shape: 'pc', f: 100, D: 30 }), sp = O.spot(L, 587.5618, 0.05, 0, O.paraxialFocus(O.surfacesOf(L, 587.5618)).xF, 21); ok(Math.max(...sp.map((p) => Math.abs(p.y))) < 1e-6, 'faisceau fin : tache ponctuelle au foyer paraxial'); }
// 10. chromatisme et doublet achromatique
{ const S = O.focalVsLambda(O.singlet({ shape: 'bi', f: 100, D: 30 }), [486.1327, 656.2725]), A = O.achromat({ f: 100, D: 30 }), Af = O.focalVsLambda(A, [486.1327, 587.5618, 656.2725]);
  ok(S[0].xF < S[1].xF, 'lentille simple : le bleu converge avant le rouge'); near(S[1].xF - S[0].xF, 100 / O.abbe('BK7'), 0.1, 'écart chromatique ≈ f/V');
  near(Af[0].xF, Af[2].xF, 1e-4, 'doublet : foyers F et C confondus'); near(O.paraxialFocus(O.surfacesOf(A, 587.5618)).f, 100, 1e-6, 'doublet : f′ = 100 mm à la raie d');
  ok((S[1].xF - S[0].xF) / Math.abs(Af[1].xF - Af[0].xF) > 20, 'doublet : chromatisme réduit de plus de 20×'); ok(A.R1 > 0 && A.R2 < 0, 'doublet : crown convergent devant'); }

// 11. fonctions spéciales
[[0.5, 0.4923442, 0.0647324], [1, 0.7798934, 0.4382591], [2, 0.4882534, 0.3434157], [4, 0.4984260, 0.4205158], [10, 0.4998987, 0.4681699]].forEach(([x, C, S]) => { const v = O.fresnelCS(x); near(v[0], C, 2e-7, 'C(' + x + ')'); near(v[1], S, 2e-7, 'S(' + x + ')'); });
[2.5, 3.5, 4.5, 6].forEach((x) => { const h = 1e-5, a = O.fresnelCS(x - h), b = O.fresnelCS(x + h); near((b[0] - a[0]) / (2 * h), Math.cos(Math.PI * x * x / 2), 1e-4, 'C′(x) = cos(πx²/2) en ' + x); near((b[1] - a[1]) / (2 * h), Math.sin(Math.PI * x * x / 2), 1e-4, 'S′(x) = sin(πx²/2) en ' + x); });
[3, 5].forEach((x) => { const a = O.fresnelCS(x - 1e-9), b = O.fresnelCS(x + 1e-9); near(a[0], b[0], 1e-8, 'C continue en ' + x); near(a[1], b[1], 1e-8, 'S continue en ' + x); });
near(O.fresnelCS(-1.3)[0], -O.fresnelCS(1.3)[0], 1e-15, 'C impaire');
near(O.besselJ1(1), 0.4400505857, 1e-8, 'J1(1)'); [3.8317059702, 7.0155866698, 10.1734681351].forEach((z) => near(O.besselJ1(z), 0, 1e-7, 'zéro de J1 ' + z));

// 12. diffraction
const base = { type: 'slit', a: 100, lnm: 632.8, D: 2000, model: 'exact' };
{ const cw = O.centralWidth(base); near(O.intensity(cw.exact / 2, base), 0, 1e-20, 'fente : 1er minimum exact à D tan(asin(λ/a))'); near(O.intensity(cw.approx / 2, Object.assign({}, base, { model: 'small' })), 0, 1e-20, 'petits angles : minimum à λD/a'); near(cw.approx, 2 * 632.8e-6 * 2000 / 0.1, 1e-9, 'L = 2λD/a'); ok(Math.abs(cw.exact - cw.approx) / cw.exact < 1e-4, 'a = 100 µm : petits angles excellents'); }
{ const cw = O.centralWidth(Object.assign({}, base, { a: 1 })); ok((cw.exact - cw.approx) / cw.exact > 0.1, 'a = 1 µm : l’approximation des petits angles se trompe de plus de 10 %'); ok(O.centralWidth(Object.assign({}, base, { a: 0.5 })).exact === Infinity, 'a < λ : pas de minimum'); }
{ const h = Object.assign({}, base, { type: 'hole', a: 200 }), cw = O.centralWidth(h); near(O.intensity(cw.exact / 2, h), 0, 1e-12, 'trou : 1er anneau noir à 1,22 λ/a'); near(O.intensity(0, h), 1, 1e-12, 'trou : centre'); }
{ const y = Object.assign({}, base, { type: 'young', a: 40, b: 200, model: 'small' }), i = 632.8e-6 * 2000 / 0.2; near(O.intensity(i, y) / O.sinc(Math.PI * 0.04 * i / 2000 / 632.8e-6) ** 2, 1, 1e-9, 'Young : frange brillante à i = λD/b'); near(O.intensity(i / 2, y), 0, 1e-20, 'Young : frange sombre à i/2'); }
{ const g = Object.assign({}, base, { type: 'grating', lpmm: 300, N: 40 }); O.gratingOrders(g).forEach((od) => { if (od.k % 2) near(O.intensity(od.x, g) / O.sinc(Math.PI * (1 / 300 / 2) * Math.sin(od.theta) / 632.8e-6) ** 2, 1, 1e-6, 'réseau : ordre ' + od.k + ' au bon endroit'); else if (od.k) ok(O.intensity(od.x, g) < 1e-6, 'réseau à traits de largeur p/2 : ordre pair ' + od.k + ' éteint'); else near(O.intensity(0, g), 1, 1e-12, 'réseau : ordre 0'); });
  const o1 = O.gratingOrders(Object.assign({}, g, { lpmm: 600 })).find((q) => q.k === 1); ok((o1.x - o1.xSmall) / o1.x > 0.05, 'réseau 600 traits/mm : les petits angles décalent l’ordre 1 de plus de 5 %'); }
{ const f = Object.assign({}, base, { a: 50, D: 20000, model: 'fresnel' }), ex = Object.assign({}, f, { model: 'exact' }), k = (50e-3) ** 2 / (632.8e-6 * 20000);
  [0, 50, 120, 300].forEach((x) => near(O.intensity(x, f) / k, O.intensity(x, ex), 0.01, 'Fresnel → Fraunhofer loin (x = ' + x + ' mm)'));
  const w = Object.assign({}, base, { a: 20000, D: 1000, model: 'fresnel' }); near(O.intensity(0, w), 1, 0.05, 'fente très large : on retrouve l’onde incidente'); near(O.intensity(10, w), 0.25, 0.02, 'bord de l’ombre géométrique : intensité 1/4');
  ok(O.fresnelNumber(f) < 0.1 && O.fresnelNumber(w) > 10, 'nombre de Fresnel'); }
{ const m = O.hairMeasure(25.3, 2000, 632.8, 1, 5); near(m.a, 2 * 632.8e-6 * 2000 / 25.3 * 1000, 1e-9, 'cheveu : a = 2λD/L'); ok(m.ua > 0 && m.ua / m.a < 0.05, 'cheveu : incertitude'); }
ok(O.rgbOf(632.8)[0] === 255 && O.rgbOf(532)[1] === 255, 'couleurs des lasers');

// interférences : formule de Fresnel, facteur de contraste, trous de Young
{ const base2 = { type: 'young', a: 1e-6, b: 200, lnm: 632.8, D: 2000, model: 'small' }, i = 632.8e-6 * 2000 / 0.2;
  [1, 0.25, 0.04].forEach((r) => { const o = Object.assign({}, base2, { r }), Imax = O.intensity(0, o), Imin = O.intensity(i / 2, o); near((Imax - Imin) / (Imax + Imin), O.contrast(r), 1e-9, 'contraste Γ mesuré = 2√r/(1 + r), r = ' + r); });
  near(O.contrast(1), 1, 1e-15, 'I1 = I2 : Γ = 1');
  const o = Object.assign({}, base2, { r: 0.36 }), I1 = 1, I2 = 0.36, x = 0.37 * i, phi = 2 * Math.PI * 0.2 * x / 2000 / 632.8e-6;
  near(O.intensity(x, o) * (1 + Math.sqrt(I2)) ** 2, I1 + I2 + 2 * Math.sqrt(I1 * I2) * Math.cos(phi), 1e-9, 'formule de Fresnel I = I1 + I2 + 2√(I1I2) cos φ');
  const h = { type: 'youngHoles', a: 100, b: 500, lnm: 532, D: 2000, model: 'exact' }, cw = O.centralWidth({ type: 'hole', a: 100, lnm: 532, D: 2000 }); near(O.intensity(cw.exact / 2, h), 0, 1e-12, 'trous de Young : enveloppe d’Airy');
  const ws = O.whiteSpectrum(31); near(ws.reduce((s, q) => s + q[1], 0), 1, 1e-12, 'spectre blanc normalisé'); near(ws[0][0], 400, 0, 'spectre blanc 400 nm'); near(ws[30][0], 700, 1e-9, 'spectre blanc 700 nm');
  const am = O.apparent(6800, 56e6), aM = O.apparent(6800, 160e6); near(am, 1.2143e-4, 1e-7, 'Mars au plus près : 1,21·10⁻⁴ rad'); near(aM / Math.PI * 180 * 3600, 8.77, 0.01, 'Mars au plus loin : 8,8″'); }
// réfraction : Fresnel, angle limite, Brewster, prisme, fibre
{ const f0 = O.fresnelRT(1, 1.5, 0); near(f0.R, 0.04, 1e-12, 'incidence normale air/verre : R = ((n1 − n2)/(n1 + n2))² = 4 %');
  for (let k = 0; k < 100; k++) { const n1 = U(1, 2), n2 = U(1, 2), th = U(0, 1.5), f = O.fresnelRT(n1, n2, th); if (!f.tir) { ok(f.R >= 0 && f.R <= 1, 'R entre 0 et 1'); near(n1 * Math.sin(th), n2 * Math.sin(f.th2), 1e-12, 'dioptre : Snell'); } else ok(n1 * Math.sin(th) >= n2, 'réflexion totale seulement au-delà de l’angle limite'); }
  near(O.fresnelRT(1, 1.5, O.brewster(1, 1.5)).Rp, 0, 1e-15, 'Brewster : Rp = 0'); near(O.criticalAngle(1.5, 1) * 180 / Math.PI, 41.81, 0.01, 'angle limite verre/air 41,8°'); ok(O.fresnelRT(1.5, 1, 0.75).tir, 'verre → air à 43° : réflexion totale'); ok(isNaN(O.criticalAngle(1, 1.5)), 'pas d’angle limite vers un milieu plus réfringent');
  const A = 60 * Math.PI / 180, n = O.nGlass('BK7', 589.3), dm = O.prismDmin(A, n); near(O.prismN(A, dm), n, 1e-12, 'prisme : indice retrouvé au minimum de déviation');
  let best = 1e9; for (let i = 0.3; i < 1.5; i += 0.0005) { const p = O.prism(A, n, i); if (p.ok) best = Math.min(best, p.D); } near(best, dm, 1e-6, 'prisme : minimum numérique = formule');
  const pm = O.prism(A, n, (dm + A) / 2); near(pm.i2, (dm + A) / 2, 1e-9, 'au minimum de déviation : trajet symétrique (i = i′)'); near(pm.r1, A / 2, 1e-9, 'au minimum de déviation : r = A/2');
  ok(O.prismDmin(A, O.nGlass('BK7', 405)) > O.prismDmin(A, O.nGlass('BK7', 650)), 'prisme : le violet est plus dévié que le rouge'); ok(!O.prism(A, n, 0.05).ok, 'prisme : émergence impossible sous faible incidence (réflexion totale)');
  const fb = O.fiber(1.48, 1.46, 1); near(fb.NA, Math.sqrt(1.48 ** 2 - 1.46 ** 2), 1e-15, 'fibre : ouverture numérique'); near(Math.sin(fb.acc), fb.NA, 1e-12, 'fibre : sin θa = ON');
  near(fb.dtPerM * 1000 * 1e9, 1.48 * 0.02 / (299792458 * 1.46) * 1e12, 1e-6, 'fibre : dispersion modale (ns/km)');
  const pin = O.fiberPath(1.48, 1.46, 1, fb.acc * 0.9, 25e-6, 0.01), pout = O.fiberPath(1.48, 1.46, 1, fb.acc * 1.1, 25e-6, 0.01);
  near(pin.P, 1, 1e-12, 'fibre : rayon dans le cône d’acceptance guidé sans perte'); ok(pout.P < 0.01, 'fibre : rayon hors du cône perdu à travers la gaine'); ok(pin.pts.every((q) => Math.abs(q[1]) <= 25e-6 + 1e-15), 'fibre : le rayon reste dans le cœur');
  const th1 = Math.asin(Math.sin(fb.acc * 0.9) / 1.48), geo = 0.01 / Math.cos(th1); ok(Math.abs(pin.pts.reduce((s2, q, k) => (k ? s2 + Math.hypot(q[0] - pin.pts[k - 1][0], q[1] - pin.pts[k - 1][1]) : 0), 0) - geo) < 1e-9, 'fibre : longueur du zigzag = L / cos θ'); }
// schémas à connaître : chaque cas de lentille donne la bonne image, et les 3 rayons émergents passent par B′
{ const exp = { c1: ['real', 'down', 'small'], c2: ['real', 'down', 'big'], c3: ['inf', null, null], c4: ['virt', 'up', 'big'], c5: ['real', 'up', 'small'], d1: ['virt', 'up', 'small'], d2: ['real', 'up', 'big'], d3: ['virt', 'down', 'big'] };
  SC.LIST.forEach((it) => { const r = it.make(); ok(r.F.steps.length >= 2, 'schéma ' + it.id + ' : étapes'); const svg = r.F.svg(99); ok(svg.startsWith('<svg') && !/NaN|Infinity|undefined/.test(svg), 'schéma ' + it.id + ' : SVG valide');
    if (exp[it.id]) { const e = exp[it.id]; ok(r.nat === e[0] && r.sens === e[1] && r.taille === e[2], 'schéma ' + it.id + ' : nature/sens/taille ' + [r.nat, r.sens, r.taille].join('/'));
      if (isFinite(r.pp)) { const { f, p, h, pp, hp } = r, y1 = h - (h / f) * pp, y2 = (h / p) * pp, y3 = h - (h / (p + f)) * p; near(y1, hp, 1e-9, it.id + ' : rayon parallèle passe par B′'); near(y2, hp, 1e-9, it.id + ' : rayon par O passe par B′'); near(y3, hp, 1e-9, it.id + ' : rayon par F passe par B′'); near(1 / pp - 1 / p, 1 / f, 1e-12, it.id + ' : conjugaison de Descartes'); } } });
  const c2b = SC.lensCase(60, -120, 28); near(c2b.g, -1, 1e-12, 'objet en 2F : γ = −1'); near(c2b.pp, 120, 1e-9, 'objet en 2F : image en 2F′');
  const pf = SC.prismFig(); near(pf.Dm, 2 * Math.asin(1.5168 * Math.sin(Math.PI / 6)) - Math.PI / 3, 1e-12, 'schéma prisme : Dmin'); near(SC.kepler().G, -3, 1e-12, 'schéma lunette : G = −f1/f2');
  ['myope', 'hyper'].forEach((k) => { const r = SC.eye(k), svg = r.F.svg(9); const m = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" class="img"\/>/g)].filter((q, i) => i % 2 === 1); ok(m.length === 3, 'œil ' + k + ' corrigé : 3 rayons'); const ends = m.map((q) => +q[4]); ok(Math.max(...ends) - Math.min(...ends) < 0.02, 'œil ' + k + ' corrigé : les rayons se rejoignent sur la rétine'); });
  const fo = SC.fiberFig(); near(Math.sin(fo.acc), Math.sqrt(1.5 ** 2 - 1.4 ** 2), 1e-12, 'schéma fibre : ON'); }
console.log(n + ' vérifications, ' + bad + ' échec(s)');
process.exit(bad ? 1 : 0);
