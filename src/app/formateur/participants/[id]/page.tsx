import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OutcomesCard } from '@/components/outcomes/outcomes-card';
import { ParticipantFile } from '@/components/passport/participant-file';
import { NeedsAssessmentCard } from '@/components/quality/needs-assessment-card';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { loadParticipantOutcomes, participantGroups } from '@/lib/outcomes/load';
import { getPassport } from '@/lib/passport';
import { loadNeedsAssessment } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Fiche participant' };

export default async function TrainerParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const passport = await getPassport(supabase, id);
  if (!passport) notFound();
  const groupIds = participantGroups(passport).map((group) => group.id);
  const [, outcomes, needs, trains] = await Promise.all([
    supabase.rpc('log_event', { p_action: 'participant_file.viewed', p_entity_type: 'participant', p_entity_id: id }),
    loadParticipantOutcomes(supabase, id),
    loadNeedsAssessment(supabase, id),
    user.role === 'admin' || groupIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase.from('group_trainers').select('group_id').eq('trainer_id', user.id).in('group_id', groupIds),
  ]);
  // L'analyse du besoin s'écrit par l'administrateur ou un formateur d'un groupe du participant (RLS).
  const canEditNeeds = user.role === 'admin' || (trains.data ?? []).length > 0;
  return (
    <>
      <ParticipantFile
        passport={passport}
        reportHref={`/formateur/participants/${id}/bilan`}
        canCertify
        back={
          <Link href={passport.group ? `/formateur/groupes/${passport.group.id}` : '/formateur/groupes'} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            {passport.group?.name ?? 'Groupes'}
          </Link>
        }
      />
      <OutcomesCard
        participantId={id}
        participantName={`${passport.participant.firstName} ${passport.participant.lastName}`}
        groups={participantGroups(passport)}
        records={outcomes}
        canEdit={hasPermission(user, 'outcomes.write')}
      />
      <NeedsAssessmentCard
        participantId={id}
        participantName={`${passport.participant.firstName} ${passport.participant.lastName}`}
        assessment={needs}
        canEdit={canEditNeeds}
      />
    </>
  );
}
