import { ArrowDownRight, ArrowRight, ArrowUpRight, MessageSquareText } from 'lucide-react';

import { LevelMeter } from '@/components/ui/level-meter';
import { InfoHint } from '@/components/ui/overlays';
import type { PassportFramework, PassportSkill } from '@/lib/passport';
import { AGGREGATION_LABELS } from '@/lib/evaluation-engine';
import { cn, formatScore } from '@/lib/utils';

/** Évolution session après session : un point par observation validée. */
export function ObservationTrail({ skill, max, min }: { skill: PassportSkill; min: number; max: number }) {
  const points = skill.summary.observations;
  if (points.length === 0) return null;
  const width = 120;
  const height = 32;
  const x = (index: number) => (points.length === 1 ? width / 2 : 6 + (index * (width - 12)) / (points.length - 1));
  const y = (value: number) => height - 5 - ((value - min) / (max - min || 1)) * (height - 10);
  const label = points.map((point) => `session ${point.sessionNumber} : ${formatScore(point.score)}`).join(', ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Observations : ${label}`} className="overflow-visible">
      <line x1="0" x2={width} y1={height - 5} y2={height - 5} stroke="#e5e5e0" strokeWidth="1" />
      {points.length > 1 ? (
        <polyline points={points.map((point, index) => `${x(index)},${y(point.score)}`).join(' ')} fill="none" stroke="#00819b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
      {points.map((point, index) => (
        <circle key={`${point.sessionNumber}-${index}`} cx={x(index)} cy={y(point.score)} r="4" fill="#00819b" stroke="#fff" strokeWidth="2">
          <title>{`Session ${point.sessionNumber} : ${formatScore(point.score)} / ${max}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function TrendBadge({ skill }: { skill: PassportSkill }) {
  const { trend, delta } = skill.summary;
  if (!trend) return null;
  const config = {
    up: { icon: ArrowUpRight, text: `+${formatScore(delta)} depuis la première observation`, className: 'text-success bg-success-soft' },
    down: { icon: ArrowDownRight, text: `${formatScore(delta)} depuis la première observation`, className: 'text-ink-muted bg-paper' },
    stable: { icon: ArrowRight, text: 'Stable depuis la première observation', className: 'text-ink-muted bg-paper' },
  }[trend];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', config.className)}>
      <config.icon className="size-3.5" aria-hidden />
      {config.text}
    </span>
  );
}

export function SkillCard({ skill, framework, showSelf }: { skill: PassportSkill; framework: PassportFramework; showSelf: boolean }) {
  const { scaleMin: min, scaleMax: max } = framework.rules;
  const observed = skill.summary.value;
  const levelText = skill.level ? skill.levels.find((level) => level.value === skill.level!.value)?.description : null;

  return (
    <article className="flex h-full flex-col rounded-lg border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-display text-base leading-snug font-semibold">{skill.name}</h4>
        <InfoHint label={`Comprendre la compétence ${skill.name}`}>
          {skill.description ? <p className="text-ink">{skill.description}</p> : null}
          <ol className={cn('space-y-1.5', skill.description && 'mt-3 border-t border-line pt-3')}>
            {framework.levels.map((level) => (
              <li key={level.value}>
                <span className="font-semibold text-ink">
                  {level.value}. {level.label}
                </span>
                {skill.levels.find((d) => d.value === level.value)?.description ? (
                  <span className="block">{skill.levels.find((d) => d.value === level.value)!.description}</span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-line pt-3 text-xs">
            Valeur retenue : {AGGREGATION_LABELS[framework.rules.aggregation].label.toLowerCase()}.
          </p>
        </InfoHint>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{skill.level ? skill.level.label : 'Pas encore observée'}</span>
          {observed !== null ? (
            <span className="text-sm text-ink-muted tabular-nums">
              <span className="font-semibold text-ink">{formatScore(observed)}</span>/{max}
            </span>
          ) : null}
        </div>
        <LevelMeter
          value={observed}
          min={min}
          max={max}
          size="lg"
          label={observed === null ? `${skill.name} : pas encore observée` : `${skill.name} : niveau ${formatScore(observed)} sur ${max}, ${skill.level?.label ?? ''}`}
        />
        {showSelf && skill.selfValue !== null ? (
          <div className="mt-2.5">
            <LevelMeter value={skill.selfValue} min={min} max={max} size="sm" tone="self" label={`Votre auto-évaluation : ${skill.selfValue} sur ${max}`} />
            <p className="mt-1 text-xs text-ink-subtle">Mon auto-évaluation : {skill.selfValue}/{max}</p>
          </div>
        ) : null}
      </div>

      {levelText ? <p className="mt-4 text-sm text-ink-muted">{levelText}</p> : null}

      <div className="mt-auto pt-4">
        {skill.summary.observations.length > 0 ? (
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
            <div className="space-y-1">
              <p className="text-xs text-ink-subtle">
                {skill.summary.observations.length} observation{skill.summary.observations.length > 1 ? 's' : ''} · sessions{' '}
                {skill.summary.observations.map((o) => o.sessionNumber).join(', ')}
              </p>
              <TrendBadge skill={skill} />
            </div>
            <ObservationTrail skill={skill} min={min} max={max} />
          </div>
        ) : null}
        {skill.lastComment ? (
          <p className="mt-3 flex gap-2 rounded-md bg-paper px-3 py-2 text-sm text-ink-muted">
            <MessageSquareText className="mt-0.5 size-4 shrink-0 text-petrol-500" aria-hidden />
            <span>
              {skill.lastComment.text} <span className="text-ink-subtle">— session {skill.lastComment.sessionNumber}</span>
            </span>
          </p>
        ) : null}
      </div>
    </article>
  );
}
