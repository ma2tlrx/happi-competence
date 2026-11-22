-- Propositions de correspondance HAPPI ↔ ROME 4.0 (savoir-être professionnels, version 26M10).
-- Toutes en statut « proposée » : un administrateur identifié les examine et les valide dans l'interface
-- (Administration › Référentiels › Correspondances). Aucune n'est visible des participants avant validation.
-- Chaque justification s'appuie sur les critères et descripteurs HAPPI et sur la définition ROME du fichier.
-- Aucun barème, niveau ou score n'est touché. Rejouable : ignore ce qui existe déjà.
insert into public.skill_mappings (framework_id, skill_code, external_skill_id, link_type, origin, justification)
select f.id, v.skill_code, es.id, v.link_type, 'manual', v.justification
from (values
('transversal','relationnel','6D101','close','Les critères HAPPI « écoute active » et « empathie » recoupent la définition ROME (écouter activement, faire preuve d''ouverture d''esprit et de diplomatie) ; HAPPI y ajoute la clarté de communication et la gestion des conflits.'),
('transversal','esprit_d_equipe','6D102','equivalent','Même compétence : collaboration, engagement collectif et soutien aux autres (HAPPI) ↔ travailler et se coordonner avec les autres pour réaliser les objectifs (ROME).'),
('transversal','adaptabilite','6D113','close','Réactivité face aux imprévus, ouverture au changement et flexibilité (HAPPI) ↔ s''adapter à des situations variées et gérer l''incertitude (ROME).'),
('transversal','adaptabilite','6D111','partial','Seul le critère HAPPI « réactivité face aux imprévus » recoupe la réactivité ROME (réagir rapidement en hiérarchisant les actions).'),
('transversal','gestion_des_priorites','6D107','close','Identifier les tâches essentielles, planifier, respecter les échéances (HAPPI) ↔ planifier, prioriser, anticiper selon moyens, objectifs et calendrier (ROME).'),
('transversal','gestion_du_stress','6D112','close','Maîtrise émotionnelle et efficacité sous pression (HAPPI) ↔ garder le contrôle de soi face aux situations irritantes, imprévues, stressantes (ROME).'),
('transversal','leadership','6D106','equivalent','Même compétence : fédérer et orienter le groupe vers les objectifs (HAPPI) ↔ mobiliser une équipe dans la poursuite d''un objectif partagé (ROME).'),
('transversal','leadership','6D105','partial','Le critère HAPPI « vision et inspiration » recoupe « inspirer, donner du sens » (ROME) ; les autres critères (décision, délégation) n''y figurent pas.'),
('transversal','force_de_proposition','6D103','equivalent','Même compétence : initiative, pertinence des suggestions (HAPPI) ↔ initier des propositions nouvelles, être proactif (ROME).'),
('transversal','force_de_proposition','6D115','partial','Le critère HAPPI « créativité » recoupe la créativité ROME ; la compétence HAPPI est plus large (argumentation, initiative).'),
('transversal','organisation','6D107','close','Gestion du temps, planification et anticipation des besoins (HAPPI) ↔ planifier, prioriser, anticiper (ROME) ; HAPPI ajoute le rangement et la gestion des outils.'),
('transversal','implication','6D109','partial','Le critère HAPPI « persévérance » (aller au bout des tâches) recoupe la persévérance ROME ; l''implication couvre aussi la motivation.'),
('transversal','implication','6D108','partial','Le critère HAPPI « autonomie dans le travail » recoupe l''autonomie ROME.'),
('transversal','curiosite','6D114','equivalent','Même compétence : ouverture aux connaissances, exploration, questionnement (HAPPI) ↔ aller au-delà de ce qui est donné à voir, s''ouvrir à la nouveauté (ROME).'),
('transversal','autonomie','6D108','equivalent','Même compétence : travailler sans supervision, savoir quand solliciter de l''aide (HAPPI) ↔ prendre en charge son activité sans être encadré en continu, solliciter les autres si besoin (ROME).'),
('transversal','respect_des_delais','6D107','partial','Les critères HAPPI « planification » et « anticipation des retards » recoupent la planification ROME ; le respect des délais lui-même n''est pas nommé dans la définition ROME.'),
('transversal','polyvalence','6D113','partial','Adaptabilité aux différents contextes et résilience face aux changements de mission (HAPPI) recoupent s''adapter à des situations variées (ROME) ; la polyvalence y ajoute la variété des compétences.'),
('transversal','respect_des_consignes','6D110','close','Suivre les consignes avec rigueur (HAPPI) ↔ suivre avec exactitude les règles, procédures et instructions fournies (ROME).'),
('transversal','professionnalisme','6D110','partial','Retards, tenue et langage (HAPPI) recoupent « se montrer ponctuel et respectueux des règles de savoir-vivre » (fin de la définition ROME).'),
('transversal','rigueur','6D110','close','Travail précis et soigné, vérification avant de rendre (HAPPI) ↔ réaliser des tâches sans erreur, avec exactitude et précision (ROME).'),
('sociocognitive','auto_regulation','6D112','close','Ajuster ses émotions et comportements pour atteindre un objectif (HAPPI) ↔ garder le contrôle de soi pour agir efficacement (ROME).'),
('sociocognitive','auto_organisation','6D107','close','Structurer ses ressources pour conduire ses activités (HAPPI) ↔ planifier et prioriser selon moyens et objectifs (ROME).'),
('sociocognitive','auto_organisation','6D108','partial','L''auto-organisation « par soi-même » rejoint l''autonomie ROME (prendre en charge son activité) sans la couvrir entièrement.'),
('sociocognitive','auto_mobilisation','6D109','close','Se mettre en action et persévérer (HAPPI) ↔ maintenir son effort jusqu''à l''achèvement malgré les obstacles (ROME).'),
('sociocognitive','sensibilite_sociale','6D101','close','Percevoir et analyser les émotions et attentes des autres (HAPPI) ↔ être à l''écoute et faire preuve d''empathie (ROME).'),
('sociocognitive','adaptation_relationnelle','6D113','partial','Ajuster ses expressions et paroles selon la situation sociale (HAPPI) recoupe en partie s''adapter à des situations variées (ROME), limité ici au registre relationnel.'),
('sociocognitive','cooperation','6D102','close','Contribuer à une action collective (HAPPI) ↔ travailler et se coordonner avec les autres pour réaliser les objectifs (ROME).'),
('sociocognitive','planification','6D107','close','Organiser dans le temps une succession d''activités selon ressources et contraintes (HAPPI) ↔ planifier, prioriser, anticiper selon moyens, objectifs et calendrier (ROME).'),
('sociocognitive','flexibilite_mentale','6D115','partial','Générer des idées et usages alternatifs (HAPPI) recoupe la créativité, inventivité ROME (imaginer du nouveau) sans l''égaler.'),
('sociocognitive','flexibilite_mentale','6D113','partial','Changer de stratégie, produire des alternatives (HAPPI) recoupe en partie l''ouverture aux changements ROME.')
) as v(framework_code, skill_code, rome_code, link_type, justification)
join public.frameworks f on f.code = v.framework_code
join public.external_frameworks ef on ef.code = 'rome_savoir_etre'
join public.external_skills es on es.framework_id = ef.id and es.code = v.rome_code
on conflict (framework_id, skill_code, external_skill_id) do nothing;
