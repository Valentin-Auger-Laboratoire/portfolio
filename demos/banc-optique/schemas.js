/* Schémas d'optique géométrique à connaître (programme de CPGE TSI), redessinés de zéro en 2026.
   Chaque schéma est CALCULÉ (positions par la relation de conjugaison, rayons par leurs règles de construction),
   puis découpé en étapes pour les refaire de mémoire. Produit du SVG ; classes CSS : ax, lens, obj, img, r1, r2, r3, r4, aux, lbl, dim.
   Utilisable dans le navigateur (window.Schemas) et avec Node (module.exports, pour les tests). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Schemas = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 640, H = 320;
  let LANG = 'fr'; const tr = (fr, en) => (LANG === 'en' ? en : fr); const setLang = (l) => { LANG = l; };
  const conj = (p, f) => (Math.abs(1 / f + 1 / p) < 1e-12 ? Infinity : 1 / (1 / f + 1 / p)); // OA′ à partir de OA
  const r2 = (v) => Math.round(v * 100) / 100;
  // ------------------------------------------------------------ constructeur de figure
  function fig(xmin, xmax, ymax) {
    const k = Math.min(W / (xmax - xmin), (H / 2 - 14) / ymax), cx = (W - (xmax - xmin) * k) / 2;
    const X = (x) => r2(cx + (x - xmin) * k), Y = (y) => r2(H / 2 - y * k);
    const F = { xmin, xmax, ymax, k, X, Y, base: [], steps: [], cur: null };
    F.add = (s) => { (F.cur ? F.cur.parts : F.base).push(s); return F; };
    F.step = (fr, en, kind) => { F.cur = { fr, en, kind: kind || 'ray', parts: [] }; F.steps.push(F.cur); return F; };
    F.line = (x1, y1, x2, y2, cls, dash) => F.add('<line x1="' + X(x1) + '" y1="' + Y(y1) + '" x2="' + X(x2) + '" y2="' + Y(y2) + '" class="' + cls + (dash ? ' dash' : '') + '"/>');
    F.poly = (pts, cls, dash) => F.add('<polyline points="' + pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ') + '" class="' + cls + (dash ? ' dash' : '') + '"/>');
    F.text = (x, y, s, cls, anchor, dx, dy) => F.add('<text x="' + r2(X(x) + (dx || 0)) + '" y="' + r2(Y(y) + (dy || 0)) + '" class="' + (cls || 'lbl') + '" text-anchor="' + (anchor || 'middle') + '">' + s + '</text>');
    F.arrowHead = (x, y, ang, cls) => { const a = 7, px = X(x), py = Y(y), c = Math.cos(ang), s = Math.sin(ang); F.add('<polygon points="' + r2(px) + ',' + r2(py) + ' ' + r2(px - a * c + a * 0.5 * s) + ',' + r2(py + a * s + a * 0.5 * c) + ' ' + r2(px - a * c - a * 0.5 * s) + ',' + r2(py + a * s - a * 0.5 * c) + '" class="' + cls + ' fill"/>'); };
    // flèche au milieu d'un segment (sens de propagation)
    F.mid = (x1, y1, x2, y2, cls) => { const ang = Math.atan2(-(Y(y2) - Y(y1)), X(x2) - X(x1)); F.arrowHead((x1 + x2) / 2, (y1 + y2) / 2, ang, cls); };
    F.vec = (x, y0, y1, cls, dash, name, below) => { F.line(x, y0, x, y1, cls, dash); F.arrowHead(x, y1, y1 > y0 ? Math.PI / 2 : -Math.PI / 2, cls); if (name) F.text(x, y1, name, 'lbl ' + cls + 't', 'middle', 0, y1 > y0 ? -8 : 16); return F; };
    F.axis = () => { F.line(xmin, 0, xmax, 0, 'ax'); F.arrowHead(xmax, 0, 0, 'ax'); return F; };
    F.pt = (x, name, up) => { F.add('<circle cx="' + X(x) + '" cy="' + Y(0) + '" r="2.2" class="ax fill"/>'); F.text(x, 0, name, 'lbl', 'middle', 0, up ? -7 : 15); return F; };
    F.lens = (x, conv, hh, name) => { F.line(x, -hh, x, hh, 'lens'); [[hh, 1], [-hh, -1]].forEach(([y, s]) => { const px = X(x), py = Y(y), a = 7; F.add(conv ? '<polygon points="' + px + ',' + r2(py - 2 * s) + ' ' + (px - a) + ',' + r2(py + a * s) + ' ' + (px + a) + ',' + r2(py + a * s) + '" class="lens fill"/>' : '<polygon points="' + px + ',' + r2(py + 5 * s) + ' ' + (px - a) + ',' + r2(py - 3 * s) + ' ' + (px + a) + ',' + r2(py - 3 * s) + '" class="lens fill"/>'); }); if (name) F.text(x, hh, name, 'lbl', 'middle', 0, -12); return F; };
    F.arc = (x, y, rpx, a0, a1, cls) => { const px = X(x), py = Y(y), p0 = [px + rpx * Math.cos(a0), py - rpx * Math.sin(a0)], p1 = [px + rpx * Math.cos(a1), py - rpx * Math.sin(a1)], large = Math.abs(a1 - a0) > Math.PI ? 1 : 0, sweep = a1 > a0 ? 0 : 1; F.add('<path d="M' + r2(p0[0]) + ',' + r2(p0[1]) + ' A' + rpx + ',' + rpx + ' 0 ' + large + ' ' + sweep + ' ' + r2(p1[0]) + ',' + r2(p1[1]) + '" class="' + (cls || 'aux') + '"/>'); };
    F.svg = (n, hideImg) => { let s = F.base.join(''); F.steps.forEach((st, i) => { if (i < n && !(hideImg && st.kind === 'img')) s += st.parts.join(''); }); return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="schema">' + s + '</svg>'; };
    return F;
  }
  // rayon le long de la droite y = y0 + s·(x − x0), entre xa et xb
  const yAt = (x0, y0, s, x) => y0 + s * (x - x0);

  // ------------------------------------------------------------ lentille mince, objet à distance finie
  // f : focale image (algébrique), p = OA, h = AB ; renvoie la figure et les caractéristiques
  function lensCase(f, p, h, opt) {
    const o = Object.assign({ xmin: -175, xmax: 205 }, opt || {}), pp = conj(p, f), g = isFinite(pp) ? pp / p : Infinity, hp = isFinite(pp) ? g * h : Infinity;
    const ymax = Math.min(95, Math.max(Math.abs(h), isFinite(hp) ? Math.abs(hp) : 0, 40) * 1.25);
    const F = fig(o.xmin, o.xmax, ymax), real = p < 0, imgReal = isFinite(pp) && pp > 0, xR = o.xmax - 4, xL = o.xmin + 4;
    F.axis().lens(0, f > 0, ymax * 0.82, 'L').pt(0, 'O', false).pt(-f, 'F', true).pt(f, 'F′', true);
    if (Math.abs(2 * f) < o.xmax && Math.abs(2 * f) < -o.xmin) { F.pt(-2 * f, '', true); F.pt(2 * f, '', true); }
    F.vec(p, 0, h, 'obj', !real, 'B'); F.text(p, 0, 'A', 'lbl objt', 'middle', 0, 15);
    // un rayon : incident (droite passant par B de pente sIn), coupe la lentille en y0, émergent de pente sOut
    const ray = (cls, sIn, sOut, extras, fr, en) => {
      F.step(fr, en);
      const y0 = yAt(p, h, sIn, 0);
      if (real) { F.line(p, h, 0, y0, cls); F.mid(p, h, 0, y0, cls); }
      else { F.line(xL, yAt(p, h, sIn, xL), 0, y0, cls); F.mid(xL, yAt(p, h, sIn, xL), 0, y0, cls); F.line(0, y0, p, h, cls, true); }
      (extras.inDash || []).forEach((x) => { if (x > 0) F.line(0, y0, x, yAt(0, y0, sIn, x), cls, true); else if (real && x < p) F.line(x, yAt(0, y0, sIn, x), p, h, cls, true); });
      F.line(0, y0, xR, yAt(0, y0, sOut, xR), cls); F.mid(0, y0, xR * 0.6, yAt(0, y0, sOut, xR * 0.6), cls);
      let back = 0; if (isFinite(pp) && pp < 0) back = Math.min(back, pp); (extras.outBack || []).forEach((x) => { if (x < 0) back = Math.min(back, x); });
      if (back < 0) F.line(back, yAt(0, y0, sOut, back), 0, y0, cls, true);
    };
    ray('r1', 0, -h / f, { outBack: f < 0 ? [f] : [] }, 'Rayon parallèle à l’axe : il ressort en passant par F′' + (f < 0 ? ' (son prolongement passe par F′, côté objet)' : '') + '.', 'Ray parallel to the axis: it emerges through F′' + (f < 0 ? ' (its extension goes through F′, on the object side)' : '') + '.');
    ray('r2', h / p, h / p, {}, 'Rayon passant par le centre optique O : il n’est pas dévié.', 'Ray through the optical centre O: it is not deviated.');
    if (Math.abs(p + f) > 1e-9) { const s3 = h / (p + f); ray('r3', s3, 0, { inDash: [-f] }, 'Rayon passant par F (ou dont le prolongement passe par F) : il ressort parallèle à l’axe.', 'Ray through F (or whose extension goes through F): it emerges parallel to the axis.'); }
    F.step('Image A′B′ à l’intersection des rayons émergents' + (isFinite(pp) ? (imgReal ? ' (image réelle).' : ' : elle est à l’intersection de leurs PROLONGEMENTS, en pointillés (image virtuelle).') : ' : ils ressortent parallèles, l’image est rejetée à l’infini.'), 'Image A′B′ where the emerging rays meet' + (isFinite(pp) ? (imgReal ? ' (real image).' : ': it is where their EXTENSIONS meet, dotted (virtual image).') : ': they emerge parallel, the image is at infinity.'), 'img');
    if (isFinite(pp)) { F.vec(pp, 0, hp, 'img', !imgReal, 'B′'); F.text(pp, 0, 'A′', 'lbl imgt', 'middle', 0, hp > 0 ? 15 : -7); }
    const nat = !isFinite(pp) ? 'inf' : imgReal ? 'real' : 'virt';
    return { F, p, pp, g, h, hp, f, nat, sens: !isFinite(g) ? null : g > 0 ? 'up' : 'down', taille: !isFinite(g) ? null : Math.abs(g) > 1 ? 'big' : 'small', objReal: real };
  }
  // ------------------------------------------------------------ objet à l'infini (faisceau incliné d'angle α)
  function infCase(f) {
    const F = fig(-175, 205, 80), a = -0.22, xR = 201, xL = -171, hh = 66;
    F.axis().lens(0, f > 0, hh, 'L').pt(0, 'O', false).pt(-f, 'F', true).pt(f, 'F′', true);
    F.line(f, -70, f, 70, 'aux', true); F.text(f, 70, tr('plan focal image', 'image focal plane'), 'lbl dim', 'middle', 0, -4);
    const ys = f * a; // foyer secondaire image F′s
    F.text(xL, 50, 'B∞', 'lbl objt', 'start', 4, 0);
    const beam = (cls, y0, fr, en) => { F.step(fr, en); F.line(xL, yAt(0, y0, a, xL), 0, y0, cls); F.mid(xL, yAt(0, y0, a, xL), 0, y0, cls); const s = (ys - y0) / f; F.line(0, y0, xR, yAt(0, y0, s, xR), cls); if (f < 0) F.line(f, ys, 0, y0, cls, true); };
    beam('r2', 0, 'Rayon passant par O : non dévié ; il coupe le plan focal image au foyer secondaire image F′s.', 'Ray through O: not deviated; it crosses the image focal plane at the secondary image focus F′s.');
    beam('r1', 40, 'Les autres rayons du faisceau, parallèles entre eux, ressortent ' + (f > 0 ? 'en convergeant vers F′s.' : 'en semblant venir de F′s (prolongements en pointillés).'), 'The other rays of the beam, parallel to each other, emerge ' + (f > 0 ? 'converging towards F′s.' : 'appearing to come from F′s (dotted extensions).'));
    beam('r3', -40, 'Même règle pour tout rayon du faisceau.', 'Same rule for every ray of the beam.');
    F.step('Image B′ au foyer secondaire F′s, dans le plan focal image (' + (f > 0 ? 'réelle' : 'virtuelle') + ').', 'Image B′ at the secondary focus F′s, in the image focal plane (' + (f > 0 ? 'real' : 'virtual') + ').', 'img');
    F.vec(f, 0, ys, 'img', f < 0, 'B′'); F.text(f, ys, 'F′s', 'lbl imgt', 'start', 6, 4);
    return { F, nat: f > 0 ? 'real' : 'virt', sens: null, taille: null };
  }
  // ------------------------------------------------------------ rayon incident quelconque (on cherche l'émergent) ou émergent quelconque (on cherche l'incident)
  function anyRay(f, given) {
    const F = fig(-175, 205, 80), xR = 201, xL = -171, hh = 66, y0 = 34, s = -0.25;
    F.axis().lens(0, f > 0, hh, 'L').pt(0, 'O', false).pt(-f, 'F', true).pt(f, 'F′', true);
    if (given === 'in') {
      F.line(f, -70, f, 70, 'aux', true); F.text(f, 70, tr('plan focal image', 'image focal plane'), 'lbl dim', 'middle', 0, -4);
      F.line(xL, yAt(0, y0, s, xL), 0, y0, 'r1'); F.mid(xL, yAt(0, y0, s, xL), 0, y0, 'r1'); F.text(xL, yAt(0, y0, s, xL), tr('rayon incident', 'incident ray'), 'lbl dim', 'start', 4, -8);
      F.step('Tracer le rayon parallèle au rayon incident qui passe par O (non dévié).', 'Draw the ray parallel to the incident ray through O (not deviated).');
      F.line(xL, s * xL, xR, s * xR, 'aux', false);
      F.step('Il coupe le plan focal image au foyer secondaire F′s.', 'It crosses the image focal plane at the secondary focus F′s.');
      const ys = s * f; F.text(f, ys, 'F′s', 'lbl', 'start', 6, 4);
      F.step('Deux rayons parallèles avant la lentille se coupent dans le plan focal image : le rayon émergent passe par F′s' + (f < 0 ? ' (son prolongement, côté objet).' : '.'), 'Two rays parallel before the lens meet in the image focal plane: the emerging ray goes through F′s' + (f < 0 ? ' (its extension, on the object side).' : '.'), 'img');
      const so = (ys - y0) / f; F.line(0, y0, xR, yAt(0, y0, so, xR), 'r1'); F.mid(0, y0, 100, yAt(0, y0, so, 100), 'r1'); if (f < 0) F.line(f, ys, 0, y0, 'r1', true);
    } else {
      F.line(-f, -70, -f, 70, 'aux', true); F.text(-f, 70, tr('plan focal objet', 'object focal plane'), 'lbl dim', 'middle', 0, -4);
      F.line(0, y0, xR, yAt(0, y0, s, xR), 'r1'); F.mid(0, y0, 120, yAt(0, y0, s, 120), 'r1'); F.text(xR, yAt(0, y0, s, xR), tr('rayon émergent', 'emerging ray'), 'lbl dim', 'end', -4, -8);
      F.step('Tracer le rayon parallèle au rayon émergent qui passe par O.', 'Draw the ray parallel to the emerging ray through O.');
      F.line(xL, s * xL, xR, s * xR, 'aux', false);
      F.step('Il coupe le plan focal objet au foyer secondaire objet Fs.', 'It crosses the object focal plane at the secondary object focus Fs.');
      const ys = -s * f; F.text(-f, ys, 'Fs', 'lbl', 'start', 6, 4);
      F.step('Deux rayons qui sortent parallèles viennent d’un même point du plan focal objet : l’incident passe par Fs' + (f < 0 ? ' (son prolongement, après la lentille).' : '.'), 'Two rays emerging parallel come from the same point of the object focal plane: the incident ray goes through Fs' + (f < 0 ? ' (its extension, after the lens).' : '.'), 'img');
      const si = (y0 - ys) / f; F.line(xL, yAt(0, y0, si, xL), 0, y0, 'r1'); F.mid(xL, yAt(0, y0, si, xL), -60, yAt(0, y0, si, -60), 'r1'); if (f < 0) F.line(0, y0, -f, ys, 'r1', true);
    }
    return { F };
  }
  // ------------------------------------------------------------ miroir plan
  function mirror() {
    const F = fig(-170, 170, 90); F.line(0, -80, 0, 80, 'lens'); for (let y = -76; y <= 76; y += 10) F.line(0, y, 7, y - 7, 'dim');
    F.text(0, 80, tr('miroir', 'mirror'), 'lbl', 'middle', 0, -6); F.axis(); const p = -90, h = 40; F.vec(p, 0, h, 'obj', false, 'B'); F.text(p, 0, 'A', 'lbl objt', 'middle', 0, 15);
    [[50, 'r1'], [0, 'r2'], [-30, 'r3']].forEach(([yM, cls], i) => {
      F.step(i === 0 ? 'Un rayon issu de B se réfléchit : angle de réflexion = angle d’incidence (loi de Snell-Descartes).' : 'Tous les rayons issus de B, après réflexion, semblent venir du même point B′.', i === 0 ? 'A ray from B is reflected: angle of reflection = angle of incidence (Snell-Descartes).' : 'All rays from B, after reflection, appear to come from the same point B′.');
      const s = (yM - h) / (0 - p); F.line(p, h, 0, yM, cls); F.mid(p, h, 0, yM, cls); F.line(0, yM, -160, yAt(0, yM, -s, -160), cls); F.line(0, yM, -p, h, cls, true);
    });
    F.step('Image B′ symétrique de B par rapport au miroir : virtuelle, droite, même taille. Stigmatisme RIGOUREUX (pour tous les rayons, pas seulement en conditions de Gauss).', 'Image B′ symmetric to B with respect to the mirror: virtual, upright, same size. RIGOROUS stigmatism (for every ray, not only under paraxial conditions).', 'img');
    F.vec(-p, 0, h, 'img', true, 'B′'); F.text(-p, 0, 'A′', 'lbl imgt', 'middle', 0, 15);
    return { F, nat: 'virt', sens: 'up', taille: 'same' };
  }
  // ------------------------------------------------------------ réfraction et réflexion totale
  function refraction(total) {
    const n1 = total ? 1.5 : 1, n2 = total ? 1 : 1.5, th = total ? 52 * Math.PI / 180 : 50 * Math.PI / 180, F = fig(-150, 150, 95);
    F.add('<rect x="0" y="' + F.Y(0) + '" width="' + W + '" height="' + (H - F.Y(0)) + '" class="medium2"/>'); if (total) F.add('<rect x="0" y="0" width="' + W + '" height="' + F.Y(0) + '" class="medium2"/>').add('<rect x="0" y="' + F.Y(0) + '" width="' + W + '" height="' + (H - F.Y(0)) + '" class="medium0"/>');
    F.line(-150, 0, 150, 0, 'ax'); F.line(0, -92, 0, 92, 'aux', true); F.text(0, 92, tr('normale', 'normal'), 'lbl dim', 'start', 4, 10);
    F.text(-148, 80, tr('milieu 1 : n₁ = ', 'medium 1: n₁ = ') + String(n1).replace('.', ','), 'lbl', 'start'); F.text(-148, -84, tr('milieu 2 : n₂ = ', 'medium 2: n₂ = ') + String(n2).replace('.', ','), 'lbl', 'start');
    const L = 90, ix = -L * Math.sin(th), iy = L * Math.cos(th);
    F.line(ix, iy, 0, 0, 'r1'); F.mid(ix, iy, 0, 0, 'r1'); F.arc(0, 0, 34, Math.PI / 2, Math.PI / 2 + th, 'aux'); F.text(-14, 44, 'i₁', 'lbl');
    F.step('Rayon réfléchi : dans le plan d’incidence, angle de réflexion = i₁.', 'Reflected ray: in the plane of incidence, angle of reflection = i₁.');
    F.line(0, 0, -ix, iy, 'r2'); F.mid(0, 0, -ix, iy, 'r2'); F.arc(0, 0, 40, Math.PI / 2 - th, Math.PI / 2, 'aux'); F.text(18, 50, 'i₁', 'lbl');
    if (!total) {
      const t2 = Math.asin((n1 / n2) * Math.sin(th));
      F.step('Rayon réfracté : n₁ sin i₁ = n₂ sin i₂ ; vers un milieu plus réfringent, il se rapproche de la normale.', 'Refracted ray: n₁ sin i₁ = n₂ sin i₂; into a more refractive medium it bends towards the normal.', 'img');
      F.line(0, 0, L * Math.sin(t2), -L * Math.cos(t2), 'img'); F.mid(0, 0, L * Math.sin(t2), -L * Math.cos(t2), 'img'); F.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + t2, 'aux'); F.text(13, -44, 'i₂', 'lbl');
    } else {
      const tl = Math.asin(n2 / n1);
      F.step('Angle limite : sin iₗ = n₂/n₁ (' + (tl * 180 / Math.PI).toFixed(1).replace('.', ',') + '° ici). Au-delà, aucun rayon réfracté : réflexion TOTALE.', 'Critical angle: sin i_c = n₂/n₁ (' + (tl * 180 / Math.PI).toFixed(1) + '° here). Beyond it, no refracted ray: TOTAL internal reflection.', 'img');
      F.line(-L * Math.sin(tl), L * Math.cos(tl), 0, 0, 'aux', true); F.line(0, 0, 140, 0, 'aux', true); F.text(-L * Math.sin(tl), L * Math.cos(tl), tr('incidence limite', 'critical incidence'), 'lbl dim', 'end', -4, 0);
    }
    return { F };
  }
  // ------------------------------------------------------------ prisme (au minimum de déviation)
  function prismFig() {
    const A = 60 * Math.PI / 180, n = 1.5168, Dm = 2 * Math.asin(n * Math.sin(A / 2)) - A, im = (Dm + A) / 2, F = fig(-170, 170, 100);
    const hgt = 150, top = [0, 85], half = Math.tan(A / 2) * hgt, bl = [-half, 85 - hgt], br = [half, 85 - hgt];
    F.add('<polygon points="' + [top, bl, br].map((p) => F.X(p[0]) + ',' + F.Y(p[1])).join(' ') + '" class="glass"/>'); F.text(0, 85, 'A', 'lbl', 'middle', 0, -6);
    // point d'entrée au milieu de la face gauche ; trajet symétrique (horizontal dans le prisme)
    const yi = 20, xi = -Math.tan(A / 2) * (85 - yi), nL = [-Math.cos(A / 2), Math.sin(A / 2)], dIn = [Math.cos(im - A / 2), Math.sin(im - A / 2)]; /* incidence mesurée depuis la normale intérieure */
    const L = 95; F.line(xi, yi, xi + L * nL[0] * 1.0, yi + L * nL[1] * 1.0, 'aux', true); F.line(-xi, yi, -xi - L * nL[0], yi + L * nL[1], 'aux', true);
    F.line(xi - L * dIn[0], yi - L * dIn[1], xi, yi, 'r1'); F.mid(xi - L * dIn[0], yi - L * dIn[1], xi, yi, 'r1'); F.text(xi - 26, yi + 18, 'i', 'lbl');
    F.step('Première réfraction : sin i = n sin r.', 'First refraction: sin i = n sin r.');
    F.line(xi, yi, -xi, yi, 'r1'); F.mid(xi, yi, -xi, yi, 'r1'); F.text(xi + 18, yi - 12, 'r', 'lbl'); F.text(-xi - 18, yi - 12, 'r′', 'lbl');
    F.step('Seconde réfraction : n sin r′ = sin i′, avec r + r′ = A.', 'Second refraction: n sin r′ = sin i′, with r + r′ = A.');
    F.line(-xi, yi, -xi + L * dIn[0], yi - L * dIn[1], 'r1'); F.mid(-xi, yi, -xi + L * dIn[0], yi - L * dIn[1], 'r1'); F.text(-xi + 26, yi + 18, 'i′', 'lbl');
    F.step('Déviation D = i + i′ − A ; elle est minimale pour un trajet symétrique (i = i′, r = r′ = A/2) : n = sin((A + Dm)/2) / sin(A/2).', 'Deviation D = i + i′ − A; it is minimal for a symmetric path (i = i′, r = r′ = A/2): n = sin((A + Dm)/2) / sin(A/2).', 'img');
    F.line(xi, yi, xi + 160 * dIn[0], yi + 160 * dIn[1], 'aux', true); F.text(xi + 150 * dIn[0], yi + 150 * dIn[1], 'D', 'lbl', 'start', 6, 0);
    return { F, Dm, im };
  }
  // ------------------------------------------------------------ fibre optique à saut d'indice
  function fiberFig() {
    const n1 = 1.5, n2 = 1.4, NA = Math.sqrt(n1 * n1 - n2 * n2), acc = Math.asin(NA), F = fig(-120, 220, 80), rc = 30;
    F.add('<rect x="' + F.X(0) + '" y="' + F.Y(60) + '" width="' + (F.X(220) - F.X(0)) + '" height="' + (F.Y(-60) - F.Y(60)) + '" class="medium0"/>');
    F.add('<rect x="' + F.X(0) + '" y="' + F.Y(rc) + '" width="' + (F.X(220) - F.X(0)) + '" height="' + (F.Y(-rc) - F.Y(rc)) + '" class="glass"/>');
    F.text(214, 44, tr('gaine n₂', 'cladding n₂'), 'lbl dim', 'end'); F.text(214, 14, tr('cœur n₁ > n₂', 'core n₁ > n₂'), 'lbl dim', 'end'); F.line(-120, 0, 220, 0, 'aux', true);
    F.line(0, -70, 0, 70, 'aux'); F.text(-115, 60, tr('air', tr('air', 'air')), 'lbl dim', 'start');
    const th = acc * 0.85, t1 = Math.asin(Math.sin(th) / n1);
    F.line(-110, -110 * Math.tan(th), 0, 0, 'r1'); F.mid(-110, -110 * Math.tan(th), 0, 0, 'r1'); F.text(-60, -60 * Math.tan(th), 'θ', 'lbl', 'start', 4, 16);
    F.step('Entrée : sin θ = n₁ sin θ₁ (réfraction air → cœur).', 'Entry: sin θ = n₁ sin θ₁ (refraction air → core).');
    let x = 0, y = 0, dir = 1; const pts = [[0, 0]]; while (x < 220) { const dx = (dir > 0 ? rc - y : y + rc) / Math.tan(t1); if (x + dx > 220) { pts.push([220, y + dir * Math.tan(t1) * (220 - x)]); break; } x += dx; y = dir * rc; pts.push([x, y]); dir = -dir; }
    F.poly(pts, 'r1');
    F.step('Dans le cœur, incidence sur la gaine = 90° − θ₁ ; si elle dépasse l’angle limite (sin iₗ = n₂/n₁), réflexion totale à chaque rebond : la lumière est guidée.', 'In the core, incidence on the cladding = 90° − θ₁; if it exceeds the critical angle (sin i_c = n₂/n₁), total internal reflection at every bounce: light is guided.');
    F.step('Cône d’acceptance : sin θa = √(n₁² − n₂²) = ON (ouverture numérique). Ici θa = ' + (acc * 180 / Math.PI).toFixed(1).replace('.', ',') + '°.', 'Acceptance cone: sin θa = √(n₁² − n₂²) = NA (numerical aperture). Here θa = ' + (acc * 180 / Math.PI).toFixed(1) + '°.', 'img');
    F.add('<polygon points="' + F.X(0) + ',' + F.Y(0) + ' ' + F.X(-110) + ',' + F.Y(110 * Math.tan(acc)) + ' ' + F.X(-110) + ',' + F.Y(-110 * Math.tan(acc)) + '" class="cone"/>'); F.text(-108, 110 * Math.tan(acc), 'θa', 'lbl', 'start', 4, 14);
    return { F, NA, acc };
  }
  // ------------------------------------------------------------ lunette astronomique (Kepler, afocale)
  function kepler() {
    const f1 = 120, f2 = 40, F = fig(-60, 230, 70), a = -0.12, hh = 58, xR = 226, xL = -56;
    F.axis().lens(0, true, hh, tr('L₁ objectif', 'L₁ objective')).lens(f1 + f2, true, hh * 0.7, tr('L₂ oculaire', 'L₂ eyepiece')).pt(0, 'O₁').pt(f1, 'F′₁ = F₂', true).pt(f1 + f2, 'O₂').pt(f1 + 2 * f2, 'F′₂', true);
    const ys = f1 * a; // image intermédiaire dans le plan focal commun
    const ray = (cls, y0) => { F.line(xL, yAt(0, y0, a, xL), 0, y0, cls); F.mid(xL, yAt(0, y0, a, xL), 0, y0, cls); const s1 = (ys - y0) / f1, y2 = yAt(0, y0, s1, f1 + f2); F.line(0, y0, f1 + f2, y2, cls); const sOut = -ys / f2; /* parallèle au rayon B₁O₂ */ F.line(f1 + f2, y2, xR, yAt(f1 + f2, y2, sOut, xR), cls); };
    F.step('Faisceau incident parallèle (objet à l’infini, diamètre apparent α) : il converge dans le plan focal image de L₁.', 'Incident parallel beam (object at infinity, apparent diameter α): it converges in the image focal plane of L₁.');
    ray('r2', 0); ray('r1', 30); ray('r3', -30);
    F.step('Image intermédiaire A₁B₁ dans le plan F′₁ = F₂ (renversée).', 'Intermediate image A₁B₁ in the plane F′₁ = F₂ (inverted).');
    F.vec(f1, 0, ys, 'aux', false, 'B₁');
    F.step('A₁B₁ est dans le plan focal objet de L₂ : le faisceau ressort parallèle, incliné de α′. Système AFOCAL, grossissement G = α′/α = −f′₁/f′₂ (image finale renversée).', 'A₁B₁ is in the object focal plane of L₂: the beam emerges parallel, tilted by α′. AFOCAL system, angular magnification G = α′/α = −f′₁/f′₂ (inverted final image).', 'img');
    F.text(xR - 10, 34, 'α′', 'lbl imgt', 'end'); F.text(xL + 10, 40, 'α', 'lbl objt', 'start');
    return { F, G: -f1 / f2 };
  }
  // ------------------------------------------------------------ loupe
  function loupe() {
    const f = 60, F = fig(-120, 200, 70), h = 24, hh = 58; F.axis().lens(0, true, hh, tr('loupe', 'magnifier')).pt(0, 'O').pt(-f, 'F', true).pt(f, 'F′', true);
    F.vec(-f, 0, h, 'obj', false, 'B'); F.text(-f, 0, 'A', 'lbl objt', 'middle', 0, 15);
    F.add('<ellipse cx="' + F.X(150) + '" cy="' + F.Y(0) + '" rx="13" ry="10" class="lens"/>'); F.text(150, 0, tr('œil', 'eye'), 'lbl', 'middle', 0, -16);
    F.step('Objet dans le plan focal objet : les rayons issus de B ressortent parallèles entre eux.', 'Object in the object focal plane: rays from B emerge parallel to each other.');
    [[h, 'r1'], [0, 'r2']].forEach(([y0, cls]) => { const sIn = (y0 - h) / f; F.line(-f, h, 0, y0, cls); F.mid(-f, h, 0, y0, cls); F.line(0, y0, 196, yAt(0, y0, -h / f, 196), cls); void sIn; }); /* parallèles au rayon BO */
    F.step('Image à l’infini : l’œil voit sans accommoder, sous l’angle α′ = AB/f′.', 'Image at infinity: the eye sees it without accommodating, at the angle α′ = AB/f′.', 'img');
    F.text(186, 18, 'α′', 'lbl imgt', 'end');
    F.step('À l’œil nu au punctum proximum (dₘ ≈ 25 cm) : α = AB/dₘ. Grossissement commercial G = α′/α = dₘ/f′ (ici f′ = 6 cm → G ≈ 4).', 'With the naked eye at the near point (dₘ ≈ 25 cm): α = AB/dₘ. Commercial magnification G = α′/α = dₘ/f′ (here f′ = 6 cm → G ≈ 4).', 'img');
    return { F };
  }
  // ------------------------------------------------------------ œil réduit : normal, myope, hypermétrope (avec correction)
  function eye(kind) {
    const F = fig(-150, 120, 70), hh = 50, ret = 70; // distance cristallin–rétine (unités du dessin)
    F.axis().lens(0, true, hh, tr('cristallin', 'eye lens'));
    F.add('<path d="M' + F.X(ret) + ',' + F.Y(52) + ' Q' + F.X(ret + 14) + ',' + F.Y(0) + ' ' + F.X(ret) + ',' + F.Y(-52) + '" class="lens"/>'); F.text(ret + 8, 52, tr('rétine', 'retina'), 'lbl', 'middle', 0, -6);
    const fEye = kind === 'myope' ? 58 : kind === 'hyper' ? 84 : ret; // œil au repos
    const ys = [28, 0, -28], corr = kind === 'myope' ? 1 / (1 / ret - 1 / fEye) : kind === 'hyper' ? 1 / (1 / ret - 1 / fEye) : null; // lentille de contact accolée : 1/fc = 1/ret − 1/fEye
    F.step(kind === 'normal' ? 'Œil normal au repos : un objet à l’infini (punctum remotum) donne une image nette sur la rétine, F′ est sur la rétine.' : kind === 'myope' ? 'Œil myope au repos : trop convergent, l’image d’un objet à l’infini se forme AVANT la rétine (flou).' : 'Œil hypermétrope au repos : pas assez convergent, l’image se formerait APRÈS la rétine (flou ou fatigue d’accommodation).', kind === 'normal' ? 'Normal eye at rest: an object at infinity (far point) gives a sharp image on the retina, F′ is on the retina.' : kind === 'myope' ? 'Short-sighted eye at rest: too converging, the image of an object at infinity forms BEFORE the retina (blur).' : 'Long-sighted eye at rest: not converging enough, the image would form AFTER the retina (blur or accommodation strain).');
    ys.forEach((y0, i) => { const cls = ['r1', 'r2', 'r3'][i]; F.line(-146, y0, 0, y0, cls); F.mid(-146, y0, -60, y0, cls); const s = -y0 / fEye; F.line(0, y0, ret + 8, yAt(0, y0, s, ret + 8), cls); });
    F.pt(fEye, 'F′', true);
    if (corr) {
      F.step('Correction par un verre ' + (kind === 'myope' ? 'DIVERGENT' : 'CONVERGENT') + ' : son foyer image doit se trouver au punctum remotum de l’œil, et l’image d’un objet à l’infini revient sur la rétine (verre accolé : les vergences s’ajoutent, V = 1/d_rétine − 1/f′_œil).', 'Correction with a ' + (kind === 'myope' ? 'DIVERGING' : 'CONVERGING') + ' lens: its image focus must lie at the far point of the eye, and the image of an object at infinity returns to the retina (contact lens: powers add up, V = 1/d_retina − 1/f′_eye).', 'img');
      // verre correcteur à 40 unités devant l'œil : son foyer image doit être conjugué de la rétine par le cristallin au repos
      const xc = -40, pObj = 1 / (1 / ret - 1 / fEye), fc = pObj - xc;
      F.lens(xc, fc > 0, hh * 0.9, null); F.text(xc, -hh * 0.9, kind === 'myope' ? tr('verre divergent', 'diverging lens') : tr('verre convergent', 'converging lens'), 'lbl', 'middle', 0, 16);
      ys.forEach((y0) => { const u1 = -y0 / fc, y1 = y0 + u1 * -xc, u2 = u1 - y1 / fEye; F.line(xc, y0, 0, y1, 'img'); F.line(0, y1, ret, y1 + u2 * ret, 'img'); });
    }
    if (kind === 'normal') {
      F.step('Accommodation : pour un objet proche (jusqu’au punctum proximum, ≈ 25 cm), les muscles bombent le cristallin, sa focale diminue et l’image reste sur la rétine.', 'Accommodation: for a close object (down to the near point, ≈ 25 cm), muscles make the lens more curved, its focal length decreases and the image stays on the retina.', 'img');
      const pn = -130, hn = 22, hi = (ret / pn) * hn; F.vec(pn, 0, hn, 'obj', false, 'B'); [-30, 0, 30].forEach((y0) => { F.line(pn, hn, 0, y0, 'img'); F.line(0, y0, ret, hi, 'img'); });
    }
    return { F, corr };
  }
  // ------------------------------------------------------------ appareil photographique (mise au point)
  function camera() {
    const f = 50, p = -160, h = 30, pp = conj(p, f), F = fig(-175, 120, 60), hh = 44, sensor = pp;
    F.axis().lens(0, true, hh, tr('objectif', 'lens')).pt(0, 'O').pt(-f, 'F', true).pt(f, 'F′', true);
    F.add('<rect x="' + F.X(sensor) + '" y="' + F.Y(40) + '" width="6" height="' + (F.Y(-40) - F.Y(40)) + '" class="sensor"/>'); F.text(sensor + 3, 40, tr('capteur', 'sensor'), 'lbl', 'middle', 0, -6);
    F.line(-6, 34, -6, hh, 'lens'); F.line(-6, -34, -6, -hh, 'lens'); F.text(-6, -hh, tr('diaphragme', 'aperture'), 'lbl dim', 'middle', 0, 14);
    F.vec(p, 0, h, 'obj', false, 'B'); F.text(p, 0, 'A', 'lbl objt', 'middle', 0, 15);
    F.step('L’objectif (lentille convergente) forme une image réelle renversée de l’objet.', 'The lens (converging) forms a real inverted image of the object.');
    [[0, 'r1'], [h / p, 'r2'], [h / (p + f), 'r3']].forEach(([sIn, cls], i) => { const y0 = yAt(p, h, sIn, 0), sOut = i === 0 ? -h / f : i === 1 ? h / p : 0; F.line(p, h, 0, y0, cls); F.mid(p, h, 0, y0, cls); F.line(0, y0, sensor, yAt(0, y0, sOut, sensor), cls); });
    F.step('Mise au point : on règle le tirage (distance objectif–capteur) pour que l’image tombe sur le capteur. Objet à l’infini : capteur en F′ ; objet proche : on éloigne l’objectif (OA′ > f′).', 'Focusing: the lens–sensor distance is adjusted so that the image lands on the sensor. Object at infinity: sensor at F′; close object: the lens moves away (OA′ > f′).', 'img');
    F.vec(pp, 0, (pp / p) * h, 'img', false, 'B′');
    F.step('Le diaphragme règle la quantité de lumière et la profondeur de champ (plus il est fermé, plus la zone nette est profonde).', 'The aperture stop sets the amount of light and the depth of field (the more it is closed, the deeper the sharp zone).', 'img');
    return { F, pp };
  }

  // ------------------------------------------------------------ catalogue
  const T = (fr, en) => ({ fr, en });
  const LIST = [
    { id: 'c1', g: 'conv', t: T('Objet réel avant 2F (au-delà de 2f′)', 'Real object beyond 2F'), make: () => lensCase(60, -150, 30) },
    { id: 'c2', g: 'conv', t: T('Objet réel entre 2F et F', 'Real object between 2F and F'), make: () => lensCase(60, -90, 26) },
    { id: 'c2b', g: 'conv', t: T('Objet en 2F : image en 2F′, γ = −1', 'Object at 2F: image at 2F′, m = −1'), make: () => lensCase(60, -120, 28) },
    { id: 'c3', g: 'conv', t: T('Objet au foyer F : image à l’infini', 'Object at focus F: image at infinity'), make: () => lensCase(60, -60, 26) },
    { id: 'c4', g: 'conv', t: T('Objet entre F et O : image virtuelle (loupe)', 'Object between F and O: virtual image (magnifier)'), make: () => lensCase(60, -36, 18, { xmin: -175, xmax: 160 }) },
    { id: 'c5', g: 'conv', t: T('Objet virtuel (rayons convergents)', 'Virtual object (converging rays)'), make: () => lensCase(60, 50, 34) },
    { id: 'ci', g: 'conv', t: T('Objet à l’infini : image dans le plan focal image', 'Object at infinity: image in the image focal plane'), make: () => infCase(60) },
    { id: 'd1', g: 'div', t: T('Objet réel : image virtuelle droite réduite', 'Real object: virtual upright reduced image'), make: () => lensCase(-60, -100, 34) },
    { id: 'd2', g: 'div', t: T('Objet virtuel entre O et F : image réelle droite agrandie', 'Virtual object between O and F: real upright enlarged image'), make: () => lensCase(-60, 40, 20) },
    { id: 'd3', g: 'div', t: T('Objet virtuel au-delà de F : image virtuelle renversée', 'Virtual object beyond F: virtual inverted image'), make: () => lensCase(-60, 95, 26, { xmin: -205, xmax: 175 }) },
    { id: 'di', g: 'div', t: T('Objet à l’infini : image virtuelle dans le plan focal image', 'Object at infinity: virtual image in the image focal plane'), make: () => infCase(-60) },
    { id: 'qc', g: 'any', t: T('Rayon incident quelconque — lentille convergente', 'Any incident ray — converging lens'), make: () => anyRay(60, 'in') },
    { id: 'qd', g: 'any', t: T('Rayon incident quelconque — lentille divergente', 'Any incident ray — diverging lens'), make: () => anyRay(-60, 'in') },
    { id: 'ec', g: 'any', t: T('Rayon émergent quelconque — lentille convergente', 'Any emerging ray — converging lens'), make: () => anyRay(60, 'out') },
    { id: 'ed', g: 'any', t: T('Rayon émergent quelconque — lentille divergente', 'Any emerging ray — diverging lens'), make: () => anyRay(-60, 'out') },
    { id: 'mi', g: 'base', t: T('Miroir plan : stigmatisme rigoureux', 'Plane mirror: rigorous stigmatism'), make: mirror },
    { id: 'sn', g: 'base', t: T('Réflexion et réfraction (Snell-Descartes)', 'Reflection and refraction (Snell-Descartes)'), make: () => refraction(false) },
    { id: 'rt', g: 'base', t: T('Réflexion totale et angle limite', 'Total internal reflection and critical angle'), make: () => refraction(true) },
    { id: 'pr', g: 'dev', t: T('Prisme : minimum de déviation', 'Prism: minimum deviation'), make: prismFig },
    { id: 'fo', g: 'dev', t: T('Fibre optique : cône d’acceptance', 'Optical fibre: acceptance cone'), make: fiberFig },
    { id: 'lo', g: 'dev', t: T('Loupe : image à l’infini, grossissement', 'Magnifier: image at infinity, magnification'), make: loupe },
    { id: 'ke', g: 'dev', t: T('Lunette astronomique de Kepler (afocale)', 'Keplerian astronomical telescope (afocal)'), make: kepler },
    { id: 'en', g: 'dev', t: T('Œil normal (modèle de l’œil réduit)', 'Normal eye (reduced eye model)'), make: () => eye('normal') },
    { id: 'em', g: 'dev', t: T('Œil myope et sa correction', 'Short-sighted eye and its correction'), make: () => eye('myope') },
    { id: 'eh', g: 'dev', t: T('Œil hypermétrope et sa correction', 'Long-sighted eye and its correction'), make: () => eye('hyper') },
    { id: 'ap', g: 'dev', t: T('Appareil photographique : mise au point', 'Camera: focusing'), make: camera },
  ];
  const GROUPS = { conv: T('Lentille mince convergente', 'Thin converging lens'), div: T('Lentille mince divergente', 'Thin diverging lens'), any: T('Rayons quelconques', 'Arbitrary rays'), base: T('Miroir, réflexion, réfraction', 'Mirror, reflection, refraction'), dev: T('Instruments et dispositifs', 'Instruments and devices') };
  return { setLang, LIST, GROUPS, lensCase, infCase, anyRay, mirror, refraction, prismFig, fiberFig, kepler, loupe, eye, camera, conj, W, H };
});
