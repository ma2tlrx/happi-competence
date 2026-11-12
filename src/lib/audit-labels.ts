/** Libellés lisibles des actions du journal d'activité (le code technique reste consultable). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'organization.requested': 'Demande d’espace organisme',
  'organization.status_changed': 'Statut d’organisme modifié',
  'evaluation.validated': 'Évaluation validée',
  'evaluation.amended': 'Évaluation modifiée',
  'invitation_code.used': 'Code d’accès utilisé',
  'invitation_code.created': 'Code d’accès créé',
  'group.created': 'Groupe créé',
  'user.role_changed': 'Rôle modifié',
  'auth.signed_in': 'Connexion',
  'auth.password_changed': 'Mot de passe modifié',
  'export.passport_pdf': 'Passeport exporté',
  'export.attendance_pdf': 'Feuille de présence exportée (PDF)',
  'export.attendance_csv': 'Feuille de présence exportée (CSV)',
  'export.participants_csv': 'Liste des participants exportée',
  'export.personal_data': 'Export des données personnelles',
  'export.report_pdf': 'Bilan téléchargé',
  'participant_file.viewed': 'Fiche participant consultée',
  'report.created': 'Bilan créé',
  'report.content_updated': 'Texte d’un bilan modifié',
  'report.finalized': 'Bilan validé',
  'satisfaction.submitted': 'Réponse à une enquête de satisfaction',
  'satisfaction.version_created': 'Version d’enquête de satisfaction créée',
  'satisfaction.version_published': 'Enquête de satisfaction publiée',
  'demo.created': 'Démonstration créée',
  'demo.deleted': 'Démonstration supprimée',
  'demo.space_opened': 'Espace de démonstration ouvert',
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/** Détails d'une entrée du journal, en « clé : valeur » lisibles plutôt qu'en JSON brut. */
export function auditDetails(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return '';
  return Object.entries(metadata as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replaceAll('_', ' ')} : ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}
