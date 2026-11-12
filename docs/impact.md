# Abandons, situations de sortie, suivis et tableau de bord d'impact

Chantier A2 de `docs/audit-strategique.md` (axe A). Migration : `supabase/migrations/20261113100000_outcomes_and_impact.sql`.

## Abandons
- `group_members.status` : `active`, `dropped` (abandon), `removed` (retrait pour **erreur d'inscription**).
- Un abandon porte un motif (`drop_reason`) et une date (`dropped_at`, point de départ des suivis) ; « Autre motif » exige une précision (`drop_details`, 300 caractères).
- Motifs **provisoires — à valider** : emploi trouvé, entrée en formation, santé, déménagement, motif personnel, sans nouvelles, autre.
- Un abandon n'est plus actif : il disparaît des feuilles de présence et d'évaluation, ne compte plus dans la capacité du groupe et rend le participant affectable à un autre groupe. Il reste visible dans l'historique (fiche, passeport, groupe et séances visibles de l'organisme et du participant) et dans les statistiques. Un retrait en est exclu.
- Journal : `group.member_dropped`, `group.member_drop_updated` (déclencheur, sans le texte libre).

## Alerte de décrochage (`src/lib/outcomes/dropout.ts`, calcul à la volée)
Règles **provisoires** sur les séances terminées : deux dernières présences renseignées « absent » ou « excusé », ou « absent » (sans motif) à la dernière séance terminée. Une présence non saisie est ignorée (ce n'est pas une absence). Affichage : carte « À relancer » du tableau de bord formateur et page groupe.

## Situations des participants (`participant_outcomes`)
- Une ligne par (participant, groupe, moment) ; moments : `entry`, `exit`, `followup_3m`, `followup_6m`.
- Situations — **catégories provisoires, à aligner sur les nomenclatures de vos financeurs (FSE+, France Travail, CEJ)** : emploi durable (CDI, CDD ≥ 6 mois), emploi de transition (CDD < 6 mois, intérim, contrat aidé), formation qualifiante ou certifiante, création d'activité, immersion / stage, recherche active d'emploi, autre étape du parcours (soins, logement, mobilité…), sans nouvelles.
- Écriture : administrateur ; formateur du groupe (permission `outcomes.write`) ; membre de l'organisme du participant (permission `org.outcomes.write`). Lecture : les mêmes, l'organisme avec `org.impact.read`, et le participant pour ses propres lignes. Suppression : administrateur seulement.
- Historique : chaque saisie / modification / suppression est journalisée (`outcome.recorded`, `outcome.updated` avec la situation précédente, `outcome.deleted`).

## Échéancier (`src/lib/outcomes/schedule.ts`)
Date de référence : date d'abandon, sinon date de fin du groupe terminé (statut terminé/archivé ou date de fin dépassée), à défaut date de la dernière séance terminée. Sortie attendue à cette date, puis suivis à +3 et +6 mois. États : à venir, à faire, en retard (plus de 30 jours après l'échéance — **à valider**), renseigné. Pages : `/formateur/suivis`, `/organisme/suivis`, `/admin/suivis`.

## Tableau de bord d'impact (`src/lib/outcomes/impact.ts`)
Pages `/admin/impact` et `/organisme/impact` (permission `org.impact.read`, restreint aux participants de la structure) ; export CSV `/api/exports/impact?type=indicateurs|participants` (cellules protégées contre l'injection de formules).
- Unité : un parcours = une inscription à un groupe ; retraits exclus, abandons comptés.
- Assiduité : présent, en retard, départ anticipé / présences renseignées sur les séances terminées.
- Progression observée : au moins une compétence évaluée (évaluations validées) sur ≥ 2 séances du groupe avec niveau final > initial (même calcul que le passeport : `summarizeSkill`). Sans compétence observée deux fois : « non évaluable », hors dénominateur.
- Situations : taux de suivi = renseignées / attendues (échéance atteinte) ; « non renseigné » affiché à part, jamais compté comme zéro.
- Chaque pourcentage est affiché avec son effectif (n) ; un taux sans effectif est « — ». Pour un organisme sans accès aux présences ou aux évaluations, les indicateurs correspondants sont « non disponible ».
- Filtres : période (chevauchement des dates du groupe), programme, organisme (administrateur).
