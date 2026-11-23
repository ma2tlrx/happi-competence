'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Sur téléphone (moins de 640 px) : le contenu est replié derrière un bouton « Voir … ».
 * Dès 640 px, le contenu est toujours affiché et le bouton disparaît. Le contenu n'est rendu qu'une fois.
 */
export function MobileFold({
  label,
  children,
  tone = 'light',
  className,
}: {
  /** Fin de phrase du bouton : « Voir {label} » / « Masquer {label} ». */
  label: string;
  children: ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'mt-2 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-4 text-left font-semibold sm:hidden',
          tone === 'dark' ? 'border-white/30 text-white' : 'border-line-strong bg-white text-ink',
        )}
      >
        {open ? 'Masquer' : 'Voir'} {label}
        <ChevronDown
          className={cn('size-5 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <div id={id} className={cn(!open && 'max-sm:hidden', 'max-sm:mt-4')}>
        {children}
      </div>
    </div>
  );
}
