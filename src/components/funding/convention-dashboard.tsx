import { CalendarCheck, Clock, DoorOpen, FileCheck2, Users } from 'lucide-react';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { formatHours } from '@/lib/attendance/hours';
import type { ConventionReport } from '@/lib/funding/indicators';
import { formatRatio, type Ratio } from '@/lib/outcomes/impact';
import {
  DROP_REASON_CODES,
  DROP_REASONS,
  dropReasonLabel,
  NOT_RECORDED,
  OUTCOME_KIND_CODES,
  OUTCOME_KINDS,
  OUTCOME_SITUATION_CODES,
  OUTCOME_SITUATIONS,
  PROVISIONAL_OUTCOMES_NOTICE,
  situationLabel,
} from '@/lib/outcomes/labels';
import { AUDIENCE_LABELS, MOMENT_LABELS } from '@/lib/satisfaction/window';
import { formatDate } from '@/lib/utils';

const UNAVAILABLE = 'Non disponible';
const rate = (value: Ratio) => (value.rate === null ? '—' : `${Math.round(value.rate)} %`);

function outcomeText(value: string | null | undefined) {
  if (value === undefined) return <span className="text-ink-subtle">Pas encore attendue</span>;
  return value === null ? <span className="text-ink-subtle">{NOT_RECORDED}</span> : situationLabel(value);
}

/**
 * Tableau de bord réalisé / conventionné d'une convention. Partagé par l'administrateur et
 * l'organisme (périmètre limité à ses participants : `scopeNotice`). Les données que le rôle
 * ne peut pas lire sont affichées « non disponible », jamais calculées à zéro.
 */
export function ConventionDashboard({
  report,
  plannedHours,
  unavailable = { attendance: false, progression: false },
  scopeNotice,
  showCertificates = false,
  showSatisfaction = true,
}: {
  report: ConventionReport;
  plannedHours: number;
  unavailable?: { attendance: boolean; progression: boolean };
  scopeNotice?: string;
  showCertificates?: boolean;
  showSatisfaction?: boolean;
}) {
  const { participants, hours, indicators } = report;
  return (
    <div className="space-y-6">
      {scopeNotice ? <Notice title="Périmètre partiel">{scopeNotice}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={scopeNotice ? 'Parcours entrés' : 'Parcours entrés / conventionnés'}
          value={scopeNotice ? String(participants.entered) : `${participants.entered} / ${participants.planned}`}
          detail={scopeNotice ? `${participants.distinct} personne(s) de votre structure` : `${rate(participants.entryRate)} · ${participants.distinct} personne(s)`}
          icon={Users}
        />
        <StatTile
          label="Heures-stagiaires réalisées"
          value={unavailable.attendance ? UNAVAILABLE : formatHours(hours.realisedMinutes)}
          detail={
            unavailable.attendance
              ? undefined
              : scopeNotice
                ? 'pour vos participants'
                : `sur ${formatHours(hours.conventionMinutes)} conventionnées (${rate(hours.realisationRate)})`
          }
          icon={Clock}
        />
        <StatTile
          label="Assiduité"
          value={unavailable.attendance ? UNAVAILABLE : rate(indicators.attendance)}
          detail={unavailable.attendance ? undefined : `n = ${indicators.attendance.n} présences renseignées`}
          icon={CalendarCheck}
        />
        <StatTile label="Abandons" value={String(indicators.dropped)} detail={formatRatio(indicators.dropRate)} icon={DoorOpen} />
      </div>

      {!unavailable.attendance && (hours.missingAttendance || hours.sessionsOutsidePeriod || hours.sessionsWithoutTimes) ? (
        <Notice variant="warning" title="Points à vérifier avant transmission">
          <ul className="list-disc space-y-0.5 pl-5">
            {hours.missingAttendance ? (
              <li>{`${hours.missingAttendance} présence(s) non saisie(s) sur des séances terminées : ni absence ni heure réalisée tant qu’elles ne sont pas renseignées.`}</li>
            ) : null}
            {hours.sessionsOutsidePeriod ? <li>{`${hours.sessionsOutsidePeriod} séance(s) terminée(s) hors de la période conventionnée ou sans date.`}</li> : null}
            {hours.sessionsWithoutTimes ? <li>{`${hours.sessionsWithoutTimes} séance(s) sans horaires : durée prise dans la trame du programme.`}</li> : null}
          </ul>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Réalisation" description={`Durée conventionnée : ${String(plannedHours).replace('.', ',')} h par participant.`} />
          <CardBody>
            {unavailable.attendance ? (
              <p className="text-sm text-ink-muted">Les présences ne sont pas accessibles à ce compte.</p>
            ) : (
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-muted">Heures-stagiaires conventionnées</dt>
                <dd className="text-right font-semibold">{formatHours(hours.conventionMinutes)}</dd>
                <dt className="text-ink-muted">Planifiées au calendrier</dt>
                <dd className="text-right font-semibold">{formatHours(hours.scheduledMinutes)}</dd>
                <dt className="text-ink-muted">Réalisées</dt>
                <dd className="text-right font-semibold">{formatHours(hours.realisedMinutes)}</dd>
                <dt className="text-ink-muted">Réalisé / planifié</dt>
                <dd className="text-right font-semibold">{rate(hours.scheduleRate)}</dd>
                <dt className="text-ink-muted">Moyenne par parcours</dt>
                <dd className="text-right font-semibold">{hours.averageRealisedMinutes === null ? '—' : formatHours(hours.averageRealisedMinutes)}</dd>
                <dt className="text-ink-muted">Progression observée</dt>
                <dd className="text-right font-semibold">
                  {unavailable.progression ? UNAVAILABLE : `${formatRatio(indicators.progression)} · ${indicators.progression.insufficient} non évaluable(s)`}
                </dd>
              </dl>
            )}
            <p className="mt-3 text-xs text-ink-subtle">
              Règle du certificat de réalisation : séance terminée, participant présent, en retard ou parti plus tôt (séance comptée en entier).
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Abandons par motif" />
          <CardBody>
            {indicators.dropped ? (
              <ul className="space-y-1.5 text-sm">
                {DROP_REASON_CODES.filter((code) => indicators.dropReasons[code] > 0).map((code) => (
                  <li key={code} className="flex justify-between gap-4">
                    <span>{DROP_REASONS[code]}</span>
                    <span className="font-semibold">{indicators.dropReasons[code]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Aucun abandon enregistré.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Sorties et suivis" description={PROVISIONAL_OUTCOMES_NOTICE} />
        <CardBody className="px-0 pb-2 sm:px-0">
          <TableWrap label="Situations à l’entrée, à la sortie et lors des suivis">
            <Table>
              <thead>
                <tr>
                  <Th>Moment</Th>
                  <Th className="text-right">Attendues</Th>
                  <Th className="text-right">Renseignées</Th>
                  <Th className="text-right">{NOT_RECORDED}</Th>
                  <Th>Répartition</Th>
                </tr>
              </thead>
              <tbody>
                {OUTCOME_KIND_CODES.map((kind) => {
                  const outcome = indicators.outcomes[kind];
                  const split = OUTCOME_SITUATION_CODES.filter((code) => outcome.bySituation[code] > 0);
                  return (
                    <Tr key={kind}>
                      <Td className="font-semibold">{OUTCOME_KINDS[kind]}</Td>
                      <Td className="text-right">{outcome.expected}</Td>
                      <Td className="text-right">{`${outcome.recorded} (${outcome.rate === null ? '—' : `${Math.round(outcome.rate)} %`})`}</Td>
                      <Td className="text-right">{outcome.missing}</Td>
                      <Td className="text-sm">
                        {split.length ? split.map((code) => `${OUTCOME_SITUATIONS[code].label} : ${outcome.bySituation[code]}`).join(' · ') : '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </CardBody>
      </Card>

      {showSatisfaction ? (
        <Card>
          <CardHeader title="Satisfaction" description="Taux de réponse = réponses / invités ; moyennes avec leur nombre de réponses." />
          <CardBody>
            {report.satisfaction.some((block) => block.invited > 0) ? (
              <ul className="space-y-3 text-sm">
                {report.satisfaction
                  .filter((block) => block.invited > 0)
                  .map((block) => (
                    <li key={`${block.audience}-${block.moment}`}>
                      <p className="font-semibold">
                        {`${AUDIENCE_LABELS[block.audience]} — ${MOMENT_LABELS[block.moment].label} : ${block.responses} / ${block.invited} (${rate(block.responseRate)})`}
                      </p>
                      {block.scores.length ? (
                        <ul className="mt-1 space-y-0.5 pl-4 text-ink-muted">
                          {block.scores.map((score) => (
                            <li key={score.text}>
                              {`${score.text} : ${
                                score.kind === 'nps'
                                  ? `indice de recommandation ${score.recommendationIndex ?? '—'}`
                                  : `${score.mean === null ? '—' : String(score.mean).replace('.', ',')} / 5`
                              } (n = ${score.n})`}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Aucune enquête ouverte pour les groupes de cette convention.</p>
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Pièces justificatives"
          description={`${report.evidence.sheets.length} feuille(s) d’émargement, dont ${report.evidence.countersignedSheets} contre-signée(s) · ${report.evidence.certificates} certificat(s) de réalisation disponible(s).`}
        />
        <CardBody className="px-0 pb-2 sm:px-0">
          {report.evidence.sheets.length ? (
            <TableWrap label="Feuilles d’émargement par séance">
              <Table>
                <thead>
                  <tr>
                    <Th>Groupe</Th>
                    <Th>Séance</Th>
                    <Th>Date</Th>
                    <Th>Contre-signature</Th>
                    <Th className="text-right">Feuille</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.evidence.sheets.map((sheet) => (
                    <Tr key={sheet.sessionId}>
                      <Td>{sheet.groupName}</Td>
                      <Td>{sheet.number}</Td>
                      <Td className="whitespace-nowrap">{formatDate(sheet.date, '—')}</Td>
                      <Td>{sheet.countersigned ? <Badge variant="success">Contre-signée</Badge> : <Badge variant="warning">À contre-signer</Badge>}</Td>
                      <Td className="text-right">
                        <a
                          href={`/api/exports/emargement/${sheet.sessionId}`}
                          className="inline-flex min-h-8 items-center font-semibold text-petrol-700 underline"
                          aria-label={`Feuille d’émargement, ${sheet.groupName}, séance ${sheet.number}`}
                        >
                          PDF
                        </a>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState icon={FileCheck2} title="Aucune séance terminée" description="Les feuilles d’émargement apparaîtront ici au fil des séances." />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Réalisation par participant" />
        <CardBody className="px-0 pb-2 sm:px-0">
          {report.rows.length ? (
            <TableWrap label="Réalisation par participant">
              <Table>
                <thead>
                  <tr>
                    <Th>Participant</Th>
                    <Th>Groupe</Th>
                    <Th>Statut</Th>
                    <Th className="text-right">Heures réalisées</Th>
                    <Th className="text-right">Assiduité</Th>
                    <Th>Sortie</Th>
                    {showCertificates ? (
                      <Th className="text-right">
                        <span className="sr-only">Certificat</span>
                      </Th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <Tr key={`${row.participantId}:${row.groupId}`}>
                      <Td className="font-semibold whitespace-nowrap">{`${row.lastName.toUpperCase()} ${row.firstName}`}</Td>
                      <Td>{row.groupName}</Td>
                      <Td className="text-sm">{row.status === 'dropped' ? `Abandon (${dropReasonLabel(row.dropReason)})` : 'Inscrit'}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {unavailable.attendance ? UNAVAILABLE : `${formatHours(row.realisedMinutes)} / ${formatHours(row.plannedMinutes)}`}
                      </Td>
                      <Td className="text-right whitespace-nowrap">{unavailable.attendance ? UNAVAILABLE : formatRatio(row.attendance)}</Td>
                      <Td className="text-sm">{outcomeText(row.outcomes.exit)}</Td>
                      {showCertificates ? (
                        <Td className="text-right">
                          {row.attendedSessions > 0 ? (
                            <a
                              href={`/api/exports/certificat/${row.participantId}?groupe=${row.groupId}`}
                              className="inline-flex min-h-8 items-center font-semibold text-petrol-700 underline"
                              aria-label={`Certificat de réalisation de ${row.firstName} ${row.lastName}`}
                            >
                              Certificat
                            </a>
                          ) : null}
                        </Td>
                      ) : null}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState icon={Users} title="Aucun parcours" description="Rattachez un groupe à la convention pour suivre sa réalisation." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
