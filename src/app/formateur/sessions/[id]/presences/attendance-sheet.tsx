'use client';

import { Check, CheckCheck, Clock, DoorOpen, FileCheck, X } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { AutosaveTextarea } from '@/components/ui/autosave-textarea';
import { Avatar } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';

import { recordAttendance, saveAttendanceComment } from './actions';

type Status = 'present' | 'late' | 'left_early' | 'absent' | 'excused';
const OPTIONS: { value: Status; label: string; short: string; icon: typeof Check; active: string }[] = [
  { value: 'present', label: 'Présent', short: 'Présent', icon: Check, active: 'border-success bg-success text-white' },
  { value: 'late', label: 'Retard', short: 'Retard', icon: Clock, active: 'border-warning bg-warning text-white' },
  { value: 'left_early', label: 'Départ anticipé', short: 'Départ', icon: DoorOpen, active: 'border-warning bg-warning text-white' },
  { value: 'absent', label: 'Absent', short: 'Absent', icon: X, active: 'border-danger bg-danger text-white' },
  { value: 'excused', label: 'Absence justifiée', short: 'Justifié', icon: FileCheck, active: 'border-petrol-700 bg-petrol-700 text-white' },
];

export type AttendanceRow = { participantId: string; firstName: string; lastName: string; status: Status | null; comment: string | null; recordedAt: string | null; recordedBy: string | null };

export function AttendanceSheet({ sessionId, rows: initialRows, canEdit }: { sessionId: string; rows: AttendanceRow[]; canEdit: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);

  const apply = (participantIds: string[], status: Status) => {
    const previous = rows;
    setRows((current) => current.map((row) => (participantIds.includes(row.participantId) ? { ...row, status, recordedAt: new Date().toISOString() } : row)));
    setSaving(participantIds.length === 1 ? participantIds[0]! : 'all');
    start(async () => {
      const result = await recordAttendance({ sessionId, participantIds, status });
      setSaving(null);
      if (!result.ok) {
        setRows(previous);
        toast.error(result.message ?? 'La présence n’a pas été enregistrée.');
      } else if (participantIds.length > 1) {
        toast.success('Tous les participants restants sont notés présents.');
      }
    });
  };

  const missing = rows.filter((row) => !row.status).map((row) => row.participantId);
  const counts = OPTIONS.map((option) => ({ ...option, count: rows.filter((row) => row.status === option.value).length }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {counts.map((option) => (
            <li key={option.value}>
              {option.label} <span className="font-semibold text-ink tabular-nums">{option.count}</span>
            </li>
          ))}
          <li>
            À renseigner <span className="font-semibold text-ink tabular-nums">{missing.length}</span>
          </li>
        </ul>
        {canEdit && missing.length > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => apply(missing, 'present')} loading={pending && saving === 'all'}>
            <CheckCheck aria-hidden />
            Marquer les autres présents
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.participantId} className={cn('rounded-lg border bg-white p-4 transition-colors', row.status ? 'border-line' : 'border-orange-200')}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Avatar person={{ first_name: row.firstName, last_name: row.lastName }} />
                <div>
                  <p className="font-semibold text-ink">
                    {row.lastName.toUpperCase()} {row.firstName}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {row.recordedAt ? `Validé le ${formatDateTime(row.recordedAt)}${row.recordedBy ? ` par ${row.recordedBy}` : ''}` : 'Non renseigné'}
                  </p>
                </div>
              </div>
              <div role="radiogroup" aria-label={`Présence de ${row.firstName} ${row.lastName}`} className="grid grid-cols-5 gap-1.5 lg:flex">
                {OPTIONS.map((option) => {
                  const selected = row.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!canEdit}
                      onClick={() => !selected && apply([row.participantId], option.value)}
                      className={cn(
                        'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border px-2 text-xs font-semibold transition-colors lg:min-w-[5.5rem] lg:flex-row lg:gap-1.5 lg:text-sm',
                        selected ? option.active : 'border-line-strong bg-white text-ink-muted hover:border-petrol-400 hover:text-ink',
                        !canEdit && 'cursor-default',
                      )}
                    >
                      <option.icon className="size-4" aria-hidden />
                      <span className="lg:hidden">{option.short}</span>
                      <span className="hidden lg:inline">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {row.status && canEdit ? (
              <details className="mt-2" open={Boolean(row.comment) || undefined}>
                <summary className="cursor-pointer text-sm font-medium text-petrol-700">{row.comment ? 'Commentaire' : 'Ajouter un commentaire'}</summary>
                <AutosaveTextarea
                  className="mt-2"
                  label={`Commentaire sur la présence de ${row.firstName} ${row.lastName}`}
                  initialValue={row.comment ?? ''}
                  rows={2}
                  maxLength={500}
                  onSave={(comment) => saveAttendanceComment(sessionId, row.participantId, comment)}
                />
              </details>
            ) : row.comment ? (
              <p className="mt-2 text-sm text-ink-muted">{row.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
