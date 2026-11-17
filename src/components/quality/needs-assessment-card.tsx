import { Badge, Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { saveNeedsAssessment } from '@/lib/quality/actions';
import { needsAssessmentFields } from '@/lib/quality/forms';
import { NO_HEALTH_DATA_NOTICE, PREREQUISITES_MET, QUALIOPI_DISCLAIMER, QUALIOPI_HINTS, type PrerequisitesMet } from '@/lib/quality/labels';
import type { NeedsAssessment } from '@/lib/quality/load';
import { todayIso } from '@/lib/trainer';
import { formatDate } from '@/lib/utils';

import { RecordDialog } from './record-dialog';

const RECORDED_BY: Record<string, string> = { admin: 'l’équipe HAPPI', formateur: 'un formateur', organisme: 'le prescripteur' };

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[14rem_1fr]">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className="text-[0.9375rem] whitespace-pre-line">{value ?? <span className="text-ink-subtle">Non renseigné</span>}</dd>
    </div>
  );
}

/** Analyse du besoin à l'entrée (fiche de positionnement), sur la fiche participant. */
export function NeedsAssessmentCard({
  participantId,
  participantName,
  assessment,
  canEdit,
}: {
  participantId: string;
  participantName: string;
  assessment: NeedsAssessment | null;
  canEdit: boolean;
}) {
  const today = todayIso();
  return (
    <Card className="mt-6">
      <CardHeader
        title="Analyse du besoin à l’entrée"
        description={`${QUALIOPI_HINTS.needs}. ${QUALIOPI_DISCLAIMER}`}
        action={
          canEdit ? (
            <RecordDialog
              mode={assessment ? 'edit' : 'create'}
              triggerLabel={assessment ? 'Modifier' : 'Renseigner'}
              ariaLabel={`${assessment ? 'Modifier' : 'Renseigner'} l’analyse du besoin de ${participantName}`}
              title={`Analyse du besoin · ${participantName}`}
              description="Remplie par le formateur ou le prescripteur. Chaque modification est conservée dans le journal d’activité."
              intro={<p className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning">{NO_HEALTH_DATA_NOTICE}</p>}
              fields={needsAssessmentFields(today, assessment ?? {})}
              action={saveNeedsAssessment.bind(null, participantId)}
            />
          ) : null
        }
      />
      <CardBody>
        {assessment ? (
          <dl className="space-y-3">
            <Row label="Date" value={`${formatDate(assessment.assessedOn)}${assessment.recordedRole ? ` · renseignée par ${RECORDED_BY[assessment.recordedRole] ?? assessment.recordedRole}` : ''}`} />
            <Row label="Attentes" value={assessment.expectations} />
            <Row label="Contraintes" value={assessment.constraintsNotes} />
            <Row
              label="Prérequis"
              value={
                [assessment.prerequisites, assessment.prerequisitesMet ? `Atteints : ${PREREQUISITES_MET[assessment.prerequisitesMet as PrerequisitesMet]}` : null]
                  .filter(Boolean)
                  .join('\n') || null
              }
            />
            <div className="grid gap-1 sm:grid-cols-[14rem_1fr]">
              <dt className="text-sm font-semibold text-ink-muted">Besoin d’adaptation</dt>
              <dd>
                {assessment.adaptationNeeded ? <Badge variant="orange">Oui</Badge> : <Badge>Non</Badge>}
                {assessment.adaptationPlanned ? <span className="mt-1 block text-[0.9375rem] whitespace-pre-line">{assessment.adaptationPlanned}</span> : null}
              </dd>
            </div>
            <Row label="Référent handicap" value={assessment.disabilityReferent} />
          </dl>
        ) : (
          <p className="text-sm text-ink-subtle">
            Aucune analyse du besoin pour l’instant.{canEdit ? ' Renseignez les attentes, contraintes, prérequis et besoins d’adaptation à l’entrée.' : ''}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
