import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { toCsv } from '@/lib/csv';
import { QUESTION_KIND_LABELS } from '@/lib/satisfaction/aggregate';
import { satisfactionFilters } from '@/lib/satisfaction/filters';
import { loadSatisfactionResults } from '@/lib/satisfaction/load';
import { AUDIENCE_LABELS, MOMENT_LABELS } from '@/lib/satisfaction/window';
import { createClient } from '@/lib/supabase/server';
import { formatNumericDate } from '@/lib/utils';

/** Réponses détaillées aux enquêtes de satisfaction (administrateur), une ligne par réponse à une question. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.role !== 'admin' || user.status !== 'active') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const search = request.nextUrl.searchParams;
  const filters = satisfactionFilters({ groupe: search.get('groupe'), programme: search.get('programme'), du: search.get('du'), au: search.get('au') });
  const supabase = await createClient();
  const { data: groups } = await supabase.from('groups').select('id, name, program_id, programs ( name )');
  const scoped = (groups ?? []).filter((group) => (!filters.groupId || group.id === filters.groupId) && (!filters.programId || group.program_id === filters.programId));
  const { rows, questions } = await loadSatisfactionResults(supabase, scoped.map((group) => group.id), { from: filters.from, to: filters.to });
  const groupById = new Map(scoped.map((group) => [group.id, group]));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const lines: (string | number | null)[][] = [
    ['Groupe', 'Programme', 'Destinataire', 'Moment', 'Date de réponse', 'Répondant', 'Réponse n°', 'Version', 'Question', 'Type', 'Valeur'],
    ...rows.map((row) => {
      const group = groupById.get(row.groupId);
      const question = questionById.get(row.questionId);
      return [
        group?.name ?? '',
        group?.programs?.name ?? '',
        AUDIENCE_LABELS[row.audience],
        MOMENT_LABELS[row.moment].label,
        formatNumericDate(row.submittedAt, ''),
        row.respondent ?? '',
        row.responseId?.slice(0, 8) ?? '',
        question?.versionLabel ?? '',
        question?.text ?? '',
        question ? QUESTION_KIND_LABELS[question.kind] : '',
        row.value ?? row.choice ?? row.textValue ?? '',
      ];
    }),
  ];
  return new NextResponse(toCsv(lines), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="satisfaction-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
