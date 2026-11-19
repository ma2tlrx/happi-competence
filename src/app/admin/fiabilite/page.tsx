import { Download, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CloseExerciseButton, ExerciseForm, MinPairsForm, PublicationControls } from '@/components/reliability/admin-controls';
import { StatsTable } from '@/components/reliability/stats-table';
import { buttonClasses } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { LinkTabs } from '@/components/ui/navigation';
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadReliabilityDataset, loadReliabilitySettings } from '@/lib/reliability/load';
import { buildReliabilityReport } from '@/lib/reliability/report';
import { readSalt, SALT_ENV } from '@/lib/reliability/research-export';
import { MIN_PAIRS_BOUNDS } from '@/lib/reliability/statistics';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatDateTime, formatScore, isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Fiabilité de la mesure' };

type Search = { demo?: string; seance?: string; exercice?: string; attribuees?: string; ecartees?: string };

export default async function ReliabilityPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole('admin');
  const params = await searchParams;
  const includeDemo = params.demo === '1';
  const supabase = await createClient();
  const settings = await loadReliabilitySettings(supabase);
  const dataset = await loadReliabilityDataset(supabase, { includeDemo });
  const report = buildReliabilityReport(dataset, settings.minPairs);
  const saltReady = readSalt() !== null;

  const [{ data: exercises }, { data: exerciseRatings }, { data: sessions }] = await Promise.all([
    supabase.from('calibration_exercises').select('id, title, status, created_at, sessions ( number, scheduled_date, groups ( name, is_demo ) )').order('created_at', { ascending: false }).limit(50),
    supabase.from('calibration_ratings').select('exercise_id, status').not('exercise_id', 'is', null),
    supabase
      .from('sessions')
      .select('id, number, scheduled_date, status, groups ( name, is_demo ), program_sessions ( title )')
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: false, nullsFirst: false })
      .limit(150),
  ]);
  const counts = new Map<string, { submitted: number; draft: number }>();
  for (const row of exerciseRatings ?? []) {
    const current = counts.get(row.exercise_id!) ?? { submitted: 0, draft: 0 };
    if (row.status === 'submitted') current.submitted += 1;
    else if (row.status === 'draft') current.draft += 1;
    counts.set(row.exercise_id!, current);
  }

  // Création d'un exercice : participants du groupe de la séance choisie et formateurs actifs.
  const chosen = isUuid(params.seance) ? (sessions ?? []).find((session) => session.id === params.seance) : undefined;
  let exerciseForm: React.ReactNode = null;
  if (chosen) {
    const { data: detail } = await supabase.from('sessions').select('group_id, trainer_id').eq('id', chosen.id).single();
    const [{ data: members }, { data: trainers }, { data: groupTrainers }, { data: evaluations }] = await Promise.all([
      supabase.from('group_members').select('participant_id, participants ( first_name, last_name )').eq('group_id', detail!.group_id).eq('status', 'active'),
      supabase.from('profiles').select('id, first_name, last_name, is_demo').eq('role', 'formateur').eq('status', 'active').order('last_name'),
      supabase.from('group_trainers').select('trainer_id').eq('group_id', detail!.group_id),
      supabase.from('evaluations').select('participant_id, status').eq('session_id', chosen.id),
    ]);
    const inGroup = new Set((groupTrainers ?? []).map((row) => row.trainer_id));
    const status = new Map((evaluations ?? []).map((row) => [row.participant_id, row.status]));
    exerciseForm = (
      <ExerciseForm
        sessionId={chosen.id}
        participants={(members ?? []).map((row) => ({
          id: row.participant_id,
          label: `${row.participants?.first_name ?? ''} ${row.participants?.last_name ?? ''} — ${status.get(row.participant_id) === 'validated' ? 'évaluation validée' : status.has(row.participant_id) ? 'évaluation en brouillon' : 'pas encore évalué'}`,
        }))}
        trainers={(trainers ?? []).map((person) => ({
          id: person.id,
          label: `${person.first_name} ${person.last_name}`,
          hint: person.id === detail!.trainer_id ? 'Anime la séance (sera écarté)' : inGroup.has(person.id) ? 'Formateur du groupe' : person.is_demo ? 'Compte de démonstration' : undefined,
        }))}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Fiabilité de la mesure"
        description="Accord entre l’évaluation officielle et les secondes cotations à l’aveugle. Chaque valeur est donnée avec son effectif (n) et son intervalle de confiance ; « non observé » n’est jamais compté comme zéro. Méthode : docs/fiabilite.md."
      />
      <LinkTabs
        label="Données prises en compte"
        className="mb-6"
        tabs={[
          { href: '/admin/fiabilite', label: 'Données réelles', active: !includeDemo },
          { href: '/admin/fiabilite?demo=1', label: 'Réelles et démonstration', active: includeDemo },
        ]}
      />
      {params.exercice === 'cree' ? (
        <Notice variant="success" className="mb-6" title="Exercice créé">
          {params.attribuees ?? '0'} cotation(s) attribuée(s), {params.ecartees ?? '0'} écartée(s) (aveugle impossible à garantir ou formateur non éligible).
        </Notice>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Secondes cotations soumises" value={report.submittedRatings} />
        <StatTile label="Sans évaluation officielle validée" value={report.withoutOfficial} />
        <StatTile label="Écartées (même auteur)" value={report.sameRater} />
        <StatTile label="Officielle modifiée après la seconde" value={report.amendedAfter} />
      </div>

      {report.versions.length === 0 ? (
        <Card className="mb-6">
          <EmptyState icon={Scale} title="Pas encore de paire de cotations" description="Les statistiques apparaîtront dès qu’une seconde cotation soumise pourra être rapprochée d’une évaluation officielle validée." />
        </Card>
      ) : (
        report.versions.map((entry) => (
          <Card key={entry.version.id} className="mb-6">
            <CardHeader
              title={`${entry.version.frameworkName} · ${entry.version.label}`}
              description={`Échelle ${entry.version.scale.min}–${entry.version.scale.max} (pas ${formatScore(entry.version.scale.step)}). Les échelles de versions différentes ne sont jamais mélangées.`}
            />
            <CardBody className="space-y-6">
              <StatsTable label="Accord global" firstColumn="Ensemble" rows={[{ id: 'global', label: 'Toutes compétences', stats: entry.overall, observabilityMismatches: entry.observabilityMismatches }]} />
              <div>
                <h3 className="mb-2 font-semibold">Par compétence</h3>
                <StatsTable label="Accord par compétence" firstColumn="Compétence" rows={entry.bySkill} />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Par formateur</h3>
                <p className="mb-2 text-sm text-ink-muted">Toutes les paires où le formateur est l’un des deux observateurs (officiel ou second). Outil d’étalonnage, pas d’évaluation des personnes.</p>
                <StatsTable label="Accord par formateur" firstColumn="Formateur" rows={entry.byRater} />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Écarts les plus fréquents</h3>
                {entry.frequentGaps.length ? (
                  <TableWrap label="Écarts les plus fréquents">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Compétence</Th>
                          <Th>Niveau officiel</Th>
                          <Th>Niveau second</Th>
                          <Th>Occurrences</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.frequentGaps.map((gap) => (
                          <Tr key={`${gap.skillId}-${gap.official}-${gap.second}`}>
                            <Td className="font-medium">{gap.skillName}</Td>
                            <Td>{formatScore(gap.official)}</Td>
                            <Td>{formatScore(gap.second)}</Td>
                            <Td>{gap.count}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                ) : (
                  <p className="text-sm text-ink-muted">Aucun désaccord de niveau.</p>
                )}
              </div>
            </CardBody>
          </Card>
        ))
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Seuil et publication" description="La publication ne reprend que les données réelles, en agrégats par référentiel (ni compétence, ni formateur, ni personne)." />
          <CardBody className="space-y-5">
            <MinPairsForm minPairs={settings.minPairs} bounds={MIN_PAIRS_BOUNDS} />
            <div className="border-t border-line pt-4">
              <p className="mb-3 text-sm text-ink-muted">
                {settings.publish && settings.computedAt
                  ? `Publié sur la page « Notre méthode » (calcul du ${formatDateTime(settings.computedAt)}).`
                  : 'Rien n’est publié : la page « Notre méthode » n’affiche aucune statistique.'}{' '}
                <Link href="/methode" className="font-medium text-petrol-700 hover:underline">Voir la page</Link>
              </p>
              <PublicationControls published={settings.publish} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Export pour un partenaire de recherche" description="Une ligne par compétence cotée : pseudonymes (HMAC-SHA-256 avec un sel secret), référentiel, niveaux. Aucun nom, aucune date, aucun commentaire." />
          <CardBody className="space-y-3">
            {saltReady ? (
              <div className="flex flex-wrap gap-2">
                <a href="/api/exports/fiabilite" className={buttonClasses({ variant: 'secondary' })}>
                  <Download aria-hidden />
                  Exporter (données réelles)
                </a>
                <a href="/api/exports/fiabilite?demo=1" className={buttonClasses({ variant: 'outline' })}>
                  Avec la démonstration
                </a>
              </div>
            ) : (
              <Notice variant="warning" title="Export indisponible">
                Définissez la variable d’environnement serveur {SALT_ENV} (au moins 32 caractères aléatoires) pour activer l’export pseudonymisé.
              </Notice>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Exercices d’étalonnage" description="Une même séance cotée par plusieurs formateurs, puis comparée à l’évaluation officielle. Utilisable sur des données réelles ou de démonstration." />
        <CardBody className="space-y-6">
          {exercises?.length ? (
            <TableWrap label="Exercices d’étalonnage">
              <Table>
                <thead>
                  <tr>
                    <Th>Exercice</Th>
                    <Th>Séance</Th>
                    <Th>Cotations</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((exercise) => (
                    <Tr key={exercise.id}>
                      <Td className="font-medium">
                        {exercise.title}
                        <span className="block text-xs text-ink-subtle">Créé le {formatDate(exercise.created_at)}</span>
                      </Td>
                      <Td className="text-sm text-ink-muted">
                        Session {exercise.sessions?.number} · {exercise.sessions?.groups?.name}
                        {exercise.sessions?.groups?.is_demo ? <Badge className="ml-2">démo</Badge> : null}
                      </Td>
                      <Td className="text-sm">
                        {counts.get(exercise.id)?.submitted ?? 0} soumise(s) · {counts.get(exercise.id)?.draft ?? 0} en cours
                      </Td>
                      <Td>{exercise.status === 'open' ? <CloseExerciseButton exerciseId={exercise.id} /> : <Badge variant="outline">Clos</Badge>}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <p className="text-sm text-ink-muted">Aucun exercice pour l’instant.</p>
          )}
          <div className="border-t border-line pt-5">
            <h3 className="font-semibold">Nouvel exercice</h3>
            <form method="get" action="/admin/fiabilite" className="mt-3 flex flex-wrap items-end gap-2">
              {includeDemo ? <input type="hidden" name="demo" value="1" /> : null}
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-ink">
                Séance
                <Select name="seance" defaultValue={chosen?.id ?? ''} className="min-w-0">
                  <option value="">Choisir une séance…</option>
                  {(sessions ?? []).map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatDate(session.scheduled_date)} · {session.groups?.name} · Session {session.number} {session.program_sessions?.title ?? ''}
                      {session.groups?.is_demo ? ' (démo)' : ''}
                    </option>
                  ))}
                </Select>
              </label>
              <button type="submit" className={buttonClasses({ variant: 'outline' })}>Choisir</button>
            </form>
            {exerciseForm ? <div className="mt-5">{exerciseForm}</div> : null}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
