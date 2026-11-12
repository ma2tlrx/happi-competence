import { CalendarCheck, Download, DoorOpen, TrendingUp, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, EmptyState, Notice, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { formatRatio, type ImpactIndicators, type Ratio } from '@/lib/outcomes/impact';
import { DROP_REASON_CODES, DROP_REASONS, NOT_RECORDED, OUTCOME_KIND_CODES, OUTCOME_KINDS, OUTCOME_SITUATION_CODES, OUTCOME_SITUATIONS, PROVISIONAL_OUTCOMES_NOTICE } from '@/lib/outcomes/labels';
import type { ImpactAccess } from '@/lib/outcomes/report';
import { formatDate } from '@/lib/utils';

import { CohortChart, SituationChart } from './impact-charts';

const UNAVAILABLE = 'Non disponible';

function percentText(value: Pick<Ratio, 'rate' | 'n'>, unavailable = false) {
  return unavailable ? UNAVAILABLE : formatRatio(value);
}

function share(count: number, n: number) {
  return n > 0 ? `${count} (${Math.round((count / n) * 100)} %)` : String(count);
}

function FilterForm({ access, action, showOrganization }: { access: ImpactAccess; action: string; showOrganization: boolean }) {
  const { filters } = access;
  const control = 'h-10 w-full rounded-md border border-line-strong bg-white px-3 text-[0.9375rem] text-ink focus-visible:outline-2 focus-visible:outline-orange-500';
  return (
    <form method="get" action={action} className="mb-6 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Du
        <input type="date" name="du" defaultValue={filters.from ?? ''} className={control} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Au
        <input type="date" name="au" defaultValue={filters.to ?? ''} className={control} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Programme
        <select name="programme" defaultValue={filters.programId ?? ''} className={control}>
          <option value="">Tous les programmes</option>
          {access.programs.map((program) => (
            <option key={program.id} value={program.id}>{program.name}</option>
          ))}
        </select>
      </label>
      {showOrganization ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Organisme
          <select name="organisme" defaultValue={filters.organizationId ?? ''} className={control}>
            <option value="">Tous les organismes</option>
            {access.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit">Appliquer</Button>
        <Button asChild variant="ghost">
          <a href={action}>Réinitialiser</a>
        </Button>
      </div>
    </form>
  );
}

function OutcomesTable({ indicators, caption }: { indicators: ImpactIndicators; caption: string }) {
  const kinds = OUTCOME_KIND_CODES;
  return (
    <TableWrap label={caption}>
      <Table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <Th>Situation</Th>
            {kinds.map((kind) => (
              <Th key={kind} className="text-right">
                {OUTCOME_KINDS[kind]}
                <span className="block font-normal">renseignées n = {indicators.outcomes[kind].recorded}</span>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OUTCOME_SITUATION_CODES.map((code) => (
            <Tr key={code}>
              <Th scope="row" className="border-b-0 bg-transparent font-normal text-ink">{OUTCOME_SITUATIONS[code].label}</Th>
              {kinds.map((kind) => (
                <Td key={kind} className="text-right tabular-nums">{share(indicators.outcomes[kind].bySituation[code], indicators.outcomes[kind].recorded)}</Td>
              ))}
            </Tr>
          ))}
          <Tr>
            <Th scope="row" className="border-b-0 bg-transparent font-semibold text-ink">{NOT_RECORDED}</Th>
            {kinds.map((kind) => (
              <Td key={kind} className="text-right font-semibold tabular-nums">{indicators.outcomes[kind].missing}</Td>
            ))}
          </Tr>
          <Tr>
            <Th scope="row" className="border-b-0 bg-transparent font-semibold text-ink">Taux de suivi (renseignées / attendues)</Th>
            {kinds.map((kind) => (
              <Td key={kind} className="text-right font-semibold tabular-nums">
                {formatRatio({ rate: indicators.outcomes[kind].rate, n: indicators.outcomes[kind].expected })}
              </Td>
            ))}
          </Tr>
        </tbody>
      </Table>
    </TableWrap>
  );
}

/** Tableau de bord d'impact, partagé par l'administration et l'espace organisme. */
export function ImpactView({ access, action, exportHref, showOrganization }: { access: ImpactAccess; action: string; exportHref: string; showOrganization: boolean }) {
  const { report, unavailable } = access;
  const total = report.total;
  const query = new URLSearchParams(
    Object.entries({ du: access.filters.from, au: access.filters.to, programme: access.filters.programId, organisme: showOrganization ? access.filters.organizationId : null }).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  ).toString();
  const csv = (type: string) => `${exportHref}?${new URLSearchParams([...new URLSearchParams(query), ['type', type]]).toString()}`;

  return (
    <>
      <FilterForm access={access} action={action} showOrganization={showOrganization} />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={csv('indicateurs')} download>
            <Download aria-hidden />
            Indicateurs (CSV)
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={csv('participants')} download>
            <Download aria-hidden />
            Détail par participant (CSV)
          </a>
        </Button>
      </div>

      {total.enrolled === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Aucun parcours sur cette sélection" description="Modifiez la période ou les filtres." />
        </Card>
      ) : (
        <div className="space-y-6">
          {unavailable.attendance || unavailable.progression ? (
            <Notice variant="info" title="Certaines données ne sont pas ouvertes à votre compte">
              {[unavailable.attendance ? 'présences' : null, unavailable.progression ? 'évaluations' : null].filter(Boolean).join(' et ')} : les indicateurs correspondants sont affichés « non disponible ».
            </Notice>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label="Parcours inscrits" value={total.enrolled} detail={`${total.active} actifs · ${total.sessionsCompleted} séances réalisées`} icon={Users} />
            <StatTile label="Abandons" value={total.dropped} detail={percentText(total.dropRate)} icon={DoorOpen} />
            <StatTile
              label="Assiduité"
              value={unavailable.attendance || total.attendance.rate === null ? '—' : `${Math.round(total.attendance.rate)} %`}
              detail={unavailable.attendance ? UNAVAILABLE : `n = ${total.attendance.n} présences renseignées`}
              icon={CalendarCheck}
            />
            <StatTile
              label="Progression observée"
              value={unavailable.progression ? '—' : `${total.progression.count} / ${total.progression.n}`}
              detail={unavailable.progression ? UNAVAILABLE : `${percentText(total.progression)} · ${total.progression.insufficient} non évaluable(s)`}
              icon={TrendingUp}
            />
          </div>

          <Card>
            <CardHeader title="Situations à l’entrée, à la sortie, à 3 et 6 mois" description={PROVISIONAL_OUTCOMES_NOTICE} />
            <CardBody className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {(['exit', 'followup_3m', 'followup_6m'] as const).map((kind) => (
                  <SituationChart
                    key={kind}
                    title={`${OUTCOME_KINDS[kind]} (attendues n = ${total.outcomes[kind].expected})`}
                    data={[
                      ...OUTCOME_SITUATION_CODES.map((code) => ({ label: OUTCOME_SITUATIONS[code].label, count: total.outcomes[kind].bySituation[code] })),
                      { label: NOT_RECORDED, count: total.outcomes[kind].missing, missing: true },
                    ]}
                  />
                ))}
              </div>
              <OutcomesTable indicators={total} caption="Répartition des situations par moment du parcours" />
              <p className="text-sm text-ink-subtle">
                Une situation est attendue à son échéance (fin du groupe ou abandon, puis 3 et 6 mois après). « Non renseigné » n’est jamais compté comme une
                situation ni comme zéro.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Motifs d’abandon" description={`${total.dropped} abandon(s) sur ${total.enrolled} parcours. Liste provisoire, à valider.`} />
            <CardBody className="px-0 pb-2 sm:px-0">
              <TableWrap label="Motifs d’abandon">
                <Table>
                  <thead>
                    <tr>
                      <Th>Motif</Th>
                      <Th className="text-right">Abandons</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {DROP_REASON_CODES.map((code) => (
                      <Tr key={code}>
                        <Td>{DROP_REASONS[code]}</Td>
                        <Td className="text-right tabular-nums">{share(total.dropReasons[code], total.dropped)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Par cohorte" description="Assiduité sur les séances terminées (présences renseignées) et taux d’abandon." />
            <CardBody className="space-y-4 px-0 sm:px-0">
              {!unavailable.attendance ? (
                <div className="px-5 sm:px-6">
                  <CohortChart data={report.cohorts.map((row) => ({ name: row.group.name, attendance: row.indicators.attendance.rate, dropRate: row.indicators.dropRate.rate }))} />
                </div>
              ) : null}
              <TableWrap label="Indicateurs par cohorte">
                <Table>
                  <thead>
                    <tr>
                      <Th>Cohorte</Th>
                      <Th className="text-right">Inscrits</Th>
                      <Th className="text-right">Abandons</Th>
                      <Th className="text-right">Séances</Th>
                      <Th className="text-right">Assiduité</Th>
                      <Th className="text-right">Progression</Th>
                      <Th className="text-right">Sortie</Th>
                      <Th className="text-right">3 mois</Th>
                      <Th className="text-right">6 mois</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.cohorts.map(({ group, indicators }) => (
                      <Tr key={group.id}>
                        <Td>
                          <span className="font-semibold">{group.name}</span>
                          <span className="block text-sm text-ink-subtle">
                            {group.programName} · {formatDate(group.startDate)} – {formatDate(group.endDate, '…')}
                          </span>
                        </Td>
                        <Td className="text-right tabular-nums">{indicators.enrolled}</Td>
                        <Td className="text-right tabular-nums">{indicators.dropped}</Td>
                        <Td className="text-right tabular-nums">{indicators.sessionsCompleted}</Td>
                        <Td className="text-right whitespace-nowrap tabular-nums">{percentText(indicators.attendance, unavailable.attendance)}</Td>
                        <Td className="text-right whitespace-nowrap tabular-nums">
                          {unavailable.progression ? UNAVAILABLE : `${indicators.progression.count} / ${indicators.progression.n}`}
                        </Td>
                        {(['exit', 'followup_3m', 'followup_6m'] as const).map((kind) => (
                          <Td key={kind} className="text-right whitespace-nowrap tabular-nums">
                            {indicators.outcomes[kind].expected === 0 ? 'Pas encore' : formatRatio({ rate: indicators.outcomes[kind].rate, n: indicators.outcomes[kind].expected })}
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              <p className="px-5 text-sm text-ink-subtle sm:px-6">Sortie, 3 et 6 mois : part des situations renseignées parmi celles attendues (n = attendues).</p>
            </CardBody>
          </Card>

          {showOrganization ? (
            <Card>
              <CardHeader title="Par organisme" description="Rattachement du participant (organisme prescripteur)." />
              <CardBody className="px-0 pb-2 sm:px-0">
                <TableWrap label="Indicateurs par organisme">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Organisme</Th>
                        <Th className="text-right">Inscrits</Th>
                        <Th className="text-right">Abandons</Th>
                        <Th className="text-right">Assiduité</Th>
                        <Th className="text-right">Progression</Th>
                        <Th className="text-right">Sortie</Th>
                        <Th className="text-right">3 mois</Th>
                        <Th className="text-right">6 mois</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.organizations.map(({ organizationId, organizationName, indicators }) => (
                        <Tr key={organizationId ?? 'aucun'}>
                          <Td className="font-semibold">{organizationName}</Td>
                          <Td className="text-right tabular-nums">{indicators.enrolled}</Td>
                          <Td className="text-right whitespace-nowrap tabular-nums">{percentText(indicators.dropRate)}</Td>
                          <Td className="text-right whitespace-nowrap tabular-nums">{percentText(indicators.attendance)}</Td>
                          <Td className="text-right whitespace-nowrap tabular-nums">{`${indicators.progression.count} / ${indicators.progression.n}`}</Td>
                          {(['exit', 'followup_3m', 'followup_6m'] as const).map((kind) => (
                            <Td key={kind} className="text-right whitespace-nowrap tabular-nums">
                              {indicators.outcomes[kind].expected === 0 ? 'Pas encore' : formatRatio({ rate: indicators.outcomes[kind].rate, n: indicators.outcomes[kind].expected })}
                            </Td>
                          ))}
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </CardBody>
            </Card>
          ) : null}

          <p className="text-sm text-ink-subtle">
            Unité de compte : un parcours (inscription d’un participant à un groupe). Les retraits pour erreur d’inscription sont exclus, les abandons sont comptés.
            Progression observée : au moins une compétence évaluée sur deux séances ou plus, avec un niveau final supérieur au niveau initial ; les parcours sans
            compétence observée deux fois sont « non évaluables » et sortent du dénominateur.
          </p>
        </div>
      )}
    </>
  );
}
