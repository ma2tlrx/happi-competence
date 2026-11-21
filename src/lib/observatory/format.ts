/**
 * Observatoire — mise en mots des constats. Module pur : chaque phrase est assemblée à partir des
 * valeurs calculées (jamais rédigée par une IA, jamais inventée), toujours avec n. Une progression est
 * un écart entre observations, jamais un « gain de formation ».
 */
import { formatScore } from '@/lib/utils';

import type { Finding } from './report';

/** Écart signé à une décimale : « +0,8 », « -2 », « 0 ». */
export function formatSigned(value: number, digits = 1): string {
  const text = formatScore(Math.abs(value), digits);
  return text === '0' ? '0' : `${value > 0 ? '+' : '-'}${text}`;
}

/** Valeur absolue en points, accordée (singulier sous 2) : « 1,8 point », « 2 points ». */
export function formatPoints(value: number): string {
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  return `${formatScore(rounded, 1)} ${rounded >= 2 ? 'points' : 'point'}`;
}

export type FindingParts = { label: string; skill: string; figure: string; detail: string };

export function findingParts(finding: Finding, scaleMax: number): FindingParts {
  switch (finding.kind) {
    case 'highest':
    case 'lowest':
      return {
        label: finding.kind === 'highest' ? 'Plus haute moyenne observée' : 'Plus basse moyenne observée',
        skill: finding.skill,
        figure: `${formatScore(finding.mean, 1)} / ${scaleMax}`,
        detail: `Moyenne observée, n = ${finding.n} personnes.`,
      };
    case 'progression':
      return {
        label: 'Plus forte progression',
        skill: finding.skill,
        figure: `${formatSigned(finding.meanDelta)} pt`,
        detail: `En moyenne, de la première à la dernière observation. ${finding.up} en hausse sur ${finding.n} personnes.`,
      };
    case 'self_gap':
      return {
        label: 'Plus grand écart du regard sur soi',
        skill: finding.skill,
        figure: `${formatSigned(finding.meanGap)} pt`,
        detail: `Les personnes se voient en moyenne ${formatPoints(finding.meanGap)} ${finding.meanGap > 0 ? 'plus haut' : 'plus bas'} que ce qui est observé (n = ${finding.n}).`,
      };
    case 'segment_gap':
      return {
        label: 'Plus grand écart entre segments',
        skill: finding.skill,
        figure: `${formatScore(finding.gap, 1)} pt`,
        detail:
          `Observé, en moyenne : « ${finding.high.label} » ${formatScore(finding.high.mean, 1)} (n = ${finding.high.n}), ` +
          `« ${finding.low.label} » ${formatScore(finding.low.mean, 1)} (n = ${finding.low.n}).` +
          (finding.overlap ? ' Marges qui se recoupent : écart à confirmer.' : ''),
      };
  }
}
