import { cn } from '@/lib/utils';

/** Code de partie en grands caractères espacés (lisible depuis le fond d'une salle). */
export function CodeBadge({ code, size = 'md', className }: { code: string; size?: 'md' | 'xl'; className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-center', className)}>
      <span className={cn('font-medium text-white/70', size === 'xl' ? 'text-lg' : 'text-xs')}>Code de la partie</span>
      <span
        className={cn(
          'mt-1 max-w-full rounded-lg border border-orange-400/60 bg-white/10 px-4 py-1 font-mono font-medium text-white',
          size === 'xl' ? 'max-w-full whitespace-nowrap px-3 text-4xl tracking-[0.18em] sm:px-4 sm:text-6xl sm:tracking-[0.22em]' : 'text-2xl tracking-[0.25em]',
        )}
        aria-label={`Code de la partie : ${code.split('').join(' ')}`}
      >
        {code}
      </span>
    </span>
  );
}
