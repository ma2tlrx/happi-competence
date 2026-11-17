import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ReferralForm } from '@/components/referrals/referral-form';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

import { createReferral } from '../actions';

export const metadata: Metadata = { title: 'Orienter une personne' };

export default async function NewReferralPage() {
  const user = await requireRole('organisme');
  const supabase = await createClient();
  const { data: programs } = await supabase.from('programs').select('id, name').eq('status', 'active').order('name');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/organisme/orientations" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Mes orientations
          </Link>
        }
        title="Orienter une personne"
        description="Une fiche courte, sans ressaisie : l’équipe HAPPI contacte la personne, lui propose un groupe et l’invite à créer son compte."
      />
      {hasPermission(user, 'org.referrals.write') ? (
        <ReferralForm action={createReferral} programs={programs ?? []} referentName={`${user.firstName} ${user.lastName}`.trim() || user.email} />
      ) : (
        <Card>
          <EmptyState title="Accès non ouvert" description="Votre compte ne permet pas d’orienter des personnes. Contactez l’équipe HAPPI." />
        </Card>
      )}
    </div>
  );
}
