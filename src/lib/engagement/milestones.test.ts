import { describe, expect, it } from 'vitest';

import { completedJourneys, milestoneProgress, MILESTONE_TIERS } from './milestones';

describe('jalons d’une structure', () => {
  it('compte les jalons franchis et donne le suivant', () => {
    expect(milestoneProgress(11, MILESTONE_TIERS.personnes)).toEqual({ value: 11, reached: 2, tiers: 6, previous: 10, next: 25 });
    expect(milestoneProgress(0, MILESTONE_TIERS.personnes)).toMatchObject({ reached: 0, previous: 0, next: 1 });
  });

  it('au-delà du dernier jalon, il n’y a plus de suivant', () => {
    expect(milestoneProgress(400, MILESTONE_TIERS.parcours)).toMatchObject({ reached: 5, next: null, previous: 100 });
  });

  it('un parcours mené à terme exclut les abandons et les groupes inachevés', () => {
    expect(
      completedJourneys([
        { dropped: false, completedSessions: 6, totalSessions: 6, groupId: 'a' },
        { dropped: true, completedSessions: 6, totalSessions: 6, groupId: 'a' },
        { dropped: false, completedSessions: 3, totalSessions: 6, groupId: 'b' },
        { dropped: false, completedSessions: 0, totalSessions: 0, groupId: null },
      ]),
    ).toBe(1);
  });
});
