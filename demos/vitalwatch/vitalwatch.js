/* VitalWatch : portage JavaScript du moteur Python (vitalwatch/news2.py, simulation.py, moniteur.py). */
(function (racine) {
  'use strict';

  // --- NEWS2 (échelle 1 de SpO2) ---
  const pFr = (v) => (v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3);
  const pSpo2 = (v) => (v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0);
  const pPas = (v) => (v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : v <= 219 ? 0 : 3);
  const pFc = (v) => (v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3);
  const pTemp = (v) => (v <= 35 ? 3 : v <= 36 ? 1 : v <= 38 ? 0 : v <= 39 ? 1 : 2);
  function news2(fr, spo2, oxygene, pas, fc, alerte, temp) {
    const d = { fr: pFr(fr), spo2: pSpo2(spo2), oxygene: oxygene ? 2 : 0, pas: pPas(pas), fc: pFc(fc), conscience: alerte ? 0 : 3, temp: pTemp(temp) };
    return { score: Object.values(d).reduce((a, b) => a + b, 0), detail: d };
  }
  function niveau(score, detail) {
    if (score >= 7) return 'eleve';
    if (score >= 5) return 'moyen';
    if (Object.values(detail).some((v) => v === 3)) return 'basmoyen';
    return score >= 1 ? 'bas' : 'aucun';
  }
  const ORDRE = ['aucun', 'bas', 'basmoyen', 'moyen', 'eleve'];

  // --- Simulation ---
  function rng(graine) {
    let a = graine >>> 0;
    const u = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let r = null;
    u.normal = () => { if (r !== null) { const v = r; r = null; return v; } let x, y, s; do { x = 2 * u() - 1; y = 2 * u() - 1; s = x * x + y * y; } while (!s || s >= 1); const m = Math.sqrt(-2 * Math.log(s) / s); r = y * m; return x * m; };
    return u;
  }
  const BASE = { fc: 72, fr: 15, spo2: 97.5, pas: 122, temp: 36.9 };
  const BRUIT = { fc: 2, fr: 0.8, spo2: 0.4, pas: 3, temp: 0.05 };
  const rampe = (t, d, l) => Math.min(1, Math.max(0, (t - d) / l));
  function constantes(t, sc) {
    const v = Object.assign({}, BASE);
    if (sc === 'sepsis') { const k = rampe(t, 3600, 3 * 3600); Object.assign(v, { fc: 72 + 50 * k, fr: 15 + 13 * k, pas: 122 - 40 * k, temp: 36.9 + 2.2 * k, spo2: 97.5 - 4 * k }); }
    else if (sc === 'desaturation') { const k = rampe(t, 7200, 1200); v.spo2 = 97.5 - 9 * k; v.fr = 15 + 8 * k; }
    return v;
  }
  function simulerCapteur(o = {}) {
    const p = Object.assign({ scenario: 'stable', duree: 6 * 3600, periode: 10, graine: 0, decroche: [], consciencePerdueA: null }, o), u = rng(p.graine), msgs = [];
    for (let seq = 0, t = 0; t < p.duree; seq++, t += p.periode) {
      const v = constantes(t, p.scenario), m = {};
      for (const k in v) m[k] = v[k] + BRUIT[k] * u.normal();
      for (const [d, l] of p.decroche) if (t >= d && t < d + l) { m.spo2 = 40 + 30 * u(); m.fc = 30 * u(); }
      m.spo2 = Math.min(100, m.spo2);
      msgs.push(JSON.stringify({ patient: 'lit-12', seq, t, fc: Math.round(m.fc), fr: Math.round(m.fr), spo2: Math.round(m.spo2), pas: Math.round(m.pas),
        temp: Math.round(m.temp * 10) / 10, oxygene: false, conscience: p.consciencePerdueA === null || t < p.consciencePerdueA ? 'A' : 'V' }));
    }
    return msgs;
  }
  function reseau(msgs, o = {}) {
    const p = Object.assign({ perte: 0.02, latence: 0.4, gigue: 0.3, graine: 1, coupures: [] }, o), u = rng(p.graine), out = [];
    for (const m of msgs) {
      const t = JSON.parse(m).t;
      if (u() < p.perte || p.coupures.some(([a, d]) => t >= a && t < a + d)) continue;
      out.push([t + p.latence - p.gigue * Math.log(1 - u()), m]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  // --- Moniteur ---
  const SEUILS = [['fc', 'haut', 130, 120], ['fc', 'bas', 40, 45], ['spo2', 'bas', 90, 92], ['fr', 'haut', 25, 22], ['fr', 'bas', 8, 10], ['pas', 'bas', 90, 95], ['temp', 'haut', 39, 38.5]];
  const estArtefact = (m, prec) => (m.spo2 < 75 && m.fc < 35) || (prec !== null && prec.spo2 - m.spo2 > 15);
  const mediane = (a) => { const s = a.slice().sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : 0.5 * (s[k - 1] + s[k]); };

  class Moniteur {
    constructor(o = {}) {
      Object.assign(this, { periode: 10, persistance: 30, attente: 30, silence: 60, hysteresis: true, artefacts: true }, o);
      Object.assign(this, { journal: [], attendu: 0, tampon: new Map(), perdus: 0, enRetard: 0, recus: 0, precedent: null, dernierT: null,
        debut: new Map(), actives: new Set(), fin: new Map(), artefactDepuis: null, alarmeCapteur: false, fenetre: [], prochainNews: 300, niveau: 'aucun', historiqueNews: [], traites: [] });
    }
    log(t, genre, cle, val) { this.journal.push({ t, genre, cle, val }); }
    recevoir(arrivee, brut) {
      const m = JSON.parse(brut); this.recus++;
      if (m.seq < this.attendu) { this.enRetard++; return; }
      this.tampon.set(m.seq, m); this.vider(arrivee);
    }
    vider(maintenant) {
      for (;;) {
        if (this.tampon.has(this.attendu)) { const m = this.tampon.get(this.attendu); this.tampon.delete(this.attendu); this.traiter(m); this.attendu++; }
        else if (this.tampon.size && maintenant - this.attendu * this.periode > this.attente) { this.perdus++; this.attendu++; }
        else return;
      }
    }
    terminer(maintenant) { this.vider(maintenant + 1e9); }
    traiter(m) {
      const t = m.t;
      if (this.dernierT !== null && t - this.dernierT > this.silence) { this.log(this.dernierT + this.silence, 'technique', 'liaisonPerdue', Math.round(t - this.dernierT)); this.log(t, 'technique', 'liaisonOk'); }
      this.dernierT = t;
      const art = this.artefacts && estArtefact(m, this.precedent);
      m.artefact = art; this.traites.push(m);
      if (art) {
        if (this.artefactDepuis === null) this.artefactDepuis = t;
        if (!this.alarmeCapteur && t - this.artefactDepuis >= 20) { this.alarmeCapteur = true; this.log(t, 'technique', 'capteur'); }
      } else {
        if (this.alarmeCapteur) this.log(t, 'technique', 'capteurOk');
        this.artefactDepuis = null; this.alarmeCapteur = false; this.precedent = m;
        this.alarmes(m); this.fenetre.push(m);
      }
      while (this.fenetre.length && this.fenetre[0].t < t - 300) this.fenetre.shift();
      if (t >= this.prochainNews && this.fenetre.length) { this.news(t); this.prochainNews += 300; }
    }
    alarmes(m) {
      const t = m.t;
      for (const [p, sens, seuil, retour0] of SEUILS) {
        const cle = p + sens, v = m[p], retour = this.hysteresis ? retour0 : seuil;
        const dehors = sens === 'haut' ? v > seuil : v < seuil, rentre = sens === 'haut' ? v < retour || (!this.hysteresis && v <= seuil) : v > retour || (!this.hysteresis && v >= seuil);
        if (!this.actives.has(cle)) {
          if (dehors) { if (!this.debut.has(cle)) this.debut.set(cle, t); if (t - this.debut.get(cle) >= this.persistance) { this.actives.add(cle); this.log(t, 'clinique', 'alarme', [p, sens, v]); } }
          else this.debut.delete(cle);
        } else if (rentre) {
          if (!this.fin.has(cle)) this.fin.set(cle, t);
          if (t - this.fin.get(cle) >= this.persistance) { this.actives.delete(cle); this.fin.delete(cle); this.debut.delete(cle); this.log(t, 'clinique', 'finAlarme', [p, sens, v]); }
        } else this.fin.delete(cle);
      }
    }
    news(t) {
      const med = {}; for (const k of ['fr', 'spo2', 'pas', 'fc', 'temp']) med[k] = mediane(this.fenetre.map((x) => x[k]));
      const der = this.fenetre[this.fenetre.length - 1];
      const r = news2(med.fr, med.spo2, der.oxygene, med.pas, med.fc, der.conscience === 'A', med.temp), nv = niveau(r.score, r.detail);
      this.historiqueNews.push({ t, score: r.score, niveau: nv });
      if (ORDRE.indexOf(nv) > ORDRE.indexOf(this.niveau)) this.log(t, 'news2', 'news', [r.score, nv]);
      this.niveau = nv;
    }
  }
  function surveiller(livraisons, o) {
    const mon = new Moniteur(o);
    for (const [a, m] of livraisons) mon.recevoir(a, m);
    if (livraisons.length) mon.terminer(livraisons[livraisons.length - 1][0]);
    return mon;
  }

  const api = { news2, niveau, ORDRE, constantes, simulerCapteur, reseau, Moniteur, surveiller, estArtefact, SEUILS, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.VitalWatch = api;
})(typeof window !== 'undefined' ? window : globalThis);
