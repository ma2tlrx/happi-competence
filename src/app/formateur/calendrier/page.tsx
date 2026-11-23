import type { Metadata } from 'next';

import { CalendarPage, type CalendarSearchParams } from '@/components/calendar/calendar-page';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { myGroupIds } from '@/lib/trainer';

export const metadata: Metadata = { title: 'Calendrier' };

export default async function TrainerCalendarPage({ searchParams }: { searchParams: Promise<CalendarSearchParams> }) {
  const [params, user] = await Promise.all([searchParams, requireRole('formateur', 'admin')]);
  const supabase = await createClient();
  const groupIds = await myGroupIds(supabase, user.id);
  return <CalendarPage space="formateur" basePath="/formateur/calendrier" params={params} supabase={supabase} groupIds={groupIds} />;
}
