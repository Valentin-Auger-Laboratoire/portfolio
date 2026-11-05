/* Génératrice d'éolienne + Arduino : portage de simulation/simulation.py (dépôt generatrice-eolienne-arduino).
   - 2024 : génératrice directement sur A0, analogRead > 100 → relais D8 fermé, une lecture toutes les 100 ms.
   - 2026 : pont de diodes (1,4 V), lissage (constante de temps 0,2 s), pont 33 k / 10 k (×4,3), moyenne sur
     8 mesures toutes les 50 ms, hystérésis 3,0 / 2,5 V, 2 s minimum entre deux commutations.
   Hypothèses de la simulation (pas des mesures) : 0,9 V crête et 4 Hz par m/s ; vent en rafales autour de 5 m/s.
   Utilisable dans le navigateur (window.Eolienne) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Eolienne = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K = { ampl: 0.9, freq: 4.0, diode: 1.4, tauC: 0.2, tauCharge: 0.002, rHaut: 33000, rBas: 10000, seuil24: 100, on26: 3.0, off26: 2.5, min26: 2.0, n26: 8 };
  K.rapport = (K.rHaut + K.rBas) / K.rBas;
  // composantes des rafales : random.Random(2024) de simulation.py, recopiées pour un résultat identique
  const GUSTS = [[0.7230816465879635, 0.18750078702733775, 1.9136335578655521], [1.0985684421000135, 0.11432037557780693, 4.5146706795643485], [0.5386990240206004, 0.0763883293145448, 5.119264247507055], [0.7484712438192599, 0.1156505832171868, 4.5848825497821215], [1.166924682977158, 0.09119171869070325, 4.435576627258236], [0.7674156506896384, 0.18821281923432656, 6.297877662351373], [0.485743649455162, 0.19309586075967716, 2.951759269277937], [0.9381313931074291, 0.2205385484552363, 0.9347398351813256]];
  // vent : rafales autour de « mean » (gust = 1 : comme la simulation de référence) ou vent constant
  const wind = (t, mean, gust) => Math.max(0, mean + gust * GUSTS.reduce((s, [a, f, p]) => s + a * Math.sin(2 * Math.PI * f * t + p), 0));
  const can = (v) => Math.max(0, Math.min(1023, Math.trunc((v / 5.0) * 1023)));

  function createSim(o) {
    const opt = Object.assign({ mean: 5, gust: 1, dt: 0.0005 }, o || {});
    const s = {
      t: 0, phase: 0, v: 0, u: 0, vc: 0,
      r24: false, ch24: 0, next24: 0, over5: 0, raw24: 0,
      r26: false, ch26: 0, next26: 0, last26: -10, buf: [], m26: 0, next26print: 0,
      serial24: [], serial26: [], opt,
    };
    const push = (arr, m) => { arr.push({ t: s.t, m }); if (arr.length > 200) arr.shift(); };
    s.step = function () {
      const dt = opt.dt, t = s.t;
      const v = typeof opt.wind === 'function' ? opt.wind(t) : wind(t, opt.mean, opt.gust);
      s.v = v; s.phase += 2 * Math.PI * K.freq * v * dt;
      const u = K.ampl * v * Math.sin(s.phase); s.u = u;
      if (u > 5.0) s.over5 += dt;
      // 2024 : lecture directe toutes les 100 ms
      if (t >= s.next24) {
        s.next24 += 0.1;
        s.raw24 = can(u);
        const n = s.raw24 > K.seuil24;
        if (n !== s.r24) { s.ch24++; s.r24 = n; }
        push(s.serial24, 'Tension lue: ' + s.raw24);
      }
      // 2026 : redressement et lissage
      const ur = Math.max(0, Math.abs(u) - K.diode);
      if (ur > s.vc) s.vc += (ur - s.vc) * Math.min(1, dt / K.tauCharge); else s.vc -= (s.vc * dt) / K.tauC;
      if (t >= s.next26) {
        s.next26 += 0.05;
        const a0 = (s.vc * K.rBas) / (K.rHaut + K.rBas);
        s.buf = s.buf.concat([(can(a0) * 5.0) / 1023 * K.rapport]).slice(-K.n26);
        s.m26 = s.buf.reduce((a, b) => a + b, 0) / s.buf.length;
        if (t - s.last26 >= K.min26) {
          if (!s.r26 && s.m26 > K.on26) { s.r26 = true; s.ch26++; s.last26 = t; }
          else if (s.r26 && s.m26 < K.off26) { s.r26 = false; s.ch26++; s.last26 = t; }
        }
      }
      if (t >= s.next26print) { s.next26print += 0.5; push(s.serial26, Math.round(t * 1000) + ',' + (s.buf.length ? s.buf[s.buf.length - 1] : 0).toFixed(2) + ',' + s.m26.toFixed(2) + ',' + (s.r26 ? 1 : 0)); }
      s.t += dt;
    };
    s.run = function (T, onSample, every) { const e = every || 200; let k = 0; while (s.t < T) { s.step(); if (onSample && k++ % e === 0) onSample(s); } return s; };
    return s;
  }
  function summary(mean, gust, T) {
    const s = createSim({ mean, gust }).run(T || 120);
    return { ch24: s.ch24, ch26: s.ch26, over5: s.over5 / (T || 120) };
  }
  // puissance du vent récupérable : P = ½ρSv³Cp
  const power = (D, v, Cp, rho) => 0.5 * (rho || 1.2) * Math.PI * (D / 2) ** 2 * v ** 3 * (Cp === undefined ? 0.2 : Cp);
  return { K, GUSTS, wind, can, createSim, summary, power };
});
