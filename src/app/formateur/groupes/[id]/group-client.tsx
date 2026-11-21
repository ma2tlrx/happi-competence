'use client';

import { Check, ChevronsDown, CircleAlert, DoorOpen, Pencil, RotateCcw, UserMinus, UserPlus } from 'lucide-react';
import { useActionState, useEffect, useId, useRef, useState, useTransition, type InputHTMLAttributes } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { DROP_DETAILS_MAX, DROP_REASON_CODES, DROP_REASONS } from '@/lib/outcomes/labels';
import { copyForward, fieldName, firstFilledIndex, initialRows, LOCATION_MAX, type PlanField, type PlanRow } from '@/lib/sessions/plan';
import { cn } from '@/lib/utils';

import { addMember, declareDropout, linkParticipantOrganization, planSessions, removeMember, restoreMember } from '../../actions';

type Option = { id: string; name: string };

export function AddMemberDialog({ groupId, candidates, full }: { groupId: string; candidates: { id: string; label: string }[]; full: boolean }) {
  const [open, setOpen] = useState(false);
  const [existingState, existingAction] = useActionState(addMember.bind(null, groupId), null);
  const [newState, newAction] = useActionState(addMember.bind(null, groupId), null);
  const errors = newState?.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={full} title={full ? 'Le groupe a atteint sa taille maximale' : undefined}>
          <UserPlus aria-hidden />
          Ajouter un participant
        </Button>
      </DialogTrigger>
      <DialogContent title="Ajouter un participant" description="Ajoutez une personne déjà inscrite, ou créez sa fiche : elle pourra ensuite créer son compte avec la même adresse e-mail.">
        <Tabs defaultValue={candidates.length > 0 ? 'existant' : 'nouveau'}>
          <TabsList>
            <TabsTrigger value="existant">Participant inscrit</TabsTrigger>
            <TabsTrigger value="nouveau">Nouveau participant</TabsTrigger>
          </TabsList>
          <TabsContent value="existant">
            {candidates.length > 0 ? (
              <form action={existingAction} className="space-y-4">
                <Field label="Participant">
                  {({ id }) => (
                    <Select id={id} name="participantId" required defaultValue="">
                      <option value="" disabled>Sélectionner</option>
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <FormMessage state={existingState} />
                <SubmitButton>Ajouter au groupe</SubmitButton>
              </form>
            ) : (
              <p className="text-[0.9375rem] text-ink-muted">Aucun participant inscrit sans groupe pour le moment. Utilisez l’onglet « Nouveau participant ».</p>
            )}
          </TabsContent>
          <TabsContent value="nouveau">
            <form action={newAction} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom" required error={errors.firstName}>
                  {({ id, invalid }) => <Input id={id} name="firstName" aria-invalid={invalid || undefined} />}
                </Field>
                <Field label="Nom" required error={errors.lastName}>
                  {({ id, invalid }) => <Input id={id} name="lastName" aria-invalid={invalid || undefined} />}
                </Field>
              </div>
              <Field label="Adresse e-mail" required error={errors.email} hint="Si la personne a déjà une fiche, elle est simplement ajoutée au groupe.">
                {({ id, describedBy, invalid }) => <Input id={id} name="email" type="email" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
              </Field>
              <FormMessage state={newState} />
              <SubmitButton>Créer et ajouter</SubmitButton>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function MemberActions({ groupId, participantId, name, removed }: { groupId: string; participantId: string; name: string; removed: boolean }) {
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      if (!removed && !window.confirm(`Retirer ${name} du groupe ? À réserver à une erreur d’inscription : pour un départ en cours de parcours, déclarez plutôt un abandon. Ses présences et évaluations sont conservées.`)) return;
      const result = removed ? await restoreMember(groupId, participantId) : await removeMember(groupId, participantId);
      if (result.ok) toast.success(removed ? `${name} a réintégré le groupe.` : `${name} a été retiré du groupe.`);
      else toast.error(result.message ?? 'Action impossible.');
    });
  return (
    <Button size="sm" variant={removed ? 'outline' : 'ghost'} onClick={run} loading={pending} aria-label={removed ? `Réintégrer ${name}` : `Retirer ${name} du groupe (erreur d’inscription)`}>
      {removed ? <RotateCcw aria-hidden /> : <UserMinus aria-hidden />}
      <span className="hidden md:inline">{removed ? 'Réintégrer' : 'Retirer'}</span>
    </Button>
  );
}

export function DropoutDialog({
  groupId,
  participantId,
  name,
  existing,
}: {
  groupId: string;
  participantId: string;
  name: string;
  existing?: { reason: string | null; details: string | null; droppedAt: string | null };
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [state, action] = useActionState(async (previous: Awaited<ReturnType<typeof declareDropout>>, formData: FormData) => {
    const result = await declareDropout(groupId, participantId, previous, formData);
    if (result?.ok) {
      toast.success(existing ? `Abandon de ${name} mis à jour.` : `Abandon de ${name} enregistré.`);
      setOpen(false);
    }
    return result;
  }, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={existing ? `Modifier l’abandon de ${name}` : `Déclarer l’abandon de ${name}`}>
          {existing ? <Pencil aria-hidden /> : <DoorOpen aria-hidden />}
          <span className="hidden md:inline">{existing ? 'Modifier' : 'Abandon'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        title={existing ? `Abandon de ${name}` : `Déclarer l’abandon de ${name}`}
        description="La personne quitte le parcours : elle n’apparaît plus sur les feuilles de présence mais reste dans l’historique, les statistiques et l’échéancier des suivis. Pour une erreur d’inscription, utilisez plutôt « Retirer »."
      >
        <form action={action} className="space-y-4" noValidate>
          <Field label="Motif" required error={errors.reason} hint="Liste provisoire, à valider.">
            {({ id, describedBy, invalid }) => (
              <Select id={id} name="reason" required defaultValue={existing?.reason ?? ''} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
                <option value="" disabled>
                  Sélectionner
                </option>
                {DROP_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {DROP_REASONS[code]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Précisions" optional error={errors.details} hint={`Obligatoire pour « Autre motif ». ${DROP_DETAILS_MAX} caractères au plus.`}>
            {({ id, describedBy, invalid }) => (
              <Textarea id={id} name="details" rows={3} maxLength={DROP_DETAILS_MAX} defaultValue={existing?.details ?? ''} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          <Field label="Date de l’abandon" required error={errors.droppedAt} hint="Point de départ des suivis à 3 et 6 mois.">
            {({ id, describedBy, invalid }) => (
              <Input id={id} name="droppedAt" type="date" max={today} required defaultValue={existing?.droppedAt ?? today} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <SubmitButton>{existing ? 'Enregistrer' : 'Déclarer l’abandon'}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationSelect({ participantId, groupId, value, organizations, disabled, name }: { participantId: string; groupId: string; value: string | null; organizations: Option[]; disabled: boolean; name: string }) {
  const [current, setCurrent] = useState(value ?? '');
  const [pending, start] = useTransition();
  const change = (next: string) => {
    const previous = current;
    setCurrent(next);
    start(async () => {
      const result = await linkParticipantOrganization(participantId, next || null, groupId);
      if (result.ok) toast.success('Rattachement enregistré.');
      else {
        setCurrent(previous);
        toast.error(result.message ?? 'Rattachement impossible.');
      }
    });
  };
  return (
    <Select
      aria-label={`Organisme de ${name}`}
      value={current}
      disabled={disabled || pending}
      onChange={(event) => change(event.target.value)}
      className="h-9 min-w-44 text-sm"
    >
      <option value="">Aucun organisme</option>
      {organizations.map((organization) => (
        <option key={organization.id} value={organization.id}>{organization.name}</option>
      ))}
    </Select>
  );
}

/** Une ligne par session : titre, puis date, début, fin et lieu (colonnes au-delà de 48rem de large). */
const PLAN_ROW = '@3xl:grid-cols-[minmax(0,1fr)_9.5rem_8rem_8rem_minmax(0,1.1fr)]';

/** Champ d'une session : libellé visible sur les cartes, réservé aux lecteurs d'écran en grille (« Date de la session 3 »). */
function PlanInput({
  number,
  field,
  label,
  error,
  onValue,
  className,
  ...props
}: { number: number; field: PlanField; label: string; error?: string; onValue: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'onChange'>) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink @3xl:sr-only">
        {label}
        <span className="sr-only"> de la session {number}</span>
      </label>
      <Input
        id={id}
        name={fieldName(field, number)}
        onChange={(event) => onValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erreur` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-erreur`} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Création des sessions manquantes : chacune a sa date, son horaire et son lieu. Valeurs de départ hebdomadaires
 * depuis le début du groupe ; « Recopier sur les suivantes » reprend la première ligne remplie, une semaine plus tard.
 */
export function PlanSessionsForm({ groupId, missing, defaultStart }: { groupId: string; missing: { number: number; title: string }[]; defaultStart: string | null }) {
  const [state, action] = useActionState(planSessions.bind(null, groupId), null);
  const [rows, setRows] = useState<PlanRow[]>(() => initialRows(missing, defaultStart));
  const [copied, setCopied] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const emblems = useRef<(HTMLSpanElement | null)[]>([]);
  const baseId = useId();
  const hintId = `${baseId}-aide`;
  const errors = state?.fieldErrors ?? {};
  const source = firstFilledIndex(rows);
  const count = rows.length;

  // Après un refus, le premier champ à corriger reçoit le focus (il peut être loin sur téléphone).
  useEffect(() => {
    if (state?.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const change = (index: number, field: PlanField, value: string) => {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, [field]: value } : row)));
    setCopied(0);
  };

  const copy = () => {
    if (source < 0) return;
    setRows(copyForward(rows, source));
    setCopied(count - source - 1);
    // Les numéros des sessions recopiées s'allument l'un après l'autre (rien en mouvement réduit).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const orange = getComputedStyle(document.documentElement).getPropertyValue('--color-orange-500').trim();
    emblems.current.slice(source + 1).forEach((emblem, step) =>
      emblem?.animate([{ offset: 0, backgroundColor: orange, transform: 'scale(1.2)' }], { duration: 600, delay: step * 70, easing: 'ease-out' }),
    );
  };

  return (
    <form ref={formRef} action={action} className="@container space-y-4">
      <p className="text-[0.9375rem] text-ink-muted">
        {count > 1 ? 'Réglez la première session, recopiez-la sur les suivantes, puis ajustez ce qui change.' : 'Il reste une session à créer.'}
      </p>
      <div aria-hidden className={cn('hidden gap-3 text-sm text-ink-subtle @3xl:grid', PLAN_ROW)}>
        <span>Session</span>
        <span>Date</span>
        <span>Début</span>
        <span>Fin</span>
        <span>Lieu</span>
      </div>
      <ol className="space-y-3 @3xl:space-y-0 @3xl:divide-y @3xl:divide-line @3xl:border-y @3xl:border-line">
        {rows.map((row, index) => {
          const titleId = `${baseId}-session-${row.number}`;
          const error = (field: PlanField) => errors[fieldName(field, row.number)];
          return (
            <li key={row.number}>
              <div role="group" aria-labelledby={titleId} className={cn('grid gap-3 rounded-lg bg-paper p-3 @3xl:items-start @3xl:rounded-none @3xl:bg-transparent @3xl:px-0', PLAN_ROW)}>
                <p id={titleId} className="flex min-w-0 items-center gap-2.5 font-medium text-ink @3xl:min-h-10">
                  <span
                    ref={(element) => {
                      emblems.current[index] = element;
                    }}
                    aria-hidden
                    className="pixel-corners flex size-8 shrink-0 items-center justify-center bg-petrol-100 font-display text-sm font-semibold text-petrol-800"
                  >
                    {row.number}
                  </span>
                  <span className="min-w-0">
                    <span className="sr-only">Session {row.number} · </span>
                    {missing[index]?.title}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-3 @xl:grid-cols-[9.5rem_8rem_8rem_minmax(0,1fr)] @3xl:contents">
                  <PlanInput number={row.number} field="date" label="Date" type="date" value={row.date} error={error('date')} onValue={(value) => change(index, 'date', value)} className="col-span-2 @xl:col-span-1" />
                  <PlanInput number={row.number} field="start" label="Début" type="time" value={row.start} error={error('start')} onValue={(value) => change(index, 'start', value)} />
                  <PlanInput number={row.number} field="end" label="Fin" type="time" value={row.end} error={error('end')} onValue={(value) => change(index, 'end', value)} />
                  <PlanInput
                    number={row.number}
                    field="location"
                    label="Lieu"
                    value={row.location}
                    maxLength={LOCATION_MAX}
                    placeholder="Salle ou adresse"
                    error={error('location')}
                    onValue={(value) => change(index, 'location', value)}
                    className="col-span-2 @xl:col-span-1"
                  />
                </div>
              </div>
              {index === source && index < count - 1 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3 @3xl:pt-0 @3xl:pb-3 @3xl:pl-[2.625rem]">
                  <Button size="sm" variant="outline" onClick={copy} aria-describedby={hintId}>
                    <ChevronsDown aria-hidden />
                    Recopier sur les suivantes
                  </Button>
                  <p id={hintId} className={cn('text-sm text-ink-subtle', copied > 0 && 'sr-only')}>
                    Une semaine plus tard, mêmes horaires et même lieu.
                  </p>
                  <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
                    {copied > 0 ? (
                      <>
                        <Check className="size-4 shrink-0" aria-hidden />
                        {copied > 1 ? `Recopié sur les ${copied} sessions suivantes.` : 'Recopié sur la session suivante.'}
                      </>
                    ) : null}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <FormMessage state={state} />
      <SubmitButton>{count > 1 ? `Créer les ${count} sessions` : 'Créer la session'}</SubmitButton>
    </form>
  );
}
