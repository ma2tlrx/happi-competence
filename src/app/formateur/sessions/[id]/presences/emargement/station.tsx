'use client';

import { ArrowLeft, CircleCheck, FileDown, Lock, Maximize, Minimize, PenLine } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { ATTENDANCE_STATUS } from '@/components/passport/session-status';
import { SignaturePad } from '@/components/attendance/signature-pad';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Textarea } from '@/components/ui/form';
import { Notice } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { cn, formatDateTime, formatTime } from '@/lib/utils';

import { countersignAttendance, signOnTrainerDevice } from '../actions';

export type StationRow = {
  participantId: string;
  name: string;
  status: string | null;
  signable: boolean;
  signature: { kind: 'drawn' | 'unable'; signedAt: string } | null;
};

const timeOf = (iso: string) => formatTime(new Date(iso).toTimeString().slice(0, 5));

export function SigningStation({
  sessionId,
  title,
  subtitle,
  dateLabel,
  rows: initialRows,
  missingAttendance,
  windowOpen,
  canWrite,
  frozen,
}: {
  sessionId: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  rows: StationRow[];
  missingAttendance: number;
  windowOpen: boolean;
  canWrite: boolean;
  frozen: { trainerName: string; signedAt: string } | null;
}) {
  const router = useRouter();
  // Signatures enregistrées depuis le dernier rendu serveur (affichage immédiat, avant actualisation).
  const [recent, setRecent] = useState<Record<string, NonNullable<StationRow['signature']>>>({});
  const rows = initialRows.map((row) => (recent[row.participantId] && !row.signature ? { ...row, signature: recent[row.participantId]! } : row));
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'draw' | 'unable'>('draw');
  const [path, setPath] = useState('');
  const [reason, setReason] = useState('');
  const [counterPath, setCounterPath] = useState('');
  const [attest, setAttest] = useState(false);
  const [pending, start] = useTransition();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => toast.error('Le plein écran n’est pas disponible sur cet appareil.'));
  };

  const open = !frozen && windowOpen && canWrite;
  const person = rows.find((row) => row.participantId === selected) ?? null;
  const eligible = rows.filter((row) => row.signable);
  const others = rows.filter((row) => !row.signable);
  const unsigned = eligible.filter((row) => !row.signature);

  const choose = (participantId: string) => {
    setSelected(participantId);
    setMode('draw');
    setPath('');
    setReason('');
  };

  const submit = () => {
    if (!person) return;
    start(async () => {
      const result = await signOnTrainerDevice(
        mode === 'draw'
          ? { kind: 'drawn', sessionId, participantId: person.participantId, path }
          : { kind: 'unable', sessionId, participantId: person.participantId, reason },
      );
      if (!result.ok) {
        toast.error(result.message ?? 'La signature n’a pas été enregistrée.');
        return;
      }
      const signedAt = result.signedAt ?? new Date().toISOString();
      setRecent((current) => ({ ...current, [person.participantId]: { kind: mode === 'draw' ? 'drawn' : 'unable', signedAt } }));
      toast.success(`${person.name} : ${mode === 'draw' ? 'signature' : 'mention'} enregistrée à ${timeOf(signedAt)}.`);
      setSelected(null);
      router.refresh();
    });
  };

  const countersign = () =>
    start(async () => {
      const result = await countersignAttendance({ sessionId, path: counterPath, attest: attest as true });
      if (!result.ok) {
        toast.error(result.message ?? 'La contre-signature n’a pas été enregistrée.');
        return;
      }
      toast.success('Feuille contre-signée : elle est désormais figée.');
      router.refresh();
    });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
        <Link href={`/formateur/sessions/${sessionId}/presences`} className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-petrol-700 hover:text-petrol-950">
          <ArrowLeft className="size-4" aria-hidden />
          Quitter l’émargement
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate font-display text-lg font-semibold text-ink">{title}</h1>
          <p className="truncate text-sm text-ink-muted">{subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          {fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        </Button>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {frozen ? (
          <Notice
            variant="success"
            title="Feuille contre-signée"
            action={
              <Button asChild size="sm" variant="outline">
                <a href={`/api/exports/emargement/${sessionId}`} download>
                  <FileDown aria-hidden />
                  PDF
                </a>
              </Button>
            }
          >
            Contre-signée par {frozen.trainerName} le {formatDateTime(frozen.signedAt)}. Plus aucune signature ni modification de présence n’est possible.
          </Notice>
        ) : !windowOpen ? (
          <Notice variant="warning" title="Émargement fermé">
            L’émargement n’est possible que le jour de la séance ou pendant qu’elle est en cours.
          </Notice>
        ) : !canWrite ? (
          <Notice variant="warning" title="Lecture seule">Votre compte ne permet pas de recueillir les signatures.</Notice>
        ) : null}

        {person && open ? (
          <section aria-labelledby="signataire" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
            <div>
              <p className="text-sm text-ink-muted">À signer par</p>
              <h2 id="signataire" className="font-display text-2xl font-semibold text-ink">
                {person.name}
              </h2>
              <p className="text-sm text-ink-muted">Présence : {ATTENDANCE_STATUS[person.status ?? '']?.label ?? '—'}</p>
            </div>
            {mode === 'draw' ? (
              <>
                <p className="text-ink">J’atteste avoir participé à la séance du {dateLabel}.</p>
                <SignaturePad key={person.participantId} label={`Zone de signature de ${person.name}`} onChange={setPath} />
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" onClick={submit} disabled={!path} loading={pending}>
                    <PenLine aria-hidden />
                    Valider la signature
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setSelected(null)} disabled={pending}>
                    Annuler
                  </Button>
                </div>
                <Button variant="link" onClick={() => setMode('unable')}>
                  Signature impossible ? Saisir un motif (formateur)
                </Button>
              </>
            ) : (
              <>
                <Notice variant="info">
                  À remplir par le formateur lorsque la personne, présente, ne peut pas signer à l’écran. La mention est tracée à votre nom.
                </Notice>
                <Field label="Motif" required hint="Exemple : handicap moteur, blessure à la main. 3 à 300 caractères.">
                  {({ id, describedBy }) => (
                    <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
                  )}
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={submit} disabled={reason.trim().length < 3} loading={pending}>
                    Enregistrer « signature impossible »
                  </Button>
                  <Button variant="outline" onClick={() => setMode('draw')} disabled={pending}>
                    Revenir à la signature
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : (
          <>
            <section aria-labelledby="a-signer">
              <h2 id="a-signer" className="mb-3 font-display text-lg font-semibold text-ink">
                Participants présents · {eligible.length - unsigned.length}/{eligible.length} signé(s)
              </h2>
              {eligible.length === 0 ? (
                <p className="text-ink-muted">Aucun participant noté présent. Renseignez d’abord les présences.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {eligible.map((row) => (
                    <li key={row.participantId}>
                      {row.signature ? (
                        <div className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3">
                          <span className="font-semibold text-ink">{row.name}</span>
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
                            <CircleCheck className="size-4" aria-hidden />
                            {row.signature.kind === 'unable' ? 'Mention' : 'Signé'} {timeOf(row.signature.signedAt)}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!open}
                          onClick={() => choose(row.participantId)}
                          className={cn(
                            'flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-line-strong bg-white px-4 py-3 text-left transition-colors',
                            'hover:border-petrol-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol-500 disabled:cursor-not-allowed disabled:opacity-60',
                          )}
                        >
                          <span className="font-semibold text-ink">{row.name}</span>
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                            <PenLine className="size-4" aria-hidden />
                            Faire signer
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {others.length > 0 ? (
                <p className="mt-3 text-sm text-ink-subtle">
                  Ne signent pas :{' '}
                  {others.map((row) => `${row.name} (${row.status ? (ATTENDANCE_STATUS[row.status]?.label ?? row.status).toLowerCase() : 'présence à renseigner'})`).join(', ')}.
                </p>
              ) : null}
            </section>

            {!frozen && canWrite ? (
              <section aria-labelledby="contre-signature" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Lock className="size-5 text-petrol-700" aria-hidden />
                  <h2 id="contre-signature" className="font-display text-lg font-semibold text-ink">
                    Contre-signature du formateur
                  </h2>
                </div>
                <p className="text-sm text-ink-muted">
                  Vous attestez la liste des présences. La feuille est ensuite figée : plus de nouvelle signature ni de changement de présence (correction
                  possible uniquement par un administrateur, tracée).
                </p>
                {missingAttendance > 0 ? (
                  <Notice variant="warning">Renseignez la présence de tous les participants avant de contre-signer ({missingAttendance} restant(s)).</Notice>
                ) : (
                  <>
                    {unsigned.length > 0 ? (
                      <Notice variant="warning">
                        {unsigned.length} participant(s) présent(s) n’ont pas signé : ils figureront « non signé » sur la feuille.
                      </Notice>
                    ) : null}
                    <SignaturePad label="Zone de contre-signature du formateur" onChange={setCounterPath} />
                    <Checkbox
                      label="J’atteste l’exactitude de la liste des présences de cette séance."
                      checked={attest}
                      onChange={(event) => setAttest(event.target.checked)}
                    />
                    <Button onClick={countersign} disabled={!counterPath || !attest} loading={pending} variant="secondary">
                      <Lock aria-hidden />
                      Contre-signer et figer la feuille
                    </Button>
                  </>
                )}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
