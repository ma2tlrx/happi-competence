'use client';

import { Send } from 'lucide-react';
import { useActionState } from 'react';

import { FormMessage, SubmitButton } from '@/components/ui/form';

import { sendTestEmailToMe } from './actions';

export function TestEmailForm({ maskedEmail }: { maskedEmail: string }) {
  const [state, action] = useActionState(sendTestEmailToMe, null);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-muted">Le message part vers l’adresse de votre compte ({maskedEmail}).</p>
      <SubmitButton variant="outline">
        <Send aria-hidden />
        Envoyer un e-mail de test à moi-même
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
