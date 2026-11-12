import { isUuid } from '@/lib/utils';

export type SatisfactionSearch = { groupe?: string | null; programme?: string | null; du?: string | null; au?: string | null };

const isDate = (value: string | null | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/** Filtres des résultats (administrateur) lus dans l'URL ; toute valeur invalide est ignorée. */
export function satisfactionFilters(params: SatisfactionSearch) {
  return {
    groupId: isUuid(params.groupe) ? params.groupe : null,
    programId: isUuid(params.programme) ? params.programme : null,
    from: isDate(params.du),
    to: isDate(params.au),
  };
}
