import { ListTodo } from 'lucide-react';
import type { Metadata } from 'next';

import { DeleteButton, RecordDialog } from '@/components/quality/record-dialog';
import { Badge, Card, CardBody, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { deleteImprovementAction, saveImprovementAction } from '@/lib/quality/actions';
import { improvementActionFields } from '@/lib/quality/forms';
import { isOverdue } from '@/lib/quality/indicators';
import { ACTION_ORIGIN_CODES, ACTION_ORIGINS, ACTION_STATUSES, QUALIOPI_DISCLAIMER, QUALIOPI_HINTS, type ActionOrigin, type ActionStatus } from '@/lib/quality/labels';
import { loadComplaints, loadImprovementActions, loadWatchEntries } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Plan d’amélioration' };

export default async function ImprovementPlanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole('admin');
  const params = await searchParams;
  const today = todayIso();
  const supabase = await createClient();
  const [actions, complaints, watch] = await Promise.all([loadImprovementActions(supabase), loadComplaints(supabase), loadWatchEntries(supabase)]);
  const links = {
    complaints: complaints.map((complaint) => ({ id: complaint.id, label: `${formatDate(complaint.receivedOn)} · ${complaint.subject}` })),
    watch: watch.map((entry) => ({ id: entry.id, label: `${formatDate(entry.observedOn)} · ${entry.source}` })),
  };
  // Lien direct depuis les résultats de satisfaction ou une entrée de veille : formulaire prérempli.
  const origin = typeof params.origine === 'string' && (ACTION_ORIGIN_CODES as string[]).includes(params.origine) ? (params.origine as ActionOrigin) : undefined;
  const watchEntryId = typeof params.veille === 'string' && watch.some((entry) => entry.id === params.veille) ? params.veille : undefined;
  const originDetails = typeof params.precision === 'string' ? params.precision.slice(0, 300) : undefined;

  return (
    <>
      <PageHeader
        title="Plan d’amélioration continue"
        description={`Actions décidées à la suite d’une réclamation, des résultats de satisfaction, d’un audit, de la veille ou d’un retour de formateur. ${QUALIOPI_HINTS.improvement} — ${QUALIOPI_DISCLAIMER}`}
        actions={
          <RecordDialog
            key={origin ?? 'nouvelle'}
            mode="create"
            triggerLabel="Ajouter une action"
            title="Nouvelle action d’amélioration"
            fields={improvementActionFields({ origin, watchEntryId, originDetails }, links)}
            action={saveImprovementAction.bind(null, null)}
            defaultOpen={params.nouveau === '1'}
          />
        }
      />
      <Card>
        {actions.length === 0 ? (
          <EmptyState icon={ListTodo} title="Aucune action pour le moment" description="Ajoutez une action ou créez-la depuis une réclamation, une entrée de veille ou la page Satisfaction." />
        ) : (
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Plan d’amélioration">
              <Table>
                <thead>
                  <tr>
                    <Th>Action</Th>
                    <Th>Origine</Th>
                    <Th>Responsable</Th>
                    <Th>Échéance</Th>
                    <Th>Statut</Th>
                    <Th>Efficacité constatée</Th>
                    <Th className="text-right">
                      <span className="sr-only">Gestion</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => {
                    const status = ACTION_STATUSES[action.status as ActionStatus];
                    return (
                      <Tr key={action.id}>
                        <Td className="max-w-[20rem]">
                          <span className="font-semibold">{action.title}</span>
                          {action.description ? <span className="block line-clamp-2 text-sm text-ink-muted">{action.description}</span> : null}
                        </Td>
                        <Td className="text-sm">
                          {ACTION_ORIGINS[action.origin as ActionOrigin] ?? action.origin}
                          {action.complaintSubject ? <span className="block text-ink-subtle">« {action.complaintSubject} »</span> : null}
                          {action.watchSource ? <span className="block text-ink-subtle">{action.watchSource}</span> : null}
                          {action.originDetails ? <span className="block text-ink-subtle">{action.originDetails}</span> : null}
                        </Td>
                        <Td className="text-sm">{action.ownerName ?? <span className="text-ink-subtle">—</span>}</Td>
                        <Td className="text-sm whitespace-nowrap">
                          {action.dueOn ? formatDate(action.dueOn) : '—'}
                          {isOverdue(action, today) ? (
                            <Badge variant="danger" className="ml-2">
                              En retard
                            </Badge>
                          ) : null}
                        </Td>
                        <Td>
                          {status ? <Badge variant={status.variant}>{status.label}</Badge> : action.status}
                          {action.closedOn ? <span className="block text-xs text-ink-subtle">le {formatDate(action.closedOn)}</span> : null}
                        </Td>
                        <Td className="max-w-[16rem] text-sm">
                          {action.effectiveness ?? <span className="text-ink-subtle">{action.status === 'done' ? 'À renseigner' : '—'}</span>}
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          <RecordDialog
                            mode="edit"
                            triggerLabel="Modifier"
                            ariaLabel={`Modifier l’action « ${action.title} »`}
                            title="Action d’amélioration"
                            description="Chaque modification est conservée dans le journal d’activité."
                            fields={improvementActionFields(action, links)}
                            action={saveImprovementAction.bind(null, action.id)}
                          />
                          <DeleteButton action={deleteImprovementAction.bind(null, action.id)} label={`Supprimer l’action « ${action.title} »`} confirm="Supprimer cette action du plan d’amélioration ?" />
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
