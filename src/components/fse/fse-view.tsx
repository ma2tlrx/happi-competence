import { ClipboardList, Download, Users } from 'lucide-react';
import Link from 'next/link';

import { FilterForm } from '@/components/outcomes/impact-view';
import { Button, buttonClasses } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, ProvisionalBadge, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { COMPLETENESS_LABELS } from '@/lib/fse/codes';
import { FAMILY_LABELS, GENDER_COLUMNS, type FseIndicators, type IndicatorFamily } from '@/lib/fse/indicators';
import type { FseAccess } from '@/lib/fse/load';
import { EXIT_WINDOW_DAYS } from '@/lib/fse/outcomes';

const FAMILIES = Object.keys(FAMILY_LABELS) as IndicatorFamily[];
const JOURNEY_LIMIT = 200;
const VARIANT = { missing: 'outline', partial: 'warning', complete: 'success' } as const;

/** Effectif nul affiché « 0 » ; les colonnes « non renseigné » etc. restent distinctes (jamais fusionnées avec 0). */
function IndicatorsTable({ indicators, caption }: { indicators: FseIndicators; caption: string }) {
  return (
    <div className="space-y-6">
      {FAMILIES.map((family) => {
        const rows = indicators.rows.filter((row) => row.family === family);
        const showWindow = family === 'resultat';
        return (
          <TableWrap key={family} label={`${caption} — ${FAMILY_LABELS[family]}`}>
            <Table>
              <caption className="px-4 pt-3 pb-2 text-left text-sm font-semibold text-ink">{FAMILY_LABELS[family]}</caption>
              <thead>
                <tr>
                  <Th>Indicateur</Th>
                  <Th className="text-right">Effectif</Th>
                  {GENDER_COLUMNS.map((column) => (
                    <Th key={column.key} className="text-right">
                      {column.label}
                    </Th>
                  ))}
                  <Th className="text-right">Non renseigné</Th>
                  <Th className="text-right">Ne souhaite pas répondre</Th>
                  <Th className="text-right">Ne sait pas / sans nouvelles</Th>
                  {showWindow ? <Th className="text-right">Hors délai</Th> : null}
                  <Th className="text-right">Base (n)</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.code ?? row.label}>
                    <Td className="min-w-64 text-sm">
                      {row.code ? <span className="mr-2 font-mono text-xs text-ink-subtle">{row.code}</span> : null}
                      {row.label}
                      {row.note ? <span className="mt-0.5 block text-xs text-ink-subtle">{row.note}</span> : null}
                    </Td>
                    {row.computed ? (
                      <>
                        <Td className="text-right font-semibold tabular-nums">{row.count}</Td>
                        {GENDER_COLUMNS.map((column) => (
                          <Td key={column.key} className="text-right tabular-nums">
                            {row.byGender[column.key]}
                          </Td>
                        ))}
                        <Td className="text-right tabular-nums">{row.notRecorded}</Td>
                        <Td className="text-right tabular-nums">{row.declined}</Td>
                        <Td className="text-right tabular-nums">{row.unknown}</Td>
                        {showWindow ? <Td className="text-right tabular-nums">{row.outOfWindow}</Td> : null}
                        <Td className="text-right tabular-nums">{row.base}</Td>
                      </>
                    ) : (
                      <Td colSpan={GENDER_COLUMNS.length + (showWindow ? 6 : 5)} className="text-sm text-ink-subtle">
                        Non calculé
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        );
      })}
    </div>
  );
}

/** Indicateurs FSE+ et dispositifs publics (onglet « FSE+ » d'Admin › Impact). */
export function FseView({ access, action, exportHref, detailHref }: { access: FseAccess; action: string; exportHref: string; detailHref: (participantId: string) => string }) {
  const { report } = access;
  const { summary } = report.total;
  const query = new URLSearchParams(
    Object.entries({ du: access.filters.from, au: access.filters.to, programme: access.filters.programId, organisme: access.filters.organizationId }).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );
  const csv = (type: string) => `${exportHref}?${new URLSearchParams([...query, ['type', type]]).toString()}`;
  const journeys = [...report.journeys].sort(
    (a, b) => ['missing', 'partial', 'complete'].indexOf(a.completeness) - ['missing', 'partial', 'complete'].indexOf(b.completeness) || a.participant.lastName.localeCompare(b.participant.lastName, 'fr'),
  );

  return (
    <>
      <FilterForm access={access} action={action} showOrganization />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={csv('indicateurs')} download>
            <Download aria-hidden />
            Tableau agrégé (CSV)
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={csv('participants')} download>
            <Download aria-hidden />
            Fichier participants (CSV)
          </a>
        </Button>
      </div>

      {summary.journeys === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Aucun parcours sur cette sélection" description="Modifiez la période ou les filtres." />
        </Card>
      ) : (
        <div className="space-y-6">
          <Notice variant="info" title="Lecture des indicateurs">
            <span className="flex flex-wrap items-center gap-2">
              <ProvisionalBadge>Provisoire — à valider</ProvisionalBadge>
              Un parcours = une inscription à un groupe. Les données absentes, refusées ou inconnues sont comptées à part, jamais à zéro. Une situation de sortie
              n’entre dans un indicateur de résultat que si elle a été observée dans les {EXIT_WINDOW_DAYS} jours suivant la sortie. Sources et règles : docs/fse-plus.md.
            </span>
          </Notice>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label="Parcours" value={summary.journeys} icon={Users} />
            <StatTile label={COMPLETENESS_LABELS.complete} value={summary.complete} icon={ClipboardList} />
            <StatTile label={COMPLETENESS_LABELS.partial} value={summary.partial} icon={ClipboardList} />
            <StatTile label={COMPLETENESS_LABELS.missing} value={summary.missing} icon={ClipboardList} />
          </div>

          <Card>
            <CardHeader title="Ensemble de la sélection" description="Effectifs par indicateur, ventilés par genre." />
            <CardBody className="px-0 sm:px-0">
              <IndicatorsTable indicators={report.total} caption="Ensemble" />
            </CardBody>
          </Card>

          {[
            { title: 'Par organisme', items: report.organizations.map((item) => ({ key: item.organizationId ?? 'sans', name: item.organizationName, indicators: item.indicators })) },
            { title: 'Par cohorte', items: report.cohorts.map((item) => ({ key: item.group.id, name: `${item.group.name} (${item.group.programName})`, indicators: item.indicators })) },
          ].map((section) => (
            <Card key={section.title}>
              <CardHeader title={section.title} />
              <CardBody className="space-y-3">
                {section.items.map((item) => (
                  <details key={item.key} className="rounded-md border border-line">
                    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-[0.9375rem] font-medium focus-visible:outline-2 focus-visible:outline-orange-500">
                      <span>{item.name}</span>
                      <span className="text-sm text-ink-subtle">{item.indicators.summary.journeys} parcours</span>
                    </summary>
                    <div className="border-t border-line py-2">
                      <IndicatorsTable indicators={item.indicators} caption={item.name} />
                    </div>
                  </details>
                ))}
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardHeader
              title="Fiches d’entrée"
              description={`Fiches à compléter en premier. ${journeys.length > JOURNEY_LIMIT ? `${JOURNEY_LIMIT} premiers parcours sur ${journeys.length} : affinez les filtres ou utilisez l’export.` : ''}`}
            />
            <CardBody className="px-0 pb-2 sm:px-0">
              <TableWrap label="Fiches d’entrée des participants">
                <Table>
                  <thead>
                    <tr>
                      <Th>Participant</Th>
                      <Th>Groupe</Th>
                      <Th>Organisme</Th>
                      <Th>État</Th>
                      <Th className="text-right">
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.slice(0, JOURNEY_LIMIT).map((journey) => (
                      <Tr key={`${journey.participant.id}:${journey.group.id}`}>
                        <Td className="text-sm">
                          {journey.participant.lastName.toUpperCase()} {journey.participant.firstName}
                        </Td>
                        <Td className="text-sm">{journey.group.name}</Td>
                        <Td className="text-sm">{journey.participant.organizationName ?? '—'}</Td>
                        <Td>
                          <Badge variant={VARIANT[journey.completeness]}>{COMPLETENESS_LABELS[journey.completeness]}</Badge>
                        </Td>
                        <Td className="text-right">
                          <Link
                            href={detailHref(journey.participant.id)}
                            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                            aria-label={`Ouvrir la fiche d’entrée de ${journey.participant.firstName} ${journey.participant.lastName}`}
                          >
                            Ouvrir
                          </Link>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
