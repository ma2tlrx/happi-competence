'use client';

import { CircleCheck, Play, Undo2 } from 'lucide-react';
import { useActionState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, Select, SubmitButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';

import { setSessionStatus, updateSession } from '../../actions';

export function SessionStatusButtons({ sessionId, status }: { sessionId: string; status: string }) {
  const [pending, start] = useTransition();
  const run = (next: 'planned' | 'in_progress' | 'completed', message: string) =>
    start(async () => {
      const result = await setSessionStatus(sessionId, next);
      if (result.ok) toast.success(message);
      else toast.error(result.message ?? 'Action impossible.');
    });
  if (status === 'planned') {
    return (
      <Button onClick={() => run('in_progress', 'Session démarrée.')} loading={pending}>
        <Play aria-hidden />
        Démarrer la session
      </Button>
    );
  }
  if (status === 'in_progress') {
    return (
      <Button onClick={() => run('completed', 'Session terminée. Vous pouvez finaliser les évaluations.')} loading={pending}>
        <CircleCheck aria-hidden />
        Terminer la session
      </Button>
    );
  }
  if (status === 'completed') {
    return (
      <Button variant="ghost" onClick={() => run('in_progress', 'Session rouverte.')} loading={pending}>
        <Undo2 aria-hidden />
        Rouvrir
      </Button>
    );
  }
  return null;
}

export function SessionDetailsForm({
  sessionId,
  values,
}: {
  sessionId: string;
  values: { scheduledDate: string | null; startTime: string | null; endTime: string | null; location: string | null; status: string };
}) {
  const [state, action] = useActionState(updateSession.bind(null, sessionId), null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Date" error={errors.scheduledDate}>{({ id }) => <Input id={id} name="scheduledDate" type="date" defaultValue={values.scheduledDate ?? ''} />}</Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Début" error={errors.startTime}>{({ id }) => <Input id={id} name="startTime" type="time" defaultValue={values.startTime?.slice(0, 5) ?? ''} />}</Field>
        <Field label="Fin" error={errors.endTime}>{({ id, invalid }) => <Input id={id} name="endTime" type="time" defaultValue={values.endTime?.slice(0, 5) ?? ''} aria-invalid={invalid || undefined} />}</Field>
      </div>
      <Field label="Lieu" optional>{({ id }) => <Input id={id} name="location" defaultValue={values.location ?? ''} />}</Field>
      <Field label="Statut">
        {({ id }) => (
          <Select id={id} name="status" defaultValue={values.status}>
            <option value="planned">À venir</option>
            <option value="in_progress">En cours</option>
            <option value="completed">Terminée</option>
            <option value="cancelled">Annulée</option>
          </Select>
        )}
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Enregistrer</SubmitButton>
    </form>
  );
}
