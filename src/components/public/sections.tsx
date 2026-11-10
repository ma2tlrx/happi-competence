import { ArrowRight, Building2, GraduationCap, Plus, ShieldCheck, User } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Reveal } from './reveal';

export function Section({
  id,
  tone = 'paper',
  className,
  children,
}: {
  id?: string;
  tone?: 'paper' | 'white' | 'petrol';
  className?: string;
  children: ReactNode;
}) {
  const tones = { paper: 'bg-paper', white: 'bg-white', petrol: 'bg-petrol-900 text-white pixel-grid' };
  return (
    <section id={id} className={cn('py-20 sm:py-24 lg:py-28', tones[tone], className)}>
      <div className="container-site">{children}</div>
    </section>
  );
}

export function SectionHeading({
  title,
  intro,
  align = 'left',
  tone = 'light',
  className,
}: {
  title: ReactNode;
  intro?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <h2 className={cn('text-display-lg', tone === 'dark' && 'text-white')}>{title}</h2>
      {intro ? <p className={cn('mt-4 text-lead', tone === 'dark' ? 'text-white/70' : 'text-ink-muted')}>{intro}</p> : null}
    </Reveal>
  );
}

/** Encart « Accéder à mon espace » : deux entrées principales, l'équipe HAPPI en retrait. */
export function SpaceAccess() {
  const choices = [
    {
      href: '/connexion?espace=participant',
      signup: '/inscription?espace=participant',
      icon: User,
      title: 'Je suis participant',
      text: 'Retrouvez votre parcours, votre auto-évaluation et votre passeport de compétences.',
      cta: 'Me connecter',
      signupLabel: 'Créer mon compte',
    },
    {
      href: '/connexion?espace=organisme',
      signup: '/inscription?espace=organisme',
      icon: Building2,
      title: 'Je suis un organisme',
      text: 'Suivez les participants qui vous sont rattachés : présences, avancement, fiches de compétences.',
      cta: 'Me connecter',
      signupLabel: 'Demander un espace',
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {choices.map((choice, index) => (
        <Reveal key={choice.href} delay={index * 0.08}>
          <div className="group relative flex h-full flex-col rounded-xl border border-line bg-white p-6 transition-[border-color,box-shadow] duration-300 hover:border-petrol-300 hover:shadow-md sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-lg bg-petrol-900 text-white transition-colors duration-300 group-hover:bg-orange-500 group-hover:text-petrol-950">
              <choice.icon className="size-6" aria-hidden />
            </span>
            <h3 className="mt-5 text-title">{choice.title}</h3>
            <p className="mt-2 flex-1 text-ink-muted">{choice.text}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href={choice.href}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-petrol-900 px-5 font-semibold text-white transition-colors hover:bg-petrol-800"
              >
                {choice.cta}
                <ArrowRight className="size-[1.125rem] transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link href={choice.signup} className="inline-flex items-center gap-1.5 font-semibold text-petrol-700 underline-offset-4 hover:underline">
                <Plus className="size-4" aria-hidden />
                {choice.signupLabel}
              </Link>
            </div>
          </div>
        </Reveal>
      ))}
      <Reveal className="md:col-span-2" delay={0.16}>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-line-strong px-5 py-4 text-[0.9375rem] text-ink-muted">
          <span>Vous faites partie de l’équipe HAPPI ?</span>
          <Link href="/connexion?espace=formateur" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-petrol-700">
            <GraduationCap className="size-4" aria-hidden />
            Espace formateur
          </Link>
          <Link href="/connexion?espace=admin" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-petrol-700">
            <ShieldCheck className="size-4" aria-hidden />
            Administration
          </Link>
        </p>
      </Reveal>
    </div>
  );
}

export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <details key={item.question} className="group py-1">
          <summary className="flex list-none items-center justify-between gap-6 py-4 text-left font-display text-[1.0625rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {item.question}
            <Plus className="size-5 shrink-0 text-petrol-500 transition-transform duration-300 group-open:rotate-45" aria-hidden />
          </summary>
          <p className="max-w-3xl pb-5 text-ink-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function PageHero({ title, intro, children }: { title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="pixel-grid bg-petrol-900 pt-16 pb-20 text-white sm:pt-20 sm:pb-24">
      <div className="container-site">
        <Reveal className="max-w-3xl">
          <h1 className="text-display-lg text-white">{title}</h1>
          {intro ? <p className="mt-5 text-lead text-white/75">{intro}</p> : null}
          {children}
        </Reveal>
      </div>
    </section>
  );
}
