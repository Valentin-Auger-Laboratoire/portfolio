// =====================================================================
//  Simulation des deux chaînes d'acquisition des TP d'électronique :
//  1. pouls par capteur piézoélectrique : capteur -> convertisseur
//     charge-tension (Rf // Cf) -> filtre passe-bas RC -> oscilloscope ;
//  2. résistance cutanée : pont de Wheatstone -> amplificateur
//     différentiel -> filtre passe-bas RC -> oscilloscope.
//  Les filtres du premier ordre sont discrétisés exactement
//  (a = exp(−dt/τ)). Les amplitudes du capteur sont calibrées pour
//  retrouver l'ordre de grandeur des mesures du TP.
// =====================================================================
(function (root) {
  'use strict';

  const FS = 2000;            // fréquence d'échantillonnage (Hz)
  const DT = 1 / FS;
  const R_SCOPE = 1e6;        // impédance d'entrée de l'oscilloscope (Ω)

  // PRNG + bruit gaussien
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // Filtres du premier ordre, discrétisation exacte
  function lowPass(tau) { const a = Math.exp(-DT / tau); let y = 0; return { step: (x) => (y = a * y + (1 - a) * x), reset: (v) => (y = v || 0) }; }
  // passe-haut : réponse exacte à une entrée linéaire par morceaux (reste juste quand τ << dt)
  function highPass(tau) { const a = Math.exp(-DT / tau), b = (tau * (1 - a)) / DT; let y = 0, xp = 0; return { step: (x) => { y = a * y + b * (x - xp); xp = x; return y; } }; }

  // Filtre RC chargé par l'oscilloscope : diviseur R / Rscope, τ = (R // Rscope)·C
  function rcFilter(R, C, loaded) {
    const k = loaded ? R_SCOPE / (R + R_SCOPE) : 1;
    const Req = loaded ? (R * R_SCOPE) / (R + R_SCOPE) : R;
    return { tau: Req * C, k, fc: 1 / (2 * Math.PI * Req * C) };
  }
  const gainLP = (f, fc) => 1 / Math.sqrt(1 + (f / fc) ** 2);

  // =================================================================
  //  1. Pouls (capteur piézoélectrique)
  //  p = { mode:'carotid'|'finger', bpm, Rf, Cf, R, C, loaded, noise (V eff.), hum (V) }
  // =================================================================
  const K_PIEZO = 7.5e-9;     // C/N, calibré : ≈ 1,2 V crête à crête au doigt avec le montage du TP
  function pulseForce(t, bpm) {
    // onde de pouls : montée systolique rapide, onde dicrote, puis retour
    const T = 60 / bpm, ph = (t % T) / T;
    const sys = Math.exp(-(((ph - 0.12) / 0.05) ** 2));
    const dic = 0.35 * Math.exp(-(((ph - 0.38) / 0.07) ** 2));
    return 0.05 * (sys + dic);                       // N (faible : quelques centièmes de newton)
  }
  function PulseSim(p, seed) {
    const r = rng(seed || 1);
    const hp = highPass(p.Rf * p.Cf);
    const flt = rcFilter(p.R, p.C, p.loaded);
    const lp = lowPass(flt.tau);
    let t = 0, nextTap = 0.4, tapStart = -10, tapAmp = 1;
    function force() {
      if (p.mode === 'finger') {
        if (t >= nextTap) { tapStart = t; tapAmp = 0.7 + 0.6 * r(); nextTap = t + 0.6 + 0.9 * r(); }
        const u = t - tapStart;                       // appui : montée 20 ms, relâchement 60 ms
        return u < 0 ? 0 : u < 0.02 ? tapAmp * (u / 0.02) : u < 0.12 ? tapAmp * Math.exp(-(u - 0.02) / 0.03) : 0;
      }
      return pulseForce(t, p.bpm);
    }
    return {
      info: () => ({ fcConv: 1 / (2 * Math.PI * p.Rf * p.Cf), fcFilter: flt.fc, gainAtPulse: flt.k * gainLP(p.bpm / 60, flt.fc), f0: p.bpm / 60 }),
      step() {
        const Q = K_PIEZO * force();
        // convertisseur : Vs = −(Q/Cf)·(sτ/(1+sτ)), τ = Rf·Cf
        let raw = -hp.step(Q / p.Cf);
        raw += p.noise * gauss(r) + p.hum * Math.sin(2 * Math.PI * 50 * t);
        const filt = lp.step(flt.k * raw);
        t += DT;
        return [raw, filt];
      },
      time: () => t,
    };
  }

  // =================================================================
  //  2. Résistance cutanée (pont de Wheatstone)
  //  p = { E, R1, R2, R3, R0 (peau au repos), gain, R, C, loaded, noise, hum, test110 }
  // =================================================================
  function SkinSim(p, seed) {
    const r = rng(seed || 2);
    const flt = rcFilter(p.R, p.C, p.loaded);
    const lp = lowPass(flt.tau);
    const tonic = lowPass(2.5);                       // le niveau de base suit lentement les changements (eau salée)
    let t = 0, base = p.R0, salt = 1, scr = [], motion = [];
    tonic.reset(1);
    const api = {
      stimulus() { scr.push(t); },                    // réponse phasique (stress)
      salt() { salt = Math.max(0.35, salt * 0.6); },  // eau salée : conductivité accrue
      dry() { salt = 1; },
      move() { motion.push(t); },                     // appui / mouvement des électrodes
      rSkin: 0, vMinus: 0, vPlus: 0, current: 0,
      info: () => ({ fcFilter: flt.fc, att50: 20 * Math.log10(flt.k * gainLP(50, flt.fc)), att110: 20 * Math.log10(flt.k * gainLP(110, flt.fc)), balance: p.R3 }),
      step() {
        // résistance de la peau : niveau tonique × eau salée − réponses phasiques
        const lvl = tonic.step(salt);
        let drop = 0;
        scr = scr.filter((s) => t - s < 20);
        for (const s of scr) { const u = t - s; if (u > 0.8) drop += 0.12 * (1 - Math.exp(-(u - 0.8) / 0.7)) * Math.exp(-(u - 0.8) / 4); }
        const Rs = base * lvl * (1 - drop);
        api.rSkin = Rs;
        const vPlus = (p.E * p.R2) / (p.R1 + p.R2);
        const vMinus = (p.E * Rs) / (p.R3 + Rs);
        api.vPlus = vPlus; api.vMinus = vMinus; api.current = p.E / (p.R3 + Rs);
        let vd = vPlus - vMinus;
        // artefacts de mouvement : pics brefs
        motion = motion.filter((s) => t - s < 1.5);
        for (const s of motion) { const u = t - s; vd += 0.05 * Math.sin(2 * Math.PI * 9 * u) * Math.exp(-u / 0.25) * (1 + gauss(r) * 0.3); }
        let raw;
        if (p.test110) raw = p.gain * 0.005 * Math.sin(2 * Math.PI * 110 * t) + 0.3 * p.noise * gauss(r);   // test : 10 mV crête à crête à 110 Hz depuis le générateur
        else raw = p.gain * (vd + p.hum * Math.sin(2 * Math.PI * 50 * t)) + p.noise * gauss(r);
        if (t === 0) lp.reset(flt.k * raw);          // filtre déjà en régime établi au démarrage
        const filt = lp.step(flt.k * raw);
        t += DT;
        return [raw, filt];
      },
      time: () => t,
    };
    return api;
  }

  // Mesures sur une fenêtre de points
  function measure(arr) {
    let mn = Infinity, mx = -Infinity, s = 0;
    for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; s += v; }
    return { pp: mx - mn, mean: s / arr.length, min: mn, max: mx };
  }

  const api = { FS, DT, R_SCOPE, PulseSim, SkinSim, rcFilter, gainLP, lowPass, highPass, measure, pulseForce };
  root.Acquisition = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
