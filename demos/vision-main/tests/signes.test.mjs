import { lettres, mainLocale, versImage, reconnaitre, caracteristiques, Stabilisateur, modeles } from '../signes.js';
let ok = 0, ko = 0; const check = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC', m); } };
let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

// 1. invariance : position, taille, rotation, main gauche/droite
for (const ab of ['lsf', 'asl']) for (const l of lettres(ab)) {
  const P = mainLocale(l);
  const a = versImage(P, { main: 'droite', angleImage: l.o ?? 0 }), ref = caracteristiques(a.monde, a.image, 1);
  for (const opt of [{ main: 'gauche' }, { lacet: 35 }, { tangage: -25 }]) {
    const b = versImage(mainLocale(l, { echelle: 1.2 }), { main: 'droite', angleImage: l.o ?? 0, ...opt });
    const c = caracteristiques(b.monde, b.image, opt.main === 'gauche' ? -1 : 1);
    const e = Math.max(...c.v.map((v, i) => Math.abs(v - ref.v[i])));
    check(e < 1e-6, `${ab} ${l.lettre} invariance ${JSON.stringify(opt)} (${e})`);
  }
}
// 2. reconnaissance sans bruit : chaque lettre se reconnaît elle-même, mains droite et gauche
for (const ab of ['lsf', 'asl']) for (const l of lettres(ab)) for (const main of ['droite', 'gauche']) {
  const { monde, image } = versImage(mainLocale(l), { main, angleImage: l.o ?? 0 });
  const r = reconnaitre(monde, image, ab);
  check(r.lettre === l.lettre && r.confiance > 0.5, `${ab} ${l.lettre} ${main} -> ${r.lettre}`);
}
// 3. robustesse : bruit des angles (7°), taille (±15 %), rotations (lacet ±30°, tangage ±20°, ±15° dans l'image), bruit 2 mm
const resume = {};
for (const ab of ['lsf', 'asl']) {
  let tot = 0, bon = 0; const parLettre = {};
  for (const l of lettres(ab)) {
    let b = 0;
    for (let k = 0; k < 60; k++) {
      const main = rnd() < 0.5 ? 'droite' : 'gauche';
      const P = mainLocale(l, { bruit: 7, echelle: 0.85 + rnd() * 0.3, alea: rnd });
      const { monde, image } = versImage(P, { main, angleImage: (l.o ?? 0) + (rnd() * 2 - 1) * 15, lacet: (rnd() * 2 - 1) * 30, tangage: (rnd() * 2 - 1) * 20, bruitMm: 2, alea: rnd });
      const r = reconnaitre(monde, image, ab, { main: rnd() < 0.5 ? main : null });
      tot++; if (r.lettre === l.lettre) { bon++; b++; }
    }
    parLettre[l.lettre] = b / 60;
    check(b / 60 >= 0.8, `${ab} ${l.lettre} robuste : ${Math.round(b / 60 * 100)} %`);
  }
  resume[ab] = (bon / tot * 100).toFixed(1);
  check(bon / tot >= 0.95, `${ab} global ${resume[ab]} %`);
}
console.log('  signes de synthèse : LSF ' + resume.lsf + ' %, ASL ' + resume.asl + ' % (24 lettres, 60 mains bruitées chacune)');
// 4. lettres propres à chaque alphabet
const diff = ['F', 'G', 'H', 'T', 'X'];
for (const L of diff) {
  const a = lettres('lsf').find((x) => x.lettre === L), b = lettres('asl').find((x) => x.lettre === L);
  check(a && b && a.desc.fr !== b.desc.fr, 'forme différente LSF/ASL : ' + L);
}
check(lettres('lsf').length === 24 && lettres('asl').length === 24 && !lettres('lsf').some((l) => l.lettre === 'J' || l.lettre === 'Z'), '24 lettres statiques, sans J ni Z');
// LSF H (cornes) reconnu comme H en LSF mais pas en ASL
{ const l = lettres('lsf').find((x) => x.lettre === 'H'); const { monde, image } = versImage(mainLocale(l), {});
  check(reconnaitre(monde, image, 'lsf').lettre === 'H' && reconnaitre(monde, image, 'asl').lettre !== 'H', 'H en cornes : LSF oui, ASL non'); }
// 5. exemples personnels : une forme inconnue apprise devient reconnue
{
  const forme = { d: [[0, 30, 30, 20], [0, 70, 40, 20], [0, 10, 80, 60], [0, 50, 10, 10]], p: (f) => ({ dirs: [[70, 30], [60, 20], [40, 0]] }) };
  const ex = [];
  for (let k = 0; k < 10; k++) { const { monde, image } = versImage(mainLocale(forme, { bruit: 4, alea: rnd }), { lacet: (rnd() - 0.5) * 20, alea: rnd }); ex.push({ lettre: 'B', c: caracteristiques(monde, image, 1) }); }
  const { monde, image } = versImage(mainLocale(forme, { bruit: 4, alea: rnd }), { alea: rnd });
  const sans = reconnaitre(monde, image, 'lsf'), avec = reconnaitre(monde, image, 'lsf', { exemples: ex });
  check(avec.lettre === 'B' && avec.distance < sans.distance, `exemples personnels : ${sans.lettre} (${sans.distance.toFixed(2)}) -> ${avec.lettre} (${avec.distance.toFixed(2)})`);
}
// 6. stabilisation : validée une seule fois après 900 ms
{
  const st = new Stabilisateur(900); const v = [];
  for (let t = 0; t <= 2000; t += 50) { const r = st.pousser(t < 300 ? 'A' : 'B', t); if (r) v.push([r, t]); }
  check(v.length === 1 && v[0][0] === 'B' && v[0][1] >= 1200, 'stabilisation ' + JSON.stringify(v));
  check(st.pousser(null, 2100) === null && st.progression(2100) === 0, 'pas de main : rien');
}
console.log(`signes : ${ok} réussies, ${ko} échouées`);
if (ko) process.exit(1);
