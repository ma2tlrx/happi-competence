/**
 * Libellés du module qualité. Module sans dépendance serveur.
 *
 * Les codes reprennent ceux autorisés par la base (migration 20261116090000_quality_module.sql).
 * Les correspondances avec le Référentiel national qualité (Qualiopi) sont INDICATIVES : elles
 * reprennent la numérotation 2019 citée dans docs/annexes-strategie/conformite-modele-economique.md
 * (§1.2), alors que le référentiel a été modifié au 1er novembre 2026 (décret n° 2026-728).
 */

export const QUALIOPI_DISCLAIMER = 'Correspondance indicative, à vérifier avec votre certificateur.';
export const QUALIOPI_NUMBERING_NOTE =
  'Numérotation 2019 du Référentiel national qualité ; le référentiel a été modifié au 1er novembre 2026 (décret n° 2026-728) : vérifiez la correspondance avec la version en vigueur.';

/** Correspondances indicatives : critère et plage d'indicateurs cités par l'annexe de conformité. */
export const QUALIOPI_HINTS = {
  results: 'Critère 1 (indicateurs 1 à 3) : indicateurs de résultats publiés',
  needs: 'Critère 2 (indicateurs 4 à 8) : analyse du besoin et positionnement à l’entrée',
  dropouts: 'Critère 3 (indicateur 12) : prévention des abandons',
  adaptation: 'Critère 4 (indicateurs 17 à 20) : besoins d’adaptation, référent handicap',
  trainers: 'Critère 5 (indicateurs 21 et 22) : compétences et formation des intervenants',
  watch: 'Critère 6 (indicateurs 23 à 29) : veille',
  improvement: 'Critère 7 (indicateurs 30 à 32) : appréciations, réclamations, amélioration continue',
} as const;
export type QualiopiHint = keyof typeof QUALIOPI_HINTS;

// ── Réclamations ─────────────────────────────────────────────────────────────
export const COMPLAINT_SOURCES = {
  participant: 'Participant',
  prescripteur: 'Prescripteur',
  financeur: 'Financeur',
  autre: 'Autre',
} as const;
export type ComplaintSource = keyof typeof COMPLAINT_SOURCES;
export const COMPLAINT_SOURCE_CODES = Object.keys(COMPLAINT_SOURCES) as [ComplaintSource, ...ComplaintSource[]];

export const COMPLAINT_CHANNELS = {
  espace_en_ligne: 'Espace en ligne',
  telephone: 'Téléphone',
  email: 'E-mail',
  courrier: 'Courrier',
  entretien: 'Entretien',
  autre: 'Autre',
} as const;
export type ComplaintChannel = keyof typeof COMPLAINT_CHANNELS;
export const COMPLAINT_CHANNEL_CODES = Object.keys(COMPLAINT_CHANNELS) as [ComplaintChannel, ...ComplaintChannel[]];

export const COMPLAINT_STATUSES = {
  received: { label: 'Reçue', variant: 'orange' },
  in_progress: { label: 'En cours', variant: 'warning' },
  resolved: { label: 'Traitée', variant: 'success' },
  closed: { label: 'Close', variant: 'neutral' },
} as const;
export type ComplaintStatus = keyof typeof COMPLAINT_STATUSES;
export const COMPLAINT_STATUS_CODES = Object.keys(COMPLAINT_STATUSES) as [ComplaintStatus, ...ComplaintStatus[]];
export const OPEN_COMPLAINT_STATUSES: readonly ComplaintStatus[] = ['received', 'in_progress'];

// ── Plan d'amélioration ──────────────────────────────────────────────────────
export const ACTION_ORIGINS = {
  reclamation: 'Réclamation',
  satisfaction: 'Satisfaction',
  audit: 'Audit',
  veille: 'Veille',
  retour_formateur: 'Retour d’un formateur',
  autre: 'Autre',
} as const;
export type ActionOrigin = keyof typeof ACTION_ORIGINS;
export const ACTION_ORIGIN_CODES = Object.keys(ACTION_ORIGINS) as [ActionOrigin, ...ActionOrigin[]];

export const ACTION_STATUSES = {
  planned: { label: 'Prévue', variant: 'orange' },
  in_progress: { label: 'En cours', variant: 'warning' },
  done: { label: 'Réalisée', variant: 'success' },
  abandoned: { label: 'Abandonnée', variant: 'neutral' },
} as const;
export type ActionStatus = keyof typeof ACTION_STATUSES;
export const ACTION_STATUS_CODES = Object.keys(ACTION_STATUSES) as [ActionStatus, ...ActionStatus[]];
export const OPEN_ACTION_STATUSES: readonly ActionStatus[] = ['planned', 'in_progress'];

// ── Veille ───────────────────────────────────────────────────────────────────
export const WATCH_KINDS = {
  legale: 'Légale et réglementaire',
  metiers: 'Métiers et emploi',
  pedagogique: 'Pédagogique et technologique',
  handicap: 'Handicap et accessibilité',
} as const;
export type WatchKind = keyof typeof WATCH_KINDS;
export const WATCH_KIND_CODES = Object.keys(WATCH_KINDS) as [WatchKind, ...WatchKind[]];

// ── Registre des intervenants ────────────────────────────────────────────────
export const QUALIFICATION_KINDS = {
  diplome: 'Diplôme',
  qualification: 'Qualification ou certification',
  experience: 'Expérience professionnelle',
  formation: 'Formation suivie',
} as const;
export type QualificationKind = keyof typeof QUALIFICATION_KINDS;
export const QUALIFICATION_KIND_CODES = Object.keys(QUALIFICATION_KINDS) as [QualificationKind, ...QualificationKind[]];

/** Seuil d'ancienneté d'une formation suivie, en mois : valeur par défaut PROVISOIRE, à valider. */
export const DEFAULT_TRAINING_MAX_AGE_MONTHS = 24;

export const AI_TRAINING_HINT =
  'Formation à l’usage de l’intelligence artificielle : l’article 4 du règlement européen sur l’IA demande aux organisations qui utilisent des systèmes d’IA d’assurer un niveau suffisant de maîtrise de l’IA à leur personnel.';

// ── Analyse du besoin ────────────────────────────────────────────────────────
export const PREREQUISITES_MET = {
  oui: 'Oui',
  partiellement: 'Partiellement',
  non: 'Non',
} as const;
export type PrerequisitesMet = keyof typeof PREREQUISITES_MET;
export const PREREQUISITES_MET_CODES = Object.keys(PREREQUISITES_MET) as [PrerequisitesMet, ...PrerequisitesMet[]];

export const NO_HEALTH_DATA_NOTICE =
  'Ne notez aucune information de santé ni la nature d’un handicap : indiquez seulement s’il faut adapter l’accompagnement et comment (horaires, supports, accessibilité des lieux…).';

/** Effectif minimal pour publier un indicateur sur la page publique. */
export const PUBLIC_MIN_N = 10;

export const SATISFACTION_RATE_DEFINITION =
  'Part des notes 4 ou 5 (sur 5) aux questions notées de l’enquête participants à chaud. Mode de calcul provisoire — à valider.';
export const COMPLETION_RATE_DEFINITION =
  'Part des parcours menés sans abandon (abandons déclarés exclus ; retraits pour erreur d’inscription non comptés). Mode de calcul provisoire — à valider.';
