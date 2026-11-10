'use client';

import { Table2 } from 'lucide-react';
import { useState } from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';

import { cn, formatScore } from '@/lib/utils';

export type RadarDatum = { name: string; observed: number | null; self: number | null };

const OBSERVED = '#00819b';
const SELF = '#ea632e';

function shortLabel(name: string, compact: boolean) {
  if (!compact || name.length <= 14) return name;
  return `${name.slice(0, 13).trimEnd()}…`;
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
  title,
}: {
  data: RadarDatum[];
  min: number;
  max: number;
  showSelf: boolean;
  height?: number;
  compact?: boolean;
  title: string;
}) {
  const [table, setTable] = useState(false);
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
        <div className={cn('relative w-full', !hasObserved && 'opacity-90')} style={{ height }} role="img" aria-label={`${title}. Utilisez « Voir en tableau » pour lire les valeurs.`}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius={compact ? '68%' : '72%'} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
              <PolarGrid stroke="#e5e5e0" />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fill: '#4b6166', fontSize: compact ? 11 : 12, fontFamily: 'var(--font-dm-sans)' }}
                tickFormatter={(value: string) => shortLabel(value, compact)}
              />
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
