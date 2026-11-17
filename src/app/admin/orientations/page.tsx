import type { Metadata } from 'next';

import { ReferralQueue } from '@/components/referrals/staff-views';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Orientations' };

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ statut?: string; programme?: string; organisme?: string; tri?: string }> }) {
  const user = await requireRole('admin');
  return <ReferralQueue user={user} basePath="/admin/orientations" filters={await searchParams} />;
}
