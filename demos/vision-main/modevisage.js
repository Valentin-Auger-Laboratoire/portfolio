// =====================================================================
//  Étape 5 : maillage du visage (478 points) et humeur affichée en haut
//  Le modèle MediaPipe Face Landmarker donne les points et 52 coefficients
//  d'expression ; humeur.js en déduit l'humeur par des règles.
// =====================================================================
import { FaceLandmarker } from './lib/vision_bundle.mjs';
import { versObjet, humeur, Lisseur, corriger, indices, moyenneRepos, HUMEURS, LIBELLES, COULEURS } from './humeur.js';

export function creerModeVisage(app) {
  const etat = { res: null, h: null, repos: null, calib: null, ind: null, visages: 0 };
  const lisseur = new Lisseur(0.25, 350);
  try { const r = JSON.parse(localStorage.getItem('visage-repos') || 'null'); if (r && typeof r === 'object') etat.repos = r; } catch (e) {}

  function traiter(res, now) {
    etat.res = res;
    const bs = res && res.faceBlendshapes && res.faceBlendshapes[0];
    etat.visages = (res && res.faceLandmarks && res.faceLandmarks.length) || 0;
    if (!bs) { etat.h = null; return; }
    const brut = versObjet(bs.categories);
    if (etat.calib) {
      etat.calib.liste.push(brut);
      if (now - etat.calib.debut > 2000) { etat.repos = moyenneRepos(etat.calib.liste); etat.calib = null; try { localStorage.setItem('visage-repos', JSON.stringify(etat.repos)); } catch (e) {} }
    }
    const b = corriger(brut, etat.repos);
    const h = humeur(b);
    etat.h = lisseur.pousser(h.p, now);
    etat.ind = indices(b);
  }

  function relier(ctx, pts, connexions, col, lw) {
    const w = app.canvas.width, h = app.canvas.height;
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (const { start, end } of connexions) {
      const a = pts[start], b = pts[end]; if (!a || !b) continue;
      ctx.moveTo((1 - a.x) * w, a.y * h); ctx.lineTo((1 - b.x) * w, b.y * h);
    }
    ctx.stroke();
  }

  function dessiner(ctx, now) {
    const w = app.canvas.width, h = app.canvas.height;
    const faces = (etat.res && etat.res.faceLandmarks) || [];
    for (const pts of faces) {
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_TESSELATION, 'rgba(80,230,120,0.45)', 1);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, 'rgba(120,255,160,0.9)', 1.6);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_LIPS, 'rgba(120,255,160,0.9)', 1.6);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, 'rgba(120,255,160,0.9)', 1.6);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, 'rgba(120,255,160,0.9)', 1.6);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, 'rgba(120,255,160,0.9)', 1.6);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, 'rgba(120,255,160,0.9)', 1.6);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, '#ffffff', 1.6);
      relier(ctx, pts, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, '#ffffff', 1.6);
    }
    // bandeau d'humeur en haut
    const bh = Math.round(h * 0.09);
    ctx.fillStyle = 'rgba(12,12,13,.78)'; ctx.fillRect(0, 0, w, bh);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    let txt, col;
    if (etat.calib) { txt = app.t('calibrating'); col = '#f2c230'; }
    else if (!faces.length) { txt = app.t('noFace'); col = '#9b9b9f'; }
    else { const hm = etat.h ? etat.h.humeur : 'neutre'; txt = app.t('moodLabel') + ' : ' + LIBELLES[app.lang()][hm].toUpperCase() + ' · ' + Math.round((etat.h ? etat.h.p[hm] : 1) * 100) + ' %'; col = COULEURS[hm]; }
    ctx.font = `700 ${Math.round(bh * 0.42)}px Inter, sans-serif`; ctx.fillStyle = col; ctx.fillText(txt, w / 2, bh / 2);
    ctx.fillStyle = col; ctx.fillRect(0, bh - 3, w, 3);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  }

  return {
    etat, traiter, dessiner,
    calibrer(now) { etat.calib = { debut: now, liste: [] }; },
    oublierCalibration() { etat.repos = null; try { localStorage.removeItem('visage-repos'); } catch (e) {} },
    HUMEURS, LIBELLES, COULEURS,
  };
}
