import { FileDown, Globe } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PeriodFilter } from '@/components/quality/period-filter';
import { DisableResultsButton, PublishResultsForm } from '@/components/quality/public-results-controls';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Notice, PageHeader, ProvisionalBadge, StatTile } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { formatRate, parsePublicIndicators, publicIndicators, type PublicIndicator } from '@/lib/quality/indicators';
import { COMPLETION_RATE_DEFINITION, PUBLIC_MIN_N, QUALIOPI_DISCLAIMER, QUALIOPI_HINTS, QUALIOPI_NUMBERING_NOTE, SATISFACTION_RATE_DEFINITION } from '@/lib/quality/labels';
import { loadPublicResultsState, loadQualityDashboard, parsePeriod } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { formatDate, formatDateTime, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Qualité' };

const PUBLIC_LABELS: Record<string, string> = {
  participants: 'Participants (parcours)',
  completion: 'Taux de réalisation',
  attendance: 'Assiduité',
  satisfaction: 'Satisfaction',
};

function publicValue(key: string, indicator: PublicIndicator) {
  if (indicator.status !== 'published') return 'Pas encore assez de données';
  return key === 'participants' ? `${indicator.value}` : `${indicator.value} % (n = ${indicator.n})`;
}

function Hint({ hint }: { hint: keyof typeof QUALIOPI_HINTS }) {
  return <span className="mt-1 block text-xs text-ink-subtle">{QUALIOPI_HINTS[hint]}</span>;
}

export default async function QualityDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole('admin');
  const today = todayIso();
  const period = parsePeriod(await searchParams, today);
  const supabase = await createClient();
  const [dashboard, publicState] = await Promise.all([loadQualityDashboard(supabase, period, today), loadPublicResultsState(supabase)]);
  const { snapshot, complaints, actions, trainers, needs } = dashboard;
  const preview = publicIndicators(snapshot);
  const published = parsePublicIndicators(publicState.indicators);
  const exportQuery = new URLSearchParams({ du: period.from, au: period.to }).toString();

  return (
    <>
      <PageHeader
        title="Indicateurs qualité"
        description="Registres et indicateurs utiles à un audit Qualiopi, calculés à partir des données de la plateforme. Chaque taux est donné avec son effectif (n)."
        actions={
          <Button asChild variant="outline">
            <a href={`/api/exports/qualite?${exportQuery}`} download>
              <FileDown aria-hidden />
              Exporter le dossier de preuves (PDF)
            </a>
          </Button>
        }
      />
      <Notice className="mb-6" title={QUALIOPI_DISCLAIMER}>
        {QUALIOPI_NUMBERING_NOTE} Les rubriques indiquent des preuves possibles pour l’audit ; elles ne remplacent pas la lecture du référentiel et du guide de lecture
        de votre certificateur.
      </Notice>
      <PeriodFilter from={period.from} to={period.to} today={today} />
      <p className="mb-4 text-sm text-ink-muted">
        Période du {formatDate(period.from)} au {formatDate(period.to)} : groupes dont les dates chevauchent la période, réponses et réclamations reçues dans la période.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Satisfaction des participants (à chaud)"
          value={snapshot.satisfaction.rate === null ? '—' : `${Math.round(snapshot.satisfaction.rate)} %`}
          detail={
            <>
              {`${snapshot.satisfaction.count} notes 4–5 sur ${snapshot.satisfaction.n} · ${snapshot.satisfaction.respondents} ${pluralize(snapshot.satisfaction.respondents, 'répondant')}`}
              <Hint hint="improvement" />
            </>
          }
        />
        <StatTile
          label="Taux d’abandon"
          value={snapshot.impact.dropRate.rate === null ? '—' : `${Math.round(snapshot.impact.dropRate.rate)} %`}
          detail={
            <>
              {`${snapshot.impact.dropped} ${pluralize(snapshot.impact.dropped, 'abandon')} sur ${snapshot.impact.enrolled} parcours (n = ${snapshot.impact.dropRate.n})`}
              <Hint hint="dropouts" />
            </>
          }
        />
        <StatTile
          label="Assiduité"
          value={snapshot.impact.attendance.rate === null ? '—' : `${Math.round(snapshot.impact.attendance.rate)} %`}
          detail={
            <>
              {`Présences renseignées : n = ${snapshot.impact.attendance.n}`}
              <Hint hint="results" />
            </>
          }
        />
        <StatTile
          label="Réclamations reçues"
          value={complaints.total}
          detail={
            <>
              {complaints.answered
                ? `Délai moyen de réponse : ${String(complaints.meanDelayDays).replace('.', ',')} j (n = ${complaints.answered}) · ${complaints.open} en cours`
                : `Aucune réponse datée · ${complaints.open} en cours`}
              <Hint hint="improvement" />
            </>
          }
        />
        <StatTile
          label="Actions d’amélioration"
          value={`${actions.open} ouverte${actions.open > 1 ? 's' : ''} · ${actions.closed} close${actions.closed > 1 ? 's' : ''}`}
          detail={
            <>
              {`${actions.overdue} en retard · efficacité constatée : ${formatRate(actions.effectivenessRecorded)}`}
              <Hint hint="improvement" />
            </>
          }
        />
        <StatTile
          label="Intervenants formés récemment"
          value={trainers.total ? `${trainers.upToDate} / ${trainers.total}` : '—'}
          detail={
            <>
              {`Formation de moins de ${trainers.maxAgeMonths} mois · ${trainers.aiTrained} formé(s) à l’usage de l’IA`}
              <Hint hint="trainers" />
            </>
          }
        />
        <StatTile
          label="Analyse du besoin renseignée"
          value={needs.rate === null ? '—' : `${Math.round(needs.rate)} %`}
          detail={
            <>
              {`${needs.count} participant(s) sur ${needs.n} · ${needs.adaptation} avec adaptation prévue`}
              <Hint hint="needs" />
            </>
          }
        />
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <ProvisionalBadge>Modes de calcul à valider</ProvisionalBadge>
        {SATISFACTION_RATE_DEFINITION}
      </p>
      {trainers.outdated + trainers.none > 0 ? (
        <Notice variant="warning" className="mt-4" title="Formation des intervenants à mettre à jour">
          {`${trainers.outdated + trainers.none} formateur(s) actif(s) sans formation suivie depuis moins de ${trainers.maxAgeMonths} mois. `}
          <Link href="/admin/qualite/intervenants" className="font-semibold underline">
            Voir le registre des intervenants
          </Link>
        </Notice>
      ) : null}

      <Card className="mt-8" id="resultats-publics">
        <CardHeader
          title="Page publique « Nos résultats »"
          description={`${QUALIOPI_HINTS.results}. ${QUALIOPI_DISCLAIMER} Un indicateur n’est affiché que si son effectif atteint ${PUBLIC_MIN_N}.`}
          action={publicState.enabled ? <Badge variant="success" icon={Globe}>Publiée</Badge> : <Badge>Désactivée</Badge>}
        />
        <CardBody className="space-y-5">
          {publicState.enabled && published ? (
            <div>
              <p className="text-sm text-ink-muted">
                {`En ligne : période du ${formatDate(publicState.periodFrom)} au ${formatDate(publicState.periodTo)}, mise à jour le ${formatDateTime(publicState.computedAt)}.`}{' '}
                <Link href="/resultats" className="font-semibold text-petrol-700 underline">
                  Voir la page
                </Link>
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(published).map(([key, indicator]) => (
                  <li key={key} className="rounded-md border border-line px-3 py-2 text-sm">
                    <span className="font-semibold">{PUBLIC_LABELS[key]}</span> : {publicValue(key, indicator)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">La page n’est pas publiée : elle n’apparaît ni dans le pied de page ni dans les moteurs de recherche.</p>
          )}
          <div>
            <h3 className="text-sm font-semibold">Aperçu pour la période filtrée</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(preview).map(([key, indicator]) => (
                <li key={key} className="rounded-md border border-dashed border-line-strong px-3 py-2 text-sm">
                  <span className="font-semibold">{PUBLIC_LABELS[key]}</span> : {publicValue(key, indicator)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-subtle">{COMPLETION_RATE_DEFINITION}</p>
          </div>
          <PublishResultsForm from={period.from} to={period.to} today={today} enabled={publicState.enabled} />
          {publicState.enabled ? <DisableResultsButton /> : null}
        </CardBody>
      </Card>
    </>
  );
}
