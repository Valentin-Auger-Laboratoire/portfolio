/* =====================================================================
   Entrepôt de données de santé : les 5 V du Big Data
   Tout est calculé dans le navigateur sur des données FICTIVES générées ici.
     Vélocité : flux des moniteurs, file d'attente, fenêtres, alertes
     Variété  : trois sites, trois formats (HL7 v2, FHIR JSON, CSV en mg/dL)
     Véracité : erreurs injectées, règles de qualité, nettoyage
     Valeur   : entrepôt en étoile, pseudonymisation, cube OLAP
     Volume   : document NoSQL / lignes SQL, MapReduce réparti
     Fouille  : k-means (+ ACP, silhouette), règles d'association (Apriori)
   ===================================================================== */
(function (racine) {
  'use strict';

  /* ---------- hasard reproductible ---------- */
  function Hasard(graine) {
    let a = (graine >>> 0) || 1;
    const rand = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let res = null;
    const randn = () => {
      if (res !== null) { const r = res; res = null; return r; }
      let u = 0; while (u === 0) u = rand();
      const v = rand(), m = Math.sqrt(-2 * Math.log(u));
      res = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v);
    };
    const choix = (t) => t[Math.floor(rand() * t.length)];
    const bern = (p) => rand() < p;
    return { rand, randn, choix, bern };
  }

  /* ---------- référentiels ---------- */
  const DIAG = {
    I50: { fr: 'Insuffisance cardiaque', en: 'Heart failure', chap: 'IX', service: 'CARDIO' },
    I48: { fr: 'Fibrillation atriale', en: 'Atrial fibrillation', chap: 'IX', service: 'CARDIO' },
    I10: { fr: 'Hypertension artérielle', en: 'Hypertension', chap: 'IX', service: 'CARDIO' },
    E11: { fr: 'Diabète de type 2', en: 'Type 2 diabetes', chap: 'IV', service: 'ENDO' },
    J44: { fr: 'BPCO', en: 'COPD', chap: 'X', service: 'PNEUMO' },
    J18: { fr: 'Pneumonie', en: 'Pneumonia', chap: 'X', service: 'PNEUMO' },
    N18: { fr: 'Insuffisance rénale chronique', en: 'Chronic kidney disease', chap: 'XIV', service: 'NEPHRO' },
    S72: { fr: 'Fracture du col du fémur', en: 'Hip fracture', chap: 'XIX', service: 'ORTHO' },
    F03: { fr: 'Démence', en: 'Dementia', chap: 'V', service: 'GERIA' },
    I21: { fr: 'Infarctus du myocarde', en: 'Myocardial infarction', chap: 'IX', service: 'CARDIO' },
    K35: { fr: 'Appendicite aiguë', en: 'Acute appendicitis', chap: 'XI', service: 'CHIRDIG' },
  };
  const CHAP = { IV: { fr: 'IV · Endocrinien', en: 'IV · Endocrine' }, V: { fr: 'V · Troubles mentaux', en: 'V · Mental disorders' }, IX: { fr: 'IX · Circulatoire', en: 'IX · Circulatory' }, X: { fr: 'X · Respiratoire', en: 'X · Respiratory' }, XIV: { fr: 'XIV · Génito-urinaire', en: 'XIV · Genitourinary' }, XIX: { fr: 'XIX · Lésions traumatiques', en: 'XIX · Injuries' }, XI: { fr: 'XI · Digestif', en: 'XI · Digestive' } };
  const SERVICES = {
    CARDIO: { fr: 'Cardiologie', en: 'Cardiology', pole: 'MED', dms: 6 },
    PNEUMO: { fr: 'Pneumologie', en: 'Pulmonology', pole: 'MED', dms: 7 },
    ENDO: { fr: 'Endocrinologie', en: 'Endocrinology', pole: 'MED', dms: 4 },
    NEPHRO: { fr: 'Néphrologie', en: 'Nephrology', pole: 'MED', dms: 6 },
    GERIA: { fr: 'Gériatrie', en: 'Geriatrics', pole: 'GER', dms: 12 },
    ORTHO: { fr: 'Orthopédie', en: 'Orthopaedics', pole: 'CHIR', dms: 9 },
    CHIRDIG: { fr: 'Chirurgie digestive', en: 'Digestive surgery', pole: 'CHIR', dms: 3 },
  };
  const POLES = { MED: { fr: 'Pôle médecine', en: 'Medicine' }, GER: { fr: 'Pôle gériatrie', en: 'Geriatrics' }, CHIR: { fr: 'Pôle chirurgie', en: 'Surgery' } };
  // variantes de libellés envoyées par les sites (Véracité)
  const VARIANTES = { CARDIO: ['Cardiologie', 'cardio', 'CARDIOLOGIE ', 'Cardiolgie'], PNEUMO: ['Pneumologie', 'pneumo', 'Pneumo-logie', 'PNEUMOLOGIE'],
    ENDO: ['Endocrinologie', 'endoc', 'Endocrino', 'Endocrinologie '], NEPHRO: ['Néphrologie', 'Nephrologie', 'nephro', 'NEPHRO'],
    GERIA: ['Gériatrie', 'Geriatrie', 'geria', 'Gériatrie court séjour'], ORTHO: ['Orthopédie', 'Orthopedie', 'ortho', 'Chir. orthopédique'],
    CHIRDIG: ['Chirurgie digestive', 'chir dig', 'Chirurgie digestve', 'CHIRURGIE DIGESTIVE'] };
  const MEDS = { furosemide: 'Furosémide', bisoprolol: 'Bisoprolol', apixaban: 'Apixaban', metformine: 'Metformine', insuline: 'Insuline',
    amlodipine: 'Amlodipine', salbutamol: 'Salbutamol', amoxicilline: 'Amoxicilline', paracetamol: 'Paracétamol', enoxaparine: 'Énoxaparine', aspirine: 'Aspirine' };
  const PRESCRIPTION = { I50: [['furosemide', 0.9], ['bisoprolol', 0.6]], I48: [['apixaban', 0.85], ['bisoprolol', 0.5]], E11: [['metformine', 0.75], ['insuline', 0.35]],
    I10: [['amlodipine', 0.6]], J44: [['salbutamol', 0.85]], J18: [['amoxicilline', 0.85]], S72: [['paracetamol', 0.9], ['enoxaparine', 0.8]], N18: [], F03: [],
    I21: [['aspirine', 0.95], ['bisoprolol', 0.7]], K35: [['paracetamol', 0.9], ['amoxicilline', 0.6]] };
  const GLU_MGDL = 18.016;      // 1 mmol/L de glucose = 18,016 mg/dL
  const CREA_UMOL = 88.42;      // 1 mg/dL de créatinine = 88,42 µmol/L

  const J = 86400000, T0 = Date.UTC(2025, 0, 1), T1 = Date.UTC(2026, 9, 31);
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const jours = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / J);

  /* ---------- 1. Générateur : la « vérité » ---------- */
  function generer({ patients = 1500, graine = 2026 } = {}) {
    const h = Hasard(graine);
    const P = [], S = [];
    for (let i = 0; i < patients; i++) {
      const age = Math.round(20 + 76 * Math.pow(h.rand(), 0.62));
      const a = (age - 20) / 76;
      const sexe = h.bern(0.5) ? 'F' : 'M';
      const naissance = 2026 - age;
      const cond = [];
      if (h.bern(0.15 + 0.5 * a)) cond.push('I10');
      const diab = h.bern(0.07 + 0.22 * a); if (diab) cond.push('E11');
      if (h.bern(0.02 + 0.28 * a * a)) cond.push('I50');
      if (h.bern(0.01 + 0.22 * a * a)) cond.push('I48');
      if (h.bern(0.05 + 0.12 * a)) cond.push('J44');
      if (h.bern(0.02 + 0.12 * a * a + (diab ? 0.12 : 0))) cond.push('N18');
      if (h.bern(0.28 * a * a * a)) cond.push('F03');
      const ins = 'INS' + String(1000000 + Math.floor(h.rand() * 8999999)) + String(i).padStart(4, '0');
      const p = { ins, age, sexe, naissance, cond };
      P.push(p);
      // séjours : 1 + Poisson, réhospitalisation précoce plus probable si I50 / N18 / âge
      const lambda = 0.25 + 0.6 * a + (cond.includes('I50') ? 0.6 : 0) + (cond.includes('J44') ? 0.3 : 0);
      let nb = 1, L = Math.exp(-lambda), k = 0, pr = 1;
      do { k++; pr *= h.rand(); } while (pr > L); nb += k - 1;
      nb = Math.min(nb, 6);
      let t = T0 + h.rand() * (T1 - T0) * 0.75;
      for (let s = 0; s < nb && t < T1; s++) {
        // motif principal : une maladie du patient ou un épisode aigu
        const aigus = age < 45 ? ['K35', 'K35', 'J18'] : age < 70 ? ['K35', 'J18', 'I21'] : ['J18', 'S72', 'I21'];
        const chron = cond.filter((c) => c !== 'I10');
        const motif = chron.length && h.bern(0.8) ? h.choix(chron) : h.choix(aigus);
        const service = DIAG[motif].service;
        const dms = Math.max(1, Math.round(SERVICES[service].dms * Math.exp(0.45 * h.randn()) * (1 + 0.008 * (age - 60))));
        const entree = t, sortie = t + dms * J;
        const diags = [motif].concat(cond.filter((c) => c !== motif && h.bern(0.85)));
        const meds = [];
        diags.forEach((d) => PRESCRIPTION[d].forEach(([m, pm]) => { if (!meds.includes(m) && h.bern(pm)) meds.push(m); }));
        const glyc = +(diags.includes('E11') ? 9 + 2.4 * h.randn() : 5.4 + 0.6 * h.randn()).toFixed(1);
        const crea = Math.round(diags.includes('N18') ? 220 + 60 * h.randn() : 78 + 14 * h.randn());
        const site = h.rand() < 0.4 ? 'A' : h.rand() < 0.58 ? 'B' : 'C';
        S.push({ id: `S${String(S.length + 1).padStart(6, '0')}`, ins, age, sexe, naissance, service, entree: iso(entree), sortie: iso(sortie),
          dms, diags, meds, glyc: Math.max(2.5, glyc), crea: Math.max(35, crea), site, rh30: false });
        const precoce = h.bern(0.05 + 0.12 * a + (cond.includes('I50') ? 0.18 : 0) + (cond.includes('N18') ? 0.1 : 0));
        t = sortie + (precoce ? (3 + h.rand() * 27) : (35 + -Math.log(1 - h.rand()) * 140)) * J;
      }
    }
    // réhospitalisation à 30 jours (calculée sur les dates)
    const parPatient = {};
    S.forEach((s) => (parPatient[s.ins] = parPatient[s.ins] || []).push(s));
    Object.values(parPatient).forEach((l) => {
      l.sort((x, y) => x.entree.localeCompare(y.entree));
      for (let i = 0; i + 1 < l.length; i++) l[i].rh30 = jours(l[i].sortie, l[i + 1].entree) <= 30;
    });
    return { patients: P, sejours: S };
  }

  /* ---------- 2. Variété : chaque site envoie dans son format ---------- */
  const pad = (n, k = 2) => String(n).padStart(k, '0');
  const hl7date = (d) => d.replace(/-/g, '');
  function versHL7(s, libelle) {
    const seg = [
      `MSH|^~\\&|DPI_SITE_A|HOPITAL_A|ENTREPOT|REGION|${hl7date(s.sortie)}1200||ADT^A03|${s.id}|P|2.5`,
      `PID|1||${s.ins}^^^INS-NIR||ANONYME^PATIENT||${s.naissance}0101|${s.sexe}`,
      `PV1|1|I|${libelle}||||||||||||||||${s.id}|||||||||||||||||||||||||${hl7date(s.entree)}|${hl7date(s.sortie)}`,
    ];
    s.diags.forEach((d, i) => seg.push(`DG1|${i + 1}||${d}^${DIAG[d].fr}^I10||${hl7date(s.entree)}|${i === 0 ? 'A' : 'W'}`));
    s.meds.forEach((m, i) => seg.push(`RXE|${i + 1}|${m}^${MEDS[m]}`));
    seg.push(`OBX|1|NM|15074-8^Glucose^LN||${s.glyc}|mmol/L|||||F`);
    seg.push(`OBX|2|NM|14682-9^Creatinine^LN||${s.crea}|umol/L|||||F`);
    return seg.join('\r');
  }
  function versFHIR(s, libelle) {
    const ref = `Encounter/${s.id}`;
    return JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: [
      { resource: { resourceType: 'Patient', id: s.ins, identifier: [{ system: 'urn:oid:1.2.250.1.213.1.4.8', value: s.ins }], gender: s.sexe === 'F' ? 'female' : s.sexe === 'M' ? 'male' : undefined, birthDate: `${s.naissance}-01-01` } },
      { resource: { resourceType: 'Encounter', id: s.id, subject: { reference: `Patient/${s.ins}` }, serviceType: { text: libelle }, period: { start: s.entree, end: s.sortie } } },
      ...s.diags.map((d) => ({ resource: { resourceType: 'Condition', encounter: { reference: ref }, code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: d }] } } })),
      ...s.meds.map((m) => ({ resource: { resourceType: 'MedicationRequest', encounter: { reference: ref }, medicationCodeableConcept: { text: m } } })),
      { resource: { resourceType: 'Observation', encounter: { reference: ref }, code: { coding: [{ system: 'http://loinc.org', code: '15074-8' }] }, valueQuantity: { value: s.glyc, unit: 'mmol/L' } } },
      { resource: { resourceType: 'Observation', encounter: { reference: ref }, code: { coding: [{ system: 'http://loinc.org', code: '14682-9' }] }, valueQuantity: { value: s.crea, unit: 'umol/L' } } },
    ] });
  }
  const frDate = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const virg = (x, k) => x.toFixed(k).replace('.', ',');
  const ENTETE_CSV = 'ins;naissance;sexe;service;entree;sortie;id_sejour;diagnostics;traitements;glycemie_mg_dl;creatinine_mg_dl';
  function versCSV(s, libelle, glyMgdl, creaMgdl) {
    return [s.ins, s.naissance, s.sexe, libelle, frDate(s.entree), frDate(s.sortie), s.id, s.diags.join('|'), s.meds.join('|'),
      virg(glyMgdl, 1), virg(creaMgdl, 2)].join(';');
  }

  /* ---------- 3. Véracité : injection d'erreurs à l'envoi ---------- */
  // taux : { doublon, libelle, unite, aberrant, dates, manquant } (probabilités par séjour)
  function emettre(sejours, taux, graine = 7) {
    const h = Hasard(graine);
    const msgs = [];
    const verite = {};          // erreurs réellement injectées, pour mesurer la détection
    sejours.forEach((s0) => {
      const s = { ...s0, diags: [...s0.diags], meds: [...s0.meds] };
      const err = [];
      let libelle = SERVICES[s.service].fr;
      if (h.bern(taux.libelle || 0)) { libelle = h.choix(VARIANTES[s.service].slice(1)); err.push('libelle'); }
      if (h.bern(taux.aberrant || 0)) { if (h.bern(0.5)) s.glyc = h.choix([0, 0.3, 61, 95]); else s.naissance = 2026 - h.choix([131, 145, -2]); err.push('aberrant'); }
      if (h.bern(taux.dates || 0)) { const e = s.entree; s.entree = s.sortie; s.sortie = e; err.push('dates'); }
      if (h.bern(taux.manquant || 0)) { s.sexe = ''; err.push('manquant'); }
      let glyMgdl = s.glyc * GLU_MGDL, creaMgdl = s.crea / CREA_UMOL;
      if (s.site === 'C' && h.bern(taux.unite || 0)) { glyMgdl = s.glyc; err.push('unite'); }   // valeur en mmol/L dans la colonne mg/dL
      const texte = s.site === 'A' ? versHL7(s, libelle) : s.site === 'B' ? versFHIR(s, libelle) : versCSV(s, libelle, glyMgdl, creaMgdl);
      msgs.push({ site: s.site, texte });
      verite[s.id] = err;
      if (h.bern(taux.doublon || 0)) { msgs.push({ site: s.site, texte }); verite[s.id] = err.concat('doublon'); }
    });
    // les messages n'arrivent pas dans l'ordre
    for (let i = msgs.length - 1; i > 0; i--) { const k = Math.floor(h.rand() * (i + 1)); [msgs[i], msgs[k]] = [msgs[k], msgs[i]]; }
    return { msgs, verite };
  }

  /* ---------- 4. Lecture des trois formats vers un modèle commun ---------- */
  function lireHL7(txt) {
    const seg = txt.split(/\r|\n/).map((l) => l.split('|'));
    const get = (n) => seg.find((s) => s[0] === n);
    const pid = get('PID'), pv1 = get('PV1');
    const d8 = (x) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`;
    const obx = (code) => { const o = seg.find((s) => s[0] === 'OBX' && s[3].startsWith(code)); return o ? { v: parseFloat(o[5]), u: o[6] } : null; };
    const g = obx('15074-8'), c = obx('14682-9');
    return { format: 'HL7 v2', ins: pid[3].split('^')[0], naissance: +pid[7].slice(0, 4), sexe: pid[8] || '', serviceBrut: pv1[3], id: pv1[19],
      entree: d8(pv1[44]), sortie: d8(pv1[45]), diags: seg.filter((s) => s[0] === 'DG1').map((s) => s[3].split('^')[0]),
      meds: seg.filter((s) => s[0] === 'RXE').map((s) => s[2].split('^')[0]), glyc: g && g.v, glycUnite: g && g.u, crea: c && c.v, creaUnite: c && c.u };
  }
  function lireFHIR(txt) {
    const b = JSON.parse(txt), r = b.entry.map((e) => e.resource);
    const pat = r.find((x) => x.resourceType === 'Patient'), enc = r.find((x) => x.resourceType === 'Encounter');
    const obs = (code) => r.find((x) => x.resourceType === 'Observation' && x.code.coding[0].code === code);
    const g = obs('15074-8'), c = obs('14682-9');
    return { format: 'FHIR', ins: pat.identifier[0].value, naissance: +pat.birthDate.slice(0, 4), sexe: pat.gender === 'female' ? 'F' : pat.gender === 'male' ? 'M' : '',
      serviceBrut: enc.serviceType.text, id: enc.id, entree: enc.period.start, sortie: enc.period.end,
      diags: r.filter((x) => x.resourceType === 'Condition').map((x) => x.code.coding[0].code),
      meds: r.filter((x) => x.resourceType === 'MedicationRequest').map((x) => x.medicationCodeableConcept.text),
      glyc: g && g.valueQuantity.value, glycUnite: g && g.valueQuantity.unit, crea: c && c.valueQuantity.value, creaUnite: c && c.valueQuantity.unit };
  }
  function lireCSVLigne(l) {
    const c = l.split(';');
    const d = (x) => `${x.slice(6, 10)}-${x.slice(3, 5)}-${x.slice(0, 2)}`;
    const num = (x) => parseFloat(x.replace(',', '.'));
    return { format: 'CSV', ins: c[0], naissance: +c[1], sexe: c[2], serviceBrut: c[3], entree: d(c[4]), sortie: d(c[5]), id: c[6],
      diags: c[7] ? c[7].split('|') : [], meds: c[8] ? c[8].split('|') : [], glyc: num(c[9]), glycUnite: 'mg/dL', crea: num(c[10]), creaUnite: 'mg/dL' };
  }
  const lire = (m) => (m.site === 'A' ? lireHL7(m.texte) : m.site === 'B' ? lireFHIR(m.texte) : lireCSVLigne(m.texte));

  /* ---------- 5. Règles de qualité et nettoyage ---------- */
  function levenshtein(a, b) {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  // libellé brut → code de service (dictionnaire de synonymes, puis distance d'édition)
  const SYNONYMES = { cardio: 'CARDIO', pneumo: 'PNEUMO', endoc: 'ENDO', endocrino: 'ENDO', nephro: 'NEPHRO', geria: 'GERIA', ortho: 'ORTHO', chirorthopedique: 'ORTHO', geriatriecourtsejour: 'GERIA', chirdig: 'CHIRDIG' };
  function normaliserService(brut) {
    const k = sansAccent(brut || '');
    for (const [code, s] of Object.entries(SERVICES)) if (sansAccent(s.fr) === k) return { code, regle: brut === s.fr ? null : 'libelle' };
    if (SYNONYMES[k]) return { code: SYNONYMES[k], regle: 'libelle' };
    let best = null, dist = 99;
    for (const [code, s] of Object.entries(SERVICES)) { const d = levenshtein(k, sansAccent(s.fr)); if (d < dist) { dist = d; best = code; } }
    return dist <= 1 ? { code: best, regle: 'libelle' } : { code: null, regle: 'libelle' };
  }

  // nettoie une liste de messages ; renvoie les séjours propres, les rejets et le rapport
  function nettoyer(msgs) {
    const vus = new Set(), propres = [], rejets = [], journal = [];
    const compte = { recus: msgs.length, doublon: 0, libelle: 0, unite: 0, aberrant: 0, dates: 0, manquant: 0, illisible: 0 };
    const parSite = { A: { recus: 0, problemes: 0 }, B: { recus: 0, problemes: 0 }, C: { recus: 0, problemes: 0 } };
    for (const m of msgs) {
      parSite[m.site].recus++;
      let r;
      try { r = lire(m); } catch (e) { compte.illisible++; parSite[m.site].problemes++; rejets.push({ site: m.site, motif: 'illisible' }); continue; }
      const cle = r.id;
      if (vus.has(cle)) { compte.doublon++; parSite[m.site].problemes++; journal.push({ id: r.id, regle: 'doublon' }); continue; }
      vus.add(cle);
      const pb = [];
      // unités : tout passer en mmol/L et µmol/L
      let glyc = r.glyc, crea = r.crea;
      if (r.glycUnite === 'mg/dL') {
        if (glyc < 30) { pb.push('unite'); }           // < 30 mg/dL impossible chez un patient vivant : valeur déjà en mmol/L
        else glyc = glyc / GLU_MGDL;
      }
      if (r.creaUnite === 'mg/dL') crea = crea * CREA_UMOL;
      glyc = Math.round(glyc * 10) / 10; crea = Math.round(crea);
      // libellé de service
      const ns = normaliserService(r.serviceBrut);
      if (ns.regle) pb.push('libelle');
      // valeurs impossibles
      const age = 2026 - r.naissance;
      if (!(glyc >= 1 && glyc <= 50) || !(age >= 0 && age <= 120)) pb.push('aberrant');
      // dates
      let entree = r.entree, sortie = r.sortie;
      if (sortie < entree) { pb.push('dates'); [entree, sortie] = [sortie, entree]; }
      if (!r.sexe) pb.push('manquant');
      pb.forEach((p) => { compte[p]++; journal.push({ id: r.id, regle: p }); });
      if (pb.length) parSite[m.site].problemes++;
      const glycOk = glyc >= 1 && glyc <= 50, ageOk = age >= 0 && age <= 120;
      if (!ns.code) { rejets.push({ site: m.site, motif: 'service inconnu', id: r.id }); continue; }
      const sej = { id: r.id, ins: r.ins, naissance: r.naissance, age: ageOk ? age : null, sexe: r.sexe || null, service: ns.code,
        serviceBrut: r.serviceBrut, entree, sortie, dms: jours(entree, sortie), diags: r.diags, meds: r.meds, site: m.site,
        glyc: glycOk ? glyc : null, crea, format: r.format, problemes: pb };
      propres.push(sej);
    }
    return { propres, rejets, compte, parSite, journal };
  }
  // sans nettoyage : on prend tout tel quel (doublons compris, unités non converties)
  function brut(msgs) {
    return msgs.map((m) => { const r = lire(m); return { ...r, service: normaliserService(r.serviceBrut).regle ? null : normaliserService(r.serviceBrut).code,
      age: 2026 - r.naissance, dms: jours(r.entree, r.sortie), site: m.site }; });
  }
  // détection : rappel par type d'erreur (part des erreurs injectées retrouvées)
  function evaluerDetection(verite, rapport) {
    const trouve = {};
    rapport.journal.forEach((j) => { (trouve[j.id] = trouve[j.id] || new Set()).add(j.regle); });
    const res = {};
    ['doublon', 'libelle', 'unite', 'aberrant', 'dates', 'manquant'].forEach((k) => {
      let inj = 0, det = 0;
      Object.entries(verite).forEach(([id, e]) => { if (e.includes(k)) { inj++; if (trouve[id] && trouve[id].has(k)) det++; } });
      let fp = 0;
      Object.entries(trouve).forEach(([id, s]) => { if (s.has(k) && !(verite[id] || []).includes(k)) fp++; });
      res[k] = { injectees: inj, detectees: det, rappel: inj ? det / inj : 1, fauxPositifs: fp };
    });
    return res;
  }

  /* ---------- 6. Entrepôt : réhospitalisations, pseudonymisation, étoile ---------- */
  // FNV-1a 64 bits salé (démonstration ; en production : HMAC-SHA-256 avec une clé gardée à part)
  function pseudonyme(ins, sel) {
    let h1 = 0x811c9dc5 ^ sel, h2 = 0x01000193 ^ (sel * 31);
    const s = ins + '#' + sel;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ (c + i), 2246822519); }
    return 'P' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  const tranche = (age) => (age == null ? '?' : age < 45 ? '18–44' : age < 65 ? '45–64' : age < 75 ? '65–74' : age < 85 ? '75–84' : '85+');
  const TRANCHES = ['18–44', '45–64', '65–74', '75–84', '85+', '?'];
  function construireEntrepot(sejours, sel = 4242) {
    const valides = sejours.filter((s) => s.service);
    const parP = {};
    valides.forEach((s) => (parP[s.ins] = parP[s.ins] || []).push(s));
    const rh = {};
    Object.values(parP).forEach((l) => { l.sort((a, b) => a.entree.localeCompare(b.entree)); for (let i = 0; i < l.length; i++) rh[l[i].id] = i + 1 < l.length && jours(l[i].sortie, l[i + 1].entree) <= 30; });
    const dimPatient = new Map(), faits = [], pont = [];
    valides.forEach((s) => {
      const pk = pseudonyme(s.ins, sel);
      if (!dimPatient.has(pk)) dimPatient.set(pk, { patient_k: pk, sexe: s.sexe || '?', tranche: tranche(s.age), naissance: s.naissance });
      const d = s.entree;
      faits.push({ sejour_k: s.id, patient_k: pk, sexe: s.sexe || '?', tranche: tranche(s.age), annee: d.slice(0, 4), trimestre: `${d.slice(0, 4)}-T${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}`, mois: d.slice(0, 7),
        service: s.service, pole: SERVICES[s.service].pole, dp: s.diags[0] || '?', chap: s.diags[0] && DIAG[s.diags[0]] ? DIAG[s.diags[0]].chap : '?',
        dms: s.dms, rh30: rh[s.id] ? 1 : 0, glyc: s.glyc, crea: s.crea, nbDiag: s.diags.length, nbMed: s.meds.length });
      s.diags.forEach((c) => pont.push({ sejour_k: s.id, diag: c }));
    });
    return { faits, dimPatient: [...dimPatient.values()], pont };
  }

  /* ---------- 7. Cube OLAP ---------- */
  // dimensions et leurs niveaux (du plus agrégé au plus fin)
  const DIMS = {
    temps: ['annee', 'trimestre', 'mois'],
    service: ['pole', 'service'],
    diagnostic: ['chap', 'dp'],
    patient: ['sexe', 'tranche'],
  };
  const MESURES = {
    sejours: { agg: (l) => l.length },
    dms: { agg: (l) => l.reduce((s, f) => s + f.dms, 0) / l.length },
    rh30: { agg: (l) => l.reduce((s, f) => s + f.rh30, 0) / l.length },
    glyc: { agg: (l) => { const v = l.filter((f) => f.glyc != null); return v.length ? v.reduce((s, f) => s + f.glyc, 0) / v.length : NaN; } },
  };
  // filtres : { attribut: valeur } (slice / dice)
  function cube(faits, { lignes, colonnes, mesure = 'sejours', filtres = {} }) {
    const f = faits.filter((x) => Object.entries(filtres).every(([k, v]) => x[k] === v));
    const vals = (attr) => (attr ? [...new Set(f.map((x) => x[attr]))].sort() : ['Total']);
    const L = vals(lignes), C = vals(colonnes);
    const groupes = new Map();
    f.forEach((x) => { const k = (lignes ? x[lignes] : 'Total') + '\u0001' + (colonnes ? x[colonnes] : 'Total'); if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(x); });
    const agg = MESURES[mesure].agg;
    const cell = (l, c) => { const g = groupes.get(l + '\u0001' + c); return g ? agg(g) : null; };
    const totL = (l) => { const g = f.filter((x) => (lignes ? x[lignes] : 'Total') === l); return g.length ? agg(g) : null; };
    const totC = (c) => { const g = f.filter((x) => (colonnes ? x[colonnes] : 'Total') === c); return g.length ? agg(g) : null; };
    return { lignes: L, colonnes: C, valeurs: L.map((l) => C.map((c) => cell(l, c))), totLignes: L.map(totL), totColonnes: C.map(totC), total: f.length ? agg(f) : null, n: f.length };
  }
  // requête SQL équivalente (affichée)
  function sql({ lignes, colonnes, mesure, filtres = {} }) {
    const colSQL = { annee: 'EXTRACT(YEAR FROM t.date)', trimestre: "t.trimestre", mois: "t.mois", pole: 's.pole', service: 's.libelle', chap: 'd.chapitre', dp: 'd.code_cim10', sexe: 'p.sexe', tranche: 'p.tranche_age' };
    const m = { sejours: 'COUNT(*) AS nb_sejours', dms: 'AVG(f.duree_jours) AS dms', rh30: 'AVG(f.rehospit_30j) AS taux_rh30', glyc: 'AVG(f.glycemie_mmol) AS glycemie_moy' }[mesure];
    const g = [lignes, colonnes].filter(Boolean).map((a) => colSQL[a]);
    const w = Object.entries(filtres).map(([k, v]) => `${colSQL[k]} = '${v}'`);
    return `SELECT ${g.length ? g.join(', ') + ', ' : ''}${m}\nFROM fait_sejour f\n  JOIN dim_temps t      ON f.date_entree_k = t.date_k\n  JOIN dim_service s    ON f.service_k = s.service_k\n  JOIN dim_diagnostic d ON f.dp_k = d.diag_k\n  JOIN dim_patient p    ON f.patient_k = p.patient_k`
      + (w.length ? `\nWHERE ${w.join('\n  AND ')}` : '') + (g.length ? `\nGROUP BY ROLLUP (${g.join(', ')})` : '') + ';';
  }

  /* ---------- 8. NoSQL : un patient en document / en lignes ---------- */
  function document(sejours, ins) {
    const l = sejours.filter((s) => s.ins === ins).sort((a, b) => a.entree.localeCompare(b.entree));
    if (!l.length) return null;
    const p = l[0];
    return { _id: ins, naissance: p.naissance, sexe: p.sexe, sejours: l.map((s) => ({ id: s.id, service: s.service, entree: s.entree, sortie: s.sortie,
      diagnostics: s.diags, traitements: s.meds, biologie: { glycemie_mmol_l: s.glyc, creatinine_umol_l: s.crea } })) };
  }
  function lignesSQL(doc) {
    if (!doc) return null;
    return {
      patient: [{ ins: doc._id, naissance: doc.naissance, sexe: doc.sexe }],
      sejour: doc.sejours.map((s) => ({ id: s.id, ins: doc._id, service: s.service, entree: s.entree, sortie: s.sortie })),
      diagnostic: doc.sejours.flatMap((s) => s.diagnostics.map((d) => ({ sejour: s.id, cim10: d }))),
      traitement: doc.sejours.flatMap((s) => s.traitements.map((m) => ({ sejour: s.id, medicament: m }))),
      biologie: doc.sejours.flatMap((s) => [{ sejour: s.id, loinc: '15074-8', valeur: s.biologie.glycemie_mmol_l }, { sejour: s.id, loinc: '14682-9', valeur: s.biologie.creatinine_umol_l }]),
    };
  }

  /* ---------- 9. MapReduce réparti ---------- */
  // compte des diagnostics par service, sur `noeuds` nœuds et `reducteurs` réducteurs
  function hachage(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function mapReduce(sejours, { noeuds = 4, reducteurs = 3, combiner = true } = {}) {
    const parts = Array.from({ length: noeuds }, () => []);
    sejours.forEach((s) => parts[hachage(s.id) % noeuds].push(s));        // répartition des données (sharding)
    const etapes = parts.map((p) => {
      const emis = [];
      p.forEach((s) => s.diags.forEach((d) => emis.push([`${s.service}|${d}`, 1])));     // map
      let sortie = emis;
      if (combiner) { const m = new Map(); emis.forEach(([k, v]) => m.set(k, (m.get(k) || 0) + v)); sortie = [...m.entries()]; }  // combiner local
      const envois = Array.from({ length: reducteurs }, () => []);
      sortie.forEach((kv) => envois[hachage(kv[0]) % reducteurs].push(kv));               // partition / shuffle
      return { lignes: p.length, emis: emis.length, sortie: sortie.length, envois: envois.map((e) => e.length), paires: envois };
    });
    const red = Array.from({ length: reducteurs }, (_, r) => {
      const m = new Map();
      etapes.forEach((e) => e.paires[r].forEach(([k, v]) => m.set(k, (m.get(k) || 0) + v)));   // reduce
      return m;
    });
    const resultat = new Map();
    red.forEach((m) => m.forEach((v, k) => resultat.set(k, v)));
    const echanges = etapes.reduce((s, e) => s + e.sortie, 0);
    return { etapes: etapes.map(({ paires, ...r }) => r), reducteurs: red.map((m) => ({ cles: m.size, total: [...m.values()].reduce((a, b) => a + b, 0) })), resultat, echanges };
  }
  function compteDirect(sejours) { const m = new Map(); sejours.forEach((s) => s.diags.forEach((d) => { const k = `${s.service}|${d}`; m.set(k, (m.get(k) || 0) + 1); })); return m; }

  /* ---------- 10. Fouille : k-means, ACP, silhouette ---------- */
  function profils(faits) {
    const m = new Map();
    faits.forEach((f) => {
      const p = m.get(f.patient_k) || { k: f.patient_k, nb: 0, dms: 0, rh: 0, diag: 0, tranche: f.tranche, glyc: [], age: null };
      p.nb++; p.dms += f.dms; p.rh += f.rh30; p.diag = Math.max(p.diag, f.nbDiag); if (f.glyc != null) p.glyc.push(f.glyc);
      m.set(f.patient_k, p);
    });
    return [...m.values()].map((p) => ({ k: p.k, tranche: p.tranche, nb: p.nb, dmsMoy: p.dms / p.nb, joursTotal: p.dms, rh: p.rh, diag: p.diag,
      glyc: p.glyc.length ? p.glyc.reduce((a, b) => a + b, 0) / p.glyc.length : 5.5 }));
  }
  const VARS = ['nb', 'dmsMoy', 'diag', 'glyc', 'rh'];
  function standardiser(X) {
    const d = X[0].length, mu = Array(d).fill(0), sd = Array(d).fill(0);
    X.forEach((x) => x.forEach((v, j) => (mu[j] += v / X.length)));
    X.forEach((x) => x.forEach((v, j) => (sd[j] += (v - mu[j]) ** 2 / X.length)));
    sd.forEach((v, j) => (sd[j] = Math.sqrt(v) || 1));
    return { Z: X.map((x) => x.map((v, j) => (v - mu[j]) / sd[j])), mu, sd };
  }
  const d2 = (a, b) => a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0);
  function kmeans(Z, k, graine = 1, iterMax = 100) {
    const h = Hasard(graine), n = Z.length;
    const C = [Z[Math.floor(h.rand() * n)].slice()];                  // k-means++
    while (C.length < k) {
      const D = Z.map((z) => Math.min(...C.map((c) => d2(z, c))));
      const tot = D.reduce((a, b) => a + b, 0); let r = h.rand() * tot, i = 0;
      while (i < n - 1 && (r -= D[i]) > 0) i++;
      C.push(Z[i].slice());
    }
    let lab = new Array(n).fill(-1), iter = 0;
    for (; iter < iterMax; iter++) {
      let change = false;
      Z.forEach((z, i) => { let b = 0, bd = Infinity; C.forEach((c, j) => { const dd = d2(z, c); if (dd < bd) { bd = dd; b = j; } }); if (lab[i] !== b) { lab[i] = b; change = true; } });
      C.forEach((c, j) => { const m = Z.filter((_, i) => lab[i] === j); if (m.length) c.forEach((_, t) => (c[t] = m.reduce((s, z) => s + z[t], 0) / m.length)); });
      if (!change) break;
    }
    const inertie = Z.reduce((s, z, i) => s + d2(z, C[lab[i]]), 0);
    return { labels: lab, centres: C, inertie, iter };
  }
  // silhouette moyenne (sur un échantillon pour rester rapide)
  function silhouette(Z, lab, k, max = 500) {
    const idx = Z.map((_, i) => i).filter((i) => i % Math.max(1, Math.floor(Z.length / max)) === 0);
    let s = 0, n = 0;
    idx.forEach((i) => {
      const moy = Array(k).fill(0), cnt = Array(k).fill(0);
      idx.forEach((j) => { if (j !== i) { moy[lab[j]] += Math.sqrt(d2(Z[i], Z[j])); cnt[lab[j]]++; } });
      const a = cnt[lab[i]] ? moy[lab[i]] / cnt[lab[i]] : 0;
      let b = Infinity; for (let c = 0; c < k; c++) if (c !== lab[i] && cnt[c]) b = Math.min(b, moy[c] / cnt[c]);
      if (Number.isFinite(b)) { s += (b - a) / Math.max(a, b); n++; }
    });
    return n ? s / n : 0;
  }
  // ACP à 2 composantes (puissance itérée sur la matrice de covariance)
  function acp2(Z) {
    const d = Z[0].length, Cv = Array.from({ length: d }, () => Array(d).fill(0));
    Z.forEach((z) => { for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) Cv[i][j] += z[i] * z[j] / Z.length; });
    const comps = [], vals = [];
    let M = Cv.map((r) => r.slice());
    for (let c = 0; c < 2; c++) {
      let v = Array(d).fill(1).map((x, i) => x + i * 0.1);
      for (let it = 0; it < 500; it++) { const w = M.map((r) => r.reduce((s, x, j) => s + x * v[j], 0)); const nn = Math.hypot(...w) || 1; v = w.map((x) => x / nn); }
      const lam = v.reduce((s, x, i) => s + x * M[i].reduce((t, y, j) => t + y * v[j], 0), 0);
      comps.push(v); vals.push(lam);
      M = M.map((r, i) => r.map((x, j) => x - lam * v[i] * v[j]));
    }
    const tr = Cv.reduce((s, r, i) => s + r[i], 0);
    return { comps, vals, part: vals.map((l) => l / tr), proj: Z.map((z) => comps.map((v) => z.reduce((s, x, j) => s + x * v[j], 0))) };
  }

  /* ---------- 11. Fouille : règles d'association (Apriori) ---------- */
  function transactions(faits, sejours) {
    const parId = new Map(sejours.map((s) => [s.id, s]));
    return faits.map((f) => { const s = parId.get(f.sejour_k); return [...new Set([...s.diags, ...s.meds.map((m) => 'm:' + m)])].sort(); });
  }
  function apriori(T, minSup, minConf) {
    const n = T.length, sets = T.map((t) => new Set(t));
    const support = new Map();
    const cle = (items) => items.join(',');
    const compter = (items) => sets.reduce((s, t) => s + (items.every((i) => t.has(i)) ? 1 : 0), 0);
    let Lk = [...new Set(T.flat())].sort().map((i) => [i]).filter((it) => { const c = compter(it); if (c / n >= minSup) { support.set(cle(it), c); return true; } return false; });
    const frequents = [...Lk];
    while (Lk.length) {
      const cand = new Map();
      for (let a = 0; a < Lk.length; a++) for (let b = a + 1; b < Lk.length; b++) {
        const x = Lk[a], y = Lk[b];
        if (x.slice(0, -1).join() !== y.slice(0, -1).join()) continue;
        const c = [...x, y[y.length - 1]].sort();
        // élagage : tous les sous-ensembles doivent être fréquents
        if (c.every((_, i) => support.has(cle(c.filter((__, j) => j !== i))))) cand.set(cle(c), c);
      }
      Lk = [...cand.values()].filter((it) => { const c = compter(it); if (c / n >= minSup) { support.set(cle(it), c); return true; } return false; });
      frequents.push(...Lk);
    }
    const regles = [];
    frequents.filter((f) => f.length >= 2).forEach((f) => {
      const sf = support.get(cle(f));
      const k = f.length;
      for (let mask = 1; mask < (1 << k) - 1; mask++) {
        const A = f.filter((_, i) => mask & (1 << i)), B = f.filter((_, i) => !(mask & (1 << i)));
        const sA = support.get(cle(A)), sB = support.get(cle(B));
        const conf = sf / sA;
        if (conf >= minConf) regles.push({ si: A, alors: B, support: sf / n, confiance: conf, lift: conf / (sB / n), n: sf });
      }
    });
    regles.sort((a, b) => b.lift - a.lift || b.confiance - a.confiance);
    return { frequents: frequents.map((f) => ({ items: f, support: support.get(cle(f)) / n })), regles, n };
  }

  /* ---------- 12. Vélocité : flux des moniteurs ---------- */
  // état : file d'attente, horloge, fenêtres de 10 s par lit, alertes
  function nouveauFlux({ lits = 300, hz = 1, signaux = 2, octets = 60, capacite = 2000, desat = 0.02, graine = 5 } = {}) {
    const h = Hasard(graine);
    const patients = Array.from({ length: lits }, (_, i) => ({ fc: 70 + 12 * h.randn(), spo2: 97 + h.randn(), desat: h.rand() < desat, debut: 5 + h.rand() * 40 }));
    return { h, lits, hz, signaux, octets, capacite, t: 0, file: [], recus: 0, traites: 0, octetsTotal: 0, patients, fen: patients.map(() => []), alertes: [], retard: 0, histo: [] };
  }
  function pasFlux(F, dt) {
    const n = F.lits * F.hz * dt;                      // mesures produites pendant dt (par signal)
    let k = Math.floor(n); if (F.h.rand() < n - k) k++;
    for (let e = 0; e < k; e++) {
      const lit = Math.floor(F.h.rand() * F.lits), p = F.patients[lit];
      const ts = F.t + F.h.rand() * dt;
      const spo2 = p.desat && ts > p.debut ? 86 + 1.5 * F.h.randn() : p.spo2 + 0.8 * F.h.randn();
      F.file.push({ lit, ts, fc: p.fc + 4 * F.h.randn(), spo2 });
    }
    F.recus += k * F.signaux;
    F.octetsTotal += k * F.signaux * F.octets;
    F.t += dt;
    // traitement : capacité en mesures par seconde (tous signaux confondus)
    const avant = F.traites;
    let budget = Math.floor(F.capacite * dt / F.signaux);
    let retardMax = 0;
    while (budget-- > 0 && F.file.length) {
      const ev = F.file.shift();
      retardMax = Math.max(retardMax, F.t - ev.ts);
      const w = F.fen[ev.lit];
      w.push(ev);
      while (w.length && w[0].ts < ev.ts - 10) w.shift();             // fenêtre glissante de 10 s
      const moy = w.reduce((s, x) => s + x.spo2, 0) / w.length;
      if (w.length >= 3 && moy < 90 && !F.alertes.some((a) => a.lit === ev.lit)) F.alertes.push({ lit: ev.lit, ts: ev.ts, detectee: F.t, spo2: moy });
      F.traites += F.signaux;
    }
    F.retard = F.file.length ? F.t - F.file[0].ts : 0;
    F.histo.push({ t: F.t, entree: k * F.signaux / dt, sortie: (F.traites - avant) / dt, file: F.file.length * F.signaux, retard: F.retard });
    if (F.histo.length > 600) F.histo.shift();
    return F;
  }
  // volume théorique
  const volume = ({ lits, hz, signaux, octets }) => { const parS = lits * hz * signaux * octets; return { parSeconde: parS, parJour: parS * 86400, parAn: parS * 86400 * 365 }; };

  const api = { Hasard, DIAG, CHAP, SERVICES, POLES, MEDS, VARIANTES, GLU_MGDL, CREA_UMOL, TRANCHES, DIMS, MESURES, ENTETE_CSV,
    generer, versHL7, versFHIR, versCSV, emettre, lireHL7, lireFHIR, lireCSVLigne, lire, levenshtein, normaliserService, nettoyer, brut, evaluerDetection,
    pseudonyme, tranche, construireEntrepot, cube, sql, document, lignesSQL, mapReduce, compteDirect, hachage,
    profils, VARS, standardiser, kmeans, silhouette, acp2, transactions, apriori, nouveauFlux, pasFlux, volume, jours };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Entrepot = api;
})(typeof window !== 'undefined' ? window : this);
