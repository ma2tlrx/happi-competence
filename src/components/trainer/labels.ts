import type { BadgeVariant } from '@/components/ui/primitives';
import { parisDate } from '@/lib/attendance/signature';
import { displayGroupStatus } from '@/lib/listing-rules';

export const GROUP_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  planned: { label: 'Prévu', variant: 'outline' },
  active: { label: 'En cours', variant: 'success' },
  completed: { label: 'Terminé', variant: 'petrol' },
  archived: { label: 'Archivé', variant: 'neutral' },
};

/** Badge de statut d'un groupe : « Prévu » tant que la date de début n'est pas atteinte (jour à Paris). */
export function groupStatusBadge(status: string, startDate: string | null | undefined) {
  return GROUP_STATUS[displayGroupStatus({ status, startDate }, parisDate())] ?? GROUP_STATUS.active!;
}
