/**
 * Masquage des adresses e-mail pour l'affichage (administration) et les messages d'erreur.
 * « jeanne.dupont@exemple.fr » → « j…t@e…e.fr ». Les journaux applicatifs n'affichent jamais d'adresse.
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return '—';
  const at = value.lastIndexOf('@');
  if (at <= 0) return '…';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const name = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  const hide = (part: string) => (part.length <= 2 ? `${part[0] ?? ''}…` : `${part[0]}…${part[part.length - 1]}`);
  return `${hide(local)}@${hide(name)}${tld}`;
}

const EMAIL_PATTERN = /[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+/g;

/** Retire toute adresse d'un texte (message d'erreur d'un fournisseur) et le tronque. */
export function scrubError(value: unknown, max = 500): string {
  const text = value instanceof Error ? value.message : typeof value === 'string' ? value : JSON.stringify(value);
  return (text ?? 'Erreur inconnue').replace(EMAIL_PATTERN, (match) => maskEmail(match)).replace(/\s+/g, ' ').trim().slice(0, max);
}
