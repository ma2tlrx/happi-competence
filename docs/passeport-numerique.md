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
- Polices (Atkinson Hyperlegible, Lexend, Roboto) et bibliothèque PDF (pdf-lib 1.17.1) sont **hébergées par la plateforme** (`public/passeport-numerique/`) : aucun appel à Google Fonts ni à un CDN. Les licences accompagnent les fichiers. La vidéo de présentation et son image sont dans le même dossier.

## Ce qui est modifié dans l'application d'origine

Adaptations faites à chaque requête (fichier d'origine **non modifié**, livré tel quel dans `private/`). Si le fichier est mis à jour, `npm test` signale précisément la phrase qui ne se retrouve plus.

1. **Plus aucun code animateur dans la page** : le code « 1111 » (et la constante « 000 ») sont retirés ; l'espace animateur s'ouvre directement pour un formateur ou un administrateur, il reste fermé pour un participant ; le bouton « Changer le code animateur » disparaît.
2. **Compte** : pour un participant, la création de compte de l'application (prénom, nom, code à quatre chiffres) est remplacée par son compte HAPPI. Les textes du consentement et de la notice qui parlent du code secret sont adaptés.
3. **Données rangées par compte** : la clé de stockage du navigateur contient un identifiant opaque du compte ; deux personnes qui se servent du même appareil ne voient pas les données l'une de l'autre.
4. Polices et bibliothèque PDF locales.
5. **Charte graphique HAPPI** (voir ci-dessous) : feuille de thème `public/passeport-numerique/theme.css` chargée après celle d'origine, couleurs et polices ramenées à la marque, logo et mascotte officiels.
6. **Sorties vers la plateforme** : « Retour à mon espace HAPPI » (participant) et « Fermer » (animateur) passent par un message au cadre de la plateforme, qui navigue vers une page autorisée (liste fermée).

## Modifications apportées à l'application d'origine

Contrairement aux adaptations ci-dessus (faites à la volée par `page.ts`), celles-ci sont écrites **directement dans** `private/passeport-numerique/index.html`, à l'endroit de l'exercice concerné. Un test (`page.test.ts`) vérifie qu'elles sont toujours là et que les étapes attendues n'ont pas bougé.

- **Exercice « Les réseaux sociaux » : écran simulé façon Facebook** (« Publier dans le groupe de la famille » et « Protéger mon compte »). Seul l'habillage change : consignes, étapes, cibles cliquables, corrections et validation sont ceux d'origine.
  - Code : bloc `RÉSEAU SOCIAL` (fonction `fbScreen`, juste avant `scr`) et feuille de style `.fbx…` (après `.rl small`). `eSim` active l'habillage pour les exercices dont l'identifiant commence par `rs` (`CURSOC`) ; `scr` lui confie alors les écrans (fil d'actualité, page de groupe, création de publication, listes de menu et de réglages). Tout autre écran retombe sur le rendu générique.
  - Rendu : barre du haut avec le mot « facebook » en texte bleu (#1877F2), pas d'image de marque ; onglets Accueil, Amis, Vidéo, Marketplace, Notifications, Menu en icônes SVG dessinées ; zone « Quoi de neuf, <prénom> ? » ; cartes blanches sur fond #F0F2F5 (avatar rond, nom, heure, texte, image, pastilles de réaction, J'aime · Commenter · Partager) ; bouton « Publier » bleu ; police système (Segoe UI / Helvetica). Cet écran garde volontairement la direction artistique de l'application imitée, comme les autres écrans simulés ; seuls la consigne et la bulle du guide restent en charte HAPPI.
  - Accessibilité : les zones cliquables attendues sont de vrais boutons (focus clavier, libellés, 44 px au minimum) ; les éléments décoratifs (onglets, « … », J'aime, etc.) ne sont ni focusables ni lus.
  - Les images des publications sont les illustrations vectorielles déjà présentes dans l'application ; l'avatar est l'initiale du prénom du compte.
  - Autres écrans simulés de réseau social : aucun autre (Instagram, etc.). WhatsApp apparaît dans les exercices de messagerie, de message vocal et d'installation d'application ; ils n'ont pas été modifiés.

## Charte graphique et affichage

- **Couleurs** : encre pétrole `#102C32`, orange `#EA632E` (actions, mondes validés), blanc, papier `#F5F5F2`, trait `#E5E5E0`. Texte orange sur fond clair : `#B8431A` (contraste ≥ 4,5:1). Mode sombre cohérent (pétrole `#0A1E22`). Les écrans simulés des exercices (boîte mail, messagerie, banque, etc.) gardent volontairement le look des applications qu'ils imitent.
- **Polices** : Poppins (titres) et DM Sans (texte), comme le reste de l'application ; Roboto seulement pour les écrans simulés. Tailles de texte et de boutons d'origine conservées (public peu à l'aise avec le numérique) : l'ancienne police Atkinson Hyperlegible, conçue pour la basse vision, est remplacée à votre demande par la police de la marque.
- **Formes** : cartes à 14 px, boutons à 10 px, fond pétrole à motif « pixel » discret, logo HAPPI officiel, mascotte officielle dans les bulles du guide. Le dessin vectoriel de fourmi d'origine n'est conservé que là où un dessin est indispensable (tampons du passeport, fichiers PDF).
- **Affichage** : l'application s'affiche dans la page de la plateforme (menu conservé). Ordinateur et tablette : le cadre est ancré sous l'en-tête, à droite du menu latéral, et occupe tout l'espace restant jusqu'aux bords de la fenêtre (le contenu de l'application n'est plus limité en largeur). Téléphone : le cadre remplit tout l'écran sous l'en-tête, bord à bord ; la barre basse de la plateforme est masquée sur cette page (l'application a la sienne), les onglets de l'espace animateur passent à la ligne et les titres sont un peu réduits. Pas de plein écran ; textes et boutons aux grandes tailles d'origine.
- **Responsive** : testé sur téléphone (390 px), tablette (820 px) et ordinateur ; barre de navigation basse et bouton d'aide sur téléphone, grille de mondes à 1 à 4 colonnes, marges des encoches (`safe-area`).

## Limites connues (à décider avec vous)

- **Les données de progression restent sur l'appareil** de la personne (comportement d'origine : « les données restent sur chaque appareil »). Le formateur ne voit donc pas, dans la plateforme, la progression des participants ; l'espace animateur propose « Sauvegarder / Importer une sauvegarde » pour regrouper les chiffres. L'application contient déjà un point d'accroche prévu pour une base partagée (`window.claude.use('db')`, collections `pn_profiles`, `pn_sessions`, `pn_meta`) : le brancher sur la base de la plateforme (progression de chaque participant visible par son formateur, partagée entre appareils) est l'étape suivante, à valider.
- Le « code de la salle » des **défis chrono** (`1001`) est resté tel quel : c'est un déverrouillage de jeu local, pas un accès protégé.
- Aucune trame de sessions pour ce programme dans la plateforme (les ateliers se gèrent dans l'espace animateur de l'application) : le programme « Passeport Numérique » n'a donc pas de sessions planifiables côté groupes.
- Les traductions (en, es, it, pt, ar) des deux phrases adaptées ne sont pas mises à jour : ces phrases s'affichent en français.

## Base de données

Migration `20261122090000_program_kinds.sql` : `programs.kind`, `participants.program_kind` (choix à l'inscription, transmis par les métadonnées du compte et contrôlé par le déclencheur), et le programme « Passeport Numérique » (1 trame, 2 h, **à valider**).
