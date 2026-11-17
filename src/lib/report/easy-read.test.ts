import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildReportData } from './build';
import { checkContent, SCORE_PATTERN } from './content';
import { buildEasyReadDossier, checkEasyRead, easyReadSchema, easyReadToText, sentencesFromLines, type EasyReadContent } from './easy-read';
import { generateEasyRead } from './easy-read-ai';
import { fixtureContent, fixturePassport } from './fixtures';

const data = buildReportData(
  fixturePassport({ attended: [1, 2], evaluated: [1, 2], ct: { relationnel: [[1, 3, 'Écoute Camille et les autres.']], adaptabilite: [[1, 2], [2, 4]] } }),
  new Map(),
);
const content = fixtureContent(data);
const relationnel = data.frameworks.flatMap((f) => f.skills).find((skill) => skill.code === 'relationnel')!;
const unobserved = data.frameworks.flatMap((f) => f.skills).find((skill) => skill.status === 'not_observed')!;

const falc: EasyReadContent = {
  sections: [
    { title: 'Ce qu’est ce bilan', sentences: ['Ce bilan parle de vous.', 'Il dit ce que les formateurs ont vu.'] },
    { title: 'Ce que vous savez bien faire', sentences: [`Vous savez bien faire : ${relationnel.name}.`, 'Vous écoutez les autres.'] },
    { title: 'À retenir', sentences: ['Vous pouvez être fier de vous.'] },
  ],
};

describe('version facile à lire : contrôles', () => {
  it('un texte FALC conforme passe les contrôles, comme le texte du bilan passe checkContent', () => {
    expect(easyReadSchema.safeParse(falc).success).toBe(true);
    expect(checkEasyRead(falc, data)).toEqual([]);
    expect(checkContent(content, data)).toEqual([]);
    for (const sentence of falc.sections.flatMap((section) => section.sentences)) expect(SCORE_PATTERN.test(sentence)).toBe(false);
  });

  it('refuse une note chiffrée, comme checkContent', () => {
    const issues = checkEasyRead({ sections: [{ title: 'Vos niveaux', sentences: ['Vous avez 3/5 en relationnel.'] }] }, data);
    expect(issues.map((issue) => issue.message).join(' ')).toMatch(/note/);
  });

  it('refuse toute mention d’une compétence non observée', () => {
    const issues = checkEasyRead({ sections: [{ title: 'À travailler', sentences: [`Travaillez : ${unobserved.name}.`] }] }, data);
    expect(issues[0]!.message).toMatch(/n’a pas été observée/);
  });

  it('refuse les phrases longues ou à plusieurs idées', () => {
    const long = 'Vous avez participé à toutes les activités du groupe avec beaucoup de sérieux et vous avez aidé les autres à comprendre les consignes du jeu.';
    const issues = checkEasyRead({ sections: [{ title: 'Bilan', sentences: [long, 'Vous écoutez. Vous parlez.', 'Vous aidez ; vous partagez.'] }] }, data);
    expect(issues.map((issue) => issue.path)).toEqual(['sections.0.sentences.0', 'sections.0.sentences.1', 'sections.0.sentences.2']);
  });

  it('refuse un texte vide', () => {
    expect(checkEasyRead({ sections: [] }, data)).toHaveLength(1);
    expect(checkEasyRead({ sections: [{ title: '', sentences: [] }] }, data)).toHaveLength(2);
  });

  it('découpe la saisie ligne à ligne et produit un texte lisible à voix haute', () => {
    expect(sentencesFromLines(' Une phrase.\n\n Deux phrases. \n')).toEqual(['Une phrase.', 'Deux phrases.']);
    expect(easyReadToText(falc)).toContain('Ce qu’est ce bilan\nCe bilan parle de vous.');
  });
});

describe('version facile à lire : dossier et génération', () => {
  it('le dossier ne contient ni nom, ni compétence non observée', () => {
    const dossier = JSON.stringify(buildEasyReadDossier(data, { ...content, introduction: 'Bonjour Camille Exemple.' }));
    expect(dossier).not.toContain('Camille');
    expect(dossier).not.toContain(`"${unobserved.code}"`);
    expect(dossier).toContain(relationnel.name);
  });

  it('redemande une correction puis renvoie un texte conforme', async () => {
    const responses = [{ parsed_output: { sections: [{ title: 'Bilan', sentences: ['Vous avez 4/5.'] }] } }, { parsed_output: falc }];
    const calls: unknown[] = [];
    const parse = vi.fn(async (body: unknown) => {
      calls.push(body);
      return { model: 'test-model', content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', ...responses.shift() };
    });
    const result = await generateEasyRead(data, content, { client: { beta: { messages: { parse } } } as never, provider: 'openrouter', model: 'm' });
    expect(result).toEqual({ ok: true, content: falc, model: 'test-model' });
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
