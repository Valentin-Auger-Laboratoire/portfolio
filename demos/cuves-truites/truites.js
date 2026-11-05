/* Supervision de cuves d'élevage de truites : simulation des cuves, des capteurs et des deux programmes.
   - « 2023 » : portage fidèle de code/arduino/supervision_cuve.ino (cuve 1 seulement, thermistance Grove B = 4275,
     remplissage (2000 − d)·100/2000, turbidité −1120,4·V² + 5742,3·V − 4352,9, électrovanne jamais commandée,
     trame « T,R,NTU » sans delay) et de la lecture de interface_bassin.pde (values.length > 0, puis values[0..2]).
   - « 2026 » : la version corrigée décrite dans la vérification du README (4 cuves, vraies hauteurs, électrovanne
     sous 80 %, seuils 20 / 24 °C, mesures invalides détectées, trame vérifiée).
   Utilisable dans le navigateur (window.Truites) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Truites = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ------------------------------------------------------------------ capteurs (formules du programme de 2023)
  const THERM = { B: 4275, R0: 100000 };
  const adcOfTemp = (T) => { const R = THERM.R0 * Math.exp(THERM.B * (1 / (T + 273.15) - 1 / 298.15)); return Math.max(0, Math.min(1023, Math.round(1023 / (R / THERM.R0 + 1)))); };
  const tempOfAdc = (a) => { const R = THERM.R0 * (1023.0 / a - 1.0); return 1.0 / (Math.log(R / THERM.R0) / THERM.B + 1 / 298.15) - 273.15; }; // a = 0 → −273,15
  const ntuOfV = (v) => -1120.4 * v * v + 5742.3 * v - 4352.9;
  // tension du capteur de turbidité pour une turbidité donnée (branche décroissante, 2,5 à 4,2 V) + décalage du capteur
  const vOfNtu = (n) => { const a = -1120.4, b = 5742.3, c = -4352.9 - n; const d = b * b - 4 * a * c; return d < 0 ? 2.5 : (-b - Math.sqrt(d)) / (2 * a); };
  const fill2023 = (d) => ((2000 - d) * 100) / 2000;
  const fmt2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : v > 0 ? 'inf' : v < 0 ? '-inf' : 'nan'); // Serial.print(float)

  // ------------------------------------------------------------------ cuves (cm, °C, NTU, h)
  const TANK = { Hs: 150, full: 120, empty: 0, inflow: 14, out: 2.2, Tin: 11, tau: 8 };
  // distances capteur → eau : pleine 30 cm, vide 150 cm ; la version 2026 utilise ces deux hauteurs
  const fill2026 = (d) => ((TANK.Hs - d) / TANK.full) * 100;
  const SCENARIOS = {
    normal: { amb: [14, 4] },
    chaud: { amb: [22, 6] },
    fuite: { amb: [14, 4], leak: { tank: 2, rate: 6, from: 4 } },
    mousse: { amb: [14, 4], noEcho: { tank: 0, from: 3 } },
    debranche: { amb: [14, 4], unplug: { tank: 0, from: 3 } },
    nourrissage: { amb: [14, 4], feed: [6, 12, 18] },
    photo: { amb: [14, 4], noEcho: { tank: 0, from: 0 }, turbAdc: { tank: 0, adc: 311 }, loss: 1, cut: 'first' }, // reconstitution de l'écran de la photo : analogRead(A1) = 311 donne exactement 1783,44
  };

  // ------------------------------------------------------------------ liaison série et lecture Processing
  // L'Arduino envoie une trame toutes les ~30 ms ; si des octets sont perdus, la ligne lue par Processing est tronquée.
  function cutFrame(line, mode, rnd) {
    if (mode === 'first') { const i = line.indexOf(','); return line.slice(i + 1); } // perte du 1er champ
    const k = Math.floor(rnd() * (line.length - 2)) + 1; return rnd() < 0.5 ? line.slice(k) : line.slice(0, k);
  }
  // lecture d'interface_bassin.pde : v1 = values[0], v2 = values[1], v3 = values[2] ; un index manquant lève une exception
  function parse2023(line, v) {
    const values = line.trim().split(',').map((s) => (s === '' ? NaN : parseFloat(s)));
    const out = { v1: v.v1, v2: v.v2, v3: v.v3, error: null };
    if (values.length > 0) {
      out.v1 = values[0];
      if (values.length < 2) { out.error = 'ArrayIndexOutOfBoundsException: 1'; return out; }
      out.v2 = values[1];
      if (values.length < 3) { out.error = 'ArrayIndexOutOfBoundsException: 2'; return out; }
      out.v3 = values[2];
    }
    return out;
  }
  // version 2026 : « $C1,18.42,85.0,12.3,0*cs » avec somme de contrôle XOR (façon NMEA)
  const xor = (s) => { let c = 0; for (let i = 0; i < s.length; i++) c ^= s.charCodeAt(i); return c.toString(16).toUpperCase().padStart(2, '0'); };
  const frame2026 = (k, T, F, N, valve, flags) => { const body = 'C' + (k + 1) + ',' + T.toFixed(2) + ',' + F.toFixed(1) + ',' + N.toFixed(0) + ',' + valve + ',' + flags; return '$' + body + '*' + xor(body); };
  function parse2026(line) {
    const m = /^\$([^*]+)\*([0-9A-F]{2})$/.exec(line.trim());
    if (!m || xor(m[1]) !== m[2]) return { error: 'rejetée' };
    const f = m[1].split(','); if (f.length !== 6) return { error: 'rejetée' };
    return { tank: parseInt(f[0].slice(1), 10) - 1, T: parseFloat(f[1]), F: parseFloat(f[2]), N: parseFloat(f[3]), valve: +f[4], flags: f[5] };
  }

  // ------------------------------------------------------------------ simulation (pas de 1 min)
  function createSim(opt) {
    const o = Object.assign({ prog: '2023', scenario: 'normal', loss: 0.02, seed: 7 }, opt || {});
    const S = SCENARIOS[o.scenario] || SCENARIOS.normal;
    const loss = S.loss !== undefined ? S.loss : o.loss;
    let seed = o.seed; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const tanks = [0, 1, 2, 3].map((k) => ({ h: 112 - k * 4, T: 13 + k * 0.4, N: 6 + k, valve: 0, feed: 0 }));
    const disp = { v1: 0, v2: 0, v3: 0 };                    // ce qu'affiche l'interface 2023 (cuve 1)
    const view = tanks.map(() => ({ T: null, F: null, N: null, valve: 0, flags: '', last: -1 })); // affichage 2026
    const ctl = tanks.map(() => ({ valve: 0, lastD: null, invalid: 0 }));
    const out = { t: [], T: [[], [], [], []], h: [[], [], [], []], shownFill: [], shownT: [], frames: 0, cut: 0, errors: 0, rejected: 0, alarms: [], serial: [], valveOn: [0, 0, 0, 0] };
    const log = (m) => { out.serial.push({ t: sim.t, m }); if (out.serial.length > 300) out.serial.shift(); };
    const alarmSet = new Set();
    const raise = (k, type) => { const key = k + ':' + type; if (!alarmSet.has(key)) { alarmSet.add(key); out.alarms.push({ t: sim.t, tank: k, type }); } };
    // lecture d'un capteur pour une cuve
    function sense(k) {
      const c = tanks[k], hrs = sim.t / 60;
      const unplug = S.unplug && S.unplug.tank === k && hrs >= S.unplug.from;
      const a = unplug ? 0 : adcOfTemp(c.T + 0.05 * gauss());
      const noEcho = S.noEcho && S.noEcho.tank === k && hrs >= S.noEcho.from;
      const d = noEcho ? 0 : Math.max(1, Math.round(TANK.Hs - c.h + 0.6 * gauss()));
      const V = vOfNtu(c.N) + 0.015 + 0.004 * gauss(); // léger décalage du capteur
      const adcV = S.turbAdc && S.turbAdc.tank === k ? S.turbAdc.adc : Math.max(0, Math.min(1023, Math.round((V * 1024) / 5)));
      return { a, d, adcV };
    }
    const sim = {
      t: 0, tanks, disp, view, out, opt: o, S,
      step() { // 1 minute
        const hrs = sim.t / 60, amb = S.amb[0] + S.amb[1] * Math.sin((2 * Math.PI * (hrs - 9)) / 24);
        // physique des cuves
        tanks.forEach((c, k) => {
          const leak = S.leak && S.leak.tank === k && hrs >= S.leak.from ? S.leak.rate : 0;
          const valve = o.prog === '2026' ? ctl[k].valve : 0;
          const qin = valve ? TANK.inflow : 0;
          c.h = Math.max(0, Math.min(TANK.full + 5, c.h + (qin - TANK.out - leak) / 60));
          c.T += ((amb - c.T) / TANK.tau / 60) + (qin > 0 && c.h > 1 ? ((TANK.Tin - c.T) * qin) / c.h / 60 : 0);
          if (S.feed && S.feed.some((f) => Math.abs(hrs - f) < 1 / 120)) c.N += 70;
          c.N += ((6 + k - c.N) / 2 / 60) - (qin > 0 ? ((c.N - 3) * qin) / Math.max(c.h, 1) / 60 : 0);
          if (valve) out.valveOn[k]++;
        });
        // programmes
        if (o.prog === '2023') {
          // cuve 1 seulement ; une trame représentative par minute simulée (le vrai programme en envoie ~30 par seconde)
          const s = sense(0), T = tempOfAdc(s.a), F = fill2023(s.d), V = s.adcV * (5.0 / 1024.0), N = ntuOfV(V);
          let line = fmt2(T) + ',' + fmt2(F) + ',' + fmt2(N);
          out.frames++;
          if (rnd() < loss) { line = cutFrame(line, S.cut, rnd); out.cut++; }
          const r = parse2023(line, disp);
          disp.v1 = r.v1; disp.v2 = r.v2; disp.v3 = r.v3;
          if (r.error) { out.errors++; log(line + '   → ' + r.error); } else log(line);
        } else {
          tanks.forEach((c, k) => {
            const s = sense(k), C = ctl[k];
            const T = s.a === 0 || s.a === 1023 ? null : tempOfAdc(s.a);
            let F = null; if (s.d === 0) C.invalid++; else { C.invalid = 0; F = fill2026(s.d); C.lastD = s.d; }
            const V = s.adcV * (5 / 1024); const inRange = V >= 2.5; const N = Math.max(0, ntuOfV(Math.max(2.5, Math.min(4.2, V)))); // au-dessus de 4,2 V : eau très claire (≈ 0 NTU)
            const flags = [];
            if (T === null) { flags.push('SONDE'); raise(k, 'sonde'); }
            else if (T >= 24) { flags.push('T24'); raise(k, 't24'); } else if (T >= 20) { flags.push('T20'); raise(k, 't20'); } else if (T < 3) flags.push('T3');
            if (C.invalid >= 3) { flags.push('ECHO'); raise(k, 'echo'); }
            if (!inRange) flags.push('NTU?');
            if (N > 50) { flags.push('TURB'); raise(k, 'turb'); }
            const lev = F !== null ? F : C.lastD !== null ? fill2026(C.lastD) : null;
            if (lev !== null) { if (lev < 80) C.valve = 1; else if (lev > 95) C.valve = 0; }
            if (lev !== null && lev < 50) { flags.push('NIVEAU'); raise(k, 'niveau'); }
            let line = frame2026(k, T === null ? -999 : T, lev === null ? -1 : lev, N, C.valve, flags.join('|') || 'OK');
            out.frames++;
            if (rnd() < loss) { line = cutFrame(line, S.cut, rnd); out.cut++; }
            const r = parse2026(line);
            if (r.error) { out.rejected++; if (k === 0) log(line + '   → ' + r.error); }
            else { view[r.tank] = { T: r.T === -999 ? null : r.T, F: r.F < 0 ? null : r.F, N: r.N, valve: r.valve, flags: r.flags, last: sim.t }; if (k === 0) log(line); }
          });
        }
        sim.t += 1;
        if (sim.t % 5 === 0) {
          out.t.push(sim.t / 60); tanks.forEach((c, k) => { out.T[k].push(c.T); out.h[k].push((c.h / TANK.full) * 100); });
          out.shownFill.push(o.prog === '2023' ? disp.v2 : view[0].F); out.shownT.push(o.prog === '2023' ? disp.v1 : view[0].T);
        }
      },
      run(hours) { while (sim.t < hours * 60) sim.step(); return sim; },
    };
    return sim;
  }
  function summary(sim) {
    const o = sim.out, firstAlarm = (type, k) => { const a = o.alarms.find((x) => x.type === type && (k === undefined || x.tank === k)); return a ? a.t / 60 : null; };
    return { minLevel: Math.min(...sim.tanks.map((c) => (c.h / TANK.full) * 100)), maxT: Math.max(...o.T.flat()), alarms: o.alarms.map((a) => a.type), frames: o.frames, cut: o.cut, errors: o.errors, rejected: o.rejected, firstAlarm, disp: Object.assign({}, sim.disp) };
  }
  return { THERM, adcOfTemp, tempOfAdc, ntuOfV, vOfNtu, fill2023, fill2026, fmt2, TANK, SCENARIOS, cutFrame, parse2023, parse2026, frame2026, xor, createSim, summary };
});
