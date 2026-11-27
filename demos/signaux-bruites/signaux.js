/* =====================================================================
   Signaux bruités : simulation d'un système, bruit, estimation des paramètres
   Portage JavaScript du projet MATLAB (EPISEN, février 2026) :
     simu_sys.m, bruit.m, somme.m, analyse_automatique.m et l'IHM App Designer
   + version corrigée (novembre 2026) :
     moindres carrés non linéaires (Levenberg-Marquardt) pour l'exponentielle
     et la puissance, intervalles de confiance à 95 %, σ réellement estimé,
     test des résidus, tirages de Monte-Carlo.
   ===================================================================== */
(function (racine) {
  'use strict';

  const NOMS = ['Lineaire', 'Logarithmique', 'Exponentiel', 'Puissance'];

  /* ---------- hasard reproductible ---------- */
  function Hasard(graine) {
    let a = (graine >>> 0) || 1;
    const rand = () => {               // mulberry32
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let reserve = null;
    const randn = () => {              // Box-Muller
      if (reserve !== null) { const r = reserve; reserve = null; return r; }
      let u = 0; while (u === 0) u = rand();
      const v = rand(), m = Math.sqrt(-2 * Math.log(u));
      reserve = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    };
    return { rand, randn };
  }

  const linspace = (a, b, n) => (n === 1 ? [b] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)));
  const moyenne = (v) => v.reduce((s, x) => s + x, 0) / v.length;

  /* ---------- simu_sys.m (identique) ---------- */
  // 1 : y = p0*x + p1 ; 2 : y = p0*log(x) + p1 ; 3 : y = p0*exp(p1*x) ; 4 : y = p1*x^p0
  function simuSys(x, type, p0, p1) {
    return x.map((v) => {
      const xx = v <= 0 ? 1e-6 : v;   // x(x<=0) = 1e-6
      switch (type) {
        case 1: return p0 * xx + p1;
        case 2: return p0 * Math.log(xx) + p1;
        case 3: return p0 * Math.exp(p1 * xx);
        case 4: return p1 * Math.pow(xx, p0);
        default: throw new Error('Type de fonction inconnu');
      }
    });
  }

  /* ---------- bruit.m (identique) ---------- */
  function bruit(n, sigma, typeBruit, hasard) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = typeBruit === 1 ? sigma * hasard.randn() : sigma * (hasard.rand() - 0.5) * 2;
    return out;
  }
  // densité théorique tracée par bruit.m sur l'histogramme
  const densiteBruit = (b, sigma, typeBruit) => (typeBruit === 1
    ? Math.exp(-0.5 * (b / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
    : (Math.abs(b) <= sigma ? 1 / (2 * sigma) : 0));

  /* ---------- polyfit(X, Y, 1) ---------- */
  function polyfit1(X, Y) {
    const n = X.length, mx = moyenne(X), my = moyenne(Y);
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (X[i] - mx) ** 2; sxy += (X[i] - mx) * (Y[i] - my); }
    const a = sxy / sxx;
    return [a, my - a * mx];
  }

  function r2(y, yfit) {
    const my = moyenne(y);
    let ssr = 0, sst = 0;
    for (let i = 0; i < y.length; i++) { ssr += (y[i] - yfit[i]) ** 2; sst += (y[i] - my) ** 2; }
    return 1 - ssr / sst;
  }
  const sse = (y, yfit) => y.reduce((s, v, i) => s + (v - yfit[i]) ** 2, 0);

  /* ---------- estimation d'origine (somme.m / analyse_automatique.m) ---------- */
  // passage au logarithme pour l'exponentielle et la puissance, valeurs ≤ 0 remplacées par 1e-4
  function estimerOrigine(x, y, type) {
    const yc = y.map((v) => (v <= 0 ? 1e-4 : v));
    let p, p0, p1;
    switch (type) {
      case 1: p = polyfit1(x, y); p0 = p[0]; p1 = p[1]; break;
      case 2: p = polyfit1(x.map(Math.log), y); p0 = p[0]; p1 = p[1]; break;
      case 3: p = polyfit1(x, yc.map(Math.log)); p1 = p[0]; p0 = Math.exp(p[1]); break;
      case 4: p = polyfit1(x.map(Math.log), yc.map(Math.log)); p0 = p[0]; p1 = Math.exp(p[1]); break;
      default: throw new Error('Type inconnu');
    }
    return { p0, p1, coupes: y.filter((v) => v <= 0).length };
  }

  // analyse_automatique.m : les 4 modèles, garde le meilleur R²
  function analyseOrigine(x, y) {
    const stats = [1, 2, 3, 4].map((t) => {
      try {
        const e = estimerOrigine(x, y, t);
        const yf = simuSys(x, t, e.p0, e.p1);
        const R2 = r2(y, yf);
        return { type: t, nom: NOMS[t - 1], p0: e.p0, p1: e.p1, R2: Number.isFinite(R2) ? R2 : NaN, coupes: e.coupes };
      } catch (er) { return { type: t, nom: NOMS[t - 1], p0: 0, p1: 0, R2: 0, coupes: 0 }; }
    });
    let best = 0;
    stats.forEach((s, i) => { if (!(stats[best].R2 >= s.R2) && Number.isFinite(s.R2)) best = i; });
    return { stats, meilleur: stats[best].type };
  }

  /* ---------- outils statistiques ---------- */
  function lgamma(z) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
    z -= 1;
    let a = c[0];
    const t = z + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
  }
  // fonction bêta incomplète régularisée (fraction continue de Lentz)
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    const fc = (aa, bb, xx) => {
      const TINY = 1e-300;
      let c = 1, d = 1 - (aa + bb) * xx / (aa + 1);
      if (Math.abs(d) < TINY) d = TINY;
      d = 1 / d; let h = d;
      for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let an = m * (bb - m) * xx / ((aa + m2 - 1) * (aa + m2));
        d = 1 + an * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + an / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; h *= d * c;
        an = -(aa + m) * (aa + bb + m) * xx / ((aa + m2) * (aa + m2 + 1));
        d = 1 + an * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + an / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d;
        const del = d * c; h *= del;
        if (Math.abs(del - 1) < 1e-14) break;
      }
      return h;
    };
    return x < (a + 1) / (a + b + 2) ? bt * fc(a, b, x) / a : 1 - bt * fc(b, a, 1 - x) / b;
  }
  // loi de Student : P(T ≤ t) et quantile
  const studentCdf = (t, nu) => { const x = nu / (nu + t * t), p = 0.5 * betai(nu / 2, 0.5, x); return t >= 0 ? 1 - p : p; };
  function studentQuantile(p, nu) {
    let lo = 0, hi = 1000;
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (studentCdf(m, nu) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  function erf(x) {
    const s = Math.sign(x); x = Math.abs(x);
    const t = 1 / (1 + 0.5 * x);
    const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
      + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return s * y;
  }

  // test des suites (Wald-Wolfowitz) sur le signe des résidus : des résidus de bruit changent souvent de signe
  function testSuites(res) {
    const s = res.filter((r) => r !== 0).map((r) => r > 0);
    const n1 = s.filter(Boolean).length, n2 = s.length - n1;
    if (n1 < 2 || n2 < 2) return { suites: s.length ? 1 : 0, attendu: NaN, z: NaN, p: NaN };
    let suites = 1;
    for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) suites++;
    const n = n1 + n2, mu = 2 * n1 * n2 / n + 1, v = 2 * n1 * n2 * (2 * n1 * n2 - n) / (n * n * (n - 1));
    const z = (suites - mu) / Math.sqrt(v);
    return { suites, attendu: mu, z, p: 2 * (1 - normCdf(Math.abs(z))) };
  }

  /* ---------- estimation corrigée ---------- */
  // dérivées du modèle par rapport à (p0, p1)
  function jacobien(x, type, p0, p1) {
    return x.map((v) => {
      const xx = v <= 0 ? 1e-6 : v;
      switch (type) {
        case 1: return [xx, 1];
        case 2: return [Math.log(xx), 1];
        case 3: { const e = Math.exp(p1 * xx); return [e, p0 * xx * e]; }
        case 4: { const pw = Math.pow(xx, p0); return [p1 * pw * Math.log(xx), pw]; }
        default: throw new Error('Type inconnu');
      }
    });
  }
  const inv2 = (a, b, c) => { const d = a * c - b * b; return [c / d, -b / d, a / d]; }; // inverse de [[a b][b c]]

  // point de départ : linéarisation SANS remplacer les valeurs négatives (on n'utilise que les y > 0)
  function depart(x, y, type) {
    if (type <= 2) return estimerOrigine(x, y, type);
    const idx = y.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    if (idx.length >= 2) {
      const xs = idx.map((i) => x[i]), ys = idx.map((i) => y[i]);
      const e = estimerOrigine(xs, ys, type);
      if (Number.isFinite(e.p0) && Number.isFinite(e.p1)) return e;
    }
    return type === 3 ? { p0: Math.max(moyenne(y), 1e-3), p1: 0 } : { p0: 1, p1: Math.max(moyenne(y), 1e-3) };
  }

  // Levenberg-Marquardt sur les données d'origine (pas sur leur logarithme)
  function levenbergMarquardt(x, y, type, p0, p1) {
    let lambda = 1e-3, cout = sse(y, simuSys(x, type, p0, p1)), iter = 0;
    if (!Number.isFinite(cout)) cout = Infinity;
    for (; iter < 300; iter++) {
      const J = jacobien(x, type, p0, p1), yf = simuSys(x, type, p0, p1);
      let a = 0, b = 0, c = 0, g0 = 0, g1 = 0;
      for (let i = 0; i < x.length; i++) {
        const r = y[i] - yf[i];
        a += J[i][0] * J[i][0]; b += J[i][0] * J[i][1]; c += J[i][1] * J[i][1];
        g0 += J[i][0] * r; g1 += J[i][1] * r;
      }
      let progres = false;
      for (let essai = 0; essai < 30; essai++) {
        const [ia, ib, ic] = inv2(a * (1 + lambda), b, c * (1 + lambda));
        const d0 = ia * g0 + ib * g1, d1 = ib * g0 + ic * g1;
        const q0 = p0 + d0, q1 = p1 + d1;
        const c2 = sse(y, simuSys(x, type, q0, q1));
        if (Number.isFinite(c2) && c2 < cout) {
          const gain = (cout - c2) / Math.max(cout, 1e-300);
          p0 = q0; p1 = q1; cout = c2; lambda = Math.max(lambda / 10, 1e-12); progres = true;
          if (gain < 1e-13 || (Math.abs(d0) <= 1e-12 * (Math.abs(p0) + 1e-12) && Math.abs(d1) <= 1e-12 * (Math.abs(p1) + 1e-12))) iter = 1e9;
          break;
        }
        lambda *= 10;
      }
      if (!progres) break;
    }
    return { p0, p1, sse: cout };
  }

  // estimation corrigée d'un modèle : paramètres, intervalles de confiance à 95 %, σ estimé, R², résidus
  function estimerCorrige(x, y, type) {
    const n = x.length;
    const d = depart(x, y, type);
    const f = type <= 2 ? { p0: d.p0, p1: d.p1, sse: sse(y, simuSys(x, type, d.p0, d.p1)) } : levenbergMarquardt(x, y, type, d.p0, d.p1);
    const yf = simuSys(x, type, f.p0, f.p1);
    const res = y.map((v, i) => v - yf[i]);
    const ddl = n - 2;
    const sigma = ddl > 0 ? Math.sqrt(f.sse / ddl) : NaN;
    let d0 = NaN, d1 = NaN, se0 = NaN, se1 = NaN, corr = NaN;
    if (ddl > 0) {
      const J = jacobien(x, type, f.p0, f.p1);
      let a = 0, b = 0, c = 0;
      J.forEach(([u, v]) => { a += u * u; b += u * v; c += v * v; });
      const [ia, ib, ic] = inv2(a, b, c);
      se0 = sigma * Math.sqrt(ia); se1 = sigma * Math.sqrt(ic); corr = ib / Math.sqrt(ia * ic);
      const t = studentQuantile(0.975, ddl);
      d0 = t * se0; d1 = t * se1;
    }
    return { type, nom: NOMS[type - 1], p0: f.p0, p1: f.p1, d0, d1, se0, se1, corr, sigma, R2: r2(y, yf), sse: f.sse, eqm: f.sse / n, res, suites: testSuites(res) };
  }

  // analyse automatique corrigée : même critère (R² sur les données d'origine), mais modèles bien ajustés
  // + avertissement si les résidus ne ressemblent pas à du bruit
  function analyseCorrigee(x, y) {
    const stats = [1, 2, 3, 4].map((t) => { try { return estimerCorrige(x, y, t); } catch (e) { return { type: t, nom: NOMS[t - 1], R2: NaN }; } });
    let best = 0;
    stats.forEach((s, i) => { if (Number.isFinite(s.R2) && !(stats[best].R2 >= s.R2)) best = i; });
    return { stats, meilleur: stats[best].type };
  }

  /* ---------- une simulation complète ---------- */
  // o : { type, p0, p1, sigma, mu, typeBruit, n, xmin, xmax, graine, modele (0 = auto, 1..4 forcé) }
  function simuler(o) {
    const h = Hasard(o.graine);
    const x = linspace(o.xmin, o.xmax, o.n);
    const ySys = simuSys(x, o.type, o.p0, o.p1);
    const b = bruit(o.n, o.sigma, o.typeBruit, h).map((v) => v + (o.mu || 0));
    const y = ySys.map((v, i) => v + b[i]);
    const ori = analyseOrigine(x, y), cor = analyseCorrigee(x, y);
    const tOri = o.modele || ori.meilleur, tCor = o.modele || cor.meilleur;
    // l'IHM d'origine affichait un AUTRE tirage de bruit que celui ajouté au signal (second appel à bruit.m)
    const bAffiche = bruit(o.n, o.sigma, o.typeBruit, h);
    return { x, ySys, b, y, bAffiche, ori, cor, choixOri: ori.stats[tOri - 1], choixCor: cor.stats[tCor - 1] };
  }

  /* ---------- Monte-Carlo : biais, dispersion et couverture des intervalles ---------- */
  function monteCarlo(o, tirages) {
    const out = { ori: { p0: [], p1: [] }, cor: { p0: [], p1: [] }, couv0: 0, couv1: 0, ok: 0, bonModeleOri: 0, bonModeleCor: 0 };
    for (let k = 0; k < tirages; k++) {
      const h = Hasard((o.graine * 7919 + k * 104729) >>> 0);
      const x = linspace(o.xmin, o.xmax, o.n);
      const y = simuSys(x, o.type, o.p0, o.p1).map((v) => v + (o.typeBruit === 1 ? o.sigma * h.randn() : o.sigma * (h.rand() - 0.5) * 2) + (o.mu || 0));
      const eo = estimerOrigine(x, y, o.type), ec = estimerCorrige(x, y, o.type);
      out.ori.p0.push(eo.p0); out.ori.p1.push(eo.p1); out.cor.p0.push(ec.p0); out.cor.p1.push(ec.p1);
      if (Number.isFinite(ec.d0)) {
        out.ok++;
        if (Math.abs(ec.p0 - o.p0) <= ec.d0) out.couv0++;
        if (Math.abs(ec.p1 - o.p1) <= ec.d1) out.couv1++;
      }
      if (analyseOrigine(x, y).meilleur === o.type) out.bonModeleOri++;
      if (analyseCorrigee(x, y).meilleur === o.type) out.bonModeleCor++;
    }
    const resume = (v, vrai) => {
      const f = v.filter(Number.isFinite), m = moyenne(f);
      const sd = Math.sqrt(f.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, f.length - 1));
      const sorted = [...f].sort((a, b) => a - b);
      return { moyenne: m, biais: m - vrai, ecart: sd, rmse: Math.sqrt(f.reduce((s, x) => s + (x - vrai) ** 2, 0) / f.length), mediane: sorted[Math.floor(sorted.length / 2)] };
    };
    out.r = {
      ori0: resume(out.ori.p0, o.p0), ori1: resume(out.ori.p1, o.p1),
      cor0: resume(out.cor.p0, o.p0), cor1: resume(out.cor.p1, o.p1),
      couv0: out.couv0 / Math.max(1, out.ok), couv1: out.couv1 / Math.max(1, out.ok),
      bonOri: out.bonModeleOri / tirages, bonCor: out.bonModeleCor / tirages,
    };
    return out;
  }

  /* ---------- export CSV (mêmes colonnes que l'IHM) ---------- */
  function csv(sim) {
    const l = ['X,Systeme,Bruit,Systeme_plus_Bruit'];
    sim.x.forEach((x, i) => l.push([x, sim.ySys[i], sim.b[i], sim.y[i]].map((v) => +v.toPrecision(10)).join(',')));
    return l.join('\n');
  }
  function lireCSV(txt) {
    const lignes = txt.trim().split(/\r?\n/).filter((l) => l.trim());
    if (!lignes.length) return null;
    const sep = lignes[0].includes(';') ? ';' : lignes[0].includes('\t') ? '\t' : ',';
    const tete = lignes[0].split(sep).map((s) => s.trim().replace(/^"|"$/g, ''));
    const ix = tete.findIndex((t) => /^x$/i.test(t));
    const iy = tete.findIndex((t) => /plus_bruit|signal_bruite|^y$/i.test(t));
    const debut = ix >= 0 && iy >= 0 ? 1 : 0;
    const cx = ix >= 0 ? ix : 0, cy = iy >= 0 ? iy : 1;
    const x = [], y = [];
    for (const l of lignes.slice(debut)) {
      const c = l.split(sep).map((s) => parseFloat(s.replace(',', '.')));
      if (Number.isFinite(c[cx]) && Number.isFinite(c[cy])) { x.push(c[cx]); y.push(c[cy]); }
    }
    return x.length >= 3 ? { x, y } : null;
  }

  const api = { NOMS, Hasard, linspace, simuSys, bruit, densiteBruit, polyfit1, r2, sse, estimerOrigine, analyseOrigine,
    estimerCorrige, analyseCorrigee, levenbergMarquardt, testSuites, studentQuantile, studentCdf, betai, simuler, monteCarlo, csv, lireCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Signaux = api;
})(typeof window !== 'undefined' ? window : this);
