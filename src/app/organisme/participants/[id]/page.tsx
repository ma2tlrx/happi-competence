import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ParticipantFile } from '@/components/passport/participant-file';
import { FinalReports } from '@/components/report/final-reports';
import { Notice } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { getPassport } from '@/lib/passport';
import { listReports } from '@/lib/report/load';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Fiche participant' };

export default async function OrganizationParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireRole('organisme');
  const supabase = await createClient();
  // RLS : la fiche n'est renvoyée que si le participant est rattaché à la structure de l'utilisateur.
  const passport = await getPassport(supabase, id);
  if (!passport) notFound();
  await supabase.rpc('log_event', { p_action: 'participant_file.viewed', p_entity_type: 'participant', p_entity_id: id });
  const reports = await listReports(supabase, id);
  return (
    <>
      {!hasPermission(user, 'org.evaluations.read') ? (
        <Notice variant="warning" className="mb-4" title="Évaluations non partagées">Votre structure n’a pas accès aux évaluations détaillées.</Notice>
      ) : null}
      <FinalReports reports={reports} canDownload={hasPermission(user, 'org.exports')} />
      <ParticipantFile
        passport={passport}
        canDownload={hasPermission(user, 'org.exports')}
        canCertify={hasPermission(user, 'org.exports') && hasPermission(user, 'org.attendance.read')}
        back={
          <Link href="/organisme/participants" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Participants
          </Link>
        }
      />
    </>
  );
}
