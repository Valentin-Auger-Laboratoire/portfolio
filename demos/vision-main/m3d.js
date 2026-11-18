// =====================================================================
//  Petite bibliothèque de calcul 3D écrite à la main
//  vecteurs, quaternions, matrices 4x4 (colonnes, convention WebGL),
//  perspective, rayon depuis un pixel, intersection rayon / boîte.
// =====================================================================

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

// ---------- quaternions [x, y, z, w] ----------
export const q4 = {
  id: () => [0, 0, 0, 1],
  axeAngle(ax, a) { const n = v3.norm(ax), s = Math.sin(a / 2); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(a / 2)]; },
  mul(a, b) {   // a puis... : q = a * b (applique b d'abord)
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  },
  conj: (q) => [-q[0], -q[1], -q[2], q[3]],
  norm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; },
  tourner(q, v) {   // applique la rotation q au vecteur v
    const u = [q[0], q[1], q[2]], s = q[3];
    const t = v3.mul(v3.cross(u, v), 2);
    return v3.add(v3.add(v, v3.mul(t, s)), v3.cross(u, t));
  },
  // matrice de rotation 3x3 (lignes) -> quaternion (méthode de Shepperd)
  depuisMat3(m) {
    const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2], tr = a + e + i;
    let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(h - f) / s, (c - g) / s, (d - b) / s, 0.25 * s]; }
    else if (a > e && a > i) { const s = Math.sqrt(1 + a - e - i) * 2; q = [0.25 * s, (b + d) / s, (c + g) / s, (h - f) / s]; }
    else if (e > i) { const s = Math.sqrt(1 + e - a - i) * 2; q = [(b + d) / s, 0.25 * s, (f + h) / s, (c - g) / s]; }
    else { const s = Math.sqrt(1 + i - a - e) * 2; q = [(c + g) / s, (f + h) / s, 0.25 * s, (d - b) / s]; }
    return q4.norm(q);
  },
  angle: (q) => 2 * Math.acos(Math.min(1, Math.abs(q4.norm(q)[3]))),
  // interpolation sphérique
  slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map((x) => -x); d = -d; }
    if (d > 0.9995) return q4.norm(a.map((x, i) => x + (b[i] - x) * t));
    const th = Math.acos(d), s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return a.map((x, i) => wa * x + wb * b[i]);
  },
};

// ---------- matrices 4x4 (tableau de 16, colonnes) ----------
export const m4 = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
    }
    return o;
  },
  // translation * rotation * échelle
  trs(t, q, s) {
    const [x, y, z, w] = q, sx = s, sy = s, sz = s;
    return [
      (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
      t[0], t[1], t[2], 1,
    ];
  },
  perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  },
  // vue : caméra en `oeil`, orientation q (la caméra regarde vers -z de son repère)
  vue(oeil, q) {
    const c = q4.conj(q), r = m4.trs([0, 0, 0], c, 1);
    const t = q4.tourner(c, v3.mul(oeil, -1));
    r[12] = t[0]; r[13] = t[1]; r[14] = t[2];
    return r;
  },
  point(m, p) {
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [x / w, y / w, z / w];
  },
};

// ---------- rayons ----------
// pixel (sx, sy) d'une vue largeur x hauteur, caméra perspective fovY, en `oeil` d'orientation q
export function rayonPixel(sx, sy, largeur, hauteur, fovY, oeil, q) {
  const f = Math.tan(fovY / 2), a = largeur / hauteur;
  const x = ((sx / largeur) * 2 - 1) * f * a, y = (1 - (sy / hauteur) * 2) * f;
  return { o: oeil, d: v3.norm(q4.tourner(q, [x, y, -1])) };
}
// point 3D -> pixel (inverse de rayonPixel) ; z = profondeur devant la caméra
export function projeterPixel(p, largeur, hauteur, fovY, oeil, q) {
  const l = q4.tourner(q4.conj(q), v3.sub(p, oeil)), f = Math.tan(fovY / 2), a = largeur / hauteur;
  const z = -l[2];
  return [((l[0] / (z * f * a)) + 1) / 2 * largeur, (1 - l[1] / (z * f)) / 2 * hauteur, z];
}

// intersection rayon / boîte alignée (min, max) : distance t ou null
export function rayonBoite({ o, d }, min, max) {
  let t0 = -Infinity, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < min[a] || o[a] > max[a]) return null; continue; }
    let ta = (min[a] - o[a]) / d[a], tb = (max[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  if (t1 < 0) return null;
  return t0 >= 0 ? t0 : t1;
}

// intersection rayon / triangle (Möller-Trumbore) : t ou null
export function rayonTriangle({ o, d }, a, b, c) {
  const e1 = v3.sub(b, a), e2 = v3.sub(c, a), p = v3.cross(d, e2), det = v3.dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, s = v3.sub(o, a), u = v3.dot(s, p) * inv;
  if (u < 0 || u > 1) return null;
  const qv = v3.cross(s, e1), v = v3.dot(d, qv) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = v3.dot(e2, qv) * inv;
  return t > 1e-9 ? t : null;
}
