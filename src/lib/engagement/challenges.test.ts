import { describe, expect, it } from 'vitest';

import { buildChallenges, nextChallenge, starsOf, toCelebrate, type EngagementFacts } from './challenges';
import { buildCollection, buildJourney } from './journey';

const base: EngagementFacts = {
  hasGroup: true,
  dropped: false,
  totalSessions: 6,
  completedSessions: 0,
  attendedSessions: 0,
  selfAssessmentDone: false,
  finalSelfAssessment: 'no_initial',
  observedSkills: 0,
  skillsTotal: 34,
  progressions: 0,
  surveysAvailable: 0,
  surveysAnswered: 0,
  sharesCreated: 0,
  gamesPlayed: 0,
};

const byId = (facts: Partial<EngagementFacts>) => new Map(buildChallenges({ ...base, ...facts }).map((item) => [item.id, item]));

describe('défis du participant', () => {
  it('un nouveau participant n’a rien réussi et commence par son auto-évaluation', () => {
    const challenges = buildChallenges(base);
    expect(challenges.every((item) => !item.done)).toBe(true);
    expect(starsOf(challenges).earned).toBe(0);
    expect(nextChallenge(challenges)?.id).toBe('point-de-depart');
  });

  it('une absence ralentit un défi de présence sans jamais le rendre impossible', () => {
    // Trois sessions passées, une seule suivie : « À mi-chemin » reste atteignable.
    const challenges = byId({ completedSessions: 3, attendedSessions: 1 });
    expect(challenges.get('premier-rendez-vous')?.done).toBe(true);
    expect(challenges.get('a-mi-chemin')).toMatchObject({ done: false, current: 1, target: 3, available: true });
  });

  it('« Ligne d’arrivée » se gagne en allant au bout, même avec des absences, mais pas après un abandon', () => {
    expect(byId({ completedSessions: 6, attendedSessions: 4 }).get('ligne-d-arrivee')?.done).toBe(true);
    expect(byId({ completedSessions: 5, attendedSessions: 5 }).get('ligne-d-arrivee')?.done).toBe(false);
    const dropped = byId({ completedSessions: 6, attendedSessions: 2, dropped: true }).get('ligne-d-arrivee');
    expect(dropped).toMatchObject({ done: false, available: false, lockedReason: 'Votre parcours a été interrompu.' });
  });

  it('une compétence révélée compte quel que soit son niveau, et les paliers suivent le nombre de compétences observées', () => {
    const challenges = byId({ observedSkills: 12 });
    expect(challenges.get('premiere-revelee')?.done).toBe(true);
    expect(challenges.get('collection-en-marche')?.done).toBe(true);
    expect(challenges.get('belle-collection')).toMatchObject({ done: false, current: 12, target: 20 });
  });

  it('les paliers de collection ne dépassent jamais le nombre de compétences du référentiel', () => {
    const challenges = byId({ observedSkills: 8, skillsTotal: 8 });
    expect(challenges.get('belle-collection')).toMatchObject({ done: true, target: 8 });
  });

  it('les défis qui dépendent d’une étape à venir sont verrouillés avec leur raison', () => {
    const challenges = byId({});
    expect(challenges.get('regard-final')).toMatchObject({ available: false, lockedReason: 'S’ouvre à la dernière session.' });
    expect(challenges.get('mon-avis-compte')).toMatchObject({ available: false });
    expect(challenges.get('montrer-mes-competences')).toMatchObject({ available: false });
  });

  it('la prochaine étape suit le parcours : auto-évaluation finale ouverte, puis avis attendu', () => {
    const challenges = buildChallenges({ ...base, selfAssessmentDone: true, finalSelfAssessment: 'open', surveysAvailable: 1, observedSkills: 5 });
    expect(nextChallenge(challenges)?.id).toBe('regard-final');
    const later = buildChallenges({ ...base, selfAssessmentDone: true, finalSelfAssessment: 'completed', surveysAvailable: 1, observedSkills: 5 });
    expect(nextChallenge(later)?.id).toBe('mon-avis-compte');
  });

  it('aucune prochaine étape proposée quand rien ne dépend de la personne', () => {
    const challenges = buildChallenges({ ...base, hasGroup: false, selfAssessmentDone: true });
    expect(nextChallenge(challenges)).toBeNull();
  });

  it('les étoiles comptent les défis réussis, au total fixe', () => {
    const all = buildChallenges({
      ...base,
      completedSessions: 6,
      attendedSessions: 6,
      selfAssessmentDone: true,
      finalSelfAssessment: 'completed',
      observedSkills: 34,
      progressions: 3,
      surveysAvailable: 1,
      surveysAnswered: 1,
      sharesCreated: 1,
      gamesPlayed: 1,
    });
    const stars = starsOf(all);
    expect(stars.done).toBe(stars.count);
    expect(stars.earned).toBe(stars.total);
    expect(stars.total).toBe(21);
  });

  it('une seule célébration par visite, la plus difficile d’abord, jamais deux fois', () => {
    const challenges = buildChallenges({ ...base, selfAssessmentDone: true, attendedSessions: 1, completedSessions: 1, observedSkills: 1 });
    const first = toCelebrate(challenges, new Set());
    expect(first?.id).toBe('point-de-depart');
    expect(toCelebrate(challenges, new Set(challenges.filter((item) => item.done).map((item) => item.id)))).toBeNull();
  });
});

describe('carte du parcours', () => {
  const session = (number: number, status: 'planned' | 'in_progress' | 'completed' | 'cancelled', attendance: string | null = null) => ({
    number,
    title: `Session ${number}`,
    date: null,
    status,
    attendance,
  });

  it('distingue les sessions suivies, passées, en cours et à venir, sans reproche pour une absence', () => {
    const { stations, currentNumber, finished } = buildJourney(
      [session(1, 'completed', 'present'), session(2, 'completed', 'absent'), session(3, 'completed', 'late'), session(4, 'planned'), session(5, 'planned'), session(6, 'planned')],
      6,
    );
    expect(stations.map((station) => station.state)).toEqual(['attended', 'passed', 'attended', 'current', 'upcoming', 'upcoming']);
    expect(currentNumber).toBe(4);
    expect(finished).toBe(false);
    expect(stations.at(-1)?.isLast).toBe(true);
  });

  it('sans groupe, affiche les six étapes à venir', () => {
    const { stations, currentNumber } = buildJourney([], 6);
    expect(stations).toHaveLength(6);
    expect(stations.every((station) => station.state === 'upcoming' && station.title === null)).toBe(true);
    expect(currentNumber).toBeNull();
  });

  it('une session en cours prime sur la prochaine prévue, et un parcours terminé est signalé', () => {
    expect(buildJourney([session(1, 'completed', 'present'), session(2, 'in_progress'), session(3, 'planned')], 3).currentNumber).toBe(2);
    expect(buildJourney([session(1, 'completed', 'present'), session(2, 'completed', 'excused'), session(3, 'cancelled')], 3).finished).toBe(true);
  });
});

describe('album des compétences', () => {
  it('révèle une compétence dès sa première observation, sans tenir compte du niveau', () => {
    const collection = buildCollection([
      {
        code: 'transversal',
        name: 'Compétences transversales',
        shortName: 'Transversales',
        skills: [
          { code: 'a', name: 'A', summary: { value: 1, delta: null } },
          { code: 'b', name: 'B', summary: { value: null, delta: null } },
          { code: 'c', name: 'C', summary: { value: 3, delta: 1 } },
        ],
      },
    ]);
    expect(collection).toMatchObject({ revealed: 2, total: 3, progressions: 1 });
    expect(collection.groups[0]?.skills.map((skill) => skill.revealed)).toEqual([true, false, true]);
    expect(collection.groups[0]?.skills[0]?.href).toBe('/participant/competences-transversales#competence-a');
  });
});
