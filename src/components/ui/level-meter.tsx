import { cn, formatScore } from '@/lib/utils';

type LevelMeterProps = {
  /** Valeur sur l'échelle (peut être décimale si la règle de calcul est une moyenne). */
  value: number | null | undefined;
  min: number;
  max: number;
  /** Seconde valeur affichée comme repère (ex. auto-évaluation). */
  marker?: number | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'observed' | 'self' | 'neutral' | 'inverse';
  /** Texte lu par les lecteurs d'écran, ex. « Coopération : niveau 3 sur 4, Maîtrise ». */
  label: string;
  className?: string;
};

const fills = {
  observed: 'bg-chart-observed',
  self: 'bg-chart-self',
  neutral: 'bg-petrol-700',
  inverse: 'bg-orange-500',
};
const tracks = {
  observed: 'bg-petrol-100',
  self: 'bg-orange-100',
  neutral: 'bg-petrol-100',
  inverse: 'bg-white/15',
};
const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };

/**
 * Jauge segmentée : un segment par niveau de l'échelle.
 * C'est la signature visuelle de HAPPI — elle remplace la note chiffrée brute
 * par une lecture « niveau atteint », à la manière d'une barre de progression de jeu.
 */
export function LevelMeter({ value, min, max, marker, size = 'md', tone = 'observed', label, className }: LevelMeterProps) {
  const segments = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const hasValue = value !== null && value !== undefined;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('flex w-full items-center gap-[3px]', className)}
      data-value={hasValue ? value : undefined}
    >
      {segments.map((segment) => {
        // Part remplie du segment : 1 si le niveau est atteint, fraction si la valeur est décimale.
        const fill = hasValue ? Math.max(0, Math.min(1, (value as number) - (segment - 1))) : 0;
        const isMarker = marker !== null && marker !== undefined && Math.round(marker) === segment;
        return (
          <span
            key={segment}
            className={cn('relative flex-1 overflow-hidden rounded-[3px]', heights[size], tracks[tone])}
          >
            <span
              className={cn('absolute inset-y-0 left-0 rounded-[3px] transition-[width] duration-500 ease-out', fills[tone])}
              style={{ width: `${fill * 100}%` }}
            />
            {isMarker ? <span className="absolute inset-x-0 -bottom-px mx-auto h-[3px] w-full bg-chart-self" /> : null}
          </span>
        );
      })}
    </div>
  );
}

/** Jauge avec son libellé de niveau et sa valeur — une ligne de « liste de jauges ». */
export function LevelMeterRow({
  name,
  value,
  min,
  max,
  levelLabel,
  tone = 'observed',
  className,
}: {
  name: string;
  value: number | null | undefined;
  min: number;
  max: number;
  levelLabel?: string | null;
  tone?: LevelMeterProps['tone'];
  className?: string;
}) {
  const hasValue = value !== null && value !== undefined;
  const reading = hasValue
    ? `${name} : ${formatScore(value)} sur ${max}${levelLabel ? `, ${levelLabel}` : ''}`
    : `${name} : pas encore observé`;
  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]', className)}>
      <span className="truncate text-[0.9375rem] font-medium text-ink">{name}</span>
      <LevelMeter value={value} min={min} max={max} tone={tone} label={reading} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
      <span className="text-right text-sm text-ink-muted tabular-nums">
        {hasValue ? (
          <>
            <span className="font-semibold text-ink">{formatScore(value)}</span>
            <span className="text-ink-subtle">/{max}</span>
            {levelLabel ? <span className="ml-2 hidden text-ink-muted md:inline">{levelLabel}</span> : null}
          </>
        ) : (
          <span className="text-ink-subtle">Non observé</span>
        )}
      </span>
    </div>
  );
}

/** Progression dans le programme : un segment par session. */
export function SessionSteps({
  total,
  completed,
  current,
  tone = 'light',
  className,
}: {
  total: number;
  completed: number;
  /** Numéro de la session en cours, le cas échéant. */
  current?: number | null;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${completed} session${completed > 1 ? 's' : ''} réalisée${completed > 1 ? 's' : ''} sur ${total}`}
      className={cn('flex w-full items-center gap-1.5', className)}
    >
      {Array.from({ length: total }, (_, index) => {
        const number = index + 1;
        const done = number <= completed;
        const active = current === number && !done;
        return (
          <span
            key={number}
            className={cn(
              'h-2.5 flex-1 rounded-[3px] transition-colors duration-500',
              tone === 'dark'
                ? done
                  ? 'bg-orange-500'
                  : active
                    ? 'bg-orange-500/45'
                    : 'bg-white/15'
                : done
                  ? 'bg-petrol-900'
                  : active
                    ? 'bg-petrol-400'
                    : 'bg-petrol-100',
            )}
          />
        );
      })}
    </div>
  );
}
