/** Rôles applicatifs (table public.roles). Module sans dépendance serveur : utilisable partout. */
export const ROLES = ['participant', 'organisme', 'formateur', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  participant: 'Participant',
  organisme: 'Organisme',
  formateur: 'Formateur',
  admin: 'Administrateur',
};

export const ROLE_HOME: Record<Role, string> = {
  participant: '/participant/dashboard',
  organisme: '/organisme/dashboard',
  formateur: '/formateur/dashboard',
  admin: '/admin/dashboard',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Permissions fines (table public.permissions). L'administrateur les possède toutes. */
export type PermissionCode =
  | 'groups.manage'
  | 'sessions.manage'
  | 'attendance.write'
  | 'evaluations.write'
  | 'participants.directory'
  | 'participants.link_organization'
  | 'content.read'
  | 'org.evaluations.read'
  | 'org.attendance.read'
  | 'org.exports';

export const ORGANIZATION_TYPES = {
  mission_locale: 'Mission Locale',
  france_travail: 'France Travail',
  ecole: 'École ou établissement d’enseignement',
  organisme_formation: 'Organisme de formation',
  structure_insertion: 'Structure d’insertion',
  entreprise: 'Entreprise',
  autre: 'Autre structure',
} as const;
export type OrganizationType = keyof typeof ORGANIZATION_TYPES;

export const ORGANIZATION_STATUS_LABELS = {
  pending: 'En attente de validation',
  active: 'Actif',
  suspended: 'Suspendu',
  rejected: 'Demande refusée',
} as const;
export type OrganizationStatus = keyof typeof ORGANIZATION_STATUS_LABELS;
