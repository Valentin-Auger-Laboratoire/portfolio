// =====================================================================
//  Gestes de la main, à partir des 21 points MediaPipe
//  - pince pouce-index / pouce-majeur (distance réelle en mètres, avec hystérésis)
//  - main ouverte, poing
//  - orientation 3D de la main (repère de la paume) -> quaternion, pour faire
//    tourner une pièce comme on tourne la main
//  - taille apparente (profondeur : une main deux fois plus petite est deux fois plus loin)
//  - balayage horizontal de la main ouverte (changer de page)
// =====================================================================
import { v3, q4 } from './m3d.js';

const P = (p) => [p.x, p.y, p.z];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Doigt tendu : bout plus loin du poignet que l'articulation du milieu, et doigt presque droit
function tendu(W, mcp, pip, tip) {
  const a = v3.norm(v3.sub(P(W[pip]), P(W[mcp]))), b = v3.norm(v3.sub(P(W[tip]), P(W[pip])));
  return v3.dot(a, b) > 0.75 && dist(W[tip], W[0]) > dist(W[pip], W[0]);
}
function replie(W, pip, tip) { return dist(W[tip], W[0]) < dist(W[pip], W[0]) * 1.02; }

// Repère de la paume en coordonnées de rendu (x droite, y haut, z vers l'écran),
// image en miroir si `miroir` (caméra avant affichée comme un miroir)
export function repereMain(W, miroir) {
  const conv = (p) => [miroir ? -p.x : p.x, -p.y, -p.z];
  const w = conv(W[0]), i = conv(W[5]), m = conv(W[9]), a = conv(W[17]);
  const y = v3.norm(v3.sub(m, w));
  let x = v3.sub(i, a); x = v3.norm(v3.sub(x, v3.mul(y, v3.dot(x, y))));
  const z = v3.cross(x, y);
  return [x, y, z];   // colonnes
}
// quaternion d'un repère (colonnes x, y, z)
export function quatRepere([x, y, z]) {
  return q4.depuisMat3([[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]]);
}

// lm : points image (0..1) ; W : points 3D en mètres ; dims : {l, h} de l'affichage
// miroir : la caméra avant est affichée comme un miroir ; versVue : fonction point image -> pixel de la vue
// (recadrage de l'image dans la vue), sinon simple mise à l'échelle
export function lireMain(lm, W, { miroir = true, l = 1, h = 1, versVue = null } = {}) {
  const px = versVue || ((p) => [(miroir ? 1 - p.x : p.x) * l, p.y * h]);
  const doigts = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];
  const tendus = doigts.map(([m, p, t]) => tendu(W, m, p, t));
  const replies = doigts.map(([, p, t]) => replie(W, p, t));
  const pointeurIdx = px(lm[8]), pouce = px(lm[4]);
  return {
    pointeur: [(pointeurIdx[0] + pouce[0]) / 2, (pointeurIdx[1] + pouce[1]) / 2],   // milieu pouce-index : ne saute pas quand on pince
    index: pointeurIdx,
    centre: px(lm[9]).map((v, k) => (v + px(lm[0])[k]) / 2),
    dPince: dist(W[4], W[8]),          // mètres
    dPinceMajeur: dist(W[4], W[12]),
    ouverte: tendus.every(Boolean),
    poing: replies.every(Boolean),
    taille: Math.hypot(...[0, 1].map((k) => px(lm[9])[k] - px(lm[0])[k])) + Math.hypot(...[0, 1].map((k) => px(lm[5])[k] - px(lm[17])[k])),
    q: quatRepere(repereMain(W, miroir)),
  };
}

// Interrupteur avec hystérésis (évite les pinces qui « clignotent »)
export class Seuil {
  constructor(on, off) { this.on = on; this.off = off; this.actif = false; }
  maj(d) { this.actif = this.actif ? d < this.off : d < this.on; return this.actif; }
}
export const PINCE_ON = 0.032, PINCE_OFF = 0.05;   // mètres entre le bout du pouce et celui de l'index

// Balayage horizontal de la main ouverte : déplacement > fraction de la largeur en moins de `duree` ms
export class Balayage {
  constructor({ fraction = 0.22, duree = 450, repos = 900 } = {}) { this.fraction = fraction; this.duree = duree; this.repos = repos; this.pts = []; this.dernier = -1e9; }
  pousser(x, y, t, largeur, actif) {
    if (!actif) { this.pts = []; return null; }
    this.pts.push([x, y, t]);
    while (this.pts.length && t - this.pts[0][2] > this.duree) this.pts.shift();
    if (t - this.dernier < this.repos || this.pts.length < 3) return null;
    const a = this.pts[0], dx = x - a[0], dy = y - a[1];
    if (Math.abs(dx) > this.fraction * largeur && Math.abs(dx) > 2 * Math.abs(dy)) { this.dernier = t; this.pts = []; return dx > 0 ? 'droite' : 'gauche'; }
    return null;
  }
}

// Vitesse de rotation (rad/s, axe) entre deux orientations séparées de dt secondes
export function vitesseAngulaire(qa, qb, dt) {
  let d = q4.norm(q4.mul(qb, q4.conj(qa)));
  if (d[3] < 0) d = d.map((x) => -x);
  const ang = 2 * Math.acos(Math.min(1, d[3])), s = Math.sqrt(Math.max(1 - d[3] * d[3], 0));
  if (s < 1e-6 || dt <= 0) return { axe: [0, 1, 0], w: 0 };
  return { axe: [d[0] / s, d[1] / s, d[2] / s], w: ang / dt };
}

// Condition tenue pendant `duree` ms (ex. les deux mains ouvertes) : vrai une seule fois, puis il faut relâcher
export class Maintien {
  constructor(duree = 1000) { this.duree = duree; this.depuis = null; this.fait = false; }
  maj(cond, t) {
    if (!cond) { this.depuis = null; this.fait = false; return false; }
    if (this.depuis === null) this.depuis = t;
    if (!this.fait && t - this.depuis >= this.duree) { this.fait = true; return true; }
    return false;
  }
  progression(t) { return this.depuis === null || this.fait ? 0 : Math.min((t - this.depuis) / this.duree, 1); }
}
