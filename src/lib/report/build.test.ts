import { describe, expect, it } from 'vitest';

import { activitiesFromSupport } from './activities';
import { buildReportData, statusOf } from './build';
import { checkContent, emptyContent } from './content';
import { fixturePassport, SUPPORT_SESSION_1 } from './fixtures';

const supports = new Map([[1, SUPPORT_SESSION_1]]);

describe('activités des sessions', () => {
  it('extrait les jeux et activités du support, sans les rubriques d’organisation', () => {
    expect(activitiesFromSupport(SUPPORT_SESSION_1)).toEqual(['Jeu de l\'Imposteur', 'Débat thématique', 'Moving Out', 'WorldGuessr']);
    expect(activitiesFromSupport('## Overcooked 2 — Cuisine coopérative\n## Quiz de consolidation — Kahoot\n## Activité\n')).toEqual(['Overcooked 2', 'Quiz Kahoot']);
    expect(activitiesFromSupport(null)).toEqual([]);
  });
});

describe('statut d’observation', () => {
  it('distingue absence, observation unique et observations répétées', () => {
    expect(statusOf(0)).toBe('not_observed');
    expect(statusOf(1)).toBe('single');
    expect(statusOf(3)).toBe('repeated');
  });
});

describe('cas 1 — parcours complet', () => {
  const data = buildReportData(
    fixturePassport({
      attended: [1, 2, 3, 4, 5],
      evaluated: [1, 2, 3, 4, 5],
      ct: {
        relationnel: [[1, 3, 'Reformule la consigne pour le groupe.']],
        esprit_d_equipe: [[1, 4]],
        adaptabilite: [[2, 2], [5, 4]],
        leadership: [[3, 5]],
        organisation: [[3, 3]],
        curiosite: [[4, 4]],
        autonomie: [[5, 2]],
      },
      hbs: { cooperation: [[1, 3], [3, 4]], planification: [[1, 2], [5, 3]], arbitrage: [[2, 2]], synthese: [[5, 1]] },
      feedback: { 1: { observation: 'Très à l’écoute.', advice: 'Oser prendre la parole en premier.' } },
    }),
    supports,
    new Date('2026-07-01T10:00:00Z'),
  );

  it('compte les sessions, activités et observations réelles', () => {
    expect(data.counts).toMatchObject({ sessionsAttended: 5, sessionsEvaluated: 5, activities: 4, observations: 14, skillsObserved: 11, skillsTotal: 34 });
    expect(data.sufficiency).toBe('sufficient');
  });

  it('conserve chaque observation avec sa session, son niveau et son commentaire', () => {
    const ct = data.frameworks[0]!;
    const adaptabilite = ct.skills.find((skill) => skill.code === 'adaptabilite')!;
    expect(adaptabilite).toMatchObject({ value: 4, levelLabel: 'Acquis', status: 'repeated', delta: 2, trend: 'up' });
    expect(adaptabilite.observations.map((o) => [o.session, o.value, o.levelLabel])).toEqual([[2, 2, 'En difficulté'], [5, 4, 'Acquis']]);
    expect(ct.skills.find((skill) => skill.code === 'relationnel')!.observations[0]!.comment).toBe('Reformule la consigne pour le groupe.');
  });

  it('laisse les compétences non observées sans valeur (jamais zéro)', () => {
    const rigueur = data.frameworks[0]!.skills.find((skill) => skill.code === 'rigueur')!;
    expect(rigueur).toMatchObject({ value: null, levelValue: null, levelLabel: null, status: 'not_observed', observations: [] });
    expect(data.frameworks[0]!.distribution.reduce((sum, level) => sum + level.count, 0)).toBe(7);
  });

  it('dégage des points d’appui et un profil contrasté', () => {
    const ct = data.frameworks[0]!;
    expect(ct.highlights.strengths[0]).toBe('leadership');
    expect(ct.shape).toBe('contrasted');
    expect(ct.spread).toBe(3);
  });

  it('signale le référentiel provisoire dans les données manquantes', () => {
    expect(data.missing.some((line) => line.includes('provisoire'))).toBe(true);
    expect(data.feedback).toEqual([{ session: 1, title: 'La communication', date: '2026-01-10', observation: 'Très à l’écoute.', advice: 'Oser prendre la parole en premier.' }]);
  });
});

describe('cas 2 — peu de données', () => {
  const data = buildReportData(fixturePassport({ attended: [1], evaluated: [1], ct: { relationnel: [[1, 4]], comprehension: [[1, 3]] } }), supports);
  it('ne dégage aucune tendance et le dit', () => {
    const ct = data.frameworks[0]!;
    expect(ct.highlights).toMatchObject({ strengths: [], toDevelop: [], insufficient: true });
    expect(ct.shape).toBe('undetermined');
    expect(data.sufficiency).toBe('limited');
    expect(data.missing.join(' ')).toContain('trop peu de compétences observées');
    expect(ct.skills.find((skill) => skill.code === 'relationnel')!.status).toBe('single');
  });
});

describe('cas 3 — résultats homogènes', () => {
  const data = buildReportData(
    fixturePassport({ attended: [1, 2], evaluated: [1, 2], ct: { relationnel: [[1, 3]], esprit_d_equipe: [[1, 3]], comprehension: [[1, 4]], adaptabilite: [[2, 3]], gestion_du_stress: [[2, 4]] } }),
    supports,
  );
  it('qualifie le profil d’homogène et ne classe rien « à développer » au même niveau que les forces', () => {
    const ct = data.frameworks[0]!;
    expect(ct.shape).toBe('homogeneous');
    expect(ct.spread).toBe(1);
    for (const code of ct.highlights.toDevelop) {
      const skill = ct.skills.find((s) => s.code === code)!;
      expect(skill.levelValue).toBeLessThan(4);
    }
  });
});

describe('cas 4 — résultats contrastés', () => {
  const data = buildReportData(
    fixturePassport({ attended: [1, 3], evaluated: [1, 3], ct: { relationnel: [[1, 5]], esprit_d_equipe: [[1, 5]], comprehension: [[1, 1]], leadership: [[3, 1]], organisation: [[3, 4]] } }),
    supports,
  );
  it('met en évidence les écarts', () => {
    const ct = data.frameworks[0]!;
    expect(ct.shape).toBe('contrasted');
    expect(ct.highlights.strengths.slice(0, 2).sort()).toEqual(['esprit_d_equipe', 'relationnel']);
    expect(ct.highlights.toDevelop).toEqual(expect.arrayContaining(['comprehension', 'leadership']));
  });
});

describe('cas 5 — données manquantes', () => {
  it('produit un bilan vide mais honnête sans groupe ni évaluation', () => {
    const data = buildReportData(fixturePassport({ withGroup: false }), new Map());
    expect(data.sufficiency).toBe('none');
    expect(data.counts.observations).toBe(0);
    expect(data.sessions).toEqual([]);
    expect(data.missing).toEqual(
      expect.arrayContaining([
        expect.stringContaining('aucun groupe actif'),
        expect.stringContaining('Aucune évaluation'),
        'Auto-évaluation initiale non complétée.',
        'Aucun commentaire de session partagé par les formateurs.',
      ]),
    );
    expect(emptyContent(data).skills).toEqual([]);
  });

  it('signale une session suivie mais non évaluée', () => {
    const data = buildReportData(fixturePassport({ attended: [1, 2], evaluated: [1], ct: { relationnel: [[1, 3]] } }), supports);
    expect(data.missing).toContain('Session suivie sans évaluation validée : 2.');
  });
});

describe('contrôle du texte', () => {
  const data = buildReportData(fixturePassport({ attended: [1], evaluated: [1], ct: { relationnel: [[1, 4]] } }), supports);
  const base = emptyContent(data);

  it('accepte un texte cohérent', () => {
    const content = { ...base, behaviour: { summary: 'x', themes: [{ theme: 'communication' as const, text: 'Prend la parole.', sessions: [1] }] } };
    expect(checkContent(content, data)).toEqual([]);
  });

  it('refuse une note écrite dans le texte, une compétence non observée commentée et une session non évaluée', () => {
    const content = {
      ...base,
      conclusion: 'Votre relationnel atteint 4/5.',
      skills: [...base.skills, { code: 'rigueur', observed: 'a', strengths: 'b', progress: 'c', professional: 'd' }],
      behaviour: { summary: '', themes: [{ theme: 'echec' as const, text: 'Persévère.', sessions: [3] }] },
    };
    const issues = checkContent(content, data).map((issue) => issue.path);
    expect(issues).toEqual(expect.arrayContaining(['conclusion', 'skills.1.code', 'behaviour.themes.0.sessions']));
  });
});
