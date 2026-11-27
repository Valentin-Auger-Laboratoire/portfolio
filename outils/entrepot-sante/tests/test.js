/* Vérifications du moteur « Entrepôt de données de santé » : node tests/test.js */
'use strict';
const E = require('../entrepot.js');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('ÉCHEC : ' + m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m} (${a} ≠ ${b})`);

const G = E.generer({ patients: 1500, graine: 2026 });
const S = G.sejours;

// 1. Générateur
ok(S.length > 2000 && G.patients.length === 1500, `séjours générés (${S.length})`);
ok(JSON.stringify(E.generer({ patients: 50, graine: 9 })) === JSON.stringify(E.generer({ patients: 50, graine: 9 })), 'même graine → mêmes données');
ok(S.every((s) => s.sortie >= s.entree && E.jours(s.entree, s.sortie) === s.dms), 'durée de séjour = sortie − entrée');
{
  const parP = {};
  S.forEach((s) => (parP[s.ins] = parP[s.ins] || []).push(s));
  let okRh = true;
  Object.values(parP).forEach((l) => { l.sort((a, b) => a.entree.localeCompare(b.entree)); l.forEach((s, i) => { const v = i + 1 < l.length && E.jours(s.sortie, l[i + 1].entree) <= 30; if (v !== s.rh30) okRh = false; }); });
  ok(okRh, 'réhospitalisation à 30 jours cohérente avec les dates');
  const taux = S.filter((s) => s.rh30).length / S.length;
  ok(taux > 0.04 && taux < 0.2, `taux de réhospitalisation plausible (${(100 * taux).toFixed(1)} %)`);
}
{
  const e11 = S.filter((s) => s.diags.includes('E11')), aut = S.filter((s) => !s.diags.includes('E11'));
  const moy = (l) => l.reduce((a, s) => a + s.glyc, 0) / l.length;
  ok(moy(e11) > moy(aut) + 2.5, 'glycémie plus haute chez les diabétiques');
}

// 2. Variété : les trois formats redonnent exactement les données (sans erreur injectée)
const sansErreur = E.emettre(S, {}, 3);
{
  const parId = new Map(S.map((s) => [s.id, s]));
  const formats = { A: 0, B: 0, C: 0 };
  let identiques = 0;
  sansErreur.msgs.forEach((m) => {
    const r = E.lire(m), s = parId.get(r.id);
    formats[m.site]++;
    let glyc = r.glyc, crea = r.crea;
    if (r.glycUnite === 'mg/dL') glyc = glyc / E.GLU_MGDL;
    if (r.creaUnite === 'mg/dL') crea = crea * E.CREA_UMOL;
    const memes = r.ins === s.ins && r.naissance === s.naissance && r.sexe === s.sexe && E.normaliserService(r.serviceBrut).code === s.service
      && r.entree === s.entree && r.sortie === s.sortie && r.diags.join() === s.diags.join() && r.meds.join() === s.meds.join()
      && Math.abs(glyc - s.glyc) < 0.03 && Math.abs(crea - s.crea) < 0.5;
    if (memes) identiques++;
  });
  ok(identiques === S.length, `HL7 v2, FHIR et CSV relus sans perte (${identiques} / ${S.length})`);
  ok(formats.A > 0 && formats.B > 0 && formats.C > 0, 'les trois sites envoient');
  const n0 = E.nettoyer(sansErreur.msgs);
  ok(Object.entries(n0.compte).every(([k, v]) => k === 'recus' || v === 0), 'aucune fausse alerte sur des données propres');
}
near(E.GLU_MGDL * 5.5, 99.088, 1e-9, '5,5 mmol/L = 99,1 mg/dL'); near(1.2 * E.CREA_UMOL, 106.104, 1e-9, '1,2 mg/dL = 106 µmol/L');

// 3. Véracité : détection des erreurs injectées
const taux = { doublon: 0.03, libelle: 0.08, unite: 0.3, aberrant: 0.02, dates: 0.02, manquant: 0.03 };
const em = E.emettre(S, taux, 7);
const net = E.nettoyer(em.msgs);
const det = E.evaluerDetection(em.verite, net);
['doublon', 'libelle', 'dates', 'manquant'].forEach((k) => ok(det[k].injectees > 10 && det[k].rappel === 1 && det[k].fauxPositifs === 0, `${k} : toutes retrouvées, aucun faux positif (${det[k].detectees}/${det[k].injectees})`));
ok(det.unite.rappel > 0.97, `unités : ${det.unite.detectees}/${det.unite.injectees}`);
ok(det.aberrant.rappel > 0.9, `valeurs impossibles : ${det.aberrant.detectees}/${det.aberrant.injectees}`);
ok(net.propres.length === S.length, 'après nettoyage : un séjour par séjour réel (doublons retirés)');
{
  const parId = new Map(S.map((s) => [s.id, s]));
  ok(net.propres.every((p) => p.dms === parId.get(p.id).dms), 'dates inversées remises dans l\'ordre');
  ok(net.propres.every((p) => p.glyc == null || em.verite[p.id].includes('aberrant') || Math.abs(p.glyc - parId.get(p.id).glyc) < 0.06), 'glycémies converties en mmol/L = vraies valeurs');
  ok(net.propres.every((p) => p.service === parId.get(p.id).service), 'libellés de service tous ramenés au bon code');
  // effet sur un indicateur : glycémie moyenne des diabétiques, brute (non nettoyée) vs propre vs vraie
  const vraie = S.filter((s) => s.diags.includes('E11')).reduce((a, s, _, l) => a + s.glyc / l.length, 0);
  const propre = net.propres.filter((s) => s.diags.includes('E11') && s.glyc != null).reduce((a, s, _, l) => a + s.glyc / l.length, 0);
  const b = E.brut(em.msgs).filter((s) => s.diags.includes('E11')).reduce((a, s, _, l) => a + s.glyc / l.length, 0);
  ok(Math.abs(propre - vraie) < 0.1 && Math.abs(b - vraie) > 5, `indicateur : brut ${b.toFixed(1)}, propre ${propre.toFixed(2)}, vrai ${vraie.toFixed(2)} mmol/L`);
}
ok(E.levenshtein('cardiolgie', 'cardiologie') === 1 && E.levenshtein('abc', 'abc') === 0 && E.levenshtein('', 'abc') === 3, 'distance de Levenshtein');
Object.entries(E.VARIANTES).forEach(([code, v]) => v.forEach((x) => ok(E.normaliserService(x).code === code, `libellé « ${x} » → ${code}`)));
ok(E.normaliserService('Radiologie').code === null, 'libellé inconnu non deviné');

// 4. Entrepôt et pseudonymisation
const W = E.construireEntrepot(net.propres);
ok(W.faits.length === S.length, 'une ligne de fait par séjour');
{
  const ps = new Set(W.dimPatient.map((p) => p.patient_k));
  ok(ps.size === new Set(S.map((s) => s.ins)).size, 'un pseudonyme par patient, sans collision');
  ok(E.pseudonyme('INS123', 1) === E.pseudonyme('INS123', 1) && E.pseudonyme('INS123', 1) !== E.pseudonyme('INS123', 2), 'pseudonyme stable, dépend du sel');
  ok(!JSON.stringify(W.faits).includes('INS'), 'aucun identifiant en clair dans l\'entrepôt');
  const rhVrai = S.filter((s) => s.rh30).length, rhW = W.faits.reduce((a, f) => a + f.rh30, 0);
  ok(rhVrai === rhW, `réhospitalisations recalculées dans l'entrepôt (${rhW} = ${rhVrai})`);
}

// 5. Cube OLAP
{
  const c = E.cube(W.faits, { lignes: 'service', colonnes: 'annee', mesure: 'sejours' });
  const somme = c.valeurs.flat().reduce((a, v) => a + (v || 0), 0);
  ok(somme === W.faits.length && c.total === W.faits.length, 'somme des cellules = total');
  ok(c.totLignes.reduce((a, v) => a + v, 0) === c.total, 'totaux de lignes cohérents');
  const mois = E.cube(W.faits, { lignes: 'mois', mesure: 'sejours' }), an = E.cube(W.faits, { lignes: 'annee', mesure: 'sejours' });
  const parAn = {}; mois.lignes.forEach((m, i) => (parAn[m.slice(0, 4)] = (parAn[m.slice(0, 4)] || 0) + mois.valeurs[i][0]));
  ok(an.lignes.every((a, i) => parAn[a] === an.valeurs[i][0]), 'agrégation mois → année (roll-up)');
  const d = E.cube(W.faits, { lignes: 'service', mesure: 'dms' });
  near(d.total, W.faits.reduce((a, f) => a + f.dms, 0) / W.faits.length, 1e-12, 'DMS totale = moyenne de tous les séjours');
  const sl = E.cube(W.faits, { lignes: 'tranche', mesure: 'sejours', filtres: { service: 'GERIA' } });
  ok(sl.total === W.faits.filter((f) => f.service === 'GERIA').length, 'découpage (slice) sur un service');
  const dice = E.cube(W.faits, { lignes: 'sexe', mesure: 'sejours', filtres: { service: 'CARDIO', annee: '2025' } });
  ok(dice.total === W.faits.filter((f) => f.service === 'CARDIO' && f.annee === '2025').length, 'dé (dice) sur deux dimensions');
  const geria = d.lignes.indexOf('GERIA'), endo = d.lignes.indexOf('ENDO');
  ok(d.valeurs[geria][0] > d.valeurs[endo][0], 'DMS gériatrie > endocrinologie');
  ok(/GROUP BY ROLLUP/.test(E.sql({ lignes: 'service', colonnes: 'annee', mesure: 'dms' })) && /WHERE/.test(E.sql({ lignes: 'sexe', mesure: 'sejours', filtres: { service: 'CARDIO' } })), 'requête SQL équivalente');
}

// 6. NoSQL
{
  const ins = S[0].ins, doc = E.document(net.propres, ins), L = E.lignesSQL(doc);
  ok(doc.sejours.length === S.filter((s) => s.ins === ins).length, 'document : tous les séjours du patient');
  ok(L.diagnostic.length === doc.sejours.reduce((a, s) => a + s.diagnostics.length, 0), 'lignes SQL : une ligne par diagnostic');
}

// 7. MapReduce
{
  const direct = E.compteDirect(net.propres);
  [true, false].forEach((cb) => {
    const r = E.mapReduce(net.propres, { noeuds: 4, reducteurs: 3, combiner: cb });
    ok(r.resultat.size === direct.size && [...direct].every(([k, v]) => r.resultat.get(k) === v), `MapReduce = comptage direct (combiner ${cb})`);
  });
  const avec = E.mapReduce(net.propres, { combiner: true }), sans = E.mapReduce(net.propres, { combiner: false });
  ok(avec.echanges < sans.echanges / 10, `le combiner réduit le shuffle (${avec.echanges} au lieu de ${sans.echanges} paires)`);
  ok(avec.etapes.reduce((a, e) => a + e.lignes, 0) === net.propres.length, 'chaque séjour sur un seul nœud');
  const r8 = E.mapReduce(net.propres, { noeuds: 8, reducteurs: 5 });
  ok([...direct].every(([k, v]) => r8.resultat.get(k) === v), 'même résultat avec 8 nœuds et 5 réducteurs');
}

// 8. Apriori
{
  const T = E.transactions(W.faits, net.propres);
  const a = E.apriori(T, 0.05, 0.5);
  const brute = (items) => T.filter((t) => items.every((i) => t.includes(i))).length / T.length;
  ok(a.frequents.every((f) => Math.abs(f.support - brute(f.items)) < 1e-12 && f.support >= 0.05), 'supports = comptage direct, tous ≥ seuil');
  ok(a.regles.every((r) => r.confiance >= 0.5 && Math.abs(r.confiance - brute([...r.si, ...r.alors]) / brute(r.si)) < 1e-12), 'confiances exactes');
  const r = a.regles.find((x) => x.si.join() === 'E11' && x.alors.join() === 'm:metformine');
  ok(r && Math.abs(r.confiance - 0.75) < 0.05 && r.lift > 3, `règle E11 → metformine retrouvée (confiance ${r && r.confiance.toFixed(2)})`);
  const r2 = a.regles.find((x) => x.si.join() === 'm:apixaban' && x.alors.join() === 'I48');
  ok(r2 && r2.confiance > 0.95, 'apixaban → fibrillation atriale');
  // tous les ensembles fréquents trouvés (vérification exhaustive sur les paires)
  const items = [...new Set(T.flat())];
  let paires = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (brute([items[i], items[j]]) >= 0.05) paires++;
  ok(a.frequents.filter((f) => f.items.length === 2).length === paires, `toutes les paires fréquentes trouvées (${paires})`);
}

// 9. k-means, silhouette, ACP
{
  const h = E.Hasard(3), Z = [], vrai = [];
  [[0, 0], [6, 0], [3, 6]].forEach((c, k) => { for (let i = 0; i < 100; i++) { Z.push([c[0] + 0.5 * h.randn(), c[1] + 0.5 * h.randn()]); vrai.push(k); } });
  const km = E.kmeans(Z, 3, 2);
  let pur = 0;
  for (let c = 0; c < 3; c++) { const m = vrai.filter((_, i) => km.labels[i] === c); const cnt = [0, 1, 2].map((v) => m.filter((x) => x === v).length); pur += Math.max(...cnt); }
  ok(pur === 300, 'k-means retrouve trois groupes séparés');
  ok(E.silhouette(Z, km.labels, 3) > 0.7, 'silhouette élevée pour des groupes nets');
  const ligne = Array.from({ length: 200 }, (_, i) => { const t = i / 20 - 5; return [t, 2 * t + 0.05 * h.randn(), -t + 0.05 * h.randn()]; });
  ok(E.acp2(E.standardiser(ligne).Z).part[0] > 0.99, 'ACP : données alignées → 1re composante > 99 %');
  const P = E.profils(W.faits), X = P.map((p) => E.VARS.map((v) => p[v]));
  const { Z: Zp } = E.standardiser(X);
  const i2 = E.kmeans(Zp, 2, 1).inertie, i6 = E.kmeans(Zp, 6, 1).inertie;
  ok(P.length === W.dimPatient.length && i6 < i2, 'profils patients : inertie qui baisse avec k');
}

// 10. Vélocité
{
  const F = E.nouveauFlux({ lits: 300, hz: 1, signaux: 2, capacite: 2000, desat: 0.05 });
  for (let i = 0; i < 1500; i++) E.pasFlux(F, 0.1);
  ok(F.retard < 0.2, `capacité suffisante : retard ${F.retard.toFixed(2)} s`);
  const desat = F.patients.filter((p) => p.desat).length;
  ok(F.alertes.length === desat, `toutes les désaturations alertées (${F.alertes.length}/${desat})`);
  ok(F.alertes.every((a) => a.detectee - F.patients[a.lit].debut < 15), 'alerte en moins de 15 s');
  near(F.recus / F.t, 600, 30, 'débit reçu = lits × signaux × Hz');
  const G2 = E.nouveauFlux({ lits: 300, hz: 1, signaux: 2, capacite: 300 });
  for (let i = 0; i < 600; i++) E.pasFlux(G2, 0.1);
  ok(G2.retard > 25 && G2.file.length > 8000, `capacité insuffisante : la file grossit (retard ${G2.retard.toFixed(0)} s)`);
  const v = E.volume({ lits: 300, hz: 1, signaux: 2, octets: 60 });
  near(v.parJour, 300 * 2 * 60 * 86400, 1e-6, 'volume par jour');
}

// 11. Stockage et calcul distribué (onglet « Lac, Parquet, Spark »)
const K = require('../stockage.js');
{
  ok(K.EXEMPLES.filter((e) => e.type === 's').length >= 3 && K.EXEMPLES.some((e) => e.id === 'json' && e.type === 'm') && K.EXEMPLES.some((e) => e.id === 'img' && e.type === 'n'), 'types : SQL/CSV structurés, JSON semi-structuré, image non structurée');
  const m = K.metadonnees('labo_C_2026-11.csv', 'a;b\n1;2\n3;4', '2026-11-27');
  ok(m.taille === 11 && m.lignes === 3 && m.format === 'csv', 'métadonnées d\'un fichier');
  const z = K.zonesLac(em.msgs, net.propres, W.faits);
  ok(z.brut.fichiers === em.msgs.length && z.calcule.lignes === net.propres.length && z.brut.octets > z.calcule.octets && z.calcule.octets > z.metier.octets, 'zones du lac : brut > calculé > métier');
  const csv = K.versCSV(W.faits), col = K.versColonnes(W.faits), tri = K.versColonnes(W.faits, { trierPar: ['annee', 'service'] });
  ok(col.octets < csv.length / 1.8, `colonnes encodées plus compactes que le CSV (${col.octets} contre ${csv.length} octets)`);
  const q = { mesure: 'dms', filtres: { service: 'CARDIO', annee: '2025' } };
  const vrai = W.faits.filter((f) => f.service === 'CARDIO' && f.annee === '2025');
  const moy = vrai.reduce((a, f) => a + f.dms, 0) / vrai.length;
  const rC = K.requeteCSV(W.faits, csv, q), rCol = K.requeteColonnes(col, q), rTri = K.requeteColonnes(tri, q);
  const P = K.partitionner(W.faits, ['annee', 'service']), rP = K.requetePartitions(P, ['annee', 'service'], q);
  [rC, rCol, rTri, rP].forEach((r, i) => near(r.valeur, moy, 1e-12, `même résultat quelle que soit la lecture (${i})`));
  ok(rCol.octetsLus < rC.octetsLus / 20, 'colonnes : seules les colonnes utiles sont lues');
  ok(rTri.groupesLus < rTri.groupesTotal && rTri.octetsLus < rCol.octetsLus, 'données triées : les statistiques min/max sautent des groupes');
  ok(rP.fichiersLus === 1 && rP.fichiersTotal === 2 * Object.keys(E.SERVICES).length && rP.octetsLus < rTri.octetsLus, 'partitions : un seul fichier lu');
  ok(P.reduce((a, p) => a + p.n, 0) === W.faits.length, 'partitions : aucune ligne perdue');
  near(K.amdahl(0.05, 1), 1, 1e-12, 'Amdahl p = 1'); near(K.amdahl(0.05, 1e9), 20, 1e-6, 'Amdahl : plafond 1/s');
  const seqT = K.ordonnancer({ noeuds: 1, coeursParNoeud: 1, partitions: 64, sequentiel: 0, coutTache: 0 });
  near(seqT.duree, 1000, 1e-9, '1 cœur : durée = travail total');
  const d = [1, 2, 4].map((nn) => K.ordonnancer({ noeuds: nn, partitions: 64 }).duree);
  ok(d[0] > d[1] && d[1] > d[2], 'plus de nœuds → plus rapide');
  const peu = K.ordonnancer({ noeuds: 16, partitions: 8 }), assez = K.ordonnancer({ noeuds: 16, partitions: 128 });
  ok(peu.duree > assez.duree * 1.3, 'moins de partitions que de cœurs : cœurs inoccupés');
  const lim = K.ordonnancer({ noeuds: 64, partitions: 1024, coutTache: 0 }), borne = 0.05 * 1000 + 0.95 * 1000 / 256;
  ok(lim.duree >= borne - 1e-9, 'jamais mieux que la loi d\'Amdahl');
  ok(K.ordonnancer({ noeuds: 4, partitions: 64, desequilibre: 1 }).duree > K.ordonnancer({ noeuds: 4, partitions: 64 }).duree * 1.3, 'une partition trop grosse ralentit tout (déséquilibre)');
  const sain = K.ordonnancer({ noeuds: 4, partitions: 64 }), panne = K.ordonnancer({ noeuds: 4, partitions: 64, panneA: 80 });
  ok(panne.relances >= 1 && panne.duree > sain.duree && new Set(panne.traces.filter((t) => !t.perdue).map((t) => t.tache)).size === 64, 'panne d\'un nœud : tâches relancées ailleurs, travail complet');
  ok(K.coutScaleUp(256) === Infinity && K.coutScaleUp(64) > K.coutScaleOut(64), 'scale up : plafond et prix plus que proportionnel');
  const df = K.DataFrame(W.faits).withColumn('dms_sem', (r) => r.dms / 7, ['dms']).filter('service', 'CARDIO').filter('annee', '2025').select('dms_sem');
  ok(df.plan.length === 4, 'évaluation paresseuse : rien n\'est calculé avant l\'action');
  const a1 = df.avg('dms_sem', false), a2 = df.avg('dms_sem', true);
  near(a1.valeur, moy / 7, 1e-12, 'plan naïf : bon résultat'); near(a2.valeur, moy / 7, 1e-12, 'plan optimisé : même résultat');
  ok(a2.cellulesLues < a1.cellulesLues / 4 && a2.cellulesCalculees === vrai.length, 'plan optimisé : filtres poussés et colonnes élaguées');
  ok(/PushedFilters/.test(df.explain(true)[0]), 'plan affiché avec filtres poussés');
  const T = K.Table(W.faits.slice(0, 50).map((f) => ({ id: f.sejour_k, glyc: f.glyc, patient: f.patient_k })), 'id');
  const v1 = T.transaction('correction', [{ type: 'upsert', lignes: [{ id: W.faits[0].sejour_k, glyc: 6.1 }] }]);
  const avant = T.lire().length;
  const rate = T.transaction('suppression interrompue', [{ type: 'delete', si: (l) => l.patient === W.faits[1].patient_k }, { type: 'echec', message: 'coupure' }]);
  ok(v1.ok && !rate.ok && T.lire().length === avant && T.derniere() === 1, 'atomicité : transaction interrompue sans effet');
  const ctl = T.transaction('contrôle', [{ type: 'upsert', lignes: [{ id: 'X', glyc: 99 }] }, { type: 'check', nom: 'glycémie', regle: (l) => l.glyc == null || l.glyc < 50 }]);
  ok(!ctl.ok && !T.lire().some((l) => l.id === 'X'), 'cohérence : règle métier violée → refus');
  const del = T.transaction('effacement RGPD', [{ type: 'delete', si: (l) => l.patient === W.faits[1].patient_k }]);
  ok(del.ok && !T.lire().some((l) => l.patient === W.faits[1].patient_k) && T.lire(0).some((l) => l.patient === W.faits[1].patient_k), 'time travel : l\'ancienne version contient encore la ligne supprimée');
  ok(T.lire(0).find((l) => l.id === W.faits[0].sejour_k).glyc === W.faits[0].glyc, 'version 0 inchangée (durabilité des versions)');
}

console.log(`${n - bad} / ${n} vérifications réussies`);
process.exit(bad ? 1 : 0);
