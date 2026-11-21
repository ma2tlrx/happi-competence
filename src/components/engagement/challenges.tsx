import { Star } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { FAMILY_LABELS, type Challenge, type ChallengeFamily } from '@/lib/engagement/challenges';
import { cn } from '@/lib/utils';

import { ChallengeEmblem, ChallengeStars, PixelProgress } from './visuals';

function progressText(challenge: Challenge) {
  if (challenge.done) return 'Réussi';
  if (!challenge.available) return challenge.lockedReason ?? 'Bientôt disponible';
  return challenge.target > 1 ? `${challenge.current} sur ${challenge.target}` : 'À faire';
}

/** Un défi : emblème, objectif, progression et, s'il dépend de la personne, le lien pour agir. */
export function ChallengeRow({ challenge, compact = false }: { challenge: Challenge; compact?: boolean }) {
  return (
    <article className={cn('flex gap-4', !challenge.available && !challenge.done && 'opacity-75')}>
      <ChallengeEmblem challenge={challenge} size={compact ? 'md' : 'lg'} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h3 className="font-display text-[0.9375rem] leading-snug font-semibold text-ink">{challenge.title}</h3>
          <ChallengeStars count={challenge.stars} earned={challenge.done} />
        </div>
        <p className="mt-0.5 text-sm text-ink-muted">{challenge.goal}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          {challenge.available && !challenge.done && challenge.target > 1 ? (
            <PixelProgress
              current={challenge.current}
              target={challenge.target}
              label={`${challenge.title} : ${challenge.current} sur ${challenge.target}`}
              className="w-32 sm:w-40"
            />
          ) : null}
          <span className={cn('text-sm', challenge.done ? 'font-semibold text-orange-700' : 'text-ink-subtle')}>{progressText(challenge)}</span>
          {!compact && challenge.available && !challenge.done && challenge.href && challenge.action ? (
            <Link href={challenge.href} className="inline-flex min-h-8 items-center text-sm font-semibold text-petrol-700 underline-offset-4 hover:text-petrol-950 hover:underline">
              {challenge.action}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Défis regroupés par famille : parcours, compétences, participation. */
export function ChallengeBoard({ challenges }: { challenges: Challenge[] }) {
  const families = Object.keys(FAMILY_LABELS) as ChallengeFamily[];
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {families.map((family) => {
        const items = challenges.filter((item) => item.family === family);
        const done = items.filter((item) => item.done).length;
        return (
          <section key={family} aria-labelledby={`defis-${family}`} className="rounded-xl border border-line bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id={`defis-${family}`} className="font-display text-lg font-semibold text-ink">
                {FAMILY_LABELS[family]}
              </h2>
              <span className="text-sm text-ink-muted tabular-nums">
                {done} / {items.length}
              </span>
            </div>
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={item.id}>
                  <ChallengeRow challenge={item} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Total d'étoiles : sobre, chiffré, avec la part des défis réussis. */
export function StarTotal({ earned, total, done, count, tone = 'light' }: { earned: number; total: number; done: number; count: number; tone?: 'light' | 'dark' }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('pixel-corners flex size-12 items-center justify-center', tone === 'dark' ? 'bg-white/10' : 'bg-orange-50')}>
        <Star className="size-6 fill-orange-500 text-orange-500" aria-hidden />
      </span>
      <span>
        <span className={cn('block font-display text-2xl leading-none font-semibold tabular-nums', tone === 'dark' ? 'text-white' : 'text-ink')}>
          {earned}
          <span className={cn('text-base font-medium', tone === 'dark' ? 'text-white/55' : 'text-ink-subtle')}> / {total} étoiles</span>
        </span>
        <span className={cn('mt-1 block text-sm', tone === 'dark' ? 'text-white/70' : 'text-ink-muted')}>
          {done} défi{done > 1 ? 's' : ''} réussi{done > 1 ? 's' : ''} sur {count}
        </span>
      </span>
    </div>
  );
}

/** Prochaine étape : une seule action, la plus utile maintenant. */
export function NextStepCard({ challenge }: { challenge: Challenge }) {
  return (
    <section aria-labelledby="prochaine-etape" className="flex h-full flex-col justify-between gap-5 rounded-xl border border-orange-200 bg-orange-50 p-5 sm:p-6">
      <div className="flex gap-4">
        <ChallengeEmblem challenge={challenge} size="lg" className="bg-white" />
        <div className="min-w-0">
          <p className="text-sm text-orange-700">Votre prochaine étape</p>
          <h2 id="prochaine-etape" className="mt-0.5 font-display text-xl leading-snug font-semibold text-ink">
            {challenge.title}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-ink-muted">{challenge.goal}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <ChallengeStars count={challenge.stars} earned={false} />à gagner
        </span>
        {challenge.href && challenge.action ? (
          <Button asChild>
            <Link href={challenge.href}>{challenge.action}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
