# Référentiels publics : savoir-être France Travail (ROME 4.0) et compétences transversales ESCO

Chantier F4 de `docs/audit-strategique.md` — « parler le langage des conseillers et des employeurs ».
HAPPI garde ses deux référentiels internes (18 compétences transversales, 16 habiletés socio-cognitives) ;
on leur associe, compétence par compétence, des éléments de référentiels publics, avec la source citée.

## 1. État de la vérification des sources (19 novembre 2026)

**Aucune liste officielle n'a pu être lue depuis l'environnement de développement.** Les tentatives ont échoué
au niveau du réseau (proxy sortant de l'environnement : connexion refusée, nom d'hôte non résolu) pour :

| Hôte | Usage prévu | Résultat |
| --- | --- | --- |
| `www.data.gouv.fr` | jeu de données ROME et API ROME 4.0 | refusé (hôte non autorisé dans l'environnement) |
| `www.francetravail.org` | page open data du ROME | refusé |
| `esco.ec.europa.eu` | portail ESCO (téléchargement, hiérarchie des compétences transversales) | refusé |
| `ec.europa.eu` | API ESCO (`/esco/api`) | refusé |

En conséquence, et conformément à la règle « ne rien compléter de mémoire » :

- **aucun élément n'est importé** par la migration ; les tables sont créées vides ;
- aucun libellé, code, URI, numéro de version ou texte de licence n'est inscrit dans le code ;
- aucune correspondance, même proposée, n'est créée par la migration.

Pour lever le blocage : autoriser ces hôtes dans les réglages réseau de l'environnement, ou télécharger les fichiers
depuis un poste ordinaire, puis lancer l'import (section 3).

### Pages officielles à consulter (adresses relevées par moteur de recherche, contenu non lu)

Ces adresses sont des points d'entrée ; leur contenu, la version courante et la licence exacte **restent à vérifier**
par la personne qui télécharge, et à reporter dans la commande d'import.

- ROME (France Travail) — jeu de données : <https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome>
- API ROME 4.0 (France Travail) : <https://www.data.gouv.fr/fr/dataservices/672cf64aa47b8d4c15d13d58> (accès développeur sur francetravail.io)
- Open data ROME (France Travail) : <https://www.francetravail.org/opendata/repertoire-operationnel-des-meti.html>
- ESCO — téléchargement : <https://esco.ec.europa.eu/en/use-esco/download>
- ESCO — compétences transversales : <https://esco.ec.europa.eu/en/node/237> (page « Transversal knowledge, skills and competences » selon le moteur de recherche)
- Décision 2011/833/UE sur la réutilisation des documents de la Commission (base juridique de la réutilisation d'ESCO) : <https://eur-lex.europa.eu/eli/dec/2011/833/oj>

Indications issues des seuls résumés de recherche, **non vérifiées sur la source et non utilisées** : le ROME 4.0
comporterait un domaine « savoir-être professionnels » de 16 macro-compétences, diffusé sous Licence Ouverte 2.0 ;
ESCO serait réutilisable librement au titre de la décision 2011/833/UE, avec une version 1.2.x en cours. À confirmer
au moment du téléchargement.

## 2. Modèle de données (`supabase/migrations/20261118130000_public_skill_frameworks.sql`)

- `external_frameworks` : code interne, nom, éditeur, **version**, **adresse de la source**, **licence**, **date de récupération**, notes.
- `external_skills` : code ou URI fourni par la source, libellé, définition (seulement si la source en donne une),
  `is_active` (faux si l'élément a disparu au dernier import : conservé pour ne pas casser les correspondances).
- `skill_mappings` : compétence HAPPI (référentiel + code stable `skills.code`, qui survit aux nouvelles versions),
  élément externe, type de lien (`equivalent` équivalent, `close` proche, `partial` partiel), statut (`proposed`, `validated`),
  origine (`manual` ou `label_match`), justification, proposée par / le, validée par / le.

Règles garanties par la base (RLS + déclencheur `private.skill_mappings_guard`) :

- référentiels publics lisibles par tout utilisateur connecté, jamais anonyme ; écriture par l'administrateur seulement ;
- correspondances écrites par l'administrateur seulement ; **hors administration, seules les validées sont lisibles** ;
- une correspondance naît toujours « proposée » ; la validation exige un administrateur identifié (`auth.uid()` non nul) :
  la clé de service et le script d'import **ne peuvent pas valider** ; l'auteur et l'heure de validation sont posés par la base ;
- une correspondance validée ne change pas de type ni de justification sans repasser en « proposée » ; la cible ne change jamais ;
- journal (`private.audit`) : `external_framework.created|updated|deleted`, `external_skills.imported|updated|deleted`
  (une ligne par import), `skill_mapping.proposed|validated|unvalidated|updated|removed`.

## 3. Importer un référentiel

1. Télécharger le fichier officiel (CSV ou JSON) **en dehors du dépôt** (le script refuse un fichier situé dans le dépôt :
   la licence des données n'est pas celle du code). Noter l'adresse, la version, la licence et la date.
2. Ouvrir le fichier et repérer les noms exacts des colonnes (code ou URI, libellé, définition, éventuelle colonne de type
   pour ne garder que les savoir-être ou les compétences transversales). Le script n'en suppose aucun.
3. Essai à blanc (rien n'est écrit ; affiche les éléments lus et les propositions possibles) :

```bash
npm run referentiels:import -- \
  --fichier ~/telechargements/referentiels/fichier-officiel.csv \
  --code esco_transversal --nom "Compétences transversales ESCO" --editeur "Commission européenne" \
  --version "<version lue sur la source>" --source "<adresse https de la page de téléchargement>" \
  --licence "<licence telle qu'énoncée par la source>" --date 2026-11-19 \
  --colonne-code "<colonne code/URI>" --colonne-libelle "<colonne libellé>" --colonne-definition "<colonne définition>" \
  [--filtre-colonne "<colonne type>" --filtre-valeur "<valeur>[,<valeur>]"] \
  --essai
```

4. Même commande sans `--essai` pour importer, et avec `--proposer` pour créer les propositions automatiques.
   Variables nécessaires (fichier `.env.local`) : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   La commande lance `node --experimental-strip-types` : le script réutilise le module pur `src/lib/public-frameworks/import.ts`.

Ré-import d'une nouvelle version : relancer avec le même `--code` et la nouvelle `--version` ; les éléments sont mis à jour
par code, les absents passent inactifs (signalés « absent du dernier import » dans l'interface).

## 4. Propositions automatiques et validation

Le script ne propose une correspondance (`origin = label_match`, type « équivalent », statut « proposée ») que si le libellé
HAPPI et le libellé externe sont **identiques**, ou **quasi identiques** (seules la casse, les accents, la ponctuation ou les
espaces diffèrent — ex. « Esprit d'équipe » / « ESPRIT D’ÉQUIPE »). Ni pluriel, ni synonyme, ni recouvrement de sens :
c'est une décision pédagogique. Chaque proposition porte sa justification (libellés comparés, source, code).

**À faire par le propriétaire** dans Administration › Référentiels › Correspondances : comparer les définitions, choisir le type
de lien, valider ou retirer chaque proposition, et ajouter les correspondances non évidentes (recherche par libellé, code ou mot
de la définition ; filtres par référentiel HAPPI, statut, référentiel public et nom).

## 5. Où les correspondances validées apparaissent

Toujours avec la source (nom, éditeur, version) et la mention « elle ne modifie pas le niveau observé » ; jamais les propositions ;
aucun niveau ni score modifié.

- Passeport / fiche compétence (participant et professionnels) : carte de chaque compétence (`src/components/passport/skill-card.tsx`).
- CV de compétences (`src/lib/skills-cv.ts`, PDF `src/lib/pdf/skills-cv-document.tsx`) : au plus 2 correspondances par compétence,
  sources listées dans l'encadré « Méthode » ; le document reste sur une page.
- Page publique `/verifier/[token]` : pour les compétences partagées seulement (les habiletés socio-cognitives uniquement si le
  participant les a incluses dans le lien).
- Export CSV des résultats d'un participant pour un conseiller : `/api/exports/resultats/[participantId]` (bouton « Résultats (CSV) »
  de la fiche ; organisme avec la permission d'export, formateur du groupe, administrateur, participant lui-même — mêmes droits que le PDF).

## Import du ROME — arborescence des métiers (22 novembre 2026)

Fichier fourni par HAPPI : « Arborescence principale du ROME » (France Travail, 19-10-2026) : 14 grands domaines,
110 domaines professionnels, 1 923 fiches, 16 253 appellations. **Ce fichier ne contient ni compétences ni
savoir-être** : il décrit les métiers. Il n'est donc pas la liste « savoir-être professionnels ROME 4.0 » prévue plus haut.

- Importé comme référentiel externe `rome_metiers`, une ligne par **fiche** (code ROME, ex. `A1101`). Le fichier ne donne pas
  d'intitulé de fiche : le libellé est composé du code et des deux premières appellations ; la définition donne le domaine, le
  domaine professionnel et toutes les appellations. Aucun intitulé n'est inventé.
- Licence non lue dans le fichier : indiquée comme « à vérifier » dans l'import.
- Les correspondances avec les compétences transversales HAPPI se font dans « Correspondances ROME et ESCO » : elles naissent
  « proposées », l'administrateur les valide (choix pédagogique, aucune correspondance automatique).
- Fait en local ; en production, relancer la commande d'import (clé de service requise) avec le même fichier converti.

## Import des savoir-être ROME 4.0 (22 novembre 2026)

Fichier fourni par HAPPI : « arborescence simplifiée des compétences » (France Travail, version 26M10 du ROME 4.0, 19 582 compétences,
6 domaines, 32 enjeux, 84 objectifs, 506 macro-compétences). Feuille « REF - Macro » : 16 macro-compétences de type
« Savoir-être professionnel » (domaine « Savoir-être professionnels », objectif « Agir et interagir en contexte professionnel »),
codes 6D101 à 6D116, avec leur définition. Ce sont les 16 savoir-être attendus (l'écoute, l'esprit d'équipe, la force de proposition…).

- Importés comme référentiel externe `rome_savoir_etre` (code macro, libellé et définition du fichier, sans rien ajouter).
- Aucune correspondance proposée automatiquement (aucun libellé identique à ceux de HAPPI) : à construire dans
  « Correspondances ROME et ESCO », une à une, par un administrateur. Seules les correspondances validées sont visibles des participants.
- Fait en local ; en production, relancer la commande d'import (clé de service requise).

## Passerelle HAPPI ↔ ROME 4.0 savoir-être (22 novembre 2026)

Étude : les 34 compétences HAPPI (18 transversales sur l'échelle 1 à 5, 16 habiletés socio-cognitives sur 1 à 4, descripteurs
de niveau et critères d'observation) confrontées aux 16 savoir-être ROME (définition officielle du fichier 26M10).
Fichier rejouable : `supabase/data/rome-propositions.sql`. **30 correspondances « proposées »** (5 équivalentes, 13 proches,
12 partielles) sont en base, avec leur justification ; **aucune n'est validée** : un administrateur identifié les examine
dans Administration › Référentiels › Correspondances (seul moyen de les rendre visibles des participants).

- **Transversales** : 16 de 18 reliées (équivalences : esprit d'équipe, leadership, force de proposition, curiosité, autonomie).
  Sans correspondance ROME : *Compréhension*, *Analyse des problèmes* (compétences cognitives, hors savoir-être ROME).
- **Socio-cognitives** : 8 de 16 reliées (auto-régulation, auto-organisation, auto-mobilisation, sensibilité sociale,
  adaptation relationnelle, coopération, planification, flexibilité mentale). Les 8 autres (auto-évaluation, raisonnement logique,
  arbitrage, traitement de l'information, synthèse, conceptualisation, projection, approche globale) sont cognitives : pas de
  savoir-être ROME équivalent.
- **Côté ROME sans équivalent HAPPI** : *sens des responsabilités* (6D104) et *sens du service* (6D116).
- **Barèmes** : la passerelle ne convertit aucun niveau. Les savoir-être ROME n'ont pas d'échelle de maîtrise ; une correspondance
  dit « de quoi on parle », jamais « quel score ». Aucune note, aucun barème ni aucun résultat n'est modifié.
- **Métiers** : la relation compétence ↔ fiches métiers n'est pas proposée automatiquement (le fichier donne, pour chaque
  savoir-être, la liste des fiches qui le mobilisent, mais presque tous concernent des centaines de fiches : peu informatif).
