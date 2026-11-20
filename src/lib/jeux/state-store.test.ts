import { describe, expect, it } from 'vitest';

import { newQuizState, submitAnswer, revealAnswers, showQuestion, joinLobby, startGame, type QuizState } from './quiz-engine';
import { createMemoryStore, mutateState, type StateStore } from './state-store';

const noSleep = async () => {};

function twoAnswerQuestion() {
  return [
    {
      id: 'q1',
      text: 'Question',
      type: 'multiple_choice' as const,
      timeLimit: 20,
      answers: [
        { id: 'a', text: 'A', isCorrect: true },
        { id: 'b', text: 'B', isCorrect: false },
      ],
    },
  ];
}

async function answeringState(players: number): Promise<QuizState> {
  const state = newQuizState('s1', twoAnswerQuestion(), 50);
  for (let i = 0; i < players; i++) joinLobby(state, { id: `p${i}`, nickname: `Joueur${i}`, userId: `u${i}` });
  startGame(state);
  showQuestion(state, 0);
  revealAnswers(state, 1000);
  return state;
}

/** Magasin dont les lectures sont étalées dans le temps : les écritures se croisent comme sur plusieurs serveurs. */
function slowReads<T>(inner: StateStore<T>): StateStore<T> {
  return {
    async read(id) {
      const value = await inner.read(id);
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));
      return value;
    },
    write: (id, state, version) => inner.write(id, state, version),
  };
}

describe('mutateState : verrou optimiste', () => {
  it('écrit et incrémente la version', async () => {
    const store = createMemoryStore<{ n: number }>({ x: { n: 0 } });
    const outcome = await mutateState(store, 'x', (s) => ({ state: { n: s.n + 1 }, result: 'ok' }), { sleep: noSleep });
    expect(outcome).toMatchObject({ kind: 'ok', version: 2, state: { n: 1 } });
    expect((await store.read('x'))?.version).toBe(2);
  });

  it('signale un état absent', async () => {
    const store = createMemoryStore<{ n: number }>();
    expect(await mutateState(store, 'nope', (s) => ({ state: s, result: 1 }), { sleep: noSleep })).toEqual({ kind: 'missing' });
  });

  it('un refus de la mutation n’écrit rien', async () => {
    const store = createMemoryStore<{ n: number }>({ x: { n: 0 } });
    const outcome = await mutateState(store, 'x', () => ({ reject: 'non' as const }), { sleep: noSleep });
    expect(outcome).toEqual({ kind: 'rejected', reason: 'non' });
    expect((await store.read('x'))?.version).toBe(1);
  });

  it('rejoue la mutation sur l’état à jour après un conflit', async () => {
    const store = createMemoryStore<{ n: number }>({ x: { n: 0 } });
    store.failNextWrites(2);
    let calls = 0;
    const outcome = await mutateState(
      store,
      'x',
      (s) => {
        calls++;
        return { state: { n: s.n + 1 }, result: null };
      },
      { sleep: noSleep },
    );
    expect(outcome.kind).toBe('ok');
    expect(calls).toBe(3);
  });

  it('abandonne après le nombre maximal d’essais', async () => {
    const store = createMemoryStore<{ n: number }>({ x: { n: 0 } });
    store.failNextWrites(10);
    const outcome = await mutateState(store, 'x', (s) => ({ state: s, result: null }), { sleep: noSleep, maxAttempts: 3 });
    expect(outcome).toEqual({ kind: 'conflict' });
  });

  it('attend entre deux essais, de plus en plus longtemps', async () => {
    const store = createMemoryStore<{ n: number }>({ x: { n: 0 } });
    store.failNextWrites(2);
    const waits: number[] = [];
    await mutateState(store, 'x', (s) => ({ state: s, result: null }), { sleep: async (ms) => void waits.push(ms), random: () => 1 });
    expect(waits).toEqual([40, 70]);
  });
});

describe('réponses simultanées au Quiz', () => {
  it('ne perd aucune réponse quand plusieurs joueurs répondent au même instant', async () => {
    const initial = await answeringState(5);
    const store = slowReads(createMemoryStore<QuizState>({ s1: initial }));
    const outcomes = await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        mutateState(
          store,
          's1',
          (state) => {
            const result = submitAnswer(state, `p${i}`, i % 2 ? 'b' : 'a', 2000);
            return result.ok ? { state, result: result.result } : { reject: result.code };
          },
          { sleep: noSleep },
        ),
      ),
    );
    expect(outcomes.every((o) => o.kind === 'ok')).toBe(true);
    const final = (await store.read('s1'))!.state;
    expect(Object.keys(final.answers).sort()).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    // Score cumulé exact : 3 bonnes réponses (p0, p2, p4) à 1000 - 50 % × 1/20 = 975.
    expect(final.players.p0.score).toBe(975);
    expect(final.players.p1.score).toBe(0);
    // Les cinq ont répondu : la question a été close dans la dernière écriture.
    expect(final.status).toBe('review');
  });

  it('un même joueur ne compte qu’une fois même en double envoi concurrent', async () => {
    const initial = await answeringState(3);
    const store = slowReads(createMemoryStore<QuizState>({ s1: initial }));
    const results = await Promise.all(
      [1, 2].map(() =>
        mutateState(
          store,
          's1',
          (state) => {
            const result = submitAnswer(state, 'p0', 'a', 2000);
            return result.ok ? { state, result: result.result } : { reject: result.code };
          },
          { sleep: noSleep },
        ),
      ),
    );
    expect(results.filter((r) => r.kind === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r.kind === 'rejected')).toHaveLength(1);
    expect((await store.read('s1'))!.state.players.p0.score).toBe(975);
  });
});
