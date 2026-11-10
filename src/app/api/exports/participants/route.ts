import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/auth/session';
import { getOrganizationOverview } from '@/lib/organization';
import { createClient } from '@/lib/supabase/server';
import { formatNumericDate } from '@/lib/utils';

const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;

/** Liste des participants visibles (organisme : les siens ; administrateur : tous), au format CSV. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!(user.role === 'admin' || (user.role === 'organisme' && hasPermission(user, 'org.exports')))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }
  const supabase = await createClient();
  const overview = await getOrganizationOverview(supabase);
  const lines = [
    ['Nom', 'Prénom', 'E-mail', 'Groupe', 'Programme', 'Entrée', 'Sessions suivies', 'Sessions réalisées', 'Taux de présence', 'Évaluations validées'],
    ...overview.participants.map((p) => [
      p.lastName,
      p.firstName,
      p.email ?? '',
      p.groupName ?? '',
      p.programName ?? '',
      formatNumericDate(p.joinedAt),
      String(p.attended),
      String(p.completedSessions),
      p.attendanceRate === null ? '' : `${Math.round(p.attendanceRate)} %`,
      String(p.evaluated),
    ]),
  ];
  await supabase.rpc('log_event', { p_action: 'export.participants_csv' });
  return new NextResponse(`﻿${lines.map((line) => line.map(cell).join(';')).join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="participants-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
