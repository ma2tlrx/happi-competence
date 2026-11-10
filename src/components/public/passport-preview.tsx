"use client";

import { motion } from "motion/react";
import Image from "next/image";

import { LevelMeter, SessionSteps } from "@/components/ui/level-meter";

// Valeurs d'illustration : la carte est explicitement présentée comme un exemple.
const rows = [
  { name: "Coopération", value: 3, max: 4, level: "Maîtrise" },
  { name: "Gestion du stress", value: 4, max: 5, level: "Acquis" },
  { name: "Planification", value: 2, max: 4, level: "Acquisition" },
];

/** Visuel du hero : un aperçu du passeport de compétences porté par la mascotte. */
export function PassportPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[26rem] lg:mr-20">
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 rounded-xl border border-white/10 bg-white p-5 shadow-lg sm:p-6"
        aria-label="Exemple de passeport de compétences"
        role="img"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink-subtle">Passeport de compétences</p>
            <p className="font-display text-lg font-semibold text-ink">
              Exemple de parcours
            </p>
          </div>
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
            Session 4 / 6
          </span>
        </div>
        <SessionSteps total={6} completed={3} current={4} className="mt-4" />
        <div className="mt-6 space-y-4">
          {rows.map((row, index) => (
            <motion.div
              key={row.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + index * 0.12, duration: 0.5 }}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink">{row.name}</span>
                <span className="text-ink-muted">{row.level}</span>
              </div>
              <LevelMeter
                value={row.value}
                min={1}
                max={row.max}
                label={`${row.name} : ${row.level}`}
              />
            </motion.div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-4 border-t border-line pt-4 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-4 rounded-[2px] bg-chart-observed"
              aria-hidden
            />
            Observé par les formateurs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-[2px] bg-chart-self" aria-hidden />
            Auto-évaluation
          </span>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute z-20 hidden sm:block sm:-right-24 sm:-bottom-16 sm:w-40"
      >
        <Image
          src="/brand/happi-mascotte-3d.webp"
          alt=""
          width={800}
          height={1000}
          className="h-auto w-full drop-shadow-xl"
          priority
        />
      </motion.div>
    </div>
  );
}
