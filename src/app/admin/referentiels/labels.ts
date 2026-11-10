import type { BadgeVariant } from '@/components/ui/primitives';

export const VERSION_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Brouillon', variant: 'warning' },
  published: { label: 'Publiée', variant: 'success' },
  archived: { label: 'Archivée', variant: 'neutral' },
};
