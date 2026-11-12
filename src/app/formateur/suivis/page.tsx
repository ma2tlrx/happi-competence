import type { Metadata } from 'next';

import { FollowupsView } from '@/components/outcomes/followups-view';
import { PageHeader } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { loadFollowups } from '@/lib/outcomes/load';
import { createClient } from '@/lib/supabase/server';
import { myGroupIds, todayIso } from '@/lib/trainer';

export const metadata: Metadata = { title: 'Suivis à faire' };

export default async function TrainerFollowupsPage() {
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const groupIds = await myGroupIds(supabase, user.id);
  const items = await loadFollowups(supabase, { groupIds }, todayIso());
  return (
    <>
      <PageHeader
        title="Suivis à faire"
        description="Situation de sortie des participants de vos groupes terminés (et des abandons), puis suivis à 3 et 6 mois."
      />
      <FollowupsView items={items} canEdit={hasPermission(user, 'outcomes.write')} participantHref={(id) => `/formateur/participants/${id}`} />
    </>
  );
}
