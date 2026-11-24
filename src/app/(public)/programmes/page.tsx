import { ArrowRight, CalendarDays, ClipboardCheck, Clock, Gamepad2, TrendingUp, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/public/reveal';
import { PasseportProgram } from '@/components/public/passeport-numerique';
import { ProgramVideoButton } from '@/components/programmes/video-button';
import { PageHero, Section, SectionHeading } from '@/components/public/sections';
import { Button } from '@/components/ui/button';
import { ProvisionalBadge } from '@/components/ui/primitives';
import { journey, offers } from '@/config/site-content';
import { getPublicCatalog } from '@/lib/public-catalog';
import { formatDuration } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Les programmes',
  description:
    'HAPPI Compétence : 18 heures en 6 sessions pour révéler ses compétences. Passeport Numérique : des exercices guidés pour gagner en autonomie avec le numérique.',
};

export default async function ProgrammesPage() {
  const { program } = await getPublicCatalog();
  const count = program?.sessions_count ?? 6;
  const duration = program?.session_duration_minutes ?? 180;
  const facts = [
    {
      icon: Clock,
      label: 'Durée totale',
      value: formatDuration(count * duration),
    },
    {
      icon: CalendarDays,
      label: 'Sessions',
      value: `${count} × ${formatDuration(duration)}`,
    },
    {
      icon: Users,
      label: 'Participants par groupe',
      value: program ? `${program.min_group_size} à ${program.max_group_size}` : '4 à 8',
    },
    { icon: Gamepad2, label: 'Format', value: 'Mises en situation ludiques' },
    {
      icon: ClipboardCheck,
      label: 'Évaluation',
      value: 'Individuelle, à chaque session',
    },
    { icon: TrendingUp, label: 'Suivi', value: 'Passeport de compétences' },
  ];

  return (
    <>
      <PageHero
        title="Les programmes"
        intro="Deux programmes, un même accompagnement : HAPPI Compétence pour révéler ses compétences, Passeport Numérique pour gagner en autonomie avec le numérique."
      >
        <nav aria-label="Aller à un programme" className="mt-8">
          <ul className="flex flex-wrap gap-3">
            <li>
              <a
                href="#happi-competence"
                className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-5 font-semibold text-white hover:bg-white/10"
              >
                HAPPI Compétence
              </a>
            </li>
            <li>
              <a
                href="#passeport-numerique"
                className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-5 font-semibold text-white hover:bg-white/10"
              >
                Passeport Numérique
              </a>
            </li>
          </ul>
        </nav>
      </PageHero>

      <div id="happi-competence" className="scroll-mt-20">
        <Section tone="white" className="pb-0 sm:pb-0 lg:pb-0">
          <h2 className="text-display-lg">Le programme HAPPI Compétence</h2>
          <p className="mt-4 max-w-2xl text-lead text-ink-muted">
            Un parcours de six sessions en groupe, où le jeu vidéo sert de terrain d’observation commun. Chaque session alterne mise en
            situation, débat et débriefing.
          </p>
          <div className="mt-5">
            <ProgramVideoButton kind="happi_competence" />
          </div>
        </Section>

        <Section tone="white" className="pt-10 sm:pt-10 lg:pt-10">
          <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="relative bg-white p-6 pl-14">
                <fact.icon className="absolute top-6.5 left-6 size-5 text-orange-600" aria-hidden />
                <dt className="text-sm text-ink-muted">{fact.label}</dt>
                <dd className="mt-0.5 font-display text-lg font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section>
          <SectionHeading
            title="Le parcours, session après session"
            intro="Chaque session dure trois heures. Les supports pédagogiques détaillés sont remis aux formateurs ; voici les thèmes abordés."
          />
          <ol className="relative mt-12 space-y-4 before:absolute before:top-4 before:bottom-4 before:left-[1.4rem] before:w-px before:bg-line-strong">
            {(program?.sessions ?? []).map((session, index) => (
              <li key={session.number}>
                <Reveal delay={index * 0.05} className="relative flex gap-5 sm:gap-7">
                  <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-petrol-900 font-display font-semibold text-white ring-4 ring-paper">
                    {session.number}
                  </span>
                  <div className="flex-1 rounded-lg bg-white p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-title">{session.title}</h3>
                      {session.is_provisional ? <ProvisionalBadge>Contenu à venir</ProvisionalBadge> : null}
                    </div>
                    <p className="mt-2 text-ink-muted">{session.summary ?? 'Le contenu de cette session sera précisé prochainement.'}</p>
                    <p className="mt-3 text-sm text-ink-subtle">
                      {formatDuration(duration)} · jeu, débat, débriefing et évaluation individuelle
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </Section>

        <Section tone="white">
          <SectionHeading title="Comment se déroule l’accompagnement" />
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {journey.map((step, index) => (
              <li key={step.title}>
                <Reveal delay={(index % 3) * 0.06} className="h-full rounded-lg border border-line p-6">
                  <span className="font-display text-sm font-semibold text-orange-700">Étape {index + 1}</span>
                  <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-ink-muted">{step.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </Section>

        <Section>
          <SectionHeading
            title="Nos formats"
            intro="Le cycle complet est le cœur du programme. D’autres formats répondent à des besoins plus ciblés."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {offers.map((offer, index) => (
              <Reveal key={offer.title} delay={(index % 2) * 0.06}>
                <article className="h-full rounded-xl bg-white p-6 sm:p-8">
                  <p className="text-sm font-semibold text-orange-700">{offer.duration}</p>
                  <h3 className="mt-1 text-display-md">{offer.title}</h3>
                  <p className="mt-3 text-ink-muted">{offer.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild size="lg">
              <Link href="/contact">
                Construire un programme avec nous
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </Section>
      </div>

      <PasseportProgram />
    </>
  );
}
