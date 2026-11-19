/**
 * Validation des formulaires financeurs et conventions (module pur, partagé par les actions
 * serveur). La base revalide tout (contraintes, RLS) : ces schémas donnent des messages clairs.
 */
import { z } from 'zod';

import '@/lib/zod-fr';

import { CONVENTION_STATUS_CODES, FUNDER_KIND_CODES } from './labels';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au plus.`)
    .transform((value) => value || null);

const requiredText = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} : ${min} caractères au moins.`).max(max, `${label} : ${max} caractères au plus.`);

/** Nombre saisi en français (virgule décimale, espaces de milliers tolérés). */
const decimal = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));

export const funderSchema = z.object({
  name: requiredText(2, 200, 'Nom'),
  kind: z.enum(FUNDER_KIND_CODES, 'Choisissez le type de financeur.'),
  contactName: text(200),
  contactEmail: z
    .string()
    .trim()
    .max(320, '320 caractères au plus.')
    .refine((value) => value === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), 'Adresse e-mail invalide.')
    .transform((value) => value.toLowerCase() || null),
  contactPhone: text(40),
});

export const conventionSchema = z
  .object({
    funderId: z.string().uuid('Choisissez le financeur.'),
    reference: text(120),
    title: requiredText(2, 200, 'Intitulé'),
    startDate: z.string().trim().regex(ISO, 'Date invalide.'),
    endDate: z.string().trim().regex(ISO, 'Date invalide.'),
    plannedParticipants: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Nombre entier attendu.')
      .transform(Number)
      .refine((value) => value >= 1 && value <= 10000, 'Entre 1 et 10 000 participants.'),
    plannedHours: z
      .string()
      .trim()
      .regex(/^\d+([.,]\d{1,2})?$/, 'Nombre d’heures attendu (ex. 18 ou 17,5).')
      .transform(decimal)
      .refine((value) => value > 0 && value <= 2000, 'Entre 0 et 2 000 heures.'),
    amount: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d{1,10}([.,]\d{1,2})?$/.test(value.replace(/\s/g, '')), 'Montant invalide (ex. 12 500 ou 12500,50).')
      .transform((value) => (value === '' ? null : decimal(value))),
    status: z.enum(CONVENTION_STATUS_CODES, 'Choisissez le statut.'),
    notes: text(4000),
  })
  .refine((value) => value.endDate >= value.startDate, { path: ['endDate'], message: 'La fin doit suivre le début.' });

export const attachSchema = z.object({ groupId: z.string().uuid('Choisissez un groupe.') });

export function parseYear(value: unknown, fallback: number) {
  const year = typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return year >= 2000 && year <= 2100 ? year : fallback;
}
