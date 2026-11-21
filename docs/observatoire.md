# Observatoire des compétences (administration)

Page `/admin/observatoire` (administrateur uniquement), export `/api/exports/observatoire` (mêmes paramètres).
Vue globale des résultats observés de tous les participants, compétence par compétence, avec filtres et
comparaison par un axe. Une seule page ; l'état (référentiel, filtres, axe, fiche ouverte) vit dans l'adresse :
« Copier le lien » la partage.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/evaluation-engine/inputs.ts` | Construction **partagée avec le passeport** : observations validées, réponses d'auto-évaluation, comparabilité des échelles, groupe de référence |
| `src/lib/observatory/axes.ts` | Axes, libellés, lecture et écriture des paramètres d'adresse (liste blanche) |
| `src/lib/observatory/dataset.ts` | Assemblage des lignes lues en un jeu anonyme (pur) |
| `src/lib/observatory/stats.ts` | Moyenne, écart-type, marge, distribution, progression, regard sur soi, masquage (pur) |
| `src/lib/observatory/report.ts` | Rapport agrégé et masqué, constats (pur) — seul objet transmis au navigateur et à l'export |
| `src/lib/observatory/format.ts`, `csv.ts` | Mise en mots des constats, lignes CSV (purs) |
| `src/lib/observatory/load.ts` | Lectures Supabase (serveur), contrôle du rôle |
| `src/components/observatory/` | Écran (vue, carte de chaleur, fiche, visuels) |

## Méthode

- **Unité : une personne.** Valeur d'une compétence pour une personne = exactement celle de son passeport :
  observations **validées** seulement, rattachées au code stable de la compétence, synthétisées par
  `summarizeProfile` / `summarizeSkill` selon la règle de la version (agrégation, arrondi).
- **Version affichée** : la plus récente **publiée** de chaque référentiel (règles, échelle, niveaux,
  compétences actives). Les observations d'une version antérieure de **même échelle** sont reprises par
  code (comme le passeport) ; celles d'une **autre échelle** sont écartées et comptées (avertissement à
  l'écran) : jamais de mélange d'échelles.
- **Manquant ≠ zéro** : une personne sans observation d'une compétence n'entre pas dans son calcul.
  Population d'un référentiel = personnes ayant au moins une observation validée d'une compétence affichée.
- **Distribution** : effectifs par niveau atteint (`levelFor`, arrondi à l'inférieur, comme le passeport).
- **Moyenne et marge à 95 %** : ± 1,96 × écart-type (n − 1) / √n, affichée seulement à partir de 5 personnes.
- **Progression** : dernière − première observation (`summarizeSkill`), pour les personnes observées au moins
  deux fois : écart moyen, nombre en hausse / stables / en baisse. C'est un écart entre observations, **pas un
  gain de formation** (aucun groupe témoin, personnes et séances différentes).
- **Regard sur soi** : auto-évaluation initiale − valeur observée, seulement si l'échelle de l'auto-évaluation
  est celle du référentiel (`selfScaleComparable`, règle du passeport) ; auto-évaluation initiale la plus
  récente, terminée, la dernière réponse d'une compétence dans l'ordre des questions l'emporte. Positif : la
  personne se voit plus haut que ce qui est observé. Sinon « non comparable ».
- **Courbe par session** : moyenne de toutes les observations portant le numéro de session (une valeur par
  personne et par session). Les personnes peuvent changer d'un point à l'autre (effet de composition).
- **Chiffres clés** : personnes observées ; observations validées ; part des progressions en hausse et écart
  moyen du regard sur soi, calculés sur les couples (personne × compétence), chacun avec n.

## Axes (filtres et « comparer par »)

Organisme du participant ; ville de la structure (`organizations.city`) ; programme, cohorte et année d'entrée
(année de début) du **groupe de référence** (même règle que le passeport : inscription active la plus récente,
sinon dernier abandon ; un retrait ne compte pas) ; et, depuis la **fiche d'entrée la plus récente** (date
d'entrée la plus récente, puis dernière mise à jour) : tranche d'âge, genre, niveau de diplôme, situation à
l'entrée, QPV (codes et libellés de `src/lib/fse/codes.ts`). « Non renseigné » est une catégorie à part entière.
Les catégories sensibles (handicap, RQTH, minorité, origine, nationalité, logement) ne sont **ni lues ni
proposées** ; un paramètre d'adresse qui les viserait est ignoré.

## Confidentialité

- Aucun nom, aucun identifiant de personne, aucun commentaire n'est lu ou transmis ; le navigateur ne reçoit
  que le rapport agrégé.
- **Seuil de 5 personnes** : toute case (compétence × segment), tout point de courbe, toute progression ou tout
  regard sur soi portant sur 1 à 4 personnes est masqué (« moins de 5 »), sans effectif ni valeur, à l'écran et
  dans l'export. Un filtre qui laisse moins de 5 personnes affiche un état vide explicite, sans chiffre. Les
  effectifs de filtres et de segments sous 5 s'affichent « moins de 5 ».
- **Masquage complémentaire** : dans une comparaison, si les cases masquées d'une ligne réunissent 1 à 4
  personnes, la plus petite case visible est masquée aussi (sinon « Ensemble − cases visibles » redonnerait
  leur résultat).
- **Démonstration** : un compte réel ne voit que les données réelles ; un compte de démonstration ne voit que
  les données de démonstration (`participants.is_demo`).
- **Constats** : calculés à partir des seules cases affichées (n ≥ 5), jamais rédigés ; l'écart entre segments
  exclut « non renseigné » et signale « écart à confirmer » quand les marges se recoupent.

## Limites

- Les filtres successifs permettent en théorie de recouper deux requêtes (différence de deux populations) ;
  la page est réservée à l'administrateur, qui a déjà accès aux fiches individuelles.
- Une case de 5 personnes ou plus peut être homogène (tous au même niveau) : la moyenne révèle alors le niveau
  de chacun. C'est la limite connue d'un seuil d'effectif.
- La marge suppose des observations indépendantes et un échantillon aléatoire ; ce n'est ni l'un ni l'autre.
- Performance : toutes les lignes utiles sont lues (pages de 1 000, en parallèle) puis calculées en mémoire.
  Adapté jusqu'à quelques milliers de participants (≈ 100 000 notes) ; au-delà, déplacer la synthèse par
  personne et par compétence dans une fonction SQL d'agrégation (ou une vue matérialisée rafraîchie après
  validation d'une évaluation), en gardant le masquage dans `report.ts`.

## Points à valider (propriétaire)

- Séparation stricte réelles / démonstration selon le compte connecté.
- Version affichée = la plus récente publiée (le passeport affiche la plus récente utilisée par la personne ;
  identiques tant qu'un référentiel n'a qu'une version publiée).
- Fiche d'entrée « la plus récente » : date d'entrée, puis dernière mise à jour.
- Année d'entrée = année de début du groupe de référence.
- Journalisation de l'export : action `export.observatory_csv` à ajouter à `public.log_event`.
