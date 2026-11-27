/* =====================================================================
   Stockage et calcul distribué (onglet « Lac, Parquet, Spark »)
     - structuré / semi-structuré / non structuré, métadonnées
     - zones du lac de données (brut → calculé → métier), ETL / ELT
     - CSV (lignes) contre stockage en colonnes façon Parquet :
       dictionnaire, bits, groupes de lignes avec min/max, partitions
     - passage à l'échelle vertical / horizontal, partitions, déséquilibre,
       panne d'un nœud
     - évaluation paresseuse et optimisation du plan (filtres poussés,
       colonnes élaguées)
     - table transactionnelle : ACID, journal des versions, time travel
   ===================================================================== */
(function (racine) {
  'use strict';

  /* ---------- 1. Types de données ---------- */
  // s = structuré, m = semi-structuré, n = non structuré
  const EXEMPLES = [
    { id: 'pg', type: 's', fr: 'Table PostgreSQL / MySQL des séjours', en: 'PostgreSQL / MySQL table of stays' },
    { id: 'csv', type: 's', fr: 'Fichier CSV du laboratoire (site C)', en: 'Lab CSV file (site C)' },
    { id: 'parquet', type: 's', fr: 'Fichier Parquet de l\'entrepôt', en: 'Warehouse Parquet file' },
    { id: 'json', type: 'm', fr: 'Bundle FHIR en JSON (site B)', en: 'FHIR bundle in JSON (site B)' },
    { id: 'hl7', type: 'm', fr: 'Message HL7 v2 (site A)', en: 'HL7 v2 message (site A)' },
    { id: 'xml', type: 'm', fr: 'Document XML (CDA)', en: 'XML document (CDA)' },
    { id: 'log', type: 'm', fr: 'Journaux du serveur des moniteurs', en: 'Monitor server logs' },
    { id: 'pdf', type: 'n', fr: 'Compte rendu d\'hospitalisation en PDF', en: 'Discharge letter as PDF' },
    { id: 'img', type: 'n', fr: 'Image de radiographie', en: 'X-ray image' },
    { id: 'video', type: 'n', fr: 'Vidéo d\'échographie', en: 'Ultrasound video' },
    { id: 'texte', type: 'n', fr: 'Note libre d\'infirmier', en: 'Free-text nursing note' },
  ];
  const metadonnees = (nom, contenu, modifie) => ({ nom, taille: contenu.length, modifie, format: nom.split('.').pop(), lignes: contenu.split('\n').length });

  /* ---------- 2. Zones du lac de données ---------- */
  // brut : messages tels que reçus ; calculé : séjours nettoyés et standardisés ; métier : agrégats prêts pour la BI
  function zonesLac(msgs, propres, faits) {
    const brut = msgs.reduce((s, m) => s + m.texte.length, 0);
    const calcule = propres.reduce((s, p) => s + JSON.stringify({ id: p.id, ins: p.ins, service: p.service, entree: p.entree, sortie: p.sortie, diags: p.diags, meds: p.meds, glyc: p.glyc, crea: p.crea }).length + 1, 0);
    const agg = {};
    faits.forEach((f) => { const k = `${f.mois}|${f.service}`; const a = agg[k] || (agg[k] = { n: 0, dms: 0, rh: 0 }); a.n++; a.dms += f.dms; a.rh += f.rh30; });
    const metier = Object.keys(agg).length * 40;
    return { brut: { fichiers: msgs.length, octets: brut }, calcule: { lignes: propres.length, octets: calcule }, metier: { lignes: Object.keys(agg).length, octets: metier } };
  }

  /* ---------- 3. CSV contre colonnes (façon Parquet) ---------- */
  const COLONNES = ['sejour_k', 'patient_k', 'annee', 'mois', 'service', 'pole', 'dp', 'sexe', 'tranche', 'dms', 'rh30', 'glyc'];
  function versCSV(faits) {
    return COLONNES.join(',') + '\n' + faits.map((f) => COLONNES.map((c) => (f[c] == null ? '' : f[c])).join(',')).join('\n');
  }
  const bits = (n) => Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
  // taille d'une colonne encodée : dictionnaire + indices sur le minimum de bits, ou nombres sur leur largeur utile
  function encoderColonne(valeurs) {
    const num = valeurs.every((v) => v == null || typeof v === 'number');
    const dict = [...new Set(valeurs.map((v) => (v == null ? '\u0000' : String(v))))];
    if (!num || dict.length < valeurs.length / 4) {
      const tDict = dict.reduce((s, d) => s + d.length + 1, 0);
      return { encodage: 'dictionnaire', cardinalite: dict.length, octets: tDict + Math.ceil(valeurs.length * bits(dict.length) / 8) };
    }
    const v = valeurs.filter((x) => x != null), mn = Math.min(...v), mx = Math.max(...v);
    const entiers = v.every((x) => Number.isInteger(x * 10));
    const ech = entiers ? 10 : 1000;
    const largeur = bits(Math.round((mx - mn) * ech) + 1);
    return { encodage: 'bits', cardinalite: dict.length, octets: 8 + Math.ceil(valeurs.length * (largeur + 1) / 8) };
  }
  // fichier en colonnes : groupes de lignes, chaque colonne encodée, statistiques min/max par groupe
  function versColonnes(faits, { tailleGroupe = 500, trierPar = null } = {}) {
    const lignes = trierPar ? [...faits].sort((a, b) => trierPar.map((k) => String(a[k]).localeCompare(String(b[k]))).find((x) => x) || 0) : faits;
    const groupes = [];
    for (let i = 0; i < lignes.length; i += tailleGroupe) {
      const g = lignes.slice(i, i + tailleGroupe);
      const cols = {};
      COLONNES.forEach((c) => {
        const v = g.map((f) => f[c]);
        const e = encoderColonne(v);
        const nn = v.filter((x) => x != null).map(String).sort();
        cols[c] = { ...e, min: nn[0], max: nn[nn.length - 1] };
      });
      groupes.push({ lignes: g, cols });
    }
    const octets = groupes.reduce((s, g) => s + Object.values(g.cols).reduce((t, c) => t + c.octets, 0), 0);
    return { groupes, octets };
  }
  // requête : moyenne d'une mesure avec des filtres d'égalité ; renvoie le résultat et les octets lus
  function requeteCSV(faits, csv, { mesure, filtres }) {
    const f = faits.filter((x) => Object.entries(filtres).every(([k, v]) => String(x[k]) === v));
    return { valeur: f.reduce((s, x) => s + x[mesure], 0) / f.length, n: f.length, octetsLus: csv.length, groupesLus: 1, groupesTotal: 1 };
  }
  function requeteColonnes(fichier, { mesure, filtres }) {
    let lus = 0, gLus = 0, somme = 0, n = 0;
    const utiles = [...new Set([...Object.keys(filtres), mesure])];
    fichier.groupes.forEach((g) => {
      // statistiques : on saute le groupe si une valeur filtrée est hors [min, max]
      const possible = Object.entries(filtres).every(([k, v]) => v >= g.cols[k].min && v <= g.cols[k].max);
      if (!possible) return;
      gLus++;
      utiles.forEach((c) => (lus += g.cols[c].octets));      // seules les colonnes utiles sont lues
      g.lignes.forEach((x) => { if (Object.entries(filtres).every(([k, v]) => String(x[k]) === v)) { somme += x[mesure]; n++; } });
    });
    return { valeur: somme / n, n, octetsLus: lus, groupesLus: gLus, groupesTotal: fichier.groupes.length };
  }
  // partitionnement en répertoires annee=…/service=…/part-0
  function partitionner(faits, cles) {
    const parts = new Map();
    faits.forEach((f) => { const k = cles.map((c) => `${c}=${f[c]}`).join('/'); if (!parts.has(k)) parts.set(k, []); parts.get(k).push(f); });
    return [...parts.entries()].map(([chemin, l]) => ({ chemin, fichier: versColonnes(l, { tailleGroupe: 500 }), n: l.length }));
  }
  function requetePartitions(parts, cles, q) {
    let lus = 0, fichiers = 0, somme = 0, n = 0, gL = 0, gT = 0;
    parts.forEach((p) => {
      const val = Object.fromEntries(p.chemin.split('/').map((s) => s.split('=')));
      if (cles.some((c) => q.filtres[c] !== undefined && q.filtres[c] !== val[c])) return;   // élagage des partitions
      fichiers++;
      const r = requeteColonnes(p.fichier, { mesure: q.mesure, filtres: Object.fromEntries(Object.entries(q.filtres).filter(([k]) => !cles.includes(k))) });
      lus += r.octetsLus; gL += r.groupesLus; gT += r.groupesTotal;
      if (r.n) { somme += r.valeur * r.n; n += r.n; }
    });
    return { valeur: somme / n, n, octetsLus: lus, fichiersLus: fichiers, fichiersTotal: parts.length, groupesLus: gL, groupesTotal: gT };
  }

  /* ---------- 4. Passage à l'échelle, partitions, pannes ---------- */
  // tâches de durées proportionnelles à la taille des partitions ; ordonnancement glouton sur `coeurs` cœurs
  function tailles(nbPartitions, total, desequilibre, graine = 3) {
    let a = graine >>> 0;
    const r = () => { a = (Math.imul(a ^ (a >>> 15), 2246822519) + 0x9E3779B9) >>> 0; return a / 4294967296; };
    const w = Array.from({ length: nbPartitions }, (_, i) => (i === 0 ? 1 + desequilibre * nbPartitions * 0.3 : 0.7 + 0.6 * r()));
    const s = w.reduce((x, y) => x + y, 0);
    return w.map((x) => total * x / s);
  }
  // durée du travail : partie séquentielle + tâches parallèles + coût fixe par tâche ; panne : un cœur s'arrête à `panneA`, ses tâches repartent
  function ordonnancer({ total = 1000, partitions = 16, noeuds = 4, coeursParNoeud = 4, sequentiel = 0.05, coutTache = 0.5, desequilibre = 0, panneA = null }) {
    const coeurs = noeuds * coeursParNoeud;
    const seq = sequentiel * total;
    const taches = tailles(partitions, total * (1 - sequentiel), desequilibre).map((d) => d + coutTache).sort((a, b) => b - a);
    const libre = Array(coeurs).fill(seq);
    const morts = new Set();
    const traces = [];
    const file = taches.map((d, i) => ({ i, d }));
    let relances = 0;
    while (file.length) {
      const t = file.shift();
      let c = -1;
      for (let k = 0; k < coeurs; k++) if (!morts.has(k) && (c < 0 || libre[k] < libre[c])) c = k;
      const debut = libre[c], fin = debut + t.d;
      // panne d'un nœud entier (ses cœurs) au temps panneA : la tâche en cours est perdue et relancée ailleurs
      if (panneA != null && Math.floor(c / coeursParNoeud) === 0 && fin > panneA && !morts.has(c)) {
        for (let k = 0; k < coeursParNoeud; k++) morts.add(k);
        if (debut < panneA) traces.push({ coeur: c, debut, fin: panneA, tache: t.i, perdue: true });
        relances++;
        file.unshift(t);
        // les autres tâches de ce nœud encore en cours au moment de la panne sont perdues aussi
        traces.forEach((x) => {
          if (!x.perdue && x.coeur < coeursParNoeud && x.fin > panneA) {
            file.unshift({ i: x.tache, d: x.fin - x.debut }); relances++;
            x.fin = panneA; x.perdue = true;
          }
        });
        if (morts.size >= coeurs) return { duree: Infinity, traces, relances, coeurs };
        continue;
      }
      libre[c] = fin;
      traces.push({ coeur: c, debut, fin, tache: t.i, perdue: false });
    }
    const duree = Math.max(...traces.map((x) => x.fin), seq);
    const occup = traces.filter((x) => !x.perdue).reduce((s, x) => s + x.fin - x.debut, 0);
    return { duree, traces, relances, coeurs, morts: morts.size, efficacite: occup / (Math.max(1e-9, duree - seq) * coeurs), seq };
  }
  // loi d'Amdahl : accélération maximale avec p cœurs
  const amdahl = (s, p) => 1 / (s + (1 - s) / p);
  // coût indicatif : scale up = une machine de plus en plus grosse (prix plus que proportionnel, plafond), scale out = n machines identiques
  const coutScaleUp = (coeurs) => (coeurs > 128 ? Infinity : 0.05 * coeurs * Math.pow(coeurs / 4, 0.35));
  const coutScaleOut = (coeurs) => 0.05 * coeurs * 1.1;

  /* ---------- 5. Évaluation paresseuse et plan optimisé ---------- */
  // mini DataFrame : les transformations construisent un plan ; seule une action l'exécute
  function DataFrame(source, plan = []) {
    const avec = (op) => DataFrame(source, plan.concat(op));
    return {
      plan,
      filter: (col, val) => avec({ op: 'filter', col, val }),
      withColumn: (col, f, deps) => avec({ op: 'withColumn', col, f, deps }),
      select: (...cols) => avec({ op: 'select', cols }),
      // action : exécute, en optimisant ou non, et compte les cellules lues / calculées
      avg: (col, optimiser = true) => executer(source, plan, col, optimiser),
      explain: (optimiser = true) => (optimiser ? optimiserPlan(plan, null) : plan).map((o) => texteOp(o)),
    };
  }
  const texteOp = (o) => (o.op === 'filter' ? `Filter (${o.col} = '${o.val}')` : o.op === 'withColumn' ? `Project [+ ${o.col}]` : o.op === 'select' ? `Project [${o.cols.join(', ')}]` : o.op === 'scan' ? `Scan [${o.cols.join(', ')}]${o.filtres.length ? ' PushedFilters: ' + o.filtres.map((f) => `${f.col}='${f.val}'`).join(', ') : ''}` : o.op);
  // règles de l'optimiseur : les filtres remontent avant les colonnes calculées (si elles n'en dépendent pas), puis sont poussés dans la lecture ; seules les colonnes utiles sont lues
  function optimiserPlan(plan, colFinale) {
    const filtres = plan.filter((o) => o.op === 'filter');
    const autres = plan.filter((o) => o.op !== 'filter');
    const calc = new Set(autres.filter((o) => o.op === 'withColumn').map((o) => o.col));
    const pousses = filtres.filter((f) => !calc.has(f.col)), restants = filtres.filter((f) => calc.has(f.col));
    const besoins = new Set([...(colFinale ? [colFinale] : []), ...filtres.map((f) => f.col)]);
    autres.forEach((o) => { if (o.op === 'withColumn' && (besoins.has(o.col) || !colFinale)) o.deps.forEach((d) => besoins.add(d)); if (o.op === 'select' && !colFinale) o.cols.forEach((c) => besoins.add(c)); });
    const lus = [...besoins].filter((c) => !calc.has(c));
    const utiles = autres.filter((o) => o.op !== 'withColumn' || !colFinale || besoins.has(o.col));
    return [{ op: 'scan', cols: lus, filtres: pousses }, ...utiles.filter((o) => o.op !== 'select'), ...restants];
  }
  function executer(source, plan, colFinale, optimiser) {
    let cellulesLues = 0, cellulesCalculees = 0, lignesTraitees = 0;
    let lignes;
    const etapes = optimiser ? optimiserPlan(plan, colFinale) : [{ op: 'scan', cols: Object.keys(source[0]), filtres: [] }, ...plan];
    for (const o of etapes) {
      if (o.op === 'scan') {
        lignes = source.filter((r) => o.filtres.every((f) => String(r[f.col]) === f.val)).map((r) => Object.fromEntries(o.cols.map((c) => [c, r[c]])));
        cellulesLues += o.filtres.length ? source.length * o.filtres.length + lignes.length * o.cols.length : source.length * o.cols.length;
      } else if (o.op === 'filter') { lignesTraitees += lignes.length; lignes = lignes.filter((r) => String(r[o.col]) === o.val); }
      else if (o.op === 'withColumn') { lignes.forEach((r) => { r[o.col] = o.f(r); }); cellulesCalculees += lignes.length; lignesTraitees += lignes.length; }
      else if (o.op === 'select') { lignes = lignes.map((r) => Object.fromEntries(o.cols.map((c) => [c, r[c]]))); }
    }
    const v = lignes.map((r) => r[colFinale]);
    return { valeur: v.reduce((s, x) => s + x, 0) / v.length, n: v.length, cellulesLues, cellulesCalculees, lignesTraitees, etapes: etapes.map(texteOp) };
  }

  /* ---------- 6. Table transactionnelle : ACID et time travel ---------- */
  function Table(lignesInitiales, cle) {
    const versions = [{ version: 0, op: 'CREATE', lignes: lignesInitiales.map((l) => ({ ...l })), detail: lignesInitiales.length }];
    const journal = [{ version: 0, op: 'CREATE', ok: true, detail: `${lignesInitiales.length}` }];
    const actuelle = () => versions[versions.length - 1].lignes;
    // une transaction : toutes ses opérations réussissent, ou aucune n'est appliquée (atomicité)
    function transaction(nom, ops) {
      const copie = actuelle().map((l) => ({ ...l }));
      try {
        let t = copie;
        let touchees = 0;
        for (const o of ops) {
          if (o.type === 'upsert') {
            o.lignes.forEach((n) => { const i = t.findIndex((l) => l[cle] === n[cle]); if (i >= 0) t[i] = { ...t[i], ...n }; else t.push({ ...n }); touchees++; });
          } else if (o.type === 'delete') { const av = t.length; t = t.filter((l) => !o.si(l)); touchees += av - t.length; }
          else if (o.type === 'check') { const err = t.find((l) => !o.regle(l)); if (err) throw new Error(`${o.nom} : ${err[cle]}`); }
          else if (o.type === 'echec') throw new Error(o.message);
        }
        versions.push({ version: versions.length, op: nom, lignes: t, detail: touchees });
        journal.push({ version: versions.length - 1, op: nom, ok: true, detail: `${touchees}` });
        return { ok: true, version: versions.length - 1 };
      } catch (e) {
        journal.push({ version: null, op: nom, ok: false, detail: e.message });
        return { ok: false, erreur: e.message };
      }
    }
    return { transaction, journal, versions, lire: (v = versions.length - 1) => versions[Math.min(v, versions.length - 1)].lignes, derniere: () => versions.length - 1 };
  }

  const api = { EXEMPLES, metadonnees, zonesLac, COLONNES, versCSV, encoderColonne, versColonnes, requeteCSV, requeteColonnes, partitionner, requetePartitions,
    tailles, ordonnancer, amdahl, coutScaleUp, coutScaleOut, DataFrame, optimiserPlan, Table };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Stockage = api;
})(typeof window !== 'undefined' ? window : this);
