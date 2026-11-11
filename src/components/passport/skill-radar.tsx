'use client';

import { Table2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';

import { cn, formatScore } from '@/lib/utils';

export type RadarDatum = { name: string; observed: number | null; self: number | null };

const OBSERVED = '#00819b';
const SELF = '#ea632e';

function shortLabel(name: string, compact: boolean) {
  if (!compact || name.length <= 14) return name;
  return `${name.slice(0, 13).trimEnd()}…`;
}

/** Coupe un libellé long en deux lignes, à l'espace (ou au trait d'union) le plus proche du milieu. */
function splitLabel(name: string): string[] {
  if (name.length <= 14) return [name];
  const middle = name.length / 2;
  let cut = -1;
  for (let index = 1; index < name.length - 1; index += 1) {
    const breakable = name[index] === ' ' || name[index - 1] === '-';
    if (breakable && (cut === -1 || Math.abs(index - middle) < Math.abs(cut - middle))) cut = index;
  }
  if (cut === -1) return [name];
  return [name.slice(0, cut).trimEnd(), name.slice(cut).trimStart()];
}

type AngleTickProps = { x?: number | string; y?: number | string; cy?: number | string; textAnchor?: string; payload?: { value?: string } };

/** Libellé d'axe sur une ou deux lignes : aucun nom de compétence n'est tronqué. */
function WrappedTick({ x = 0, y = 0, cy, textAnchor, payload, fontSize = 12 }: AngleTickProps & { fontSize?: number }) {
  const lines = splitLabel(String(payload?.value ?? ''));
  const px = Number(x);
  const py = Number(y);
  const above = cy !== undefined && py < Number(cy) - 40;
  // Un libellé sur deux lignes s'écarte du graphique en haut, et se centre sur son axe ailleurs
  // (il ne déborde ainsi ni sur le tracé ni sur le libellé voisin).
  const first = lines.length > 1 ? (above ? -12 : -6) : 0;
  return (
    <text x={px} y={py} textAnchor={textAnchor as 'start' | 'middle' | 'end' | undefined} fill="#4b6166" fontSize={fontSize} fontFamily="var(--font-dm-sans)">
      {lines.map((line, index) => (
        <tspan key={line} x={px} dy={index === 0 ? first : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Radar des compétences : observations des formateurs (et auto-évaluation si comparable).
 * Les compétences non observées sont tracées à 0 et signalées comme telles ; un tableau
 * équivalent est disponible pour les lecteurs d'écran et la lecture précise.
 */
export function SkillRadar({
  data,
  min,
  max,
  showSelf,
  height = 360,
  compact = false,
  wrapLabels = false,
  title,
}: {
  data: RadarDatum[];
  min: number;
  max: number;
  showSelf: boolean;
  height?: number;
  compact?: boolean;
  /** Écrit les libellés longs sur deux lignes au lieu de les tronquer (prévoir de la place autour du graphique). */
  wrapLabels?: boolean;
  title: string;
}) {
  const [table, setTable] = useState(false);
  // Sur un écran étroit, les libellés passent sur deux lignes et le tracé se resserre
  // pour qu'aucun nom de compétence ne soit coupé par le bord.
  const box = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setNarrow((entry?.contentRect.width ?? 999) < 480));
    observer.observe(node);
    return () => observer.disconnect();
  }, [table]);
  const wrap = wrapLabels || narrow;
  const chartData = data.map((datum) => ({ ...datum, observedPlot: datum.observed ?? 0, selfPlot: datum.self ?? 0 }));
  const hasObserved = data.some((datum) => datum.observed !== null);

  return (
    <figure className="w-full">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted" aria-hidden={table}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-chart-observed" />
            Observé par les formateurs
          </span>
          {showSelf ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-chart-self" />
              Mon auto-évaluation
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setTable((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm font-medium text-petrol-700 hover:bg-petrol-50"
          aria-pressed={table}
        >
          <Table2 className="size-4" aria-hidden />
          {table ? 'Voir le graphique' : 'Voir en tableau'}
        </button>
      </div>

      {table ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th scope="col" className="py-2 font-semibold">Compétence</th>
              <th scope="col" className="py-2 text-right font-semibold">Observé</th>
              {showSelf ? <th scope="col" className="py-2 text-right font-semibold">Auto-évaluation</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.name} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 font-medium text-ink">{datum.name}</th>
                <td className="py-2 text-right tabular-nums">{datum.observed === null ? 'Non observé' : `${formatScore(datum.observed)} / ${max}`}</td>
                {showSelf ? <td className="py-2 text-right tabular-nums">{datum.self === null ? '—' : `${datum.self} / ${max}`}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={box} className={cn('relative w-full', !hasObserved && 'opacity-90')} style={{ height }} role="img" aria-label={`${title}. Utilisez « Voir en tableau » pour lire les valeurs.`}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius={narrow ? '54%' : wrap ? '62%' : compact ? '68%' : '72%'} margin={{ top: 8, right: narrow ? 8 : 24, bottom: 8, left: narrow ? 8 : 24 }}>
              <PolarGrid stroke="#e5e5e0" />
              {wrap ? (
                <PolarAngleAxis dataKey="name" tick={(props: AngleTickProps) => <WrappedTick {...props} fontSize={narrow ? 10 : 12} />} />
              ) : (
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fill: '#4b6166', fontSize: compact ? 11 : 12, fontFamily: 'var(--font-dm-sans)' }}
                  tickFormatter={(value: string) => shortLabel(value, compact)}
                />
              )}
              <PolarRadiusAxis domain={[0, max]} tickCount={max + 1} tick={false} axisLine={false} />
              {showSelf ? (
                <Radar name="Mon auto-évaluation" dataKey="selfPlot" stroke={SELF} strokeWidth={2} fill={SELF} fillOpacity={0.08} dot={{ r: 3, fill: SELF, strokeWidth: 0 }} isAnimationActive animationDuration={900} />
              ) : null}
              <Radar name="Observé par les formateurs" dataKey="observedPlot" stroke={OBSERVED} strokeWidth={2} fill={OBSERVED} fillOpacity={0.14} dot={{ r: 3.5, fill: OBSERVED, strokeWidth: 0 }} isAnimationActive animationDuration={900} animationBegin={150} />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const datum = payload[0]!.payload as RadarDatum;
                  return (
                    <div className="rounded-md border border-line bg-white px-3 py-2 text-sm shadow-md">
                      <p className="font-semibold text-ink">{datum.name}</p>
                      <p className="mt-1 flex items-center gap-2 text-ink-muted">
                        <span className="h-0.5 w-3 bg-chart-observed" aria-hidden />
                        <span className="font-semibold text-ink">{datum.observed === null ? 'Non observé' : `${formatScore(datum.observed)} / ${max}`}</span>
                      </p>
                      {showSelf ? (
                        <p className="flex items-center gap-2 text-ink-muted">
                          <span className="h-0.5 w-3 bg-chart-self" aria-hidden />
                          <span className="font-semibold text-ink">{datum.self === null ? '—' : `${datum.self} / ${max}`}</span>
                          auto-évaluation
                        </p>
                      ) : null}
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
          {!hasObserved ? (
            <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm font-medium text-ink-muted">
              Les observations apparaîtront ici après votre première session évaluée.
            </p>
          ) : null}
        </div>
      )}
      <p className="mt-2 text-xs text-ink-subtle">Échelle de {min} à {max}. Une compétence non observée est placée au centre.</p>
    </figure>
  );
}
