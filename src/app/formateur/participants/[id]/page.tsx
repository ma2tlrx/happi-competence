import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ParticipantFile } from '@/components/passport/participant-file';
import { requireRole } from '@/lib/auth/session';
import { getPassport } from '@/lib/passport';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Fiche participant' };

export default async function TrainerParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const passport = await getPassport(supabase, id);
  if (!passport) notFound();
  await supabase.rpc('log_event', { p_action: 'participant_file.viewed', p_entity_type: 'participant', p_entity_id: id });
  return (
    <ParticipantFile
      passport={passport}
      reportHref={`/formateur/participants/${id}/bilan`}
      back={
        <Link href={passport.group ? `/formateur/groupes/${passport.group.id}` : '/formateur/groupes'} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {passport.group?.name ?? 'Groupes'}
        </Link>
      }
    />
  );
}
