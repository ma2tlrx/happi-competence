# HAPPI Compétence — Audit produit (direction produit, 11/11/2026)

Sources lues : README.md, docs/architecture.md, docs/bilans.md, docs/audit-production.md, supabase/migrations/*.sql (49 tables), src/app/**/page.tsx (58 écrans), src/components/app/nav-config.ts. Application locale non démarrée (port 3000 fermé) : constat sur code et schéma.

Légende : Prio = indispensable (I) / différenciant (D) / confort (C) ; Effort S (< 2 sem.), M (2-6 sem.), L (> 6 sem.).

## 1. Ce que fait réellement l'application

### Socle transverse (présent)
- 4 espaces + site vitrine (catalogue public des programmes, contact).
- Sécurité de haut niveau : RLS sur toutes les tables, codes d'accès hachés à usage unique, journal d'audit en ajout seul, évaluations validées amendables seulement avec motif tracé, export RGPD et suppression de compte.
- Référentiels versionnés et figés (échelle, niveaux, descripteurs de niveau, critères observables pondérés, correspondance session-compétences, modes de notation direct / nombre de critères / moyenne pondérée, agrégation latest/mean/weighted/max). Photographie du référentiel à la validation.
- Responsive mobile vérifié (390/820 px), audit axe-core et clavier fait, interface en français uniquement (`lang="fr"`).
- Notifications : centre in-app uniquement (`/notifications`), alimenté par très peu d'événements (statut d'organisme, demandes d'organisme, contact et suppression RGPD pour les admins). Aucun e-mail applicatif ; e-mails d'authentification Supabase sans SMTP configuré (limite 2/h, P1 production).

### Participant
Présent : inscription libre (ou réclamation d'une fiche créée par le formateur), mot de passe oublié ; auto-évaluation initiale (questionnaire versionné) ; passeport avec radars CT 1-5 et HBS 1-4 comparés au déclaratif de départ ; parcours par session avec journal « ce que j'ai appris » ; bilan validé téléchargeable ; export PDF du passeport ; profil, export de ses données.
Absent : onboarding guidé (consentements, objectifs, projet pro) ; agenda personnel / ICS / rappels ; émargement en ligne ; auto-évaluation intermédiaire et finale (prévues dans le schéma `self_assessments.kind`, non exposées : seule `initial` est utilisée) ; mesure d'évolution avant/après ; lien de partage du passeport ; badges ; CV de compétences ; export Europass ; messagerie ; enquête de satisfaction ; suivi à 3/6 mois ; FALC, audio, multilingue ; aide en ligne ; PWA.

### Formateur
Présent : tableau de bord (groupes, sessions à venir/réalisées, évaluations à compléter) ; groupes (taille min/max, ajout d'un inscrit ou création de fiche) ; planification des 6 sessions (date, horaires, lieu, statut) ; présences 5 statuts avec historique ; feuille de présence PDF avec colonne signature papier et CSV ; grille d'évaluation par session avec descripteurs, critères, commentaires observation / conseil / privé, brouillon auto-enregistré, validation, correction tracée ; lecteur pédagogique plein écran (supports Markdown versionnés, état de progression, notes) ; bilans PDF rédigés par IA (OpenRouter/Claude), contrôlés (pas de note chiffrée, constats rattachés à une session), relus, validés, versionnés.
Absent : émargement électronique ; un seul évaluateur par participant et par session (contrainte `unique (session_id, participant_id)` sur `evaluations`) donc pas de multi-évaluateurs ni de calibration ; pas de preuves photo/vidéo/audio (aucun stockage de fichiers) ; pas de prise de notes rapide en séance / hors-ligne ; pas de télémétrie de jeu (assumé dans docs/bilans.md) ; IA limitée à la rédaction du bilan (pas de suggestion d'observation ni de synthèse de groupe) ; pas d'envoi de convocations ; pas de messagerie avec participants/prescripteurs.

### Organisme / prescripteur
Présent : demande de compte validée par l'admin ou code ; espace en lecture seule : tableau de bord (programmes, participants, sessions réalisées/à venir, taux de présence), programmes, sessions, présences, fiches participants, bilans validés téléchargeables si permission `org.exports`, export CSV participants (sans filtres). Types prévus : Mission Locale, France Travail, école, OF, SIAE, entreprise.
Absent : prescription en ligne (orienter un jeune, file d'attente, places disponibles) ; indicateurs d'impact (progression, sorties positives, assiduité par cohorte) ; rapports automatiques ; suivi post-programme ; conventions, devis, factures ; intégration i-milo / France Travail ; SSO ; alertes (absence, décrochage).

### Administrateur / direction HAPPI
Présent : utilisateurs, rôles et permissions fines, organismes, formateurs, participants, codes d'accès, programmes paramétrables (nombre et durée des sessions, taille de groupe), groupes, sessions, référentiels et questionnaire versionnés, supports pédagogiques, paramètres (mentions légales), environnement de démonstration, journal d'activité lisible ; tableau de bord de comptages (participants, organismes, formateurs, groupes, sessions, présence, évaluations validées).
Absent : pilotage business (CA, pipeline, remplissage des groupes, coût par participant) ; indicateurs qualité (Qualiopi : satisfaction, abandons, réclamations) ; devis / conventions / facturation ; multi-tenant réel (des OF licenciés qui opèrent leurs propres formateurs et programmes) et marque blanche ; API, webhooks, SSO ; calibration des formateurs ; gestion des consentements image ; centre d'aide / support.

### Employeur / recruteur (absent)
Aucun espace, aucun rôle (le type d'organisme « entreprise » n'ouvre qu'une vue prescripteur). Manque : consultation d'un passeport partagé par le candidat (lien vérifiable), vérification d'authenticité (badge signé / QR), viviers de candidats consentants, offres de stage/immersion (PMSMP), retour employeur après immersion, parrainage.

## 2. Manques détaillés (description · valeur · prio · effort · dépendances)

| # | Manque | Valeur pour | Prio | Effort | Dépendances |
|---|---|---|---|---|---|
| 1 | E-mails transactionnels (SMTP) + rappels de session J-2/J-1 par e-mail et SMS, convocations, fichier ICS | participant (assiduité), formateur, organisme | I | S-M | prestataire (Brevo/Mailjet), consentement SMS, file de tâches planifiées (cron Supabase) |
| 2 | Émargement électronique par séance (signature tactile ou code/QR, horodatage, géolocalisation optionnelle, double signature formateur), feuille certifiée pour financeurs | organisme, HAPPI (preuve Qualiopi, OPCO, France Travail) | I | M | stockage de fichiers, journal existant ; la feuille PDF actuelle n'a qu'une colonne signature papier |
| 3 | Auto-évaluation intermédiaire et finale + écran d'évolution avant/après (déclaré initial, observé, déclaré final) | participant, organisme, financeur | I | S-M | schéma déjà prêt (`kind`), questionnaire versionné ; reprise dans bilan et passeport |
| 4 | Pilotage d'impact : tableau de bord par cohorte/organisme/période (assiduité, abandons, progression par compétence, sorties positives), exports filtrés, rapport PDF automatique trimestriel | organisme, financeurs, direction HAPPI | I | M-L | 3, 5 ; entrepôt de vues SQL agrégées |
| 5 | Suivi post-programme : statut de sortie, enquêtes à 3 et 6 mois (emploi, formation, alternance), satisfaction à chaud/froid (NPS) | financeurs, Qualiopi, marketing HAPPI | I | M | 1 (envoi d'enquêtes), consentement |
| 6 | Prescription et inscription en ligne : fiche d'orientation par le prescripteur, file d'attente, remplissage des groupes, onboarding guidé du participant (consentements, droit à l'image, objectifs) | organisme, HAPPI ops | I | M | 1 ; l'organisme est aujourd'hui en lecture seule |
| 7 | Multi-tenant OF + marque blanche (logo, couleurs, domaine, programmes et formateurs propres, isolation par client) | business HAPPI (licences), OF clients | I (scale) | L | refonte RLS par tenant, facturation (13) |
| 8 | Passeport partageable par lien (expirable, révocable, journalisé, consentement) + vue employeur publique vérifiable | participant, employeur | D | M | — ; base pour 9 et 15 |
| 9 | Open Badges 3.0 / European Digital Credentials (Europass), CV de compétences généré | participant, employeur, financeur (reconnaissance) | D | M-L | 8, validation du référentiel CT (encore provisoire) |
| 10 | Multi-évaluateurs et calibration inter-évaluateurs (double cotation, écarts, accord inter-juges, sessions d'étalonnage sur cas vidéo) | crédibilité méthodo, direction pédagogique | D | M-L | lever la contrainte d'unicité sur `evaluations`, règle d'agrégation, 11 |
| 11 | Preuves d'observation (photo, vidéo courte, audio, captures de jeu) et saisie rapide en séance sur tablette, PWA hors-ligne | formateur | D | M-L | Supabase Storage, consentement image, purge RGPD |
| 12 | IA d'assistance : transformation de notes dictées en observations rattachées aux critères, détection d'incohérences, synthèse de groupe, aide FALC | formateur, participant | D | M | 11, sous-traitance hors UE à contractualiser (DPA) |
| 13 | Devis, conventions, facturation par groupe/participant, signature électronique des conventions | direction HAPPI, organismes | I (ops) | M-L | intégration outil de gestion (Pennylane, Dendreo/Digiforma) ou module natif |
| 14 | Intégrations : API REST + webhooks, SSO (ProConnect, Microsoft Entra), export i-milo / France Travail, connecteurs logiciels OF | Missions Locales, France Travail, grands comptes | I (grands comptes) | L | 7, conventions d'échange de données |
| 15 | Télémétrie des jeux (temps, réussites, coopération) pour objectiver les observations | différenciation scientifique, bilans | D | L | partenariats éditeurs ou jeux maison, protocole de validation |
| 16 | Messagerie formateur-participant-prescripteur, alertes de décrochage | tous | C | M | 1 |
| 17 | Accessibilité étendue : FALC, lecture audio, multilingue (anglais, arabe, ukrainien…) | participants peu lecteurs / allophones | D | M | extraction des textes (i18n), validation des contenus |
| 18 | Aide en ligne, guides par rôle, chat support, statut de service | tous | C | S | — |
| 19 | Espace employeur (viviers consentants, immersions PMSMP, retour employeur) | employeur, participant | D | L | 8, 9 |

## 3. Top 15 par impact business
1. E-mails + rappels SMS/e-mail (1)
2. Émargement électronique probant (2)
3. Auto-évaluation finale et mesure avant/après (3)
4. Tableaux de bord d'impact et rapports financeurs (4)
5. Suivi post-programme et satisfaction (5)
6. Prescription en ligne et onboarding (6)
7. Passeport partageable par lien vérifiable (8)
8. Devis, conventions, facturation (13)
9. Multi-tenant et marque blanche (7)
10. Badges numériques, Europass, CV de compétences (9)
11. Intégrations API / SSO / i-milo (14)
12. Multi-évaluateurs et calibration (10)
13. Preuves multimédia et mode séance hors-ligne (11)
14. IA d'assistance à l'observation (12)
15. FALC, multilingue et aide en ligne (17 + 18)
Ensuite : télémétrie de jeu (15), espace employeur complet (19), messagerie (16).

## 4. Déjà présent : à ne pas recommander
Versionnement des référentiels et critères observables pondérés ; descripteurs de niveau ; brouillon auto-enregistré ; validation et correction tracée ; commentaires privés/partagés ; bilans IA relus, versionnés, figés ; export PDF passeport et bilans ; feuilles de présence PDF/CSV ; plusieurs programmes et plusieurs formateurs par groupe (`group_trainers`) ; permissions fines par rôle ; journal d'audit immuable ; RGPD (export, suppression) ; responsive mobile ; démonstration ; lecteur pédagogique ; comparaison déclaré initial / observé.
