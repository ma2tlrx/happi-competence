/**
 * Jeux d'animation (Quiz et Undercover) : propriété des contenus, rôles, états inaccessibles au client,
 * identité des joueurs liée à un compte, journal sans texte libre, verrou optimiste sur la vraie base et
 * vues publiques sans fuite.
 *
 * Les routes HTTP sont couvertes par les tests unitaires de src/lib/jeux (règles, schémas, vues publiques) ;
 * ici on vérifie ce que la base garantit même si une route était mal écrite.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createQuiz, createSession, deleteQuiz, getQuiz, listQuestions, listQuizzes, saveQuestions, type Db } from '@/lib/jeux/data';
import { joinLobby, newQuizState, publicQuizState, revealAnswers, showQuestion, startGame, submitAnswer, type QuizQuestion } from '@/lib/jeux/quiz-engine';
import { createQuizState, getQuizState, insertUndercoverGame, mutateQuiz, getUndercoverGame } from '@/lib/jeux/stores';
import { generateCode, joinGame, newUndercoverGame, startGame as startUndercover, toPublicState } from '@/lib/jeux/undercover-engine';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let trainerA: Client;
let trainerB: Client;
let participant: Client;
let organisme: Client;
let admin: Client;
const quizzes: string[] = [];
const undercoverGames: string[] = [];

const SECRET_TITLE = 'TITRE-CONFIDENTIEL-4721';
const questionInput = [
  {
    text: 'Question de sécurité ?',
    type: 'multiple_choice' as const,
    timeLimit: 20,
    answers: [
      { id: 'a1', text: 'Bonne', isCorrect: true },
      { id: 'a2', text: 'Mauvaise', isCorrect: false },
    ],
  },
];

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  participant = await signIn(f.accounts.participantA.email);
  organisme = await signIn(f.accounts.memberA.email);
  // Un administrateur : le compte du membre B est promu pour la durée du test.
  await service.from('profiles').update({ role: 'admin' }).eq('id', f.accounts.memberB.id);
  admin = await signIn(f.accounts.memberB.email);
});

afterAll(async () => {
  if (quizzes.length) await service.from('game_quizzes').delete().in('id', quizzes);
  if (undercoverGames.length) await service.from('game_undercover_games').delete().in('id', undercoverGames);
  await service.from('game_quizzes').delete().in('owner_id', [f.accounts.trainerA.id, f.accounts.trainerB.id, f.accounts.memberB.id]);
  await destroyFixtures(f);
});

describe('permission games.manage', () => {
  it('est accordée au formateur et à l’administrateur seulement', async () => {
    const { data } = await service.from('role_permissions').select('role_code').eq('permission_code', 'games.manage');
    expect((data ?? []).map((r) => r.role_code).sort()).toEqual(['admin', 'formateur']);
  });
  it('ne peut pas être accordée à un participant ou à un organisme', async () => {
    for (const role of ['participant', 'organisme']) {
      const { error } = await service.from('role_permissions').insert({ role_code: role, permission_code: 'games.manage' });
      expect(error).not.toBeNull();
    }
  });
});

describe('bibliothèque : propriété des contenus', () => {
  let quizId: string;
  let sessionId: string;

  it('un formateur crée un quiz, ses questions et une partie', async () => {
    const quiz = await createQuiz(trainerA as unknown as Db, { ownerId: f.accounts.trainerA.id, title: SECRET_TITLE, description: '' });
    quizId = quiz.id;
    quizzes.push(quizId);
    await saveQuestions(trainerA as unknown as Db, quizId, questionInput);
    expect(await listQuestions(trainerA as unknown as Db, quizId)).toHaveLength(1);
    const session = await createSession(trainerA as unknown as Db, { quizId, ownerId: f.accounts.trainerA.id, maxPlayers: 10 });
    sessionId = session.id;
    expect(session.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(session.status).toBe('waiting');
  });

  it('un autre formateur ne voit ni le quiz, ni les questions, ni la partie', async () => {
    expect(await getQuiz(trainerB as unknown as Db, quizId)).toBeNull();
    expect((await listQuizzes(trainerB as unknown as Db, null)).some((q) => q.id === quizId)).toBe(false);
    const questions = await trainerB.from('game_questions').select('id').eq('quiz_id', quizId);
    expect(questions.data ?? []).toHaveLength(0);
    const sessions = await trainerB.from('game_sessions').select('id').eq('id', sessionId);
    expect(sessions.data ?? []).toHaveLength(0);
  });

  it('un autre formateur ne peut ni modifier, ni supprimer, ni remplacer les questions', async () => {
    const update = await trainerB.from('game_quizzes').update({ title: 'piraté' }).eq('id', quizId).select('id');
    expect(update.data ?? []).toHaveLength(0);
    const remove = await trainerB.from('game_quizzes').delete().eq('id', quizId).select('id');
    expect(remove.data ?? []).toHaveLength(0);
    const replace = await trainerB.rpc('save_game_questions', { p_quiz_id: quizId, p_questions: [] });
    expect(replace.error).not.toBeNull();
    expect(await listQuestions(trainerA as unknown as Db, quizId)).toHaveLength(1);
    expect((await getQuiz(trainerA as unknown as Db, quizId))?.title).toBe(SECRET_TITLE);
  });

  it('un formateur ne crée ni quiz au nom d’un autre, ni partie sur le quiz d’un autre', async () => {
    const usurpation = await trainerB.from('game_quizzes').insert({ owner_id: f.accounts.trainerA.id, title: 'Au nom de A' });
    expect(usurpation.error).not.toBeNull();
    const session = await trainerB.from('game_sessions').insert({ quiz_id: quizId, owner_id: f.accounts.trainerB.id, code: 'ZZZ999' });
    expect(session.error).not.toBeNull();
    const ouSession = await trainerB.from('game_sessions').insert({ quiz_id: quizId, owner_id: f.accounts.trainerA.id, code: 'ZZZ998' });
    expect(ouSession.error).not.toBeNull();
  });

  it('un propriétaire ne change ni le code, ni le propriétaire, ni le quiz d’une partie', async () => {
    for (const patch of [{ code: 'AAA222' }, { owner_id: f.accounts.trainerB.id }, { quiz_id: quizId }, { status: 'active' }]) {
      const { error } = await trainerA.from('game_sessions').update(patch).eq('id', sessionId);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
    const quiz = await trainerA.from('game_quizzes').update({ owner_id: f.accounts.trainerB.id }).eq('id', quizId);
    expect(quiz.error).not.toBeNull();
  });

  it('participant, organisme et visiteur anonyme n’accèdent à rien', async () => {
    for (const [name, client] of [['participant', participant], ['organisme', organisme], ['anonyme', anonymous()]] as const) {
      const read = await client.from('game_quizzes').select('id');
      expect(read.data ?? [], name).toHaveLength(0);
      const insert = await client.from('game_quizzes').insert({ owner_id: f.accounts.trainerA.id, title: 'x' });
      expect(insert.error, name).not.toBeNull();
      const config = await client.from('game_undercover_configs').select('id');
      expect(config.data ?? [], name).toHaveLength(0);
      const sessions = await client.from('game_sessions').select('id');
      expect(sessions.data ?? [], name).toHaveLength(0);
    }
    const own = await organisme.from('game_quizzes').insert({ owner_id: f.accounts.memberA.id, title: 'x' });
    expect(own.error).not.toBeNull();
  });

  it('l’administrateur voit tous les contenus, y compris pour animer', async () => {
    expect(await getQuiz(admin as unknown as Db, quizId)).not.toBeNull();
    const session = await createSession(admin as unknown as Db, { quizId, ownerId: f.accounts.memberB.id, maxPlayers: 5 });
    expect(session.ownerId).toBe(f.accounts.memberB.id);
  });

  it('le journal d’activité ne contient ni titre, ni question, ni pseudo', async () => {
    const { data } = await service.from('audit_logs').select('action, metadata, entity_id').in('entity_type', ['game_quiz', 'game_session']).in('entity_id', [quizId, sessionId]);
    const rows = data ?? [];
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['game_quiz.created', 'game_session.created']));
    expect(JSON.stringify(rows)).not.toContain(SECRET_TITLE);
    expect(JSON.stringify(rows)).not.toContain('Question de sécurité');
  });
});

describe('états et jetons : inaccessibles au client', () => {
  let sessionId: string;
  const questions: QuizQuestion[] = [
    { id: 'q1', text: 'Q', type: 'multiple_choice', timeLimit: 20, answers: [{ id: 'a1', text: 'Oui', isCorrect: true }, { id: 'a2', text: 'Non', isCorrect: false }] },
  ];

  beforeAll(async () => {
    const quiz = await createQuiz(service as unknown as Db, { ownerId: f.accounts.trainerA.id, title: 'Quiz états', description: '' });
    quizzes.push(quiz.id);
    const session = await createSession(service as unknown as Db, { quizId: quiz.id, ownerId: f.accounts.trainerA.id, maxPlayers: 10 });
    sessionId = session.id;
    await createQuizState(service as unknown as Db, newQuizState(sessionId, questions, 10));
  });

  it('game_states et game_undercover_games ne se lisent ni ne s’écrivent avec une session', async () => {
    for (const [name, client] of [['formateur', trainerA], ['administrateur', admin], ['participant', participant], ['anonyme', anonymous()]] as const) {
      const read = await client.from('game_states').select('state');
      expect(read.error, name).not.toBeNull();
      const write = await client.from('game_states').update({ state: {} }).eq('id', sessionId);
      expect(write.error, name).not.toBeNull();
      const undercover = await client.from('game_undercover_games').select('state');
      expect(undercover.error, name).not.toBeNull();
      const insert = await client.from('game_undercover_games').insert({ owner_id: f.accounts.trainerA.id, code: 'QQQ222', state: {}, expires_at: new Date().toISOString() });
      expect(insert.error, name).not.toBeNull();
    }
  });

  it('le compte d’un joueur (profil, fiche) ne se lit pas, même par le propriétaire', async () => {
    const player = await service
      .from('game_session_players')
      .insert({ session_id: sessionId, nickname: 'Pseudo-test', profile_id: f.accounts.participantA.id, participant_id: f.participantA })
      .select('id')
      .single();
    expect(player.error).toBeNull();
    for (const column of ['profile_id', 'participant_id', 'is_trial']) {
      const hidden = await trainerA.from('game_session_players').select(column).eq('session_id', sessionId);
      expect(hidden.error, column).not.toBeNull();
    }
    expect((await trainerA.from('game_session_players').select('token_hash')).error).not.toBeNull();
    const visible = await trainerA.from('game_session_players').select('id, nickname, score').eq('session_id', sessionId);
    expect(visible.data).toHaveLength(1);
    const forged = await trainerA.from('game_session_players').insert({ session_id: sessionId, nickname: 'Intrus', profile_id: f.accounts.trainerA.id, is_trial: true });
    expect(forged.error).not.toBeNull();
    const rewrite = await trainerA.from('game_session_players').update({ score: 99999 }).eq('session_id', sessionId);
    expect(rewrite.error).not.toBeNull();
    const other = await trainerB.from('game_session_players').select('id').eq('session_id', sessionId);
    expect(other.data ?? []).toHaveLength(0);
  });

  it('un pseudo ne peut pas être pris deux fois dans la même partie (casse ignorée)', async () => {
    const duplicate = await service
      .from('game_session_players')
      .insert({ session_id: sessionId, nickname: 'PSEUDO-TEST', profile_id: f.accounts.participantB.id, participant_id: f.participantB });
    expect(duplicate.error?.code).toBe('23505');
  });

  it('un compte n’a qu’une place par partie, et un participant n’est jamais « en essai »', async () => {
    const twice = await service
      .from('game_session_players')
      .insert({ session_id: sessionId, nickname: 'Autre pseudo', profile_id: f.accounts.participantA.id, participant_id: f.participantA });
    expect(twice.error?.code).toBe('23505');
    const inconsistent = await service
      .from('game_session_players')
      .insert({ session_id: sessionId, nickname: 'Incohérent', profile_id: f.accounts.participantB.id, participant_id: f.participantB, is_trial: true });
    expect(inconsistent.error).not.toBeNull();
    const anonymousRow = await service.from('game_session_players').insert({ session_id: sessionId, nickname: 'Sans compte' });
    expect(anonymousRow.error).not.toBeNull();
  });

  it('le code d’une partie en cours est unique', async () => {
    const { data } = await service.from('game_sessions').select('code, quiz_id').eq('id', sessionId).single();
    const duplicate = await service.from('game_sessions').insert({ quiz_id: data!.quiz_id, owner_id: f.accounts.trainerA.id, code: data!.code });
    expect(duplicate.error?.code).toBe('23505');
  });

  it('la purge est réservée au serveur', async () => {
    expect((await trainerA.rpc('purge_expired_games')).error).not.toBeNull();
    expect((await anonymous().rpc('purge_expired_games')).error).not.toBeNull();
    const done = await service.rpc('purge_expired_games');
    expect(done.error).toBeNull();
  });

  it('la limitation de débit accepte les portées de jeu', async () => {
    const hit = await service.rpc('rate_limit_hit', { p_action: 'game_join.ip', p_key_hash: 'a'.repeat(64), p_limit: 150, p_window_seconds: 600 });
    expect(hit.error).toBeNull();
    expect((hit.data as { allowed?: boolean }).allowed).toBe(true);
  });

  it('plusieurs réponses simultanées sont toutes retenues (verrou optimiste sur la vraie base)', async () => {
    const db = service as unknown as Db;
    const quiz = await createQuiz(db, { ownerId: f.accounts.trainerA.id, title: 'Quiz concurrence', description: '' });
    quizzes.push(quiz.id);
    const session = await createSession(db, { quizId: quiz.id, ownerId: f.accounts.trainerA.id, maxPlayers: 10 });
    const state = newQuizState(session.id, questions, 10);
    for (let i = 0; i < 4; i++) joinLobby(state, { id: `p${i}`, nickname: `J${i}`, userId: `u${i}` });
    startGame(state);
    showQuestion(state, 0);
    revealAnswers(state, Date.now());
    await createQuizState(db, state);

    const results = await Promise.all(
      [0, 1, 2].map((i) =>
        mutateQuiz<null, string>(db, session.id, (s) => {
          const r = submitAnswer(s, `p${i}`, 'a1', Date.now());
          return r.ok ? { state: s, result: null } : { reject: r.code };
        }),
      ),
    );
    expect(results.every((r) => r.kind === 'ok')).toBe(true);
    const stored = await getQuizState(db, session.id);
    expect(Object.keys(stored!.answers).sort()).toEqual(['p0', 'p1', 'p2']);
    expect(stored!.status).toBe('answering');
  });

  it('un état expiré n’est plus lu et la purge le supprime', async () => {
    const db = service as unknown as Db;
    await service.from('game_states').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', sessionId);
    expect(await getQuizState(db, sessionId)).toBeNull();
    const purged = await service.rpc('purge_expired_games');
    expect((purged.data as { quiz_states: number }).quiz_states).toBeGreaterThanOrEqual(1);
    const { data } = await service.from('game_sessions').select('status').eq('id', sessionId).single();
    expect(data?.status).toBe('finished');
  });

  it('la vue publique d’une partie de Quiz en cours ne contient aucune bonne réponse', async () => {
    const state = newQuizState('s', questions, 10);
    joinLobby(state, { id: 'p1', nickname: 'Ana', userId: 'user-ana-0123456789', participantId: 'part-ana-0123' });
    startGame(state);
    showQuestion(state, 0);
    revealAnswers(state, 1);
    const text = JSON.stringify(publicQuizState(state));
    expect(text).not.toContain('isCorrect');
    expect(text).not.toContain('user-ana-0123456789');
    expect(text).not.toContain('part-ana-0123');
    expect(text).not.toContain('userId');
  });
});

describe('Undercover : rôles et mots côté serveur seulement', () => {
  it('l’état stocké contient les rôles, la vue publique non', async () => {
    const db = service as unknown as Db;
    const now = Date.now();
    let state = newUndercoverGame({
      gameId: crypto.randomUUID(),
      code: generateCode(),
      hostId: crypto.randomUUID(),
      hostNickname: 'Animateur',
      customWordPair: { civil: 'MOT-CIVIL-SECRET', undercover: 'MOT-IMPOSTEUR-SECRET' },
      now,
    });
    for (let i = 1; i <= 4; i++) joinGame(state, { id: crypto.randomUUID(), nickname: `J${i}`, userId: `user-uc-${i}-0123456789`, participantId: `part-uc-${i}`, now });
    startUndercover(state, now);
    // Le code est tiré au hasard : un doublon éventuel est rejoué.
    for (let attempt = 0; attempt < 5 && !(await insertUndercoverGame(db, f.accounts.trainerA.id, state)); attempt++) {
      state = { ...state, code: generateCode() };
    }
    undercoverGames.push(state.gameId);

    const stored = await getUndercoverGame(db, state.gameId);
    expect(stored?.ownerId).toBe(f.accounts.trainerA.id);
    expect(Object.values(stored!.state.players).some((p) => p.role === 'spy')).toBe(true);

    const text = JSON.stringify(toPublicState(stored!.state));
    expect(text).not.toContain('MOT-CIVIL-SECRET');
    expect(text).not.toContain('MOT-IMPOSTEUR-SECRET');
    expect(text).not.toContain('"role"');
    expect(text).not.toContain('user-uc');
    expect(text).not.toContain('part-uc');
    expect(text).not.toContain('userId');

    // Le formateur propriétaire lui-même ne lit pas l'état par l'API de la base.
    expect((await trainerA.from('game_undercover_games').select('state')).error).not.toBeNull();
  });
});

describe('suppression', () => {
  it('supprimer un quiz supprime ses parties, joueurs et états (cascade)', async () => {
    const db = trainerA as unknown as Db;
    const quiz = await createQuiz(db, { ownerId: f.accounts.trainerA.id, title: 'À supprimer', description: '' });
    await saveQuestions(db, quiz.id, questionInput);
    const session = await createSession(db, { quizId: quiz.id, ownerId: f.accounts.trainerA.id, maxPlayers: 5 });
    await createQuizState(service as unknown as Db, newQuizState(session.id, [], 5));
    await deleteQuiz(db, quiz.id);
    expect((await service.from('game_sessions').select('id').eq('id', session.id)).data ?? []).toHaveLength(0);
    expect((await service.from('game_states').select('id').eq('id', session.id)).data ?? []).toHaveLength(0);
    expect((await service.from('game_questions').select('id').eq('quiz_id', quiz.id)).data ?? []).toHaveLength(0);
  });
});
