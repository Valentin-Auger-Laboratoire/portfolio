// =====================================================================
//  Moteur 3D de voxels écrit à la main (aucune bibliothèque 3D)
//  - monde : grille de cubes colorés, annulation
//  - caméra en orbite : projection perspective et rayon inverse
//  - visée : parcours de grille (Amanatides & Woo 1987) + sol y = 0
//  - rendu : faces visibles seulement, triées de la plus loin à la plus proche
//  - export : OBJ + MTL (Fusion 360, Blender, trancheur d'impression 3D)
//  Utilisable dans le navigateur et dans Node (tests/test.js).
// =====================================================================

export const TAILLE = { x: 16, y: 12, z: 16 };      // emprise de la grille (en cubes)

export const PALETTE = [
  { nom: 'cyan', hex: '#38d9f5' }, { nom: 'rouge', hex: '#c8102e' }, { nom: 'blanc', hex: '#e9e9ea' },
  { nom: 'gris', hex: '#7c7c82' }, { nom: 'vert', hex: '#4fc46a' }, { nom: 'jaune', hex: '#f2c230' },
  { nom: 'orange', hex: '#f08a24' }, { nom: 'violet', hex: '#8b5cf6' },
];

// 6 faces d'un cube : normale + 4 sommets (sens trigonométrique vu de l'extérieur)
export const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const cle = (x, y, z) => x + ',' + y + ',' + z;
export const dansGrille = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < TAILLE.x && y < TAILLE.y && z < TAILLE.z;

export class Monde {
  constructor() { this.cubes = new Map(); this.historique = []; }
  get nombre() { return this.cubes.size; }
  a(x, y, z) { return this.cubes.has(cle(x, y, z)); }
  couleur(x, y, z) { return this.cubes.get(cle(x, y, z)); }
  // Les modifications d'un même geste (une ligne tracée à la pince) sont regroupées : une annulation les retire toutes
  debutGeste() { this._geste = []; }
  finGeste() { if (this._geste && this._geste.length) this.historique.push(this._geste); this._geste = null; }
  _note(op) { if (this._geste) this._geste.push(op); else this.historique.push([op]); }
  ajouter(x, y, z, c) {
    if (!dansGrille(x, y, z)) return false;
    const k = cle(x, y, z), avant = this.cubes.get(k);
    if (avant === c) return false;
    this.cubes.set(k, c); this._note({ k, avant, apres: c }); return true;
  }
  retirer(x, y, z) {
    const k = cle(x, y, z), avant = this.cubes.get(k);
    if (avant === undefined) return false;
    this.cubes.delete(k); this._note({ k, avant, apres: undefined }); return true;
  }
  annuler() {
    this.finGeste();
    const g = this.historique.pop(); if (!g) return false;
    for (let i = g.length - 1; i >= 0; i--) { const { k, avant } = g[i]; if (avant === undefined) this.cubes.delete(k); else this.cubes.set(k, avant); }
    return true;
  }
  vider() { if (!this.cubes.size) return; this.debutGeste(); for (const k of [...this.cubes.keys()]) { const [x, y, z] = k.split(',').map(Number); this.retirer(x, y, z); } this.finGeste(); }
  *liste() { for (const [k, c] of this.cubes) { const [x, y, z] = k.split(',').map(Number); yield { x, y, z, c }; } }
  versJSON() { return JSON.stringify([...this.liste()].map(({ x, y, z, c }) => [x, y, z, c])); }
  depuisJSON(txt) {
    const t = JSON.parse(txt); if (!Array.isArray(t)) throw new Error('format');
    this.cubes.clear(); this.historique = [];
    for (const e of t) if (Array.isArray(e) && e.length === 4 && dansGrille(e[0], e[1], e[2]) && Number.isInteger(e[3]) && e[3] >= 0 && e[3] < PALETTE.length) this.cubes.set(cle(e[0], e[1], e[2]), e[3]);
  }
}

// ---------- vecteurs ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vec = { sub, add, mul, dot, cross, norm };

// ---------- caméra en orbite ----------
// lacet (autour de y), tangage (au-dessus de l'horizon), distance à la cible, focale en pixels
export function camera({ lacet = 0.7, tangage = 0.55, distance = 30, cible = [TAILLE.x / 2, 2, TAILLE.z / 2], largeur = 960, hauteur = 720, focale } = {}) {
  const f0 = focale || 0.9 * Math.max(largeur, hauteur);
  const oeil = [cible[0] + distance * Math.cos(tangage) * Math.sin(lacet), cible[1] + distance * Math.sin(tangage), cible[2] + distance * Math.cos(tangage) * Math.cos(lacet)];
  const avant = norm(sub(cible, oeil));
  const droite = norm(cross(avant, [0, 1, 0]));
  const haut = cross(droite, avant);
  const cx = largeur / 2, cy = hauteur / 2;
  return {
    oeil, avant, droite, haut, focale: f0, largeur, hauteur,
    // point 3D -> [x écran, y écran, profondeur] ; profondeur <= 0 : derrière la caméra
    projeter(p) { const d = sub(p, oeil); const z = dot(d, avant); return [cx + (f0 * dot(d, droite)) / z, cy - (f0 * dot(d, haut)) / z, z]; },
    // pixel -> rayon {o, d} (inverse exact de projeter)
    rayon(sx, sy) { return { o: oeil, d: norm(add(avant, add(mul(droite, (sx - cx) / f0), mul(haut, -(sy - cy) / f0)))) }; },
  };
}

// ---------- visée : premier cube touché par le rayon, sinon le sol ----------
// Renvoie { touche: [x,y,z] | null, normale: [nx,ny,nz], pose: [x,y,z] | null, t }
export function viser(monde, { o, d }, tMax = 200) {
  // Entrée dans la boîte de la grille (méthode des dalles)
  let t0 = 0, t1 = tMax;
  const hi = [TAILLE.x, TAILLE.y, TAILLE.z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < 0 || o[a] > hi[a]) return { touche: null, pose: null }; continue; }
    let ta = (0 - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return { touche: null, pose: null };
  }
  const p = add(o, mul(d, t0 + 1e-9));
  const c = [0, 1, 2].map((a) => Math.min(Math.max(Math.floor(p[a]), 0), hi[a] - 1));
  const pas = d.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
  const tDelta = d.map((v) => (v !== 0 ? Math.abs(1 / v) : Infinity));
  const tProchain = [0, 1, 2].map((a) => (d[a] > 0 ? (c[a] + 1 - o[a]) / d[a] : d[a] < 0 ? (c[a] - o[a]) / d[a] : Infinity));
  // normale de la face d'entrée dans la boîte
  let normale = [0, 0, 0];
  { let best = -1, ax = 1; for (let a = 0; a < 3; a++) { if (d[a] === 0) continue; const ta = ((d[a] > 0 ? 0 : hi[a]) - o[a]) / d[a]; if (ta > best) { best = ta; ax = a; } } normale[ax] = -pas[ax]; }
  let t = t0;
  for (let i = 0; i < 3 * (hi[0] + hi[1] + hi[2]); i++) {
    if (monde.a(c[0], c[1], c[2])) {
      const pose = add(c, normale);
      return { touche: [...c], normale, pose: dansGrille(...pose) ? pose : null, t };
    }
    let a = tProchain[0] < tProchain[1] ? (tProchain[0] < tProchain[2] ? 0 : 2) : (tProchain[1] < tProchain[2] ? 1 : 2);
    t = tProchain[a]; c[a] += pas[a]; tProchain[a] += tDelta[a];
    normale = [0, 0, 0]; normale[a] = -pas[a];
    if (c[a] < 0 || c[a] >= hi[a]) break;
    if (t > t1 + 1e-9) break;
  }
  // Aucun cube : sol y = 0 (on pose dans la couche 0)
  if (d[1] < 0) {
    const ts = -o[1] / d[1], q = add(o, mul(d, ts));
    const x = Math.floor(q[0]), z = Math.floor(q[2]);
    if (dansGrille(x, 0, z)) return { touche: null, normale: [0, 1, 0], pose: [x, 0, z], t: ts };
  }
  return { touche: null, pose: null };
}

// ---------- faces visibles, triées pour l'algorithme du peintre ----------
export function facesVisibles(monde, cam) {
  // Tri par cube (du plus loin au plus proche) puis faces de chaque cube : pour des cubes égaux posés sur
  // une grille, c'est plus sûr que trier les faces une à une (deux faces voisines peuvent s'inverser).
  const cubes = [];
  for (const q of monde.liste()) cubes.push({ ...q, dist: Math.hypot(q.x + 0.5 - cam.oeil[0], q.y + 0.5 - cam.oeil[1], q.z + 0.5 - cam.oeil[2]) });
  cubes.sort((a, b) => b.dist - a.dist);
  const out = [];
  for (const { x, y, z, c, dist } of cubes) {
    for (const f of FACES) {
      if (monde.a(x + f.n[0], y + f.n[1], z + f.n[2])) continue;           // face cachée par un voisin
      const centre = [x + 0.5 + f.n[0] * 0.5, y + 0.5 + f.n[1] * 0.5, z + 0.5 + f.n[2] * 0.5];
      if (dot(sub(cam.oeil, centre), f.n) <= 0) continue;                  // face tournée vers l'arrière
      const pts = f.v.map((v) => cam.projeter([x + v[0], y + v[1], z + v[2]]));
      if (pts.some((p) => p[2] <= 0.05)) continue;
      out.push({ pts, n: f.n, c, dist, cube: [x, y, z] });
    }
  }
  return out;
}

// Éclairage simple (lumière directionnelle + ambiance) : facteur 0..1
const LUMIERE = norm([0.45, 0.85, 0.3]);
export const eclairage = (n) => 0.42 + 0.58 * Math.max(0, dot(n, LUMIERE));

// ---------- export OBJ + MTL (faces extérieures seulement, 1 cube = `taille` unités) ----------
export function exporterOBJ(monde, { taille = 10, nom = 'construction' } = {}) {
  const sommets = new Map(), lignesV = [], parCouleur = new Map();
  const idx = (p) => { const k = p.join(','); if (!sommets.has(k)) { sommets.set(k, sommets.size + 1); lignesV.push('v ' + p.map((u) => +(u * taille).toFixed(4)).join(' ')); } return sommets.get(k); };
  let nFaces = 0;
  for (const { x, y, z, c } of monde.liste()) {
    for (const f of FACES) {
      if (monde.a(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
      const ids = f.v.map((v) => idx([x + v[0], y + v[1], z + v[2]]));
      if (!parCouleur.has(c)) parCouleur.set(c, []);
      parCouleur.get(c).push('f ' + ids.join(' ')); nFaces++;
    }
  }
  const obj = ['# ' + nom + ' : ' + monde.nombre + ' cubes, ' + nFaces + ' faces, unité : mm (1 cube = ' + taille + ' mm)', 'mtllib ' + nom + '.mtl', 'o ' + nom, ...lignesV];
  for (const [c, fs] of parCouleur) obj.push('usemtl ' + PALETTE[c].nom, ...fs);
  const mtl = [...parCouleur.keys()].map((c) => {
    const h = PALETTE[c].hex, rgb = [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4));
    return 'newmtl ' + PALETTE[c].nom + '\nKd ' + rgb.join(' ') + '\nKa 0 0 0\nd 1\nillum 1';
  });
  return { obj: obj.join('\n') + '\n', mtl: mtl.join('\n\n') + '\n', nFaces, nSommets: sommets.size };
}

// ---------- export STL (impression 3D) : faces extérieures, 2 triangles par face, unité mm ----------
export function exporterSTL(monde, { taille = 10, nom = 'construction' } = {}) {
  const l = ['solid ' + nom]; let n = 0;
  const v = (p) => '      vertex ' + p.map((u) => +(u * taille).toFixed(4)).join(' ');
  for (const { x, y, z } of monde.liste()) for (const f of FACES) {
    if (monde.a(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
    const q = f.v.map((w) => [x + w[0], y + w[1], z + w[2]]);
    for (const tri of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
      l.push('  facet normal ' + f.n.join(' '), '    outer loop', ...tri.map(v), '    endloop', '  endfacet'); n++;
    }
  }
  l.push('endsolid ' + nom);
  return { stl: l.join('\n') + '\n', nTriangles: n };
}

// Symétrie par rapport au plan médian x = TAILLE.x / 2
export const miroirX = (x) => TAILLE.x - 1 - x;

// Point de vue « posé » : lacet / tangage bornés
export const bornerTangage = (t) => Math.min(Math.max(t, 0.08), 1.45);
export const bornerDistance = (d) => Math.min(Math.max(d, 10), 70);
