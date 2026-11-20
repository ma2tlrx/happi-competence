import { describe, expect, it } from 'vitest';

import {
  advanceSpeaker,
  assignRoles,
  checkWinCondition,
  joinGame,
  myRole,
  nextRound,
  newUndercoverGame,
  replayGame,
  resolveVotes,
  spyGuess,
  startGame,
  startVoting,
  submitVote,
  toPublicState,
  type UndercoverState,
} from './undercover-engine';

/** Générateur déterministe (suite congruentielle) pour des tirages reproductibles. */
function seeded(seed = 7) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

const words = { civil: 'Chat', undercover: 'Chien' };

/** Salon avec un animateur et `count` joueurs j1..jn (compte « u-jN »). */
function lobby(count: number, includeMisterWhite = true): UndercoverState {
  const s = newUndercoverGame({ gameId: 'g1', code: 'ABC234', hostId: 'host', hostNickname: 'Animateur', customWordPair: words, includeMisterWhite, now: 1 });
  for (let i = 1; i <= count; i++) joinGame(s, { id: `j${i}`, nickname: `Joueur${i}`, userId: `u-j${i}`, participantId: `part-j${i}`, now: 2 });
  return s;
}

function started(count: number, includeMisterWhite = true, rng = seeded()): UndercoverState {
  const s = lobby(count, includeMisterWhite);
  expect(startGame(s, 10, rng).ok).toBe(true);
  return s;
}

function toVoting(s: UndercoverState) {
  nextRound(s);
  expect(startVoting(s).ok).toBe(true);
}

const ids = (s: UndercoverState, role: string) => Object.values(s.players).filter((p) => p.role === role).map((p) => p.id);
const vote = (s: UndercoverState, voter: string, target: string) => submitVote(s, voter, target, `u-${voter}`);

describe('salon', () => {
  it('limite à 8 joueurs (animateur compris) et refuse les pseudos en double', () => {
    const s = lobby(7);
    expect(joinGame(s, { id: 'x', nickname: 'Joueur1', userId: 'u-x', now: 3 })).toEqual({ ok: false, code: 'full' });
    const t = lobby(2);
    expect(joinGame(t, { id: 'x', nickname: 'joueur1', userId: 'u-x', now: 3 })).toEqual({ ok: false, code: 'nickname_taken' });
  });
  it('refuse l’entrée une fois la partie commencée', () => {
    const s = started(4);
    expect(joinGame(s, { id: 'x', nickname: 'Nouveau', userId: 'u-x', now: 3 })).toEqual({ ok: false, code: 'already_started' });
  });
  it('exige trois joueurs hors animateur', () => {
    expect(startGame(lobby(2), 10)).toEqual({ ok: false, code: 'not_enough_players' });
  });
});

describe('distribution des rôles', () => {
  it('3 joueurs : un undercover et deux civils, pas de Fourmi Caché', () => {
    const s = started(3);
    expect(ids(s, 'undercover')).toHaveLength(1);
    expect(ids(s, 'civil')).toHaveLength(2);
    expect(ids(s, 'spy')).toHaveLength(0);
  });
  it('4 joueurs ou plus : un Fourmi Caché sans mot', () => {
    const s = started(5);
    expect(ids(s, 'spy')).toHaveLength(1);
    expect(s.players[ids(s, 'spy')[0]].word).toBeUndefined();
    expect(ids(s, 'civil')).toHaveLength(3);
  });
  it('sans option « Fourmi Caché », aucun n’est distribué', () => {
    expect(ids(started(6, false), 'spy')).toHaveLength(0);
  });
  it('l’animateur ne reçoit aucun rôle', () => {
    expect(started(4).players.host.role).toBeUndefined();
  });
  it('les mots sont les bons : civils et undercover', () => {
    const roles = assignRoles(['a', 'b', 'c', 'd'], words, true, seeded(3));
    const civils = Object.values(roles).filter((r) => r.role === 'civil');
    expect(civils.every((r) => r.word === 'Chat')).toBe(true);
    expect(Object.values(roles).find((r) => r.role === 'undercover')?.word).toBe('Chien');
  });
});

describe('vote : validité', () => {
  it('refuse hors phase de vote, avec un mauvais jeton, pour soi-même, pour l’animateur', () => {
    const s = started(4);
    expect(vote(s, 'j1', 'j2')).toEqual({ ok: false, code: 'bad_phase' });
    toVoting(s);
    expect(submitVote(s, 'j1', 'j2', 'mauvais')).toEqual({ ok: false, code: 'forbidden' });
    expect(vote(s, 'j1', 'j1')).toEqual({ ok: false, code: 'invalid_vote' });
    expect(vote(s, 'j1', 'host')).toEqual({ ok: false, code: 'invalid_vote' });
    expect(submitVote(s, 'host', 'j2', 'u-host')).toEqual({ ok: false, code: 'forbidden' });
  });
  it('indique quand tout le monde a voté, et permet de changer son vote', () => {
    const s = started(3);
    toVoting(s);
    expect(vote(s, 'j1', 'j2')).toMatchObject({ result: { allVoted: false } });
    vote(s, 'j2', 'j3');
    vote(s, 'j1', 'j3');
    expect(s.votes.j1).toBe('j3');
    expect(vote(s, 'j3', 'j1')).toMatchObject({ result: { allVoted: true } });
  });
  it('un joueur éliminé ne vote plus et ne peut plus être désigné', () => {
    const s = started(5);
    toVoting(s);
    for (const v of ['j1', 'j2', 'j3', 'j4', 'j5']) vote(s, v, v === 'j5' ? 'j4' : 'j5');
    resolveVotes(s, 20, seeded());
    expect(s.players.j5.isEliminated).toBe(true);
    nextRound(s);
    startVoting(s);
    expect(vote(s, 'j5', 'j1')).toEqual({ ok: false, code: 'invalid_vote' });
    expect(vote(s, 'j1', 'j5')).toEqual({ ok: false, code: 'invalid_vote' });
  });
});

describe('dépouillement et départage', () => {
  it('élimine le joueur le plus voté et publie le résultat du tour', () => {
    const s = started(5);
    toVoting(s);
    for (const v of ['j1', 'j2', 'j3']) vote(s, v, 'j5');
    vote(s, 'j4', 'j1');
    vote(s, 'j5', 'j1');
    expect(resolveVotes(s, 20, seeded())).toMatchObject({ ok: true, result: { tie: false } });
    expect(s.roundResults).toHaveLength(1);
    expect(s.roundResults[0]).toMatchObject({ eliminatedId: 'j5', wasTie: false, roundNumber: 1 });
    expect(s.votes).toEqual({});
  });

  it('égalité au premier tour : nouveau vote limité aux joueurs à égalité', () => {
    const s = started(4);
    toVoting(s);
    // Égalité 2-2 entre j3 et j4.
    s.votes = { j1: 'j3', j2: 'j3', j3: 'j4', j4: 'j4' };
    const r = resolveVotes(s, 20, seeded());
    expect(r).toMatchObject({ ok: true, result: { tie: true } });
    expect([...(s.tiebreakPlayerIds ?? [])].sort()).toEqual(['j3', 'j4']);
    expect(s.status).toBe('voting');
    expect(s.votes).toEqual({});
    expect(s.roundResults).toHaveLength(0);
    // Pendant le départage, on ne peut désigner qu'un joueur à égalité.
    expect(vote(s, 'j1', 'j2')).toEqual({ ok: false, code: 'invalid_vote' });
    expect(vote(s, 'j1', 'j3').ok).toBe(true);
  });

  it('égalité au second tour : tirage au sort entre les joueurs à égalité', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = started(4);
      toVoting(s);
      s.votes = { j1: 'j3', j2: 'j3', j3: 'j4', j4: 'j4' };
      resolveVotes(s, 20, seeded(seed));
      s.votes = { j1: 'j3', j2: 'j4' };
      const r = resolveVotes(s, 21, seeded(seed));
      expect(r).toMatchObject({ ok: true, result: { tie: false } });
      expect(s.roundResults[0].wasTie).toBe(true);
      expect(['j3', 'j4']).toContain(s.roundResults[0].eliminatedId);
      expect(s.tiebreakPlayerIds).toBeUndefined();
    }
  });

  it('le tirage au sort peut désigner chacun des deux joueurs à égalité', () => {
    const picked = new Set<string | null>();
    for (const draw of [0.1, 0.9]) {
      const s = started(4);
      toVoting(s);
      s.tiebreakPlayerIds = ['j3', 'j4'];
      s.votes = { j1: 'j3', j2: 'j4' };
      resolveVotes(s, 20, () => draw);
      picked.add(s.roundResults[0].eliminatedId);
    }
    expect(picked).toEqual(new Set(['j3', 'j4']));
  });

  it('personne n’a voté : le jeu ne boucle plus, il tire au sort après un revote', () => {
    const s = started(5);
    toVoting(s);
    expect(resolveVotes(s, 20, seeded())).toMatchObject({ result: { tie: true } });
    expect(s.tiebreakPlayerIds).toHaveLength(5);
    const second = resolveVotes(s, 21, seeded());
    expect(second).toMatchObject({ ok: true, result: { tie: false } });
    expect(s.roundResults[0].eliminatedId).not.toBeNull();
  });

  it('refuse de dépouiller hors phase de vote', () => {
    expect(resolveVotes(started(4), 20)).toEqual({ ok: false, code: 'bad_phase' });
  });
});

describe('victoire', () => {
  const fresh = () => {
    const s = started(5);
    toVoting(s);
    return s;
  };
  const eliminate = (s: UndercoverState, target: string) => {
    s.votes = Object.fromEntries(Object.values(s.players).filter((p) => !p.isHost && !p.isEliminated && p.id !== target).map((p) => [p.id, target]));
    return resolveVotes(s, 30, seeded());
  };

  it('les civils gagnent quand plus d’undercover ni de Fourmi Caché ne reste', () => {
    const s = fresh();
    const under = ids(s, 'undercover')[0];
    const spy = ids(s, 'spy')[0];
    eliminate(s, under);
    expect(s.status).toBe('vote_result');
    nextRound(s);
    startVoting(s);
    eliminate(s, spy);
    // Le Fourmi Caché éliminé : la partie est jouée (civils gagnants) sans devinette.
    expect(s.status).toBe('game_over');
    expect(s.winner).toBe('civils');
    expect(s.winnerIds?.every((id) => s.players[id].role === 'civil')).toBe(true);
  });

  it('le Fourmi Caché éliminé tente de deviner quand la partie continue', () => {
    const s = fresh();
    const spy = ids(s, 'spy')[0];
    eliminate(s, spy);
    expect(s.status).toBe('spy_guess');
    expect(spyGuess(s, spy, 'u-mauvais', 'Chat', 40)).toEqual({ ok: false, code: 'forbidden' });
    const civil = ids(s, 'civil')[0];
    expect(spyGuess(s, civil, `u-${civil}`, 'Chat', 40)).toEqual({ ok: false, code: 'forbidden' });
    expect(spyGuess(s, spy, `u-${spy}`, '  chat ', 40)).toMatchObject({ ok: true });
    expect(s.winner).toBe('spy');
    expect(s.winnerIds).toEqual([spy]);
    expect(s.status).toBe('game_over');
  });

  it('une mauvaise devinette laisse la victoire aux civils si rien d’autre n’est joué', () => {
    const s = fresh();
    const spy = ids(s, 'spy')[0];
    eliminate(s, spy);
    spyGuess(s, spy, `u-${spy}`, 'Poisson', 40);
    expect(s.spyGuessCorrect).toBe(false);
    expect(s.winner).toBe('civils');
  });

  it('les imposteurs gagnent quand il ne reste que deux joueurs dont un undercover', () => {
    const s = started(3, false);
    toVoting(s);
    const civil = ids(s, 'civil')[0];
    s.votes = Object.fromEntries(Object.values(s.players).filter((p) => !p.isHost && p.id !== civil).map((p) => [p.id, civil]));
    resolveVotes(s, 30, seeded());
    expect(s.winner).toBe('undercover');
    expect(s.status).toBe('game_over');
  });

  it('checkWinCondition : partie en cours sans vainqueur', () => {
    expect(checkWinCondition(started(5))).toBeNull();
  });
});

describe('phases et rejouer', () => {
  it('enchaîne rôles → discussion → orateurs → vote', () => {
    const s = started(3);
    expect(s.status).toBe('role_reveal');
    expect(startVoting(s)).toEqual({ ok: false, code: 'bad_phase' });
    nextRound(s);
    expect(s.status).toBe('discussion');
    advanceSpeaker(s);
    advanceSpeaker(s);
    expect(s.status).toBe('discussion');
    advanceSpeaker(s);
    expect(s.status).toBe('voting');
  });
  it('rejoue : mêmes joueurs, rôles effacés', () => {
    const s = started(4);
    s.status = 'game_over';
    expect(replayGame(s).ok).toBe(true);
    expect(s.status).toBe('lobby');
    expect(Object.values(s.players).every((p) => !p.role && !p.word && !p.isEliminated)).toBe(true);
    expect(Object.keys(s.players)).toHaveLength(5);
    expect(replayGame(s)).toEqual({ ok: false, code: 'bad_phase' });
  });
});

describe('aucune fuite dans la vue publique', () => {
  it('ne contient ni jeton, ni rôle, ni mot, ni vote en cours avant la fin', () => {
    const s = started(5);
    toVoting(s);
    vote(s, 'j1', 'j2');
    const text = JSON.stringify(toPublicState(s));
    expect(text).not.toContain('u-j');
    expect(text).not.toContain('part-j');
    expect(text).not.toContain('userId');
    expect(text).not.toContain('participantId');
    expect(text).not.toContain('"role"');
    expect(text).not.toContain('"word"');
    expect(text).not.toContain('Chien');
    expect(text).not.toContain('Chat');
    expect(text).not.toContain('"votes"');
    expect(toPublicState(s).voteCount).toBe(1);
  });
  it('révèle la paire de mots seulement en fin de partie', () => {
    const s = started(5);
    expect(toPublicState(s).wordPair).toBeUndefined();
    s.status = 'game_over';
    expect(toPublicState(s).wordPair).toEqual(words);
  });
  it('un joueur ne lit que son propre rôle', () => {
    const s = started(5);
    const spy = ids(s, 'spy')[0];
    expect(myRole(s, spy)).toEqual({ ok: true, result: { role: 'spy', word: null } });
    const under = ids(s, 'undercover')[0];
    expect(myRole(s, under)).toEqual({ ok: true, result: { role: 'undercover', word: 'Chien' } });
    expect(myRole(s, 'host')).toEqual({ ok: false, code: 'no_role' });
    expect(myRole(s, 'inconnu')).toEqual({ ok: false, code: 'not_found' });
  });
});
