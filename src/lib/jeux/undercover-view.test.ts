import { describe, expect, it } from 'vitest';

import type { PublicGame, PublicPlayer } from './client-undercover';
import { nicknameError, normalizeCode, parseIdentity } from './client-undercover';
import { activePlayers, activeSpeakingOrder, currentSpeaker, isLastSpeaker, pluralFr, tallyVotes, voteKey } from './undercover-view';

function player(id: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id, nickname: id.toUpperCase(), isHost: false, isEliminated: false, joinedAt: 0, ...extra };
}

function game(extra: Partial<PublicGame> = {}): PublicGame {
  const players = [player('h', { isHost: true }), player('a'), player('b'), player('c', { isEliminated: true }), player('d')];
  return {
    gameId: 'g',
    code: 'ABC234',
    status: 'discussion',
    hostId: 'h',
    players: Object.fromEntries(players.map((p) => [p.id, p])),
    playerCount: players.length,
    voteCount: 0,
    includeMisterWhite: true,
    maxPlayers: 8,
    currentRound: 2,
    roundResults: [],
    speakingOrder: ['b', 'c', 'a', 'd'],
    currentSpeakerIndex: 0,
    createdAt: 0,
    ...extra,
  };
}

describe('affichage d’une partie Undercover', () => {
  it('ne compte ni l’animateur ni les éliminés parmi les joueurs actifs', () => {
    expect(activePlayers(game()).map((p) => p.id).sort()).toEqual(['a', 'b', 'd']);
  });

  it('retire les éliminés de l’ordre de parole', () => {
    expect(activeSpeakingOrder(game())).toEqual(['b', 'a', 'd']);
  });

  it('désigne l’orateur courant et le dernier orateur', () => {
    expect(currentSpeaker(game())?.id).toBe('b');
    expect(isLastSpeaker(game())).toBe(false);
    expect(isLastSpeaker(game({ currentSpeakerIndex: 2 }))).toBe(true);
    expect(currentSpeaker(game({ currentSpeakerIndex: 9 }))).toBeNull();
  });

  it('décompte les voix du plus voté au moins voté', () => {
    const lines = tallyVotes(game(), { votes: { a: 'b', b: 'd', d: 'b' } });
    expect(lines).toEqual([
      { targetId: 'b', nickname: 'B', count: 2 },
      { targetId: 'd', nickname: 'D', count: 1 },
    ]);
  });

  it('change l’identifiant du tour de vote à chaque manche et à chaque départage', () => {
    const first = voteKey(game());
    expect(voteKey(game({ currentRound: 3 }))).not.toBe(first);
    expect(voteKey(game({ tiebreakPlayerIds: ['a', 'b'] }))).not.toBe(first);
  });

  it('accorde les mots au pluriel', () => {
    expect(pluralFr(1, 'vote')).toBe('1 vote');
    expect(pluralFr(2, 'vote')).toBe('2 votes');
  });
});

describe('saisie à l’entrée d’une partie', () => {
  it('met le code en majuscules, sans caractère parasite, sur six caractères', () => {
    expect(normalizeCode(' ab-c 234xyz')).toBe('ABC234');
  });

  it('exige un pseudo de 2 à 20 caractères', () => {
    expect(nicknameError('a')).toMatch(/au moins 2/);
    expect(nicknameError('  ')).toMatch(/au moins 2/);
    expect(nicknameError('x'.repeat(21))).toMatch(/dépasser 20/);
    expect(nicknameError('Léa')).toBeNull();
  });

  it('relit une identité enregistrée et ignore une valeur illisible', () => {
    expect(parseIdentity(JSON.stringify({ playerId: 'p', token: 't', host: true }))).toEqual({ playerId: 'p', token: 't', host: true });
    expect(parseIdentity(JSON.stringify({ playerId: 'p', token: 't' }))?.host).toBe(false);
    expect(parseIdentity('pas du json')).toBeNull();
    expect(parseIdentity(null)).toBeNull();
  });
});
