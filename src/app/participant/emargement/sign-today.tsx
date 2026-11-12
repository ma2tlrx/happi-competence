'use client';

import { CircleCheck, PenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { SignaturePad } from '@/components/attendance/signature-pad';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { formatDate, formatDateTime, formatTimeRange } from '@/lib/utils';

import { signOwnAttendance } from './actions';

export type SignableSession = {
  sessionId: string;
  number: number;
  title: string;
  groupName: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  attendanceStatus: string | null;
  signedAt: string | null;
  frozen: boolean;
  canSign: boolean;
};

/** Émargement depuis le compte du participant : séances du jour. */
export function SignToday({ sessions }: { sessions: SignableSession[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [path, setPath] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (sessionId: string) =>
    start(async () => {
      const result = await signOwnAttendance({ sessionId, path });
      if (!result.ok) {
        toast.error(result.message ?? 'La signature n’a pas été enregistrée.');
        return;
      }
      toast.success('Votre signature est enregistrée.');
      setOpen(null);
      setPath('');
      router.refresh();
    });

  return (
    <Card>
      <CardHeader title="Émargement du jour" description="Signez la feuille de présence de votre séance, comme sur papier." />
      <CardBody className="space-y-4">
        {sessions.map((session) => (
          <div key={session.sessionId} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">
                  Session {session.number} · {session.title}
                </p>
                <p className="text-sm text-ink-muted">
                  {formatDate(session.date)} · {formatTimeRange(session.startTime, session.endTime)} · {session.groupName}
                </p>
              </div>
              {session.signedAt ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                  <CircleCheck className="size-4" aria-hidden />
                  Signé le {formatDateTime(session.signedAt)}
                </p>
              ) : session.canSign && open !== session.sessionId ? (
                <Button onClick={() => { setOpen(session.sessionId); setPath(''); }}>
                  <PenLine aria-hidden />
                  Signer
                </Button>
              ) : !session.canSign ? (
                <p className="text-sm text-ink-subtle">
                  {session.frozen
                    ? 'Feuille contre-signée par le formateur : signature close.'
                    : session.attendanceStatus
                      ? 'Signature non disponible pour votre statut de présence.'
                      : 'Votre formateur n’a pas encore noté votre présence.'}
                </p>
              ) : null}
            </div>
            {open === session.sessionId ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-ink-muted">
                  En signant, j’atteste avoir participé à cette séance du {formatDate(session.date)}.
                </p>
                <SignaturePad key={session.sessionId} label={`Zone de signature pour la session ${session.number}`} onChange={setPath} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => submit(session.sessionId)} disabled={!path} loading={pending}>
                    Valider ma signature
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(null)} disabled={pending}>
                    Annuler
                  </Button>
                </div>
                <p className="text-sm text-ink-subtle">Vous ne pouvez pas signer à l’écran ? Votre formateur peut l’indiquer sur sa feuille.</p>
              </div>
            ) : null}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
