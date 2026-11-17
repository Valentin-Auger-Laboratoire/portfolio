import { humeur, scores, corriger, moyenneRepos, Lisseur, indices, versObjet, HUMEURS } from '../humeur.js';
let ok = 0, ko = 0; const check = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC', m); } };
const visage = (o) => ({ eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05, ...o });
const cas = [
  ['neutre', visage({})],
  ['content', visage({ mouthSmileLeft: 0.8, mouthSmileRight: 0.75, cheekSquintLeft: 0.4, cheekSquintRight: 0.4 })],
  ['content', visage({ mouthSmileLeft: 0.95, mouthSmileRight: 0.95, browDownLeft: 0.8, browDownRight: 0.85 })],   // sourire franc, sourcils bas (photo réelle)
  ['surpris', visage({ jawOpen: 0.7, browInnerUp: 0.8, eyeWideLeft: 0.6, eyeWideRight: 0.6 })],
  ['triste', visage({ mouthFrownLeft: 0.6, mouthFrownRight: 0.55, browInnerUp: 0.5 })],
  ['contrarie', visage({ browDownLeft: 0.7, browDownRight: 0.7, mouthPressLeft: 0.5, mouthPressRight: 0.5, noseSneerLeft: 0.3, noseSneerRight: 0.3 })],
  ['neutre', visage({ mouthSmileLeft: 0.12, mouthSmileRight: 0.1, browDownLeft: 0.1, browDownRight: 0.1 })],          // traces faibles : neutre
];
for (const [att, b] of cas) { const h = humeur(b); check(h.humeur === att, `${att} attendu, ${h.humeur} obtenu ${JSON.stringify(h.p)}`); }
for (const [, b] of cas) { const h = humeur(b); const S = HUMEURS.reduce((a, k) => a + h.p[k], 0); check(Math.abs(S - 1) < 1e-12, 'probabilités de somme 1'); }
// calibration : une personne aux sourcils naturellement bas n'est plus « contrariée » au repos
{
  const repos = visage({ browDownLeft: 0.55, browDownRight: 0.6, mouthPressLeft: 0.3, mouthPressRight: 0.3 });
  check(humeur(repos).humeur === 'contrarie', 'sans calibration : visage au repos lu contrarié');
  const R = moyenneRepos([repos, repos, repos]);
  check(humeur(corriger(repos, R)).humeur === 'neutre', 'avec calibration : neutre');
  const fache = visage({ browDownLeft: 0.95, browDownRight: 0.95, mouthPressLeft: 0.8, mouthPressRight: 0.8, noseSneerLeft: 0.4, noseSneerRight: 0.4 });
  check(humeur(corriger(fache, R)).humeur === 'contrarie', 'avec calibration : vrai froncement toujours lu');
  const c = corriger({ a: 0.5 }, { a: 0.5 }); check(c.a === 0, 'corriger : repos -> 0');
  const c2 = corriger({ a: 1 }, { a: 0.5 }); check(Math.abs(c2.a - 1) < 1e-12, 'corriger : maximum -> 1');
}
// lissage : une image isolée ne change pas l'étiquette, une expression tenue oui
{
  const L = new Lisseur(0.25, 350); const n = humeur(cas[0][1]).p, c = humeur(cas[1][1]).p;
  let t = 0, r;
  for (; t < 1000; t += 33) r = L.pousser(n, t);
  r = L.pousser(c, t); t += 33; r = L.pousser(n, t);
  check(r.humeur === 'neutre', 'une image souriante isolée : reste neutre');
  for (let k = 0; k < 30; k++) { t += 33; r = L.pousser(c, t); }
  check(r.humeur === 'content', 'sourire tenu 1 s : content');
}
check(versObjet([{ categoryName: 'jawOpen', score: 0.3 }]).jawOpen === 0.3, 'versObjet');
check(indices({ mouthSmileLeft: 0.4, mouthSmileRight: 0.6 }).sourire === 0.5, 'indice sourire = moyenne gauche/droite');
console.log(`humeur : ${ok} réussies, ${ko} échouées`);
if (ko) process.exit(1);
