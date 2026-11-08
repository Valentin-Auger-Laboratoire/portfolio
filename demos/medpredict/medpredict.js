/* MedPredict : portage JavaScript du moteur Python (medpredict/fiabilite.py). */
(function (racine) {
  'use strict';

  function gamma(z) { // Lanczos, assez précis pour Gamma(1 + 1/beta)
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  const fiabilite = (t, b, e) => Math.exp(-Math.pow(t / e, b));
  const tauxDefaillance = (t, b, e) => (b / e) * Math.pow(t / e, b - 1);
  const mtbf = (b, e) => e * gamma(1 + 1 / b);
  const dureeBp = (p, b, e) => e * Math.pow(-Math.log(1 - p / 100), 1 / b);
  const disponibilite = (m, mttr) => m / (m + mttr);
  const regime = (b) => (b < 0.95 ? 'jeunesse' : b <= 1.05 ? 'aleatoire' : 'usure');

  // Maximum de vraisemblance avec censure à droite (dichotomie sur la dérivée profilée)
  function ajusterWeibull(durees, panne) {
    const r = panne.filter(Boolean).length;
    if (r < 2) throw new Error('Il faut au moins deux pannes observées.');
    const tmax = Math.max(...durees);
    const lnt = durees.map(Math.log);
    let s = 0; for (let i = 0; i < durees.length; i++) if (panne[i]) s += lnt[i];
    const moy = s / r;
    const g = (b) => {
      let num = 0, den = 0;
      for (let i = 0; i < durees.length; i++) { const tb = Math.pow(durees[i] / tmax, b); num += tb * lnt[i]; den += tb; }
      return num / den - 1 / b - moy;
    };
    let lo = 0.05, hi = 50;
    for (let k = 0; k < 200; k++) { const m = 0.5 * (lo + hi); if (g(m) > 0) hi = m; else lo = m; }
    const beta = 0.5 * (lo + hi);
    let somme = 0; for (const t of durees) somme += Math.pow(t / tmax, beta);
    return { beta, eta: tmax * Math.pow(somme / r, 1 / beta) };
  }

  function kaplanMeier(durees, panne) {
    const idx = durees.map((t, i) => i).sort((a, b) => durees[a] - durees[b] || (panne[b] - panne[a]));
    const n = idx.length; let s = 1; const xs = [], ys = [];
    idx.forEach((i, k) => { if (panne[i]) { s *= 1 - 1 / (n - k); xs.push(durees[i]); ys.push(s); } });
    return { xs, ys };
  }

  function integraleR(T, b, e, n = 2000) {
    T = Math.min(T, e * Math.pow(40, 1 / b));
    const h = T / n; let s = fiabilite(0, b, e) + fiabilite(T, b, e);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fiabilite(i * h, b, e);
    return s * h / 3;
  }

  function coutHoraire(T, b, e, cp, cc) {
    const R = fiabilite(T, b, e);
    return (cp * R + cc * (1 - R)) / integraleR(T, b, e);
  }

  function intervalleOptimal(b, e, cp, cc) {
    const sans = cc / mtbf(b, e);
    if (b <= 1 || cc <= cp) return null;
    let meilleur = 0, cmin = Infinity; const grille = [];
    for (let i = 0; i < 300; i++) grille.push((0.02 + i * (3 - 0.02) / 299) * e);
    grille.forEach((T, i) => { const c = coutHoraire(T, b, e, cp, cc); if (c < cmin) { cmin = c; meilleur = i; } });
    let a = grille[Math.max(meilleur - 1, 0)], z = grille[Math.min(meilleur + 1, 299)];
    const phi = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 80; k++) {
      const c = z - phi * (z - a), d = a + phi * (z - a);
      if (coutHoraire(c, b, e, cp, cc) < coutHoraire(d, b, e, cp, cc)) z = d; else a = c;
    }
    const T = 0.5 * (a + z), cT = coutHoraire(T, b, e, cp, cc);
    return cT >= sans ? null : { T, cout: cT, sans };
  }

  // Générateur pseudo-aléatoire reproductible (mulberry32)
  function rng(graine) {
    let a = graine >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Parc fictif : durées de vie Weibull, appareils mis en service à des dates différentes
  function genererParc(n, beta, eta, fenetre, graine) {
    const u = rng(graine); const durees = [], panne = [];
    for (let i = 0; i < n; i++) {
      const vie = eta * Math.pow(-Math.log(1 - u()), 1 / beta);
      const obs = u() * fenetre;
      if (vie <= obs) { durees.push(Math.max(1, Math.round(vie))); panne.push(true); }
      else { durees.push(Math.max(1, Math.round(obs))); panne.push(false); }
    }
    return { durees, panne };
  }

  function lireCSV(texte) {
    const durees = [], panne = [], erreurs = [];
    texte.split(/\r?\n/).forEach((ligne, i) => {
      const sep = ligne.includes(';') ? ';' : ligne.includes('\t') ? '\t' : ',';
      const c = ligne.split(sep).map((x) => x.trim());
      if (!ligne.trim() || (i === 0 && isNaN(parseFloat(c[1])))) return;
      const h = parseFloat((c[1] || '').replace(',', '.'));
      const etat = (c[2] || '').toLowerCase();
      if (!(h > 0) || !/^(panne|en_service|failed|running)$/.test(etat)) { erreurs.push(i + 1); return; }
      durees.push(h); panne.push(etat === 'panne' || etat === 'failed');
    });
    return { durees, panne, erreurs };
  }

  // Les 40 pousse-seringues fictifs du dépôt (donnees/pousse-seringues.csv)
  const EXEMPLE = 'appareil,heures,etat\nPS-01,1835,panne\nPS-02,2824,en_service\nPS-03,2354,en_service\nPS-04,3566,panne\nPS-05,2051,en_service\nPS-06,4322,panne\nPS-07,4684,panne\nPS-08,743,panne\nPS-09,4035,panne\nPS-10,3446,panne\nPS-11,5275,panne\nPS-12,3349,en_service\nPS-13,3782,en_service\nPS-14,2963,panne\nPS-15,1930,panne\nPS-16,3237,panne\nPS-17,2405,panne\nPS-18,3746,en_service\nPS-19,16,en_service\nPS-20,4292,panne\nPS-21,4674,en_service\nPS-22,2939,en_service\nPS-23,3976,panne\nPS-24,841,en_service\nPS-25,4685,panne\nPS-26,4547,panne\nPS-27,529,en_service\nPS-28,3224,en_service\nPS-29,2818,panne\nPS-30,2828,en_service\nPS-31,4185,panne\nPS-32,3749,en_service\nPS-33,3325,panne\nPS-34,4447,panne\nPS-35,2685,panne\nPS-36,5517,panne\nPS-37,1442,en_service\nPS-38,1898,panne\nPS-39,213,en_service\nPS-40,2109,panne';

  const api = { gamma, fiabilite, tauxDefaillance, mtbf, dureeBp, disponibilite, regime, ajusterWeibull, kaplanMeier,
    coutHoraire, intervalleOptimal, genererParc, lireCSV, rng, EXEMPLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.MedPredict = api;
})(typeof window !== 'undefined' ? window : globalThis);
