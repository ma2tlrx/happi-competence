import { describe, expect, it } from 'vitest';

import { toCsv } from '@/lib/csv';
import { fixturePassport } from '@/lib/report/fixtures';

import { RESULTS_CSV_HEADER, resultsCsvLines } from './results-csv';

const SOURCE = { code: 'src_a', name: 'Source fictive', publisher: 'Éditeur fictif', version: '1.0' };

describe('export CSV des résultats pour un conseiller', () => {
  const passport = fixturePassport({
    attended: [1, 2],
    evaluated: [1, 2],
    ct: { relationnel: [[1, 3, 'Commentaire privé du formateur.'], [2, 4]] },
  });
  const ct = passport.frameworks.find((framework) => framework.code === 'transversal')!;
  const relationnel = ct.skills.find((skill) => skill.code === 'relationnel')!;
  relationnel.publicMappings = [{ code: 'F1', label: 'Élément fictif', linkType: 'close', source: SOURCE }];

  it('une ligne par compétence, niveaux et valeurs repris tels quels', () => {
    const lines = resultsCsvLines(passport);
    expect(lines[0]).toEqual(RESULTS_CSV_HEADER);
    expect(lines).toHaveLength(1 + passport.frameworks.reduce((total, framework) => total + framework.skills.length, 0));
    const line = lines.find((cells) => cells[4] === relationnel.name)!;
    expect(line[5]).toBe(relationnel.level!.label);
    expect(line[6]).toBe(relationnel.summary.value);
    expect(line[8]).toBe(2);
    expect(line[9]).toBe('Élément fictif [proche ; Source fictive (Éditeur fictif), version 1.0 ; F1]');
    const unobserved = lines.find((cells) => cells[4] !== relationnel.name && cells[3]?.toString().startsWith(ct.name))!;
    expect(unobserved[5]).toBe('Pas encore observée');
    expect(unobserved[9]).toBe('');
  });

  it('ne contient ni commentaire ni réponse d’auto-évaluation', () => {
    const withSelf = structuredClone(passport);
    withSelf.frameworks[0]!.skills[0]!.selfValue = 5;
    withSelf.frameworks[0]!.skills[0]!.selfQuestion = 'Question d’auto-évaluation privée';
    const csv = toCsv(resultsCsvLines(withSelf));
    expect(csv).not.toContain('Commentaire privé');
    expect(csv).not.toContain('Question d’auto-évaluation privée');
    expect(RESULTS_CSV_HEADER.join(' ')).not.toMatch(/auto/i);
  });
});
