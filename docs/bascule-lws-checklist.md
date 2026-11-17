# Bascule vers cPanel M (LWS) : check-list à cocher

Objectif : passer de « Starter » à « cPanel M2 » **sans perdre les e-mails** et en gardant le site vitrine WordPress. Le passage Starter → cPanel **efface toutes les données** de l’hébergement actuel (confirmé par le support LWS) : on sauvegarde avant, on restaure après.

Légende : 👤 à faire par vous (accès LWS) · 🤖 déjà prêt dans le dépôt.

## A. Avant la bascule (compter 1 h)

- [ ] 👤 **Lister les boîtes mail** (cPanel/Espace client › E-mails) : adresse, taille, alias, redirections. Les noter dans le tableau ci-dessous.
- [ ] 👤 **Sauvegarder chaque boîte mail** : Thunderbird (IMAP) → copier tous les dossiers en « Dossiers locaux » (ou export `.mbox` avec l’extension ImportExportTools NG). Vérifier que le nombre de messages correspond.
- [ ] 👤 **Capture d’écran de la zone DNS** (Espace client › Domaine › Zone DNS) : enregistrements MX, SPF (TXT), DKIM, DMARC, A, CNAME. À conserver.
- [ ] 👤 **Exporter WordPress** : extension *All-in-One WP Migration* (ou *Duplicator*) → fichier `.wpress` (fichiers + base). Télécharger en local.
- [ ] 👤 Télécharger aussi le dossier `wp-content/uploads` (FTP) en double.
- [ ] 👤 Noter les identifiants FTP / Espace client utiles.
- [ ] 👤 Choisir un créneau calme (le site vitrine et les mails seront coupés quelques heures).

| Boîte | Taille | Alias / redirections | Sauvegardée ✔ |
| --- | --- | --- | --- |
|  |  |  |  |

## B. Le jour J

1. [ ] 👤 Espace client LWS › Changer de formule › **cPanel M2** (0 € de différence, 5,99 € HT identique). Lire l’écran : il doit confirmer l’effacement des données (c’est attendu, tout est sauvegardé).
2. [ ] 👤 Attendre l’e-mail de LWS avec les accès cPanel (identifiant, lien).
3. [ ] 👤 cPanel › **E-mail** › recréer chaque boîte (mêmes adresses, nouveaux mots de passe).
4. [ ] 👤 Vérifier la zone DNS (MX, SPF, DKIM) : comparer avec la capture de l’étape A. LWS recrée normalement les valeurs par défaut ; ajouter à la main celles qui manquent (notamment les enregistrements d’envoi transactionnel ajoutés plus tard, voir D).
5. [ ] 👤 Thunderbird : se reconnecter aux boîtes et **recopier** les dossiers sauvegardés vers les boîtes IMAP (glisser-déposer).
6. [ ] 👤 **Restaurer WordPress** : cPanel › Softaculous ou WordPress Toolkit › installer WordPress vierge, puis *All-in-One WP Migration* › Importer le `.wpress`. Vérifier les pages, les formulaires, le HTTPS.
7. [ ] 👤 cPanel › **SSL/TLS** (AutoSSL) : certificat actif pour le domaine et le sous-domaine.

## C. Installer l’application HAPPI (compter 45 min)

Le paquet est prêt et **testé sur Node 22.23.4** (la version proposée par LWS) : toutes les pages publiques répondent, en-têtes de sécurité présents.

1. [ ] 🤖 Fichier à téléverser : `dist/lws/happi-competence-lws-<commit>.zip` (régénéré avec `npm run package:lws`, voir `docs/hebergement-lws.md` §1). Me demander la dernière version avant le jour J.
2. [ ] 👤 cPanel › **Setup Node.js App** › Create : version 22.x, mode *production*, racine `happi-competence`, URL = sous-domaine choisi (ex. `app.votre-domaine.fr`), fichier de démarrage `app.js`.
3. [ ] 👤 Téléverser et extraire le zip dans la racine de l’application (Gestionnaire de fichiers).
4. [ ] 👤 Variables d’environnement (liste complète dans `docs/hebergement-lws.md` §2 et `.env.example`) : saisies **uniquement dans cPanel**, jamais dans le dépôt :
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (l’adresse HTTPS finale)
   - `CRON_SECRET`, `PASSPORT_SHARE_SECRET`, `RATE_LIMIT_SECRET` (chaînes aléatoires longues, distinctes)
   - e-mails (voir D) et, si utilisé, `OPENROUTER_API_KEY`
5. [ ] 👤 Cliquer **Restart**, ouvrir l’adresse, puis `…/api/health` : doit répondre `ok` (base de données joignable).
6. [ ] 👤 cPanel › **Tâches cron** : une fois par jour, appeler `/api/cron/rappels` avec l’en-tête d’autorisation (commande exacte dans `docs/hebergement-lws.md` §5).
7. [ ] 👤 Optionnel : une sonde de disponibilité externe (UptimeRobot, gratuit) sur `/api/health` toutes les 5 minutes, pour limiter les mises en veille de Passenger.

## D. E-mails de l’application

Les e-mails de l’application (rappels, partage) ne doivent **pas** partir de la boîte LWS (limites d’envoi). Utiliser un service transactionnel (Brevo, plan gratuit suffisant) :

- [ ] 👤 Créer le compte, authentifier le domaine (SPF/DKIM dans la zone DNS LWS : Brevo fournit les valeurs).
- [ ] 👤 Variables : `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`.
- [ ] 👤 Supabase › Authentication › SMTP : même fournisseur, pour les e-mails de connexion.

## E. Base de données Supabase (indépendant de LWS, à faire dès que possible)

- [ ] 👤 Supabase › SQL Editor : coller le fichier des **11 migrations** (me demander le fichier à jour) et exécuter **une seule fois**.
- [ ] 👤 Authentication : activer le TOTP (MFA), longueur minimale du mot de passe 10.
- [ ] 👤 Faire pivoter la clé OpenRouter collée plus tôt dans la conversation.

## F. Retour arrière

Si l’application ne démarre pas : le site WordPress et les e-mails restent indépendants. L’application peut rester sur Vercel (environnement d’essai actuel) tant que LWS n’est pas prêt : rien n’est coupé côté ancien outil.
