# Jeux d'animation (Quiz et Undercover)

Le « Site de Quizz » (quiz.happicompetence.fr) est intégré à l'application : deux jeux d'animation en direct,
**Quiz** (code + QR, questions chronométrées, classement) et **Undercover** (rôles secrets, discussion, votes, « Fourmi Caché »).
Ce document décrit le moteur, la base, les routes et les résultats conservés. Les pages sont l'affaire des chantiers d'interface.

> Les jeux sont des **outils d'animation**. Ils n'alimentent ni évaluations, ni bilans, ni passeports, ni CV de compétences, ni statistiques d'impact, ni exports financeurs, et rien ne doit les y brancher (voir « Résultats conservés »).

## Qui peut quoi

| Action | Qui | Contrôle |
| --- | --- | --- |
| Créer, éditer un quiz ; créer et animer une partie ; configurations Undercover | formateur (permission `games.manage`) et administrateur | serveur (session + permission + propriété) **et** RLS |
| Voir les contenus d'un autre formateur | administrateur seul | RLS + serveur |
| Rejoindre une partie, répondre, voter, lire son rôle, lire l'état | **participant connecté** (compte actif avec fiche participant) ; **animateur en mode essai** (aucun résultat) | session (cookies), compte = joueur de la partie, limitation de débit |
| Organisme, participant sans fiche, compte désactivé, visiteur non connecté | **refusés** (403 / 401) | serveur |

**Plus de joueur anonyme.** L'identité d'un joueur est celle de la **session connectée** (cookies) : plus aucun jeton (`playerToken`, `hostToken`) n'existe dans les routes, les états ou la base.

`games.manage` est applicable aux rôles `formateur` et `admin`, accordée par défaut au formateur ; l'administrateur a toutes les permissions.
Un formateur sans la permission (retirée par l'administrateur) reçoit 403 partout, et les politiques RLS refusent de toute façon.

## Données (migration `20261120100000_games.sql`)

| Table | Contenu | Accès client |
| --- | --- | --- |
| `game_quizzes`, `game_questions` | bibliothèque du formateur (`owner_id` = `profiles.id`) | propriétaire ou admin (RLS forcée) |
| `game_sessions` | partie de Quiz : code, statut, max joueurs | propriétaire ou admin : lecture, création, suppression ; statut et code changés par le serveur seulement |
| `game_session_players` | pseudo + score final + compte (`profile_id`), fiche (`participant_id`), `is_trial` | pseudo/score lisibles par le propriétaire ; jamais le compte ni la fiche ; aucune écriture |
| `game_results` | **résultats conservés** (voir plus bas) | le participant (les siens), ses formateurs, l'administrateur ; **pas l'organisme** ; aucune écriture client |
| `game_states` | état vivant du Quiz (bonnes réponses comprises), 24 h | **aucun** (aucun droit, aucune politique) |
| `game_undercover_games` | état vivant d'Undercover (rôles, mots), 4 h | **aucun** |
| `game_undercover_configs` | paires de mots enregistrées | propriétaire ou admin |

- RLS **activée et forcée** partout. Les deux tables d'état ne se lisent qu'avec la clé de service, depuis les routes.
- `public.save_game_questions(quiz, questions)` remplace les questions d'un quiz en une seule transaction (l'original supprimait puis insérait : un échec perdait tout). SECURITY INVOKER : la RLS s'applique.
- `public.purge_expired_games()` (service seulement) supprime les états expirés et clôt les parties de Quiz orphelines. Elle est appelée à chaque création de partie ; une tâche planifiée (cron) peut aussi l'appeler.
- **Journal d'activité** : déclencheurs `private.audit` sur la création/suppression d'un quiz, la création/lancement/fin d'une partie, la création d'une partie Undercover, la création/suppression d'une configuration. Métadonnées : identifiants, nombre de joueurs. **Jamais** de titre, de question, de mot ni de pseudo.
- Purge de la démo : toutes les tables dépendent de `profiles` par `on delete cascade` ; `purgeDemo` n'a rien à ajouter.
- Le code d'une partie de Quiz n'est unique que parmi les parties en cours (index partiel) : un code terminé se réutilise. Le jeu d'origine pouvait échouer à la création si un ancien code identique existait.

## Moteur (`src/lib/jeux/`)

| Fichier | Rôle |
| --- | --- |
| `scoring.ts` | points (1 000 → 500 selon la rapidité), classement, statistiques de réponses, délai de grâce de 2 s |
| `quiz-engine.ts` | transitions pures du Quiz et vue publique (`publicQuizState`) |
| `undercover-engine.ts` | règles pures d'Undercover (rôles, votes, départage, victoire) et vue publique (`toPublicState`) |
| `state-store.ts` | **verrou optimiste** : `mutateState` (lecture, mutation, écriture si la version n'a pas bougé, sinon on rejoue — 6 essais, attente aléatoire croissante) |
| `stores.ts` | stockage Supabase des états (colonne `version`, expiration renouvelée à chaque écriture) |
| `data.ts` | accès aux tables (le client est passé en argument : session = RLS, service = routes publiques) |
| `schemas.ts` | validation zod de tous les corps de requête |
| `guards.ts`, `nickname.ts` | droits, propriété, qui peut jouer, contrôle d'origine ; filtre et proposition de pseudo |
| `results.ts`, `results-load.ts` | lignes de résultats à la fin d'une partie (pures), indicateurs, lecture des résultats d'un participant |
| `http.ts`, `routes.ts`, `quiz-join.ts`, `broadcast.ts` | utilitaires des routes (serveur) : gardes `requireManager` / `requirePlayer` / `requireViewer`, enregistrement des résultats |
| `words.ts` | thèmes et paires de mots (**provisoires — à valider**), importable côté navigateur |

### Règles conservées de l'original (avec tests)
- Points : `1000 − 500 × min(temps / durée, 1)` pour une bonne réponse, 0 sinon.
- Concurrence : toutes les écritures d'état passent par le verrou optimiste ; plusieurs joueurs qui répondent ensemble n'écrasent personne (test avec lectures étalées et conflits forcés).
- Rôles : 1 undercover ; 1 « Fourmi Caché » (sans mot) à partir de 4 joueurs et si l'option est active ; le reste civils. L'animateur ne joue pas. Salle de 8 au plus, 3 joueurs minimum.
- Départage : égalité au premier dépouillement → nouveau vote **limité aux joueurs à égalité** ; égalité encore → **tirage au sort** parmi eux.
- Victoire : civils quand ni undercover ni Fourmi Caché ne reste ; sinon l'undercover (ou le Fourmi Caché) gagne quand il ne reste que deux joueurs en jeu ou plus aucun civil ; Fourmi Caché éliminé → devinette du mot des civils.

### Corrections par rapport à l'original (à valider)
- **Vote vide** : si personne ne vote, le jeu d'origine rouvrait indéfiniment le même vote vide. Ici : revote entre tous les joueurs en jeu, puis tirage au sort.
- **Entrée dans la salle** sous verrou (l'original n'en avait pas : deux entrées simultanées pouvaient s'écraser) ; pseudo unique par partie garanti **en base** (index insensible à la casse).
- **Clôture de la question** dans la même écriture que la dernière réponse (l'original la faisait après coup, hors verrou).
- **Chronomètre** : « afficher les réponses » n'est plus rejouable (un double clic remettait le chronomètre à zéro) ; une réponse reçue plus de 2 s après la fin du temps est refusée.
- **Identité des joueurs** : elle vient de la **session connectée**. Chaque action (répondre, voter, lire son rôle, deviner) vérifie, sur l'état de la partie, que le `playerId` envoyé appartient bien au compte connecté (`isPlayerOf`) : on ne peut pas jouer à la place d'un autre, même en connaissant son `playerId` (visible de tous). Un compte n'a qu'**une place par partie** (contrainte en base pour le Quiz, vérification sous verrou pour Undercover) : rejouer « rejoindre » reprend la même place.
- Les jetons d'animateur (`hostToken`) disparaissent : l'animateur est identifié par son compte (session + permission + propriété de la partie).
- Le pseudo « CHECK_ONLY » (vérification du code par l'écran d'accueil d'origine) ne crée plus de joueur.
- La question 1 n'est plus lisible dans `state` avant le départ.

## Routes API (`/api/jeux/**`) — contrat pour les interfaces

Toutes répondent en JSON, `Cache-Control: no-store`. Erreur : `{ "error": "message en français" }` avec le statut HTTP.
**Animateur** = cookies de session HAPPI (même origine), rôle formateur/administrateur avec `games.manage`, propriétaire du contenu (ou admin) ; sinon 401 (non connecté), 403 (droits), 404 (pas à lui : on ne révèle pas l'existence).
**Joueur** = compte connecté (cookies de session, même origine) : participant actif avec fiche (résultats conservés), ou formateur/administrateur en **mode essai** (`trial: true`, aucun résultat). 401 si non connecté, 403 pour tout autre compte (organisme, participant sans fiche, compte désactivé) ou si le `playerId` n'est pas celui du compte. Les routes d'entrée et de jeu restent limitées en débit par IP (portées `game_join` : 150 / 10 min ; `game_play` : 1 500 / 10 min ; réglables dans `src/lib/security/rate-limit-core.ts`) → 429. Les lectures (`state`, `games/[id]`, `sessions/[id]`) exigent aussi d'être connecté **et** joueur de la partie (ou son animateur), sinon 404.

### Bibliothèque (animateur)
| Méthode et chemin | Corps | Réponse |
| --- | --- | --- |
| `GET /api/jeux/quizzes` (`?scope=all` admin) | — | `{ quizzes: [{ id, adminId, ownerId, title, description, themeColor, createdAt, updatedAt, questionCount }] }` |
| `POST /api/jeux/quizzes` | `{ title, description?, themeColor? }` | 201 `{ quiz }` |
| `GET /api/jeux/quizzes/[id]` | — | `{ quiz, questions: [{ id, quizId, text, type, timeLimit, order, imageUrl?, answers: [{ id, text, isCorrect }] }] }` |
| `PUT /api/jeux/quizzes/[id]` | `{ quiz?: { title?, description?, themeColor? }, questions?: [{ text, type, timeLimit, imageUrl?, answers: [{ id?, text, isCorrect }] }] }` | `{ quiz, questions }` (les questions sont remplacées d'un bloc) |
| `DELETE /api/jeux/quizzes/[id]` | — | `{ ok: true }` |

`type` ∈ `multiple_choice` \| `true_false` \| `multiple_select` ; `timeLimit` 5–300 s ; 2 à 8 réponses ; 100 questions au plus. Les brouillons (énoncé ou réponses vides) s'enregistrent ; le lancement d'une partie exige des questions complètes (400 avec le message du premier défaut).

### Parties de Quiz
| Méthode et chemin | Qui | Corps | Réponse |
| --- | --- | --- | --- |
| `GET /api/jeux/sessions` (`?scope=all` admin) | animateur | — | `{ sessions: [{ id, quizId, adminId, ownerId, code, status, maxPlayers, createdAt, finishedAt?, quiz }] }` |
| `POST /api/jeux/sessions` | animateur | `{ quizId, maxPlayers? }` (2–50, défaut 10) | 201 `{ session }` |
| `GET /api/jeux/sessions/[id]` | joueur de la partie / animateur | — | animateur : `{ session, quiz, players: [{ id, nickname, score, joinedAt, sessionId }], liveState }` ; public : `{ session: { id, code, status, maxPlayers, createdAt }, quiz: { id, title, themeColor }, players: [{ id, nickname }], liveState }` |
| `DELETE /api/jeux/sessions/[id]` | animateur | — | `{ ok: true }` ; 409 si la partie est en cours |
| `POST /api/jeux/sessions/join` | joueur connecté (`game_join`) | `{ code, nickname, trial? }` (`nickname: "CHECK_ONLY"` : vérifie seulement le code, sans créer de joueur) | `{ sessionId, playerId, nickname, sessionCode, trial }` ; vérification : `{ valid: true, sessionCode, sessionId }` |

`liveState` = `{ status, playerCount, currentQuestionIndex, totalQuestions }` ou `null`. **Aucun jeton** : l'écran joueur garde `playerId` (ex. pour savoir « qui je suis » dans `state`), mais le serveur ne s'y fie pas, il se fie au compte.
`trial` doit valoir **exactement** ce qu'est le compte : `false` (ou absent) pour un participant, `true` pour un formateur/administrateur ; sinon 403 (« Le mode essai est réservé aux animateurs » / « cochez partie d'essai »).
Rejouer l'appel avec le même compte renvoie la **même place** (même `playerId`, **pseudo d'origine conservé**), y compris une fois la partie commencée ; un autre compte ne peut plus entrer après le départ.
Pseudo : 2 à 20 caractères, filtré (voir « Pseudo »). Erreurs d'entrée : 400 pseudo refusé (message en français), 401/403 compte, 404 code inconnu, 410 partie terminée, 409 partie commencée / salle complète / pseudo pris.

### Déroulé d'une partie de Quiz
| Méthode et chemin | Qui | Corps | Réponse / effet |
| --- | --- | --- | --- |
| `GET /api/jeux/quiz/[sessionId]/state` | joueur de la partie / animateur | — | voir « État public » ci-dessous (404 pour un compte qui n'est pas dans la partie) |
| `POST …/join` | joueur connecté (`game_join`) | `{ playerId }` | `{ ok: true }` (confirme/réinscrit le joueur ; idempotent ; 403 si `playerId` n'est pas celui du compte) |
| `POST …/answer` | joueur connecté (`game_play`) | `{ playerId, answerId }` | `{ ok: true, isCorrect, points, totalScore }` — le résultat de CE joueur seulement |
| `POST …/start` | animateur | — | `{ ok: true }` ; salle → décompte (`starting`, 3 s) ; partie « active » |
| `POST …/show-question` | animateur | `{ index }` | `{ ok: true }` ; affiche l'énoncé, sans les réponses |
| `POST …/reveal-answers` | animateur | — | `{ ok: true }` ; affiche les réponses, **démarre le chronomètre serveur** |
| `POST …/end-question` | animateur | — | `{ ok: true }` ; clôt la question (correction) |
| `POST …/next` | animateur | — | `{ ok: true, finished }` ; question suivante, ou fin après la dernière |
| `POST …/end` *(ajout)* | animateur | — | `{ ok: true, finished: true }` ; termine tout de suite |

Enchaînement attendu : `start` → (3 s) → `show-question {index:0}` → `reveal-answers` → réponses → (`end-question` ou toutes réponses reçues) → `next` → … La dernière réponse attendue clôt la question automatiquement.
Refus : 409 si l'action n'est pas permise à ce stade (ex. `reveal-answers` hors affichage de la question, `next` pendant le décompte).

#### État public du Quiz (`GET …/state`)
```
{ status: 'lobby'|'starting'|'question_show'|'answering'|'review'|'finished',
  currentQuestionIndex, totalQuestions,
  players: [{ id, nickname }],
  question: { id, text, type, timeLimit, imageUrl, index, total } | null,   // null au salon et au décompte
  answers: [{ id, text }] | null,            // seulement pendant 'answering', SANS isCorrect
  questionStartTime: number | null,           // ms epoch serveur, pour synchroniser le chronomètre
  answerCount: number | null,                 // réponses reçues (pendant 'answering')
  correctAnswerIds: string[] | null,          // seulement en 'review'
  leaderboard: [{ rank, id, nickname, score }] | null,   // 'review' et 'finished'
  stats: { answerCounts, totalAnswered } | null,         // 'review'
  finalScores: [{ rank, id, nickname, score }] | null }  // 'finished'
```
Cette lecture suffit à jouer **sans Realtime** (la pile locale n'en a pas) : les écrans interrogent `state` régulièrement (4 s conseillées).

### Undercover
| Méthode et chemin | Qui | Corps | Réponse |
| --- | --- | --- | --- |
| `GET /api/jeux/undercover/configs` | animateur | — | `{ configs: [{ id, name, civilWord, undercoverWord, includeMisterWhite, createdAt }] }` |
| `POST /api/jeux/undercover/configs` | animateur | `{ name, civilWord, undercoverWord, includeMisterWhite? }` | 201 `{ config }` |
| `DELETE /api/jeux/undercover/configs/[id]` | animateur | — | `{ ok: true }` |
| `POST /api/jeux/undercover/games` | animateur | `{ civilWord, undercoverWord, includeMisterWhite?, nickname? }` **ou** `{ themeId, … }` | `{ gameId, code, playerId, isHost: true }` |
| `GET /api/jeux/undercover/games?code=ABC234` | joueur connecté (`game_join`) | — | `{ game }` (401 non connecté, 404 inconnu, 409 déjà commencée sauf si le compte y a déjà sa place) |
| `GET /api/jeux/undercover/games/[id]` | joueur de la partie / animateur | — | `{ game }` (vue publique ; 404 pour un compte qui n'est pas dans la partie) |
| `POST …/[id]/join` | joueur connecté (`game_join`) | `{ nickname, trial? }` | `{ playerId, nickname, trial }` (409 : pseudo pris, salle pleine ou partie commencée ; même compte = même place, même hors salon) |
| `POST …/[id]/my-role` | joueur connecté (`game_play`) | `{ playerId }` | `{ role: 'civil'\|'undercover'\|'spy', word: string\|null }` — **son** rôle seulement (403 si `playerId` n'est pas celui du compte) |
| `POST …/[id]/vote` | joueur connecté (`game_play`) | `{ voterId, targetId }` | `{ allVoted, game }` |
| `POST …/[id]/spy-guess` | joueur connecté (`game_play`) | `{ spyId, guess }` | `{ game }` |
| `POST …/[id]/start` | animateur | — | `{ game }` (rôles distribués, phase `role_reveal`) |
| `POST …/[id]/next-phase` | animateur | `{ action: 'start_discussion'\|'next_speaker'\|'start_voting' }` | `{ game }` |
| `POST …/[id]/resolve-vote` | animateur | — | `{ game }` (égalité : `status` reste `voting`, `tiebreakPlayerIds` renseigné) |
| `POST …/[id]/replay` | animateur | — | `{ game }` |
| `POST …/[id]/cancel` | animateur | — | `{ ok: true }` (salon seulement) |

`game` (vue publique) : `{ gameId, code, status, hostId, players: { [id]: { id, nickname, isHost, isEliminated, eliminatedInRound?, joinedAt } }, playerCount, currentRound, roundResults, speakingOrder, currentSpeakerIndex, voteCount, tiebreakPlayerIds?, winner?, winnerIds?, spyGuessCorrect?, maxPlayers, includeMisterWhite, createdAt, startedAt?, finishedAt?, wordPair? }`.
Ni jeton, ni rôle, ni mot, ni vote en cours ; le rôle d'un joueur éliminé n'apparaît que dans `roundResults` (résultat du tour) ; `wordPair` seulement en `game_over`.
Les thèmes (`THEMES`) s'importent depuis `@/lib/jeux/words` (module sans dépendance serveur).
Hôte : le `playerId` renvoyé à la création n'ouvre aucun droit ; ce sont le compte et la propriété de la partie qui comptent. Les actions animateur (`start`, `next-phase`, `resolve-vote`, `replay`, `cancel`) n'envoient aucun jeton.

## Joueurs : compte, pseudo, mode essai

- **Qui joue** : un participant (rôle `participant`, compte actif, fiche participant) ; ses résultats sont conservés. Un formateur/administrateur (`games.manage`) peut rejoindre en **mode essai** : il joue normalement mais **aucun résultat n'est enregistré**, et il est exclu du rang et du nombre de joueurs des résultats des autres. Tout autre compte est refusé.
- **Pseudo** (`src/lib/jeux/nickname.ts`, testé) : 2 à 20 caractères, espaces normalisés, ni chevron ni caractère de contrôle, **ni adresse e-mail ni adresse web ni numéro de téléphone** (arobase, « http », « www », 6 chiffres ou plus), **ni insulte ou propos haineux évidents**. Le filtre est volontairement simple : liste courte comparée sans accents, majuscules ni séparateurs, avec les substitutions usuelles (0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s) ; les mots courts ne sont refusés qu'en mot entier (pas de « Dominique » bloqué). Il ne remplace pas la vigilance de l'animateur. La liste (`BLOCKED_WORDS`) est à compléter par HAPPI. `suggestNickname(prénom, nom)` fournit le pseudo proposé par défaut (« Inès M. »).
- **Place unique** : un compte = une place par partie ; rejoindre à nouveau reprend la place et le pseudo d'origine.
- **Lecture** : `state`, `sessions/[id]` et `undercover/games/[id]` ne répondent qu'aux joueurs de la partie et à son animateur.

## Résultats conservés (`game_results`)

À la fin d'une partie, **une ligne par participant** est écrite par le serveur (clé de service) :

| Jeu | Contenu |
| --- | --- |
| Quiz | date, titre du quiz, nombre de joueurs, rang, score, nombre de questions, réponses données, bonnes réponses, temps moyen de réponse (ms) |
| Undercover | date, thème (« Thème : … » ou « Mots personnalisés » : jamais les mots), nombre de joueurs, rôle (civil / undercover / fourmi caché), issue (gagné / perdu), manches survécues |

- **Quand** : Quiz : à `next` (après la dernière question) et à `end` ; Undercover : à `resolve-vote` et `spy-guess` quand la partie passe à `game_over` ; une partie rejouée (`replay`) compte pour une nouvelle manche (`play_index` 2, 3…). **Idempotent** : clé unique (participant, jeu, partie, manche), insertion « ignorer les doublons ».
- **Jamais** pour un animateur en mode essai, pour l'animateur d'Undercover, ni pour une partie sans participant. Rang et nombre de joueurs sont calculés **sans** les joueurs en mode essai. Les ex æquo se suivent dans l'ordre d'arrivée (comme le classement affiché).
- **Pas de pseudo, pas de mot secret** dans la table. Le titre d'un quiz est le texte saisi par le formateur.
- **Qui lit** (RLS forcée) : le participant (les siens), un formateur pour les participants de ses groupes (`private.trains_participant`), l'administrateur. **L'organisme n'y a pas accès** (choix prudent, à valider). Aucune écriture côté client (ni participant, ni formateur, ni administrateur).
- **Où c'est affiché** : page « Mes jeux » (`/participant/jeux`) et carte récapitulative sur « Mon profil » ; section « Jeux d'animation (hors bilan) » de la fiche participant (`/formateur/participants/[id]`, aussi utilisée par l'administrateur) ; export « Mes données » (RGPD, clé `passeport.jeux_animation`).
- **Hors bilan, passeport, CV, impact, exports financeurs** : aucune requête de ces modules ne lit `game_results`. Garde-fou automatique : `tests/security/game-results.test.ts` échoue si un fichier de `src/` hors liste blanche (pages « Mes jeux », fiche participant, export RGPD, moteur des jeux, types, libellés du journal) mentionne la table, ou si une migration autre que `20261120110000_game_results.sql` la lit.
- **Conservation** : 24 mois proposés (à valider), purge par `public.purge_old_game_results(durée)` (serveur seulement, à planifier comme `purge_expired_games`) ; suppression en cascade avec la fiche du participant. Voir `docs/conformite/registre-traitements.md` (T9).
- **Journal d'activité** : un événement `game_results.recorded` par lot (type de jeu, nombre de lignes) ; ni participant, ni pseudo, ni titre.
- **Limite connue** : si l'enregistrement échoue (base indisponible, deux essais), la fin de partie réussit quand même et les résultats de cette partie sont perdus (journalisés en erreur) ; une reprise manuelle est possible tant que l'état n'a pas expiré.

## Temps réel et sécurité des canaux

Le serveur diffuse (API REST Realtime, clé de service, jamais côté navigateur) sur `session-<sessionId>` et `undercover-<gameId>` les événements de l'original :
Quiz — `lobby:updated {players}`, `game:starting {countdown}`, `question:show {id,text,type,timeLimit,imageUrl,index,total}`, `question:answers {answers, remainingTime}`, `answer:received {count,total}`, `answer:result:<playerId> {isCorrect,points,totalScore}`, `question:ended {correctAnswerIds, leaderboard, stats}`, `game:ended {finalScores}` ;
Undercover — `player_joined`, `game_started`, `game_cancelled`, `phase_changed`, `tie_vote`, `vote_submitted {voteCount,totalActive,allVoted}`, `spy_guess_result`.

- **Un échec de diffusion ne fait jamais échouer une route** (une ligne technique, sans donnée de joueur, est journalisée). La pile locale n'a pas de service Realtime : les écrans doivent donc **toujours** resynchroniser par `GET …/state` (ou `GET …/games/[id]`).
- **Rien dans la sécurité ne repose sur un événement reçu.** Sur un canal public, n'importe qui peut émettre un faux événement : un écran ne doit s'en servir que comme déclencheur de relecture de `state`, jamais comme source de vérité. Les décisions (réponse acceptée, score, rôle, élimination) sont prises uniquement par les routes serveur, après contrôle du compte connecté.
- Les charges diffusées ne contiennent ni bonne réponse avant `question:ended`, ni rôle, mot ou jeton. Limite connue : `answer:result:<playerId>` (propre au joueur) est lisible par qui écoute tout le canal ; il n'indique pas quelle réponse a été choisie.
- **Configuration conseillée** : canaux **publics** (comme l'original) ; la sécurité ne repose pas sur le canal (les routes exigent le compte) ; les identifiants de partie sont des UUID aléatoires non listables. Des canaux **privés** (autorisation Realtime sur `realtime.messages`) ne se justifieraient que si l'animateur doit pouvoir seul émettre : aujourd'hui l'émission est faite par le serveur, donc il suffit d'interdire l'émission côté client dans les réglages Realtime du projet Supabase (« Allow public access » en réception seulement) si la version du projet le permet. À décider avec le propriétaire.

## Limites connues et points à valider

1. **Contenus provisoires** : les thèmes et paires de mots d'Undercover sont repris de l'original ; à valider avant usage en séance (aucune valeur pédagogique officielle).
2. **Pseudos et comptes** : conservés dans `game_session_players` (pseudo, score final, lien vers le compte) tant que la partie existe (suppression du quiz = suppression en cascade ; suppression du compte = suppression de la ligne). Aucune purge automatique des anciennes parties n'est programmée : à décider (ex. 90 jours). Le pseudo n'est jamais copié dans `game_results`.
3. **Durées de vie** : état du Quiz 24 h, état d'Undercover 4 h (comme l'original). Le brief indiquait 24 h ; à confirmer pour Undercover.
4. Un pic de plus de 6 écritures simultanées sur la même partie peut épuiser les 6 essais du verrou optimiste (503 « réessayez ») : une classe de 50 qui répond à la même seconde peut en voir quelques-uns réessayer. Une procédure SQL atomique (`jsonb_set`) supprimerait cette limite.
5. Les routes de lecture (`state`, `games/[id]`, `sessions/[id]`) ne sont pas limitées en débit (interrogées en continu) ; elles exigent une session valide et l'appartenance à la partie, et ne renvoient rien de secret. Chaque lecture lit le profil du compte (une requête de plus que l'ancienne lecture anonyme) : à surveiller pour une grande salle.
6. Limitation par IP : elle suppose que `x-forwarded-for` est posé par l'hébergeur (voir `clientIp`).
7. `ANSWER_GRACE_MS` (2 s) et les seuils de débit sont des choix de départ à ajuster à l'usage.
8. Les tests `tests/security/games.test.ts` et `tests/security/game-results.test.ts` s'exécutent contre la pile locale **après application des migrations** (`20261120100000_games.sql`, `20261120110000_game_results.sql`).
9. **À valider par le propriétaire** : accès de l'organisme aux résultats (aujourd'hui refusé), base légale et durée de conservation (24 mois proposés), liste de mots refusés des pseudos, forme du mode essai (un animateur ne peut jouer qu'en essai).

## Import des anciennes données (optionnel)

`node scripts/import-quizzhappi.mjs export.json --owner <uuid-profil> [--out import.sql]` lit un export JSON (quiz, questions, configurations Undercover) et écrit des `INSERT … ON CONFLICT DO NOTHING` à relire puis exécuter. Le script ne contacte aucune base. Parties, joueurs et états ne sont pas importés.
