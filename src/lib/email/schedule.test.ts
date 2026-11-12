import { describe, expect, it } from 'vitest';

import { addDays, idempotencyKeys, isUpcoming, parisDate, retryDelayMs, sessionChangeKind, sessionFingerprint, tomorrowInParis } from './schedule';

describe('dates à Paris', () => {
  it('donne la date locale de Paris, pas celle d’UTC', () => {
    // 23 h 30 UTC un 12 novembre = 0 h 30 le 13 à Paris (UTC+1).
    expect(parisDate(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-13');
    expect(tomorrowInParis(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-14');
    // Été (UTC+2) : 22 h 30 UTC = 0 h 30 le lendemain.
    expect(parisDate(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
  });

  it('passe correctement le changement d’heure de printemps (29 mars 2026)', () => {
    // Exécution planifiée à 16 h UTC la veille du changement : demain = dimanche 29 mars.
    expect(tomorrowInParis(new Date('2026-03-28T16:00:00Z'))).toBe('2026-03-29');
    // Le jour du changement (journée de 23 h) : demain = 30 mars.
    expect(tomorrowInParis(new Date('2026-03-29T16:00:00Z'))).toBe('2026-03-30');
    expect(tomorrowInParis(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-30');
  });

  it('passe correctement le changement d’heure d’automne (25 octobre 2026)', () => {
    expect(tomorrowInParis(new Date('2026-10-24T16:00:00Z'))).toBe('2026-10-25');
    // Journée de 25 h : 23 h 30 UTC le 25 = 0 h 30 le 26 à Paris (UTC+1).
    expect(tomorrowInParis(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-27');
    expect(tomorrowInParis(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-26');
  });

  it('ajoute des jours calendaires (fin de mois, année bissextile)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('considère comme à venir une séance du jour même', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    expect(isUpcoming('2026-11-12', now)).toBe(true);
    expect(isUpcoming('2026-11-11', now)).toBe(false);
    expect(isUpcoming(null, now)).toBe(false);
  });
});

describe('reprise des échecs', () => {
  it('allonge le délai et le plafonne', () => {
    expect(retryDelayMs(1)).toBe(5 * 60_000);
    expect(retryDelayMs(2)).toBe(10 * 60_000);
    expect(retryDelayMs(20)).toBe(6 * 3600_000);
  });
});

describe('idempotence', () => {
  const base = { scheduled_date: '2026-11-20', start_time: '09:00:00', end_time: '12:00:00', location: 'Salle A', status: 'planned' };

  it('produit des clés stables et distinctes par séance et par participant', () => {
    expect(idempotencyKeys.reminder('s1', 'p1', '2026-11-20')).toBe('reminder:s1:p1:2026-11-20');
    expect(idempotencyKeys.convocation('s1', 'p1')).toBe(idempotencyKeys.convocation('s1', 'p1'));
    expect(idempotencyKeys.convocation('s1', 'p1')).not.toBe(idempotencyKeys.convocation('s1', 'p2'));
  });

  it('ne change pas l’empreinte pour un format d’heure différent, la change pour un autre lieu', () => {
    expect(sessionFingerprint(base)).toBe(sessionFingerprint({ ...base, start_time: '09:00', end_time: '12:00' }));
    expect(sessionFingerprint(base)).not.toBe(sessionFingerprint({ ...base, location: 'Salle B' }));
    expect(idempotencyKeys.update('s1', 'p1', base)).toBe(idempotencyKeys.update('s1', 'p1', { ...base }));
  });

  it('détermine ce qu’il faut annoncer', () => {
    expect(sessionChangeKind(base, base)).toBeNull();
    expect(sessionChangeKind(base, { ...base, location: 'Salle B' })).toBe('updated');
    expect(sessionChangeKind(base, { ...base, status: 'cancelled' })).toBe('cancelled');
    expect(sessionChangeKind({ ...base, status: 'cancelled' }, { ...base, status: 'cancelled' })).toBeNull();
    expect(sessionChangeKind({ ...base, status: 'cancelled' }, base)).toBe('updated');
    expect(sessionChangeKind(base, { ...base, status: 'in_progress' })).toBeNull();
  });
});
