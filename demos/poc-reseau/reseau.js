// =====================================================================
//  Moteur du simulateur de flux du PoC réseau de téléradiologie.
//  Modèle construit à partir des fichiers du dépôt
//  github.com/Valentin-Auger-Laboratoire/poc-reseau-teleradiologie :
//  configs/vyos.conf (interfaces, routes, rulesets) et configs/R-*.cfg.
// =====================================================================
(function (root) {
  'use strict';

  // ---------- Adresses IPv4 ----------
  const ip2n = (ip) => ip.split('.').reduce((a, b) => a * 256 + +b, 0);
  function inNet(ip, cidr) {
    const [net, len] = cidr.split('/');
    const mask = len == 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
    return ((ip2n(ip) & mask) >>> 0) === ((ip2n(net) & mask) >>> 0);
  }

  // ---------- Hôtes de démonstration (adresses du plan d'adressage J4) ----------
  const HOSTS = {
    'pc-paris':    { ip: '172.16.10.10',   zone: 'paris',     vlan: 10, label: { fr: 'PC Paris (VLAN 10 USERS)', en: 'Paris PC (VLAN 10 USERS)' } },
    'srv-paris':   { ip: '172.16.20.10',   zone: 'paris',     vlan: 20, label: { fr: 'Serveur Paris (VLAN 20)', en: 'Paris server (VLAN 20)' } },
    'pc-lyon':     { ip: '172.17.10.10',   zone: 'lyon',      vlan: 10, label: { fr: 'PC Lyon (VLAN 10 USERS)', en: 'Lyon PC (VLAN 10 USERS)' } },
    'irm-lyon':    { ip: '172.17.40.10',   zone: 'lyon',      vlan: 40, label: { fr: 'IRM Lyon (VLAN 40 IMAGERIE)', en: 'Lyon MRI (VLAN 40 IMAGING)' } },
    'pc-marseille':{ ip: '172.18.10.10',   zone: 'marseille', vlan: 10, label: { fr: 'PC Marseille (VLAN 10 USERS)', en: 'Marseille PC (VLAN 10 USERS)' } },
    'web-dmz':     { ip: '192.168.101.10', zone: 'dmz',       label: { fr: 'Serveur web TeleRad Pro (DMZ)', en: 'TeleRad Pro web server (DMZ)' } },
    'pc-cloud':    { ip: '192.168.201.10', zone: 'cloud',     label: { fr: 'PC Cloud HDS', en: 'HDS Cloud PC' } },
    'vm-radio':    { ip: '192.168.11.10',  zone: 'radio',     label: { fr: 'VM Radiologue (extranet)', en: 'Radiologist VM (extranet)' } },
    'vm-etabli':   { ip: '192.168.21.10',  zone: 'etabli',    label: { fr: 'VM Établissement (extranet)', en: 'Facility VM (extranet)' } },
  };

  const SERVICES = {
    icmp:  { proto: 'icmp', port: null, label: { fr: 'Ping (ICMP)', en: 'Ping (ICMP)' } },
    https: { proto: 'tcp',  port: 443,  label: { fr: 'HTTPS (TCP 443)', en: 'HTTPS (TCP 443)' } },
    http:  { proto: 'tcp',  port: 80,   label: { fr: 'HTTP (TCP 80)', en: 'HTTP (TCP 80)' } },
    dicom: { proto: 'tcp',  port: 104,  label: { fr: 'DICOM (TCP 104)', en: 'DICOM (TCP 104)' } },
    ssh:   { proto: 'tcp',  port: 22,   label: { fr: 'SSH (TCP 22)', en: 'SSH (TCP 22)' } },
  };

  // Zone -> routeur d'accès et interface VyOS par laquelle la zone est jointe
  const ZONES = {
    paris:     { router: 'R-Paris',      vyos: 'eth2', site: true },
    lyon:      { router: 'R-Lyon',       vyos: 'eth2', site: true },
    marseille: { router: 'R-Marseille',  vyos: 'eth2', site: true },
    dmz:       { router: 'R-DMZ',        vyos: 'eth4' },
    cloud:     { router: 'R-Cloud',      vyos: 'eth1' },
    radio:     { router: 'R-Ext-Radio',  vyos: 'eth3' },
    etabli:    { router: 'R-Ext-Etabli', vyos: 'eth5' },
  };

  // ---------- Rulesets VyOS (copie fidèle de configs/vyos.conf) ----------
  const RULESETS = {
    'DMZ-IN': { def: 'drop', rules: [
      { n: 5,  action: 'accept', src: '192.168.100.1/32' },
      { n: 10, action: 'accept', proto: 'tcp', dport: 443 },
      { n: 20, action: 'accept', proto: 'tcp', dport: 104 },
      { n: 30, action: 'accept', proto: 'icmp' },
      { n: 35, action: 'accept', src: '10.0.1.0/24' },
      { n: 36, action: 'accept', src: '172.16.0.0/16' },
      { n: 37, action: 'accept', src: '172.17.0.0/16' },
      { n: 38, action: 'accept', src: '172.18.0.0/16' },
    ] },
    'RADIO-IN': { def: 'drop', rules: [
      { n: 10, action: 'accept', src: '192.168.11.0/24', dst: '192.168.101.0/24' },
      { n: 20, action: 'accept', src: '192.168.11.0/24', dst: '192.168.201.0/24' },
      { n: 30, action: 'accept', proto: 'icmp' },
    ] },
    'ETABLI-IN': { def: 'drop', rules: [
      { n: 10, action: 'accept', src: '192.168.21.0/24', dst: '192.168.101.0/24' },
      { n: 20, action: 'accept', proto: 'icmp' },
    ] },
  };
  // forward filter : interface d'entrée -> ruleset (eth1 et eth2 : aucun)
  const FORWARD = { eth4: 'DMZ-IN', eth3: 'RADIO-IN', eth5: 'ETABLI-IN' };

  function ruleMatches(r, pkt) {
    if (r.proto && r.proto !== pkt.proto) return false;
    if (r.dport != null && r.dport !== pkt.port) return false;
    if (r.src && !inNet(pkt.src, r.src)) return false;
    if (r.dst && !inNet(pkt.dst, r.dst)) return false;
    return true;
  }

  function evalRuleset(name, pkt) {
    const rs = RULESETS[name];
    for (const r of rs.rules) if (ruleMatches(r, pkt)) return { action: r.action, rule: r.n };
    return { action: rs.def, rule: 'default' };
  }

  // ---------- Simulation d'un flux ----------
  function simulate(srcId, dstId, svcId) {
    const s = HOSTS[srcId], d = HOSTS[dstId], svc = SERVICES[svcId];
    const pkt = { src: s.ip, dst: d.ip, proto: svc.proto, port: svc.port };
    const zs = ZONES[s.zone], zd = ZONES[d.zone];
    const res = { pkt, path: [], firewall: null, verdict: 'accept', notes: [] };
    const host = (id) => 'host:' + id;

    if (srcId === dstId) { res.path = [host(srcId)]; res.notes.push('same'); return res; }

    // Même site : routage inter-VLAN (router-on-a-stick) ou même VLAN
    if (s.zone === d.zone) {
      res.path = [host(srcId), zs.router, host(dstId)];
      res.notes.push(s.vlan === d.vlan ? 'sameVlan' : 'interVlan');
      if (s.vlan === 40 || d.vlan === 40) res.notes.push('imagerie');
      return res;
    }
    // Entre deux sites : OSPF sans passer par le pare-feu
    if (zs.site && zd.site) {
      const pair = [s.zone, d.zone].sort().join('-');
      if (pair === 'lyon-marseille') { res.path = [host(srcId), zs.router, 'SW-WAN', zd.router, host(dstId)]; res.notes.push('ospfInit'); }
      else res.path = [host(srcId), zs.router, zd.router, host(dstId)];
      res.notes.push('ospfSites');
      if (s.vlan === 40 || d.vlan === 40) res.notes.push('imagerie');
      return res;
    }
    // Sinon : passage par le pare-feu VyOS
    const inIf = zs.vyos, outIf = zd.vyos;
    const before = zs.site ? [host(srcId), zs.router, 'SW-WAN'] : [host(srcId), zs.router];
    const after = zd.site ? ['SW-WAN', zd.router, host(dstId)] : [zd.router, host(dstId)];
    res.path = [...before, 'VyOS', ...after];
    res.inIf = inIf; res.outIf = outIf;
    const rsName = FORWARD[inIf];
    if (!rsName) {
      res.firewall = { ruleset: null, action: 'accept', rule: null };
      res.notes.push(zs.site ? 'noFilterSites' : 'noFilterCloud');
    } else {
      const r = evalRuleset(rsName, pkt);
      res.firewall = { ruleset: rsName, ...r };
      res.verdict = r.action;
      if (rsName === 'RADIO-IN' && r.rule === 30 && zd.site) res.notes.push('t05');
      if (r.action === 'drop') res.notes.push('dropped');
    }
    if (res.verdict === 'accept') res.notes.push('stateful');
    if (svc.port === 80 || svc.port === 104) res.notes.push('clair');
    return res;
  }

  root.ReseauPoC = { HOSTS, SERVICES, RULESETS, FORWARD, simulate, inNet };
  if (typeof module !== 'undefined') module.exports = root.ReseauPoC;
})(typeof window !== 'undefined' ? window : globalThis);
