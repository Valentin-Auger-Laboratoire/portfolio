# Portfolio — fiche projet (notes de travail : choix validés, déploiement, à faire)

## Qui / quoi
- Élève ingénieur : réseaux, IA, code, technologies. IMPORTANT : son profil est d'abord RÉSEAU, la santé vient en second (contexte de l'école). Éviter le ton slogan / cliché.
- Objectif : portfolio technique pro (pas marketing), hébergé sur GitHub Pages.
- Cible : recruteurs / tuteurs de stage.
- Propriétaire GitHub : Valentin-Auger-Laboratoire (Valentin Auger).
- Ses projets GitHub tournent autour de la santé connectée / IA / données médicales
  (MedPredict, GaitAnalysis, MedScan, VitalWatch IoT, SecureHealth Exchange FHIR, Vision-ECG).

## Déploiement
- Commits : auteur "Valentin-Auger-Laboratoire <263339119+Valentin-Auger-Laboratoire@users.noreply.github.com>" (JAMAIS le Gmail perso valentin32auger@gmail.com ; les anciens commits jusqu'à 6302b0b le contiennent encore).
- Dépôt : https://github.com/Valentin-Auger-Laboratoire/portfolio (branche `main`)
- Site en ligne : https://valentin-auger-laboratoire.github.io/portfolio/
- GitHub Pages : déploiement depuis `main`, dossier `/ (root)`. Chaque push met le site à jour (~1 min).
- Le site vit dans un sous-dossier `/portfolio/` → utiliser des chemins RELATIFS (pas de `/` au début).
- Valentin utilise un navigateur avec traduction auto : "Décors" = Settings, "Principaux" = main.

## Choix de design (validés)
- Thème sobre ingénieur (avec une touche santé). Palette : NOIR / GRIS / BLANC + rouge profond pour les éléments importants. Pas de bleu.
- Accueil scindé en deux (seulement l'accueil, le reste du site reste noir uni) :
  gauche = nom + photo de Valentin (assets/photo.jpg), droite = image ingénierie santé / robots (assets/fond-sante.jpg) + fiche résumé (rectangle simple, angles droits, semi-transparent + flou, libellés en gras avec majuscule ; PAS de barre façon fenêtre Mac ; légèrement décalée vers la droite via transform, sauf sur mobile).
  Les deux photos passent en noir et blanc via CSS (filter: grayscale). Proportions : --left / --right dans .hero.
- Photo de Valentin (costume, N&B) : assets/photo.jpg = sens d'ORIGINE, recadré à gauche ; calée à GAUCHE du bloc gauche (il regarde vers son nom), fondu vers la droite ; le texte est poussé à droite de la photo. Sur téléphone : photo atténuée (opacity .35). (copie de secours photo-original.jpg supprimée à la demande de Valentin ; l'original est dans l'historique Git, commit 10158cc).
- Zone entre la photo et le côté droit : image de code (fournie par Valentin) RETOURNÉE en miroir, assets/code-hero.jpg (474x270, petite), en fond assombri (brightness .55) sous la photo, fondu depuis la gauche.
- Image du robot (droite) : fondu sur son bord gauche (mask-image) pour une transition douce avec la zone code ; fond du bloc droit = noir.
- Trait d'ECG : essayé puis REFUSÉ par Valentin.
- Image droite actuelle : bras robotique (Niryo One), fournie par Valentin, 600x600 (un peu basse résolution). Origine/droits à vérifier.
- Images "code" (fournies par Valentin) : assets/code-main.jpg à côté du texte À propos, assets/code-ecrans.jpg en fond de la carte Contact (N&B + voile sombre).
- Image couloir de serveurs (dessin N&B) : assets/serveurs.jpg, bandeau en haut de la section Compétences.
- Références aimées : accueils de portfolio photo N&B plein cadre d'un côté, texte de l'autre.
- Fond animé (réseau de nœuds) SUPPRIMÉ : Valentin le trouvait pas pro / pas personnalisé.
- Nom en grand : blanc, contour noir + ombre décalée. Sur-titre "Élève ingénieur" en rouge.
- Phrase sous le nom (écrite par Valentin, NE PAS reformuler) : "Réseaux, électronique et mécanique. Je teste, je construis, je documente." / "Voici les projets de mon laboratoire d'expérimentation, et comment je les ai construits." Pas de lien dans la phrase. Affichée ligne par ligne (4 lignes, coupure après la virgule de la dernière phrase). Tailles du bloc nom/phrase proportionnelles à l'écran (vw), réduites d'environ 15 % à la demande de Valentin ; bloc calé juste à droite de la photo (padding-left ≈ 0,42 × hauteur). Son GitHub s'appelle "Laboratoire" = son labo d'expérimentation.
- Barre du haut : PAS de nom/logo (doublon), juste le menu centré. Accueil : PAS de boutons (refusés, inutiles).
- Polices : Inter (texte) + JetBrains Mono (accents techniques).
- Couleurs : toutes dans `:root` de style.css. Accent = rouge profond #c8102e (choisi par Valentin), surtout pas orangé. Secondaire = gris clair #c9c9cc.
- Valentin a REFUSÉ : lettrage rétro (Shrikhand) sur le titre, couleur crème. Garder le design de base, ne changer que ce qui est demandé.
- Pas d'illustrations, pas de framework : HTML/CSS/JS pur.

## Structure
- FICHE-PROJET.md — cette fiche (ancien nom : CLAUDE.md). Chargée automatiquement par Claude via .claude/CLAUDE.md (qui l'importe). NE PAS supprimer .claude/CLAUDE.md.
- index.html — sections : Accueil, À propos, Projets (filtres), Compétences, Parcours (formation), Expérience, Contact (chaque section a son onglet dans le menu)
- style.css — styles (responsive < 820px)
- script.js — filtres projets, menu mobile, nav active, changement de langue
- traduction-anglais.js (ancien nom : i18n.js, renommé pour être compris tout de suite) — traductions ANGLAISES (clé → texte). Le français est dans index.html.

## Bilingue FR / EN (obligatoire : stage de 16 semaines à l'étranger)
- Sélecteur FR | EN en haut à droite (à gauche sur mobile). Choix mémorisé (localStorage), sinon langue du navigateur.
- TOUT nouveau texte : ajouter data-i18n="clé" dans index.html + la traduction dans traduction-anglais.js. Attributs : data-i18n-attr="alt:clé;aria-label:clé".
- assets/ — cv.pdf, images de projets

## Ajouter un projet
Copier un bloc `<article class="project-card" data-tags="...">` dans index.html (+ clés pN.date/title/desc dans traduction-anglais.js).
data-tags possibles : sante, data, electronique, ia, web (filtres "Application santé" / "Données" / "Électronique" / "IA" / "Web"). Cartes pleine largeur (project-card--wide), en tête : Back-office officine, Athletix-Data, SantéConnect (téléconsultation), site EPISEN, Vision IA ; puis les 4 projets IHM en 2x2. Ajouter un filtre seulement s'il a au moins un projet.
Grille projets : 2 colonnes (1 sur mobile).

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
- [x] Projets (source : resume-projets.md du dossier EPISEN, cours ECUE 235, 2026) : 4 cartes = Suivi médical UX V1→V2, Salle d'attente MVP/MVVM, Monitoring patients (version reprise après examen ; le rendu d'examen ne s'exécute pas), Web scraping. Écartés : exercices PyQt, exemples de cours, ECUE 234 (pas ses projets). Code publié dans le dépôt PUBLIC github.com/Valentin-Auger-Laboratoire/projets-episen (un dossier par projet : suivi-medical-ux, salle-attente-mvp-mvvm, monitoring-patients, web-scraping) ; chaque carte entière est cliquable vers son dossier ("Voir le code ↗"). Pas d'images (aucune capture dans le dossier → à demander).
- [x] Projet 5 : site vitrine EPISEN (Bootstrap 5, mars 2026), dépôt PUBLIC séparé github.com/Valentin-Auger-Laboratoire/site-episen, site en ligne (GitHub Pages) valentin-auger-laboratoire.github.io/site-episen/. Nettoyé : pas de noms/photos d'enseignants (avatars + "Enseignant·e N", intitulés génériques), pas de pages copiées du site officiel, pas de vidéo ; bandeau "Projet étudiant — site non officiel" sur chaque page. Carte en pleine largeur en tête de grille, 2 liens (site + code). Contexte (cours ? seul ?) non confirmé par Valentin.
- [x] Projet 6 : Vision IA, suivi de la main (Python, OpenCV, MediaPipe Hands 0.10.21, mars 2026), dépôt PUBLIC github.com/Valentin-Auger-Laboratoire/vision-main. Amélioré avant publication : bouton QUITTER déclenché par l'index (repère 8), clic souris, croix, FPS, position via frame.shape, isOpened, hands.close ; README cite l'exemple officiel MediaPipe. Python 3.11/3.12 requis (pas 3.13). MANQUE : images/demo.png (le README affiche une image cassée) → à mettre aussi sur la carte. Contexte (perso ?) non confirmé.
- [x] Projet 7 (PRINCIPAL) : Back-office d'officine, PoC Flutter réalisé pendant le stage en pharmacie (juin 2026). Dépôt PUBLIC github.com/Valentin-Auger-Laboratoire/backoffice-officine, démo web en ligne valentin-auger-laboratoire.github.io/backoffice-officine/ (Pages depuis main /docs, build Flutter web copiée dans docs/ ; à recompiler à chaque modif). ANONYMISÉ : "Pharmacie Démo", comptes "(démo)", "Grossiste A/B/C", factures GA-DEMO/GB-DEMO, prix/stocks fictifs. Failles corrigées (IV aléatoire, SHA-256). Ne PAS relier ce dépôt au nom de la pharmacie (section Expérience) sans l'accord de Valentin. Valentin ne souhaite PAS répondre aux questions "seul ?" / "aide d'une IA ?" : ne plus les poser, ne rien affirmer à ce sujet sur les cartes.
- [x] Projet 8 : SantéConnect, téléconsultation PHP/MySQL/WebRTC (avril 2026), dépôt PUBLIC github.com/Valentin-Auger-Laboratoire/teleconsultation (pas de démo : PHP non exécutable sur GitHub Pages). Nettoyé et sécurisé avant publication (password_hash, contrôles d'accès + appartenance du RDV, XSS, upload verrouillé, secrets dans config.local.php ignoré, ids en dur supprimés, paiement simulé sans champs carte). Mot de passe d'application Gmail "Ryokan" à révoquer côté Google (fait ? non confirmé). Visio non testée.
- [x] Projet 9 : Athletix-Data (avril 2026) : capteur PPG (LED IR + phototransistor + LM358) sur ESP32 (Wokwi) + appli Flutter + API PHP/MySQL. Dépôt PUBLIC github.com/Valentin-Auger-Laboratoire/athletix-data, démo web (mode démo sans backend) valentin-auger-laboratoire.github.io/athletix-data/ (Pages main /docs). Sécurisé et nettoyé (secrets hors dépôt, password_hash, requêtes préparées, jeton). Honnête : BPM simulés, "IA" = règles. Backend PHP non exécuté (seulement php -l). Mot de passe d'application Gmail "Athletix-Data" à révoquer côté Google. Captures dispo dans le dépôt (screenshots/, hardware/schema_montage.png).
- Dossier "TP PROGRAMMATION" (6 TP d'initiation Python, nov. 2025 : fondamentaux, listes, chaînes, méthodes de chaînes, dictionnaires/auth MD5, fichiers/INSEE) : ÉCARTÉ, trop débutant, 3 scripts sur 6 plantent, contient les énoncés du prof et un fichier temporaire Office avec le nom d'une autre personne. Seule option éventuelle : fusionner TP5+TP6 en un petit projet corrigé.
  ⚠️ SSH_sur_Python_3.py (dans son dossier EPISEN) contient un mot de passe en clair : ne jamais le publier.
- [ ] Captures d'écran des projets + un projet réseau perso (serveur domotique / NAS / réseau maison)
- [x] Déployer sur GitHub Pages
- [x] Couleur d'accent choisie : rouge profond #c8102e (sélecteur retiré)
- Bouton principal : texte blanc avec contour noir (text-shadow) — demandé par Valentin.
- CV : deux boutons rouges côte à côte SOUS la carte Contact, icône fine + "Télécharger le CV / Version française · PDF" (assets/cv-fr.pdf) et "Download my resume / English version · PDF" (assets/cv-en.pdf). Pas de grosses flèches. PDF à fournir par Valentin.
- Pied de page : nom + deux lignes dans le MÊME style (gris italique, rien en couleur) : "Connecter, sécuriser, faire durer." / "Mais ce qui compte, c'est que ça marche. Et que ça tienne."  (les phrases slogan santé type "technologie qui prend soin" ont été jugées trop clichées) + liens LinkedIn / GitHub / Haut de page. PAS de ©, d'année ni de mention GitHub Pages.
