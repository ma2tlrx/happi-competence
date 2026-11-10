-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — supports pédagogiques initiaux (provisoires)
--
-- Sessions 1 à 5 : séquences de l'outil précédent converties en Markdown.
-- Session 6      : gabarit de démonstration.
-- Les fichiers sources sont dans content/supports/. Chaque support se remplace
-- depuis l'espace administrateur (Contenus pédagogiques → Importer).
-- ════════════════════════════════════════════════════════════════════════════

do $block$
declare
  v_program_session uuid;
  v_content uuid;
  v_version uuid;
begin
  select ps.id into v_program_session
  from public.program_sessions ps join public.programs p on p.id = ps.program_id
  where p.is_public and ps.number = 1;
  insert into public.pedagogical_contents (program_session_id) values (v_program_session) returning id into v_content;
  insert into public.pedagogical_content_versions (content_id, version_number, markdown, source_filename, change_note, is_provisional, published_at)
  values (v_content, 1, $support$# Session 1 — La communication

> **Support provisoire.** Contenu repris de l’outil précédent, en attente du support officiel.

- **Durée** : 3 h 05
- **Participants** : 8

## Objectifs

Développer l'écoute active, l'assertivité et la coopération par le jeu (Moving Out, WorldGuessr) et le débat.

## Compétences observées

- **Compétences transversales** : Relationnel, Esprit d'équipe, Compréhension
- **Habiletés socio-cognitives** : Sensibilité sociale, Adaptation relationnelle, Coopération, Planification, Traitement de l'information

## Accueil & Présentation du programme

- **Durée** : 10 min
- **Type** : Introduction

### Objectifs de la session

Permettre aux participants de comprendre le cadre du programme et de se projeter dans les 6 sessions à venir.

### Contenu

- Présentation du programme : les 6 sessions, leurs thèmes et leurs liens entre eux
- Rappel du fonctionnement : alternance jeux / débrief / mise en commun
- Explication du rôle de l'observation et de l'autoévaluation : pourquoi ça compte
- Objectif final : découvrir ses forces, progresser et valoriser ses qualités humaines

### Conseil au formateur

Prenez le temps d'instaurer un climat bienveillant dès cette première étape. Invitez les participants à se présenter brièvement si c'est leur première rencontre.

### À observer

- Niveau d'engagement à l'arrivée
- Participants qui se connaissent déjà
- Questions ou appréhensions exprimées

## Introduction à la Communication en entreprise

- **Durée** : 10 min
- **Type** : Apport théorique

### Notions clés à transmettre

La communication est un processus actif qui implique : recevoir, comprendre, ajuster, transmettre et s'adapter en permanence.

### Communication VERBALE

Ce sont les mots que l'on utilise, à l'oral ou à l'écrit.

→ Elle exprime le contenu du message.

Exemples : expliquer une consigne, poser une question, rédiger un email.

### Communication NON-VERBALE

Ce sont les signaux envoyés sans les mots : gestes, posture, regard, ton, expressions du visage, silences.

→ Elle traduit l'émotion et l'attitude.

### Les 3 concepts fondamentaux

- Communication interpersonnelle : L'échange humain global entre deux personnes ou plus. Il prend en compte le verbal, le non-verbal, le contexte et les émotions.
- Écoute active : L'art d'écouter pour comprendre réellement ce que dit l'autre, et non uniquement pour préparer sa propre réponse.
- Assertivité : La capacité à exprimer clairement ses idées, ses besoins ou ses limites sans agressivité et sans passivité. Trouver l'équilibre entre s'affirmer et respecter l'autre.

### Consigne pour les participants

Chaque participant identifie un exemple concret de bonne et mauvaise communication vécue.

### À observer

- Connaissance préalable des concepts
- Réactions à la notion d'assertivité
- Participants qui associent communication = parler uniquement

## Auto-évaluation initiale

- **Durée** : 10 min
- **Type** : Activité

### Objectif de l'auto-évaluation

Permettre à chaque participant de prendre conscience de sa propre perception de ses compétences en communication, avant les activités. Cette évaluation servira de référence pour mesurer l'évolution en fin de programme.

### Consigne pour les participants

Chaque participant complète son auto-évaluation individuellement et en silence.

### À observer

- Réaction face à l'auto-évaluation
- Participants qui hésitent ou posent des questions
- Niveau de conscience de soi apparent

## Icebreaker — Jeu de l'Imposteur

- **Durée** : 15 min
- **Type** : Activité

### Objectif pédagogique

Mobiliser l'écoute, l'attention, la reformulation et la compréhension dans un contexte ludique et détendu.

### Déroulé du jeu

- Un paquet de 8 cartes est distribué secrètement
- 6 cartes portent le même mot (lié à la communication)
- 1 carte porte un mot opposé : c'est l'Imposteur
- 1 carte est vide : c'est l'Espion
- Tour de parole (sens horaire) : chaque joueur dit UN mot en lien avec sa carte, sans jamais dire le mot exact de la carte.
- Premier vote : à la fin du tour, tous votent pour éliminer le joueur le plus suspect.
- Deuxième tour si nécessaire : si l'imposteur ou l'espion ne sont pas éliminés, un nouveau tour commence avec de nouveaux mots.

### Règles

- Interdiction de dire le mot exact de sa carte
- Interdiction de répéter un mot déjà utilisé lors d'un tour précédent
- Les mots doivent rester cohérents avec la thématique de la manche
- Victoire des civils → si l'imposteur ou l'espion sont éliminés
- Victoire de l'imposteur/espion → si ils survivent à tous les votes

### Configuration des manches

Manche 1 — Civils : Réunion d'Entreprise (1|2|3|5|7|8) / Imposteur : Pause Cafétéria (6) / Espion : Aucun mot (4)

Manche 2 — Civils : Entretien d'Embauche (1|3|4|5|6|7) / Imposteur : Entretien de Licenciement (2) / Espion : Aucun mot (8)

### Consigne pour les participants

Les participants jouent les manches de l'Imposteur selon les règles décrites.

### À observer

- Facilité à trouver des mots associés
- Stratégies de bluff utilisées
- Gestion des émotions lors des votes

## Débat thématique — Questions OUI / NON

- **Durée** : 20 min
- **Type** : Débat

### Objectifs pédagogiques

- Développer l'écoute active et la capacité d'argumentation
- Travailler la reformulation, l'adaptation et le respect des tours de parole
- Initier une réflexion concrète sur la communication en milieu professionnel
- Encourager chaque participant à se positionner clairement, puis à nuancer sa réponse

### Méthode : Questions fermées OUI / NON → puis ouverture

Pour chaque thème, le facilitateur pose une question fermée. Chaque participant répond d'abord uniquement par OUI ou par NON. Ensuite seulement, le débat s'ouvre : les participants expliquent leur choix, peuvent changer d'avis et échangent librement.

### Règles du débat

- Répondre d'abord par OUI ou NON uniquement - pas d'explication dans un premier temps
- Chacun peut s'exprimer sans être interrompu lors de la phase d'explication
- Autorisé de dire « je change d'avis » si on est convaincu par un argument
- Autorisé de dire « je ne sais pas » ou « je passe » si on ne trouve pas de mots
- Parler à partir de son expérience et de son ressenti, pas de jugements sur les autres

### THÈME 1 : Peut-on bien travailler avec quelqu'un qu'on n'aime pas ?

Scénario : Tu es en binôme avec une personne qui t'énerve. Vous avez une mission commune à rendre dans les temps.

Questions OUI / NON :

1. Est-ce qu'on peut travailler efficacement avec quelqu'un qu'on n'apprécie pas ?
2. As-tu déjà réussi à mettre de côté tes émotions pour accomplir une tâche ?
3. Est-ce que « faire semblant » que tout va bien est une bonne stratégie au travail ?
4. Peut-on demander à son responsable d'être retiré d'un binôme sans raison professionnelle ?
5. Est-il possible de respecter quelqu'un sans l'apprécier personnellement ?

Pistes de solution : Poser un cadre clair dès le départ (rôles, tâches, livrables) / Se concentrer sur la tâche commune, pas sur la relation / Communiquer sur les faits plutôt que sur les émotions / Demander un temps de recul ou un médiateur si nécessaire / Distinguer le professionnel du personnel

### THÈME 2 : Est-ce que tout se dit ?

Scénario : Ton collègue est en retard de façon récurrente. Ça te frustre et ça impacte ton travail.

Questions OUI / NON :

1. Est-ce qu'il faut toujours dire ce qu'on pense à ses collègues ?
2. Y a-t-il des moments où il vaut mieux garder quelque chose pour soi au travail ?
3. Peut-on dire une vérité difficile sans blesser la personne en face ?
4. Est-ce que le contexte (lieu, moment, relation) change ce qu'on peut ou ne peut pas dire ?
5. As-tu déjà regretté d'avoir dit quelque chose, ou au contraire de ne pas l'avoir dit ?

Pistes de solution : Appliquer la CNV : faits, ressentis, besoins, demandes concrètes / Bien choisir le moment et le lieu pour aborder un sujet sensible / Utiliser le « je » plutôt que le « tu » accusateur / Poser des questions avant de tirer des conclusions / Exprimer ce qu'on ressent sans interpréter les intentions de l'autre

### THÈME 3 : Faut-il toujours écouter les autres, même s'ils ont tort ?

Scénario : En réunion, quelqu'un propose une idée que tout le monde juge absurde ou hors-sujet.

Questions OUI / NON :

1. Est-ce qu'il faut toujours dire ce qu'on pense à ses collègues ?
2. Est-ce qu'écouter quelqu'un veut dire qu'on est d'accord avec lui ?
3. Peut-on apprendre quelque chose d'une idée qu'on juge mauvaise ?
4. Est-il acceptable d'interrompre quelqu'un en réunion si son idée fait perdre du temps ?
5. As-tu déjà changé d'avis sur une idée après avoir vraiment écouté la personne ?

Pistes de solution : Écouter pour comprendre, pas pour répondre / Reformuler l'idée de l'autre avant de la critiquer / Répondre avec respect même en cas de désaccord total / Proposer une alternative constructive plutôt que de rejeter en bloc / Rappeler que toute prise de parole mérite d'être considérée

### Conseil au formateur

Encourager les plus discrets à se positionner par OUI/NON même sans argumenter dans un premier temps.

Valoriser les reformulations, les compromis et les évolutions d'opinion.

Relancer avec : « Peux-tu expliquer pourquoi ? », « Comment tu l'aurais fait toi ? », « Est-ce que quelqu'un pense le contraire ? »

Relier le débat au jeu qui suit : coopération, écoute, gestion de conflit.

### À observer

- Capacité à se positionner clairement
- Qualité de l'argumentation
- Écoute et respect lors des échanges
- Évolution d'opinion

## Pause

- **Durée** : 10 min
- **Type** : Pause

Temps de récupération libre pour les participants. Inviter à s'hydrater et à décompresser avant la session de jeu vidéo.

### Consigne pour les participants

Pause libre.

## Activités Ludiques — Moving Out & WorldGuessr

- **Durée** : 80 min
- **Type** : Activité

### Objectifs pédagogiques

- Observer et mesurer l'expression des compétences en situation de coopération
- Identifier les forces et les axes d'amélioration de chaque participant
- Favoriser une prise de conscience individuelle et collective des compétences mobilisées

### ─── MOVING OUT (60 min) ───

Moving Out est un jeu vidéo coopératif dans lequel les joueurs doivent déménager des meubles d'une maison jusqu'à un camion le plus rapidement possible.

### LES COMMANDES

- Joystick gauche : se déplacer
- B : attraper / porter un objet
- A : sauter
- Y : lancer un objet
- X : courir (sprint)
- ZR / ZL : interagir selon certaines actions ou mécaniques spéciales
- + : mettre le jeu en pause / ouvrir le menu

### Conseil facilitateur

- Former deux groupes de 3 ou 4 équilibrés : mélanger les niveaux d'expérience et personnalités.
- Éviter de mettre tous les joueurs timides ensemble : favoriser la communication.
- Vérifier le matériel : brancher toutes les manettes (3 ou 4 selon le groupe).
- Réinitialiser les sauvegardes : lancer une nouvelle partie pour que tous commencent au même niveau.

### Activité pour 3 joueurs

Niveau 1 : Les joueurs jouent librement afin de découvrir le jeu et les touches. Il n'y a pas de consigne particulière. L'objectif est simplement de comprendre comment se déplacer et manipuler les objets.

Niveaux 2 et 3 : Les joueurs n'ont pas le droit de parler. Ils doivent communiquer uniquement avec des gestes ou en pointant du doigt pour s'organiser et réussir le déménagement.

Feedback : Les joueurs expliquent comment ils ont réussi à se faire comprendre, quels gestes ont bien fonctionné et ce qui était compliqué sans parler.

Niveaux 4 à 8 : Un joueur devient éclaireur. Il ne déménage pas mais guide l'équipe à l'oral et décide qui fait quoi. L'équipe est composée de 1 éclaireur et 2 déménageurs.

Feedback : Les joueurs expliquent si les consignes de l'éclaireur étaient claires, si l'organisation a aidé et comment la communication a amélioré le travail d'équipe.

### Activité pour 4 joueurs

Niveau 1 : Découverte libre du jeu et des touches.

Niveaux 2 et 3 : Communication uniquement par gestes ou en pointant du doigt.

Feedback : idem.

Niveaux 4 à 7 : Un joueur devient éclaireur. L'équipe est composée de 1 éclaireur et 2 déménageurs.

Feedback : idem.

### ─── WORLDGUESSR (20 min) ───

Worldguessr est un jeu en ligne où les joueurs doivent deviner leur position dans le monde à partir de vues Street View.

### LES COMMANDES

- Clic gauche : Se déplacer et tourner la caméra à 360°
- Molette souris : Zoom sur la carte pour placer le marqueur
- Entrée : Valider votre estimation

### Conseil facilitateur

- Former deux groupes de 3 ou 4 équilibrés : mélanger les niveaux de connaissances géographiques et les styles de raisonnement.
- Encourager la communication : ne pas mettre tous les joueurs timides ensemble, favoriser le partage d'observations et d'hypothèses.
- Vérifier le matériel : ordinateur et connexion internet stable pour tous les participants.

### Organisation

Deux équipes s'affrontent (3 ou 4 joueurs contre 3 ou 4 joueurs).

L'objectif : deviner correctement les lieux sur la carte de France plus rapidement que l'équipe adverse.

Matériel : ordinateur, connexion stable, accès à worldguessr.

### Déroulement

- Héberger une partie de 5 manches avec un temps par manches de 90 secondes — sur la carte : France
- Une fois la partie terminée : héberger une nouvelle partie de 5 manches avec un temps par manches de 60 secondes — sur la carte : Tous les Pays
- Les joueurs doivent communiquer en équipe pour partager leurs observations, discuter des indices et décider ensemble où placer le marqueur.

### Feedback après le tournoi

- Les joueurs expliquent comment ils ont organisé la communication.
- Quelles stratégies ont été efficaces pour deviner les lieux.
- Ce qui aurait pu être amélioré pour mieux collaborer.

### Ce que l'on observe pendant les jeux

Comment chaque participant communique sous pression, s'adapte aux autres, prend des initiatives, accepte les erreurs et soutient ses coéquipiers.

### Consigne pour les participants

Jeu en équipe : Moving Out puis WorldGuessr selon les consignes décrites.

### À observer

- Communication verbale et non-verbale
- Répartition spontanée des rôles
- Gestion des erreurs et des conflits
- Leadership naturel émergent
- Adaptation aux contraintes du jeu

## Quiz de consolidation — Kahoot

- **Durée** : 15 min
- **Type** : Apport théorique

### Objectifs pédagogiques

- Vérifier la compréhension des notions vues pendant la session
- Consolider les apprentissages (communication, coopération, écoute)
- Amener les participants à faire des liens entre théorie et pratique (jeux + débat)
- Identifier les points à renforcer avant la suite du programme

Format : Quiz interactif (oral ou écrit) — Questions variées : QCM / Vrai-Faux / situations — Réponses individuelles puis correction collective

### Réponses & Explications

1. QCM → B. De l'écoute active — L'écoute active, c'est être pleinement attentif (regard, posture, réactions). Le téléphone casse la connexion.
2. V/F → Faux — Communiquer, c'est aussi recevoir, comprendre, ajuster et s'adapter à l'autre.
3. QCM → C. L'écoute active — Reformuler montre que tu écoutes et que tu veux bien comprendre avant de répondre.
4. QCM → A. Tu lui demandes son avis — La coopération implique d'inclure tout le monde. Inviter à s'exprimer améliore le travail d'équipe.
5. QCM → B. Le ton, les gestes, la posture — Le non verbal transmet souvent plus d'émotions que les mots.
6. V/F → Faux — L'assertivité, c'est s'exprimer clairement tout en respectant les autres. Ce n'est pas être brutal.
7. QCM → C. Écouter et chercher un compromis — Les conflits bien gérés améliorent la coopération.
8. QCM → D. Tu changes ta façon d'expliquer — S'adapter, c'est ajuster son message selon l'autre.
9. QCM → A. Ce que l'autre comprend — La communication réussie dépend de la compréhension du message, pas juste de son émission.
10. V/F → Vrai — Comprendre les émotions des autres aide à mieux communiquer et travailler ensemble.
11. BONUS → Faux — Ce n'est pas le volume qui compte, mais la clarté, l'écoute et l'adaptation.

### Conseil facilitateur

Inviter les participants à sortir leur téléphone et scanner le QR code ou se rendre sur kahoot.it / sur l'application Kahoot.

Afficher le code de la partie et vérifier que chacun est bien connecté avant de démarrer.

Encourager l'utilisation de pseudos clairs (prénom ou nom d'équipe) pour faciliter le suivi du classement.

Rappeler les règles : lire les questions jusqu'au bout, prendre le temps de réfléchir, attention aux questions pièges.

Relancer l'engagement : « On va voir qui a été le plus attentif pendant la session », « Le classement peut changer jusqu'à la fin ».

### Consigne pour les participants

Les participants répondent au quiz Kahoot individuellement puis correction collective.

### À observer

- Notions bien assimilées
- Points de confusion à clarifier
- Engagement et dynamique du quiz

## Conclusion & Mise en commun

- **Durée** : 15 min
- **Type** : Débriefing

### Notions à aborder

- Écoute active : se concentrer sur la compréhension avant de répondre
- Reformulation : reformuler pour éviter les malentendus et montrer qu'on a compris
- Gestion des émotions : reconnaître ses émotions sans se laisser déborder dans les interactions
- Savoir demander sans imposer / refuser sans blesser
- Communication bienveillante : exprimer ses besoins sans accuser ni attaquer l'autre

### Consigne pour les participants

Tour de table : chaque participant partage ce qu'il retient de la session et un point sur lequel il souhaite progresser.

### À observer

- Capacité à identifier ses propres axes de progression
- Qualité des prises de parole
- Liens entre théorie et pratique exprimés
$support$, 'session-1.md', 'Reprise du support de l’outil précédent (version provisoire).', true, now())
  returning id into v_version;
  update public.pedagogical_contents set current_version_id = v_version where id = v_content;
end
$block$;

do $block$
declare
  v_program_session uuid;
  v_content uuid;
  v_version uuid;
begin
  select ps.id into v_program_session
  from public.program_sessions ps join public.programs p on p.id = ps.program_id
  where p.is_public and ps.number = 2;
  insert into public.pedagogical_contents (program_session_id) values (v_program_session) returning id into v_content;
  insert into public.pedagogical_content_versions (content_id, version_number, markdown, source_filename, change_note, is_provisional, published_at)
  values (v_content, 1, $support$# Session 2 — Adaptabilité et gestion du stress

> **Support provisoire.** Contenu repris de l’outil précédent, en attente du support officiel.

- **Durée** : 3 h 00
- **Participants** : 8

## Objectifs

Développer la réactivité, la gestion des priorités et la maîtrise émotionnelle sous pression via Keep Talking et Unchained Together.

## Compétences observées

- **Compétences transversales** : Adaptabilité, Gestion des priorités, Gestion du stress
- **Habiletés socio-cognitives** : Auto-évaluation, Auto-régulation, Auto-organisation, Auto-mobilisation, Sensibilité sociale, Adaptation relationnelle, Planification, Arbitrage, Synthèse, Flexibilité mentale, Projection

## Accueil & Cadrage de la session

- **Durée** : 10 min
- **Type** : Introduction

### Objectifs de la session

- Comprendre l'importance de l'adaptabilité et de la gestion du stress en entreprise.
- Poser le cadre : savoir s'ajuster dans l'incertitude et gérer la pression.
- Définir les attentes : entraide, calme et résilience collective.

### Contenu

- Rappel du fonctionnement : alternance jeux / débrief / mise en commun
- Objectif final : apprendre à transformer le stress en ressource, à mieux planifier et prioriser

### Conseil au formateur

Installez un climat de sécurité. Le stress est un sujet personnel ; rappelez que l'objectif est l'expérimentation, pas la performance absolue.

### À observer

- Niveau d'énergie et d'engagement
- Relation au stress exprimée par les participants
- Appréhensions ou motivations partagées

## Introduction à l'Adaptation en entreprise

- **Durée** : 10 min
- **Type** : Apport théorique

### Notions clés à transmettre

L'adaptabilité est la capacité à modifier son comportement ou sa stratégie face à un changement d'environnement ou une situation imprévue.

### Les 3 concepts fondamentaux

- Régulation émotionnelle : Le stress peut être un moteur (adrénaline) ou un frein (paralysie). Savoir le réguler est une compétence clé.
- Gestion des priorités : Savoir trier l'information sous pression : faire la différence entre l'Urgent et l'Important.
- Outils de gestion : Utiliser la respiration, le recentrage, la planification courte et la flexibilité mentale.

### Consigne pour les participants

Les participants identifient une situation récente où ils ont dû s'adapter rapidement.

### À observer

- Connaissance préalable de la matrice Urgent/Important
- Rapport personnel au stress
- Stratégies de gestion déjà utilisées

## Icebreaker — Jeu de l'Imposteur

- **Durée** : 20 min
- **Type** : Activité

### Objectif pédagogique

Mobiliser l'écoute, l'attention, la reformulation et la compréhension dans un contexte ludique et détendu.

### Déroulé du jeu

- Un paquet de 8 cartes est distribué secrètement
- 6 cartes portent le même mot (lié à la communication)
- 1 carte porte un mot opposé : c'est l'Imposteur
- 1 carte est vide : c'est l'Espion
- Tour de parole (sens horaire) : chaque joueur dit UN mot en lien avec sa carte, sans jamais dire le mot exact de la carte.
- Premier vote : à la fin du tour, tous votent pour éliminer le joueur le plus suspect.
- Deuxième tour si nécessaire : si l'imposteur ou l'espion ne sont pas éliminés, un nouveau tour commence avec de nouveaux mots.

### Règles

- Interdiction de dire le mot exact de sa carte
- Interdiction de répéter un mot déjà utilisé lors d'un tour précédent
- Les mots doivent rester cohérents avec la thématique de la manche
- Victoire des civils → si l'imposteur ou l'espion sont éliminés
- Victoire de l'imposteur/espion → si ils survivent à tous les votes

### Configuration des manches

Manche 1 — Civils : Feeling (1|3|4|6|7|8) / Imposteur : Stratégie (2) / Espion : Aucun mot (5)

Manche 2 — Civils : Prendre du recul (1|2|3|5|6|7) / Imposteur : Incertitude (4) / Espion : Aucun mot (8)

### Consigne pour les participants

Les participants jouent les manches de l'Imposteur selon les règles décrites.

### À observer

- Gestion de la pression du vote
- Capacité à rester calme sous observation
- Stratégies verbales utilisées

## Débat thématique — Questions OUI / NON

- **Durée** : 20 min
- **Type** : Débat

### Objectifs pédagogiques

- Développer l'écoute active et la capacité d'argumentation
- Travailler la reformulation, l'adaptation et le respect des tours de parole
- Initier une réflexion concrète sur la communication en milieu professionnel
- Encourager chaque participant à se positionner clairement, puis à nuancer sa réponse

### Méthode : Questions fermées OUI / NON → puis ouverture

Pour chaque thème, le facilitateur pose une question fermée. Chaque participant répond d'abord uniquement par OUI ou par NON. Ensuite seulement, le débat s'ouvre.

### Règles du débat

- Répondre d'abord par OUI ou NON uniquement - pas d'explication dans un premier temps
- Chacun peut s'exprimer sans être interrompu lors de la phase d'explication
- Autorisé de dire « je change d'avis » si on est convaincu par un argument
- Autorisé de dire « je ne sais pas » ou « je passe » si on ne trouve pas de mots
- Parler à partir de son expérience et de son ressenti, pas de jugements sur les autres

### THÈME 1 : Peut-on bien travailler sous pression ?

Scénario : Tu es en stage, ton responsable panique à cause d'un imprévu majeur. Le reste de l'équipe commence à perdre ses moyens.

Questions OUI / NON :

1. Un leader doit-il toujours cacher son stress pour rester crédible ?
2. Le stress peut-il être un moteur positif pour l'efficacité ?
3. Est-il acceptable de dire "je craque" devant ses collègues ?
4. Peut-on prendre une décision réfléchie sous une pression extrême ?
5. Le calme est-il la seule preuve de professionnalisme ?

Pistes de solution : Reconnaître son émotion sans la laisser déborder sur l'équipe / Utiliser des techniques de respiration flash pour redescendre en pression / Communiquer sur ses limites avant d'atteindre le point de rupture / Déléguer ou demander un court temps de recul pour y voir clair / Distinguer la panique (bloquante) de l'urgence (stimulante)

### THÈME 2 : Il vaut mieux agir vite ou attendre pour analyser ?

Scénario : Une erreur technique bloque une commande client importante. Tu dois choisir entre une réparation de fortune immédiate ou une analyse approfondie qui prend du temps.

Questions OUI / NON :

1. Est-ce que "mieux vaut fait que parfait" s'applique toujours en urgence ?
2. Attendre pour analyser est-il perçu comme de la passivité ?
3. Peut-on regretter d'avoir agi trop vite même si le problème est résolu ?
4. L'instinct est-il un bon guide dans la gestion de crise ?
5. Faut-il demander l'avis de tout le monde avant d'agir dans l'urgence ?

Pistes de solution : Identifier les priorités vitales (ce qui bloque la situation) / Expliquer son choix de recul pour rassurer l'équipe/le client / Découper le problème : action immédiate vs solution pérenne / S'appuyer sur des faits concrets plutôt que sur la peur / Arbitrer rapidement : qui a l'expertise nécessaire ici ?

### THÈME 3 : Peut-on être trop adaptable ?

Scénario : Dans un projet de groupe, un collaborateur change constamment de stratégie pour s'adapter aux envies de chacun. Résultat : le projet piétine.

Questions OUI / NON :

1. Est-ce que dire "oui" à tous les changements est une preuve de compétence ?
2. L'adaptabilité peut-elle être vue comme un manque de personnalité ?
3. Faut-il parfois refuser de s'adapter pour protéger ses propres priorités ?
4. Trop de flexibilité peut-il nuire à la confiance de l'équipe ?
5. Est-il plus dur de s'adapter à une personne qu'à une situation technique ?

Pistes de solution : Définir un cadre clair : qu'est-ce qui est négociable et qu'est-ce qui ne l'est pas ? / Apprendre à dire non pour protéger la cohérence du projet / Utiliser l'adaptabilité pour améliorer la direction, pas pour en changer sans arrêt / Maintenir une ligne directrice malgré les ajustements nécessaires / Développer sa sensibilité sociale pour comprendre les besoins derrière les demandes

### Conseil au formateur

Encourager les plus discrets à se positionner par OUI/NON même sans argumenter dans un premier temps.

Valoriser les reformulations, les compromis et les évolutions d'opinion.

Relancer avec : « Peux-tu expliquer pourquoi ? », « Comment tu l'aurais fait toi ? », « Est-ce que quelqu'un pense le contraire ? »

Relier le débat au jeu qui suit : coopération, écoute, gestion de conflit.

### À observer

- Rapport personnel au stress exprimé
- Capacité à nuancer
- Connaissance de stratégies de gestion du stress

## Pause

- **Durée** : 10 min
- **Type** : Pause

Temps de récupération libre pour les participants. Inviter à s'hydrater et à décompresser avant la session de jeu vidéo.

### Consigne pour les participants

Pause libre.

## Keep Talking and Nobody Explodes — Désamorçage coopératif

- **Durée** : 40 min
- **Type** : Activité

Keep Talking and Nobody Explodes est un jeu vidéo coopératif et intense où les joueurs doivent désamorcer une bombe avant qu'elle n'explose.

### LES COMMANDES

Navigation et interaction

- Souris – Pointer et cliquer sur les modules, boutons, fils ou interrupteurs
- Clic gauche – Sélectionner un module ou interagir avec un élément
- Clic droit – Faire pivoter certains modules ou objets (selon module)
- Molette de souris – Zoom avant/arrière sur certains modules si nécessaire

### Explications du format

Les deux jeux se déroulent en simultané, avec des participants répartis en deux groupes distincts. Chaque groupe est installé dans une pièce différente afin de favoriser la concentration, la communication et l'immersion dans l'activité. À mi-parcours du temps prévu, une rotation est effectuée afin que chaque groupe puisse expérimenter le second jeu.

### Conseil facilitateur

- Former équilibrés : mélanger les niveaux d'expérience et les personnalités pour que chaque équipe ait des joueurs confiants et d'autres plus prudents.
- Encourager la communication : éviter de mettre tous les joueurs timides ensemble, car le jeu repose sur des échanges clairs sous pression.
- Distribuer les manuels de désamorçage : prévoir au moins un manuel par joueur, afin que tous puissent consulter les instructions nécessaires pour guider le désamorçeur.
- Utiliser le code 750 au démarrage si un joueur utilise le manuel sur téléphone.

Organisation : Groupe de 3 ou 4 joueurs.

L'objectif : désamorcer les bombes en équipe le plus efficacement possible.

Matériel : ordinateur, connexion stable, accès au jeu, ardoise pour prise de note et manuels de désamorçage (au moins une ardoise et un manuel par joueur).

### Déroulement

- L'activité se déroule sur la moitié de la durée prévue de la session.
- Un joueur est désamorçeur pendant qu'un ou plusieurs coéquipiers consultent le manuel et donnent les instructions.
- Si le désamorçeur réussit à désamorcer la bombe, il passe le rôle au joueur suivant.
- Si le désamorçeur échoue, il reste à son poste pour une seconde bombe.
- Les joueurs doivent communiquer pour décrire les modules, donner et suivre les instructions, et coordonner leurs actions.
- Chaque joueur peut se concentrer sur certains modules : fils, boutons, symboles ou séquences.

### Feedback après chaque bombe

- Les joueurs expliquent comment ils ont organisé la communication.
- Quelles stratégies ont été efficaces pour désamorcer les bombes.
- Ce qui aurait pu être amélioré pour mieux collaborer et réduire les erreurs sous pression.

### Ce que l'on observe pendant les jeux

Comment chaque participant s'organise et transmet les informations sous pression, s'adapte aux autres, organise son équipe, relance ses coéquipiers.

### Consigne pour les participants

Jeu en équipe : Keep Talking and Nobody Explodes selon les consignes décrites.

### À observer

- Communication sous pression
- Clarté des instructions données
- Gestion du stress et des erreurs
- Adaptation aux imprévus
- Leadership dans la coordination

## Unchained Together — Coopération enchaînée

- **Durée** : 40 min
- **Type** : Activité

Unchained Together : les joueurs sont attachés par des chaînes et doivent s'adapter aux mouvements des autres.

### LES COMMANDES

- Flèches directionnelles / ZQSD - Déplacer le personnage
- Shift (maintenu) - Courir / accélérer le déplacement
- Espace / Barre d'espace - Sauter
- E - Tirer la chaine pour rapprocher le coéquipier
- Souris - Déplacer la caméra ou changer l'angle de vue

### Conseil facilitateur

- Former deux groupes de 3 ou 4 équilibrés : mélanger les niveaux de connaissances et les styles de raisonnement.
- Encourager la communication : ne pas mettre tous les joueurs timides ensemble.
- Vérifier le matériel : ordinateur et connexion internet stable pour tous les participants.

### Organisation

L'objectif : progresser ensemble vers le sommet en coordonnant les mouvements tout en gérant le stress et les obstacles.

Matériel : ordinateur, connexion stable, accès au jeu.

### Déroulement

- Découverte : au début, les joueurs explorent le jeu librement, apprennent les touches et se familiarisent avec les déplacements et les interactions.
- Progression en équipe : ensuite, les joueurs avancent en coopération, chacun choisissant comment contribuer pour que le groupe atteigne les objectifs.
- Gestion du timing : le formateur peut à tout moment désigner un joueur responsable des timings, c'est-à-dire celui qui indique quand le groupe doit sauter ou effectuer une action coordonnée.
- Les joueurs doivent communiquer constamment pour coordonner leurs déplacements et actions, s'adapter aux imprévus et éviter que les chaînes ne bloquent le groupe.
- L'accent est mis sur l'adaptabilité, la coopération et la gestion du stress : si un obstacle échoue, le groupe doit rester calme et trouver rapidement une nouvelle stratégie.

### Feedback après le tournoi

- Les joueurs expliquent comment ils ont organisé leurs mouvements et leur communication.
- Quels rôles ou stratégies ont été efficaces pour progresser.
- Ce qui a été difficile et comment ils ont géré le stress ou les situations imprévues.

### Ce que l'on observe pendant les jeux

Comment chaque participant s'adapte aux déplacements des autres, se canalise pour suivre le groupe, accepte les erreurs et soutient ses coéquipiers.

### Consigne pour les participants

Jeu en équipe : Unchained Together selon les consignes décrites.

### À observer

- Coordination et synchronisation
- Réaction face aux blocages
- Capacité à rester calme
- Gestion des responsabilités collectives

## Quiz de consolidation — Kahoot

- **Durée** : 15 min
- **Type** : Apport théorique

### Objectifs pédagogiques

- Vérifier la compréhension des notions vues pendant la session
- Consolider les apprentissages (gestion du stress, adaptabilité, priorisation)
- Amener les participants à faire des liens entre théorie et pratique (jeux + débat)
- Identifier les points à renforcer avant la suite du programme

Format : Quiz interactif (oral ou écrit) — Questions variées : QCM / Vrai-Faux / situations

### Réponses & Explications

1. QCM → B. S'ajuster face aux changements ou imprévus — Être adaptable, c'est réagir intelligemment aux changements, pas les subir.
2. QCM → C. Distinguer urgent et important — Tout n'est pas urgent ! Savoir trier évite de se disperser.
3. QCM → B. Non, il peut l'exprimer sans paniquer — Être pro, c'est reconnaître ses émotions sans les subir.
4. QCM → A. Tu ralentis tout le monde — Partager l'info est essentiel pour coordonner efficacement.
5. QCM → D. Adrénaline — Bien géré, le stress donne de l'énergie et booste la performance.
6. QCM → B. S'adapter aux autres — La réussite dépend de la coordination et de l'adaptation collective.
7. V/F → Faux — Trop s'adapter peut faire perdre le cap et ralentir les décisions.
8. QCM → D. Respirer et se recentrer — La respiration permet de calmer le corps et l'esprit immédiatement.
9. QCM → A. Observer et écouter — L'attention et l'écoute permettent de comprendre et analyser les autres.
10. QCM → B. Non, parfois il faut réfléchir rapidement avant — Prendre quelques secondes pour réfléchir peut éviter de grosses erreurs.
11. BONUS → Faux — Bien géré, il peut devenir un vrai moteur.

### Conseil facilitateur

Inviter les participants à sortir leur téléphone et scanner le QR code ou se rendre sur kahoot.it / sur l'application Kahoot.

Afficher le code de la partie et vérifier que chacun est bien connecté avant de démarrer.

Encourager l'utilisation de pseudos clairs (prénom ou nom d'équipe) pour faciliter le suivi du classement.

Rappeler les règles : lire les questions jusqu'au bout, prendre le temps de réfléchir, attention aux questions pièges.

### Consigne pour les participants

Les participants répondent au quiz Kahoot individuellement puis correction collective.

### À observer

- Notions bien assimilées
- Compréhension du stress comme moteur
- Liens entre adaptabilité et performance

## Conclusion & Mise en commun

- **Durée** : 15 min
- **Type** : Débriefing

### Notions à aborder

- Le stress est inévitable, mais sa gestion peut être travaillée.
- Importance de prioriser : distinguer l'urgent de l'important.
- L'adaptabilité, ce n'est pas tout accepter, mais savoir changer de plan sans perdre son objectif.
- Auto-régulation correspond à prendre conscience de ses réactions et savoir les ajuster pour rester efficace.

### Consigne pour les participants

Tour de table : chaque participant partage ce qu'il retient et une stratégie qu'il compte appliquer.

### À observer

- Prise de conscience sur ses réactions sous stress
- Formulation d'intentions concrètes
- Liens avec la vie professionnelle
$support$, 'session-2.md', 'Reprise du support de l’outil précédent (version provisoire).', true, now())
  returning id into v_version;
  update public.pedagogical_contents set current_version_id = v_version where id = v_content;
end
$block$;

do $block$
declare
  v_program_session uuid;
  v_content uuid;
  v_version uuid;
begin
  select ps.id into v_program_session
  from public.program_sessions ps join public.programs p on p.id = ps.program_id
  where p.is_public and ps.number = 3;
  insert into public.pedagogical_contents (program_session_id) values (v_program_session) returning id into v_content;
  insert into public.pedagogical_content_versions (content_id, version_number, markdown, source_filename, change_note, is_provisional, published_at)
  values (v_content, 1, $support$# Session 3 — Leadership

> **Support provisoire.** Contenu repris de l’outil précédent, en attente du support officiel.

- **Durée** : 2 h 40
- **Participants** : 8

## Objectifs

Explorer les styles de leadership, la prise de décision et l'organisation collective via Overcooked 2 et Supermarket Together.

## Compétences observées

- **Compétences transversales** : Leadership, Force de proposition, Organisation
- **Habiletés socio-cognitives** : Sensibilité sociale, Adaptation relationnelle, Coopération, Raisonnement logique, Arbitrage, Conceptualisation, Projection

## Accueil & Cadrage — Le Leadership

- **Durée** : 10 min
- **Type** : Introduction

### Objectifs de la session

Poser le cadre de la session : le leadership comme compétence collective et individuelle. Montrer que le leadership n'est pas seulement diriger, mais aussi inspirer, organiser, arbitrer et fédérer.

### Contenu

- Définition du leadership : leadership de rôle, de compétence, de situation
- Valoriser la diversité des styles de leadership : autoritaire, collaboratif, facilitateur
- Rappel du fonctionnement : alternance jeux / débrief / mise en commun
- Lien avec le jeu Overcooked : chaque cuisine nécessite un leader qui coordonne et répartit les rôles

### Conseil au formateur

Invitez les participants à réfléchir à un leader qu'ils admirent (sportif, professionnel, personnel). Demandez-leur de partager un mot qui décrit ce leader pour lancer la dynamique.

### À observer

- Leaders identifiés par les participants
- Représentations initiales du leadership
- Distinction leadership / management connue ou non

## Introduction au Leadership en entreprise

- **Durée** : 10 min
- **Type** : Apport théorique

### Notions clés à transmettre

Le leadership n'est pas seulement « commander », mais inspirer, organiser et fédérer. Il peut être de rôle (désigné), de compétence (celui qui maîtrise une tâche), ou de situation (celui qui prend l'initiative au bon moment).

### Leader vs Manager

- Le Manager représente la structure, les règles et le suivi.
- Le Leader représente la vision, la motivation et l'exemplarité.

→ En entreprise, les deux se complètent.

### Différents styles de Leadership

- Directif : décide vite, cadre strict
- Collaboratif : prend en compte les idées du groupe
- Facilitateur : donne confiance, répartit les rôles

### Les 3 concepts fondamentaux du leadership

- Leadership de rôle : Celui qui est désigné ou nommé pour diriger. Il tire sa légitimité de sa position hiérarchique ou de son titre.
- Leadership de compétence : Celui qui maîtrise un domaine et que le groupe suit naturellement pour son expertise. Sa légitimité vient de son savoir-faire.
- Leadership de situation : Celui qui prend l'initiative au bon moment, sans avoir été désigné. Il s'adapte au contexte et aux besoins du groupe.

### Consigne pour les participants

Les participants identifient quel type de leadership ils ont tendance à exercer naturellement.

### À observer

- Connaissance préalable des concepts
- Identification à un style de leadership
- Distinction leader / manager assimilée

## Icebreaker — Jeu de l'Imposteur

- **Durée** : 15 min
- **Type** : Activité

### Objectif pédagogique

Mobiliser l'écoute, l'attention, la reformulation et la compréhension dans un contexte ludique et détendu.

### Déroulé du jeu

- Un paquet de 8 cartes est distribué secrètement
- 6 cartes portent le même mot (lié à la thématique du leadership)
- 1 carte porte un mot opposé : c'est l'Imposteur
- 1 carte est vide : c'est l'Espion
- Tour de parole (sens horaire) : chaque joueur dit UN mot en lien avec sa carte, sans jamais dire le mot exact de la carte.
- Premier vote : à la fin du tour, tous votent pour éliminer le joueur le plus suspect.
- Deuxième tour si nécessaire : si l'imposteur ou l'espion ne sont pas éliminés, un nouveau tour commence avec de nouveaux mots.

### Règles

- Interdiction de dire le mot exact de sa carte
- Interdiction de répéter un mot déjà utilisé lors d'un tour précédent
- Les mots doivent rester cohérents avec la thématique de la manche
- Victoire des civils → si l'imposteur ou l'espion sont éliminés
- Victoire de l'imposteur/espion → si ils survivent à tous les votes

### Configuration des manches

Manche 1 — Civils : Déléguer (2|3|4|6|7|8) / Imposteur : Imposer (5) / Espion : Aucun mot (1)

Manche 2 — Civils : Entraîneur / Coach (1|4|5|6|7|8) / Imposteur : Capitaine (2) / Espion : Aucun mot (3)

### Consigne pour les participants

Les participants jouent les manches de l'Imposteur selon les règles décrites.

### À observer

- Prise d'initiative dans le jeu
- Comportements de leadership naturels
- Gestion du doute et du vote

## Débat thématique — Questions OUI / NON

- **Durée** : 20 min
- **Type** : Débat

### Objectifs pédagogiques

- Développer la capacité à arbitrer sous contrainte
- Identifier ses réactions face au leadership et celles des autres
- Réfléchir sur l'équilibre entre leadership individuel et collectif
- Encourager chaque participant à se positionner clairement, puis à nuancer sa réponse

### Méthode : Questions fermées OUI / NON → puis ouverture

Pour chaque thème, le facilitateur pose une question fermée. Chaque participant répond d'abord uniquement par OUI ou par NON. Ensuite seulement, le débat s'ouvre.

### Règles du débat

- Répondre d'abord par OUI ou NON uniquement - pas d'explication dans un premier temps
- Chacun peut s'exprimer sans être interrompu lors de la phase d'explication
- Autorisé de dire « je change d'avis » si on est convaincu par un argument
- Autorisé de dire « je ne sais pas » ou « je passe » si on ne trouve pas de mots
- Parler à partir de son expérience et de son ressenti, pas de jugements sur les autres

### THÈME 1 : Un leader doit-il tout contrôler ?

Scénario : Tu es en équipe sur un projet. Une personne prend toutes les décisions sans consulter le groupe, mais le travail avance vite.

Questions OUI / NON :

1. Un leader doit-il prendre toutes les décisions seul pour être efficace ?
2. Donner trop de liberté à une équipe nuit-il à la performance ?
3. Un bon leader doit-il vérifier tout le travail des autres ?
4. Est-ce qu'un leader perd en crédibilité s'il délègue trop ?
5. Peut-on être efficace sans contrôler chaque étape ?

Pistes de solution : Trouver un équilibre entre contrôle et autonomie / Clarifier les rôles et responsabilités dès le départ / Faire confiance progressivement à son équipe / Mettre en place des points de suivi réguliers / Favoriser la responsabilisation des membres

### THÈME 2 : Faut-il être dur pour être respecté en tant que leader ?

Scénario : Dans ton équipe, une personne adopte un style très strict et impose ses décisions. Les résultats sont là, mais l'ambiance est tendue.

Questions OUI / NON :

1. Un leader doit-il être strict pour être respecté ?
2. La peur est-elle un bon levier pour motiver une équipe ?
3. Peut-on être un leader respecté sans être autoritaire ?
4. Être trop gentil empêche-t-il de bien diriger ?
5. Le respect se gagne-t-il plus par l'autorité que par l'écoute ?

Pistes de solution : Instaurer un cadre clair sans être autoritaire / Privilégier le respect mutuel plutôt que la peur / Développer une communication assertive / Être ferme sur les objectifs, souple sur la manière / Valoriser les efforts et les réussites de l'équipe

### THÈME 3 : Un leader doit-il toujours montrer l'exemple ?

Scénario : Lors d'une activité, le leader donne des consignes mais ne les applique pas lui-même. L'équipe commence à douter de sa légitimité.

Questions OUI / NON :

1. Un leader doit-il toujours appliquer ce qu'il demande ?
2. Peut-on suivre quelqu'un qui ne montre pas l'exemple ?
3. Un leader a-t-il le droit de faire des exceptions pour lui-même ?
4. L'exemplarité est-elle plus importante que les compétences ?
5. Un leader doit-il être irréprochable en permanence ?

Pistes de solution : Adopter une posture exemplaire au quotidien / Reconnaître ses erreurs pour renforcer la confiance / Aligner ses actions avec ses paroles / Clarifier les attentes communes / Construire sa légitimité par le comportement

### Conseil au formateur

Encourager les plus discrets à se positionner par OUI/NON même sans argumenter dans un premier temps.

Valoriser les reformulations, les compromis et les évolutions d'opinion.

Relancer avec : « Peux-tu expliquer pourquoi ? », « Comment tu l'aurais fait toi ? »

Relier le débat au jeu qui suit : coopération, écoute, leadership.

### À observer

- Rapport au leadership exprimé
- Capacité à arbitrer
- Évolution d'opinion pendant le débat

## Pause

- **Durée** : 10 min
- **Type** : Pause

Temps de récupération libre.

### Consigne pour les participants

Pause libre.

## Overcooked 2 — Cuisine coopérative

- **Durée** : 40 min
- **Type** : Activité

Overcooked 2 est un jeu vidéo coopératif de cuisine où les joueurs doivent préparer et servir des plats en équipe dans des cuisines de plus en plus chaotiques. Chaque cuisine nécessite un leader qui coordonne et répartit les rôles.

### LES COMMANDES

- Stick gauche : Déplacer le personnage
- Stick droit : Déplacer la caméra (si disponible, selon version)
- A : Prendre / déposer un objet ou interagir avec une station (planche, four, lave-vaisselle…)
- B : Lancer un objet ou poser rapidement un ingrédient
- X / Y : Certaines actions contextuelles selon le niveau (ex. récupérer un plat, activer un mécanisme)
- + (Start) : Mettre le jeu en pause / ouvrir le menu

### Conseil facilitateur

- Former des groupes équilibrés : mélanger niveaux et personnalités pour favoriser le leadership naturel.
- Encourager le leadership : un joueur organise les tâches et guide l'équipe.
- Communication claire : partager les priorités et informations sur les commandes.
- Répartition des rôles : chacun se concentre sur une tâche spécifique pour éviter les collisions.
- Adaptabilité : ajuster les stratégies selon les obstacles et la progression.
- Apprentissage clé : un bon leadership et une communication efficace permettent de mieux coopérer et réussir.

### Activité pour 3-4 joueurs — Organisation

L'objectif : préparer et servir les commandes le plus efficacement possible, en développant leadership, communication et coordination.

Matériel : Nintendo Switch avec Overcooked, manettes pour tous les joueurs.

### Découverte et initiation (tutoriel + niveaux 1-1)

Les joueurs disposent de ces niveaux pour apprendre les touches, se familiariser avec le déplacement, la prise et le dépôt des ingrédients. Premiers échanges et essais de coordination.

### Établissement d'un leader et d'une stratégie (niveaux 1-2 à 1-5)

L'équipe doit choisir un leader qui coordonne les actions et attribue les rôles avant de lancer les niveaux (Le leader change à chaque niveau). Les autres joueurs suivent la stratégie décidée par le leader. Après chaque niveau, un tour de table est effectué pour donner un retour sur la prestation du leader. Le leader effectue également une auto-évaluation de sa propre performance et de sa capacité à organiser l'équipe.

### Communication restreinte et leadership unique (niveaux 1-6, 2-1, 2-2, 2-3, 2-4)

Seul le leader est autorisé à parler pour donner les consignes et établir la stratégie. Les autres joueurs ne communiquent pas verbalement et doivent suivre les instructions du leader. Après chaque niveau, feedback sur la prestation du leader et auto-évaluation de celui-ci pour réfléchir à son efficacité et à sa clarté.

### Consigne pour les participants

Jeu en équipe : Overcooked 2 selon les consignes et phases décrites.

### À observer

- Style de leadership adopté
- Clarté des consignes données
- Réaction à l'erreur des autres
- Organisation et priorisation des tâches
- Adaptation aux niveaux plus chaotiques

## Supermarket Together — Gestion de magasin

- **Durée** : 20 min
- **Type** : Activité

Supermarket Together est un jeu vidéo coopératif dans lequel les joueurs doivent gérer ensemble un supermarché et accomplir différentes tâches avant la fin du temps imparti.

### LES COMMANDES

- Flèches directionnelles / ZQSD : Déplacer le personnage dans le magasin
- Shift (maintenu) : Courir ou se déplacer plus vite
- E / clic gauche : Prendre ou déposer un objet (produit, panier, caisse)
- F / clic droit : Interagir avec un client ou un équipement (scanner, rayons, caisse)
- R : Jeter ou poser un objet (selon situation)
- Tab : Afficher l'inventaire ou la liste des tâches (si disponible)
- Esc / Start : Mettre le jeu en pause ou ouvrir le menu

### Conseil facilitateur

- Former des groupes équilibrés pour favoriser le leadership naturel.
- Désigner un leader pour coordonner les actions, répartir les tâches et fixer les priorités.
- Communication guidée : suivre les instructions du leader pour éviter les collisions et optimiser le temps.
- Répartition claire des rôles : chacun se concentre sur une tâche précise (caisse, rayons, nettoyage, service).
- Feedback : évaluer le leader et ajuster la stratégie pour améliorer la coordination.

Activité pour 3-4 joueurs

### Découverte et préparation (avant le Jour 1)

Les joueurs disposent de 5 minutes avant de lancer le Jour 1 pour découvrir les touches et comprendre les actions de base. Pendant ce temps, l'équipe discute pour établir les rôles dans le magasin. Un manager est choisi pour coordonner l'équipe et répartir les tâches. Les rôles peuvent être adaptés selon qu'ils sont 3 ou 4 joueurs (caisse, réassort des rayons, gestion du stock, aide polyvalente).

### Gestion du magasin (Jour 1)

L'équipe lance le Jour 1 et applique l'organisation décidée. Le manager coordonne le travail et peut ajuster les rôles si nécessaire. À la fin du Jour 1, une rotation des rôles est effectuée afin qu'un autre joueur puisse prendre le rôle de manager. Un court feedback est réalisé. Ils disposent de 2 minutes pour réarranger le magasin et vérifier les stocks.

### Suite de la session (Jour 2)

L'équipe continue jusqu'à la fin du Jour 2 avec la nouvelle organisation. Le nouveau manager doit diriger l'équipe, répartir les tâches et s'adapter aux situations du jeu. À la fin du Jour 2, un nouveau moment de feedback permet de comparer les styles de leadership et les stratégies utilisées.

### Ce que l'on observe pendant les jeux

Comment chaque participant communique sous pression, s'adapte aux autres, prend des initiatives, accepte les erreurs et soutient ses coéquipiers.

### Consigne pour les participants

Jeu en équipe : Supermarket Together selon les consignes décrites.

### À observer

- Capacité à coordonner et déléguer
- Comparaison des styles de leadership
- Gestion des conflits de priorités
- Adaptabilité aux changements de rôle

## Quiz de consolidation — Kahoot

- **Durée** : 15 min
- **Type** : Apport théorique

### Objectifs pédagogiques

- Vérifier la compréhension des notions vues pendant la session
- Consolider les apprentissages (leadership, coopération, arbitrage)
- Amener les participants à faire des liens entre théorie et pratique (jeux + débat)
- Identifier les points à renforcer avant la suite du programme

Format : Quiz interactif (oral ou écrit) — Questions variées : QCM / Vrai-Faux / situations

### Réponses & Explications

1. QCM → C. Inspirer, organiser et fédérer — Le leadership ne se limite pas à diriger : il s'agit aussi de motiver, structurer et rassembler une équipe.
2. V/F → Faux — Un leader peut émerger naturellement (leadership de situation ou de compétence).
3. QCM → A. Tu proposes une organisation simple — Le leadership de situation consiste à prendre l'initiative au bon moment pour aider le groupe.
4. QCM → C. Leadership de compétence — La légitimité vient ici du savoir-faire et non du statut.
5. V/F → Faux — Un bon leader trouve un équilibre entre contrôle et autonomie pour responsabiliser son équipe.
6. QCM → D. Clarifier les rôles et donner des consignes précises — Un leader directif peut être efficace en urgence, mais un style uniquement directif étouffe la créativité et l'implication du groupe.
7. QCM → A. Collaboratif — Le leadership collaboratif prend en compte les idées de chacun pour mieux décider.
8. V/F → Vrai — Reconnaître ses erreurs renforce la confiance et l'exemplarité.
9. QCM → D. Désigner un leader pour coordonner — Un leader permet de structurer la communication et améliorer l'efficacité collective.
10. QCM → B. L'écoute et l'adaptation — Un leader doit comprendre son équipe et s'adapter aux situations.
11. BONUS → C. Adapter ta communication et écouter les retours — Un bon leader ajuste sa manière de communiquer et prend en compte son équipe pour être plus efficace.

### Conseil facilitateur

Inviter les participants à sortir leur téléphone et scanner le QR code ou se rendre sur kahoot.it / sur l'application Kahoot.

Afficher le code de la partie et vérifier que chacun est bien connecté avant de démarrer.

Encourager l'utilisation de pseudos clairs (prénom ou nom d'équipe) pour faciliter le suivi du classement.

Rappeler les règles : lire les questions jusqu'au bout, prendre le temps de réfléchir, attention aux questions pièges.

Relancer l'engagement : « On va voir qui a été le plus attentif pendant la session », « Le classement peut changer jusqu'à la fin ».

### Consigne pour les participants

Les participants répondent au quiz Kahoot individuellement puis correction collective.

### À observer

- Compréhension des 3 types de leadership
- Assimilation de la notion d'exemplarité
- Liens avec les jeux exprimés

## Conclusion & Discussion de groupe

- **Durée** : 20 min
- **Type** : Débriefing

### Notions à aborder

- Différence entre « donner des ordres » et « inspirer »
- L'importance de l'écoute et de l'adaptation dans le leadership
- Arbitrer = décider avec équité et cohérence
- Se projeter = anticiper les étapes et organiser collectivement
- Mise en lumière des styles de leadership : directif, collaboratif, facilitateur

### Consigne pour les participants

Tour de table : chaque participant identifie son style de leadership naturel et ce qu'il souhaite développer.

### À observer

- Auto-connaissance des styles de leadership
- Capacité à s'auto-évaluer
- Intentions d'amélioration formulées
$support$, 'session-3.md', 'Reprise du support de l’outil précédent (version provisoire).', true, now())
  returning id into v_version;
  update public.pedagogical_contents set current_version_id = v_version where id = v_content;
end
$block$;

do $block$
declare
  v_program_session uuid;
  v_content uuid;
  v_version uuid;
begin
  select ps.id into v_program_session
  from public.program_sessions ps join public.programs p on p.id = ps.program_id
  where p.is_public and ps.number = 4;
  insert into public.pedagogical_contents (program_session_id) values (v_program_session) returning id into v_content;
  insert into public.pedagogical_content_versions (content_id, version_number, markdown, source_filename, change_note, is_provisional, published_at)
  values (v_content, 1, $support$# Session 4 — Analyse des problèmes

> **Support provisoire.** Contenu repris de l’outil précédent, en attente du support officiel.

- **Durée** : 3 h 00
- **Participants** : 8

## Objectifs

Développer la curiosité, l'analyse logique et la résolution collective via Escape Simulator et Biped.

## Compétences observées

- **Compétences transversales** : Implication, Analyse des problèmes, Curiosité
- **Habiletés socio-cognitives** : Auto-évaluation, Auto-organisation, Auto-mobilisation, Coopération, Raisonnement logique, Arbitrage, Traitement de l'information, Conceptualisation, Projection, Approche globale

## Accueil & Cadrage — Analyse de problèmes

- **Durée** : 10 min
- **Type** : Introduction

### Objectifs de la session

- Poser le cadre : apprendre à décomposer un problème complexe en étapes claires.
- Comprendre l'importance de la logique, de la curiosité et de la coopération dans la résolution de problèmes.

### Contenu

- Rappel de la méthode : alternance jeu → débrief → mise en commun
- Mise en avant : une bonne analyse des problèmes repose autant sur l'esprit collectif que sur l'organisation individuelle
- Définir les attentes : implication active, écoute, partage de pistes même incomplètes
- Lien entreprise : face à un bug, un imprévu client, un blocage technique → observer, structurer, chercher des alternatives

### Conseil au formateur

Encouragez les participants à partager un moment où ils ont résolu un problème de manière inattendue. Valorisez la curiosité et l'esprit d'initiative dès le début.

### À observer

- Expériences de résolution de problèmes partagées
- Niveau de curiosité et d'initiative
- Rapport à l'erreur et à l'essai-erreur

## Introduction à l'Analyse de problèmes en entreprise

- **Durée** : 10 min
- **Type** : Apport théorique

### Notions clés à transmettre

Un problème est une situation où la solution n'est pas immédiate → nécessité d'analyser, tester, ajuster. Importance de la curiosité : poser des questions, explorer plusieurs pistes. Outils pratiques : méthode QQOQCP (Qui ? Quoi ? Où ? Quand ? Comment ? Pourquoi ?)

### Méthode QQOQCP

- Qui est concerné par le problème ?
- Quoi : quel est le problème exactement ?
- Où : dans quel contexte ?
- Quand, Comment, Pourquoi : pour structurer l'analyse complète.

### Schématisation & Priorisation

- Décomposer le problème en sous-parties
- Prioriser les actions par impact et urgence
- Tester une piste rapidement avant de s'engager totalement

### Les 3 piliers de l'analyse de problèmes

- Observer : Prendre le temps de comprendre la situation avant d'agir. Collecter les informations, identifier les indices et les contraintes.
- Structurer : Organiser les informations collectées, décomposer le problème en étapes logiques et prioriser les actions à mener.
- Coopérer & Ajuster : Travailler en équipe pour tester des pistes, accepter de se tromper et ajuster sa stratégie en fonction des résultats.

### Consigne pour les participants

Les participants appliquent la méthode QQOQCP à un problème concret de leur vie quotidienne.

### À observer

- Connaissance préalable de QQOQCP
- Capacité à décomposer un problème
- Approche globale vs approche par détail

## Icebreaker — Jeu de l'Imposteur

- **Durée** : 15 min
- **Type** : Activité

### Objectif pédagogique

Mobiliser l'écoute, l'attention, la reformulation et la compréhension dans un contexte ludique et détendu.

### Déroulé du jeu

- Un paquet de 8 cartes est distribué secrètement
- 6 cartes portent le même mot (lié à l'analyse de problèmes)
- 1 carte porte un mot opposé : c'est l'Imposteur
- 1 carte est vide : c'est l'Espion
- Tour de parole (sens horaire) : chaque joueur dit UN mot en lien avec sa carte, sans jamais dire le mot exact de la carte.
- Premier vote : à la fin du tour, tous votent pour éliminer le joueur le plus suspect.
- Deuxième tour si nécessaire : si l'imposteur ou l'espion ne sont pas éliminés, un nouveau tour commence avec de nouveaux mots.

### Règles

- Interdiction de dire le mot exact de sa carte
- Interdiction de répéter un mot déjà utilisé lors d'un tour précédent
- Les mots doivent rester cohérents avec la thématique de la manche
- Victoire des civils → si l'imposteur ou l'espion sont éliminés
- Victoire de l'imposteur/espion → si ils survivent à tous les votes

### Configuration des manches

Manche 1 — Civils : Puzzle (2|3|5|6|7|8) / Imposteur : Lego (4) / Espion : Aucun mot (1)

Manche 2 — Civils : Collaboration (1|2|3|5|7|8) / Imposteur : Isolement (6) / Espion : Aucun mot (4)

### Consigne pour les participants

Les participants jouent les manches de l'Imposteur selon les règles décrites.

### À observer

- Démarche analytique dans le jeu
- Curiosité et observation
- Stratégies de déduction utilisées

## Débat thématique — Questions OUI / NON

- **Durée** : 20 min
- **Type** : Débat

### Objectifs pédagogiques

- Observer l'implication et la curiosité en situation réelle
- Évaluer la capacité à analyser collectivement, tester, ajuster et coopérer
- Identifier les forces et difficultés individuelles dans la résolution de problèmes
- Encourager chaque participant à se positionner clairement, puis à nuancer sa réponse

### Méthode : Cadre bienveillant & structuré

Pour chaque thème, le facilitateur pose une question fermée. Chaque participant répond d'abord uniquement par OUI ou par NON. Ensuite seulement, le débat s'ouvre.

### Règles du débat

- Répondre d'abord par OUI ou NON uniquement - pas d'explication dans un premier temps
- Chacun peut s'exprimer sans être interrompu lors de la phase d'explication
- Autorisé de dire « je change d'avis » si on est convaincu par un argument
- Autorisé de dire « je ne sais pas » ou « je passe » si on ne trouve pas de mots
- Parler à partir de son expérience et de son ressenti, pas de jugements sur les autres

### THÈME 1 : Faut-il toujours chercher la « bonne » solution ?

Scénario : Tu travailles sur un projet et tu trouves une solution imparfaite mais qui fonctionne. Ton équipe hésite à la valider.

Questions OUI / NON :

1. Une solution imparfaite mais fonctionnelle peut-elle être acceptée ?
2. Faut-il toujours viser la perfection avant de valider une solution ?
3. Peut-on considérer une solution comme suffisante sans être optimale ?
4. Est-il pertinent de fixer un temps limite pour trouver une solution ?
5. Une solution parfaite tardive vaut-il plus le coup ?

Pistes de solution : Identifier si l'objectif principal est atteint / Fixer un temps limite pour la recherche de solution / Accepter l'imperfection si elle répond au besoin / Capitaliser sur les retours pour améliorer ensuite / Distinguer « suffisant » de « bâclé »

### THÈME 2 : L'erreur est-elle une perte de temps ?

Scénario : Tu passes 20 minutes sur une piste qui s'avère être une mauvaise direction. Ton équipe pense que c'est du temps perdu.

Questions OUI / NON :

1. Une erreur peut-elle être utile ?
2. Est-ce que se tromper signifie forcément perdre du temps ?
3. Faut-il éviter les erreurs à tout prix ?
4. Une mauvaise piste peut-elle aider à trouver la bonne solution ?
5. Est-il utile de garder une trace des erreurs ou des fausses pistes ?

Pistes de solution : L'erreur est une source d'information / Garder trace des fausses pistes pour ne pas les refaire / Capitaliser sur les échecs pour progresser / L'erreur fait partie du processus d'analyse / Valoriser celui qui ose tester même si ça échoue

### THÈME 3 : Seul ou en groupe pour résoudre un problème ?

Scénario : En escape game, tu trouves une piste mais l'équipe part sur une autre direction. Tu hésites à suivre le groupe ou insister.

Questions OUI / NON :

1. Faut-il toujours suivre l'avis du groupe ?
2. Une idée minoritaire peut-elle être meilleure que celle du groupe ?
3. Est-il important d'exprimer son idée même si elle va à l'encontre du groupe ?
4. La diversité des points de vue améliore-t-elle la résolution de problème ?
5. Tester rapidement une idée est-il plus efficace que débattre longtemps ?

Pistes de solution : La diversité des approches enrichit la résolution / Exprimer sa proposition clairement avant de suivre / Proposer un test rapide plutôt qu'un long débat / Accepter que le groupe puisse avoir raison aussi / Valoriser chaque contribution, même minoritaire

### Conseil au formateur

Encourager les plus discrets à se positionner par OUI/NON même sans argumenter dans un premier temps.

Valoriser les reformulations, les compromis et les évolutions d'opinion.

Relancer avec : « Peux-tu expliquer pourquoi ? », « Comment tu l'aurais fait toi ? »

Relier le débat au jeu qui suit : coopération, analyse, résolution.

### À observer

- Rapport à l'erreur exprimé
- Capacité à argumenter et nuancer
- Approche collective vs individuelle

## Pause

- **Durée** : 10 min
- **Type** : Pause

Temps de récupération libre.

### Consigne pour les participants

Pause libre.

## Escape Simulator — Résolution d'énigmes

- **Durée** : 60 min
- **Type** : Activité

Escape Simulator est un jeu d'escape game virtuel où les joueurs doivent résoudre des énigmes et trouver des indices pour s'échapper d'une salle.

### LES COMMANDES

- Z / Q / S / D : se déplacer
- Souris : regarder autour de soi
- Clic gauche : interagir / prendre un objet
- Clic droit : examiner un objet
- R : faire tourner l'objet
- F : utiliser un objet
- E : ramasser / poser un objet
- Tab : ouvrir l'inventaire
- Shift : courir
- C : s'accroupir
- Échap (Esc) : menu / pause

### Conseil facilitateur

- Encourager les joueurs à expliquer à voix haute leurs hypothèses et leurs raisonnements pour favoriser la résolution collective des énigmes.
- Rappeler à l'équipe de bien partager les informations découvertes (codes, objets, indices) afin d'éviter que certains éléments importants soient oubliés.
- Inciter un joueur à organiser la recherche et à répartir les zones ou les objets à analyser pour structurer la résolution des problèmes.
- Laisser les joueurs expérimenter et tester des idées : l'erreur fait partie du processus de réflexion et aide souvent à trouver la solution.

Organisation : Groupe de 3 ou 4 joueurs.

L'objectif : résoudre des énigmes en équipe en développant la communication, la logique et la capacité de résolution de problèmes.

### Déroulement

Les joueurs commencent par réaliser le tutoriel du jeu afin de découvrir les touches et comprendre comment interagir avec les objets (observer, ramasser, faire tourner, utiliser). Ce moment permet également aux joueurs de commencer à communiquer entre eux, partager les objets trouvés et comprendre le fonctionnement des énigmes.

### Résolution des salles — dans l'ordre suivant

1. Labyrinthe d'Égypte — Première chambre

- Ramasser les objets dans la pièce : livre bleu, valise, morceau de pyramidion
- Ouvrir la valise pour récupérer : livre rouge, brosse
- Utiliser la brosse pour nettoyer le coffre poussiéreux et révéler des symboles
- Utiliser le livre rouge pour traduire les symboles
- Entrer le code : 3426
- Ouvrir le coffre et récupérer la clé et un morceau de pyramidion
- Récupérer d'autres morceaux : dans le vase cassé, avec l'énigme du sphinx
- Examiner le sphinx et traduire le symbole avec le livre bleu
- Placer le sphinx dans le mécanisme mural puis dans l'eau pour obtenir un morceau de pyramidion
- Assembler les 4 morceaux de pyramidion
- Les placer sur le piédestal pour obtenir la clé soleil et ouvrir la porte

2. Manoir Edgewood — Bilan cérébral (Brain Checkup)

- Sur le canapé : prendre les journaux, déplacer les coussins pour trouver une clé
- Regarder les trois montres près de la fenêtre
- Utiliser les journaux comme indice pour régler l'heure correcte sur les montres
- Un compartiment s'ouvre → récupérer le test de QI
- Prendre tous les livres rouges dans la bibliothèque
- Utiliser la clé pour ouvrir les placards en bas et récupérer les autres livres
- Résoudre le test de QI
- Entrer le code du tiroir : 2323

3. À la dérive dans l'espace — Réveil d'urgence (Emergency Wake-Up)

- Fouiller la cabine et récupérer : carte d'accès, objets du tableau de contrôle
- Examiner les écrans et notes pour trouver les indices sur l'activation du système
- Activer les modules du vaisseau dans le bon ordre : 1. énergie | 2. oxygène | 3. navigation
- Utiliser la carte d'accès sur le panneau de contrôle
- Entrer les bons paramètres sur la console pour relancer le système

### Feedback après la session

Les joueurs expliquent comment ils ont organisé la recherche d'indices et la résolution des énigmes. Discussion sur les stratégies utilisées pour analyser les objets, comprendre les mécanismes et résoudre les problèmes.

### Ce que l'on observe pendant les jeux

Comment chaque participant communique sous pression, s'adapte aux autres, prend des initiatives, accepte les erreurs et soutient ses coéquipiers.

### Consigne pour les participants

Jeu en équipe : Escape Simulator selon les salles et consignes décrites.

### À observer

- Organisation de la recherche d'indices
- Partage d'informations
- Capacité à observer et structurer
- Réaction face aux blocages
- Curiosité et exploration

## Biped — Coopération physique

- **Durée** : 20 min
- **Type** : Activité

Biped est un jeu coopératif où deux joueurs contrôlent chacun un petit robot. Ils doivent résoudre des énigmes ensemble en coordonnant leurs mouvements.

### LES COMMANDES

- Stick gauche – Déplacer le robot
- Stick droit – Tourner la caméra (si disponible)
- B – Sauter
- A – Courir / booster la vitesse (si utilisé dans certaines zones)
- L / R – Incliner ou ajuster l'équilibre du robot (selon niveau)
- X / Y – Interagir avec les objets ou boutons du niveau
- ZR / ZL – Saisir ou lâcher un objet
- + (Start) – Mettre le jeu en pause / menu
- - (Select) – Afficher la carte ou les objectifs (si disponible)

### Conseil facilitateur

- Encourager la communication : rappeler aux joueurs de se parler pour coordonner les mouvements, synchroniser les sauts et planifier les actions.
- Répartition des rôles : dans certains obstacles, un joueur peut guider l'autre ou se concentrer sur l'équilibre tandis que l'autre active les mécanismes.
- Expérimentation et ajustement : encourager les joueurs à tester différentes stratégies, ajuster leurs mouvements et s'adapter aux imprévus dans le niveau.
- Observation et planification : analyser les obstacles avant de bouger pour anticiper les actions nécessaires et résoudre les énigmes.

Activité en binôme → Deux binômes simultanées

Organisation : Objectif : avancer le plus loin possible dans les niveaux du jeu en résolvant des énigmes physiques et logiques grâce à la coopération et à la communication. Les joueurs travaillent en autonomie, chacun contrôle son robot et doit coordonner ses actions avec les autres pour réussir les obstacles.

### Déroulement

Les joueurs commencent par un niveau tutoriel ou une zone d'initiation. L'objectif est de découvrir les commandes : déplacer le robot, sauter, maintenir l'équilibre, manipuler les objets. Les joueurs peuvent s'entraîner librement à coordonner leurs mouvements et tester la physique du jeu.

### Progression dans les niveaux

Les joueurs avancent en autonomie à travers les différents niveaux. Chaque obstacle ou puzzle demande coordination, communication et réflexion collective : synchroniser les sauts, positionner les robots correctement pour activer les mécanismes, manipuler les objets ensemble pour franchir les obstacles. Les joueurs doivent tester différentes stratégies et s'adapter aux situations sans intervention du formateur.

### Feedback après le tournoi

- Les joueurs expliquent comment ils ont organisé la communication.
- Quelles stratégies ont été efficaces.
- Ce qui aurait pu être amélioré pour mieux collaborer.

### Consigne pour les participants

Jeu en binôme : Biped selon les consignes décrites.

### À observer

- Coordination et synchronisation
- Communication pendant l'action
- Planification avant d'agir
- Résolution collective des obstacles

## Quiz de consolidation — Kahoot

- **Durée** : 15 min
- **Type** : Apport théorique

### Objectifs pédagogiques

- Vérifier la compréhension des notions vues pendant la session
- Consolider les apprentissages (analyse, coopération, curiosité)
- Amener les participants à faire des liens entre théorie et pratique (jeux + débat)
- Identifier les points à renforcer avant la suite du programme

Format : Quiz interactif (oral ou écrit) — Questions variées : QCM / Vrai-Faux / situations

### Réponses & Explications

1. QCM → A. Observer et comprendre la situation — Avant d'agir, il faut analyser la situation pour éviter les erreurs inutiles.
2. V/F → Faux — Un problème nécessite justement une phase d'analyse, de test et d'ajustement.
3. QCM → B. Tu le partages avec l'équipe et proposes une hypothèse — Partager l'information permet une réflexion collective plus efficace.
4. QCM → A. Une méthode pour structurer un problème — QQOQCP aide à analyser un problème en posant les bonnes questions (Qui, Quoi, Où, etc.).
5. V/F → Faux — Les erreurs permettent d'apprendre et d'éviter de reproduire les mêmes pistes inefficaces.
6. QCM → C. Tu analyses ce qui n'a pas marché et ajustes — L'analyse des erreurs permet d'améliorer la stratégie.
7. QCM → D. Pour organiser les informations et prioriser — Structurer permet de rendre un problème complexe plus simple et compréhensible.
8. V/F → Vrai — La diversité des points de vue enrichit la réflexion et peut amener de meilleures solutions.
9. QCM → C. Tester rapidement une solution — Tester permet de valider ou invalider une piste plus rapidement que débattre sans fin.
10. QCM → D. Observer — Les 3 piliers sont : observer, structurer, coopérer & ajuster.
11. BONUS → A. Tu l'utilises et tu l'améliores ensuite — Une solution efficace, même imparfaite, permet d'avancer et d'améliorer progressivement.

### Conseil facilitateur

Corriger chaque réponse en groupe pour créer de l'échange. Demander régulièrement : "Pourquoi ?"

Faire le lien avec les jeux : analyse dans Biped/Escape Simulator. Valoriser les erreurs comme des apprentissages.

Inviter les participants à sortir leur téléphone et scanner le QR code ou se rendre sur kahoot.it.

### Consigne pour les participants

Les participants répondent au quiz Kahoot individuellement puis correction collective.

### À observer

- Compréhension des 3 piliers
- Assimilation de QQOQCP
- Rapport à l'erreur comme outil d'apprentissage

## Conclusion & Discussion de groupe

- **Durée** : 20 min
- **Type** : Débriefing

### Notions à aborder

- Un problème est une opportunité de créativité et de coopération
- Tester des pistes même incomplètes est une force, pas une faiblesse
- La curiosité et l'implication sont les moteurs de l'innovation
- Adopter une approche globale avant de se concentrer sur les détails
- Tour de table : moment où tu as trouvé une solution ou débloqué le groupe

### Consigne pour les participants

Tour de table : chaque participant partage un moment où il a contribué à débloquer le groupe.

### À observer

- Prise de conscience du processus d'analyse
- Valorisation de l'erreur comme apprentissage
- Identification des forces individuelles
$support$, 'session-4.md', 'Reprise du support de l’outil précédent (version provisoire).', true, now())
  returning id into v_version;
  update public.pedagogical_contents set current_version_id = v_version where id = v_content;
end
$block$;

do $block$
declare
  v_program_session uuid;
  v_content uuid;
  v_version uuid;
begin
  select ps.id into v_program_session
  from public.program_sessions ps join public.programs p on p.id = ps.program_id
  where p.is_public and ps.number = 5;
  insert into public.pedagogical_contents (program_session_id) values (v_program_session) returning id into v_content;
  insert into public.pedagogical_content_versions (content_id, version_number, markdown, source_filename, change_note, is_provisional, published_at)
  values (v_content, 1, $support$# Session 5 — Autonomie et compétitivité

> **Support provisoire.** Contenu repris de l’outil précédent, en attente du support officiel.

- **Durée** : 2 h 40
- **Participants** : 8

## Objectifs

Développer l'autonomie, le respect des délais et la compétitivité saine via Supermarket Together (solo) et Mario Kart.

## Compétences observées

- **Compétences transversales** : Autonomie, Respect des délais, Polyvalence
- **Habiletés socio-cognitives** : Auto-évaluation, Auto-régulation, Auto-organisation, Auto-mobilisation, Planification, Traitement de l'information, Synthèse, Approche globale

## Accueil & Cadrage — Autonomie & Compétitivité

- **Durée** : 10 min
- **Type** : Introduction

### Objectifs de la session

- Poser le cadre : l'autonomie comme capacité à prendre des initiatives tout en respectant les règles et les délais.
- Comprendre la compétitivité saine comme un moteur de performance individuelle et collective.

### Contenu

- Rappel de la méthode : alternance jeu → débrief → mise en commun
- Autonomie = initiatives + respect des règles et délais
- Compétitivité saine → stimule la performance sans nuire à l'équipe
- Outils : sous-objectifs, priorisation, auto-évaluation

### Conseil au formateur

Demandez aux participants de partager un moment où ils ont pris une initiative seul(e) et ce que ça leur a apporté. Valorisez l'autonomie dès le début.

### À observer

- Rapport à l'autonomie exprimé
- Expériences d'initiative partagées
- Relation à la compétition observée

## Introduction à l'Autonomie & Compétitivité

- **Durée** : 10 min
- **Type** : Apport théorique

### Notions clés à transmettre

- Autonomie = prendre des initiatives tout en respectant les règles et les délais.
- Compétitivité saine → stimule la performance.
- Risque : compétition mal gérée nuit à l'équipe.
- Outils : sous-objectifs, priorisation, auto-évaluation.

### Autonomie & Cadre

Être autonome ne signifie pas agir seul sans rendre de comptes.

→ C'est savoir prioriser, s'organiser et respecter les délais.

Exemple : gérer ses tâches sans attendre qu'on vous dise quoi faire.

### Compétitivité saine

Se dépasser soi-même, pas écraser les autres.

→ La compétition est un moteur quand elle motive sans déstabiliser.

### Les 3 piliers de l'autonomie & compétitivité

- Auto-Organisation : Capacité à structurer son travail, gérer ses priorités et respecter les délais sans supervision constante.
- Polyvalence : Capacité à s'adapter à différents rôles et tâches selon les besoins de l'équipe et du contexte.
- Compétitivité saine : Se fixer des objectifs ambitieux et se dépasser tout en respectant les autres et en contribuant à la réussite collective.

### Consigne pour les participants

Les participants identifient une tâche qu'ils gèrent en totale autonomie et comment ils s'organisent.

### À observer

- Connaissance de ses propres outils d'organisation
- Rapport à la compétition saine/malsaine
- Capacité à s'auto-évaluer

## Icebreaker — Jeu de l'Imposteur

- **Durée** : 15 min
- **Type** : Activité

### Objectif pédagogique

Mobiliser l'écoute, l'attention, la reformulation et la compréhension dans un contexte ludique et détendu.

### Déroulé du jeu

- Un paquet de 8 cartes est distribué secrètement
- 6 cartes portent le même mot (lié à l'autonomie et la compétitivité)
- 1 carte porte un mot opposé : c'est l'Imposteur
- 1 carte est vide : c'est l'Espion
- Tour de parole (sens horaire) : chaque joueur dit UN mot en lien avec sa carte, sans jamais dire le mot exact de la carte.
- Premier vote : à la fin du tour, tous votent pour éliminer le joueur le plus suspect.
- Deuxième tour si nécessaire : si l'imposteur ou l'espion ne sont pas éliminés, un nouveau tour commence avec de nouveaux mots.

### Règles

- Interdiction de dire le mot exact de sa carte
- Interdiction de répéter un mot déjà utilisé lors d'un tour précédent
- Les mots doivent rester cohérents avec la thématique de la manche
- Victoire des civils → si l'imposteur ou l'espion sont éliminés
- Victoire de l'imposteur/espion → si ils survivent à tous les votes

### Configuration des manches

Manche 1 — Civils : Responsabilité (1|3|4|6|7|8) / Imposteur : Dépendance (2) / Espion : Aucun mot (5)

Manche 2 — Civils : Course (1|2|4|5|6|8) / Imposteur : Marathon (3) / Espion : Aucun mot (7)

### Consigne pour les participants

Les participants jouent les manches de l'Imposteur selon les règles décrites.

### À observer

- Prise d'initiative individuelle
- Gestion de la compétition dans le jeu
- Autonomie dans les décisions de vote

## Débat thématique — Questions OUI / NON

- **Durée** : 20 min
- **Type** : Débat

### Objectifs pédagogiques

- Observer l'autonomie et la capacité à s'auto-organiser
- Évaluer la gestion du temps, la priorisation et le respect des délais
- Identifier comment chacun réagit à la compétition
- Encourager chaque participant à se positionner clairement, puis à nuancer sa réponse

### Méthode : Cadre bienveillant & structuré

Pour chaque thème, le facilitateur pose une question fermée. Chaque participant répond d'abord uniquement par OUI ou par NON. Ensuite seulement, le débat s'ouvre.

### Règles du débat

- Répondre d'abord par OUI ou NON uniquement - pas d'explication dans un premier temps
- Chacun peut s'exprimer sans être interrompu lors de la phase d'explication
- Autorisé de dire « je change d'avis » si on est convaincu par un argument
- Autorisé de dire « je ne sais pas » ou « je passe » si on ne trouve pas de mots
- Parler à partir de son expérience et de son ressenti, pas de jugements sur les autres

### THÈME 1 : Peut-on être trop autonome ?

Scénario : Un collaborateur prend des initiatives sans consulter son équipe. Il avance vite mais crée des problèmes de coordination.

Questions OUI / NON :

1. L'autonomie a-t-elle des limites ?
2. Faut-il toujours valider ses décisions avec les autres ?
3. Peut-on être autonome tout en respectant un cadre collectif ?
4. Agir seul peut-il nuire à la performance de l'équipe ?
5. L'autonomie signifie-t-elle être totalement indépendant ?

Pistes de solution : Définir un cadre clair avec des points de validation / L'autonomie n'est pas l'indépendance totale / Consulter avant les décisions qui impactent les autres / Être autonome, c'est aussi savoir demander de l'aide / Trouver l'équilibre entre initiative et coordination

### THÈME 2 : Vaut-il mieux finir vite ou finir bien ?

Scénario : Tu dois rendre un rapport rapidement. Tu peux aller vite avec des imperfections ou prendre plus de temps pour un rendu parfait.

Questions OUI / NON :

1. La vitesse est-elle plus importante que la qualité ?
2. Faut-il parfois accepter un résultat imparfait pour respecter un délai ?
3. Un travail parfait mais en retard est-il problématique ?
4. Est-il important de communiquer en cas de risque de retard ?
5. Existe-t-il une qualité minimale acceptable pour valider un travail ?

Pistes de solution : Prioriser selon le contexte et l'urgence / Communiquer en cas de risque de retard / Définir une qualité minimale acceptable / Mieux vaut un livrable imparfait à temps qu'un parfait trop tard / Savoir négocier les délais si nécessaire

### THÈME 3 : La compétitivité aide-t-elle à progresser ?

Scénario : Deux collègues se comparent en permanence. L'un progresse, l'autre se décourage. La compétition crée une tension dans l'équipe.

Questions OUI / NON :

1. La compétition est-elle toujours motivante ?
2. La comparaison avec les autres peut-elle devenir négative ?
3. Peut-on progresser sans se comparer aux autres ?
4. La compétition peut-elle nuire à la cohésion d'équipe ?
5. La compétition peut-elle nuire à la cohésion d'équipe ?

Pistes de solution : Favoriser une compétition saine orientée collectif / Éviter les comparaisons toxiques entre individus / Se concentrer sur sa propre progression / Considérer l'évolution personnelle comme indicateur clé / Valoriser l'effort autant que le résultat

### Conseil au formateur

Encourager les plus discrets à se positionner par OUI/NON même sans argumenter.

Valoriser les reformulations et les évolutions d'opinion.

Relancer avec : « Peux-tu expliquer pourquoi ? », « Comment tu l'aurais fait toi ? »

Relier le débat au jeu qui suit : autonomie, gestion du temps, compétition.

### À observer

- Rapport à l'autonomie et aux délais
- Rapport à la compétition
- Capacité à nuancer sa position

## Pause

- **Durée** : 10 min
- **Type** : Pause

Temps de récupération libre.

### Consigne pour les participants

Pause libre.

## Supermarket Together — Mode autonomie

- **Durée** : 20 min
- **Type** : Activité

Supermarket Together est un jeu vidéo coopératif dans lequel les joueurs doivent gérer ensemble un supermarché et accomplir différentes tâches avant la fin du temps imparti.

### LES COMMANDES

- Flèches directionnelles / ZQSD : Déplacer le personnage dans le magasin
- Shift (maintenu) : Courir ou se déplacer plus vite
- E / clic gauche : Prendre ou déposer un objet (produit, panier, caisse)
- F / clic droit : Interagir avec un client ou un équipement (scanner, rayons, caisse)
- R : Jeter ou poser un objet (selon situation)
- Tab : Afficher l'inventaire ou la liste des tâches (si disponible)
- Esc / Start : Mettre le jeu en pause ou ouvrir le menu

### Conseil facilitateur

- Favoriser l'initiative individuelle : laisser les joueurs décider par eux-mêmes comment organiser leurs actions et gérer leurs tâches dans le magasin.
- Observation et auto-organisation : encourager chaque joueur à observer l'environnement, identifier les priorités et ajuster sa stratégie sans dépendre du formateur.

### Activité pour 3-4 joueurs — Organisation

Groupe de 4 joueurs. Chaque joueur gère son propre supermarché.

L'objectif est d'atteindre le Jour 3 en autonomie, en organisant son magasin et ses tâches sans aide extérieure.

### Temps de préparation (5 minutes)

Avant de lancer la partie, les joueurs disposent de 5 minutes pour réfléchir individuellement à leur organisation. Ils doivent penser à :

- la mise en place de leur magasin,
- la gestion des produits et du stock,
- la manière dont ils vont servir les clients efficacement.

Le formateur n'intervient pas : chacun doit construire sa propre stratégie.

### Gestion du magasin (Jour 1 à Jour 3)

Les joueurs lancent la partie et doivent faire fonctionner leur magasin jusqu'au Jour 3. Pendant la partie, ils doivent :

- prendre leurs propres décisions,
- s'adapter aux situations du jeu,
- ajuster leur organisation si nécessaire.

### Retour et échange

À la fin de la session, chaque joueur explique : la stratégie qu'il a utilisée, comment il a organisé son magasin, ce qui a été facile ou difficile. Les stratégies sont ensuite comparées entre les joueurs afin d'observer les différentes façons de gérer le magasin.

### Ce que l'on observe pendant les jeux

Comment chaque participant s'organise, prend des initiatives, explore les pistes, accepte les erreurs et synthétise sa stratégie lors de la présentation.

### Consigne pour les participants

Chaque joueur gère son propre supermarché en totale autonomie jusqu'au Jour 3.

### À observer

- Capacité d'auto-organisation
- Prise de décision sans supervision
- Adaptation aux imprévus du jeu
- Gestion des priorités
- Stratégie développée et résultats

## Mario Kart — Compétition et pression

- **Durée** : 40 min
- **Type** : Activité

Mario Kart est un jeu vidéo de course dans lequel plusieurs joueurs s'affrontent sur des circuits variés remplis de virages, d'obstacles et d'objets à récupérer.

### LES COMMANDES

- Joystick gauche : diriger le kart
- A : accélérer
- B : freiner / marche arrière
- ZR : utiliser un objet
- ZL : déraper (drift) dans les virages
- L : regarder derrière
- R : sauter / lancer un mini-turbo en dérapage
- X : klaxon
- + : pause / menu

### Conseil facilitateur

- Encourager l'esprit de compétition : rappeler aux joueurs que l'objectif est de donner le meilleur de soi pour obtenir la meilleure position possible.
- Gérer la frustration : certaines situations peuvent être injustes (objets, dépassements de dernière seconde). Encourager les joueurs à rester calmes et concentrés.
- Observer les stratégies : regarder comment les joueurs utilisent les objets, prennent les virages ou tentent de dépasser leurs adversaires.
- Favoriser le dépassement de soi : inciter les joueurs à essayer d'améliorer leurs performances d'une course à l'autre.
- Valoriser le fair-play : rappeler que la compétition doit rester saine et que l'objectif est aussi de prendre du plaisir tout en jouant.

### Activité pour 3-4 joueurs — Organisation

Groupe de 3 à 4 joueurs. Durée de l'activité : 40 minutes.

L'objectif est de participer à plusieurs courses et tenter d'obtenir le meilleur classement possible.

Le jeu met en avant la compétitivité, la concentration et la gestion de la pression.

### Prise en main — Coupe d'entraînement (10 minutes)

Les joueurs commencent par lancer une première coupe afin de découvrir ou se rappeler des commandes du jeu (accélérer, tourner, déraper, utiliser les objets). Cette coupe permet de : se familiariser avec la conduite du kart, tester l'utilisation des objets, comprendre le fonctionnement des circuits et des virages. Cette première coupe sert uniquement d'entraînement.

### Compétition (25 minutes)

Une fois la prise en main terminée, les joueurs lancent deux nouvelles coupes qui marquent le début de la compétition. Chaque joueur doit : tenter d'obtenir le meilleur classement possible, rester concentré pendant les courses, utiliser les objets et les trajectoires de manière stratégique pour dépasser les adversaires. Les résultats des courses permettent de déterminer le classement final de la session.

### Consigne pour les participants

Tournoi Mario Kart : coupe d'entraînement puis 2 coupes de compétition.

### À observer

- Gestion de la frustration
- Évolution de la stratégie d'une course à l'autre
- Fair-play et attitude compétitive
- Concentration et persévérance

## Quiz de consolidation — Kahoot

- **Durée** : 15 min
- **Type** : Apport théorique

### Objectifs pédagogiques

- Vérifier la compréhension des notions vues pendant la session
- Consolider les apprentissages (autonomie, délais, compétitivité)
- Amener les participants à faire des liens entre théorie et pratique (jeux + débat)
- Identifier les points à renforcer avant la suite du programme

Format : Quiz interactif (oral ou écrit) — Questions variées : QCM / Vrai-Faux / situations

### Réponses & Explications

1. QCM → D. Prendre des initiatives tout en respectant les règles — L'autonomie, c'est agir par soi-même tout en respectant le cadre collectif.
2. V/F → Faux — Être autonome, c'est savoir s'organiser, mais aussi demander de l'aide si nécessaire.
3. QCM → A. Organiser tes priorités et planifier — L'auto-organisation est essentielle pour être efficace sans supervision.
4. QCM → B. L'auto-organisation — Savoir organiser son travail permet de respecter les délais et être efficace.
5. V/F → Faux — Respecter les délais est aussi important que la qualité du travail.
6. QCM → B. Prévenir et ajuster ton organisation — Communiquer et s'adapter permet de mieux gérer les imprévus.
7. QCM → A. Se dépasser tout en respectant les autres — La compétition doit motiver sans nuire à l'équipe.
8. V/F → Vrai — Une compétition mal gérée peut créer du stress et des tensions.
9. QCM → A. Analyser tes erreurs et t'améliorer — La progression vient de l'analyse et de l'amélioration continue.
10. QCM → D. L'auto-organisation — S'organiser seul est essentiel pour être autonome et efficace.
11. BONUS → C. Recentrer sur la progression personnelle et le collectif — La compétition doit rester saine et tournée vers l'amélioration, pas la domination.

### Conseil facilitateur

Corriger chaque réponse en groupe pour créer de l'échange. Demander régulièrement : "Pourquoi ?"

Faire le lien avec les jeux : autonomie dans Supermarket, compétition dans Mario Kart. Valoriser les erreurs comme des apprentissages.

Inviter les participants à sortir leur téléphone et scanner le QR code ou se rendre sur kahoot.it / sur l'application Kahoot.

### Consigne pour les participants

Les participants répondent au quiz Kahoot individuellement puis correction collective.

### À observer

- Compréhension des 3 piliers
- Rapport autonomie/délais assimilé
- Compétitivité saine vs malsaine distinguée

## Conclusion & Bilan du programme

- **Durée** : 20 min
- **Type** : Débriefing

### Notions à aborder

- L'autonomie n'exclut pas la coopération
- Respecter les délais = fiabilité et crédibilité
- La polyvalence est un atout majeur en équipe
- Compétitivité saine = se dépasser sans déstabiliser
- Tour de table : moment d'autonomie + moment où la coopération a permis de progresser

### Consigne pour les participants

Tour de table final : chaque participant partage ce qu'il retient de l'ensemble du programme et une compétence qu'il souhaite continuer à développer.

### À observer

- Synthèse personnelle du programme
- Identification des progrès réalisés
- Projection dans l'application professionnelle
$support$, 'session-5.md', 'Reprise du support de l’outil précédent (version provisoire).', true, now())
  returning id into v_version;
  update public.pedagogical_contents set current_version_id = v_version where id = v_content;
end
$block$;

do $block$
declare
  v_program_session uuid;
  v_content uuid;
  v_version uuid;
begin
  select ps.id into v_program_session
  from public.program_sessions ps join public.programs p on p.id = ps.program_id
  where p.is_public and ps.number = 6;
  insert into public.pedagogical_contents (program_session_id) values (v_program_session) returning id into v_content;
  insert into public.pedagogical_content_versions (content_id, version_number, markdown, source_filename, change_note, is_provisional, published_at)
  values (v_content, 1, $support$# Session 6 — Thème à préciser

> **Structure de démonstration.** Ce support est un gabarit provisoire : il illustre les types de blocs reconnus par le lecteur pédagogique. Remplacez-le en important le support officiel de la session 6.

- **Durée** : 3 h 00
- **Participants** : 8

## Objectifs

- Objectif pédagogique à renseigner.
- Objectif pédagogique à renseigner.

## Accueil et cadrage

- **Durée** : 10 min
- **Type** : Introduction
- **Objectif** : à renseigner

### À dire

Texte d’introduction à présenter au groupe — à renseigner.

### Consigne pour les participants

Consigne à transmettre — à renseigner.

### À observer

- Indicateur observable à renseigner.

## Apport théorique

- **Durée** : 15 min
- **Type** : Apport théorique

### Notions clés à transmettre

- Notion à renseigner.
- Notion à renseigner.

### Questions à poser

1. Question de réflexion à renseigner.
2. Question de réflexion à renseigner.

## Activité

- **Durée** : 60 min
- **Type** : Activité
- **Compétences mobilisées** : à renseigner

### Consigne pour les participants

Déroulé de l’activité — à renseigner.

### À observer

- Indicateur observable à renseigner.

### À retenir

Rappel pédagogique destiné au formateur — à renseigner.

## Pause

- **Durée** : 10 min
- **Type** : Pause

## Transition

- **Durée** : 5 min
- **Type** : Transition

### À dire

Phrase de transition vers l’activité suivante — à renseigner.

## Débriefing

- **Durée** : 20 min
- **Type** : Débriefing

### Questions à poser

1. Question de débriefing à renseigner.

### À retenir

Points à retenir pour le groupe — à renseigner.
$support$, 'session-6.md', 'Structure de démonstration provisoire.', true, now())
  returning id into v_version;
  update public.pedagogical_contents set current_version_id = v_version where id = v_content;
end
$block$;
