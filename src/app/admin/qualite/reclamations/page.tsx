import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';

import { PeriodFilter } from '@/components/quality/period-filter';
import { DeleteButton, RecordDialog } from '@/components/quality/record-dialog';
import { Badge, Card, CardBody, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { deleteComplaint, saveComplaint, saveImprovementAction } from '@/lib/quality/actions';
import { complaintFields, improvementActionFields } from '@/lib/quality/forms';
import { complaintAge, complaintDelay } from '@/lib/quality/indicators';
import { COMPLAINT_CHANNELS, COMPLAINT_SOURCES, COMPLAINT_STATUSES, QUALIOPI_DISCLAIMER, QUALIOPI_HINTS, type ComplaintChannel, type ComplaintSource, type ComplaintStatus } from '@/lib/quality/labels';
import { loadComplaints, loadImprovementActions, parsePeriod } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { formatDate, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Réclamations' };

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole('admin');
  const today = todayIso();
  const period = parsePeriod(await searchParams, today);
  const supabase = await createClient();
  const [complaints, actions] = await Promise.all([loadComplaints(supabase, period), loadImprovementActions(supabase)]);
  const actionsByComplaint = new Map<string, number>();
  for (const action of actions) if (action.complaintId) actionsByComplaint.set(action.complaintId, (actionsByComplaint.get(action.complaintId) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Réclamations et incidents"
        description={`Registre des réclamations : réception, réponse apportée, délai de traitement, action corrective. ${QUALIOPI_HINTS.improvement} — ${QUALIOPI_DISCLAIMER}`}
        actions={
          <RecordDialog
            mode="create"
            triggerLabel="Saisir une réclamation"
            title="Nouvelle réclamation"
            description="Pour une réclamation reçue par téléphone, e-mail, courrier ou en entretien. Les participants et les organismes peuvent aussi signaler un problème depuis leur espace."
            fields={complaintFields(today)}
            action={saveComplaint.bind(null, null)}
          />
        }
      />
      <PeriodFilter from={period.from} to={period.to} today={today} />
      <Card>
        {complaints.length === 0 ? (
          <EmptyState icon={Inbox} title="Aucune réclamation sur la période" description="Les signalements déposés depuis les espaces et les réclamations saisies ici apparaîtront dans ce registre." />
        ) : (
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Registre des réclamations">
              <Table>
                <thead>
                  <tr>
                    <Th>Reçue le</Th>
                    <Th>Objet</Th>
                    <Th>Source</Th>
                    <Th>Statut</Th>
                    <Th>Délai</Th>
                    <Th>Actions liées</Th>
                    <Th className="text-right">
                      <span className="sr-only">Gestion</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => {
                    const delay = complaintDelay(complaint);
                    const age = complaintAge(complaint, today);
                    const status = COMPLAINT_STATUSES[complaint.status as ComplaintStatus];
                    const linked = actionsByComplaint.get(complaint.id) ?? 0;
                    return (
                      <Tr key={complaint.id}>
                        <Td className="text-sm whitespace-nowrap">{formatDate(complaint.receivedOn)}</Td>
                        <Td className="max-w-[22rem]">
                          <span className="font-semibold">{complaint.subject}</span>
                          <span className="block line-clamp-2 text-sm text-ink-muted">{complaint.description}</span>
                          {complaint.response ? <span className="mt-1 block line-clamp-2 text-sm text-ink-subtle">Réponse : {complaint.response}</span> : null}
                        </Td>
                        <Td className="text-sm">
                          {COMPLAINT_SOURCES[complaint.source as ComplaintSource] ?? complaint.source}
                          <span className="block text-ink-subtle">
                            {COMPLAINT_CHANNELS[complaint.channel as ComplaintChannel] ?? complaint.channel}
                            {complaint.participantName ? ` · ${complaint.participantName}` : complaint.organizationName ? ` · ${complaint.organizationName}` : complaint.reporterName ? ` · ${complaint.reporterName}` : ''}
                          </span>
                        </Td>
                        <Td>{status ? <Badge variant={status.variant}>{status.label}</Badge> : complaint.status}</Td>
                        <Td className="text-sm whitespace-nowrap">
                          {delay !== null ? `${delay} ${pluralize(delay, 'jour')}` : <span className="text-ink-subtle">{`en attente depuis ${age} ${pluralize(age ?? 0, 'jour')}`}</span>}
                        </Td>
                        <Td className="text-sm">
                          {linked ? `${linked} action${linked > 1 ? 's' : ''}` : null}
                          <span className="block">
                            <RecordDialog
                              mode="create"
                              triggerLabel="Action corrective"
                              ariaLabel={`Créer une action corrective pour « ${complaint.subject} »`}
                              title="Action corrective"
                              description={`Liée à la réclamation « ${complaint.subject} ».`}
                              fields={improvementActionFields(
                                { origin: 'reclamation', complaintId: complaint.id, title: '' },
                                { complaints: [{ id: complaint.id, label: complaint.subject }], watch: [] },
                              )}
                              action={saveImprovementAction.bind(null, null)}
                            />
                          </span>
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          <RecordDialog
                            mode="edit"
                            triggerLabel="Modifier"
                            ariaLabel={`Modifier la réclamation « ${complaint.subject} »`}
                            title="Réclamation"
                            description="Chaque modification est conservée dans le journal d’activité."
                            fields={complaintFields(today, complaint)}
                            action={saveComplaint.bind(null, complaint.id)}
                          />
                          <DeleteButton
                            action={deleteComplaint.bind(null, complaint.id)}
                            label={`Supprimer la réclamation « ${complaint.subject} »`}
                            confirm="Supprimer définitivement cette réclamation du registre ? Les actions liées sont conservées."
                          />
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
