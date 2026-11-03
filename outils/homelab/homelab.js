// =====================================================================
//  Tableau de bord homelab : moteur de supervision (sans interface).
//  - Monitor : sonde chaque service à intervalle régulier, garde un
//    historique, calcule l'état (up / degraded / down) et journalise
//    chaque changement d'état.
//  - simProbe : sonde simulée (homelab fictif de démonstration).
//  - httpProbe : vraie sonde HTTP depuis le navigateur (fetch no-cors :
//    une réponse, même opaque, compte comme « joignable »).
// =====================================================================
(function (root) {
  'use strict';

  // ---------- Règles d'état ----------
  // down     : au moins `failThreshold` échecs consécutifs
  // degraded : joignable mais latence > warnMs, ou échec isolé
  // up       : joignable sous le seuil
  function nextStatus(s, r, cfg) {
    if (!r.ok) {
      s.fails += 1;
      return s.fails >= cfg.failThreshold ? 'down' : (s.status === 'down' ? 'down' : 'degraded');
    }
    s.fails = 0;
    return r.ms > (s.svc.warnMs || cfg.warnMs) ? 'degraded' : 'up';
  }

  function Monitor(cfg) {
    const conf = { warnMs: 150, failThreshold: 3, history: 60, ...cfg };
    const states = conf.services.map((svc) => ({ svc, hist: [], status: 'unknown', fails: 0, ok: 0, total: 0, since: null }));
    const events = [];
    let busy = false;

    async function tick(now) {
      if (busy) return false;
      busy = true;
      try {
        const results = await Promise.all(states.map((s) => conf.probe(s.svc, now).catch(() => ({ ok: false, ms: null }))));
        results.forEach((r, i) => {
          const s = states[i];
          s.hist.push({ t: now, ok: r.ok, ms: r.ok ? r.ms : null });
          if (s.hist.length > conf.history) s.hist.shift();
          s.total += 1; if (r.ok) s.ok += 1;
          const st = nextStatus(s, r, conf);
          if (st !== s.status) {
            if (s.status !== 'unknown' || st !== 'up') events.unshift({ t: now, id: s.svc.id, from: s.status, to: st, ms: r.ms });
            s.status = st; s.since = now;
          }
        });
        if (events.length > 200) events.length = 200;
        return true;
      } finally { busy = false; }
    }

    function summary() {
      const up = states.filter((s) => s.status === 'up').length;
      const okMs = states.flatMap((s) => s.hist.filter((h) => h.ok).slice(-1).map((h) => h.ms));
      const avg = okMs.length ? okMs.reduce((a, b) => a + b, 0) / okMs.length : null;
      const ok = states.reduce((a, s) => a + s.ok, 0), total = states.reduce((a, s) => a + s.total, 0);
      return { up, total: states.length, avgMs: avg, availability: total ? ok / total : null,
        down: states.filter((s) => s.status === 'down').length, degraded: states.filter((s) => s.status === 'degraded').length };
    }
    return { tick, states, events, summary, conf };
  }

  // ---------- PRNG déterministe (mulberry32) ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- Sonde simulée ----------
  // Chaque service a une latence de base et une gigue ; de rares pics et
  // pertes de paquets ; et des pannes forcées (bouton « Provoquer une panne »).
  function simProbe(seed) {
    const rand = rng(seed || 7);
    const forced = new Map(); // id -> nombre de sondes restantes en panne
    const slow = new Map();   // id -> nombre de sondes restantes ralenties
    function probe(svc) {
      const f = forced.get(svc.id);
      if (f) { forced.set(svc.id, f - 1); if (f - 1 <= 0) forced.delete(svc.id); return Promise.resolve({ ok: false, ms: null }); }
      if (rand() < (svc.loss || 0.004)) return Promise.resolve({ ok: false, ms: null });
      let ms = svc.base * (0.8 + rand() * 0.4) + (rand() < 0.03 ? svc.base * (2 + rand() * 4) : 0);
      const s = slow.get(svc.id);
      if (s) { slow.set(svc.id, s - 1); if (s - 1 <= 0) slow.delete(svc.id); ms += 180 + rand() * 120; }
      return Promise.resolve({ ok: true, ms: Math.round(ms * 10) / 10 });
    }
    probe.outage = (id, n) => forced.set(id, n);
    probe.slowdown = (id, n) => slow.set(id, n);
    probe.rand = rand;
    return probe;
  }

  // ---------- Ressources simulées (NAS, serveur domotique) ----------
  function simResources(seed) {
    const rand = rng((seed || 7) * 31);
    const r = { disk: 71.4, cpu: 14, ram: 52, temp: 38 };
    return {
      get: () => ({ ...r }),
      step(extraDisk) {
        r.disk = Math.min(99.5, r.disk + 0.01 + (extraDisk || 0));
        r.cpu = Math.max(3, Math.min(100, r.cpu + (rand() - 0.5) * 8 + (rand() < 0.03 ? 35 : 0) - (r.cpu > 30 ? 4 : 0)));
        r.ram = Math.max(30, Math.min(97, r.ram + (rand() - 0.5) * 2));
        r.temp = Math.max(30, Math.min(70, r.temp + (rand() - 0.5) * 0.8 + (r.cpu > 50 ? 0.6 : 0) - (r.temp > 42 ? 0.3 : 0)));
        return { ...r };
      },
    };
  }
  // seuils : à vérifier au-delà de warn, critique au-delà de crit
  const RES_LIMITS = { disk: [80, 90], cpu: [70, 90], ram: [80, 90], temp: [50, 60] };
  const level = (key, v) => (v >= RES_LIMITS[key][1] ? 'crit' : v >= RES_LIMITS[key][0] ? 'warn' : 'ok');

  // ---------- Vraie sonde HTTP ----------
  function httpProbe(timeoutMs) {
    return async function (svc) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs || 3000);
      const t0 = performance.now();
      try {
        const sep = svc.url.includes('?') ? '&' : '?';
        await fetch(svc.url + sep + '_=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
        return { ok: true, ms: Math.round((performance.now() - t0) * 10) / 10 };
      } catch (e) {
        return { ok: false, ms: null };
      } finally { clearTimeout(timer); }
    };
  }

  // ---------- Validation d'une configuration JSON ----------
  function parseConfig(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { error: 'json' }; }
    const list = Array.isArray(data) ? data : data && data.services;
    if (!Array.isArray(list) || !list.length) return { error: 'empty' };
    const ids = new Set(), services = [];
    for (const [i, s] of list.entries()) {
      if (!s || typeof s.name !== 'string' || !s.name.trim()) return { error: 'name', i: i + 1 };
      let u;
      try { u = new URL(s.url); } catch (e) { return { error: 'url', i: i + 1 }; }
      if (!/^https?:$/.test(u.protocol)) return { error: 'url', i: i + 1 };
      let id = String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      while (ids.has(id)) id += '-';
      ids.add(id);
      services.push({ id, name: s.name.trim().slice(0, 40), url: u.href, host: u.host, kind: String(s.kind || '').slice(0, 30), warnMs: +s.warnMs > 0 ? +s.warnMs : undefined });
    }
    if (services.length > 30) return { error: 'tooMany' };
    return { services, interval: Math.max(5, Math.min(300, +data.interval || 15)) };
  }

  const api = { Monitor, simProbe, simResources, httpProbe, parseConfig, level, RES_LIMITS, nextStatus };
  root.Homelab = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
