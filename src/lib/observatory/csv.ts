/**
 * Observatoire — lignes de l'export CSV, tirées du rapport déjà masqué (src/lib/observatory/report.ts) :
 * l'export ne peut donc rien contenir que l'écran ne montre. Une ligne masquée (moins de 5 personnes)
 * porte « moins de 5 » et aucune valeur. Sérialisation et protection contre l'injection de formules :
 * toCsv (src/lib/csv.ts).
 */
import { MIN_PERSONS } from './axes';
import type { ObservatoryReport } from './report';
import type { CellView, ProgressionView, SelfGapView } from './stats';

type Cell = string | number | null;

const HIDDEN = 'moins de 5';
const percent = (count: number, n: number) => Math.round((count / n) * 100);

const NO_RESULT: Record<Exclude<ObservatoryReport['state'], 'ok'>, string> = {
  empty: 'Aucune personne observée avec ces filtres.',
  too_small: `Moins de ${MIN_PERSONS} personnes correspondent à ces filtres : rien n’est exporté.`,
  no_framework: 'Aucun référentiel publié.',
};

function cellColumns(cell: CellView, levels: number): Cell[] {
  if (cell.state === 'shown') return [cell.n, cell.mean, cell.margin, ...cell.distribution];
  return [cell.state === 'hidden' ? HIDDEN : 0, '', '', ...Array.from({ length: levels }, () => '')];
}

function progressionColumns(view: ProgressionView): Cell[] {
  if (view.state === 'shown') return [view.n, view.meanDelta, percent(view.up, view.n)];
  return [view.state === 'hidden' ? HIDDEN : 0, '', ''];
}

function selfColumns(view: SelfGapView): Cell[] {
  if (view.state === 'shown') return [view.n, view.meanGap, percent(view.higher, view.n), percent(view.lower, view.n)];
  return [view.state === 'hidden' ? HIDDEN : view.state === 'not_comparable' ? 'non comparable' : 0, '', '', ''];
}

export function observatoryCsvLines(report: ObservatoryReport, exportedOn: string): Cell[][] {
  const filters = report.axes
    .filter((axis) => axis.selected)
    .map((axis) => `${axis.label} : ${axis.options.find((option) => option.value === axis.selected)?.label ?? axis.selected}`)
    .join(' ; ');
  const lines: Cell[][] = [
    ['Observatoire des compétences — HAPPI Compétence'],
    ['Référentiel', report.framework ? `${report.framework.name} (${report.framework.versionLabel})` : 'Aucun'],
    ['Filtres', filters || 'Aucun'],
    ['Comparer par', report.compare?.label ?? 'Aucun'],
    ['Exporté le', exportedOn],
    ['Méthode', 'Une valeur par personne et par compétence, calculée comme dans le passeport (observations validées, règle du référentiel). Une personne non observée n’entre pas dans le calcul : jamais de zéro.'],
    ['Confidentialité', `Cases de moins de ${MIN_PERSONS} personnes masquées (« ${HIDDEN} »), y compris par masquage complémentaire. Aucune donnée individuelle.`],
    [],
  ];
  if (report.state !== 'ok' || !report.framework) {
    lines.push(['Aucun résultat', NO_RESULT[report.state === 'ok' ? 'no_framework' : report.state]]);
    return lines;
  }

  const levels = report.framework.levels;
  lines.push([
    'Compétence',
    'Catégorie',
    'Segment',
    'Personnes (n)',
    'Moyenne',
    'Marge à 95 % (±)',
    ...levels.map((level) => `${level.label} (niveau ${level.value}) : personnes`),
    'Progression : personnes (n)',
    'Progression : écart moyen (points)',
    'Progression : en hausse (%)',
    'Regard sur soi : personnes (n)',
    'Regard sur soi : écart moyen (points)',
    'Se voient plus haut (%)',
    'Se voient plus bas (%)',
  ]);
  const blank = (count: number) => Array.from({ length: count }, () => '');
  for (const skill of report.skills) {
    // Une ligne masquée ou vide reste entièrement vide : sa progression et son regard sur soi portent sur encore moins de personnes.
    const overall = skill.overall.state === 'shown' ? [...cellColumns(skill.overall, levels.length), ...progressionColumns(skill.progression), ...selfColumns(skill.selfGap)] : [...cellColumns(skill.overall, levels.length), ...blank(7)];
    lines.push([skill.name, skill.category ?? '', 'Ensemble', ...overall]);
    report.segments.forEach((segment, index) => {
      lines.push([skill.name, skill.category ?? '', `${report.compare!.label} : ${segment.label}`, ...cellColumns(skill.segments[index]!, levels.length), ...blank(7)]);
    });
  }
  return lines;
}
