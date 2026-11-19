import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntryProfilePage } from '@/components/fse/entry-profile-page';
import { requireRole } from '@/lib/auth/session';
import { canManageEntryProfiles } from '@/lib/fse/load';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Fiche d’entrée FSE+' };

export default async function OrganizationEntryProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireRole('organisme');
  if (!canManageEntryProfiles(user)) notFound();
  return <EntryProfilePage participantId={id} back={{ href: `/organisme/participants/${id}`, label: 'Fiche participant' }} />;
}
