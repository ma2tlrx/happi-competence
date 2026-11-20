import { cn } from '@/lib/utils';

/** Code de partie en grands caractères espacés (lisible depuis le fond d'une salle). */
export function CodeBadge({ code, size = 'md', className }: { code: string; size?: 'md' | 'xl'; className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-center', className)}>
      <span className={cn('font-medium text-white/70', size === 'xl' ? 'text-lg' : 'text-xs')}>Code de la partie</span>
      <span
        className={cn(
          'mt-1 rounded-lg border border-orange-400/60 bg-white/10 px-4 py-1 font-mono font-medium text-white',
          size === 'xl' ? 'text-6xl tracking-[0.3em] lg:text-8xl' : 'text-2xl tracking-[0.25em]',
        )}
        aria-label={`Code de la partie : ${code.split('').join(' ')}`}
      >
        {code}
      </span>
    </span>
  );
}
