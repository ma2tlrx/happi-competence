'use client';

import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Graphiques sobres du tableau de bord d'impact. Deux couleurs seulement (pétrole #00819b et
 * orange #ea632e, distinguables en daltonisme) ; chaque barre porte sa valeur en clair, et un
 * tableau accessible reprend les mêmes données à côté de chaque graphique (le graphique est décoratif
 * pour les lecteurs d'écran).
 */
const PETROL = '#00819b';
const ORANGE = '#ea632e';
const NEUTRAL = '#a5c3c9';

export type SituationDatum = { label: string; count: number; missing?: boolean };

/** Répartition des situations d'un moment du parcours ; « Non renseigné » est une barre distincte. */
export function SituationChart({ data, title }: { data: SituationDatum[]; title: string }) {
  const rows = data.map((row) => ({ ...row, recorded: row.missing ? null : row.count, notRecorded: row.missing ? row.count : null }));
  return (
    <figure aria-hidden className="min-w-0">
      <figcaption className="mb-2 text-sm font-semibold text-ink">{title}</figcaption>
      <div style={{ height: Math.max(160, rows.length * 30 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="#e5e5e0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#4b6166' }} />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: '#102c32' }} />
            <Tooltip cursor={{ fill: '#f1f6f7' }} />
            <Bar dataKey="recorded" name="Renseigné" fill={PETROL} stackId="a" isAnimationActive={false}>
              <LabelList dataKey="recorded" position="right" style={{ fontSize: 12, fill: '#102c32' }} />
            </Bar>
            <Bar dataKey="notRecorded" name="Non renseigné" fill={NEUTRAL} stroke="#4b6166" strokeDasharray="3 2" stackId="a" isAnimationActive={false}>
              <LabelList dataKey="notRecorded" position="right" style={{ fontSize: 12, fill: '#102c32' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export type CohortDatum = { name: string; attendance: number | null; dropRate: number | null };

/** Assiduité et taux d'abandon par cohorte (en %). Une valeur manquante n'est pas tracée (et non mise à zéro). */
export function CohortChart({ data }: { data: CohortDatum[] }) {
  const percent = (value: unknown) => (typeof value === 'number' ? `${Math.round(value)} %` : '');
  return (
    <figure aria-hidden className="min-w-0">
      <div style={{ height: Math.max(200, data.length * 56 + 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="#e5e5e0" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value} %`} tick={{ fontSize: 12, fill: '#4b6166' }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#102c32' }} />
            <Tooltip formatter={(value) => percent(value)} cursor={{ fill: '#f1f6f7' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="attendance" name="Assiduité" fill={PETROL} isAnimationActive={false}>
              <LabelList dataKey="attendance" position="right" formatter={percent} style={{ fontSize: 12, fill: '#102c32' }} />
            </Bar>
            <Bar dataKey="dropRate" name="Abandons" fill={ORANGE} isAnimationActive={false}>
              <LabelList dataKey="dropRate" position="right" formatter={percent} style={{ fontSize: 12, fill: '#102c32' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
