import { ArrowRight, Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DeleteButton, RecordDialog } from '@/components/quality/record-dialog';
import { Badge, Card, CardBody, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { deleteWatchEntry, saveWatchEntry } from '@/lib/quality/actions';
import { watchEntryFields } from '@/lib/quality/forms';
import { QUALIOPI_DISCLAIMER, QUALIOPI_HINTS, WATCH_KINDS, type WatchKind } from '@/lib/quality/labels';
import { loadImprovementActions, loadWatchEntries } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Veille' };

export default async function WatchPage() {
  await requireRole('admin');
  const today = todayIso();
  const supabase = await createClient();
  const [entries, actions] = await Promise.all([loadWatchEntries(supabase), loadImprovementActions(supabase)]);
  const actionsByEntry = new Map<string, number>();
  for (const action of actions) if (action.watchEntryId) actionsByEntry.set(action.watchEntryId, (actionsByEntry.get(action.watchEntryId) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Journal de veille"
        description={`Veille légale et réglementaire, métiers et emploi, pédagogique et technologique, handicap et accessibilité. ${QUALIOPI_HINTS.watch} — ${QUALIOPI_DISCLAIMER}`}
        actions={<RecordDialog mode="create" triggerLabel="Ajouter une entrée" title="Nouvelle entrée de veille" fields={watchEntryFields(today)} action={saveWatchEntry.bind(null, null)} />}
      />
      <Card>
        {entries.length === 0 ? (
          <EmptyState icon={Newspaper} title="Aucune entrée de veille" description="Notez ici les évolutions repérées (textes, métiers, pratiques pédagogiques, accessibilité) et ce qu’elles changent pour HAPPI." />
        ) : (
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Journal de veille">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Source et résumé</Th>
                    <Th>Impact et décision</Th>
                    <Th>Plan d’amélioration</Th>
                    <Th className="text-right">
                      <span className="sr-only">Gestion</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const linked = actionsByEntry.get(entry.id) ?? 0;
                    const query = new URLSearchParams({ origine: 'veille', veille: entry.id, nouveau: '1' }).toString();
                    return (
                      <Tr key={entry.id}>
                        <Td className="text-sm whitespace-nowrap">{formatDate(entry.observedOn)}</Td>
                        <Td>
                          <Badge variant="petrol">{WATCH_KINDS[entry.kind as WatchKind] ?? entry.kind}</Badge>
                        </Td>
                        <Td className="max-w-[22rem]">
                          <span className="font-semibold">{entry.source}</span>
                          <span className="block line-clamp-3 text-sm text-ink-muted">{entry.summary}</span>
                        </Td>
                        <Td className="max-w-[18rem] text-sm">
                          {entry.impact ?? <span className="text-ink-subtle">Impact non renseigné</span>}
                          {entry.decision ? <span className="mt-1 block text-ink-muted">Décision : {entry.decision}</span> : null}
                        </Td>
                        <Td className="text-sm">
                          {linked ? <span className="block">{`${linked} action${linked > 1 ? 's' : ''}`}</span> : null}
                          <Link href={`/admin/qualite/amelioration?${query}`} className="inline-flex min-h-8 items-center gap-1 font-semibold text-petrol-700 underline">
                            Créer une action
                            <ArrowRight className="size-4" aria-hidden />
                          </Link>
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          <RecordDialog
                            mode="edit"
                            triggerLabel="Modifier"
                            ariaLabel={`Modifier l’entrée « ${entry.source} »`}
                            title="Entrée de veille"
                            fields={watchEntryFields(today, entry)}
                            action={saveWatchEntry.bind(null, entry.id)}
                          />
                          <DeleteButton action={deleteWatchEntry.bind(null, entry.id)} label={`Supprimer l’entrée « ${entry.source} »`} confirm="Supprimer cette entrée de veille ? Les actions liées sont conservées." />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        )}
      </Card>
    </>
  );
}
