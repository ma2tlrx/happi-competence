import { ArrowRight, Check, Compass, Headphones, Languages, Printer, ShieldCheck, Timer, Award } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { ProgramVideoButton } from '@/components/programmes/video-button';
import { MobileFold } from '@/components/public/mobile-fold';
import { Reveal } from '@/components/public/reveal';
import { Section, SectionHeading } from '@/components/public/sections';
import { Button } from '@/components/ui/button';
import {
  PASSEPORT_ANCHOR,
  PASSEPORT_SIGNUP,
  passeportAccess,
  passeportFacts,
  passeportMoreWorlds,
  passeportSteps,
  passeportWorlds,
} from '@/lib/public-passeport';

/** Écran des mondes, dessiné en HTML/CSS : illustration, sans progression ni chiffre. */
function WorldsScreen() {
  return (
    <figure className="mx-auto w-full max-w-sm">
      <div className="rounded-[1.75rem] border border-white/15 bg-petrol-950 p-3 shadow-2xl shadow-black/30">
        <div className="rounded-[1.25rem] bg-paper p-4 text-ink">
          <div className="flex items-center gap-3">
            <Image src="/brand/happi-mascotte.png" alt="" width={44} height={44} className="size-11 shrink-0" />
            <p className="rounded-lg rounded-bl-none bg-white px-3 py-2 text-[0.9375rem] leading-snug shadow-xs">
              Touchez le monde de votre choix. Je vous guide.
            </p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2.5">
            {passeportWorlds.map((world, index) => (
              <li
                key={world.name}
                className="relative flex min-h-24 flex-col justify-between rounded-lg border border-line bg-white p-3 text-[0.9375rem] font-semibold leading-tight"
              >
                <span
                  className="flex size-7 items-center justify-center rounded-md bg-petrol-900 font-display text-sm text-white"
                  aria-hidden
                >
                  {index + 1}
                </span>
                {world.name}
                {index === 0 ? (
                  <span className="absolute top-3 right-3 flex size-3" aria-hidden>
                    <span className="absolute inline-flex size-full rounded-full bg-orange-500/60 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-3 rounded-full bg-orange-500" />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-sm text-ink-muted">et {passeportMoreWorlds.length} autres mondes</p>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-white/65">Illustration : l’écran des mondes d’exercices.</figcaption>
    </figure>
  );
}

function Facts({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <dl
      className={
        tone === 'dark' ? 'grid grid-cols-3 gap-4 border-t border-white/15 pt-6' : 'grid grid-cols-3 gap-4 border-t border-line pt-6'
      }
    >
      {passeportFacts.map((fact) => (
        <div key={fact.label}>
          <dt className={tone === 'dark' ? 'text-sm text-white/70' : 'text-sm text-ink-muted'}>{fact.label}</dt>
          <dd className={tone === 'dark' ? 'font-display text-3xl font-semibold text-white' : 'font-display text-3xl font-semibold'}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Accueil : présentation courte du Passeport Numérique, entre « Notre méthodologie » et « Pour qui ». */
export function PasseportHome() {
  return (
    <Section tone="petrol" id="passeport-numerique">
      <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
        <div>
          <SectionHeading
            tone="dark"
            title="Le Passeport Numérique : prendre en main le numérique, à son rythme"
            intro="Un parcours d’exercices guidés pour gagner en autonomie avec le téléphone, l’ordinateur et internet. On s’entraîne sur des écrans simulés : on ne risque rien."
          />

          <h3 className="mt-12 text-title text-white">Comment ça marche</h3>
          <ol className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {passeportSteps.map((step, index) => (
              <li key={step.title}>
                <Reveal delay={index * 0.06} className="border-t border-white/20 pt-4">
                  <p className="font-display text-lg font-semibold text-white">
                    <span className="mr-2 text-orange-300">{index + 1}.</span>
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-white/75">{step.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
        <Reveal delay={0.1} className="max-sm:hidden">
          <WorldsScreen />
        </Reveal>
      </div>

      <div className="mt-10 sm:mt-16">
        <h3 className="text-title text-white">En quoi consiste l’activité</h3>
        <p className="mt-2 max-w-2xl text-white/75">
          Chaque « monde » regroupe des exercices sur un sujet de la vie de tous les jours. En voici quatre sur {passeportFacts[0].value}.
        </p>
        <MobileFold label="les exercices" tone="dark" className="mt-4 sm:mt-6">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {passeportWorlds.map((world, index) => (
              <li key={world.name}>
                <Reveal delay={index * 0.06} className="h-full rounded-xl border border-white/15 bg-white/[0.06] p-5">
                  <h4 className="font-display text-lg font-semibold text-white">{world.name}</h4>
                  <ul className="mt-3 space-y-1.5 text-[0.9375rem] text-white/75">
                    {world.exercises.map((exercise) => (
                      <li key={exercise} className="flex gap-2">
                        <Check className="mt-1 size-4 shrink-0 text-orange-300" aria-hidden />
                        {exercise}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </li>
            ))}
          </ul>
        </MobileFold>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-xl">
          <Facts />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={PASSEPORT_ANCHOR}>
              Découvrir le Passeport Numérique
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="inverse">
            <Link href={PASSEPORT_SIGNUP}>M’inscrire</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

/** « Pour qui » : bloc dédié aux personnes éloignées du numérique. */
export function PasseportAudienceCard({ title, intro, items }: { title: string; intro: string; items: readonly string[] }) {
  return (
    <Reveal className="mt-5">
      <div className="grid gap-8 rounded-xl bg-petrol-900 p-6 text-white sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        <div>
          <h3 className="text-title text-white">{title}</h3>
          <p className="mt-3 text-white/80">{intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={PASSEPORT_ANCHOR}>
                Découvrir le Passeport Numérique
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-white/85">
              <span className="mt-2.5 h-1.5 w-3 shrink-0 rounded-[2px] bg-orange-500" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

/** Page « Les programmes » : présentation complète du Passeport Numérique. */
export function PasseportProgram() {
  const outputs = [
    {
      icon: Printer,
      title: 'Des notes mémo',
      text: 'Après chaque monde réussi, un mémo à imprimer avec les bons gestes et de la place pour ses propres notes.',
    },
    {
      icon: Award,
      title: 'Un certificat de réussite',
      text: 'Quand tous les mondes sont réussis, la personne peut télécharger son certificat ou se l’envoyer par mail.',
    },
    {
      icon: Timer,
      title: 'Des défis chrono',
      text: 'Des petits défis facultatifs, pour le plaisir. Ils ne comptent pas pour le certificat.',
    },
  ];
  const access = [Languages, Headphones, Compass];
  return (
    <section id="passeport-numerique" className="scroll-mt-28">
      <div className="pixel-grid bg-petrol-900 py-16 text-white sm:py-20">
        <div className="container-site grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <Reveal>
            <h2 className="text-display-lg text-white">Le Passeport Numérique</h2>
            <p className="mt-4 max-w-2xl text-lead text-white/80">
              Un parcours d’exercices guidés pour prendre en main le téléphone, l’ordinateur et internet, à son rythme et sans risque.
            </p>
            <div className="mt-5">
              <ProgramVideoButton kind="passeport_numerique" variant="inverse" />
            </div>
            <div className="mt-8 max-w-xl">
              <Facts />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="max-sm:hidden">
            <WorldsScreen />
          </Reveal>
        </div>
      </div>

      <Section tone="white">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-display-md">À qui s’adresse ce programme ?</h3>
            <p className="mt-4 text-ink-muted">
              Aux personnes qui se sentent éloignées du numérique : peu à l’aise avec un téléphone ou un ordinateur, qui hésitent à faire
              leurs démarches en ligne ou qui craignent les arnaques. Pas besoin de savoir quoi que ce soit pour commencer.
            </p>
          </div>
          <div>
            <h3 className="text-display-md">Comment ça se passe</h3>
            <p className="mt-4 text-ink-muted">
              La personne s’inscrit, choisit le Passeport Numérique, puis avance monde après monde avec un guide à l’écran. Les ateliers
              sont animés par un formateur ou un animateur, qui dispose de son propre espace pour accompagner le groupe (durée d’un atelier
              : {passeportFacts[2].value}).
            </p>
          </div>
        </div>

        <h3 className="mt-16 text-display-md">Un parcours en {passeportFacts[0].value} mondes d’exercices</h3>
        <p className="mt-3 max-w-2xl text-ink-muted">Chaque exercice se fait en situation simulée. Voici un aperçu.</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {passeportWorlds.map((world, index) => (
            <li key={world.name}>
              <Reveal delay={index * 0.05} className="h-full rounded-xl border border-line p-5">
                <h4 className="font-display text-lg font-semibold">{world.name}</h4>
                <ul className="mt-3 space-y-1.5 text-[0.9375rem] text-ink-muted">
                  {world.exercises.map((exercise) => (
                    <li key={exercise} className="flex gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-orange-700" aria-hidden />
                      {exercise}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-ink-muted">
          <span className="font-semibold text-ink">Et aussi : </span>
          {passeportMoreWorlds.join(', ')}.
        </p>
      </Section>

      <Section>
        <h3 className="text-display-md">Ce que la personne garde</h3>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {outputs.map((item, index) => (
            <li key={item.title}>
              <Reveal delay={index * 0.06} className="h-full rounded-xl bg-white p-6">
                <item.icon className="size-6 text-orange-700" aria-hidden />
                <h4 className="mt-4 font-display text-lg font-semibold">{item.title}</h4>
                <p className="mt-2 text-ink-muted">{item.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>

        <h3 className="mt-16 text-display-md">Pensé pour être lisible par tous</h3>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {passeportAccess.map((label, index) => {
            const Icon = access[index] ?? ShieldCheck;
            return (
              <li key={label} className="flex items-center gap-4 rounded-xl border border-line-strong bg-white p-5">
                <Icon className="size-6 shrink-0 text-petrol-700" aria-hidden />
                <span className="font-semibold">{label}</span>
              </li>
            );
          })}
        </ul>

        <Reveal className="mt-14 rounded-xl bg-petrol-900 p-6 text-white sm:p-8">
          <h3 className="text-display-md text-white">Commencer le Passeport Numérique</h3>
          <p className="mt-3 max-w-2xl text-white/80">
            Créez votre compte : la première question est « Pour quel programme vous inscrivez-vous ? ». Choisissez le Passeport Numérique.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={PASSEPORT_SIGNUP}>
                M’inscrire au Passeport Numérique
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="inverse">
              <Link href="/contact">Poser une question</Link>
            </Button>
          </div>
        </Reveal>
      </Section>
    </section>
  );
}
