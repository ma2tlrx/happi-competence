import { Download, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { FilterSelect, Pagination, SearchInput } from '@/components/ui/navigation';
import { Badge, Card, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { getOrganizationOverview } from '@/lib/organization';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatPercent, normalizeText } from '@/lib/utils';

export const metadata: Metadata = { title: 'Participants' };
const PAGE_SIZE = 20;

export default async function OrganizationParticipantsPage({ searchParams }: { searchParams: Promise<{ q?: string; groupe?: string; programme?: string; page?: string }> }) {
  const { q = '', groupe, programme, page = '1' } = await searchParams;
  const user = await requireRole('organisme');
  const supabase = await createClient();
  const overview = await getOrganizationOverview(supabase);
  const query = normalizeText(q);
  const filtered = overview.participants.filter(
    (participant) =>
      (!query || normalizeText(`${participant.firstName} ${participant.lastName} ${participant.email ?? ''}`).includes(query)) &&
      (!groupe || participant.groupId === groupe) &&
      (!programme || participant.programName === programme),
  );
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);
  const programs = [...new Set(overview.participants.map((p) => p.programName).filter((v): v is string => Boolean(v)))];

  return (
    <>
      <PageHeader
        title="Participants"
        description="Les personnes rattachées à votre structure. Chaque fiche présente l’auto-évaluation, les évaluations validées et le bilan."
        actions={
          hasPermission(user, 'org.exports') ? (
            <Button asChild variant="outline">
              <a href="/api/exports/participants" download>
                <Download aria-hidden />
                Export CSV
              </a>
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput placeholder="Rechercher un participant" />
        <FilterSelect param="groupe" label="Filtrer par groupe" allLabel="Tous les groupes" options={overview.groups.map((g) => ({ value: g.id, label: g.name }))} />
        <FilterSelect param="programme" label="Filtrer par programme" allLabel="Tous les programmes" options={programs.map((p) => ({ value: p, label: p }))} />
      </div>
      <Card>
        {rows.length > 0 ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Participant</Th>
                  <Th>Programme</Th>
                  <Th>Entrée</Th>
                  <Th className="text-right">Sessions</Th>
                  <Th className="text-right">Présence</Th>
                  <Th>Avancement</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((participant) => (
                  <Tr key={participant.id}>
                    <Td>
                      <Link href={`/organisme/participants/${participant.id}`} className="font-semibold text-ink hover:text-petrol-700 hover:underline">
                        {participant.lastName.toUpperCase()} {participant.firstName}
                      </Link>
                      <span className="block text-sm text-ink-subtle">{participant.groupName ?? 'Sans groupe'}</span>
                    </Td>
                    <Td className="text-ink-muted">{participant.programName ?? '—'}</Td>
                    <Td className="text-sm whitespace-nowrap text-ink-muted">{formatDate(participant.joinedAt)}</Td>
                    <Td className="text-right tabular-nums">{participant.attended}/{participant.completedSessions}</Td>
                    <Td className="text-right tabular-nums">{formatPercent(participant.attendanceRate)}</Td>
                    <Td>
                      {!participant.groupId ? (
                        <Badge variant="outline">Non inscrit</Badge>
                      ) : participant.dropped ? (
                        <Badge variant="warning">Abandon</Badge>
                      ) : participant.completedSessions >= participant.totalSessions ? (
                        <Badge variant="success">Parcours terminé</Badge>
                      ) : (
                        <Badge variant="petrol">{participant.completedSessions}/{participant.totalSessions} sessions</Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Users} title={query || groupe || programme ? 'Aucun participant ne correspond' : 'Aucun participant rattaché'} description={query || groupe || programme ? 'Modifiez la recherche ou les filtres.' : 'Les participants apparaîtront ici dès qu’ils seront rattachés à votre structure.'} />
        )}
        <Pagination page={pageNumber} pageCount={pageCount} total={filtered.length} label="participants" />
      </Card>
    </>
  );
}
