import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { mfaStep } from '@/lib/auth/mfa';
import { addDays, parisNow } from '@/lib/calendar/calendar';
import { calendarSpaceFor } from '@/lib/calendar/access';
import { buildIcs } from '@/lib/calendar/ics';
import { loadCalendar } from '@/lib/calendar/queries';
import { createClient } from '@/lib/supabase/server';
import { myGroupIds } from '@/lib/trainer';

/**
 * « Ajouter à mon agenda » : fichier .ics des sessions que le compte connecté peut voir
 * (deux mois en arrière, un an en avant). Authentifié par la session ; aucun lien public.
 * Lecture avec le client de l'appelant : la sécurité au niveau des lignes borne le contenu.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.status !== 'active' || mfaStep(user.mfa) !== null) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const space = calendarSpaceFor(user);
  if (space === 'admin') return NextResponse.json({ error: 'Export réservé aux formateurs, organismes et participants.' }, { status: 403 });

  const supabase = await createClient();
  const today = parisNow().date;
  const groupIds = space === 'formateur' ? await myGroupIds(supabase, user.id) : undefined;
  const { events } = await loadCalendar(supabase, { space, from: addDays(today, -60), to: addDays(today, 365), groupIds });
  return new NextResponse(buildIcs(events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sessions-happi.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
