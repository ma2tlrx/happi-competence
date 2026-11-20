import { cn } from '@/lib/utils';

/** Barre de temps restant : la valeur numérique est affichée à côté, la barre est décorative. */
export function TimerBar({ timeLeft, total, className }: { timeLeft: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (timeLeft / total) * 100)) : 0;
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-white/15', className)} aria-hidden>
      <div
        className={cn('h-full rounded-full transition-[width] duration-300 ease-linear', timeLeft <= 5 ? 'bg-danger' : 'bg-orange-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
