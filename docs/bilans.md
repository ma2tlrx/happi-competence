# Bilans HAPPI

Un bilan est un document professionnel (PDF A4) qui présente, pour un participant,
ce que les formateurs ont observé pendant le programme : niveaux atteints,
observations par session, analyse rédigée, recommandations et méthodologie. Il se
remet au participant et à la structure qui l’accompagne.

## Parcours

1. **Fiche participant → « Bilan HAPPI »** (formateurs du participant, administrateurs).
2. **Générer le bilan** : les résultats validés sont *figés* dans une nouvelle version,
   puis l’IA rédige le texte (si une clé est configurée). Durée : 30 s à 2 min.
3. **Relire** : aperçu fidèle (le PDF lui-même, dans la page) et formulaire de
   relecture : introduction, profil, façon d’agir, fiches par compétence,
   recommandations, synthèse, limites. On peut aussi :
   - masquer des sections ;
   - indiquer la structure accompagnatrice ;
   - ajouter des observations complémentaires du formateur.
4. **Régénérer le texte** si besoin : les résultats ne bougent pas.
5. **Valider** : le bilan est figé et devient téléchargeable par le participant (« Mon
   bilan ») et par son organisme (fiche participant, si l’organisme a le droit
   d’export).
6. **Générer un nouveau bilan** plus tard : nouvelle version, les anciennes restent
   consultables à l’identique.

## Ce qui alimente le bilan

| Donnée | Source | Remarque |
| --- | --- | --- |
| Niveaux par compétence | `evaluation_scores` des évaluations **validées** | saisis par les formateurs ; aucun score automatique de jeu n’existe dans HAPPI |
| Observations par session | idem, avec la session et la date | une observation = une note non nulle sur une session |
| Commentaires par compétence | `evaluation_scores.comment` | partagés avec le participant |
| Commentaires de session | `evaluation_comments` (`observation`, `advice`) | les notes `private` ne sont **jamais** utilisées |
| Auto-évaluation | questionnaire initial | affichée à part, jamais confondue avec l’observation |
| Jeux et activités | titres du support pédagogique publié de chaque session suivie | « au programme » : le déroulé prévu, pas une trace de partie |
| Référentiels, échelles, définitions, descriptions de niveaux | versions publiées des référentiels | version enregistrée dans le bilan |

## Règles (version `bilan-1.0`, `src/lib/report/build.ts`)

- **Valeur retenue** : celle du moteur d’évaluation existant, selon la règle de la
  version du référentiel (aujourd’hui « dernière observation » pour les deux
  référentiels). Aucune formule existante n’a été modifiée.
- **Niveau** : libellé officiel de l’échelle du référentiel (niveau atteint, arrondi
  à l’inférieur si la valeur est décimale). Aucun seuil nouveau n’a été inventé.
  Les formulations proposées dans le cahier des charges (« peu mobilisée »,
  « régulièrement mobilisée »…) n’ont pas été appliquées : les associer aux niveaux
  officiels serait une décision pédagogique à prendre par l’équipe HAPPI.
- **Statut d’observation** : 0 observation → « Non observée » (jamais un zéro, jamais
  un niveau faible) ; 1 → « 1 observation · à confirmer » ; 2 ou plus → « Observée en
  N sessions ».
- **Pas de score global** : les deux référentiels n’ont pas la même échelle
  (1 à 5 et 1 à 4) ; la synthèse se fait par référentiel.
- **Points d’appui / à développer / en progression** : fonction `highlights` du
  moteur existant, seulement à partir de 4 compétences observées dans un référentiel ;
  une compétence au même niveau que les points d’appui n’est jamais classée « à
  développer ».
- **Lecture du profil** : « niveaux proches » si l’écart entre le niveau le plus haut
  et le plus bas observés est d’au plus 1 ; « contrastés » à partir de 2 ;
  « indéterminé » sous le seuil de 4 compétences observées.
- **Suffisance des données** : `none` sans observation, `limited` avec moins de deux
  sessions évaluées ou un référentiel sous le seuil, `sufficient` sinon.
- **Données manquantes** listées en clair dans l’interface et dans le bilan.

Toute modification de ces règles doit incrémenter `REPORT_ENGINE_VERSION`
(`src/lib/report/model.ts`) ; les bilans existants gardent leurs valeurs.

## Rédaction par IA (`src/lib/report/ai.ts`)

- **Fournisseur** : OpenRouter (`OPENROUTER_API_KEY`, point d’accès compatible avec
  l’API Claude) ou API Claude directe (`ANTHROPIC_API_KEY`). Modèle par défaut :
  Claude Opus 5.5 ; `REPORT_AI_MODEL` le remplace. Clés côté serveur uniquement.
- **Données envoyées** : le dossier de `src/lib/report/prompt.ts`. Il contient les
  niveaux, les observations, les commentaires partagés et les activités. Il ne
  contient ni nom, ni structure, ni formateur. Le texte s’adresse au participant en
  le vouvoyant.
- **Sortie structurée** : JSON validé par le schéma `reportContentSchema`
  (`src/lib/report/content.ts`), puis contrôlé par `checkContent` :
  - aucune note chiffrée dans le texte ;
  - pas de fiche pour une compétence non observée ;
  - chaque constat rattaché à une session réellement évaluée ;
  - longueurs maximales.

  En cas d’écart, une seconde demande liste les corrections ; si l’écart persiste,
  rien n’est enregistré.
- **Erreurs gérées** : clé absente ou refusée, crédit épuisé, saturation, délai,
  refus du modèle, réponse illisible ou tronquée. Le brouillon reste utilisable.
- **Repli** : avec l’API Claude directe, le repli automatique en cas de refus est
  activé (`fallbacks: "default"`).

## Versions et droits (`supabase/migrations/20261112090000_participant_reports.sql`)

- `data` (résultats) est **immuable** ; `content` se modifie tant que le bilan est en
  brouillon ; un bilan validé ne se modifie ni ne se supprime.
- La base fixe le numéro de version, l’auteur, la date et l’auteur de la validation.
- Lecture : administrateurs et formateurs du participant (tout) ; participant et
  organisme rattaché (bilans validés uniquement). Écriture : administrateurs et
  formateurs du participant.
- Journal : `report.created`, `report.content_updated`, `report.finalized`,
  `export.report_pdf`.

## PDF (`src/lib/pdf/report/`)

- Rendu par `@react-pdf/renderer`, déjà utilisé par le projet : texte sélectionnable,
  graphiques vectoriels, polices DM Sans et Poppins (licence OFL, `public/fonts/report`).
- Pas de dépendance ajoutée.
- Sections :
  - couverture ;
  - introduction et parcours ;
  - profil ;
  - cartographie (radar et jauges) ;
  - façon d’agir (constats datés, matrice des dimensions des habiletés,
    commentaires) ;
  - fiches détaillées ;
  - recommandations ;
  - synthèse ;
  - méthodologie et limites.
- Une section sans matière est omise plutôt que remplie ; aucune fiche n’est
  produite pour une compétence non observée.

## Limites connues

- HAPPI n’enregistre aucune donnée issue des jeux eux-mêmes (temps, réussites,
  événements de partie). La « façon d’agir en situation » repose donc sur les
  observations des formateurs. Une matrice de tendances comportementales fondée sur
  des mesures de jeu demanderait de collecter ces données.
- Les compétences transversales sont en référentiel provisoire (signalé dans le bilan).
