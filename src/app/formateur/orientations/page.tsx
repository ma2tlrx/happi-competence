import type { Metadata } from 'next';

import { ReferralQueue } from '@/components/referrals/staff-views';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Orientations' };

export default async function TrainerReferralsPage({ searchParams }: { searchParams: Promise<{ statut?: string; programme?: string; organisme?: string; tri?: string }> }) {
  const user = await requireRole('formateur', 'admin');
  return <ReferralQueue user={user} basePath="/formateur/orientations" filters={await searchParams} />;
}
