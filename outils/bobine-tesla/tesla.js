// =====================================================================
//  Conception d'une bobine Tesla : moteur de calcul (sans interface).
//  Formules classiques des concepteurs de bobines Tesla :
//  - inductance du secondaire : formule de Wheeler (solénoïde à une couche)
//  - capacité propre du secondaire : approximation de Medhurst
//  - capacité de la sphère du haut : sphère isolée, C = 4·π·ε0·r
//  - fréquence de résonance : f = 1 / (2·π·√(L·C))
//  - primaire en spirale plate : formule de Wheeler pour spirale plate
//  Toutes les longueurs d'entrée sont en millimètres.
// =====================================================================
(function (root) {
  'use strict';

  const MM_PER_IN = 25.4;
  const EPS0 = 8.8541878128e-12;   // F/m
  const RHO_CU = 1.72e-8;          // Ω·m (cuivre à 20 °C)
  const C_LIGHT = 299792458;       // m/s

  // Solénoïde à une couche (Wheeler) : L(µH) = r²·N² / (9r + 10h), r et h en pouces
  function wheelerSolenoid(rMm, hMm, n) {
    const r = rMm / MM_PER_IN, h = hMm / MM_PER_IN;
    return (r * r * n * n) / (9 * r + 10 * h) * 1e-6; // H
  }
  // Spirale plate (Wheeler) : L(µH) = R²·N² / (8R + 11W), R = rayon moyen, W = largeur, en pouces
  function wheelerSpiral(rMeanMm, widthMm, n) {
    const r = rMeanMm / MM_PER_IN, w = widthMm / MM_PER_IN;
    return (r * r * n * n) / (8 * r + 11 * w) * 1e-6; // H
  }
  // Capacité propre (Medhurst simplifiée) : C(pF) = 0,29·h + 0,41·r + 1,94·√(r³/h), r et h en cm
  function medhurst(rMm, hMm) {
    const r = rMm / 10, h = hMm / 10;
    return (0.29 * h + 0.41 * r + 1.94 * Math.sqrt((r * r * r) / h)) * 1e-12; // F
  }
  const sphereCap = (dMm) => 4 * Math.PI * EPS0 * (dMm / 2000); // F
  const resonance = (L, C) => 1 / (2 * Math.PI * Math.sqrt(L * C));

  // ---------- Primaire en spirale plate : spires nécessaires pour une inductance donnée ----------
  // Rayon intérieur ri, pas p (fil + espace) : rayon moyen = ri + N·p/2, largeur = N·p.
  function spiralTurnsFor(Ltarget, innerDiaMm, pitchMm) {
    const L = (n) => wheelerSpiral(innerDiaMm / 2 + (n * pitchMm) / 2, n * pitchMm, n);
    let lo = 0.01, hi = 200;
    if (L(hi) < Ltarget) return null;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (L(mid) < Ltarget) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  // =================================================================
  //  Calcul complet
  //  p = { coilDia, windLen, wireDia, topDia (0 = aucune), mode: 'sgtc'|'sstc',
  //        primCapNf, primInnerDia, primPitch, primTurns (sstc) }
  // =================================================================
  function design(p) {
    const issues = [];
    const err = (code, v) => issues.push({ lvl: 'err', code, v });
    const warn = (code, v) => issues.push({ lvl: 'warn', code, v });
    const pos = (x) => Number.isFinite(x) && x > 0;

    if (!pos(p.coilDia)) err('coilDia');
    if (!pos(p.windLen)) err('windLen');
    if (!pos(p.wireDia)) err('wireDia');
    if (!(Number.isFinite(p.topDia) && p.topDia >= 0)) err('topDia');
    if (p.mode === 'sgtc') {
      if (!pos(p.primCapNf)) err('primCap');
      if (!pos(p.primInnerDia)) err('primInner');
      if (!pos(p.primPitch)) err('primPitch');
    } else if (!pos(p.primTurns)) err('primTurns');
    if (issues.length) return { ok: false, issues };

    // ---------- Secondaire ----------
    const r = p.coilDia / 2, h = p.windLen;
    const turns = Math.floor(h / p.wireDia);           // bobinage jointif
    const Ls = wheelerSolenoid(r, h, turns);
    const Cself = medhurst(r, h);
    const Ctop = p.topDia > 0 ? sphereCap(p.topDia) : 0;
    const Ctot = Cself + Ctop;
    const f = resonance(Ls, Ctot);
    const fBare = resonance(Ls, Cself);
    const wireLen = turns * Math.PI * (p.coilDia + p.wireDia) / 1000;     // m
    const area = Math.PI * Math.pow(p.wireDia * 0.92 / 2000, 2);           // m² (≈ 8 % d'émail)
    const Rdc = RHO_CU * wireLen / area;
    const quarterWave = C_LIGHT / (4 * f);                                  // m
    const Xl = 2 * Math.PI * f * Ls;                                        // Ω
    const Q = Xl / Rdc;                                                     // Q en continu (borne haute)
    const aspect = h / p.coilDia;

    if (turns < 200) warn('fewTurns', turns);
    if (turns > 2500) warn('manyTurns', turns);
    if (aspect < 3) warn('aspectLow', aspect);
    if (aspect > 6) warn('aspectHigh', aspect);
    if (p.topDia > 0 && p.topDia < p.coilDia) warn('topSmall');
    if (p.topDia === 0) warn('noTop');

    // ---------- Primaire ----------
    let prim = null;
    if (p.mode === 'sgtc') {
      const Cp = p.primCapNf * 1e-9;
      const Lp = 1 / (Math.pow(2 * Math.PI * f, 2) * Cp);
      const n = spiralTurnsFor(Lp, p.primInnerDia, p.primPitch);
      if (n === null) warn('primTooBig');
      if (p.primInnerDia < p.coilDia + 20) warn('primClose');
      const outer = n === null ? null : p.primInnerDia + 2 * n * p.primPitch;
      prim = { Lp, turns: n, outerDia: outer, Cp };
    } else {
      const n = p.primTurns, pitch = p.primPitch > 0 ? p.primPitch : 5;
      const Lp = wheelerSolenoid((p.coilDia + 30) / 2, n * pitch, n);
      prim = { Lp, turns: n, outerDia: p.coilDia + 30, drive: f };
    }

    return {
      ok: true, issues,
      sec: { turns, Ls, Cself, Ctop, Ctot, f, fBare, wireLen, Rdc, quarterWave, wireRatio: wireLen / quarterWave, Xl, Q, aspect },
      prim,
    };
  }

  // Fréquence en fonction de la hauteur de bobinage (pour la courbe)
  function sweep(p, n) {
    const out = [];
    const h0 = Math.max(p.coilDia * 1, 40), h1 = p.coilDia * 8;
    for (let i = 0; i <= n; i++) {
      const h = h0 + (h1 - h0) * i / n;
      const turns = Math.floor(h / p.wireDia);
      const L = wheelerSolenoid(p.coilDia / 2, h, turns);
      const C = medhurst(p.coilDia / 2, h) + (p.topDia > 0 ? sphereCap(p.topDia) : 0);
      out.push({ h, f: resonance(L, C) });
    }
    return out;
  }

  const api = { design, sweep, wheelerSolenoid, wheelerSpiral, medhurst, sphereCap, resonance, spiralTurnsFor };
  root.TeslaCoil = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
