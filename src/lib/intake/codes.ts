/**
 * Questionnaire d'accueil du participant : questions et réponses reprises mot pour mot de l'ancien
 * « Formulaire HaPPi » (formateur.happicompetence.fr, src/components/OnboardingTalent.jsx, étapes 1 à 5).
 * L'étape 6 de ce formulaire (les 15 affirmations) est l'auto-évaluation déjà en place.
 * Les codes sont ceux autorisés par la base (migration 20261121100000_participant_intake.sql).
 * Module sans dépendance serveur.
 */

export const AGE_BANDS = {
  '15_17': '15 - 17 ans',
  '18_21': '18 - 21 ans',
  '22_24': '22 - 24 ans',
  '25_plus': '25 ans et plus',
} as const;

export const SITUATIONS = {
  lyceen: 'Lycéen(ne)',
  etudiant: 'Étudiant(e)',
  formation: 'En formation / apprentissage',
  demandeur_emploi: 'Demandeur(se) d’emploi',
  salarie: 'Salarié(e)',
  autre: 'Autre',
} as const;

export const RESIDENCES = {
  beziers: 'Béziers',
  villages_alentours: 'Villages alentours',
  autre_ville: 'Autre ville',
} as const;

export const STUDY_LEVELS = {
  sans_diplome: 'Sans diplôme',
  cap: 'CAP',
  bep: 'BEP',
  bac_general: 'Bac général',
  bac_techno: 'Bac technologique',
  bac_pro: 'Bac professionnel',
  daeu: 'DAEU',
  bac_2: 'BTS / DUT (Bac+2)',
  licence: 'Licence (Bac+3)',
  maitrise: 'Maîtrise (Bac+4)',
  master: 'Master / DEA / DESS (Bac+5)',
  doctorat: 'Bac+6 et plus / Doctorat',
  autre: 'Autre',
} as const;

export const VOLUNTEERING = {
  regulier: 'Oui, régulièrement',
  ponctuel: 'Oui, ponctuellement',
  jamais: 'Non, jamais',
} as const;

export const VOLUNTEERING_FIELDS = {
  sport_loisirs: 'Sport / Loisirs',
  education_formation: 'Éducation / Formation',
  social_humanitaire: 'Social / Humanitaire',
  culture_art: 'Culture / Art',
  environnement: 'Environnement',
  sante: 'Santé',
  religion_spiritualite: 'Religion / Spiritualité',
  politique_citoyennete: 'Politique / Citoyenneté',
  autre: 'Autre',
} as const;

/**
 * Domaines de bénévolat qui peuvent révéler une conviction religieuse ou une opinion politique
 * (catégories particulières, article 9 du RGPD) : jamais utilisés dans les statistiques ni les découpages.
 */
export const SENSITIVE_VOLUNTEERING_FIELDS: readonly (keyof typeof VOLUNTEERING_FIELDS)[] = ['religion_spiritualite', 'politique_citoyennete'];

export const EXPERIENCES = {
  meme_domaine: 'Oui, dans le même domaine que mes études',
  autre_domaine: 'Oui, dans un autre domaine',
  aucune: 'Non, aucune expérience',
} as const;

export const SECTORS = {
  commerce_vente: 'Commerce & vente',
  informatique_numerique: 'Informatique & numérique',
  sante_social: 'Santé & social',
  securite_defense: 'Sécurité & défense',
  art_design: 'Art & design',
  hotellerie_restauration: 'Hôtellerie & restauration',
  btp_artisanat: 'BTP & artisanat',
  sport_animation: 'Sport & animation',
  finance_gestion: 'Finance & gestion',
  education_formation: 'Éducation & formation',
  transport_logistique: 'Transport & logistique',
  industrie_production: 'Industrie & production',
  autre: 'Autre',
} as const;

export const TWO_YEAR_PLANS = {
  emploi: 'Être en emploi dans mon domaine cible',
  etudes: 'Poursuivre mes études ou une formation',
  creation: 'Créer ma propre activité / entreprise',
  alternance: 'Intégrer une formation en alternance',
  ne_sait_pas: 'Je ne sais pas encore',
} as const;

export const APTITUDES = {
  aptitude_punctuality: 'Ponctualité',
  aptitude_motivation: 'Motivation / Investissement',
  aptitude_communication: 'Communication',
  aptitude_initiative: 'Prise d’initiative',
} as const;

/** Échelle des aptitudes (ancien formulaire : « 1 = Très faible → 5 = Excellent »). */
export const APTITUDE_SCALE = { 1: 'Très faible', 3: 'Moyen', 5: 'Excellent' } as const;

/** Les cinq étapes de ce questionnaire, puis l'auto-évaluation (étape 6 de l'ancien formulaire). */
export const INTAKE_STEPS = [
  { step: 1, title: 'Informations personnelles', subtitle: 'Quelques informations sur toi' },
  { step: 2, title: 'Parcours académique', subtitle: 'Ton niveau d’études et ta formation' },
  { step: 3, title: 'Bénévolat & expériences', subtitle: 'Tes engagements et expériences professionnelles' },
  { step: 4, title: 'Ambitions professionnelles', subtitle: 'Tes projets et aspirations' },
  { step: 5, title: 'Aptitudes personnelles', subtitle: 'Note-toi sur les aptitudes suivantes (1 = Très faible → 5 = Excellent)' },
] as const;

export const TOTAL_STEPS = 6;

export type IntakeStep = 1 | 2 | 3 | 4 | 5;
