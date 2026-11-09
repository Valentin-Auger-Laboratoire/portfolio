// =====================================================================
//  Démo web « Vision IA » : portage JavaScript des scripts Python du dépôt
//  github.com/Valentin-Auger-Laboratoire/vision-main
//    Étape 1 = app.py (suivi de la main, bouton QUITTER au doigt)
//    Étape 2 = construction_gestes.py (cubes posés par pince, poing = effacer)
//  MediaPipe Tasks Vision (Apache 2.0) est servi depuis lib/ (aucun CDN).
// =====================================================================
import { FilesetResolver, HandLandmarker } from './lib/vision_bundle.mjs';

const T = {
  fr: {
    back: '← Retour au portfolio', eyebrow: 'Démo interactive · vision par ordinateur',
    title: 'Suivre la main, puis construire des cubes avec des gestes',
    intro: "La webcam détecte les 21 points de chaque main en temps réel. Étape 1 : touchez le bouton QUITTER du bout de l'index. Étape 2 : pincez le pouce et l'index pour poser des cubes, fermez le poing pour effacer.",
    note: 'Version web de démonstration (JavaScript, MediaPipe Hands) qui reprend la logique des scripts Python du projet : <a href="https://github.com/Valentin-Auger-Laboratoire/vision-main" target="_blank" rel="noopener">voir le code Python ↗</a>',
    mode1: 'Étape 1 · Suivi de la main', mode2: 'Étape 2 · Construction de cubes',
    start: 'Activer la caméra', restart: 'Relancer la caméra',
    statusIdle: "La caméra ne s'allume qu'après ce clic. Le modèle de la main (≈ 8 Mo) se charge une seule fois.",
    loading: 'Chargement du modèle de la main…', cam: 'Ouverture de la caméra…',
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
    title: 'Track the hand, then build cubes with gestures',
    intro: 'The webcam detects the 21 landmarks of each hand in real time. Step 1: touch the QUIT button with your index fingertip. Step 2: pinch thumb and index to place cubes, close your fist to erase.',
    note: 'Web demo version (JavaScript, MediaPipe Hands) following the logic of the project\'s Python scripts: <a href="https://github.com/Valentin-Auger-Laboratoire/vision-main" target="_blank" rel="noopener">view the Python code ↗</a>',
    mode1: 'Step 1 · Hand tracking', mode2: 'Step 2 · Building cubes',
    start: 'Turn on the camera', restart: 'Restart the camera',
    statusIdle: 'The camera only turns on after this click. The hand model (≈ 8 MB) loads once.',
    loading: 'Loading the hand model…', cam: 'Opening the camera…',
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
let mode = 2, landmarker = null, stream = null, running = false;
let cubes = [], pinchLock = {}, fistLock = {}, fps = 0, prev = 0, quitSince = 0, lastVideoTime = -1;
let button = [0, 0, 0, 0];

function t(k) { return T[lang][k]; }

function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  document.querySelectorAll('[data-t]').forEach((el) => { const v = T[l][el.dataset.t]; if (v != null) el.innerHTML = v; });
  if (!running && $('start').dataset.state === 'restart') $('start').textContent = t('restart');
  document.title = l === 'fr' ? 'Vision IA — démo' : 'Vision AI — demo';
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === l));
  try { localStorage.setItem('lang', l); localStorage.setItem('langChoix', l); } catch (e) {}
}

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.mode === m));
  document.querySelectorAll('.help .step').forEach((s) => (s.hidden = +s.dataset.step !== m));
  $('undo').hidden = $('clear').hidden = !(running && m === 2);
  quitSince = 0;
}

function status(text, isError) {
  const s = $('status'); s.textContent = text; s.classList.toggle('msg', !!isError);
}

async function start() {
  const btn = $('start'); btn.disabled = true;
  try {
    if (!landmarker) {
      status(t('loading'));
      const files = await FilesetResolver.forVisionTasks(new URL('./lib/wasm', import.meta.url).href);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: new URL('./lib/hand_landmarker.task', import.meta.url).href, delegate },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.7, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try { landmarker = await HandLandmarker.createFromOptions(files, opts('GPU')); }
      catch (e) { landmarker = await HandLandmarker.createFromOptions(files, opts('CPU')); }
    }
    status(t('cam'));
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    $('stage').style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
    $('overlay').hidden = true;
    running = true; prev = performance.now(); fps = 0; lastVideoTime = -1;
    $('stop').hidden = false; setMode(mode);
    requestAnimationFrame(loop);
  } catch (e) {
    const name = e && e.name;
    status(name === 'NotAllowedError' || name === 'SecurityError' ? t('denied')
      : name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError' ? t('nocam') : (landmarker ? t('nocam') : t('fail')), true);
    console.error(e);
  } finally { btn.disabled = false; }
}

function stop(reasonKey) {
  running = false;
  if (stream) stream.getTracks().forEach((tr) => tr.stop());
  stream = null; video.srcObject = null;
  pinchLock = {}; fistLock = {}; quitSince = 0;
  $('overlay').hidden = false;
  const btn = $('start'); btn.dataset.state = 'restart'; btn.textContent = t('restart');
  status(t(reasonKey || 'stopped'));
  $('stop').hidden = $('undo').hidden = $('clear').hidden = true;
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

function isFist(lm) {
  const w = lm[WRIST];
  return FINGER_TIPS.every((tip, i) => Math.hypot(lm[tip].x - w.x, lm[tip].y - w.y) < Math.hypot(lm[FINGER_PIPS[i]].x - w.x, lm[FINGER_PIPS[i]].y - w.y));
}

function hud(lines) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `600 ${Math.max(14, Math.round(canvas.width * 0.022))}px JetBrains Mono, monospace`;
  lines.forEach((l, i) => {
    const y = 12 + i * Math.round(canvas.width * 0.032);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, y - 2, ctx.measureText(l).width + 10, Math.round(canvas.width * 0.028));
    ctx.fillStyle = COL.fixed; ctx.fillText(l, 13, y);
  });
}

function loop(now) {
  if (!running) return;
  const w = canvas.width, h = canvas.height;
  // Image en miroir (comme cv2.flip(frame, 1))
  ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, w, h); ctx.restore();

  let res = null;
  if (video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; res = landmarker.detectForVideo(video, now); loop.last = res; }
  else res = loop.last;
  const hands = (res && res.landmarks) || [];
  const P = (p) => [(1 - p.x) * w, p.y * h];   // coordonnées en miroir, en pixels

  if (mode === 2) cubes.forEach(([cx, cy, cs]) => drawCube(cx, cy, cs, COL.fixed));

  let fingerOnQuit = false;
  const seen = new Set();
  const grid = Math.max(Math.round(w * GRID_RATIO), 1), pinchTh = w * PINCH_RATIO;
  const minS = Math.round(w * MIN_SIZE_RATIO), maxS = Math.round(w * MAX_SIZE_RATIO);
  button = mode === 1 ? quitRect(w, h) : offRect(w, h);

  hands.forEach((lm, hi) => {
    const id = (res.handedness && res.handedness[hi] && res.handedness[hi][0] && res.handedness[hi][0].categoryName) || 'h' + hi;
    seen.add(id);
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 2;
    CONNECTIONS.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...P(lm[a])); ctx.lineTo(...P(lm[b])); ctx.stroke(); });
    ctx.fillStyle = COL.joint;
    lm.forEach((p) => { const [x, y] = P(p); ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); });
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

  const inst = 1000 / Math.max(now - prev, 1); fps = fps ? 0.9 * fps + 0.1 * inst : inst; prev = now;
  hud(mode === 2 ? [`${t('cubes')} : ${cubes.length}`, `FPS : ${fps.toFixed(0)}`] : [`${t('hands')} : ${hands.length}`, `FPS : ${fps.toFixed(0)}`]);
  requestAnimationFrame(loop);
}

// Clic sur le bouton dessiné dans l'image (coordonnées canvas)
canvas.addEventListener('click', (e) => {
  if (!running) return;
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width, y = ((e.clientY - r.top) / r.height) * canvas.height;
  if (inside(x, y, button)) stop('stopped');
});
window.addEventListener('keydown', (e) => {
  if (!running || e.target.closest('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'q') stop('stopped');
  else if (k === 'z' && mode === 2) cubes.pop();
  else if (k === 'c' && mode === 2) cubes = [];
});
$('start').addEventListener('click', start);
$('stop').addEventListener('click', () => stop('stopped'));
$('undo').addEventListener('click', () => cubes.pop());
$('clear').addEventListener('click', () => (cubes = []));
document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(+b.dataset.mode)));
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
window.addEventListener('pagehide', () => stream && stream.getTracks().forEach((tr) => tr.stop()));
setLang(lang); setMode(2);

// Hook de test (sans effet en usage normal)
window.__visionDemo = { getState: () => ({ running, mode, cubes: cubes.length, fps }), ready: () => !!landmarker };
