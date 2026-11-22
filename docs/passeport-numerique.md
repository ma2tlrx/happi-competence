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

## Limites connues (à décider avec vous)

- **Les données de progression restent sur l'appareil** de la personne (comportement d'origine : « les données restent sur chaque appareil »). Le formateur ne voit donc pas, dans la plateforme, la progression des participants ; l'espace animateur propose « Sauvegarder / Importer une sauvegarde » pour regrouper les chiffres. L'application contient déjà un point d'accroche prévu pour une base partagée (`window.claude.use('db')`, collections `pn_profiles`, `pn_sessions`, `pn_meta`) : le brancher sur la base de la plateforme (progression de chaque participant visible par son formateur, partagée entre appareils) est l'étape suivante, à valider.
- Le « code de la salle » des **défis chrono** (`1001`) est resté tel quel : c'est un déverrouillage de jeu local, pas un accès protégé.
- Aucune trame de sessions pour ce programme dans la plateforme (les ateliers se gèrent dans l'espace animateur de l'application) : le programme « Passeport Numérique » n'a donc pas de sessions planifiables côté groupes.
- Les traductions (en, es, it, pt, ar) des deux phrases adaptées ne sont pas mises à jour : ces phrases s'affichent en français.

## Base de données

Migration `20261122090000_program_kinds.sql` : `programs.kind`, `participants.program_kind` (choix à l'inscription, transmis par les métadonnées du compte et contrôlé par le déclencheur), et le programme « Passeport Numérique » (1 trame, 2 h, **à valider**).
