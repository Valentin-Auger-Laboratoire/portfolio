import { FORMES, lireSTL, lireOBJ, ecrireSTL, normaliser, boite, zVersY, lireFichier } from '../formes.js';
import { v3, q4, m4, rayonPixel, projeterPixel, rayonBoite, rayonTriangle } from '../m3d.js';
let ok = 0, ko = 0; const check = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC', m); } };
let s = 11; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

// volume signé d'un maillage fermé (théorème de la divergence)
const volume = (p) => { let V = 0; for (let i = 0; i < p.length; i += 9) { const a = [p[i], p[i+1], p[i+2]], b = [p[i+3], p[i+4], p[i+5]], c = [p[i+6], p[i+7], p[i+8]]; V += v3.dot(a, v3.cross(b, c)) / 6; } return V; };
const attendu = { cube: 1, sphere: Math.PI / 6, cylindre: Math.PI / 4, cone: Math.PI / 12, tore: 2 * Math.PI ** 2 * 0.35 * 0.15 ** 2, pyramide: 1 / 3 };
for (const [nom, f] of Object.entries(FORMES)) {
  const m = f(); const V = volume(m.positions);
  check(Math.abs(V - attendu[nom]) / attendu[nom] < (nom === 'cube' || nom === 'pyramide' ? 1e-6 : 0.02), `${nom} : volume ${V.toFixed(4)} vs ${attendu[nom].toFixed(4)} (fermé, faces vers l'extérieur)`);
  // sens des sommets = normale stockée
  let bien = 0, tot = 0;
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions, a = [p[i], p[i+1], p[i+2]], b = [p[i+3], p[i+4], p[i+5]], c = [p[i+6], p[i+7], p[i+8]];
    const g = v3.cross(v3.sub(b, a), v3.sub(c, a)); if (v3.len(g) < 1e-12) continue;
    const n = [m.normales[i] + m.normales[i+3] + m.normales[i+6], m.normales[i+1] + m.normales[i+4] + m.normales[i+7], m.normales[i+2] + m.normales[i+5] + m.normales[i+8]];
    tot++; if (v3.dot(g, n) > 0) bien++;
  }
  check(bien === tot, `${nom} : normales cohérentes avec les sommets (${bien}/${tot})`);
  const { min, max } = boite(m.positions);
  check(Math.max(...max.map((x, k) => x - min[k])) <= 1 + 1e-6, `${nom} : tient dans un cube de 1`);
}

// STL binaire : écriture puis lecture identique ; STL texte ; OBJ ; erreurs
{
  const m = FORMES.tore(); const buf = ecrireSTL(m.positions, 'tore');
  const r = lireSTL(buf);
  check(r.format === 'STL binaire' && r.positions.length === m.positions.length, 'STL binaire : nombre de triangles');
  let e = 0; for (let i = 0; i < r.positions.length; i++) e = Math.max(e, Math.abs(r.positions[i] - m.positions[i])); check(e < 1e-7, 'STL binaire : sommets identiques');
  const txt = 'solid t\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n   vertex 10 0 0\n   vertex 0 10 0\n  endloop\n endfacet\nendsolid t\n';
  const r2 = lireSTL(new TextEncoder().encode(txt).buffer);
  check(r2.format === 'STL texte' && r2.positions.length === 9 && r2.normales[2] === 1, 'STL texte');
  const obj = '# carré\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1/1/1 2/2/2 3/3/3 4/4/4\nf -4 -2 -1\n';
  const r3 = lireOBJ(obj); check(r3.positions.length === 27, 'OBJ : quadrilatère en éventail + indices négatifs');
  for (const [mal, nom] of [[() => lireOBJ('v 0 0 0\nf 1 2 3'), 'OBJ indice invalide'], [() => lireSTL(new TextEncoder().encode('bonjour').buffer), 'STL illisible'], [() => lireFichier('a.step', new ArrayBuffer(4)), 'format refusé']]) {
    let refus = false; try { mal(); } catch (er) { refus = true; } check(refus, nom);
  }
  // STL d'une vraie pièce (le boîtier d'Athletix-Data), si présent à côté
  const n = normaliser({ ...r, positions: r.positions.map((x) => x * 40) }, 1);
  const bb = boite(n.positions); check(Math.abs(Math.max(...bb.max.map((x, k) => x - bb.min[k])) - 1) < 1e-6 && Math.abs(bb.min[0] + bb.max[0]) < 1e-6, 'normaliser : centré, taille 1');
  check(Math.abs(n.dimsOrigine[0] - 40 * 1.0) < 1e-4, 'normaliser : dimensions d\'origine gardées');
  const zy = zVersY(FORMES.cone()); check(boite(zy.positions).max[2] > 0.49 && boite(zy.positions).max[1] < 0.51, 'Z vers le haut -> Y vers le haut');
}

// maths : quaternions, matrices, projection <-> rayon, intersections
for (let k = 0; k < 500; k++) {
  const q = q4.axeAngle([rnd() - .5, rnd() - .5, rnd() - .5], rnd() * 6), v = [rnd(), rnd(), rnd()];
  const M = m4.trs([1, 2, 3], q, 2), p = m4.point(M, v), att = v3.add(v3.mul(q4.tourner(q, v), 2), [1, 2, 3]);
  if (v3.len(v3.sub(p, att)) > 1e-9) { check(false, 'trs'); break; }
  const R = m4.trs([0, 0, 0], q, 1), mat = [[R[0], R[4], R[8]], [R[1], R[5], R[9]], [R[2], R[6], R[10]]];
  const q2 = q4.depuisMat3(mat); if (q4.angle(q4.mul(q2, q4.conj(q))) > 1e-6) { check(false, 'depuisMat3'); break; }
  const oeil = [rnd() * 4, rnd() * 4, 5 + rnd()], qc = q4.axeAngle([rnd() - .5, rnd() - .5, rnd() - .5], rnd() * 0.5);
  const P = v3.add(oeil, q4.tourner(qc, [rnd() - .5, rnd() - .5, -2 - rnd() * 3]));
  const [sx, sy, z] = projeterPixel(P, 800, 600, 1.0, oeil, qc), r = rayonPixel(sx, sy, 800, 600, 1.0, oeil, qc);
  const w = v3.sub(P, r.o), t = v3.dot(w, r.d); if (!(z > 0) || v3.len(v3.sub(w, v3.mul(r.d, t))) > 1e-9) { check(false, 'rayon <-> projection'); break; }
  const V = m4.vue(oeil, qc), Pv = m4.point(V, P); if (Math.abs(-Pv[2] - z) > 1e-9) { check(false, 'matrice de vue'); break; }
  ok += 5;
}
check(Math.abs(rayonBoite({ o: [0, 0, 5], d: [0, 0, -1] }, [-1, -1, -1], [1, 1, 1]) - 4) < 1e-12, 'rayon / boîte');
check(rayonBoite({ o: [3, 0, 5], d: [0, 0, -1] }, [-1, -1, -1], [1, 1, 1]) === null, 'rayon / boîte manquée');
check(Math.abs(rayonTriangle({ o: [0.2, 0.2, 1], d: [0, 0, -1] }, [0, 0, 0], [1, 0, 0], [0, 1, 0]) - 1) < 1e-12, 'rayon / triangle');
check(rayonTriangle({ o: [0.8, 0.8, 1], d: [0, 0, -1] }, [0, 0, 0], [1, 0, 0], [0, 1, 0]) === null, 'rayon / triangle manqué');
{ const a = q4.axeAngle([0, 1, 0], 0), b = q4.axeAngle([0, 1, 0], 1); check(Math.abs(q4.angle(q4.slerp(a, b, 0.5)) - 0.5) < 1e-9, 'slerp à mi-chemin'); }
console.log(`formes et maths : ${ok} réussies, ${ko} échouées`);
if (ko) process.exit(1);
