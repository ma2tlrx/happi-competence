/**
 * Validation des formulaires du module qualité (module pur, partagé par les actions serveur).
 * La base revalide tout (contraintes et déclencheurs) : ces schémas donnent des messages clairs.
 */
import { z } from 'zod';

import '@/lib/zod-fr';

import {
  ACTION_ORIGIN_CODES,
  ACTION_STATUS_CODES,
  COMPLAINT_CHANNEL_CODES,
  COMPLAINT_SOURCE_CODES,
  COMPLAINT_STATUS_CODES,
  PREREQUISITES_MET_CODES,
  QUALIFICATION_KIND_CODES,
  WATCH_KIND_CODES,
} from './labels';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const text = (max: number, message = `${max} caractères au plus.`) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const requiredText = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} : ${min} caractères au moins.`).max(max, `${label} : ${max} caractères au plus.`);

const pastDate = (today: string, label = 'La date') =>
  z
    .string()
    .trim()
    .regex(ISO, 'Date invalide.')
    .refine((value) => value <= today, `${label} ne peut pas être dans le futur.`);

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === '' || ISO.test(value), 'Date invalide.')
  .transform((value) => value || null);

const optionalUuid = z.union([z.string().uuid(), z.literal('')]).transform((value) => value || null);
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === 'on' || value === 'true');

export function complaintSchema(today: string) {
  return z
    .object({
      source: z.enum(COMPLAINT_SOURCE_CODES, 'Choisissez la source.'),
      channel: z.enum(COMPLAINT_CHANNEL_CODES, 'Choisissez le canal.'),
      receivedOn: pastDate(today, 'La date de réception'),
      subject: requiredText(3, 200, 'Objet'),
      description: requiredText(1, 4000, 'Description'),
      reporterName: text(200),
      status: z.enum(COMPLAINT_STATUS_CODES, 'Choisissez le statut.'),
      response: text(4000),
      respondedOn: optionalDate.refine((value) => !value || value <= today, 'La date de réponse ne peut pas être dans le futur.'),
    })
    .superRefine((value, ctx) => {
      if ((value.status === 'resolved' || value.status === 'closed') && !value.response) {
        ctx.addIssue({ code: 'custom', path: ['response'], message: 'Indiquez la réponse apportée avant de marquer la réclamation traitée.' });
      }
      if ((value.status === 'resolved' || value.status === 'closed') && !value.respondedOn) {
        ctx.addIssue({ code: 'custom', path: ['respondedOn'], message: 'Indiquez la date de la réponse.' });
      }
      if (value.respondedOn && value.respondedOn < value.receivedOn) {
        ctx.addIssue({ code: 'custom', path: ['respondedOn'], message: 'La réponse ne peut pas précéder la réception.' });
      }
    });
}

export const reportSchema = z.object({
  subject: requiredText(3, 200, 'Objet'),
  description: requiredText(10, 4000, 'Description'),
});

export function improvementActionSchema() {
  return z
    .object({
      origin: z.enum(ACTION_ORIGIN_CODES, 'Choisissez l’origine.'),
      originDetails: text(300),
      complaintId: optionalUuid,
      watchEntryId: optionalUuid,
      title: requiredText(3, 200, 'Intitulé'),
      description: text(4000),
      ownerName: text(120),
      dueOn: optionalDate,
      status: z.enum(ACTION_STATUS_CODES, 'Choisissez le statut.'),
      effectiveness: text(2000),
    })
    .superRefine((value, ctx) => {
      if (value.origin === 'reclamation' && !value.complaintId) {
        ctx.addIssue({ code: 'custom', path: ['complaintId'], message: 'Choisissez la réclamation à l’origine de l’action.' });
      }
      if (value.origin === 'veille' && !value.watchEntryId) {
        ctx.addIssue({ code: 'custom', path: ['watchEntryId'], message: 'Choisissez l’entrée de veille à l’origine de l’action.' });
      }
    })
    .transform((value) => ({
      ...value,
      // Un lien n'a de sens que pour l'origine correspondante.
      complaintId: value.origin === 'reclamation' ? value.complaintId : null,
      watchEntryId: value.origin === 'veille' ? value.watchEntryId : null,
    }));
}

export function watchEntrySchema(today: string) {
  return z.object({
    kind: z.enum(WATCH_KIND_CODES, 'Choisissez le type de veille.'),
    source: requiredText(2, 300, 'Source'),
    observedOn: pastDate(today),
    summary: requiredText(3, 4000, 'Résumé'),
    impact: text(4000),
    decision: text(2000),
  });
}

export const qualificationSchema = z
  .object({
    kind: z.enum(QUALIFICATION_KIND_CODES, 'Choisissez le type.'),
    title: requiredText(2, 200, 'Intitulé'),
    provider: text(200),
    description: text(2000),
    startedOn: optionalDate,
    completedOn: optionalDate,
    isAiTraining: checkbox,
    evidence: text(500),
  })
  .superRefine((value, ctx) => {
    if (value.startedOn && value.completedOn && value.completedOn < value.startedOn) {
      ctx.addIssue({ code: 'custom', path: ['completedOn'], message: 'La date de fin précède la date de début.' });
    }
    if (value.isAiTraining && value.kind !== 'formation') {
      ctx.addIssue({ code: 'custom', path: ['isAiTraining'], message: 'Seule une formation suivie peut être une formation à l’usage de l’IA.' });
    }
    if (value.evidence && /^[a-z]+:/i.test(value.evidence) && !/^https?:\/\//i.test(value.evidence)) {
      ctx.addIssue({ code: 'custom', path: ['evidence'], message: 'Une adresse doit commencer par https:// (ou indiquez une simple référence).' });
    }
  });

export function needsAssessmentSchema(today: string) {
  return z
    .object({
      assessedOn: pastDate(today),
      expectations: text(2000),
      constraintsNotes: text(2000),
      prerequisites: text(2000),
      prerequisitesMet: z.union([z.enum(PREREQUISITES_MET_CODES), z.literal('')]).transform((value) => value || null),
      adaptationNeeded: z.enum(['oui', 'non'], 'Indiquez s’il faut adapter l’accompagnement.').transform((value) => value === 'oui'),
      adaptationPlanned: text(1000),
      disabilityReferent: text(200),
    })
    .superRefine((value, ctx) => {
      if (value.adaptationNeeded && !value.adaptationPlanned) {
        ctx.addIssue({ code: 'custom', path: ['adaptationPlanned'], message: 'Décrivez l’adaptation prévue (sans détail médical).' });
      }
    })
    .transform((value) => ({ ...value, adaptationPlanned: value.adaptationNeeded ? value.adaptationPlanned : null }));
}

export const periodSchema = z
  .object({ from: z.string().regex(ISO, 'Date de début invalide.'), to: z.string().regex(ISO, 'Date de fin invalide.') })
  .refine((value) => value.to >= value.from, { path: ['to'], message: 'La fin de période précède le début.' });

/** Lien de pièce justificative cliquable uniquement s'il s'agit d'une adresse web. */
export function evidenceHref(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https?:\/\/[^\s]+$/i.test(value.trim()) ? value.trim() : null;
}
