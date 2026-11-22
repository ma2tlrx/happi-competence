# Audit sécurité et préparation aux ateliers — 22 novembre 2026

## Vérifié (local, ce jour)
- Types, lint : propres. Tests : 667 unitaires, 259 sécurité (base locale), 66 e2e (parcours des 6 rôles, inscriptions HAPPI et Passeport Numérique). Build de production : OK.
- `npm audit` (dépendances de production) : 0 vulnérabilité.
- En-têtes : CSP avec nonce, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- Aucun mot de passe, jeton ou clé en dur dans `src` et `scripts` ; aucune clé de service dans un composant client ; aucun `dangerouslySetInnerHTML`.

## Vérifié (base de production, lecture seule)
- 93 tables publiques : RLS activée et forcée sur toutes ; 0 droit pour le rôle anonyme sur les tables ; seules 3 fonctions SECURITY DEFINER sont appelables sans compte (catalogue, fiabilité, résultats publics) ; toutes ont un `search_path` fixé.
- Tables des derniers chantiers présentes (jeux, relances, questionnaire d'accueil, correspondances, programmes).
- Auth : confirmation d'e-mail obligatoire, mot de passe ≥ 10 caractères, rotation des jetons de rafraîchissement, inscriptions anonymes fermées.

## Bloquants pour un atelier
1. **Aucun SMTP configuré dans Supabase Auth** : les e-mails de confirmation passent par le service intégré, limité à **2 e-mails par heure pour tout le projet** (`rate_limit_email_sent = 2`), et réservé aux membres de l'équipe du projet. Des participants ne recevront pas leur lien : inscription impossible. À faire : brancher un SMTP (Brevo) dans Supabase › Auth › SMTP, puis relever la limite.
2. **Limite d'inscription par IP : 10 par heure.** Un groupe derrière la même connexion (salle, Wi-Fi) est bloqué dès la 11e personne. À relever (ex. 60/h) ou à contourner par le code d'accès groupe.
3. **URL du site (Auth) = adresse d'aperçu Vercel de la branche de travail** : les liens des e-mails pointent dessus. À remplacer par l'adresse définitive.

## Recommandé
- Anti-robot (CAPTCHA) et contrôle des mots de passe compromis (HIBP, offre payante) désactivés.
- Variables Vercel (EMAIL_PROVIDER, NEXT_PUBLIC_SITE_URL, RATE_LIMIT_SECRET…) non vérifiables d'ici (accès Vercel refusé).
- Passeport Numérique : la progression reste dans le navigateur de l'appareil (formateur sans visibilité, pas de reprise d'un appareil à l'autre).
- Référentiels ROME importés en local seulement ; licence à vérifier.
- Jeton Supabase (Account › Access Tokens) à supprimer une fois les opérations terminées.
- Pas de test d'inscription réelle en production (aurait créé un compte et envoyé un e-mail) : à faire avec une adresse de test après correction du point 1.
