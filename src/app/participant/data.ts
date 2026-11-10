import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { requireRole } from '@/lib/auth/session';
import { getPassport } from '@/lib/passport';
import { createClient } from '@/lib/supabase/server';

/** Passeport du participant connecté (une seule lecture par requête). */
export const getMyPassport = cache(async () => {
  const user = await requireRole('participant');
  if (!user.participantId) redirect('/compte');
  const supabase = await createClient();
  const passport = await getPassport(supabase, user.participantId);
  if (!passport) redirect('/compte');
  return { user, passport, supabase };
});
