import { Badge, Card, CardBody, CardHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { OUTCOME_KIND_CODES, OUTCOME_KINDS, PROVISIONAL_OUTCOMES_NOTICE, situationLabel } from '@/lib/outcomes/labels';
import type { OutcomeRecord } from '@/lib/outcomes/load';
import { formatDate } from '@/lib/utils';

import { OutcomeDialog } from './outcome-dialog';

/** Situations d'un participant (entrée, sortie, 3 et 6 mois) pour chacun de ses groupes. */
export function OutcomesCard({
  participantId,
  participantName,
  groups,
  records,
  canEdit,
}: {
  participantId: string;
  participantName: string;
  groups: { id: string; name: string; status: string }[];
  records: OutcomeRecord[];
  canEdit: boolean;
}) {
  const visible = groups.filter((group) => group.status !== 'removed');
  if (visible.length === 0) return null;
  const find = (groupId: string, kind: string) => records.find((record) => record.groupId === groupId && record.kind === kind) ?? null;
  return (
    <Card className="mt-6">
      <CardHeader title="Situation du participant" description={PROVISIONAL_OUTCOMES_NOTICE} />
      <CardBody className="px-0 pb-2 sm:px-0">
        <TableWrap label="Situations du participant">
          <Table>
            <thead>
              <tr>
                <Th>Groupe</Th>
                <Th>Moment</Th>
                <Th>Situation</Th>
                <Th>Observée le</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.flatMap((group) =>
                OUTCOME_KIND_CODES.map((kind) => {
                  const record = find(group.id, kind);
                  return (
                    <Tr key={`${group.id}:${kind}`}>
                      <Td className="text-sm">
                        {group.name}
                        {group.status === 'dropped' ? (
                          <Badge variant="warning" className="ml-2">
                            Abandon
                          </Badge>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap">{OUTCOME_KINDS[kind]}</Td>
                      <Td>
                        {record ? situationLabel(record.situation) : <span className="text-ink-subtle">Non renseigné</span>}
                        {record?.details ? <span className="block text-sm text-ink-subtle">{record.details}</span> : null}
                      </Td>
                      <Td className="text-sm whitespace-nowrap">{record ? formatDate(record.observedOn) : '—'}</Td>
                      <Td className="text-right">
                        {canEdit ? (
                          <OutcomeDialog
                            participantId={participantId}
                            participantName={participantName}
                            groupId={group.id}
                            groupName={group.name}
                            kind={kind}
                            existing={record ? { situation: record.situation, observedOn: record.observedOn, details: record.details } : null}
                          />
                        ) : null}
                      </Td>
                    </Tr>
                  );
                }),
              )}
            </tbody>
          </Table>
        </TableWrap>
      </CardBody>
    </Card>
  );
}
