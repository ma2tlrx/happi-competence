'use client';

import { Send, Upload } from 'lucide-react';
import { useActionState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';

import { importSupport, publishSupportVersion } from './actions';

export function ImportForm({ programSessionId }: { programSessionId: string }) {
  const [state, action] = useActionState(importSupport.bind(null, programSessionId), null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Fichier Markdown (.md)" hint="Ou collez le contenu ci-dessous.">
        {({ id, describedBy }) => <Input id={id} name="file" type="file" accept=".md,.markdown,.txt,text/markdown" aria-describedby={describedBy} className="h-auto py-2" />}
      </Field>
      <Field label="Contenu Markdown" optional>{({ id }) => <Textarea id={id} name="markdown" rows={6} className="font-mono text-sm" />}</Field>
      <Field label="Note de version" optional>{({ id }) => <Input id={id} name="note" placeholder="Ex. Support officiel transmis par l’équipe pédagogique" />}</Field>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Checkbox name="publish" defaultChecked label="Publier immédiatement" description="La version devient celle du lecteur des formateurs." />
        <Checkbox name="isProvisional" label="Contenu provisoire" />
      </div>
      <FormMessage state={state} />
      <SubmitButton><Upload aria-hidden />Importer la version</SubmitButton>
    </form>
  );
}

export function PublishVersionButton({ versionId }: { versionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => start(async () => {
      const result = await publishSupportVersion(versionId);
      if (result.ok) toast.success('Cette version est désormais utilisée par le lecteur.');
      else toast.error(result.message ?? 'Publication impossible.');
    })}>
      <Send aria-hidden />
      Utiliser cette version
    </Button>
  );
}
