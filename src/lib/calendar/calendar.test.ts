import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  displayStatus,
  groupByDay,
  monthGrid,
  parisLocalToUtc,
  parisNow,
  rangeFor,
  shiftAnchor,
  startOfWeek,
  weekDays,
  type CalendarEvent,
} from './calendar';

const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1',
  number: 1,
  title: 'Programme',
  date: '2026-11-24',
  startTime: '09:00',
  endTime: '12:00',
  location: null,
  status: 'planned',
  groupId: 'g1',
  groupName: 'Groupe 1',
  organizationName: null,
  trainerNames: [],
  href: '/x',
  ...patch,
});

describe('dates de calendrier', () => {
  it('commence la semaine le lundi', () => {
    expect(startOfWeek('2026-11-24')).toBe('2026-11-23'); // mardi
    expect(startOfWeek('2026-11-23')).toBe('2026-11-23'); // lundi
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23'); // dimanche
  });

  it('ajoute des jours et des mois sans dérive (fins de mois, années)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('construit la grille d’un mois en semaines complètes', () => {
    const weeks = monthGrid('2026-11-24');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]![0]!.date).toBe('2026-10-26'); // novembre 2026 commence un dimanche
    expect(weeks.at(-1)!.at(-1)!.date).toBe('2026-12-06');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]![0]!.inMonth).toBe(false);
    expect(weeks[0]![6]!.date).toBe('2026-11-01');
    expect(weeks[0]![6]!.inMonth).toBe(true);
  });

  it('gère une semaine à cheval sur deux mois et un mois de quatre semaines', () => {
    const feb = monthGrid('2027-02-10'); // février 2027 : du lundi 1er au dimanche 28
    expect(feb).toHaveLength(4);
    expect(feb[0]![0]!.date).toBe('2027-02-01');
    expect(feb.flat().every((day) => day.inMonth)).toBe(true);
    expect(weekDays('2026-12-30')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  });

  it('donne la plage à lire selon la vue', () => {
    expect(rangeFor('semaine', '2026-11-24')).toEqual({ from: '2026-11-23', to: '2026-11-29' });
    expect(rangeFor('mois', '2026-11-24')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(rangeFor('agenda', '2026-11-24')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });

  it('navigue d’une semaine ou d’un mois', () => {
    expect(shiftAnchor('semaine', '2026-11-24', 1)).toBe('2026-12-01');
    expect(shiftAnchor('semaine', '2026-11-24', -1)).toBe('2026-11-17');
    expect(shiftAnchor('mois', '2026-11-24', 1)).toBe('2026-12-01');
    expect(shiftAnchor('agenda', '2026-01-24', -1)).toBe('2025-12-01');
  });
});

describe('fuseau Europe/Paris', () => {
  it('donne la date et l’heure de Paris, y compris autour de minuit', () => {
    expect(parisNow(new Date('2026-11-23T23:30:00Z'))).toEqual({ date: '2026-11-24', time: '00:30' });
    expect(parisNow(new Date('2026-07-01T10:05:00Z'))).toEqual({ date: '2026-07-01', time: '12:05' });
  });

  it('convertit l’heure de Paris en UTC (heure d’hiver et d’été)', () => {
    expect(parisLocalToUtc('2026-11-24', '09:00').toISOString()).toBe('2026-11-24T08:00:00.000Z');
    expect(parisLocalToUtc('2026-07-14', '09:00').toISOString()).toBe('2026-07-14T07:00:00.000Z');
  });

  it('respecte les changements d’heure (fin octobre, fin mars)', () => {
    // 25 octobre 2026 : retour à l’heure d’hiver à 3 h.
    expect(parisLocalToUtc('2026-10-24', '10:00').toISOString()).toBe('2026-10-24T08:00:00.000Z');
    expect(parisLocalToUtc('2026-10-25', '10:00').toISOString()).toBe('2026-10-25T09:00:00.000Z');
    // 29 mars 2026 : passage à l’heure d’été à 2 h.
    expect(parisLocalToUtc('2026-03-28', '10:00').toISOString()).toBe('2026-03-28T09:00:00.000Z');
    expect(parisLocalToUtc('2026-03-29', '10:00').toISOString()).toBe('2026-03-29T08:00:00.000Z');
  });
});

describe('statut affiché', () => {
  const at = (iso: string) => parisNow(new Date(iso));
  it('garde annulée, terminée et en cours de la base', () => {
    expect(displayStatus(event({ status: 'cancelled' }), at('2026-11-30T10:00:00Z'))).toBe('cancelled');
    expect(displayStatus(event({ status: 'completed', date: '2026-12-30' }), at('2026-11-23T10:00:00Z'))).toBe('completed');
    expect(displayStatus(event({ status: 'in_progress' }), at('2026-11-23T10:00:00Z'))).toBe('in_progress');
  });

  it('déduit de l’heure le statut d’une session planifiée', () => {
    const planned = event({ date: '2026-11-24', startTime: '09:00', endTime: '12:00' });
    expect(displayStatus(planned, at('2026-11-23T10:00:00Z'))).toBe('upcoming');
    expect(displayStatus(planned, at('2026-11-24T07:00:00Z'))).toBe('upcoming'); // 08:00 à Paris
    expect(displayStatus(planned, at('2026-11-24T08:30:00Z'))).toBe('in_progress'); // 09:30
    expect(displayStatus(planned, at('2026-11-24T11:30:00Z'))).toBe('completed'); // 12:30
    expect(displayStatus(planned, at('2026-11-25T08:00:00Z'))).toBe('completed');
  });

  it('traite une session du jour sans horaire comme en cours', () => {
    expect(displayStatus(event({ startTime: null, endTime: null }), at('2026-11-24T10:00:00Z'))).toBe('in_progress');
  });
});

describe('regroupement par jour', () => {
  it('trie par heure puis par numéro, sessions sans horaire en tête du jour', () => {
    const grouped = groupByDay([
      event({ id: 'b', date: '2026-11-24', startTime: '14:00', number: 2 }),
      event({ id: 'a', date: '2026-11-24', startTime: '09:00', number: 1 }),
      event({ id: 'c', date: '2026-11-25', startTime: null, endTime: null }),
      event({ id: 'd', date: '2026-11-24', startTime: null, endTime: null, number: 3 }),
    ]);
    expect(grouped.get('2026-11-24')!.map((e) => e.id)).toEqual(['d', 'a', 'b']);
    expect(grouped.get('2026-11-25')!.map((e) => e.id)).toEqual(['c']);
  });
});
