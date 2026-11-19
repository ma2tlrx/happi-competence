# Fiabilité de la mesure : seconde cotation, étalonnage, statistiques d'accord

Chantier « Crédibilité de la mesure » (axe B de `docs/audit-strategique.md`). Objectif : mesurer,
et pouvoir montrer, à quel point deux formateurs qui observent le même participant pendant la
même séance attribuent les mêmes niveaux. Ce module **ne change rien** à l'évaluation officielle :
elle reste seule à compter dans le passeport, le bilan, les exports et le CV de compétences.

## Fichiers

| Rôle | Fichier |
|---|---|
| Migration (tables, aveugle, fonctions, RLS) | `supabase/migrations/20261118140000_rating_calibration.sql` |
| Calcul pur (statistiques) | `src/lib/reliability/statistics.ts` (+ `.test.ts`) |
| Appariement et synthèse | `src/lib/reliability/report.ts` (+ `.test.ts`) |
| Export recherche pseudonymisé | `src/lib/reliability/research-export.ts`, `src/app/api/exports/fiabilite/route.ts` |
| Chargement, actions serveur | `src/lib/reliability/load.ts`, `src/lib/reliability/actions.ts` |
| Formateur : « Coter en second » | `src/app/formateur/seconde-cotation/`, `src/components/reliability/second-rating-workspace.tsx` |
| Administrateur : « Fiabilité de la mesure » | `src/app/admin/fiabilite/page.tsx` |
| Page publique « Notre méthode » | `src/app/(public)/methode/page.tsx` (lien dans le pied de page) |
| Tests de droits | `tests/security/calibration.test.ts` |

## Parcours

**Seconde cotation par un formateur du groupe.** Onglet « Coter en second » d'une séance, ou menu
« Seconde cotation ». `start_second_rating` crée un brouillon pour chaque participant actif du
groupe **dont l'évaluation officielle est encore vide** (aucune note, aucun critère, aucun
commentaire). L'animateur de la séance (`sessions.trainer_id`) et l'auteur de l'évaluation
officielle ne peuvent pas coter en second. Bonne pratique : déclarer la seconde cotation avant ou
pendant la séance (co-animation).

**Exercice d'étalonnage (administrateur).** Page « Fiabilité de la mesure » : choisir une séance
(réelle ou de démonstration), des participants et des formateurs, et rédiger le support commun
(vidéo, déroulé écrit…). `create_calibration_exercise` écarte automatiquement : l'animateur,
l'auteur de l'évaluation officielle, et tout formateur du groupe si l'évaluation officielle est
déjà commencée (il a pu la lire). Un formateur invité qui n'est pas formateur du groupe n'a jamais
accès à l'évaluation officielle ; il reçoit le contexte minimal par `get_my_second_ratings`
(prénom et initiale du nom, séance, consignes). Clore l'exercice annule les cotations non soumises.

**Saisie.** Même présentation que l'évaluation officielle (composant `FrameworkSection` réutilisé :
niveaux, libellés, descripteurs, critères, sauvegarde automatique), responsive. « Soumettre » est
définitif ; le formateur voit alors, compétence par compétence, les niveaux de l'évaluation
officielle validée (`get_second_rating_feedback`, sans commentaires).

## Aveugle garanti par la base

Tant qu'un formateur a une seconde cotation **en brouillon** pour (séance, participant) :

- `evaluations_select` et `private.can_read_evaluation` (redéfinis) lui masquent la ligne de
  l'évaluation officielle, ses notes, critères, commentaires, historique et référentiels ;
- `participant_reports_select` et `participant_report_easy_reads_select` (redéfinis) lui masquent
  les bilans du participant, qui reprennent les évaluations validées ;
- `private.can_write_evaluation_draft` (redéfini) et les déclencheurs `calibration_official_guard`
  (sur `evaluations`) et `calibration_official_content_guard` (sur `evaluation_scores`,
  `evaluation_criterion_scores`, `evaluation_comments`) lui interdisent toute écriture, y compris
  par `validate_evaluation` et `amend_evaluation` (SECURITY DEFINER) ;
- après soumission, il ne peut pas devenir l'auteur de l'évaluation officielle de ce participant
  pour cette séance.

Les secondes cotations ne sont lisibles que par leur auteur et l'administrateur ; aucune écriture
directe n'est possible (tout passe par les fonctions). Un administrateur ne peut pas coter en
second : il voit tout, l'aveugle ne pourrait pas être garanti.

**Limite connue.** La base ne peut pas savoir ce qu'un formateur a lu *avant* d'ouvrir sa seconde
cotation : c'est pourquoi l'ouverture est refusée dès que l'évaluation officielle contient quelque
chose. Une conversation orale entre formateurs reste évidemment hors de portée.

## Calculs (`src/lib/reliability/`)

**Unité : une paire** = une compétence d'un participant pour une séance, cotée par l'évaluateur
officiel (évaluation **validée**) et par un second formateur. Règles :

- « non observé » (note nulle) n'est jamais converti en zéro. Observé d'un seul côté : la paire
  sort du calcul et est comptée à part (« observé d'un seul côté ») ; non observé des deux côtés :
  rien à comparer ;
- une note qui n'est pas sur l'échelle (note dérivée non arrondie) est écartée, jamais arrondie ;
- jamais de mélange d'échelles : un tableau par version de référentiel ;
- même compte des deux côtés, ou seconde cotation sans évaluation officielle validée : écartée et
  comptée ;
- « officielle modifiée après » : nombre de secondes cotations dont l'évaluation officielle a été
  corrigée (révision) après leur soumission — signalé, pas exclu (point à valider) ;
- par formateur : toutes les paires où il est l'un des deux observateurs.

| Statistique | Définition | Intervalle à 95 % |
|---|---|---|
| Accord exact | paires de même niveau / n | score de Wilson (1927) |
| Accord adjacent | paires à au plus **un cran** d'écart / n (un cran = le pas de l'échelle : 1, ou 0,5) | Wilson |
| Kappa de Cohen pondéré | poids quadratiques w = 1 − (i − j)² / (k − 1)², sur **toutes** les catégories de l'échelle (Cohen 1968) | erreur type asymptotique de Fleiss, Cohen et Everitt (1969), borné à [−1 ; 1] |
| CCI(1,1) | corrélation intra-classe, modèle à un facteur aléatoire (les paires d'observateurs changent d'un participant à l'autre) : (CMinter − CMintra) / (CMinter + CMintra) | loi de Fisher (Shrout et Fleiss 1979 ; McGraw et Wong 1996) |
| Écart moyen | moyenne de (second − officiel) en crans : tendance d'un observateur à coter plus haut ou plus bas | — |

Kappa non calculable (une seule catégorie utilisée par les deux, ou aucune paire) : affiché comme
tel, jamais remplacé par 0 ou 1. Aucun « score de fiabilité » composite n'est calculé.

**Seuil d'effectif.** Par défaut **30 paires** : règle pratique de Koo et Li (2016) pour une étude
de fidélité (« au moins 30 échantillons hétérogènes »), cohérente avec les tables de taille
d'échantillon de Sim et Wright (2005) pour le kappa. Modifiable par l'administrateur (10 à 1 000,
table `reliability_settings`). En dessous : « effectif insuffisant pour conclure » à côté de la
valeur (administrateur) ; aucune valeur sur la page publique.

**Cas de référence vérifiables à la main** (`statistics.test.ts`) : table [[20, 5], [10, 15]] →
kappa = (0,70 − 0,50) / 0,50 = 0,40 ; dix paires sur l'échelle 1–4 → accord exact 6/10, adjacent
9/10, kappa quadratique = 1 − 0,7 / 2,1 = 2/3. Erreurs types, intervalles et quantiles de la loi F
recoupés avec statsmodels 0.15 (`cohens_kappa`, `proportion_confint` « wilson ») et scipy 1.18.

## Publication et export

- **Page « Notre méthode »** (`/methode`, publique, toujours en ligne) : décrit la méthode à partir
  de faits présents dans l'application. Les statistiques n'apparaissent que si l'administrateur les
  publie (« Publier sur Notre méthode ») : instantané figé avec date de calcul, n par référentiel,
  accord exact, adjacent et kappa avec intervalles ; **données réelles uniquement**, jamais de
  détail par compétence, formateur ou personne. Retrait possible à tout moment.
- **Export recherche** (`/api/exports/fiabilite`, administrateur) : une ligne par compétence cotée
  (y compris « non observé d'un seul côté »), pseudonymes HMAC-SHA-256 (participant, séance,
  formateurs) avec le sel `RELIABILITY_PSEUDONYM_SALT` (variable d'environnement serveur, 32
  caractères minimum ; export refusé sans elle). Ni nom, ni date, ni organisme, ni commentaire.
  Même sel = mêmes pseudonymes d'un export à l'autre ; changer de sel rend les exports
  précédents non rapprochables. Journal : `export.reliability_research_csv`.

## Journal (`private.audit`)

`calibration.started`, `calibration.submitted`, `calibration.exercise_created`,
`calibration.exercise_closed`, `calibration.cancelled`, `reliability.settings_updated`,
`export.reliability_research_csv`. (`public.log_event` n'est pas modifié ; ces libellés sont à
ajouter à `src/lib/audit-labels.ts` si l'on veut un affichage lisible dans le journal.)

## Démonstration

Toutes les tables sont supprimées en cascade avec la séance, le participant ou le compte du
formateur : `purgeDemo` n'a rien à faire de plus. Un exercice peut porter sur une séance de
démonstration ; ses cotations sont exclues des statistiques par défaut (onglet « Réelles et
démonstration » pour les inclure) et toujours exclues de la publication.

## Limites

- Les intervalles supposent des paires indépendantes ; plusieurs compétences d'un même participant
  (et les mêmes formateurs) ne le sont pas : l'incertitude réelle est **plus grande**.
- Une seconde cotation en co-animation n'observe pas exactement les mêmes instants que
  l'évaluateur officiel ; un exercice sur support commun (vidéo) contrôle mieux ce biais.
- Comparaison au seul évaluateur officiel : l'accord entre deux seconds observateurs d'un même
  exercice n'est pas calculé (possible avec l'export).
- Ces statistiques mesurent la **fidélité** (cohérence entre formateurs), pas la **validité** (ce
  que mesurent réellement les niveaux). Aucune promesse de validité scientifique n'est faite.

## Points à valider (propriétaire)

- Seuil par défaut de 30 paires et bornes 10–1 000.
- Définition de l'accord adjacent sur une échelle au demi-point (un cran = 0,5 ici).
- Traitement des évaluations officielles modifiées après la seconde cotation (signalées, non exclues).
- Choix de montrer l'écart moyen et le tableau « par formateur » (outil d'étalonnage, à ne pas
  utiliser pour évaluer les personnes) ; information des formateurs sur ce traitement (RGPD).
- Texte de la page « Notre méthode » et décision de publier des statistiques.
- Sel de pseudonymisation : génération, conservation et rotation ; convention avec le partenaire de recherche.

## Références

- Cohen J. (1968). Weighted kappa. *Psychological Bulletin*, 70(4), 213–220.
- Fleiss J. L., Cohen J., Everitt B. S. (1969). Large sample standard errors of kappa and weighted kappa. *Psychological Bulletin*, 72(5), 323–327.
- Wilson E. B. (1927). Probable inference, the law of succession, and statistical inference. *JASA*, 22(158), 209–212.
- Shrout P. E., Fleiss J. L. (1979). Intraclass correlations: uses in assessing rater reliability. *Psychological Bulletin*, 86(2), 420–428.
- McGraw K. O., Wong S. P. (1996). Forming inferences about some intraclass correlation coefficients. *Psychological Methods*, 1(1), 30–46.
- Koo T. K., Li M. Y. (2016). A guideline of selecting and reporting intraclass correlation coefficients for reliability research. *Journal of Chiropractic Medicine*, 15(2), 155–163.
- Sim J., Wright C. C. (2005). The kappa statistic in reliability studies: use, interpretation, and sample size requirements. *Physical Therapy*, 85(3), 257–268.

## Vérifications après application de la migration

`npm run test:security -- calibration` (aveugle, droits, exercice, cascade), puis parcours manuel :
co-formateur → « Coter en second » → l'évaluation officielle disparaît de sa vue → soumission →
comparaison ; administrateur → exercice sur une séance de démonstration → statistiques → publication
→ `/methode`.
