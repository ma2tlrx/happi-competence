import type { Metadata } from 'next';

import { MyComplaints } from '@/components/quality/my-complaints';
import { ReportProblemButton } from '@/components/quality/report-problem';
import { PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadMyComplaints } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Signaler un problème' };

export default async function ParticipantComplaintsPage() {
  const user = await requireRole('participant');
  const complaints = await loadMyComplaints(await createClient(), user.id);
  return (
    <>
      <PageHeader
        title="Signaler un problème"
        description="Une difficulté pendant le programme, une insatisfaction, un incident ? Dites-le à l’équipe HAPPI : chaque signalement est lu et reçoit une réponse."
        actions={<ReportProblemButton hint="Votre signalement est transmis à l’équipe HAPPI, pas à votre groupe." />}
      />
      <MyComplaints complaints={complaints} />
    </>
  );
}
