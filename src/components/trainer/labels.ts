import type { BadgeVariant } from '@/components/ui/primitives';

export const GROUP_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  planned: { label: 'Prévu', variant: 'outline' },
  active: { label: 'En cours', variant: 'success' },
  completed: { label: 'Terminé', variant: 'petrol' },
  archived: { label: 'Archivé', variant: 'neutral' },
};
