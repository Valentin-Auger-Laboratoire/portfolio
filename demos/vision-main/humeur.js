// =====================================================================
//  Humeur à partir des expressions du visage
//  Entrée : les 52 coefficients d'expression (blendshapes, 0 à 1) que donne
//  le modèle MediaPipe Face Landmarker pour chaque image.
//  Règles écrites ici (inspirées des unités d'action du FACS d'Ekman) :
//    content   = sourire (+ joues relevées)
//    surpris   = bouche ouverte + sourcils levés + yeux écarquillés
//    triste    = coins de la bouche vers le bas + intérieur des sourcils levé
//    contrarié = sourcils froncés + lèvres pincées + nez plissé
//    neutre    = aucune expression marquée
//  Calibration : on retire le visage « au repos » de la personne.
//  Ce n'est pas un diagnostic : une expression n'est pas une émotion.
// =====================================================================

export const HUMEURS = ['neutre', 'content', 'surpris', 'triste', 'contrarie'];
export const LIBELLES = {
  fr: { neutre: 'Neutre', content: 'Content', surpris: 'Surpris', triste: 'Triste', contrarie: 'Contrarié' },
  en: { neutre: 'Neutral', content: 'Happy', surpris: 'Surprised', triste: 'Sad', contrarie: 'Annoyed' },
};
export const COULEURS = { neutre: '#9b9b9f', content: '#4fc46a', surpris: '#f2c230', triste: '#38a0f5', contrarie: '#c8102e' };

// Tableau [{categoryName, score}] de MediaPipe -> objet {nom: score}
export function versObjet(categories) {
  const o = {};
  for (const c of categories || []) o[c.categoryName] = c.score;
  return o;
}

const g = (b, k) => b[k] || 0;
const moy = (b, a, c) => (g(b, a) + g(b, c)) / 2;
const clamp = (x) => Math.min(Math.max(x, 0), 1);

// Indices lisibles (affichés dans la page)
export function indices(b) {
  return {
    sourire: moy(b, 'mouthSmileLeft', 'mouthSmileRight'),
    moue: moy(b, 'mouthFrownLeft', 'mouthFrownRight'),
    bouche: g(b, 'jawOpen'),
    sourcilsLeves: g(b, 'browInnerUp'),
    sourcilsFronces: moy(b, 'browDownLeft', 'browDownRight'),
    yeuxOuverts: moy(b, 'eyeWideLeft', 'eyeWideRight'),
    joues: moy(b, 'cheekSquintLeft', 'cheekSquintRight'),
    levresPincees: moy(b, 'mouthPressLeft', 'mouthPressRight'),
    nezPlisse: moy(b, 'noseSneerLeft', 'noseSneerRight'),
    clignement: moy(b, 'eyeBlinkLeft', 'eyeBlinkRight'),
  };
}

// Retire le repos (calibration) puis remet à l'échelle : 0 = comme au repos, 1 = expression maximale
export function corriger(b, repos) {
  if (!repos) return b;
  const o = {};
  for (const k of Object.keys(b)) { const r = repos[k] || 0; o[k] = clamp((b[k] - r) / Math.max(1 - r, 0.2)); }
  return o;
}

// Scores bruts de chaque humeur (0..1 environ)
export function scores(b) {
  const i = indices(b);
  const content = clamp(1.25 * i.sourire + 0.35 * i.joues - 0.3 * i.moue);
  const surpris = clamp(0.55 * i.bouche + 0.45 * i.sourcilsLeves + 0.55 * i.yeuxOuverts - 0.6 * i.sourire - 0.4 * i.sourcilsFronces);
  const triste = clamp(1.1 * i.moue + 0.45 * i.sourcilsLeves * (1 - i.bouche) - 0.7 * i.sourire);
  const contrarie = clamp(0.9 * i.sourcilsFronces + 0.45 * i.levresPincees + 0.55 * i.nezPlisse - 0.7 * i.sourire - 0.3 * i.sourcilsLeves);
  const marque = Math.max(content, surpris, triste, contrarie);
  const neutre = clamp(0.35 - 0.5 * marque + 0.2);       // reste haut tant qu'aucune expression ne dépasse ~0,35
  return { neutre, content, surpris, triste, contrarie };
}

// Humeur dominante + probabilités (softmax)
export function humeur(b) {
  const s = scores(b);
  const T = 0.12, e = HUMEURS.map((h) => Math.exp(s[h] / T)), S = e.reduce((a, c) => a + c, 0);
  const p = {}; HUMEURS.forEach((h, k) => (p[h] = e[k] / S));
  const top = HUMEURS.reduce((a, h) => (p[h] > p[a] ? h : a), 'neutre');
  return { humeur: top, p, s };
}

// Lissage dans le temps (moyenne exponentielle) + hystérésis : évite que l'étiquette clignote
export class Lisseur {
  constructor(alpha = 0.25, maintien = 350) { this.alpha = alpha; this.maintien = maintien; this.p = null; this.affichee = 'neutre'; this.candidat = null; this.depuis = 0; }
  pousser(p, t) {
    if (!this.p) this.p = { ...p };
    else for (const h of HUMEURS) this.p[h] += this.alpha * (p[h] - this.p[h]);
    const top = HUMEURS.reduce((a, h) => (this.p[h] > this.p[a] ? h : a), 'neutre');
    if (top === this.affichee) this.candidat = null;
    else if (top !== this.candidat) { this.candidat = top; this.depuis = t; }
    else if (t - this.depuis >= this.maintien) { this.affichee = top; this.candidat = null; }
    return { humeur: this.affichee, p: this.p };
  }
}

// Calibration : moyenne de plusieurs images au repos
export function moyenneRepos(liste) {
  const o = {};
  for (const b of liste) for (const k of Object.keys(b)) o[k] = (o[k] || 0) + b[k] / liste.length;
  return o;
}
