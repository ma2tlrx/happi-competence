import { describe, expect, it } from 'vitest';

import {
  distinctSources,
  filterSkillRows,
  mappingCounts,
  mappingKey,
  parseMappingFilters,
  searchExternalSkills,
  sourceMention,
  validatedMappingsBySkill,
  type AdminMapping,
  type AdminSkillRow,
  type ExternalSkillOption,
  type MappingRow,
} from './mappings';

// Référentiels et éléments FICTIFS.
const A = { code: 'src_a', name: 'Source A', publisher: 'Éditeur A', version: '1.0' };
const B = { code: 'src_b', name: 'Source B', publisher: 'Éditeur B', version: '2' };
const option = (id: string, label: string, source = A, extra: Partial<ExternalSkillOption> = {}): ExternalSkillOption => ({
  id,
  code: `C-${id}`,
  label,
  definition: null,
  isActive: true,
  source,
  ...extra,
});
const OPTIONS = [
  option('1', 'Travailler en équipe'),
  option('2', 'Équipe projet', B),
  option('3', 'Communication', A, { definition: 'Savoir travailler avec les autres en équipe.' }),
  option('4', 'Esprit d’équipe'),
  option('5', 'Équipe', A, { isActive: false }),
  option('6', 'Autonomie'),
];

describe('recherche d’un élément externe', () => {
  it('ignore accents et casse, classe libellé exact, début, contenu, puis définition', () => {
    expect(searchExternalSkills(OPTIONS, 'EQUIPE').map((o) => o.id)).toEqual(['2', '4', '1', '3']);
  });

  it('exige tous les mots, filtre par source, exclut les éléments déjà liés et inactifs', () => {
    expect(searchExternalSkills(OPTIONS, 'travailler equipe').map((o) => o.id)).toEqual(['1', '3']);
    expect(searchExternalSkills(OPTIONS, 'équipe', { sourceCode: 'src_b' }).map((o) => o.id)).toEqual(['2']);
    expect(searchExternalSkills(OPTIONS, 'équipe', { excludeIds: ['2', '4'] }).map((o) => o.id)).toEqual(['1', '3']);
    expect(searchExternalSkills(OPTIONS, 'équipe', { includeInactive: true }).map((o) => o.id)[0]).toBe('5');
  });

  it('cherche aussi par code et borne le nombre de résultats', () => {
    expect(searchExternalSkills(OPTIONS, 'c-6').map((o) => o.id)).toEqual(['6']);
    expect(searchExternalSkills(OPTIONS, '', { limit: 2 })).toHaveLength(2);
  });
});

describe('correspondances visibles hors administration', () => {
  const row = (status: string, skill: string, label: string, linkType = 'close', source = A): MappingRow => ({
    skill_code: skill,
    link_type: linkType,
    status,
    frameworks: { code: 'transversal' },
    external_skills: { code: `C-${label}`, label, external_frameworks: source },
  });

  it('ne garde que les correspondances validées, groupées par compétence et triées', () => {
    const map = validatedMappingsBySkill([
      row('validated', 'relationnel', 'Écoute', 'partial'),
      row('proposed', 'relationnel', 'Proposition non validée', 'equivalent'),
      row('validated', 'relationnel', 'Contact', 'equivalent', B),
      row('validated', 'rigueur', 'Rigueur', 'bizarre'),
      { ...row('validated', 'rigueur', 'Sans source'), external_skills: null },
    ]);
    expect([...map.keys()]).toEqual([mappingKey('transversal', 'relationnel')]);
    const list = map.get('transversal:relationnel')!;
    expect(list.map((m) => m.label)).toEqual(['Contact', 'Écoute']);
    expect(JSON.stringify(list)).not.toContain('Proposition non validée');
    expect(list[0]!.source).toEqual(B);
  });

  it('cite la source avec son éditeur et sa version, sans doublon', () => {
    expect(sourceMention(A)).toBe('Source A (Éditeur A), version 1.0');
    expect(distinctSources([A, B, A, { ...A, version: '1.1' }])).toHaveLength(3);
  });
});

describe('filtres de l’administration', () => {
  const mapping = (status: 'proposed' | 'validated', source = A): AdminMapping => ({
    id: `${status}-${source.code}`,
    status,
    linkType: 'close',
    origin: 'manual',
    justification: null,
    proposedAt: '2026-11-18',
    proposedBy: null,
    validatedAt: status === 'validated' ? '2026-11-18' : null,
    validatedBy: null,
    external: option('x', 'X', source),
  });
  const skill = (frameworkCode: string, code: string, name: string, mappings: AdminMapping[]): AdminSkillRow => ({
    frameworkId: frameworkCode,
    frameworkCode,
    frameworkName: frameworkCode,
    code,
    name,
    description: null,
    mappings,
  });
  const ROWS = [
    skill('transversal', 'relationnel', 'Relationnel', [mapping('validated')]),
    skill('transversal', 'rigueur', 'Rigueur', [mapping('proposed', B)]),
    skill('sociocognitive', 'empathie', 'Empathie', []),
  ];

  it('lit les filtres de l’adresse en écartant les valeurs inattendues', () => {
    expect(parseMappingFilters({ referentiel: 'transversal', statut: 'validated', source: 'src_a', q: ' rel ' })).toEqual({
      framework: 'transversal',
      status: 'validated',
      source: 'src_a',
      q: 'rel',
    });
    expect(parseMappingFilters({ referentiel: "x' or 1=1", statut: 'tout', source: ['A B'] })).toEqual({ framework: null, status: 'all', source: null, q: '' });
  });

  it('filtre par référentiel, statut, source et nom', () => {
    const base = { framework: null, status: 'all' as const, source: null, q: '' };
    expect(filterSkillRows(ROWS, { ...base, framework: 'transversal' }).map((r) => r.code)).toEqual(['relationnel', 'rigueur']);
    expect(filterSkillRows(ROWS, { ...base, status: 'validated' }).map((r) => r.code)).toEqual(['relationnel']);
    expect(filterSkillRows(ROWS, { ...base, status: 'proposed' }).map((r) => r.code)).toEqual(['rigueur']);
    expect(filterSkillRows(ROWS, { ...base, status: 'none' }).map((r) => r.code)).toEqual(['empathie']);
    expect(filterSkillRows(ROWS, { ...base, status: 'none', source: 'src_a' }).map((r) => r.code)).toEqual(['rigueur', 'empathie']);
    expect(filterSkillRows(ROWS, { ...base, q: 'EMPATH' }).map((r) => r.code)).toEqual(['empathie']);
  });

  it('compte compétences couvertes, propositions et validations', () => {
    expect(mappingCounts(ROWS)).toEqual({ skills: 3, mapped: 1, proposed: 1, validated: 1 });
  });
});
