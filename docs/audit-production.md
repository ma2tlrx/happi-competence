# Audit avant mise en production — novembre 2026

## Organisation

- **Quatre audits en parallèle**, confiés à des agents spécialisés en lecture seule :
  - **sécurité** : OWASP, droits d'accès en base (RLS), RGPD ;
  - **fonctionnel / QA** : 6 rôles, 178 pages parcourues, formulaires et parcours complets ;
  - **interface, accessibilité, responsive** : 50 pages à 3 largeurs (150 captures), axe-core, parcours au clavier ;
  - **performance et base de données** : cet audit a été interrompu par une limite d'usage ; je l'ai mené moi-même sur le code et les requêtes.
- **Corrections** : appliquées par une seule personne, pour éviter les conflits, puis vérifiées une à une (tests et scénarios rejoués).
- **Périmètre des tests** : tout a été testé sur la copie locale (base Supabase locale, données de démonstration). Aucun test destructif n'a été fait sur la base en ligne. Les migrations en ligne ont été appliquées avec l'accord du propriétaire.

## A. État initial

Le site était globalement solide :
- droits gérés par la base (RLS) sur toutes les tables ;
- toutes les actions serveur contrôlent le rôle ;
- aucun accès anonyme hors du catalogue public ;
- aucune erreur console ni lien mort sur 178 pages ;
- une suite de tests déjà en place.

Problèmes identifiés :

| Niveau | Problème |
| --- | --- |
| P0 | « Recréer la démonstration » pouvait échouer à mi-chemin et laisser un état cassé (données démo supprimées, rien de recréé). |
| P1 | Un formateur pouvait s'ouvrir l'accès à n'importe quel participant en saisissant son e-mail dans « ajouter au groupe ». |
| P1 | Redirection ouverte après connexion (`?suite=/\t/site-externe`). |
| P1 | Si la confirmation d'e-mail est désactivée, une inscription peut s'approprier une fiche invitée. Elle est **activée en production** : la faille n'est pas exploitable en ligne. |
| P1 | Admin › Supports pédagogiques affichait « aucun support » alors qu'ils existent. |
| P1 | Ouverture de l'espace participant démo impossible (profils non marqués « démo »). |
| P1 | Saisie perdue quand le serveur refuse un formulaire (inscription, contact, connexion, groupes…). |
| P1 | Page plus large que l'écran sur téléphone (11 pages), radar rogné sur téléphone. |
| P2 | Liens d'e-mail construits à partir de l'en-tête Host. |
| P2 | Aucune limite à la rédaction IA. |
| P2 | Paramètres admin acceptés sans validation ; messages d'erreur en anglais. |
| P2 | Compteur de présences faux (« 4/3 ») ; participant retiré encore affiché côté organisme. |
| P2 | Plusieurs contrastes et focus insuffisants ; journal d'activité en codes techniques. |
| P2 | Lenteur : serveurs aux États-Unis et base en Irlande ; trop d'allers-retours par page. |

## B. Travail effectué

**Sécurité**
- Migration `20261112110000_security_hardening.sql` :
  - l'ajout par e-mail exige les mêmes droits que l'ajout par identifiant ;
  - l'annuaire des participants sans groupe est cloisonné entre démo et réel ;
  - RLS forcée sur `participant_reports` ;
  - un participant peut lire l'historique de ses rattachements.
- `src/lib/utils.ts` : `safeInternalPath` résout le chemin comme un navigateur et le limite à la même origine.
- `src/app/(auth)/actions.ts` : les liens d'e-mail utilisent `NEXT_PUBLIC_SITE_URL`.
- Rédaction IA limitée à 10 par compte et par heure (`bilan/actions.ts`).
- Déconnexion refusée depuis une autre origine (`deconnexion/route.ts`).
- Empreinte IP du formulaire de contact par HMAC à clé serveur.
- Export RGPD complété (bilans, rattachements).

**Fonctionnel**
- Démonstration (`src/lib/demo/environment.ts`, `scripts/seed-demo.mjs`, migration `20261112120000_demo_marking.sql`) :
  - tout ce qu'un compte démo crée est marqué « démo » ;
  - la purge est robuste ;
  - une création ratée est nettoyée.
- Supports pédagogiques : `firstOf` gère les relations uniques renvoyées sous forme d'objet.
- `src/components/form-values-keeper.tsx` : la saisie est restaurée après un refus du serveur (sauf les mots de passe).
- `src/lib/zod-fr.ts` : messages de validation en français clair.
- Paramètres admin validés champ par champ ; planification de sessions validée (horaires, lieu).
- Présences calculées sur les sessions terminées ; participants retirés masqués côté organisme.

**Performance**
- Fonctions Vercel à Dublin, à côté de la base (`vercel.json`).
- Le filtre d'entrée ne contacte plus le serveur d'authentification pour un visiteur anonyme.
- Utilisateur courant : jeton vérifié localement, lectures en une seule vague au lieu de trois.
- Passeport : trois vagues de requêtes au lieu de cinq.
- Index vérifiés : ceux utilisés par les règles d'accès existent.

**Interface et accessibilité**
- `TableWrap` positionné et atteignable au clavier (fin des débordements sur téléphone) ; cartes et grilles contraintes.
- Radar adaptatif sur écran étroit.
- Contrastes de la barre latérale et de la méthodologie.
- Focus du curseur CV / passeport ; nom du menu du compte.
- Connexion : l'adresse est conservée et le focus revient sur le champ à corriger.
- Journal d'activité lisible (`src/lib/audit-labels.ts`).
- Cible tactile agrandie ; titres corrigés ; repère pour le bandeau démo ; une seule zone principale dans le lecteur.

**Tests ajoutés**
- Sécurité : attaque par e-mail rejouée (`tests/security/isolation.test.ts`).
- Unitaires : redirections (`src/lib/utils.test.ts`) et messages de validation (`src/lib/zod-fr.test.ts`).
- Bout en bout : test « Bilan HAPPI » rendu indépendant des données.

## C. Résultats des tests (exécutés)

| Fonctionnalité | Test | Résultat | Statut | Commentaire |
| --- | --- | --- | --- | --- |
| Toutes les pages, 6 rôles | Exploration Playwright : console, HTTP, liens | 0 erreur, 0 lien mort | Réussi | 178 pages |
| Cloisonnement des rôles | Accès croisés, exports d'un autre participant | 404 / 403 / redirection | Réussi | |
| Droits en base (RLS) | `vitest --project security` | 36/36 | Réussi | dont la nouvelle attaque par e-mail |
| Moteurs (évaluation, bilans, validation) | `npm test` | 53/53 | Réussi | |
| Parcours de bout en bout | `playwright test` | 12/12 | Réussi | connexion, inscription, contact, espaces, bilans, responsive |
| Redirection ouverte | Preuve de l'audit rejouée | renvoie vers le site | Réussi | |
| Démonstration (P0) | Scénario de l'audit rejoué puis « Recréer » | Recréation réussie, données démo purgées | Réussi | |
| Espace participant démo | Ouverture depuis l'admin | Ouvert, bandeau affiché | Réussi | |
| Saisie conservée | Contact, inscription, connexion avec erreurs | Valeurs conservées, mot de passe vidé | Réussi | |
| Débordement sur téléphone | 12 pages à 390 et 820 px | Aucun débordement | Réussi | |
| Radar sur téléphone | Capture à 390 px | Libellés entiers | Réussi | |
| Déconnexion depuis une autre origine | POST avec en-tête Origin | 403 (même origine : 303) | Réussi | |
| Types et lint | `tsc`, `eslint` | Aucune erreur | Réussi | |
| Compilation de production | `next build` local et Vercel | READY | Réussi | |
| Rédaction IA réelle | Appel OpenRouter | — | Non testé | crédit OpenRouter à zéro ; chemin d'erreur « crédit épuisé » testé |
| Envoi réel d'e-mails | Inscription en ligne | — | Non testé | aucun serveur d'envoi configuré (voir D) |
| Version en ligne | Navigation sur l'aperçu Vercel | — | Non testé | l'aperçu est protégé et injoignable depuis l'environnement de travail |

## D. Problèmes restants

| Problème | Niveau | Pourquoi non corrigé | Action nécessaire |
| --- | --- | --- | --- |
| Aucun serveur d'envoi d'e-mails : Supabase limite à 2 e-mails par heure | P1 (production) | Choix et compte d'un prestataire requis | Configurer un SMTP (Brevo, Mailjet…) dans Supabase › Authentication › SMTP |
| Longueur minimale de mot de passe à 6 en base (10 dans l'application) | P2 | Modification de configuration bloquée par sécurité | Supabase › Authentication › Policies : 10 caractères |
| Pas de limitation de débit propre à l'application (connexion, inscription, contact) | P2 | Demande un service partagé (Redis / Upstash) | Ajouter un limiteur par IP, ou un captcha (Turnstile) sur les formulaires publics |
| CSP sans `script-src` (pas de protection en profondeur contre une XSS) | P2 | Une CSP à nonce demande de revoir le rendu (pages dynamiques) | À planifier ; aucune XSS trouvée |
| Ancien mot de passe administrateur en clair dans l'historique git (ancien outil) | P2 | Réécrire l'historique est une opération destructive | Changer ce mot de passe ; purger l'historique si le dépôt devient public |
| Mentions légales « à compléter » | P2 | Informations légales à fournir | Les saisir dans Admin › Paramètres |
| Référentiel transversal provisoire, session 6 « thème à préciser » | P3 | Décision pédagogique | Valider les contenus |
| Export CSV organisme sans les filtres ; groupe futur affiché « En cours » ; session en cours comptée « à venir » | P3 | Finitions mineures | Prochaine itération |
| Données sous-traitées hors UE (IA) | Conformité | Contrat à signer | Accord de sous-traitance, mention dans la politique de confidentialité |
| Démonstration activée par défaut | P3 | Fonctionnalité voulue | En production : `HAPPI_ALLOW_DEMO=false` |

## E. Sécurité

- **Vulnérabilités découvertes** :
  - accès à un participant par son e-mail (P1) ;
  - redirection ouverte (P1) ;
  - prise de contrôle d'une fiche invitée si la confirmation d'e-mail est désactivée (P1, non exploitable en production) ;
  - liens d'e-mail dépendant de l'en-tête Host (P2) ;
  - IA sans quota (P2) ;
  - déconnexion forcée depuis un autre site (P3) ;
  - empreinte IP réversible (P3).
- **Corrigées** : toutes, sauf la troisième, couverte en production par la confirmation d'e-mail activée.
- **Vérifié et sain** :
  - accès anonyme refusé partout sauf au catalogue public ;
  - fonctions SECURITY DEFINER avec `search_path` fixé, aucune injection SQL ;
  - escalades de rôle bloquées ;
  - commentaires privés invisibles des participants et des organismes ;
  - codes d'accès stockés en empreinte, à usage unique ;
  - aucun secret dans le code ni dans les fichiers servis ;
  - Markdown rendu sans HTML ;
  - exports protégés contre l'injection CSV ;
  - `npm audit --omit=dev` : 0 vulnérabilité.
- **Risques résiduels** : absence de limitation de débit, CSP minimale, prestataire e-mail, ancien mot de passe dans l'historique (voir D).

## F. État final

- **Ce qui fonctionne et a été vérifié** :
  - site vitrine ;
  - inscription, connexion, codes d'accès, mot de passe ;
  - espaces participant, organisme, formateur et administrateur ;
  - groupes, sessions, présences, évaluations (brouillon, validation, correction tracée) ;
  - lecteur pédagogique ;
  - exports PDF et CSV ;
  - bilans (génération, rédaction manuelle, validation, téléchargement) ;
  - démonstration ;
  - droits d'accès ;
  - affichage sur téléphone et tablette.
- **Non testé** :
  - rédaction IA réelle (crédit épuisé) ;
  - envoi réel d'e-mails ;
  - navigation sur l'aperçu en ligne, protégé par Vercel.
- **Prêt pour la production** : l'application et sa base, une fois les actions de la section D faites. Les deux prioritaires sont le serveur d'e-mails et le mot de passe à 10 caractères.
- **Interventions encore nécessaires** :
  - configurations Supabase et Vercel listées en D ;
  - contenus légaux et pédagogiques ;
  - recharge du crédit OpenRouter ;
  - régénération de la clé partagée en clair dans la conversation.
