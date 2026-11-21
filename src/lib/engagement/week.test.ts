import { describe, expect, it } from 'vitest';

import { saisieProgress, startOfWeekParis } from './week';

describe('semaine du formateur', () => {
  it('commence le lundi à minuit, heure de Paris (hiver comme été)', () => {
    // Jeudi 20 novembre 2026, 10 h UTC : lundi 16 novembre, Paris en UTC+1.
    expect(startOfWeekParis(new Date('2026-11-20T10:00:00Z'))).toEqual({ date: '2026-11-16', iso: '2026-11-16T00:00:00+01:00' });
    // Mercredi 15 juillet 2026 : lundi 13 juillet, Paris en UTC+2.
    expect(startOfWeekParis(new Date('2026-07-15T08:00:00Z'))).toEqual({ date: '2026-07-13', iso: '2026-07-13T00:00:00+02:00' });
  });

  it('un dimanche soir à Paris appartient encore à la semaine qui finit', () => {
    // Dimanche 22 novembre 2026, 22 h 30 à Paris (21 h 30 UTC).
    expect(startOfWeekParis(new Date('2026-11-22T21:30:00Z')).date).toBe('2026-11-16');
    // Lundi 23 novembre, 0 h 30 à Paris (dimanche 23 h 30 UTC) : nouvelle semaine.
    expect(startOfWeekParis(new Date('2026-11-22T23:30:00Z')).date).toBe('2026-11-23');
  });

  it('ne donne pas de pourcentage quand il n’y avait rien à faire', () => {
    expect(saisieProgress(0, 0)).toBeNull();
    expect(saisieProgress(8, 3)).toBe(73);
    expect(saisieProgress(5, 0)).toBe(100);
  });
});
