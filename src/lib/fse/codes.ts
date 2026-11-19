/**
 * Fiche d'entrée FSE+ et dispositifs publics — nomenclatures. Module sans dépendance serveur.
 *
 * Les codes reprennent ceux autorisés par la base (migration 20261118110000) ; les sources de chaque
 * liste sont citées dans docs/fse-plus.md. Une valeur absente (null) = « non renseigné » ;
 * « ne souhaite pas répondre » est une réponse à part entière, comptée à part, jamais à zéro.
 */

export const NOT_RECORDED = 'Non renseigné';
export const DECLINED = 'ne_souhaite_pas_repondre';
export const DECLINED_LABEL = 'Ne souhaite pas répondre';

export const GENDERS = {
  femme: 'Femme',
  homme: 'Homme',
  non_binaire: 'Non binaire',
  ne_souhaite_pas_repondre: DECLINED_LABEL,
} as const;
export type Gender = keyof typeof GENDERS;

/** Tranches d'âge à l'entrée : HAPPI ne conserve aucune date de naissance. */
export const AGE_BANDS = {
  moins_18: 'Moins de 18 ans',
  '18_29': '18 à 29 ans',
  '30_54': '30 à 54 ans',
  '55_plus': '55 ans et plus',
} as const;
export type AgeBand = keyof typeof AGE_BANDS;

export const LABOUR_STATUSES = {
  chomeur: { label: 'Sans emploi, à la recherche d’un emploi (chômeur)', hint: 'Inscrit ou non à France Travail' },
  inactif: { label: 'Ni en emploi, ni à la recherche d’un emploi (inactif)', hint: 'Par exemple : en études, sans recherche en cours' },
  en_emploi: { label: 'En emploi, y compris indépendant', hint: null },
} as const;
export type LabourStatus = keyof typeof LABOUR_STATUSES;

export const UNEMPLOYMENT_DURATIONS = {
  moins_6_mois: 'Moins de 6 mois',
  '6_11_mois': 'De 6 à 11 mois',
  '12_23_mois': 'De 12 à 23 mois',
  '24_mois_plus': '24 mois ou plus',
} as const;
export type UnemploymentDuration = keyof typeof UNEMPLOYMENT_DURATIONS;
/** Chômage de longue durée : 12 mois ou plus (voir docs/fse-plus.md, seuil des moins de 25 ans à vérifier). */
export const LONG_TERM_DURATIONS: readonly UnemploymentDuration[] = ['12_23_mois', '24_mois_plus'];

/** Cadre national des certifications professionnelles (décret n° 2019-14 du 8 janvier 2019). */
export const DIPLOMA_LEVELS = {
  sans_diplome: { label: 'Aucun diplôme', hint: 'Ou seulement le brevet des collèges' },
  niveau_1: { label: 'Niveau 1', hint: 'Maîtrise des savoirs de base' },
  niveau_2: { label: 'Niveau 2', hint: 'Activités simples, par exemple certificat de qualification' },
  niveau_3: { label: 'Niveau 3', hint: 'CAP, BEP' },
  niveau_4: { label: 'Niveau 4', hint: 'Baccalauréat, brevet professionnel' },
  niveau_5: { label: 'Niveau 5', hint: 'BTS, DUT, bac + 2' },
  niveau_6: { label: 'Niveau 6', hint: 'Licence, BUT, bac + 3' },
  niveau_7: { label: 'Niveau 7', hint: 'Master, diplôme d’ingénieur, bac + 5' },
  niveau_8: { label: 'Niveau 8', hint: 'Doctorat' },
} as const;
export type DiplomaLevel = keyof typeof DIPLOMA_LEVELS;

/** Regroupements CITE (ISCED 2011) des indicateurs FSE+ EECO09 à EECO11. */
export const ISCED_BANDS = {
  cite_0_2: 'CITE 0 à 2 (premier cycle du secondaire au plus)',
  cite_3_4: 'CITE 3 à 4 (second cycle du secondaire ou post-secondaire non supérieur)',
  cite_5_8: 'CITE 5 à 8 (enseignement supérieur)',
} as const;
export type IscedBand = keyof typeof ISCED_BANDS;

/**
 * Correspondance niveau français → CITE, identique à la colonne générée education_isced.
 * À vérifier (docs/fse-plus.md) : le niveau 3 (CAP) et le niveau 4 (bac) relèvent de la CITE 3.
 */
export function iscedFor(level: string | null | undefined): IscedBand | null {
  if (level === 'sans_diplome' || level === 'niveau_1' || level === 'niveau_2') return 'cite_0_2';
  if (level === 'niveau_3' || level === 'niveau_4') return 'cite_3_4';
  if (level === 'niveau_5' || level === 'niveau_6' || level === 'niveau_7' || level === 'niveau_8') return 'cite_5_8';
  return null;
}

export const ANSWERS = {
  oui: 'Oui',
  non: 'Non',
  ne_sait_pas: 'Je ne sais pas',
  ne_souhaite_pas_repondre: DECLINED_LABEL,
} as const;
export type Answer = keyof typeof ANSWERS;

/** Question à réponse oui / non, avec « ne souhaite pas répondre » toujours proposé. */
export type AnswerField = {
  column: AnswerColumn;
  label: string;
  /** Formulation à la première personne, pour l'espace participant. */
  selfLabel: string;
  hint?: string;
  /** Affiche « Je ne sais pas » (zones géographiques, statuts administratifs). */
  allowUnknown: boolean;
  /** Catégorie particulière (art. 9 RGPD) ou donnée très personnelle. */
  sensitive: boolean;
};

export type AnswerColumn =
  | 'disability'
  | 'third_country_national'
  | 'foreign_background'
  | 'minority'
  | 'homeless_or_housing_excl'
  | 'rural_area'
  | 'qpv_resident'
  | 'zrr_frr_resident'
  | 'rqth'
  | 'rsa_beneficiary'
  | 'france_travail_registered'
  | 'cej';

/** Dispositifs français (justification des sources : docs/fse-plus.md). */
export const SCHEME_FIELDS: AnswerField[] = [
  {
    column: 'france_travail_registered',
    label: 'Inscrit à France Travail',
    selfLabel: 'Êtes-vous inscrit(e) à France Travail (ex-Pôle emploi) ?',
    allowUnknown: true,
    sensitive: false,
  },
  {
    column: 'cej',
    label: 'En contrat d’engagement jeune (CEJ)',
    selfLabel: 'Suivez-vous un contrat d’engagement jeune (CEJ) ?',
    hint: 'Accompagnement de la Mission Locale ou de France Travail.',
    allowUnknown: true,
    sensitive: false,
  },
  {
    column: 'rsa_beneficiary',
    label: 'Bénéficiaire du RSA',
    selfLabel: 'Percevez-vous le RSA (revenu de solidarité active) ?',
    allowUnknown: true,
    sensitive: false,
  },
  {
    column: 'rqth',
    label: 'Reconnaissance de la qualité de travailleur handicapé (RQTH)',
    selfLabel: 'Avez-vous une reconnaissance de la qualité de travailleur handicapé (RQTH) ?',
    hint: 'Donnée de santé : vous pouvez ne pas répondre.',
    allowUnknown: true,
    sensitive: true,
  },
  {
    column: 'qpv_resident',
    label: 'Habite un quartier prioritaire de la politique de la ville (QPV)',
    selfLabel: 'Habitez-vous un quartier prioritaire de la politique de la ville (QPV) ?',
    hint: 'La liste officielle des quartiers est disponible auprès de votre conseiller.',
    allowUnknown: true,
    sensitive: false,
  },
  {
    column: 'zrr_frr_resident',
    label: 'Habite une commune France Ruralités Revitalisation (ex-ZRR)',
    selfLabel: 'Habitez-vous une commune classée France Ruralités Revitalisation (anciennement ZRR) ?',
    allowUnknown: true,
    sensitive: false,
  },
];

/** Données facultatives prévues par le FSE+ (annexe I du règlement (UE) 2021/1057). */
export const OPTIONAL_FIELDS: AnswerField[] = [
  {
    column: 'disability',
    label: 'Personne handicapée',
    selfLabel: 'Êtes-vous en situation de handicap ?',
    hint: 'Donnée de santé : vous pouvez ne pas répondre.',
    allowUnknown: false,
    sensitive: true,
  },
  {
    column: 'third_country_national',
    label: 'Ressortissant de pays tiers (hors Union européenne)',
    selfLabel: 'Avez-vous une nationalité d’un pays hors Union européenne (et aucune nationalité d’un pays de l’Union) ?',
    allowUnknown: false,
    sensitive: false,
  },
  {
    column: 'foreign_background',
    label: 'Personne d’origine étrangère',
    selfLabel: 'Êtes-vous d’origine étrangère (par exemple : au moins un de vos parents né à l’étranger) ?',
    hint: 'Définition nationale à confirmer.',
    allowUnknown: true,
    sensitive: true,
  },
  {
    column: 'minority',
    label: 'Appartenance à une minorité (y compris communautés marginalisées, par exemple les Roms)',
    selfLabel: 'Considérez-vous appartenir à une minorité (par exemple une communauté marginalisée) ?',
    allowUnknown: true,
    sensitive: true,
  },
  {
    column: 'homeless_or_housing_excl',
    label: 'Sans domicile ou confronté à l’exclusion du logement',
    selfLabel: 'Êtes-vous sans domicile, ou en grande difficulté de logement (hébergement d’urgence, logement très précaire) ?',
    allowUnknown: false,
    sensitive: true,
  },
  {
    column: 'rural_area',
    label: 'Habite une zone rurale (zone peu dense)',
    selfLabel: 'Habitez-vous une zone rurale (commune peu dense) ?',
    allowUnknown: true,
    sensitive: false,
  },
];

export const ANSWER_FIELDS = [...SCHEME_FIELDS, ...OPTIONAL_FIELDS];

export type EntryProfileValues = {
  entryDate: string | null;
  gender: Gender | null;
  ageBand: AgeBand | null;
  labourStatus: LabourStatus | null;
  unemploymentDuration: UnemploymentDuration | null;
  diplomaLevel: DiplomaLevel | null;
  answers: Partial<Record<AnswerColumn, Answer | null>>;
};

export type EntryProfileRecord = EntryProfileValues & {
  id: string;
  participantId: string;
  groupId: string | null;
  participantInformedAt: string | null;
  participantConfirmedAt: string | null;
  updatedAt: string;
};

/** Champs bloquants du bilan dans Ma démarche FSE+ (date d'entrée, statut, diplôme) + âge et genre. */
export function missingCoreFields(profile: EntryProfileValues | null): string[] {
  if (!profile) return ['fiche'];
  const missing: string[] = [];
  if (!profile.entryDate) missing.push('date d’entrée');
  if (!profile.labourStatus) missing.push('situation sur le marché du travail');
  if (profile.labourStatus === 'chomeur' && !profile.unemploymentDuration) missing.push('durée de chômage');
  if (!profile.diplomaLevel) missing.push('niveau de diplôme');
  if (!profile.ageBand) missing.push('tranche d’âge');
  if (!profile.gender) missing.push('genre');
  return missing;
}

export type ProfileCompleteness = 'missing' | 'partial' | 'complete';
export function completeness(profile: EntryProfileValues | null): ProfileCompleteness {
  if (!profile) return 'missing';
  return missingCoreFields(profile).length === 0 ? 'complete' : 'partial';
}

export const COMPLETENESS_LABELS: Record<ProfileCompleteness, string> = {
  missing: 'Fiche non commencée',
  partial: 'Fiche incomplète',
  complete: 'Fiche complète',
};

function labelOf<T extends Record<string, string | { label: string }>>(map: T, code: string | null | undefined) {
  if (!code || !(code in map)) return NOT_RECORDED;
  const entry = map[code as keyof T]!;
  return typeof entry === 'string' ? entry : entry.label;
}

export const genderLabel = (code: string | null | undefined) => labelOf(GENDERS, code);
export const ageBandLabel = (code: string | null | undefined) => labelOf(AGE_BANDS, code);
export const labourStatusLabel = (code: string | null | undefined) => labelOf(LABOUR_STATUSES, code);
export const durationLabel = (code: string | null | undefined) => labelOf(UNEMPLOYMENT_DURATIONS, code);
export const diplomaLabel = (code: string | null | undefined) => {
  if (!code || !(code in DIPLOMA_LEVELS)) return NOT_RECORDED;
  const level = DIPLOMA_LEVELS[code as DiplomaLevel];
  return `${level.label} (${level.hint})`;
};
export const iscedLabel = (code: string | null | undefined) => labelOf(ISCED_BANDS, code);
export const answerLabel = (code: string | null | undefined) => labelOf(ANSWERS, code);

/**
 * Mention d'information affichée au participant et au professionnel (art. 13 RGPD).
 * PROVISOIRE — à valider par le délégué à la protection des données et un juriste (base légale).
 */
export const PRIVACY_NOTICE = {
  title: 'Pourquoi ces questions ?',
  points: [
    'HAPPI Compétence peut être financé par le Fonds social européen (FSE+) et par des financeurs publics (État, France Travail, Région…). Ces financeurs demandent des statistiques sur les personnes accompagnées : situation à l’entrée, niveau de diplôme, situation à la sortie.',
    'Vos réponses servent uniquement à produire ces statistiques et les rapports aux financeurs. Elles n’ont aucun effet sur votre parcours, sur vos droits ou sur vos aides.',
    'Elles ne sont jamais montrées à votre formateur. Seuls l’administrateur de HAPPI et, si elle y est autorisée, la structure qui vous accompagne (votre conseiller) peuvent les lire. Chaque consultation et chaque modification sont enregistrées.',
    'Les questions sur la santé, l’origine ou le logement sont facultatives : vous pouvez toujours choisir « Je ne souhaite pas répondre ».',
    'Vous pouvez relire, compléter ou corriger vos réponses à tout moment dans votre espace, rubrique « Ma fiche d’entrée ».',
  ],
  legalBasis: 'Base légale du traitement : en cours de validation par un juriste. Durée de conservation : celle exigée par les financeurs (précisée dans la politique de confidentialité).',
  provisional: 'Mention d’information provisoire — à valider par le délégué à la protection des données.',
} as const;
