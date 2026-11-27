/* Interface de l'outil « Entrepôt de données de santé » (les 5 V) */
(function () {
  'use strict';
  const E = window.Entrepot, K = window.Stockage, C = window.Commun, $ = (id) => document.getElementById(id);
  const T = {
    fr: {
      back: '← Retour au portfolio', eyebrow: 'Outil web · projet personnel, d\'après mon cours de Big Data et NoSQL pour la santé (EPISEN, 2026)',
      title: 'Entrepôt de données de santé : les 5 V du Big Data',
      intro: "Un groupement de trois hôpitaux veut analyser ses séjours. Chaque site envoie ses données dans son propre format, avec ses erreurs, pendant que les moniteurs des chambres produisent un flux continu. L'outil suit tout le chemin, des messages bruts jusqu'aux indicateurs et à la fouille de données, en illustrant les 5 V : Volume, Vélocité, Variété, Véracité, Valeur.",
      warn: "Tous les patients, séjours et mesures sont fictifs et générés dans le navigateur ; rien n'est envoyé. Les formats suivent la structure de HL7 v2.5 et FHIR R4, simplifiée. Outil pédagogique, pas un entrepôt de données de santé certifié (HDS).",
      V_volume: 'Volume', V_velocite: 'Vélocité', V_variete: 'Variété', V_veracite: 'Véracité', V_valeur: 'Valeur',
      Vd_volume: 'stocker et répartir', Vd_velocite: 'traiter en continu', Vd_variete: 'formats différents', Vd_veracite: 'données fiables ?', Vd_valeur: 'en tirer des décisions',
      tab_velocite: '1 · Vélocité', tab_variete: '2 · Variété', tab_veracite: '3 · Véracité', tab_valeur: '4 · Valeur : entrepôt, OLAP', tab_volume: '5 · Volume : NoSQL, MapReduce', tab_fouille: '7 · Fouille de données',
      tab_lac: '6 · Lac, Parquet, Spark',
      typesT: 'Structuré, semi-structuré, non structuré', tExemple: 'donnée', tS: 'structuré', tM: 'semi-structuré', tN: 'non structuré',
      typesScore: 'Cliquez sur un type pour chaque donnée : {b} bonnes réponses sur {n}.', typesExpl: 'Structuré : schéma fixe en lignes et colonnes. Semi-structuré : balises ou clés qui décrivent la donnée, mais pas de schéma imposé. Non structuré : aucun champ exploitable directement.',
      metaT: 'Métadonnées : la donnée sur la donnée', mNom: 'fichier', mTaille: 'taille', mModif: 'modifié le', mFormat: 'format', mLignes: 'lignes', mZone: 'zone',
      metaNote: "On ne lit pas le contenu pour savoir quoi faire d'un fichier : son nom, sa taille, sa date et son format suffisent pour le ranger, le retrouver et décider s'il faut le retraiter.",
      lacT: "Du lac de données à l'entrepôt", zZone: 'zone', zContenu: 'contenu', zVolume: 'volume', zTaille: 'taille', zUsage: 'pour qui',
      z_brut: 'Brute (raw)', z_calcule: 'Calculée (nettoyée, standardisée)', z_metier: 'Métier (agrégats)',
      zc_brut: 'messages HL7, FHIR et CSV tels que reçus, jamais modifiés', zc_calcule: 'un séjour par ligne, unités et libellés corrigés', zc_metier: 'séjours, DMS et réhospitalisations par mois et par service',
      zu_brut: 'ingénieur de données, rejouer un traitement', zu_calcule: 'data scientist, fouille de données', zu_metier: 'analyste BI, tableaux de bord',
      fichiers: 'fichiers', lignesU: 'lignes',
      lacNote: "Lac de données : stockage massif et bon marché des données brutes, dans leur format d'origine, sans usage défini à l'avance. Entrepôt : données calculées et standardisées, optimisées pour les requêtes SQL, plus coûteuses.",
      etlT: 'ETL ou ELT', etl: "ETL : on transforme AVANT de charger. Fiable et contrôlé, mais rigide : si une règle de qualité change, les données brutes ont déjà été jetées.",
      elt: "ELT : on charge le brut dans le lac, puis on transforme à la demande. Plus souple : avec une nouvelle règle de qualité, il suffit de relancer la transformation sur le brut conservé. En contrepartie, la gouvernance du lac est plus difficile.",
      batchTxt: "Traitement par lots : ici, l'entrepôt est recalculé d'un bloc à partir de tous les messages (comme un rapport de fin de journée). Temps réel : le flux de l'onglet 1, traité mesure par mesure dès son arrivée.",
      parqT: 'CSV ou colonnes (façon Parquet)', parqNote: "Requête : durée moyenne de séjour pour un service et une année. Le CSV doit être lu en entier. Le stockage en colonnes ne lit que les 3 colonnes utiles et saute les groupes de lignes dont les statistiques min/max excluent la valeur cherchée. Partitionner par année et service ne laisse plus qu'un fichier à ouvrir.",
      pFormat: 'stockage', pTaille: 'taille totale', pLus: 'octets lus', pGroupes: 'blocs lus', pRes: 'DMS (j)',
      p_csv: 'CSV (par lignes)', p_col: 'colonnes, non trié', p_tri: 'colonnes, trié par année et service', p_part: 'colonnes, partitionné annee=/service=',
      parqInfo: '{n} séjours correspondent. Même résultat dans les 4 cas ; seule la quantité lue change.',
      encT: 'Encodage de chaque colonne', eCol: 'colonne', eEnc: 'encodage', eCard: 'valeurs distinctes', eOct: 'octets',
      e_dictionnaire: 'dictionnaire', e_bits: 'entiers sur le minimum de bits',
      scaleT: "Passer à l'échelle : vertical ou horizontal", sN: 'nœuds (4 cœurs chacun)', sP: 'partitions des données', sS: 'part séquentielle (pilote)', sD: 'déséquilibre (une partition trop grosse)', sF: 'un nœud tombe en panne pendant le calcul',
      scaleNote: "Le travail est découpé en partitions, une tâche par partition, réparties sur les cœurs. Moins de partitions que de cœurs : des cœurs restent inoccupés. Trop de partitions : le coût fixe de chaque tâche s'accumule. La partie séquentielle limite l'accélération (loi d'Amdahl). En cas de panne, les tâches du nœud perdu sont relancées ailleurs (tolérance aux pannes).",
      kDuree: 'durée', kAcc: 'accélération', kAmdahl: "maximum d'Amdahl", kEff: 'efficacité', kRel: 'tâches relancées', kCoeurs: 'cœurs',
      scaleInfo: "Scale up (une seule machine plus grosse) : {u}. Scale out ({c} cœurs en {n} machines) : environ {o} €/h. Indicatif : le prix d'une grosse machine monte plus vite que ses cœurs, et plafonne.",
      plafond: 'impossible au-delà de 128 cœurs', parH: '€/h', lgTache: 'tâche', lgSeq: 'partie séquentielle', lgPerdue: 'tâche perdue (panne)',
      lazyT: 'Évaluation paresseuse (façon Spark)', lazyNote: "Les transformations (withColumn, filter, select) ne font que construire un plan. Rien n'est calculé avant l'action (avg). L'optimiseur réécrit alors le plan : les filtres sont poussés dans la lecture et seules les colonnes utiles sont lues.",
      planT: 'Plan exécuté', lP: 'plan', lLues: 'cellules lues', lCalc: 'cellules calculées', lRes: 'résultat (semaines)', l_naif: "naïf, dans l'ordre écrit", l_opt: 'optimisé',
      acidT: 'Transactions ACID et time travel', tx_upsert: 'Corriger 3 glycémies (upsert)', tx_coupure: 'Supprimer un patient… coupure au milieu', tx_refus: 'Insérer une glycémie de 99 mmol/L', tx_rgpd: "Effacer un patient (droit à l'effacement)", tx_raz: 'Recommencer',
      ver: 'version affichée (time travel)', acidNote: "Atomicité : une transaction interrompue ne laisse aucune trace. Cohérence : une règle métier violée fait refuser toute la transaction. Isolation : chaque transaction travaille sur sa propre copie. Durabilité : une version validée reste lisible. Attention : le time travel garde la ligne effacée dans les anciennes versions ; pour respecter le droit à l'effacement, il faut aussi purger l'historique (VACUUM).",
      journalTxT: 'Journal des transactions', jV: 'version', jOp: 'opération', jRes: 'résultat', jDet: 'détail', valide: 'validée', annulee: 'annulée', lignesTouchees: '{n} lignes',
      vueT: 'Table à la version {v} ({n} lignes)', vId: 'séjour', vPat: 'patient', vSvc: 'service', vGly: 'glycémie',
      c_parquet: 'colonnes et partitions : même résultat que le CSV', c_lazy: 'plan optimisé : même résultat, moins de lectures', c_acid: 'transaction interrompue sans effet',
      tab_verif: 'Vérifications',
      fluxT: 'Moniteurs des chambres', lits: 'lits surveillés', hz: 'mesures par seconde et par lit', cap: 'capacité de traitement (mesures/s)', desat: 'part de patients qui désaturent',
      go: 'Lancer', pause: 'Pause', raz: 'Recommencer',
      fluxNote: "Chaque lit envoie sa fréquence cardiaque et sa SpO₂. Les mesures entrent dans une file d'attente ; le traitement calcule la SpO₂ moyenne sur une fenêtre glissante de 10 s par lit et déclenche une alerte sous 90 %. Si la capacité est inférieure au débit, la file grossit sans fin et les alertes arrivent trop tard : c'est la Vélocité.",
      kRecu: 'mesures reçues', kTraite: 'traitées', kFile: "file d'attente", kRetard: 'retard', kAlertes: 'alertes', kJour: 'volume par jour', kAn: 'volume par an', s: 's',
      vOk: 'La capacité suit le débit : retard sous la seconde.', vKo: 'Capacité insuffisante : il arrive {e} mesures/s pour {c} traitées. La file grossit de {d} mesures par seconde.',
      lgEntree: 'débit entrant (mesures/s)', lgSortie: 'débit traité', lgRetard: 'retard de la plus vieille mesure en attente (s)',
      alertesT: 'Alertes de désaturation', aLit: 'lit', aDebut: 'début (s)', aDet: 'détectée à (s)', aDelai: 'délai (s)', aSpo2: 'SpO₂ moyenne', aucune: 'aucune pour l\'instant',
      autre: 'Autre séjour', siteA: 'site A', siteB: 'site B', siteC: 'site C (mg/dL)',
      sejInfo: 'Le même séjour {id}, tel que chaque site l\'enverrait. En réalité, il vient du site {s}.',
      communT: 'Modèle commun après lecture', cChamp: 'champ', cVal: 'valeur', sitesT: 'Ce que chaque site envoie', sSite: 'site', sFormat: 'format', sMsgs: 'messages', sTaille: 'taille moyenne', sUnite: 'unités',
      varNote1: "Le même séjour ne pèse pas pareil selon le format : FHIR décrit chaque information avec son système de codes (LOINC pour la biologie, CIM-10 pour les diagnostics), HL7 v2 découpe en segments et champs, le CSV est compact mais ne dit rien des unités.",
      varNote2: "Le site C envoie la glycémie en mg/dL et la créatinine en mg/dL, avec des dates jj/mm/aaaa et des virgules décimales : la lecture convertit tout en mmol/L et µmol/L (1 mmol/L de glucose = 18,016 mg/dL ; 1 mg/dL de créatinine = 88,42 µmol/L).",
      errT: "Erreurs à l'envoi", e_doublon: 'message envoyé deux fois', e_libelle: 'libellé de service mal écrit', e_unite: 'site C : glycémie en mmol/L dans la colonne mg/dL', e_aberrant: 'valeur impossible (âge, glycémie)', e_dates: 'entrée et sortie inversées', e_manquant: 'sexe manquant',
      zero: 'Aucune erreur',
      indT: 'Effet sur les indicateurs', iInd: 'indicateur', iBrut: 'sans nettoyage', iPropre: 'après nettoyage', iVrai: 'vraie valeur',
      iN: 'nombre de séjours', iDms: 'durée moyenne de séjour (j)', iGly: 'glycémie moyenne des diabétiques (mmol/L)', iSvc: 'séjours sans service reconnu', iAge: 'âge moyen',
      reglesT: 'Règles de qualité', rRegle: 'règle', rInj: 'erreurs injectées', rDet: 'détectées', rFp: 'fausses alertes', rAction: 'action',
      a_doublon: 'supprimer (même identifiant de séjour)', a_libelle: 'dictionnaire de synonymes puis distance d\'édition ≤ 1', a_unite: 'glycémie < 30 mg/dL impossible → valeur déjà en mmol/L', a_aberrant: 'mettre à vide (âge hors 0–120, glycémie hors 1–50 mmol/L)', a_dates: 'remettre dans l\'ordre', a_manquant: 'signaler (sexe inconnu)',
      qualSiteT: 'Qualité par site', qSite: 'site', qRecus: 'reçus', qPb: 'avec problème', qScore: 'score', journalT: 'Journal du nettoyage',
      olapT: 'Cube OLAP', oL: 'en lignes', oC: 'en colonnes', oM: 'mesure', up: '▲ Agréger (roll-up)', down: '▼ Détailler (drill-down)', sliceT: 'Découper (slice / dice)', fS: 'service', fA: 'année', fT: "tranche d'âge", tous: 'tous', aucuneDim: '(aucune)',
      m_sejours: 'nombre de séjours', m_dms: 'durée moyenne de séjour (j)', m_rh30: 'réhospitalisation à 30 j', m_glyc: 'glycémie moyenne (mmol/L)',
      l_annee: 'Temps · année', l_trimestre: 'Temps · trimestre', l_mois: 'Temps · mois', l_pole: 'Service · pôle', l_service: 'Service · service', l_chap: 'Diagnostic · chapitre CIM-10', l_dp: 'Diagnostic · diagnostic principal', l_sexe: 'Patient · sexe', l_tranche: "Patient · tranche d'âge",
      total: 'Total', pivotInfo: '{n} séjours dans le cube après découpage.', sqlT: 'Requête SQL équivalente', etoileT: 'Schéma en étoile',
      pseudoT: 'Pseudonymisation', pseudoTxt: "Avant le chargement, l'identifiant national de santé est remplacé par un pseudonyme : {a} → {b}. L'entrepôt ne contient aucun identifiant en clair. Ici, hachage salé de démonstration ; en production : HMAC-SHA-256 avec une clé gardée hors de l'entrepôt.",
      docT: 'NoSQL : le patient est un document', sqlRowsT: 'SQL : le même patient en lignes, dans 5 tables',
      nosqlInfo: "Lire ce patient : 1 document en NoSQL, contre {r} lignes et 4 jointures en SQL. En échange, le relationnel répond mieux aux questions transversales (« tous les séjours de cardiologie en 2025 »), qui obligeraient à parcourir tous les documents.",
      mrT: 'MapReduce réparti', nN: 'nœuds (données réparties)', nR: 'réducteurs', comb: 'combiner local (pré-agrégation)',
      mrNote: "Question : combien de fois chaque diagnostic apparaît-il dans chaque service ? Les séjours sont répartis par hachage sur les nœuds. Chaque nœud émet des paires (service|diagnostic, 1) (map), les additionne localement s'il y a un combiner, puis les envoie au réducteur choisi par hachage de la clé (shuffle), qui fait la somme finale (reduce).",
      mrEtapesT: 'Étapes par nœud', mNoeud: 'nœud', mLignes: 'séjours', mEmis: 'paires émises (map)', mSortie: 'après combiner', mEnvois: 'envois vers chaque réducteur',
      mrInfo: '{e} paires échangées sur le réseau ({p} sans combiner). Résultat identique au comptage direct : {ok}.', oui: 'oui ✓', non: 'NON',
      lgShuffle: 'paires reçues par chaque réducteur', mrResT: 'Résultat (les plus fréquents)', rCle: 'service | diagnostic', rN: 'nombre',
      k: 'nombre de groupes k', kNote: "Chaque patient est décrit par 5 variables standardisées : nombre de séjours, durée moyenne, nombre de diagnostics, glycémie moyenne, réhospitalisations. k-means++ les regroupe ; le coude de l'inertie et la silhouette aident à choisir k. Le nuage est projeté sur les 2 premiers axes de l'ACP.",
      aprT: "Règles d'association (Apriori)", sup: 'support minimal', conf: 'confiance minimale',
      aprNote: "Chaque séjour est un panier de diagnostics et de traitements. Support = part des séjours qui contiennent l'ensemble ; confiance = P(alors | si) ; lift = confiance / support de « alors » (> 1 : lien plus fort que le hasard).",
      lgAcp: 'patients projetés sur les axes 1 et 2 de l\'ACP, couleur = groupe', lgInertie: 'inertie (coude)', lgSil: 'silhouette (×1 000)',
      profilsT: 'Profil moyen de chaque groupe', pG: 'groupe', pN: 'patients', pNb: 'séjours', pDms: 'DMS (j)', pDiag: 'diagnostics', pGly: 'glycémie', pRh: 'réhosp. 30 j', pAge: 'tranche la plus fréquente',
      reglesAT: 'Règles trouvées', rSi: 'si', rAlors: 'alors', rSup: 'support', rConf: 'confiance', rLift: 'lift', aprInfo: '{f} ensembles fréquents, {r} règles à une seule conclusion (les plus fortes en tête), sur {n} séjours.',
      verifT: 'Vérifications en direct', limT: 'Limites et choix',
      lim1: "Formats simplifiés : seuls les segments et ressources utiles sont produits (PID, PV1, DG1, RXE, OBX ; Patient, Encounter, Condition, MedicationRequest, Observation).",
      lim2: "Identité : on suppose un identifiant national commun aux trois sites ; dans la réalité, rapprocher les identités entre établissements (identitovigilance) est un problème à part entière.",
      lim3: "MapReduce et le flux tournent dans une seule page : la répartition, les nœuds et la file d'attente sont simulés pour montrer le principe, pas pour mesurer des performances.",
      lim4: "Moteur vérifié par 117 tests (node tests/test.js) : lecture sans perte des trois formats, détection des erreurs, cube, MapReduce = comptage direct, Apriori = comptage exhaustif, k-means, flux.",
      repo: 'Code, tests et explications sur GitHub ↗',
      c_formats: 'les 3 formats relus sans perte', c_doublon: 'doublons tous retrouvés', c_dates: 'dates inversées toutes retrouvées', c_unite: 'erreurs d\'unité retrouvées', c_cube: 'somme des cellules du cube = total', c_rollup: 'mois agrégés = année', c_mr: 'MapReduce = comptage direct', c_apr: 'supports Apriori = comptage direct', c_pseudo: 'aucun identifiant en clair dans l\'entrepôt', c_rh: 'réhospitalisations recalculées = vraies',
      Patient: 'Patient', Sejour: 'Séjour', F: 'F', M: 'M',
    },
    en: {
      back: '← Back to portfolio', eyebrow: 'Web tool · personal project, based on my Big Data and NoSQL for healthcare course (EPISEN, 2026)',
      title: 'Health data warehouse: the 5 Vs of Big Data',
      intro: 'A group of three hospitals wants to analyse its stays. Each site sends its data in its own format, with its own errors, while bedside monitors produce a continuous stream. The tool follows the whole path, from raw messages to indicators and data mining, illustrating the 5 Vs: Volume, Velocity, Variety, Veracity, Value.',
      warn: 'All patients, stays and measurements are fictitious and generated in the browser; nothing is sent. Formats follow the structure of HL7 v2.5 and FHIR R4, simplified. Educational tool, not a certified health data warehouse.',
      V_volume: 'Volume', V_velocite: 'Velocity', V_variete: 'Variety', V_veracite: 'Veracity', V_valeur: 'Value',
      Vd_volume: 'store and distribute', Vd_velocite: 'process continuously', Vd_variete: 'different formats', Vd_veracite: 'reliable data?', Vd_valeur: 'turn into decisions',
      tab_velocite: '1 · Velocity', tab_variete: '2 · Variety', tab_veracite: '3 · Veracity', tab_valeur: '4 · Value: warehouse, OLAP', tab_volume: '5 · Volume: NoSQL, MapReduce', tab_fouille: '7 · Data mining',
      tab_lac: '6 · Lake, Parquet, Spark',
      typesT: 'Structured, semi-structured, unstructured', tExemple: 'data', tS: 'structured', tM: 'semi-structured', tN: 'unstructured',
      typesScore: 'Click a type for each item: {b} correct answers out of {n}.', typesExpl: 'Structured: fixed schema in rows and columns. Semi-structured: tags or keys describe the data, but no imposed schema. Unstructured: no directly usable field.',
      metaT: 'Metadata: data about the data', mNom: 'file', mTaille: 'size', mModif: 'modified', mFormat: 'format', mLignes: 'lines', mZone: 'zone',
      metaNote: 'You do not read the content to know what to do with a file: its name, size, date and format are enough to store it, find it and decide whether it must be reprocessed.',
      lacT: 'From data lake to warehouse', zZone: 'zone', zContenu: 'content', zVolume: 'volume', zTaille: 'size', zUsage: 'for whom',
      z_brut: 'Raw', z_calcule: 'Calculated (cleaned, standardised)', z_metier: 'Business (aggregates)',
      zc_brut: 'HL7, FHIR and CSV messages as received, never modified', zc_calcule: 'one stay per row, units and ward names fixed', zc_metier: 'stays, LOS and readmissions per month and ward',
      zu_brut: 'data engineer, replay a pipeline', zu_calcule: 'data scientist, data mining', zu_metier: 'BI analyst, dashboards',
      fichiers: 'files', lignesU: 'rows',
      lacNote: 'Data lake: massive, cheap storage of raw data in its native format, with no predefined use. Warehouse: calculated, standardised data, optimised for SQL queries, more expensive.',
      etlT: 'ETL or ELT', etl: 'ETL: transform BEFORE loading. Reliable and controlled, but rigid: if a quality rule changes, the raw data is already gone.',
      elt: 'ELT: load the raw data into the lake, then transform on demand. More flexible: with a new quality rule, just rerun the transformation on the kept raw data. In return, governing the lake is harder.',
      batchTxt: 'Batch processing: here the warehouse is rebuilt in one go from all the messages (like an end-of-day report). Real time: the stream of tab 1, processed measurement by measurement as it arrives.',
      parqT: 'CSV or columns (Parquet-like)', parqNote: 'Query: average length of stay for one ward and one year. The CSV must be read entirely. Columnar storage reads only the 3 useful columns and skips row groups whose min/max statistics exclude the value. Partitioning by year and ward leaves a single file to open.',
      pFormat: 'storage', pTaille: 'total size', pLus: 'bytes read', pGroupes: 'blocks read', pRes: 'LOS (d)',
      p_csv: 'CSV (row-based)', p_col: 'columns, unsorted', p_tri: 'columns, sorted by year and ward', p_part: 'columns, partitioned annee=/service=',
      parqInfo: '{n} stays match. Same result in all 4 cases; only the amount read changes.',
      encT: 'Encoding of each column', eCol: 'column', eEnc: 'encoding', eCard: 'distinct values', eOct: 'bytes',
      e_dictionnaire: 'dictionary', e_bits: 'integers on the minimum bits',
      scaleT: 'Scaling: up or out', sN: 'nodes (4 cores each)', sP: 'data partitions', sS: 'sequential share (driver)', sD: 'skew (one oversized partition)', sF: 'a node fails during the job',
      scaleNote: "The work is split into partitions, one task per partition, spread over the cores. Fewer partitions than cores: some cores stay idle. Too many partitions: the fixed cost of each task adds up. The sequential part limits the speed-up (Amdahl's law). On failure, the lost node's tasks are rerun elsewhere (fault tolerance).",
      kDuree: 'duration', kAcc: 'speed-up', kAmdahl: 'Amdahl maximum', kEff: 'efficiency', kRel: 'tasks rerun', kCoeurs: 'cores',
      scaleInfo: "Scale up (one bigger machine): {u}. Scale out ({c} cores on {n} machines): about €{o}/h. Indicative: a big machine's price rises faster than its cores, and caps out.",
      plafond: 'impossible beyond 128 cores', parH: '€/h', lgTache: 'task', lgSeq: 'sequential part', lgPerdue: 'lost task (failure)',
      lazyT: 'Lazy evaluation (Spark-like)', lazyNote: 'Transformations (withColumn, filter, select) only build a plan. Nothing is computed before the action (avg). The optimiser then rewrites the plan: filters are pushed into the scan and only useful columns are read.',
      planT: 'Executed plan', lP: 'plan', lLues: 'cells read', lCalc: 'cells computed', lRes: 'result (weeks)', l_naif: 'naive, as written', l_opt: 'optimised',
      acidT: 'ACID transactions and time travel', tx_upsert: 'Fix 3 glucose values (upsert)', tx_coupure: 'Delete a patient… power cut halfway', tx_refus: 'Insert a glucose of 99 mmol/L', tx_rgpd: 'Erase a patient (right to erasure)', tx_raz: 'Restart',
      ver: 'displayed version (time travel)', acidNote: 'Atomicity: an interrupted transaction leaves no trace. Consistency: a violated business rule rejects the whole transaction. Isolation: each transaction works on its own copy. Durability: a committed version stays readable. Beware: time travel keeps the erased row in old versions; to honour the right to erasure, history must be purged too (VACUUM).',
      journalTxT: 'Transaction log', jV: 'version', jOp: 'operation', jRes: 'result', jDet: 'detail', valide: 'committed', annulee: 'rolled back', lignesTouchees: '{n} rows',
      vueT: 'Table at version {v} ({n} rows)', vId: 'stay', vPat: 'patient', vSvc: 'ward', vGly: 'glucose',
      c_parquet: 'columns and partitions: same result as CSV', c_lazy: 'optimised plan: same result, fewer reads', c_acid: 'interrupted transaction has no effect',
      tab_verif: 'Checks',
      fluxT: 'Bedside monitors', lits: 'monitored beds', hz: 'measurements per second per bed', cap: 'processing capacity (measurements/s)', desat: 'share of patients desaturating',
      go: 'Start', pause: 'Pause', raz: 'Restart',
      fluxNote: 'Each bed sends its heart rate and SpO₂. Measurements enter a queue; processing computes the mean SpO₂ over a 10 s sliding window per bed and raises an alert below 90%. If capacity is below the input rate, the queue grows forever and alerts come too late: that is Velocity.',
      kRecu: 'measurements received', kTraite: 'processed', kFile: 'queue', kRetard: 'lag', kAlertes: 'alerts', kJour: 'volume per day', kAn: 'volume per year', s: 's',
      vOk: 'Capacity keeps up with the input: lag under one second.', vKo: 'Not enough capacity: {e} measurements/s arrive, {c} are processed. The queue grows by {d} measurements per second.',
      lgEntree: 'input rate (measurements/s)', lgSortie: 'processed rate', lgRetard: 'age of the oldest waiting measurement (s)',
      alertesT: 'Desaturation alerts', aLit: 'bed', aDebut: 'start (s)', aDet: 'detected at (s)', aDelai: 'delay (s)', aSpo2: 'mean SpO₂', aucune: 'none yet',
      autre: 'Another stay', siteA: 'site A', siteB: 'site B', siteC: 'site C (mg/dL)',
      sejInfo: 'The same stay {id}, as each site would send it. In reality it comes from site {s}.',
      communT: 'Common model after parsing', cChamp: 'field', cVal: 'value', sitesT: 'What each site sends', sSite: 'site', sFormat: 'format', sMsgs: 'messages', sTaille: 'mean size', sUnite: 'units',
      varNote1: 'The same stay does not weigh the same in each format: FHIR describes every item with its code system (LOINC for lab results, ICD-10 for diagnoses), HL7 v2 splits into segments and fields, CSV is compact but says nothing about units.',
      varNote2: 'Site C sends glucose and creatinine in mg/dL, with dd/mm/yyyy dates and decimal commas: parsing converts everything to mmol/L and µmol/L (1 mmol/L glucose = 18.016 mg/dL; 1 mg/dL creatinine = 88.42 µmol/L).',
      errT: 'Errors when sending', e_doublon: 'message sent twice', e_libelle: 'misspelt ward name', e_unite: 'site C: glucose in mmol/L in the mg/dL column', e_aberrant: 'impossible value (age, glucose)', e_dates: 'admission and discharge swapped', e_manquant: 'missing sex',
      zero: 'No errors',
      indT: 'Effect on indicators', iInd: 'indicator', iBrut: 'without cleaning', iPropre: 'after cleaning', iVrai: 'true value',
      iN: 'number of stays', iDms: 'average length of stay (d)', iGly: 'mean glucose of diabetics (mmol/L)', iSvc: 'stays with no recognised ward', iAge: 'mean age',
      reglesT: 'Quality rules', rRegle: 'rule', rInj: 'injected errors', rDet: 'detected', rFp: 'false alarms', rAction: 'action',
      a_doublon: 'drop (same stay identifier)', a_libelle: 'synonym dictionary then edit distance ≤ 1', a_unite: 'glucose < 30 mg/dL impossible → value already in mmol/L', a_aberrant: 'set to empty (age outside 0–120, glucose outside 1–50 mmol/L)', a_dates: 'put back in order', a_manquant: 'flag (unknown sex)',
      qualSiteT: 'Quality per site', qSite: 'site', qRecus: 'received', qPb: 'with a problem', qScore: 'score', journalT: 'Cleaning log',
      olapT: 'OLAP cube', oL: 'rows', oC: 'columns', oM: 'measure', up: '▲ Roll up', down: '▼ Drill down', sliceT: 'Slice / dice', fS: 'ward', fA: 'year', fT: 'age band', tous: 'all', aucuneDim: '(none)',
      m_sejours: 'number of stays', m_dms: 'average length of stay (d)', m_rh30: '30-day readmission', m_glyc: 'mean glucose (mmol/L)',
      l_annee: 'Time · year', l_trimestre: 'Time · quarter', l_mois: 'Time · month', l_pole: 'Ward · division', l_service: 'Ward · ward', l_chap: 'Diagnosis · ICD-10 chapter', l_dp: 'Diagnosis · main diagnosis', l_sexe: 'Patient · sex', l_tranche: 'Patient · age band',
      total: 'Total', pivotInfo: '{n} stays in the cube after slicing.', sqlT: 'Equivalent SQL query', etoileT: 'Star schema',
      pseudoT: 'Pseudonymisation', pseudoTxt: 'Before loading, the national health identifier is replaced by a pseudonym: {a} → {b}. The warehouse contains no clear identifier. Here a salted demonstration hash; in production: HMAC-SHA-256 with a key kept outside the warehouse.',
      docT: 'NoSQL: the patient is one document', sqlRowsT: 'SQL: the same patient as rows in 5 tables',
      nosqlInfo: 'Reading this patient: 1 document in NoSQL, versus {r} rows and 4 joins in SQL. In return, the relational model answers cross-cutting questions better ("all cardiology stays in 2025"), which would require scanning every document.',
      mrT: 'Distributed MapReduce', nN: 'nodes (distributed data)', nR: 'reducers', comb: 'local combiner (pre-aggregation)',
      mrNote: 'Question: how many times does each diagnosis appear in each ward? Stays are spread across nodes by hashing. Each node emits pairs (ward|diagnosis, 1) (map), adds them up locally if there is a combiner, then sends them to the reducer chosen by hashing the key (shuffle), which computes the final sum (reduce).',
      mrEtapesT: 'Steps per node', mNoeud: 'node', mLignes: 'stays', mEmis: 'pairs emitted (map)', mSortie: 'after combiner', mEnvois: 'sent to each reducer',
      mrInfo: '{e} pairs exchanged over the network ({p} without combiner). Same result as direct counting: {ok}.', oui: 'yes ✓', non: 'NO',
      lgShuffle: 'pairs received by each reducer', mrResT: 'Result (most frequent)', rCle: 'ward | diagnosis', rN: 'count',
      k: 'number of clusters k', kNote: 'Each patient is described by 5 standardised variables: number of stays, mean length of stay, number of diagnoses, mean glucose, readmissions. k-means++ groups them; the inertia elbow and the silhouette help choose k. The cloud is projected on the first 2 PCA axes.',
      aprT: 'Association rules (Apriori)', sup: 'minimum support', conf: 'minimum confidence',
      aprNote: 'Each stay is a basket of diagnoses and treatments. Support = share of stays containing the itemset; confidence = P(then | if); lift = confidence / support of "then" (> 1: stronger than chance).',
      lgAcp: 'patients projected on PCA axes 1 and 2, colour = cluster', lgInertie: 'inertia (elbow)', lgSil: 'silhouette (×1,000)',
      profilsT: 'Mean profile of each cluster', pG: 'cluster', pN: 'patients', pNb: 'stays', pDms: 'LOS (d)', pDiag: 'diagnoses', pGly: 'glucose', pRh: '30-d readm.', pAge: 'most frequent age band',
      reglesAT: 'Rules found', rSi: 'if', rAlors: 'then', rSup: 'support', rConf: 'confidence', rLift: 'lift', aprInfo: '{f} frequent itemsets, {r} single-consequent rules (strongest first), over {n} stays.',
      verifT: 'Live checks', limT: 'Limits and choices',
      lim1: 'Simplified formats: only the useful segments and resources are produced (PID, PV1, DG1, RXE, OBX; Patient, Encounter, Condition, MedicationRequest, Observation).',
      lim2: 'Identity: a national identifier shared by the three sites is assumed; in reality, matching identities across hospitals is a problem of its own.',
      lim3: 'MapReduce and the stream run in a single page: distribution, nodes and queue are simulated to show the principle, not to measure performance.',
      lim4: 'Engine checked by 117 tests (node tests/test.js): lossless parsing of the three formats, error detection, cube, MapReduce = direct count, Apriori = exhaustive count, k-means, stream.',
      repo: 'Code, tests and explanations on GitHub ↗',
      c_formats: 'the 3 formats parsed without loss', c_doublon: 'all duplicates found', c_dates: 'all swapped dates found', c_unite: 'unit errors found', c_cube: 'sum of cube cells = total', c_rollup: 'months rolled up = year', c_mr: 'MapReduce = direct count', c_apr: 'Apriori supports = direct count', c_pseudo: 'no clear identifier in the warehouse', c_rh: 'recomputed readmissions = true ones',
      Patient: 'Patient', Sejour: 'Stay', F: 'F', M: 'M',
    },
  };
  const L = C.Langue(T, () => { statique(); tout(); });
  const t = (k) => L.t(k), nf = (x, d) => C.nf(x, d, L.lang), lng = () => L.lang;
  const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
  const octets = (b) => (b >= 1e12 ? nf(b / 1e12, 1) + ' To' : b >= 1e9 ? nf(b / 1e9, 1) + ' Go' : b >= 1e6 ? nf(b / 1e6, 1) + ' Mo' : b >= 1e3 ? nf(b / 1e3, 1) + ' ko' : nf(b, 0) + ' o').replace(/ (To|Go|Mo|ko|o)$/, (m, u) => ' ' + (lng() === 'en' ? { To: 'TB', Go: 'GB', Mo: 'MB', ko: 'kB', o: 'B' }[u] : u));
  const kpi = (k, v, u, cls) => `<div class="kpi ${cls || ''}"><dt>${t(k)}</dt><dd>${v}${u ? `<small>${u}</small>` : ''}</dd></div>`;
  const nomDiag = (c) => (E.DIAG[c] ? `${c} ${E.DIAG[c][lng()]}` : c);
  const nomItem = (i) => (i.startsWith('m:') ? '💊 ' + E.MEDS[i.slice(2)] : nomDiag(i));
  const nomSvc = (c) => (E.SERVICES[c] ? E.SERVICES[c][lng()] : c);
  const COUL = ['#c8102e', '#c9c9cc', '#e0a458', '#8fd18f', '#8ab4ff', '#d08ad8', '#6fd0c6', '#f0e070'];

  /* ---------- données : génération → émission → nettoyage → entrepôt ---------- */
  const TAUX0 = { doublon: 0.03, libelle: 0.08, unite: 0.3, aberrant: 0.02, dates: 0.02, manquant: 0.03 };
  const D = { G: null, em: null, net: null, W: null };
  function pipeline() {
    if (!D.G) D.G = E.generer({ patients: 1500, graine: 2026 });
    const taux = {};
    Object.keys(TAUX0).forEach((k) => (taux[k] = +$('tx_' + k).value));
    D.em = E.emettre(D.G.sejours, taux, 7);
    D.net = E.nettoyer(D.em.msgs);
    D.W = E.construireEntrepot(D.net.propres);
    D.brut = E.brut(D.em.msgs);
  }

  /* ---------- en-tête : 5 V et onglets ---------- */
  const PAGES = ['velocite', 'variete', 'veracite', 'valeur', 'volume', 'lac', 'fouille', 'verif'];
  const V_PAGE = { volume: 'volume', velocite: 'velocite', variete: 'variete', veracite: 'veracite', valeur: 'valeur' };
  let page = 'velocite';
  function statique() {
    $('vs').innerHTML = Object.keys(V_PAGE).map((v) => `<button type="button" class="v" data-v="${v}" aria-pressed="${V_PAGE[v] === page}"><b>${t('V_' + v)}</b><span>${t('Vd_' + v)}</span></button>`).join('');
    $('tabs').innerHTML = PAGES.map((p) => `<button type="button" class="tab" role="tab" data-p="${p}" aria-selected="${p === page}">${t('tab_' + p)}</button>`).join('');
    document.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => aller(V_PAGE[b.dataset.v])));
    document.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.p)));
    $('taux').innerHTML = Object.keys(TAUX0).map((k) => `<div class="ctl"><label for="tx_${k}">${t('e_' + k)}</label><output id="otx_${k}"></output><input type="range" id="tx_${k}" min="0" max="${k === 'unite' ? 1 : 0.2}" step="0.01" value="${valTaux[k]}"></div>`).join('');
    Object.keys(TAUX0).forEach((k) => $('tx_' + k).addEventListener('input', () => { valTaux[k] = +$('tx_' + k).value; pipeline(); tout(); }));
    const niveaux = Object.entries(E.DIMS).flatMap(([, l]) => l);
    $('oL').innerHTML = niveaux.map((n) => `<option value="${n}">${t('l_' + n)}</option>`).join('');
    $('oC').innerHTML = `<option value="">${t('aucuneDim')}</option>` + niveaux.map((n) => `<option value="${n}">${t('l_' + n)}</option>`).join('');
    $('oM').innerHTML = Object.keys(E.MESURES).map((m) => `<option value="${m}">${t('m_' + m)}</option>`).join('');
    $('fS').innerHTML = `<option value="">${t('tous')}</option>` + Object.keys(E.SERVICES).map((c) => `<option value="${c}">${nomSvc(c)}</option>`).join('');
    $('fA').innerHTML = `<option value="">${t('tous')}</option><option>2025</option><option>2026</option>`;
    $('fT').innerHTML = `<option value="">${t('tous')}</option>` + E.TRANCHES.filter((x) => x !== '?').map((x) => `<option>${x}</option>`).join('');
    Object.entries(olap).forEach(([k, v]) => { if ($(k)) $(k).value = v; });
    $('go').textContent = enMarche ? t('pause') : t('go');
  }
  const valTaux = { ...TAUX0 };
  const olap = { oL: 'service', oC: 'annee', oM: 'dms', fS: '', fA: '', fT: '' };
  function aller(p) {
    page = p;
    document.querySelectorAll('.page').forEach((s) => s.classList.toggle('on', s.id === 'p-' + p));
    document.querySelectorAll('[data-p]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.p === p)));
    document.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(V_PAGE[b.dataset.v] === p)));
    try { history.replaceState(null, '', '#' + p); } catch (e) {}
    tout();
  }

  /* ---------- 1. Vélocité ---------- */
  let F = null, enMarche = false, dernierT = 0;
  function nouveauF() { F = E.nouveauFlux({ lits: +$('lits').value, hz: +$('hz').value, signaux: 2, octets: 60, capacite: +$('cap').value, desat: +$('desat').value, graine: 5 }); }
  function boucle(ts) {
    if (!enMarche) return;
    const dt = Math.min(0.25, (ts - (dernierT || ts)) / 1000) * 4 || 0.1;      // temps simulé ×4
    dernierT = ts;
    const pas = Math.ceil(dt / 0.1);
    for (let i = 0; i < pas; i++) E.pasFlux(F, dt / pas);
    if (page === 'velocite') dessinerFlux();
    requestAnimationFrame(boucle);
  }
  function dessinerFlux() {
    ['lits', 'hz', 'cap'].forEach((k) => ($('o' + k).textContent = nf(+$(k).value, 0)));
    $('odesat').textContent = nf(100 * +$('desat').value, 1) + ' %';
    if (!F) nouveauF();
    const vol = E.volume({ lits: F.lits, hz: F.hz, signaux: 2, octets: 60 });
    $('kFlux').innerHTML = kpi('kRecu', nf(F.recus, 0)) + kpi('kTraite', nf(F.traites, 0)) + kpi('kFile', nf(F.file.length * 2, 0), '', F.retard > 2 ? 'bad' : 'good')
      + kpi('kRetard', nf(F.retard, 1), t('s'), F.retard > 2 ? 'bad' : 'good') + kpi('kAlertes', F.alertes.length) + kpi('kJour', octets(vol.parJour)) + kpi('kAn', octets(vol.parAn));
    const entree = F.lits * F.hz * 2, cap = F.capacite;
    $('vFlux').textContent = cap >= entree ? t('vOk') : fmt(t('vKo'), { e: nf(entree, 0), c: nf(cap, 0), d: nf(entree - cap, 0) });
    const h = F.histo, lissage = (v, i, k) => { let s = 0, c = 0; for (let j = Math.max(0, i - k); j <= i; j++) { s += v[j]; c++; } return s / c; };
    if (h.length > 1) {
      const xs = h.map((p) => p.t), e = h.map((p) => p.entree), s = h.map((p) => p.sortie);
      const es = e.map((_, i) => lissage(e, i, 10)), ss = s.map((_, i) => lissage(s, i, 10));
      const ymax = Math.max(entree, cap * 1.0, ...es, ...ss) * 1.15;
      C.graphique($('cvDebit'), { xmin: xs[0], xmax: Math.max(xs[xs.length - 1], xs[0] + 1), ymin: 0, ymax, xlabel: 's', series: [{ x: xs, y: es, color: '#c9c9cc', width: 1.6 }, { x: xs, y: ss, color: '#c8102e', width: 2 }], hlignes: [{ y: cap, color: '#6c6c70', dash: [5, 4] }] });
      const r = h.map((p) => p.retard);
      C.graphique($('cvRetard'), { xmin: xs[0], xmax: Math.max(xs[xs.length - 1], xs[0] + 1), ymin: 0, ymax: Math.max(1, ...r) * 1.15, xlabel: 's', series: [{ x: xs, y: r, color: '#e0a458', width: 2 }], hlignes: [{ y: 10, color: '#6c6c70', dash: [5, 4] }] });
    } else { C.graphique($('cvDebit'), { xmin: 0, xmax: 10, ymin: 0, ymax: 1, series: [] }); C.graphique($('cvRetard'), { xmin: 0, xmax: 10, ymin: 0, ymax: 1, series: [] }); }
    const a = F.alertes.slice(-12).reverse();
    $('tAlertes').innerHTML = `<tr><th>${t('aLit')}</th><th class="n">${t('aDebut')}</th><th class="n">${t('aDet')}</th><th class="n">${t('aDelai')}</th><th class="n">${t('aSpo2')}</th></tr>`
      + (a.length ? a.map((x) => { const d = x.detectee - F.patients[x.lit].debut; return `<tr><td>${x.lit + 1}</td><td class="n">${nf(F.patients[x.lit].debut, 1)}</td><td class="n">${nf(x.detectee, 1)}</td><td class="n ${d > 15 ? 'bad' : 'good'}">${nf(d, 1)}</td><td class="n">${nf(x.spo2, 1)} %</td></tr>`; }).join('') : `<tr><td colspan="5">${t('aucune')}</td></tr>`);
  }

  /* ---------- 2. Variété ---------- */
  let idxSej = 0;
  function variete() {
    const S = D.G.sejours, s = S[idxSej % S.length];
    const lib = E.SERVICES[s.service].fr;
    $('sejInfo').textContent = fmt(t('sejInfo'), { id: s.id, s: s.site });
    $('cHL7').textContent = E.versHL7(s, lib).replace(/\r/g, '\n');
    $('cFHIR').textContent = JSON.stringify(JSON.parse(E.versFHIR(s, lib)), null, 2);
    $('cCSV').textContent = E.ENTETE_CSV.replace(/;/g, ';\n') + '\n\n' + E.versCSV(s, lib, s.glyc * E.GLU_MGDL, s.crea / E.CREA_UMOL);
    const r = E.lireCSVLigne(E.versCSV(s, lib, s.glyc * E.GLU_MGDL, s.crea / E.CREA_UMOL));
    const lignes = [['INS', s.ins], [t('fT'), `${2026 - s.naissance} (${s.naissance})`], ['sexe / sex', s.sexe], [t('fS'), `${nomSvc(s.service)} (${s.service})`],
      ['entrée / admission', s.entree], ['sortie / discharge', s.sortie], ['CIM-10 / ICD-10', s.diags.map(nomDiag).join(', ')], ['traitements / drugs', s.meds.map((m) => E.MEDS[m]).join(', ')],
      ['glycémie / glucose', `${nf(r.glyc / E.GLU_MGDL, 1)} mmol/L (CSV : ${nf(r.glyc, 1)} mg/dL)`], ['créatinine / creatinine', `${nf(r.crea * E.CREA_UMOL, 0)} µmol/L (CSV : ${nf(r.crea, 2)} mg/dL)`]];
    $('tCommun').innerHTML = `<tr><th>${t('cChamp')}</th><th>${t('cVal')}</th></tr>` + lignes.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
    const parSite = { A: [], B: [], C: [] };
    D.em.msgs.forEach((m) => parSite[m.site].push(m.texte.length));
    const u = { A: 'mmol/L · µmol/L', B: 'mmol/L · µmol/L', C: 'mg/dL · mg/dL' }, f = { A: 'HL7 v2.5', B: 'FHIR R4 (JSON)', C: 'CSV ;' };
    $('tSites').innerHTML = `<tr><th>${t('sSite')}</th><th>${t('sFormat')}</th><th class="n">${t('sMsgs')}</th><th class="n">${t('sTaille')}</th><th>${t('sUnite')}</th></tr>`
      + ['A', 'B', 'C'].map((k) => `<tr><td>${k}</td><td>${f[k]}</td><td class="n">${parSite[k].length}</td><td class="n">${octets(parSite[k].reduce((a, b) => a + b, 0) / parSite[k].length)}</td><td>${u[k]}</td></tr>`).join('');
  }

  /* ---------- 3. Véracité ---------- */
  function veracite() {
    Object.keys(TAUX0).forEach((k) => ($('otx_' + k).textContent = nf(100 * +$('tx_' + k).value, 0) + ' %'));
    const S = D.G.sejours, P = D.net.propres, B = D.brut;
    const moy = (l, f) => { const v = l.map(f).filter((x) => x != null && Number.isFinite(x)); return v.reduce((a, b) => a + b, 0) / v.length; };
    const gly = (l) => moy(l.filter((s) => s.diags.includes('E11')), (s) => s.glyc);
    const ind = [
      ['iN', B.length, P.length, S.length, 0],
      ['iDms', moy(B, (s) => s.dms), moy(P, (s) => s.dms), moy(S, (s) => s.dms), 2],
      ['iGly', gly(B), gly(P), gly(S), 2],
      ['iAge', moy(B, (s) => s.age), moy(P, (s) => s.age), moy(S, (s) => s.age), 1],
      ['iSvc', B.filter((s) => !s.service).length, P.filter((s) => !s.service).length, 0, 0],
    ];
    const cls = (v, vrai, d) => (Math.abs(v - vrai) <= Math.max(0.02 * Math.abs(vrai), d ? 0.05 : 0.5) ? 'good' : 'bad');
    $('tInd').innerHTML = `<tr><th>${t('iInd')}</th><th class="n">${t('iBrut')}</th><th class="n">${t('iPropre')}</th><th class="n">${t('iVrai')}</th></tr>`
      + ind.map(([k, b, p, v, d]) => `<tr><td>${t(k)}</td><td class="n ${cls(b, v, d)}">${nf(b, d)}</td><td class="n ${cls(p, v, d)}">${nf(p, d)}</td><td class="n">${nf(v, d)}</td></tr>`).join('');
    const det = E.evaluerDetection(D.em.verite, D.net);
    $('tRegles').innerHTML = `<tr><th>${t('rRegle')}</th><th class="n">${t('rInj')}</th><th class="n">${t('rDet')}</th><th class="n">${t('rFp')}</th><th>${t('rAction')}</th></tr>`
      + Object.keys(TAUX0).map((k) => `<tr><td>${t('e_' + k)}</td><td class="n">${det[k].injectees}</td><td class="n ${det[k].rappel >= 0.97 ? 'good' : 'mid'}">${det[k].detectees}</td><td class="n ${det[k].fauxPositifs ? 'mid' : ''}">${det[k].fauxPositifs}</td><td>${t('a_' + k)}</td></tr>`).join('');
    $('tQual').innerHTML = `<tr><th>${t('qSite')}</th><th class="n">${t('qRecus')}</th><th class="n">${t('qPb')}</th><th class="n">${t('qScore')}</th></tr>`
      + ['A', 'B', 'C'].map((k) => { const q = D.net.parSite[k], sc = 100 * (1 - q.problemes / Math.max(1, q.recus)); return `<tr><td>${k}</td><td class="n">${q.recus}</td><td class="n">${q.problemes}</td><td class="n ${sc > 95 ? 'good' : sc > 85 ? 'mid' : 'bad'}">${nf(sc, 1)} %</td></tr>`; }).join('');
    const parId = new Map(D.brut.map((s) => [s.id, s]));
    $('journal').innerHTML = D.net.journal.slice(0, 40).map((j) => { const b = parId.get(j.id); const detail = j.regle === 'libelle' ? `« ${b.serviceBrut} »` : j.regle === 'unite' ? `${b.glyc} mg/dL ?` : j.regle === 'aberrant' ? `${t('fT')} ${b.age}, glyc ${b.glyc}` : j.regle === 'dates' ? `${b.entree} > ${b.sortie}` : ''; return `<span class="d">${j.id}</span> <span class="t">${j.regle}</span> ${detail}`; }).join('\n') || '—';
  }

  /* ---------- 4. Valeur : OLAP ---------- */
  function valeur() {
    Object.keys(olap).forEach((k) => (olap[k] = $(k).value));
    const filtres = {};
    if (olap.fS) filtres.service = olap.fS; if (olap.fA) filtres.annee = olap.fA; if (olap.fT) filtres.tranche = olap.fT;
    const lignes = olap.oL, colonnes = olap.oC && olap.oC !== olap.oL ? olap.oC : '';
    const c = E.cube(D.W.faits, { lignes, colonnes, mesure: olap.oM, filtres });
    const dec = olap.oM === 'sejours' ? 0 : olap.oM === 'rh30' ? 1 : 2;
    const val = (v) => (v == null || !Number.isFinite(v) ? '—' : olap.oM === 'rh30' ? nf(100 * v, 1) + ' %' : nf(v, dec));
    const lab = (attr, v) => (attr === 'service' ? nomSvc(v) : attr === 'pole' ? (E.POLES[v] ? E.POLES[v][lng()] : v) : attr === 'dp' ? nomDiag(v) : attr === 'chap' ? (E.CHAP[v] ? E.CHAP[v][lng()] : v) : v);
    const tout = c.valeurs.flat().filter((v) => v != null && Number.isFinite(v)), mn = Math.min(...tout), mx = Math.max(...tout);
    const fond = (v) => (v == null || mx === mn ? '' : `background: rgba(200,16,46,${(0.08 + 0.42 * (v - mn) / (mx - mn)).toFixed(2)})`);
    $('tPivot').innerHTML = `<tr><th class="h">${t('l_' + lignes)}${colonnes ? ' \\ ' + t('l_' + colonnes) : ''}</th>${c.colonnes.map((x) => `<th class="n">${colonnes ? lab(colonnes, x) : t('m_' + olap.oM)}</th>`).join('')}${colonnes ? `<th class="n">${t('total')}</th>` : ''}</tr>`
      + c.lignes.map((l, i) => `<tr><td class="h">${lab(lignes, l)}</td>${c.valeurs[i].map((v) => `<td style="${fond(v)}">${val(v)}</td>`).join('')}${colonnes ? `<td class="tot">${val(c.totLignes[i])}</td>` : ''}</tr>`).join('')
      + `<tr class="tot"><td class="h">${t('total')}</td>${c.totColonnes.map((v) => `<td>${val(v)}</td>`).join('')}${colonnes ? `<td>${val(c.total)}</td>` : ''}</tr>`;
    $('pivotInfo').textContent = fmt(t('pivotInfo'), { n: nf(c.n, 0) });
    $('cSQL').textContent = E.sql({ lignes, colonnes, mesure: olap.oM, filtres });
    const ex = D.G.sejours[0].ins;
    $('pseudo').textContent = fmt(t('pseudoTxt'), { a: ex, b: E.pseudonyme(ex, 4242) });
    etoile();
  }
  function etoile() {
    const boite = (x, y, w, titre, champs, fait) => `<rect x="${x}" y="${y}" width="${w}" height="${18 + champs.length * 14}" rx="4" fill="${fait ? '#2a0d12' : '#161618'}" stroke="${fait ? '#c8102e' : '#3a3a3d'}"/>`
      + `<text x="${x + 8}" y="${y + 13}" fill="${fait ? '#ff8a8a' : '#f2f2f2'}" font-size="11" font-weight="600">${titre}</text>`
      + champs.map((c, i) => `<text x="${x + 8}" y="${y + 29 + i * 14}" fill="#9b9b9f" font-size="9.5">${c}</text>`).join('');
    const lien = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#6c6c70" stroke-dasharray="3 3"/>`;
    $('etoile').innerHTML = lien(260, 165, 95, 55) + lien(260, 165, 425, 55) + lien(260, 165, 95, 275) + lien(260, 165, 425, 275) + lien(260, 165, 260, 300)
      + boite(180, 110, 160, 'fait_sejour', ['sejour_k', 'patient_k (pseudonyme)', 'date_entree_k', 'service_k · dp_k', 'duree_jours', 'rehospit_30j', 'glycemie_mmol'], true)
      + boite(10, 15, 165, 'dim_temps', ['date_k', 'annee > trimestre > mois']) + boite(345, 15, 165, 'dim_service', ['service_k', 'pole > service'])
      + boite(10, 240, 165, 'dim_patient', ['patient_k', 'sexe · tranche_age']) + boite(345, 240, 165, 'dim_diagnostic', ['diag_k', 'chapitre > code_cim10'])
      + boite(185, 290, 150, 'pont_sejour_diag', ['sejour_k · diag_k']);
  }

  /* ---------- 5. Volume : NoSQL et MapReduce ---------- */
  function volume() {
    ['nN', 'nR'].forEach((k) => ($('o' + k).textContent = $(k).value));
    const P = D.net.propres, cpt = {};
    P.forEach((s) => (cpt[s.ins] = (cpt[s.ins] || 0) + 1));
    const ins = Object.entries(cpt).sort((a, b) => b[1] - a[1])[0][0];
    const doc = E.document(P, ins), rows = E.lignesSQL(doc);
    $('cDoc').textContent = JSON.stringify(doc, null, 2);
    const tab = (nom, l) => `-- ${nom} (${l.length})\n` + (l.length ? Object.keys(l[0]).join(' | ') + '\n' + l.map((r) => Object.values(r).join(' | ')).join('\n') : '');
    $('cRows').textContent = Object.entries(rows).map(([k, l]) => tab(k, l)).join('\n\n');
    $('nosqlInfo').textContent = fmt(t('nosqlInfo'), { r: Object.values(rows).reduce((a, l) => a + l.length, 0) });
    const opt = { noeuds: +$('nN').value, reducteurs: +$('nR').value, combiner: $('comb').checked };
    const r = E.mapReduce(P, opt), sans = E.mapReduce(P, { ...opt, combiner: false }), direct = E.compteDirect(P);
    const egal = r.resultat.size === direct.size && [...direct].every(([k, v]) => r.resultat.get(k) === v);
    $('tMR').innerHTML = `<tr><th>${t('mNoeud')}</th><th class="n">${t('mLignes')}</th><th class="n">${t('mEmis')}</th><th class="n">${t('mSortie')}</th><th>${t('mEnvois')}</th></tr>`
      + r.etapes.map((e, i) => `<tr><td>${i + 1}</td><td class="n">${e.lignes}</td><td class="n">${e.emis}</td><td class="n">${opt.combiner ? e.sortie : '—'}</td><td>${e.envois.join(' · ')}</td></tr>`).join('');
    $('mrInfo').innerHTML = fmt(t('mrInfo'), { e: nf(r.echanges, 0), p: nf(sans.echanges, 0), ok: `<span class="${egal ? 'ok' : 'ko'}">${egal ? t('oui') : t('non')}</span>` });
    const recu = r.reducteurs.map((_, j) => r.etapes.reduce((a, e) => a + e.envois[j], 0));
    const cv = $('cvMR'), { ctx, w, h } = C.preparer(cv), mx = Math.max(...recu, 1), bw = (w - 60) / recu.length;
    ctx.font = '11px "JetBrains Mono", monospace';
    recu.forEach((v, j) => { const bh = (h - 50) * v / mx; ctx.fillStyle = '#c8102e'; ctx.fillRect(40 + j * bw + 6, h - 26 - bh, bw - 12, bh); ctx.fillStyle = '#9b9b9f'; ctx.textAlign = 'center'; ctx.fillText('R' + (j + 1), 40 + j * bw + bw / 2, h - 10); ctx.fillText(nf(v, 0), 40 + j * bw + bw / 2, h - 32 - bh); });
    const top = [...r.resultat].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('tMRres').innerHTML = `<tr><th>${t('rCle')}</th><th class="n">${t('rN')}</th></tr>` + top.map(([k, v]) => { const [s, d] = k.split('|'); return `<tr><td>${nomSvc(s)} | ${nomDiag(d)}</td><td class="n">${v}</td></tr>`; }).join('');
  }


  /* ---------- 6. Lac, Parquet, Spark ---------- */
  const reponses = {};
  let modeEtl = 'elt', tableTx = null, versionVue = null, cacheLac = null;
  function nouvelleTable() {
    tableTx = K.Table(D.W.faits.slice(0, 40).map((f) => ({ id: f.sejour_k, patient: f.patient_k, service: f.service, glyc: f.glyc })), 'id');
    versionVue = null;
  }
  function lac() {
    // types de données
    const ex = K.EXEMPLES;
    $('tTypes').innerHTML = `<tr><th>${t('tExemple')}</th><th>${t('tS')}</th><th>${t('tM')}</th><th>${t('tN')}</th></tr>` + ex.map((e) => {
      const r = reponses[e.id];
      return `<tr><td>${e[lng()]}</td>` + ['s', 'm', 'n'].map((ty) => {
        const style = r === ty ? (ty === e.type ? 'border-color:var(--ok);color:var(--ok)' : 'border-color:#ff8a8a;color:#ff8a8a') : '';
        return `<td><button type="button" class="btn" data-rep="${e.id}:${ty}" aria-pressed="${r === ty}" style="${style}">${r === ty ? (ty === e.type ? '✓' : '✗') : '·'}</button></td>`;
      }).join('') + '</tr>';
    }).join('');
    const bons = ex.filter((e) => reponses[e.id] === e.type).length;
    $('typesScore').textContent = fmt(t('typesScore'), { b: bons, n: ex.length }) + ' ' + t('typesExpl');
    document.querySelectorAll('[data-rep]').forEach((b) => b.addEventListener('click', () => { const [id, ty] = b.dataset.rep.split(':'); reponses[id] = ty; lac(); }));
    // métadonnées
    if (!cacheLac || cacheLac.W !== D.W) {
      cacheLac = { W: D.W, csv: K.versCSV(D.W.faits), col: K.versColonnes(D.W.faits), tri: K.versColonnes(D.W.faits, { trierPar: ['annee', 'service'] }), part: K.partitionner(D.W.faits, ['annee', 'service']) };
    }
    const c = cacheLac;
    const csvC = D.em.msgs.filter((m) => m.site === 'C').map((m) => m.texte).join('\n');
    const fhir = (D.em.msgs.find((m) => m.site === 'B') || { texte: '' }).texte;
    const fichiersM = [[K.metadonnees('labo_site_C_2026-11-26.csv', E.ENTETE_CSV + '\n' + csvC, '2026-11-26 23:00'), 'z_brut'],
      [K.metadonnees('bundle_site_B_S000412.json', fhir, '2026-11-27 08:14'), 'z_brut'],
      [{ nom: 'sejours_propres/part-00000.parquet', taille: c.col.octets, modifie: '2026-11-27 02:00', format: 'parquet' }, 'z_calcule']];
    $('tMeta').innerHTML = `<tr><th>${t('mNom')}</th><th class="n">${t('mTaille')}</th><th>${t('mModif')}</th><th>${t('mFormat')}</th><th>${t('mZone')}</th></tr>`
      + fichiersM.map(([m, z]) => `<tr><td>${m.nom}</td><td class="n">${octets(m.taille)}</td><td>${m.modifie}</td><td>${m.format}</td><td>${t(z)}</td></tr>`).join('');
    // zones du lac
    const z = K.zonesLac(D.em.msgs, D.net.propres, D.W.faits);
    $('tLac').innerHTML = `<tr><th>${t('zZone')}</th><th>${t('zContenu')}</th><th class="n">${t('zVolume')}</th><th class="n">${t('zTaille')}</th><th>${t('zUsage')}</th></tr>`
      + [['brut', z.brut.fichiers, 'fichiers', z.brut.octets], ['calcule', z.calcule.lignes, 'lignesU', z.calcule.octets], ['metier', z.metier.lignes, 'lignesU', z.metier.octets]]
        .map(([k, n, u, o]) => `<tr><td>${t('z_' + k)}</td><td>${t('zc_' + k)}</td><td class="n">${nf(n, 0)} ${t(u)}</td><td class="n">${octets(o)}</td><td>${t('zu_' + k)}</td></tr>`).join('');
    document.querySelectorAll('[data-etl]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.etl === modeEtl)));
    $('cEtl').textContent = modeEtl === 'etl'
      ? 'sources ─► Extract ─► Transform (qualité, unités) ─► Load ─► entrepôt\n                 (le brut n\'est pas conservé)'
      : 'sources ─► Extract ─► Load ─► lac (brut conservé)\n                               └─► Transform à la demande ─► entrepôt\n                               └─► nouvelle règle ? on relance sur le brut';
    if (lng() === 'en') $('cEtl').textContent = modeEtl === 'etl'
      ? 'sources ─► Extract ─► Transform (quality, units) ─► Load ─► warehouse\n                 (raw data is not kept)'
      : 'sources ─► Extract ─► Load ─► lake (raw kept)\n                               └─► Transform on demand ─► warehouse\n                               └─► new rule? rerun on the raw data';
    $('etlTxt').textContent = t(modeEtl);
    // CSV / colonnes / partitions
    if (!$('qS').options.length) $('qS').innerHTML = Object.keys(E.SERVICES).map((k) => `<option value="${k}">${nomSvc(k)}</option>`).join('');
    else [...$('qS').options].forEach((o) => (o.textContent = nomSvc(o.value)));
    const q = { mesure: 'dms', filtres: { service: $('qS').value || 'CARDIO', annee: $('qA').value } };
    const r = [['csv', c.csv.length, K.requeteCSV(D.W.faits, c.csv, q)], ['col', c.col.octets, K.requeteColonnes(c.col, q)], ['tri', c.tri.octets, K.requeteColonnes(c.tri, q)],
      ['part', c.part.reduce((a, x) => a + x.fichier.octets, 0), K.requetePartitions(c.part, ['annee', 'service'], q)]];
    const ref = r[0][2].octetsLus;
    $('tParq').innerHTML = `<tr><th>${t('pFormat')}</th><th class="n">${t('pTaille')}</th><th class="n">${t('pLus')}</th><th class="n">${t('pGroupes')}</th><th class="n">${t('pRes')}</th></tr>`
      + r.map(([k, taille, x]) => `<tr><td>${t('p_' + k)}</td><td class="n">${octets(taille)}</td><td class="n ${x.octetsLus < ref / 20 ? 'good' : ''}">${octets(x.octetsLus)} (${nf(100 * x.octetsLus / ref, 1)} %)</td><td class="n">${k === 'part' ? `${x.fichiersLus} / ${x.fichiersTotal} ${t('fichiers')}` : `${x.groupesLus} / ${x.groupesTotal}`}</td><td class="n">${nf(x.valeur, 3)}</td></tr>`).join('');
    $('parqInfo').textContent = fmt(t('parqInfo'), { n: r[0][2].n });
    $('tEnc').innerHTML = `<tr><th>${t('eCol')}</th><th>${t('eEnc')}</th><th class="n">${t('eCard')}</th><th class="n">${t('eOct')}</th></tr>`
      + K.COLONNES.map((col) => { const e = K.encoderColonne(D.W.faits.map((f) => f[col])); return `<tr><td>${col}</td><td>${t('e_' + e.encodage)}</td><td class="n">${nf(e.cardinalite, 0)}</td><td class="n">${octets(e.octets)}</td></tr>`; }).join('');
    // passage à l'échelle
    const nN = +$('sN').value, parts = Math.pow(2, +$('sP').value), sq = +$('sS').value, dq = +$('sD').value;
    $('osN').textContent = nN; $('osP').textContent = parts; $('osS').textContent = nf(100 * sq, 0) + ' %'; $('osD').textContent = nf(dq, 2);
    const base = K.ordonnancer({ noeuds: 1, coeursParNoeud: 1, partitions: 1, sequentiel: sq });   // référence : tout le travail sur 1 cœur, sans découpage
    const sain = K.ordonnancer({ noeuds: nN, partitions: parts, sequentiel: sq, desequilibre: dq });
    const o = $('sF').checked && nN > 1 ? K.ordonnancer({ noeuds: nN, partitions: parts, sequentiel: sq, desequilibre: dq, panneA: sain.seq + (sain.duree - sain.seq) * 0.4 }) : sain;
    const coeurs = nN * 4;
    $('kScale').innerHTML = kpi('kCoeurs', coeurs) + kpi('kDuree', nf(o.duree, 0), 's') + kpi('kAcc', '×' + nf(base.duree / o.duree, 1)) + kpi('kAmdahl', '×' + nf(K.amdahl(sq, coeurs), 1))
      + kpi('kEff', nf(100 * o.efficacite, 0) + ' %', '', o.efficacite < 0.5 ? 'bad' : o.efficacite < 0.8 ? 'mid' : 'good') + kpi('kRel', o.relances || 0);
    const up = K.coutScaleUp(coeurs);
    $('scaleInfo').textContent = fmt(t('scaleInfo'), { u: Number.isFinite(up) ? `≈ ${nf(up, 2)} ${t('parH')}` : t('plafond'), c: coeurs, n: nN, o: nf(K.coutScaleOut(coeurs), 2) });
    const cv = $('cvGantt'), { ctx, w, h } = C.preparer(cv), gL = 40, gR = 10, gT = 6, gB = 22;
    const X = (x) => gL + x / o.duree * (w - gL - gR), lh = (h - gT - gB) / coeurs;
    ctx.fillStyle = '#26262a'; ctx.fillRect(gL, gT, X(o.seq) - gL, h - gT - gB);
    o.traces.forEach((tr) => { ctx.fillStyle = tr.perdue ? '#e0a458' : '#c8102e'; ctx.fillRect(X(tr.debut), gT + tr.coeur * lh + 0.5, Math.max(1, X(tr.fin) - X(tr.debut) - 1), Math.max(1, lh - 1)); });
    ctx.fillStyle = '#8a8a8e'; ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
    for (let k = 0; k < coeurs; k += Math.max(1, Math.ceil(coeurs / 8))) ctx.fillText('c' + (k + 1), gL - 4, gT + k * lh + lh / 2 + 3);
    ctx.textAlign = 'center'; C.graduations(0, o.duree, 6).forEach((v) => ctx.fillText(String(v), X(v), h - 6));
    // évaluation paresseuse
    const svc = q.filtres.service, an = q.filtres.annee;
    $('cLazy').textContent = `df = (spark.read.parquet("entrepot/fait_sejour")\n      .withColumn("dms_semaines", col("dms") / 7)\n      .filter(col("service") == "${svc}")\n      .filter(col("annee") == "${an}")\n      .select("dms_semaines"))\n# ${lng() === 'en' ? 'nothing is computed yet' : "rien n'est encore calculé"}\ndf.agg(avg("dms_semaines")).show()   # ${lng() === 'en' ? 'action: the plan runs' : "action : le plan s'exécute"}`;
    const df = K.DataFrame(D.W.faits).withColumn('dms_sem', (x) => x.dms / 7, ['dms']).filter('service', svc).filter('annee', an).select('dms_sem');
    const a1 = df.avg('dms_sem', false), a2 = df.avg('dms_sem', true);
    $('tLazy').innerHTML = `<tr><th>${t('lP')}</th><th class="n">${t('lLues')}</th><th class="n">${t('lCalc')}</th><th class="n">${t('lRes')}</th></tr>`
      + [['l_naif', a1], ['l_opt', a2]].map(([k, x]) => `<tr><td>${t(k)}</td><td class="n">${nf(x.cellulesLues, 0)}</td><td class="n">${nf(x.cellulesCalculees, 0)}</td><td class="n">${nf(x.valeur, 4)}</td></tr>`).join('');
    $('cPlan').textContent = '== ' + t('l_naif') + ' ==\n' + a1.etapes.join('\n') + '\n\n== ' + t('l_opt') + ' ==\n' + a2.etapes.join('\n');
    // ACID
    if (!tableTx) nouvelleTable();
    const der = tableTx.derniere();
    $('ver').max = der; if (versionVue == null || versionVue > der) versionVue = der; $('ver').value = versionVue; $('over').textContent = 'v' + versionVue;
    $('tTx').innerHTML = `<tr><th>${t('jV')}</th><th>${t('jOp')}</th><th>${t('jRes')}</th><th>${t('jDet')}</th></tr>`
      + tableTx.journal.map((j) => `<tr><td>${j.version == null ? '—' : 'v' + j.version}</td><td>${j.op}</td><td class="${j.ok ? 'good' : 'bad'}">${j.ok ? t('valide') : t('annulee')}</td><td>${j.ok ? fmt(t('lignesTouchees'), { n: j.detail }) : j.detail}</td></tr>`).join('');
    const vue = tableTx.lire(versionVue);
    $('vueT').textContent = fmt(t('vueT'), { v: versionVue, n: vue.length });
    $('tVue').innerHTML = `<tr><th>${t('vId')}</th><th>${t('vPat')}</th><th>${t('vSvc')}</th><th class="n">${t('vGly')}</th></tr>`
      + vue.slice(0, 8).map((l) => `<tr><td>${l.id}</td><td>${l.patient}</td><td>${nomSvc(l.service)}</td><td class="n">${l.glyc == null ? '—' : nf(l.glyc, 1)}</td></tr>`).join('');
  }
  function transactionDemo(k) {
    if (!tableTx) nouvelleTable();
    const l = tableTx.lire(), cible = l[1].patient;
    const en = lng() === 'en';
    if (k === 'raz') nouvelleTable();
    else if (k === 'upsert') tableTx.transaction('UPSERT', [{ type: 'upsert', lignes: l.slice(0, 3).map((x) => ({ id: x.id, glyc: x.glyc == null ? 5.6 : Math.round((x.glyc + 0.2) * 10) / 10 })) }]);
    else if (k === 'coupure') tableTx.transaction('DELETE ' + cible.slice(0, 8) + '…', [{ type: 'delete', si: (x) => x.patient === cible }, { type: 'echec', message: en ? 'power cut: nothing written' : "coupure : rien n'est écrit" }]);
    else if (k === 'refus') tableTx.transaction('INSERT glyc = 99', [{ type: 'upsert', lignes: [{ id: 'S999999', patient: 'P-test', service: 'ENDO', glyc: 99 }] }, { type: 'check', nom: en ? 'rule glucose < 50 mmol/L' : 'règle glycémie < 50 mmol/L', regle: (x) => x.glyc == null || x.glyc < 50 }]);
    else if (k === 'rgpd') tableTx.transaction((en ? 'DELETE (GDPR) ' : 'DELETE (RGPD) ') + cible.slice(0, 8) + '…', [{ type: 'delete', si: (x) => x.patient === cible }]);
    versionVue = null;
    lac();
  }

  /* ---------- 6. Fouille ---------- */
  let cacheFouille = null;
  function fouille() {
    const k = +$('k').value; $('ok').textContent = k;
    $('osup').textContent = nf(100 * +$('sup').value, 0) + ' %'; $('oconf').textContent = nf(100 * +$('conf').value, 0) + ' %';
    if (!cacheFouille || cacheFouille.W !== D.W) {
      const P = E.profils(D.W.faits), X = P.map((p) => E.VARS.map((v) => p[v])), st = E.standardiser(X);
      const coude = [1, 2, 3, 4, 5, 6, 7, 8].map((kk) => { const m = E.kmeans(st.Z, kk, 1); return { k: kk, inertie: m.inertie, sil: kk > 1 ? E.silhouette(st.Z, m.labels, kk, 400) : 0 }; });
      cacheFouille = { W: D.W, P, st, acp: E.acp2(st.Z), coude, T: E.transactions(D.W.faits, D.net.propres) };
    }
    const { P, st, acp, coude } = cacheFouille;
    const km = E.kmeans(st.Z, k, 1);
    const xs = acp.proj.map((p) => p[0]), ys = acp.proj.map((p) => p[1]);
    const g = C.graphique($('cvAcp'), { xmin: Math.min(...xs) - 0.3, xmax: Math.max(...xs) + 0.3, ymin: Math.min(...ys) - 0.3, ymax: Math.max(...ys) + 0.3,
      xlabel: `ACP 1 (${nf(100 * acp.part[0], 0)} %)`, ylabel: `ACP 2 (${nf(100 * acp.part[1], 0)} %)`,
      series: Array.from({ length: k }, (_, c) => ({ x: xs.filter((_, i) => km.labels[i] === c), y: ys.filter((_, i) => km.labels[i] === c), color: COUL[c], points: true, r: 2 })) });
    void g;
    const inMax = coude[0].inertie;
    C.graphique($('cvCoude'), { xmin: 1, xmax: 8, ymin: 0, ymax: inMax * 1.05, xlabel: 'k',
      series: [{ x: coude.map((c) => c.k), y: coude.map((c) => c.inertie), color: '#c9c9cc', width: 2 }, { x: coude.slice(1).map((c) => c.k), y: coude.slice(1).map((c) => c.sil * inMax), color: '#c8102e', width: 2 }],
      vlignes: [{ x: k, color: '#6c6c70', dash: [4, 4] }], marques: coude.slice(1).map((c) => ({ x: c.k, y: c.sil * inMax, color: '#c8102e', r: 3 })) });
    const prof = Array.from({ length: k }, (_, c) => {
      const m = P.filter((_, i) => km.labels[i] === c), moy = (f) => m.reduce((a, p) => a + f(p), 0) / m.length;
      const tr = {}; m.forEach((p) => (tr[p.tranche] = (tr[p.tranche] || 0) + 1));
      return { n: m.length, nb: moy((p) => p.nb), dms: moy((p) => p.dmsMoy), diag: moy((p) => p.diag), gly: moy((p) => p.glyc), rh: moy((p) => p.rh), tr: Object.entries(tr).sort((a, b) => b[1] - a[1])[0][0] };
    });
    $('tProfils').innerHTML = `<tr><th>${t('pG')}</th><th class="n">${t('pN')}</th><th class="n">${t('pNb')}</th><th class="n">${t('pDms')}</th><th class="n">${t('pDiag')}</th><th class="n">${t('pGly')}</th><th class="n">${t('pRh')}</th><th>${t('pAge')}</th></tr>`
      + prof.map((p, c) => `<tr><td><span style="color:${COUL[c]}">●</span> ${c + 1}</td><td class="n">${p.n}</td><td class="n">${nf(p.nb, 2)}</td><td class="n">${nf(p.dms, 1)}</td><td class="n">${nf(p.diag, 1)}</td><td class="n">${nf(p.gly, 1)}</td><td class="n">${nf(p.rh, 2)}</td><td>${p.tr}</td></tr>`).join('');
    const a = E.apriori(cacheFouille.T, +$('sup').value, +$('conf').value);
    $('tApr').innerHTML = `<tr><th>${t('rSi')}</th><th>${t('rAlors')}</th><th class="n">${t('rSup')}</th><th class="n">${t('rConf')}</th><th class="n">${t('rLift')}</th></tr>`
      + a.regles.filter((r) => r.alors.length === 1).slice(0, 15).map((r) => `<tr><td>${r.si.map(nomItem).join(' + ')}</td><td>${r.alors.map(nomItem).join(' + ')}</td><td class="n">${nf(100 * r.support, 1)} %</td><td class="n">${nf(100 * r.confiance, 0)} %</td><td class="n ${r.lift > 2 ? 'good' : ''}">${nf(r.lift, 2)}</td></tr>`).join('');
    $('aprInfo').textContent = fmt(t('aprInfo'), { f: a.frequents.length, r: a.regles.filter((r) => r.alors.length === 1).length, n: nf(a.n, 0) });
  }

  /* ---------- 7. Vérifications ---------- */
  function verif() {
    const res = [];
    const S = D.G.sejours, propre = E.emettre(S, {}, 3);
    const parId = new Map(S.map((s) => [s.id, s]));
    res.push(['c_formats', propre.msgs.every((m) => { const r = E.lire(m), s = parId.get(r.id); return r.entree === s.entree && r.diags.join() === s.diags.join() && r.meds.join() === s.meds.join(); })]);
    const det = E.evaluerDetection(D.em.verite, D.net);
    res.push(['c_doublon', det.doublon.rappel === 1]); res.push(['c_dates', det.dates.rappel === 1]); res.push(['c_unite', det.unite.rappel > 0.97]);
    const c = E.cube(D.W.faits, { lignes: 'service', colonnes: 'annee', mesure: 'sejours' });
    res.push(['c_cube', c.valeurs.flat().reduce((x, v) => x + (v || 0), 0) === c.total]);
    const mo = E.cube(D.W.faits, { lignes: 'mois', mesure: 'sejours' }), an = E.cube(D.W.faits, { lignes: 'annee', mesure: 'sejours' });
    res.push(['c_rollup', an.lignes.every((y, i) => mo.lignes.reduce((x, m, j) => x + (m.startsWith(y) ? mo.valeurs[j][0] : 0), 0) === an.valeurs[i][0])]);
    const r = E.mapReduce(D.net.propres, {}), dir = E.compteDirect(D.net.propres);
    res.push(['c_mr', [...dir].every(([k, v]) => r.resultat.get(k) === v)]);
    const T = E.transactions(D.W.faits, D.net.propres), a = E.apriori(T, 0.1, 0.5);
    res.push(['c_apr', a.frequents.every((f) => Math.abs(f.support - T.filter((x) => f.items.every((i) => x.includes(i))).length / T.length) < 1e-12)]);
    res.push(['c_pseudo', !JSON.stringify(D.W.faits).includes('INS')]);
    res.push(['c_rh', D.W.faits.reduce((x, f) => x + f.rh30, 0) === S.filter((s) => s.rh30).length]);
    {
      const q = { mesure: 'dms', filtres: { service: 'CARDIO', annee: '2025' } }, csv = K.versCSV(D.W.faits), r1 = K.requeteCSV(D.W.faits, csv, q);
      const r2 = K.requetePartitions(K.partitionner(D.W.faits, ['annee', 'service']), ['annee', 'service'], q);
      res.push(['c_parquet', Math.abs(r1.valeur - r2.valeur) < 1e-12 && r2.octetsLus < r1.octetsLus]);
      const df = K.DataFrame(D.W.faits).withColumn('s', (x) => x.dms / 7, ['dms']).filter('service', 'CARDIO').select('s'), x1 = df.avg('s', false), x2 = df.avg('s', true);
      res.push(['c_lazy', Math.abs(x1.valeur - x2.valeur) < 1e-12 && x2.cellulesLues < x1.cellulesLues]);
      const tb = K.Table([{ id: 1 }, { id: 2 }], 'id'), rr = tb.transaction('x', [{ type: 'delete', si: () => true }, { type: 'echec', message: 'x' }]);
      res.push(['c_acid', !rr.ok && tb.lire().length === 2]);
    }
    $('chk').innerHTML = res.map(([k, v]) => `<li class="${v ? 'ok' : 'ko'}">${v ? '✓' : '✗'} ${t(k)}</li>`).join('');
  }

  function tout() {
    if (page === 'velocite') dessinerFlux();
    else if (page === 'variete') variete();
    else if (page === 'veracite') veracite();
    else if (page === 'valeur') valeur();
    else if (page === 'volume') volume();
    else if (page === 'lac') lac();
    else if (page === 'fouille') fouille();
    else if (page === 'verif') verif();
  }

  // événements
  $('go').addEventListener('click', () => { enMarche = !enMarche; $('go').textContent = enMarche ? t('pause') : t('go'); if (enMarche) { if (!F) nouveauF(); dernierT = 0; requestAnimationFrame(boucle); } });
  $('raz').addEventListener('click', () => { nouveauF(); dessinerFlux(); });
  ['lits', 'hz', 'cap', 'desat'].forEach((k) => $(k).addEventListener('input', () => {
    if (!F) nouveauF();
    if (k === 'cap') F.capacite = +$('cap').value; else nouveauF();
    dessinerFlux();
  }));
  $('autre').addEventListener('click', () => { idxSej = (idxSej + 37) % D.G.sejours.length; variete(); });
  $('zero').addEventListener('click', () => { Object.keys(TAUX0).forEach((k) => { valTaux[k] = 0; $('tx_' + k).value = 0; }); pipeline(); tout(); });
  ['oL', 'oC', 'oM', 'fS', 'fA', 'fT'].forEach((k) => $(k).addEventListener('change', valeur));
  const NIV = Object.values(E.DIMS);
  const bouger = (d) => { const l = $('oL').value, dim = NIV.find((n) => n.includes(l)), i = dim.indexOf(l) + d; if (i >= 0 && i < dim.length) { $('oL').value = dim[i]; valeur(); } };
  $('up').addEventListener('click', () => bouger(-1)); $('down').addEventListener('click', () => bouger(1));
  ['nN', 'nR', 'comb'].forEach((k) => $(k).addEventListener('input', volume));
  ['k', 'sup', 'conf'].forEach((k) => $(k).addEventListener('input', fouille));
  document.querySelectorAll('[data-etl]').forEach((b) => b.addEventListener('click', () => { modeEtl = b.dataset.etl; lac(); }));
  ['qS', 'qA'].forEach((k) => $(k).addEventListener('change', lac));
  ['sN', 'sP', 'sS', 'sD', 'sF'].forEach((k) => $(k).addEventListener('input', lac));
  document.querySelectorAll('[data-tx]').forEach((b) => b.addEventListener('click', () => transactionDemo(b.dataset.tx)));
  $('ver').addEventListener('input', () => { versionVue = +$('ver').value; lac(); });
  window.addEventListener('resize', tout);

  // démarrage
  statique();
  pipeline();
  const h = (location.hash || '').slice(1);
  aller(PAGES.includes(h) ? h : 'velocite');
  L.appliquer(L.lang);
  window.__entrepot = { aller, D, lancer: () => $('go').click() };
})();
