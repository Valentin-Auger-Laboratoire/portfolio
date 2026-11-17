// =====================================================================
//  Démo web « Vision IA » : portage JavaScript des scripts Python du dépôt
//  github.com/Valentin-Auger-Laboratoire/vision-main
//    Étape 1 = app.py (suivi de la main, bouton QUITTER au doigt)
//    Étape 2 = construction_gestes.py (cubes posés par pince, poing = effacer)
//    Étape 3 = monde 3D (mode3d.js + voxels.js, moteur 3D écrit à la main)
//    Étape 4 = alphabet des signes LSF / ASL (modesignes.js + signes.js)
//    Étape 5 = maillage du visage et humeur (modevisage.js + humeur.js)
//  MediaPipe Tasks Vision (Apache 2.0) est servi depuis lib/ (aucun CDN).
// =====================================================================
import { FilesetResolver, HandLandmarker, FaceLandmarker } from './lib/vision_bundle.mjs';
import { creerMode3D } from './mode3d.js';
import { creerModeSignes } from './modesignes.js';
import { creerModeVisage } from './modevisage.js';

const T = {
  fr: {
    back: '← Retour au portfolio', eyebrow: 'Démo interactive · vision par ordinateur',
    title: 'Suivre la main, construire en 3D, lire les signes et le visage',
    intro: "La webcam détecte les 21 points de chaque main et les 478 points du visage en temps réel. Cinq étapes : un bouton touché du doigt, des cubes posés par pince, un vrai monde 3D construit avec les deux mains, l'alphabet des signes lu lettre par lettre, puis l'humeur lue sur le visage.",
    note: 'Étapes 1 et 2 : portage web des scripts Python du projet. Étapes 3 à 5 : ajoutées en 2026, écrites directement pour le web (JavaScript, MediaPipe Hands et Face Landmarker). <a href="https://github.com/Valentin-Auger-Laboratoire/vision-main" target="_blank" rel="noopener">voir le code ↗</a>',
    mode1: 'Étape 1 · Suivi de la main', mode2: 'Étape 2 · Construction de cubes',
    mode3: 'Étape 3 · Monde 3D', mode4: 'Étape 4 · Alphabet des signes', mode5: 'Étape 5 · Visage et humeur',
    start: 'Activer la caméra', restart: 'Relancer la caméra',
    statusIdle: "La caméra ne s'allume qu'après ce clic. Les modèles (main ≈ 8 Mo, visage ≈ 4 Mo) se chargent une seule fois.",
    loading: 'Chargement du modèle de la main…', loadingFace: 'Chargement du modèle du visage…',
    mouseTry: 'Essayer à la souris, sans caméra',
    undo3: 'Annuler (Z)', styleNeon: 'Rendu néon', stylePlain: 'Rendu plein', view3: 'Vue initiale', sample3: 'Charger un exemple',
    export3: 'Exporter en OBJ (Fusion 360, Blender)', stl3: 'Exporter en STL (impression 3D)', sym3: 'Symétrie miroir', rot3: 'Rotation automatique', lefty: 'Inverser les mains',
    roleBuild: 'construction', roleView: 'vue',
    h3a: 'Main droite : pincer pouce + index', h3b: 'Pose un cube sur la face visée. Gardez la pince et déplacez la main : vous tracez une ligne ou un mur dans le même plan.',
    h3c: 'Main droite : pincer pouce + majeur', h3d: 'Retire le cube visé.',
    h3e: 'Main gauche : pincer et déplacer', h3f: 'Fait tourner la scène autour de la construction.',
    h3g: 'Main gauche : poing, monter ou descendre', h3h: 'Zoom avant ou arrière.',
    h3i: 'Index sur une couleur', h3j: 'Change la couleur au bout de 0,45 s.',
    h3k: 'À la souris', h3l: 'Clic : poser · clic droit ou Maj + clic : retirer · glisser : tourner · molette : zoom.',
    lim3: 'Moteur 3D écrit à la main (projection, visée par parcours de grille, faces cachées, export OBJ et STL), vérifié par des tests automatiques. La construction est gardée dans ce navigateur.',
    h4a: 'Montrer une lettre à la caméra', h4b: "La lettre reconnue s'affiche avec sa confiance. Tenue 0,9 s, elle s'ajoute au message.",
    learnTitle: 'Apprendre mes signes', learnBtn: 'Enregistrer 25 images', forget: 'Oublier mes exemples', alphaTitle: 'Lettres reconnues',
    lim4: "J et Z se font avec un mouvement : elles ne sont pas reconnues. Les modèles des lettres viennent d'une main de synthèse : les lettres proches (A, S, E, M, N, T) peuvent se confondre avec une vraie main. Enregistrer ses propres exemples corrige la plupart des erreurs.",
    msgTitle: 'Message', space: 'Espace', backspace: 'Effacer une lettre', clearMsg: 'Tout effacer', speak: 'Lire à voix haute',
    letterSeen: 'LETTRE', confidence: 'confiance', recording: 'Enregistrement', myExamples: 'Mes exemples', none: 'aucun',
    needCam: "Activez la caméra pour enregistrer vos exemples.",
    moodTitle: 'Humeur', cuesTitle: 'Indices du visage', calib: 'Calibrer mon visage au repos (2 s)', uncalib: 'Oublier la calibration',
    calibrating: 'Gardez un visage neutre…', noFace: 'Aucun visage détecté', moodLabel: 'HUMEUR',
    cue_sourire: 'Sourire', cue_moue: 'Coins de bouche bas', cue_bouche: 'Bouche ouverte', cue_sourcilsLeves: 'Sourcils levés', cue_sourcilsFronces: 'Sourcils froncés', cue_yeuxOuverts: 'Yeux écarquillés',
    lim5: "Reconnaissance d'expressions, pas d'identification : le modèle ne sait pas qui vous êtes. L'humeur est déduite par des règles sur 52 coefficients d'expression (sourire, sourcils, bouche…). Une expression n'est pas une émotion : c'est une démonstration, pas un diagnostic.", cam: 'Ouverture de la caméra…',
    denied: "Accès à la caméra refusé. Autorisez la caméra pour ce site (icône à gauche de l'adresse), puis réessayez.",
    nocam: "Aucune caméra trouvée, ou elle est déjà utilisée par une autre application.",
    fail: "Le modèle n'a pas pu se charger. Rechargez la page.",
    stopped: 'Caméra arrêtée.', stoppedBtn: 'Caméra arrêtée : bouton QUITTER touché.',
    undo: 'Annuler le dernier cube (Z)', clear: 'Tout effacer (C)', stop: 'Arrêter la caméra (Q)',
    controls: 'Commandes',
    h1a: 'Index sur QUITTER', h1b: "Le bouton passe au vert, puis la caméra s'arrête au bout de 0,3 s.",
    h1c: 'Clic sur QUITTER ou touche Q', h1d: 'Arrêt immédiat.',
    h2a: "Viser avec l'index", h2b: "Un cube fantôme suit le bout de l'index, aimanté sur une grille.",
    h2c: 'Pincer pouce + index', h2d: 'Pose un cube. Un seul cube par pince : relâchez pour en poser un autre.',
    h2e: 'Avancer ou reculer la main', h2f: 'Change la taille du cube (profondeur simulée).',
    h2g: 'Fermer le poing', h2h: 'Efface le dernier cube.', h2i: 'Annuler, tout effacer, arrêter.',
    privacy: "Les images de la caméra sont analysées dans votre navigateur. Rien n'est enregistré ni envoyé.",
    quit: 'QUITTER', off: 'OFF', erase: 'EFFACER', cubes: 'Cubes', hands: 'Mains',
  },
  en: {
    back: '← Back to portfolio', eyebrow: 'Interactive demo · computer vision',
    title: 'Track the hand, build in 3D, read signs and the face',
    intro: 'The webcam detects the 21 landmarks of each hand and the 478 landmarks of the face in real time. Five steps: a button touched with a finger, cubes placed by pinching, a real 3D world built with both hands, the sign alphabet read letter by letter, then the mood read on the face.',
    note: 'Steps 1 and 2: web port of the project\'s Python scripts. Steps 3 to 5: added in 2026, written directly for the web (JavaScript, MediaPipe Hands and Face Landmarker). <a href="https://github.com/Valentin-Auger-Laboratoire/vision-main" target="_blank" rel="noopener">view the code ↗</a>',
    mode1: 'Step 1 · Hand tracking', mode2: 'Step 2 · Building cubes',
    mode3: 'Step 3 · 3D world', mode4: 'Step 4 · Sign alphabet', mode5: 'Step 5 · Face and mood',
    start: 'Turn on the camera', restart: 'Restart the camera',
    statusIdle: 'The camera only turns on after this click. The models (hand ≈ 8 MB, face ≈ 4 MB) load once.',
    loading: 'Loading the hand model…', loadingFace: 'Loading the face model…',
    mouseTry: 'Try it with the mouse, no camera',
    undo3: 'Undo (Z)', styleNeon: 'Neon rendering', stylePlain: 'Solid rendering', view3: 'Reset view', sample3: 'Load an example',
    export3: 'Export as OBJ (Fusion 360, Blender)', stl3: 'Export as STL (3D printing)', sym3: 'Mirror symmetry', rot3: 'Auto-rotate', lefty: 'Swap hands',
    roleBuild: 'build', roleView: 'view',
    h3a: 'Right hand: pinch thumb + index', h3b: 'Places a cube on the aimed face. Keep pinching and move the hand: you draw a line or a wall in the same plane.',
    h3c: 'Right hand: pinch thumb + middle', h3d: 'Removes the aimed cube.',
    h3e: 'Left hand: pinch and move', h3f: 'Rotates the scene around the build.',
    h3g: 'Left hand: fist, move up or down', h3h: 'Zoom in or out.',
    h3i: 'Index on a colour', h3j: 'Changes the colour after 0.45 s.',
    h3k: 'With the mouse', h3l: 'Click: place · right click or Shift + click: remove · drag: rotate · wheel: zoom.',
    lim3: 'Hand-written 3D engine (projection, grid-traversal picking, hidden faces, OBJ and STL export), checked by automated tests. The build is kept in this browser.',
    h4a: 'Show a letter to the camera', h4b: 'The recognised letter is shown with its confidence. Held for 0.9 s, it is added to the message.',
    learnTitle: 'Teach my signs', learnBtn: 'Record 25 frames', forget: 'Forget my examples', alphaTitle: 'Recognised letters',
    lim4: 'J and Z need a movement: they are not recognised. The letter models come from a synthetic hand: close letters (A, S, E, M, N, T) can be confused with a real hand. Recording your own examples fixes most errors.',
    msgTitle: 'Message', space: 'Space', backspace: 'Delete a letter', clearMsg: 'Clear all', speak: 'Read aloud',
    letterSeen: 'LETTER', confidence: 'confidence', recording: 'Recording', myExamples: 'My examples', none: 'none',
    needCam: 'Turn on the camera to record your examples.',
    moodTitle: 'Mood', cuesTitle: 'Face cues', calib: 'Calibrate my resting face (2 s)', uncalib: 'Forget the calibration',
    calibrating: 'Keep a neutral face…', noFace: 'No face detected', moodLabel: 'MOOD',
    cue_sourire: 'Smile', cue_moue: 'Mouth corners down', cue_bouche: 'Mouth open', cue_sourcilsLeves: 'Brows raised', cue_sourcilsFronces: 'Brows lowered', cue_yeuxOuverts: 'Eyes wide',
    lim5: 'Expression recognition, not identification: the model does not know who you are. The mood is inferred by rules on 52 expression coefficients (smile, brows, mouth…). An expression is not an emotion: this is a demo, not a diagnosis.', cam: 'Opening the camera…',
    denied: 'Camera access denied. Allow the camera for this site (icon left of the address bar), then try again.',
    nocam: 'No camera found, or it is already used by another application.',
    fail: 'The model could not load. Reload the page.',
    stopped: 'Camera stopped.', stoppedBtn: 'Camera stopped: QUIT button touched.',
    undo: 'Undo last cube (Z)', clear: 'Clear all (C)', stop: 'Stop the camera (Q)',
    controls: 'Controls',
    h1a: 'Index on QUIT', h1b: 'The button turns green, then the camera stops after 0.3 s.',
    h1c: 'Click QUIT or press Q', h1d: 'Immediate stop.',
    h2a: 'Aim with the index', h2b: 'A ghost cube follows the index fingertip, snapped to a grid.',
    h2c: 'Pinch thumb + index', h2d: 'Places a cube. One cube per pinch: release to place another.',
    h2e: 'Move the hand closer or further', h2f: 'Changes the cube size (simulated depth).',
    h2g: 'Close your fist', h2h: 'Erases the last cube.', h2i: 'Undo, clear all, stop.',
    privacy: 'Camera images are analysed in your browser. Nothing is recorded or sent.',
    quit: 'QUIT', off: 'OFF', erase: 'ERASE', cubes: 'Cubes', hands: 'Hands',
  },
};

// Repères et réglages repris de construction_gestes.py
const WRIST = 0, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_TIP = 8;
const FINGER_TIPS = [8, 12, 16, 20], FINGER_PIPS = [6, 10, 14, 18];
const GRID_RATIO = 1 / 32, PINCH_RATIO = 0.047, SIZE_RATIO = 0.78;
const MIN_SIZE_RATIO = 0.03, MAX_SIZE_RATIO = 0.30, DEPTH_RATIO = 0.35;
const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const COL = { fixed: '#5be35b', ghost: '#5fe3ff', fist: '#ffa600', off: '#c8102e', ok: '#2ecc40', text: '#ffffff', bone: '#ffffff', joint: '#ff3b3b' };

const $ = (id) => document.getElementById(id);
const video = $('video'), canvas = $('canvas'), ctx = canvas.getContext('2d');
let lang = 'en';
try { lang = (localStorage.getItem('langChoix') === 'fr' ? 'fr' : 'en'); } catch (e) {}
let mode = 3, landmarker = null, faceLm = null, files = null, stream = null, running = false, sourisSeule = false;
let cubes = [], pinchLock = {}, fistLock = {}, fps = 0, prev = 0, quitSince = 0, lastVideoTime = -1, lastFaceTime = -1;
let button = [0, 0, 0, 0], derniereMaj = 0;

function t(k) { return T[lang][k]; }

function isFist(lm) {
  const w = lm[WRIST];
  return FINGER_TIPS.every((tip, i) => Math.hypot(lm[tip].x - w.x, lm[tip].y - w.y) < Math.hypot(lm[FINGER_PIPS[i]].x - w.x, lm[FINGER_PIPS[i]].y - w.y));
}

// Contexte partagé avec les modules des étapes 3 à 5
const app = {
  canvas, t, lang: () => lang, estPoing: isFist, camEnMarche: () => running,
  majSignes: () => majSignes(),
};
const m3 = creerMode3D(app), m4 = creerModeSignes(app), m5 = creerModeVisage(app);
m3.brancherSouris(canvas, () => mode === 3 && (running || sourisSeule));

function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  document.querySelectorAll('[data-t]').forEach((el) => { const v = T[l][el.dataset.t]; if (v != null) el.innerHTML = v; });
  if (!running && $('start').dataset.state === 'restart') $('start').textContent = t('restart');
  $('style3').textContent = m3.etat.style === 'plein' ? t('styleNeon') : t('stylePlain');
  document.title = l === 'fr' ? 'Vision IA — démo' : 'Vision AI — demo';
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === l));
  try { localStorage.setItem('lang', l); localStorage.setItem('langChoix', l); } catch (e) {}
  majSignes(); construireBarres();
}

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.mode === m));
  document.querySelectorAll('.help .step').forEach((s) => (s.hidden = +s.dataset.step !== m));
  const actif = running || (m === 3 && sourisSeule);
  document.querySelectorAll('[data-show]').forEach((el) => {
    const ici = String(el.dataset.show) === String(m);
    if (el.id === 'souris') el.hidden = !ici || running || sourisSeule;
    else if (el.tagName === 'BUTTON') el.hidden = !ici || !actif;      // commandes utiles seulement quand l'étape tourne
    else el.hidden = !ici;
  });
  quitSince = 0;
  if (sourisSeule && m !== 3) { sourisSeule = false; $('overlay').hidden = false; }
  if (running && m === 5) chargerVisage().catch((e) => console.error(e));
  if (!running && !sourisSeule) $('overlay').hidden = false;
}

function status(text, isError) {
  const s = $('status'); s.textContent = text; s.classList.toggle('msg', !!isError);
}

async function fichiers() {
  if (!files) files = await FilesetResolver.forVisionTasks(new URL('./lib/wasm', import.meta.url).href);
  return files;
}

async function chargerMains() {
  if (landmarker) return;
  status(t('loading'));
  const f = await fichiers();
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: new URL('./lib/hand_landmarker.task', import.meta.url).href, delegate },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.7, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { landmarker = await HandLandmarker.createFromOptions(f, opts('GPU')); }
  catch (e) { landmarker = await HandLandmarker.createFromOptions(f, opts('CPU')); }
}

let chargementVisage = null;
function chargerVisage() {
  if (faceLm) return Promise.resolve();
  if (chargementVisage) return chargementVisage;
  if (!running) status(t('loadingFace'));
  chargementVisage = (async () => {
    const f = await fichiers();
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: new URL('./lib/face_landmarker.task', import.meta.url).href, delegate },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { faceLm = await FaceLandmarker.createFromOptions(f, opts('GPU')); }
    catch (e) { faceLm = await FaceLandmarker.createFromOptions(f, opts('CPU')); }
  })();
  return chargementVisage;
}

async function start() {
  const btn = $('start'); btn.disabled = true;
  try {
    if (mode === 5) await chargerVisage(); else await chargerMains();
    status(t('cam'));
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    $('stage').style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
    $('overlay').hidden = true;
    running = true; sourisSeule = false; prev = performance.now(); fps = 0; lastVideoTime = -1; lastFaceTime = -1;
    $('stop').hidden = false; setMode(mode);
    if (mode !== 5) chargerVisage().catch(() => {});     // en arrière-plan, pour l'étape 5
    else chargerMains().catch(() => {});
    requestAnimationFrame(loop);
  } catch (e) {
    const name = e && e.name;
    status(name === 'NotAllowedError' || name === 'SecurityError' ? t('denied')
      : name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError' ? t('nocam') : ((landmarker || faceLm) ? t('nocam') : t('fail')), true);
    console.error(e);
  } finally { btn.disabled = false; }
}

function essaiSouris() {
  sourisSeule = true;
  if (!running) { canvas.width = 960; canvas.height = 720; $('stage').style.aspectRatio = '4 / 3'; }
  $('overlay').hidden = true; setMode(3);
  requestAnimationFrame(boucleSouris);
}
function boucleSouris(now) {
  if (!sourisSeule || running || mode !== 3) return;
  m3.dessiner(ctx, now, false);
  hud([`${t('cubes')} : ${m3.monde.nombre}`]);
  requestAnimationFrame(boucleSouris);
}

function stop(reasonKey) {
  running = false;
  if (stream) stream.getTracks().forEach((tr) => tr.stop());
  stream = null; video.srcObject = null;
  pinchLock = {}; fistLock = {}; quitSince = 0;
  $('overlay').hidden = false;
  const btn = $('start'); btn.dataset.state = 'restart'; btn.textContent = t('restart');
  status(t(reasonKey || 'stopped'));
  $('stop').hidden = true; setMode(mode);
}

const inside = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

function quitRect(w, h) {        // app.py : bouton en haut à droite
  const bw = Math.round(w * 0.2), bh = Math.round(h * 0.075);
  return [w - bw - Math.round(w * 0.03), Math.round(h * 0.04), w - Math.round(w * 0.03), Math.round(h * 0.04) + bh];
}
function offRect(w, h) {         // construction_gestes.py : bouton centré en bas
  const bw = Math.round(w * 0.16), bh = Math.round(h * 0.09);
  const x1 = Math.round((w - bw) / 2), y1 = h - bh - Math.round(h * 0.06);
  return [x1, y1, x1 + bw, y1 + bh];
}

function drawButton(r, color, label) {
  ctx.fillStyle = color; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  ctx.fillStyle = COL.text; ctx.font = `600 ${Math.round((r[3] - r[1]) * 0.42)}px ${'Inter, system-ui, sans-serif'}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2 + 1);
}

function drawCube(x, y, size, color, width) {
  const d = Math.round(size * DEPTH_RATIO);
  const front = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
  const back = front.map(([px, py]) => [px + d, py - d]);
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(...back[i]); ctx.lineTo(...back[(i + 1) % 4]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...front[i]); ctx.lineTo(...back[i]); ctx.stroke();
  }
  ctx.lineWidth = width || 2.5;
  ctx.strokeRect(x, y, size, size);
}

function hud(lines, bas) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `600 ${Math.max(14, Math.round(canvas.width * 0.022))}px JetBrains Mono, monospace`;
  const pas = Math.round(canvas.width * 0.032);
  lines.forEach((l, i) => {
    const y = bas ? canvas.height - 12 - (lines.length - i) * pas : 12 + i * pas;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, y - 2, ctx.measureText(l).width + 10, Math.round(canvas.width * 0.028));
    ctx.fillStyle = COL.fixed; ctx.fillText(l, 13, y);
  });
}

function squelette(lm, P, coul) {
  ctx.strokeStyle = coul || COL.bone; ctx.lineWidth = 2;
  CONNECTIONS.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...P(lm[a])); ctx.lineTo(...P(lm[b])); ctx.stroke(); });
  ctx.fillStyle = COL.joint;
  lm.forEach((p) => { const [x, y] = P(p); ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); });
}

function loop(now) {
  if (!running) return;
  const w = canvas.width, h = canvas.height;
  // Image en miroir (comme cv2.flip(frame, 1))
  ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, w, h); ctx.restore();
  const P = (p) => [(1 - p.x) * w, p.y * h];   // coordonnées en miroir, en pixels

  if (mode === 5) {
    if (faceLm) {
      let res = loop.lastFace;
      if (video.currentTime !== lastFaceTime) { lastFaceTime = video.currentTime; res = faceLm.detectForVideo(video, now); loop.lastFace = res; m5.traiter(res, now); }
      m5.dessiner(ctx, now);
    } else { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(w * 0.025)}px Inter, sans-serif`; ctx.fillText(t('loadingFace'), w / 2, h / 2); }
    if (now - derniereMaj > 120) { derniereMaj = now; majBarres(); }
    finCadre(now, [`FPS : ${fps.toFixed(0)}`], true);
    return;
  }
  if (!landmarker) { finCadre(now, [t('loading')]); return; }

  let res = null;
  if (video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; res = landmarker.detectForVideo(video, now); loop.last = res; }
  else res = loop.last;
  const hands = (res && res.landmarks) || [];

  if (mode === 3) {
    m3.traiterMains(res, now);
    m3.dessiner(ctx, now, true);
    hands.forEach((lm) => squelette(lm, P, 'rgba(255,255,255,.7)'));
    finCadre(now, [`${t('cubes')} : ${m3.monde.nombre}`, `FPS : ${fps.toFixed(0)}`], true);
    return;
  }
  if (mode === 4) {
    m4.traiter(res, now);
    hands.forEach((lm) => squelette(lm, P));
    m4.dessiner(ctx, now);
    finCadre(now, [`FPS : ${fps.toFixed(0)}`], true);
    return;
  }

  if (mode === 2) cubes.forEach(([cx, cy, cs]) => drawCube(cx, cy, cs, COL.fixed));

  let fingerOnQuit = false;
  const seen = new Set();
  const grid = Math.max(Math.round(w * GRID_RATIO), 1), pinchTh = w * PINCH_RATIO;
  const minS = Math.round(w * MIN_SIZE_RATIO), maxS = Math.round(w * MAX_SIZE_RATIO);
  button = mode === 1 ? quitRect(w, h) : offRect(w, h);

  hands.forEach((lm, hi) => {
    const id = (res.handedness && res.handedness[hi] && res.handedness[hi][0] && res.handedness[hi][0].categoryName) || 'h' + hi;
    seen.add(id);
    squelette(lm, P);
    const [ix, iy] = P(lm[INDEX_TIP]);

    if (mode === 1) {
      ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(ix, iy, 8, 0, 7); ctx.fill();
      if (inside(ix, iy, button)) fingerOnQuit = true;
      return;
    }
    if (isFist(lm)) {
      if (!fistLock[id] && cubes.length) cubes.pop();
      fistLock[id] = true;
      const [wx, wy] = P(lm[WRIST]);
      ctx.fillStyle = COL.fist; ctx.font = `700 ${Math.round(w * 0.028)}px Inter, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(t('erase'), wx, wy + 30);
      return;
    }
    fistLock[id] = false;
    const depth = Math.hypot(lm[INDEX_MCP].x - lm[WRIST].x, lm[INDEX_MCP].y - lm[WRIST].y);
    const size = Math.min(Math.max(Math.round(depth * w * SIZE_RATIO), minS), maxS);
    const gx = Math.floor(ix / grid) * grid, gy = Math.floor(iy / grid) * grid;
    drawCube(gx, gy, size, COL.ghost);
    const [tx, ty] = P(lm[THUMB_TIP]);
    if (Math.hypot(ix - tx, iy - ty) < pinchTh) {
      if (!pinchLock[id]) cubes.push([gx, gy, size]);
      pinchLock[id] = true;
    } else pinchLock[id] = false;
  });
  for (const id of new Set([...Object.keys(pinchLock), ...Object.keys(fistLock)])) if (!seen.has(id)) pinchLock[id] = fistLock[id] = false;

  // Bouton (index = vert ; arrêt 0,3 s après, comme app.py)
  if (mode === 1) {
    drawButton(button, fingerOnQuit ? COL.ok : COL.off, t('quit'));
    if (fingerOnQuit) { if (!quitSince) quitSince = now; else if (now - quitSince > 300) return stop('stoppedBtn'); }
    else quitSince = 0;
  } else drawButton(button, COL.off, t('off'));

  finCadre(now, mode === 2 ? [`${t('cubes')} : ${cubes.length}`, `FPS : ${fps.toFixed(0)}`] : [`${t('hands')} : ${hands.length}`, `FPS : ${fps.toFixed(0)}`]);
}

function finCadre(now, lignes, bas) {
  const inst = 1000 / Math.max(now - prev, 1); fps = fps ? 0.9 * fps + 0.1 * inst : inst; prev = now;
  hud(lignes, bas);
  requestAnimationFrame(loop);
}

// ---------- étape 4 : interface ----------
function majSignes() {
  if (!$('msg')) return;
  $('msg').textContent = m4.etat.message;
  document.querySelectorAll('[data-alpha]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.alpha === m4.etat.alphabet));
  const L = m4.lettres(), sel = $('learnLetter'), garde = sel.value;
  sel.innerHTML = L.map((l) => `<option value="${l.lettre}">${l.lettre}</option>`).join('');
  if (garde && L.some((l) => l.lettre === garde)) sel.value = garde;
  const n = m4.nbExemples(), k = Object.keys(n).sort();
  $('learnCounts').textContent = t('myExamples') + ' (' + m4.etat.alphabet.toUpperCase() + ') : ' + (k.length ? k.map((x) => x + ' ×' + n[x]).join(', ') : t('none'));
  $('alpha').innerHTML = L.map((l) => `<div><b>${l.lettre}</b>${l.desc[lang]}</div>`).join('');
}

// ---------- étape 5 : barres ----------
const INDICES = ['sourire', 'moue', 'bouche', 'sourcilsLeves', 'sourcilsFronces', 'yeuxOuverts'];
function construireBarres() {
  const row = (id, lab) => `<div class="row"><span>${lab}</span><div class="track"><div class="fill" id="${id}"></div></div><span class="val" id="${id}v">–</span></div>`;
  $('moodBars').innerHTML = m5.HUMEURS.map((hm) => row('mb-' + hm, m5.LIBELLES[lang][hm])).join('');
  m5.HUMEURS.forEach((hm) => ($('mb-' + hm).style.background = m5.COULEURS[hm]));
  $('cueBars').innerHTML = INDICES.map((k) => row('cb-' + k, t('cue_' + k))).join('');
}
function majBarres() {
  const e = m5.etat;
  m5.HUMEURS.forEach((hm) => { const v = e.h ? e.h.p[hm] : 0; $('mb-' + hm).style.width = (v * 100).toFixed(0) + '%'; $('mb-' + hm + 'v').textContent = e.h ? Math.round(v * 100) + ' %' : '–'; });
  INDICES.forEach((k) => { const v = e.ind ? e.ind[k] : 0; $('cb-' + k).style.width = (v * 100).toFixed(0) + '%'; $('cb-' + k + 'v').textContent = e.ind ? v.toFixed(2) : '–'; });
}

// Clic sur le bouton dessiné dans l'image (coordonnées canvas), étapes 1 et 2
canvas.addEventListener('click', (e) => {
  if (!running || mode > 2) return;
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width, y = ((e.clientY - r.top) / r.height) * canvas.height;
  if (inside(x, y, button)) stop('stopped');
});
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if (k === 'q' && running) stop('stopped');
  else if (k === 'z' && mode === 2 && running) cubes.pop();
  else if (k === 'c' && mode === 2 && running) cubes = [];
  else if (k === 'z' && mode === 3) m3.annuler();
  else if (k === 'c' && mode === 3) m3.vider();
});
$('start').addEventListener('click', start);
$('souris').addEventListener('click', essaiSouris);
$('stop').addEventListener('click', () => stop('stopped'));
$('undo').addEventListener('click', () => cubes.pop());
$('clear').addEventListener('click', () => (cubes = []));
$('undo3').addEventListener('click', () => m3.annuler());
$('clear3').addEventListener('click', () => m3.vider());
$('style3').addEventListener('click', () => { const s = m3.style(); $('style3').textContent = s === 'plein' ? t('styleNeon') : t('stylePlain'); });
$('view3').addEventListener('click', () => m3.vueInitiale());
$('sample3').addEventListener('click', () => m3.exemple());
$('export3').addEventListener('click', () => m3.exporter());
$('stl3').addEventListener('click', () => m3.exporterSTL());
$('sym3').addEventListener('click', () => $('sym3').setAttribute('aria-pressed', m3.symetrie()));
$('rot3').addEventListener('click', () => $('rot3').setAttribute('aria-pressed', m3.rotation()));
$('lefty3').addEventListener('click', () => { m3.etat.gaucher = !m3.etat.gaucher; $('lefty3').setAttribute('aria-pressed', m3.etat.gaucher); });
$('space4').addEventListener('click', () => m4.espace());
$('back4').addEventListener('click', () => m4.retour());
$('clear4').addEventListener('click', () => m4.effacer());
$('speak4').addEventListener('click', () => {
  if (!('speechSynthesis' in window) || !m4.etat.message.trim()) return;
  const u = new SpeechSynthesisUtterance(m4.etat.message.toLowerCase()); u.lang = m4.etat.alphabet === 'lsf' ? 'fr-FR' : 'en-US';
  speechSynthesis.cancel(); speechSynthesis.speak(u);
});
document.querySelectorAll('[data-alpha]').forEach((b) => b.addEventListener('click', () => m4.alphabet(b.dataset.alpha)));
$('learnBtn').addEventListener('click', () => { if (!running) { $('learnCounts').textContent = t('needCam'); return; } m4.enregistrer($('learnLetter').value); });
$('forget4').addEventListener('click', () => m4.oublier());
$('calib5').addEventListener('click', () => m5.calibrer(performance.now()));
$('uncalib5').addEventListener('click', () => m5.oublierCalibration());
document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(+b.dataset.mode)));
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
window.addEventListener('pagehide', () => stream && stream.getTracks().forEach((tr) => tr.stop()));
setLang(lang); setMode(3);

// Hook de test (sans effet en usage normal)
window.__visionDemo = {
  getState: () => ({ running, mode, cubes: cubes.length, fps, voxels: m3.monde.nombre, message: m4.etat.message, humeur: m5.etat.h && m5.etat.h.humeur }),
  ready: () => !!landmarker, readyFace: () => !!faceLm, m3, m4, m5,
};
