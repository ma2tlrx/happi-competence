/**
 * Champs des formulaires financeurs et conventions (module pur), confiés au composant
 * générique RecordDialog par les pages serveur.
 */
import type { FieldSpec } from '@/lib/quality/forms';

import { CONVENTION_STATUSES, FUNDER_KINDS } from './labels';

const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

export type FunderDefaults = { name?: string; kind?: string; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null };

export function funderFields(value: FunderDefaults = {}): FieldSpec[] {
  return [
    { name: 'name', label: 'Nom du financeur', kind: 'text', required: true, maxLength: 200, hint: 'Ex. France Travail Occitanie, Région Occitanie, OPCO EP.', defaultValue: value.name },
    { name: 'kind', label: 'Type de financeur', kind: 'select', options: options(FUNDER_KINDS), required: true, defaultValue: value.kind ?? '' },
    { name: 'contactName', label: 'Contact', kind: 'text', maxLength: 200, hint: 'Nom ou fonction de l’interlocuteur.', defaultValue: value.contactName },
    { name: 'contactEmail', label: 'E-mail du contact', kind: 'text', maxLength: 320, defaultValue: value.contactEmail },
    { name: 'contactPhone', label: 'Téléphone du contact', kind: 'text', maxLength: 40, defaultValue: value.contactPhone },
  ];
}

export type ConventionDefaults = {
  funderId?: string;
  reference?: string | null;
  title?: string;
  startDate?: string;
  endDate?: string;
  plannedParticipants?: number;
  plannedHours?: number;
  amount?: number | null;
  status?: string;
  notes?: string | null;
};

const frenchNumber = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value).replace('.', ','));

export function conventionFields(funders: { id: string; name: string }[], value: ConventionDefaults = {}): FieldSpec[] {
  return [
    {
      name: 'funderId',
      label: 'Financeur',
      kind: 'select',
      options: funders.map((funder) => ({ value: funder.id, label: funder.name })),
      required: true,
      defaultValue: value.funderId ?? '',
    },
    { name: 'reference', label: 'Référence', kind: 'text', maxLength: 120, hint: 'Numéro de convention, de marché ou de bon de commande.', defaultValue: value.reference },
    { name: 'title', label: 'Intitulé de l’action', kind: 'text', required: true, maxLength: 200, defaultValue: value.title },
    { name: 'startDate', label: 'Début de la période', kind: 'date', required: true, defaultValue: value.startDate },
    { name: 'endDate', label: 'Fin de la période', kind: 'date', required: true, defaultValue: value.endDate },
    { name: 'plannedParticipants', label: 'Participants conventionnés', kind: 'text', required: true, maxLength: 5, defaultValue: value.plannedParticipants ? String(value.plannedParticipants) : '' },
    {
      name: 'plannedHours',
      label: 'Durée prévue par participant (heures)',
      kind: 'text',
      required: true,
      maxLength: 7,
      hint: 'Telle qu’inscrite à la convention (ex. 18).',
      defaultValue: frenchNumber(value.plannedHours),
    },
    { name: 'amount', label: 'Montant conventionné (€)', kind: 'text', maxLength: 16, hint: 'Facultatif. Jamais affiché aux organismes.', defaultValue: frenchNumber(value.amount) },
    { name: 'status', label: 'Statut', kind: 'select', options: options(CONVENTION_STATUSES), required: true, defaultValue: value.status ?? 'brouillon' },
    { name: 'notes', label: 'Notes internes', kind: 'textarea', maxLength: 4000, hint: 'Visibles des seuls administrateurs.', defaultValue: value.notes },
  ];
}
