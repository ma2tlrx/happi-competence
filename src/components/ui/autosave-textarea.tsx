'use client';

import { CloudCheck, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/** Zone de texte enregistrée automatiquement après une courte pause de saisie. */
export function AutosaveTextarea({
  initialValue,
  onSave,
  label,
  placeholder,
  rows = 4,
  maxLength = 4000,
  className,
  tone = 'light',
}: {
  initialValue: string;
  onSave: (value: string) => Promise<{ ok: boolean; message?: string }>;
  label: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initialValue);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const schedule = (next: string) => {
    setValue(next);
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus('saving');
      const result = await onSave(next);
      if (latest.current === next) setStatus(result.ok ? 'saved' : 'error');
    }, 800);
  };

  return (
    <div className={className}>
      <textarea
        aria-label={label}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => schedule(event.target.value)}
        className={cn(
          'w-full rounded-md border px-3 py-2.5 text-[0.9375rem] leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-orange-500',
          tone === 'dark' ? 'border-white/15 bg-white/5 text-white placeholder:text-white/40' : 'border-line-strong bg-white text-ink placeholder:text-ink-subtle/70',
        )}
      />
      <p className={cn('mt-1 flex h-5 items-center gap-1.5 text-xs', tone === 'dark' ? 'text-white/55' : 'text-ink-subtle')} aria-live="polite">
        {status === 'saving' ? <><LoaderCircle className="size-3.5 animate-spin" aria-hidden />Enregistrement…</> : null}
        {status === 'saved' ? <><CloudCheck className="size-3.5 text-success" aria-hidden />Enregistré</> : null}
        {status === 'error' ? <><TriangleAlert className="size-3.5 text-danger" aria-hidden />Non enregistré, vérifiez votre connexion</> : null}
      </p>
    </div>
  );
}
