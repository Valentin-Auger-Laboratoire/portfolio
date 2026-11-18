// =====================================================================
//  Étape 4 : lecture de l'alphabet des signes (LSF ou ASL), lettre par lettre
//  Une lettre tenue 0,9 s est ajoutée au message. On peut enregistrer ses
//  propres exemples pour une lettre : ils comptent en plus des modèles.
// =====================================================================
import { reconnaitre, Stabilisateur, lettres, caracteristiques } from './signes.js';

export function creerModeSignes(app) {
  const etat = { alphabet: 'lsf', message: '', res: null, enreg: null, main: null };
  const stab = new Stabilisateur(900);
  const cleEx = (a) => 'signes-exemples-' + a;
  const charger = (a) => { try { const t = JSON.parse(localStorage.getItem(cleEx(a)) || '[]'); return Array.isArray(t) ? t.filter((e) => e && e.lettre && e.c && Array.isArray(e.c.v)) : []; } catch (e) { return []; } };
  const exemples = { lsf: charger('lsf'), asl: charger('asl') };
  const sauver = () => { try { localStorage.setItem(cleEx(etat.alphabet), JSON.stringify(exemples[etat.alphabet])); } catch (e) {} };

  function traiter(res, now) {
    const lms = (res && res.landmarks) || [], wl = (res && res.worldLandmarks) || [];
    if (!lms.length || !wl.length) { etat.res = null; stab.pousser(null, now); etat.main = null; return; }
    // la main la plus grande à l'écran (la plus proche)
    let k = 0, best = -1;
    lms.forEach((lm, i) => { const s = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y); if (s > best) { best = s; k = i; } });
    const lab = res.handedness && res.handedness[k] && res.handedness[k][0] ? res.handedness[k][0].categoryName : null;
    const vraie = lab === 'Left' ? 'droite' : lab === 'Right' ? 'gauche' : null;
    etat.main = lms[k];
    const r = reconnaitre(wl[k], lms[k], etat.alphabet, { main: null, exemples: exemples[etat.alphabet] });
    r.vraie = vraie;
    etat.res = r;
    if (etat.enreg) {
      exemples[etat.alphabet].push({ lettre: etat.enreg.lettre, c: caracteristiques(wl[k], lms[k], r.main === 'droite' ? 1 : -1) });
      if (++etat.enreg.n >= etat.enreg.total) { etat.enreg = null; sauver(); app.majSignes(); }
      return;
    }
    const lettre = r.lettre && r.confiance >= 0.55 ? r.lettre : null;
    const ok = stab.pousser(lettre, now);
    if (ok) { etat.message += ok; app.majSignes(); }
  }

  function dessiner(ctx, now) {
    const w = app.canvas.width, h = app.canvas.height;
    const r = etat.res;
    // panneau en haut à droite
    const pw = Math.round(w * 0.24), ph = Math.round(h * 0.33), x0 = w - pw - Math.round(w * 0.02), y0 = Math.round(h * 0.03);
    ctx.fillStyle = 'rgba(12,12,13,.78)'; ctx.fillRect(x0, y0, pw, ph);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#9b9b9f';
    ctx.font = `600 ${Math.round(h * 0.026)}px JetBrains Mono, monospace`;
    ctx.fillText(app.t('letterSeen') + ' · ' + etat.alphabet.toUpperCase(), x0 + 12, y0 + 10);
    const L = etat.enreg ? etat.enreg.lettre : r && r.lettre ? r.lettre : '–';
    ctx.font = `800 ${Math.round(ph * 0.5)}px Inter, sans-serif`; ctx.fillStyle = etat.enreg ? '#f2c230' : r && r.lettre ? '#4fc46a' : '#555';
    ctx.fillText(L, x0 + 12, y0 + ph * 0.18);
    if (r && !etat.enreg) {
      const c = r.confiance, bw = pw - 24, by = y0 + ph * 0.78;
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x0 + 12, by, bw, 8);
      ctx.fillStyle = c > 0.7 ? '#4fc46a' : c > 0.5 ? '#f2c230' : '#c8102e'; ctx.fillRect(x0 + 12, by, bw * c, 8);
      ctx.fillStyle = '#d0d0d3'; ctx.font = `500 ${Math.round(h * 0.024)}px JetBrains Mono, monospace`;
      ctx.fillText(app.t('confidence') + ' ' + Math.round(c * 100) + ' %', x0 + 12, by + 13);
      // progression de la validation (cercle)
      const p = stab.progression(now);
      if (p > 0 && r.lettre) { const cx = x0 + pw - ph * 0.22, cy = y0 + ph * 0.43, rr = ph * 0.14; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.stroke(); ctx.strokeStyle = '#4fc46a'; ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + p * 2 * Math.PI); ctx.stroke(); }
    }
    if (etat.enreg) {
      ctx.fillStyle = '#f2c230'; ctx.font = `600 ${Math.round(h * 0.026)}px Inter, sans-serif`;
      ctx.fillText(app.t('recording') + ' ' + etat.enreg.n + ' / ' + etat.enreg.total, x0 + 12, y0 + ph * 0.8);
    }
    // cadre autour de la main suivie
    if (etat.main) {
      const pts = etat.main.map((p) => app.px(p)), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const m = 18, a = Math.min(...xs) - m, b = Math.min(...ys) - m;
      ctx.strokeStyle = '#4fc46a'; ctx.lineWidth = 2; ctx.strokeRect(a, b, Math.max(...xs) + m - a, Math.max(...ys) + m - b);
    }
  }

  return {
    etat, traiter, dessiner,
    alphabet(a) { etat.alphabet = a; stab.pousser(null, 0); app.majSignes(); },
    espace() { etat.message += ' '; app.majSignes(); },
    retour() { etat.message = etat.message.slice(0, -1); app.majSignes(); },
    effacer() { etat.message = ''; app.majSignes(); },
    enregistrer(lettre) { etat.enreg = { lettre, n: 0, total: 25 }; },
    nbExemples() { const o = {}; for (const e of exemples[etat.alphabet]) o[e.lettre] = (o[e.lettre] || 0) + 1; return o; },
    oublier() { exemples[etat.alphabet] = []; sauver(); app.majSignes(); },
    lettres: () => lettres(etat.alphabet),
  };
}
