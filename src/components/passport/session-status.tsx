import { Badge, type BadgeVariant } from '@/components/ui/primitives';

export const SESSION_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  planned: { label: 'À venir', variant: 'outline' },
  in_progress: { label: 'En cours', variant: 'orange' },
  completed: { label: 'Terminée', variant: 'success' },
  cancelled: { label: 'Annulée', variant: 'neutral' },
};

export const ATTENDANCE_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  present: { label: 'Présent', variant: 'success' },
  late: { label: 'En retard', variant: 'warning' },
  left_early: { label: 'Départ anticipé', variant: 'warning' },
  absent: { label: 'Absent', variant: 'danger' },
  excused: { label: 'Absence justifiée', variant: 'neutral' },
};

export function SessionStatusBadge({ status }: { status: string }) {
  const config = SESSION_STATUS[status] ?? SESSION_STATUS.planned!;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function AttendanceBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const config = ATTENDANCE_STATUS[status];
  return config ? <Badge variant={config.variant}>{config.label}</Badge> : null;
}
