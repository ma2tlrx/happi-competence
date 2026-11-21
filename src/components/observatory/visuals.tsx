'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { SessionPoint } from '@/lib/observatory/report';
import { cn, formatScore } from '@/lib/utils';

/**
 * Visuels de l'observatoire. Une seule teinte (pétrole), du clair au foncé : niveaux de l'échelle et
 * moyennes. Rampe vérifiée avec le validateur du skill dataviz (ordre monotone, écarts visibles,
 * extrémité claire ≥ 2:1 sur fond blanc) ; texte en encre sur les deux premières classes, en blanc
 * ensuite (contraste ≥ 4,5:1 partout). Ni rouge ni vert : aucun niveau n'est « bon » ou « mauvais ».
 */
export const RAMP = ['#94b7bd', '#6c9ca5', '#2f6873', '#1d4750', '#0a1e22'] as const;
const INK_ON = new Set([0, 1]);

/** Teintes pour k niveaux, réparties sur la rampe (4 niveaux : 1re, 2e, 3e et 5e teinte, elles aussi validées). */
export function rampFor(count: number): string[] {
  if (count <= 1) return [RAMP[2]];
  return Array.from({ length: count }, (_, index) => RAMP[Math.round((index * (RAMP.length - 1)) / (count - 1))]!);
}

/** Classe (0 à 4) d'une moyenne sur l'échelle : la carte de chaleur utilise 5 classes fixes. */
export function heatClass(mean: number, min: number, max: number) {
  const t = max > min ? (mean - min) / (max - min) : 0;
  return Math.min(RAMP.length - 1, Math.max(0, Math.floor(t * RAMP.length)));
}

export function heatColors(mean: number, min: number, max: number) {
  const index = heatClass(mean, min, max);
  return { background: RAMP[index]!, color: INK_ON.has(index) ? '#102c32' : '#ffffff' };
}

/** Bornes affichées de chaque classe de la carte de chaleur. */
export function heatLegend(min: number, max: number) {
  const step = (max - min) / RAMP.length;
  return RAMP.map((color, index) => ({ color, from: min + index * step, to: min + (index + 1) * step }));
}

/**
 * Distribution par niveau : une barre en cases, une case par niveau, largeur proportionnelle à
 * l'effectif, séparées par 2 px de fond. Le détail est donné en texte (infobulle et lecteur d'écran).
 */
export function DistributionBar({ distribution, levels, className }: { distribution: number[]; levels: { value: number; label: string }[]; className?: string }) {
  const total = distribution.reduce((sum, count) => sum + count, 0);
  const colors = rampFor(levels.length);
  const text = levels.map((level, index) => `${level.label} : ${distribution[index] ?? 0}`).join(', ');
  return (
    <div role="img" aria-label={`Répartition par niveau (${total} personnes) : ${text}`} title={text} className={cn('flex h-3 w-full min-w-24 gap-[2px] overflow-hidden', className)}>
      {levels.map((level, index) => {
        const count = distribution[index] ?? 0;
        if (count === 0) return null;
        return <span key={level.value} className="h-full rounded-[2px] first:rounded-l-[4px] last:rounded-r-[4px]" style={{ flexGrow: count, flexBasis: 0, background: colors[index] }} />;
      })}
    </div>
  );
}

/** Légende des niveaux (toujours présente avec la barre de distribution). */
export function LevelLegend({ levels, className }: { levels: { value: number; label: string }[]; className?: string }) {
  const colors = rampFor(levels.length);
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted', className)}>
      {levels.map((level, index) => (
        <li key={level.value} className="flex items-center gap-1.5">
          <span aria-hidden className="pixel-corners pixel-corners-sm inline-block size-3" style={{ background: colors[index] }} />
          <span className="font-semibold text-ink tabular-nums">{level.value}</span> {level.label}
        </li>
      ))}
    </ul>
  );
}

/** Courbe de la moyenne observée par numéro de session ; les points masqués ou vides ne sont pas tracés. */
export function SessionCurve({ points, min, max }: { points: SessionPoint[]; min: number; max: number }) {
  const data = points.map((point) => ({ session: `S${point.session}`, mean: point.state === 'shown' ? point.mean : null, n: point.state === 'shown' ? point.n : null }));
  return (
    <figure aria-hidden className="min-w-0">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="#e5e5e0" />
            <XAxis dataKey="session" tick={{ fontSize: 12, fill: '#4b6166' }} tickLine={false} axisLine={{ stroke: '#d3d3cb' }} />
            <YAxis domain={[min, max]} allowDecimals={false} tick={{ fontSize: 12, fill: '#4b6166' }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: '#a5c3c9' }}
              formatter={(value, _name, item) => [`${formatScore(Number(value), 1)} (n = ${(item.payload as { n: number }).n})`, 'Moyenne observée']}
            />
            <Line type="linear" dataKey="mean" stroke="#00819b" strokeWidth={2} dot={{ r: 4, fill: '#00819b', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
