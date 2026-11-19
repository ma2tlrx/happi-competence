import { TriangleAlert } from 'lucide-react';

import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { formatCoefficient, formatCoefficientInterval, formatRate, formatRateInterval, INSUFFICIENT } from '@/lib/reliability/format';
import type { GroupStats } from '@/lib/reliability/report';
import { formatScore } from '@/lib/utils';

function Value({ main, interval }: { main: string; interval: string }) {
  return (
    <>
      <span className="block font-medium text-ink">{main}</span>
      {interval ? <span className="block text-xs whitespace-nowrap text-ink-subtle">IC 95 % {interval}</span> : null}
    </>
  );
}

/** Tableau d'accord : chaque ligne porte son effectif n ; sous le seuil, l'avertissement prime. */
export function StatsTable({ rows, label, firstColumn }: { rows: GroupStats[]; label: string; firstColumn: string }) {
  return (
    <TableWrap label={label}>
      <Table>
        <thead>
          <tr>
            <Th>{firstColumn}</Th>
            <Th>n</Th>
            <Th>Accord exact</Th>
            <Th>Accord adjacent (±1 cran)</Th>
            <Th>Kappa pondéré (quadratique)</Th>
            <Th>CCI(1,1)</Th>
            <Th>Écart moyen (second − officiel)</Th>
            <Th>Observé d’un seul côté</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, label: rowLabel, stats, observabilityMismatches }) => (
            <Tr key={id}>
              <Td className="font-medium">
                {rowLabel}
                {!stats.sufficient ? (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                    {INSUFFICIENT} (n &lt; {stats.minPairs})
                  </span>
                ) : null}
              </Td>
              <Td className="font-semibold">{stats.n}</Td>
              <Td><Value main={formatRate(stats.exact.rate)} interval={formatRateInterval(stats.exact.ci)} /></Td>
              <Td><Value main={formatRate(stats.adjacent.rate)} interval={formatRateInterval(stats.adjacent.ci)} /></Td>
              <Td>
                {stats.kappa.value === null ? (
                  <span className="text-sm text-ink-subtle">{stats.kappa.undefinedReason === 'no_variability' ? 'Non calculable (une seule catégorie utilisée)' : '—'}</span>
                ) : (
                  <Value main={formatCoefficient(stats.kappa.value)} interval={formatCoefficientInterval(stats.kappa.ci)} />
                )}
              </Td>
              <Td><Value main={formatCoefficient(stats.icc.value)} interval={formatCoefficientInterval(stats.icc.ci)} /></Td>
              <Td>{stats.meanDifference === null ? '—' : `${stats.meanDifference > 0 ? '+' : ''}${formatScore(stats.meanDifference, 2)} cran`}</Td>
              <Td>{observabilityMismatches}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
