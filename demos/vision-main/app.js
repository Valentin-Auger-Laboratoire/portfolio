// =====================================================================
//  Vision IA — atelier 3D piloté par les mains
//  Pages : Atelier 3D · Langue des signes · Visage. Une seule à la fois : les gestes de l'une
//  n'agissent pas sur l'autre. Changer de page : les deux mains ouvertes 1 s ouvrent le menu.
//  Mode casque : vue stéréo côte à côte, caméra arrière, gyroscope du téléphone.
//  Modules écrits à la main : m3d (calcul), formes (STL/OBJ, formes), rendu (WebGL),
//  gestes, atelier, signes, humeur. MediaPipe Tasks Vision (Apache 2.0) dans lib/.
// =====================================================================
import { FilesetResolver, HandLandmarker, FaceLandmarker } from './lib/vision_bundle.mjs';
import { creerRendu } from './rendu.js';
import { creerAtelier, COULEURS } from './atelier.js';
import { FORMES, lireFichier, normaliser, zVersY, ecrireSTL } from './formes.js';
import { lireMain, Maintien, Seuil, PINCE_ON, PINCE_OFF } from './gestes.js';
import { q4, v3 } from './m3d.js';
import { creerModeSignes } from './modesignes.js';
import { creerModeVisage } from './modevisage.js';

const T = {
  fr: {
    back: '← Retour au portfolio', eyebrow: 'Démo interactive · vision par ordinateur · 3D', title: 'Atelier 3D piloté par les mains',
    intro: "Devant la webcam de l'ordinateur, importez une pièce (STL, OBJ) ou faites apparaître une forme, puis saisissez-la, déplacez-la et faites-la tourner avec les mains, comme un objet réel. Les deux mains ouvertes ouvrent le menu des pages : lecture de l'alphabet des signes, expressions du visage. Une seule page agit à la fois. Un mode casque pour téléphone existe aussi en option.",
    pAtelier: 'Atelier 3D', pSignes: 'Langue des signes', pVisage: 'Visage',
    start: 'Activer la caméra', startRear: 'Caméra arrière (téléphone)', mouseTry: 'Essayer sans caméra (souris ou doigt)', restart: 'Relancer la caméra',
    statusIdle: "La caméra ne s'allume qu'après ce clic. Les images restent dans votre navigateur.",
    loading: 'Chargement du modèle de la main (≈ 8 Mo)…', loadingFace: 'Chargement du modèle du visage (≈ 4 Mo)…', cam: 'Ouverture de la caméra…',
    denied: "Accès à la caméra refusé. Autorisez la caméra pour ce site, puis réessayez.", nocam: 'Aucune caméra trouvée, ou elle est déjà utilisée.', fail: "Le modèle n'a pas pu se charger. Rechargez la page.", stopped: 'Caméra arrêtée.',
    import: 'Importer STL / OBJ', fCube: 'Cube', fSphere: 'Sphère', fCyl: 'Cylindre', fCone: 'Cône', fTore: 'Tore', fPyr: 'Pyramide',
    holo: 'Hologramme', spin: 'Faire tourner', clearAll: 'Tout effacer', export: 'Exporter la scène (STL)', headset: 'Mode casque (téléphone)', stop: 'Arrêter la caméra', quitHeadset: 'Quitter le mode casque',
    controls: 'Commandes',
    g1: 'Pincer pouce + index sur une pièce', g1d: 'La saisir : elle suit la main, recule ou avance avec elle et tourne comme elle.',
    g2: 'Lâcher en tournant la main vite', g2d: 'La pièce continue de tourner sur elle-même, puis ralentit.',
    g3: 'Deux mains qui pincent la même pièce', g3d: 'Écarter pour agrandir, rapprocher pour réduire, tourner les mains pour la faire pivoter.',
    g4: 'Lâcher sur la corbeille', g4d: "Supprime la pièce (en bas à droite de l'image).",
    g5: 'Pincer sur une forme de la colonne', g5d: "Fait apparaître la forme (cube, sphère…), sans toucher l'écran.",
    g6: 'Les deux mains ouvertes pendant 1 s', g6d: "Ouvre le menu des pages ; pincer la page voulue. Une seule page agit à la fois : en langue des signes, les gestes ne déplacent pas les pièces, et dans l'atelier aucune lettre n'est lue.",
    g7: 'À la souris', g7d: "Glisser une pièce : la déplacer · clic droit ou Maj + glisser : la tourner · molette : taille · fichier glissé sur l'image : importé.",
    hsTitle: 'Mode casque (option)', ipd: 'Écart des yeux',
    lim1: "Moteur 3D WebGL écrit à la main (projection, éclairage, profondeur, vue stéréo) et lecture STL / OBJ maison. La profondeur d'une pièce suit la taille apparente de la main. En mode casque, le gyroscope du téléphone garde les pièces à leur place quand on tourne la tête.",
    s1: 'Montrer une lettre à la caméra', s1d: "Pour une personne qui ne parle pas : la webcam lit vos signes, la lettre tenue 0,9 s s'ajoute au message, qui peut être lu à voix haute. Sur cette page, les gestes ne touchent pas aux pièces de l'atelier.",
    learnTitle: 'Apprendre mes signes', learnBtn: 'Enregistrer 25 images', forget: 'Oublier mes exemples', alphaTitle: 'Lettres reconnues',
    lim4: "J et Z se font avec un mouvement : elles ne sont pas reconnues. Les lettres proches (A, S, E, M, N, T) peuvent se confondre : enregistrer ses propres exemples corrige la plupart des erreurs.",
    msgTitle: 'Message', space: 'Espace', backspace: 'Effacer une lettre', clearMsg: 'Tout effacer', speak: 'Lire à voix haute',
    letterSeen: 'LETTRE', confidence: 'confiance', recording: 'Enregistrement', myExamples: 'Mes exemples', none: 'aucun', needCam: 'Activez la caméra pour enregistrer vos exemples.',
    v1: 'Expression du visage filmé', v1d: "La webcam filme votre visage et affiche son expression. (En option, avec la caméra arrière d'un téléphone, ce serait le visage de la personne en face.)",
    moodTitle: 'Humeur', cuesTitle: 'Indices du visage', calib: 'Calibrer le visage au repos (2 s)', uncalib: 'Oublier la calibration',
    calibrating: 'Gardez un visage neutre…', noFace: 'Aucun visage détecté', moodLabel: 'HUMEUR',
    cue_sourire: 'Sourire', cue_moue: 'Coins de bouche bas', cue_bouche: 'Bouche ouverte', cue_sourcilsLeves: 'Sourcils levés', cue_sourcilsFronces: 'Sourcils froncés', cue_yeuxOuverts: 'Yeux écarquillés',
    lim5: "Reconnaissance d'expressions, pas d'identification : le modèle ne sait pas qui est filmé. L'humeur est déduite par des règles sur 52 coefficients d'expression. Une expression n'est pas une émotion : c'est une démonstration, pas un diagnostic.",
    privacy: 'Les images de la caméra et les fichiers importés restent dans votre navigateur. Rien n\'est enregistré ni envoyé.',
    trash: 'Corbeille', showHands: 'Montrez vos mains à la caméra', held: 'tenue', imported: 'Importées :', importErr: 'Fichier non lu :', tooBig: 'fichier trop gros (> 80 Mo)',
    triangles: 'triangles', swipeHint: 'les deux mains ouvertes 1 s : changer de page', menuTitle: 'Choisir la page', menuHint: 'Pincer la page voulue · les deux mains ouvertes 1 s pour fermer', mousePage: 'Souris : glisser = déplacer · clic droit = tourner · molette = taille',
  },
  en: {
    back: '← Back to portfolio', eyebrow: 'Interactive demo · computer vision · 3D', title: 'A 3D workshop driven by your hands',
    intro: 'In front of the computer webcam, import a part (STL, OBJ) or spawn a shape, then grab it, move it and turn it with your hands, like a real object. Both hands open bring up the page menu: sign alphabet reading, facial expressions. Only one page acts at a time. An optional phone-headset mode also exists.',
    pAtelier: '3D workshop', pSignes: 'Sign language', pVisage: 'Face',
    start: 'Turn on the camera', startRear: 'Rear camera (phone)', mouseTry: 'Try it without a camera (mouse or finger)', restart: 'Restart the camera',
    statusIdle: 'The camera only turns on after this click. Images stay in your browser.',
    loading: 'Loading the hand model (≈ 8 MB)…', loadingFace: 'Loading the face model (≈ 4 MB)…', cam: 'Opening the camera…',
    denied: 'Camera access denied. Allow the camera for this site, then try again.', nocam: 'No camera found, or it is already in use.', fail: 'The model could not load. Reload the page.', stopped: 'Camera stopped.',
    import: 'Import STL / OBJ', fCube: 'Cube', fSphere: 'Sphere', fCyl: 'Cylinder', fCone: 'Cone', fTore: 'Torus', fPyr: 'Pyramid',
    holo: 'Hologram', spin: 'Spin', clearAll: 'Clear all', export: 'Export the scene (STL)', headset: 'Headset mode (phone)', stop: 'Stop the camera', quitHeadset: 'Leave headset mode',
    controls: 'Controls',
    g1: 'Pinch thumb + index on a part', g1d: 'Grab it: it follows the hand, moves closer or further with it and turns like it.',
    g2: 'Release while turning the hand fast', g2d: 'The part keeps spinning on itself, then slows down.',
    g3: 'Both hands pinching the same part', g3d: 'Spread to enlarge, bring together to shrink, turn the hands to rotate it.',
    g4: 'Release over the bin', g4d: 'Deletes the part (bottom right of the image).',
    g5: 'Pinch on a shape in the column', g5d: 'Spawns the shape (cube, sphere…) without touching the screen.',
    g6: 'Both hands open for 1 s', g6d: 'Opens the page menu; pinch the page you want. Only one page acts at a time: in sign language, gestures do not move parts, and in the workshop no letter is read.',
    g7: 'With the mouse', g7d: 'Drag a part: move it · right click or Shift + drag: turn it · wheel: size · file dropped on the image: imported.',
    hsTitle: 'Headset mode (option)', ipd: 'Eye separation',
    lim1: "Hand-written WebGL 3D engine (projection, lighting, depth, stereo view) and home-made STL / OBJ reader. A part's depth follows the apparent size of the hand. In headset mode, the phone's gyroscope keeps the parts in place when you turn your head.",
    s1: 'Show a letter to the camera', s1d: 'For someone who cannot speak: the webcam reads your signs, a letter held for 0.9 s is added to the message, which can be read aloud. On this page, gestures do not touch the workshop parts.',
    learnTitle: 'Teach my signs', learnBtn: 'Record 25 frames', forget: 'Forget my examples', alphaTitle: 'Recognised letters',
    lim4: 'J and Z need a movement: they are not recognised. Close letters (A, S, E, M, N, T) can be confused: recording your own examples fixes most errors.',
    msgTitle: 'Message', space: 'Space', backspace: 'Delete a letter', clearMsg: 'Clear all', speak: 'Read aloud',
    letterSeen: 'LETTER', confidence: 'confidence', recording: 'Recording', myExamples: 'My examples', none: 'none', needCam: 'Turn on the camera to record your examples.',
    v1: 'Expression of the filmed face', v1d: "The webcam films your face and shows its expression. (Optionally, with a phone's rear camera, it would be the face of the person in front of you.)",
    moodTitle: 'Mood', cuesTitle: 'Face cues', calib: 'Calibrate the resting face (2 s)', uncalib: 'Forget the calibration',
    calibrating: 'Keep a neutral face…', noFace: 'No face detected', moodLabel: 'MOOD',
    cue_sourire: 'Smile', cue_moue: 'Mouth corners down', cue_bouche: 'Mouth open', cue_sourcilsLeves: 'Brows raised', cue_sourcilsFronces: 'Brows lowered', cue_yeuxOuverts: 'Eyes wide',
    lim5: 'Expression recognition, not identification: the model does not know who is filmed. The mood is inferred by rules on 52 expression coefficients. An expression is not an emotion: this is a demo, not a diagnosis.',
    privacy: 'Camera images and imported files stay in your browser. Nothing is recorded or sent.',
    trash: 'Bin', showHands: 'Show your hands to the camera', held: 'held', imported: 'Imported:', importErr: 'File not read:', tooBig: 'file too large (> 80 MB)',
    triangles: 'triangles', swipeHint: 'both hands open for 1 s: change page', menuTitle: 'Choose the page', menuHint: 'Pinch the page you want · both hands open for 1 s to close', mousePage: 'Mouse: drag = move · right click = turn · wheel = size',
  },
};
const NOMS_FORMES = { cube: 'fCube', sphere: 'fSphere', cylindre: 'fCyl', cone: 'fCone', tore: 'fTore', pyramide: 'fPyr' };
const PAGES = ['atelier', 'signes', 'visage'];
const CONNEXIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

const $ = (id) => document.getElementById(id);
const stage = $('stage'), video = $('video'), cv3d = $('vue3d'), cvHud = $('hud'), ctxHud = cvHud.getContext('2d');
const oeil = document.createElement('canvas'), ctx = oeil.getContext('2d');   // interface dessinée pour un œil, recopiée 1 ou 2 fois
let lang = 'en';
try { lang = localStorage.getItem('langChoix') === 'fr' ? 'fr' : 'en'; } catch (e) {}
const t = (k) => T[lang][k] ?? k;

let page = 'atelier', running = false, sourisSeule = false, miroir = true, stream = null;
let stereo = 0, ipd = 0.064, files = null, mainsLm = null, visageLm = null, chargeVisage = null;
let imagesVisage = 0, derniereImage = -1, resMains = null, resVisage = null, fps = 0, tPrec = 0, majBarresT = 0, holoParDefaut = false;
let rendu = null;
try { rendu = creerRendu(cv3d); } catch (e) { $('status').textContent = 'WebGL indisponible : ' + e.message; }
const atelier = creerAtelier();
const ouvrirMenu = new Maintien(1000);
let menu = null;                  // { depuis } quand le menu des pages est ouvert
const pincePrec = {};
const bibliotheque = [];          // pièces importées (pour les remettre dans la scène)
let message = '', vue = { l: 960, h: 720, rec: [0, 0, 1, 1] };

// ---------- correspondance image caméra -> pixels de la vue (recadrage + miroir) ----------
function px(p) { const [rx, ry, rw, rh] = vue.rec; return [(((miroir ? 1 - p.x : p.x) - rx) / rw) * vue.l, ((p.y - ry) / rh) * vue.h]; }
const app = { canvas: oeil, t, lang: () => lang, px, majSignes: () => majSignes() };
const m4s = creerModeSignes(app), m5 = creerModeVisage(app);

// ---------- scène de départ ----------
function ajouterForme(nom, pos) {
  const k = Object.keys(FORMES).indexOf(nom);
  return atelier.ajouter(FORMES[nom](), { nom: t(NOMS_FORMES[nom]), couleur: COULEURS[(k + 1) % COULEURS.length], holo: holoParDefaut, taille: 0.13, pos });
}
ajouterForme('cube', [-0.17, -0.02, -0.9]); ajouterForme('tore', [0.02, 0.03, -0.95]); ajouterForme('sphere', [0.2, -0.02, -0.9]);

// ---------- langue / pages ----------
function setLang(l) {
  lang = l; document.documentElement.lang = l;
  document.querySelectorAll('[data-t]').forEach((el) => { const v = T[l][el.dataset.t]; if (v != null) el.textContent = v; });
  if (!running && $('start').dataset.state === 'restart') $('start').textContent = t('restart');
  document.title = l === 'fr' ? 'Vision IA — atelier 3D gestuel' : 'Vision AI — gesture 3D workshop';
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === l));
  try { localStorage.setItem('lang', l); localStorage.setItem('langChoix', l); } catch (e) {}
  majSignes(); construireBarres(); majBiblio();
}
function setPage(p) {
  page = p;
  document.querySelectorAll('.page').forEach((b) => b.setAttribute('aria-pressed', b.dataset.page === p));
  document.querySelectorAll('[data-montre]').forEach((el) => (el.hidden = el.dataset.montre !== p));
  if (p === 'visage' && running) chargerVisage().catch((e) => console.error(e));
  if (sourisSeule && p !== 'atelier') { sourisSeule = false; montrerAccueil(); }
}
function montrerAccueil() { $('overlay').hidden = false; }
function status(txt, err) { const s = $('status'); s.textContent = txt; s.classList.toggle('msg', !!err); }

// ---------- modèles ----------
async function fichiers() { if (!files) files = await FilesetResolver.forVisionTasks(new URL('./lib/wasm', import.meta.url).href); return files; }
async function chargerMains() {
  if (mainsLm) return;
  status(t('loading'));
  const f = await fichiers();
  const o = (delegate) => ({ baseOptions: { modelAssetPath: new URL('./lib/hand_landmarker.task', import.meta.url).href, delegate }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { mainsLm = await HandLandmarker.createFromOptions(f, o('GPU')); } catch (e) { mainsLm = await HandLandmarker.createFromOptions(f, o('CPU')); }
}
function chargerVisage() {
  if (visageLm) return Promise.resolve();
  if (chargeVisage) return chargeVisage;
  chargeVisage = (async () => {
    const f = await fichiers();
    const o = (delegate) => ({ baseOptions: { modelAssetPath: new URL('./lib/face_landmarker.task', import.meta.url).href, delegate }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
    try { visageLm = await FaceLandmarker.createFromOptions(f, o('GPU')); } catch (e) { visageLm = await FaceLandmarker.createFromOptions(f, o('CPU')); }
  })();
  return chargeVisage;
}

// ---------- caméra ----------
async function demarrer(arriere) {
  const boutons = [$('start'), $('startArriere')]; boutons.forEach((b) => (b.disabled = true));
  try {
    if (page === 'visage') await chargerVisage(); else await chargerMains();
    status(t('cam'));
    if (stream) stream.getTracks().forEach((x) => x.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: arriere ? { ideal: 'environment' } : 'user' }, audio: false });
    video.srcObject = stream; await video.play();
    miroir = !arriere;
    stage.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
    $('overlay').hidden = true; running = true; sourisSeule = false; derniereImage = -1;
    $('stop').hidden = false;
    if (page === 'visage') chargerMains().catch(() => {}); else chargerVisage().catch(() => {});
    lancerBoucle();
  } catch (e) {
    const n = e && e.name;
    status(n === 'NotAllowedError' || n === 'SecurityError' ? t('denied') : n === 'NotFoundError' || n === 'NotReadableError' || n === 'OverconstrainedError' ? t('nocam') : (mainsLm || visageLm ? t('nocam') : t('fail')), true);
    console.error(e);
  } finally { boutons.forEach((b) => (b.disabled = false)); }
}
function arreter() {
  running = false; if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null; video.srcObject = null;
  const b = $('start'); b.dataset.state = 'restart'; b.textContent = t('restart'); status(t('stopped'));
  $('stop').hidden = true; montrerAccueil(); quitterCasque();
}
function essaiSouris() { sourisSeule = true; miroir = true; stage.style.aspectRatio = '4 / 3'; $('overlay').hidden = true; setPage('atelier'); lancerBoucle(); }

// ---------- mode casque ----------
let qDepart = null, qTel = null;
function quatTelephone(e) {   // angles du gyroscope (W3C) -> quaternion de la caméra
  const D = Math.PI / 180, x = (e.beta || 0) * D, y = (e.alpha || 0) * D, z = -(e.gamma || 0) * D;
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  let q = [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3];   // ordre YXZ
  q = q4.mul(q, [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);                     // caméra regarde par l'arrière de l'appareil
  const orient = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * D;
  return q4.mul(q, q4.axeAngle([0, 0, 1], -orient));
}
function surOrientation(e) { if (e.alpha == null) return; qTel = quatTelephone(e); if (!qDepart) qDepart = qTel; }
async function entrerCasque() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission().catch(() => {});
    window.addEventListener('deviceorientation', surOrientation);
    qDepart = null; qTel = null;
    if (stage.requestFullscreen) await stage.requestFullscreen().catch(() => {});
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
  } catch (e) {}
  stereo = ipd || 0.0001; $('quitterCasque').hidden = false;
  if (!running) demarrer(true);
}
function quitterCasque() {
  stereo = 0; $('quitterCasque').hidden = true; window.removeEventListener('deviceorientation', surOrientation); atelier.cam.q = q4.id();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && stereo) quitterCasque(); });

// ---------- souris : une « main » virtuelle ----------
const souris = { dedans: false, x: 0, y: 0, gauche: false, droit: false, q: q4.id(), prec: null, min: 0 };
function posSouris(e) { const r = cvHud.getBoundingClientRect(); let x = ((e.clientX - r.left) / r.width) * cvHud.width; if (stereo) x %= vue.l; return [x, ((e.clientY - r.top) / r.height) * cvHud.height]; }
cvHud.addEventListener('contextmenu', (e) => e.preventDefault());
cvHud.addEventListener('pointerdown', (e) => { if (page !== 'atelier') return; [souris.x, souris.y] = posSouris(e); souris.dedans = true; if (e.button === 2 || e.shiftKey) souris.droit = true; else souris.gauche = true; souris.min = 3; souris.prec = [souris.x, souris.y]; cvHud.setPointerCapture(e.pointerId); });
cvHud.addEventListener('pointermove', (e) => {
  [souris.x, souris.y] = posSouris(e); souris.dedans = true;
  if (souris.droit && souris.prec) { const dx = souris.x - souris.prec[0], dy = souris.y - souris.prec[1]; souris.q = q4.norm(q4.mul(q4.mul(q4.axeAngle([0, 1, 0], dx * 0.012), q4.axeAngle([1, 0, 0], dy * 0.012)), souris.q)); }
  souris.prec = [souris.x, souris.y];
});
cvHud.addEventListener('pointerup', () => { souris.gauche = souris.droit = false; souris.prec = null; });
cvHud.addEventListener('pointerleave', () => { souris.dedans = souris.gauche || souris.droit; });
cvHud.addEventListener('wheel', (e) => { if (page !== 'atelier') return; e.preventDefault(); const v = atelier.viser(souris.x, souris.y, vue.l, vue.h); if (v) v.o.echelle = Math.min(Math.max(v.o.echelle * (e.deltaY > 0 ? 0.92 : 1.08), 0.03), 1.5); }, { passive: false });

// ---------- import / export ----------
async function importer(liste) {
  for (const f of liste) {
    try {
      if (f.size > 80e6) throw new Error(t('tooBig'));
      let m = lireFichier(f.name, await f.arrayBuffer());
      if (m.format.startsWith('STL')) m = zVersY(m);          // CAO : Z vers le haut
      m = normaliser(m, 1);
      const entree = { nom: f.name.replace(/\.(stl|obj)$/i, ''), m };
      bibliotheque.push(entree); placer(entree);
    } catch (e) { $('biblio').textContent = t('importErr') + ' ' + f.name + ' (' + e.message + ')'; return; }
  }
  majBiblio();
}
function placer(entree) { atelier.ajouter(entree.m, { nom: entree.nom, couleur: [0.82, 0.82, 0.86], holo: holoParDefaut, taille: 0.24, pos: [0, 0, -0.8] }); }
function majBiblio() {
  const b = $('biblio'); b.textContent = '';
  if (!bibliotheque.length) return;
  b.append(t('imported') + ' ');
  bibliotheque.forEach((e) => {
    const k = document.createElement('button'); k.type = 'button'; k.className = 'small';
    const d = e.m.dimsOrigine.map((x) => x.toFixed(x < 10 ? 1 : 0)).join(' × ');
    k.textContent = `${e.nom} · ${d} · ${e.m.nbTriangles.toLocaleString(lang)} ${t('triangles')}`; k.addEventListener('click', () => placer(e)); b.append(k);
  });
}
function exporter() {
  const parts = [];
  for (const o of atelier.scene.objets) {
    const p = o.maillage.positions, out = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const w = v3.add(o.pos, q4.tourner(o.q, [p[i] * o.echelle, p[i + 1] * o.echelle, p[i + 2] * o.echelle])); out[i] = w[0] * 1000; out[i + 1] = -w[2] * 1000; out[i + 2] = w[1] * 1000; }   // mm, Z vers le haut
    parts.push(out);
  }
  if (!parts.length) return;
  const tout = new Float32Array(parts.reduce((a, x) => a + x.length, 0)); let k = 0; for (const x of parts) { tout.set(x, k); k += x.length; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ecrireSTL(tout, 'scene')], { type: 'model/stl' })); a.download = 'scene.stl'; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------- interface dessinée dans l'image (utilisable à la main) ----------
const echelleHud = () => Math.min(vue.h / 720, vue.l / 760);
function boutonsHud() {
  const u = echelleHud(), bw = Math.round(150 * u), bh = Math.round(42 * u), g = Math.round(8 * u), x = Math.round(14 * u);
  const ids = ['cube', 'sphere', 'cylindre', 'cone', 'tore', 'pyramide', 'holo', 'toupie'];
  return ids.map((id, i) => ({ id, r: [x, Math.round(64 * u) + i * (bh + g), x + bw, Math.round(64 * u) + i * (bh + g) + bh] }));
}
const dansR = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
function boutonsMenu() {
  const u = echelleHud(), bw = Math.round(240 * u), bh = Math.round(120 * u), g = Math.round(24 * u), x0 = vue.l / 2 - (3 * bw + 2 * g) / 2, y0 = vue.h / 2 - bh / 2;
  return PAGES.map((id, i) => ({ id, r: [x0 + i * (bw + g), y0, x0 + i * (bw + g) + bw, y0 + bh] }));
}
function corbeille() { const u = echelleHud(), s = Math.round(96 * u); return [vue.l - s - 14 * u, vue.h - s - 14 * u, vue.l - 14 * u, vue.h - 14 * u]; }

function dessinerHud(lues, now) {
  const L = vue.l, H = vue.h, u = echelleHud();
  ctx.clearRect(0, 0, L, H);
  // pages (points) en haut
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${Math.round(17 * u)}px Inter, sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(L / 2 - 170 * u, 10 * u, 340 * u, 38 * u);
  PAGES.forEach((p, i) => { ctx.fillStyle = p === page ? '#fff' : 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(L / 2 - 20 * u + i * 20 * u, 40 * u, 4 * u, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#fff'; ctx.fillText(t({ atelier: 'pAtelier', signes: 'pSignes', visage: 'pVisage' }[page]), L / 2, 24 * u);
  if (page === 'atelier') {
    for (const b of boutonsHud()) {
      const actif = (b.id === 'holo' && holoParDefaut) || (b.id === 'toupie' && atelier.scene.objets.some((o) => o.toupie));
      const survol = lues.some((m) => m.pointeur[0] >= b.r[0] && m.pointeur[0] <= b.r[2] && m.pointeur[1] >= b.r[1] && m.pointeur[1] <= b.r[3]);
      ctx.fillStyle = actif ? 'rgba(200,16,46,.85)' : survol ? 'rgba(255,255,255,.25)' : 'rgba(10,10,12,.62)';
      ctx.fillRect(b.r[0], b.r[1], b.r[2] - b.r[0], b.r[3] - b.r[1]);
      ctx.strokeStyle = survol ? '#fff' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(b.r[0], b.r[1], b.r[2] - b.r[0], b.r[3] - b.r[1]);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `600 ${Math.round(15 * u)}px Inter, sans-serif`;
      const lab = b.id === 'holo' ? t('holo') : b.id === 'toupie' ? t('spin') : '+ ' + t(NOMS_FORMES[b.id]);
      ctx.fillText(lab, b.r[0] + 12 * u, (b.r[1] + b.r[3]) / 2);
    }
    // corbeille
    const c = corbeille(), tenueDessus = lues.some((m) => m.tient && m.pointeur[0] >= c[0] && m.pointeur[1] >= c[1]);
    ctx.fillStyle = tenueDessus ? 'rgba(200,16,46,.85)' : 'rgba(10,10,12,.6)'; ctx.fillRect(c[0], c[1], c[2] - c[0], c[3] - c[1]);
    ctx.strokeStyle = tenueDessus ? '#fff' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 2 * u; ctx.strokeRect(c[0], c[1], c[2] - c[0], c[3] - c[1]);
    const cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2 - 8 * u;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * u; ctx.beginPath();
    ctx.moveTo(cx - 16 * u, cy - 14 * u); ctx.lineTo(cx + 16 * u, cy - 14 * u); ctx.moveTo(cx - 6 * u, cy - 19 * u); ctx.lineTo(cx + 6 * u, cy - 19 * u);
    ctx.moveTo(cx - 12 * u, cy - 10 * u); ctx.lineTo(cx - 9 * u, cy + 16 * u); ctx.lineTo(cx + 9 * u, cy + 16 * u); ctx.lineTo(cx + 12 * u, cy - 10 * u); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(13 * u)}px Inter, sans-serif`; ctx.fillText(t('trash'), cx, c[3] - 12 * u);
    // pièce tenue : nom et dimensions
    const tenus = atelier.scene.objets.filter((o) => o.cadre && o.cadre[3] > 0.5);
    if (tenus.length) {
      const o = tenus[0], d = o.maillage.dimsOrigine;
      const txt = o.nom + (d ? ` · ${d.map((x) => x.toFixed(x < 10 ? 1 : 0)).join(' × ')}` : '') + ` · ${Math.round(o.echelle * 100)} %`;
      ctx.font = `600 ${Math.round(15 * u)}px JetBrains Mono, monospace`; const w = ctx.measureText(txt).width + 20 * u;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(L / 2 - w / 2, H - 46 * u, w, 30 * u); ctx.fillStyle = '#fff'; ctx.fillText(txt, L / 2, H - 31 * u);
    }
  }
  // mains : squelette + pointeur
  if (resMains && resMains.landmarks && (page !== 'visage' || menu)) resMains.landmarks.forEach((lm) => {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2 * u;
    CONNEXIONS.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...px(lm[a])); ctx.lineTo(...px(lm[b])); ctx.stroke(); });
    ctx.fillStyle = 'rgba(56,217,245,.9)'; lm.forEach((p) => { const [x, y] = px(p); ctx.beginPath(); ctx.arc(x, y, 3 * u, 0, 7); ctx.fill(); });
  });
  if (page === 'atelier' || menu) for (const m of lues) {
    ctx.strokeStyle = m.tient ? '#c8102e' : '#fff'; ctx.lineWidth = 2.5 * u;
    ctx.beginPath(); ctx.arc(m.pointeur[0], m.pointeur[1], (m.pince ? 7 : 12) * u, 0, 7); ctx.stroke();
    if (m.pince) { ctx.fillStyle = m.tient ? '#c8102e' : '#fff'; ctx.fill(); }
  }
  if (page === 'signes' && !menu) m4s.dessiner(ctx, now);
  if (page === 'visage' && !menu) m5.dessiner(ctx, now);
  // progression « deux mains ouvertes » puis menu des pages
  const prog = ouvrirMenu.progression(now);
  if (prog > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.arc(L / 2, H / 2, 46 * u, -Math.PI / 2, -Math.PI / 2 + prog * 2 * Math.PI); ctx.stroke(); }
  if (menu) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, L, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(18 * u)}px Inter, sans-serif`; ctx.fillText(t('menuTitle'), L / 2, H / 2 - 100 * u);
    for (const b of boutonsMenu()) {
      const survol = lues.some((m) => dansR(m.pointeur, b.r)), ici = b.id === page;
      ctx.fillStyle = survol ? 'rgba(200,16,46,.9)' : ici ? 'rgba(255,255,255,.22)' : 'rgba(20,20,22,.9)'; ctx.fillRect(b.r[0], b.r[1], b.r[2] - b.r[0], b.r[3] - b.r[1]);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * u; ctx.strokeRect(b.r[0], b.r[1], b.r[2] - b.r[0], b.r[3] - b.r[1]);
      ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(20 * u)}px Inter, sans-serif`; ctx.fillText(t({ atelier: 'pAtelier', signes: 'pSignes', visage: 'pVisage' }[b.id]), (b.r[0] + b.r[2]) / 2, (b.r[1] + b.r[3]) / 2);
    }
    ctx.font = `500 ${Math.round(14 * u)}px Inter, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(t('menuHint'), L / 2, H / 2 + 100 * u);
  }
  // aide en bas
  if (running && page === 'atelier' && !(resMains && resMains.landmarks && resMains.landmarks.length)) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = `500 ${Math.round(15 * u)}px Inter, sans-serif`; const s = t('showHands') + ' · ' + t('swipeHint'), w = ctx.measureText(s).width + 24 * u;
    ctx.fillRect(L / 2 - w / 2, H - 46 * u, w, 30 * u); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(s, L / 2, H - 31 * u);
  }
  if (sourisSeule) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 ${Math.round(13 * u)}px Inter, sans-serif`; ctx.textAlign = 'right'; ctx.fillText(t('mousePage'), L - 130 * u, H - 24 * u); }
  ctx.textAlign = 'left'; ctx.fillStyle = '#5be35b'; ctx.font = `600 ${Math.round(14 * u)}px JetBrains Mono, monospace`;
  if (running) ctx.fillText(`FPS ${fps.toFixed(0)}`, 14 * u, H - 22 * u);
}

// ---------- boucle ----------
let boucleActive = false;
function lancerBoucle() { if (!boucleActive) { boucleActive = true; requestAnimationFrame(boucle); } }
function dimensionner() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
  for (const c of [cv3d, cvHud]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  vue.l = stereo ? Math.floor(W / 2) : W; vue.h = H;
  if (oeil.width !== vue.l || oeil.height !== vue.h) { oeil.width = vue.l; oeil.height = vue.h; }
  const va = running && video.videoWidth ? video.videoWidth / video.videoHeight : 4 / 3, ar = vue.l / vue.h;
  vue.rec = ar > va ? [0, (1 - va / ar) / 2, 1, va / ar] : [(1 - ar / va) / 2, 0, ar / va, 1];
}
const pinces = {};
function boucle(now) {
  if (!running && !sourisSeule) { boucleActive = false; return; }
  dimensionner();
  const inst = 1000 / Math.max(now - tPrec, 1); fps = fps ? 0.92 * fps + 0.08 * inst : inst; tPrec = now;
  if (stereo && qTel && qDepart) atelier.cam.q = q4.norm(q4.mul(q4.conj(qDepart), qTel));
  // détection
  if (running && video.currentTime !== derniereImage) {
    derniereImage = video.currentTime;
    if (page === 'visage') { if (visageLm) { resVisage = visageLm.detectForVideo(video, now); m5.traiter(resVisage, now); } if (mainsLm && (++imagesVisage % 3 === 0)) resMains = mainsLm.detectForVideo(video, now); }
    else if (mainsLm) { resMains = mainsLm.detectForVideo(video, now); if (page === 'signes' && !menu && !ouvrirMenu.depuis) m4s.traiter(resMains, now); }
  }
  // mains -> gestes
  const lues = [];
  if (running && resMains && resMains.landmarks) resMains.landmarks.forEach((lm, i) => {
    const W = resMains.worldLandmarks && resMains.worldLandmarks[i]; if (!W) return;
    const m = lireMain(lm, W, { miroir, versVue: px }); m.id = 'm' + i;
    const s = pinces[m.id] || (pinces[m.id] = new Seuil(PINCE_ON, PINCE_OFF)); m.pince = s.maj(m.dPince);
    lues.push(m);
  });
  if (page === 'atelier' && souris.dedans && (sourisSeule || running)) { const appui = souris.gauche || souris.droit || souris.min > 0; if (souris.min > 0) souris.min--; lues.push({ id: 'souris', pointeur: [souris.x, souris.y], dPince: appui ? 0.01 : 0.1, pince: appui, taille: 100, q: souris.q, ouverte: false }); }
  // menu des pages : les deux mains ouvertes pendant 1 s (aucune lettre de l'alphabet ne se fait à deux mains,
  // et on ne tient pas de pièce mains ouvertes : pas de changement de page par accident)
  const mainsCam = lues.filter((m) => m.id !== 'souris');
  const deuxOuvertes = mainsCam.length >= 2 && mainsCam.filter((m) => m.ouverte && !m.pince).length >= 2 && !atelier.tenu();
  if (ouvrirMenu.maj(deuxOuvertes, now)) menu = menu ? null : { depuis: now };
  if (menu && now - menu.depuis > 8000) menu = null;
  const clics = lues.filter((m) => m.pince && !pincePrec[m.id]);
  for (const m of lues) pincePrec[m.id] = m.pince;
  if (menu) {
    for (const m of clics) { const b = boutonsMenu().find((x) => dansR(m.pointeur, x.r)); if (b) { setPage(b.id); menu = null; break; } }
  }
  // atelier (rien ne bouge pendant que le menu est ouvert)
  if (page === 'atelier' && !menu) {
    const evts = atelier.mettreAJour(lues, vue.l, vue.h, now, { corbeille: corbeille(), boutons: boutonsHud() });
    for (const e of evts) if (e.type === 'bouton') actionHud(e.b.id);
    for (const m of lues) m.tient = !!(atelier.mains[m.id] && atelier.mains[m.id].saisie);
  }
  // rendu 3D + interface
  if (rendu) {
    if (running) rendu.majVideo(video);
    const scene = page === 'atelier' ? atelier.scene : { objets: [], temps: now / 1000 };
    rendu.dessiner(atelier.cam, scene, { video: running ? video : null, miroir, sombre: page === 'atelier' ? 0.7 : 1, stereo });
  }
  dessinerHud(lues, now);
  ctxHud.clearRect(0, 0, cvHud.width, cvHud.height);
  ctxHud.drawImage(oeil, 0, 0);
  if (stereo) ctxHud.drawImage(oeil, vue.l, 0);
  if (page === 'visage' && now - majBarresT > 120) { majBarresT = now; majBarres(); }
  requestAnimationFrame(boucle);
}
function actionHud(id) {
  if (FORMES[id]) ajouterForme(id, [(Math.random() - 0.5) * 0.3, (Math.random() - 0.3) * 0.15, -0.7 - Math.random() * 0.15]);
  else if (id === 'holo') basculerHolo();
  else if (id === 'toupie') basculerToupie();
}
function basculerHolo() { holoParDefaut = !holoParDefaut; atelier.scene.objets.forEach((o) => (o.holo = holoParDefaut)); $('holo').setAttribute('aria-pressed', holoParDefaut); }
function basculerToupie() { const v = !atelier.scene.objets.some((o) => o.toupie); atelier.scene.objets.forEach((o) => (o.toupie = v)); $('toupie').setAttribute('aria-pressed', v); }

// ---------- page Langue des signes ----------
function majSignes() {
  if (!$('msg')) return;
  $('msg').textContent = m4s.etat.message;
  document.querySelectorAll('[data-alpha]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.alpha === m4s.etat.alphabet));
  const L = m4s.lettres(), sel = $('learnLetter'), garde = sel.value;
  sel.innerHTML = L.map((l) => `<option value="${l.lettre}">${l.lettre}</option>`).join(''); if (garde) sel.value = garde;
  const n = m4s.nbExemples(), k = Object.keys(n).sort();
  $('learnCounts').textContent = t('myExamples') + ' (' + m4s.etat.alphabet.toUpperCase() + ') : ' + (k.length ? k.map((x) => x + ' ×' + n[x]).join(', ') : t('none'));
  $('alpha').innerHTML = L.map((l) => `<div><b>${l.lettre}</b>${l.desc[lang]}</div>`).join('');
}
// ---------- page Visage ----------
const INDICES = ['sourire', 'moue', 'bouche', 'sourcilsLeves', 'sourcilsFronces', 'yeuxOuverts'];
function construireBarres() {
  const row = (id, lab) => `<div class="row"><span>${lab}</span><div class="track"><div class="fill" id="${id}"></div></div><span class="val" id="${id}v">–</span></div>`;
  $('moodBars').innerHTML = m5.HUMEURS.map((h) => row('mb-' + h, m5.LIBELLES[lang][h])).join('');
  m5.HUMEURS.forEach((h) => ($('mb-' + h).style.background = m5.COULEURS[h]));
  $('cueBars').innerHTML = INDICES.map((k) => row('cb-' + k, t('cue_' + k))).join('');
}
function majBarres() {
  const e = m5.etat;
  m5.HUMEURS.forEach((h) => { const v = e.h ? e.h.p[h] : 0; $('mb-' + h).style.width = (v * 100).toFixed(0) + '%'; $('mb-' + h + 'v').textContent = e.h ? Math.round(v * 100) + ' %' : '–'; });
  INDICES.forEach((k) => { const v = e.ind ? e.ind[k] : 0; $('cb-' + k).style.width = (v * 100).toFixed(0) + '%'; $('cb-' + k + 'v').textContent = e.ind ? v.toFixed(2) : '–'; });
}

// ---------- branchements ----------
$('start').addEventListener('click', () => demarrer(false));
$('startArriere').addEventListener('click', () => demarrer(true));
$('souris').addEventListener('click', essaiSouris);
$('stop').addEventListener('click', arreter);
$('fichier').addEventListener('change', (e) => { importer([...e.target.files]); e.target.value = ''; });
['dragenter', 'dragover'].forEach((k) => stage.addEventListener(k, (e) => { e.preventDefault(); stage.classList.add('glisse'); }));
['dragleave', 'drop'].forEach((k) => stage.addEventListener(k, (e) => { e.preventDefault(); stage.classList.remove('glisse'); }));
stage.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files || [])]; if (f.length) { setPage('atelier'); if (!running && !sourisSeule) essaiSouris(); importer(f); } });
document.querySelectorAll('[data-forme]').forEach((b) => b.addEventListener('click', () => { if (!running && !sourisSeule) essaiSouris(); actionHud(b.dataset.forme); }));
$('holo').addEventListener('click', basculerHolo);
$('toupie').addEventListener('click', basculerToupie);
$('vider').addEventListener('click', () => atelier.vider());
$('exporter').addEventListener('click', exporter);
['casque', 'casque4', 'casque5'].forEach((id) => $(id).addEventListener('click', entrerCasque));
$('quitterCasque').addEventListener('click', quitterCasque);
$('ipd').addEventListener('input', (e) => { ipd = +e.target.value; $('ipdV').textContent = Math.round(ipd * 1000) + ' mm'; if (stereo) stereo = ipd || 0.0001; });
$('space4').addEventListener('click', () => m4s.espace());
$('back4').addEventListener('click', () => m4s.retour());
$('clear4').addEventListener('click', () => m4s.effacer());
$('speak4').addEventListener('click', () => {
  if (!('speechSynthesis' in window) || !m4s.etat.message.trim()) return;
  const u = new SpeechSynthesisUtterance(m4s.etat.message.toLowerCase()); u.lang = m4s.etat.alphabet === 'lsf' ? 'fr-FR' : 'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u);
});
document.querySelectorAll('[data-alpha]').forEach((b) => b.addEventListener('click', () => m4s.alphabet(b.dataset.alpha)));
$('learnBtn').addEventListener('click', () => { if (!running) { $('learnCounts').textContent = t('needCam'); return; } m4s.enregistrer($('learnLetter').value); });
$('forget4').addEventListener('click', () => m4s.oublier());
$('calib5').addEventListener('click', () => m5.calibrer(performance.now()));
$('uncalib5').addEventListener('click', () => m5.oublierCalibration());
document.querySelectorAll('.page').forEach((b) => b.addEventListener('click', () => setPage(b.dataset.page)));
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
window.addEventListener('keydown', (e) => { if (e.target.closest('input, select, textarea')) return; if (e.key === 'ArrowRight') setPage(PAGES[(PAGES.indexOf(page) + 1) % 3]); if (e.key === 'ArrowLeft') setPage(PAGES[(PAGES.indexOf(page) + 2) % 3]); if (e.key === 'Delete') { const v = atelier.viser(souris.x, souris.y, vue.l, vue.h); if (v) atelier.supprimer(v.o); } });
window.addEventListener('pagehide', () => stream && stream.getTracks().forEach((x) => x.stop()));
setLang(lang); setPage('atelier');
// dessin initial (fond de la scène derrière l'écran d'accueil)
dimensionner(); if (rendu) rendu.dessiner(atelier.cam, atelier.scene, {});

// Point d'accès pour les tests (sans effet en usage normal)
window.__visionDemo = { atelier, getState: () => ({ running, page, stereo, objets: atelier.scene.objets.length, fps, message: m4s.etat.message, humeur: m5.etat.h && m5.etat.h.humeur }), readyHands: () => !!mainsLm, readyFace: () => !!visageLm, setPage, importer, entrerCasque, quitterCasque, stereo: (v) => { stereo = v; }, ouvrirMenu: () => { menu = { depuis: performance.now() }; } };
