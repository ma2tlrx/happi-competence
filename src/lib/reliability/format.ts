/** Affichage des statistiques d'accord (français, sans arrondi trompeur). */
const decimal = (digits: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${decimal(0).format(rate * 100)} %`;
}

export function formatRateInterval(ci: [number, number] | null | undefined): string {
  return ci ? `[${decimal(0).format(ci[0] * 100)} ; ${decimal(0).format(ci[1] * 100)}] %` : '';
}

export function formatCoefficient(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : decimal(2).format(value);
}

export function formatCoefficientInterval(ci: [number, number] | null | undefined): string {
  return ci ? `[${decimal(2).format(ci[0])} ; ${decimal(2).format(ci[1])}]` : '';
}

export const INSUFFICIENT = 'Effectif insuffisant pour conclure';
