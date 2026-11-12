import { ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';

import { FollowupsView } from '@/components/outcomes/followups-view';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { loadFollowups } from '@/lib/outcomes/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';

export const metadata: Metadata = { title: 'Suivis à faire' };

export default async function OrganizationFollowupsPage() {
  const user = await requireRole('organisme');
  const canEdit = hasPermission(user, 'org.outcomes.write');
  // Sans l'une de ces permissions, RLS masque les situations : l'échéancier serait trompeur.
  if (!user.organization || user.organization.status !== 'active' || !(canEdit || hasPermission(user, 'org.impact.read'))) {
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title="Accès non ouvert" description="Votre compte ne permet pas de consulter les suivis des participants. Contactez l’équipe HAPPI." />
      </Card>
    );
  }
  const supabase = await createClient();
  const items = await loadFollowups(supabase, { organizationId: user.organization.id }, todayIso());
  return (
    <>
      <PageHeader
        title="Suivis à faire"
        description="Situation de sortie des participants rattachés à votre structure, puis suivis à 3 et 6 mois après la fin du groupe ou l’abandon."
      />
      <FollowupsView items={items} canEdit={canEdit} participantHref={(id) => `/organisme/participants/${id}`} />
    </>
  );
}
