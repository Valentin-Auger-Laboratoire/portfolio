import { lireMain, repereMain, quatRepere, Seuil, Balayage, Maintien, vitesseAngulaire, PINCE_ON, PINCE_OFF } from '../gestes.js';
import { creerAtelier } from '../atelier.js';
import { FORMES } from '../formes.js';
import { lettres, mainLocale, versImage } from '../signes.js';
import { q4, v3, projeterPixel } from '../m3d.js';
let ok = 0, ko = 0; const check = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC', m); } };
let s = 5; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const L = Object.fromEntries(lettres('asl').map((l) => [l.lettre, l]));
const main = (forme, opt = {}) => versImage(mainLocale(forme), opt);

// 1. formes de main reconnues : pince (O), main ouverte (B), poing (S)
for (const miroir of [true, false]) for (const cote of ['droite', 'gauche']) {
  const o = main(L.O, { main: cote }), b = main(L.B, { main: cote }), sp = main(L.S, { main: cote });
  const mo = lireMain(o.image, o.monde, { miroir }), mb = lireMain(b.image, b.monde, { miroir }), ms = lireMain(sp.image, sp.monde, { miroir });
  check(mo.dPince < PINCE_ON, `O = pince (${(mo.dPince * 1000).toFixed(0)} mm) ${cote}`);
  check(mb.dPince > PINCE_OFF && mb.ouverte && !mb.poing, `B = main ouverte, pas de pince ${cote}`);
  check(ms.poing && !ms.ouverte, `S = poing ${cote}`);
}
// 2. orientation : tourner la main tourne son quaternion de la même rotation (vue dans l'affichage)
const tourneImg = (pts, axe, a) => pts.map((p) => { const v = q4.tourner(q4.axeAngle(axe, a), [p.x, p.y, p.z]); return { x: v[0], y: v[1], z: v[2] }; });
let errMax = 0;
for (let k = 0; k < 300; k++) {
  const miroir = rnd() < 0.5, h = main(L.B, { main: rnd() < 0.5 ? 'droite' : 'gauche', lacet: (rnd() - .5) * 60, tangage: (rnd() - .5) * 40 });
  const axe = [rnd() - .5, rnd() - .5, rnd() - .5], a = rnd() * 2;
  const q0 = quatRepere(repereMain(h.monde, miroir)), q1 = quatRepere(repereMain(tourneImg(h.monde, axe, a), miroir));
  // rotation attendue dans l'affichage : C R C⁻¹ avec C = (±x, -y, -z)
  const C = (v) => [miroir ? -v[0] : v[0], -v[1], -v[2]];
  const axeAff = C(axe), att = miroir ? q4.axeAngle(v3.mul(axeAff, -1), a) : q4.axeAngle(axeAff, a);   // C de déterminant -1 en miroir : sens inversé
  const obtenu = q4.mul(q1, q4.conj(q0));
  errMax = Math.max(errMax, q4.angle(q4.mul(obtenu, q4.conj(att))));
}
check(errMax < 1e-6, `rotation de la main retrouvée (erreur max ${errMax.toExponential(1)} rad)`);
// 3. hystérésis
{ const t = new Seuil(PINCE_ON, PINCE_OFF); const seq = [0.06, 0.035, 0.03, 0.04, 0.049, 0.051, 0.04].map((d) => t.maj(d)); check(JSON.stringify(seq) === '[false,false,true,true,true,false,false]', 'pince avec hystérésis ' + seq); }
// 4. balayage
{
  const b = new Balayage(); let r = null;
  for (let t = 0; t <= 300; t += 30) r = r || b.pousser(100 + t * 1.2, 300 + (t % 60), t, 960, true);
  check(r === 'droite', 'balayage vers la droite');
  let r2 = null; for (let t = 400; t <= 700; t += 30) r2 = r2 || b.pousser(500 - (t - 400) * 1.2, 300, t, 960, true);
  check(r2 === null, 'pas de second balayage pendant le repos');
  let r3 = null; for (let t = 2000; t <= 2900; t += 30) r3 = r3 || b.pousser(400 + (t - 2000) * 0.1, 300, t, 960, true);
  check(r3 === null, 'main lente : pas de balayage');
  let r4 = null; const b2 = new Balayage(); for (let t = 0; t <= 300; t += 30) r4 = r4 || b2.pousser(500, 100 + t * 1.5, t, 960, true);
  check(r4 === null, 'mouvement vertical : pas de balayage');
}
// 4 bis. menu : les deux mains ouvertes tenues 1 s, une seule fois ; une main ouverte (lettre B) ne suffit pas
{
  const m = new Maintien(1000); const v = [];
  for (let t = 0; t <= 2500; t += 50) if (m.maj(t >= 200 && t < 2000, t)) v.push(t);
  check(v.length === 1 && v[0] === 1200, 'menu ouvert une fois après 1 s ' + v);
  const b1 = main(L.B, { main: 'droite' }), b2 = main(L.B, { main: 'gauche' });
  const deux = [lireMain(b1.image, b1.monde), lireMain(b2.image, b2.monde)].filter((x) => x.ouverte).length >= 2;
  const une = [lireMain(b1.image, b1.monde)].filter((x) => x.ouverte).length >= 2;
  check(deux && !une, 'deux mains ouvertes = menu, une seule (lettre B) = rien');
  const ok2 = lettres('lsf').every((l) => { const h = main(l); const r = lireMain(h.image, h.monde); return true; });
  check(ok2, 'lecture de toutes les lettres sans erreur');
}
// 5. vitesse angulaire
{ const v = vitesseAngulaire(q4.id(), q4.axeAngle([0, 0, 1], 0.3), 0.1); check(Math.abs(v.w - 3) < 1e-9 && Math.abs(v.axe[2] - 1) < 1e-9, 'vitesse angulaire 3 rad/s'); }

// 6. atelier : saisir, déplacer, profondeur, tourner, lancer, deux mains, corbeille
{
  const A = creerAtelier(), W = 960, H = 720;
  const o = A.ajouter(FORMES.cube(), { nom: 'cube', pos: [0, 0, -0.8], taille: 0.2 });
  const [cx, cy] = projeterPixel(o.pos, W, H, A.cam.fov, A.cam.oeil, A.cam.q);
  const M = (x, y, d, taille, q = q4.id()) => ({ id: 'a', pointeur: [x, y], dPince: d, taille, q });
  check(A.viser(cx, cy, W, H)?.o === o, 'viser la pièce au centre');
  check(!A.viser(5, 5, W, H), 'rien dans le coin');
  let t = 0;
  A.mettreAJour([M(cx, cy, 0.06, 200)], W, H, t += 16);
  const e = A.mettreAJour([M(cx, cy, 0.02, 200)], W, H, t += 16);
  check(e.some((x) => x.type === 'saisie'), 'pince sur la pièce = saisie');
  A.mettreAJour([M(cx + 150, cy - 60, 0.02, 200)], W, H, t += 16);
  const [nx, ny, nz] = projeterPixel(o.pos, W, H, A.cam.fov, A.cam.oeil, A.cam.q);
  check(Math.abs(nx - (cx + 150)) < 1e-6 && Math.abs(ny - (cy - 60)) < 1e-6, 'la pièce suit la main à l\'écran');
  check(Math.abs(nz - 0.8) < 1e-6, 'même profondeur si la main garde sa taille');
  A.mettreAJour([M(cx + 150, cy - 60, 0.02, 400)], W, H, t += 16);
  check(Math.abs(projeterPixel(o.pos, W, H, A.cam.fov, A.cam.oeil, A.cam.q)[2] - 0.4) < 1e-6, 'main deux fois plus grande (plus proche) : pièce deux fois plus près');
  const q0 = o.q; const R = q4.axeAngle([0, 1, 0], 0.7);
  A.mettreAJour([M(cx + 150, cy - 60, 0.02, 400, R)], W, H, t += 16);
  check(q4.angle(q4.mul(o.q, q4.conj(q4.mul(R, q0)))) < 1e-6, 'tourner la main tourne la pièce');
  // lancer : rotation rapide puis lâcher
  for (let k = 1; k <= 8; k++) A.mettreAJour([M(cx + 150, cy - 60, 0.02, 400, q4.mul(q4.axeAngle([0, 1, 0], k * 0.09), R))], W, H, t += 16);
  const e2 = A.mettreAJour([M(cx + 150, cy - 60, 0.06, 400, q4.mul(q4.axeAngle([0, 1, 0], 0.72), R))], W, H, t += 16);
  check(e2.some((x) => x.type === 'lance') && o.rot && Math.abs(o.rot.w - 0.09 / 0.016) < 0.6, 'lâcher en tournant : la pièce continue de tourner (' + (o.rot && o.rot.w.toFixed(2)) + ' rad/s)');
  const qa = o.q; A.mettreAJour([], W, H, t += 100); check(q4.angle(q4.mul(o.q, q4.conj(qa))) > 0.3, 'elle tourne seule');
  for (let k = 0; k < 200; k++) A.mettreAJour([], W, H, t += 100); check(o.rot === null, 'puis ralentit et s\'arrête');
  // deux mains : écarter = agrandir
  const B = creerAtelier(); const c = B.ajouter(FORMES.sphere(), { pos: [0, 0, -0.8], taille: 0.2 });
  const [px, py] = projeterPixel(c.pos, W, H, B.cam.fov, B.cam.oeil, B.cam.q);
  const N = (id, x, d) => ({ id, pointeur: [x, py], dPince: d, taille: 200, q: q4.id() });
  t = 0; B.mettreAJour([N('a', px - 20, 0.06), N('b', px + 20, 0.06)], W, H, t += 16);
  B.mettreAJour([N('a', px - 20, 0.02), N('b', px + 20, 0.06)], W, H, t += 16);
  B.mettreAJour([N('a', px - 20, 0.02), N('b', px + 20, 0.02)], W, H, t += 16);
  B.mettreAJour([N('a', px - 40, 0.02), N('b', px + 40, 0.02)], W, H, t += 16);
  check(Math.abs(c.echelle - 0.4) < 1e-9, 'deux mains écartées 2x : pièce 2x plus grande (' + c.echelle + ')');
  // corbeille
  const C2 = creerAtelier(); const d = C2.ajouter(FORMES.cone(), { pos: [0, 0, -0.8] });
  const [qx, qy] = projeterPixel(d.pos, W, H, C2.cam.fov, C2.cam.oeil, C2.cam.q); const zones = { corbeille: [860, 620, 960, 720] };
  t = 0; C2.mettreAJour([M(qx, qy, 0.06, 200)], W, H, t += 16, zones); C2.mettreAJour([M(qx, qy, 0.02, 200)], W, H, t += 16, zones);
  C2.mettreAJour([M(900, 680, 0.02, 200)], W, H, t += 16, zones);
  const e3 = C2.mettreAJour([M(900, 680, 0.06, 200)], W, H, t += 16, zones);
  check(e3.some((x) => x.type === 'supprime') && C2.scene.objets.length === 0, 'lâcher sur la corbeille supprime la pièce');
  // bouton de l'interface : la pince clique sans saisir
  const D = creerAtelier(); D.ajouter(FORMES.cube(), { pos: [0, 0, -0.8] });
  t = 0; D.mettreAJour([M(30, 30, 0.06, 200)], W, H, t += 16, { boutons: [{ id: 'x', r: [0, 0, 60, 60] }] });
  const e4 = D.mettreAJour([M(30, 30, 0.02, 200)], W, H, t += 16, { boutons: [{ id: 'x', r: [0, 0, 60, 60] }] });
  check(e4.length === 1 && e4[0].type === 'bouton' && e4[0].b.id === 'x', 'pince sur un bouton = clic');
}
console.log(`gestes et atelier : ${ok} réussies, ${ko} échouées`);
if (ko) process.exit(1);
