# Passeport Numérique

Application d'initiation au numérique fournie sous forme de fichier statique (`private/passeport-numerique/index.html`, 19 « mondes » d'exercices, aide en 6 langues, défis chrono facultatifs, attestations, espace animateur). Elle est intégrée à la plateforme comme **second programme**, à côté de HAPPI Compétence.

## Ce que voient les personnes

| Qui | Où | Quoi |
| --- | --- | --- |
| Visiteur | `/inscription?espace=participant` | **Étape 1** : « Pour quel programme vous inscrivez-vous ? » (HAPPI Compétence ou Passeport Numérique). **Étape 2** : le formulaire du compte, avec le programme rappelé (« Changer »). |
| Participant du Passeport Numérique | `/participant/passeport-numerique` | L'application, ouverte avec son compte : pas de compte à recréer, directement le consentement, puis les questions de départ **de l'application** (et non le questionnaire d'accueil HAPPI), puis les exercices. Menu réduit : Accueil, Passeport Numérique, Profil, Avis. |
| Participant de HAPPI Compétence | `/bienvenue` | Le questionnaire d'accueil HAPPI (5 étapes) puis l'auto-évaluation. L'application du Passeport Numérique lui est refusée (403). |
| Formateur, administrateur | `/formateur/programmes` | Le choix entre **HAPPI Compétence** et **Passeport Numérique** (deux grandes cartes). Le Passeport Numérique ouvre son **espace animateur** (`/formateur/programmes/passeport-numerique`), **sans code**. |
| Organisme, visiteur | | Refusés. |

Le programme d'une personne est celui de son **groupe actif** s'il existe, sinon celui qu'elle a choisi à l'inscription (`src/lib/programmes/kind.ts`).

## Comment c'est servi

- `src/app/passeport-numerique/app/route.ts` lit le fichier d'origine, le **prépare pour la personne connectée** (`src/lib/passeport-numerique/page.ts`) et le sert avec sa propre politique de sécurité (aucune ressource extérieure à la plateforme, cadre de même origine seulement). Le rôle (formateur ou participant) est décidé **par le serveur** : la page ne le déduit d'aucune saisie.
- Polices (Atkinson Hyperlegible, Lexend, Roboto), bibliothèque PDF (pdf-lib 1.17.1) et lecteur de polices pour les PDF (@pdf-lib/fontkit 1.1.1, MIT) sont **hébergés par la plateforme** (`public/passeport-numerique/`) : aucun appel à Google Fonts ni à un CDN. Les licences accompagnent les fichiers (`vendor/*.LICENSE.md`, `fonts/LICENSE-*.txt`). La vidéo de présentation et son image sont dans le même dossier.

## Ce qui est modifié dans l'application d'origine

Adaptations faites à chaque requête (fichier d’origine livré dans `private/`, avec les évolutions fonctionnelles listées plus bas). Si le fichier est mis à jour, `npm test` signale précisément la phrase qui ne se retrouve plus.

1. **Plus aucun code animateur dans la page** : le code « 1111 » (et la constante « 000 ») sont retirés ; l'espace animateur s'ouvre directement pour un formateur ou un administrateur, il reste fermé pour un participant ; le bouton « Changer le code animateur » disparaît.
2. **Compte** : pour un participant, la création de compte de l'application (prénom, nom, code à quatre chiffres) est remplacée par son compte HAPPI. Les textes du consentement et de la notice qui parlent du code secret sont adaptés.
3. **Données rangées par compte** : la clé de stockage du navigateur contient un identifiant opaque du compte ; deux personnes qui se servent du même appareil ne voient pas les données l'une de l'autre.
4. Polices et bibliothèque PDF locales.
5. **Charte graphique HAPPI** (voir ci-dessous) : feuille de thème `public/passeport-numerique/theme.css` chargée après celle d'origine, couleurs et polices ramenées à la marque, logo et mascotte officiels.
6. **Sorties vers la plateforme** : « Retour à mon espace HAPPI » (participant) et « Fermer » (animateur) passent par un message au cadre de la plateforme, qui navigue vers une page autorisée (liste fermée).
7. **PDF et certificat à la charte HAPPI** (voir ci-dessous) : un seul gabarit, `public/passeport-numerique/happi-pdf.js`, remplace la mise en page d'origine de tous les PDF ; `page.ts` branche l'application dessus (étape « 1 ter ») sans modifier le fichier d'origine.

## Modifications apportées à l'application d'origine

Évolutions fonctionnelles demandées par le client, faites directement dans `private/passeport-numerique/index.html` (changements minimaux ; à refaire si le fichier d'origine est remplacé). Testées sur le vrai fichier (`page.test.ts`) et au navigateur.

- **Défis chrono, accès à tous les mini-jeux** : après le code de la salle, l'application ouvrait directement le premier défi (« Course au clavier ») sans montrer les autres. Elle revient maintenant au passeport, où la grille des 8 défis est ouverte (message « Code accepté »). Le code (`1001`) et le stockage du déverrouillage (`S.lobbyDay`, valable la journée, conservé au rechargement) sont inchangés.
- **Déblocage progressif** : un exercice n'est ouvert que si le précédent est réussi (le premier toujours ; un exercice déjà réussi reste ouvert). Les autres affichent un cadenas, « Verrouillé : terminez l'exercice précédent », `aria-disabled="true"` et un message au toucher. Même erreur côté mondes : l'ancienne règle n'exigeait que les deux premiers mondes pour ouvrir tous les autres ; chaque monde s'ouvre maintenant quand le précédent est terminé (un monde déjà terminé reste ouvert). Le mode démonstration et « tout débloquer » de l'animateur ne changent pas.
- **Défis chrono, message d'erreur/pénalité** : le message (`#fb`) poussait le jeu vers le bas (50 px sur ordinateur, 100 px sur téléphone). Il s'affiche maintenant en bulle fixe au-dessus de la barre basse (sans effet sur la mise en page ni sur les clics), dans une région `role="status" aria-live="polite"`. Vaut pour tous les défis chrono.

## Charte graphique et affichage

- **Couleurs** : encre pétrole `#102C32`, orange `#EA632E` (actions, mondes validés), blanc, papier `#F5F5F2`, trait `#E5E5E0`. Texte orange sur fond clair : `#B8431A` (contraste ≥ 4,5:1). Mode sombre cohérent (pétrole `#0A1E22`). Les écrans simulés des exercices (boîte mail, messagerie, banque, etc.) gardent volontairement le look des applications qu'ils imitent.
- **Polices** : Poppins (titres) et DM Sans (texte), comme le reste de l'application ; Roboto seulement pour les écrans simulés. Tailles de texte et de boutons d'origine conservées (public peu à l'aise avec le numérique) : l'ancienne police Atkinson Hyperlegible, conçue pour la basse vision, est remplacée à votre demande par la police de la marque.
- **Formes** : cartes à 14 px, boutons à 10 px, fond pétrole à motif « pixel » discret, logo HAPPI officiel, mascotte officielle dans les bulles du guide. Le dessin vectoriel de fourmi d'origine n'est conservé que là où un dessin est indispensable (tampons du passeport, fichiers PDF).
- **Affichage** : l'application s'affiche dans la page de la plateforme (menu conservé). Ordinateur et tablette : le cadre est ancré sous l'en-tête, à droite du menu latéral, et occupe tout l'espace restant jusqu'aux bords de la fenêtre (le contenu de l'application n'est plus limité en largeur). Téléphone : le cadre remplit tout l'écran sous l'en-tête, bord à bord ; la barre basse de la plateforme est masquée sur cette page (l'application a la sienne), les onglets de l'espace animateur passent à la ligne et les titres sont un peu réduits. Pas de plein écran ; textes et boutons aux grandes tailles d'origine.
- **Responsive** : testé sur téléphone (390 px), tablette (820 px) et ordinateur ; barre de navigation basse et bouton d'aide sur téléphone, grille de mondes à 1 à 4 colonnes, marges des encoches (`safe-area`).

## PDF exportables et certificat

- **Gabarit unique** (`happi-pdf.js`, testé par `src/lib/passeport-numerique/happi-pdf.test.ts`) : bandeau pétrole à motif de points discret avec le logo HAPPI officiel (`/brand/happi-logotype-blanc.png`), titre Poppins, mascotte officielle (`/brand/happi-mascotte.png`) qui dépasse du bandeau, en-tête fin (logo pétrole) sur les pages suivantes, titres de section Poppins avec le point orange du logo, encadrés papier à filet orange, tableaux et barres pétrole, pied de page « HAPPI Compétence · Passeport Numérique » avec « Page n / N ». A4, marges de 54 pt. Orange foncé `#B8431A` pour tout texte orange sur fond clair.
- **Documents concernés** : rapport d'activité, feuille d'émargement, attestation de participation, cartes de code, mémos (un monde ou tous), défis chrono, certificat de réussite. Les contenus (textes, chiffres, listes) sont ceux de l'application : seule la mise en page change. Les fonctions de l'application qui fabriquent le contenu (rapport, émargement, attestation, défis) écrivent dans le gabarit ; cartes, mémos et certificat, qui dessinaient eux-mêmes, appellent directement `HappiPdf.cartes / memos / certificate` (`page.ts` remplace ces trois fonctions et `makePdf`).
- **Polices des PDF** : DM Sans (400, 700) et Poppins (500, 600), fichiers `.woff` de `public/fonts/report/` (les mêmes que le bilan HAPPI, licence OFL : `LICENSE-DM-Sans.txt`, `LICENSE-Poppins.txt`), lus par `@pdf-lib/fontkit` 1.1.1 (`vendor/fontkit.umd.min.js`, MIT, fichier npm publié tel quel). Les caractères que ces polices ne savent pas dessiner sont retirés plutôt que remplacés par un carré. Les mémos en arabe restent non proposés en PDF (comme avant).
- **Sceau « Passeport Numérique · Validé »** : redessiné (disque pétrole, anneau orange, la petite fourmi au centre, « PASSEPORT NUMÉRIQUE » en arc, bandeau orange « VALIDÉ <année> », « ASSOCIATION <nom> » en arc inférieur). La mention d'origine est conservée : le nom de l'association est celui saisi dans les réglages de l'espace animateur (« Happi » par défaut), l'année est l'année en cours ; rien n'est inventé. Un seul dessin SVG (`HappiPdf.sealSvg`) sert à l'écran, dans le PDF et dans l'image PNG du certificat ; la mascotte et la police Poppins 600 sont embarquées dans `happi-pdf-assets.js` (données générées à partir des fichiers officiels, car une image SVG rasterisée ne charge rien d'extérieur).
- **Certificat** : à l'écran (bandeau pétrole, papier HAPPI), en PDF A4 paysage vectoriel (remplace l'ancienne image plate), et en image PNG (envoi par mail, ou si le PDF ne peut pas être produit) recolorée à la charte.
- **Vérifier** : `node --experimental-strip-types scripts/pn-harness.mjs 4103` puis `node scripts/pn-pdf-check.mjs <dossier> --charte` génère chaque PDF et la capture du certificat ; `pdftoppm -r 70 -png fichier.pdf sortie` pour les regarder.

## Limites connues (à décider avec vous)

- **Les données de progression restent sur l'appareil** de la personne (comportement d'origine : « les données restent sur chaque appareil »). Le formateur ne voit donc pas, dans la plateforme, la progression des participants ; l'espace animateur propose « Sauvegarder / Importer une sauvegarde » pour regrouper les chiffres. L'application contient déjà un point d'accroche prévu pour une base partagée (`window.claude.use('db')`, collections `pn_profiles`, `pn_sessions`, `pn_meta`) : le brancher sur la base de la plateforme (progression de chaque participant visible par son formateur, partagée entre appareils) est l'étape suivante, à valider.
- Le « code de la salle » des **défis chrono** (`1001`) est resté tel quel : c'est un déverrouillage de jeu local, pas un accès protégé.
- Aucune trame de sessions pour ce programme dans la plateforme (les ateliers se gèrent dans l'espace animateur de l'application) : le programme « Passeport Numérique » n'a donc pas de sessions planifiables côté groupes.
- Les traductions (en, es, it, pt, ar) des deux phrases adaptées ne sont pas mises à jour : ces phrases s'affichent en français.

## Base de données

Migration `20261122090000_program_kinds.sql` : `programs.kind`, `participants.program_kind` (choix à l'inscription, transmis par les métadonnées du compte et contrôlé par le déclencheur), et le programme « Passeport Numérique » (1 trame, 2 h, **à valider**).
