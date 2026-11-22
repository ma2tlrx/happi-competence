# Pistes métiers du bilan (recommandations ROME)

Trois pistes de métiers à explorer, calculées **sans IA** et de façon **déterministe** à la création d'un bilan, puis figées avec le reste du bilan
(`ReportData.careerPaths`, moteur `pistes-1.0`, bilan `bilan-1.1`). Ce sont des **recommandations** : aucun score, rang ni pourcentage n'est
affiché ni conservé, aucun niveau n'est modifié. Code : `src/lib/career-paths/`.

## D'où viennent les données

| Donnée | Source | Remarque |
| --- | --- | --- |
| Points d'appui | règle **existante** du moteur d'évaluation (`highlights.strengths`, à partir de 4 compétences observées dans un référentiel) | aucun seuil nouveau |
| Lien compétence HAPPI ↔ savoir-être ROME | `skill_mappings` au statut **validé** (Administration › Référentiels › Correspondances) | 30 propositions en base (`supabase/data/rome-propositions.sql`), à valider par un administrateur |
| Fiches qui mobilisent chaque savoir-être | fichier France Travail « arborescence simplifiée des compétences » 26M10, colonne « Liste des fiches ROME mobilisant l'objet » | table `rome_fiche_savoir_etre` (6 343 liens) |
| Domaines, fiches, appellations | fichier France Travail « arborescence principale du ROME » (19-10-2026) | tables `rome_domains` (14 + 110), `rome_fiches` (1 923) |
| Secteurs visés | questionnaire d'accueil (`participant_intakes.sectors`) | utilisés pour le calcul, **jamais conservés dans le bilan** |

Chargement du référentiel : `python3 -I scripts/rome/build-reference-sql.py --arborescence … --competences … --sortie /tmp/rome.sql`
(fichiers officiels gardés hors du dépôt), puis exécuter le SQL produit avec la clé de service (rejouable).

## Règles (`src/lib/career-paths/engine.ts`)

1. **Ancrages** : savoir-être ROME reliés aux points d'appui par une correspondance validée. Poids du lien : équivalent 1, proche 0,75,
   partiel 0,5 (réglage par défaut, `LINK_WEIGHTS`).
2. **Rapprochement d'une fiche** : somme, sur ses savoir-être qui sont des ancrages, de poids × rareté, avec rareté = ln(1 + N / n)
   (N fiches au total, n fiches qui demandent ce savoir-être). La rigueur (1 238 fiches) distingue moins que « inspirer, donner du sens »
   (82 fiches).
3. **Domaine professionnel** : jugé sur la **moyenne** de toutes ses fiches (0 pour une fiche sans ancrage), pour recommander un domaine
   où les points d'appui comptent souvent, plutôt qu'un métier de niche ; illustré par sa fiche la plus proche (à égalité : attentes de la
   fiche le mieux couvertes, puis famille de métiers la plus large, puis code).
4. **Trois pistes impartiales**, dans trois domaines professionnels différents et si possible trois grands domaines :
   - secteurs déclarés : jusqu'à **deux** pistes dans ces secteurs (de préférence deux secteurs différents), puis **au moins une ouverture**
     hors de ces secteurs, pour ne pas enfermer la personne dans ses premiers choix ;
   - aucun secteur déclaré (ou « Autre » seul) : trois pistes d'après les seuls points d'appui.
5. **Jamais de piste au hasard** : sans référentiel, sans correspondance validée, sans point d'appui ou sans ancrage, aucune piste ;
   le brouillon l'explique, le bilan remis omet la section. Moins de trois domaines possibles : moins de trois pistes (le chapeau s'accorde).
6. Exemples de métiers : trois appellations officielles de la fiche, sans doublon.

Secteurs du questionnaire → ROME (`src/lib/career-paths/sectors.ts`, alignement de nomenclatures modifiable) :
Commerce & vente → D, M17 · Informatique & numérique → M18, I14 · Santé & social → J, K11, K12, K13 · Sécurité & défense → K17, K25 ·
Art & design → B, E, L11, L12, L13, L15 · Hôtellerie & restauration → G11, G13 à G18 · BTP & artisanat → F, B, D11 ·
Sport & animation → G12, L14, K12 · Finance & gestion → C, M12, M13, M14 · Éducation & formation → K21 · Transport & logistique → N ·
Industrie & production → H, I · Autre → aucun.

Toute modification de ces règles incrémente `CAREER_PATHS_ENGINE_VERSION` ; les bilans existants gardent leurs pistes.

## Dans le bilan

Section « Pistes à explorer », après « Recommandations », dans l'aperçu de relecture et le PDF ; masquable par le formateur. Pour chaque
piste : grand domaine, domaine professionnel, origine, exemples de métiers, savoir-être qui en rapprochent et compétences HAPPI observées
correspondantes, code de fiche, source. Les pistes ne sont pas transmises à la rédaction par IA ni à la version facile à lire.

## Limites connues

- Le ROME dit qu'une fiche **mobilise** un savoir-être, pas à quel niveau : aucune correspondance de niveau n'est faite.
- Le ROME ne donne pas le niveau de diplôme : une piste peut viser des métiers réglementés (ex. santé). Le chapeau le rappelle ; un filtre
  (par exemple exclure les praticiens médicaux J11 et J12) serait une décision de l'équipe HAPPI.
- Les savoir-être sont transverses : ils orientent vers des familles de métiers, pas vers un métier précis. Les secteurs déclarés et
  l'échange avec le conseiller restent indispensables.
- RGPD : voir le registre des traitements, T11 (profilage sans décision automatisée ; point résiduel sur l'étiquette « secteur visé »).
