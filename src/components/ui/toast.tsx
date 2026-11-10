'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

// Petit magasin externe : permet d'appeler toast.success() depuis n'importe quel composant client.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function push(kind: ToastKind, message: string) {
  const id = nextId++;
  items = [...items.slice(-3), { id, kind, message }];
  emit();
  window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const emptySnapshot: ToastItem[] = [];

const styles: Record<ToastKind, { icon: typeof Info; color: string }> = {
  success: { icon: CircleCheck, color: 'text-success' },
  error: { icon: CircleAlert, color: 'text-danger' },
  info: { icon: Info, color: 'text-petrol-600' },
};

/** Zone d'affichage des confirmations et erreurs, annoncée aux lecteurs d'écran. */
export function Toaster() {
  const current = useSyncExternalStore(subscribe, () => items, () => emptySnapshot);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:pr-6 sm:pb-6"
    >
      <AnimatePresence initial={false}>
        {current.map((item) => {
          const { icon: Icon, color } = styles[item.kind];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role={item.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-white px-4 py-3 shadow-md"
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', color)} aria-hidden />
              <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug font-medium text-ink">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-xs text-ink-subtle hover:bg-petrol-50 hover:text-ink"
                aria-label="Fermer le message"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
