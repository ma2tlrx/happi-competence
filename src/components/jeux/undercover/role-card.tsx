'use client';

import { Eye, EyeOff, HelpCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { Countdown } from '@/components/jeux/shared/countdown';
import { Button } from '@/components/ui/button';
import type { UndercoverRole } from '@/lib/jeux/client-undercover';
import { cn } from '@/lib/utils';

import { ROLE_META } from './parts';

/** Face visible de la carte : rôle, mot (ou absence de mot pour l'Espion) et consigne. */
function RoleFace({ role, word }: { role: UndercoverRole; word: string | null }) {
  const meta = ROLE_META[role];
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <meta.icon className={cn('size-14', meta.accent)} aria-hidden />
      <p className="text-sm text-white/70">Votre rôle</p>
      <p className={cn('font-display text-3xl font-semibold', meta.accent)}>{meta.label}</p>
      {word ? (
        <div className="mt-1 rounded-xl bg-white/10 px-6 py-3">
          <p className="text-sm text-white/70">Votre mot</p>
          <p className="font-display text-3xl font-semibold text-white">{word}</p>
        </div>
      ) : null}
      <p className="max-w-[16rem] text-sm text-white/80">{meta.hint}</p>
    </div>
  );
}

/**
 * Carte de rôle, visible uniquement sur le téléphone du joueur : elle se retourne au toucher,
 * et le joueur peut la recacher avant de montrer son écran. Jamais affichée sur l'écran de l'animateur.
 */
export function RoleCard({ role, word }: { role: UndercoverRole; word: string | null }) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="flex min-h-80 w-full max-w-xs items-center justify-center rounded-2xl border-2 border-white/20 bg-petrol-800 p-6"
        aria-live="polite"
        aria-atomic="true"
      >
        {revealed ? (
          <motion.div initial={reduce ? false : { rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
            <RoleFace role={role} word={word} />
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-xl text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            <HelpCircle className="size-16 text-white/80" aria-hidden />
            <span className="font-display text-xl font-semibold text-white">Touchez pour révéler votre rôle</span>
            <span className="max-w-[14rem] text-sm text-white/70">Assurez-vous que personne ne regarde votre écran.</span>
          </button>
        )}
      </div>
      {revealed ? (
        <Button variant="inverse" size="lg" onClick={() => setRevealed(false)}>
          <EyeOff aria-hidden />
          Cacher ma carte
        </Button>
      ) : null}
    </div>
  );
}

const PEEK_SECONDS = 5;

/** Bouton flottant « Revoir ma carte » : affiche la carte quelques secondes puis la cache. */
export function PeekCard({ role, word }: { role: UndercoverRole; word: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 flex min-h-14 items-center gap-2 rounded-full bg-orange-650 px-5 text-base font-semibold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Eye className="size-5" aria-hidden />
        Revoir ma carte
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Votre carte"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-petrol-950/97 px-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <p className="text-sm text-white/80">Votre carte se cache dans {PEEK_SECONDS} secondes.</p>
          <div className="w-full max-w-xs rounded-2xl border-2 border-white/20 bg-petrol-800 p-6">
            <RoleFace role={role} word={word} />
          </div>
          <div className="w-full max-w-xs">
            <Countdown seconds={PEEK_SECONDS} onDone={() => setOpen(false)} label="Temps avant que la carte se cache" />
          </div>
          <Button autoFocus variant="inverse" size="lg" onClick={() => setOpen(false)}>
            <EyeOff aria-hidden />
            Cacher maintenant
          </Button>
        </div>
      ) : null}
    </>
  );
}
