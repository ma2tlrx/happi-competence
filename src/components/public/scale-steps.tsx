'use client';

import { motion } from 'motion/react';

// Dégradé séquentiel pétrole : du niveau le plus bas (clair) au plus haut (foncé).
const RAMP = ['#cadce0', '#a5c3c9', '#76a3ac', '#2f6873', '#102c32'];

/** Une échelle de niveaux dessinée en marches : une marche par niveau, avec son libellé officiel. */
export function ScaleSteps({ levels, label }: { levels: { value: number; label: string }[]; label: string }) {
  const count = levels.length;
  return (
    <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }} aria-label={label}>
      {levels.map((level, index) => {
        const ratio = count > 1 ? index / (count - 1) : 1;
        return (
          <li key={level.value} className="min-w-0">
            <span className="flex h-[5.5rem] items-end" aria-hidden>
              <motion.span
                className="block w-full origin-bottom rounded-t-[4px]"
                style={{ height: `${22 + ratio * 78}%`, backgroundColor: RAMP[Math.round(ratio * (RAMP.length - 1))] }}
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            <span className="mt-2 block border-t border-line-strong pt-2 font-mono text-sm font-medium text-ink tabular-nums">{level.value}</span>
            <span className="block text-sm leading-snug text-ink-muted">{level.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
