# HAPPI Compétence

**Human Abilities & Professional Progress Integration** — *L’avenir se joue ici.*

Plateforme de suivi des compétences d’un programme d’accompagnement en six sessions :
site vitrine, passeport de compétences des participants, outils des formateurs
(présences, évaluations, lecteur pédagogique), suivi en lecture seule pour les
organismes prescripteurs et administration complète des référentiels et contenus.

## Espaces

| Espace | Accès | Fonctions principales |
| --- | --- | --- |
| Site public | libre | Accueil, programme, approche, compétences, contact, pages légales |
| Participant | inscription libre | Auto-évaluation initiale, passeport (radars CT 1–5 et HBS 1–4), parcours, bilan, export PDF |
| Formateur | code d’accès | Groupes, 6 sessions, présences (PDF/CSV), évaluations avec brouillon auto-enregistré, validation et historique, lecteur pédagogique plein écran |
| Organisme | demande validée par l’administration ou code | Suivi en lecture seule des seuls participants rattachés |
| Administrateur | code d’accès provisionné | Comptes, rôles, organismes, codes d’accès, référentiels versionnés, supports Markdown versionnés, journal d’activité |

## Pile technique

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, Tailwind CSS 4,
Supabase (PostgreSQL + RLS, Auth), Recharts, Lucide, Motion, React PDF, Zod,
Vitest, Playwright.

## Démarrage local

Prérequis : Node.js 20+, Docker.

```bash
npm install
```

```bash
npm run db:start
```

Démarre une pile Supabase locale (Postgres, Auth, API, boîte mail de test sur
http://localhost:54324), applique les migrations et génère `.env.local`.

```bash
npm run demo:seed
```

Crée des données fictives (organismes, groupes, participants, évaluations) et écrit
les identifiants de démonstration dans `.demo-credentials.json` (non versionné).

```bash
npm run dev
```

Application sur http://localhost:3000.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | Développement, build, production |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm test` | Tests unitaires (moteur d’évaluation, analyse des supports) |
| `npm run test:security` | Tests d’isolation RLS contre la base locale réelle |
| `npm run test:e2e` | Parcours Playwright (ordinateur et mobile) |
| `npm run db:start` / `stop` / `reset` / `status` | Pile Supabase locale |
| `npm run demo:seed` / `demo:purge` | Données de démonstration |
| `npm run admin:code` | Génère un code d’accès administrateur à usage unique |

## Sécurité

- Toutes les tables sont protégées par **Row Level Security** ; l’interface ne lit
  jamais les données avec des privilèges élevés.
- La clé de service n’est utilisée que côté serveur, pour des opérations précises
  (codes d’accès, formulaire de contact, suppression de compte).
- Les codes d’accès ne sont jamais stockés en clair (empreinte SHA-256, usage
  unique, expiration, révocation) ; aucun mot de passe ni code universel n’est
  inscrit dans le code.
- Les évaluations validées ne se modifient qu’avec un motif, tracé dans un
  historique en ajout seul ; le journal d’audit ne peut être ni modifié ni supprimé.
- Les tests `tests/security` vérifient l’isolation au niveau de la base
  (organisme A ↔ B, formateur ↔ groupe d’un autre, participant ↔ autre participant,
  visiteur anonyme).

## Contenus provisoires

Conformément au cahier des charges, aucun critère pédagogique, barème ou contenu
officiel n’a été inventé :

- **16 habiletés socio-cognitives** : issues du référentiel fourni.
- **18 compétences transversales**, critères d’observation, correspondance avec les
  sessions et questionnaire d’auto-évaluation : repris de l’outil précédent,
  **marqués provisoires**, à valider puis remplacer via l’administration.
- **Supports des sessions** : sessions 1 à 5 converties depuis l’outil précédent,
  session 6 = gabarit de démonstration.

## Documentation

- [Mise en production](docs/deploiement.md)
- [Architecture et modèle de données](docs/architecture.md)
- [Format des supports pédagogiques](docs/format-supports-pedagogiques.md)
