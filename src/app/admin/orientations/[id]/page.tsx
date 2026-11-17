import type { Metadata } from 'next';

import { StaffReferralDetail } from '@/components/referrals/staff-views';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Orientation' };

export default async function AdminReferralPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('admin');
  const { id } = await params;
  return <StaffReferralDetail user={user} basePath="/admin/orientations" id={id} />;
}
