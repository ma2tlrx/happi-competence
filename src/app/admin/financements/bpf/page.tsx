import { Download } from 'lucide-react';
import type { Metadata } from 'next';

import { Button, buttonClasses } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Notice, PageHeader, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { formatHours } from '@/lib/attendance/hours';
import { requireRole } from '@/lib/auth/session';
import { TO_COMPLETE } from '@/lib/funding/labels';
import { loadBpf } from '@/lib/funding/load';
import { parseYear } from '@/lib/funding/schemas';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';

export const metadata: Metadata = { title: 'Bilan pédagogique et financier' };

const ToComplete = () => <span className="font-semibold text-warning">{TO_COMPLETE}</span>;

export default async function BpfPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole('admin');
  const current = Number(todayIso().slice(0, 4));
  const raw = (await searchParams).annee;
  const year = parseYear(Array.isArray(raw) ? raw[0] : raw, current - 1);
  const report = await loadBpf(await createClient(), year);
  const years = Array.from({ length: 6 }, (_, index) => current - index);

  return (
    <>
      <PageHeader
        title="Bilan pédagogique et financier"
        description="Données que HAPPI peut réellement fournir pour le BPF (cerfa n° 10443) : stagiaires et heures-stagiaires réalisées, par origine du financement. Le reste est à compléter, jamais estimé."
        actions={
          <a href={`/api/exports/bpf?annee=${year}`} className={buttonClasses({ variant: 'secondary' })}>
            <Download aria-hidden />
            Télécharger (CSV)
          </a>
        }
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bpf-annee" className="text-sm font-semibold text-ink">
            Année civile
          </label>
          <select
            id="bpf-annee"
            name="annee"
            defaultValue={String(year)}
            className="h-10 rounded-md border border-line-strong bg-white px-3 text-[0.9375rem] text-ink focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Afficher</Button>
      </form>

      <Notice variant="warning" className="mb-6" title="À vérifier avant la déclaration">
        Le BPF porte sur l’exercice comptable : l’année civile n’y correspond que si votre exercice est calé sur elle. Les numéros de ligne changent selon la
        version du formulaire : vérifiez-les dans la notice de l’année (n° 50199) sur Mon Activité Formation. Méthode et limites : docs/financements.md.
      </Notice>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Stagiaires (personnes distinctes)" value={String(report.total.trainees)} detail="au moins une heure réalisée dans l’année" />
        <StatTile label="Heures-stagiaires réalisées" value={formatHours(report.total.minutes)} detail="règle du certificat de réalisation" />
        <StatTile
          label="Présences non saisies"
          value={String(report.warnings.missingAttendance)}
          detail={report.warnings.missingAttendance ? 'non comptées : à régulariser avant export' : 'aucune'}
        />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Cadre F-1 — Type de stagiaires" description="Le statut des stagiaires (salarié, demandeur d’emploi…) n’est pas saisi dans HAPPI." />
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Type de stagiaires">
              <Table>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th className="text-right">Stagiaires</Th>
                    <Th className="text-right">Heures-stagiaires</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.traineeTypes.map((type) => (
                    <Tr key={type.code}>
                      <Td>{type.label}</Td>
                      <Td className="text-right">
                        <ToComplete />
                      </Td>
                      <Td className="text-right">
                        <ToComplete />
                      </Td>
                    </Tr>
                  ))}
                  <Tr>
                    <Td className="font-semibold">Total connu</Td>
                    <Td className="text-right font-semibold">{report.total.trainees}</Td>
                    <Td className="text-right font-semibold">{formatHours(report.total.minutes)}</Td>
                  </Tr>
                </tbody>
              </Table>
            </TableWrap>
            {report.entrySituations.length ? (
              <div className="px-5 pt-4 sm:px-6">
                <p className="text-sm font-semibold">Aide à la ventilation : situation à l’entrée saisie</p>
                <p className="text-xs text-ink-subtle">Indicatif — une situation d’entrée ne vaut pas statut au sens du BPF.</p>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {report.entrySituations.map((row) => (
                    <li key={row.situation ?? 'none'} className="flex justify-between gap-4">
                      <span>{row.label}</span>
                      <span className="font-semibold">{row.trainees}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Origine du financement (aide au cadre C)"
            description="Le cadre C porte sur les montants (produits HT), inconnus de HAPPI : à compléter depuis la comptabilité."
          />
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Origine du financement">
              <Table>
                <thead>
                  <tr>
                    <Th>Origine</Th>
                    <Th>Ligne</Th>
                    <Th className="text-right">Stagiaires</Th>
                    <Th className="text-right">Heures-stagiaires</Th>
                    <Th className="text-right">Montant HT</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.origins.length ? (
                    report.origins.map((origin) => (
                      <Tr key={origin.origin}>
                        <Td className="max-w-[22rem]">
                          {origin.label}
                          {origin.verify.map((note) => (
                            <span key={note} className="block text-xs text-warning">
                              {note}
                            </span>
                          ))}
                        </Td>
                        <Td className="text-sm whitespace-nowrap">{origin.line}</Td>
                        <Td className="text-right">{origin.trainees}</Td>
                        <Td className="text-right whitespace-nowrap">{formatHours(origin.minutes)}</Td>
                        <Td className="text-right">
                          <ToComplete />
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={5} className="text-sm text-ink-muted">
                        Aucune heure réalisée sur cette année.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Détail par convention" />
          <CardBody className="px-0 pb-2 sm:px-0">
            <TableWrap label="Détail par convention">
              <Table>
                <thead>
                  <tr>
                    <Th>Convention</Th>
                    <Th>Financeur</Th>
                    <Th className="text-right">Stagiaires</Th>
                    <Th className="text-right">Heures-stagiaires</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.conventions.map((row) => (
                    <Tr key={row.conventionId ?? 'none'}>
                      <Td>{row.reference ? `${row.reference} — ${row.title}` : row.title}</Td>
                      <Td className="text-sm">{row.funderName ?? '—'}</Td>
                      <Td className="text-right">{row.trainees}</Td>
                      <Td className="text-right whitespace-nowrap">{formatHours(row.minutes)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Autres rubriques" />
          <CardBody>
            <ul className="space-y-1 text-sm">
              <li>
                Cadres F-3 (objectif général des prestations) et F-4 (spécialités de formation) : <ToComplete />
              </li>
              <li>
                Cadres A, B, D, E, G : identification, charges, intervenants, sous-traitance — <ToComplete />
              </li>
              <li>{`Séances terminées sans horaires (durée prise dans la trame) : ${report.warnings.sessionsWithoutTimes}`}</li>
              <li>{`Séances terminées sans date (exclues) : ${report.warnings.undatedCompletedSessions}`}</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
