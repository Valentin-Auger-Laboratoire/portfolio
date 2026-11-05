/* Balnéothérapie connectée : simulation de la régulation de température et de ses deux programmes.
   - « 2023 » : portage fidèle de code/regulation_temperature_bluetooth.ino (DS18B20 sur D6, relais sur D7,
     Bluetooth sur D2/D3, relais HIGH si T ≤ 20 °C, delay(10000), message println à 2 décimales).
   - « 2026 » : la version corrigée décrite dans la relecture du README (hystérésis 32 / 36 °C, sonde débranchée
     détectée, coupure et alerte au-delà de 38 °C, boucle non bloquante).
   Modèle thermique du premier ordre : C·dT/dt = P·relais − UA·(T − Tamb).
   Utilisable dans le navigateur (window.Balneo) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Balneo = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ mesures réelles (data/mesures_terminal_bluetooth.csv, avril 2023)
  const MESURES = {
    A: [['11:44:39.097', 23.06], ['11:44:49.728', 23.06], ['11:45:00.705', 23.06], ['11:45:11.101', 23.06], ['11:45:21.716', 23.0], ['11:45:32.634', 22.87], ['11:45:42.964', 22.94], ['11:45:53.731', 23.0], ['11:46:04.550', 23.06], ['11:46:14.978', 23.06], ['11:46:25.605', 23.06], ['11:46:36.340', 23.0], ['11:46:46.965', 23.0], ['11:46:57.595', 23.0], ['11:47:08.396', 22.94], ['11:47:19.099', 22.94], ['11:47:29.602', 22.19], ['11:47:40.216', 18.56]],
    B: [['11:51:52.147', 18.12], ['11:52:02.740', 18.12], ['11:52:13.502', 18.12], ['11:52:24.140', 18.12], ['11:52:34.756', 18.12], ['11:52:45.394', 18.12], ['11:52:56.128', 18.19], ['11:53:06.764', 18.19], ['11:53:17.297', 18.19], ['11:53:28.432', 18.19], ['11:53:38.713', 18.19], ['11:53:49.350', 18.19], ['11:53:59.978', 18.19], ['11:54:10.605', 18.25], ['11:54:21.339', 18.25], ['11:54:32.271', 18.25], ['11:54:42.589', 18.25], ['11:54:53.214', 18.31], ['11:55:03.981', 18.31], ['11:55:14.596', 18.31], ['11:55:25.222', 18.31], ['11:55:36.130', 18.31], ['11:55:46.593', 18.37], ['11:55:57.226', 18.37], ['11:56:08.043', 18.37], ['11:56:18.596', 18.37], ['11:56:25.928', 18.44], ['11:56:36.464', 18.44], ['11:56:47.096', 18.44], ['11:57:00.969', 18.44]],
  };
  const sec = (h) => { const [a, b, c] = h.split(':').map(Number); return a * 3600 + b * 60 + c; };
  // régression linéaire T = a + b·t
  function linfit(pts) {
    const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let sxy = 0, sxx = 0; for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
    const b = sxy / sxx; return { a: my - b * mx, b };
  }
  const B0 = sec(MESURES.B[0][0]);
  const SERIE_B = MESURES.B.map(([h, T]) => [sec(h) - B0, T]);
  const PENTE_B = linfit(SERIE_B).b; // °C/s pendant la chauffe (relais à HIGH, T < 20 °C)
  // période réelle de la boucle : médiane des écarts entre deux mesures
  const ecarts = [];
  for (const s of ['A', 'B']) for (let i = 1; i < MESURES[s].length; i++) ecarts.push(sec(MESURES[s][i][0]) - sec(MESURES[s][i - 1][0]));
  ecarts.sort((x, y) => x - y);
  const PERIODE = ecarts[Math.floor(ecarts.length / 2)];

  // ------------------------------------------------------------------ installations
  const CP = 4186; // J/(kg·K)
  // maquette du TP : volume et pertes SUPPOSÉS, puissance de chauffe DÉDUITE de la pente mesurée (série B, ~18,2 °C, ambiance ~23 °C)
  const MAQ = { V: 1.0, UA: 0.30, Tamb: 23.0 };
  MAQ.P = MAQ.V * CP * PENTE_B - MAQ.UA * (MAQ.Tamb - 18.2);
  const POOLS = {
    maquette: { V: MAQ.V, UA: MAQ.UA, P: MAQ.P, Tamb: MAQ.Tamb, T0: 18.12, horizon: 12 * 3600 },
    bassin: { V: 15000, UA: 600, P: 45000, Tamb: 26, T0: 20, horizon: 24 * 3600 }, // bassin de 15 m³ (illustratif)
  };

  // ------------------------------------------------------------------ DS18B20 et message
  const DISCONNECTED = -127;
  const ds18b20 = (T, ok, noise) => (ok ? Math.round((T + (noise || 0)) / 0.0625) * 0.0625 : DISCONNECTED);
  // println(float) d'Arduino : 2 décimales
  const println = (v) => v.toFixed(2);

  // ------------------------------------------------------------------ programmes
  function prog2023() {
    let wake = 0;
    return {
      name: '2023', period: PERIODE,
      step(t, io, hw) {
        if (t < wake) return;
        const temperature = hw.read();
        hw.send(println(temperature));
        if (temperature <= 20) io.relais = 1; else io.relais = 0; // Si inferieur ou egal a 32°C (commentaire d'origine)
        wake = t + PERIODE; // delay(10000) + conversion : 10,63 s mesurées
      },
    };
  }
  function prog2026(cfg) {
    const lo = cfg.lo, hi = cfg.hi, max = cfg.max;
    let nextRead = 0, nextSend = 0, last = null, invalid = 0, hot = false;
    return {
      name: '2026', period: 1,
      step(t, io, hw) {
        if (t < nextRead) return;
        nextRead = t + 1; // conversion 12 bits ≈ 750 ms, lecture chaque seconde sans bloquer
        const v = hw.read();
        if (v === DISCONNECTED || v < -50 || v > 85) invalid++; else { invalid = 0; last = v; }
        io.alarm = null;
        if (last !== null) { if (last >= max) hot = true; else if (last < max - 1) hot = false; } // alarme avec 1 °C d'hystérésis
        if (invalid >= 2) { io.relais = 0; io.alarm = 'sonde'; }
        else if (hot) { io.relais = 0; io.alarm = 'surchauffe'; }
        else if (last !== null) { if (last < lo) io.relais = 1; else if (last > hi) io.relais = 0; } // hystérésis
        if (t >= nextSend) { nextSend = t + 10; hw.send(invalid >= 2 ? println(DISCONNECTED) : println(last === null ? v : last)); }
      },
    };
  }

  // ------------------------------------------------------------------ simulation
  // opt : { prog, pool, Tamb, lo, hi, max, fault: {type: 'sonde'|'relais'|'froid', t}, seed }
  function createSim(opt) {
    const o = Object.assign({ prog: '2023', pool: 'maquette', lo: 32, hi: 36, max: 38, seed: 3 }, opt || {});
    const P = Object.assign({}, POOLS[o.pool] || POOLS.maquette);
    if (o.Tamb !== undefined) P.Tamb = o.Tamb;
    const C = P.V * CP;
    let seed = o.seed; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const io = { relais: 0, alarm: null };
    const state = { T: o.T0 !== undefined ? o.T0 : P.T0, sondeOK: true, collé: false };
    const prog = o.prog === '2026' ? prog2026(o) : prog2023();
    const out = { t: [], T: [], relais: [], msgs: [], energy: 0, maxT: -Infinity, comfort: 0, alarms: [] };
    const hw = {
      read: () => ds18b20(state.T, state.sondeOK, 0.02 * gauss()),
      send: (m) => { out.msgs.push({ t: sim.t, m }); if (out.msgs.length > 2000) out.msgs.shift(); },
    };
    let lastAlarm = null;
    const sim = {
      t: 0, io, state, out, pool: P, prog,
      step(dt) {
        const f = o.fault;
        if (f && sim.t >= f.t) {
          if (f.type === 'sonde') state.sondeOK = false;
          if (f.type === 'relais') state.collé = true;
          if (f.type === 'froid' && !f.done) { state.T -= f.dT || (o.pool === 'bassin' ? 3 : 4); f.done = true; }
        }
        prog.step(sim.t, io, hw);
        if (io.alarm !== lastAlarm) { if (io.alarm) out.alarms.push({ t: sim.t, type: io.alarm }); lastAlarm = io.alarm; }
        const heat = state.collé ? 1 : io.relais;
        state.T += ((P.P * heat - P.UA * (state.T - P.Tamb)) / C) * dt;
        out.energy += (P.P * heat * dt) / 3600; // Wh
        out.maxT = Math.max(out.maxT, state.T);
        if (state.T >= o.lo && state.T <= o.hi) out.comfort += dt;
        sim.t += dt;
        if (Math.floor(sim.t / out.every) !== Math.floor((sim.t - dt) / out.every)) { out.t.push(sim.t); out.T.push(state.T); out.relais.push(heat); }
      },
      run(T, dt) { const h = dt || 0.5; while (sim.t < T) sim.step(h); return sim; },
    };
    out.every = o.pool === 'bassin' ? 60 : 5;
    return sim;
  }
  function summary(sim) {
    const o = sim.out;
    return { T: sim.state.T, maxT: o.maxT, comfort: o.comfort / Math.max(1, sim.t), energy: o.energy, alarms: o.alarms.map((a) => a.type), relais: sim.io.relais };
  }

  return { MESURES, SERIE_B, PENTE_B, PERIODE, POOLS, MAQ, CP, DISCONNECTED, ds18b20, println, linfit, sec, createSim, summary };
});
