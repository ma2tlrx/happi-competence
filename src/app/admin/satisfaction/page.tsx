import { ArrowRight, FileDown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SatisfactionResults } from '@/components/satisfaction/results-view';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Badge, Card, CardBody, CardHeader, Notice, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { satisfactionFilters, type SatisfactionSearch } from '@/lib/satisfaction/filters';
import { loadSatisfactionResults } from '@/lib/satisfaction/load';
import { AUDIENCE_LABELS, MOMENT_LABELS, type SatisfactionAudience, type SatisfactionMoment } from '@/lib/satisfaction/window';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { VERSION_STATUS } from '../referentiels/labels';
import { CloneSurveyButton } from './survey-client';

export const metadata: Metadata = { title: 'Satisfaction' };

type Search = SatisfactionSearch;

export default async function AdminSatisfactionPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole('admin');
  const params = await searchParams;
  const filters = satisfactionFilters(params);
  const supabase = await createClient();
  const [{ data: surveys }, { data: groups }, { data: programs }] = await Promise.all([
    supabase.from('satisfaction_surveys').select('id, code, name, description, audience, moment, satisfaction_survey_versions ( id, version_number, label, status, is_provisional, published_at, created_at )').order('code'),
    supabase.from('groups').select('id, name, program_id').order('start_date', { ascending: false }),
    supabase.from('programs').select('id, name').order('name'),
  ]);
  const scoped = (groups ?? []).filter((group) => (!filters.groupId || group.id === filters.groupId) && (!filters.programId || group.program_id === filters.programId));
  const { summaries } = await loadSatisfactionResults(supabase, scoped.map((group) => group.id), { from: filters.from, to: filters.to });
  const groupNames = Object.fromEntries((groups ?? []).map((group) => [group.id, group.name]));
  const exportQuery = new URLSearchParams(
    Object.entries({ groupe: filters.groupId, programme: filters.programId, du: filters.from, au: filters.to }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  const anyProvisional = (surveys ?? []).some((survey) => survey.satisfaction_survey_versions.some((version) => version.status === 'published' && version.is_provisional));

  return (
    <>
      <PageHeader
        title="Satisfaction"
        description="Enquêtes à chaud (fin de programme) et à froid (90 jours après), pour les participants et les prescripteurs. Indicateur Qualiopi 30."
      />
      {anyProvisional ? (
        <Notice variant="warning" className="mb-6" title="Questions provisoires — à valider">
          Les questions livrées sont des questions génériques de satisfaction de formation. Relisez-les et adaptez-les : créez une nouvelle version, modifiez-la, puis publiez-la.
        </Notice>
      ) : null}

      <section aria-labelledby="enquetes-titre" className="mb-10">
        <h2 id="enquetes-titre" className="mb-3 text-[1.25rem] font-semibold tracking-[-0.01em]">
          Enquêtes
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {(surveys ?? []).map((survey) => {
            const versions = [...survey.satisfaction_survey_versions].sort((a, b) => b.version_number - a.version_number);
            const published = versions.find((version) => version.status === 'published');
            const hasDraft = versions.some((version) => version.status === 'draft');
            return (
              <Card key={survey.id}>
                <CardHeader
                  as="h3"
                  title={survey.name}
                  description={`${AUDIENCE_LABELS[survey.audience as SatisfactionAudience]} · ${MOMENT_LABELS[survey.moment as SatisfactionMoment].description}`}
                  action={published && !hasDraft ? <CloneSurveyButton versionId={published.id} /> : null}
                />
                <CardBody className="pt-2">
                  <ul className="divide-y divide-line">
                    {versions.map((version) => (
                      <li key={version.id}>
                        <Link href={`/admin/satisfaction/${version.id}`} className="group flex min-h-11 items-center justify-between gap-3 py-2.5">
                          <span>
                            <span className="flex flex-wrap items-center gap-2 font-semibold">
                              {version.label}
                              <Badge variant={VERSION_STATUS[version.status]!.variant}>{VERSION_STATUS[version.status]!.label}</Badge>
                              {version.is_provisional ? <ProvisionalBadge /> : null}
                            </span>
                            <span className="block text-sm text-ink-muted">
                              Version {version.version_number} · {version.published_at ? `publiée le ${formatDate(version.published_at)}` : `créée le ${formatDate(version.created_at)}`}
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="resultats-titre">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="resultats-titre" className="text-[1.25rem] font-semibold tracking-[-0.01em]">
              Résultats
            </h2>
            <p className="text-sm text-ink-muted">
              Moyennes avec leur effectif (n), taux de réponse sur les invités. La période filtre la date de réponse ; le nombre d’invités reste celui des groupes retenus.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`/api/exports/satisfaction${exportQuery ? `?${exportQuery}` : ''}`} download>
              <FileDown aria-hidden />
              Exporter les réponses (CSV)
            </a>
          </Button>
        </div>
        <form method="get" className="mb-5 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
          <label className="block text-sm font-semibold">
            Programme
            <Select name="programme" defaultValue={filters.programId ?? ''} className="mt-1">
              <option value="">Tous les programmes</option>
              {(programs ?? []).map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-semibold">
            Groupe
            <Select name="groupe" defaultValue={filters.groupId ?? ''} className="mt-1">
              <option value="">Tous les groupes</option>
              {(groups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-semibold">
            Du
            <Input type="date" name="du" defaultValue={filters.from ?? ''} className="mt-1" />
          </label>
          <label className="block text-sm font-semibold">
            Au
            <Input type="date" name="au" defaultValue={filters.to ?? ''} className="mt-1" />
          </label>
          <Button type="submit" variant="secondary">
            Filtrer
          </Button>
        </form>
        <SatisfactionResults summaries={summaries} showAuthors groupNames={groupNames} />
      </section>
    </>
  );
}
