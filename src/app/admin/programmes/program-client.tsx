'use client';

import { Globe, Pencil, Plus } from 'lucide-react';
import { useActionState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';

import { activateFrameworkVersion, saveProgram, saveProgramSession, setProgramPublic } from '../actions';

type Program = { id: string; name: string; description: string | null; sessions_count: number; session_duration_minutes: number; min_group_size: number; max_group_size: number };

export function ProgramDialog({ program }: { program?: Program }) {
  const [state, action] = useActionState(saveProgram.bind(null, program?.id ?? null), null);
  const e = state?.fieldErrors ?? {};
  return (
    <Dialog>
      <DialogTrigger asChild>
        {program ? <Button size="sm" variant="outline"><Pencil aria-hidden />Modifier</Button> : <Button><Plus aria-hidden />Nouveau programme</Button>}
      </DialogTrigger>
      <DialogContent title={program ? `Modifier ${program.name}` : 'Créer un programme'} description={program ? undefined : 'Une trame vide est créée avec une session par numéro, à compléter ensuite.'}>
        <form action={action} className="space-y-4" noValidate>
          <Field label="Nom" required error={e.name}>{({ id }) => <Input id={id} name="name" defaultValue={program?.name} />}</Field>
          <Field label="Description" optional>{({ id }) => <Textarea id={id} name="description" rows={3} defaultValue={program?.description ?? ''} />}</Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre de sessions" error={e.sessionsCount}>{({ id }) => <Input id={id} name="sessionsCount" type="number" min={1} max={24} defaultValue={program?.sessions_count ?? 6} disabled={Boolean(program)} />}</Field>
            <Field label="Durée d’une session (min)" error={e.sessionDuration}>{({ id }) => <Input id={id} name="sessionDuration" type="number" min={15} max={600} defaultValue={program?.session_duration_minutes ?? 180} />}</Field>
            <Field label="Participants minimum" error={e.minGroupSize}>{({ id }) => <Input id={id} name="minGroupSize" type="number" min={1} defaultValue={program?.min_group_size ?? 4} />}</Field>
            <Field label="Participants maximum" error={e.maxGroupSize}>{({ id }) => <Input id={id} name="maxGroupSize" type="number" min={1} defaultValue={program?.max_group_size ?? 8} />}</Field>
          </div>
          {program ? <input type="hidden" name="sessionsCount" value={program.sessions_count} /> : null}
          <FormMessage state={state} />
          <SubmitButton>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Sheet = { id: string; number: number; title: string; summary: string | null; objectives: string[]; activities: string[]; key_notions: string[]; takeaways: string[]; is_provisional: boolean };

export function ProgramSessionDialog({ sheet }: { sheet: Sheet }) {
  const [state, action] = useActionState(saveProgramSession.bind(null, sheet.id), null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-sm font-semibold text-petrol-700 hover:underline">Modifier</button>
      </DialogTrigger>
      <DialogContent size="lg" title={`Session ${sheet.number} de la trame`} description="Une ligne par élément. Ces informations alimentent la fiche de session du participant.">
        <form action={action} className="space-y-4" noValidate>
          <Field label="Titre" required error={state?.fieldErrors?.title}>{({ id }) => <Input id={id} name="title" defaultValue={sheet.title} />}</Field>
          <Field label="Résumé" optional>{({ id }) => <Textarea id={id} name="summary" rows={2} defaultValue={sheet.summary ?? ''} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Objectifs pédagogiques" optional>{({ id }) => <Textarea id={id} name="objectives" rows={4} defaultValue={sheet.objectives.join('\n')} />}</Field>
            <Field label="Activités" optional>{({ id }) => <Textarea id={id} name="activities" rows={4} defaultValue={sheet.activities.join('\n')} />}</Field>
            <Field label="Notions essentielles" optional>{({ id }) => <Textarea id={id} name="keyNotions" rows={4} defaultValue={sheet.key_notions.join('\n')} />}</Field>
            <Field label="Points à retenir" optional>{({ id }) => <Textarea id={id} name="takeaways" rows={4} defaultValue={sheet.takeaways.join('\n')} />}</Field>
          </div>
          <Checkbox name="isProvisional" defaultChecked={sheet.is_provisional} label="Contenu provisoire" description="Signalé comme tel aux participants et aux formateurs." />
          <FormMessage state={state} />
          <SubmitButton>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FrameworkVersionSelect({ programId, frameworkId, current, versions, frameworkName }: { programId: string; frameworkId: string; current: string | null; versions: { id: string; label: string }[]; frameworkName: string }) {
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label={`Version active du référentiel ${frameworkName}`}
      defaultValue={current ?? ''}
      disabled={pending || versions.length === 0}
      className="h-9 text-sm"
      onChange={(event) => {
        const versionId = event.target.value;
        if (!versionId) return;
        start(async () => {
          const result = await activateFrameworkVersion(programId, frameworkId, versionId);
          if (result.ok) toast.success('Version activée pour ce programme. Les nouvelles évaluations l’utiliseront ; les anciennes restent inchangées.');
          else toast.error(result.message ?? 'Activation impossible.');
        });
      }}
    >
      <option value="" disabled>{versions.length ? 'Choisir une version publiée' : 'Aucune version publiée'}</option>
      {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
    </Select>
  );
}

export function PublicButton({ programId }: { programId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => start(async () => {
      const result = await setProgramPublic(programId);
      if (result.ok) toast.success('Ce programme est présenté sur le site.');
      else toast.error(result.message ?? 'Action impossible.');
    })}>
      <Globe aria-hidden />
      Présenter sur le site
    </Button>
  );
}
