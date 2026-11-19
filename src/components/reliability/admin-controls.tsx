'use client';

import { EyeOff, Lock, Send } from 'lucide-react';
import { useActionState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { closeExercise, createExercise, publishReliability, saveMinPairs, unpublishReliability } from '@/lib/reliability/actions';

export function MinPairsForm({ minPairs, bounds }: { minPairs: number; bounds: { min: number; max: number } }) {
  const [state, action] = useActionState(saveMinPairs, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <Field label="Effectif minimal de paires pour conclure" hint="30 par défaut (Koo et Li, 2016). En dessous, les tableaux affichent « effectif insuffisant pour conclure »." error={state?.fieldErrors?.minPairs} className="w-full max-w-md">
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="minPairs" type="number" min={bounds.min} max={bounds.max} step={1} defaultValue={minPairs} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <SubmitButton variant="secondary">Enregistrer le seuil</SubmitButton>
      {state?.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}

function useSimpleAction(run: () => Promise<{ ok: boolean; message?: string }>) {
  const [pending, start] = useTransition();
  return {
    pending,
    trigger: () =>
      start(async () => {
        const result = await run();
        if (result.ok) toast.success(result.message ?? 'Fait.');
        else toast.error(result.message ?? 'Opération impossible.');
      }),
  };
}

export function PublicationControls({ published }: { published: boolean }) {
  const publish = useSimpleAction(publishReliability);
  const unpublish = useSimpleAction(unpublishReliability);
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={publish.trigger} loading={publish.pending}>
        {publish.pending ? null : <Send aria-hidden />}
        {published ? 'Recalculer et republier' : 'Publier sur « Notre méthode »'}
      </Button>
      {published ? (
        <Button variant="outline" onClick={unpublish.trigger} loading={unpublish.pending}>
          {unpublish.pending ? null : <EyeOff aria-hidden />}
          Retirer de la page publique
        </Button>
      ) : null}
    </div>
  );
}

export function CloseExerciseButton({ exerciseId }: { exerciseId: string }) {
  const close = useSimpleAction(() => closeExercise(exerciseId));
  return (
    <Button size="sm" variant="outline" onClick={close.trigger} loading={close.pending}>
      {close.pending ? null : <Lock aria-hidden />}
      Clore
    </Button>
  );
}

export function ExerciseForm({
  sessionId,
  participants,
  trainers,
}: {
  sessionId: string;
  participants: { id: string; label: string }[];
  trainers: { id: string; label: string; hint?: string }[];
}) {
  const [state, action] = useActionState(createExercise, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="sessionId" value={sessionId} />
      <Field label="Titre de l’exercice" required error={errors.title}>
        {({ id, describedBy, invalid }) => <Input id={id} name="title" maxLength={160} required aria-describedby={describedBy} aria-invalid={invalid || undefined} placeholder="Ex. Étalonnage de novembre — séance 2" />}
      </Field>
      <Field label="Support et consignes d’observation" hint="Ce que chaque formateur observe (vidéo, déroulé écrit…) et comment. Jamais les niveaux officiels." error={errors.instructions}>
        {({ id, describedBy }) => <Textarea id={id} name="instructions" rows={4} maxLength={4000} aria-describedby={describedBy} />}
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Participants à coter</legend>
        {errors.participants ? <p className="mt-1 text-sm font-medium text-danger">{errors.participants}</p> : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {participants.map((person) => <Checkbox key={person.id} name="participants" value={person.id} label={person.label} />)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Formateurs invités</legend>
        <p className="mt-0.5 text-sm text-ink-muted">
          L’animateur de la séance, l’auteur de l’évaluation officielle et, si celle-ci est commencée, les formateurs du groupe sont écartés automatiquement : l’aveugle ne serait pas garanti.
        </p>
        {errors.raters ? <p className="mt-1 text-sm font-medium text-danger">{errors.raters}</p> : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {trainers.map((person) => <Checkbox key={person.id} name="raters" value={person.id} label={person.label} description={person.hint} />)}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton>Créer l’exercice</SubmitButton>
    </form>
  );
}
