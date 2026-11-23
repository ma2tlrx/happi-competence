import { describe, expect, it } from 'vitest';

import {
  displayName,
  enqueueMark,
  flushQueue,
  formatMarkContext,
  groupMarksByParticipant,
  parseQueue,
  removeFromQueue,
  type LiveMark,
  type PendingMark,
} from './live-marks';

const mark = (patch: Partial<LiveMark> = {}): LiveMark => ({
  id: crypto.randomUUID(),
  participantId: 'p1',
  skillCode: null,
  blockIndex: null,
  blockTitle: null,
  elapsedSeconds: null,
  createdAt: '2026-11-24T10:00:00Z',
  ...patch,
});

describe('displayName', () => {
  it('prénom et initiale du nom', () => {
    expect(displayName('Léa', 'Dupont')).toBe('Léa D.');
    expect(displayName('  Jean-Paul ', 'de la Tour')).toBe('Jean-Paul D.');
  });
  it('tolère un nom vide', () => {
    expect(displayName('Léa', '')).toBe('Léa');
  });
});

describe('formatMarkContext', () => {
  it('bloc, titre et minutes', () => {
    expect(formatMarkContext({ blockIndex: 2, blockTitle: 'Le jeu de la montgolfière', elapsedSeconds: 14 * 60 + 20 })).toBe('pendant « Le jeu de la montgolfière » (bloc 3), à 14 min');
  });
  it('sans chronomètre', () => {
    expect(formatMarkContext({ blockIndex: 0, blockTitle: 'Accueil', elapsedSeconds: null })).toBe('pendant « Accueil » (bloc 1)');
  });
  it('sans bloc, seulement le temps', () => {
    expect(formatMarkContext({ blockIndex: null, blockTitle: null, elapsedSeconds: 59 })).toBe('à 0 min');
  });
  it('au-delà d’une heure', () => {
    expect(formatMarkContext({ blockIndex: null, blockTitle: null, elapsedSeconds: 3725 })).toBe('à 1 h 02');
  });
  it('rien à dire sans repère', () => {
    expect(formatMarkContext({ blockIndex: null, blockTitle: null, elapsedSeconds: null })).toBe('');
  });
});

describe('groupMarksByParticipant', () => {
  it('regroupe par participant puis par compétence, général en premier', () => {
    const marks = [
      mark({ participantId: 'a', skillCode: 'esprit_equipe', createdAt: '2026-11-24T10:05:00Z' }),
      mark({ participantId: 'a', skillCode: null, createdAt: '2026-11-24T10:01:00Z' }),
      mark({ participantId: 'a', skillCode: 'esprit_equipe', createdAt: '2026-11-24T10:02:00Z' }),
      mark({ participantId: 'b', skillCode: 'ecoute' }),
    ];
    const grouped = groupMarksByParticipant(marks);
    expect(Object.keys(grouped)).toEqual(['a', 'b']);
    expect(grouped.a.total).toBe(3);
    expect(grouped.a.bySkill.map((entry) => entry.skillCode)).toEqual([null, 'esprit_equipe']);
    expect(grouped.a.bySkill[1]!.marks.map((m) => m.createdAt)).toEqual(['2026-11-24T10:02:00Z', '2026-11-24T10:05:00Z']);
  });
  it('liste vide', () => {
    expect(groupMarksByParticipant([])).toEqual({});
  });
});

describe('file hors ligne', () => {
  const pending = (id: string): PendingMark => ({ id, participantId: 'p1', skillCode: null, blockIndex: 1, blockTitle: 'X', elapsedSeconds: 10, clientAt: 1 });

  it('ajoute sans doublon et sans perte', () => {
    let queue: PendingMark[] = [];
    queue = enqueueMark(queue, pending('a'));
    queue = enqueueMark(queue, pending('b'));
    queue = enqueueMark(queue, pending('a'));
    expect(queue.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('retire un élément (annulation avant envoi)', () => {
    expect(removeFromQueue([pending('a'), pending('b')], 'a').map((item) => item.id)).toEqual(['b']);
  });

  it('parseQueue ignore le contenu invalide', () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue('pas du json')).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
    expect(parseQueue(JSON.stringify([pending('a'), { id: 3 }]))).toEqual([pending('a')]);
  });

  it('flush : garde en file ce qui échoue, retire ce qui réussit, ne perd rien', async () => {
    const sent: string[] = [];
    const result = await flushQueue([pending('a'), pending('b'), pending('c')], async (item) => {
      if (item.id === 'b') return 'retry';
      sent.push(item.id);
      return 'sent';
    });
    expect(sent).toEqual(['a', 'c']);
    expect(result.map((item) => item.id)).toEqual(['b']);
  });

  it('flush : un refus définitif (donnée invalide) sort de la file', async () => {
    const result = await flushQueue([pending('a')], async () => 'rejected');
    expect(result).toEqual([]);
  });

  it('flush : une exception compte comme à réessayer', async () => {
    const result = await flushQueue([pending('a')], async () => {
      throw new Error('réseau');
    });
    expect(result.map((item) => item.id)).toEqual(['a']);
  });
});
