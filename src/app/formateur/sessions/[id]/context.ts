import 'server-only';

import { notFound } from 'next/navigation';
import { cache } from 'react';

import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export type SessionMember = { id: string; firstName: string; lastName: string; email: string | null; organizationId: string | null };

/** Session, groupe et participants attendus : base commune des pages d'une session. */
export const getSessionContext = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, number, scheduled_date, start_time, end_time, location, status, started_at, completed_at, group_id, program_session_id, trainer_id, program_sessions ( id, number, title, summary, objectives, activities, key_notions, is_provisional ), groups ( id, name, program_id, organization_id, organizations ( name ), programs ( name, sessions_count ) )',
    )
    .eq('id', id)
    .maybeSingle();
  if (!session || !session.groups) notFound();

  const { data: members } = await supabase
    .from('group_members')
    .select('status, participants ( id, first_name, last_name, email, organization_id )')
    .eq('group_id', session.group_id)
    .order('joined_at');
  const active: SessionMember[] = (members ?? [])
    .filter((member) => member.status === 'active' && member.participants)
    .map((member) => ({
      id: member.participants!.id,
      firstName: member.participants!.first_name,
      lastName: member.participants!.last_name,
      email: member.participants!.email,
      organizationId: member.participants!.organization_id,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));

  return {
    user,
    supabase,
    session,
    group: session.groups,
    title: session.program_sessions?.title ?? `Session ${session.number}`,
    members: active,
  };
});
