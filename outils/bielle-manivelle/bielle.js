// =====================================================================
//  Système bielle-manivelle : moteur de calcul (sans interface).
//  Manivelle de rayon r, bielle de longueur L, excentration e (axe du
//  piston décalé de e par rapport au centre de la manivelle), vitesse
//  de rotation constante ω.
//  Position du piston (origine au centre de la manivelle) :
//     x(θ) = r·cos θ + √(L² − (r·sin θ − e)²)
//  Vitesse et accélération : dérivées analytiques de x par rapport au temps.
//  Longueurs en mm, vitesses en mm/s, accélérations en m/s².
// =====================================================================
(function (root) {
  'use strict';

  function check(p) {
    const issues = [];
    const pos = (x) => Number.isFinite(x) && x > 0;
    if (!pos(p.r)) issues.push({ lvl: 'err', code: 'r' });
    if (!pos(p.L)) issues.push({ lvl: 'err', code: 'L' });
    if (!Number.isFinite(p.e)) issues.push({ lvl: 'err', code: 'e' });
    if (!pos(p.rpm)) issues.push({ lvl: 'err', code: 'rpm' });
    if (issues.length) return issues;
    if (p.L <= p.r + Math.abs(p.e)) issues.push({ lvl: 'err', code: 'lock' });
    return issues;
  }

  // État cinématique pour un angle θ (rad) ; ω en rad/s
  function state(p, th) {
    const { r, L, e } = p;
    const w = (p.rpm * 2 * Math.PI) / 60;
    const s = Math.sin(th), c = Math.cos(th);
    const u = r * s - e;                 // décalage vertical tête de bielle / axe du piston
    const k = Math.sqrt(L * L - u * u);  // projection de la bielle sur l'axe
    const x = r * c + k;
    // dx/dθ et d²x/dθ²
    const du = r * c, ddu = -r * s;
    const dk = -(u * du) / k;
    const ddk = -((du * du + u * ddu) * k - u * du * dk) / (k * k);
    const dx = -r * s + dk;
    const ddx = -r * c + ddk;
    const beta = Math.asin(u / L);       // angle de la bielle par rapport à l'axe
    return { th, x, v: dx * w, a: (ddx * w * w) / 1000, beta, crank: { x: r * c, y: r * s }, pin: { x, y: e } };
  }

  // Points morts : bielle et manivelle alignées
  function deadCenters(p) {
    const { r, L, e } = p;
    const thTop = Math.asin(e / (L + r));             // point mort haut (x max)
    const thBot = Math.PI + Math.asin(e / (L - r));   // point mort bas (x min)
    const xTop = Math.sqrt((L + r) ** 2 - e * e);
    const xBot = Math.sqrt((L - r) ** 2 - e * e);
    // angle parcouru pendant la course aller (du PMH au PMB), sens trigonométrique
    let go = thBot - thTop; go = ((go % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return { thTop, thBot, xTop, xBot, stroke: xTop - xBot, goDeg: (go * 180) / Math.PI, backDeg: 360 - (go * 180) / Math.PI };
  }

  function analyse(p, n) {
    const issues = check(p);
    if (issues.some((i) => i.lvl === 'err')) return { ok: false, issues };
    const N = n || 360;
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(state(p, (2 * Math.PI * i) / N));
    const dc = deadCenters(p);
    const vmax = Math.max(...pts.map((q) => Math.abs(q.v)));
    const amax = Math.max(...pts.map((q) => Math.abs(q.a)));
    const betaMax = Math.max(...pts.map((q) => Math.abs(q.beta)));
    const lambda = p.r / p.L;
    const w = (p.rpm * 2 * Math.PI) / 60;
    const vmean = (2 * dc.stroke * p.rpm) / 60;          // vitesse moyenne du piston (mm/s)
    if (lambda > 0.35) issues.push({ lvl: 'warn', code: 'shortRod', v: lambda });
    if ((betaMax * 180) / Math.PI > 25) issues.push({ lvl: 'warn', code: 'angle', v: (betaMax * 180) / Math.PI });
    if (Math.abs(p.e) > 0 && Math.abs(dc.goDeg - 180) > 1) issues.push({ lvl: 'info', code: 'quick', v: dc.goDeg / dc.backDeg });
    return { ok: true, issues, pts, dc, vmax, amax, betaMax, lambda, w, vmean };
  }

  const api = { state, deadCenters, analyse, check };
  root.BielleManivelle = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
