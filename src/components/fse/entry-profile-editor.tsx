import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Notice } from '@/components/ui/primitives';
import type { ActionState } from '@/lib/action-state';
import { COMPLETENESS_LABELS, PRIVACY_NOTICE, completeness, missingCoreFields, type EntryProfileRecord } from '@/lib/fse/codes';
import type { ParticipantGroup } from '@/lib/fse/load';
import { formatDate } from '@/lib/utils';

import { EntryProfileForm } from './entry-profile-form';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Mention d'information (finalité, destinataires, droit de ne pas répondre). Provisoire — à valider. */
export function PrivacyNoticeCard({ audience }: { audience: 'participant' | 'professional' }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-5 text-petrol-700" aria-hidden />
            {audience === 'participant' ? PRIVACY_NOTICE.title : 'Information à donner à la personne'}
          </span>
        }
      />
      <CardBody className="space-y-3">
        <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] text-ink-muted">
          {PRIVACY_NOTICE.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="text-sm text-ink-subtle">{PRIVACY_NOTICE.legalBasis}</p>
        <p className="text-sm text-ink-subtle">{PRIVACY_NOTICE.provisional}</p>
      </CardBody>
    </Card>
  );
}

const VARIANT = { missing: 'outline', partial: 'warning', complete: 'success' } as const;

export function CompletenessBadge({ profile }: { profile: EntryProfileRecord | null }) {
  const state = completeness(profile);
  return <Badge variant={VARIANT[state]}>{COMPLETENESS_LABELS[state]}</Badge>;
}

/** Une fiche par groupe du participant (et une fiche hors groupe s'il n'en a aucun). */
export function EntryProfileEditor({
  action,
  participantId,
  groups,
  profiles,
  mode,
}: {
  action: Action;
  participantId?: string;
  groups: ParticipantGroup[];
  profiles: EntryProfileRecord[];
  mode: 'professional' | 'participant';
}) {
  const targets: { id: string | null; name: string; dropped: boolean }[] = groups.length
    ? groups.map((group) => ({ id: group.id, name: group.name, dropped: group.status === 'dropped' }))
    : [{ id: null, name: mode === 'participant' ? 'Votre parcours' : 'Hors groupe', dropped: false }];
  return (
    <div className="space-y-6">
      {targets.map((target) => {
        const profile = profiles.find((item) => item.groupId === target.id) ?? null;
        const missing = profile ? missingCoreFields(profile) : [];
        return (
          <Card key={target.id ?? 'hors-groupe'}>
            <CardHeader
              title={target.id ? `Groupe « ${target.name} »` : target.name}
              description={
                profile
                  ? `Dernière mise à jour le ${formatDate(profile.updatedAt.slice(0, 10))}${profile.participantConfirmedAt ? ` · relue par la personne le ${formatDate(profile.participantConfirmedAt.slice(0, 10))}` : ''}`
                  : 'Aucune réponse enregistrée pour l’instant.'
              }
              action={
                <span className="flex flex-wrap gap-2">
                  {target.dropped ? <Badge variant="warning">Abandon</Badge> : null}
                  <CompletenessBadge profile={profile} />
                </span>
              }
            />
            <CardBody className="space-y-5">
              {mode === 'professional' && profile && missing.length ? (
                <Notice variant="warning" title="Données manquantes pour le rapport FSE+">
                  {missing.join(', ')}.
                </Notice>
              ) : null}
              <EntryProfileForm
                action={action}
                participantId={participantId}
                groupId={target.id}
                values={profile}
                mode={mode}
                informed={Boolean(profile?.participantInformedAt)}
              />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/** Résumé de la fiche d'entrée sur la fiche participant (espace organisme), avec lien vers la saisie. */
export function EntryProfileSummaryCard({ href, groups, profiles }: { href: string; groups: { id: string; name: string; status: string }[]; profiles: EntryProfileRecord[] }) {
  const visible = groups.filter((group) => group.status !== 'removed');
  const targets = visible.length ? visible.map((group) => ({ id: group.id as string | null, name: group.name })) : [{ id: null, name: 'Hors groupe' }];
  return (
    <Card className="mt-6">
      <CardHeader
        title="Fiche d’entrée (FSE+ et financeurs)"
        description="Données sensibles, jamais visibles par le formateur. Chaque consultation est journalisée."
        action={
          <Link href={href} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
            Ouvrir la fiche
          </Link>
        }
      />
      <CardBody>
        <ul className="space-y-2">
          {targets.map((target) => (
            <li key={target.id ?? 'hors-groupe'} className="flex flex-wrap items-center justify-between gap-2 text-[0.9375rem]">
              <span>{target.name}</span>
              <CompletenessBadge profile={profiles.find((profile) => profile.groupId === target.id) ?? null} />
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
