/**
 * Libellés des abandons et des situations des participants. Module sans dépendance serveur.
 *
 * Les listes reprennent les codes autorisés par la base (migration 20261113100000) ;
 * elles sont PROVISOIRES et doivent être alignées sur les nomenclatures des financeurs.
 */

export const PROVISIONAL_OUTCOMES_NOTICE =
  'Catégories provisoires — à aligner sur les nomenclatures de vos financeurs (FSE+, France Travail, CEJ).';

export const DROP_REASONS = {
  emploi_trouve: 'Emploi trouvé',
  entree_formation: 'Entrée en formation',
  sante: 'Santé',
  demenagement: 'Déménagement',
  motif_personnel: 'Motif personnel',
  sans_nouvelles: 'Sans nouvelles',
  autre: 'Autre motif',
} as const;
export type DropReason = keyof typeof DROP_REASONS;
export const DROP_REASON_CODES = Object.keys(DROP_REASONS) as [DropReason, ...DropReason[]];
export const DROP_DETAILS_MAX = 300;

export const OUTCOME_KINDS = {
  entry: 'Entrée',
  exit: 'Sortie',
  followup_3m: 'Suivi à 3 mois',
  followup_6m: 'Suivi à 6 mois',
} as const;
export type OutcomeKind = keyof typeof OUTCOME_KINDS;
export const OUTCOME_KIND_CODES = Object.keys(OUTCOME_KINDS) as [OutcomeKind, ...OutcomeKind[]];

export const OUTCOME_SITUATIONS = {
  emploi_durable: { label: 'Emploi durable', hint: 'CDI, CDD de 6 mois ou plus' },
  emploi_transition: { label: 'Emploi de transition', hint: 'CDD de moins de 6 mois, intérim, contrat aidé' },
  formation_qualifiante: { label: 'Formation qualifiante ou certifiante', hint: null },
  creation_activite: { label: 'Création d’activité', hint: null },
  immersion_stage: { label: 'Immersion ou stage', hint: null },
  recherche_emploi: { label: 'Recherche active d’emploi', hint: null },
  autre_etape: { label: 'Autre étape du parcours', hint: 'Soins, logement, mobilité…' },
  sans_nouvelles: { label: 'Sans nouvelles', hint: null },
} as const;
export type OutcomeSituation = keyof typeof OUTCOME_SITUATIONS;
export const OUTCOME_SITUATION_CODES = Object.keys(OUTCOME_SITUATIONS) as [OutcomeSituation, ...OutcomeSituation[]];
export const OUTCOME_DETAILS_MAX = 500;

/** Libellé affiché quand une donnée n'a pas été saisie : jamais confondu avec zéro. */
export const NOT_RECORDED = 'Non renseigné';

export function dropReasonLabel(code: string | null | undefined) {
  return code && code in DROP_REASONS ? DROP_REASONS[code as DropReason] : NOT_RECORDED;
}

export function situationLabel(code: string | null | undefined) {
  return code && code in OUTCOME_SITUATIONS ? OUTCOME_SITUATIONS[code as OutcomeSituation].label : NOT_RECORDED;
}

export function kindLabel(code: string) {
  return code in OUTCOME_KINDS ? OUTCOME_KINDS[code as OutcomeKind] : code;
}
