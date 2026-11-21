# Gamification : défis, parcours, album, jalons

But : donner envie de revenir, à chaque profil, sans toucher à l’évaluation. Tout se calcule à partir de données qui existent déjà ; aucun nouveau suivi de comportement n’est enregistré côté serveur.

## Règles de conception

- **Aucun barème touché.** Une compétence est « révélée » dès sa première observation validée, quel que soit le niveau. Une case vide veut dire « pas encore observée », jamais zéro.
- **Pas de classement entre personnes**, ni entre participants, ni entre formateurs, ni entre structures.
- **Rien ne se perd.** Pas de série à entretenir. Une absence ralentit un défi de présence, elle ne le ferme jamais (« Ligne d’arrivée » se gagne en allant au bout du programme, même avec des absences).
- **Jamais de défi sur ce qui doit rester libre** : consentements, fiche d’entrée, données sensibles.
- **Hors bilan.** Défis, étoiles et jalons n’entrent ni dans le bilan, ni dans le passeport partagé, ni dans les indicateurs d’impact ou les exports financeurs.
- **Mouvement sobre** : une seule animation à l’arrivée (la mascotte avance sur la carte du parcours) et une célébration quand un défi est réussi. Les deux respectent « réduire les animations ».

## Participant

| Élément | Où | Calcul |
| --- | --- | --- |
| Carte du parcours | accueil | sessions du groupe : suivie (présent, retard, départ anticipé), passée (sans reproche), en cours ou prochaine, à venir, annulée |
| Prochaine étape | accueil | premier défi faisable tout de suite, dans l’ordre du parcours (auto-évaluation de départ, auto-évaluation finale, avis, partage, jeu). Une enquête en attente garde sa propre carte. |
| Défis et étoiles | accueil, « Mes réussites » | `src/lib/engagement/challenges.ts` |
| Album des compétences | accueil, « Mes réussites » | une case par compétence ; révélée = au moins une observation validée ; « en progression » = règle du moteur d’évaluation (dernière observation au-dessus de la première) |
| Célébration | accueil, « Mes réussites » | au plus une par visite, le défi le plus difficile d’abord |

### Défis (12, 21 étoiles)

| Famille | Défi | Étoiles | Condition |
| --- | --- | --- | --- |
| Parcours | Point de départ | 2 | auto-évaluation de départ remplie |
| | Premier rendez-vous | 1 | 1 session suivie |
| | À mi-chemin | 2 | moitié des sessions suivies (3 sur 6) |
| | Ligne d’arrivée | 3 | programme mené au bout, sans abandon |
| | Regard final | 2 | auto-évaluation de fin de parcours remplie (ouverte à la dernière session) |
| Compétences | Première révélée | 1 | 1 compétence observée |
| | Collection en marche | 2 | 10 compétences observées |
| | Belle collection | 3 | 20 compétences observées |
| | Ça progresse | 2 | 1 compétence en progression |
| Participation | Mon avis compte | 1 | une enquête de satisfaction remplie |
| | Montrer mes compétences | 1 | un lien de partage du passeport créé |
| | Esprit d’équipe | 1 | une partie de jeu d’animation jouée (existence seulement : ni score ni rang) |

**À valider** : la liste, les intitulés, les étoiles et les paliers 1 / 10 / 20 de l’album sont des propositions d’animation, réglables dans `challenges.ts` (`COLLECTION_STEPS`). Le défi « Montrer mes compétences » encourage le partage du passeport : à retirer si vous préférez qu’aucune incitation ne porte sur un partage de données.

### Données lues

Passeport (présences, évaluations validées, auto-évaluations), enquêtes de satisfaction de la personne, nombre de ses liens de partage, existence d’une partie de jeu (`loadParticipantEngagement`, session de la personne, RLS). Aucune écriture.

**Navigateur** : la liste des défis déjà célébrés est gardée dans le stockage local du navigateur (clé `happi:defis-celebres:<identifiant du participant>`), pour ne pas fêter deux fois le même défi. Elle n’est jamais envoyée au serveur ; si le stockage est indisponible, la célébration réapparaît simplement à la visite suivante.

## Formateur

- **À faire** : évaluations à finaliser par session terminée, personnes à relancer (absences répétées). Quand la liste est vide : « Tout est à jour ».
- **Ma semaine** (depuis lundi, heure de Paris) : part des évaluations à jour, évaluations validées, compétences observées et présences saisies **par le formateur lui-même**. Ces chiffres ne sont visibles que par lui : aucun écran ne les compare ni ne les remonte à la direction.

## Organisme

**Les jalons de votre structure** : personnes accompagnées, sessions réalisées, parcours menés à terme, orientations acceptées. Seuils dans `src/lib/engagement/milestones.ts` (`MILESTONE_TIERS`), **à valider** : ce sont des caps d’animation, pas des objectifs de performance.

## Navigation participant

Huit entrées au lieu de seize : Accueil, Mes compétences (Transversales, Habiletés socio-cognitives, Mon auto-évaluation, Mon évolution), Mon parcours, Mes réussites (Défis, Badges, Jeux), Mon bilan (Mon bilan, Partager mon passeport), Rejoindre une partie, Mon profil (Profil, Consentements, Fiche d’entrée), Mon avis (Donner mon avis, Signaler un problème). Les adresses des pages ne changent pas.
