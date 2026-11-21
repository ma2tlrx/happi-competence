import Link from 'next/link';

import { Tooltip } from '@/components/ui/overlays';
import type { CollectionGroup } from '@/lib/engagement/journey';
import { cn } from '@/lib/utils';

/**
 * Album des compétences : une case par compétence du référentiel, révélée dès la première
 * observation validée de vos formateurs. Le niveau n'apparaît pas ici : l'album compte ce qui a été
 * vu, la jauge de chaque fiche dit à quel niveau. Une case vide signifie « pas encore observée ».
 */
export function SkillCollection({ groups, size = 'md' }: { groups: CollectionGroup[]; size?: 'md' | 'lg' }) {
  const cell = size === 'lg' ? 'size-10 sm:size-11' : 'size-8 sm:size-9';
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.code} aria-labelledby={`album-${group.code}`}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 id={`album-${group.code}`} className="text-[0.9375rem] font-semibold text-ink">
              {group.name}
            </h3>
            <span className="text-sm text-ink-muted tabular-nums">
              {group.revealed} / {group.skills.length}
            </span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {group.skills.map((skill) => {
              const state = skill.revealed ? (skill.progressed ? 'révélée, en progression' : 'révélée') : 'à découvrir';
              return (
                <li key={skill.code}>
                  <Tooltip
                    content={
                      <>
                        <span className="font-semibold">{skill.name}</span>
                        <span className="block text-white/75">{skill.revealed ? (skill.progressed ? 'Révélée · en progression' : 'Révélée') : 'À découvrir'}</span>
                      </>
                    }
                  >
                    <Link
                      href={skill.href}
                      aria-label={`${skill.name} : ${state}`}
                      className={cn(
                        'pixel-corners relative block transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5',
                        cell,
                        skill.revealed ? 'bg-petrol-700 hover:bg-petrol-600' : 'bg-white shadow-[inset_0_0_0_2px_var(--color-petrol-300)] hover:bg-petrol-50',
                      )}
                    >
                      {skill.revealed ? <span aria-hidden className="absolute inset-x-1.5 top-1.5 h-1 rounded-full bg-white/15" /> : null}
                      {skill.progressed ? <span aria-hidden className="absolute right-1 bottom-1 size-2 rounded-[2px] bg-orange-400" /> : null}
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="pixel-corners pixel-corners-sm inline-block size-3.5 bg-petrol-700" />
          Révélée
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="pixel-corners pixel-corners-sm relative inline-block size-3.5 bg-petrol-700">
            <span className="absolute right-0.5 bottom-0.5 size-1.5 rounded-[1px] bg-orange-400" />
          </span>
          En progression
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="pixel-corners pixel-corners-sm inline-block size-3.5 bg-white shadow-[inset_0_0_0_1.5px_var(--color-petrol-300)]" />
          À découvrir
        </span>
      </p>
    </div>
  );
}
