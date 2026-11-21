import { Check, Minus, X } from 'lucide-react';

import { PRESENCE_LABELS, PRESENCE_LEGEND, type PresenceCell, type PresenceEntry } from '@/lib/organisme/groups';
import { cn, formatShortDate } from '@/lib/utils';

/**
 * Cases de présence, même grammaire que la carte du parcours du participant : orange = séance suivie,
 * pétrole = séance manquée (sans rouge, sans reproche). Chaque état a aussi sa forme (coche, moitié,
 * croix, tiret, pointillés) : la couleur n'est jamais la seule information.
 */
const CELL_STYLE: Record<PresenceCell, string> = {
  present: 'bg-orange-500 text-petrol-950',
  partial: 'bg-[linear-gradient(135deg,var(--color-orange-500)_50%,var(--color-orange-200)_50%)]',
  absent: 'bg-petrol-800 text-white',
  excused: 'border border-petrol-300 bg-petrol-100 text-petrol-700',
  unknown: 'border border-dashed border-ink-subtle bg-white',
};

function Glyph({ cell }: { cell: PresenceCell }) {
  if (cell === 'present') return <Check className="size-3.5" strokeWidth={3} />;
  if (cell === 'absent') return <X className="size-3.5" strokeWidth={3} />;
  if (cell === 'excused') return <Minus className="size-3.5" strokeWidth={3} />;
  return null;
}

export function PresenceSquare({ cell, className }: { cell: PresenceCell; className?: string }) {
  return (
    <span aria-hidden className={cn('pixel-corners pixel-corners-sm flex size-6 shrink-0 items-center justify-center', CELL_STYLE[cell], className)}>
      <Glyph cell={cell} />
    </span>
  );
}

/** Une case par séance terminée ; le détail (séance, date, statut) est lu par les lecteurs d'écran et au survol. */
export function PresenceTrail({ entries, name }: { entries: PresenceEntry[]; name: string }) {
  if (entries.length === 0) return <p className="text-sm text-ink-subtle">Pas encore de séance terminée</p>;
  return (
    <ol aria-label={`Présence de ${name}`} className="flex flex-wrap gap-1.5">
      {entries.map((entry) => {
        const text = `Séance ${entry.number}${entry.date ? ` (${formatShortDate(entry.date)})` : ''} : ${PRESENCE_LABELS[entry.cell]}`;
        return (
          <li key={entry.sessionId} title={text}>
            <PresenceSquare cell={entry.cell} />
            <span className="sr-only">{text}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function PresenceLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="Légende des cases de présence" className={cn('flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted', className)}>
      {PRESENCE_LEGEND.map((item) => (
        <li key={item.cell} className="flex items-center gap-1.5">
          <PresenceSquare cell={item.cell} className="size-5 [&_svg]:size-3" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
