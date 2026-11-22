import { Briefcase, Link2 } from 'lucide-react';

import { isMetierMapping, LINK_TYPES, sourceMention, type PublicSkillMapping } from '@/lib/public-frameworks/mappings';
import { cn } from '@/lib/utils';

export const PUBLIC_MAPPINGS_NOTICE = 'Correspondance validée par l’équipe HAPPI ; elle ne modifie pas le niveau observé.';

/**
 * Correspondances VALIDÉES d'une compétence avec les référentiels publics (savoir-être
 * France Travail, ESCO…), chacune avec sa source et sa version. Rien si aucune.
 */
export function PublicMappings({ mappings, skillName, className }: { mappings: PublicSkillMapping[]; skillName: string; className?: string }) {
  if (mappings.length === 0) return null;
  const skills = mappings.filter((mapping) => !isMetierMapping(mapping));
  const trades = mappings.filter(isMetierMapping);
  return (
    <section className={cn('rounded-md border border-line bg-paper px-3 py-2.5', className)} aria-label={`${skillName} dans les référentiels publics`}>
      {skills.length > 0 ? (
        <>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Link2 className="size-3.5 text-petrol-600" aria-hidden />
            Dans les référentiels publics
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {skills.map((mapping) => (
              <li key={`${mapping.source.code}-${mapping.code}`} className="leading-snug">
                <span className="font-medium text-ink">{mapping.label}</span>
                <span className="text-ink-muted"> · {LINK_TYPES[mapping.linkType].label.toLowerCase()}</span>
                <span className="block text-xs text-ink-subtle">Source : {sourceMention(mapping.source)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {trades.length > 0 ? (
        <>
          <p className={cn('flex items-center gap-1.5 text-xs font-semibold text-ink', skills.length > 0 && 'mt-3')}>
            <Briefcase className="size-3.5 text-petrol-600" aria-hidden />
            Métiers où cette compétence compte (fiches ROME)
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {trades.map((mapping) => (
              <li key={`${mapping.source.code}-${mapping.code}`} className="leading-snug">
                <span className="font-medium text-ink">{mapping.label}</span>
                <span className="block text-xs text-ink-subtle">Source : {sourceMention(mapping.source)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-1.5 text-xs text-ink-subtle">{PUBLIC_MAPPINGS_NOTICE}</p>
    </section>
  );
}
