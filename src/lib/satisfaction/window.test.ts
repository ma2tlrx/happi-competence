import { describe, expect, it } from 'vitest';

import { addDays, programmeEnd, satisfactionWindow, todayInParis, type WindowGroup } from './window';

const sessions = (statuses: string[], start = '2026-03-02') =>
  statuses.map((status, index) => ({ number: index + 1, status, date: addDays(start, index * 7) }));

describe('fin du programme', () => {
  it('reste inconnue tant que la dernière séance n’est pas terminée', () => {
    expect(programmeEnd({ status: 'active', endDate: '2026-04-30', sessions: sessions(['completed', 'completed', 'planned']) })).toBeNull();
  });

  it('est la date de la dernière séance terminée, séances annulées ignorées', () => {
    const group: WindowGroup = { status: 'active', endDate: null, sessions: [...sessions(['completed', 'completed']), { number: 3, status: 'cancelled', date: '2026-05-01' }] };
    expect(programmeEnd(group)).toBe('2026-03-09');
  });

  it('se replie sur la date de clôture puis sur la fin du groupe', () => {
    expect(programmeEnd({ status: 'active', endDate: '2026-06-01', sessions: [{ number: 1, status: 'completed', date: null, completedAt: '2026-05-20T16:00:00Z' }] })).toBe('2026-05-20');
    expect(programmeEnd({ status: 'active', endDate: '2026-06-01', sessions: [{ number: 1, status: 'completed', date: null }] })).toBe('2026-06-01');
  });

  it('un groupe marqué terminé clôt le programme même sans séance terminée', () => {
    expect(programmeEnd({ status: 'completed', endDate: '2026-06-01', sessions: sessions(['completed', 'planned']) })).toBe('2026-06-01');
    expect(programmeEnd({ status: 'completed', endDate: null, sessions: [], updatedAt: '2026-06-03T10:00:00Z' })).toBe('2026-06-03');
  });
});

describe('ouverture des enquêtes', () => {
  const finished: WindowGroup = { status: 'active', endDate: null, sessions: sessions(['completed', 'completed'], '2026-01-05') };

  it('à chaud : fermée tant que le programme court', () => {
    expect(satisfactionWindow({ status: 'active', endDate: null, sessions: sessions(['completed', 'planned']) }, '2026-06-01')).toMatchObject({
      endDate: null,
      hotOpen: false,
      coldOpen: false,
    });
  });

  it('à chaud : ouverte le jour de la fin, jusqu’à la veille de l’ouverture à froid', () => {
    expect(satisfactionWindow(finished, '2026-01-12')).toMatchObject({ endDate: '2026-01-12', hotOpen: true, coldOpen: false, coldOpensOn: '2026-04-12' });
    expect(satisfactionWindow(finished, '2026-04-11')).toMatchObject({ hotOpen: true, coldOpen: false });
  });

  it('à froid : ouverte à partir de fin + 90 jours', () => {
    expect(satisfactionWindow(finished, '2026-04-12')).toMatchObject({ hotOpen: false, coldOpen: true });
    expect(satisfactionWindow(finished, '2027-01-01')).toMatchObject({ hotOpen: false, coldOpen: true });
  });

  it('calcule les dates sans effet des changements d’heure', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 90)).toBe('2027-01-22');
  });

  it('date du jour à Paris', () => {
    expect(todayInParis(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
  });
});
