# Jeux d'animation (Quiz et Undercover)

Le « Site de Quizz » (quiz.happicompetence.fr) est intégré à l'application : deux jeux d'animation en direct,
**Quiz** (code + QR, questions chronométrées, classement) et **Undercover** (rôles secrets, discussion, votes, « Fourmi Caché »).
Ce document décrit le moteur et la base (chantier J1). Les pages sont l'affaire des chantiers d'interface.

> Les jeux sont des **outils d'animation**. Ils n'alimentent ni évaluations, ni passeports, ni statistiques d'impact, et rien ne doit les y brancher.

## Qui peut quoi

| Action | Qui | Contrôle |
| --- | --- | --- |
| Créer, éditer un quiz ; créer et animer une partie ; configurations Undercover | formateur (permission `games.manage`) et administrateur | serveur (session + permission + propriété) **et** RLS |
| Voir les contenus d'un autre formateur | administrateur seul | RLS + serveur |
| Rejoindre une partie, répondre, voter, lire son rôle | **tout le monde, sans compte** (code ou lien + pseudo) | serveur avec clé de service, jeton personnel, limitation de débit |

`games.manage` est applicable aux rôles `formateur` et `admin`, accordée par défaut au formateur ; l'administrateur a toutes les permissions.
Un formateur sans la permission (retirée par l'administrateur) reçoit 403 partout, et les politiques RLS refusent de toute façon.

## Données (migration `20261120100000_games.sql`)

| Table | Contenu | Accès client |
| --- | --- | --- |
| `game_quizzes`, `game_questions` | bibliothèque du formateur (`owner_id` = `profiles.id`) | propriétaire ou admin (RLS forcée) |
| `game_sessions` | partie de Quiz : code, statut, max joueurs | propriétaire ou admin : lecture, création, suppression ; statut et code changés par le serveur seulement |
| `game_session_players` | pseudo + score final + **empreinte** du jeton | pseudo/score lisibles par le propriétaire ; jamais le jeton ; aucune écriture |
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
| `guards.ts`, `tokens.ts` | droits, propriété, contrôle d'origine ; jetons aléatoires et empreintes SHA-256 |
| `http.ts`, `routes.ts`, `quiz-join.ts`, `broadcast.ts` | utilitaires des routes (serveur) |
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
- **Identité des joueurs** : chaque joueur reçoit à l'entrée un `playerToken` (aléatoire, 24 octets) ; seule son empreinte SHA-256 est conservée. Il est exigé pour répondre (Quiz), voter, lire son rôle, deviner. L'original acceptait n'importe quel `playerId` (visible de tous) : on pouvait répondre à la place d'un autre.
- Les jetons d'animateur (`hostToken`) disparaissent : l'animateur est identifié par son compte (session + permission + propriété de la partie).
- Le pseudo « CHECK_ONLY » (vérification du code par l'écran d'accueil d'origine) ne crée plus de joueur.
- La question 1 n'est plus lisible dans `state` avant le départ.

## Routes API (`/api/jeux/**`) — contrat pour les interfaces

Toutes répondent en JSON, `Cache-Control: no-store`. Erreur : `{ "error": "message en français" }` avec le statut HTTP.
**Animateur** = cookies de session HAPPI (même origine), rôle formateur/administrateur avec `games.manage`, propriétaire du contenu (ou admin) ; sinon 401 (non connecté), 403 (droits), 404 (pas à lui : on ne révèle pas l'existence).
**Public** = sans compte ; limité en débit par IP (portées `game_join` : 150 / 10 min ; `game_play` : 1 500 / 10 min ; réglables dans `src/lib/security/rate-limit-core.ts`) → 429.

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
| `GET /api/jeux/sessions/[id]` | public / animateur | — | animateur : `{ session, quiz, players: [{ id, nickname, score, joinedAt, sessionId }], liveState }` ; public : `{ session: { id, code, status, maxPlayers, createdAt }, quiz: { id, title, themeColor }, players: [{ id, nickname }], liveState }` |
| `DELETE /api/jeux/sessions/[id]` | animateur | — | `{ ok: true }` ; 409 si la partie est en cours |
| `POST /api/jeux/sessions/join` | public (`game_join`) | `{ code, nickname }` (`nickname: "CHECK_ONLY"` : vérifie seulement le code) | `{ sessionId, playerId, nickname, sessionCode, playerToken }` ; vérification : `{ valid: true, sessionCode }` |

`liveState` = `{ status, playerCount, currentQuestionIndex, totalQuestions }` ou `null`. **`playerToken` n'est renvoyé qu'ici** : l'écran joueur doit le garder (ex. `localStorage`) avec `playerId`.
Erreurs d'entrée : 404 code inconnu, 410 partie terminée, 409 partie commencée / salle complète / pseudo pris.

### Déroulé d'une partie de Quiz
| Méthode et chemin | Qui | Corps | Réponse / effet |
| --- | --- | --- | --- |
| `GET /api/jeux/quiz/[sessionId]/state` | public | — | voir « État public » ci-dessous |
| `POST …/join` | public (`game_join`) | `{ playerId, playerToken }` | `{ ok: true }` (confirme/réinscrit le joueur ; idempotent) |
| `POST …/answer` | public (`game_play`) | `{ playerId, answerId, playerToken }` | `{ ok: true, isCorrect, points, totalScore }` — le résultat de CE joueur seulement |
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
| `POST /api/jeux/undercover/games` | animateur | `{ civilWord, undercoverWord, includeMisterWhite?, nickname? }` **ou** `{ themeId, … }` | `{ gameId, code, playerId, playerToken, isHost: true }` |
| `GET /api/jeux/undercover/games?code=ABC234` | public (`game_join`) | — | `{ game }` (404 inconnu, 409 déjà commencée) |
| `GET /api/jeux/undercover/games/[id]` | public | — | `{ game }` (vue publique) |
| `POST …/[id]/join` | public (`game_join`) | `{ nickname }` | `{ playerId, playerToken, nickname }` (409 : pseudo pris, salle pleine ou partie commencée) |
| `POST …/[id]/my-role` | public (`game_play`) | `{ playerId, playerToken }` | `{ role: 'civil'\|'undercover'\|'spy', word: string\|null }` — **son** rôle seulement |
| `POST …/[id]/vote` | public (`game_play`) | `{ voterId, targetId, playerToken }` | `{ allVoted, game }` |
| `POST …/[id]/spy-guess` | public (`game_play`) | `{ spyId, playerToken, guess }` | `{ game }` |
| `POST …/[id]/start` | animateur | — | `{ game }` (rôles distribués, phase `role_reveal`) |
| `POST …/[id]/next-phase` | animateur | `{ action: 'start_discussion'\|'next_speaker'\|'start_voting' }` | `{ game }` |
| `POST …/[id]/resolve-vote` | animateur | — | `{ game }` (égalité : `status` reste `voting`, `tiebreakPlayerIds` renseigné) |
| `POST …/[id]/replay` | animateur | — | `{ game }` |
| `POST …/[id]/cancel` | animateur | — | `{ ok: true }` (salon seulement) |

`game` (vue publique) : `{ gameId, code, status, hostId, players: { [id]: { id, nickname, isHost, isEliminated, eliminatedInRound?, joinedAt } }, playerCount, currentRound, roundResults, speakingOrder, currentSpeakerIndex, voteCount, tiebreakPlayerIds?, winner?, winnerIds?, spyGuessCorrect?, maxPlayers, includeMisterWhite, createdAt, startedAt?, finishedAt?, wordPair? }`.
Ni jeton, ni rôle, ni mot, ni vote en cours ; le rôle d'un joueur éliminé n'apparaît que dans `roundResults` (résultat du tour) ; `wordPair` seulement en `game_over`.
Les thèmes (`THEMES`) s'importent depuis `@/lib/jeux/words` (module sans dépendance serveur).
Hôte : l'identifiant `playerId`/`playerToken` renvoyé à la création n'ouvre aucun droit ; ce sont le compte et la propriété de la partie qui comptent.

## Temps réel et sécurité des canaux

Le serveur diffuse (API REST Realtime, clé de service, jamais côté navigateur) sur `session-<sessionId>` et `undercover-<gameId>` les événements de l'original :
Quiz — `lobby:updated {players}`, `game:starting {countdown}`, `question:show {id,text,type,timeLimit,imageUrl,index,total}`, `question:answers {answers, remainingTime}`, `answer:received {count,total}`, `answer:result:<playerId> {isCorrect,points,totalScore}`, `question:ended {correctAnswerIds, leaderboard, stats}`, `game:ended {finalScores}` ;
Undercover — `player_joined`, `game_started`, `game_cancelled`, `phase_changed`, `tie_vote`, `vote_submitted {voteCount,totalActive,allVoted}`, `spy_guess_result`.

- **Un échec de diffusion ne fait jamais échouer une route** (une ligne technique, sans donnée de joueur, est journalisée). La pile locale n'a pas de service Realtime : les écrans doivent donc **toujours** resynchroniser par `GET …/state` (ou `GET …/games/[id]`).
- **Rien dans la sécurité ne repose sur un événement reçu.** Sur un canal public, n'importe qui peut émettre un faux événement : un écran ne doit s'en servir que comme déclencheur de relecture de `state`, jamais comme source de vérité. Les décisions (réponse acceptée, score, rôle, élimination) sont prises uniquement par les routes serveur, après contrôle du jeton.
- Les charges diffusées ne contiennent ni bonne réponse avant `question:ended`, ni rôle, mot ou jeton. Limite connue : `answer:result:<playerId>` (propre au joueur) est lisible par qui écoute tout le canal ; il n'indique pas quelle réponse a été choisie.
- **Configuration conseillée** : canaux **publics** (comme l'original) tant que les écrans sont anonymes ; les identifiants de partie sont des UUID aléatoires non listables. Des canaux **privés** (autorisation Realtime sur `realtime.messages`) ne se justifieraient que si l'animateur doit pouvoir seul émettre : aujourd'hui l'émission est faite par le serveur, donc il suffit d'interdire l'émission côté client dans les réglages Realtime du projet Supabase (« Allow public access » en réception seulement) si la version du projet le permet. À décider avec le propriétaire.

## Limites connues et points à valider

1. **Contenus provisoires** : les thèmes et paires de mots d'Undercover sont repris de l'original ; à valider avant usage en séance (aucune valeur pédagogique officielle).
2. **Pseudos** : conservés dans `game_session_players` avec le score final, tant que la partie existe (suppression du quiz = suppression en cascade). Aucune purge automatique des anciennes parties n'est programmée : à décider (ex. 90 jours).
3. **Durées de vie** : état du Quiz 24 h, état d'Undercover 4 h (comme l'original). Le brief indiquait 24 h ; à confirmer pour Undercover.
4. Un pic de plus de 6 écritures simultanées sur la même partie peut épuiser les 6 essais du verrou optimiste (503 « réessayez ») : une classe de 50 qui répond à la même seconde peut en voir quelques-uns réessayer. Une procédure SQL atomique (`jsonb_set`) supprimerait cette limite.
5. Les routes publiques de lecture (`state`, `games/[id]`) ne sont pas limitées en débit (interrogées en continu derrière une même IP) ; elles ne renvoient rien de secret.
6. Limitation par IP : elle suppose que `x-forwarded-for` est posé par l'hébergeur (voir `clientIp`).
7. `ANSWER_GRACE_MS` (2 s) et les seuils de débit sont des choix de départ à ajuster à l'usage.
8. Les tests `tests/security/games.test.ts` s'exécutent contre la pile locale **après application de la migration**.

## Import des anciennes données (optionnel)

`node scripts/import-quizzhappi.mjs export.json --owner <uuid-profil> [--out import.sql]` lit un export JSON (quiz, questions, configurations Undercover) et écrit des `INSERT … ON CONFLICT DO NOTHING` à relire puis exécuter. Le script ne contacte aucune base. Parties, joueurs et états ne sont pas importés.
