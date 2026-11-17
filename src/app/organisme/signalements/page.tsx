import type { Metadata } from 'next';

import { MyComplaints } from '@/components/quality/my-complaints';
import { ReportProblemButton } from '@/components/quality/report-problem';
import { Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadMyComplaints } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Signaler un problème' };

export default async function OrganizationComplaintsPage() {
  const user = await requireRole('organisme');
  const complaints = await loadMyComplaints(await createClient(), user.id);
  const active = user.organization?.status === 'active';
  return (
    <>
      <PageHeader
        title="Signaler un problème"
        description="Une difficulté dans l’accompagnement de vos participants, un incident, une insatisfaction ? Signalez-le à l’équipe HAPPI : chaque signalement reçoit une réponse."
        actions={active ? <ReportProblemButton hint="Le signalement est rattaché à votre structure et transmis à l’équipe HAPPI." /> : null}
      />
      {!active ? (
        <Notice variant="warning" className="mb-6">
          Votre structure n’est pas encore active : vous pourrez signaler un problème dès sa validation.
        </Notice>
      ) : null}
      <MyComplaints complaints={complaints} />
    </>
  );
}
