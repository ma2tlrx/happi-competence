/**
 * Description des formulaires du module qualité (module pur) : les pages serveur construisent
 * la liste des champs, préremplie, et la confient au composant RecordDialog.
 */
import {
  ACTION_ORIGINS,
  ACTION_STATUSES,
  AI_TRAINING_HINT,
  COMPLAINT_CHANNELS,
  COMPLAINT_SOURCES,
  COMPLAINT_STATUSES,
  NO_HEALTH_DATA_NOTICE,
  PREREQUISITES_MET,
  QUALIFICATION_KINDS,
  WATCH_KINDS,
} from './labels';

export type FieldSpec = {
  name: string;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'date' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  defaultValue?: string | boolean | null;
  maxLength?: number;
  max?: string;
  /** Champ affiché seulement si un autre champ (liste) a l'une de ces valeurs. */
  showWhen?: { field: string; values: string[] };
};

const options = (labels: Record<string, string | { label: string }>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label: typeof label === 'string' ? label : label.label }));

export type ComplaintDefaults = {
  source?: string;
  channel?: string;
  receivedOn?: string;
  subject?: string;
  description?: string;
  reporterName?: string | null;
  status?: string;
  response?: string | null;
  respondedOn?: string | null;
};

export function complaintFields(today: string, value: ComplaintDefaults = {}): FieldSpec[] {
  return [
    { name: 'source', label: 'Source', kind: 'select', options: options(COMPLAINT_SOURCES), required: true, defaultValue: value.source ?? '' },
    { name: 'channel', label: 'Canal de réception', kind: 'select', options: options(COMPLAINT_CHANNELS), required: true, defaultValue: value.channel ?? '' },
    { name: 'receivedOn', label: 'Date de réception', kind: 'date', required: true, max: today, defaultValue: value.receivedOn ?? today },
    { name: 'reporterName', label: 'Émetteur', kind: 'text', maxLength: 200, hint: 'Nom ou fonction de la personne, si utile au suivi.', defaultValue: value.reporterName },
    { name: 'subject', label: 'Objet', kind: 'text', required: true, maxLength: 200, defaultValue: value.subject },
    { name: 'description', label: 'Description', kind: 'textarea', required: true, maxLength: 4000, defaultValue: value.description },
    { name: 'status', label: 'Statut', kind: 'select', options: options(COMPLAINT_STATUSES), required: true, defaultValue: value.status ?? 'received' },
    {
      name: 'response',
      label: 'Réponse apportée',
      kind: 'textarea',
      maxLength: 4000,
      hint: 'Obligatoire pour marquer la réclamation traitée ou close. Visible de l’auteur s’il l’a déposée depuis son espace.',
      defaultValue: value.response,
    },
    { name: 'respondedOn', label: 'Date de la réponse', kind: 'date', max: today, defaultValue: value.respondedOn },
  ];
}

export type ActionDefaults = {
  origin?: string;
  originDetails?: string | null;
  complaintId?: string | null;
  watchEntryId?: string | null;
  title?: string;
  description?: string | null;
  ownerName?: string | null;
  dueOn?: string | null;
  status?: string;
  effectiveness?: string | null;
};

export function improvementActionFields(
  value: ActionDefaults,
  links: { complaints: { id: string; label: string }[]; watch: { id: string; label: string }[] },
): FieldSpec[] {
  return [
    { name: 'origin', label: 'Origine', kind: 'select', options: options(ACTION_ORIGINS), required: true, defaultValue: value.origin ?? '' },
    {
      name: 'complaintId',
      label: 'Réclamation liée',
      kind: 'select',
      required: true,
      options: links.complaints.map((item) => ({ value: item.id, label: item.label })),
      defaultValue: value.complaintId,
      showWhen: { field: 'origin', values: ['reclamation'] },
    },
    {
      name: 'watchEntryId',
      label: 'Entrée de veille liée',
      kind: 'select',
      required: true,
      options: links.watch.map((item) => ({ value: item.id, label: item.label })),
      defaultValue: value.watchEntryId,
      showWhen: { field: 'origin', values: ['veille'] },
    },
    {
      name: 'originDetails',
      label: 'Précision sur l’origine',
      kind: 'text',
      maxLength: 300,
      hint: 'Par exemple : enquête à chaud, groupe, période ; rapport d’audit du…',
      defaultValue: value.originDetails,
    },
    { name: 'title', label: 'Action', kind: 'text', required: true, maxLength: 200, defaultValue: value.title },
    { name: 'description', label: 'Description', kind: 'textarea', maxLength: 4000, defaultValue: value.description },
    { name: 'ownerName', label: 'Responsable', kind: 'text', maxLength: 120, defaultValue: value.ownerName },
    { name: 'dueOn', label: 'Échéance', kind: 'date', defaultValue: value.dueOn },
    { name: 'status', label: 'Statut', kind: 'select', options: options(ACTION_STATUSES), required: true, defaultValue: value.status ?? 'planned' },
    {
      name: 'effectiveness',
      label: 'Efficacité constatée',
      kind: 'textarea',
      maxLength: 2000,
      hint: 'Ce que l’action a changé, comment vous l’avez vérifié.',
      defaultValue: value.effectiveness,
    },
  ];
}

export type WatchDefaults = { kind?: string; source?: string; observedOn?: string; summary?: string; impact?: string | null; decision?: string | null };

export function watchEntryFields(today: string, value: WatchDefaults = {}): FieldSpec[] {
  return [
    { name: 'kind', label: 'Type de veille', kind: 'select', options: options(WATCH_KINDS), required: true, defaultValue: value.kind ?? '' },
    { name: 'source', label: 'Source', kind: 'text', required: true, maxLength: 300, hint: 'Texte, site, publication, événement…', defaultValue: value.source },
    { name: 'observedOn', label: 'Date', kind: 'date', required: true, max: today, defaultValue: value.observedOn ?? today },
    { name: 'summary', label: 'Résumé', kind: 'textarea', required: true, maxLength: 4000, defaultValue: value.summary },
    { name: 'impact', label: 'Impact pour HAPPI', kind: 'textarea', maxLength: 4000, defaultValue: value.impact },
    {
      name: 'decision',
      label: 'Action décidée',
      kind: 'textarea',
      maxLength: 2000,
      hint: 'Si une action s’impose, ajoutez-la ensuite au plan d’amélioration (origine « Veille »).',
      defaultValue: value.decision,
    },
  ];
}

export type QualificationDefaults = {
  kind?: string;
  title?: string;
  provider?: string | null;
  description?: string | null;
  startedOn?: string | null;
  completedOn?: string | null;
  isAiTraining?: boolean;
  evidence?: string | null;
};

export function qualificationFields(value: QualificationDefaults = {}): FieldSpec[] {
  return [
    { name: 'kind', label: 'Type', kind: 'select', options: options(QUALIFICATION_KINDS), required: true, defaultValue: value.kind ?? '' },
    { name: 'title', label: 'Intitulé', kind: 'text', required: true, maxLength: 200, defaultValue: value.title },
    { name: 'provider', label: 'Organisme, établissement ou employeur', kind: 'text', maxLength: 200, defaultValue: value.provider },
    { name: 'description', label: 'Précisions', kind: 'textarea', maxLength: 2000, defaultValue: value.description },
    { name: 'startedOn', label: 'Date de début', kind: 'date', defaultValue: value.startedOn },
    { name: 'completedOn', label: 'Date d’obtention ou de fin', kind: 'date', defaultValue: value.completedOn },
    {
      name: 'isAiTraining',
      label: 'Formation à l’usage de l’intelligence artificielle',
      kind: 'checkbox',
      hint: AI_TRAINING_HINT,
      defaultValue: value.isAiTraining ?? false,
      showWhen: { field: 'kind', values: ['formation'] },
    },
    {
      name: 'evidence',
      label: 'Pièce justificative',
      kind: 'text',
      maxLength: 500,
      hint: 'Référence du document (ex. « attestation classée au dossier RH ») ou adresse https:// où il est conservé. Aucun fichier n’est déposé ici.',
      defaultValue: value.evidence,
    },
  ];
}

export type NeedsDefaults = {
  assessedOn?: string;
  expectations?: string | null;
  constraintsNotes?: string | null;
  prerequisites?: string | null;
  prerequisitesMet?: string | null;
  adaptationNeeded?: boolean;
  adaptationPlanned?: string | null;
  disabilityReferent?: string | null;
};

export function needsAssessmentFields(today: string, value: NeedsDefaults = {}): FieldSpec[] {
  return [
    { name: 'assessedOn', label: 'Date du positionnement', kind: 'date', required: true, max: today, defaultValue: value.assessedOn ?? today },
    { name: 'expectations', label: 'Attentes du participant et du prescripteur', kind: 'textarea', maxLength: 2000, defaultValue: value.expectations },
    {
      name: 'constraintsNotes',
      label: 'Contraintes',
      kind: 'textarea',
      maxLength: 2000,
      hint: 'Horaires, transport, garde d’enfants, emploi… Sans information de santé.',
      defaultValue: value.constraintsNotes,
    },
    { name: 'prerequisites', label: 'Prérequis vérifiés', kind: 'textarea', maxLength: 2000, defaultValue: value.prerequisites },
    {
      name: 'prerequisitesMet',
      label: 'Prérequis atteints',
      kind: 'select',
      options: Object.entries(PREREQUISITES_MET).map(([code, label]) => ({ value: code, label })),
      defaultValue: value.prerequisitesMet,
    },
    {
      name: 'adaptationNeeded',
      label: 'Besoin d’adaptation de l’accompagnement',
      kind: 'select',
      required: true,
      options: [
        { value: 'non', label: 'Non' },
        { value: 'oui', label: 'Oui' },
      ],
      hint: NO_HEALTH_DATA_NOTICE,
      defaultValue: value.adaptationNeeded === undefined ? '' : value.adaptationNeeded ? 'oui' : 'non',
    },
    {
      name: 'adaptationPlanned',
      label: 'Adaptation prévue',
      kind: 'textarea',
      required: true,
      maxLength: 1000,
      hint: 'Par exemple : pauses plus fréquentes, supports en gros caractères, salle accessible. Jamais la nature d’un handicap.',
      defaultValue: value.adaptationPlanned,
      showWhen: { field: 'adaptationNeeded', values: ['oui'] },
    },
    {
      name: 'disabilityReferent',
      label: 'Référent handicap',
      kind: 'text',
      maxLength: 200,
      hint: 'Nom et coordonnées professionnelles du référent handicap mobilisé, le cas échéant.',
      defaultValue: value.disabilityReferent,
    },
  ];
}
