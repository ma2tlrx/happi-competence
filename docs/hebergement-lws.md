# Hébergement LWS (cPanel, Node.js via Passenger)

Alternative à Vercel : l’application tourne comme un serveur Node.js autonome
(`output: 'standalone'` de Next.js) derrière Apache et Phusion Passenger, sur un
hébergement LWS doté de **Setup Node.js App**. La base et l’authentification restent
chez Supabase (étapes 1 à 3 de [deploiement.md](deploiement.md)).

Informations confirmées par le support LWS (formule L) : Node.js **22.23.4** et
24.22.1 proposés, accès **SSH** et terminal, **Tâches Cron**, 80 processus au plus.
Next.js n’a pas été testé par LWS ; la mise en veille de l’application après
inactivité n’est pas confirmée (voir « Limites »). Le paquet vise **Node.js 22.23.4**.

## 1. Construire le paquet (sur votre poste ou en CI)

```bash
npm ci
npm run package:lws
```

Le script (`scripts/package-lws.mjs`) :

1. construit avec `NEXT_OUTPUT=standalone` (sortie autonome activée **uniquement**
   par cette variable : le build Vercel n’est pas modifié) ;
2. assemble `dist/lws/app/` : `server.js` et ses `node_modules` réduits au strict
   nécessaire, `.next/static`, tout `public/` (dont les polices des PDF
   `public/fonts/report` et les logos), un `app.js` d’entrée pour Passenger, un
   `package.json` sans dépendance à installer, `BUILD.txt` (version, commit) ;
3. produit `dist/lws/happi-competence-lws-<commit>.zip` (~30 Mo, ~95 Mo décompressé).

Aucune variable d’environnement ni secret n’est inclus. Construisez sur Linux x64
(comme le serveur LWS) : le paquet embarque les binaires natifs de `sharp`
(optimisation des images) pour la plateforme de construction.

Vérifié localement (17/11/2026, Node.js 22.23.4) : le zip décompressé dans un dossier
neuf démarre avec `node app.js`, répond sur `/`, `/programmes`, `/connexion`,
`/api/health` (200 quand la base répond, 503 sinon), produit les PDF (feuille
d’émargement, passeport, feuille de présence) avec les polices du paquet et l’export
ZIP de réversibilité ; ~150 Mo de mémoire après quelques requêtes. Node.js 24 n’a
pas été testé.

## 2. Créer l’application dans cPanel 👤

**cPanel → Logiciels → Setup Node.js App → Create Application** :

| Champ | Valeur |
| --- | --- |
| Node.js version | **22.23.4** |
| Application mode | Production |
| Application root | `happi-competence` (dossier dans votre répertoire personnel, **hors** `public_html`) |
| Application URL | votre domaine (ex. `app.votre-domaine.fr`) |
| Application startup file | `app.js` |

Ne lancez pas « Run NPM Install » : les dépendances sont déjà dans le paquet.

### Variables d’environnement

Dans la même page, **Environment variables** : celles du tableau de
[deploiement.md](deploiement.md#4-déploiement-vercel-) (`NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_DEMO_MODE=false`, `HAPPI_ALLOW_DEMO=false`,
`EMAIL_*`, `CRON_SECRET`, `RATE_LIMIT_SECRET`, clés d’IA…), plus au besoin
`SENTRY_DSN` ([exploitation.md](exploitation.md#sentry-facultatif-)).

⚠ Les variables `NEXT_PUBLIC_*` sont **figées au moment du build** dans le code
envoyé au navigateur : définissez-les aussi (mêmes valeurs) dans l’environnement où
vous lancez `npm run package:lws`. Celles du serveur (clés secrètes) ne sont lues
qu’à l’exécution, dans cPanel.

## 3. Téléverser

**Par le gestionnaire de fichiers** : envoyez le zip dans `happi-competence/`,
« Extract », puis **Restart** dans Setup Node.js App.

**Par SSH** (recommandé ensuite) :

```bash
LWS_SSH=utilisateur@serveur.lws-hosting.com LWS_APP_DIR=happi-competence scripts/deploy-lws.sh
```

`scripts/deploy-lws.sh` construit, synchronise `dist/lws/app/` par `rsync` (fichiers
obsolètes retirés, `.htaccess`, `tmp/`, journaux et `.env*` du serveur préservés) puis
redémarre l’application (`tmp/restart.txt`, pris en compte par Passenger). Utilisez
une clé SSH (cPanel → Sécurité → Accès SSH → Gérer les clés) ; aucun identifiant
n’est stocké dans le dépôt. Pour automatiser depuis GitHub, un workflow manuel peut
appeler ce script avec la clé dans les *secrets* du dépôt — non fourni ici.

Contrôle : `curl -fsS https://app.votre-domaine.fr/api/health`.

## 4. Domaine et HTTPS 👤

1. **Domaines** : rattachez le domaine ou sous-domaine à l’application (l’« Application
   URL » ci-dessus).
2. **SSL/TLS Status** (AutoSSL / Let’s Encrypt) : émettez le certificat, puis forcez
   HTTPS (**Domaines → Forcer la redirection HTTPS**). L’application envoie déjà HSTS
   et une CSP avec `upgrade-insecure-requests`.
3. Supabase → Authentication → URL Configuration : `Site URL` et `Redirect URLs`
   sur ce domaine ; `NEXT_PUBLIC_SITE_URL` identique.

## 5. Tâche quotidienne des rappels (cron) 👤

Vercel appelle `/api/cron/rappels` tous les jours à 16 h UTC ; sur LWS, créez une
**Tâche Cron** (cPanel → Avancé → Tâches Cron). Pour ne pas laisser le secret dans la
ligne de commande, enregistrez l’en-tête dans un fichier privé (par SSH) :

```bash
printf 'Authorization: Bearer %s\n' 'VOTRE_CRON_SECRET' > ~/.happi-cron-header && chmod 600 ~/.happi-cron-header
```

Tâche, chaque jour à 17 h 07 (heure du serveur, Paris) :

```
7 17 * * * curl -fsS --max-time 280 -H @$HOME/.happi-cron-header https://app.votre-domaine.fr/api/cron/rappels > /dev/null
```

Réponse attendue : `{"ok":true,…}` ; 401 si le secret ne correspond pas. Si la
version de `curl` du serveur refuse `-H @fichier` (curl < 7.55), utilisez
`-H "Authorization: Bearer …"` directement dans la tâche.

## 6. Mise à jour

1. `git pull`, puis `npm ci` et `npm run package:lws` (ou `scripts/deploy-lws.sh`).
2. Migrations de base éventuelles : appliquez-les **avant** le déploiement (étape 2 de
   [deploiement.md](deploiement.md)) ; vérifiez dans leur en-tête qu’elles restent
   compatibles avec la version en ligne le temps du basculement.
3. Redémarrage (automatique avec le script, sinon **Restart** dans cPanel) ;
   vérifiez `/api/health` (le `commit` doit être le nouveau).
4. Conservez les trois derniers zips pour revenir en arrière.

## 7. Journaux

Passenger écrit la sortie de l’application dans `happi-competence/stderr.log` (ou le
journal indiqué dans Setup Node.js App). Les erreurs serveur y figurent en une ligne
JSON `"event":"server_error"` (voir [exploitation.md](exploitation.md)). Pensez à
vider ce fichier périodiquement (il n’est pas tourné automatiquement).

## 8. Limites et points d’attention

- **Mise en veille** : Passenger peut arrêter un processus inactif (réglage non
  confirmé par LWS). Le premier visiteur suivant attend alors le redémarrage (en local :
  serveur prêt immédiatement, première page en 0,3 s ; sur un serveur mutualisé, comptez
  quelques secondes). La sonde
  de supervision toutes les 5 min (exploitation.md) maintient l’application active.
- **Ressources** : ~150 Mo de mémoire par processus ; la génération d’un bilan par
  l’IA ou d’un gros PDF en demande davantage pendant quelques secondes. La limite de
  80 processus de la formule L laisse de la marge, mais la mémoire allouée n’est pas
  connue : surveillez les redémarrages dans le journal.
- **Durée des requêtes** : la génération d’un bilan peut durer jusqu’à 2 minutes ;
  vérifiez qu’aucun délai Apache / Passenger plus court ne l’interrompt (sinon,
  demandez à LWS de relever le délai ou rédigez sans IA).
- **Adresse IP des visiteurs** : la limitation de débit par IP lit `x-forwarded-for` ;
  derrière Apache/Passenger cet en-tête peut provenir du client. Les limites par
  adresse e-mail et par compte restent efficaces ; demandez à LWS si l’en-tête est
  réécrit par leur infrastructure.
- **Pas de CDN** : les fichiers `/_next/static` sont servis par Node.js (en cache
  navigateur longue durée, noms à empreinte). Toutes les pages sont rendues à chaque
  requête (CSP à nonce), comme sur Vercel.
- **Région** : choisissez un serveur LWS en France ; la latence vers Supabase
  (Irlande/Paris) s’ajoute à chaque lecture.
- **Démonstration** : `HAPPI_ALLOW_DEMO=false` en production.
