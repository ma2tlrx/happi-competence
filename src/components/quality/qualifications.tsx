import { Bot, ExternalLink } from 'lucide-react';

import { Badge, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { deleteQualification, saveQualification } from '@/lib/quality/actions';
import { qualificationFields } from '@/lib/quality/forms';
import type { TrainerTrainingStatus } from '@/lib/quality/indicators';
import { QUALIFICATION_KINDS, type QualificationKind } from '@/lib/quality/labels';
import type { Qualification } from '@/lib/quality/load';
import { evidenceHref } from '@/lib/quality/schemas';
import { formatDate } from '@/lib/utils';

import { DeleteButton, RecordDialog } from './record-dialog';

/** État de formation continue d'un intervenant (seuil paramétrable). */
export function TrainingBadge({ training, maxAgeMonths }: { training: TrainerTrainingStatus; maxAgeMonths: number }) {
  if (training.state === 'up_to_date') return <Badge variant="success">Formation à jour</Badge>;
  if (training.state === 'outdated') return <Badge variant="warning">{`Dernière formation il y a plus de ${maxAgeMonths} mois`}</Badge>;
  return <Badge variant="danger">Aucune formation suivie datée</Badge>;
}

export function AddQualificationButton({ trainerId, trainerName }: { trainerId: string; trainerName?: string }) {
  return (
    <RecordDialog
      mode="create"
      triggerLabel="Ajouter"
      ariaLabel={trainerName ? `Ajouter une ligne au registre de ${trainerName}` : 'Ajouter une ligne à mon registre'}
      title={trainerName ? `Registre de ${trainerName}` : 'Mon registre'}
      description="Diplôme, qualification, expérience ou formation suivie. Chaque ajout est conservé dans le journal d’activité."
      fields={qualificationFields()}
      action={saveQualification.bind(null, trainerId, null)}
    />
  );
}

/** Lignes du registre d'un intervenant, modifiables par lui-même ou par l'administrateur. */
export function QualificationsTable({ trainerId, rows, canEdit }: { trainerId: string; rows: Qualification[]; canEdit: boolean }) {
  if (rows.length === 0) return <p className="px-5 py-4 text-sm text-ink-subtle sm:px-6">Aucune ligne dans le registre.</p>;
  return (
    <TableWrap label="Registre de l’intervenant">
      <Table>
        <thead>
          <tr>
            <Th>Type</Th>
            <Th>Intitulé</Th>
            <Th>Dates</Th>
            <Th>Justificatif</Th>
            {canEdit ? (
              <Th className="text-right">
                <span className="sr-only">Gestion</span>
              </Th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = evidenceHref(row.evidence);
            return (
              <Tr key={row.id}>
                <Td className="text-sm whitespace-nowrap">
                  {QUALIFICATION_KINDS[row.kind as QualificationKind] ?? row.kind}
                  {row.isAiTraining ? (
                    <Badge variant="petrol" icon={Bot} className="ml-2">
                      IA
                    </Badge>
                  ) : null}
                </Td>
                <Td className="max-w-[20rem]">
                  <span className="font-semibold">{row.title}</span>
                  {row.provider ? <span className="block text-sm text-ink-muted">{row.provider}</span> : null}
                  {row.description ? <span className="block line-clamp-2 text-sm text-ink-subtle">{row.description}</span> : null}
                </Td>
                <Td className="text-sm whitespace-nowrap">
                  {row.startedOn ? `${formatDate(row.startedOn)} → ` : ''}
                  {row.completedOn ? formatDate(row.completedOn) : row.startedOn ? 'en cours' : '—'}
                </Td>
                <Td className="max-w-[14rem] text-sm">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-petrol-700 underline">
                      Ouvrir
                      <ExternalLink className="size-3.5" aria-hidden />
                      <span className="sr-only">(nouvelle fenêtre)</span>
                    </a>
                  ) : (
                    (row.evidence ?? <span className="text-ink-subtle">—</span>)
                  )}
                </Td>
                {canEdit ? (
                  <Td className="text-right whitespace-nowrap">
                    <RecordDialog
                      mode="edit"
                      triggerLabel="Modifier"
                      ariaLabel={`Modifier « ${row.title} »`}
                      title="Ligne du registre"
                      fields={qualificationFields(row)}
                      action={saveQualification.bind(null, trainerId, row.id)}
                    />
                    <DeleteButton action={deleteQualification.bind(null, row.id)} label={`Supprimer « ${row.title} »`} confirm="Supprimer cette ligne du registre ?" />
                  </Td>
                ) : null}
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
