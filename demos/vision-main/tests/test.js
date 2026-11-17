// Tests de la démo Vision IA (Node 18+) : node tests/test.js
const { execFileSync } = require('child_process');
const path = require('path');
let echec = false;
for (const f of ['voxels.test.mjs', 'signes.test.mjs', 'humeur.test.mjs']) {
  try { process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, f)]).toString()); }
  catch (e) { process.stdout.write((e.stdout || '').toString()); echec = true; }
}
if (echec) { console.log('DES TESTS ONT ÉCHOUÉ'); process.exit(1); }
console.log('Tous les tests sont réussis.');
