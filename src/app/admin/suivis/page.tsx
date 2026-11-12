import type { Metadata } from 'next';

import { FollowupsView } from '@/components/outcomes/followups-view';
import { PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadFollowups } from '@/lib/outcomes/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';

export const metadata: Metadata = { title: 'Suivis à faire' };

export default async function AdminFollowupsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const items = await loadFollowups(supabase, {}, todayIso());
  return (
    <>
      <PageHeader title="Suivis à faire" description="Situations de sortie et suivis à 3 et 6 mois, sur l’ensemble des groupes." />
      <FollowupsView items={items} canEdit participantHref={(id) => `/formateur/participants/${id}`} />
    </>
  );
}
