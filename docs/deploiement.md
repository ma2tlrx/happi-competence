# Mise en production

Ce guide décrit les étapes, dans l’ordre, pour mettre HAPPI Compétence en ligne
avec Supabase (base, authentification) et Vercel (application Next.js).
Toutes les étapes marquées **👤** nécessitent une action de votre part : création de
compte, saisie d’une clé, choix d’un domaine.

## 1. Projet Supabase 👤

1. Créez un projet sur [supabase.com](https://supabase.com) — région **UE**
   (par exemple Paris `eu-west-3` ou Francfort) pour l’hébergement des données
   personnelles en Europe (RGPD).
2. Notez dans **Project Settings → API** :
   - l’URL du projet (`https://xxxx.supabase.co`) ;
   - la clé publique (`anon` / `publishable`) ;
   - la clé secrète (`service_role` / `secret`) — à ne jamais exposer côté navigateur.
3. Notez la chaîne de connexion à la base (**Project Settings → Database**).

## 2. Appliquer les migrations

Les fichiers `supabase/migrations/*.sql` créent le schéma, les déclencheurs, les
fonctions métier, les politiques RLS et les données de référence. Appliquez-les
**dans l’ordre des noms de fichier**, une seule fois.

Avec la CLI Supabase (recommandé) :

```bash
npx supabase link --project-ref <identifiant-du-projet>
```

```bash
npx supabase db push
```

Ou avec `psql` :

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

Vérification : dans l’éditeur SQL de Supabase, `select count(*) from public.skills;`
doit renvoyer 34 (18 compétences transversales et 16 habiletés socio-cognitives).

## 3. Authentification 👤

Dans **Authentication → URL Configuration** :

- **Site URL** : `https://votre-domaine.fr`
- **Redirect URLs** : `https://votre-domaine.fr/auth/confirmation`
  (ajoutez aussi l’URL de prévisualisation Vercel si besoin).

Dans **Authentication → Providers → Email** : laissez la confirmation d’e-mail
activée.

Dans **Authentication → SMTP Settings** : configurez un serveur SMTP
(Brevo, Mailjet, Scaleway TEM…) avec une adresse d’expédition de votre domaine.
Le service d’e-mail intégré de Supabase est limité à quelques envois par heure et
ne convient pas à la production.

Personnalisez au besoin les modèles d’e-mail (**Authentication → Email Templates**)
en français.

Dans **Authentication → Multi-Factor (MFA)** : vérifiez que **TOTP (App
Authenticator)** est activé pour l’enrôlement et la vérification (« Enabled »).
C’est le réglage par défaut de Supabase ; sans lui, la page **Mon compte →
Sécurité** ne peut pas activer la double authentification. Laissez les autres
facteurs (téléphone, WebAuthn) désactivés : l’application ne les gère pas.

Une fois votre propre compte administrateur protégé (**Mon compte → Sécurité**),
vous pouvez cocher **Administration → Paramètres → Exiger la double
authentification pour les administrateurs et formateurs**. Les comptes concernés
sans double authentification sont alors renvoyés vers son activation, et la base
refuse leurs droits tant que la session n’a pas été validée par un code (niveau
`aal2`). En cas de téléphone perdu, un administrateur réinitialise la double
authentification depuis **Administration → Utilisateurs**, après avoir vérifié
l’identité de la personne par un autre moyen.

**Limitation de débit** : connexion, inscription, mot de passe oublié, formulaire
de contact, codes d’accès et codes de double authentification sont limités par
adresse IP, par adresse e-mail ou par compte (table privée
`private.rate_limit_counters`, fonction `public.rate_limit_hit`, réservée à la clé
de service). Aucun service externe n’est nécessaire. L’adresse IP est lue dans
`x-forwarded-for` / `x-real-ip`, que Vercel renseigne lui-même : derrière un autre
hébergeur ou un mandataire, vérifiez que ces en-têtes sont réécrits par
l’infrastructure, sinon la limite par IP peut être contournée (les limites par
e-mail et par compte restent efficaces).

## 4. Déploiement Vercel 👤

1. Importez le dépôt GitHub dans Vercel (framework détecté : Next.js).
2. Renseignez les variables d’environnement (**Settings → Environment Variables**) :

| Variable | Valeur | Exposée au navigateur |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://votre-domaine.fr` | oui |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique | oui (protégée par RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé secrète | **non** — serveur uniquement |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | oui |
| `OPENROUTER_API_KEY` | clé OpenRouter (rédaction des bilans) | **non** — serveur uniquement, facultative |
| `ANTHROPIC_API_KEY` | clé API Claude, si OpenRouter n’est pas utilisé | **non** — serveur uniquement, facultative |
| `RATE_LIMIT_SECRET` | chaîne aléatoire longue (clé des empreintes de la limitation de débit) | **non** — serveur uniquement, facultative (à défaut : clé secrète Supabase) |
| `REPORT_AI_MODEL` | modèle de rédaction (défaut : `anthropic/claude-opus-5.5`) | non, facultative |

Sans clé d’IA, les bilans fonctionnent : ils sont créés avec leurs résultats et se
rédigent à la main. Les fonctions qui génèrent un bilan peuvent durer jusqu’à deux
minutes (`maxDuration = 300` sur la page des bilans).

3. Déployez, puis rattachez votre domaine (**Settings → Domains**) et mettez à jour
   `NEXT_PUBLIC_SITE_URL` et la configuration Auth de l’étape 3.

Les en-têtes de sécurité (CSP, HSTS, `X-Frame-Options`…) sont définis dans
`next.config.ts`.

Les fonctions serveur s’exécutent à Dublin (`regions: ["dub1"]` dans `vercel.json`),
au plus près de la base Supabase (eu-west-1) : chaque page enchaîne plusieurs
lectures, et une région éloignée (par défaut Washington) les ralentit nettement.

### Démonstration

L’espace administrateur propose **Démonstration** : création d’un jeu complet de
comptes et de données fictifs (tous marqués « démo », adresses en
`@demo.happi.test`), ouverture directe des espaces formateur, organisme et
participant, puis suppression en un clic. Pour l’interdire sur un environnement,
définissez `HAPPI_ALLOW_DEMO=false`.

## 5. Premier administrateur

Aucun mot de passe ni code administrateur n’est inscrit dans l’application. Le
premier accès se provisionne depuis un poste de confiance disposant de la clé
secrète :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run admin:code -- --hours 2 --label "Premier administrateur"
```

Le script affiche un code `HAPPI-…` **une seule fois** (seule son empreinte
SHA-256 est enregistrée). Rendez-vous sur `https://votre-domaine.fr/acces-pro`,
saisissez le code et créez votre compte : il reçoit le rôle administrateur, et le
code devient inutilisable.

Les codes suivants (formateurs, organismes, autres administrateurs) se créent
depuis **Administration → Codes d’accès**.

## 6. À compléter avant ouverture 👤

- **Mentions légales, confidentialité, conditions d’utilisation** : les valeurs
  signalées « à renseigner » sur ces pages (raison sociale, forme juridique, SIRET,
  adresse, directeur de la publication, hébergeur, contact RGPD…) se saisissent dans
  **Administration → Paramètres**, sans modifier le code. Faites relire ces textes
  par votre conseil juridique. Les points de droit encore ouverts sont signalés
  « à valider par un juriste » sur la politique de confidentialité et la
  déclaration d’accessibilité ; les brouillons du registre des traitements et de
  l’analyse d’impact sont dans [conformite/](conformite/).
- **Référentiels officiels** : les 18 compétences transversales, leurs critères,
  la correspondance avec les sessions et le questionnaire d’auto-évaluation sont
  **provisoires** (repris de l’outil précédent). Les 16 habiletés socio-cognitives
  proviennent de votre fichier de référence. Pour les remplacer : **Administration
  → Référentiels → Nouvelle version**, modifier, publier, puis activer.
- **Supports pédagogiques officiels** : importez-les depuis **Administration →
  Supports pédagogiques** (format : [format-supports-pedagogiques.md](format-supports-pedagogiques.md)).
- **Adresse de contact** : les messages du formulaire de contact sont consultables
  dans **Administration → Paramètres**.

## 7. Sauvegardes et exploitation

- Les sauvegardes quotidiennes sont incluses dans les offres payantes de Supabase ;
  activez la restauration à un instant donné (PITR) si la volumétrie le justifie.
- Le journal d’audit (`audit_logs`) est en ajout seul : prévoyez une purge ou un
  archivage annuel selon votre politique de conservation.
- Chaque utilisateur exporte ses données en libre-service (**Mon compte**) ; les
  demandes de suppression se traitent dans **Administration → Paramètres**.

## Données de démonstration

Ne lancez **jamais** `npm run demo:seed` sur la production. Pour s’en prémunir,
définissez `HAPPI_ALLOW_DEMO=false` dans l’environnement du poste qui détient la clé
de production : le script refusera alors de s’exécuter. `npm run demo:purge`
supprime les données marquées comme démonstration.
