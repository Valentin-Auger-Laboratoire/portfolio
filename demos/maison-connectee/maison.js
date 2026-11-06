/* Maison connectée : régulation de température (Tle STI2D SIN, novembre 2022).
   - 2022 : mon programme Arduino porté fidèlement (version téléversée) : capteur Grove (thermistance B = 4275, R0 = 100 kΩ) sur A0,
     relayPin = 4 (ventilateur), digPin = 2 (chauffage), seuils 26 / 26,1 / 29,9 / 30 °C, delay(100) + delay(1000) + delay(1000).
   - 2026 : version corrigée : hystérésis réglable, défaut de sonde détecté (chauffage coupé), boucle sans delay(), écran effacé.
   - Maquette thermique de la pièce (HYPOTHÈSES, réglables) : capacité 4 000 J/K, pertes 1 W/K, chauffage 20 W, ventilateur +3 W/K
     d'échange avec l'extérieur ; bruit de mesure de ±1 point du convertisseur.
   Utilisable dans le navigateur (window.Maison) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Maison = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const B = 4275, R0 = 100000, K0 = 273.15;
  // ---------------------------------------------------------------- capteur Grove (thermistance) et conversion du programme
  // module : a = 1023 / (1 + R/R0) avec R = R0·exp(B(1/T − 1/298,15))  (inverse exact de la formule du programme)
  function adcFromT(T) { const r = Math.exp(B * (1 / (T + K0) - 1 / 298.15)); return 1023 / (1 + r); }
  // la formule de mon programme, telle quelle (y compris a = 0 ou a = 1023, sonde débranchée ou en court-circuit)
  function tempFromAdc(a) {
    let R = 1023.0 / a - 1.0;
    R = R0 * R;
    return 1.0 / (Math.log(R / R0) / B + 1 / 298.15) - K0;
  }
  const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2); // print(float) d'Arduino : 2 décimales

  // ---------------------------------------------------------------- régulation 2022 (version téléversée, chaîne de if / else)
  // renvoie l'état des sorties après un passage dans loop() et la durée des delay() exécutés (ms)
  function ctrl2022(T, s) {
    const o = { fan: s.fan, heat: s.heat };
    let wait = 100 + 1000;
    if (T > 26.1 && T <= 29.9) { o.fan = 0; o.heat = 0; wait += 1000; }
    else if (T <= 26) { o.fan = 0; o.heat = 1; wait += 1000; }
    else if (T > 30) { o.heat = 0; o.fan = 1; wait += 1000; }
    // 26 < T ≤ 26,1 ou 29,9 < T ≤ 30 : aucun if n'est vrai, les sorties gardent leur état
    return { out: o, wait };
  }
  // ---------------------------------------------------------------- régulation 2026
  // cfg : { hOn, hOff, fOn, fOff } (chauffage allumé sous hOn, éteint au-dessus de hOff ; ventilateur allumé au-dessus de fOn, éteint sous fOff)
  const CFG26 = { hOn: 25, hOff: 26, fOn: 30, fOff: 29 };
  function ctrl2026(a, s, cfg) {
    const c = Object.assign({}, CFG26, cfg || {}), o = { fan: s.fan, heat: s.heat, fault: false };
    if (a < 10 || a > 1013) { o.fan = 0; o.heat = 0; o.fault = true; return o; } // sonde débranchée ou en court-circuit : tout couper
    const T = tempFromAdc(a);
    if (T < c.hOn) o.heat = 1; else if (T > c.hOff) o.heat = 0;
    if (T > c.fOn) o.fan = 1; else if (T < c.fOff) o.fan = 0;
    if (o.heat && o.fan) o.fan = 0; // jamais les deux à la fois
    return o;
  }
  // ---------------------------------------------------------------- écran LCD 16×2 (la ligne 2 n'est jamais effacée en 2022)
  function lcdWrite(line, text) { return (text + line.slice(text.length)).slice(0, 16).padEnd(16, ' '); }

  // ---------------------------------------------------------------- simulation d'une journée
  const PLANT = { C: 4000, G: 1, Ph: 20, Gf: 3 }; // J/K, W/K, W, W/K
  const SCEN = {
    winter: { T0: 22, ext: (t) => 12 - 3 * Math.cos((2 * Math.PI * (t / 3600 - 4)) / 24), sun: 0 },
    summer: { T0: 27, ext: (t) => 27 + 7 * Math.sin((2 * Math.PI * (t / 3600 - 9)) / 24), sun: 8 },
    mild: { T0: 24, ext: (t) => 21 + 2 * Math.sin((2 * Math.PI * (t / 3600 - 9)) / 24), sun: 0 },
  };
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  // o : { scen, hours, noise (points de CAN), unplug (s, instant où la sonde se débranche), version: '2022' | '2026', cfg, plant, seed, every }
  function simulate(o) {
    const opt = Object.assign({ scen: 'winter', hours: 12, noise: 1, unplug: null, version: '2022', cfg: null, plant: null, seed: 3, every: 30 }, o || {});
    const sc = opt.ext ? { T0: opt.T0 === undefined ? 20 : opt.T0, ext: opt.ext, sun: 0 } : SCEN[opt.scen], P = Object.assign({}, PLANT, opt.plant || {}), r = rng(opt.seed), t1 = opt.hours * 3600;
    let T = sc.T0, s = { fan: 0, heat: 0 }, next = 0, sw = 0, heatOn = 0, fanOn = 0, both = 0, fault = false, lcd = '                ';
    const out = { t: [], T: [], Text: [], Tmes: [], heat: [], fan: [], serial: [], lcd: [] };
    let Tmes = NaN, k = 0;
    for (let t = 0; t <= t1; t++) {
      const Text = sc.ext(t);
      if (t >= next) {
        // lecture du capteur
        let a;
        if (opt.unplug !== null && t >= opt.unplug) a = 0;
        else a = Math.max(0, Math.min(1023, Math.round(adcFromT(T) + opt.noise * (r() * 2 - 1))));
        const prev = { fan: s.fan, heat: s.heat };
        if (opt.version === '2022') {
          Tmes = tempFromAdc(a);
          const c = ctrl2022(Tmes, s); s = c.out; next = t + c.wait / 1000;
          lcd = lcdWrite(lcd, f2(Tmes));
          out.serial.push([t, 'temperature = ' + f2(Tmes)]);
        } else {
          const c = ctrl2026(a, s, opt.cfg); s = { fan: c.fan, heat: c.heat }; fault = c.fault; next = t + 1;
          Tmes = c.fault ? NaN : tempFromAdc(a);
          lcd = (c.fault ? 'DEFAUT SONDE' : f2(Tmes) + ' C ' + (s.heat ? 'CHAUF' : s.fan ? 'VENT' : 'OK')).padEnd(16, ' ');
          if (t % 10 === 0 || prev.fan !== s.fan || prev.heat !== s.heat) out.serial.push([t, (c.fault ? 'DEFAUT;' : f2(Tmes) + ';') + s.heat + ';' + s.fan]);
        }
        if (prev.fan !== s.fan) sw++;
        if (prev.heat !== s.heat) sw++;
      }
      // maquette thermique de la pièce (pas de 1 s)
      const G = P.G + (s.fan ? P.Gf : 0), sun = sc.sun * Math.max(0, Math.sin((2 * Math.PI * (t / 3600 - 7)) / 24));
      T += ((s.heat ? P.Ph : 0) + sun - G * (T - Text)) / P.C;
      if (s.heat) heatOn++; if (s.fan) fanOn++; if (s.heat && s.fan) both++;
      if (k++ % opt.every === 0) { out.t.push(t); out.T.push(T); out.Text.push(Text); out.Tmes.push(Tmes); out.heat.push(s.heat); out.fan.push(s.fan); out.lcd.push(lcd); }
    }
    return Object.assign(out, { switches: sw, heatH: heatOn / 3600, fanH: fanOn / 3600, both, Tmax: Math.max(...out.T), Tmin: Math.min(...out.T), fault, opt, plant: P });
  }
  return { B, R0, adcFromT, tempFromAdc, f2, ctrl2022, ctrl2026, CFG26, lcdWrite, PLANT, SCEN, simulate };
});
