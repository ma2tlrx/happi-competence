import type { Metadata } from 'next';

import { CalendarPage, type CalendarSearchParams } from '@/components/calendar/calendar-page';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Calendrier' };

export default async function ParticipantCalendarPage({ searchParams }: { searchParams: Promise<CalendarSearchParams> }) {
  const [params] = await Promise.all([searchParams, requireRole('participant')]);
  const supabase = await createClient();
  return <CalendarPage space="participant" basePath="/participant/calendrier" params={params} supabase={supabase} />;
}
