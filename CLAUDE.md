# Portfolio — fiche projet (lue automatiquement par Claude Code)

## Qui / quoi
- Élève ingénieur·e : réseaux, IA, code, technologies.
- Objectif : portfolio technique pro (pas marketing), hébergé sur GitHub Pages.
- Cible : recruteurs / tuteurs de stage.
- Propriétaire GitHub : Valentin-Auger-Laboratoire (Valentin Auger).
- Ses projets GitHub tournent autour de la santé connectée / IA / données médicales
  (MedPredict, GaitAnalysis, MedScan, VitalWatch IoT, SecureHealth Exchange FHIR, Vision-ECG).

## Déploiement
- Dépôt : https://github.com/Valentin-Auger-Laboratoire/portfolio (branche `main`)
- Site en ligne : https://valentin-auger-laboratoire.github.io/portfolio/
- GitHub Pages : déploiement depuis `main`, dossier `/ (root)`. Chaque push met le site à jour (~1 min).
- Le site vit dans un sous-dossier `/portfolio/` → utiliser des chemins RELATIFS (pas de `/` au début).
- Valentin utilise un navigateur avec traduction auto : "Décors" = Settings, "Principaux" = main.

## Choix de design (validés)
- Thème sombre "dashboard d'ingénieur", minimaliste.
- Fond : graphe de nœuds animé en canvas (script.js) — remplace l'image fond-tech.png.
- Polices : Inter (texte) + JetBrains Mono (accents techniques).
- Couleurs : toutes dans `:root` de style.css (accent cyan #4fd1c5, bleu #7aa2f7).
- Pas d'illustrations, pas de framework : HTML/CSS/JS pur.

## Structure
- index.html — sections : Accueil, À propos, Projets (filtres), Compétences, Parcours, Contact
- style.css — styles (responsive < 820px)
- script.js — fond animé, filtres projets, menu mobile, nav active
- assets/ — cv.pdf, images de projets

## Ajouter un projet
Copier un bloc `<article class="project-card" data-tags="...">` dans index.html.
data-tags possibles : reseau, ia, dev (plusieurs séparés par un espace).

## À faire
- [ ] Remplacer les textes "Prénom Nom", école, liens, e-mail
- [ ] Ajouter cv.pdf dans assets/
- [ ] Renseigner les vrais projets
- [x] Déployer sur GitHub Pages
- [ ] Choisir la couleur d'accent (sélecteur TEMPORAIRE en bas à droite → à retirer ensuite)
