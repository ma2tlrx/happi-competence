import { CalendarClock } from 'lucide-react';
import Link from 'next/link';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, ProvisionalBadge, Table, TableWrap, Td, Th, Tr, type BadgeVariant } from '@/components/ui/primitives';
import { OUTCOME_KINDS, PROVISIONAL_OUTCOMES_NOTICE, situationLabel } from '@/lib/outcomes/labels';
import type { FollowupItem } from '@/lib/outcomes/load';
import { FOLLOWUP_STATE_LABELS, type FollowupState } from '@/lib/outcomes/schedule';
import { formatDate } from '@/lib/utils';

import { OutcomeDialog } from './outcome-dialog';

const STATE_VARIANTS: Record<FollowupState, BadgeVariant> = { late: 'danger', due: 'warning', upcoming: 'outline', done: 'success' };
const SECTIONS: { state: FollowupState; title: string; description: string }[] = [
  { state: 'late', title: 'En retard', description: 'Échéance dépassée de plus de 30 jours.' },
  { state: 'due', title: 'À faire', description: 'Échéance atteinte : la situation peut être saisie dès maintenant.' },
  { state: 'upcoming', title: 'À venir', description: 'Suivis prévus dans les prochains mois.' },
  { state: 'done', title: 'Renseignés', description: 'Situations déjà saisies, modifiables (chaque modification est tracée).' },
];

/**
 * Échéancier des suivis : sortie à saisir pour les groupes terminés et les abandons, puis suivis à 3 et 6 mois.
 * Partagé par les espaces formateur, organisme et administrateur.
 */
export function FollowupsView({ items, canEdit, participantHref }: { items: FollowupItem[]; canEdit: boolean; participantHref: (id: string) => string }) {
  return (
    <div className="space-y-6">
      <Notice variant="info" title="Catégories provisoires">
        {PROVISIONAL_OUTCOMES_NOTICE}
      </Notice>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Aucun suivi prévu"
            description="Les suivis apparaissent quand un groupe se termine ou qu’un abandon est déclaré : situation de sortie, puis suivis à 3 et 6 mois."
          />
        </Card>
      ) : (
        SECTIONS.map((section) => {
          const rows = items.filter((item) => item.state === section.state);
          if (rows.length === 0) return null;
          const table = (
            <TableWrap label={`Suivis : ${section.title}`}>
              <Table>
                <thead>
                  <tr>
                    <Th>Participant</Th>
                    <Th>Suivi</Th>
                    <Th>Échéance</Th>
                    <Th>Situation</Th>
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <Tr key={`${item.participantId}:${item.groupId}:${item.kind}`}>
                      <Td>
                        <Link href={participantHref(item.participantId)} className="font-semibold text-ink hover:text-petrol-700 hover:underline">
                          {item.participantName}
                        </Link>
                        <span className="block text-sm text-ink-subtle">
                          {item.groupName}
                          {item.organizationName ? ` · ${item.organizationName}` : ''}
                          {item.dropped ? ' · abandon' : ''}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">{OUTCOME_KINDS[item.kind]}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="block text-sm">{formatDate(item.dueDate, 'Date de fin inconnue')}</span>
                        <Badge variant={STATE_VARIANTS[item.state]}>{FOLLOWUP_STATE_LABELS[item.state]}</Badge>
                      </Td>
                      <Td className="text-sm">{item.outcome ? situationLabel(item.outcome.situation) : <span className="text-ink-subtle">Non renseigné</span>}</Td>
                      <Td className="text-right">
                        {canEdit ? (
                          <OutcomeDialog
                            participantId={item.participantId}
                            participantName={item.participantName}
                            groupId={item.groupId}
                            groupName={item.groupName}
                            kind={item.kind}
                            existing={item.outcome ? { situation: item.outcome.situation, observedOn: item.outcome.observedOn, details: item.outcome.details } : null}
                          />
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          );
          return (
            <Card key={section.state}>
              <CardHeader title={`${section.title} (${rows.length})`} description={section.description} />
              <CardBody className="px-0 pb-2 sm:px-0">
                {section.state === 'done' || section.state === 'upcoming' ? (
                  <details className="px-0">
                    <summary className="cursor-pointer px-5 pb-3 text-sm font-semibold text-petrol-700 sm:px-6">Afficher la liste</summary>
                    {table}
                  </details>
                ) : (
                  table
                )}
              </CardBody>
            </Card>
          );
        })
      )}
      <p className="flex items-center gap-2 text-sm text-ink-subtle">
        <ProvisionalBadge>Règles provisoires</ProvisionalBadge>
        Échéances : sortie à la fin du groupe ou à l’abandon, puis 3 et 6 mois après ; « en retard » au-delà de 30 jours.
      </p>
    </div>
  );
}
