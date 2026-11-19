# Fiche d'entrée / de sortie FSE+ et indicateurs des financeurs publics

Chantier F2. Migration : `supabase/migrations/20261118110000_participant_entry_profile.sql`. Calcul : `src/lib/fse/`.

> **Statut : provisoire — à valider** avec l'autorité de gestion (DREETS, Région ou organisme intermédiaire qui instruit le dossier FSE+),
> le délégué à la protection des données et un juriste (base légale). Aucune donnée n'est supprimée automatiquement.

## 1. Sources et limites de la recherche

La recherche a été faite le 18 novembre 2026. **Les textes officiels n'ont pas pu être ouverts directement** : l'environnement de travail
n'autorisait pas l'accès à `eur-lex.europa.eu`, `fse.gouv.fr`, `legifrance.gouv.fr` ni aux sites des DREETS et des Régions (refus réseau).
Les informations ci-dessous proviennent d'extraits renvoyés par un moteur de recherche, qui citent ces documents. Chaque point non lu dans
le texte source est marqué **à vérifier**.

Nouvelle tentative le 19 novembre 2026, après ouverture réseau de `eur-lex.europa.eu`, `ec.europa.eu`, `travail-emploi.gouv.fr` et
`www.service-public.fr` : **toujours aucune lecture possible**. EUR-Lex renvoie une réponse vide (code 202, page de vérification anti-robot) ;
`travail-emploi.gouv.fr` refuse la requête (« Request Rejected ») ; `www.service-public.fr` redirige vers `www.service-public.gouv.fr`
(hôte non ouvert) ; la boîte à outils de la Commission est sur `sfc.ec.europa.eu` (hôte non ouvert). Les points « à vérifier » restent donc
à contrôler par une personne, navigateur en main, sur les liens ci-dessous.

| Réf. | Source | Ce qu'on en a tiré | Lu en entier ? |
| --- | --- | --- | --- |
| [R1] | Règlement (UE) 2021/1057 du 24 juin 2021 (FSE+), JO L 231 du 30.6.2021 — <https://eur-lex.europa.eu/eli/reg/2021/1057> | Annexe I : indicateurs communs de réalisation et de résultat pour les participants ; art. 2 : définition de l'indicateur de résultat à long terme (« effets six mois après que le participant a quitté l'opération ») | Non — **à vérifier** |
| [R2] | Commission européenne, *ESF+ Common indicators toolbox*, octobre 2021 — <https://sfc.ec.europa.eu/system/files/documents/documents/toolbox-october-2021_0.pdf> | Codes EECO01…EECO17, EECR01…EECR06 ; EECO17 selon la classification DEGURBA ; EECO13 (citoyenneté) ≠ EECO14 (pays de naissance des parents, définition nationale) ; EECO15 définition nationale ; échantillonnage possible pour EECR05/EECR06 ; EECR05 et EECR06 non cumulables (populations différentes) | Non (table des matières et extraits) — **à vérifier** |
| [R3] | Commission européenne, FAQ SFC sur les indicateurs participants — <https://sfc.ec.europa.eu/en/2014/support-ms/part/faq/how-often-should-indicators-participants-be-collected-and-reported> et pages voisines | « Au terme de la participation » = date de sortie ou jusqu'à 4 semaines après ; date de sortie individuelle (pas la fin de l'opération) ; sortants précoces inclus ; EECR01 et EECR04 exclusifs, la dernière situation de la fenêtre l'emporte | Extraits ; certaines FAQ datent de 2014-2020 — **à vérifier pour 2021-2027** |
| [R4] | Liste des indicateurs communs participants FSE+ 2021-2027, Région Pays de la Loire — <https://dechets-economiecirculaire.paysdelaloire.fr/sites/default/files/2022-11/Liste%20Indicateurs%20communs%20participants%20FSE%2B%2021-27%20VD.pdf> | Libellés français EECO02, EECO03, EECO04, EECR01…EECR05 | Extraits |
| [R5] | Boîte à outils des indicateurs communs FSE, Pas-de-Calais — <https://essentiel62-jeu.pasdecalais.fr/content/download/33417/320205/version/1/file/boite_a_outils_indicateurs_communs_fse.pdf> | Libellés EECO05, EECO06, EECO11, EECO16, EECR01, EECR03 | Extraits |
| [R6] | Fiche indicateurs, Nouvelle-Aquitaine — <https://www.europe-en-nouvelle-aquitaine.eu/sites/default/files/2023-03/Annexe2_CAE_IndicateursFSE.pdf> et formulaire « Suivi participants » <https://europe-en-nouvelle-aquitaine.eu/sites/default/files/2022-10/Suivi_Participants_Contenu_Formulaire_Annexe_MDNA.pdf> | EECO09 « CITE 0 à 2 » ; question de sortie « qualification obtenue : oui / non » | Extraits |
| [R7] | Questionnaire de recueil des données à l'entrée des participants, ministère du Travail, décembre 2022 (DEETS Guyane, DREETS Hauts-de-France) — <https://guyane.deets.gouv.fr/sites/guyane.deets.gouv.fr/IMG/pdf/questionnaire_participant_fse_decembre_2022_vf.pdf> ; notice DREETS Grand Est <https://grand-est.dreets.gouv.fr/sites/grand-est.dreets.gouv.fr/IMG/pdf/Questionnaire_V1-2_notice.pdf> | Données reportées dans « Ma démarche FSE+ » (saisie directe, papier ou import Excel) ; situation au jour de l'entrée ; champs bloquants au bilan final : date d'entrée, statut sur le marché du travail, niveau de diplôme ; questions « inscrit à Pôle emploi », plus haut diplôme ; conserver les questionnaires comme preuve | Extraits — **libellés exacts des questions à vérifier** (RQTH, QPV, minima sociaux non confirmés dans la version 2022) |
| [R8] | Annexe IV indicateurs, DREETS Hauts-de-France — <https://hauts-de-france.dreets.gouv.fr/sites/hauts-de-france.dreets.gouv.fr/IMG/pdf/annexe_iv_indicateurs.pdf> ; note CD Vaucluse | Chômeur de longue durée = statut chômeur à l'entrée et durée de chômage ≥ 12 mois | Extraits (document 2014-2020) |
| [R9] | Cour des comptes européenne, rapport spécial 25/2021 — <https://www.eca.europa.eu/Lists/ECADocuments/SR21_25/SR_Long-term_unemployment_FR.pdf> | CLD : sans emploi et en recherche active depuis au moins 12 mois (OIT / Eurostat) | Extraits |
| [R10] | Décret n° 2019-14 du 8 janvier 2019 (cadre national des certifications professionnelles) — Centre Inffo <https://www.centre-inffo.fr/site-droit-formation/actualites-droit/cadre-national-des-certifications-publication-du-decret-2> ; ministère de l'Enseignement supérieur <https://www.enseignementsup-recherche.gouv.fr/fr/nomenclature-relative-au-niveau-de-diplome-45785> | 8 niveaux ; CAP/BEP = niveau 3 (ex-V), bac = niveau 4 (ex-IV) ; critères dans l'arrêté du 8 janvier 2019 | Extraits |
| [R11] | INSEE, Classification internationale type de l'éducation (CITE 2011) — <https://www.insee.fr/fr/metadonnees/definition/c1746> | Nomenclature internationale ; niveau 8 = doctorat | Extraits — **correspondance niveau français → CITE à vérifier** |
| [R12] | Décret n° 2023-1314 du 28 décembre 2023 (liste des QPV de métropole, en vigueur le 1er janvier 2024, abroge le décret 2014-1750) — <https://www.legifrance.gouv.fr/eli/decret/2023/12/28/2023-1314/jo/texte> ; périmètres sur data.gouv.fr | Résidence en QPV | Extraits |
| [R13] | Loi n° 2023-1322 du 29 décembre 2023 de finances pour 2024, art. 73 — service-public.fr <https://www.service-public.gouv.fr/entreprendre/actualites/A17460> | Les ZRR sont remplacées par les zones France Ruralités Revitalisation (FRR) au 1er juillet 2024 | Extraits |
| [R14] | Décret n° 2022-199 du 18 février 2022 relatif au contrat d'engagement jeune — Banque des territoires <https://www.banquedesterritoires.fr/contrat-dengagement-jeune-le-decret-de-mise-en-oeuvre-paru> | CEJ : 16-25 ans (29 ans si RQTH), Mission Locale ou France Travail | Extraits |
| [R15] | CNIL, fiche pratique (handicap = donnée de santé, donnée sensible ; AIPD recommandée) — <https://france-paralympique.fr/wp-content/uploads/2024/06/cnil-fiche-pratique-cpsf.pdf> | Données de handicap / RQTH = catégorie particulière (art. 9 RGPD) | Extraits (contexte sportif, par analogie) |

Points non trouvés : l'option « ne souhaite pas répondre » dans le questionnaire national (ajoutée ici par principe de minimisation, **à
vérifier** avec l'autorité de gestion), la présence des questions « origine étrangère » et « minorité » dans le questionnaire français (**à
vérifier** : leur collecte est particulièrement encadrée en France), le seuil de chômage de longue durée pour les moins de 25 ans (**à
vérifier**), la loi pour le plein emploi (inscription des bénéficiaires du RSA et des jeunes suivis par les Missions Locales à France Travail)
non confirmée par les extraits, l'annexe II du règlement (selon les extraits, l'annexe II concerne l'inclusion sociale des personnes les plus
démunies et l'annexe III la privation matérielle — **à vérifier** ; ces deux annexes ne s'appliquent pas à une action d'insertion comme HAPPI).

## 2. Fiche d'entrée (`participant_entry_profiles`)

Une ligne par participant et par groupe (parcours). Une fiche « hors groupe » (`group_id` nul) sert de fiche par défaut pour les parcours
qui n'ont pas leur propre fiche. Aucune date de naissance n'existe dans HAPPI : on enregistre une **tranche d'âge à l'entrée**.

| Donnée | Valeurs | Source |
| --- | --- | --- |
| Date d'entrée | date (saisie par le professionnel) | [R7] champ bloquant |
| Genre | femme, homme, non binaire, ne souhaite pas répondre | ventilation par genre des indicateurs [R4][R5] ; catégorie « non binaire » **à vérifier** |
| Tranche d'âge | < 18, 18-29, 30-54, 55 et plus | EECO06-EECO08 [R2][R5] |
| Situation sur le marché du travail | chômeur, inactif, en emploi (y compris indépendant) | EECO02, EECO04, EECO05 [R4][R5] |
| Durée de chômage / d'inscription | < 6 mois, 6-11, 12-23, ≥ 24 mois (si chômeur) | EECO03 [R8][R9] |
| Niveau de diplôme | sans diplôme, niveaux 1 à 8 du cadre 2019 | [R10] |
| Niveau CITE | 0-2, 3-4, 5-8 — **colonne générée** à partir du niveau français | EECO09-EECO11 [R2][R6] ; correspondance **à vérifier** [R11] |
| Facultatif FSE+ : handicap, ressortissant de pays tiers, origine étrangère, minorité, sans domicile / exclusion du logement, zone rurale | oui, non, (ne sait pas), **ne souhaite pas répondre** | EECO12-EECO17 [R2][R5] |
| Dispositifs : inscrit France Travail, CEJ, RSA, RQTH, QPV, commune FRR (ex-ZRR) | oui, non, ne sait pas, ne souhaite pas répondre | [R7][R12][R13][R14] |

Correspondance niveau français → CITE retenue (**à vérifier**, [R10][R11]) : sans diplôme / niveaux 1-2 → CITE 0-2 ; niveaux 3 (CAP, BEP) et 4
(bac) → CITE 3-4 ; niveaux 5 à 8 → CITE 5-8.

« Fiche complète » = date d'entrée, statut (et durée si chômeur), diplôme, âge et genre renseignés (champs bloquants de [R7] + ventilations).

### Droits (RLS forcée)
- Lecture / écriture : administrateur ; membre de l'organisme de rattachement du participant ayant la permission **`org.entry_profile.manage`**
  (accordée par défaut au rôle organisme — **à valider**, retirable dans Paramètres) ; **le participant lui-même** (il complète et corrige ;
  la date d'entrée reste celle du professionnel ; sa relecture est horodatée `participant_confirmed_at`).
- **Jamais le formateur** : aucune clause `trains_participant` / `trains_group`. Le formateur n'a pas non plus accès aux pages ni aux exports.
- Suppression : administrateur seulement (cascade à la suppression du participant ou du groupe, donc purge de la démonstration).

### Information de la personne (art. 13 RGPD)
Mention affichée dans l'espace participant (« Ma fiche d'entrée ») et sur l'écran de saisie du professionnel (`PRIVACY_NOTICE`,
`src/lib/fse/codes.ts`) : finalité (statistiques et rapports aux financeurs, sans effet sur le parcours ni les droits), destinataires
(administrateur, structure d'accompagnement habilitée, jamais le formateur), droit de ne pas répondre, droit de rectification dans
l'espace. Le professionnel coche « la personne a reçu l'information » ; la première date est conservée (`participant_informed_at`).
**Base légale : à valider par un juriste** (obligation légale liée au règlement FSE+ / mission d'intérêt public, et pour les données
de santé une exception de l'art. 9.2 à déterminer). Une AIPD est recommandée [R15].

### Journal
- Déclencheur `participant_entry_profiles_audit` → `private.audit` : `entry_profile.recorded`, `entry_profile.updated` (**liste des champs
  modifiés, jamais les valeurs**), `entry_profile.deleted`.
- Fonction `public.log_entry_profile_event` (sans toucher `log_event`) : `entry_profile.viewed` (ouverture de la fiche par un professionnel),
  `export.fse_participants_csv`, `export.fse_indicators_csv`. Refusée au formateur et hors périmètre.

### Conservation
Aucune suppression automatique. Les pièces d'une opération cofinancée doivent être conservées pendant la durée fixée par le règlement
portant dispositions communes (règlement (UE) 2021/1060, art. 82 : en principe cinq ans à compter du 31 décembre de l'année du dernier
paiement au bénéficiaire — **à vérifier**, non lu dans le texte) et par la convention de l'opération. Durée à inscrire dans la politique de
confidentialité ; purge manuelle par l'administrateur à l'échéance.

## 3. Situations de sortie → indicateurs de résultat (`src/lib/fse/outcomes.ts`)

| Situation HAPPI | Indicateur FSE+ |
| --- | --- |
| Recherche active d'emploi | EECR01 en recherche d'emploi au terme de la participation |
| Formation qualifiante ou certifiante ; **Autre formation ou reprise d'études** (nouvelle, provisoire) | EECR02 suivant un enseignement ou une formation |
| Case **« qualification obtenue »** (nouvelle colonne, sortie uniquement ; vide = non renseigné) | EECR03 obtenant une qualification |
| Emploi durable, emploi de transition, création d'activité | EECR04 en emploi, y compris indépendant |
| Mêmes codes emploi, au suivi à 6 mois | EECR05 en emploi six mois après la sortie |
| Immersion ou stage, autre étape, sans nouvelles | aucun (immersion : **à valider**) |
| — | EECR06 situation améliorée à 6 mois : **non calculé** (définition à vérifier) |

- Fenêtre « au terme de la participation » : la situation de sortie doit être observée entre la date de sortie et **28 jours** après [R3].
  Hors fenêtre (avant la sortie ou après 28 jours, ou date de sortie inconnue) : compté « hors délai », jamais dans l'indicateur.
- Date de sortie : date d'abandon, sinon date de fin du groupe terminé, à défaut dernière séance terminée (même règle que `docs/impact.md`).
- Les données existantes ne changent pas : la contrainte de `participant_outcomes.situation` est élargie, la colonne ajoutée est nullable.
- Libellés des indicateurs (EECO09-EECO11, EECR02 notamment) : reformulés d'après les extraits — **libellés officiels à vérifier** sur [R1].

## 4. Calcul des indicateurs (`src/lib/fse/indicators.ts`, testé dans `indicators.test.ts`)
- Unité : un parcours = une inscription à un groupe ; retraits exclus, abandons comptés.
- Pour chaque indicateur : effectif concerné, ventilé par genre (femmes, hommes, non binaires, genre non communiqué), et **à part** :
  non renseigné, ne souhaite pas répondre, ne sait pas / sans nouvelles, hors délai ; base (n) = tous les parcours (réalisation) ou les
  sorties / suivis à 6 mois attendus (résultat). Une donnée manquante n'est jamais comptée à zéro.
- Agrégats : ensemble, par cohorte, par organisme ; filtres période (chevauchement des dates du groupe), programme, organisme.

## 5. Écrans et exports
- Participant : `/participant/fiche-entree` (menu « Ma fiche d'entrée ») — information, questions simples à la première personne, toutes
  facultatives, « Je ne souhaite pas répondre » toujours proposé, boutons radio de 40 px qui passent à la ligne (360 px).
- Organisme : carte « Fiche d'entrée » sur la fiche participant, saisie sur `/organisme/participants/[id]/fiche-entree`.
- Administration : onglet **Admin › Impact › FSE+** (`/admin/impact/fse`) : indicateurs, détails par organisme et par cohorte, liste des
  fiches à compléter, saisie sur `/admin/impact/fse/[participantId]`.
- Exports : `/api/exports/fse?type=participants` (fichier participants : une ligne par parcours, entrée + sortie) et
  `?type=indicateurs` (tableau agrégé). Contrôle de rôle serveur : administrateur, ou organisme avec `org.entry_profile.manage` **et**
  `org.impact.read` (sinon les sorties seraient faussement « non renseignées ») ; RLS + filtre organisme explicite ; export journalisé.
- Export RGPD du participant (`/api/exports/mes-donnees`) : ajoute ses fiches d'entrée et la qualification de sortie.
- Export de réversibilité (`public.export_platform_data`) : **n'inclut pas** encore les fiches d'entrée (décision à prendre).

## 6. À valider par le propriétaire
1. Liste des données et libellés (genre non binaire, origine étrangère, minorité : à collecter ou non en France).
2. Permission `org.entry_profile.manage` accordée par défaut à l'organisme.
3. Correspondance niveau 2019 → CITE ; seuil de chômage de longue durée des moins de 25 ans.
4. Correspondance situations → EECR (immersion, autre étape) ; fenêtre stricte de 28 jours.
5. Mention d'information, base légale, AIPD, durée de conservation.
6. Méthode d'EECR06 avant tout calcul.
