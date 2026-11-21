'use client';

import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Download, Link2, LoaderCircle, RotateCcw, SlidersHorizontal, Telescope, X } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Notice, ProvisionalBadge, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { Dialog, DialogContent, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { AXIS_KEYS, AXIS_LABELS, observatorySearch, type AxisKey, type ObservatoryFilters } from '@/lib/observatory/axes';
import { findingParts, formatSigned } from '@/lib/observatory/format';
import type { ObservatoryReport, SkillReport } from '@/lib/observatory/report';
import type { CellView } from '@/lib/observatory/stats';
import { cn, formatScore } from '@/lib/utils';

import { DistributionBar, heatColors, heatLegend, LevelLegend, SessionCurve } from './visuals';

const HIDDEN_TEXT = 'moins de 5';
const STRUCTURE_AXES: AxisKey[] = ['organisme', 'ville', 'programme', 'cohorte', 'annee'];
const PROFILE_AXES: AxisKey[] = ['age', 'genre', 'diplome', 'situation', 'qpv'];

type Report = ObservatoryReport & { framework: NonNullable<ObservatoryReport['framework']> };
type Sort = 'ordre' | 'moyenne' | 'progression' | 'regard';

/** Moyenne avec sa marge : « 3,4 ± 0,3 ». */
function meanText(cell: Extract<CellView, { state: 'shown' }>) {
  return `${formatScore(cell.mean, 1)} ± ${formatScore(cell.margin, 1)}`;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-sm text-ink-subtle">{children}</span>;
}

// ── En-tête ──────────────────────────────────────────────────────────────────
function Header({ report }: { report: ObservatoryReport }) {
  const summary = report.summary;
  const progression = summary?.progression;
  const selfGap = summary?.selfGap;
  const tiles: { label: string; value: string; detail: string }[] = summary
    ? [
        { label: 'personnes observées', value: String(summary.persons), detail: 'au moins une observation validée' },
        { label: 'observations validées', value: String(summary.observations), detail: `n = ${summary.persons} personnes` },
        {
          label: 'des progressions en hausse',
          value: progression?.state === 'shown' ? `${Math.round(progression.upShare * 100)} %` : progression?.state === 'hidden' ? HIDDEN_TEXT : '—',
          detail: progression?.state === 'shown' ? `n = ${progression.pairs} compétences suivies deux fois, ${progression.persons} personnes` : 'compétences suivies deux fois',
        },
        {
          label: 'écart moyen du regard sur soi',
          value: selfGap?.state === 'shown' ? `${formatSigned(selfGap.meanGap)} pt` : selfGap?.state === 'hidden' ? HIDDEN_TEXT : selfGap?.state === 'not_comparable' ? 'non comparable' : '—',
          detail:
            selfGap?.state === 'shown'
              ? `auto-évaluation − observé, n = ${selfGap.pairs} réponses, ${selfGap.persons} personnes`
              : selfGap?.state === 'not_comparable'
                ? 'échelles différentes'
                : 'auto-évaluation − observé',
        },
      ]
    : [];
  return (
    <section aria-labelledby="observatoire-titre" className="pixel-grid mb-4 rounded-xl bg-petrol-900 p-5 text-white sm:p-7">
      <div className="flex items-start gap-4">
        <span aria-hidden className="pixel-corners hidden size-12 shrink-0 items-center justify-center bg-orange-500 text-petrol-950 sm:flex">
          <Telescope className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 id="observatoire-titre" className="font-display text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[1.875rem]">
            Observatoire des compétences
          </h1>
          <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-white/75">
            Les résultats observés de tous les participants, compétence par compétence. Aucun résultat individuel : sous 5 personnes, rien ne s’affiche.
          </p>
        </div>
      </div>
      {tiles.length ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col rounded-lg bg-white/[0.06] p-3.5 ring-1 ring-white/10 sm:p-4">
              <dt className="order-2 mt-1 text-sm leading-snug text-white/80">{tile.label}</dt>
              <dd className="order-1 font-display text-2xl leading-none font-semibold text-white tabular-nums sm:text-[1.75rem]">{tile.value}</dd>
              <dd className="order-3 mt-1.5 text-xs leading-snug text-white/60">{tile.detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

// ── Barre de filtres ─────────────────────────────────────────────────────────
function FilterBar({ report, pending, onChange, exportHref }: { report: ObservatoryReport; pending: boolean; onChange: (next: ObservatoryFilters) => void; exportHref: string }) {
  const { filters } = report;
  const active = report.axes.filter((axis) => axis.selected);
  const setValue = (key: AxisKey, value: string) => {
    const values = { ...filters.values };
    if (value) values[key] = value;
    else delete values[key];
    onChange({ ...filters, values });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Lien copié : il ouvre l’observatoire avec ces filtres.');
    } catch {
      toast.error('Copie impossible : copiez l’adresse de la page.');
    }
  };
  const control = 'h-10 w-full rounded-md border border-line-strong bg-white px-3 text-[0.9375rem] text-ink focus-visible:outline-2 focus-visible:outline-orange-500';
  const axisSelect = (key: AxisKey) => {
    const axis = report.axes.find((item) => item.key === key)!;
    const id = `observatoire-${key}`;
    return (
      <div key={key} className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {axis.label}
        </label>
        <select id={id} value={axis.selected ?? ''} onChange={(event) => setValue(key, event.target.value)} className={control} disabled={pending}>
          <option value="">Tous</option>
          {axis.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count ?? HIDDEN_TEXT})
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="z-10 mb-6 border-b border-line bg-paper/95 py-3 backdrop-blur-sm sm:sticky sm:top-16">
      <div className="flex flex-wrap items-center gap-2">
        {report.frameworks.length > 1 ? (
          <div role="group" aria-label="Référentiel" className="inline-flex rounded-md border border-line-strong bg-white p-0.5">
            {report.frameworks.map((framework) => (
              <button
                key={framework.code}
                type="button"
                aria-pressed={framework.code === filters.framework}
                onClick={() => framework.code !== filters.framework && onChange({ ...filters, framework: framework.code })}
                className={cn(
                  'min-h-9 rounded-sm px-3 text-sm font-semibold transition-colors',
                  framework.code === filters.framework ? 'bg-petrol-900 text-white' : 'text-ink-muted hover:bg-petrol-50 hover:text-ink',
                )}
                title={framework.name}
              >
                {framework.shortName}
              </button>
            ))}
          </div>
        ) : null}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-h-9">
              <SlidersHorizontal aria-hidden />
              Filtrer{active.length ? ` (${active.length})` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(40rem,calc(100vw-2rem))] p-4">
            <p className="text-sm text-ink-muted">Le nombre entre parenthèses compte les personnes observées, compte tenu des autres filtres.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 font-display text-sm font-semibold text-ink">Structure et parcours</legend>
                {STRUCTURE_AXES.map(axisSelect)}
              </fieldset>
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 font-display text-sm font-semibold text-ink">Fiche d’entrée</legend>
                {PROFILE_AXES.map(axisSelect)}
              </fieldset>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <label htmlFor="observatoire-comparer" className="text-sm font-semibold text-ink">
            Comparer par
          </label>
          <select
            id="observatoire-comparer"
            value={filters.compare ?? ''}
            onChange={(event) => onChange({ ...filters, compare: (event.target.value || null) as AxisKey | null })}
            className="h-9 rounded-md border border-line-strong bg-white px-2.5 text-sm font-normal text-ink focus-visible:outline-2 focus-visible:outline-orange-500"
            disabled={pending}
          >
            <option value="">Aucun axe</option>
            {AXIS_KEYS.map((key) => (
              <option key={key} value={key}>
                {AXIS_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        {pending ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Calcul…
          </span>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="min-h-9" onClick={() => onChange({ framework: filters.framework, values: {}, compare: null })} disabled={pending || (!active.length && !filters.compare)}>
            <RotateCcw aria-hidden />
            Réinitialiser
          </Button>
          <Button variant="ghost" size="sm" className="min-h-9" onClick={copyLink}>
            <Link2 aria-hidden />
            Copier le lien
          </Button>
          <Button asChild variant="primary" size="sm" className="min-h-9">
            <a href={exportHref} download>
              <Download aria-hidden />
              Exporter (CSV)
            </a>
          </Button>
        </div>
      </div>
      {active.length ? (
        <ul aria-label="Filtres actifs" className="mt-2.5 flex flex-wrap gap-2">
          {active.map((axis) => (
            <li key={axis.key}>
              <button
                type="button"
                onClick={() => setValue(axis.key, '')}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-petrol-200 bg-petrol-50 px-3 text-sm text-petrol-800 hover:border-petrol-400"
                aria-label={`Retirer le filtre ${axis.label} : ${axis.options.find((option) => option.value === axis.selected)?.label ?? ''}`}
              >
                {axis.label} : {axis.options.find((option) => option.value === axis.selected)?.label ?? axis.selected}
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── Ce qui ressort ───────────────────────────────────────────────────────────
function Findings({ report, onOpen }: { report: Report; onOpen: (code: string) => void }) {
  return (
    <section aria-labelledby="constats-titre" className="mb-8">
      <h2 id="constats-titre" className="text-title">
        Ce qui ressort
      </h2>
      {report.findings.length ? (
        <ul className="mt-3 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          {report.findings.map((finding) => {
            const parts = findingParts(finding, report.framework.scaleMax);
            return (
              <li key={finding.kind} className="border-l-2 border-petrol-300 pl-4">
                <p className="text-sm text-ink-muted">{parts.label}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-[1.75rem] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">{parts.figure}</span>
                  <button type="button" onClick={() => onOpen(finding.code)} className="text-left font-semibold text-petrol-700 underline-offset-4 hover:underline">
                    {parts.skill}
                  </button>
                </p>
                <p className="mt-1.5 text-sm text-ink-subtle">{parts.detail}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">Pas assez de personnes par compétence pour dégager un constat.</p>
      )}
    </section>
  );
}

// ── Tableau des compétences ──────────────────────────────────────────────────
function sortValue(skill: SkillReport, sort: Sort): number | null {
  if (sort === 'moyenne') return skill.overall.state === 'shown' ? skill.overall.mean : null;
  if (sort === 'progression') return skill.progression.state === 'shown' ? skill.progression.meanDelta : null;
  if (sort === 'regard') return skill.selfGap.state === 'shown' ? skill.selfGap.meanGap : null;
  return null;
}

function SortHeader({ label, value, sort, onSort, className }: { label: string; value: Sort; sort: Sort; onSort: (sort: Sort) => void; className?: string }) {
  const activeSort = sort === value;
  return (
    <Th aria-sort={activeSort ? (value === 'ordre' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button type="button" onClick={() => onSort(value)} className={cn('inline-flex min-h-8 items-center gap-1', activeSort && 'text-ink')}>
        {label}
        {activeSort && value !== 'ordre' ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />}
      </button>
    </Th>
  );
}

function Trend({ value }: { value: number }) {
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : ArrowRight;
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-ink tabular-nums">
      <Icon className="size-3.5 text-petrol-500" aria-hidden />
      {formatSigned(value)}
    </span>
  );
}

function SkillsTable({ report, onOpen }: { report: Report; onOpen: (code: string) => void }) {
  const [sort, setSort] = useState<Sort>('ordre');
  const rows =
    sort === 'ordre'
      ? report.skills
      : [...report.skills].sort((a, b) => {
          const va = sortValue(a, sort);
          const vb = sortValue(b, sort);
          if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
          return vb - va;
        });
  return (
    <section aria-labelledby="competences-titre">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="competences-titre" className="text-title">
          Compétence par compétence
        </h2>
        <LevelLegend levels={report.framework.levels} />
      </div>
      <div className="rounded-lg border border-line bg-white">
        <TableWrap label="Résultats par compétence">
          <Table>
            <caption className="sr-only">Résultats observés par compétence : répartition par niveau, moyenne avec marge à 95 %, progression et regard sur soi, avec l’effectif n.</caption>
            <thead>
              <tr>
                <SortHeader label="Compétence" value="ordre" sort={sort} onSort={setSort} />
                <Th className="min-w-40">Répartition par niveau</Th>
                <SortHeader label="Moyenne" value="moyenne" sort={sort} onSort={setSort} />
                <SortHeader label="Progression" value="progression" sort={sort} onSort={setSort} />
                <SortHeader label="Regard sur soi" value="regard" sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((skill) => (
                <Tr key={skill.code}>
                  <Th scope="row" className="border-b-0 bg-transparent font-normal whitespace-normal text-ink">
                    <button type="button" onClick={() => onOpen(skill.code)} className="min-h-8 text-left font-semibold text-petrol-800 underline-offset-4 hover:underline">
                      {skill.name}
                    </button>
                    {skill.category ? <span className="block text-sm text-ink-subtle">{skill.category}</span> : null}
                  </Th>
                  {skill.overall.state === 'shown' ? (
                    <>
                      <Td>
                        <DistributionBar distribution={skill.overall.distribution} levels={report.framework.levels} />
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="font-semibold tabular-nums">{meanText(skill.overall)}</span>
                        <span className="block text-sm text-ink-subtle">n = {skill.overall.n}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {skill.progression.state === 'shown' ? (
                          <>
                            <Trend value={skill.progression.meanDelta} />
                            <span className="block text-sm text-ink-subtle">
                              {skill.progression.up} en hausse, n = {skill.progression.n}
                            </span>
                          </>
                        ) : (
                          <Muted>{skill.progression.state === 'hidden' ? HIDDEN_TEXT : 'une seule observation'}</Muted>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {skill.selfGap.state === 'shown' ? (
                          <>
                            <span className="font-semibold tabular-nums">{formatSigned(skill.selfGap.meanGap)}</span>
                            <span className="block text-sm text-ink-subtle">
                              {skill.selfGap.meanGap > 0 ? 'se voient plus haut' : skill.selfGap.meanGap < 0 ? 'se voient plus bas' : 'comme observé'}, n = {skill.selfGap.n}
                            </span>
                          </>
                        ) : (
                          <Muted>{skill.selfGap.state === 'hidden' ? HIDDEN_TEXT : skill.selfGap.state === 'not_comparable' ? 'non comparable' : '—'}</Muted>
                        )}
                      </Td>
                    </>
                  ) : (
                    <Td colSpan={4}>
                      <Muted>{skill.overall.state === 'hidden' ? 'Moins de 5 personnes observées : résultat masqué.' : 'Pas encore observée.'}</Muted>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </div>
    </section>
  );
}

// ── Carte de chaleur ─────────────────────────────────────────────────────────
function HeatCell({ cell, report, label, onOpen }: { cell: CellView; report: Report; label: string; onOpen: () => void }) {
  if (cell.state !== 'shown') {
    return (
      <Td className="p-1 sm:p-1">
        <span
          className={cn('flex h-14 min-w-20 items-center justify-center rounded-sm text-center text-xs text-ink-subtle', cell.state === 'hidden' && 'bg-[repeating-linear-gradient(135deg,#f5f5f2_0_6px,#e5e5e0_6px_7px)]')}
          title={cell.state === 'hidden' ? `${label} : moins de 5 personnes, masqué` : `${label} : pas d’observation`}
        >
          {cell.state === 'hidden' ? HIDDEN_TEXT : '—'}
        </span>
      </Td>
    );
  }
  const colors = heatColors(cell.mean, report.framework.scaleMin, report.framework.scaleMax);
  return (
    <Td className="p-1 sm:p-1">
      <button
        type="button"
        onClick={onOpen}
        style={colors}
        title={`${label} : ${meanText(cell)} (n = ${cell.n})`}
        aria-label={`${label} : moyenne ${formatScore(cell.mean, 1)}, n = ${cell.n}`}
        className="flex h-14 w-full min-w-20 flex-col items-center justify-center rounded-sm transition-transform hover:scale-[1.03]"
      >
        <span className="font-display text-base leading-none font-semibold tabular-nums">{formatScore(cell.mean, 1)}</span>
        <span className="mt-1 text-[0.6875rem] leading-none opacity-85">n = {cell.n}</span>
      </button>
    </Td>
  );
}

function Heatmap({ report, onOpen }: { report: Report; onOpen: (code: string) => void }) {
  const legend = heatLegend(report.framework.scaleMin, report.framework.scaleMax);
  return (
    <section aria-labelledby="carte-titre">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="carte-titre" className="text-title">
          Moyenne observée par {report.compare!.label.toLowerCase()}
        </h2>
        <ul aria-label="Légende des couleurs" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {legend.map((item) => (
            <li key={item.color} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-5 rounded-[3px]" style={{ background: item.color }} />
              {formatScore(item.from, 1)} à {formatScore(item.to, 1)}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-5 rounded-[3px] bg-[repeating-linear-gradient(135deg,#f5f5f2_0_3px,#d3d3cb_3px_4px)]" />
            moins de 5 personnes
          </li>
        </ul>
      </div>
      <div className="rounded-lg border border-line bg-white">
        <TableWrap label="Carte de chaleur des compétences">
          <Table className="table-fixed">
            <caption className="sr-only">Moyenne observée de chaque compétence par {report.compare!.label.toLowerCase()}, avec l’effectif n. Cases de moins de 5 personnes masquées.</caption>
            <colgroup>
              <col className="w-48" />
              <col className="w-28" />
              {report.segments.map((segment) => (
                <col key={segment.key} className="w-28" />
              ))}
            </colgroup>
            <thead>
              <tr>
                <Th className="align-bottom">Compétence</Th>
                <Th className="align-bottom whitespace-normal">
                  Ensemble
                  <span className="block font-normal">repère</span>
                </Th>
                {report.segments.map((segment) => (
                  <Th key={segment.key} className="align-bottom whitespace-normal">
                    <span className="line-clamp-3" title={segment.label}>
                      {segment.label}
                    </span>
                    <span className="block font-normal">{segment.count === null ? HIDDEN_TEXT : `n = ${segment.count}`}</span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.skills.map((skill) => (
                <Tr key={skill.code} className="hover:bg-transparent">
                  <Th scope="row" className="border-b-0 bg-transparent font-normal whitespace-normal text-ink">
                    <button type="button" onClick={() => onOpen(skill.code)} className="min-h-8 text-left font-semibold text-petrol-800 underline-offset-4 hover:underline">
                      {skill.name}
                    </button>
                  </Th>
                  <HeatCell cell={skill.overall} report={report} label={`${skill.name}, ensemble`} onOpen={() => onOpen(skill.code)} />
                  {skill.segments.map((cell, index) => (
                    <HeatCell key={report.segments[index]!.key} cell={cell} report={report} label={`${skill.name}, ${report.segments[index]!.label}`} onOpen={() => onOpen(skill.code)} />
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </div>
    </section>
  );
}

// ── Fiche d'une compétence ───────────────────────────────────────────────────
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line px-3.5 py-3">
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function SkillSheet({ skill, report }: { skill: SkillReport; report: Report }) {
  const levels = report.framework.levels;
  const overall = skill.overall;
  const shownPoints = skill.sessions.filter((point) => point.state === 'shown');
  return (
    <div className="flex flex-col gap-6">
      {skill.description ? <p className="text-[0.9375rem] text-ink-muted">{skill.description}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Moyenne observée">
          {overall.state === 'shown' ? (
            <>
              <span className="font-display text-xl font-semibold tabular-nums">{meanText(overall)}</span>
              <span className="block text-sm text-ink-subtle">
                sur {report.framework.scaleMax}, marge à 95 %, n = {overall.n}
              </span>
            </>
          ) : (
            <Muted>{overall.state === 'hidden' ? 'moins de 5 personnes' : 'pas encore observée'}</Muted>
          )}
        </Stat>
        <Stat label="Progression">
          {skill.progression.state === 'shown' ? (
            <>
              <span className="font-display text-xl font-semibold tabular-nums">{formatSigned(skill.progression.meanDelta)} pt</span>
              <span className="block text-sm text-ink-subtle">
                {skill.progression.up} en hausse, {skill.progression.stable} stables, {skill.progression.down} en baisse (n = {skill.progression.n})
              </span>
            </>
          ) : (
            <Muted>{skill.progression.state === 'hidden' ? 'moins de 5 personnes observées deux fois' : 'aucune personne observée deux fois'}</Muted>
          )}
        </Stat>
        <Stat label="Regard sur soi">
          {skill.selfGap.state === 'shown' ? (
            <>
              <span className="font-display text-xl font-semibold tabular-nums">{formatSigned(skill.selfGap.meanGap)} pt</span>
              <span className="block text-sm text-ink-subtle">
                {skill.selfGap.higher} se voient plus haut, {skill.selfGap.lower} plus bas, {skill.selfGap.equal} comme observé (n = {skill.selfGap.n})
              </span>
            </>
          ) : (
            <Muted>
              {skill.selfGap.state === 'hidden' ? 'moins de 5 personnes' : skill.selfGap.state === 'not_comparable' ? 'auto-évaluation sur une autre échelle' : 'aucune auto-évaluation'}
            </Muted>
          )}
        </Stat>
      </div>

      {overall.state === 'shown' ? (
        <section aria-labelledby="fiche-repartition">
          <h3 id="fiche-repartition" className="text-base">
            Répartition par niveau
          </h3>
          <DistributionBar distribution={overall.distribution} levels={levels} className="mt-2 h-4" />
          <ul className="mt-2 grid gap-1 text-sm text-ink-muted sm:grid-cols-2">
            {levels.map((level, index) => (
              <li key={level.value} className="flex justify-between gap-3 border-b border-line py-1">
                <span>
                  <span className="font-semibold text-ink tabular-nums">{level.value}</span> {level.label}
                </span>
                <span className="tabular-nums">
                  {overall.distribution[index]} ({Math.round(((overall.distribution[index] ?? 0) / overall.n) * 100)} %)
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="fiche-sessions">
        <h3 id="fiche-sessions" className="text-base">
          Moyenne observée à chaque session
        </h3>
        <p className="mt-0.5 text-sm text-ink-subtle">Toutes les observations de la session, une valeur par personne. Les personnes peuvent changer d’une session à l’autre.</p>
        {shownPoints.length ? (
          <>
            <SessionCurve points={skill.sessions} min={report.framework.scaleMin} max={report.framework.scaleMax} />
            <ul aria-label="Moyenne par session" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              {skill.sessions.map((point) => (
                <li key={point.session}>
                  <span className="font-semibold text-ink">S{point.session}</span>{' '}
                  {point.state === 'shown' ? `${formatScore(point.mean, 1)} (n = ${point.n})` : point.state === 'hidden' ? HIDDEN_TEXT : '—'}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">Aucune session ne réunit au moins 5 personnes observées.</p>
        )}
      </section>

      {report.compare ? (
        <section aria-labelledby="fiche-segments">
          <h3 id="fiche-segments" className="text-base">
            Selon {report.compare.label.toLowerCase()}
          </h3>
          <ul className="mt-2 flex flex-col gap-2.5">
            {report.segments.map((segment, index) => {
              const cell = skill.segments[index]!;
              return (
                <li key={segment.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                  <span className="text-sm font-semibold text-ink">{segment.label}</span>
                  <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    {cell.state === 'shown' ? <DistributionBar distribution={cell.distribution} levels={levels} /> : <Muted>{cell.state === 'hidden' ? 'masqué : moins de 5 personnes' : 'pas d’observation'}</Muted>}
                  </span>
                  <span className="text-right text-sm whitespace-nowrap tabular-nums">{cell.state === 'shown' ? `${meanText(cell)} (n = ${cell.n})` : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function ObservatoryView({ report, initialSkill }: { report: ObservatoryReport; initialSkill: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [skillCode, setSkillCode] = useState<string | null>(initialSkill);

  const navigate = (next: ObservatoryFilters) => {
    setSkillCode(null);
    startTransition(() => router.push(`${pathname}${observatorySearch(next)}`, { scroll: false }));
  };
  // La fiche ouverte vit dans l'adresse (lien partageable), sans recharger les données.
  const openSkill = (code: string | null) => {
    setSkillCode(code);
    window.history.replaceState(null, '', `${pathname}${observatorySearch(report.filters, { competence: code })}`);
  };
  const exportHref = `/api/exports/observatoire${observatorySearch(report.filters)}`;
  const resetAction = (
    <Button variant="outline" onClick={() => navigate({ framework: report.filters.framework, values: {}, compare: null })}>
      <RotateCcw aria-hidden />
      Réinitialiser les filtres
    </Button>
  );

  const framework = report.framework;
  const ready = report.state === 'ok' && framework ? (report as Report) : null;
  const skill = ready?.skills.find((item) => item.code === skillCode) ?? null;

  return (
    <>
      <Header report={report} />
      {framework ? <FilterBar report={report} pending={pending} onChange={navigate} exportHref={exportHref} /> : null}

      <div className={cn('transition-opacity', pending && 'opacity-60')} aria-busy={pending || undefined}>
        {framework ? (
          <p className="-mt-2 mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            {framework.name}, {framework.versionLabel.charAt(0).toLowerCase() + framework.versionLabel.slice(1)}, échelle de {framework.scaleMin} à {framework.scaleMax}
            {framework.isProvisional ? <ProvisionalBadge /> : null}
            {report.compare ? <Badge variant="petrol">Comparé par {report.compare.label.toLowerCase()}</Badge> : null}
          </p>
        ) : null}

        {report.excludedObservations > 0 ? (
          <Notice variant="warning" className="mb-6" title="Des observations ont été écartées">
            Notées sur une autre échelle que la version affichée, elles ne sont pas comptées (n = {report.excludedObservations}).
          </Notice>
        ) : null}

        {report.state === 'no_framework' ? (
          <EmptyState icon={Telescope} title="Aucun référentiel publié" description="Publiez un référentiel pour suivre ses compétences ici." />
        ) : report.state === 'empty' || report.state === 'too_small' ? (
          <div className="flex flex-col items-center rounded-lg border border-line bg-white px-6 py-12 text-center">
            <Image src="/brand/happi-mascotte.png" alt="" width={72} height={72} className="mb-4 size-18" />
            <p className="font-display text-base font-semibold text-ink">
              {report.state === 'empty' ? 'Personne n’a encore été observé avec ces filtres' : 'Moins de 5 personnes avec ces filtres'}
            </p>
            <p className="mt-1.5 max-w-md text-sm text-ink-muted">
              {report.state === 'empty'
                ? 'Les résultats apparaissent dès que des évaluations sont validées. Élargissez les filtres pour voir plus de personnes.'
                : 'Pour protéger chacun, rien n’est affiché sous 5 personnes. Élargissez les filtres.'}
            </p>
            <div className="mt-5">{resetAction}</div>
          </div>
        ) : ready ? (
          <>
            <Findings report={ready} onOpen={openSkill} />
            {report.compare ? <Heatmap report={ready} onOpen={openSkill} /> : <SkillsTable report={ready} onOpen={openSkill} />}
            <p className="mt-4 max-w-3xl text-sm text-ink-subtle">
              Une valeur par personne, calculée comme dans son passeport. Une personne non observée n’entre pas dans le calcul. Progression : écart entre la première et la dernière observation, pas
              un effet prouvé de la formation.
            </p>
          </>
        ) : null}
      </div>

      <Dialog open={skill !== null} onOpenChange={(open) => !open && openSkill(null)}>
        {skill && ready ? (
          <DialogContent size="lg" title={skill.name} description={skill.category ?? ready.framework.name}>
            <SkillSheet skill={skill} report={ready} />
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
