// =====================================================================
//  Trains d'engrenages : moteur de calcul (sans interface).
//  - simpleTrain : suite d'étages de roues extérieures à denture droite ;
//    la roue menée d'un étage et la roue menante du suivant sont sur le
//    même arbre.
//  - epicyclic : train épicycloïdal simple (planétaire, satellites,
//    couronne, porte-satellites), relation de Willis :
//        (ωs − ωc) / (ωr − ωc) = − Zr / Zs
//  Vitesses en tr/min, couples en N·m, module et entraxes en mm.
// =====================================================================
(function (root) {
  'use strict';

  const isInt = (x) => Number.isInteger(x);
  const posInt = (x) => isInt(x) && x > 0;

  // ---------------- Train simple ----------------
  function simpleTrain(p) {
    const issues = [];
    const err = (code, v) => issues.push({ lvl: 'err', code, v });
    const warn = (code, v) => issues.push({ lvl: 'warn', code, v });
    if (!p.stages.length) err('noStage');
    p.stages.forEach((s, k) => {
      if (!posInt(s.z1) || !posInt(s.z2)) err('z', k + 1);
      if (!(Number.isFinite(s.m) && s.m > 0)) err('m', k + 1);
    });
    if (!(Number.isFinite(p.nIn) && p.nIn > 0)) err('nIn');
    if (!(Number.isFinite(p.cIn) && p.cIn >= 0)) err('cIn');
    if (!(Number.isFinite(p.eta) && p.eta > 0 && p.eta <= 1)) err('eta');
    if (issues.length) return { ok: false, issues };

    let ratio = 1;
    const stages = p.stages.map((s, k) => {
      const i = s.z1 / s.z2;          // ω mené / ω menant (en valeur absolue)
      ratio *= i;
      if (s.z1 < 17 || s.z2 < 17) warn('under', [k + 1, Math.min(s.z1, s.z2)]);
      if (s.z2 / s.z1 > 7 || s.z1 / s.z2 > 7) warn('bigStep', [k + 1, Math.max(s.z2 / s.z1, s.z1 / s.z2)]);
      return { ...s, i, a: (s.m * (s.z1 + s.z2)) / 2, d1: s.m * s.z1, d2: s.m * s.z2 };
    });
    const sign = stages.length % 2 === 0 ? 1 : -1;   // chaque contact extérieur inverse le sens
    const etaTot = Math.pow(p.eta, stages.length);
    return {
      ok: true, issues, stages, ratio, sign, etaTot,
      nOut: p.nIn * ratio * sign,
      cOut: (p.cIn * etaTot) / ratio,
      pIn: (p.cIn * p.nIn * 2 * Math.PI) / 60,
    };
  }

  // ---------------- Train épicycloïdal ----------------
  // fixed / input ∈ {'s', 'c', 'r'} (planétaire, porte-satellites, couronne)
  function solveEpi(zs, zr, fixed, input) {
    const k = -zr / zs;                // ωs − ωc = k (ωr − ωc)
    const w = { s: null, c: null, r: null };
    w[fixed] = 0; w[input] = 1;
    // inconnue restante
    if (w.s === null) w.s = w.c + k * (w.r - w.c);
    else if (w.r === null) w.r = w.c + (w.s - w.c) / k;
    else w.c = (w.s - k * w.r) / (1 - k);
    return w;
  }

  function epicyclic(p) {
    const issues = [];
    const err = (code, v) => issues.push({ lvl: 'err', code, v });
    const warn = (code, v) => issues.push({ lvl: 'warn', code, v });
    for (const k of ['zs', 'zp', 'zr']) if (!posInt(p[k])) err('zEpi', k);
    if (!posInt(p.n) || p.n < 1) err('nSat');
    if (!(Number.isFinite(p.m) && p.m > 0)) err('m', 0);
    if (!(Number.isFinite(p.nIn) && p.nIn > 0)) err('nIn');
    if (!['s', 'c', 'r'].includes(p.fixed) || !['s', 'c', 'r'].includes(p.input) || p.fixed === p.input) err('roles');
    if (issues.length) return { ok: false, issues };

    // conditions géométriques
    if (p.zr !== p.zs + 2 * p.zp) err('coax', p.zs + 2 * p.zp);
    if (((p.zs + p.zr) % p.n) !== 0) err('mount', [p.zs + p.zr, p.n]);
    const neighbour = (p.zs + p.zp) * Math.sin(Math.PI / p.n) - (p.zp + 2);
    if (p.n > 1 && neighbour <= 0) err('neighbour', p.n);
    if (p.zs < 17) warn('under', ['S', p.zs]);
    if (p.zp < 17) warn('under', ['P', p.zp]);
    if (p.zr - p.zp < 10) warn('internal');
    if (issues.some((i) => i.lvl === 'err')) return { ok: false, issues };

    const output = ['s', 'c', 'r'].find((x) => x !== p.fixed && x !== p.input);
    const w = solveEpi(p.zs, p.zr, p.fixed, p.input);   // vitesses relatives à l'entrée = 1
    const pRel = (-(w.s - w.c) * p.zs) / p.zp;         // satellite par rapport au porte-satellites
    const pAbs = w.c + pRel;
    const ratio = w[output];                           // ω sortie / ω entrée (signé)
    return {
      ok: true, issues, output, ratio, w, pRel, pAbs,
      nOut: p.nIn * ratio, nPlanetRel: p.nIn * pRel, nPlanetAbs: p.nIn * pAbs,
      willis: -p.zr / p.zs, aSat: (p.m * (p.zs + p.zp)) / 2,
      dS: p.m * p.zs, dP: p.m * p.zp, dR: p.m * p.zr,
    };
  }

  const api = { simpleTrain, epicyclic, solveEpi };
  root.Engrenages = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
