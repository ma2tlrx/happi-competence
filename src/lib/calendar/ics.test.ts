import { describe, expect, it } from 'vitest';

import type { CalendarEvent } from './calendar';
import { buildIcs, escapeIcsText, foldLine } from './ics';

const base: CalendarEvent = {
  id: 'abc',
  number: 3,
  title: 'Session 3 — Prise de parole, avec virgule; et point-virgule',
  date: '2026-11-24',
  startTime: '09:00',
  endTime: '12:00',
  location: 'Salle des Tilleuls',
  status: 'planned',
  groupId: 'g',
  groupName: 'Groupe A',
  organizationName: 'Mission Locale',
  trainerNames: [],
  href: '/x',
};
const stamp = new Date('2026-11-20T10:00:00Z');

describe('export ICS', () => {
  it('échappe le texte (virgules, points-virgules, retours à la ligne, barres obliques)', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('plie les lignes de plus de 75 octets sans couper un caractère', () => {
    const line = `SUMMARY:${'é'.repeat(80)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.map((part, index) => (index ? part.slice(1) : part)).join('')).toBe(line);
  });

  it('produit un calendrier avec des heures UTC converties depuis Paris', () => {
    const ics = buildIcs([base], stamp);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261124T080000Z');
    expect(ics).toContain('DTEND:20261124T110000Z');
    expect(ics).toContain('UID:session-abc@happi-competence');
    expect(ics).toContain('DTSTAMP:20261120T100000Z');
    expect(ics).toContain('LOCATION:Salle des Tilleuls');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('marque une session annulée et traite l’heure d’été', () => {
    const ics = buildIcs([{ ...base, status: 'cancelled', date: '2026-07-14' }], stamp);
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('DTSTART:20260714T070000Z');
  });

  it('sans horaire : événement sur la journée entière (fin exclusive)', () => {
    const ics = buildIcs([{ ...base, startTime: null, endTime: null }], stamp);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261124');
    expect(ics).toContain('DTEND;VALUE=DATE:20261125');
  });

  it('sans heure de fin : une heure par défaut', () => {
    const ics = buildIcs([{ ...base, endTime: null }], stamp);
    expect(ics).toContain('DTEND:20261124T090000Z');
  });
});
