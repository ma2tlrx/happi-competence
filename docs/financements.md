# Financements : conventions, bilan de l’action et BPF

Objectif : qu’un financeur (France Travail, Région, Département, OPCO, État/DREETS, FSE+, Mission Locale/CEJ,
fondation…) reçoive des preuves de réalisation et des résultats, et que l’organisme prépare son bilan pédagogique
et financier (BPF) sans ressaisie.

## Ce qui existe

| Élément | Où |
|---|---|
| Tables `funders`, `funding_conventions`, `funding_convention_groups` | `supabase/migrations/20261118100000_funding_conventions.sql` |
| Calculs (purs, testés) | `src/lib/funding/` (`realisation.ts`, `indicators.ts`, `bpf.ts`, `csv.ts`) |
| Administration | `/admin/financements` (conventions, fiche, financeurs, BPF) |
| Vue organisme (lecture seule) | `/organisme/financements` |
| Bilan de l’action (PDF) | `/api/exports/financements/[id]/bilan` (`?nominatif=1` : annexe nominative) |
| Réalisation par participant (CSV) | `/api/exports/financements/[id]/realisation` |
| Données BPF (CSV) | `/api/exports/bpf?annee=AAAA` |

Un groupe est rattaché à **au plus une** convention ; une convention regroupe plusieurs groupes. Le co-financement
(un groupe, plusieurs financeurs) n’est pas géré.

## Droits

- **Administrateur** : tout (RLS `private.is_admin()` sur les trois tables, `force row level security`).
- **Organisme** (permission `org.impact.read`, structure active) : aucune lecture directe des tables. La fonction
  `org_funding_conventions()` renvoie les conventions **en cours ou soldées** dont au moins un groupe concerne ses
  participants (`private.org_sees_group` : groupe de l’organisme, ou participant rattaché, abandons compris), avec
  ces seuls groupes, et **sans** montant, notes internes ni contact du financeur. Les indicateurs affichés ne
  comptent que ses participants (données lues avec ses droits : présences si `org.attendance.read`, progression
  si `org.evaluations.read`, sinon « non disponible »).
- **Formateur, participant, visiteur** : aucun accès.
- Exports : administrateur uniquement, contrôle du rôle dans chaque route, traçabilité par
  `log_funding_export()` (actions `export.funding_bilan_action_pdf`, `export.funding_bilan_action_pdf_nominatif`,
  `export.funding_realisation_csv`, `export.bpf_csv`) ; si la trace échoue, l’export est refusé.
- Journal : déclencheurs `private.audit` (`funding.funder_*`, `funding.convention_*`, `funding.group_attached`,
  `funding.group_detached`), sans texte libre ni montant (seule la liste des champs modifiés est notée).

## Règles de calcul

Unité de compte : le **parcours** (un participant inscrit dans un groupe), comme le tableau d’impact. Les
inscriptions retirées pour erreur sont exclues ; les abandons restent comptés.

| Indicateur | Règle | Effectif (n) |
|---|---|---|
| Parcours entrés / conventionnés | parcours des groupes rattachés / participants inscrits à la convention (peut dépasser 100 %) | conventionnés |
| Personnes distinctes | un participant inscrit dans deux groupes de la convention compte une fois | — |
| Heures-stagiaires conventionnées | participants conventionnés × durée prévue par participant | — |
| Heures-stagiaires planifiées | somme des durées prévues des parcours (séances non annulées, complétées par la trame) — `computeRealisation` | — |
| Heures-stagiaires réalisées | **règle du certificat de réalisation** (`src/lib/attendance/hours.ts`) : séance terminée, participant présent, en retard ou parti plus tôt, séance comptée en entier ; durée selon les horaires, sinon la trame du programme, sinon 3 h | — |
| Réalisé / conventionné, réalisé / planifié | heures réalisées / heures conventionnées (ou planifiées) | minutes de référence ; « — » si nulles |
| Assiduité | présences / présences **renseignées** sur les séances terminées (tableau d’impact) | présences renseignées |
| Abandons, motifs | statut `dropped` et motif (`group_members`) | parcours |
| Progression observée | tableau d’impact (au moins une compétence observée deux fois, niveau final > premier) | parcours évaluables |
| Sorties, suivis 3 et 6 mois | tableau d’impact : situation attendue à échéance ; « non renseigné » compté à part, jamais dans une catégorie | situations attendues |
| Satisfaction | module satisfaction : réponses / invités, moyennes des questions notées et indice de recommandation | invités ; réponses par question |
| Pièces justificatives | une feuille d’émargement par séance terminée (contre-signée ou non) ; un certificat par parcours ayant au moins une séance suivie | — |

Signalements (jamais masqués, jamais convertis en zéro) : présences non saisies sur des séances terminées (hors
période postérieure à un abandon), séances sans horaires (durée de la trame), séances terminées hors de la période
conventionnée ou sans date.

## Bilan de l’action (PDF)

Modèle indicatif — à adapter aux exigences du financeur. Sections : identification de l’action et du financeur,
public accueilli, réalisation, abandons par motif, résultats (progression, sorties, suivis), satisfaction, pièces
justificatives. Données agrégées. L’annexe nominative (nom, prénom, groupe, heures réalisées, situation de sortie)
n’est ajoutée que par le bouton dédié (`?nominatif=1`), dont l’usage est tracé à part.

## BPF (cerfa n° 10443)

Écran `/admin/financements/bpf` et CSV, pour une **année civile** choisie.

Fourni par l’application :
- **Cadre F-1, total** : nombre de stagiaires (personnes distinctes ayant au moins une heure réalisée dans l’année)
  et heures-stagiaires réalisées dans l’année, séance par séance (règle du certificat).
- **Aide au cadre C** : stagiaires et heures par famille d’origine du financement, d’après le type du financeur de
  la convention du groupe (correspondance dans `src/lib/funding/labels.ts`, `BPF_ORIGIN_BY_FUNDER`). Groupes sans
  convention : ligne « à déterminer ».
- Aide à la ventilation F-1 : répartition par situation à l’entrée saisie (indicatif, ne vaut pas statut BPF).

« À compléter », jamais estimé : ventilation F-1 par type de stagiaire (statut non saisi), tous les montants du
cadre C (produits HT), cadres F-3 (objectif), F-4 (spécialités), A, B, D, E, G.

### Sources consultées (19 novembre 2026)

Recherches web ; les pages officielles n’ont pas pu être ouvertes depuis l’environnement de développement (hôtes
non autorisés : service-public.fr, dreets.gouv.fr). Les éléments ci-dessous viennent des extraits des résultats de
recherche :
- Notice explicative du BPF, n° 50199 (formulaires.service-public.gouv.fr/cerfas/10443/notice/50199 ;
  travail-emploi.gouv.fr, notice d’août 2025 ; versions DREETS Bretagne, Centre-Val de Loire, DRIEETS Île-de-France).
- Centre Inffo, « Remplir le bilan pédagogique et financier — mode d’emploi » (éditions 2019 à 2025).
- Formulaire cerfa n° 10443 (versions *14 à *17 citées).

Structure retenue : cadres A–B (identification), C (origine des produits : 1 entreprises ; 2 organismes
gestionnaires des fonds de la formation — OPCO, Caisse des dépôts pour le CPF… ; 3 pouvoirs publics pour leurs
agents ; 4 à 8 pouvoirs publics pour des publics spécifiques : instances européennes, État, conseils régionaux,
France Travail, autres ressources publiques ; 9 personnes à titre individuel ; 10 autres organismes de formation ;
11 autres produits), D (charges), E (intervenants), F (F-1 type de stagiaires : salariés d’employeurs privés hors
apprentis, apprentis, personnes en recherche d’emploi, particuliers à leurs frais, autres ; F-2 sous-traitance ;
F-3 objectif ; F-4 spécialités), G (formation confiée par un autre organisme).

### Non vérifié

- **Numérotation exacte des lignes** du cadre C dans la version en vigueur (elle a varié selon les années :
  « autres ressources publiques » en ligne 8 ou 9 selon les sources). Les numéros affichés sont indicatifs.
- Ligne applicable aux fonds d’une **fondation** et aux financements versés par une **Mission Locale** (CEJ).
- Calage exercice comptable / année civile ; date limite de dépôt de l’année (30 avril ou 31 mai selon les sources).
- Définition exacte du « stagiaire » quand une personne suit deux actions dans l’année (compté une fois ici).

## Points à valider par le propriétaire

1. Correspondance type de financeur → ligne du cadre C (`BPF_ORIGIN_BY_FUNDER`).
2. Organisme : accès limité aux conventions en cours/soldées, sans montant, notes ni contact ; exige `org.impact.read`.
3. Un retard ou un départ anticipé compte pour la séance entière (règle du certificat, déjà « à valider »).
4. Mentions légales de l’organisme de formation (SIRET, déclaration d’activité) : toujours « à compléter »
   (`TRAINING_ORGANISATION`).
5. Co-financement d’un même groupe : non géré (une convention par groupe).
6. Données démo : une convention `is_demo` disparaît avec son dernier groupe (déclencheur), puis son financeur démo.
   L’environnement de démonstration créé depuis l’interface (`src/lib/demo/environment.ts`) n’inclut pas encore de
   convention ; `scripts/seed-demo.mjs` en crée une (groupes A et C).
