# Open Badges 3.0 vérifiables

Le participant peut recevoir des badges numériques signés par HAPPI Compétence, au format
**Open Badges 3.0** (1EdTech), lui-même fondé sur le modèle **W3C Verifiable Credentials 2.0**.
Il les télécharge, les importe dans un portefeuille numérique et transmet un lien de
vérification à un employeur ou à un organisme.

> État : fonctionnalité livrée **désactivée tant que la clé de signature n'est pas configurée**,
> avec un seul modèle de badge, **inactif et provisoire** (« Participation au programme HAPPI »),
> dont le critère reste à décider par l'équipe HAPPI.

## Sources

- 1EdTech, *Open Badges Specification v3.0* — https://www.imsglobal.org/spec/ob/v3p0/
- 1EdTech, *Open Badges 3.0 Conformance and Certification Guide* — https://www.imsglobal.org/spec/ob/v3p0/cert/
- W3C, *Verifiable Credentials Data Model v2.0* — https://www.w3.org/TR/vc-data-model-2.0/
- W3C, *Securing Verifiable Credentials using JOSE and COSE* (VC-JOSE-COSE) — https://www.w3.org/TR/vc-jose-cose/
- IETF RFC 7515 (JWS), RFC 7517 (JWK), RFC 7518 (algorithmes, dont RS256), RFC 7638 (empreinte de JWK).

**Relecture.** La spécification Open Badges 3.0 (version en ligne au 19/11/2026) et le guide de
conformité ont été relus ; les points ci-dessous en citent les sections. Points relevés :

- § 8.2.3 : en-tête JOSE limité à `alg` (RS256 au minimum), `kid` (URI déréférençable vers un
  JWK) ou `jwk`, et `typ` qui, s'il est présent, DOIT valoir `"JWT"` ; aucun autre en-tête admis.
- § 8.2.4.1 : la charge utile est le crédential lui-même, avec `iss` (= `issuer.id`), `jti`
  (= `id`), `nbf` (= `validFrom`), `sub` (= `credentialSubject.id`), tous obligatoires, et `exp`
  si `validUntil` existe. § 8.2.6.1 : le vérificateur contrôle chacune de ces égalités.
- § 5.1 / 5.2 : un badge signé en VC-JWT se transmet comme fichier dont le contenu DOIT être le
  JWS compact (extension `.jwt` ou `.jws`), ou comme ressource web en `text/plain`.
- § 9.1 : la révocation se vérifie par `credentialStatus` de type `BitstringStatusListEntry`
  (W3C Bitstring Status List v1.0).
- Guide de conformité § 3.1.1 : il ne liste que les mécanismes de preuve *Linked Data* acceptés
  (Data Integrity EdDSA `eddsa-rdfc-2022`, et ECDSA `ecdsa-sd-2023`) ; le format JWT reste décrit
  par la spécification (§ 8.2). **La certification 1EdTech n'a pas été tentée.**

## Choix techniques

| Sujet | Choix | Pourquoi |
| --- | --- | --- |
| Format de preuve | JWT (JWS compact, OB 3.0 § 8.2), crédential VC 2.0 en charge utile | Le plus simple à produire et à vérifier ; aucune canonisation JSON-LD nécessaire (contrairement aux preuves Data Integrity EdDSA, seules testées par la suite de conformité 1EdTech). |
| Algorithme | **RS256** (RSA 2 048 bits minimum, 3 072 conseillés) | « MUST be RS256 as a minimum » (§ 8.2.3) : meilleure interopérabilité. |
| Bibliothèque | **aucune** (module `node:crypto`) | La signature RS256, l'export JWK et l'empreinte RFC 7638 sont natives ; la bibliothèque `jose` n'a pas été installée. |
| En-tête | `{ "alg": "RS256", "typ": "JWT", "kid": "<adresse du JWK>" }` | § 8.2.3 ; le `kid` est une adresse https déréférençable vers la clé publique (§ 8.5). |
| Revendications JWT | `iss`, `jti`, `nbf`, `sub` (+ `iat`) | § 8.2.4.1 ; égalités contrôlées à la vérification (§ 8.2.6.1). |
| Fichier remis | `.jwt` (par défaut) : le JWS compact brut ; `.json` (secondaire) : *EnvelopedVerifiableCredential* (`id` = `data:application/vc+jwt,<JWT>`) | Le `.jwt` est le fichier Open Badges 3.0 de référence (§ 5.1). Le `.json` demandé est la forme JSON normalisée par VC 2.0 ; il n'est pas un format de fichier Open Badges et sa prise en charge par les portefeuilles n'est pas garantie. |
| Titulaire | `credentialSubject.id` = `urn:uuid:<aléatoire, propre au badge>` (exigé par `sub`) et `identifier` : `IdentityObject` de type `name`, non haché (prénom et nom) | Les participants n'ont pas d'identifiant décentralisé (DID) ; un identifiant opaque évite d'exposer un identifiant interne, le nom rattache le badge à son titulaire (§ 9.3). |
| Révocation | Contrôlée par la page de vérification (registre en base) | `credentialStatus` (facultatif) n'est **pas** inscrit : la méthode retenue par la spécification (§ 9.1) est `BitstringStatusListEntry`, qui exige de publier une liste d'états signée (elle-même un crédential). Évolution possible ; tant qu'elle n'est pas faite, un vérificateur tiers ne voit pas la révocation hors de notre page. |
| Expiration | Aucune (`validUntil` absent) | Une participation ne « périme » pas ; le propriétaire peut en décider autrement. |

### Structure d'un badge émis

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
  "id": "https://<site>/badges/verifier/<jeton>",
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "name": "<nom du badge>",
  "issuer": { "id": "https://<site>/api/badges/emetteur", "type": ["Profile"], "name": "HAPPI Compétence", "url": "https://<site>", "email": "…" },
  "validFrom": "2026-11-18T10:00:00Z",
  "credentialSubject": {
    "id": "urn:uuid:<aléatoire>",
    "type": ["AchievementSubject"],
    "identifier": [{ "type": "IdentityObject", "identityHash": "Prénom Nom", "identityType": "name", "hashed": false }],
    "achievement": {
      "id": "https://<site>/api/badges/modeles/<uuid>",
      "type": ["Achievement"],
      "name": "…", "description": "…",
      "criteria": { "narrative": "…" },
      "image": { "id": "https://<site>/brand/happi-mascotte.png", "type": "Image" },
      "tag": ["<compétences rattachées>"]
    }
  },
  "credentialSchema": [{ "id": "https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json", "type": "1EdTechJsonSchemaValidator2019" }],
  "iss": "…", "jti": "…", "sub": "urn:uuid:…", "nbf": 0, "iat": 0
}
```

Code : `src/lib/badges/credential.ts` (construction, signature, vérification), tests
`src/lib/badges/credential.test.ts` (clé générée dans le test).

## Adresses publiques

| Adresse | Contenu |
| --- | --- |
| `/api/badges/emetteur` | Profil de l'émetteur (`Profile`). Publie aussi la clé publique (`verificationMethod` de type `JsonWebKey`, `assertionMethod`, à la manière d'un document d'identifiant contrôlé du W3C) et `jwks_uri`. Ces trois propriétés ne font pas partie du `Profile` Open Badges : extension non validée. |
| `/api/badges/jwks` | Clés publiques au format JWKS (RFC 7517). Vide tant qu'aucune clé n'est configurée. |
| `/api/badges/cles/<empreinte>` | La clé publique désignée par le `kid` des badges (empreinte RFC 7638). |
| `/api/badges/modeles/<uuid>` | Description publique (`Achievement`) d'un modèle actif ou déjà émis. Aucune donnée de titulaire. |
| `/badges/verifier/<jeton>` | Page de vérification lisible par un humain (voir plus bas). |

Les réponses JSON sont lisibles par tout vérificateur (CORS ouvert, lecture seule) et non indexées.

## Clé de signature

- Variable d'environnement **`OPEN_BADGES_SIGNING_KEY`** (serveur uniquement) : JWK privée RSA,
  en JSON ou en JSON encodé en base64. Jamais dans le code, jamais en base.
- Génération (puis stockage dans le gestionnaire de secrets de l'hébergeur) :

  ```sh
  node -e "const c=require('node:crypto');const k=c.generateKeyPairSync('rsa',{modulusLength:3072}).privateKey.export({format:'jwk'});console.log(Buffer.from(JSON.stringify(k)).toString('base64'))"
  ```

- Sans clé (ou clé illisible, ou de moins de 2 048 bits) : l'émission est désactivée et
  Admin › Badges l'indique ; la page de vérification affiche « vérification momentanément
  impossible ». Le message d'erreur ne recopie jamais la clé.
- **Rotation : limite actuelle.** Seule la clé courante est publiée. Changer de clé rend les
  badges déjà émis invérifiables (page : « vérification impossible »). Avant toute rotation, il
  faudra publier aussi les anciennes clés publiques (évolution à prévoir : variable listant les
  JWK publiques retirées).
- **`OPEN_BADGES_STORAGE_SECRET`** (facultatif) chiffre la copie des badges en base ; à défaut,
  `PASSPORT_SHARE_SECRET`, puis la clé de service. Ne pas le changer une fois des badges émis.

## Données et droits

Migration `supabase/migrations/20261118120000_open_badges.sql`.

- `badge_classes` (modèles) : nom, description, critères en texte, image (adresse https ou chemin
  du site), compétences rattachées (étiquettes), règle d'attribution (JSON), actif, provisoire.
  Contrainte : **un modèle provisoire ne peut pas être actif**. Lecture : équipe HAPPI, et le
  participant pour les modèles des badges qu'il a reçus. Écriture : administrateurs.
- `badge_assertions` (badges émis) : participant, modèle, groupe, date, émetteur, empreinte SHA-256
  du JWT signé, copie chiffrée (AES-256-GCM, clé hors base), empreinte SHA-256 du jeton public
  (32 octets aléatoires, dans l'adresse de vérification), `kid`, règle et faits au moment de
  l'émission, révocation (date, auteur, motif obligatoire). Un seul badge valide par modèle et
  participant. Les colonnes empreinte du jeton et copie chiffrée ne sont lisibles par aucun client.
- **Émission et révocation : administrateurs seuls** (fonctions `issue_badge_assertion`,
  `revoke_badge_assertion`). Choix le plus prudent : un formateur peut proposer oralement, mais
  la décision d'attribuer une preuve opposable reste centralisée. Les formateurs **lisent** les
  badges de leurs participants ; les organismes n'y ont pas accès.
- Téléchargement (`/api/exports/badges/<id>`) : le titulaire d'un badge non révoqué, ou un
  administrateur (`badge_credential_ciphertext`). L'empreinte est recontrôlée avant remise.
- Journal (`private.audit`) : `badge_class.created|updated|deleted`, `badge_assertion.issued|revoked`
  (sans jeton ni crédential). Notification du participant à l'émission et à la révocation.
- Données de démonstration : `badge_assertions` est supprimé en cascade avec le participant
  (`purgeDemo`) ; `group_id` passe à vide si le groupe est supprimé. Le script de démonstration
  n'émet aucun badge (le seul modèle fourni est inactif et provisoire).

## Règles d'attribution (aucun critère inventé)

Les critères sont une **décision du propriétaire**. L'administrateur compose, pour chaque modèle,
une règle facultative à partir de faits déjà mesurés, évalués groupe par groupe
(`src/lib/badges/rules.ts`, `src/lib/badges/eligibility.ts`) :

- **heures réalisées au moins N** — même règle que le certificat de réalisation
  (`src/lib/attendance/hours.ts` : séances terminées où le participant était présent, en retard
  ou parti plus tôt ; règle elle-même « à valider avec le financeur ») ;
- **programme terminé** — groupe clôturé, ou toutes les séances prévues terminées ;
- **niveau validé d'une compétence ≥ X, au moins N fois** — évaluations validées du groupe
  (jusqu'à trois compétences).

Toutes les conditions cochées doivent être remplies. La règle **ne fait que suggérer** des
participants éligibles dans Admin › Badges › (modèle) : **rien n'est émis automatiquement**.
L'administrateur peut aussi émettre manuellement à un membre de groupe non suggéré. La règle et
les faits du moment sont conservés avec le badge (`award_snapshot`).

Modèle par défaut : « Participation au programme HAPPI », **inactif**, description et critère
marqués « provisoire — à valider », **sans règle**. Pour l'utiliser : rédiger le critère, cocher
« Critère validé par l'équipe HAPPI », puis « Modèle actif ».

## Interfaces

- **Admin › Badges** (`/admin/badges`) : état de la signature, modèles (statut, règle, nombre
  émis), création ; détail d'un modèle : participants éligibles, émission (bouton ou manuelle),
  badges émis et révocation avec motif, modification du modèle et de sa règle.
- **Mes badges** (`/participant/badges`) : badges reçus, téléchargement `.jwt` (fichier Open Badges)
  ou `.json` (enveloppé VC 2.0), lien de vérification à copier ou ouvrir.
- **Vérification publique** (`/badges/verifier/<jeton>`) : le serveur vérifie la signature avec la
  clé publique, l'empreinte enregistrée, l'adresse du badge et la révocation. Affiche le badge,
  ses critères, le prénom et l'initiale du nom du titulaire, la date. Message neutre pour un
  identifiant inconnu ; message d'alerte si le contenu ne correspond pas ; « révoqué » avec la
  date (le motif reste interne). Page non indexée, sans cache partagé ni en-tête Referer
  (`src/proxy.ts`, `next.config.ts`, `robots.ts`), comme `/verifier/<jeton>`.

## Compatibilité : ce qui n'a PAS été testé

- **Aucun import réel dans un portefeuille** (ex. portefeuilles Open Badges 3.0, application du
  type *Learner Credential Wallet*) n'a été essayé. La compatibilité n'est donc pas garantie.
- **Europass Digital Credentials (EDC)** : non testé et probablement **non compatible tel quel**.
  EDC repose sur son propre modèle (ELM, *European Learning Model*), des signatures de type
  cachet électronique (JAdES/XAdES) et des émetteurs accrédités ; un badge Open Badges 3.0 n'est
  pas un crédential EDC. Le portfolio Europass permet en revanche d'ajouter des liens et
  documents : le lien de vérification peut y figurer.
- **Validateur 1EdTech** : non exécuté. À faire avant mise en production, avec le `.jwt` d'un
  badge de test (et le schéma JSON `ob_v3p0_achievementcredential_schema.json`).
- Un vérificateur externe doit récupérer la clé via le `kid` (adresse https) : il faut que
  `NEXT_PUBLIC_SITE_URL` soit l'adresse publique définitive du site **avant** la première émission
  (elle est inscrite dans chaque badge).

## Vérifications à faire après application de la migration

1. `npm run test:security` (fichier `tests/security/badges.test.ts`).
2. Configurer une clé de test, créer un modèle, le valider, l'activer, émettre, télécharger le
   `.json`, ouvrir le lien de vérification, révoquer, recharger la page.
3. Passer le `.json` / `.jwt` dans le validateur 1EdTech et un portefeuille Open Badges 3.0.
