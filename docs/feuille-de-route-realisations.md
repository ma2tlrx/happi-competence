# Feuille de route : ce qui a été construit (novembre 2026)

Suite de `docs/audit-strategique.md`. Six chantiers réalisés en parallèle, puis fusionnés et testés ensemble.
Les contenus marqués **provisoire** et les points **à valider** demandent une décision du propriétaire.

## 1. Émargement électronique et certificat de réalisation (axe A)
- **Signature au doigt** pour chaque séance :
  - sur la tablette du formateur (Présences › Émargement, plein écran) ;
  - ou depuis le compte du participant (carte « Émargement du jour »).
- **Valeurs fixées par la base** : heure du serveur et empreinte SHA-256 de chaque signature. L'IP est conservée seulement sous forme d'empreinte.
- **Signature impossible** : mention avec motif, saisie par le formateur.
- **Contre-signature du formateur** : elle fige la feuille. Ensuite, plus de signature et plus de changement de présence ni d'horaires. Seul l'administrateur peut corriger, et la correction est tracée.
- **PDF « Feuille d'émargement »** :
  - empreinte de l'ensemble, revérifiée à chaque génération ;
  - mention « valeur probante à valider avec votre financeur ».
- **PDF « Certificat de réalisation »** par participant et par groupe :
  - heures réalisées et heures prévues ;
  - modèle indicatif.
- Migration : `20261113090000_attendance_signatures.sql`.

## 2. Abandons, situations de sortie, suivis, impact (axe A)
- **Abandon déclaré**, distinct d'un retrait :
  - motif (liste provisoire) et date ;
  - le participant reste visible dans l'historique et les statistiques.
- **Alerte « À relancer »** : 2 absences consécutives, ou une absence non justifiée à la dernière séance.
- **Situation du participant** à l'entrée, à la sortie, à 3 mois et à 6 mois :
  - catégories provisoires, à aligner sur les nomenclatures FSE+, France Travail et CEJ ;
  - saisie par le formateur, l'organisme ou l'admin, et lecture par le participant.
- **Pages « Suivis »** : échéancier des situations à saisir.
- **Tableau de bord « Impact »** (admin et organisme) :
  - par cohorte et par organisme ;
  - assiduité, abandons, progression observée, situations ;
  - chaque taux est accompagné de son effectif (n), et le « non renseigné » n'est jamais compté comme zéro ;
  - exports CSV.
- Migration : `20261113100000_outcomes_and_impact.sql` ; règles détaillées dans `docs/impact.md`.

## 3. Satisfaction, auto-évaluation finale, évolution (axes A et B)
- **Enquêtes de satisfaction** à chaud (fin du programme) et à froid (3 mois après), pour les participants et les prescripteurs :
  - questions provisoires, versionnées et modifiables dans Admin › Satisfaction ;
  - résultats avec taux de réponse et effectifs ;
  - verbatims affichés seulement à partir de 3 réponses ;
  - export CSV.
- **Auto-évaluation finale** :
  - même questionnaire que l'auto-évaluation initiale ;
  - ouverte en fin de parcours, une seule fois.
- **Écran « Mon évolution »** : déclaré au départ, observé par les formateurs, déclaré à la fin. Les échelles différentes ne sont jamais additionnées ; « non observé » n'est jamais traité comme un zéro.
- Migration : `20261113110000_satisfaction_and_final_self_assessment.sql`.

## 4. Passeport partageable et vérifiable (axe C)
- **Lien de partage créé par le participant**, et par lui seul :
  - durée de 7, 30 ou 90 jours ;
  - contenu choisi ;
  - révocable ;
  - consultations comptées.
- **Page publique `/verifier/…`** :
  - niveaux validés seulement, prénom et initiale du nom ;
  - non indexée, sans référent ;
  - message neutre si le lien est inconnu, expiré ou révoqué.
- **QR code** à télécharger, et en option dans le PDF du passeport.
- **Stockage du jeton** : empreinte en base, plus une copie chiffrée qui permet de recopier le lien et de générer le QR. **À valider** : l'alternative est d'afficher le lien une seule fois à la création.
- Migration : `20261113120000_passport_sharing.sql`.

## 5. Sécurité et conformité (axe E)
- **Limitation du nombre de tentatives** sur la connexion, l'inscription, les codes d'accès, le mot de passe oublié et le contact. Elle est gérée par la base, sans service externe.
- **Double authentification** :
  - application d'authentification, activable dans Mon compte › Sécurité ;
  - option admin pour l'exiger des administrateurs et formateurs, désactivée par défaut ;
  - imposée aussi par la base, en cas d'appel direct à l'API ;
  - réinitialisation par un administrateur, journalisée.
- **Mention de l'IA** (règlement européen, art. 50) sur les bilans en PDF et à l'écran.
- **Masquage des données personnelles** dans ce qui est envoyé à l'IA : e-mails, téléphones, numéros, adresses, nom.
- **Documents** :
  - politique de confidentialité réécrite, avec les points « à valider par un juriste » ;
  - page « Déclaration d'accessibilité » (non conforme tant qu'aucun audit RGAA n'a été fait) ;
  - brouillons du registre des traitements et de l'AIPD dans `docs/conformite/`.
- Migration : `20261113130000_rate_limit_and_mfa.sql`.

## 6. E-mails, convocations, rappels (axe D)
- **Envois** :
  - convocation, séance modifiée ou annulée, rappel la veille, bilan disponible, invitation ;
  - avec la notification correspondante dans l'application.
- **File d'envoi** sans doublon. Comptes démo et personnes sans adresse : rien n'est envoyé.
- **Fournisseurs** : Brevo, SMTP ou Resend, au choix. Sans configuration, rien n'est envoyé et l'e-mail est seulement journalisé.
- **Page Admin › E-mails** : état de la configuration, derniers envois, e-mail de test.
- **Rappels** préparés chaque jour à 16 h UTC (route `/api/cron/rappels`, protégée par `CRON_SECRET`).
- **Préférence** « recevoir les rappels » dans Mon compte. Convocations, modifications et annulations restent toujours envoyées.
- Migration : `20261113140000_email_outbox.sql`.

Journalisation des nouveaux exports et de la réinitialisation de la double authentification : `20261113150000_log_event_new_actions.sql`.

## Vérifications exécutées (pile locale, base recréée de zéro avec toutes les migrations dans l'ordre)
| Test | Résultat |
| --- | --- |
| `tsc --noEmit`, `eslint` | aucune erreur |
| `npm test` (unitaires) | 195/195 |
| `vitest --project security` (droits en base) | 109/109 |
| `playwright test` (parcours complets, dont le partage du passeport) | 16/16 |
| Parcours de 34 pages × 4 rôles × 2 largeurs (1280 et 390 px) | 0 erreur console, 0 erreur HTTP ; 1 débordement corrigé (filtres Impact) |
| `next build` | réussi |

**Non testé :**
- envoi réel d'e-mails : aucun fournisseur configuré, mais l'envoi vers la boîte de test locale a été vérifié par l'agent ;
- double authentification de bout en bout dans le navigateur : l'enrôlement réel a été vérifié côté serveur ;
- signature tactile sur une vraie tablette.

## Mise en production (non faite, à décider)
1. Appliquer en ligne les migrations `20261113090000` à `20261113150000`.
2. Variables Vercel :
   - `CRON_SECRET`, `PASSPORT_SHARE_SECRET` ;
   - `EMAIL_PROVIDER`, plus `BREVO_API_KEY` (ou `SMTP_URL` / `RESEND_API_KEY`) et `EMAIL_FROM` ;
   - `RATE_LIMIT_SECRET` (facultatif).
3. Supabase › Authentication :
   - activer la MFA TOTP ;
   - configurer le SMTP (même fournisseur) ;
   - mot de passe de 10 caractères au minimum.
4. Vérifier que le plan Vercel accepte la tâche planifiée quotidienne.

## Points à valider par le propriétaire
- **Contenus provisoires** :
  - questions de satisfaction ;
  - motifs d'abandon ;
  - catégories de situation ;
  - textes des e-mails ;
  - mention de méthode sur la page de vérification ;
  - modèle de certificat (SIRET et numéro de déclaration d'activité à compléter).
- **Règles** :
  - décrochage ;
  - échéancier de suivi ;
  - ouverture des enquêtes et de l'auto-évaluation finale ;
  - un retard ou un départ anticipé compte comme séance réalisée.
- **Juridique** :
  - valeur probante de l'émargement ;
  - points marqués « à valider par un juriste » dans la politique de confidentialité, le registre et l'AIPD.
- **Stockage chiffré du jeton de partage** (voir 4).
- **Seuils de limitation des tentatives** (`src/lib/security/rate-limit-core.ts`).
