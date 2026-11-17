// =====================================================================
//  Alphabet des signes (lettres statiques) à partir des 21 points de la main
//  - repère de la main : poignet, base de l'index et de l'auriculaire
//  - caractéristiques invariantes : flexions des doigts, écarts, position du pouce,
//    contacts pouce-doigts, orientation de la main dans l'image
//  - modèles des lettres calculés depuis une main de synthèse (cinématique écrite ici),
//    + exemples enregistrés par l'utilisateur (plus proches voisins)
//  - LSF et ASL : mêmes formes sauf F, G, H, T, X ; J et Z demandent un mouvement (non reconnues)
//  Utilisable dans le navigateur et dans Node (tests/test.js).
// =====================================================================

const D2R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => len(sub(a, b));

// ---------------------------------------------------------------------
//  1. Main de synthèse (centimètres). Repère local de la main droite :
//     x vers le pouce, y vers les doigts, z sort de la paume.
// ---------------------------------------------------------------------
const DOIGTS = [            // base (articulation MCP) et longueurs des phalanges
  // proportions calées sur les points MediaPipe de vraies mains (paume ≈ 10 cm, doigts ≈ 0,75 paume)
  { mcp: [2.5, 9.6, 0], l: [3.6, 2.1, 1.7], ids: [5, 6, 7, 8] },     // index
  { mcp: [0.8, 10.0, 0], l: [3.9, 2.5, 1.8], ids: [9, 10, 11, 12] },  // majeur
  { mcp: [-0.9, 9.6, 0], l: [3.6, 2.3, 1.7], ids: [13, 14, 15, 16] }, // annulaire
  { mcp: [-2.4, 8.8, 0], l: [2.8, 1.7, 1.5], ids: [17, 18, 19, 20] }, // auriculaire
];
const POUCE = { cmc: [2.0, 1.6, 0.5], l: [4.0, 3.0, 2.4] };

// direction (lacet psi depuis +y vers +x, élévation eps vers +z), degrés
const dir = (psi, eps) => [Math.sin(psi * D2R) * Math.cos(eps * D2R), Math.cos(psi * D2R) * Math.cos(eps * D2R), Math.sin(eps * D2R)];

// Doigt : [abduction (+ vers le pouce), flexion MCP, flexion PIP, flexion DIP] en degrés
function doigt(d, [abd, f1, f2, f3], echelle) {
  const pts = [d.mcp.map((v) => v * echelle)];
  const a = abd * D2R; let phi = 0;
  [f1, f2, f3].forEach((f, i) => {
    phi += f * D2R;
    const u = [Math.sin(a) * Math.cos(phi), Math.cos(a) * Math.cos(phi), Math.sin(phi)];
    pts.push(add(pts[i], mul(u, d.l[i] * echelle)));
  });
  return pts;
}

// Pouce : directions explicites {dirs:[[psi,eps]x3]} ou métacarpe + cible du bout {mc:[psi,eps], cible:[x,y,z]}
function pouce(spec, echelle) {
  const L = POUCE.l.map((v) => v * echelle), cmc = POUCE.cmc.map((v) => v * echelle);
  if (spec.dirs) {
    const pts = [cmc];
    spec.dirs.forEach(([p, e], i) => pts.push(add(pts[i], mul(dir(p, e), L[i]))));
    return pts;
  }
  const [p, e] = spec.mc || [40, 35];
  const mcp = add(cmc, mul(dir(p, e), L[0]));
  let v = sub(spec.cible, mcp); let dd = len(v);
  const a = L[1], b = L[2];
  if (dd > a + b - 1e-6) { const u = norm(v); return [cmc, mcp, add(mcp, mul(u, a)), add(mcp, mul(u, a + b))]; }
  if (dd < Math.abs(a - b) + 1e-6) dd = Math.abs(a - b) + 1e-6;
  // deux solutions pour l'articulation IP : on garde celle qui ressort vers l'extérieur et devant
  const u = norm(v), x = (a * a - b * b + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(a * a - x * x, 0));
  let w = sub(norm([1, 0, 1]), mul(u, dot(norm([1, 0, 1]), u)));
  if (len(w) < 1e-6) w = sub([0, 0, 1], mul(u, u[2]));
  w = norm(w);
  const ip = add(add(mcp, mul(u, x)), mul(w, h));
  return [cmc, mcp, ip, add(mcp, mul(u, dd))];
}

// Position d'une articulation d'un doigt déjà construit (pour les cibles du pouce)
const REP = { index: 0, majeur: 1, annulaire: 2, auriculaire: 3 };

// ---------------------------------------------------------------------
//  2. Formes des lettres
// ---------------------------------------------------------------------
const EXT = [0, 3, 22, 16], POING = [0, 62, 100, 68], COURBE = [0, 30, 45, 30], CROCHET = [0, 15, 95, 70];
const PLI = [0, 85, 5, 5], DEMI = [0, 55, 55, 35];
const ECART = (a) => [a, 3, 22, 16];   // doigt tendu (légèrement fléchi, comme une vraie main) et écarté

// cibles du pouce calculées depuis les doigts (f = points des 4 doigts)
const C = {
  cote: () => ({ dirs: [[18, 22], [6, 4], [2, -8]] }),
  ecarte: () => ({ dirs: [[62, 8], [78, 4], [84, 0]] }),
  paume: (f) => ({ mc: [30, 40], cible: [-0.3 * f.e, 5.0 * f.e, 1.6 * f.e] }),
  devant: (f) => ({ mc: [25, 45], cible: add(mul(add(f[0][1], f[1][1]), 0.5), [0, -0.6 * f.e, 1.6 * f.e]) }),
  tient: (a, b) => (f) => ({ mc: [20, 45], cible: add(mul(add(f[a][1], f[b][1]), 0.5), [0, -0.6 * f.e, 1.6 * f.e]) }),
  dessous: (f) => ({ mc: [25, 40], cible: [-0.2 * f.e, 6.0 * f.e, 1.5 * f.e] }),
  entre: (a, b, dz) => (f) => ({ mc: [25, 45], cible: add(mul(add(f[a][2], f[b][2]), 0.5), [0, 0.3 * f.e, dz * f.e]) }),
  touche: (k, o = [0, 0, 0]) => (f) => ({ mc: [38, 40], cible: add(f[k][3], o.map((v) => v * f.e)) }),
  surPhalange: (k, j, o) => (f) => ({ mc: [35, 40], cible: add(f[k][j], o.map((v) => v * f.e)) }),
  parallele: (f) => ({ mc: [22, 30], cible: add(f[0][2], [0.8 * f.e, 0.4 * f.e, 2.2 * f.e]) }),
};

// orientation : angle de l'axe de la main dans l'image (0 = doigts vers le haut, 90 = de côté, 180 = vers le bas)
const HAUT = 0, COTE = 90, BAS = 165;
const COMMUN = {
  A: { d: [POING, POING, POING, POING], p: C.cote, desc: { fr: 'poing fermé, pouce le long de l\'index', en: 'fist, thumb along the index' } },
  B: { d: [EXT, EXT, EXT, EXT], p: C.paume, desc: { fr: 'main plate, doigts serrés, pouce replié sur la paume', en: 'flat hand, fingers together, thumb across the palm' } },
  C: { d: [COURBE, COURBE, COURBE, COURBE], p: C.touche(0, [0.4, -3.4, -0.6]), desc: { fr: 'main en arc de cercle', en: 'hand curved like a C' } },
  D: { d: [EXT, [0, 60, 85, 55], [0, 60, 85, 55], [0, 60, 85, 55]], p: C.touche(1, [0.2, 0, 0.3]), desc: { fr: 'index tendu, pouce contre le majeur', en: 'index up, thumb touches the middle finger' } },
  E: { d: [[0, 25, 100, 75], [0, 25, 100, 75], [0, 25, 100, 75], [0, 25, 100, 75]], p: C.dessous, desc: { fr: 'doigts repliés sur le pouce', en: 'fingers curled down onto the thumb' } },
  I: { d: [POING, POING, POING, EXT], p: C.devant, desc: { fr: 'auriculaire tendu', en: 'little finger up' } },
  K: { d: [ECART(6), ECART(-8), POING, POING], p: C.entre(0, 1, 1.0), o: HAUT, desc: { fr: 'index et majeur en V, pouce entre les deux', en: 'index and middle in a V, thumb between them' } },
  L: { d: [EXT, POING, POING, POING], p: C.ecarte, desc: { fr: 'index tendu, pouce écarté (L)', en: 'index up, thumb out (L)' } },
  M: { d: [[0, 70, 80, 50], [0, 70, 80, 50], [0, 70, 80, 50], POING], p: C.entre(2, 3, -0.8), desc: { fr: 'pouce sous trois doigts', en: 'thumb under three fingers' } },
  N: { d: [[0, 70, 80, 50], [0, 70, 80, 50], POING, POING], p: C.entre(1, 2, -0.8), desc: { fr: 'pouce sous deux doigts', en: 'thumb under two fingers' } },
  O: { d: [DEMI, DEMI, DEMI, DEMI], p: C.touche(0, [0, 0, 0.3]), desc: { fr: 'tous les doigts touchent le pouce (O)', en: 'all fingertips touch the thumb (O)' } },
  P: { d: [ECART(6), [-8, 35, 0, 0], POING, POING], p: C.entre(0, 1, 1.0), o: BAS, desc: { fr: 'comme K, main tournée vers le bas', en: 'like K, pointing down' } },
  Q: { d: [EXT, POING, POING, POING], p: C.parallele, o: BAS, desc: { fr: 'index et pouce vers le bas', en: 'index and thumb pointing down' } },
  R: { d: [[-9, 3, 22, 16], [9, 3, 22, 16], POING, POING], p: C.tient(2, 3), desc: { fr: 'index et majeur croisés', en: 'index and middle crossed' } },
  S: { d: [POING, POING, POING, POING], p: C.devant, desc: { fr: 'poing, pouce devant les doigts', en: 'fist, thumb across the fingers' } },
  U: { d: [ECART(-2), ECART(2), POING, POING], p: C.tient(2, 3), o: HAUT, desc: { fr: 'index et majeur serrés vers le haut', en: 'index and middle up, together' } },
  V: { d: [ECART(10), ECART(-10), POING, POING], p: C.tient(2, 3), desc: { fr: 'index et majeur en V', en: 'index and middle in a V' } },
  W: { d: [ECART(10), EXT, ECART(-10), POING], p: C.touche(3, [0.4, 0, 0.6]), desc: { fr: 'trois doigts levés', en: 'three fingers up' } },
  Y: { d: [POING, POING, POING, ECART(-12)], p: C.ecarte, desc: { fr: 'pouce et auriculaire tendus', en: 'thumb and little finger out' } },
};

const SPECIFIQUE = {
  asl: {
    F: { d: [DEMI, ECART(6), EXT, ECART(-6)], p: C.touche(0, [0, 0, 0.3]), desc: { fr: 'pouce et index en rond, trois doigts levés', en: 'thumb and index circle, three fingers up' } },
    G: { d: [EXT, POING, POING, POING], p: C.parallele, o: COTE, desc: { fr: 'index et pouce parallèles, de côté', en: 'index and thumb parallel, pointing sideways' } },
    H: { d: [ECART(-2), ECART(2), POING, POING], p: C.tient(2, 3), o: COTE, desc: { fr: 'index et majeur serrés, de côté', en: 'index and middle together, sideways' } },
    T: { d: [[0, 75, 95, 60], POING, POING, POING], p: C.entre(0, 1, -0.4), desc: { fr: 'pouce glissé entre index et majeur', en: 'thumb tucked between index and middle' } },
    X: { d: [CROCHET, POING, POING, POING], p: C.devant, desc: { fr: 'index en crochet', en: 'index hooked' } },
  },
  lsf: {
    F: { d: [[0, 45, 80, 30], ECART(8), ECART(0), ECART(-12)], p: C.surPhalange(0, 1, [0.9, 0, 0.4]), desc: { fr: 'pouce contre l\'extérieur de l\'index plié, trois doigts écartés', en: 'thumb on the outside of the bent index, three fingers spread' } },
    G: { d: [EXT, POING, POING, POING], p: C.parallele, o: HAUT, desc: { fr: 'index et pouce parallèles, vers le haut', en: 'index and thumb parallel, pointing up' } },
    H: { d: [EXT, POING, POING, EXT], p: C.tient(1, 2), desc: { fr: 'index et auriculaire tendus (cornes)', en: 'index and little finger up (horns)' } },
    T: { d: [[0, 45, 80, 30], ECART(8), ECART(0), ECART(-12)], p: C.surPhalange(0, 1, [-0.4, 0, -1.0]), desc: { fr: 'comme le F, pouce à l\'intérieur de l\'index', en: 'like F, thumb inside the index' } },
    X: { d: [CROCHET, CROCHET, POING, POING], p: C.devant, desc: { fr: 'index et majeur en crochet (V plié)', en: 'index and middle hooked (bent V)' } },
  },
};

export const ALPHABETS = ['lsf', 'asl'];
export function lettres(alphabet) {
  const L = { ...COMMUN, ...SPECIFIQUE[alphabet] };
  return Object.keys(L).sort().map((k) => ({ lettre: k, ...L[k] }));
}
export const NON_RECONNUES = ['J', 'Z'];

// Construit les 21 points (repère local, cm) d'une lettre ; bruit optionnel (degrés) et échelle
export function mainLocale(forme, { bruit = 0, echelle = 1, alea = Math.random } = {}) {
  const n = () => (alea() * 2 - 1) * bruit;
  const f = DOIGTS.map((d, i) => doigt(d, forme.d[i].map((v, j) => v + (j === 0 ? n() * 0.5 : n())), echelle));
  f.e = echelle;
  const p = pouce(forme.p(f), echelle);
  const P = new Array(21);
  P[0] = [0, 0, 0];
  p.forEach((q, i) => (P[1 + i] = q));
  f.forEach((pts, i) => pts.forEach((q, j) => (P[DOIGTS[i].ids[j]] = q)));
  return P;
}

// Rotation (axe, angle) — Rodrigues
function rot(v, ax, a) { const k = norm(ax), c = Math.cos(a), s = Math.sin(a); return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))); }

// Place la main devant une caméra (image NON retournée : x à droite, y vers le bas, z s'éloigne)
// angleImage : orientation de l'axe de la main (0 haut, 90 côté, 180 bas) ; lacet/tangage/roulis en degrés
export function versImage(P, { main = 'droite', angleImage = 0, lacet = 0, tangage = 0, bruitMm = 0, alea = Math.random } = {}) {
  const s = main === 'droite' ? 1 : -1;
  const out3 = P.map((q) => {
    let v = [q[0], q[1], q[2]];
    v = rot(v, [0, 1, 0], lacet * D2R);
    v = rot(v, [1, 0, 0], tangage * D2R);
    v = rot(v, [0, 0, 1], -s * angleImage * D2R);   // tourne la main dans le plan de l'image
    return [s * v[0], -v[1], -v[2]];                  // main droite vue de face : pouce à droite de l'image
  });
  const nb = () => (alea() * 2 - 1) * bruitMm * 0.1;
  const monde = out3.map((v) => [(v[0] + nb()) / 100, (v[1] + nb()) / 100, (v[2] + nb()) / 100]); // mètres
  const image = monde.map((v) => ({ x: 0.5 + v[0] * 2.2, y: 0.55 + v[1] * 2.2, z: v[2] }));
  return { monde: monde.map(([x, y, z]) => ({ x, y, z })), image };
}

// ---------------------------------------------------------------------
//  3. Caractéristiques (invariantes en position, taille et rotation)
// ---------------------------------------------------------------------
const arr = (p) => [p.x, p.y, p.z];

function repere(W, s) {
  const y = norm(sub(W[9], W[0]));
  let x = sub(W[5], W[17]); x = norm(sub(x, mul(y, dot(x, y))));
  const z = mul(cross(x, y), s);
  return { x, y, z };
}

// W : 21 points 3D (mètres, image non retournée) ; img : points image normalisés ; s = +1 main droite, -1 gauche
export function caracteristiques(W, img, s) {
  W = W.map(arr);
  const R = repere(W, s), o = W[0];
  const L = W.map((q) => { const v = sub(q, o); return [dot(v, R.x), dot(v, R.y), dot(v, R.z)]; });
  const paume = dist(L[0], L[9]) || 1;
  const f = [];
  const flex = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));
  for (const d of DOIGTS) {
    const [m, p, q, t] = d.ids.map((i) => L[i]);
    const meta = norm([m[0], m[1], 0]);                    // direction du métacarpe dans le plan de la paume
    const prox = norm(sub(p, m));
    f.push(Math.atan2(prox[2], dot(prox, meta)) / (Math.PI / 2));    // flexion MCP (signée)
    f.push((flex(sub(p, m), sub(q, p)) + flex(sub(q, p), sub(t, q))) / Math.PI); // flexion PIP + DIP
  }
  // écarts entre doigts voisins (dans le plan de la paume), croisement index/majeur
  // (pondérés par la longueur projetée : un doigt replié n'a pas d'écart mesurable)
  const plan = (i) => { const v = norm(sub(L[i + 1], L[i])); return { a: Math.atan2(v[0], Math.abs(v[1]) + 1e-9), l: Math.max(0, v[1]) }; };
  const ecartDoigts = (i, j) => { const a = plan(i), b = plan(j), w = Math.min(a.l, b.l); return (a.a - b.a) * w * w * 1.5; };
  f.push(ecartDoigts(5, 9), ecartDoigts(9, 13), ecartDoigts(13, 17));
  f.push(((L[8][0] - L[12][0]) / paume) * 1.2);
  // pouce
  f.push(...L[4].map((v) => (v / paume) * 1.1));
  f.push(flex(sub(L[3], L[2]), sub(L[4], L[3])) / Math.PI * 1.5);
  for (const k of [8, 12, 16, 20, 6, 10]) f.push((dist(L[4], L[k]) / paume) * 1.4);
  // orientation dans l'image : angle de l'axe poignet -> majeur (0 haut, pi bas)
  const vx = img[9].x - img[0].x, vy = img[9].y - img[0].y;
  const angle = Math.acos(Math.max(-1, Math.min(1, -vy / (Math.hypot(vx, vy) || 1))));
  return { v: f, angle };
}

// ---------------------------------------------------------------------
//  4. Classifieur : modèles de synthèse + exemples de l'utilisateur
// ---------------------------------------------------------------------
const POIDS_ANGLE = 1.6;                                 // l'orientation compte surtout pour G, H, K/P, Q
function ecart(a, b, angleCompte) {
  let d = 0;
  for (let i = 0; i < a.v.length; i++) { const e = a.v[i] - b.v[i]; d += e * e; }
  if (angleCompte) { const e = (a.angle - b.angle) * POIDS_ANGLE; d += e * e; }
  else { const e = Math.max(0, Math.abs(a.angle - b.angle) - 0.7) * POIDS_ANGLE; d += e * e; }   // tolérance ±40° pour les lettres sans orientation imposée
  return d;
}

const cacheModeles = {};
export function modeles(alphabet) {
  if (cacheModeles[alphabet]) return cacheModeles[alphabet];
  const out = [];
  for (const l of lettres(alphabet)) {
    const P = mainLocale(l, { bruit: 0 });
    const angle = l.o !== undefined ? l.o : HAUT;
    const { monde, image } = versImage(P, { main: 'droite', angleImage: angle });
    const c = caracteristiques(monde, image, 1);
    out.push({ lettre: l.lettre, c, oriente: l.o !== undefined });
  }
  return (cacheModeles[alphabet] = out);
}

// exemples : [{lettre, c:{v,angle}}] enregistrés par l'utilisateur (même alphabet)
// main : 'droite' | 'gauche' | null (inconnue : on essaie les deux)
export function reconnaitre(W, img, alphabet, { main = null, exemples = [] } = {}) {
  const essais = main === 'droite' ? [1] : main === 'gauche' ? [-1] : [1, -1];
  let meilleur = null;
  for (const s of essais) {
    const c = caracteristiques(W, img, s);
    const scores = new Map();
    for (const m of modeles(alphabet)) {
      const d = ecart(c, m.c, m.oriente);
      if (!scores.has(m.lettre) || d < scores.get(m.lettre)) scores.set(m.lettre, d);
    }
    for (const e of exemples) {
      const d = ecart(c, e.c, true) * 0.8;                 // un exemple personnel compte un peu plus
      if (!scores.has(e.lettre) || d < scores.get(e.lettre)) scores.set(e.lettre, d);
    }
    const tri = [...scores.entries()].sort((a, b) => a[1] - b[1]);
    if (!meilleur || tri[0][1] < meilleur.tri[0][1]) meilleur = { tri, c, s };
  }
  const { tri } = meilleur;
  // confiance : poids exp(-d/T) normalisés
  const T = 0.1, w = tri.map(([, d]) => Math.exp(-(d - tri[0][1]) / T)), somme = w.reduce((a, b) => a + b, 0);
  const proche = tri[0][1] < 4.0;                         // au-delà, aucune lettre ne ressemble
  return {
    lettre: proche ? tri[0][0] : null,
    confiance: proche ? w[0] / somme : 0,
    distance: tri[0][1],
    classement: tri.slice(0, 4).map(([l, d], i) => ({ lettre: l, distance: d, p: w[i] / somme })),
    main: meilleur.s === 1 ? 'droite' : 'gauche',
    caract: meilleur.c,
  };
}

// Stabilisation : une lettre est « validée » quand elle reste la même pendant `duree` ms
export class Stabilisateur {
  constructor(duree = 900) { this.duree = duree; this.courante = null; this.depuis = 0; this.validee = false; }
  pousser(lettre, t) {
    if (lettre !== this.courante) { this.courante = lettre; this.depuis = t; this.validee = false; return null; }
    if (lettre && !this.validee && t - this.depuis >= this.duree) { this.validee = true; return lettre; }
    return null;
  }
  progression(t) { return this.courante && !this.validee ? Math.min((t - this.depuis) / this.duree, 1) : this.validee ? 1 : 0; }
}
