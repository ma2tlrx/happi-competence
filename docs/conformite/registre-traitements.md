# Registre des activités de traitement (article 30 du RGPD)

> **BROUILLON — à valider.** Établi à partir du schéma réel de la base
> (`supabase/migrations/`) en novembre 2026. Les champs « à compléter » relèvent de
> l’entreprise ; les points marqués **[à valider par un juriste]** sont des
> propositions, pas des positions arrêtées. À relire à chaque évolution du schéma.

## Responsable du traitement

| Rubrique | Valeur |
| --- | --- |
| Raison sociale | à compléter (paramètre `legal.company_name`) |
| Adresse | à compléter (`legal.address`) |
| Représentant | à compléter (`legal.publication_director`) |
| Délégué / référent protection des données | à compléter (`legal.dpo_contact`) |
| Rôle de HAPPI | Responsable de traitement quand HAPPI anime le programme ; **sous-traitant** quand un organisme utilise la plateforme pour ses propres participants **[à valider par un juriste]** |

## Sous-traitants communs à tous les traitements

| Sous-traitant | Service | Localisation des données | Transfert hors UE | Contrat |
| --- | --- | --- | --- | --- |
| Supabase | Base de données, authentification, double authentification | UE (Irlande, eu-west-1) | Société américaine : accès possible depuis les États-Unis **[à valider]** | DPA à signer |
| Vercel | Hébergement et exécution de l’application | UE (Dublin, `dub1`) | Société américaine **[à valider]** | DPA à signer |
| OpenRouter | Acheminement des requêtes de rédaction IA | États-Unis | Oui (DPF ou CCT à vérifier) | DPA à signer ; routage sans conservation (ZDR) à activer |
| Anthropic | Modèle de langage (rédaction des bilans) | États-Unis | Oui (DPF ou CCT à vérifier) | DPA à signer (ou API directe) |
| Prestataire SMTP | E-mails de confirmation et de réinitialisation | à compléter | à compléter | à compléter |

## Traitements

### T1. Gestion des comptes et authentification
- **Finalité** : accès sécurisé aux espaces (participant, organisme, formateur, administrateur).
- **Personnes** : participants, membres d’organismes, formateurs, administrateurs.
- **Données** : `profiles` (prénom, nom, e-mail, téléphone, rôle, statut, dates de consentement), `auth.users` (mot de passe haché), `auth.mfa_factors` (secret TOTP, géré par Supabase Auth), `invitation_codes` (empreinte SHA-256 du code), `notifications`.
- **Base légale** : exécution du contrat / de la mission d’accompagnement **[à valider par un juriste]**.
- **Destinataires** : la personne ; les administrateurs.
- **Durée** : durée du compte, puis à définir **[à valider]**.
- **Sécurité** : RLS `profiles_select` (soi-même ou administrateur), garde `private.profiles_guard` (rôle/statut non modifiables par l’utilisateur), double authentification TOTP, limitation de débit.

### T2. Suivi du parcours et des présences
- **Finalité** : organiser les sessions, justifier la réalisation de l’accompagnement auprès des financeurs.
- **Données** : `participants`, `groups`, `group_members`, `group_trainers`, `sessions`, `attendance`, `attendance_history`, `participant_session_notes`, `session_player_states`, `participant_organization_history`.
- **Base légale** : exécution de la mission ; obligations de preuve des financements **[à valider par un juriste]**.
- **Destinataires** : formateurs du groupe (`private.trains_group`, `private.trains_participant`), organisme de rattachement (`private.org_sees_participant`, permission `org.attendance.read`), administrateurs.
- **Durée** : accompagnement + durée à définir (paramètre `platform.data_retention_months`, 36 mois aujourd’hui) **[à valider]**.

### T3. Évaluation des compétences et passeport
- **Finalité** : établir le passeport de compétences à partir d’observations des formateurs et de l’auto-évaluation.
- **Données** : `self_assessments`, `self_assessment_answers`, `evaluations`, `evaluation_scores`, `evaluation_criterion_scores`, `evaluation_comments` (partagés / internes), `evaluation_history`, `trainer_notes` (notes privées).
- **Base légale** : exécution de la mission **[à valider par un juriste]**.
- **Destinataires** : participant (évaluations validées), formateurs du groupe, organisme (évaluations validées, permission `org.evaluations.read`), administrateurs. Notes privées et brouillons : équipe HAPPI seulement.
- **Durée** : comme T2 **[à valider]**.
- **Remarque** : évaluation de personnes vulnérables → AIPD (voir `aipd-preparation.md`).

### T4. Bilans individuels (avec assistance IA facultative)
- **Finalité** : remettre au participant une synthèse rédigée de son parcours, transmissible à sa structure.
- **Données** : `participant_reports` (données figées, texte, origine `content_source` : `ai`, `ai_edited`, `manual`, modèle utilisé).
- **Données transmises à l’IA** : dossier pseudonymisé construit par `buildDossier` (`src/lib/report/prompt.ts`) : ni nom, ni structure, ni formateur ; commentaires filtrés par `redactPersonalData` (`src/lib/report/redact.ts` : e-mails, téléphones, NIR/identifiants, adresses, nom de la personne masqués).
- **Base légale** : exécution de la mission ; l’usage de l’IA pourrait relever du consentement ou de l’intérêt légitime **[à valider par un juriste]**.
- **Destinataires** : participant et organisme (bilans validés), formateurs, administrateurs ; OpenRouter / Anthropic (sous-traitants, hors UE).
- **Transparence** : mention « Texte rédigé avec l’aide d’une intelligence artificielle, relu et validé par le formateur » dans le PDF et à l’écran (règlement (UE) 2024/1689, art. 50).
- **Durée** : comme T2 ; côté prestataires IA : aucune conservation souhaitée (à vérifier contractuellement).

### T5. Organismes partenaires
- **Finalité** : gérer les structures prescriptrices et leurs membres habilités.
- **Données** : `organizations` (nom, type, SIRET, ville, e-mail de contact), `organization_members`.
- **Base légale** : contrat / intérêt légitime **[à valider]**.
- **Durée** : durée de la relation + à définir.

### T6. Formulaire de contact
- **Finalité** : répondre aux demandes.
- **Données** : `contact_messages` (nom, e-mail, structure, profil, message, empreinte HMAC de l’IP).
- **Base légale** : mesures précontractuelles / intérêt légitime **[à valider]**.
- **Durée** : à définir.

### T7. Sécurité, traçabilité et limitation de débit
- **Finalité** : sécurité du service, preuve des actions sensibles, prévention des attaques par essais répétés.
- **Données** : `audit_logs` (identifiants, action, date ; en ajout seul), `private.rate_limit_counters` (empreintes HMAC de l’IP, de l’e-mail ou de l’identifiant ; deux jours au plus).
- **Base légale** : intérêt légitime ; obligation de sécurité (art. 32) **[à valider]**.
- **Destinataires** : administrateurs (journal) ; compteurs accessibles au seul serveur (clé de service).
- **Durée** : journal à définir (purge/archivage annuel suggéré) ; compteurs 48 h.

### T8. Exercice des droits
- **Finalité** : traiter les demandes d’export et de suppression et en garder la preuve.
- **Données** : `data_requests`.
- **Base légale** : obligation légale (art. 12 à 22).
- **Durée** : à définir **[à valider]**.

## Mesures de sécurité générales (art. 32)
RLS activée (et forcée sur les tables sensibles) sur toutes les tables ; fonctions `SECURITY DEFINER` à `search_path` vide ; clé de service uniquement côté serveur ; double authentification TOTP, exigible pour les administrateurs et formateurs (`security.mfa_required_staff`, contrôlée en base par `private.mfa_satisfied`) ; limitation de débit ; journal en ajout seul ; codes et mots de passe jamais en clair ; en-têtes de sécurité (`next.config.ts`).
