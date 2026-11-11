import { Circle, G, Line, Polygon, Rect, Svg, Text as SvgText, Text, View } from '@react-pdf/renderer';

import type { ReportCategory, ReportFramework, ReportSkill } from '@/lib/report/model';

import { C, levelColor } from './theme';

/** Jauge segmentée : un segment par niveau ; vide (contour seul) si la compétence n'a pas été observée. */
export function LevelMeter({ value, min, max, width = 110, height = 6 }: { value: number | null; min: number; max: number; width?: number; height?: number }) {
  const count = max - min + 1;
  const gap = 2;
  const segment = (width - gap * (count - 1)) / count;
  return (
    <Svg width={width} height={height}>
      {Array.from({ length: count }, (_, index) => {
        const level = min + index;
        const filled = value !== null && level <= value;
        return (
          <Rect
            key={level}
            x={index * (segment + gap)}
            y={0}
            width={segment}
            height={height}
            rx={1.5}
            fill={filled ? C.observed : value === null ? C.white : C.observedTrack}
            stroke={value === null ? C.lineStrong : undefined}
            strokeWidth={value === null ? 0.6 : 0}
          />
        );
      })}
    </Svg>
  );
}

/** Répartition des compétences par niveau atteint, compétences non observées comprises. */
export function DistributionBar({ framework, width }: { framework: ReportFramework; width: number }) {
  const total = framework.totalCount;
  const unobserved = total - framework.observedCount;
  let x = 0;
  const parts = [
    ...framework.distribution.filter((level) => level.count > 0).map((level) => ({ key: `l${level.value}`, count: level.count, fill: levelColor(level.value, framework.scaleMin, framework.scaleMax) })),
    ...(unobserved > 0 ? [{ key: 'none', count: unobserved, fill: C.paper }] : []),
  ];
  return (
    <Svg width={width} height={14}>
      {parts.map((part) => {
        const w = (part.count / total) * width;
        const rect = <Rect key={part.key} x={x + 0.5} y={0} width={Math.max(0, w - 1)} height={14} fill={part.fill} stroke={part.key === 'none' ? C.lineStrong : undefined} strokeWidth={part.key === 'none' ? 0.5 : 0} />;
        x += w;
        return rect;
      })}
    </Svg>
  );
}

export function DistributionLegend({ framework }: { framework: ReportFramework }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
      {framework.distribution.map((level) => (
        <View key={level.value} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 3 }}>
          <View style={{ width: 7, height: 7, backgroundColor: levelColor(level.value, framework.scaleMin, framework.scaleMax), marginRight: 4, borderRadius: 1 }} />
          <Text style={{ fontSize: 7.5, color: C.muted }}>
            {level.label} · {level.count}
          </Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
        <View style={{ width: 7, height: 7, backgroundColor: C.paper, borderWidth: 0.5, borderColor: C.lineStrong, marginRight: 4, borderRadius: 1 }} />
        <Text style={{ fontSize: 7.5, color: C.muted }}>Non observées · {framework.totalCount - framework.observedCount}</Text>
      </View>
    </View>
  );
}

function shortName(name: string) {
  return name.length > 18 ? `${name.slice(0, 17).trimEnd()}.` : name;
}

/**
 * Radar d'un référentiel : niveau retenu par compétence. Une compétence non observée
 * est marquée d'un point creux au centre, jamais tracée comme un zéro.
 */
export function Radar({ framework, size = 260 }: { framework: ReportFramework; size?: number }) {
  const skills = framework.skills;
  const n = skills.length;
  const cx = size / 2 + 40;
  const cy = size / 2 + 14;
  const r = size / 2 - 18;
  const span = framework.scaleMax - framework.scaleMin + 1;
  const angle = (index: number) => -Math.PI / 2 + (index / n) * Math.PI * 2;
  const point = (index: number, value: number) => {
    const radius = (value / framework.scaleMax) * r;
    return [cx + Math.cos(angle(index)) * radius, cy + Math.sin(angle(index)) * radius] as const;
  };
  const polygon = (values: (number | null)[]) => values.map((value, index) => point(index, value ?? 0).join(',')).join(' ');
  const showSelf = framework.selfComparable && skills.some((skill) => skill.self);
  return (
    <Svg width={size + 80} height={size + 28}>
      {Array.from({ length: span }, (_, ring) => (
        <Polygon
          key={ring}
          points={skills.map((_, index) => point(index, framework.scaleMin + ring).join(',')).join(' ')}
          fill="none"
          stroke={C.line}
          strokeWidth={0.6}
        />
      ))}
      {skills.map((skill, index) => {
        const [x, y] = point(index, framework.scaleMax);
        return <Line key={`a${skill.code}`} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} strokeWidth={0.5} />;
      })}
      {showSelf ? <Polygon points={polygon(skills.map((skill) => skill.self?.value ?? null))} fill="none" stroke={C.orange} strokeWidth={1} strokeDasharray="3 2" /> : null}
      <Polygon points={polygon(skills.map((skill) => skill.levelValue))} fill={C.observed} fillOpacity={0.14} stroke={C.observed} strokeWidth={1.4} />
      {skills.map((skill, index) => {
        if (skill.levelValue === null) return <Circle key={`d${skill.code}`} cx={cx} cy={cy} r={0} />;
        const [x, y] = point(index, skill.levelValue);
        return <Circle key={`d${skill.code}`} cx={x} cy={y} r={2.2} fill={C.observed} />;
      })}
      {skills.map((skill, index) => {
        const a = angle(index);
        const x = cx + Math.cos(a) * (r + 9);
        const y = cy + Math.sin(a) * (r + 9) + 2.5;
        const cos = Math.cos(a);
        return (
          <SvgText
            key={`t${skill.code}`}
            x={x}
            y={y}
            textAnchor={cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle'}
            style={{ fontSize: 6.8, fontFamily: 'DM Sans' }}
            fill={skill.levelValue === null ? C.subtle : C.ink}
          >
            {shortName(skill.name)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

/** Matrice dimensions × niveaux : nombre de compétences de chaque dimension à chaque niveau. */
export function DimensionMatrix({ framework, width }: { framework: ReportFramework; width: number }) {
  const labelWidth = 92;
  const columns = [...framework.levels.map((level) => ({ key: `l${level.value}`, label: level.label, value: level.value })), { key: 'none', label: 'Non observées', value: null as number | null }];
  const colWidth = (width - labelWidth) / columns.length;
  const rowHeight = 26;
  const height = 22 + framework.categories.length * rowHeight;
  const countFor = (category: ReportCategory, value: number | null) =>
    value === null ? category.total - category.observed : (category.distribution.find((level) => level.value === value)?.count ?? 0);
  return (
    <Svg width={width} height={height}>
      {columns.map((column, index) => (
        <SvgText key={column.key} x={labelWidth + index * colWidth + colWidth / 2} y={10} textAnchor="middle" style={{ fontSize: 6.8, fontFamily: 'DM Sans' }} fill={C.muted}>
          {column.label}
        </SvgText>
      ))}
      {framework.categories.map((category, row) => {
        const y = 22 + row * rowHeight;
        return (
          <G key={category.code}>
            <Line x1={0} y1={y} x2={width} y2={y} stroke={C.line} strokeWidth={0.5} />
            <SvgText x={0} y={y + rowHeight / 2 + 3} style={{ fontSize: 8, fontFamily: 'DM Sans' }} fill={C.ink}>
              {category.name}
            </SvgText>
            {columns.map((column, index) => {
              const count = countFor(category, column.value);
              const x = labelWidth + index * colWidth + colWidth / 2;
              if (count === 0) return <Circle key={column.key} cx={x} cy={y + rowHeight / 2} r={1.2} fill={C.lineStrong} />;
              const fill = column.value === null ? C.white : levelColor(column.value, framework.scaleMin, framework.scaleMax);
              const dark = column.value !== null && column.value >= framework.scaleMax - 1;
              return (
                <G key={column.key}>
                  <Circle cx={x} cy={y + rowHeight / 2} r={6 + count * 1.6} fill={fill} stroke={column.value === null ? C.lineStrong : undefined} strokeWidth={column.value === null ? 0.6 : 0} />
                  <SvgText x={x} y={y + rowHeight / 2 + 2.6} textAnchor="middle" style={{ fontSize: 7.5, fontFamily: 'DM Sans' }} fill={dark ? C.white : C.ink}>
                    {String(count)}
                  </SvgText>
                </G>
              );
            })}
          </G>
        );
      })}
    </Svg>
  );
}

export function statusText(skill: ReportSkill) {
  if (skill.status === 'not_observed') return 'Non observée';
  if (skill.status === 'single') return '1 observation · à confirmer';
  return `Observée en ${skill.observations.length} sessions`;
}
