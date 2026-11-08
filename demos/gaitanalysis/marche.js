/* GaitAnalysis : portage JavaScript du moteur Python (gaitanalysis/marche.py). */
(function (racine) {
  'use strict';
  const G = 9.81;
  const ARTICULATIONS = ['hanche', 'genou', 'cheville'];
  const ROM_REFERENCE = { hanche: [35, 50], genou: [55, 70], cheville: [20, 35] };

  const mod1 = (x) => x - Math.floor(x);
  const bosse = (phi, c, l) => { let s = 0; for (const k of [-1, 0, 1]) s += Math.exp(-0.5 * Math.pow((phi - c + k) / l, 2)); return s; };

  function gabarit(art, phi, raideur = 1) {
    phi = mod1(phi);
    if (art === 'hanche') return 10 + 20 * Math.cos(2 * Math.PI * phi) + 3 * Math.cos(4 * Math.PI * phi);
    if (art === 'genou') return 3 + 14 * bosse(phi, 0.15, 0.06) + 58 * raideur * bosse(phi, 0.72, 0.09);
    if (art === 'cheville') return 2 + 10 * bosse(phi, 0.45, 0.09) - 18 * bosse(phi, 0.63, 0.05);
    throw new Error(art);
  }

  const SCENARIOS = {
    normal: {}, genou_raide_droit: { raideur: 0.55 }, variabilite: { cv: 0.08 },
    instable: { balancement: 0.04, largeur: 0.10, cv: 0.05 },
  };

  function rng(graine) {
    let a = graine >>> 0;
    const u = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let reserve = null;
    u.normal = () => { if (reserve !== null) { const r = reserve; reserve = null; return r; } let x, y, s; do { x = 2 * u() - 1; y = 2 * u() - 1; s = x * x + y * y; } while (!s || s >= 1); const m = Math.sqrt(-2 * Math.log(s) / s); reserve = y * m; return x * m; };
    return u;
  }

  function simuler(o = {}) {
    const p = Object.assign({ n: 20, duree: 1.1, fe: 100, cv: 0.02, raideur: 1, balancement: 0.02, largeur: 0.16, jambe: 0.9, bruit: 0, graine: 0 }, o);
    const r = rng(p.graine);
    const durees = []; for (let i = 0; i < p.n; i++) durees.push(Math.max(0.6, p.duree * (1 + p.cv * r.normal())));
    const att = [0]; durees.forEach((d) => att.push(att[att.length - 1] + d));
    const N = Math.floor(att[p.n] * p.fe), s = { t: new Float64Array(N), fe: p.fe, phase: new Float64Array(N) };
    ARTICULATIONS.forEach((a) => { s[a + '_droit'] = new Float64Array(N); s[a + '_gauche'] = new Float64Array(N); });
    s.com = new Float64Array(N);
    let i = 0;
    for (let k = 0; k < N; k++) {
      const t = k / p.fe; s.t[k] = t;
      while (i < p.n - 1 && t >= att[i + 1]) i++;
      const ph = i + (t - att[i]) / durees[i]; s.phase[k] = ph;
      ARTICULATIONS.forEach((a) => {
        s[a + '_droit'][k] = gabarit(a, ph, a === 'genou' ? p.raideur : 1) + (p.bruit ? p.bruit * r.normal() : 0);
        s[a + '_gauche'][k] = gabarit(a, ph + 0.5) + (p.bruit ? p.bruit * r.normal() : 0);
      });
      s.com[k] = p.balancement * Math.sin(2 * Math.PI * (ph - 0.25));
    }
    s.verite = { attaques: att.slice(0, -1), durees, largeur: p.largeur, jambe: p.jambe };
    return s;
  }

  function detecterAttaques(x, fe, dureeMin = 0.6) {
    const n = x.length, k = Math.max(3, (Math.floor(0.09 * fe)) | 1), h = k >> 1;
    const xl = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = -h; j <= h; j++) s += x[Math.min(n - 1, Math.max(0, i + j))]; xl[i] = s / k; }
    const tri = Array.from(xl).sort((a, b) => a - b), pc = (q) => tri[Math.min(n - 1, Math.round(q / 100 * (n - 1)))];
    const seuil = 0.5 * (pc(95) + pc(5)), ecart = Math.floor(dureeMin * fe), demi = Math.max(2, Math.floor(0.1 * fe));
    const pics = [];
    let i = demi;
    while (i < n - demi) {
      if (xl[i] >= xl[i - 1] && xl[i] > xl[i + 1] && xl[i] > seuil) {
        let j = i; for (let q = i; q < Math.min(n, i + (ecart >> 1)); q++) if (xl[q] > xl[j]) j = q;
        if (j >= demi && j < n - demi && (!pics.length || j - pics[pics.length - 1] >= ecart)) pics.push(j);
        i = j + (ecart >> 1);
      } else i++;
    }
    return pics.map((pk) => { // parabole par moindres carrés sur ± 100 ms
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, y0 = 0, y1 = 0, y2 = 0;
      for (let u = -demi; u <= demi; u++) { const y = xl[pk + u]; s0++; s1 += u; s2 += u * u; s3 += u ** 3; s4 += u ** 4; y0 += y; y1 += u * y; y2 += u * u * y; }
      // s1 = s3 = 0 par symétrie : y = a u² + b u + c
      const b = y1 / s2, a = (y2 - s2 * y0 / s0) / (s4 - s2 * s2 / s0);
      const dec = a < 0 ? Math.max(-demi, Math.min(demi, -b / (2 * a))) : 0;
      return (pk + dec) / fe;
    });
  }

  function romParCycle(sig, t, att) {
    const out = [];
    for (let c = 0; c + 1 < att.length; c++) {
      let mn = Infinity, mx = -Infinity, m = 0;
      for (let k = 0; k < t.length; k++) if (t[k] >= att[c] && t[k] < att[c + 1]) { m++; if (sig[k] < mn) mn = sig[k]; if (sig[k] > mx) mx = sig[k]; }
      if (m > 3) out.push(mx - mn);
    }
    return out;
  }
  const moyenne = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const ecartType = (a) => { const m = moyenne(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  const indiceSymetrie = (d, g) => Math.abs(d - g) / (0.5 * (d + g)) * 100;
  const margeStabilite = (com, v, bord, l) => bord - (com + v / Math.sqrt(G / l));

  function analyser(s) {
    const { t, fe } = s;
    const ad = detecterAttaques(s.hanche_droit, fe), ag = detecterAttaques(s.hanche_gauche, fe);
    const d = []; for (let i = 1; i < ad.length; i++) d.push(ad[i] - ad[i - 1]);
    const res = { attaquesDroit: ad, attaquesGauche: ag, dureeFoulee: moyenne(d), cv: ecartType(d) / moyenne(d) * 100, cadence: 120 / moyenne(d) };
    ARTICULATIONS.forEach((a) => {
      const rd = romParCycle(s[a + '_droit'], t, ad), rg = romParCycle(s[a + '_gauche'], t, ag);
      res[a] = { droit: moyenne(rd), gauche: moyenne(rg), symetrie: indiceSymetrie(moyenne(rd), moyenne(rg)), reference: ROM_REFERENCE[a] };
    });
    const w = s.verite.largeur, l = s.verite.jambe, n = t.length;
    const marge = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const v = (s.com[Math.min(n - 1, k + 1)] - s.com[Math.max(0, k - 1)]) / ((Math.min(n - 1, k + 1) - Math.max(0, k - 1)) / fe);
      marge[k] = w / 2 - Math.abs(s.com[k] + v / Math.sqrt(G / l));
    }
    const mos = [];
    for (let c = 0; c + 1 < ad.length; c++) { let m = Infinity; for (let k = 0; k < n; k++) if (t[k] >= ad[c] && t[k] < ad[c + 1] && marge[k] < m) m = marge[k]; mos.push(m); }
    res.marge = marge; res.mosMin = Math.min(...mos); res.mosMoy = moyenne(mos);
    return res;
  }

  const api = { gabarit, simuler, SCENARIOS, detecterAttaques, romParCycle, indiceSymetrie, margeStabilite, analyser, ARTICULATIONS, ROM_REFERENCE, rng, G };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Marche = api;
})(typeof window !== 'undefined' ? window : globalThis);
