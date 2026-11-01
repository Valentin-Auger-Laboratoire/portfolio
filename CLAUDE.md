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
- Trait d'ECG : essayé puis REFUSÉ par Valentin.
- Image droite actuelle : bras robotique (Niryo One), fournie par Valentin, 600x600 (un peu basse résolution). Origine/droits à vérifier.
- Images "code" (fournies par Valentin) : assets/code-main.jpg à côté du texte À propos, assets/code-ecrans.jpg en fond de la carte Contact (N&B + voile sombre).
- Image couloir de serveurs (dessin N&B) : assets/serveurs.jpg, bandeau en haut de la section Compétences.
- Références aimées : accueils de portfolio photo N&B plein cadre d'un côté, texte de l'autre.
- Fond animé (réseau de nœuds) SUPPRIMÉ : Valentin le trouvait pas pro / pas personnalisé.
- Nom en grand : blanc, contour noir + ombre décalée. Sur-titre "Élève ingénieur" en rouge.
- Barre du haut : PAS de nom/logo (doublon), juste le menu centré. Accueil : PAS de boutons (refusés, inutiles).
- Polices : Inter (texte) + JetBrains Mono (accents techniques).
- Couleurs : toutes dans `:root` de style.css. Accent = rouge profond #c8102e (choisi par Valentin), surtout pas orangé. Secondaire = gris clair #c9c9cc.
- Valentin a REFUSÉ : lettrage rétro (Shrikhand) sur le titre, couleur crème. Garder le design de base, ne changer que ce qui est demandé.
- Pas d'illustrations, pas de framework : HTML/CSS/JS pur.

## Structure
- index.html — sections : Accueil, À propos, Projets (filtres), Compétences, Parcours, Contact
- style.css — styles (responsive < 820px)
- script.js — filtres projets, menu mobile, nav active
- assets/ — cv.pdf, images de projets

## Ajouter un projet
Copier un bloc `<article class="project-card" data-tags="...">` dans index.html.
data-tags possibles : reseau, ia, dev (plusieurs séparés par un espace).

## À faire
- [x] Nom : Valentin Auger
- [x] École : EPISEN (École Publique d'Ingénieurs de la Santé et du Numérique) — école d'ingé spécialisée technologies pour la santé
- [x] Contact : auger32valentin@gmail.com, linkedin.com/in/auger-valentin, github.com/Valentin-Auger-Laboratoire
- [ ] Remplacer année, ville, recherche (stage/alternance)
- [ ] Ajouter assets/cv-fr.pdf et assets/cv-en.pdf
- [ ] Renseigner les vrais projets
- [x] Déployer sur GitHub Pages
- [x] Couleur d'accent choisie : rouge profond #c8102e (sélecteur retiré)
- Bouton principal : texte blanc avec contour noir (text-shadow) — demandé par Valentin.
- CV : deux boutons rouges côte à côte SOUS la carte Contact, icône fine + "Télécharger le CV / Version française · PDF" (assets/cv-fr.pdf) et "Download my resume / English version · PDF" (assets/cv-en.pdf). Pas de grosses flèches. PDF à fournir par Valentin.
- Pied de page : nom + phrase "Connecter, sécuriser, faire durer." (choisie par Valentin ; "Ce qui compte, c'est que ça marche. Et que ça tienne." aimée aussi → à réutiliser ailleurs, ex. À propos) (les phrases slogan santé type "technologie qui prend soin" ont été jugées trop clichées) + liens LinkedIn / GitHub / Haut de page. PAS de ©, d'année ni de mention GitHub Pages.
