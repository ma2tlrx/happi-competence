'use client';

import { useActionState } from 'react';

import { Checkbox, FormMessage, SubmitButton } from '@/components/ui/form';
import type { ActionState } from '@/lib/action-state';
import { CONSENT_TEXTS } from '@/lib/referrals/fields';

import { YesNo } from './referral-form';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ConsentForm({ action, image, share, confirmed }: { action: Action; image: boolean; share: boolean; confirmed: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-5">
      <YesNo
        name="consentImage"
        legend={`${CONSENT_TEXTS.image.label} : j’accepte d’être pris(e) en photo ou filmé(e) pendant les séances (supports internes et communication de HAPPI).`}
        description={CONSENT_TEXTS.image.note}
        error={errors.consentImage}
        defaultValue={image}
      />
      <YesNo
        name="consentShareResults"
        legend={`${CONSENT_TEXTS.shareResults.label} : j’accepte que la structure qui m’a orienté(e) consulte mes présences et mes résultats.`}
        description={CONSENT_TEXTS.shareResults.note}
        error={errors.consentShareResults}
        defaultValue={share}
      />
      <Checkbox name="informed" label="J’ai pris connaissance de l’information sur le traitement de mes données." error={errors.informed} defaultChecked={confirmed} />
      <FormMessage state={state} />
      <SubmitButton>{confirmed ? 'Enregistrer mes choix' : 'Confirmer mes choix'}</SubmitButton>
    </form>
  );
}
