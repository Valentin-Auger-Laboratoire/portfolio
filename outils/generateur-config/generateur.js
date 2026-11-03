// =====================================================================
//  Générateur de configuration réseau : moteur (sans interface).
//  - cisco(site) : routeur Cisco IOS en router-on-a-stick (sous-interfaces
//    802.1Q, DHCP, OSPF, SSH) + commutateur d'accès (VLAN, trunk, ports).
//  - vyos(fw)    : pare-feu VyOS (interfaces, rulesets, forward filter,
//    OSPF) avec analyse des règles (règles masquées, doublons, interfaces
//    non filtrées).
//  Chaque fonction renvoie le texte généré et une liste de problèmes
//  { lvl: 'err' | 'warn', code, p: {paramètres} } traduits par la page.
//  Aucun mot de passe n'est saisi ni généré : un marqueur <MOT_DE_PASSE>
//  est laissé à la place.
// =====================================================================
(function (root) {
  'use strict';

  // ---------- IPv4 ----------
  function parseIp(s) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());
    if (!m) return null;
    const o = m.slice(1).map(Number);
    if (o.some((x) => x > 255)) return null;
    return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
  }
  const ipStr = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  // "a.b.c.d/p" (ou "a.b.c.d" = /32) -> { ip, prefix, net, bcast }
  function parseCidr(s, defPrefix) {
    const str = String(s).trim();
    const [a, b] = str.split('/');
    const ip = parseIp(a);
    if (ip === null) return null;
    let prefix = defPrefix;
    if (b !== undefined) {
      if (!/^\d{1,2}$/.test(b) || +b > 32) return null;
      prefix = +b;
    }
    if (prefix === undefined) return null;
    const net = (ip & maskOf(prefix)) >>> 0;
    return { ip, prefix, net, bcast: (net + 2 ** (32 - prefix) - 1) >>> 0 };
  }
  const contains = (outer, inner) => inner.net >= outer.net && inner.bcast <= outer.bcast;
  const overlaps = (a, b) => a.net <= b.bcast && b.net <= a.bcast;
  const cidrStr = (c) => ipStr(c.net) + '/' + c.prefix;

  // ---------- Ports d'un commutateur Cisco ----------
  // "Fa0/1-10, Gi0/1" -> [{ type, slot, from, to }]
  const IF_ABBR = { f: 'FastEthernet', fa: 'FastEthernet', fastethernet: 'FastEthernet', g: 'GigabitEthernet', gi: 'GigabitEthernet', gigabitethernet: 'GigabitEthernet', e: 'Ethernet', et: 'Ethernet', eth: 'Ethernet', ethernet: 'Ethernet' };
  function parsePorts(s) {
    const out = [];
    const txt = String(s || '').trim();
    if (!txt) return out;
    for (const tok of txt.split(',')) {
      const m = /^([A-Za-z]+)\s*((?:\d+\/)+)(\d+)(?:\s*-\s*(\d+))?$/.exec(tok.trim());
      if (!m) return null;
      const type = IF_ABBR[m[1].toLowerCase()];
      if (!type) return null;
      const from = +m[3], to = m[4] !== undefined ? +m[4] : from;
      if (to < from) return null;
      out.push({ type, slot: m[2], from, to });
    }
    return out;
  }
  const portKey = (type, slot, n) => type + slot + n;
  function parseIfName(s) {
    const m = /^([A-Za-z]+)\s*((?:\d+\/)*\d+)$/.exec(String(s || '').trim());
    if (!m) return null;
    const type = IF_ABBR[m[1].toLowerCase()];
    return type ? type + m[2] : null;
  }

  const HOSTNAME = /^[A-Za-z][A-Za-z0-9-]{0,62}$/;
  const NAME = /^[A-Za-z0-9_-]{1,32}$/;

  // =================================================================
  //  Cisco : routeur (router-on-a-stick) + commutateur d'accès
  // =================================================================
  function cisco(site) {
    const issues = [];
    const err = (code, p) => issues.push({ lvl: 'err', code, p: p || {} });
    const warn = (code, p) => issues.push({ lvl: 'warn', code, p: p || {} });

    if (!HOSTNAME.test(site.router || '')) err('hostname', { v: site.router || '' });
    if (!HOSTNAME.test(site.switch || '')) err('hostname', { v: site.switch || '' });
    const trunkIf = parseIfName(site.trunkIf);
    if (!trunkIf) err('ifname', { v: site.trunkIf || '' });
    const uplink = parseIfName(site.uplinkIf);
    if (!uplink) err('ifname', { v: site.uplinkIf || '' });

    // --- VLAN ---
    const vlans = [];
    const ids = new Set(), usedPorts = new Map();
    if (uplink) usedPorts.set(uplink, 'trunk');
    if (!site.vlans.length) err('noVlan');
    for (const v of site.vlans) {
      const id = Number(v.id);
      const tag = v.name || String(v.id);
      if (!Number.isInteger(id) || id < 1 || id > 4094) { err('vlanId', { v: v.id }); continue; }
      if (id >= 1002 && id <= 1005) { err('vlanReserved', { v: id }); continue; }
      if (id === 1) warn('vlan1');
      if (ids.has(id)) { err('vlanDup', { v: id }); continue; }
      ids.add(id);
      if (!NAME.test(v.name || '')) err('vlanName', { v: v.name || '', id });
      const c = parseCidr(v.cidr);
      if (!c) { err('cidr', { v: v.cidr, n: tag }); continue; }
      if (c.prefix > 30) { err('prefixTooLong', { v: v.cidr, n: tag }); continue; }
      if (c.ip !== c.net) { err('notNetwork', { v: v.cidr, n: tag, s: cidrStr(c) }); continue; }
      const ports = parsePorts(v.ports);
      if (ports === null) { err('ports', { v: v.ports, n: tag }); continue; }
      if (!ports.length) warn('noPorts', { n: tag });
      for (const p of ports) {
        for (let k = p.from; k <= p.to; k++) {
          const key = portKey(p.type, p.slot, k);
          if (usedPorts.has(key)) err('portDup', { v: key, a: usedPorts.get(key), b: tag });
          else usedPorts.set(key, tag);
        }
      }
      vlans.push({ id, name: v.name, c, gw: c.net + 1, dhcp: !!v.dhcp, ports });
    }
    vlans.sort((a, b) => a.id - b.id);

    // --- Lien WAN ---
    let wan = null;
    if (site.wanIf || site.wanCidr) {
      const wIf = parseIfName(site.wanIf);
      const wc = parseCidr(site.wanCidr);
      if (!wIf) err('ifname', { v: site.wanIf || '' });
      else if (wIf === trunkIf) err('wanIsTrunk');
      if (!wc) err('cidr', { v: site.wanCidr || '', n: 'WAN' });
      else if (wc.prefix < 31 && (wc.ip === wc.net || wc.ip === wc.bcast)) err('wanHost', { v: site.wanCidr });
      else if (wIf) wan = { ifn: wIf, c: wc };
    }

    // --- Chevauchements ---
    const nets = vlans.map((v) => ({ n: v.name || v.id, c: v.c }));
    if (wan) nets.push({ n: 'WAN', c: wan.c });
    for (let i = 0; i < nets.length; i++)
      for (let j = i + 1; j < nets.length; j++)
        if (overlaps(nets[i].c, nets[j].c)) err('overlap', { a: nets[i].n, b: nets[j].n });

    // --- OSPF / SSH ---
    const o = site.ospf || {};
    if (o.enabled) {
      if (!(Number.isInteger(+o.pid) && +o.pid >= 1 && +o.pid <= 65535)) err('ospfPid', { v: o.pid });
      if (!(Number.isInteger(+o.area) && +o.area >= 0)) err('ospfArea', { v: o.area });
      if (parseIp(o.rid) === null) err('rid', { v: o.rid });
      if (!wan) warn('ospfNoWan');
    }
    const ssh = site.ssh || {};
    if (ssh.enabled) {
      if (!/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(ssh.domain || '')) err('domain', { v: ssh.domain || '' });
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,31}$/.test(ssh.user || '')) err('user', { v: ssh.user || '' });
    } else warn('noSsh');
    const dns = site.dns ? parseIp(site.dns) : null;
    if (site.dns && dns === null) err('dns', { v: site.dns });
    if (vlans.some((v) => v.dhcp) && !site.dns) warn('noDns');

    if (issues.some((i) => i.lvl === 'err')) return { ok: false, issues, router: '', switch: '' };

    // ---------- Routeur ----------
    const R = [];
    const L = (s) => R.push(s);
    L('! ' + (site.header || 'Configuration generee - a relire avant application'));
    L('hostname ' + site.router);
    L('no ip domain lookup');
    L('service password-encryption');
    L('!');
    L('interface ' + trunkIf);
    L(' description Trunk 802.1Q vers ' + site.switch);
    L(' no ip address');
    L(' no shutdown');
    L('!');
    for (const v of vlans) {
      L('interface ' + trunkIf + '.' + v.id);
      if (v.name) L(' description ' + v.name);
      L(' encapsulation dot1Q ' + v.id);
      L(' ip address ' + ipStr(v.gw) + ' ' + ipStr(maskOf(v.c.prefix)));
      L('!');
    }
    if (wan) {
      L('interface ' + wan.ifn);
      L(' description WAN');
      L(' ip address ' + ipStr(wan.c.ip) + ' ' + ipStr(maskOf(wan.c.prefix)));
      L(' no shutdown');
      L('!');
    }
    for (const v of vlans.filter((x) => x.dhcp)) {
      L('ip dhcp excluded-address ' + ipStr(v.gw));
      L('ip dhcp pool VLAN' + v.id + (v.name ? '-' + v.name : ''));
      L(' network ' + ipStr(v.c.net) + ' ' + ipStr(maskOf(v.c.prefix)));
      L(' default-router ' + ipStr(v.gw));
      if (dns !== null) L(' dns-server ' + ipStr(dns));
      L('!');
    }
    if (o.enabled) {
      L('router ospf ' + +o.pid);
      L(' router-id ' + ipStr(parseIp(o.rid)));
      L(' passive-interface default');
      if (wan) L(' no passive-interface ' + wan.ifn);
      for (const v of vlans) L(' network ' + ipStr(v.c.net) + ' ' + ipStr(~maskOf(v.c.prefix) >>> 0) + ' area ' + +o.area);
      if (wan) L(' network ' + ipStr(wan.c.net) + ' ' + ipStr(~maskOf(wan.c.prefix) >>> 0) + ' area ' + +o.area);
      L('!');
    }
    if (ssh.enabled) {
      L('ip domain-name ' + ssh.domain);
      L('username ' + ssh.user + ' privilege 15 secret <MOT_DE_PASSE>');
      L('crypto key generate rsa general-keys modulus 2048');
      L('ip ssh version 2');
      L('line vty 0 4');
      L(' login local');
      L(' transport input ssh');
      L('!');
    }
    L('end');

    // ---------- Commutateur ----------
    const S = [];
    const W = (s) => S.push(s);
    W('! ' + (site.header || 'Configuration generee - a relire avant application'));
    W('hostname ' + site.switch);
    W('no ip domain lookup');
    W('!');
    for (const v of vlans) { W('vlan ' + v.id); if (v.name) W(' name ' + v.name); W('!'); }
    W('interface ' + uplink);
    W(' description Trunk 802.1Q vers ' + site.router);
    W(' ! sur certains modeles : switchport trunk encapsulation dot1q');
    W(' switchport mode trunk');
    W(' switchport trunk allowed vlan ' + vlans.map((v) => v.id).join(','));
    W(' no shutdown');
    W('!');
    for (const v of vlans) {
      for (const p of v.ports) {
        W(p.from === p.to ? 'interface ' + p.type + p.slot + p.from : 'interface range ' + p.type + p.slot + p.from + ' - ' + p.to);
        if (v.name) W(' description ' + v.name);
        W(' switchport mode access');
        W(' switchport access vlan ' + v.id);
        W(' spanning-tree portfast');
        W(' no shutdown');
        W('!');
      }
    }
    if (ssh.enabled) {
      W('ip domain-name ' + ssh.domain);
      W('username ' + ssh.user + ' privilege 15 secret <MOT_DE_PASSE>');
      W('crypto key generate rsa general-keys modulus 2048');
      W('ip ssh version 2');
      W('line vty 0 15');
      W(' login local');
      W(' transport input ssh');
      W('!');
    }
    W('end');

    const plan = vlans.map((v) => ({ id: v.id, name: v.name, net: cidrStr(v.c), gw: ipStr(v.gw), dhcp: v.dhcp,
      first: ipStr(v.gw + 1), last: ipStr(v.c.bcast - 1) }));
    return { ok: true, issues, router: R.join('\n') + '\n', switch: S.join('\n') + '\n', plan };
  }

  // =================================================================
  //  VyOS : pare-feu stateful + analyse des règles
  // =================================================================
  const PROTOS = ['any', 'tcp', 'udp', 'tcp_udp', 'icmp'];
  // "80,443,8000-8080" -> [[80,80],[443,443],[8000,8080]] ; '' -> null (tous)
  function parsePortSpec(s) {
    const t = String(s || '').trim();
    if (!t) return null;
    const out = [];
    for (const tok of t.split(',')) {
      const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(tok.trim());
      if (!m) return false;
      const a = +m[1], b = m[2] !== undefined ? +m[2] : a;
      if (a < 1 || b > 65535 || b < a) return false;
      out.push([a, b]);
    }
    return out;
  }
  const protoCovers = (a, b) => a === 'any' || a === b || (a === 'tcp_udp' && (b === 'tcp' || b === 'udp'));
  function portsCover(a, b) { // a ⊇ b ?
    if (a === null) return true;
    if (b === null) return false;
    return b.every(([x, y]) => a.some(([u, v]) => u <= x && y <= v));
  }
  const ANY = { net: 0, bcast: 0xffffffff, prefix: 0 };
  function ruleCovers(a, b) {
    return protoCovers(a.proto, b.proto) && contains(a.src, b.src) && contains(a.dst, b.dst) && portsCover(a.ports, b.ports);
  }

  function vyos(fw) {
    const issues = [];
    const err = (code, p) => issues.push({ lvl: 'err', code, p: p || {} });
    const warn = (code, p) => issues.push({ lvl: 'warn', code, p: p || {} });

    // --- Interfaces ---
    const ifs = [];
    const ifNames = new Set();
    for (const i of fw.interfaces) {
      if (!/^eth\d{1,2}$/.test(i.name || '')) { err('vyIf', { v: i.name || '' }); continue; }
      if (ifNames.has(i.name)) { err('vyIfDup', { v: i.name }); continue; }
      ifNames.add(i.name);
      const c = parseCidr(i.cidr);
      if (!c) { err('cidr', { v: i.cidr, n: i.name }); continue; }
      if (c.prefix < 31 && (c.ip === c.net || c.ip === c.bcast)) { err('vyIfHost', { v: i.cidr, n: i.name }); continue; }
      if (/['"\\]/.test(i.desc || '')) { err('vyDesc', { n: i.name }); continue; }
      ifs.push({ name: i.name, c, desc: i.desc || '' });
    }
    for (let a = 0; a < ifs.length; a++)
      for (let b = a + 1; b < ifs.length; b++)
        if (overlaps(ifs[a].c, ifs[b].c)) err('overlap', { a: ifs[a].name, b: ifs[b].name });

    // --- Rulesets ---
    const sets = new Map();
    for (const s of fw.rulesets) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,27}$/.test(s.name || '')) { err('vySetName', { v: s.name || '' }); continue; }
      if (sets.has(s.name)) { err('vySetDup', { v: s.name }); continue; }
      if (!['accept', 'drop', 'reject'].includes(s.def)) { err('vyAction', { v: s.def }); continue; }
      if (s.iface && !ifNames.has(s.iface)) err('vyBindUnknown', { s: s.name, v: s.iface });
      sets.set(s.name, { name: s.name, def: s.def, iface: s.iface || '', rules: [] });
    }

    // --- Règles ---
    for (const r of fw.rules) {
      const set = sets.get(r.set);
      const n = Number(r.n);
      const where = { s: r.set, r: r.n };
      if (!set) { err('vyRuleSet', where); continue; }
      if (!Number.isInteger(n) || n < 1 || n > 999999) { err('vyRuleNum', where); continue; }
      if (set.rules.some((x) => x.n === n)) { err('vyRuleDup', where); continue; }
      if (!['accept', 'drop', 'reject'].includes(r.action)) { err('vyAction', { v: r.action }); continue; }
      const proto = PROTOS.includes(r.proto) ? r.proto : null;
      if (!proto) { err('vyProto', where); continue; }
      const src = r.src ? parseCidr(r.src, 32) : ANY;
      const dst = r.dst ? parseCidr(r.dst, 32) : ANY;
      if (!src) { err('vyAddr', { ...where, v: r.src }); continue; }
      if (!dst) { err('vyAddr', { ...where, v: r.dst }); continue; }
      if (r.src && src.ip !== src.net) warn('vyAddrHost', { ...where, v: r.src, c: cidrStr(src) });
      if (r.dst && dst.ip !== dst.net) warn('vyAddrHost', { ...where, v: r.dst, c: cidrStr(dst) });
      const ports = parsePortSpec(r.port);
      if (ports === false) { err('vyPort', { ...where, v: r.port }); continue; }
      if (ports && !['tcp', 'udp', 'tcp_udp'].includes(proto)) { err('vyPortProto', where); continue; }
      set.rules.push({ n, action: r.action, proto, src, dst, ports, raw: r });
    }

    // --- Analyse ---
    const bound = new Map();
    for (const s of sets.values()) {
      s.rules.sort((a, b) => a.n - b.n);
      if (!s.iface) warn('vyUnbound', { s: s.name });
      else if (bound.has(s.iface)) warn('vyBindDup', { v: s.iface, a: bound.get(s.iface), b: s.name });
      else bound.set(s.iface, s.name);
      if (s.def === 'accept') warn('vyDefAccept', { s: s.name });
      for (let j = 0; j < s.rules.length; j++) {
        const rj = s.rules[j];
        if (rj.action === 'accept' && rj.proto === 'any' && rj.src === ANY && rj.dst === ANY && !rj.ports)
          warn('vyAcceptAll', { s: s.name, r: rj.n });
        for (let i = 0; i < j; i++) {
          const ri = s.rules[i];
          if (ruleCovers(ri, rj)) {
            warn(ri.action === rj.action ? 'vyRedundant' : 'vyShadow', { s: s.name, r: rj.n, by: ri.n });
            break;
          }
        }
      }
    }
    for (const i of ifs) if (!bound.has(i.name)) warn('vyNoFilter', { v: i.name });
    if (!fw.stateful) warn('vyNoState');
    if (fw.ospf && fw.ospf.enabled && parseIp(fw.ospf.rid) === null) err('rid', { v: fw.ospf.rid });

    if (issues.some((i) => i.lvl === 'err')) return { ok: false, issues, text: '' };

    // ---------- Texte ----------
    const T = [];
    const L = (s) => T.push(s);
    L('# ' + (fw.header || 'Configuration generee - a relire avant application'));
    L('configure');
    L('# --- Interfaces ---');
    for (const i of ifs) {
      L("set interfaces ethernet " + i.name + " address '" + ipStr(i.c.ip) + '/' + i.c.prefix + "'");
      if (i.desc) L("set interfaces ethernet " + i.name + " description '" + i.desc + "'");
    }
    if (fw.ospf && fw.ospf.enabled) {
      L('# --- OSPF (area 0) ---');
      L("set protocols ospf parameters router-id '" + ipStr(parseIp(fw.ospf.rid)) + "'");
      for (const i of ifs) L("set protocols ospf area 0 network '" + cidrStr(i.c) + "'");
    }
    L('# --- Pare-feu ---');
    if (fw.stateful) {
      L('set firewall global-options state-policy established action accept');
      L('set firewall global-options state-policy related action accept');
      L('set firewall global-options state-policy invalid action drop');
    }
    for (const s of sets.values()) {
      const P = 'set firewall ipv4 name ' + s.name;
      L(P + ' default-action ' + s.def);
      for (const r of s.rules) {
        const Q = P + ' rule ' + r.n;
        L(Q + ' action ' + r.action);
        if (r.proto !== 'any') L(Q + ' protocol ' + r.proto);
        if (r.src !== ANY) L(Q + " source address '" + (r.src.prefix === 32 ? ipStr(r.src.net) : cidrStr(r.src)) + "'");
        if (r.dst !== ANY) L(Q + " destination address '" + (r.dst.prefix === 32 ? ipStr(r.dst.net) : cidrStr(r.dst)) + "'");
        if (r.ports) L(Q + ' destination port ' + r.ports.map(([a, b]) => (a === b ? a : a + '-' + b)).join(','));
      }
    }
    let k = 10;
    for (const s of sets.values()) {
      if (!s.iface) continue;
      const Q = 'set firewall ipv4 forward filter rule ' + k;
      L(Q + ' action jump');
      L(Q + ' inbound-interface name ' + s.iface);
      L(Q + ' jump-target ' + s.name);
      k += 10;
    }
    L('commit');
    L('save');
    return { ok: true, issues, text: T.join('\n') + '\n' };
  }

  const api = { cisco, vyos, parseCidr, parsePorts, parsePortSpec, ipStr };
  root.GenConfig = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
