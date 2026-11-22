/**
 * Deux programmes coexistent : « HAPPI Compétence » (six sessions évaluées sur des référentiels) et
 * « Passeport Numérique » (application d'exercices, src/lib/passeport-numerique). Module pur : le type
 * de programme se choisit à l'inscription (participants.program_kind) et se lit sur le programme du groupe
 * (programs.kind). Le programme du groupe prime sur le choix de départ.
 */
export const PROGRAM_KINDS = ['happi_competence', 'passeport_numerique'] as const;
export type ProgramKind = (typeof PROGRAM_KINDS)[number];

export const PROGRAM_KIND_LABELS: Record<ProgramKind, { name: string; short: string; summary: string }> = {
  happi_competence: {
    name: 'HAPPI Compétence',
    short: 'HAPPI',
    summary: 'Six sessions pour identifier, développer et valoriser vos compétences transversales grâce au jeu vidéo.',
  },
  passeport_numerique: {
    name: 'Passeport Numérique',
    short: 'Passeport Numérique',
    summary: 'Un atelier ludique pour découvrir le numérique pas à pas, à votre rythme : gestes de base, mails, démarches en ligne, vigilance face aux arnaques.',
  },
};

export function parseProgramKind(value: unknown): ProgramKind | null {
  return PROGRAM_KINDS.find((kind) => kind === value) ?? null;
}

/** Valeur de l'adresse `?programme=` : les deux noms lisibles ou les codes de la base. */
export function programKindFromSlug(slug: unknown): ProgramKind | null {
  if (slug === 'happi' || slug === 'happi-competence') return 'happi_competence';
  if (slug === 'passeport-numerique') return 'passeport_numerique';
  return parseProgramKind(slug);
}

export function programSlug(kind: ProgramKind): string {
  return kind === 'passeport_numerique' ? 'passeport-numerique' : 'happi-competence';
}

/** Programme à afficher pour une personne : celui de son groupe actif, sinon celui qu'elle a choisi. */
export function effectiveProgramKind(groupProgramKind: unknown, chosen: unknown): ProgramKind {
  return parseProgramKind(groupProgramKind) ?? parseProgramKind(chosen) ?? 'happi_competence';
}
