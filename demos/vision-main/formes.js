// =====================================================================
//  Formes 3D : lecture des fichiers STL (binaire et texte) et OBJ,
//  formes de base (cube, sphère, cylindre, cône, tore, pyramide).
//  Un maillage = { positions: Float32Array, normales: Float32Array } :
//  triangles à la suite (9 nombres par triangle), sommets dans le sens
//  trigonométrique vu de l'extérieur.
// =====================================================================

// ---------- outils ----------
function normaleTriangle(p, i) {
  const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
  const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
  const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const l = Math.hypot(nx, ny, nz);
  return l > 0 ? [nx / l, ny / l, nz / l] : [0, 0, 0];
}

// Normales plates (une par triangle) : pièces mécaniques, arêtes vives
export function normalesPlates(pos) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 9) { const v = normaleTriangle(pos, i); for (let k = 0; k < 3; k++) n.set(v, i + 3 * k); }
  return n;
}

export function boite(pos) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { const v = pos[i + a]; if (v < min[a]) min[a] = v; if (v > max[a]) max[a] = v; }
  return { min, max };
}

// Recentre sur le milieu de la boîte et ramène la plus grande dimension à `taille` ;
// garde les dimensions d'origine (souvent en mm pour un STL)
export function normaliser(m, taille = 1) {
  const { min, max } = boite(m.positions);
  const dims = [0, 1, 2].map((a) => max[a] - min[a]), c = [0, 1, 2].map((a) => (min[a] + max[a]) / 2);
  const k = taille / (Math.max(...dims) || 1);
  const p = new Float32Array(m.positions.length);
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) p[i + a] = (m.positions[i + a] - c[a]) * k;
  return { ...m, positions: p, dimsOrigine: dims, facteur: k, nbTriangles: p.length / 9 };
}

// Les pièces CAO sont souvent en « Z vers le haut » : on les remet en « Y vers le haut »
export function zVersY(m) {
  const p = new Float32Array(m.positions.length), n = new Float32Array(m.normales.length);
  for (let i = 0; i < p.length; i += 3) {
    p[i] = m.positions[i]; p[i + 1] = m.positions[i + 2]; p[i + 2] = -m.positions[i + 1];
    n[i] = m.normales[i]; n[i + 1] = m.normales[i + 2]; n[i + 2] = -m.normales[i + 1];
  }
  return { ...m, positions: p, normales: n };
}

// ---------- STL ----------
export function lireSTL(buffer) {
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer instanceof ArrayBuffer ? buffer : u8.buffer, u8.byteOffset, u8.byteLength);
  const binaire = u8.length >= 84 && 84 + 50 * dv.getUint32(80, true) === u8.length;
  let pos;
  if (binaire) {
    const n = dv.getUint32(80, true); pos = new Float32Array(n * 9);
    for (let t = 0; t < n; t++) { const o = 84 + t * 50 + 12; for (let k = 0; k < 9; k++) pos[t * 9 + k] = dv.getFloat32(o + 4 * k, true); }
  } else {
    const txt = new TextDecoder().decode(u8);
    if (!/^\s*solid/i.test(txt) || !/vertex/i.test(txt)) throw new Error('STL illisible');
    const nums = [];
    const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g; let m;
    while ((m = re.exec(txt))) nums.push(+m[1], +m[2], +m[3]);
    if (nums.length % 9 !== 0 || !nums.length) throw new Error('STL incomplet');
    pos = new Float32Array(nums);
  }
  if (!pos.length) throw new Error('STL vide');
  for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) throw new Error('STL : nombre invalide');
  return { positions: pos, normales: normalesPlates(pos), format: binaire ? 'STL binaire' : 'STL texte' };
}

// ---------- OBJ (sommets et faces ; polygones découpés en éventail) ----------
export function lireOBJ(texte) {
  const v = [], pos = [];
  for (const brut of texte.split(/\r?\n/)) {
    const l = brut.trim(); if (!l || l[0] === '#') continue;
    const t = l.split(/\s+/);
    if (t[0] === 'v') v.push([+t[1], +t[2], +t[3]]);
    else if (t[0] === 'f') {
      const ids = t.slice(1).map((s) => { const i = parseInt(s.split('/')[0], 10); return i < 0 ? v.length + i : i - 1; });
      if (ids.some((i) => !(i >= 0 && i < v.length))) throw new Error('OBJ : indice de sommet invalide');
      for (let k = 1; k + 1 < ids.length; k++) pos.push(...v[ids[0]], ...v[ids[k]], ...v[ids[k + 1]]);
    }
  }
  if (!pos.length) throw new Error('OBJ sans faces');
  const p = new Float32Array(pos);
  for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) throw new Error('OBJ : nombre invalide');
  return { positions: p, normales: normalesPlates(p), format: 'OBJ' };
}

export function lireFichier(nom, buffer) {
  const ext = (nom.split('.').pop() || '').toLowerCase();
  if (ext === 'stl') return lireSTL(buffer);
  if (ext === 'obj') return lireOBJ(new TextDecoder().decode(new Uint8Array(buffer)));
  throw new Error('format non pris en charge (STL ou OBJ)');
}

// ---------- formes de base (taille 1, centrées) ----------
function construire(tris) {   // tris : liste de [p1, p2, p3, n1, n2, n3]
  const p = new Float32Array(tris.length * 9), n = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => { for (let k = 0; k < 3; k++) { p.set(t[k], i * 9 + 3 * k); n.set(t[3 + k], i * 9 + 3 * k); } });
  return { positions: p, normales: n };
}
const quad = (a, b, c, d, n) => [[a, b, c, n, n, n], [a, c, d, n, n, n]];

export function cube() {
  const h = 0.5, t = [];
  const F = [
    [[1, 0, 0], [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]]],
    [[-1, 0, 0], [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]]],
    [[0, 1, 0], [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]]],
    [[0, -1, 0], [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]]],
    [[0, 0, 1], [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]]],
    [[0, 0, -1], [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]]],
  ];
  for (const [n, v] of F) t.push(...quad(...v, n));
  return construire(t);
}

export function sphere(seg = 32, anneaux = 16) {
  const r = 0.5, t = [];
  const P = (i, j) => { const th = (j / anneaux) * Math.PI, ph = (i / seg) * 2 * Math.PI; const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), -Math.sin(th) * Math.sin(ph)]; return [n.map((x) => x * r), n]; };
  for (let j = 0; j < anneaux; j++) for (let i = 0; i < seg; i++) {
    const [a, na] = P(i, j), [b, nb] = P(i, j + 1), [c, nc] = P(i + 1, j + 1), [d, nd] = P(i + 1, j);
    if (j > 0) t.push([a, b, d, na, nb, nd]);
    if (j < anneaux - 1) t.push([b, c, d, nb, nc, nd]);
  }
  return construire(t);
}

// Cylindre / cône (r1 en bas, r2 en haut), hauteur 1
export function cylindre(seg = 40, r1 = 0.5, r2 = 0.5) {
  const t = [], h = 0.5, pente = (r1 - r2);   // normale latérale : (cos, pente, -sin) normalisée
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * 2 * Math.PI, a1 = ((i + 1) / seg) * 2 * Math.PI;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const nl = (c, s) => { const l = Math.hypot(1, pente); return [c / l, pente / l, -s / l]; };
    const b0 = [r1 * c0, -h, -r1 * s0], b1 = [r1 * c1, -h, -r1 * s1], t0 = [r2 * c0, h, -r2 * s0], t1 = [r2 * c1, h, -r2 * s1];
    if (r2 > 1e-9) t.push([b0, b1, t1, nl(c0, s0), nl(c1, s1), nl(c1, s1)], [b0, t1, t0, nl(c0, s0), nl(c1, s1), nl(c0, s0)]);
    else t.push([b0, b1, [0, h, 0], nl(c0, s0), nl(c1, s1), nl((c0 + c1) / 2, (s0 + s1) / 2)]);
    if (r1 > 1e-9) t.push([[0, -h, 0], b1, b0, [0, -1, 0], [0, -1, 0], [0, -1, 0]]);
    if (r2 > 1e-9) t.push([[0, h, 0], t0, t1, [0, 1, 0], [0, 1, 0], [0, 1, 0]]);
  }
  return construire(t);
}
export const cone = (seg = 40) => cylindre(seg, 0.5, 0);

export function tore(seg = 48, cotes = 20, R = 0.35, r = 0.15) {
  const t = [];
  const P = (i, j) => {
    const u = (i / seg) * 2 * Math.PI, v = (j / cotes) * 2 * Math.PI;
    const n = [Math.cos(v) * Math.cos(u), Math.sin(v), -Math.cos(v) * Math.sin(u)];
    return [[(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), -(R + r * Math.cos(v)) * Math.sin(u)], n];
  };
  for (let i = 0; i < seg; i++) for (let j = 0; j < cotes; j++) {
    const [a, na] = P(i, j), [b, nb] = P(i + 1, j), [c, nc] = P(i + 1, j + 1), [d, nd] = P(i, j + 1);
    t.push([a, b, c, na, nb, nc], [a, c, d, na, nc, nd]);
  }
  return construire(t);
}

export function pyramide() {
  const h = 0.5, s = [0, h, 0], B = [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]], t = [];
  for (let i = 0; i < 4; i++) {
    const a = B[i], b = B[(i + 1) % 4];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [s[0] - a[0], s[1] - a[1], s[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n); n = n.map((x) => x / l);
    // sommets dans le sens trigonométrique vu de l'extérieur
    t.push([a, s, b, n.map((x) => -x), n.map((x) => -x), n.map((x) => -x)]);
  }
  t.push(...quad(B[0], B[1], B[2], B[3], [0, -1, 0]));
  return construire(t);
}

export const FORMES = { cube, sphere, cylindre: () => cylindre(), cone: () => cone(), tore: () => tore(), pyramide };

// Écrit un STL binaire (pour réexporter une pièce transformée)
export function ecrireSTL(pos, nom = 'piece') {
  const n = pos.length / 9, buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
  const ent = new TextEncoder().encode(nom.slice(0, 79)); new Uint8Array(buf).set(ent, 0);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50, nr = normaleTriangle(pos, t * 9);
    for (let k = 0; k < 3; k++) dv.setFloat32(o + 4 * k, nr[k], true);
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + 4 * k, pos[t * 9 + k], true);
  }
  return buf;
}
