'use client';

import { BellRing, CircleAlert, CircleCheck } from 'lucide-react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/ui/form';
import type { ActionState } from '@/lib/action-state';
import { relaunchedLabel, type FollowupState } from '@/lib/organisme/groups';
import { cn } from '@/lib/utils';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Relance d'un membre. Le même composant reste en place avant et après l'envoi : la page revalidée remplace
 * le bouton par « Relancé·e le … » et le message de l'action reste affiché. La règle (qui peut être relancé,
 * une seule fois par absence) est vérifiée par le serveur et la base ; ce bouton n'en est que le reflet.
 */
export function RelaunchControl({
  action,
  groupId,
  participantId,
  fullName,
  followup,
}: {
  action: Action;
  groupId: string;
  participantId: string;
  fullName: string;
  followup: FollowupState;
}) {
  const [state, formAction] = useActionState(action, null);
  if (followup.kind === 'dropped') return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {followup.kind === 'to_relaunch' ? (
        <form action={formAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="sessionId" value={followup.sessionId} />
          <input type="hidden" name="participantId" value={participantId} />
          <SubmitButton size="sm">
            <BellRing aria-hidden />
            Relancer
            <span className="sr-only"> {fullName}</span>
          </SubmitButton>
        </form>
      ) : null}
      {followup.kind === 'relaunched' ? (
        <span className={cn('inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-petrol-700', state?.ok && 'animate-pop')}>
          <CircleCheck className="size-4" aria-hidden />
          {relaunchedLabel(followup.at)}
        </span>
      ) : null}
      {state?.message ? (
        <p role={state.ok ? 'status' : 'alert'} className={cn('flex items-start gap-1.5 text-sm font-medium', state.ok ? 'text-success' : 'text-danger')}>
          {state.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
