# Architecture technique

## Vue d’ensemble

```
Navigateur ──► Next.js 16 (App Router, React 19, TypeScript strict)
                │  proxy.ts        rafraîchit la session, protège les routes privées
                │  layouts         contrôle du rôle côté serveur (requireRole)
                │  pages serveur   lecture avec la session de l'utilisateur → RLS
                │  actions serveur écritures validées (Zod) puis RLS / fonctions SQL
                │  routes /api     exports PDF (react-pdf) et CSV
                ▼
             Supabase : PostgreSQL (RLS sur toutes les tables), Auth (GoTrue), API (PostgREST)
```

- **Aucune donnée n’est lue avec des privilèges élevés pour l’affichage.** Les pages
  utilisent le client lié aux cookies de l’utilisateur : ce sont les politiques RLS
  qui déterminent ce qui est visible. Le client à clé de service (`src/lib/supabase/admin.ts`)
  ne sert qu’à : vérifier et consommer un code d’accès, enregistrer un message de
  contact, bloquer la connexion d’un compte désactivé, supprimer un compte (RGPD).
- Les contrôles qui croisent plusieurs tables passent par des fonctions
  `SECURITY DEFINER` du schéma `private` (non exposé par l’API).

## Arborescence

```
src/
  app/
    (public)/            site vitrine : accueil, programme, approche, compétences, contact, pages légales
    (auth)/              connexion, inscriptions, accès par code, mot de passe
    (account)/           mon compte, notifications (tous rôles)
    participant/         passeport de compétences
    organisme/           suivi des participants rattachés (lecture seule)
    formateur/           groupes, sessions, présences, évaluations, lecteur pédagogique
    admin/               administration complète
    api/exports/         passeport PDF, feuilles de présence PDF/CSV, participants CSV, mes données
  components/            design system (ui/), passeport, coque applicative, site public
  lib/
    evaluation-engine/   moteur de calcul pur et testé (modes de notation, synthèse, points saillants)
    pedagogy/parse.ts    analyse des supports Markdown en séquences
    passport.ts          lecture du passeport (partagée par tous les espaces)
    auth/                rôles, permissions, utilisateur courant
    pdf/                 documents PDF
supabase/
  migrations/            schéma, déclencheurs, fonctions métier, RLS, données de référence
  local/                 pile Docker de développement
scripts/                 pile locale, données de démonstration, provisionnement d’accès
tests/security/          tests d’isolation contre l’API réelle
tests/e2e/               scénarios Playwright
```

## Modèle de données

| Domaine | Tables |
| --- | --- |
| Comptes | `profiles` (1:1 `auth.users`), `roles`, `permissions`, `role_permissions` |
| Organismes | `organizations`, `organization_members` |
| Participants | `participants`, `participant_organization_history` |
| Programme | `programs`, `program_sessions` (trame), `program_frameworks` (version active par référentiel) |
| Groupes | `groups`, `group_trainers`, `group_members` |
| Sessions | `sessions`, `attendance`, `attendance_history` |
| Référentiels | `frameworks`, `framework_versions`, `scale_levels`, `skill_categories`, `skills`, `skill_level_descriptors`, `skill_criteria`, `session_skill_map` |
| Auto-évaluation | `questionnaires`, `questionnaire_versions`, `questionnaire_scale_labels`, `questionnaire_questions`, `self_assessments`, `self_assessment_answers` |
| Évaluations | `evaluations`, `evaluation_frameworks`, `evaluation_scores`, `evaluation_criterion_scores`, `evaluation_comments`, `evaluation_history` |
| Contenus | `pedagogical_contents`, `pedagogical_content_versions`, `session_player_states`, `trainer_notes`, `participant_session_notes` |
| Plateforme | `invitation_codes`, `audit_logs`, `notifications`, `contact_messages`, `data_requests`, `app_settings` |

Correspondance avec la liste du cahier des charges : *Users* = `auth.users` ;
*SociocognitiveSkills* et *TransversalSkills* = `skills` d’un référentiel
(`frameworks.code` = `sociocognitive` ou `transversal`) ; *PedagogicalContent* =
`pedagogical_contents` + versions.

## Permissions

| Rôle | Périmètre (imposé par RLS) |
| --- | --- |
| Participant | Sa fiche, son auto-évaluation, ses présences, ses évaluations **validées** (sans notes privées ni critères) |
| Organisme | Participants rattachés à sa structure active, leurs présences et évaluations validées ; aucune écriture pédagogique |
| Formateur | Groupes qui lui sont attribués : membres, sessions, présences, évaluations ; participants sans groupe (pour les affecter) |
| Administrateur | Tout, selon les fonctions prévues |

Les permissions fines (`groups.manage`, `attendance.write`, `evaluations.write`,
`org.exports`…) sont réglables par rôle dans **Administration → Utilisateurs**.

## Moteur d’évaluation

Une **version de référentiel** porte toutes les règles : échelle (min, max, pas),
libellés de niveaux, compétences et catégories, descriptions de niveau par
compétence, critères d’observation pondérés, correspondances avec les sessions, et
les règles de calcul :

- `scoring_mode` : `direct` (niveau saisi), `criteria_count` (nombre de critères
  observés), `criteria_average` (moyenne pondérée des critères notés) ;
- `aggregation` : synthèse entre sessions — `latest`, `mean`, `weighted_mean`, `max` ;
- `rounding` : `none`, `half`, `integer`.

Garanties :

1. Une version publiée est **figée** (déclencheurs). On fait évoluer un référentiel
   en créant une nouvelle version, puis en l’activant pour un programme.
2. Une évaluation est liée aux versions actives à sa création
   (`evaluation_frameworks`) et, à la validation, enregistre une **photographie**
   des référentiels appliqués (`framework_snapshot` : échelle, niveaux, compétences,
   critères, règles).
3. Une évaluation validée ne se modifie que par `amend_evaluation` : motif
   obligatoire, chaque changement est tracé dans `evaluation_history` (auteur,
   date, ancienne et nouvelle valeur). Aucune réécriture silencieuse n’est possible.
4. Le code d’une compétence est stable d’une version à l’autre : il relie
   l’historique d’une même compétence quand son intitulé change.

Valeurs livrées : notation `direct` et synthèse `latest` (dernière observation),
qui n’introduisent aucune moyenne ni pondération pédagogique non validée.

## Bilans

Voir [bilans.md](bilans.md) : photographie des résultats (`src/lib/report`), rédaction par IA
validée, PDF éditorial (`src/lib/pdf/report`), versions immuables (`participant_reports`).

## Journalisation

`audit_logs` est alimenté par les déclencheurs et fonctions (validation et
modification d’évaluation, présences, rattachements, rôles, codes d’accès,
organismes, référentiels, contenus, exports, consultations de fiche, connexions).
La table est en ajout seul : ni modification ni suppression, même avec la clé de service.
