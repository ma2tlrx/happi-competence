import { ArrowRight, BookOpen, Check, MonitorSmartphone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PasseportLauncher } from '@/components/passeport-numerique/launcher';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { AGGREGATION_LABELS, SCORING_MODE_LABELS, type Aggregation, type ScoringMode } from '@/lib/evaluation-engine';
import { PASSEPORT_FACTS } from '@/lib/passeport-numerique/meta';
import { PROGRAM_KIND_LABELS, PROGRAM_KINDS, programKindFromSlug, programSlug, type ProgramKind } from '@/lib/programmes/kind';
import { createClient } from '@/lib/supabase/server';
import { cn, formatDuration } from '@/lib/utils';

export const metadata: Metadata = { title: 'Programmes' };

const KIND_ICONS: Record<ProgramKind, typeof BookOpen> = { happi_competence: BookOpen, passeport_numerique: MonitorSmartphone };

export default async function TrainerProgramsPage({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  await requireRole('formateur', 'admin');
  const selected = programKindFromSlug((await searchParams).programme) ?? 'happi_competence';
  const supabase = await createClient();
  const { data: programs } = await supabase
    .from('programs')
    .select('id, name, description, sessions_count, session_duration_minutes, min_group_size, max_group_size, status, program_sessions ( number, title, summary, is_provisional ), program_frameworks ( framework_versions ( label, is_provisional, scale_min, scale_max, scoring_mode, aggregation, frameworks ( name ) ) )')
    .eq('status', 'active')
    .eq('kind', 'happi_competence')
    .order('name');

  return (
    <>
      <PageHeader title="Programmes" description="Choisissez le programme que vous animez." />
      <nav aria-label="Programmes" className="mb-6 grid gap-3 sm:grid-cols-2">
        {PROGRAM_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind];
          const active = kind === selected;
          return (
            <Link
              key={kind}
              href={`/formateur/programmes?programme=${programSlug(kind)}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-start gap-4 rounded-xl border-2 p-4 transition-colors sm:p-5',
                active ? 'border-orange-500 bg-orange-50' : 'border-line bg-white hover:border-petrol-300',
              )}
            >
              <span aria-hidden className={cn('pixel-corners flex size-11 shrink-0 items-center justify-center', active ? 'bg-orange-500 text-petrol-950' : 'bg-petrol-100 text-petrol-700')}>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  {PROGRAM_KIND_LABELS[kind].name}
                  {active ? <Check className="size-4 text-orange-700" aria-label="Programme affiché" /> : null}
                </span>
                <span className="mt-0.5 block text-sm text-ink-muted">{PROGRAM_KIND_LABELS[kind].summary}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      {selected === 'passeport_numerique' ? (
        <Card>
          <CardHeader title={PROGRAM_KIND_LABELS.passeport_numerique.name} description="Un atelier d’initiation au numérique, avec son espace animateur." />
          <CardBody className="space-y-6">
            <dl className="grid grid-cols-3 gap-3">
              {PASSEPORT_FACTS.map((fact) => (
                <div key={fact.label} className="flex flex-col rounded-lg bg-paper p-3.5">
                  <dt className="text-sm leading-snug text-ink-muted">{fact.label}</dt>
                  <dd className="order-first font-display text-2xl font-semibold text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[0.9375rem] text-ink-muted">
              Découvrir le numérique pas à pas, à son rythme : gestes de base, clavier, arnaques, mails, photos, démarches en ligne, intelligence artificielle… Une heure d’exercices, puis une heure d’entraide. Les
              participants inscrits au Passeport Numérique y accèdent avec leur compte.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <PasseportLauncher href="/formateur/programmes/passeport-numerique">
                  Ouvrir l’espace animateur
                  <ArrowRight aria-hidden />
                </PasseportLauncher>
              </Button>
            </div>
            <p className="rounded-lg bg-orange-50 p-3.5 text-sm text-ink-muted">
              Dans cette version, la progression de chaque personne reste sur l’appareil qu’elle utilise : pour regrouper les chiffres, utilisez « Sauvegarder » puis « Importer une sauvegarde » dans les réglages de l’espace
              animateur.
            </p>
          </CardBody>
        </Card>
      ) : (programs ?? []).length === 0 ? (
        <Card><EmptyState icon={BookOpen} title="Aucun programme actif" /></Card>
      ) : (
        <div className="space-y-6">
          {programs!.map((program) => (
            <Card key={program.id}>
              <CardHeader
                title={program.name}
                description={`${program.sessions_count} sessions de ${formatDuration(program.session_duration_minutes)} · groupes de ${program.min_group_size} à ${program.max_group_size} participants`}
              />
              <CardBody className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  {program.description ? <p className="mb-4 text-[0.9375rem] text-ink-muted">{program.description}</p> : null}
                  <ol className="space-y-2">
                    {[...program.program_sessions].sort((a, b) => a.number - b.number).map((session) => (
                      <li key={session.number} className="flex gap-3 rounded-md bg-paper p-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-petrol-900 text-sm font-semibold text-white">{session.number}</span>
                        <span>
                          <span className="flex flex-wrap items-center gap-2 font-semibold">{session.title}{session.is_provisional ? <ProvisionalBadge /> : null}</span>
                          {session.summary ? <span className="block text-sm text-ink-muted">{session.summary}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold text-ink-muted">Référentiels activés</p>
                  <ul className="space-y-3">
                    {program.program_frameworks.map((link, index) => {
                      const version = link.framework_versions;
                      if (!version) return null;
                      return (
                        <li key={index} className="rounded-md border border-line p-4">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">{version.frameworks?.name}{version.is_provisional ? <ProvisionalBadge /> : <Badge variant="success">Validé</Badge>}</p>
                          <p className="text-sm text-ink-muted">{version.label}</p>
                          <p className="mt-2 text-sm text-ink-muted">
                            Échelle {version.scale_min}–{version.scale_max} · {SCORING_MODE_LABELS[version.scoring_mode as ScoringMode].label} · {AGGREGATION_LABELS[version.aggregation as Aggregation].label}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
