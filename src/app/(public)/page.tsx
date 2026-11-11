import { ArrowRight, Gamepad2, Quote } from 'lucide-react';
import Link from 'next/link';

import { CountUp } from '@/components/public/count-up';
import { DeclaredObserved } from '@/components/public/declared-observed';
import { HeroMascot, Intro, Magnetic, SplitHeadline } from '@/components/public/hero-motion';
import { MethodTimeline } from '@/components/public/method-timeline';
import { PassportDemo } from '@/components/public/passport-demo';
import { Reveal } from '@/components/public/reveal';
import { ScaleSteps } from '@/components/public/scale-steps';
import { SessionJourney } from '@/components/public/session-journey';
import { SkillField } from '@/components/public/skill-field';
import { Faq, Section, SectionHeading, SpaceAccess } from '@/components/public/sections';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { audiences, faq, journey, mission, organizationBenefits, participantBenefits, testimonials, vision } from '@/config/site-content';
import { frameworkByCode, getPublicCatalog } from '@/lib/public-catalog';
import { formatDuration } from '@/lib/utils';

export default async function HomePage() {
  const catalog = await getPublicCatalog();
  const program = catalog.program;
  const sessionsCount = program?.sessions_count ?? 6;
  const totalHours = program ? formatDuration(program.sessions_count * program.session_duration_minutes) : '18 h';
  const transversal = frameworkByCode(catalog, 'transversal');
  const sociocognitive = frameworkByCode(catalog, 'sociocognitive');
  const frameworks = [transversal, sociocognitive].filter((framework) => framework != null);
  const journeySkills = frameworks.flatMap((framework) =>
    framework.categories.flatMap((category) =>
      category.skills.map((skill) => ({
        name: skill.name,
        kind: framework.code === 'transversal' ? ('ct' as const) : ('hbs' as const),
        group: category.name,
        sessions: skill.sessions ?? [],
      })),
    ),
  );
  const fieldSkills = journeySkills.map(({ name, kind }) => ({ name, kind }));

  // « Du déclaré à l'observé » : trois compétences du référentiel, avec un niveau d'illustration (exemple fictif).
  const transversalSkills = transversal?.categories.flatMap((category) => category.skills) ?? [];
  const compared = [
    { code: 'relationnel', declared: 'Bon relationnel', value: 4 },
    { code: 'esprit_d_equipe', declared: 'Esprit d’équipe', value: 3 },
    { code: 'organisation', declared: 'Sens de l’organisation', value: 4 },
  ].flatMap((item) => {
    const skill = transversalSkills.find((candidate) => candidate.code === item.code);
    if (!skill || !transversal) return [];
    return [
      {
        declared: item.declared,
        name: skill.name,
        value: Math.min(item.value, transversal.scale_max),
        max: transversal.scale_max,
        level: transversal.levels.find((level) => level.value === item.value)?.label ?? null,
        session: skill.sessions?.[0] ?? null,
      },
    ];
  });

  // Démonstration du passeport : structure réelle du référentiel, niveaux fictifs calculés dans le composant.
  const demoFrameworks = frameworks.map((framework) => ({
    code: framework.code,
    name: framework.name,
    shortName: framework.short_name,
    min: framework.scale_min,
    max: framework.scale_max,
    levels: framework.levels,
    skills: framework.categories.flatMap((category) =>
      category.skills.map((skill) => ({ code: skill.code, name: skill.name, sessions: skill.sessions ?? [] })),
    ),
  }));
  const demoSessions = (program?.sessions ?? []).map((session) => ({
    number: session.number,
    title: session.title,
    provisional: session.is_provisional,
  }));

  return (
    <>
      {/* ── Hero : la carte des compétences à révéler ─────────────────── */}
      <section className="relative isolate overflow-hidden bg-petrol-900 text-white lg:min-h-[calc(100svh-4.5rem)]">
        <SkillField skills={fieldSkills} />
        <HeroMascot />
        <div className="container-site relative z-10 pt-12 pb-[19rem] sm:pt-16 lg:flex lg:min-h-[calc(100svh-4.5rem)] lg:flex-col lg:justify-center lg:py-12">
          <div className="pointer-events-none max-w-[44rem] [&_a]:pointer-events-auto">
            <Intro>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-petrol-900/60 px-3 py-1 text-sm text-white/80 backdrop-blur-sm">
                <Gamepad2 className="size-4 text-orange-400" aria-hidden />
                {siteConfig.meaning}
              </p>
            </Intro>
            <SplitHeadline
              lines={['Révélez les', 'compétences', 'qui feront', 'la différence.']}
              className="mt-6 font-display text-[clamp(2.75rem,1.5rem+4.6vw,5.25rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-white"
            />
            <Intro delay={0.5}>
              <p className="mt-7 max-w-lg text-lead text-white/75">
                Grâce au jeu vidéo, HAPPI vous aide à identifier, développer et valoriser vos compétences transversales pour construire
                votre avenir professionnel.
              </p>
            </Intro>
            <Intro delay={0.62}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Magnetic>
                  <Button asChild size="lg">
                    <Link href="/programme">
                      Découvrir le programme
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </Magnetic>
                <Magnetic strength={0.18}>
                  <Button asChild size="lg" variant="inverse">
                    <Link href="#acces">Accéder à mon espace</Link>
                  </Button>
                </Magnetic>
              </div>
            </Intro>
            <Intro delay={0.74}>
              <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
                <div>
                  <dt className="text-sm text-white/60">Durée</dt>
                  <dd className="font-display text-2xl font-semibold text-white">{totalHours}</dd>
                </div>
                <div>
                  <dt className="text-sm text-white/60">Sessions</dt>
                  <dd className="font-display text-2xl font-semibold text-white">{sessionsCount}</dd>
                </div>
                <div>
                  <dt className="text-sm text-white/60">Par groupe</dt>
                  <dd className="font-display text-2xl font-semibold text-white">
                    {program ? `${program.min_group_size} à ${program.max_group_size}` : '4 à 8'}
                  </dd>
                </div>
              </dl>
            </Intro>
          </div>
        </div>
      </section>

      {/* ── Pourquoi HAPPI : du déclaré à l'observé ───────────────────── */}
      <Section tone="white">
        <SectionHeading
          title="Des compétences essentielles, souvent invisibles"
          intro="Coopérer, s’adapter, décider sous pression : ces compétences comptent dans tous les métiers, mais elles se voient rarement sur un CV et se racontent mal en entretien."
        />
        {compared.length ? (
          <Reveal className="mt-12">
            <DeclaredObserved
              skills={compared}
              comment="Répartit les rôles dès le début de la partie et vérifie que chacun a compris la consigne."
            />
          </Reveal>
        ) : null}
        <ol className="mt-16 grid gap-x-10 gap-y-10 md:grid-cols-3">
          {[
            {
              title: 'Le jeu révèle ce que l’on fait vraiment',
              text: 'Face à un défi de jeu vidéo, chacun agit spontanément : on organise, on rassure, on propose, on tranche. Le formateur observe ces comportements réels, pas des réponses préparées.',
            },
            {
              title: 'Le débriefing donne des mots',
              text: 'Après chaque activité, le groupe met en commun ce qui s’est passé. Le participant apprend à nommer ses compétences et à les relier à des situations professionnelles.',
            },
            {
              title: 'Le passeport les rend valorisables',
              text: 'Auto-évaluation, observations datées et commentaires des formateurs forment un passeport que le participant peut consulter et présenter.',
            },
          ].map((item, index) => (
            <li key={item.title}>
              <Reveal delay={index * 0.08} className="border-t border-line-strong pt-5">
                <span className="font-mono text-sm text-orange-700" aria-hidden>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-title">{item.title}</h3>
                <p className="mt-2 text-ink-muted">{item.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Le programme : six sessions racontées au défilement ─────────── */}
      <section className="bg-petrol-900 text-white">
        <div className="container-site flex flex-col gap-6 pt-20 sm:pt-28 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            tone="dark"
            title={`${totalHours} pour révéler son potentiel`}
            intro={`${sessionsCount} sessions de ${formatDuration(program?.session_duration_minutes ?? 180)}, en groupe. À chaque session, de nouvelles compétences entrent en jeu.`}
          />
          <Button asChild variant="inverse">
            <Link href="/programme">
              Le programme en détail
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        {program?.sessions.length ? <SessionJourney sessions={program.sessions} skills={journeySkills} /> : null}
      </section>

      {/* ── Le passeport en démonstration, puis l'accès aux espaces ──── */}
      <Section>
        <SectionHeading
          title="Un passeport qui se remplit session après session"
          intro="Faites avancer un parcours d’exemple : l’auto-évaluation de départ reste visible, les observations des formateurs s’ajoutent au fil du programme."
        />
        {demoFrameworks.length && demoSessions.length ? (
          <Reveal className="mt-12">
            <PassportDemo frameworks={demoFrameworks} sessions={demoSessions} />
            <p className="mt-3 text-sm text-ink-muted">
              Niveaux et commentaires fictifs, affichés avec les composants de l’espace participant et la répartition réelle des
              compétences par session.
            </p>
          </Reveal>
        ) : null}

        <div id="acces" className="mt-20 scroll-mt-24 sm:mt-24">
          <SectionHeading
            title="Accéder à mon espace"
            intro="Choisissez votre profil pour vous connecter ou créer votre compte."
            className="mb-8"
          />
          <SpaceAccess />
        </div>
      </Section>

      {/* ── Les compétences ──────────────────────────────────────────── */}
      <Section tone="white">
        <SectionHeading
          title="Deux référentiels pour nommer ce que l’on observe"
          intro="Ce que la personne sait mobiliser en situation de travail, et les aptitudes qui lui permettent d’apprendre, d’interagir et de s’adapter. Chaque référentiel a sa propre échelle de niveaux."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {frameworks.map((framework, index) => {
            const count = framework.categories.reduce((total, category) => total + category.skills.length, 0);
            return (
              <Reveal key={framework.code} delay={index * 0.08}>
                <article className="flex h-full flex-col rounded-xl border border-line p-6 sm:p-8">
                  <h3 className="flex items-end gap-4">
                    <CountUp value={count} className="font-mono text-[clamp(3.5rem,3rem+3vw,5.5rem)] leading-[0.85] font-medium tracking-[-0.06em] text-petrol-900" />
                    <span className="pb-1 text-display-md">{framework.name.replace(/^./, (letter) => letter.toLowerCase())}</span>
                  </h3>
                  <div className="mt-8">
                    <p className="mb-3 text-sm text-ink-subtle">
                      Échelle de {framework.scale_min} à {framework.scale_max}
                    </p>
                    <ScaleSteps
                      levels={framework.levels}
                      label={`Échelle des ${framework.name.toLowerCase()}, de ${framework.scale_min} à ${framework.scale_max}`}
                    />
                  </div>
                  <ul className="mt-8 space-y-3">
                    {framework.categories.map((category) => (
                      <li key={category.code} className="flex flex-col gap-1 border-t border-line pt-3 sm:flex-row sm:gap-4">
                        <span className="w-40 shrink-0 font-semibold text-ink">{category.name}</span>
                        <span className="text-ink-muted">{category.skills.map((skill) => skill.name).join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-8">
          <Link href="/competences" className="inline-flex items-center gap-2 font-semibold text-petrol-700 hover:text-petrol-950">
            Découvrir chaque compétence et ses niveaux
            <ArrowRight className="size-[1.125rem]" aria-hidden />
          </Link>
        </Reveal>
      </Section>

      {/* ── Méthodologie ─────────────────────────────────────────────── */}
      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading title="Notre méthodologie" intro={vision} />
            <Reveal delay={0.1}>
              <p className="mt-6 text-ink-muted">{mission}</p>
            </Reveal>
          </div>
          <MethodTimeline steps={journey} />
        </div>
      </Section>

      {/* ── Publics et bénéfices ─────────────────────────────────────── */}
      <Section tone="white">
        <SectionHeading
          title="Pour qui ?"
          intro="Tout public, même non-joueur. HAPPI s’adresse aux personnes accompagnées comme aux structures qui les accompagnent."
        />
        <ul className="mt-10 flex flex-wrap gap-2">
          {audiences.map((audience) => (
            <li key={audience.title} className="rounded-full border border-line-strong px-4 py-2 text-[0.9375rem] font-medium text-ink">
              {audience.title}
            </li>
          ))}
        </ul>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {[
            { title: 'Pour les participants', items: participantBenefits },
            { title: 'Pour les organismes', items: organizationBenefits },
          ].map((group, index) => (
            <Reveal key={group.title} delay={index * 0.08}>
              <div className="h-full rounded-xl bg-paper p-6 sm:p-8">
                <h3 className="text-title">{group.title}</h3>
                <ul className="mt-5 space-y-3">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-3 text-ink-muted">
                      <span className="mt-2.5 h-1.5 w-3 shrink-0 rounded-[2px] bg-orange-500" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── Témoignages ──────────────────────────────────────────────── */}
      <Section>
        <SectionHeading title="Ils ont participé au programme" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((item, index) => (
            <Reveal key={item.author} delay={index * 0.06}>
              <figure className="flex h-full flex-col rounded-lg bg-white p-6">
                <Quote className="size-6 text-orange-500" aria-hidden />
                <blockquote className="mt-4 flex-1 text-ink">« {item.quote} »</blockquote>
                <figcaption className="mt-5 text-sm text-ink-muted">
                  <span className="font-semibold text-ink">{item.author}</span>, participant
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── Équipe ───────────────────────────────────────────────────── */}
      <Section tone="white">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHeading
            title="L’équipe"
            intro="HAPPI est porté par une équipe qui anime les sessions, observe les participants et fait évoluer la méthode avec les structures partenaires."
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {siteConfig.team.map((member) => (
              <li key={member.email} className="rounded-xl border border-line p-6">
                <span
                  className="flex size-12 items-center justify-center rounded-full bg-petrol-900 font-display font-semibold text-white"
                  aria-hidden
                >
                  {member.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </span>
                <p className="mt-4 font-display text-lg font-semibold">{member.name}</p>
                <p className="text-ink-muted">{member.role}</p>
                <a
                  href={`mailto:${member.email}`}
                  className="mt-3 inline-block text-sm font-medium text-petrol-700 underline-offset-4 hover:underline"
                >
                  {member.email}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── Questions fréquentes ─────────────────────────────────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading title="Questions fréquentes" />
          <Faq items={faq} />
        </div>
      </Section>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <Section tone="petrol" className="py-16 sm:py-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-display-md text-white">{siteConfig.slogan}</h2>
            <p className="mt-3 text-lead text-white/70">
              Vous accompagnez des jeunes, des demandeurs d’emploi ou des équipes ? Parlons de votre projet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/contact">Nous contacter</Link>
            </Button>
            <Button asChild size="lg" variant="inverse">
              <Link href="/inscription?espace=organisme">Demander un espace organisme</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
