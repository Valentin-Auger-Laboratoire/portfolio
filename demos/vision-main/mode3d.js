// =====================================================================
//  Étape 3 : monde 3D construit avec les deux mains (ou à la souris)
//  Main droite = construction (pince pouce + index : poser / tracer ;
//  pince pouce + majeur : retirer). Main gauche = vue (pince + déplacer :
//  tourner ; poing + monter / descendre : zoom). Palette touchée du bout de l'index.
// =====================================================================
import { Monde, PALETTE, TAILLE, camera, viser, facesVisibles, eclairage, exporterOBJ, exporterSTL, miroirX, bornerTangage, bornerDistance, dansGrille } from './voxels.js';

const PINCE = 0.055, PINCE_RELACHE = 0.075;     // seuils (fraction de la largeur), avec hystérésis
const SURVOL_MS = 450;

export function creerMode3D(app) {
  const monde = new Monde();
  const vue = { lacet: 0.75, tangage: 0.6, distance: 34 };
  const etat = { couleur: 0, style: 'plein', symetrie: false, rotation: false, vise: null, plan: null, survol: null, survolDepuis: 0, souris: null, gaucher: false, mains: [] };
  const verrous = {};   // par main : pinceIndex, pinceMajeur, saisie
  try { const s = localStorage.getItem('vision3d-auto'); if (s) monde.depuisJSON(s); } catch (e) {}
  const sauverAuto = () => { try { localStorage.setItem('vision3d-auto', monde.versJSON()); } catch (e) {} };

  const cam = () => camera({ ...vue, largeur: app.canvas.width, hauteur: app.canvas.height });

  function palette(w, h) {
    const n = PALETTE.length, s = Math.round(Math.min(w * 0.055, h * 0.075)), g = Math.round(s * 0.25);
    const x0 = Math.round((w - (n * s + (n - 1) * g)) / 2), y0 = Math.round(h * 0.03);
    return PALETTE.map((p, i) => ({ i, r: [x0 + i * (s + g), y0, x0 + i * (s + g) + s, y0 + s] }));
  }
  const dedans = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

  // Intersection du rayon avec le plan de dessin verrouillé (axe a, coordonnée c)
  function caseDansPlan(r, plan) {
    const { a, c } = plan; const d = r.d[a]; if (Math.abs(d) < 1e-6) return null;
    const t = (c + 0.5 - r.o[a]) / d; if (t <= 0) return null;
    const p = [0, 1, 2].map((k) => r.o[k] + r.d[k] * t); p[a] = c + 0.5;
    const cell = p.map(Math.floor); cell[a] = c;
    return dansGrille(...cell) ? cell : null;
  }

  function poser(cell) {
    if (!cell || monde.a(...cell)) return false;
    monde.ajouter(...cell, etat.couleur);
    if (etat.symetrie) monde.ajouter(miroirX(cell[0]), cell[1], cell[2], etat.couleur);
    return true;
  }
  function retirer(cell) {
    if (!cell) return;
    const geste = !monde._geste; if (geste) monde.debutGeste();
    monde.retirer(...cell);
    if (etat.symetrie) monde.retirer(miroirX(cell[0]), cell[1], cell[2]);
    if (geste) monde.finGeste();
  }

  // ---------- gestes ----------
  function traiterMains(res, now) {
    const w = app.canvas.width, h = app.canvas.height;
    const lms = (res && res.landmarks) || [];
    const P = (p) => [(1 - p.x) * w, p.y * h];
    // Rôles selon la position à l'écran (image en miroir) : la main la plus à droite construit,
    // l'autre tourne la vue. Plus fiable que l'étiquette droite/gauche du modèle. Bouton pour inverser.
    const vraies = lms.map((lm) => ({ lm, x: 1 - lm[0].x }));
    let constr = null, vueM = null;
    if (vraies.length === 1) constr = vraies[0];
    else if (vraies.length >= 2) {
      const tri = [...vraies].sort((a, b) => b.x - a.x);
      [constr, vueM] = etat.gaucher ? [tri[tri.length - 1], tri[0]] : [tri[0], tri[tri.length - 1]];
    }
    etat.mains = vraies.map((m) => ({ ...m, role: m === constr ? 'construction' : 'vue' }));
    etat.vise = null;

    if (constr) {
      const lm = constr.lm, id = 'c';
      const v = verrous[id] || (verrous[id] = {});
      const [ix, iy] = P(lm[8]), [tx, ty] = P(lm[4]), [mx, my] = P(lm[12]);
      const dI = Math.hypot(ix - tx, iy - ty) / w, dM = Math.hypot(mx - tx, my - ty) / w;
      // le curseur est le milieu pouce-index : il ne saute pas quand on pince
      const cx = (ix + tx) / 2, cy = (iy + ty) / 2;
      etat.curseur = [cx, cy];
      // palette
      const sw = palette(w, h).find((s) => dedans(ix, iy, s.r));
      if (sw) { if (etat.survol !== sw.i) { etat.survol = sw.i; etat.survolDepuis = now; } else if (now - etat.survolDepuis > SURVOL_MS) etat.couleur = sw.i; }
      else etat.survol = null;
      const c = cam(), r = c.rayon(cx, cy);
      etat.vise = viser(monde, r);
      // pince index : poser puis tracer dans un plan
      const pinceI = v.pinceI ? dI < PINCE_RELACHE : dI < PINCE;
      if (pinceI && !sw) {
        if (!v.pinceI) {
          monde.debutGeste();
          const pose = etat.vise && etat.vise.pose;
          if (pose) { poser(pose); const n = etat.vise.normale || [0, 1, 0]; const a = n[0] ? 0 : n[1] ? 1 : 2; etat.plan = { a, c: pose[a] }; }
        } else if (etat.plan) poser(caseDansPlan(r, etat.plan));
      } else if (v.pinceI) { monde.finGeste(); etat.plan = null; sauverAuto(); }
      v.pinceI = pinceI && !sw;
      // pince majeur : retirer le cube visé (un par pince)
      const pinceM = v.pinceM ? dM < PINCE_RELACHE : dM < PINCE;
      if (pinceM && !v.pinceM && !pinceI && etat.vise && etat.vise.touche) { retirer(etat.vise.touche); sauverAuto(); }
      v.pinceM = pinceM;
    } else { if (verrous.c && verrous.c.pinceI) { monde.finGeste(); sauverAuto(); } verrous.c = {}; etat.plan = null; etat.curseur = null; }

    if (vueM) {
      const lm = vueM.lm, v = verrous.v || (verrous.v = {});
      const [ix, iy] = P(lm[8]), [tx, ty] = P(lm[4]);
      const d = Math.hypot(ix - tx, iy - ty) / w;
      const pince = v.pince ? d < PINCE_RELACHE : d < PINCE;
      const poing = app.estPoing(lm);
      const cx = (ix + tx) / 2, cy = (iy + ty) / 2;
      if (pince) {
        if (v.prec) { vue.lacet -= ((cx - v.prec[0]) / w) * 4.0; vue.tangage = bornerTangage(vue.tangage + ((cy - v.prec[1]) / h) * 2.5); }
        v.prec = [cx, cy];
      } else if (poing) {
        const [wx, wy] = P(lm[0]);
        if (v.precZ != null) vue.distance = bornerDistance(vue.distance * (1 + ((wy - v.precZ) / h) * 2.2));
        v.precZ = wy; v.prec = null;
      } else { v.prec = null; v.precZ = null; }
      v.pince = pince; v.poing = poing;
    } else verrous.v = {};
  }

  // ---------- rendu ----------
  function dessiner(ctx, now, avecVideo) {
    if (etat.rotation) { const dt = etat.tPrec ? Math.min(now - etat.tPrec, 100) : 16; vue.lacet += dt * 0.00025; }
    etat.tPrec = now;
    const w = app.canvas.width, h = app.canvas.height, c = cam();
    if (avecVideo) { ctx.fillStyle = 'rgba(8,10,14,0.55)'; ctx.fillRect(0, 0, w, h); }
    else { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#15171c'); g.addColorStop(1, '#0b0c0f'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    // sol
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    const seg = (a, b) => { const p = c.projeter(a), q = c.projeter(b); if (p[2] > 0.1 && q[2] > 0.1) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } };
    for (let i = 0; i <= TAILLE.x; i++) seg([i, 0, 0], [i, 0, TAILLE.z]);
    for (let k = 0; k <= TAILLE.z; k++) seg([0, 0, k], [TAILLE.x, 0, k]);
    if (etat.symetrie) { ctx.strokeStyle = 'rgba(200,16,46,.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); seg([TAILLE.x / 2, 0, 0], [TAILLE.x / 2, 0, TAILLE.z]); seg([TAILLE.x / 2, 0, 0], [TAILLE.x / 2, 4, 0]); ctx.setLineDash([]); }
    // axes (x rouge, y vert, z bleu) au coin
    ctx.lineWidth = 2;
    [[[2, 0, 0], '#e5484d'], [[0, 2, 0], '#4fc46a'], [[0, 0, 2], '#3e8ef7']].forEach(([e, col]) => { ctx.strokeStyle = col; seg([0, 0.01, 0], e); });
    // cubes
    const neon = etat.style === 'neon';
    for (const f of facesVisibles(monde, c)) {
      const hex = PALETTE[f.c].hex, k = eclairage(f.n);
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]); ctx.closePath();
      if (neon) {
        ctx.fillStyle = `rgba(${rgb.join(',')},0.10)`; ctx.fill();
        ctx.shadowColor = hex; ctx.shadowBlur = 10; ctx.strokeStyle = hex; ctx.lineWidth = 1.6; ctx.stroke(); ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = `rgb(${rgb.map((v) => Math.round(v * k)).join(',')})`; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // case visée
    const v = etat.vise;
    if (v && v.pose && !(verrous.c && verrous.c.pinceM)) {
      cubeFil(ctx, c, v.pose, PALETTE[etat.couleur].hex, [5, 4]);
      if (etat.symetrie) cubeFil(ctx, c, [miroirX(v.pose[0]), v.pose[1], v.pose[2]], PALETTE[etat.couleur].hex, [2, 4]);
    }
    if (v && v.touche) cubeFil(ctx, c, v.touche, 'rgba(255,255,255,0.55)', [2, 3]);
    // palette (seulement avec la caméra)
    if (avecVideo) palette(w, h).forEach(({ i, r }) => {
      ctx.fillStyle = PALETTE[i].hex; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      ctx.lineWidth = i === etat.couleur ? 4 : 1.5; ctx.strokeStyle = i === etat.couleur ? '#fff' : 'rgba(255,255,255,.35)';
      ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      if (etat.survol === i && i !== etat.couleur) { const p = Math.min((now - etat.survolDepuis) / SURVOL_MS, 1); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(r[0], r[3] + 4, (r[2] - r[0]) * p, 4); }
    });
    // curseur et rôles des mains
    if (etat.curseur) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(etat.curseur[0], etat.curseur[1], 9, 0, 7); ctx.stroke(); }
    for (const m of etat.mains) {
      const [x, y] = [(1 - m.lm[0].x) * w, m.lm[0].y * h];
      ctx.font = `600 ${Math.round(w * 0.018)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = m.role === 'construction' ? '#38d9f5' : '#f2c230';
      ctx.fillText(app.t(m.role === 'construction' ? 'roleBuild' : 'roleView'), x, y + 28);
    }
  }

  function cubeFil(ctx, c, [x, y, z], col, dash) {
    const P = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((v) => c.projeter([x + v[0], y + v[1], z + v[2]]));
    if (P.some((p) => p[2] <= 0.1)) return;
    ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = 2;
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke(); });
    ctx.setLineDash([]);
  }

  // ---------- souris ----------
  function brancherSouris(canvas, actif) {
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height]; };
    let drag = null;
    canvas.addEventListener('contextmenu', (e) => { if (actif()) e.preventDefault(); });
    canvas.addEventListener('pointerdown', (e) => { if (!actif()) return; drag = { p: pos(e), bouge: false, bouton: e.button, shift: e.shiftKey }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!actif()) return;
      const p = pos(e);
      if (drag) {
        const dx = p[0] - drag.p[0], dy = p[1] - drag.p[1];
        if (Math.hypot(dx, dy) > 4) drag.bouge = true;
        if (drag.bouge) { vue.lacet -= (dx / canvas.width) * 4; vue.tangage = bornerTangage(vue.tangage + (dy / canvas.height) * 2.5); drag.p = p; }
      }
      if (!app.camEnMarche()) { etat.vise = viser(monde, cam().rayon(p[0], p[1])); etat.curseur = null; }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!actif() || !drag) return;
      if (!drag.bouge) {
        const p = pos(e), vv = viser(monde, cam().rayon(p[0], p[1]));
        if (drag.bouton === 2 || drag.shift) { if (vv.touche) retirer(vv.touche); }
        else if (vv.pose) { monde.debutGeste(); poser(vv.pose); monde.finGeste(); }
        etat.vise = viser(monde, cam().rayon(p[0], p[1])); sauverAuto();
      }
      drag = null;
    });
    canvas.addEventListener('wheel', (e) => { if (!actif()) return; e.preventDefault(); vue.distance = bornerDistance(vue.distance * (1 + Math.sign(e.deltaY) * 0.08)); }, { passive: false });
  }

  function telecharger(nom, texte, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texte], { type })); a.download = nom; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  return {
    monde, vue, etat, traiterMains, dessiner, brancherSouris,
    annuler() { monde.annuler(); sauverAuto(); },
    vider() { monde.vider(); sauverAuto(); },
    style() { etat.style = etat.style === 'plein' ? 'neon' : 'plein'; return etat.style; },
    vueInitiale() { Object.assign(vue, { lacet: 0.75, tangage: 0.6, distance: 34 }); },
    symetrie() { etat.symetrie = !etat.symetrie; return etat.symetrie; },
    rotation() { etat.rotation = !etat.rotation; return etat.rotation; },
    exporterSTL() { const e = exporterSTL(monde, { taille: 10 }); telecharger('construction.stl', e.stl, 'model/stl'); return e; },
    exporter() { const e = exporterOBJ(monde, { taille: 10, nom: 'construction' }); telecharger('construction.obj', e.obj, 'text/plain'); setTimeout(() => telecharger('construction.mtl', e.mtl, 'text/plain'), 300); return e; },
    exemple() {   // petite maquette pour montrer le rendu : une maison
      monde.debutGeste();
      for (let x = 5; x <= 10; x++) for (let z = 5; z <= 9; z++) for (let y = 0; y < 4; y++) {
        const bord = x === 5 || x === 10 || z === 5 || z === 9; if (!bord) continue;
        if (z === 9 && x === 7 && y < 2) continue;              // porte
        if ((x === 5 || x === 10) && z === 7 && y === 2) continue; // fenêtres
        monde.ajouter(x, y, z, 2);
      }
      for (let k = 0; k < 4; k++) for (let x = 5 + k; x <= 10 - k; x++) for (let z = 4; z <= 10; z++) if (x === 5 + k || x === 10 - k) monde.ajouter(x, 4 + k, z, 1);
      for (let z = 4; z <= 10; z++) for (let x = 7; x <= 8; x++) monde.ajouter(x, 7, z, 1);
      for (let x = 2; x <= 13; x++) monde.ajouter(x, 0, 12, 4);
      monde.ajouter(12, 0, 7, 3); monde.ajouter(12, 1, 7, 3); monde.ajouter(12, 2, 7, 4); monde.ajouter(11, 2, 7, 4); monde.ajouter(13, 2, 7, 4); monde.ajouter(12, 3, 7, 4); monde.ajouter(12, 2, 6, 4); monde.ajouter(12, 2, 8, 4);
      monde.finGeste(); sauverAuto();
    },
  };
}
