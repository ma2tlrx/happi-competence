'use client';

import { Star } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { Dialog as RadixDialog } from 'radix-ui';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toCelebrate, type Challenge } from '@/lib/engagement/challenges';

type Celebrated = Pick<Challenge, 'id' | 'title' | 'goal' | 'stars' | 'done'>;

// Éclats « pixel » : positions fixes (pas de hasard au rendu), couleurs de la marque.
const SHARDS = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2 + (index % 2 ? 0.17 : -0.11);
  const distance = 110 + ((index * 37) % 70);
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance * 0.8 - 20,
    size: 6 + ((index * 5) % 7),
    color: ['#ea632e', '#f4a17e', '#ffffff', '#76a3ac'][index % 4]!,
    rotate: (index * 47) % 180,
  };
});

function readSeen(key: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : new Set(JSON.parse(raw) as string[]);
  } catch {
    return null;
  }
}

function writeSeen(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Stockage indisponible (navigation privée) : on ne célèbre simplement pas deux fois dans la visite.
  }
}

/**
 * Célébration d'un défi réussi depuis la dernière visite, sur cet appareil : au plus une par visite.
 * Le souvenir des défis déjà fêtés reste dans le navigateur (confort d'affichage, aucune donnée envoyée).
 */
export function ChallengeCelebration({ storageKey, challenges }: { storageKey: string; challenges: Celebrated[] }) {
  const [current, setCurrent] = useState<Celebrated | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const done = challenges.filter((item) => item.done).map((item) => item.id);
    if (done.length === 0) return;
    const next = toCelebrate(challenges, readSeen(storageKey) ?? new Set());
    if (!next) return;
    // Affichage après la première peinture : la page se pose, puis la fête. Le souvenir n'est écrit
    // qu'à l'affichage : une visite trop courte ne fait pas perdre la célébration.
    const timer = window.setTimeout(() => {
      writeSeen(storageKey, done);
      setCurrent(next);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [storageKey, challenges]);

  return (
    <RadixDialog.Root open={current !== null} onOpenChange={(open) => (open ? null : setCurrent(null))}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-petrol-950/55 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content className="pixel-grid fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-petrol-900 px-6 pt-8 pb-6 text-center text-white shadow-lg data-[state=open]:animate-pop">
          {current ? (
            <>
              <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
                {!reduce
                  ? SHARDS.map((shard, index) => (
                      <motion.span
                        key={index}
                        aria-hidden
                        className="absolute top-1/2 left-1/2 rounded-[2px]"
                        style={{ width: shard.size, height: shard.size, backgroundColor: shard.color }}
                        initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
                        animate={{ x: shard.x, y: shard.y, opacity: [0, 1, 1, 0], rotate: shard.rotate, scale: 1 }}
                        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.05 + (index % 6) * 0.02 }}
                      />
                    ))
                  : null}
                <motion.div
                  initial={reduce ? false : { scale: 0.6, y: 18, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                >
                  <Image src="/brand/happi-mascotte-3d.webp" alt="" width={120} height={200} className="h-36 w-auto drop-shadow-[0_10px_14px_rgb(0_0_0/0.35)]" />
                </motion.div>
              </div>
              <RadixDialog.Title className="mt-3 font-display text-2xl font-semibold text-white">Défi réussi</RadixDialog.Title>
              <RadixDialog.Description asChild>
                <div>
                  <p className="mt-1 text-lg font-semibold text-orange-300">{current.title}</p>
                  <p className="mt-2 text-[0.9375rem] text-white/75">{current.goal}</p>
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                    <span className="inline-flex" aria-hidden>
                      {Array.from({ length: current.stars }, (_, index) => (
                        <Star key={index} className="size-4 fill-orange-400 text-orange-400" />
                      ))}
                    </span>
                    +{current.stars} étoile{current.stars > 1 ? 's' : ''}
                  </p>
                </div>
              </RadixDialog.Description>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <RadixDialog.Close asChild>
                  <Button>Continuer</Button>
                </RadixDialog.Close>
                <Button asChild variant="inverse">
                  <Link href="/participant/reussites" onClick={() => setCurrent(null)}>
                    Voir mes défis
                  </Link>
                </Button>
              </div>
            </>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
