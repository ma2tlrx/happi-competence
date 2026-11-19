/**
 * Libellés des financeurs, des conventions et du bilan pédagogique et financier (BPF).
 * Module pur, utilisable côté serveur et côté client.
 *
 * Les codes reprennent ceux autorisés par la base (migration 20261118100000).
 */

export const FUNDER_KINDS = {
  france_travail: 'France Travail',
  region: 'Région',
  departement: 'Département',
  etat: 'État (DREETS, préfecture…)',
  opco: 'OPCO',
  fse_plus: 'Fonds social européen (FSE+)',
  mission_locale: 'Mission Locale (CEJ…)',
  entreprise: 'Entreprise',
  particulier_cpf: 'Particulier ou CPF',
  fondation: 'Fondation',
  autre_public: 'Autre financeur public',
  autre_prive: 'Autre financeur privé',
} as const;
export type FunderKind = keyof typeof FUNDER_KINDS;
export const FUNDER_KIND_CODES = Object.keys(FUNDER_KINDS) as [FunderKind, ...FunderKind[]];

export function funderKindLabel(code: string | null | undefined) {
  return code && code in FUNDER_KINDS ? FUNDER_KINDS[code as FunderKind] : 'Type non renseigné';
}

export const CONVENTION_STATUSES = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  soldee: 'Soldée',
} as const;
export type ConventionStatus = keyof typeof CONVENTION_STATUSES;
export const CONVENTION_STATUS_CODES = Object.keys(CONVENTION_STATUSES) as [ConventionStatus, ...ConventionStatus[]];

export function conventionStatusLabel(code: string) {
  return code in CONVENTION_STATUSES ? CONVENTION_STATUSES[code as ConventionStatus] : code;
}

export const FUNDING_REPORT_NOTICE = 'Modèle indicatif — à adapter aux exigences du financeur.';

/** Texte affiché quand l'application ne connaît pas une donnée : à saisir par l'organisme, jamais estimée. */
export const TO_COMPLETE = 'À compléter';

// ── Bilan pédagogique et financier (cerfa n° 10443, notice n° 50199) ─────────
//
// Sources consultées : voir docs/financements.md. La numérotation des lignes change d'une
// version du formulaire à l'autre : les libellés ci-dessous suivent la notice, les numéros
// de ligne sont à vérifier dans la notice de l'année déclarée (« à valider »).

/** Cadre F-1 : type de stagiaires. Le statut des participants n'est pas saisi dans HAPPI. */
export const BPF_TRAINEE_TYPES = [
  { code: 'salaries_prives', label: 'Salariés d’employeurs privés hors apprentis' },
  { code: 'apprentis', label: 'Apprentis' },
  { code: 'demandeurs_emploi', label: 'Personnes en recherche d’emploi formées par votre organisme' },
  { code: 'particuliers', label: 'Particuliers à leurs propres frais formés par votre organisme' },
  { code: 'autres', label: 'Autres stagiaires' },
] as const;

/** Cadre C : origine des produits, regroupée selon les familles de la notice. */
export const BPF_ORIGINS = {
  entreprises: { label: 'Entreprises, pour la formation de leurs salariés', line: 'C-1' },
  opco: { label: 'Organismes gestionnaires des fonds de la formation (OPCO…)', line: 'C-2 (sous-ligne à préciser)' },
  europe: { label: 'Pouvoirs publics, publics spécifiques : instances européennes (FSE+)', line: 'C-4' },
  etat: { label: 'Pouvoirs publics, publics spécifiques : État', line: 'C-5' },
  region: { label: 'Pouvoirs publics, publics spécifiques : conseils régionaux', line: 'C-6' },
  france_travail: { label: 'Pouvoirs publics, publics spécifiques : France Travail', line: 'C-7' },
  autres_publics: { label: 'Pouvoirs publics, publics spécifiques : autres ressources publiques', line: 'C-8' },
  particuliers_ou_cpf: { label: 'Particuliers à leurs frais (C-9) ou CPF (C-2, Caisse des dépôts) — à ventiler', line: 'C-9 ou C-2' },
  autres_produits: { label: 'Autres produits au titre de la formation professionnelle', line: 'C-11' },
  a_qualifier: { label: 'Financeur privé à qualifier', line: 'À déterminer' },
  sans_convention: { label: 'Groupe sans convention de financement', line: 'À déterminer' },
} as const;
export type BpfOrigin = keyof typeof BPF_ORIGINS;
export const BPF_ORIGIN_CODES = Object.keys(BPF_ORIGINS) as [BpfOrigin, ...BpfOrigin[]];

/**
 * Correspondance type de financeur → famille du cadre C. Une correspondance marquée `verify`
 * dépend de l'origine réelle des fonds (ex. CEJ versé par l'État via la Mission Locale).
 */
export const BPF_ORIGIN_BY_FUNDER: Record<FunderKind, { origin: BpfOrigin; verify?: string }> = {
  entreprise: { origin: 'entreprises' },
  opco: { origin: 'opco', verify: 'Préciser le dispositif (plan de développement des compétences, alternance, transition professionnelle…).' },
  fse_plus: { origin: 'europe' },
  etat: { origin: 'etat' },
  region: { origin: 'region' },
  france_travail: { origin: 'france_travail' },
  departement: { origin: 'autres_publics' },
  mission_locale: { origin: 'autres_publics', verify: 'Vérifier l’origine des fonds (CEJ financé par l’État, Région…).' },
  autre_public: { origin: 'autres_publics' },
  particulier_cpf: { origin: 'particuliers_ou_cpf', verify: 'Ventiler entre particuliers à leurs frais et CPF (Caisse des dépôts).' },
  fondation: { origin: 'autres_produits', verify: 'Vérifier la ligne applicable aux fonds d’une fondation.' },
  autre_prive: { origin: 'a_qualifier', verify: 'Qualifier le financeur pour choisir la ligne.' },
};

export function bpfOriginOf(kind: string | null | undefined): BpfOrigin {
  return kind && kind in BPF_ORIGIN_BY_FUNDER ? BPF_ORIGIN_BY_FUNDER[kind as FunderKind].origin : 'sans_convention';
}
