import {
  CalendarCheck,
  Compass,
  Flag,
  Gamepad2,
  Gem,
  LayoutGrid,
  ListChecks,
  Lock,
  MessageSquareHeart,
  Milestone,
  Share2,
  Sparkle,
  Star,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import type { Challenge, ChallengeId } from '@/lib/engagement/challenges';
import { cn } from '@/lib/utils';

export const CHALLENGE_ICONS: Record<ChallengeId, LucideIcon> = {
  'point-de-depart': ListChecks,
  'premier-rendez-vous': CalendarCheck,
  'a-mi-chemin': Milestone,
  'ligne-d-arrivee': Flag,
  'regard-final': Compass,
  'premiere-revelee': Sparkle,
  'collection-en-marche': LayoutGrid,
  'belle-collection': Gem,
  'ca-progresse': TrendingUp,
  'mon-avis-compte': MessageSquareHeart,
  'montrer-mes-competences': Share2,
  'esprit-d-equipe': Gamepad2,
};

/** Emblème d'un défi : carré aux coins « pixel ». Orange une fois réussi, pétrole pâle sinon, grisé s'il est verrouillé. */
export function ChallengeEmblem({ challenge, size = 'md', className }: { challenge: Challenge; size?: 'md' | 'lg' | 'xl'; className?: string }) {
  const Icon = challenge.available || challenge.done ? CHALLENGE_ICONS[challenge.id] : Lock;
  const sizes = { md: 'size-11 [&_svg]:size-5', lg: 'size-14 [&_svg]:size-6', xl: 'size-20 [&_svg]:size-9' };
  return (
    <span
      aria-hidden
      className={cn(
        'pixel-corners flex shrink-0 items-center justify-center',
        size === 'xl' && 'pixel-corners-lg',
        sizes[size],
        challenge.done ? 'bg-orange-500 text-petrol-950' : challenge.available ? 'bg-petrol-100 text-petrol-700' : 'bg-paper text-ink-subtle',
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/**
 * Progression en cases : une case par unité tant que l'objectif est petit, dix cases au-delà.
 * Même grammaire que la jauge de niveau, en plus discret.
 */
export function PixelProgress({ current, target, tone = 'light', label, className }: { current: number; target: number; tone?: 'light' | 'dark'; label: string; className?: string }) {
  const cells = Math.min(Math.max(target, 1), 10);
  const filled = target <= 10 ? current : Math.floor((current / target) * cells);
  return (
    <div role="img" aria-label={label} className={cn('flex gap-[3px]', className)}>
      {Array.from({ length: cells }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-2 flex-1 rounded-[2px]',
            index < filled ? 'bg-orange-500' : tone === 'dark' ? 'bg-white/15' : 'bg-petrol-100',
          )}
        />
      ))}
    </div>
  );
}

/** Étoiles d'un défi (1 à 3), pleines si le défi est réussi. */
export function ChallengeStars({ count, earned, className }: { count: number; earned: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${count} étoile${count > 1 ? 's' : ''}`} role="img">
      {Array.from({ length: count }, (_, index) => (
        <Star key={index} aria-hidden className={cn('size-3.5', earned ? 'fill-orange-500 text-orange-500' : 'fill-transparent text-ink-subtle')} />
      ))}
    </span>
  );
}
