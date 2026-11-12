# Analyse d’impact relative à la protection des données (AIPD) — trame préparatoire

> **BROUILLON — à valider.** Trame préremplie à partir du code (novembre 2026) pour
> préparer l’AIPD avec le responsable de traitement, son référent protection des
> données et un juriste (l’outil PIA de la CNIL peut servir de support). Rien ici
> n’est une conclusion : les niveaux de risque sont des propositions à discuter.
> Points de droit marqués **[à valider par un juriste]**.

## 1. Pourquoi une AIPD
Critères du CEPD vraisemblablement réunis **[à valider par un juriste]** :
- **évaluation de personnes** (niveaux de compétences, bilans) ;
- **personnes vulnérables** (jeunes, demandeurs d’emploi, publics en insertion) ;
- **usage innovant** (rédaction assistée par une IA générative) ;
- **transfert hors UE** (OpenRouter, Anthropic).

## 2. Description du traitement
- **Objet** : accompagner des petits groupes vers l’emploi par des mises en situation de jeu vidéo ; les formateurs observent et évaluent des compétences transversales et des habiletés socio-cognitives ; un passeport et un bilan individuel sont remis au participant et à sa structure.
- **Données et flux** : voir `registre-traitements.md` (T1 à T8). Flux IA : `src/app/formateur/participants/[id]/bilan/actions.ts` → `buildDossier` (`src/lib/report/prompt.ts`) → OpenRouter/Anthropic (`src/lib/report/ai.ts`) → texte contrôlé (`checkContent`, `src/lib/report/content.ts`) → relecture et validation humaine → bilan immuable (`participant_reports`).
- **Acteurs** : participants, formateurs, organismes, administrateurs HAPPI ; sous-traitants Supabase, Vercel, OpenRouter, Anthropic, SMTP (à compléter).
- **Supports** : application Next.js (Vercel, Dublin), base PostgreSQL et authentification Supabase (Irlande).

## 3. Nécessité et proportionnalité
| Question | Éléments disponibles | À compléter |
| --- | --- | --- |
| Finalités déterminées et légitimes | Suivi du parcours, passeport, bilan, preuve de réalisation | Validation des finalités secondaires (statistiques, recherche) |
| Base légale | Consentement aujourd’hui ; contrat / mission d’intérêt public / intérêt légitime proposés | **[à valider par un juriste]** |
| Minimisation | Pas de date de naissance ni d’adresse demandées ; IA sans nom ni structure ; filtre `redactPersonalData` sur les commentaires ; notes internes jamais envoyées à l’IA | Consigne écrite aux formateurs : aucune donnée de santé/justice |
| Exactitude | Niveaux saisis par les formateurs ; correction tracée avec motif (`evaluation_history`) ; l’IA n’attribue aucun niveau | — |
| Durées | 36 mois paramétrés ; compteurs 48 h | Durées par catégorie **[à valider]** ; purge automatique à planifier |
| Information | Politique de confidentialité ; mention IA dans le bilan (art. 50) | Information spécifique au moment de l’orientation |
| Droits | Export libre-service (`/api/exports/mes-donnees`), demande de suppression (`data_requests`, `process_deletion_request`) | Opposition, limitation : procédure à écrire |
| Sous-traitance | Liste des sous-traitants publiée | DPA signés, analyse des transferts **[à valider]** |

## 4. Risques
| Risque | Sources | Impacts possibles | Vraisemblance / gravité (proposition) |
| --- | --- | --- | --- |
| Accès illégitime aux évaluations (autre organisme, autre formateur) | Erreur de droits, compte compromis | Stigmatisation, atteinte à l’insertion | Limitée / importante |
| Prise de contrôle d’un compte administrateur ou formateur | Mot de passe réutilisé, hameçonnage, essais en série | Accès à de nombreux dossiers | Limitée (avec 2FA) / importante |
| Transmission de données identifiantes ou sensibles à l’IA | Commentaire libre contenant nom, téléphone, santé | Transfert hors UE de données sensibles | Limitée / importante |
| Texte de bilan inexact ou stigmatisant | Hallucination du modèle, profilage | Décision défavorable d’un prescripteur | Limitée / importante |
| Qualification « haut risque » au sens du règlement IA (profilage) | Interprétation de l’annexe III | Obligations supplémentaires | **[à valider par un juriste]** |
| Conservation excessive | Absence de purge automatique | Exposition prolongée | Importante / limitée |
| Perte de disponibilité ou de données | Panne hébergeur | Interruption du suivi | Limitée / limitée |

## 5. Mesures existantes (références au code)
- **Cloisonnement en base (RLS)** : `supabase/migrations/20261110090600_row_level_security.sql` ; helpers `private.is_admin()`, `private.trains_participant()`, `private.org_sees_participant()`, `private.my_participant_id()`, `private.has_permission()` ; tests `tests/security/isolation.test.ts`, `reports.test.ts`.
- **Brouillons et notes internes** invisibles des participants et organismes (politiques sur `evaluations`, `trainer_notes`, `participant_reports`).
- **Double authentification** TOTP (`src/app/(account)/compte/securite/`, `src/lib/auth/mfa.ts`), exigible pour administrateurs et formateurs ; contrôle en base : `private.mfa_satisfied` / `private.current_role_code` (`supabase/migrations/20261113130000_rate_limit_and_mfa.sql`) ; tests `tests/security/rate-limit-mfa.test.ts`.
- **Limitation de débit** : `src/lib/security/rate-limit*.ts`, `public.rate_limit_hit` (clé de service uniquement).
- **Journal en ajout seul** : `audit_logs`, `private.audit(...)` ; consultations de fiche et exports journalisés.
- **IA encadrée** : dossier sans identité (`buildDossier`), filtre `redactPersonalData` (`src/lib/report/redact.ts`, tests `redact.test.ts`), contrôle du texte (`checkContent`), relecture et validation humaines, option de rédaction manuelle, mention de transparence (`src/lib/report/ai-disclosure.ts`).
- **Secrets** : codes d’accès en SHA-256, empreintes HMAC pour IP/e-mail, clé de service côté serveur uniquement (`src/lib/supabase/admin.ts`).
- **Droits** : export et demande de suppression en libre-service.

## 6. Mesures complémentaires envisagées
- DPA signés avec chaque sous-traitant ; routage sans conservation (ZDR) chez OpenRouter, ou API Anthropic directe.
- Note d’évaluation « article 6(3) » du règlement IA (exception au haut risque, question du profilage) **[à valider par un juriste]**.
- Formation des formateurs à l’IA (art. 4) et consigne écrite sur les champs libres.
- Purge automatique planifiée selon les durées arrêtées ; archivage intermédiaire.
- Exiger la double authentification pour administrateurs et formateurs en production.
- Procédure de notification de violation sous 72 h ; plan de reprise testé.

## 7. Validation
| Rôle | Nom | Avis | Date |
| --- | --- | --- | --- |
| Responsable de traitement | à compléter | | |
| Référent / DPO | à compléter | | |
| Juriste | à compléter | | |
