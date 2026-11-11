# HAPPI Compétence — Conformité, financements, reconnaissance, modèle économique

*Note de consultant, 11 novembre 2026. Recherches web (moteur de recherche uniquement : la lecture directe des pages était bloquée par le réseau de la session, donc les textes officiels — Légifrance, EUR-Lex — n'ont pas été relus en entier). Lecture du dépôt : `docs/architecture.md`, `docs/audit-production.md`, `docs/bilans.md`, pages `src/app/(public)/mentions-legales`, `confidentialite`, `conditions-utilisation`.*

Légende : **[OBL]** obligatoire · **[ATT]** fortement attendu par les acheteurs/financeurs · **[OPP]** opportunité · **[JUR]** à faire valider par un juriste · **[INC]** incertain.

---

## 0. Constat sur l'application (état du dépôt)

Ce qui existe et constitue déjà des preuves :
- **Présences** : statuts `present / absent / late / left_early / excused`, historique (`attendance_history`), feuilles de présence PDF avec colonne « Signature » (signature **papier**) et export CSV.
- **Positionnement / évaluation** : questionnaire d'auto-évaluation initial ; évaluations par formateur sur référentiels versionnés et figés ; correction tracée avec motif (`evaluation_history`) ; bilans PDF versionnés et immuables.
- **Traçabilité** : `audit_logs` en ajout seul (connexions, exports, consultations de fiche, modifications).
- **RGPD** : RLS sur toutes les tables, export « mes données », demande de suppression (`data_requests`), politique de confidentialité, durée de conservation affichée (36 mois après l'accompagnement), IA alimentée sans nom ni structure.

Ce qui manque (détaillé plus bas) : satisfaction, réclamations, émargement électronique horodaté et signé, motif et suivi des abandons, situation à l'entrée/sortie et suivi à 3–6 mois, analyse du besoin, registre des intervenants et de la veille, tableau d'indicateurs exportable par financeur. Côté légal : mentions légales « à compléter », base légale « consentement » discutable, sous-traitant IA hors UE non mentionné dans la politique, pas de DPA signé (cf. `audit-production.md` §D), pas de déclaration d'accessibilité.

---

## 1. Qualiopi

### 1.1 Cadre
- Référentiel national qualité (RNQ) : **7 critères**, **32 indicateurs** jusqu'au 31 octobre 2026 ; guide de lecture V9 (8 janvier 2024). Source : [AFNOR, guide de lecture V9](https://www.afnor.org/wp-content/uploads/2024/01/Guide_de_lecture_qualiopi_v9_du_8_janvier_2024.pdf).
- **Depuis le 1er novembre 2026** : décret n° 2026-728 du 1er août 2026 (JO du 4 août 2026) → **33 indicateurs** (le 33e propre aux CFA), 7 critères inchangés, une douzaine d'indicateurs réécrits (sources secondaires citant 1, 2, 3, 7, 12, 14, 15, 19, 20, 27, 30, 32), arrêtés à venir fixant des seuils pour certains indicateurs. **[INC]** Le texte exact n'a pas été relu sur Légifrance ; le guide de lecture V10 n'était pas confirmé. Sources : [Digi-Certif](https://www.digi-certif.com/decret-2026-728-referentiel-qualiopi/), [CapCertification](https://capcertification.com/decret-qualiopi-2026-le-referentiel-passe-a-33-indicateurs-au-1er-novembre/), [Mentivis](https://mentivis.com/fr/insights/decret-2026-728-nouveau-referentiel-qualiopi/), [BCI France](https://bcifrance.fr/actualites/qualiopi-v10-calendrier-decret-2026-728).
- **Quand est-ce obligatoire ?** **[OBL]** pour tout prestataire d'« actions concourant au développement des compétences » (formation, bilan de compétences, VAE, apprentissage) financées par des fonds publics ou mutualisés (OPCO, CPF, Région, France Travail, Agefiph…) — art. L.6316-1 du Code du travail. Data-Dock ne suffit plus depuis 2022 ([CSE Guide](https://www.cse-guide.fr/blog/certification-datadock/)). **[JUR]** Une prestation d'*accompagnement vers l'emploi* achetée par marché public (France Travail, Mission Locale) n'est pas juridiquement une action de formation : Qualiopi n'y est pas exigé par la loi mais est très souvent demandé dans les critères de sélection → **[ATT]**. Si HAPPI vend de la **formation** (OPCO, CPF, AIF, Région) : déclaration d'activité (NDA), bilan pédagogique et financier annuel et Qualiopi sont **[OBL]**.

### 1.2 Correspondance critères / indicateurs ↔ application
(Numérotation 2019 ; vérifier les reformulations 2026.)

| Critère | Indicateurs | Preuve attendue | Ce que l'appli fait | Manque / à développer |
|---|---|---|---|---|
| 1. Information du public | 1–3 | Information sur prestations, délais, tarifs, accessibilité ; **indicateurs de résultats** publiés (satisfaction, assiduité, sorties) | Site vitrine, programme | **Calcul et publication automatiques d'indicateurs de résultats** (taux d'assiduité, de complétion, de satisfaction, de sorties positives) sur la page publique, datés et avec effectif |
| 2. Objectifs et adaptation | 4–8 | Analyse du besoin du bénéficiaire et du prescripteur ; objectifs opérationnels ; **positionnement à l'entrée** | Auto-évaluation initiale (= positionnement) ; référentiels liés aux sessions | **Fiche d'analyse du besoin / prescription** (prescripteur, attentes, freins, besoins d'adaptation) ; objectifs individualisés |
| 3. Accompagnement et évaluation | 9–16 | Conditions de déroulement communiquées ; adaptation ; **évaluation de l'atteinte des objectifs** (11) ; **prévention des abandons** (12) ; coordination des acteurs (13) | Évaluations par session, bilans, passeport, présences | **Module abandons** : motif normalisé, date, relance, alerte après N absences ; **comparaison entrée/sortie** des niveaux (preuve 11) ; livret d'accueil / convocation générés ; notes de coordination avec le conseiller référent |
| 4. Moyens | 17–20 | Moyens humains et techniques ; ressources pédagogiques ; référent handicap ; *(seuils numériques possibles sur 19–20 en 2026 [INC])* | Supports pédagogiques versionnés, lecteur | Champ « besoins d'adaptation » (sans détail médical), référent handicap identifié ; inventaire du matériel |
| 5. Compétences des intervenants | 21–22 | Qualification et formation continue des formateurs | Rôle formateur, code d'accès | **Registre des intervenants** : CV, certification « formateur HAPPI », formations suivies, dates d'échéance |
| 6. Environnement | 23–29 | **Veille** légale, métiers, pédagogique, handicap ; sous-traitance ; partenaires | — | **Journal de veille** (date, source, impact, action) ; liste des partenaires/prescripteurs ; contrats de sous-traitance (essaimage) |
| 7. Amélioration continue | 30–32 | **Recueil des appréciations** (bénéficiaires, financeurs, formateurs) ; **réclamations** ; plan d'amélioration | — | **Questionnaires de satisfaction** à chaud (fin S6) et à froid (3 mois), aussi côté prescripteur ; **registre des réclamations** (réception, analyse, réponse, délai) ; **registre des actions d'amélioration** reliant satisfaction/réclamations/abandons |

**Priorité appli** : (1) satisfaction à chaud/froid, (2) réclamations, (3) abandons avec motifs, (4) tableau d'indicateurs publiable, (5) veille et registre des intervenants. Ces modules sont aussi vendables aux OF partenaires (argument de la licence SaaS).

---

## 2. Financements et exigences documentaires

| Financeur | Voie d'accès | Exigences documentaires | Impact logiciel |
|---|---|---|---|
| **France Travail** — prestations d'accompagnement | Marchés publics (accords-cadres, un titulaire par lot ; prix unitaire par bénéficiaire, ex. Activ'Créa Émergence plafond 535 €, autre lot 521 €) ([BOAMP 25-87457](https://www.boamp.fr/telechargements/FILES/PDF/2025/08/25-87457.pdf), [BOAMP 25-91702](https://www.boamp.fr/telechargements/FILES/PDF/2025/08/25-91702.pdf)) | Selon CCTP : attestations de présence, compte-rendu individuel/bilan de fin de prestation, saisie dans les outils de France Travail, délais d'entrée, facturation Chorus Pro | Bilan individuel PDF ✓ ; ajouter **export au format du CCTP** (identifiant France Travail du bénéficiaire, dates d'entrée/sortie, résultat) **[INC : à lire dans chaque DCE]** |
| **France Travail** — formation (AIF, achats de formation) | KAIROS ; Qualiopi | **Feuilles d'émargement ou état de présence émargé** joints à la facture ; Chorus Pro ([kit facturation OF, avril 2026](https://actuformation.francetravail.org/wp-content/uploads/2026/04/kit-facturation-of-ft-avril-2026-ok.pdf)) | Émargement par demi-journée, signatures stagiaire + formateur |
| **Missions Locales** (PACEA, CEJ) | Achat sur budget propre (convention pluriannuelle État 2025-2027), commande publique selon montant ; le conseiller reste référent ([circulaire CEJ](https://occitanie.dreets.gouv.fr/sites/occitanie.dreets.gouv.fr/IMG/pdf/circulairecej_45292.pdf), [instruction 2025](https://www.associatheque.fr/fr/fichiers/actualite/instruction-NOR-TSSD2520236J.pdf)) | Présences (le CEJ exige 15–20 h d'activité hebdomadaire justifiables), compte-rendu au conseiller, situation à la sortie | **Export des heures réalisées par jeune et par semaine** (pour justifier l'activité CEJ) ; partage du bilan au conseiller ✓ ; champ « identifiant i-milo » **[INC]** |
| **PIC / PRIC 2024-2027** | Appels à projets État-Région (remobilisation, savoirs de base, sécurisation des parcours) ; financements en baisse en 2026 ([Centre Inffo](https://www.centre-inffo.fr/site-regions-formation/en-cours-dans-les-regions/pactes-regionaux-dinvestissement-dans-les-competences-2024-2027), [AAP PRIC PACA](https://paca.dreets.gouv.fr/sites/paca.dreets.gouv.fr/IMG/pdf/2025_03_aap_pric_2025-2027_version_publication_vf.pdf)) | Bilans d'exécution, publics cibles (peu qualifiés, QPV…), sorties | Données sociodémographiques à l'entrée (niveau de diplôme, QPV) → minimisation à arbitrer |
| **Région** (programme régional de formation, chèques) | Marchés / habilitation de service public ; Qualiopi | Émargement, attestations de fin, enquêtes de sortie, référencement de l'offre au Carif-Oref | Export d'offre (format LHÉO) **[OPP]** |
| **OPCO** | Fonds mutualisés (entreprises < 50 salariés, alternance, PDC) → Qualiopi | Convention, programme, émargement, attestation d'assiduité / certificat de réalisation, évaluation | Génération automatique **certificat de réalisation** + attestation de fin |
| **CPF** | Uniquement certifications RNCP/RS + Qualiopi + EDOF | Cf. §3 | — |
| **FSE+** 2021-2027 | AAP DREETS / départements (souvent pour IAE, inclusion) | **Données participants (indicateurs communs)** à l'entrée et à la sortie, ventilées par genre ; justificatifs d'éligibilité conservés ; **feuilles d'émargement des participants et du formateur** ; saisie dans *Ma Démarche FSE+* ([indicateurs communs FSE+](https://dechets-economiecirculaire.paysdelaloire.fr/sites/default/files/2022-11/Liste%20Indicateurs%20communs%20participants%20FSE%2B%2021-27%20VD.pdf), [questionnaire participant DREETS HdF](https://hauts-de-france.dreets.gouv.fr/sites/hauts-de-france.dreets.gouv.fr/IMG/pdf/questionnaire_participant_fse_.pdf), [guide demande de paiement Bretagne](https://bretagne.dreets.gouv.fr/sites/bretagne.dreets.gouv.fr/IMG/pdf/support_formation_demande_de_paiement_fse__.pdf)) | **Module « questionnaire participant FSE+ »** (entrée/sortie/6 mois) avec **import Excel** compatible Ma Démarche FSE+ ; conservation des pièces longue durée (archivage) **[JUR : durée de conservation FSE+ vs 36 mois de la politique actuelle]** |
| **IAE** (ACI, EI, ETTI) | Achat par la SIAE (aide au poste, FDI, FSE+) | La SIAE doit rendre compte des « sorties dynamiques » (emploi durable, de transition, sorties positives) | Champs de sortie et de suivi alignés sur ces catégories |

### Ce que cela impose au logiciel (synthèse)
1. **Émargement électronique probant** **[ATT]** : par demi-journée, signature du participant et du formateur, horodatage serveur, géolocalisation ou code de session facultatif, scellement (empreinte) du PDF, piste d'audit. L'émargement électronique est admis par les financeurs à condition de garantir identité, intégrité et datation **[JUR : vérifier pour chaque financeur ; certains exigent encore le papier]**. Le signature électronique « simple » (eIDAS) suffit en général.
2. **Données d'entrée/sortie** (situation, prescripteur, date d'entrée/sortie, motif, situation à 3 et 6 mois).
3. **Tableaux d'indicateurs exportables** (CSV/Excel) par financeur, par période, par action.
4. **Documents automatiques** : convocation, attestation de présence/assiduité, certificat de réalisation, attestation de fin, bilan.
5. **Archivage** des preuves sur la durée imposée par le financeur (FSE+ : plusieurs années après la clôture du programme **[INC]**).

---

## 3. Reconnaissance et crédibilité

- **Répertoire spécifique (RS)** **[OPP, long terme]** : enregistre des certifications de compétences complémentaires, dont une catégorie « compétences transversales » ; enregistrement 5 ans maximum. Le **décret n° 2025-500 du 6 juin 2025** (applicable au 1er octobre 2025) a durci les critères (R.6113-11 ; refus sans examen possible ; données d'insertion des titulaires exigées). Le parc RS a été réduit de près de moitié. Sources : [Centre Inffo, fiche 19-14](https://www.centre-inffo.fr/fiche/criteres-denregistrement-sur-demande-dune-certification-au-rs-2), [JO 8 juin 2025](https://www.francecompetences.fr/app/uploads/2025/09/joe_20250608_0133_0010.pdf), [Notice RS 2024](https://francecompetences.fr/app/uploads/2024/09/Notice_aide_RS_092024.pdf), [vademecum France compétences janv. 2026](https://www.francecompetences.fr/app/uploads/2026/01/CP_Publication-vademecum-21-janvier-2026-VF.pdf). En pratique il faut : un référentiel de compétences **et** un référentiel d'évaluation distincts, des modalités d'évaluation certificatives (pas seulement formatives), un jury, **au moins deux promotions de titulaires** avec données (usage commun, à vérifier dans le vademecum **[INC]**), la preuve de l'usage par le marché du travail. **18 h de jeu évaluées par le seul formateur ne suffisent pas** : il faudra une épreuve certificative standardisée. Le RNCP (métier) n'est pas pertinent.
  → Impact appli : séparer évaluation formative et **épreuve certificative**, jury, PV, numéro de certification, suivi des titulaires (insertion à 6 mois).
- **Norme AFNOR XP X50-766** (janvier 2025) : norme **expérimentale**, 25 habiletés socio-cognitives, terminologie et usages ; « ni un test clé en main » ; révision possible vers une NF après 3 ans ; deux normes complémentaires (évaluer, développer) envisagées. Sources : [AFNOR boutique](https://www.boutique.afnor.org/en-gb/standard/xp-x50766/education-learning-services-and-competence-soft-skills-classification-termi/fa206742/430521), [Centre Inffo](https://www.centre-inffo.fr/site-centre-inffo/lafnor-publie-une-norme-experimentale-sur-les-habiletes-socio-cognitives). **Attention de communication** : on peut dire « référentiel aligné sur la terminologie de la norme XP X50-766 », pas « certifié AFNOR ». Il n'existe pas de certification de conformité à cette norme à ma connaissance **[INC]**.
- **Validation scientifique du référentiel** **[ATT pour la crédibilité, OPP pour se différencier]** : le dépôt indique un référentiel transversal « provisoire » et une session 6 « à préciser » (`audit-production.md` §D). Recommandation : partenariat avec un laboratoire (psychologie, sciences de l'éducation, game studies) pour la validité de contenu (accord inter-juges entre formateurs, fidélité test-retest), étude pré/post sur 100+ participants. L'appli doit permettre **la double cotation** (deux formateurs, mesure d'accord) et l'**export anonymisé** pour la recherche (base légale et information à prévoir).
- **Open Badges 3.0** **[OPP, rapide]** : standard 1EdTech basé sur les *Verifiable Credentials* W3C, lisible dans un portefeuille Europass ; pratiques françaises de badges sur les compétences transversales (APP, « La Normandie badge les compétences », universités). Sources : [Open Badge Factory](https://openbadgefactory.com/en/your-badges-are-now-open-badges-3-0/), [Guide Unicaen 2026](https://pedagogie.unicaen.fr/wp-content/uploads/sites/24/2026/04/Guide_open-badges-2026.pdf), [Centre Inffo, badges et territoires](https://www.centre-inffo.fr/site-centre-inffo/actualites-centre-inffo/le-quotidien-de-la-formation-actualite-formation-professionnelle-apprentissage/badges-numeriques-quels-usages-sur-les-territoires-fffod). Impact appli : émission d'un badge par habileté observée ≥ 2 sessions (cohérent avec la règle « observée en N sessions » de `bilans.md`), critères publics, page de vérification, révocation. Valeur : reconnaissance « non formelle », tremplin vers un futur RS.
- **Data-Dock** : obsolète comme condition de financement depuis 2022 ; **Qualiopi** le remplace.
- **Carif-Oref** **[OPP]** : référencement de l'offre de formation dans la base régionale (alimente les sites d'orientation et l'information des prescripteurs). Gratuit en général, modalités régionales **[INC, non vérifié en ligne]**.
- **Partenariats** **[ATT]** : conventions avec une ou deux Missions Locales et une SIAE pilotes, lettres de soutien, UNML / réseaux IAE, éventuellement fédération du jeu vidéo ; programmes voisins (Gaming House de l'Insertion à Montpellier/Aix, SNML Cup, serious game France Travail en festivals) montrent que le créneau existe mais est souvent gratuit pour les jeunes et financé par subventions ([GHINS](https://encommun.montpellier.fr/sites/default/files/articles/2024-09/GHINS%20-%20Gaming%20House%20de%20l%27Insertion.pdf), [SNML Cup](https://snml-2024.unml.info/assets/upload/snml-2024/Fiche%20projet%20SNML%20Cup%202024_1723024516.pdf), [France Travail festivals](https://www.francetravail.org/accueil/communiques/2025/france-travail-transforme-les-festivals-d-ete-en-tremplin-professionnel.html?type=article)).

---

## 4. Conformité

### 4.1 RGPD **[OBL]**

| Point | Constat | À faire (appli / organisation) |
|---|---|---|
| **Rôles** | Deux schémas : (a) HAPPI anime → HAPPI responsable de traitement, la structure prescriptrice destinataire (voire co-responsable) ; (b) licence SaaS à un OF → l'OF est responsable, HAPPI **sous-traitant** (art. 28) | Qualifier chaque contrat ; contrat de sous-traitance type pour les OF ; accord de co-responsabilité éventuel avec Missions Locales **[JUR]** |
| **Base légale** | La politique invoque le **consentement** | Pour des personnes orientées par France Travail/Mission Locale, le consentement n'est pas « libre » (déséquilibre) : préférer **l'exécution du contrat / mission d'intérêt public / intérêt légitime** selon le schéma, et garder le consentement pour les usages optionnels (recherche, badge public, IA si choisi) **[JUR]** |
| **Registre des traitements** (art. 30) | Non vu dans le dépôt | Tenir le registre : comptes, parcours/présences, évaluations, bilans avec IA, contact, journal de sécurité, recherche |
| **AIPD** (art. 35) | Non vue | **Fortement recommandée, très probablement obligatoire** : au moins deux critères du CEPD sont réunis (évaluation/notation de personnes + personnes vulnérables : jeunes, demandeurs d'emploi, publics IAE ; + usage innovant de l'IA). Liste CNIL : [traitements avec AIPD requise](https://www.cnil.fr/fr/liste-traitements-aipd-requise), [CNIL — AIPD](https://www.cnil.fr/fr/ce-quil-faut-savoir-sur-lanalyse-dimpact-relative-la-protection-des-donnees-dpia). Outil PIA de la CNIL utilisable |
| **Sous-traitants** | Supabase (base en Irlande), Vercel (fonctions à Dublin), OpenRouter + Anthropic (US). Audit : « contrat à signer » | **DPA signé** avec chacun ; liste publique des sous-traitants ; pour l'IA : DPA OpenRouter (proposé, accès via Trust Portal, routage **ZDR** possible — [OpenRouter DPA](https://openrouter.ai/data-processing-agreement), [ZDR](https://openrouter.ai/docs/guides/features/zdr)) ou **API Anthropic en direct** (moins d'intermédiaires) ; vérifier certification Data Privacy Framework ou CCT + analyse d'impact du transfert **[JUR, INC]**. Supabase et Vercel sont des sociétés américaines : même hébergées en UE, transferts/accès possibles → à documenter |
| **IA « données sans nom »** | Données **pseudonymisées**, donc toujours personnelles ; les commentaires libres peuvent contenir des éléments identifiants ou sensibles (santé, handicap, justice) | Filtre de détection avant envoi, consigne aux formateurs, information des participants (mention explicite de l'IA et du transfert), option de rédaction manuelle ✓ (existe), désactivation de la rétention et de l'entraînement |
| **Données sensibles** (art. 9) | Non prévues, mais risque dans les champs libres | Interdire la saisie d'informations de santé ; « besoins d'adaptation » formulés sans diagnostic. Si des données de santé étaient hébergées, **HDS** deviendrait nécessaire — à éviter par conception |
| **Conservation** | 36 mois après l'accompagnement | Cohérent pour le suivi, mais à articuler avec les obligations de preuve des financeurs (FSE+, Qualiopi : la durée d'audit couvre le cycle de 3 ans) ; prévoir **archivage intermédiaire** à accès restreint et purge automatique planifiée **[JUR]** |
| **Droits** | Export, suppression ✓ ; droit d'opposition, limitation ; info sur l'IA | Procédure de réponse à 1 mois ; tracer les demandes (✓ `data_requests`) ; nommer un référent/DPO (champ vide dans la page) |
| **Sécurité** | Bonne base (RLS, audit, journal immuable) ; points ouverts : SMTP, mot de passe 6 car. en base, pas de limitation de débit, CSP minimale, ancien mot de passe dans l'historique git | Les corriger avant toute réponse à appel d'offres ; procédure de **notification de violation sous 72 h** |

### 4.2 AI Act (règlement (UE) 2024/1689) **[OBL partielle, calendrier]**
- **Annexe III, point 3 (éducation et formation professionnelle)** vise les systèmes d'IA destinés à **évaluer les acquis d'apprentissage**, orienter le processus d'apprentissage, déterminer le niveau approprié d'éducation, surveiller les comportements lors d'examens. **Point 4 (emploi)** vise le recrutement, la sélection, l'évaluation des candidats. Un système qui *évaluerait* automatiquement des participants serait donc **à haut risque**.
- **Cas HAPPI** : les niveaux sont **saisis par les formateurs**, l'IA **rédige un texte** à partir de résultats déjà validés, sous contrôle (`checkContent`, relecture, validation humaine, aucune note chiffrée dans le texte). Cela relève a priori de l'**exception de l'article 6(3)** (tâche procédurale étroite / amélioration du résultat d'une activité humaine préalable / tâche préparatoire), **à condition** de ne pas faire de profilage — or l'article 6(3) précise qu'un système de l'annexe III **qui effectue un profilage** reste toujours à haut risque. La rédaction d'un « profil » et d'une « façon d'agir » peut être lue comme du profilage **[JUR — point le plus sensible]**. Le fournisseur qui invoque l'exception doit **documenter son évaluation** et s'enregistrer dans la base de l'UE.
- **Calendrier** : le *Digital Omnibus* (règlement (UE) 2026/1744, JO du 24 juillet 2026, en vigueur le 27 juillet 2026) **reporte les obligations haut risque de l'annexe III au 2 décembre 2027** ; annexe I au 2 août 2028. Restent applicables : pratiques interdites et **maîtrise de l'IA (art. 4)** depuis le 2 février 2025 ; **transparence (art. 50)** depuis le 2 août 2026 **[INC : vérifier les ajustements de l'Omnibus sur l'art. 50]**. Sources : [Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html), [AIActo](https://www.aiacto.eu/en/blog/digital-omnibus-ai-act-report-2027), [UNIwise](https://uniwise.eu/resources/blog/the-eu-ai-act-and-assessment-december-2027-is-not-a-snooze-button).
- **Si haut risque** (d'ici déc. 2027) : système de gestion des risques, qualité des données, documentation technique, journalisation, contrôle humain, exactitude/robustesse, marquage CE, enregistrement ; côté déployeurs publics (France Travail, Missions Locales) **analyse d'impact sur les droits fondamentaux (art. 27)** et information des personnes.
- **À faire dès maintenant** : (1) note d'évaluation « art. 6(3) » signée ; (2) ne jamais laisser l'IA proposer un niveau ou un classement ; (3) mention visible « texte rédigé avec assistance d'IA, relu et validé par [formateur] » dans le bilan et dans l'interface ; (4) formation IA des formateurs (art. 4) tracée dans le registre des intervenants ; (5) journal des générations (modèle, version du prompt, validateur) — déjà partiellement présent (versions immuables).

### 4.3 Accessibilité (RGAA / EAA)
- **Article 47 de la loi 2005-102** : obligation (RGAA 4.1.2, déclaration d'accessibilité, schéma pluriannuel, mention en page d'accueil, moyen de signalement) pour les personnes publiques, les **organismes privés délégataires d'une mission de service public** ou créés pour satisfaire des besoins d'intérêt général, et les entreprises au-delà d'un seuil de chiffre d'affaires (250 M€ selon les sources) ([RGAA 4.1.2](https://accessibilite.numerique.gouv.fr/doc/RGAA-v4.1.2.odt), [Deloitte Avocats](https://blog.avocats.deloitte.fr/accessibilite-numerique%e2%80%af-vers-de-nouvelles-contraintes-entreprises%e2%80%af/?amp=1)).
- **European Accessibility Act** (en application depuis le 28 juin 2025) : vise surtout des services **aux consommateurs** (e-commerce, banque, transport…) ; **micro-entreprises exemptées** (< 10 salariés et ≤ 2 M€) ([DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques-et-les-faq/professionnels-vos-produits-et-services-doivent-etre)).
- **Pour HAPPI** : probablement **non obligatoire à titre propre** aujourd'hui (petite structure, service B2B) **[JUR]** ; mais **[ATT]** car (a) les clients publics (France Travail, Missions Locales, Régions) sont eux-mêmes soumis et l'exigent dans les marchés pour les outils mis à disposition des usagers ; (b) Qualiopi exige l'accessibilité aux personnes en situation de handicap ; (c) publics concernés. L'audit interne (axe-core, clavier) est un bon départ. **À faire** : audit RGAA par un tiers, **déclaration d'accessibilité** (même « partiellement conforme »), page accessibilité, moyen de contact, PDF accessibles (balisage des bilans react-pdf — à vérifier, souvent non balisés).

### 4.4 Sécurité et attentes des acheteurs publics
- **ISO 27001** : non exigée par la loi ; **[OPP]** à moyen terme, demandée surtout par de grands comptes. Hébergeurs déjà certifiés (Supabase/AWS : SOC 2, ISO 27001 — à vérifier sur leurs pages de confiance).
- **HDS** : **non requis** tant qu'aucune donnée de santé n'est traitée (cf. 4.1) ; c'est une raison supplémentaire d'interdire ces données dans les champs libres.
- **SecNumCloud / immunité aux lois extra-européennes** : exigé seulement pour certaines données sensibles de l'État (doctrine « cloud au centre », loi SREN 2024) ; France Travail pourrait l'invoquer pour certains marchés **[JUR, INC]**. Hébergeur français ou européen sans maison mère américaine = argument commercial.
- **Attendus usuels dans un DCE** : plan d'assurance sécurité (PAS), questionnaire sécurité, localisation des données en UE, réversibilité (export complet), journalisation, chiffrement, gestion des accès, PRA/PCA et sauvegardes, procédure d'incident, contrat de sous-traitance RGPD. L'appli couvre bien journalisation et droits ; manquent documentation PAS, **réversibilité contractuelle** (export complet par organisme), PRA testé, limitation de débit, double authentification pour admins/formateurs.

### 4.5 CGU / CGV / mentions légales **[OBL]**
- **Mentions légales** (LCEN art. 6) : raison sociale, forme, SIRET/RCS, adresse, directeur de publication, hébergeur (nom, adresse, téléphone) — actuellement **vides** dans l'appli. À compléter avant mise en ligne publique.
- **CGU** : existantes et sobres ; ajouter : IA, durée, suspension, propriété des contenus, responsabilité, droit applicable, rappel que les niveaux ne sont pas une certification (✓ déjà présent, bon point).
- **CGV / conditions de prestation** pour les clients B2B : prix, modalités d'annulation, sous-traitance, propriété intellectuelle des supports, clause RGPD / DPA en annexe, niveau de service (SLA) pour la licence SaaS, réversibilité. Pour la formation : **convention ou contrat de formation** (mentions obligatoires du Code du travail), règlement intérieur pour les stagiaires (obligatoire pour un OF).
- **Politique de confidentialité** : compléter responsable, DPO/référent, **sous-traitants dont l'IA et les transferts hors UE**, base légale révisée, durées par catégorie.

---

## 5. Modèle économique

### 5.1 Repères de prix (sourcés, à prendre comme ordres de grandeur)
| Référence | Prix | Source |
|---|---|---|
| Prestations d'accompagnement France Travail (Activ'…) | **≈ 520–535 € HT par bénéficiaire** (prix plafonds) | [BOAMP 25-87457](https://www.boamp.fr/telechargements/FILES/PDF/2025/08/25-87457.pdf), [BOAMP 25-91702](https://www.boamp.fr/telechargements/FILES/PDF/2025/08/25-91702.pdf) |
| Formation de demandeurs d'emploi (France Travail, 2025) | **1 785 € pour 79 h ≈ 22,6 €/h** (calcul) | [Caisse des Dépôts, Brèves QPS 41](https://politiques-sociales.caissedesdepots.fr/sites/default/files/QPS_Les%20Breves_41_La%20publication.pdf) |
| CPF (2024) | 1 647 € par action en moyenne | [France compétences, usage des fonds 2024](https://francecompetences.fr/app/uploads/2025/01/07-rapport-usage-fonds-2024-cpf.pdf) |
| Team building escape game / serious game | **25–70 € HT/personne**, ou **forfaits 1 300–2 000 € HT** (8–20 personnes) | [Funbooker — serious game](https://www.funbooker.com/fr/category/team-building-serious-game), [Funbooker — jeux rétro/next gen](https://www.funbooker.com/fr/annonce/team-building-jeux-retro-gaming-ou-next-gen-en-idf/voir) |
| Programmes jeu vidéo en Mission Locale | Souvent gratuits pour les jeunes, financés par subventions — **pas de tarif public trouvé** | GHINS, SNML Cup (ci-dessus) |

**Déduction pour HAPPI** (estimation, non sourcée directement) :
- Parcours 18 h, groupe de 8 : à 22–30 €/h/participant → **400–540 € HT par participant**, soit **3 200–4 300 € HT par groupe**, en ligne avec le plafond des prestations France Travail. Au-delà de ~600 €/participant, la prestation sort des grilles publiques habituelles.
- Team building 5 h entreprise : **1 500–3 000 € HT** le groupe (positionnement « RH / soft skills », au-dessus de l'escape game loisir).
- Bloc individuel 3 h : **250–450 € HT** (comparable à un entretien d'accompagnement renforcé) **[INC]**.

### 5.2 Modèles possibles
1. **Prestation directe** (actuel) : marge élevée, capacité limitée par les formateurs ; nécessite Qualiopi pour la partie formation.
2. **Licence SaaS pour OF / SIAE partenaires** : abonnement par structure + par participant actif (ordre de grandeur à tester : 5–15 € par participant et par parcours, ou 100–300 €/mois par structure **[INC, aucun comparable public trouvé]**). Atout : les modules Qualiopi/financeurs (émargement, satisfaction, réclamations, indicateurs, export FSE+) ont une valeur en soi. Implique : multi-organisme (déjà présent), **HAPPI sous-traitant RGPD**, SLA, réversibilité, facturation, configuration du référentiel par client.
3. **Essaimage / franchise de formateurs certifiés HAPPI** : formation de formateurs (habilitation), redevance par groupe, accès logiciel inclus. Implique : contrat d'habilitation (le décret 2025-500 encadre les habilitations si un RS est obtenu), registre des formateurs certifiés et de leurs échéances, contrôle qualité (double cotation, audits de sessions), contrats de sous-traitance Qualiopi (indicateur 27). La franchise au sens juridique (loi Doubin, DIP) impose une information précontractuelle **[JUR]**.
4. **Combinaison recommandée** : prestation directe sur 2–3 territoires pilotes pour produire des preuves d'impact, puis essaimage avec logiciel inclus ; la licence SaaS seule viendra ensuite.

### 5.3 Indicateurs d'impact attendus
- **Sorties** : taux de **sortie positive** (emploi, formation qualifiante, alternance, création d'activité), distinction emploi durable (CDI/CDD ≥ 6 mois) / de transition / autres sorties positives (catégories IAE), à la fin et à **3 et 6 mois**. Repères : environ un quart des jeunes en emploi durable à la sortie du CEJ en Mission Locale, 33,5 % en emploi six mois après selon une estimation administrative ([Assemblée nationale, avis PLF 2025](https://www.assemblee-nationale.fr/dyn/17/rapports/cion-soc/l17b0524-tiii_rapport-avis.pdf)). HAPPI n'étant qu'une brique du parcours, mesurer plutôt la **contribution** (passage à l'étape suivante du parcours).
- **Engagement** : taux d'assiduité, taux d'abandon et motifs, taux de complétion des 6 sessions.
- **Progression** : écart entrée/sortie sur les habiletés (auto-évaluation et observation), part des participants avec ≥ N habiletés « observées en 2 sessions ».
- **Satisfaction** : participants (à chaud/à froid), prescripteurs (conseillers).
- **FSE+** : indicateurs communs ventilés par genre, âge, niveau d'études, situation.
- Impact logiciel : modèle de données « parcours » (entrée, sortie, suivi), relances automatiques de suivi à 3/6 mois (e-mail/SMS, avec consentement), tableau de bord par financeur et export.

---

## 6. Synthèse des priorités pour l'application

| Priorité | Élément | Statut | Effort |
|---|---|---|---|
| 1 | Mentions légales, politique de confidentialité complète (IA, sous-traitants, base légale), DPA signés, registre, AIPD | **OBL** | faible (juridique) |
| 2 | Note « AI Act art. 6(3) » + mention IA dans le bilan + formation IA des formateurs | **OBL** (art. 4, 50) / prévention haut risque | faible |
| 3 | Satisfaction à chaud/à froid, réclamations, plan d'amélioration | **ATT** (Qualiopi) | moyen |
| 4 | Abandons (motifs, alertes), entrée/sortie/suivi 3–6 mois | **ATT** (Qualiopi 12, financeurs) | moyen |
| 5 | Émargement électronique signé et horodaté par demi-journée | **ATT** | moyen |
| 6 | Tableaux d'indicateurs et exports par financeur (FSE+, CEJ heures, France Travail) | **ATT** | moyen |
| 7 | Documents automatiques (convocation, attestation, certificat de réalisation) | **ATT** (OPCO, Région) | faible |
| 8 | Déclaration d'accessibilité, audit RGAA, PDF balisés | **ATT** | moyen |
| 9 | Registre des intervenants et de la veille | **ATT** (Qualiopi C5–C6) | faible |
| 10 | Open Badges 3.0 | **OPP** | moyen |
| 11 | Double cotation et export anonymisé pour validation scientifique | **OPP** | moyen |
| 12 | Épreuve certificative, jury, suivi des titulaires (préparation RS) | **OPP** long terme | élevé |
| 13 | Fonctions SaaS multi-clients (SLA, réversibilité, facturation) | **OPP** | élevé |

## 7. Points à faire valider par un juriste (récapitulatif)
1. Qualification des rôles RGPD par schéma de vente ; base légale (consentement vs mission/contrat).
2. Transferts hors UE (OpenRouter, Anthropic, Supabase, Vercel) : DPF/CCT, analyse de transfert.
3. AI Act : applicabilité de l'exception art. 6(3) face à la notion de profilage ; qualité de fournisseur vs déployeur.
4. Durées de conservation compatibles avec les obligations de preuve FSE+/Qualiopi.
5. Valeur probante de l'émargement électronique pour chaque financeur.
6. Assujettissement d'HAPPI à l'art. 47 (si un marché lui confie une mission de service public).
7. Contrat d'essaimage : franchise (DIP, loi Doubin) ou licence + habilitation.
8. Texte exact du décret Qualiopi 2026-728 et des arrêtés de seuils ; guide de lecture V10.

*Limites de cette note : recherches web par moteur uniquement (pages non lues en entier) ; plusieurs sources sont des blogs de consultants ; aucun DCE France Travail ni barème de Mission Locale n'a été consulté en entier ; les prix HAPPI proposés sont des estimations.*
