-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — données de référence
--
-- Rôles, permissions, référentiels (version 1), questionnaire d'auto-évaluation,
-- programme et paramètres. Ces données constituent le point de départ de la
-- plateforme ; elles se modifient ensuite depuis l'espace administrateur.
--
-- Sources :
--   • 16 habiletés socio-cognitives : référentiel fourni par HAPPI (définitions
--     et niveaux Aptitude / Acquisition / Maîtrise / Excellence) ;
--   • 18 compétences transversales, critères, correspondances avec les sessions
--     et questionnaire : repris de l'outil précédent et signalés comme provisoires.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.roles (code, label, description, position) values
  ('participant', 'Participant', 'Personne qui suit un programme HAPPI et consulte son passeport de compétences.', 1),
  ('organisme', 'Organisme', 'Membre d’une structure partenaire : consultation des participants qui lui sont rattachés.', 2),
  ('formateur', 'Formateur', 'Anime les sessions, saisit les présences et évalue les participants de ses groupes.', 3),
  ('admin', 'Administrateur', 'Gère l’ensemble de la plateforme.', 4);

insert into public.permissions (code, label, description, applicable_roles, position) values
  ('groups.manage', 'Créer et gérer les groupes', 'Créer un groupe, modifier ses informations, ajouter ou retirer des participants.', '{formateur}', 1),
  ('sessions.manage', 'Planifier et modifier les sessions', 'Créer les sessions d’un groupe et modifier leurs dates, horaires et lieux.', '{formateur}', 2),
  ('attendance.write', 'Saisir les présences', 'Renseigner et corriger les fiches de présence.', '{formateur}', 3),
  ('evaluations.write', 'Évaluer les participants', 'Saisir, valider et corriger les évaluations.', '{formateur}', 4),
  ('participants.directory', 'Voir les participants sans groupe', 'Consulter les participants inscrits qui n’ont pas encore de groupe, pour pouvoir les affecter.', '{formateur}', 5),
  ('participants.link_organization', 'Rattacher un participant à un organisme', 'Modifier l’organisme de rattachement d’un participant.', '{formateur}', 6),
  ('content.read', 'Consulter les supports pédagogiques', 'Ouvrir le lecteur pédagogique des sessions.', '{formateur}', 7),
  ('org.evaluations.read', 'Consulter les évaluations validées', 'Lire les fiches de compétences des participants rattachés à l’organisme.', '{organisme}', 8),
  ('org.attendance.read', 'Consulter les présences', 'Lire les fiches de présence des participants rattachés à l’organisme.', '{organisme}', 9),
  ('org.exports', 'Télécharger les documents', 'Télécharger les feuilles de présence et les fiches de compétences.', '{organisme}', 10);

insert into public.role_permissions (role_code, permission_code)
select role_code, p.code from public.permissions p, unnest(p.applicable_roles) as role_code;

insert into public.app_settings (key, value, is_public) values
  ('contact.email', '"contact@happicompetence.fr"', true),
  ('contact.phones', '["06 67 32 60 07", "06 27 24 74 96"]', true),
  ('legal.company_name', '""', true),
  ('legal.legal_form', '""', true),
  ('legal.siret', '""', true),
  ('legal.address', '""', true),
  ('legal.publication_director', '""', true),
  ('legal.host', '""', true),
  ('legal.dpo_contact', '""', true),
  ('platform.organization_signup_enabled', 'true', true),
  ('platform.data_retention_months', '36', false);

do $seed$
declare
  v_data jsonb := $happi${
 "frameworks": [
  {
   "code": "transversal",
   "name": "Compétences transversales",
   "short_name": "Transversales",
   "description": "Dix-huit compétences utiles dans tous les métiers, observées pendant les sessions du programme.",
   "position": 1,
   "version": {
    "label": "Version 1 — reprise de l’outil précédent",
    "is_provisional": true,
    "notes": "Intitulés, catégories, niveaux, critères et correspondances avec les sessions repris de l’outil précédent. À confirmer ou remplacer dès réception du référentiel officiel des 18 compétences transversales et du barème des formateurs. La session 6 n’a pas encore de compétences associées.",
    "scale_min": 1,
    "scale_max": 5
   },
   "levels": [
    {
     "value": 1,
     "label": "Non acquis",
     "description": null
    },
    {
     "value": 2,
     "label": "En difficulté",
     "description": null
    },
    {
     "value": 3,
     "label": "En cours d'acquisition",
     "description": null
    },
    {
     "value": 4,
     "label": "Acquis",
     "description": null
    },
    {
     "value": 5,
     "label": "Dépassé",
     "description": null
    }
   ],
   "categories": [
    {
     "code": "communication",
     "name": "Communication",
     "description": null,
     "skills": [
      {
       "code": "relationnel",
       "name": "Relationnel",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Évite le contact, reste en retrait ou communique en surface."
        },
        {
         "value": 2,
         "description": "Interagit peu, langage parfois inadapté, écoute limitée."
        },
        {
         "value": 3,
         "description": "Communique correctement en situation connue, fait des efforts d'écoute."
        },
        {
         "value": 4,
         "description": "Établit facilement des relations positives, écoute activement, s'adapte."
        },
        {
         "value": 5,
         "description": "Crée naturellement un climat de confiance, fédère et sert de modèle."
        }
       ],
       "criteria": [
        {
         "label": "Écoute active"
        },
        {
         "label": "Empathie"
        },
        {
         "label": "Clarté et fluidité de communication"
        },
        {
         "label": "Gestion des interactions"
        },
        {
         "label": "Gestion des conflits"
        }
       ],
       "sessions": [
        1
       ]
      },
      {
       "code": "esprit_d_equipe",
       "name": "Esprit d'équipe",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Travaille de manière individuelle, ne prend pas en compte les autres."
        },
        {
         "value": 2,
         "description": "Participe peu, ne contribue pas vraiment à la réussite du groupe."
        },
        {
         "value": 3,
         "description": "Collabore correctement, contribue aux tâches communes régulièrement."
        },
        {
         "value": 4,
         "description": "S'implique activement, aide ses coéquipiers, partage succès et difficultés."
        },
        {
         "value": 5,
         "description": "Moteur du groupe, renforce la cohésion, anticipe les besoins des autres."
        }
       ],
       "criteria": [
        {
         "label": "Collaboration"
        },
        {
         "label": "Soutien aux collègues"
        },
        {
         "label": "Acceptation des différences"
        },
        {
         "label": "Partage d'informations"
        },
        {
         "label": "Engagement collectif"
        }
       ],
       "sessions": [
        1
       ]
      },
      {
       "code": "comprehension",
       "name": "Compréhension",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Ne saisit pas les consignes, les situations ou les enjeux."
        },
        {
         "value": 2,
         "description": "Comprend partiellement, doit être guidé régulièrement."
        },
        {
         "value": 3,
         "description": "Comprend les situations habituelles, demande rarement des clarifications."
        },
        {
         "value": 4,
         "description": "Analyse rapidement les situations, reformule et adapte sa compréhension."
        },
        {
         "value": 5,
         "description": "Saisit les enjeux implicites, fait des liens entre informations complexes."
        }
       ],
       "criteria": [
        {
         "label": "Analyse des informations"
        },
        {
         "label": "Interprétation des consignes"
        },
        {
         "label": "Synthèse des éléments clés"
        },
        {
         "label": "Réactivité aux explications"
        },
        {
         "label": "Identification des zones d'ombre"
        }
       ],
       "sessions": [
        1
       ]
      }
     ]
    },
    {
     "code": "gestion_du_stress",
     "name": "Gestion du stress",
     "description": null,
     "skills": [
      {
       "code": "adaptabilite",
       "name": "Adaptabilité",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Résiste aux changements, reste bloqué face à l'imprévu."
        },
        {
         "value": 2,
         "description": "S'adapte avec difficulté, a besoin de temps et de soutien."
        },
        {
         "value": 3,
         "description": "Accepte les changements, s'ajuste progressivement à de nouvelles situations."
        },
        {
         "value": 4,
         "description": "S'adapte rapidement et efficacement, conserve sa performance."
        },
        {
         "value": 5,
         "description": "Transforme les imprévus en opportunités, guide les autres dans le changement."
        }
       ],
       "criteria": [
        {
         "label": "Réactivité face aux imprévus"
        },
        {
         "label": "Ouverture au changement"
        },
        {
         "label": "Apprentissage rapide"
        },
        {
         "label": "Capacité à sortir de sa zone de confort"
        },
        {
         "label": "Flexibilité comportementale"
        }
       ],
       "sessions": [
        2
       ]
      },
      {
       "code": "gestion_des_priorites",
       "name": "Gestion des priorités",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Ne distingue pas l'urgent de l'important, se disperse ou est paralysé."
        },
        {
         "value": 2,
         "description": "Trie les tâches avec difficulté, doit être guidé pour prioriser."
        },
        {
         "value": 3,
         "description": "Identifie les priorités en situation connue, progresse avec la pratique."
        },
        {
         "value": 4,
         "description": "Hiérarchise efficacement ses tâches, s'organise sans supervision."
        },
        {
         "value": 5,
         "description": "Anticipe les urgences, gère les priorités de l'équipe avec méthode."
        }
       ],
       "criteria": [
        {
         "label": "Identification des tâches essentielles"
        },
        {
         "label": "Planification efficace"
        },
        {
         "label": "Capacité à respecter les échéances"
        },
        {
         "label": "Gestion des imprévus"
        },
        {
         "label": "Concentration sur l'essentiel"
        }
       ],
       "sessions": [
        2
       ]
      },
      {
       "code": "gestion_du_stress",
       "name": "Gestion du stress",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Est rapidement dépassé par la pression, perd ses moyens."
        },
        {
         "value": 2,
         "description": "Ressent fortement le stress, performance impactée mais récupère."
        },
        {
         "value": 3,
         "description": "Gère son stress en situation connue, utilise quelques outils."
        },
        {
         "value": 4,
         "description": "Reste performant sous pression, utilise des techniques de régulation efficaces."
        },
        {
         "value": 5,
         "description": "Transforme le stress en énergie, rassure et stabilise le groupe."
        }
       ],
       "criteria": [
        {
         "label": "Maîtrise émotionnelle"
        },
        {
         "label": "Capacité à prendre du recul"
        },
        {
         "label": "Gestion des imprévus sous pression"
        },
        {
         "label": "Efficacité sous pression"
        },
        {
         "label": "Stratégies de gestion du stress"
        }
       ],
       "sessions": [
        2
       ]
      }
     ]
    },
    {
     "code": "leadership",
     "name": "Leadership",
     "description": null,
     "skills": [
      {
       "code": "leadership",
       "name": "Leadership",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Ne prend pas d'initiative, attend les instructions."
        },
        {
         "value": 2,
         "description": "Prend rarement l'initiative, influence limitée sur le groupe."
        },
        {
         "value": 3,
         "description": "Guide parfois le groupe, prend la parole en situation connue."
        },
        {
         "value": 4,
         "description": "Fédère naturellement, oriente le groupe vers les objectifs, inspire confiance."
        },
        {
         "value": 5,
         "description": "Leader reconnu, adapte son style selon la situation, développe les autres."
        }
       ],
       "criteria": [
        {
         "label": "Vision et inspiration"
        },
        {
         "label": "Prise de décisions"
        },
        {
         "label": "Responsabilité"
        },
        {
         "label": "Capacité à déléguer"
        },
        {
         "label": "Exemplarité"
        }
       ],
       "sessions": [
        3
       ]
      },
      {
       "code": "force_de_proposition",
       "name": "Force de proposition",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "N'exprime pas d'idées ou d'initiatives."
        },
        {
         "value": 2,
         "description": "Partage peu ses idées, manque de confiance pour les formuler."
        },
        {
         "value": 3,
         "description": "Propose des idées en situation simple."
        },
        {
         "value": 4,
         "description": "Propose régulièrement des solutions adaptées, enrichit les décisions du groupe."
        },
        {
         "value": 5,
         "description": "Génère des idées innovantes, entraîne une dynamique créative."
        }
       ],
       "criteria": [
        {
         "label": "Créativité"
        },
        {
         "label": "Pertinence des suggestions"
        },
        {
         "label": "Initiative"
        },
        {
         "label": "Capacité à argumenter ses idées"
        },
        {
         "label": "Persévérance"
        }
       ],
       "sessions": [
        3
       ]
      },
      {
       "code": "organisation",
       "name": "Organisation",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Travail non structuré, oublis fréquents, ne planifie pas."
        },
        {
         "value": 2,
         "description": "S'organise avec difficulté, perd du temps par manque de méthode."
        },
        {
         "value": 3,
         "description": "S'organise correctement en situation simple, utilise des outils basiques."
        },
        {
         "value": 4,
         "description": "Planifie efficacement, gère son temps et ses ressources de façon autonome."
        },
        {
         "value": 5,
         "description": "Optimise l'organisation du groupe, anticipe et structure les actions collectives."
        }
       ],
       "criteria": [
        {
         "label": "Gestion du temps"
        },
        {
         "label": "Planification des tâches"
        },
        {
         "label": "Rangement et gestion des outils"
        },
        {
         "label": "Suivi et respect des deadlines"
        },
        {
         "label": "Anticipation des besoins"
        }
       ],
       "sessions": [
        3
       ]
      }
     ]
    },
    {
     "code": "analyse_des_problemes",
     "name": "Analyse des problèmes",
     "description": null,
     "skills": [
      {
       "code": "implication",
       "name": "Implication",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "S'investit peu ou pas, participe passivement."
        },
        {
         "value": 2,
         "description": "Participation irrégulière, se laisse décourager facilement."
        },
        {
         "value": 3,
         "description": "S'implique correctement, montre de la bonne volonté."
        },
        {
         "value": 4,
         "description": "Pleinement engagé, va au bout des tâches, cherche à progresser."
        },
        {
         "value": 5,
         "description": "Enthousiaste et persévérant, entraîne le groupe dans sa dynamique."
        }
       ],
       "criteria": [
        {
         "label": "Motivation"
        },
        {
         "label": "Autonomie dans le travail"
        },
        {
         "label": "Fiabilité"
        },
        {
         "label": "Persévérance"
        },
        {
         "label": "Investissement personnel"
        }
       ],
       "sessions": [
        4
       ]
      },
      {
       "code": "analyse_des_problemes",
       "name": "Analyse des problèmes",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Ne décompose pas les problèmes, réagit sans analyser."
        },
        {
         "value": 2,
         "description": "Identifie partiellement les problèmes, manque de méthode."
        },
        {
         "value": 3,
         "description": "Analyse les situations simples, identifie les causes principales."
        },
        {
         "value": 4,
         "description": "Décompose et structure les problèmes, propose des solutions adaptées."
        },
        {
         "value": 5,
         "description": "Analyse complexe et systémique, anticipe les risques, guide la résolution."
        }
       ],
       "criteria": [
        {
         "label": "Identification des causes"
        },
        {
         "label": "Évaluation des conséquences"
        },
        {
         "label": "Recherche de solutions adaptées"
        },
        {
         "label": "Prise de décision éclairée"
        },
        {
         "label": "Capacité à apprendre des erreurs"
        }
       ],
       "sessions": [
        4
       ]
      },
      {
       "code": "curiosite",
       "name": "Curiosité",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Montre peu d'intérêt pour l'apprentissage ou l'exploration."
        },
        {
         "value": 2,
         "description": "Curiosité limitée, se cantonne au minimum demandé."
        },
        {
         "value": 3,
         "description": "S'intéresse à certains sujets, commence à explorer par lui-même."
        },
        {
         "value": 4,
         "description": "Curieux et proactif, cherche à comprendre au-delà des consignes."
        },
        {
         "value": 5,
         "description": "Soif d'apprendre permanente, partage ses découvertes avec le groupe."
        }
       ],
       "criteria": [
        {
         "label": "Ouverture aux nouvelles connaissances"
        },
        {
         "label": "Esprit d'exploration"
        },
        {
         "label": "Volonté d'expérimenter"
        },
        {
         "label": "Questionnement actif"
        },
        {
         "label": "Veille et autoformation"
        }
       ],
       "sessions": [
        4
       ]
      }
     ]
    },
    {
     "code": "autonomie_et_competitivite",
     "name": "Autonomie et compétitivité",
     "description": null,
     "skills": [
      {
       "code": "autonomie",
       "name": "Autonomie",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "A besoin d'être guidé en permanence pour avancer."
        },
        {
         "value": 2,
         "description": "Avance peu sans validation, doute souvent de ses actions."
        },
        {
         "value": 3,
         "description": "Travaille de manière autonome sur des tâches connues."
        },
        {
         "value": 4,
         "description": "Prend des décisions seul avec discernement, sait quand demander de l'aide."
        },
        {
         "value": 5,
         "description": "Parfaitement autonome, guide les autres dans leur propre autonomie."
        }
       ],
       "criteria": [
        {
         "label": "Capacité à travailler sans supervision"
        },
        {
         "label": "Prise d'initiatives"
        },
        {
         "label": "Auto-organisation"
        },
        {
         "label": "Autodiscipline"
        },
        {
         "label": "Résolution des problèmes par soi-même"
        }
       ],
       "sessions": [
        5
       ]
      },
      {
       "code": "respect_des_delais",
       "name": "Respect des délais",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Ne respecte pas les délais, ne les considère pas comme une priorité."
        },
        {
         "value": 2,
         "description": "Dépasse souvent les délais, a du mal à anticiper."
        },
        {
         "value": 3,
         "description": "Respecte généralement les délais en étant rappelé."
        },
        {
         "value": 4,
         "description": "Respecte systématiquement les délais fixés, anticipe les retards possibles."
        },
        {
         "value": 5,
         "description": "Livre avant les délais, aide les autres à s'organiser pour tenir les leurs."
        }
       ],
       "criteria": [
        {
         "label": "Planification des tâches"
        },
        {
         "label": "Efficacité dans l'exécution"
        },
        {
         "label": "Anticipation des retards"
        },
        {
         "label": "Capacité à travailler sous pression"
        },
        {
         "label": "Fiabilité"
        }
       ],
       "sessions": [
        5
       ]
      },
      {
       "code": "polyvalence",
       "name": "Polyvalence",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Ne s'adapte pas à des tâches différentes, reste dans un registre unique."
        },
        {
         "value": 2,
         "description": "Peine à changer de rôle ou de type de tâche."
        },
        {
         "value": 3,
         "description": "Peut gérer des tâches variées avec un accompagnement."
        },
        {
         "value": 4,
         "description": "S'adapte à différents rôles et contextes de manière efficace."
        },
        {
         "value": 5,
         "description": "Excelle dans des registres très différents, atout indispensable du groupe."
        }
       ],
       "criteria": [
        {
         "label": "Capacité à apprendre rapidement"
        },
        {
         "label": "Adaptabilité aux différents contextes"
        },
        {
         "label": "Compétences variées"
        },
        {
         "label": "Efficacité dans plusieurs rôles"
        },
        {
         "label": "Résilience face aux changements de mission"
        }
       ],
       "sessions": [
        5
       ]
      }
     ]
    },
    {
     "code": "humaine",
     "name": "Humaine",
     "description": null,
     "skills": [
      {
       "code": "respect_des_consignes",
       "name": "Respect des consignes",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Ne suit pas les consignes ou les ignore."
        },
        {
         "value": 2,
         "description": "Suit partiellement les consignes, doit être rappelé régulièrement."
        },
        {
         "value": 3,
         "description": "Respecte les consignes dans les situations connues."
        },
        {
         "value": 4,
         "description": "Suit les consignes avec rigueur et les explique aux autres si besoin."
        },
        {
         "value": 5,
         "description": "Modèle de respect des règles, contribue à maintenir le cadre du groupe."
        }
       ],
       "criteria": [],
       "sessions": []
      },
      {
       "code": "professionnalisme",
       "name": "Professionnalisme",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Comportement non professionnel (retards, tenue, langage)."
        },
        {
         "value": 2,
         "description": "Attitude fluctuante, manque de régularité dans la posture professionnelle."
        },
        {
         "value": 3,
         "description": "Comportement globalement professionnel, quelques points à améliorer."
        },
        {
         "value": 4,
         "description": "Attitude professionnelle constante, représente bien le groupe."
        },
        {
         "value": 5,
         "description": "Exemplarité totale, influence positivement l'attitude du groupe."
        }
       ],
       "criteria": [],
       "sessions": []
      },
      {
       "code": "rigueur",
       "name": "Rigueur",
       "description": null,
       "levels": [
        {
         "value": 1,
         "description": "Travail bâclé, erreurs fréquentes, peu de soin apporté."
        },
        {
         "value": 2,
         "description": "Manque de précision, doit être relu ou guidé pour corriger."
        },
        {
         "value": 3,
         "description": "Travail généralement soigné, quelques imprécisions."
        },
        {
         "value": 4,
         "description": "Travail précis et fiable, vérifie systématiquement avant de rendre."
        },
        {
         "value": 5,
         "description": "Perfectionniste, qualité irréprochable, entraîne les autres vers l'exigence."
        }
       ],
       "criteria": [],
       "sessions": []
      }
     ]
    }
   ]
  },
  {
   "code": "sociocognitive",
   "name": "Habiletés socio-cognitives",
   "short_name": "Habiletés",
   "description": "Seize aptitudes qui combinent les ressources émotionnelles et intellectuelles d’une personne pour apprendre, interagir et s’adapter. Leur identification s’appuie sur la norme AFNOR XP X50-766.",
   "position": 2,
   "version": {
    "label": "Version 1 — référentiel des habiletés socio-cognitives",
    "is_provisional": false,
    "notes": "Définitions et niveaux issus du référentiel des habiletés socio-cognitives fourni par HAPPI. Les correspondances avec les sessions proviennent de l’outil précédent et restent à confirmer. Aucun critère d’observation n’est encore défini.",
    "scale_min": 1,
    "scale_max": 4
   },
   "levels": [
    {
     "value": 1,
     "label": "Aptitude",
     "description": null
    },
    {
     "value": 2,
     "label": "Acquisition",
     "description": null
    },
    {
     "value": 3,
     "label": "Maîtrise",
     "description": null
    },
    {
     "value": 4,
     "label": "Excellence",
     "description": null
    }
   ],
   "categories": [
    {
     "code": "soi",
     "name": "Soi",
     "description": "Habiletés tournées vers soi : se connaître, se réguler, s’organiser et se mobiliser.",
     "skills": [
      {
       "code": "auto_evaluation",
       "name": "Auto-évaluation",
       "description": "Habileté à prendre du recul sur ses expériences à partir de ses pensées, émotions et comportements pour produire une analyse critique.",
       "levels": [
        {
         "value": 1,
         "description": "Reconnaît partiellement ses émotions/comportements après coup."
        },
        {
         "value": 2,
         "description": "Identifie ses points forts/faibles dans un cadre familier."
        },
        {
         "value": 3,
         "description": "Analyse ses expériences et ajuste ses comportements dans des situations variées."
        },
        {
         "value": 4,
         "description": "Prend systématiquement du recul, tire des enseignements et généralise."
        }
       ],
       "criteria": [],
       "sessions": [
        2,
        4,
        5
       ]
      },
      {
       "code": "auto_regulation",
       "name": "Auto-régulation",
       "description": "Habileté à ajuster ses pensées, émotions et comportements pour atteindre un objectif donné.",
       "levels": [
        {
         "value": 1,
         "description": "Réagit de manière basique (ex. se calme après un rappel)."
        },
        {
         "value": 2,
         "description": "Parvient à gérer ses émotions dans un cadre connu."
        },
        {
         "value": 3,
         "description": "Régule efficacement ses réactions face à des situations complexes."
        },
        {
         "value": 4,
         "description": "Montre une maîtrise constante, même dans des contextes fortement stressants."
        }
       ],
       "criteria": [],
       "sessions": [
        2,
        5
       ]
      },
      {
       "code": "auto_organisation",
       "name": "Auto-organisation",
       "description": "Habileté à identifier et structurer par soi-même ses ressources personnelles pour conduire ses activités.",
       "levels": [
        {
         "value": 1,
         "description": "Organise ponctuellement ses actions."
        },
        {
         "value": 2,
         "description": "Structure son travail de façon cohérente dans des contextes simples."
        },
        {
         "value": 3,
         "description": "Planifie et organise ses ressources de manière autonome et efficace."
        },
        {
         "value": 4,
         "description": "Gère ses ressources de façon optimale dans des situations complexes."
        }
       ],
       "criteria": [],
       "sessions": [
        2,
        4,
        5
       ]
      },
      {
       "code": "auto_mobilisation",
       "name": "Auto-mobilisation",
       "description": "Habileté à combiner ses ressources émotionnelles et cognitives pour se mettre en action et persévérer.",
       "levels": [
        {
         "value": 1,
         "description": "Se met en action uniquement sous impulsion extérieure."
        },
        {
         "value": 2,
         "description": "Persévère sur des tâches connues."
        },
        {
         "value": 3,
         "description": "Se mobilise de manière autonome, même face à des obstacles."
        },
        {
         "value": 4,
         "description": "Déploie une énergie durable et inspire la persévérance des autres."
        }
       ],
       "criteria": [],
       "sessions": [
        2,
        4,
        5
       ]
      }
     ]
    },
    {
     "code": "autre",
     "name": "Autre",
     "description": "Habiletés tournées vers les autres : percevoir, s’ajuster et coopérer.",
     "skills": [
      {
       "code": "sensibilite_sociale",
       "name": "Sensibilité sociale",
       "description": "Habileté à percevoir et analyser les émotions et attentes des autres.",
       "levels": [
        {
         "value": 1,
         "description": "Détecte parfois les émotions des autres."
        },
        {
         "value": 2,
         "description": "Réagit à certaines émotions identifiées."
        },
        {
         "value": 3,
         "description": "Adapte son comportement aux besoins émotionnels des autres."
        },
        {
         "value": 4,
         "description": "Capte et régule activement les dynamiques émotionnelles du groupe."
        }
       ],
       "criteria": [],
       "sessions": [
        1,
        2,
        3
       ]
      },
      {
       "code": "adaptation_relationnelle",
       "name": "Adaptation relationnelle",
       "description": "Habileté à ajuster ses émotions, expressions, gestes et paroles selon une situation sociale donnée.",
       "levels": [
        {
         "value": 1,
         "description": "S'adapte difficilement à un interlocuteur différent."
        },
        {
         "value": 2,
         "description": "Ajuste partiellement son attitude selon la situation."
        },
        {
         "value": 3,
         "description": "Change volontairement de registre pour fluidifier la relation."
        },
        {
         "value": 4,
         "description": "Adapte et module son comportement avec aisance dans tout contexte social."
        }
       ],
       "criteria": [],
       "sessions": [
        1,
        2,
        3
       ]
      },
      {
       "code": "cooperation",
       "name": "Coopération",
       "description": "Habileté à contribuer à une action collective.",
       "levels": [
        {
         "value": 1,
         "description": "Coopère si sollicité directement."
        },
        {
         "value": 2,
         "description": "Participe activement quand les règles sont claires."
        },
        {
         "value": 3,
         "description": "S'implique spontanément et soutient les autres."
        },
        {
         "value": 4,
         "description": "Favorise la cohésion et optimise l'efficacité collective."
        }
       ],
       "criteria": [],
       "sessions": [
        1,
        3,
        4
       ]
      }
     ]
    },
    {
     "code": "action",
     "name": "Action",
     "description": "Habiletés tournées vers l’action : raisonner, planifier et décider.",
     "skills": [
      {
       "code": "raisonnement_logique",
       "name": "Raisonnement logique",
       "description": "Habileté à tirer des conclusions à partir de l'analyse d'informations en suivant des règles établies.",
       "levels": [
        {
         "value": 1,
         "description": "Suit une logique simple mais partielle."
        },
        {
         "value": 2,
         "description": "Applique une logique correcte dans des cas connus."
        },
        {
         "value": 3,
         "description": "Analyse efficacement et corrige les erreurs en temps réel."
        },
        {
         "value": 4,
         "description": "Structure et explique une logique complexe pour l'ensemble du groupe."
        }
       ],
       "criteria": [],
       "sessions": [
        3,
        4
       ]
      },
      {
       "code": "planification",
       "name": "Planification",
       "description": "Habileté à organiser dans le temps une succession d'activités en fonction des ressources et contraintes.",
       "levels": [
        {
         "value": 1,
         "description": "Organise ses actions immédiates."
        },
        {
         "value": 2,
         "description": "Planifie des étapes simples et connues."
        },
        {
         "value": 3,
         "description": "Structure des séquences complètes de manière réaliste."
        },
        {
         "value": 4,
         "description": "Anticipe et ajuste la planification dans des contextes dynamiques."
        }
       ],
       "criteria": [],
       "sessions": [
        1,
        2,
        5
       ]
      },
      {
       "code": "arbitrage",
       "name": "Arbitrage",
       "description": "Habileté à sélectionner une option justifiable parmi plusieurs, en fonction de contraintes et conséquences.",
       "levels": [
        {
         "value": 1,
         "description": "Hésite, suit le groupe sans décider."
        },
        {
         "value": 2,
         "description": "Prend une décision simple avec justification limitée."
        },
        {
         "value": 3,
         "description": "Décide rapidement avec des arguments clairs."
        },
        {
         "value": 4,
         "description": "Décide avec assurance, équilibre rapidité et équité, obtient l'adhésion."
        }
       ],
       "criteria": [],
       "sessions": [
        2,
        3,
        4
       ]
      }
     ]
    },
    {
     "code": "savoir",
     "name": "Savoir",
     "description": "Habiletés tournées vers le savoir : traiter l’information, synthétiser et conceptualiser.",
     "skills": [
      {
       "code": "traitement_de_l_information",
       "name": "Traitement de l'information",
       "description": "Habileté à collecter, évaluer et interpréter des informations.",
       "levels": [
        {
         "value": 1,
         "description": "Capte partiellement les informations."
        },
        {
         "value": 2,
         "description": "Comprend et applique les infos dans un cadre simple."
        },
        {
         "value": 3,
         "description": "Analyse et interprète correctement dans la plupart des cas."
        },
        {
         "value": 4,
         "description": "Traite, hiérarchise et transmet les informations avec clarté à l'équipe."
        }
       ],
       "criteria": [],
       "sessions": [
        1,
        4,
        5
       ]
      },
      {
       "code": "synthese",
       "name": "Synthèse",
       "description": "Habileté à résumer et restituer des informations en respectant cohérence et sens.",
       "levels": [
        {
         "value": 1,
         "description": "Retient quelques éléments isolés."
        },
        {
         "value": 2,
         "description": "Reformule l'essentiel dans un contexte simple."
        },
        {
         "value": 3,
         "description": "Résume de manière claire et pertinente les infos complexes."
        },
        {
         "value": 4,
         "description": "Produit des synthèses complètes, claires et utilisables par tous."
        }
       ],
       "criteria": [],
       "sessions": [
        2,
        5
       ]
      },
      {
       "code": "conceptualisation",
       "name": "Conceptualisation",
       "description": "Habileté à construire des représentations abstraites en généralisant leurs caractéristiques.",
       "levels": [
        {
         "value": 1,
         "description": "Comprend des exemples concrets uniquement."
        },
        {
         "value": 2,
         "description": "Commence à formuler des notions générales."
        },
        {
         "value": 3,
         "description": "Construit des schémas et représentations abstraites utiles."
        },
        {
         "value": 4,
         "description": "Élaborations conceptuelles transférables à divers contextes."
        }
       ],
       "criteria": [],
       "sessions": [
        3,
        4
       ]
      }
     ]
    },
    {
     "code": "complexite",
     "name": "Complexité",
     "description": "Habiletés face à la complexité : explorer des alternatives, se projeter et relier.",
     "skills": [
      {
       "code": "flexibilite_mentale",
       "name": "Flexibilité mentale",
       "description": "Habileté à générer des idées/usages alternatifs.",
       "levels": [
        {
         "value": 1,
         "description": "Change difficilement de stratégie."
        },
        {
         "value": 2,
         "description": "Propose parfois une alternative simple."
        },
        {
         "value": 3,
         "description": "Génère régulièrement des solutions créatives."
        },
        {
         "value": 4,
         "description": "Produit systématiquement des alternatives innovantes et adaptées."
        }
       ],
       "criteria": [],
       "sessions": [
        2
       ]
      },
      {
       "code": "projection",
       "name": "Projection",
       "description": "Habileté à formuler des conjectures à partir de facteurs multiples.",
       "levels": [
        {
         "value": 1,
         "description": "Pense au présent immédiat."
        },
        {
         "value": 2,
         "description": "Anticipe une étape simple."
        },
        {
         "value": 3,
         "description": "Propose des scénarios futurs réalistes."
        },
        {
         "value": 4,
         "description": "Anticipe plusieurs hypothèses et guide la stratégie collective."
        }
       ],
       "criteria": [],
       "sessions": [
        2,
        3,
        4
       ]
      },
      {
       "code": "approche_globale",
       "name": "Approche globale",
       "description": "Habileté à considérer l'influence mutuelle des composantes d'un système.",
       "levels": [
        {
         "value": 1,
         "description": "Voit les éléments isolés sans liens."
        },
        {
         "value": 2,
         "description": "Identifie quelques relations simples."
        },
        {
         "value": 3,
         "description": "Relie efficacement les composantes entre elles."
        },
        {
         "value": 4,
         "description": "Intègre une vision systémique complète et cohérente."
        }
       ],
       "criteria": [],
       "sessions": [
        4,
        5
       ]
      }
     ]
    }
   ]
  }
 ],
 "program": {
  "name": "Programme HAPPI",
  "description": "18 heures d’accompagnement en 6 sessions de 3 heures : mises en situation ludiques, temps d’échange et de débriefing, observation des compétences et suivi individuel.",
  "sessions": [
   {
    "number": 1,
    "title": "La communication",
    "summary": "Développer l'écoute active, l'assertivité et la coopération par le jeu et le débat.",
    "objectives": [
     "Développer l'écoute active, l'assertivité et la coopération par le jeu et le débat."
    ],
    "activities": [
     "Auto-évaluation initiale",
     "Icebreaker — Jeu de l'Imposteur",
     "Débat thématique — Questions OUI / NON",
     "Activités Ludiques — Moving Out & WorldGuessr"
    ],
    "key_notions": [
     "Communication interpersonnelle : L'échange humain global entre deux personnes ou plus. Il prend en compte le verbal, le non-verbal, le contexte et les émotions.",
     "Écoute active : L'art d'écouter pour comprendre réellement ce que dit l'autre, et non uniquement pour préparer sa propre réponse.",
     "Assertivité : La capacité à exprimer clairement ses idées, ses besoins ou ses limites sans agressivité et sans passivité. Trouver l'équilibre entre s'affirmer et respecter l'autre."
    ],
    "takeaways": [],
    "is_provisional": false
   },
   {
    "number": 2,
    "title": "Adaptabilité et gestion du stress",
    "summary": "Développer la réactivité, la gestion des priorités et la maîtrise émotionnelle sous pression.",
    "objectives": [
     "Développer la réactivité, la gestion des priorités et la maîtrise émotionnelle sous pression."
    ],
    "activities": [
     "Icebreaker — Jeu de l'Imposteur",
     "Débat thématique — Questions OUI / NON",
     "Keep Talking and Nobody Explodes — Désamorçage coopératif",
     "Unchained Together — Coopération enchaînée"
    ],
    "key_notions": [
     "Régulation émotionnelle : Le stress peut être un moteur (adrénaline) ou un frein (paralysie). Savoir le réguler est une compétence clé.",
     "Gestion des priorités : Savoir trier l'information sous pression : faire la différence entre l'Urgent et l'Important.",
     "Outils de gestion : Utiliser la respiration, le recentrage, la planification courte et la flexibilité mentale."
    ],
    "takeaways": [],
    "is_provisional": false
   },
   {
    "number": 3,
    "title": "Leadership",
    "summary": "Explorer les styles de leadership, la prise de décision et l'organisation collective.",
    "objectives": [
     "Explorer les styles de leadership, la prise de décision et l'organisation collective."
    ],
    "activities": [
     "Icebreaker — Jeu de l'Imposteur",
     "Débat thématique — Questions OUI / NON",
     "Overcooked 2 — Cuisine coopérative",
     "Supermarket Together — Gestion de magasin"
    ],
    "key_notions": [
     "Leadership de rôle : Celui qui est désigné ou nommé pour diriger. Il tire sa légitimité de sa position hiérarchique ou de son titre.",
     "Leadership de compétence : Celui qui maîtrise un domaine et que le groupe suit naturellement pour son expertise. Sa légitimité vient de son savoir-faire.",
     "Leadership de situation : Celui qui prend l'initiative au bon moment, sans avoir été désigné. Il s'adapte au contexte et aux besoins du groupe."
    ],
    "takeaways": [],
    "is_provisional": false
   },
   {
    "number": 4,
    "title": "Analyse des problèmes",
    "summary": "Développer la curiosité, l'analyse logique et la résolution collective.",
    "objectives": [
     "Développer la curiosité, l'analyse logique et la résolution collective."
    ],
    "activities": [
     "Icebreaker — Jeu de l'Imposteur",
     "Débat thématique — Questions OUI / NON",
     "Escape Simulator — Résolution d'énigmes",
     "Biped — Coopération physique"
    ],
    "key_notions": [
     "Observer : Prendre le temps de comprendre la situation avant d'agir. Collecter les informations, identifier les indices et les contraintes.",
     "Structurer : Organiser les informations collectées, décomposer le problème en étapes logiques et prioriser les actions à mener.",
     "Coopérer & Ajuster : Travailler en équipe pour tester des pistes, accepter de se tromper et ajuster sa stratégie en fonction des résultats."
    ],
    "takeaways": [],
    "is_provisional": false
   },
   {
    "number": 5,
    "title": "Autonomie et compétitivité",
    "summary": "Développer l'autonomie, le respect des délais et la compétitivité saine.",
    "objectives": [
     "Développer l'autonomie, le respect des délais et la compétitivité saine."
    ],
    "activities": [
     "Icebreaker — Jeu de l'Imposteur",
     "Débat thématique — Questions OUI / NON",
     "Supermarket Together — Mode autonomie",
     "Mario Kart — Compétition et pression"
    ],
    "key_notions": [
     "Auto-Organisation : Capacité à structurer son travail, gérer ses priorités et respecter les délais sans supervision constante.",
     "Polyvalence : Capacité à s'adapter à différents rôles et tâches selon les besoins de l'équipe et du contexte.",
     "Compétitivité saine : Se fixer des objectifs ambitieux et se dépasser tout en respectant les autres et en contribuant à la réussite collective."
    ],
    "takeaways": [],
    "is_provisional": false
   },
   {
    "number": 6,
    "title": "Thème à préciser",
    "summary": null,
    "objectives": [],
    "activities": [],
    "key_notions": [],
    "takeaways": [],
    "is_provisional": true
   }
  ]
 },
 "questionnaire": {
  "code": "auto_evaluation_initiale",
  "name": "Auto-évaluation initiale",
  "description": "Questionnaire proposé au participant à la création de son compte. Il sert de point de départ et n’est jamais modifié par les évaluations des formateurs.",
  "version": {
   "label": "Version 1 — reprise de l’ancien formulaire",
   "is_provisional": true,
   "intro": "Pour chaque affirmation, indiquez à quel point elle vous correspond aujourd’hui. Il n’y a ni bonne ni mauvaise réponse : cette auto-évaluation sert de point de départ.",
   "scale_min": 1,
   "scale_max": 5
  },
  "scale_labels": [
   {
    "value": 1,
    "label": "Pas du tout d'accord"
   },
   {
    "value": 2,
    "label": "Plutôt pas d'accord"
   },
   {
    "value": 3,
    "label": "Neutre"
   },
   {
    "value": 4,
    "label": "Plutôt d'accord"
   },
   {
    "value": 5,
    "label": "Tout à fait d'accord"
   }
  ],
  "questions": [
   {
    "position": 1,
    "text": "J'ai de bonnes relations avec les autres",
    "framework_code": "transversal",
    "skill_code": "relationnel"
   },
   {
    "position": 2,
    "text": "J'aime et je sais travailler en équipe",
    "framework_code": "transversal",
    "skill_code": "esprit_d_equipe"
   },
   {
    "position": 3,
    "text": "Je comprends facilement les consignes et les situations",
    "framework_code": "transversal",
    "skill_code": "comprehension"
   },
   {
    "position": 4,
    "text": "Je m'adapte facilement aux changements",
    "framework_code": "transversal",
    "skill_code": "adaptabilite"
   },
   {
    "position": 5,
    "text": "Je sais bien organiser et gérer mes priorités",
    "framework_code": "transversal",
    "skill_code": "gestion_des_priorites"
   },
   {
    "position": 6,
    "text": "Je gère bien mon stress en toutes circonstances",
    "framework_code": "transversal",
    "skill_code": "gestion_du_stress"
   },
   {
    "position": 7,
    "text": "Je suis capable de diriger, d'entraîner un groupe",
    "framework_code": "transversal",
    "skill_code": "leadership"
   },
   {
    "position": 8,
    "text": "Je propose régulièrement des idées et des solutions",
    "framework_code": "transversal",
    "skill_code": "force_de_proposition"
   },
   {
    "position": 9,
    "text": "Je suis organisé(e) et méthodique dans mon travail",
    "framework_code": "transversal",
    "skill_code": "organisation"
   },
   {
    "position": 10,
    "text": "Je suis pleinement impliqué(e) dans ce que je fais",
    "framework_code": "transversal",
    "skill_code": "implication"
   },
   {
    "position": 11,
    "text": "J'analyse bien les problèmes avant d'agir",
    "framework_code": "transversal",
    "skill_code": "analyse_des_problemes"
   },
   {
    "position": 12,
    "text": "Je suis curieux(se) et j'aime apprendre de nouvelles choses",
    "framework_code": "transversal",
    "skill_code": "curiosite"
   },
   {
    "position": 13,
    "text": "Je travaille de façon autonome sans avoir besoin d'être guidé(e)",
    "framework_code": "transversal",
    "skill_code": "autonomie"
   },
   {
    "position": 14,
    "text": "Je respecte les délais et les échéances qui me sont fixés",
    "framework_code": "transversal",
    "skill_code": "respect_des_delais"
   },
   {
    "position": 15,
    "text": "Je suis polyvalent(e) et capable de m'adapter à des tâches variées",
    "framework_code": "transversal",
    "skill_code": "polyvalence"
   }
  ]
 }
}$happi$::jsonb;
  v_fw jsonb;
  v_cat jsonb;
  v_skill jsonb;
  v_session jsonb;
  v_framework_id uuid;
  v_version_id uuid;
  v_category_id uuid;
  v_skill_id uuid;
  v_program_id uuid;
  v_questionnaire_id uuid;
  v_q_version_id uuid;
  v_cat_position int;
  v_skill_position int;
begin
  -- Référentiels
  for v_fw in select * from jsonb_array_elements(v_data -> 'frameworks') loop
    insert into public.frameworks (code, name, short_name, description, position)
    values (v_fw ->> 'code', v_fw ->> 'name', v_fw ->> 'short_name', v_fw ->> 'description', (v_fw ->> 'position')::int)
    returning id into v_framework_id;

    insert into public.framework_versions (framework_id, version_number, label, status, is_provisional, notes, scale_min, scale_max)
    values (v_framework_id, 1, v_fw #>> '{version,label}', 'draft', (v_fw #>> '{version,is_provisional}')::boolean,
            v_fw #>> '{version,notes}', (v_fw #>> '{version,scale_min}')::int, (v_fw #>> '{version,scale_max}')::int)
    returning id into v_version_id;

    insert into public.scale_levels (version_id, value, label, description)
    select v_version_id, (l ->> 'value')::int, l ->> 'label', l ->> 'description'
    from jsonb_array_elements(v_fw -> 'levels') l;

    v_cat_position := 0;
    v_skill_position := 0;
    for v_cat in select * from jsonb_array_elements(v_fw -> 'categories') loop
      v_cat_position := v_cat_position + 1;
      insert into public.skill_categories (version_id, code, name, description, position)
      values (v_version_id, v_cat ->> 'code', v_cat ->> 'name', v_cat ->> 'description', v_cat_position)
      returning id into v_category_id;

      for v_skill in select * from jsonb_array_elements(v_cat -> 'skills') loop
        v_skill_position := v_skill_position + 1;
        insert into public.skills (version_id, category_id, code, name, description, position)
        values (v_version_id, v_category_id, v_skill ->> 'code', v_skill ->> 'name', v_skill ->> 'description', v_skill_position)
        returning id into v_skill_id;

        insert into public.skill_level_descriptors (skill_id, level_value, description)
        select v_skill_id, (d ->> 'value')::int, d ->> 'description'
        from jsonb_array_elements(v_skill -> 'levels') d;

        insert into public.skill_criteria (skill_id, label, position)
        select v_skill_id, c.value ->> 'label', c.ordinality::int
        from jsonb_array_elements(v_skill -> 'criteria') with ordinality as c (value, ordinality);

        insert into public.session_skill_map (version_id, session_number, skill_id)
        select v_version_id, n::int, v_skill_id
        from jsonb_array_elements_text(v_skill -> 'sessions') n;
      end loop;
    end loop;

    update public.framework_versions set status = 'published' where id = v_version_id;
  end loop;

  -- Programme et trame des 6 sessions
  insert into public.programs (name, description, sessions_count, session_duration_minutes, min_group_size, max_group_size, status, is_public)
  values (v_data #>> '{program,name}', v_data #>> '{program,description}', 6, 180, 4, 8, 'active', true)
  returning id into v_program_id;

  for v_session in select * from jsonb_array_elements(v_data #> '{program,sessions}') loop
    insert into public.program_sessions (program_id, number, title, summary, objectives, activities, key_notions, takeaways, is_provisional)
    values (
      v_program_id, (v_session ->> 'number')::int, v_session ->> 'title', v_session ->> 'summary',
      array(select jsonb_array_elements_text(v_session -> 'objectives')),
      array(select jsonb_array_elements_text(v_session -> 'activities')),
      array(select jsonb_array_elements_text(v_session -> 'key_notions')),
      array(select jsonb_array_elements_text(v_session -> 'takeaways')),
      (v_session ->> 'is_provisional')::boolean
    );
  end loop;

  insert into public.program_frameworks (program_id, framework_id, framework_version_id)
  select v_program_id, v.framework_id, v.id from public.framework_versions v where v.status = 'published';

  -- Questionnaire d'auto-évaluation initiale
  insert into public.questionnaires (code, name, description)
  values (v_data #>> '{questionnaire,code}', v_data #>> '{questionnaire,name}', v_data #>> '{questionnaire,description}')
  returning id into v_questionnaire_id;

  insert into public.questionnaire_versions (questionnaire_id, version_number, label, status, is_provisional, intro, scale_min, scale_max)
  values (v_questionnaire_id, 1, v_data #>> '{questionnaire,version,label}', 'draft',
          (v_data #>> '{questionnaire,version,is_provisional}')::boolean, v_data #>> '{questionnaire,version,intro}',
          (v_data #>> '{questionnaire,version,scale_min}')::int, (v_data #>> '{questionnaire,version,scale_max}')::int)
  returning id into v_q_version_id;

  insert into public.questionnaire_scale_labels (version_id, value, label)
  select v_q_version_id, (l ->> 'value')::int, l ->> 'label'
  from jsonb_array_elements(v_data #> '{questionnaire,scale_labels}') l;

  insert into public.questionnaire_questions (version_id, position, text, framework_code, skill_code)
  select v_q_version_id, (q ->> 'position')::int, q ->> 'text', q ->> 'framework_code', q ->> 'skill_code'
  from jsonb_array_elements(v_data #> '{questionnaire,questions}') q;

  update public.questionnaire_versions set status = 'published' where id = v_q_version_id;
end
$seed$;
