/**
 * Fiche d'orientation : champs, libellés, explications (minimisation RGPD) et validation.
 * Module sans dépendance serveur : partagé entre le formulaire et l'action serveur.
 *
 * Principe : on ne collecte que ce qui sert à inviter la personne et à lui trouver une place.
 * Ni date de naissance (une tranche d'âge suffit), ni information de santé (un oui/non sur le
 * besoin d'adaptation, le détail se discute de vive voix avec l'équipe HAPPI).
 */
import { z } from 'zod';

import '@/lib/zod-fr';

export const REASON_MAX = 1000;
export const OBJECTIVES_MAX = 1000;
export const CONSTRAINTS_DETAILS_MAX = 300;
export const STATUS_REASON_MAX = 500;

/** Tranches d'âge — provisoires, à valider (alignement avec les publics financés : CEJ, 16-25 ans…). */
export const AGE_BANDS = {
  '16_17': '16 à 17 ans',
  '18_25': '18 à 25 ans',
  '26_29': '26 à 29 ans',
  '30_49': '30 à 49 ans',
  '50_plus': '50 ans et plus',
} as const;
export type AgeBand = keyof typeof AGE_BANDS;

export const DAYS = { lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi' } as const;
export type Day = keyof typeof DAYS;
export const DAY_CODES = Object.keys(DAYS) as Day[];

export const SLOTS = { matin: 'Matin', apres_midi: 'Après-midi' } as const;
export type Slot = keyof typeof SLOTS;
export const SLOT_CODES = Object.keys(SLOTS) as Slot[];

/** Contraintes pratiques — liste provisoire, à valider. */
export const PRACTICAL_CONSTRAINTS = {
  transport: 'Mobilité : dépend des transports en commun ou de trajets longs',
  garde_enfants: 'Garde d’enfants ou personne à charge',
  horaires: 'Horaires contraints (emploi, formation, démarches)',
  autre: 'Autre contrainte pratique',
} as const;
export type PracticalConstraint = keyof typeof PRACTICAL_CONSTRAINTS;
export const CONSTRAINT_CODES = Object.keys(PRACTICAL_CONSTRAINTS) as PracticalConstraint[];

/** Pourquoi chaque champ est demandé : affiché à côté du champ (minimisation). */
export const FIELD_PURPOSES = {
  identity: 'Prénom et nom : pour accueillir la personne et l’inscrire dans un groupe.',
  email: 'Pour lui envoyer l’invitation à créer son compte et ses convocations. Obligatoire.',
  phone: 'Seulement si la personne préfère être jointe par téléphone pour l’entretien.',
  ageBand: 'Une tranche suffit : certains financements dépendent de l’âge. Nous ne demandons pas la date de naissance.',
  reason: 'Ce qui motive l’orientation, en quelques phrases. N’indiquez aucune information de santé ni de situation judiciaire.',
  objectives: 'Ce que la personne souhaite travailler ou atteindre : cela aide le formateur à préparer son accueil.',
  availability: 'Pour proposer un groupe dont les séances tombent sur des créneaux possibles.',
  constraints: 'Pour anticiper l’organisation (lieu, horaires). Précisez seulement ce qui est utile.',
  accommodation: 'Oui ou non seulement. Si oui, l’équipe HAPPI en parlera directement avec la personne : ne donnez aucun détail ici.',
  program: 'Le programme qui vous semble adapté. L’équipe HAPPI peut en proposer un autre.',
  startDate: 'Pour proposer un groupe qui démarre au bon moment.',
} as const;

/** Version du texte d'information présenté à la personne (tracée avec chaque orientation). */
export const INFORMATION_VERSION = 'v1-2026-11';

/**
 * Information de la personne orientée, affichée au conseiller (qui la lui transmet) puis à la
 * personne elle-même lors de la confirmation. Texte provisoire — à valider (base légale à
 * confirmer par un juriste, voir docs/prescription.md).
 */
export const INFORMATION_POINTS = [
  'HAPPI Compétence reçoit les informations de cette fiche pour organiser son accompagnement (inscription dans un groupe, convocations, suivi de présence et observation de ses compétences).',
  'Seules l’équipe HAPPI (formateurs et administrateurs) et la structure qui l’oriente y ont accès. Rien n’est communiqué à un employeur sans son accord.',
  'Les données sont conservées le temps de l’accompagnement puis pendant la durée de conservation indiquée dans la politique de confidentialité.',
  'Elle peut demander à consulter, corriger ou effacer ses données, et s’opposer à leur traitement, depuis son compte ou en écrivant à l’équipe HAPPI.',
] as const;

export const CONSENT_TEXTS = {
  image: {
    label: 'Droit à l’image',
    question: 'La personne accepte d’être prise en photo ou filmée pendant les séances (supports internes et communication de HAPPI).',
    note: 'Facultatif et révocable à tout moment depuis son compte. Un refus ne change rien à son accompagnement.',
  },
  shareResults: {
    label: 'Partage des résultats avec le prescripteur',
    question: 'La personne accepte que la structure qui l’oriente consulte ses présences et ses résultats (compétences observées, bilan).',
    note: 'Sans cet accord, la structure voit seulement où en est l’orientation. Modifiable à tout moment depuis son compte.',
  },
} as const;

/**
 * Mots signalant une information de santé (ou assimilée) dans un texte libre : la fiche ne doit
 * pas en contenir. Liste volontairement courte et prudente : mieux vaut un rappel de trop.
 */
const HEALTH_PATTERNS = [
  /\bmaladies?\b/,
  /\bhandicap/,
  /\brqth\b/,
  /\bmdph\b/,
  /\bdiagnosti/,
  /\bpsychiatr/,
  /\bpsycholog/,
  /\bdepression/,
  /\bmedica(?:l|ux|ment)/,
  /\bhospitalis/,
  /\baddiction/,
  /\bgrossesse\b/,
  /\benceinte\b/,
  /\bsante\b/,
  /\btherap/,
] as const;

export function mentionsHealth(text: string | null | undefined): boolean {
  if (!text) return false;
  // Comparaison sans accents ni majuscules : « Santé », « MÉDICAL » et « medical » sont repérés.
  const plain = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return HEALTH_PATTERNS.some((pattern) => pattern.test(plain));
}

const HEALTH_MESSAGE = 'Retirez toute information de santé : indiquez seulement « besoin d’adaptation : oui », l’équipe HAPPI en parlera avec la personne.';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .transform((value) => value || null);

function list<T extends string>(codes: readonly T[]) {
  return z.array(z.enum(codes as [T, ...T[]])).transform((values) => [...new Set(values)]);
}

const today = () => new Date().toISOString().slice(0, 10);

/** Validation de la fiche, champ par champ. Les clés inconnues sont refusées. */
export const referralSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Indiquez le prénom.').max(80),
    lastName: z.string().trim().min(1, 'Indiquez le nom.').max(80),
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(254),
    phone: z
      .string()
      .trim()
      .max(30, 'Numéro trop long.')
      .refine((value) => value === '' || /^[0-9+().\s-]{6,30}$/.test(value), 'Numéro de téléphone invalide.')
      .transform((value) => value || null),
    ageBand: z
      .union([z.enum(Object.keys(AGE_BANDS) as [AgeBand, ...AgeBand[]]), z.literal('')])
      .transform((value) => (value || null) as AgeBand | null),
    reason: z.string().trim().min(10, 'Décrivez le motif en quelques mots (10 caractères au moins).').max(REASON_MAX, `${REASON_MAX} caractères au maximum.`),
    objectives: optionalText(OBJECTIVES_MAX),
    availabilityDays: list(DAY_CODES),
    availabilitySlots: list(SLOT_CODES),
    practicalConstraints: list(CONSTRAINT_CODES),
    constraintsDetails: optionalText(CONSTRAINTS_DETAILS_MAX),
    needsAccommodation: z.boolean(),
    programId: z.union([z.string().uuid(), z.literal('')]).transform((value) => value || null),
    desiredStartDate: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date invalide.')
      .refine((value) => value === '' || value >= today(), 'La date ne peut pas être passée.')
      .transform((value) => value || null),
    informed: z.literal(true, { message: 'Confirmez que la personne a reçu l’information sur le traitement de ses données.' }),
    consentImage: z.boolean(),
    consentShareResults: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const key of ['reason', 'objectives', 'constraintsDetails'] as const) {
      if (mentionsHealth(value[key])) context.addIssue({ code: 'custom', path: [key], message: HEALTH_MESSAGE });
    }
  });

export type ReferralInput = z.output<typeof referralSchema>;

/** Lecture d'un FormData (cases à cocher multiples, booléens oui/non). */
export function referralFormValues(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const yes = (key: string) => text(key) === 'oui' || text(key) === 'on';
  const many = (key: string) => formData.getAll(key).filter((value): value is string => typeof value === 'string');
  return {
    firstName: text('firstName'),
    lastName: text('lastName'),
    email: text('email'),
    phone: text('phone'),
    ageBand: text('ageBand'),
    reason: text('reason'),
    objectives: text('objectives'),
    availabilityDays: many('availabilityDays'),
    availabilitySlots: many('availabilitySlots'),
    practicalConstraints: many('practicalConstraints'),
    constraintsDetails: text('constraintsDetails'),
    needsAccommodation: yes('needsAccommodation'),
    programId: text('programId'),
    desiredStartDate: text('desiredStartDate'),
    informed: yes('informed'),
    consentImage: yes('consentImage'),
    consentShareResults: yes('consentShareResults'),
  };
}

/** Colonnes de la table referrals : la fiche n'écrit rien d'autre. */
export function referralRow(input: ReferralInput, organizationId: string) {
  return {
    organization_id: organizationId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    age_band: input.ageBand,
    reason: input.reason,
    objectives: input.objectives,
    availability_days: input.availabilityDays,
    availability_slots: input.availabilitySlots,
    practical_constraints: input.practicalConstraints,
    constraints_details: input.constraintsDetails,
    needs_accommodation: input.needsAccommodation,
    program_id: input.programId,
    desired_start_date: input.desiredStartDate,
    // Horodatage posé par la base (déclencheur) : la valeur envoyée ne fait que confirmer la case.
    information_acknowledged_at: new Date().toISOString(),
    information_version: INFORMATION_VERSION,
    consent_image: input.consentImage,
    consent_share_results: input.consentShareResults,
  };
}

/** « Inès Benali » → « Inès B. » : pour les e-mails et notifications (minimisation). */
export function shortName(firstName: string | null | undefined, lastName: string | null | undefined) {
  const first = firstName?.trim() ?? '';
  const initial = lastName?.trim().charAt(0).toUpperCase();
  return [first, initial ? `${initial}.` : ''].filter(Boolean).join(' ') || 'la personne';
}

export function labelsOf<T extends string>(codes: readonly string[] | null | undefined, labels: Record<T, string>) {
  return (codes ?? []).filter((code): code is T => code in labels).map((code) => labels[code]);
}
