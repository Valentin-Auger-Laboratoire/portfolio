// =====================================================================
//  Portage JavaScript de la logique des projets Python du module IHM
//  (dépôt projets-episen). Mêmes règles, mêmes messages, mêmes formats
//  d'affichage que le code PyQt ; seule l'interface est en HTML.
// =====================================================================
(function (root) {
  'use strict';

  // ---------------- 1. Suivi médical (V1 et V2) ----------------
  // V1 : liste de chaînes "( ) action" / "[X] action", pas de message d'erreur.
  function SuiviV1() {
    const items = [];
    return {
      items,
      ajouter(txt) { if (txt) { items.push('( ) ' + txt); return { ok: true }; } return { ok: false, silent: true }; },
      terminer(i) { if (i >= 0 && i < items.length) { items[i] = items[i].replace('( )', '[X]'); return { ok: true }; } return { ok: false, silent: true }; },
      supprimer(i) { if (i >= 0 && i < items.length) { items.splice(i, 1); return { ok: true }; } return { ok: false, silent: true }; },
      exporter: () => JSON.stringify(items),
      importer(json) { items.splice(0, items.length, ...JSON.parse(json)); },
      affichage: () => items.map((text, index) => ({ text, index })),
    };
  }
  // V2 : données {action, terminee}, validation, confirmation, filtre.
  function SuiviV2() {
    const donnees = [];
    return {
      donnees,
      ajouter(txt) {
        const texte = String(txt || '').trim();
        if (!texte) return { ok: false, dialog: 'warning', title: 'Erreur de saisie', msg: "L'action ne peut pas être vide." };
        donnees.push({ action: texte, terminee: false });
        return { ok: true };
      },
      terminer(i) {
        if (i >= 0 && i < donnees.length) { donnees[i].terminee = true; return { ok: true }; }
        return { ok: false, dialog: 'info', title: 'Info', msg: 'Veuillez sélectionner une action.' };
      },
      demanderSuppression(i) { return i >= 0 && i < donnees.length ? { ok: true, dialog: 'question', title: 'Confirmation', msg: 'Voulez-vous vraiment supprimer cette action ?' } : { ok: false, silent: true }; },
      supprimer(i) { donnees.splice(i, 1); return { ok: true }; },
      exporter: () => JSON.stringify(donnees),
      importer(json) { donnees.splice(0, donnees.length, ...JSON.parse(json)); },
      // filtre : 0 = toutes, 1 = à faire, 2 = terminées (garde l'indice d'origine pour les actions)
      affichage(filtre) {
        return donnees.map((d, index) => ({ text: (d.terminee ? '[X] ' : '( ) ') + d.action, index, done: d.terminee }))
          .filter((x) => filtre === 1 ? !x.done : filtre === 2 ? x.done : true);
      },
    };
  }

  // ---------------- 2. Salle d'attente : modèle, MVP, MVVM ----------------
  class Patient { constructor(nom, age, motif) { this.nom = nom; this.age = age; this.motif = motif; } }
  class PatientRepository {
    constructor() { this.patients = []; }
    add_patient(p) { this.patients.push(p); }
    remove_patient(i) { if (i >= 0 && i < this.patients.length) this.patients.splice(i, 1); }
    get_all_patients() { return this.patients.slice(); }
  }
  const display = (ps) => ps.map((p) => `${p.nom} - ${p.age} ans - ${p.motif}`);

  // MVP : le Presenter lit la vue, valide, met à jour le modèle puis pousse l'affichage dans la vue (passive).
  class PatientPresenter {
    constructor(model, view, log) { this.model = model; this.view = view; this.log = log || (() => {}); this.refresh_view(); }
    handle_add_patient() {
      this.log('Presenter.handle_add_patient()');
      const [nom, age, motif] = this.view.get_patient_input();
      this.log('  ← view.get_patient_input() = ' + JSON.stringify([nom, age, motif]));
      if (!nom || !motif) { this.view.set_message('Erreur : Nom et Motif requis', 'red'); this.log('  → view.set_message(erreur)'); return; }
      if (age <= 0) { this.view.set_message("Erreur : L'âge doit être > 0", 'red'); this.log('  → view.set_message(erreur)'); return; }
      this.model.add_patient(new Patient(nom, age, motif)); this.log('  → model.add_patient(Patient)');
      this.view.clear_inputs(); this.view.set_message(`Patient ${nom} ajouté !`, 'green'); this.log('  → view.clear_inputs(), view.set_message(succès)');
      this.refresh_view();
    }
    handle_remove_patient() {
      this.log('Presenter.handle_remove_patient()');
      const i = this.view.get_selected_index(); this.log('  ← view.get_selected_index() = ' + i);
      if (i >= 0) { this.model.remove_patient(i); this.log('  → model.remove_patient(' + i + ')'); this.refresh_view(); }
      else { this.view.set_message('Veuillez sélectionner un patient', 'orange'); this.log('  → view.set_message(avertissement)'); }
    }
    refresh_view() { const l = display(this.model.get_all_patients()); this.view.set_patients(l); this.log('  → view.set_patients(' + l.length + ' éléments)'); }
  }

  // MVVM : la vue appelle le ViewModel, qui émet des signaux auxquels la vue est abonnée.
  class Signal { constructor() { this.slots = []; } connect(f) { this.slots.push(f); } emit(...a) { this.slots.forEach((f) => f(...a)); } }
  class PatientViewModel {
    constructor(repo, log) { this.repository = repo; this.log = log || (() => {}); this.patients_changed = new Signal(); this.message_changed = new Signal(); }
    add_patient(nom, age, motif) {
      this.log(`ViewModel.add_patient(${JSON.stringify(nom)}, ${age}, ${JSON.stringify(motif)})`);
      if (!nom || !motif) { this.log('  ⇢ émet message_changed("Erreur : Champs vides", "red")'); this.message_changed.emit('Erreur : Champs vides', 'red'); return; }
      if (age <= 0) { this.log('  ⇢ émet message_changed("Erreur : Âge invalide", "red")'); this.message_changed.emit('Erreur : Âge invalide', 'red'); return; }
      this.repository.add_patient(new Patient(nom, age, motif)); this.log('  → repository.add_patient(Patient)');
      this.log(`  ⇢ émet message_changed("Patient ${nom} ajouté !", "green")`); this.message_changed.emit(`Patient ${nom} ajouté !`, 'green');
      this.refresh();
    }
    remove_patient(i) {
      this.log('ViewModel.remove_patient(' + i + ')');
      if (i >= 0) { this.repository.remove_patient(i); this.log('  → repository.remove_patient(' + i + ')'); this.refresh(); }
      else { this.log('  ⇢ émet message_changed("Sélectionnez un patient", "orange")'); this.message_changed.emit('Sélectionnez un patient', 'orange'); }
    }
    refresh() { const l = display(this.repository.get_all_patients()); this.log('  ⇢ émet patients_changed(' + l.length + ' éléments)'); this.patients_changed.emit(l); }
  }

  // ---------------- 3. Monitoring de patients ----------------
  class InvalidPatientDataError extends Error {}
  const PATTERN = /^ID:(?<patient_id>\d+);NAME:(?<name>[^;]+);HR:(?<heart_rate>\d+);TEMP:(?<temperature>\d+(?:\.\d+)?);STATUS:(?<status>\w+)$/;
  function parse_line(line) {
    line = line.trim();
    const m = PATTERN.exec(line);
    if (!m) throw new InvalidPatientDataError('Ligne mal formée : ' + line);
    const g = m.groups;
    return { patient_id: parseInt(g.patient_id, 10), name: g.name, heart_rate: parseInt(g.heart_rate, 10), temperature: parseFloat(g.temperature), status: g.status };
  }
  function load_data(text) {
    const out = [];
    text.split(/\r?\n/).forEach((line, k) => {
      if (!line.trim()) return;
      try { out.push(parse_line(line)); } catch (e) { throw new InvalidPatientDataError('Ligne ' + (k + 1) + ' : ' + e.message); }
    });
    return out;
  }
  const pyFloat = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  class MonitoredPatient {
    constructor(d) { Object.assign(this, d); }
    is_critical() { return this.heart_rate > 100 || this.temperature > 38.5; }
    toString() { return `Patient ${this.patient_id} - ${this.name} | HR: ${this.heart_rate} bpm | TEMP: ${pyFloat(this.temperature)} °C | STATUS: ${this.status}`; }
  }
  function analyze(text) {
    const patients = load_data(text).map((d) => { const p = new MonitoredPatient(d); p.status = p.is_critical() ? 'ALERT' : 'OK'; return p; });
    return [patients, patients.filter((p) => p.is_critical())];
  }
  function report(patients, critical) {
    let out = 'Tous les patients :\n' + patients.map(String).join('\n');
    out += '\n\nPatients critiques :\n' + (critical.length ? critical.map(String).join('\n') : 'Aucun patient critique détecté.');
    return out;
  }

  // ---------------- 4. Web scraping (sur une page d'exemple) ----------------
  // Partie 1 : page statique, titres de section h2
  function extraireSections(doc) {
    return [...doc.querySelectorAll('h2')].map((s) => s.textContent.replace('[modifier | modifier le code]', '').trim())
      .filter(Boolean).map((titre) => ({ titre, info: 'Section Wikipedia' }));
  }
  // Parties 2 et 5 : cartes d'offres div.job_seen_beacon, extraction robuste
  function extraireJobs(doc) {
    const cards = [...doc.querySelectorAll('div.job_seen_beacon')];
    const data = [], ignorees = [];
    cards.forEach((card, i) => {
      const titre = card.querySelector('h2.jobTitle'), ent = card.querySelector('span[data-testid="company-name"]'), lieu = card.querySelector('div[data-testid="text-location"]');
      if (!titre || !ent || !lieu) { ignorees.push(i + 1); return; }   // except AttributeError: continue
      data.push({ 'intitulé': titre.textContent.trim(), entreprise: ent.textContent.trim(), localisation: lieu.textContent.trim() });
    });
    return { cards: cards.length, data, ignorees };
  }
  function toCsv(rows) {
    if (!rows.length) return '';
    const keys = Object.keys(rows[0]);
    const q = (v) => (/[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
    return [keys.join(','), ...rows.map((r) => keys.map((k) => q(r[k])).join(','))].join('\r\n') + '\r\n';
  }

  const api = { SuiviV1, SuiviV2, Patient, PatientRepository, PatientPresenter, PatientViewModel, Signal, parse_line, load_data, analyze, report, InvalidPatientDataError, extraireSections, extraireJobs, toCsv, PATTERN };
  root.IHM = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
