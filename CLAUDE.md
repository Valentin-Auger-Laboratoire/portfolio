# Portfolio — fiche projet (lue automatiquement par Claude Code)

## Qui / quoi
- Élève ingénieur : réseaux, IA, code, technologies. IMPORTANT : son profil est d'abord RÉSEAU, la santé vient en second (contexte de l'école). Éviter le ton slogan / cliché.
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
- Thème sobre ingénieur (avec une touche santé). Palette : NOIR / GRIS / BLANC + rouge profond pour les éléments importants. Pas de bleu.
- Accueil scindé en deux (seulement l'accueil, le reste du site reste noir uni) :
  gauche = nom + photo de Valentin (assets/photo.jpg), droite = image ingénierie santé / robots (assets/fond-sante.jpg) + fiche résumé (rectangle simple, angles droits, semi-transparent + flou, libellés en gras avec majuscule ; PAS de barre façon fenêtre Mac).
  Les deux photos passent en noir et blanc via CSS (filter: grayscale). Proportions : --left / --right dans .hero.
- Photo de Valentin (costume, N&B) : assets/photo.jpg = version RETOURNÉE en miroir (pour qu'il regarde vers son nom) ; assets/photo-original.jpg = sens d'origine. Affichée via <img class="hero-photo"> calée à droite du bloc gauche, hauteur 100 %, fondu vers la gauche (mask-image). Ombre légère sous le texte pour la lisibilité.
- Trait d'ECG : essayé puis REFUSÉ par Valentin.
- Image droite actuelle : bras robotique (Niryo One), fournie par Valentin, 600x600 (un peu basse résolution). Origine/droits à vérifier.
- Images "code" (fournies par Valentin) : assets/code-main.jpg à côté du texte À propos, assets/code-ecrans.jpg en fond de la carte Contact (N&B + voile sombre).
- Image couloir de serveurs (dessin N&B) : assets/serveurs.jpg, bandeau en haut de la section Compétences.
- Références aimées : accueils de portfolio photo N&B plein cadre d'un côté, texte de l'autre.
- Fond animé (réseau de nœuds) SUPPRIMÉ : Valentin le trouvait pas pro / pas personnalisé.
- Nom en grand : blanc, contour noir + ombre décalée. Sur-titre "Élève ingénieur" en rouge.
- Phrase sous le nom (écrite par Valentin, NE PAS reformuler) : "Réseaux, électronique et mécanique. Je teste, je construis, je documente." / "Voici les projets de mon laboratoire d'expérimentation, et comment je les ai construits." Pas de lien dans la phrase. Affichée ligne par ligne (4 lignes, coupure après la virgule de la dernière phrase). Son GitHub s'appelle "Laboratoire" = son labo d'expérimentation.
- Barre du haut : PAS de nom/logo (doublon), juste le menu centré. Accueil : PAS de boutons (refusés, inutiles).
- Polices : Inter (texte) + JetBrains Mono (accents techniques).
- Couleurs : toutes dans `:root` de style.css. Accent = rouge profond #c8102e (choisi par Valentin), surtout pas orangé. Secondaire = gris clair #c9c9cc.
- Valentin a REFUSÉ : lettrage rétro (Shrikhand) sur le titre, couleur crème. Garder le design de base, ne changer que ce qui est demandé.
- Pas d'illustrations, pas de framework : HTML/CSS/JS pur.

## Structure
- index.html — sections : Accueil, À propos, Projets (filtres), Compétences, Parcours (formation), Expérience, Contact (chaque section a son onglet dans le menu)
- style.css — styles (responsive < 820px)
- script.js — filtres projets, menu mobile, nav active, changement de langue
- i18n.js — traductions ANGLAISES (clé → texte). Le français est dans index.html.

## Bilingue FR / EN (obligatoire : stage de 16 semaines à l'étranger)
- Sélecteur FR | EN en haut à droite (à gauche sur mobile). Choix mémorisé (localStorage), sinon langue du navigateur.
- TOUT nouveau texte : ajouter data-i18n="clé" dans index.html + la traduction dans i18n.js. Attributs : data-i18n-attr="alt:clé;aria-label:clé".
- assets/ — cv.pdf, images de projets

## Ajouter un projet
Copier un bloc `<article class="project-card" data-tags="...">` dans index.html.
data-tags possibles : reseau, ia, dev (plusieurs séparés par un espace).

## À faire
- [x] Nom : Valentin Auger
- [x] École : EPISEN (École Publique d'Ingénieurs de la Santé et du Numérique) — école d'ingé spécialisée technologies pour la santé
- [x] Contact : auger32valentin@gmail.com, linkedin.com/in/auger-valentin, github.com/Valentin-Auger-Laboratoire
- [x] Recherche : stage à l'étranger de 16 semaines
- [x] Lieu : Périphérie de Paris, France (EN : Paris area, France)
- [x] Année : 2e année cycle ingénieur (EPISEN ITS, sept. 2025 – juil. 2028)
- [x] Parcours (source : LinkedIn de Valentin) : EPISEN ITS 2025–2028 ; CPGE TSI Lycée Robert Doisneau (Corbeil-Essonnes) 2023–2025, crédits ECTS ; Bac STI2D option SIN Lycée Georges Brassens (Évry-Courcouronnes) 2020–2023.
- [x] Logos du parcours : assets/logos/episen.png, doisneau.png, brassens.png (recadrés des captures LinkedIn de Valentin), affichés en N&B dans un rectangle blanc, SEUL LE NOM de l'établissement est cliquable vers LinkedIn (logos fixes, non cliquables, sans effet au survol — demandé par Valentin) : linkedin.com/school/episen-its, linkedin.com/company/lycee-robert-doisneau (page "entreprise" : pas de page école), linkedin.com/school/lycée-georges-brassens-d-évry-courcouronnes.
- [x] Expériences (source LinkedIn) : section à part "05 Expérience" avec onglet dans le menu (demandé par Valentin) :
  stage Pharmacie des Aunettes, Ris-Orangis (juin–juil. 2026, optimisation back-office) ; stage électronique 123 Cash, Corbeil-Essonnes (déc. 2019, 1 mois).
- Langues (FR natif, anglais et espagnol pro) : Valentin ne veut PAS les afficher sur le portfolio (ni ligne, ni section, ni version espagnole du site). Elles restent dans le CV.
- [x] Texte À propos rédigé (3 paragraphes FR/EN, inspiré de son LinkedIn) : parcours concret STI2D→TSI, réseaux + sécurité en premier, IA/électronique/robotique à côté, santé = contexte, stage 16 sem. à l'étranger. NB : son LinkedIn parle encore d'alternance (obsolète).
- [x] Compétences : 9 blocs en grille 3x3 (C / C++ retiré à la demande de Valentin ; Réseaux, Infrastructure & auto-hébergement, IA, Développement, Applications mobiles, CAO & fabrication, Sciences de l'ingénieur, Santé & données sensibles, Méthodes & savoir-être). Le bloc Santé vient de son stage en pharmacie : données de santé, RGPD, parc informatique, contact patients, interface soignants/patients/technique. Sources : ses dires (Android Studio, Flutter, PHP, VS Code, SolidWorks, Fusion 360, impression 3D, serveur domotique, NAS, routeur/switch, mécanique, SI) + son CV anglais (JS, back-end, SQL/MySQL, data security, Excel, gestion de projet, soft skills).
- [ ] Période du stage
- [ ] Ajouter assets/cv-fr.pdf et assets/cv-en.pdf
- [ ] Renseigner les vrais projets
- [x] Déployer sur GitHub Pages
- [x] Couleur d'accent choisie : rouge profond #c8102e (sélecteur retiré)
- Bouton principal : texte blanc avec contour noir (text-shadow) — demandé par Valentin.
- CV : deux boutons rouges côte à côte SOUS la carte Contact, icône fine + "Télécharger le CV / Version française · PDF" (assets/cv-fr.pdf) et "Download my resume / English version · PDF" (assets/cv-en.pdf). Pas de grosses flèches. PDF à fournir par Valentin.
- Pied de page : nom + deux lignes dans le MÊME style (gris italique, rien en couleur) : "Connecter, sécuriser, faire durer." / "Mais ce qui compte, c'est que ça marche. Et que ça tienne."  (les phrases slogan santé type "technologie qui prend soin" ont été jugées trop clichées) + liens LinkedIn / GitHub / Haut de page. PAS de ©, d'année ni de mention GitHub Pages.
