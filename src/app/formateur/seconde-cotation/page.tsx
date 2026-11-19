import { Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { StartSecondRatingButton } from '@/components/reliability/start-button';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { myGroupIds } from '@/lib/trainer';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Seconde cotation' };

export default async function SecondRatingsPage() {
  const user = await requireRole('formateur');
  const supabase = await createClient();
  const [{ data: ratings }, groupIds] = await Promise.all([supabase.rpc('get_my_second_ratings', {}), myGroupIds(supabase, user.id)]);
  const sessions = new Map<string, { id: string; number: number; title: string; date: string | null; group: string; exercise: string | null; draft: number; submitted: number }>();
  for (const row of ratings ?? []) {
    const current = sessions.get(row.session_id) ?? { id: row.session_id, number: row.session_number, title: row.session_title, date: row.session_date, group: row.group_name, exercise: row.exercise_title, draft: 0, submitted: 0 };
    if (row.status === 'submitted') current.submitted += 1;
    else current.draft += 1;
    sessions.set(row.session_id, current);
  }
  // Séances de mes groupes que je n'anime pas : je peux y coter en second.
  const { data: groupSessions } = groupIds.length
    ? await supabase
        .from('sessions')
        .select('id, number, scheduled_date, status, trainer_id, program_sessions ( title ), groups ( name )')
        .in('group_id', groupIds)
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: false, nullsFirst: false })
        .limit(60)
    : { data: [] };
  const candidates = (groupSessions ?? [])
    .filter((session) => session.trainer_id !== user.id && !sessions.has(session.id))
    .slice(0, 30)
    .map((session) => ({
      id: session.id,
      number: session.number,
      title: session.program_sessions?.title ?? `Session ${session.number}`,
      date: session.scheduled_date,
      groupName: session.groups?.name ?? '',
    }));

  return (
    <>
      <PageHeader
        title="Seconde cotation"
        description="Coter en second, à l’aveugle, des participants observés par un autre formateur. Ces cotations servent uniquement à mesurer l’accord entre formateurs : elles n’entrent ni dans le passeport, ni dans le bilan."
      />
      <Card className="mb-6">
        <CardHeader title="Mes secondes cotations" description="Tant qu’une cotation n’est pas soumise, l’évaluation officielle correspondante vous reste masquée." />
        <CardBody>
          {sessions.size > 0 ? (
            <TableWrap label="Mes secondes cotations">
              <Table>
                <thead>
                  <tr>
                    <Th>Séance</Th>
                    <Th>Groupe</Th>
                    <Th>Avancement</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...sessions.values()].map((session) => (
                    <Tr key={session.id}>
                      <Td>
                        <Link href={`/formateur/seconde-cotation/${session.id}`} className="font-semibold text-ink hover:text-petrol-700 hover:underline">
                          Session {session.number} · {session.title}
                        </Link>
                        <span className="block text-sm text-ink-subtle">
                          {formatDate(session.date)}
                          {session.exercise ? ` · exercice « ${session.exercise} »` : ''}
                        </span>
                      </Td>
                      <Td className="text-ink-muted">{session.group}</Td>
                      <Td>
                        {session.draft > 0 ? <Badge variant="orange">{session.draft} à coter</Badge> : null}{' '}
                        {session.submitted > 0 ? <Badge variant="success">{session.submitted} soumise(s)</Badge> : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState icon={Scale} title="Aucune seconde cotation" description="Démarrez une seconde cotation sur une séance de vos groupes, ou attendez une invitation de l’administrateur à un exercice d’étalonnage." />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Coter une séance en second"
          description="Possible pour les participants dont l’évaluation officielle n’a pas encore commencé : idéalement, déclarez la seconde cotation avant la séance ou pendant, quand vous co-animez."
        />
        <CardBody>
          {candidates.length > 0 ? (
            <ul className="divide-y divide-line">
              {candidates.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    <span className="block font-medium">Session {session.number} · {session.title}</span>
                    <span className="text-sm text-ink-subtle">{session.groupName} · {formatDate(session.date)}</span>
                  </span>
                  <StartSecondRatingButton sessionId={session.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucune séance disponible : vous animez toutes les séances de vos groupes, ou vous n’êtes affecté à aucun groupe.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
