/**
 * Résultats conservés des jeux d'animation (game_results) : propriété, rôles, organisme exclu, aucune écriture
 * côté client, idempotence, cohérence des lignes, journal sans donnée personnelle, purge, cascade, et
 * garantie que ni le bilan, ni le passeport, ni le CV, ni l'impact, ni les exports financeurs ne lisent la table.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let participantA: Client;
let participantB: Client;
let trainerA: Client;
let trainerB: Client;
let organisme: Client;
let admin: Client;
const gameRefs: string[] = [];

function quizRow(participantId: string, ref: string, extra: Record<string, unknown> = {}) {
  return {
    participant_id: participantId,
    game_type: 'quiz',
    game_ref: ref,
    play_index: 1,
    player_count: 4,
    rank: 2,
    score: 5400,
    question_count: 10,
    answered_count: 10,
    correct_answers: 7,
    avg_response_ms: 4200,
    title: 'Quiz de test',
    ...extra,
  };
}

beforeAll(async () => {
  f = await createFixtures();
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  organisme = await signIn(f.accounts.memberA.email); // rattaché à l'organisme de la fiche A
  await service.from('profiles').update({ role: 'admin' }).eq('id', f.accounts.memberB.id);
  admin = await signIn(f.accounts.memberB.email);

  const refA = randomUUID();
  const refB = randomUUID();
  gameRefs.push(refA, refB);
  const inserted = await service.from('game_results').insert([
    quizRow(f.participantA, refA),
    quizRow(f.participantB, refB, { rank: 1, score: 9100 }),
    { participant_id: f.participantA, game_type: 'undercover', game_ref: refB, play_index: 1, player_count: 5, role: 'spy', outcome: 'lost', rounds_survived: 1, title: 'Thème : Standard' },
  ]);
  expect(inserted.error).toBeNull();
});

afterAll(async () => {
  if (gameRefs.length) await service.from('game_results').delete().in('game_ref', gameRefs);
  await destroyFixtures(f);
});

describe('lecture des résultats', () => {
  it('un participant lit les siens, jamais ceux d’un autre', async () => {
    const mine = await participantA.from('game_results').select('participant_id');
    expect((mine.data ?? []).length).toBe(2);
    expect((mine.data ?? []).every((r) => r.participant_id === f.participantA)).toBe(true);
    const other = await participantA.from('game_results').select('id').eq('participant_id', f.participantB);
    expect(other.data ?? []).toHaveLength(0);
    const own = await participantB.from('game_results').select('participant_id');
    expect((own.data ?? []).map((r) => r.participant_id)).toEqual([f.participantB]);
  });

  it('un formateur ne lit que les résultats des participants de ses groupes', async () => {
    const a = await trainerA.from('game_results').select('participant_id');
    expect((a.data ?? []).every((r) => r.participant_id === f.participantA)).toBe(true);
    expect((a.data ?? []).length).toBe(2);
    expect((await trainerA.from('game_results').select('id').eq('participant_id', f.participantB)).data ?? []).toHaveLength(0);
    const b = await trainerB.from('game_results').select('participant_id');
    expect((b.data ?? []).every((r) => r.participant_id === f.participantB)).toBe(true);
    expect((await trainerB.from('game_results').select('id').eq('participant_id', f.participantA)).data ?? []).toHaveLength(0);
  });

  it('l’administrateur lit tout', async () => {
    const { data } = await admin.from('game_results').select('participant_id').in('participant_id', [f.participantA, f.participantB]);
    expect((data ?? []).length).toBe(3);
  });

  it('l’organisme du participant n’y a PAS accès (décision prudente, à valider)', async () => {
    const own = await organisme.from('game_results').select('id');
    expect(own.error).toBeNull();
    expect(own.data ?? []).toHaveLength(0);
    const direct = await organisme.from('game_results').select('id').eq('participant_id', f.participantA);
    expect(direct.data ?? []).toHaveLength(0);
  });

  it('un visiteur anonyme n’a aucun accès', async () => {
    const read = await anonymous().from('game_results').select('id');
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
  });
});

describe('aucune écriture côté client', () => {
  it('ni participant, ni formateur, ni administrateur, ni organisme ne peuvent insérer, modifier ou supprimer', async () => {
    for (const [name, client] of [['participant', participantA], ['formateur', trainerA], ['administrateur', admin], ['organisme', organisme], ['anonyme', anonymous()]] as const) {
      const insert = await client.from('game_results').insert(quizRow(f.participantA, randomUUID(), { rank: 1, score: 99999 }));
      expect(insert.error, `${name} insert`).not.toBeNull();
      const update = await client.from('game_results').update({ score: 99999, rank: 1 }).eq('participant_id', f.participantA).select('id');
      expect(update.error !== null || (update.data ?? []).length === 0, `${name} update`).toBe(true);
      const remove = await client.from('game_results').delete().eq('participant_id', f.participantA).select('id');
      expect(remove.error !== null || (remove.data ?? []).length === 0, `${name} delete`).toBe(true);
    }
    const intact = await service.from('game_results').select('score').eq('participant_id', f.participantA).eq('game_type', 'quiz');
    expect(intact.data?.[0]?.score).toBe(5400);
  });
});

describe('intégrité des lignes', () => {
  it('l’enregistrement est idempotent : rejouer la fin de partie ne duplique rien', async () => {
    const ref = randomUUID();
    gameRefs.push(ref);
    const row = quizRow(f.participantA, ref);
    const first = await service.from('game_results').upsert(row, { onConflict: 'participant_id,game_type,game_ref,play_index', ignoreDuplicates: true });
    expect(first.error).toBeNull();
    const again = await service.from('game_results').upsert({ ...row, score: 1 }, { onConflict: 'participant_id,game_type,game_ref,play_index', ignoreDuplicates: true });
    expect(again.error).toBeNull();
    const { data } = await service.from('game_results').select('score').eq('game_ref', ref);
    expect(data).toEqual([{ score: 5400 }]);
    // Rejouer l'Undercover (manche 2) donne une nouvelle ligne.
    const replay = await service.from('game_results').insert({ participant_id: f.participantA, game_type: 'undercover', game_ref: ref, play_index: 2, player_count: 4, role: 'civil', outcome: 'won', rounds_survived: 2 });
    expect(replay.error).toBeNull();
    const duplicate = await service.from('game_results').insert({ participant_id: f.participantA, game_type: 'undercover', game_ref: ref, play_index: 2, player_count: 4, role: 'civil', outcome: 'won' });
    expect(duplicate.error?.code).toBe('23505');
  });

  it('refuse les lignes incohérentes', async () => {
    const ref = randomUUID();
    gameRefs.push(ref);
    const bad = [
      { ...quizRow(f.participantA, ref), score: null },
      { ...quizRow(f.participantA, ref), rank: 0 },
      { ...quizRow(f.participantA, ref), correct_answers: 11 },
      { ...quizRow(f.participantA, ref), game_type: 'autre' },
      { participant_id: f.participantA, game_type: 'undercover', game_ref: ref, player_count: 4, role: 'civil' },
      { participant_id: f.participantA, game_type: 'undercover', game_ref: ref, player_count: 4, role: 'sorcier', outcome: 'won' },
      { participant_id: f.participantA, game_type: 'undercover', game_ref: ref, player_count: 0, role: 'civil', outcome: 'won' },
      { ...quizRow(f.participantA, ref), participant_id: randomUUID() },
    ];
    for (const row of bad) {
      const { error } = await service.from('game_results').insert(row as never);
      expect(error, JSON.stringify(row)).not.toBeNull();
    }
  });

  it('le journal d’activité note un lot de résultats sans participant, pseudo ni titre', async () => {
    const ref = randomUUID();
    gameRefs.push(ref);
    const { error } = await service.from('game_results').insert([
      quizRow(f.participantA, ref, { title: 'TITRE-A-NE-PAS-JOURNALISER' }),
      quizRow(f.participantB, ref, { title: 'TITRE-A-NE-PAS-JOURNALISER' }),
    ]);
    expect(error).toBeNull();
    const { data } = await service.from('audit_logs').select('action, entity_id, metadata, participant_id').eq('entity_type', 'game_results').eq('entity_id', ref);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ action: 'game_results.recorded', participant_id: null, metadata: { game_type: 'quiz', results: 2 } });
    const text = JSON.stringify(data);
    expect(text).not.toContain('TITRE-A-NE-PAS-JOURNALISER');
    expect(text).not.toContain(f.participantA);
    expect(text).not.toContain(f.participantB);
  });
});

describe('conservation et suppression', () => {
  it('la purge est réservée au serveur et refuse une durée trop courte', async () => {
    for (const [name, client] of [['participant', participantA], ['formateur', trainerA], ['anonyme', anonymous()]] as const) {
      expect((await client.rpc('purge_old_game_results')).error, name).not.toBeNull();
    }
    expect((await service.rpc('purge_old_game_results', { p_retention: '1 day' })).error).not.toBeNull();
    const ref = randomUUID();
    gameRefs.push(ref);
    await service.from('game_results').insert(quizRow(f.participantA, ref, { played_at: new Date(Date.now() - 800 * 24 * 3600 * 1000).toISOString() }));
    const purged = await service.rpc('purge_old_game_results');
    expect(purged.error).toBeNull();
    expect(purged.data as number).toBeGreaterThanOrEqual(1);
    expect((await service.from('game_results').select('id').eq('game_ref', ref)).data ?? []).toHaveLength(0);
    // Les résultats récents sont conservés.
    expect((await service.from('game_results').select('id').eq('participant_id', f.participantA)).data?.length).toBeGreaterThanOrEqual(2);
  });

  it('supprimer le participant supprime ses résultats (cascade)', async () => {
    const email = `cascade.${randomUUID().slice(0, 8)}@securite.happi.test`;
    const created = await service.auth.admin.createUser({
      email,
      password: `Sec-${randomUUID()}9`,
      email_confirm: true,
      user_metadata: { account_type: 'participant', first_name: 'Cascade', last_name: 'Test' },
    });
    expect(created.error).toBeNull();
    const userId = created.data.user!.id;
    try {
      const { data: file } = await service.from('participants').select('id').eq('user_id', userId).single();
      const ref = randomUUID();
      gameRefs.push(ref);
      expect((await service.from('game_results').insert(quizRow(file!.id, ref))).error).toBeNull();
      expect((await service.from('game_results').select('id').eq('participant_id', file!.id)).data).toHaveLength(1);
      expect((await service.from('participants').delete().eq('id', file!.id)).error).toBeNull();
      expect((await service.from('game_results').select('id').eq('participant_id', file!.id)).data ?? []).toHaveLength(0);
    } finally {
      await service.auth.admin.deleteUser(userId);
    }
  });

  it('les pseudos ne sont conservés dans aucune colonne de game_results', async () => {
    const { data } = await service.from('game_results').select('*').limit(1);
    const columns = Object.keys(data?.[0] ?? {});
    expect(columns.length).toBeGreaterThan(5);
    expect(columns.filter((c) => /nick|pseudo|name|word|mot/i.test(c))).toEqual([]);
  });
});

describe('hors bilan, passeport, CV, impact et exports financeurs', () => {
  // Seuls ces fichiers peuvent mentionner game_results : pages « Mes jeux », section de la fiche participant,
  // export « Mes données » (RGPD), moteur des jeux, types générés et libellés du journal.
  const ALLOWED = [
    'src/lib/jeux/',
    'src/components/jeux/',
    'src/app/api/jeux/',
    'src/app/participant/jeux/',
    'src/app/participant/profil/page.tsx',
    'src/app/formateur/participants/[id]/page.tsx',
    'src/app/api/exports/mes-donnees/route.ts',
    'src/lib/supabase/database.types.ts',
    'src/lib/audit-labels.ts',
    'src/lib/demo/environment.ts', // données de démonstration (écriture seulement)
  ];

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|mjs|js|sql)$/.test(name)) out.push(full);
    }
    return out;
  }

  it('aucun fichier de l’application hors liste blanche ne lit game_results', () => {
    const root = process.cwd();
    const offenders = walk(join(root, 'src'))
      .map((file) => relative(root, file).split(sep).join('/'))
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(join(root, file), 'utf8').includes('game_results'))
      .filter((file) => !ALLOWED.some((allowed) => file.startsWith(allowed)));
    expect(offenders).toEqual([]);
  });

  it('aucune vue, fonction ou déclencheur SQL des autres modules ne la lit', () => {
    const root = process.cwd();
    const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'));
    const readers = migrations.filter((name) => readFileSync(join(root, 'supabase/migrations', name), 'utf8').includes('game_results'));
    expect(readers).toEqual(['20261120110000_game_results.sql']);
  });
});
