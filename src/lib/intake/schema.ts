import { z } from 'zod';

import {
  AGE_BANDS,
  EXPERIENCES,
  RESIDENCES,
  SECTORS,
  SITUATIONS,
  STUDY_LEVELS,
  TWO_YEAR_PLANS,
  VOLUNTEERING,
  VOLUNTEERING_FIELDS,
  type IntakeStep,
} from './codes';

/**
 * Validation du questionnaire d'accueil, étape par étape. Les champs obligatoires sont ceux de l'ancien
 * formulaire : âge, situation et ville (étape 1), niveau d'études (2), bénévolat et expérience (3),
 * projet à deux ans (4). Les aptitudes (5) sont facultatives. Module pur (serveur et navigateur).
 */

const pick = <T extends Record<string, unknown>>(values: T, message: string) =>
  z.enum(Object.keys(values) as [keyof T & string, ...(keyof T & string)[]], { message });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères au maximum.`)
    .transform((value) => value || null)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const several = <T extends Record<string, unknown>>(values: T) =>
  z
    .array(z.enum(Object.keys(values) as [keyof T & string, ...(keyof T & string)[]]))
    .max(Object.keys(values).length)
    .optional()
    .transform((list) => [...new Set(list ?? [])]);

const rating = z
  .union([z.number().int().min(1).max(5), z.null()])
  .optional()
  .transform((value) => value ?? null);

/** Téléphone : chiffres, espaces, points, tirets, parenthèses et « + », de 10 à 20 caractères. */
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ' '))
  .refine((value) => value === '' || (/^[+()\d .-]{10,20}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 10), 'Numéro de téléphone invalide.')
  .transform((value) => value || null)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const stepSchemas = {
  1: z
    .object({
      age_band: pick(AGE_BANDS, 'Indique ton âge.'),
      situation: pick(SITUATIONS, 'Indique ta situation actuelle.'),
      residence: pick(RESIDENCES, 'Indique ta ville.'),
      residence_detail: optionalText(120, 'Ville ou village'),
      phone,
    })
    // La précision n'a de sens que pour « Villages alentours » et « Autre ville ».
    .transform((value) => ({ ...value, residence_detail: value.residence === 'beziers' ? null : value.residence_detail })),
  2: z.object({
    study_level: pick(STUDY_LEVELS, 'Indique ton niveau d’études.'),
    study_field: optionalText(200, 'Domaine'),
    school: optionalText(200, 'Établissement'),
  }),
  3: z
    .object({
      volunteering: pick(VOLUNTEERING, 'Indique si tu pratiques une activité bénévole.'),
      volunteering_fields: several(VOLUNTEERING_FIELDS),
      experience: pick(EXPERIENCES, 'Indique si tu as une expérience professionnelle.'),
      experience_detail: optionalText(1000, 'Description'),
    })
    // Les précisions suivent les réponses : pas de domaine sans bénévolat, pas de description sans expérience.
    .transform((value) => ({
      ...value,
      volunteering_fields: value.volunteering === 'jamais' ? [] : value.volunteering_fields,
      experience_detail: value.experience === 'aucune' ? null : value.experience_detail,
    })),
  4: z.object({
    sectors: several(SECTORS),
    ambitions: optionalText(1000, 'Ambitions'),
    two_year_plan: pick(TWO_YEAR_PLANS, 'Indique ce que tu souhaites dans 2 ans.'),
  }),
  5: z.object({
    aptitude_punctuality: rating,
    aptitude_motivation: rating,
    aptitude_communication: rating,
    aptitude_initiative: rating,
  }),
} as const;

export type StepValues<S extends IntakeStep> = z.output<(typeof stepSchemas)[S]>;

export function isIntakeStep(value: unknown): value is IntakeStep {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** Valide une étape ; renvoie les colonnes à enregistrer (le téléphone est à part : il vit sur la fiche participant). */
export function parseStep(step: IntakeStep, input: unknown) {
  const result = stepSchemas[step].safeParse(input);
  if (!result.success) return { ok: false as const, error: result.error };
  const { phone: phoneValue, ...columns } = result.data as Record<string, unknown> & { phone?: string | null };
  return { ok: true as const, columns, phone: step === 1 ? (phoneValue ?? null) : undefined };
}
