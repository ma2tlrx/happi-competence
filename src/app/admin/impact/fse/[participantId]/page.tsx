import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntryProfilePage } from '@/components/fse/entry-profile-page';
import { requireRole } from '@/lib/auth/session';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Fiche d’entrée FSE+' };

export default async function AdminEntryProfilePage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  if (!isUuid(participantId)) notFound();
  await requireRole('admin');
  return <EntryProfilePage participantId={participantId} back={{ href: '/admin/impact/fse', label: 'Indicateurs FSE+' }} />;
}
