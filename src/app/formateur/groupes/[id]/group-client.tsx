'use client';

import { DoorOpen, Pencil, RotateCcw, UserMinus, UserPlus } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { DROP_DETAILS_MAX, DROP_REASON_CODES, DROP_REASONS } from '@/lib/outcomes/labels';

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

export function PlanSessionsForm({ groupId, missing, defaultStart }: { groupId: string; missing: { number: number; title: string }[]; defaultStart: string | null }) {
  const [state, action] = useActionState(planSessions.bind(null, groupId), null);
  const suggested = (index: number) => {
    if (!defaultStart) return '';
    const date = new Date(`${defaultStart}T12:00:00`);
    date.setDate(date.getDate() + index * 7);
    return date.toISOString().slice(0, 10);
  };
  return (
    <form action={action} className="space-y-4">
      <p className="text-[0.9375rem] text-ink-muted">
        {missing.length === 6 ? 'Créez les six sessions du programme en une fois.' : 'Créez les sessions restantes.'} Les dates proposées suivent un rythme hebdomadaire et restent modifiables.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {missing.map((session, index) => (
          <li key={session.number}>
            <Field label={`Session ${session.number} · ${session.title}`}>
              {({ id }) => <Input id={id} name={`date-${session.number}`} type="date" defaultValue={suggested(index)} />}
            </Field>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Début" error={state?.fieldErrors?.startTime}>{({ id, describedBy, invalid }) => <Input id={id} name="startTime" type="time" defaultValue="09:00" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}</Field>
        <Field label="Fin" error={state?.fieldErrors?.endTime}>{({ id, describedBy, invalid }) => <Input id={id} name="endTime" type="time" defaultValue="12:00" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}</Field>
        <Field label="Lieu" optional error={state?.fieldErrors?.location}>{({ id, describedBy, invalid }) => <Input id={id} name="location" maxLength={200} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}</Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Créer les sessions</SubmitButton>
    </form>
  );
}
