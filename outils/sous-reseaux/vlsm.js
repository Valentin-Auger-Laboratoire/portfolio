// =====================================================================
//  Calculateur de sous-réseaux IPv4 et découpage VLSM.
//  VLSM : on trie les besoins du plus grand au plus petit, puis on
//  attribue à chacun le plus petit bloc (puissance de 2) qui contient
//  ses hôtes + l'adresse réseau + l'adresse de broadcast, en avançant
//  dans la plage sans chevauchement. Les blocs restent alignés sur leur
//  taille, ce qui garantit des sous-réseaux valides.
// =====================================================================
(function (root) {
  'use strict';

  const U32 = 0x100000000;

  function parseIp(str) {
    const m = String(str).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const o = m.slice(1).map(Number);
    if (o.some((v) => v > 255)) return null;
    return ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
  }
  const ipStr = (n) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');
  const blockSize = (prefix) => 2 ** (32 - prefix);
  const maskOf = (prefix) => U32 - blockSize(prefix);
  const toBin = (n) => [24, 16, 8, 0].map((s) => (Math.floor(n / 2 ** s) % 256).toString(2).padStart(8, '0')).join('.');

  // "172.16.0.0/16" -> { network, prefix } (l'adresse est ramenée au début du réseau)
  function parseCidr(str) {
    const m = String(str).trim().match(/^([\d.]+)\s*\/\s*(\d{1,2})$/);
    if (!m) return null;
    const ip = parseIp(m[1]), prefix = +m[2];
    if (ip === null || prefix < 0 || prefix > 32) return null;
    const size = blockSize(prefix);
    return { network: ip - (ip % size), prefix, given: ip };
  }

  // Plus petit préfixe qui contient h hôtes utilisables (2 adresses réservées ;
  // /31 pour un lien point à point de 2 hôtes selon la RFC 3021 si autorisé)
  function prefixFor(hosts, allow31) {
    if (allow31 && hosts === 2) return 31;
    if (hosts === 1) return 32 - 2; // /30 minimum pour un hôte classique
    for (let p = 30; p >= 0; p--) if (blockSize(p) - 2 >= hosts) return p;
    return null;
  }

  function describe(network, prefix) {
    const size = blockSize(prefix), bc = network + size - 1;
    const p2p = prefix >= 31;
    return {
      network, prefix, size,
      mask: maskOf(prefix), wildcard: size - 1, broadcast: p2p ? null : bc,
      first: p2p ? network : network + 1, last: p2p ? bc : bc - 1,
      usable: prefix === 32 ? 1 : prefix === 31 ? 2 : size - 2,
      cls: (() => { const o = Math.floor(network / 2 ** 24); return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D' : 'E'; })(),
      private: [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16]].some(([n, p]) => network - (network % blockSize(p)) === parseIp(n) && prefix >= p),
    };
  }

  // Découpage VLSM. needs = [{ name, hosts }]
  function vlsm(baseCidr, needs, opts) {
    opts = opts || {};
    const base = parseCidr(baseCidr);
    if (!base) return { error: 'cidr' };
    const baseSize = blockSize(base.prefix), end = base.network + baseSize;
    const items = needs.map((n, i) => ({ ...n, idx: i, hosts: Math.floor(+n.hosts) }));
    if (items.some((n) => !(n.hosts >= 1))) return { error: 'hosts' };
    items.forEach((n) => (n.prefix = prefixFor(n.hosts, opts.allow31)));
    if (items.some((n) => n.prefix === null || n.prefix < base.prefix)) return { error: 'tooBig', base: describe(base.network, base.prefix) };
    // Tri : du plus grand bloc au plus petit (à taille égale, ordre de saisie)
    const order = items.slice().sort((a, b) => a.prefix - b.prefix || a.idx - b.idx);
    let cursor = base.network;
    const out = [];
    for (const n of order) {
      const size = blockSize(n.prefix);
      if (cursor % size) cursor += size - (cursor % size); // alignement
      if (cursor + size > end) return { error: 'full', base: describe(base.network, base.prefix), placed: out };
      out.push({ name: n.name, hosts: n.hosts, ...describe(cursor, n.prefix), wasted: (n.prefix >= 31 ? 2 : blockSize(n.prefix) - 2) - n.hosts });
      cursor += size;
    }
    const used = out.reduce((a, s) => a + s.size, 0);
    return {
      base: describe(base.network, base.prefix), subnets: out,
      used, free: baseSize - used, nextFree: cursor < end ? ipStr(cursor) : null,
      adjusted: base.given !== base.network,
    };
  }

  // Lignes CSV (séparateur ;) pour export
  function toCsv(res, headers) {
    const rows = [headers];
    res.subnets.forEach((s) => rows.push([s.name, s.hosts, ipStr(s.network) + '/' + s.prefix, ipStr(s.mask),
      ipStr(s.first), ipStr(s.first) + ' - ' + ipStr(s.last), s.broadcast === null ? '-' : ipStr(s.broadcast), s.usable, s.wasted]));
    return rows.map((r) => r.map((c) => (/[;"\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c)).join(';')).join('\n');
  }

  root.VLSM = { parseIp, ipStr, parseCidr, prefixFor, describe, vlsm, toBin, maskOf, blockSize, toCsv };
  if (typeof module !== 'undefined') module.exports = root.VLSM;
})(typeof window !== 'undefined' ? window : globalThis);
