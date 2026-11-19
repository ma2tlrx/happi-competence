import { describe, expect, it } from 'vitest';

import { buildReliabilityReport, pairRatings, parsePublicReliability, publicSnapshot, type ReliabilityDataset } from './report';
import { pseudonym, readSalt, researchCsv, RESEARCH_HEADER } from './research-export';

const version = { id: 'v1', frameworkCode: 'transversales', frameworkName: 'Compétences transversales', versionNumber: 1, label: 'Version 1', scale: { min: 1, max: 4, step: 1 } };
const skills = [
  { id: 's1', versionId: 'v1', code: 'cooperer', name: 'Coopérer', position: 1 },
  { id: 's2', versionId: 'v1', code: 'communiquer', name: 'Communiquer', position: 2 },
];

function dataset(): ReliabilityDataset {
  return {
    versions: [version],
    skills,
    raterNames: { alice: 'Alice', bruno: 'Bruno', chloe: 'Chloé' },
    officials: [
      { sessionId: 'se1', participantId: 'p1', evaluatorId: 'alice', revision: 0, scores: [{ skillId: 's1', score: 2 }, { skillId: 's2', score: 3 }] },
      { sessionId: 'se1', participantId: 'p2', evaluatorId: 'alice', revision: 1, scores: [{ skillId: 's1', score: 4 }, { skillId: 's2', score: null }] },
      { sessionId: 'se2', participantId: 'p3', evaluatorId: 'bruno', revision: 0, scores: [{ skillId: 's1', score: 1 }] },
    ],
    ratings: [
      // Bruno cote p1 : accord sur s1, écart d'un cran sur s2.
      { id: 'r1', sessionId: 'se1', participantId: 'p1', raterId: 'bruno', origin: 'co_trainer', officialRevision: 0, scores: [{ skillId: 's1', score: 2 }, { skillId: 's2', score: 2 }] },
      // Bruno cote p2 : s2 observée par lui seul (désaccord d'observabilité) ; officielle modifiée après.
      { id: 'r2', sessionId: 'se1', participantId: 'p2', raterId: 'bruno', origin: 'co_trainer', officialRevision: 0, scores: [{ skillId: 's1', score: 4 }, { skillId: 's2', score: 3 }] },
      // Chloé, invitée : p1 également.
      { id: 'r3', sessionId: 'se1', participantId: 'p1', raterId: 'chloe', origin: 'exercise', officialRevision: 0, scores: [{ skillId: 's1', score: 3 }, { skillId: 's2', score: null }] },
      // Bruno sur sa propre évaluation officielle : écarté.
      { id: 'r4', sessionId: 'se2', participantId: 'p3', raterId: 'bruno', origin: 'exercise', officialRevision: 0, scores: [{ skillId: 's1', score: 1 }] },
      // Aucune évaluation officielle validée.
      { id: 'r5', sessionId: 'se9', participantId: 'p9', raterId: 'chloe', origin: 'exercise', officialRevision: null, scores: [{ skillId: 's1', score: 1 }] },
    ],
  };
}

describe('appariement', () => {
  it('apparie par séance, participant et compétence ; « non observé » n’est jamais un zéro', () => {
    const { records, withoutOfficial, sameRater } = pairRatings(dataset());
    expect(withoutOfficial).toBe(1);
    expect(sameRater).toBe(1);
    expect(records.filter((r) => r.status === 'pair')).toHaveLength(4);
    expect(records.find((r) => r.ratingId === 'r2' && r.skillId === 's2')).toMatchObject({ status: 'not_observed_official', official: null, second: 3 });
    expect(records.find((r) => r.ratingId === 'r3' && r.skillId === 's2')).toMatchObject({ status: 'not_observed_second', second: null });
    expect(records.every((r) => r.official !== 0 && r.second !== 0)).toBe(true);
  });

  it('repère les évaluations officielles modifiées après la seconde cotation', () => {
    const { records } = pairRatings(dataset());
    expect(records.filter((r) => r.amendedAfter).map((r) => r.ratingId)).toEqual(['r2', 'r2']);
  });
});

describe('synthèse', () => {
  const report = buildReliabilityReport(dataset(), 30);
  const v = report.versions[0]!;

  it('global : 4 paires, 2 accords exacts, 4 adjacents, 2 désaccords d’observabilité, effectif insuffisant', () => {
    expect(v.overall.n).toBe(4);
    expect(v.overall.exact).toMatchObject({ count: 2, n: 4 });
    expect(v.overall.adjacent).toMatchObject({ count: 4, n: 4 });
    expect(v.observabilityMismatches).toBe(2);
    expect(v.overall.sufficient).toBe(false);
    expect(report).toMatchObject({ submittedRatings: 5, withoutOfficial: 1, sameRater: 1, amendedAfter: 1 });
  });

  it('par compétence et par formateur (un formateur compte comme officiel ou comme second)', () => {
    expect(v.bySkill.map((row) => [row.label, row.stats.n])).toEqual([['Coopérer', 3], ['Communiquer', 1]]);
    expect(Object.fromEntries(v.byRater.map((row) => [row.label, row.stats.n]))).toEqual({ Alice: 4, Bruno: 3, Chloé: 1 });
  });

  it('écarts les plus fréquents', () => {
    expect(v.frequentGaps).toEqual([
      { skillId: 's2', skillName: 'Communiquer', official: 3, second: 2, count: 1 },
      { skillId: 's1', skillName: 'Coopérer', official: 2, second: 3, count: 1 },
    ]);
  });
});

describe('publication', () => {
  it('n’expose aucune valeur sous le seuil, seulement n et la date', () => {
    const snapshot = publicSnapshot(buildReliabilityReport(dataset(), 30), '2026-11-18T10:00:00.000Z');
    expect(snapshot.rows[0]).toMatchObject({ n: 4, sufficient: false, exact: null, kappa: null });
    expect(JSON.stringify(snapshot)).not.toMatch(/Alice|Bruno|p1|se1/);
  });

  it('relit l’instantané et refuse d’afficher des valeurs si n est sous le seuil enregistré', () => {
    const snapshot = publicSnapshot(buildReliabilityReport(dataset(), 2), '2026-11-18T10:00:00.000Z');
    expect(snapshot.rows[0]!.exact).not.toBeNull();
    expect(parsePublicReliability(snapshot)?.rows[0]!.exact?.rate).toBe(0.5);
    const tampered = { ...snapshot, minPairs: 30 };
    expect(parsePublicReliability(tampered)?.rows[0]!.exact).toBeNull();
    expect(parsePublicReliability({ foo: 1 })).toBeNull();
  });
});

describe('export de recherche', () => {
  const salt = 'x'.repeat(40);

  it('pseudonymes stables, différents selon le sel et le type, sans l’identifiant', () => {
    expect(pseudonym(salt, 'participant', 'p1')).toBe(pseudonym(salt, 'participant', 'p1'));
    expect(pseudonym(salt, 'participant', 'p1')).not.toBe(pseudonym('y'.repeat(40), 'participant', 'p1'));
    expect(pseudonym(salt, 'participant', 'p1')).not.toBe(pseudonym(salt, 'formateur', 'p1'));
    expect(pseudonym(salt, 'participant', 'p1')).toMatch(/^P-[0-9a-f]{16}$/);
  });

  it('refuse un sel absent ou trop court', () => {
    expect(readSalt({})).toBeNull();
    expect(readSalt({ RELIABILITY_PSEUDONYM_SALT: 'court' })).toBeNull();
    expect(readSalt({ RELIABILITY_PSEUDONYM_SALT: salt })).toBe(salt);
  });

  it('ne contient aucun identifiant interne ni nom', () => {
    const data = dataset();
    const csv = researchCsv(pairRatings(data).records, data.versions, data.skills, salt);
    expect(csv).toContain(RESEARCH_HEADER.join('";"'));
    expect(csv).not.toMatch(/Alice|Bruno|Chloé|"p1"|"se1"|"alice"/);
    expect(csv.trim().split('\r\n')).toHaveLength(1 + 6);
  });
});
