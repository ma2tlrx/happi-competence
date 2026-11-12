'use client';

import { Copy, Send, Trash2 } from 'lucide-react';
import { useActionState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';

import { cloneSurveyVersion, deleteSurveyDraft, publishSurveyVersion, saveSurveyVersion } from './actions';

type Simple = { ok: boolean; message?: string } | undefined | void;
function useRun() {
  const [pending, start] = useTransition();
  return {
    pending,
    run: (action: () => Promise<Simple>, success: string, confirm?: string) =>
      start(async () => {
        if (confirm && !window.confirm(confirm)) return;
        const result = await action();
        if (!result || result.ok) toast.success(success);
        else toast.error(result.message ?? 'Action impossible.');
      }),
  };
}

export function CloneSurveyButton({ versionId }: { versionId: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => cloneSurveyVersion(versionId), 'Nouvelle version créée.')}>
      <Copy aria-hidden />
      Nouvelle version
    </Button>
  );
}

export function DraftActions({ versionId }: { versionId: string }) {
  const { pending, run } = useRun();
  return (
    <>
      <Button variant="danger-outline" loading={pending} onClick={() => run(() => deleteSurveyDraft(versionId), 'Brouillon supprimé.', 'Supprimer définitivement ce brouillon ?')}>
        <Trash2 aria-hidden />
        Supprimer le brouillon
      </Button>
      <Button
        loading={pending}
        onClick={() =>
          run(
            () => publishSurveyVersion(versionId),
            'Enquête publiée : elle sera proposée pour les prochaines réponses.',
            'Publier cette version ? Elle ne pourra plus être modifiée ; la version publiée actuelle sera archivée (ses réponses sont conservées).',
          )
        }
      >
        <Send aria-hidden />
        Publier
      </Button>
    </>
  );
}

export function SurveyVersionForm({
  versionId,
  label,
  intro,
  isProvisional,
  ratingLabels,
  questions,
  disabled,
}: {
  versionId: string;
  label: string;
  intro: string | null;
  isProvisional: boolean;
  ratingLabels: string[];
  questions: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState(saveSurveyVersion.bind(null, versionId), null);
  return (
    <form action={action}>
      <fieldset disabled={disabled} className="space-y-4">
        <Field label="Nom de la version" required>
          {({ id }) => <Input id={id} name="label" defaultValue={label} maxLength={160} />}
        </Field>
        <Field label="Texte d’introduction" optional>
          {({ id }) => <Textarea id={id} name="intro" rows={3} maxLength={2000} defaultValue={intro ?? ''} />}
        </Field>
        <Checkbox name="isProvisional" defaultChecked={isProvisional} label="Enquête provisoire (signalée aux répondants)" />
        <div>
          <p className="mb-2 text-sm font-semibold">Libellés des notes de 1 à 5</p>
          <div className="grid gap-2 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((value) => (
              <Input key={value} name={`rating-${value}`} aria-label={`Libellé de la note ${value}`} defaultValue={ratingLabels[value - 1] ?? ''} maxLength={60} />
            ))}
          </div>
        </div>
        <Field
          label="Questions"
          hint="Une question par ligne : « type | intitulé ». Types : note (1 à 5), choix (ajoutez « | option ; option ; … »), texte (1 000 caractères), recommandation (0 à 10). Un « ? » après le type rend la question facultative, ex. « texte? | Un commentaire ? »."
        >
          {({ id, describedBy }) => <Textarea id={id} name="questions" rows={12} aria-describedby={describedBy} defaultValue={questions} />}
        </Field>
        <FormMessage state={state} />
        {!disabled ? <SubmitButton variant="secondary">Enregistrer</SubmitButton> : null}
      </fieldset>
    </form>
  );
}
