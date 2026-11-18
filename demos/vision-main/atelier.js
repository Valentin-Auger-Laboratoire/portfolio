// =====================================================================
//  Atelier 3D : les pièces de la scène et ce que les mains leur font
//  - viser une pièce (rayon depuis le pointeur, boîte de la pièce)
//  - pincer = saisir : la pièce suit la main en 3D (profondeur par la taille
//    apparente de la main) et tourne comme la main
//  - deux mains qui pincent la même pièce : agrandir / réduire et tourner
//  - lâcher en tournant vite : la pièce continue de tourner sur elle-même
//  - lâcher sur la corbeille : la pièce est supprimée
//  Fonctionne aussi à la souris (glisser = tourner la pièce, molette = taille).
// =====================================================================
import { v3, q4, rayonPixel, projeterPixel, rayonBoite } from './m3d.js';
import { boite } from './formes.js';
import { Seuil, PINCE_ON, PINCE_OFF, vitesseAngulaire } from './gestes.js';

export const COULEURS = [[0.36, 0.85, 0.98], [0.78, 0.06, 0.18], [0.9, 0.9, 0.92], [0.55, 0.55, 0.6], [0.3, 0.77, 0.42], [0.95, 0.76, 0.19]];

export function creerAtelier() {
  const scene = { objets: [], tapis: { pos: [0, -0.2, -0.95], taille: 0.75 }, temps: 0 };
  const cam = { oeil: [0, 0, 0], q: q4.id(), fov: (50 * Math.PI) / 180 };
  let idSuivant = 1;
  const mains = {};               // par main : seuils, saisie
  let duo = null;                 // saisie à deux mains

  function ajouter(maillage, { nom = 'pièce', couleur = COULEURS[0], holo = false, taille = 0.18, pos = null } = {}) {
    if (!maillage.boite) maillage.boite = boite(maillage.positions);
    const n = scene.objets.length;
    const o = {
      id: idSuivant++, nom, maillage, couleur, holo, echelle: taille,
      pos: pos || [(n % 3 - 1) * 0.22, 0, -0.75 - Math.floor(n / 3) * 0.12],
      q: q4.mul(q4.axeAngle([0, 1, 0], 0.5), q4.axeAngle([1, 0, 0], 0.35)),
      rot: null,                    // rotation libre { axe, w } (rad/s)
      toupie: false,
    };
    scene.objets.push(o); return o;
  }
  function supprimer(o) { const i = scene.objets.indexOf(o); if (i >= 0) scene.objets.splice(i, 1); for (const k in mains) if (mains[k].saisie && mains[k].saisie.o === o) mains[k].saisie = null; if (duo && duo.o === o) duo = null; }

  // pièce sous le pixel (sx, sy) d'une vue l x h
  function viser(sx, sy, l, h) {
    const r = rayonPixel(sx, sy, l, h, cam.fov, cam.oeil, cam.q);
    let best = null;
    for (const o of scene.objets) {
      // rayon dans le repère de la pièce
      const qi = q4.conj(o.q), oL = v3.mul(q4.tourner(qi, v3.sub(r.o, o.pos)), 1 / o.echelle), dL = q4.tourner(qi, r.d);
      const t = rayonBoite({ o: oL, d: dL }, o.maillage.boite.min, o.maillage.boite.max);
      if (t != null) { const tm = t * o.echelle; if (!best || tm < best.t) best = { o, t: tm, r }; }
    }
    return best;
  }

  // Une image : `lues` = mains lues par gestes.lireMain (avec .id), vue l x h, t en ms
  // zones : { corbeille: [x0, y0, x1, y1] } en pixels de la vue
  function mettreAJour(lues, l, h, t, zones = {}) {
    const evts = [];
    const dt = mains._t ? Math.min((t - mains._t) / 1000, 0.1) : 0.016; mains._t = t;
    scene.temps = t / 1000;
    for (const o of scene.objets) { o.surbrillance = 0; o.cadre = null; }
    const vues = new Set();
    for (const m of lues) {
      m.id = String(m.id); vues.add(m.id);
      const s = mains[m.id] || (mains[m.id] = { pince: new Seuil(PINCE_ON, PINCE_OFF), saisie: null });
      const avant = s.pince.actif, pince = s.pince.maj(m.dPince);
      const qMonde = q4.mul(cam.q, m.q);
      const vise = viser(m.pointeur[0], m.pointeur[1], l, h);
      m.vise = vise && vise.o;
      if (!pince) s.ui = false;
      if (pince && !avant) {
        const bouton = (zones.boutons || []).find((b) => dans(m.pointeur, b.r));
        if (bouton) { s.ui = true; evts.push({ type: 'bouton', b: bouton }); }
        else if (vise && !duo) {
          const autre = Object.entries(mains).find(([k, x]) => k !== m.id && x && x.saisie && x.saisie.o === vise.o);
          if (autre) {     // seconde main sur la même pièce : saisie à deux mains
            const a = autre[1], pa = a.dernierPointeur;
            duo = { o: vise.o, ids: [autre[0], m.id], d0: Math.hypot(m.pointeur[0] - pa[0], m.pointeur[1] - pa[1]) || 1,
              ang0: Math.atan2(m.pointeur[1] - pa[1], m.pointeur[0] - pa[0]), e0: vise.o.echelle, q0: vise.o.q };
            a.saisie = null;
          } else {
            const centre = vise.o.pos, prof = v3.dot(v3.sub(centre, cam.oeil), q4.tourner(cam.q, [0, 0, -1]));
            const [cx, cy] = projeterPixel(centre, l, h, cam.fov, cam.oeil, cam.q);
            s.saisie = { o: vise.o, taille0: m.taille, prof0: prof, dec: [cx - m.pointeur[0], cy - m.pointeur[1]], qMain0: qMonde, qObj0: vise.o.q, hist: [] };
            vise.o.rot = null; evts.push({ type: 'saisie', o: vise.o });
          }
        }
      }
      if (!pince && avant && s.saisie) {
        const o = s.saisie.o;
        if (zones.corbeille && dans(m.pointeur, zones.corbeille)) { supprimer(o); evts.push({ type: 'supprime', o }); }
        else {
          // vitesse de rotation sur les 120 dernières ms : lancer la pièce en rotation
          const H = s.saisie.hist, b = H[H.length - 1], a = b && (H.find((x) => b.t - x.t <= 120) || H[0]);
          if (a && b.t - a.t > 30 && t - b.t < 150) { const v = vitesseAngulaire(a.q, b.q, (b.t - a.t) / 1000); if (v.w > 2.0) { o.rot = { axe: v.axe, w: Math.min(v.w, 12) }; evts.push({ type: 'lance', o, w: v.w }); } }
        }
        s.saisie = null;
      }
      if (!pince && duo && duo.ids.includes(m.id)) duo = null;
      s.dernierPointeur = m.pointeur;
      // pièce tenue : suit la main
      if (s.saisie && pince) {
        const g = s.saisie, o = g.o;
        const prof = Math.min(Math.max(g.prof0 * g.taille0 / Math.max(m.taille, 1), 0.2), 3);
        const sx = m.pointeur[0] + g.dec[0], sy = m.pointeur[1] + g.dec[1];
        const r = rayonPixel(sx, sy, l, h, cam.fov, cam.oeil, cam.q);
        const avantCam = q4.tourner(cam.q, [0, 0, -1]);
        o.pos = v3.add(r.o, v3.mul(r.d, prof / Math.max(v3.dot(r.d, avantCam), 0.2)));
        const dq = q4.mul(qMonde, q4.conj(g.qMain0));
        o.q = q4.norm(q4.mul(dq, g.qObj0));
        g.hist.push({ t, q: o.q }); while (g.hist.length > 12) g.hist.shift();
        o.cadre = zones.corbeille && dans(m.pointeur, zones.corbeille) ? [1, 0.25, 0.3, 0.9] : [1, 1, 1, 0.7];
      } else if (m.vise) { m.vise.surbrillance = 1; m.vise.cadre = [1, 1, 1, 0.35]; }
    }
    // deux mains
    if (duo) {
      const [a, b] = duo.ids.map((k) => mains[k] && mains[k].dernierPointeur);
      if (a && b && vues.has(duo.ids[0]) && vues.has(duo.ids[1])) {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        duo.o.echelle = Math.min(Math.max(duo.e0 * d / duo.d0, 0.03), 1.5);
        const axe = q4.tourner(cam.q, [0, 0, -1]);
        duo.o.q = q4.norm(q4.mul(q4.axeAngle(axe, ang - duo.ang0), duo.q0));
        duo.o.cadre = [1, 0.85, 0.3, 0.9];
      }
    }
    // mains disparues
    for (const k of Object.keys(mains)) if (k !== '_t' && !vues.has(k)) { if (mains[k].saisie) mains[k].saisie = null; mains[k].pince.actif = false; if (duo && duo.ids.includes(k)) duo = null; }
    // rotations libres et toupies
    for (const o of scene.objets) {
      const tenu = Object.values(mains).some((x) => x && x.saisie && x.saisie.o === o) || (duo && duo.o === o);
      if (tenu) continue;
      if (o.toupie) o.q = q4.norm(q4.mul(q4.axeAngle([0, 1, 0], 0.9 * dt), o.q));
      if (o.rot) { o.q = q4.norm(q4.mul(q4.axeAngle(o.rot.axe, o.rot.w * dt), o.q)); o.rot.w *= Math.exp(-0.35 * dt); if (o.rot.w < 0.15) o.rot = null; }
    }
    return evts;
  }
  const dans = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];

  return {
    scene, cam, ajouter, supprimer, viser, mettreAJour,
    tenu: () => Object.values(mains).some((x) => x && x.saisie) || !!duo,
    mains, // pour l'interface (pince réservée aux boutons)
    vider() { scene.objets.length = 0; duo = null; for (const k in mains) if (mains[k] && mains[k].saisie) mains[k].saisie = null; },
  };
}
