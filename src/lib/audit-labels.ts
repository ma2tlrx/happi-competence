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
  'auth.mfa_enabled': 'Double authentification activée',
  'auth.mfa_disabled': 'Double authentification désactivée',
  'security.rate_limited': 'Trop de tentatives (limite atteinte)',
  'settings.updated': 'Paramètre modifié',
  'export.passport_pdf': 'Passeport exporté',
  'export.attendance_pdf': 'Feuille de présence exportée (PDF)',
  'export.attendance_csv': 'Feuille de présence exportée (CSV)',
  'export.participants_csv': 'Liste des participants exportée',
  'export.personal_data': 'Export des données personnelles',
  'export.organization_data': 'Export de réversibilité d’un organisme (archive complète)',
  'export.platform_data': 'Export de réversibilité de toute la plateforme',
  'export.report_pdf': 'Bilan téléchargé',
  'export.signature_sheet_pdf': 'Feuille d’émargement téléchargée',
  'export.certificate_pdf': 'Certificat de réalisation téléchargé',
  'export.impact_csv': 'Indicateurs d’impact exportés',
  'export.satisfaction_csv': 'Résultats de satisfaction exportés',
  'auth.mfa_reset': 'Double authentification réinitialisée par un administrateur',
  'participant_file.viewed': 'Fiche participant consultée',
  'referral.created': 'Orientation envoyée par un prescripteur',
  'referral.status_changed': 'Statut d’une orientation modifié',
  'referral.consent_changed': 'Consentements d’une orientation modifiés',
  'group.capacity_changed': 'Nombre de places d’un groupe modifié',
  'attendance.signed': 'Émargement signé',
  'attendance.countersigned': 'Feuille d’émargement contre-signée',
  'attendance.corrected': 'Présence corrigée (feuille figée)',
  'attendance.signature_deleted': 'Signature d’émargement supprimée',
  'attendance.countersignature_removed': 'Contre-signature retirée',
  'report.created': 'Bilan créé',
  'report.content_updated': 'Texte d’un bilan modifié',
  'report.finalized': 'Bilan validé',
  'report.easy_read_created': 'Version facile à lire d’un bilan préparée',
  'report.easy_read_updated': 'Version facile à lire d’un bilan modifiée',
  'report.easy_read_validated': 'Version facile à lire d’un bilan validée',
  'ai.observation_structured': 'Notes de séance structurées avec l’aide de l’IA',
  'passport_share.created': 'Lien de partage du passeport créé',
  'passport_share.revoked': 'Lien de partage du passeport révoqué',
  'group.member_added': 'Participant ajouté à un groupe',
  'group.member_removed': 'Participant retiré d’un groupe',
  'group.member_dropped': 'Abandon déclaré',
  'group.member_drop_updated': 'Abandon modifié',
  'outcome.recorded': 'Situation du participant renseignée',
  'outcome.updated': 'Situation du participant modifiée',
  'outcome.deleted': 'Situation du participant supprimée',
  'entry_profile.recorded': 'Fiche d’entrée FSE+ créée',
  'entry_profile.updated': 'Fiche d’entrée FSE+ modifiée (champs listés, sans les valeurs)',
  'entry_profile.deleted': 'Fiche d’entrée FSE+ supprimée',
  'entry_profile.viewed': 'Fiche d’entrée FSE+ consultée',
  'export.fse_participants_csv': 'Fichier participants FSE+ exporté',
  'export.fse_indicators_csv': 'Indicateurs FSE+ exportés',
  'satisfaction.submitted': 'Réponse à une enquête de satisfaction',
  'satisfaction.version_created': 'Version d’enquête de satisfaction créée',
  'satisfaction.version_published': 'Enquête de satisfaction publiée',
  'demo.created': 'Démonstration créée',
  'demo.deleted': 'Démonstration supprimée',
  'demo.space_opened': 'Espace de démonstration ouvert',
  'email.sent': 'E-mail envoyé',
  'email.failed': 'E-mail abandonné après plusieurs échecs',
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
