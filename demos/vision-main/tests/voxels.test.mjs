import { Monde, camera, viser, facesVisibles, exporterOBJ, exporterSTL, miroirX, TAILLE, FACES, PALETTE } from '../voxels.js';
let ok = 0, ko = 0; const check = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC', m); } };
// graine fixe
let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

// 1. ajout / retrait / annulation
const m = new Monde();
check(m.ajouter(1, 0, 1, 0) && m.nombre === 1, 'ajout');
check(!m.ajouter(1, 0, 1, 0), 'ajout identique refusé');
check(!m.ajouter(-1, 0, 0, 0) && !m.ajouter(TAILLE.x, 0, 0, 0), 'hors grille refusé');
m.ajouter(1, 0, 1, 2); check(m.couleur(1, 0, 1) === 2, 'repeindre');
m.annuler(); check(m.couleur(1, 0, 1) === 0, 'annuler repeinte');
m.debutGeste(); for (let i = 0; i < 5; i++) m.ajouter(i, 0, 5, 1); m.finGeste();
check(m.nombre === 6, 'geste 5 cubes'); m.annuler(); check(m.nombre === 1, 'annuler le geste entier');
m.retirer(1, 0, 1); check(m.nombre === 0, 'retrait'); m.annuler(); check(m.nombre === 1, 'annuler retrait');
m.vider(); check(m.nombre === 0, 'vider'); m.annuler(); check(m.nombre === 1, 'annuler vider');
const j = m.versJSON(); const m2 = new Monde(); m2.depuisJSON(j); check(m2.nombre === 1 && m2.couleur(1, 0, 1) === 0, 'JSON aller-retour');
let rej = false; try { m2.depuisJSON('{"a":1}'); } catch (e) { rej = true; } check(rej, 'JSON invalide refusé');

// 2. projection <-> rayon : inverse exact
for (let i = 0; i < 2000; i++) {
  const cam = camera({ lacet: rnd() * 6.28, tangage: 0.1 + rnd() * 1.3, distance: 12 + rnd() * 50, largeur: 640 + rnd() * 800, hauteur: 480 + rnd() * 400 });
  const p = [rnd() * 16, rnd() * 12, rnd() * 16];
  const [sx, sy, z] = cam.projeter(p); const r = cam.rayon(sx, sy);
  const q = [cam.oeil[0] + r.d[0] * 1, 0, 0];
  // distance du point p au rayon
  const v = [p[0] - r.o[0], p[1] - r.o[1], p[2] - r.o[2]]; const t = v[0] * r.d[0] + v[1] * r.d[1] + v[2] * r.d[2];
  const dist = Math.hypot(v[0] - t * r.d[0], v[1] - t * r.d[1], v[2] - t * r.d[2]);
  check(z > 0 && dist < 1e-9, 'rayon passe par le point projeté ' + dist);
}

// 3. visée contre une marche fine (force brute)
function brute(monde, { o, d }) {
  for (let t = 0; t < 200; t += 0.0005) {
    const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    const c = p.map(Math.floor);
    if (monde.a(...c)) return c;
    if (p[1] < 0) return null;
  }
  return null;
}
let nTest = 0, nAccord = 0;
for (let k = 0; k < 300; k++) {
  const w = new Monde();
  for (let i = 0; i < 40; i++) w.ajouter(Math.floor(rnd() * 16), Math.floor(rnd() * 6), Math.floor(rnd() * 16), 0);
  const cam = camera({ lacet: rnd() * 6.28, tangage: 0.15 + rnd() * 1.2, distance: 20 + rnd() * 30 });
  const r = cam.rayon(rnd() * 960, rnd() * 720);
  const a = viser(w, r).touche, b = brute(w, r);
  nTest++; const same = (a === null && b === null) || (a && b && a.join() === b.join());
  if (same) nAccord++; else console.log('désaccord', a, b);
}
check(nAccord === nTest, `visée = force brute (${nAccord}/${nTest})`);
// pose : la case de pose est voisine de la case touchée, du côté de la caméra, et libre
{
  const w = new Monde(); w.ajouter(8, 0, 8, 0);
  const cam = camera({ lacet: 0.7, tangage: 0.6, distance: 30 });
  const [sx, sy] = cam.projeter([8.5, 1.0, 8.5]);
  const v = viser(w, cam.rayon(sx, sy + 3));
  check(v.touche && v.touche.join() === '8,0,8' && v.pose.join() === '8,1,8', 'viser le dessus pose au-dessus ' + JSON.stringify(v));
  const v2 = viser(new Monde(), cam.rayon(sx, sy));
  check(v2.touche === null && v2.pose && v2.pose[1] === 0, 'sol vide : pose en couche 0');
}

// 4. faces visibles
{
  const w = new Monde(); w.ajouter(8, 0, 8, 0);
  const cam = camera({ lacet: 0.7, tangage: 0.6 });
  check(facesVisibles(w, cam).length === 3, 'un cube vu en 3/4 : 3 faces');
  const w2 = new Monde(); for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) w2.ajouter(x, y, z, 0);
  const f = facesVisibles(w2, cam);
  check(f.length === 27, 'bloc 3x3x3 en 3/4 : 3 x 9 faces, ' + f.length);
  check(f.every((a, i) => i === 0 || f[i - 1].dist >= a.dist), 'tri du plus loin au plus proche');
}

// 5. export OBJ
{
  const w = new Monde(); w.ajouter(0, 0, 0, 0); w.ajouter(1, 0, 0, 1);
  const e = exporterOBJ(w, { taille: 10 });
  check(e.nFaces === 10, '2 cubes collés : 10 faces extérieures');
  check(e.nSommets === 12, '12 sommets partagés');
  const lv = e.obj.split('\n').filter((l) => l.startsWith('v ')).length;
  const idx = e.obj.split('\n').filter((l) => l.startsWith('f ')).flatMap((l) => l.slice(2).split(' ').map(Number));
  check(lv === 12 && idx.every((i) => i >= 1 && i <= lv), 'indices de faces valides');
  check(e.obj.includes('usemtl cyan') && e.obj.includes('usemtl rouge') && e.mtl.includes('newmtl rouge'), 'matériaux par couleur');
  check(e.obj.includes('v 20 10 10'), 'coordonnées en mm');
  // orientation : normale géométrique des faces = normale de la face
  const V = e.obj.split('\n').filter((l) => l.startsWith('v ')).map((l) => l.slice(2).split(' ').map(Number));
  let bien = true;
  for (const l of e.obj.split('\n').filter((l) => l.startsWith('f '))) {
    const [a, b, c] = l.slice(2).split(' ').map((i) => V[i - 1]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const centre = [0, 1, 2].map((k) => (a[k] + c[k]) / 2);
    const cube = centre[0] > 10 ? [15, 5, 5] : [5, 5, 5];
    if (n[0] * (centre[0] - cube[0]) + n[1] * (centre[1] - cube[1]) + n[2] * (centre[2] - cube[2]) <= 0) bien = false;
  }
  check(bien, 'faces orientées vers l\'extérieur');
}
for (const f of FACES) { const [a, b, c] = f.v; const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]; check(n[0]===f.n[0] && n[1]===f.n[1] && n[2]===f.n[2], 'sens des sommets ' + f.n); }
// 6. export STL : 2 triangles par face extérieure, normales cohérentes avec l'ordre des sommets
{
  const w = new Monde(); w.ajouter(0, 0, 0, 0); w.ajouter(1, 0, 0, 1); w.ajouter(1, 1, 0, 1);
  const e = exporterSTL(w, { taille: 10 });
  check(e.nTriangles === 2 * exporterOBJ(w).nFaces, 'STL : 2 triangles par face (' + e.nTriangles + ')');
  const lignes = e.stl.split('\n'); let bien = true;
  for (let i = 0; i < lignes.length; i++) if (lignes[i].startsWith('  facet normal')) {
    const n = lignes[i].trim().split(' ').slice(2).map(Number);
    const [a, b, c] = [2, 3, 4].map((k) => lignes[i + k].trim().split(' ').slice(1).map(Number));
    const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const g = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    if (g[0]*n[0] + g[1]*n[1] + g[2]*n[2] <= 0) bien = false;
  }
  check(bien, 'STL : normales = sens des sommets');
  check(e.stl.startsWith('solid ') && e.stl.trim().endsWith('endsolid construction'), 'STL : en-tête et fin');
  // surface : 3 cubes en L -> 14 faces visibles de 100 mm² chacune
  check(e.nTriangles === 28, 'STL : 14 faces pour 3 cubes en L');
}
// 7. symétrie
check(miroirX(0) === TAILLE.x - 1 && miroirX(miroirX(5)) === 5, 'miroir involutif');
console.log(`voxels : ${ok} réussies, ${ko} échouées`);
if (ko) process.exit(1);
