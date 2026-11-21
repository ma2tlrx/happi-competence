/**
 * Espace organisme « Mes groupes » : logique pure (cases de présence, personnes à relancer, ordre des groupes).
 *
 * Parcours couverts :
 *   • Le conseiller voit ses groupes : en cours d'abord, puis à venir ; les groupes terminés à part.
 *   • Il lit la présence de chaque membre en cases, une par séance terminée.
 *   • Il relance une personne absente (sans justificatif) à sa dernière séance, une seule fois par absence.
 */
import { describe, expect, it } from 'vitest';

import {
  arrangeGroups,
  compactTimeRange,
  countToRelaunch,
  dateSpan,
  followupState,
  groupBucket,
  joinNames,
  nextSession,
  PRESENCE_LEGEND,
  presenceCell,
  presenceTrail,
  relaunchedLabel,
  revealedSkillCounts,
  sortMembers,
  type OrgSession,
} from './groups';

const TODAY = '2026-11-21';

const session = (id: string, number: number, status: string, date: string | null): OrgSession => ({ id, number, status, date });

/** Un groupe de 6 séances : 1 à 3 terminées, 4 aujourd'hui à venir, 5 et 6 plus tard. */
const SESSIONS: OrgSession[] = [
  session('s3', 3, 'completed', '2026-11-14'),
  session('s1', 1, 'completed', '2026-10-31'),
  session('s2', 2, 'completed', '2026-11-07'),
  session('s4', 4, 'planned', '2026-11-28'),
  session('s5', 5, 'planned', '2026-12-05'),
  session('s6', 6, 'planned', '2026-12-12'),
];

const statuses = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('cases de présence', () => {
  it('associe chaque statut de présence à une case', () => {
    expect(presenceCell('present')).toBe('present');
    expect(presenceCell('late')).toBe('partial');
    expect(presenceCell('left_early')).toBe('partial');
    expect(presenceCell('absent')).toBe('absent');
    expect(presenceCell('excused')).toBe('excused');
  });

  it('une présence non saisie (ou inconnue) n’est jamais une absence', () => {
    expect(presenceCell(null)).toBe('unknown');
    expect(presenceCell(undefined)).toBe('unknown');
    expect(presenceCell('autre')).toBe('unknown');
  });

  it('la légende suit l’ordre de lecture, avec des libellés courts', () => {
    expect(PRESENCE_LEGEND.map((item) => item.cell)).toEqual(['present', 'partial', 'absent', 'excused', 'unknown']);
    expect(PRESENCE_LEGEND.find((item) => item.cell === 'partial')?.label).toBe('Retard ou départ anticipé');
    expect(PRESENCE_LEGEND.find((item) => item.cell === 'unknown')?.label).toBe('Non saisi');
  });
});

describe('fil de présence', () => {
  it('une case par séance terminée, dans l’ordre chronologique', () => {
    const trail = presenceTrail(SESSIONS, statuses({ s1: 'present', s2: 'late', s3: 'absent' }));
    expect(trail.map((entry) => [entry.sessionId, entry.cell])).toEqual([
      ['s1', 'present'],
      ['s2', 'partial'],
      ['s3', 'absent'],
    ]);
  });

  it('ignore les séances à venir, en cours ou annulées ; une séance sans saisie reste « non saisi »', () => {
    const trail = presenceTrail(
      [...SESSIONS, session('s7', 7, 'in_progress', TODAY), session('s8', 8, 'cancelled', '2026-11-10')],
      statuses({ s1: 'present', s7: 'absent', s8: 'absent' }),
    );
    expect(trail.map((entry) => entry.cell)).toEqual(['present', 'unknown', 'unknown']);
  });

  it('une séance terminée sans date passe en dernier, à numéro égal les numéros départagent', () => {
    const trail = presenceTrail(
      [session('b', 2, 'completed', '2026-11-07'), session('x', 9, 'completed', null), session('a', 1, 'completed', '2026-11-07')],
      new Map(),
    );
    expect(trail.map((entry) => entry.sessionId)).toEqual(['a', 'b', 'x']);
  });
});

describe('relance d’une personne absente', () => {
  const state = (entries: Record<string, string>, followups: Record<string, string> = {}, membership = 'active') =>
    followupState({ membership, sessions: SESSIONS, statusBySession: statuses(entries), followups: new Map(Object.entries(followups)) });

  it('absente sans justificatif à sa dernière séance, pas encore relancée : à relancer', () => {
    expect(state({ s1: 'present', s2: 'present', s3: 'absent' })).toEqual({ kind: 'to_relaunch', sessionId: 's3', sessionNumber: 3 });
  });

  it('déjà relancée pour cette absence : la date de la relance est indiquée, pas de second envoi', () => {
    expect(state({ s1: 'present', s3: 'absent' }, { s3: '2026-11-15T10:00:00Z' })).toEqual({
      kind: 'relaunched',
      sessionId: 's3',
      sessionNumber: 3,
      at: '2026-11-15T10:00:00Z',
    });
  });

  it('une absence justifiée ne se relance pas', () => {
    expect(state({ s1: 'present', s3: 'excused' })).toEqual({ kind: 'none' });
  });

  it('revenue à la séance suivante : plus rien à relancer, même si une ancienne absence n’a pas été relancée', () => {
    expect(state({ s1: 'present', s2: 'absent', s3: 'present' })).toEqual({ kind: 'none' });
    expect(state({ s2: 'absent', s3: 'late' }, { s2: '2026-11-08T08:00:00Z' })).toEqual({ kind: 'none' });
  });

  it('une séance terminée sans présence saisie est ignorée : la dernière absence saisie compte', () => {
    expect(state({ s1: 'present', s2: 'absent' })).toEqual({ kind: 'to_relaunch', sessionId: 's2', sessionNumber: 2 });
  });

  it('relancée pour une absence puis de nouveau absente : la nouvelle absence peut être relancée', () => {
    expect(state({ s2: 'absent', s3: 'absent' }, { s2: '2026-11-08T08:00:00Z' })).toEqual({ kind: 'to_relaunch', sessionId: 's3', sessionNumber: 3 });
  });

  it('parcours interrompu : jamais de relance', () => {
    expect(state({ s3: 'absent' }, {}, 'dropped')).toEqual({ kind: 'dropped' });
  });

  it('rien à relancer sans séance terminée ni pour un statut d’inscription inconnu', () => {
    expect(followupState({ membership: 'active', sessions: [session('p', 1, 'planned', TODAY)], statusBySession: statuses({ p: 'absent' }), followups: new Map() })).toEqual({
      kind: 'none',
    });
    expect(state({ s3: 'absent' }, {}, 'removed')).toEqual({ kind: 'none' });
  });

  it('compte les personnes à relancer', () => {
    expect(
      countToRelaunch([
        { kind: 'to_relaunch', sessionId: 's3', sessionNumber: 3 },
        { kind: 'none' },
        { kind: 'relaunched', sessionId: 's3', sessionNumber: 3, at: '2026-11-15T10:00:00Z' },
        { kind: 'to_relaunch', sessionId: 's2', sessionNumber: 2 },
        { kind: 'dropped' },
      ]),
    ).toBe(2);
  });

  it('date de la relance courte, à l’heure de Paris', () => {
    expect(relaunchedLabel('2026-11-21T09:30:00Z')).toBe('Relancé·e le 21 nov.');
    // 23 h 30 UTC le 20 novembre = 0 h 30 le 21 novembre à Paris.
    expect(relaunchedLabel('2026-11-20T23:30:00Z')).toBe('Relancé·e le 21 nov.');
    expect(relaunchedLabel('pas une date')).toBe('Relancé·e');
  });
});

describe('classement des groupes', () => {
  const group = (status: string, startDate: string | null, endDate: string | null, totalSessions = 6) => ({ status, startDate, endDate, totalSessions });

  it('un groupe terminé ou archivé est rangé dans « terminés »', () => {
    expect(groupBucket(group('completed', '2026-09-01', '2026-10-15'), [], TODAY)).toBe('finished');
    expect(groupBucket(group('archived', '2026-01-01', '2026-02-15'), [], TODAY)).toBe('finished');
  });

  it('un groupe prévu, ou en cours mais pas encore commencé, est « à venir »', () => {
    expect(groupBucket(group('planned', '2026-12-01', '2027-01-15'), [], TODAY)).toBe('upcoming');
    expect(groupBucket(group('active', '2026-12-01', '2027-01-15'), [], TODAY)).toBe('upcoming');
  });

  it('un groupe commencé avec des séances à venir est « en cours »', () => {
    expect(groupBucket(group('active', '2026-10-31', '2026-12-12'), SESSIONS, TODAY)).toBe('current');
    expect(groupBucket(group('active', null, null), [], TODAY)).toBe('current');
  });

  it('toutes les séances du programme faites, plus rien de prévu : « terminé » même si le statut n’a pas suivi', () => {
    const done = SESSIONS.map((item) => ({ ...item, status: 'completed' }));
    expect(groupBucket(group('active', '2026-10-31', '2026-12-12'), done, TODAY)).toBe('finished');
  });

  it('date de fin passée sans séance prévue : « terminé » ; avec une séance encore prévue : « en cours »', () => {
    const past = [session('a', 1, 'completed', '2026-10-01'), session('b', 2, 'cancelled', '2026-10-08')];
    expect(groupBucket(group('active', '2026-10-01', '2026-11-01'), past, TODAY)).toBe('finished');
    expect(groupBucket(group('active', '2026-10-01', '2026-11-01'), [...past, session('c', 3, 'planned', '2026-11-25')], TODAY)).toBe('current');
  });
});

describe('prochaine séance', () => {
  it('une séance en cours passe avant la prochaine séance prévue', () => {
    expect(nextSession([...SESSIONS, session('live', 7, 'in_progress', TODAY)], TODAY)?.id).toBe('live');
  });

  it('sinon la première séance prévue à venir ; une séance prévue mais passée est ignorée', () => {
    expect(nextSession([...SESSIONS, session('old', 0, 'planned', '2026-11-01')], TODAY)?.id).toBe('s4');
    expect(nextSession([session('nodate', 2, 'planned', null), session('soon', 3, 'planned', '2026-11-30')], TODAY)?.id).toBe('soon');
  });

  it('aucune séance à venir : rien', () => {
    expect(nextSession(SESSIONS.filter((item) => item.status === 'completed'), TODAY)).toBeNull();
  });
});

describe('ordre des groupes', () => {
  const item = (name: string, bucket: 'current' | 'upcoming' | 'finished', dates: { start?: string; end?: string; next?: string } = {}) => ({
    name,
    bucket,
    startDate: dates.start ?? null,
    endDate: dates.end ?? null,
    nextDate: dates.next ?? null,
  });

  it('en cours : prochaine séance la plus proche d’abord ; à venir : début le plus proche ; terminés : les plus récents', () => {
    const arranged = arrangeGroups([
      item('Zèbre', 'current', { next: '2026-11-25' }),
      item('Sans séance', 'current'),
      item('Alpha', 'current', { next: '2026-11-22' }),
      item('Bêta', 'current', { next: '2026-11-25' }),
      item('Janvier', 'upcoming', { start: '2027-01-05' }),
      item('Décembre', 'upcoming', { start: '2026-12-01' }),
      item('Printemps', 'finished', { end: '2026-05-30' }),
      item('Octobre', 'finished', { end: '2026-10-15' }),
      item('Sans fin', 'finished'),
    ]);
    expect(arranged.current.map((group) => group.name)).toEqual(['Alpha', 'Bêta', 'Zèbre', 'Sans séance']);
    expect(arranged.upcoming.map((group) => group.name)).toEqual(['Décembre', 'Janvier']);
    expect(arranged.finished.map((group) => group.name)).toEqual(['Octobre', 'Printemps', 'Sans fin']);
  });

  it('aucun groupe : trois listes vides', () => {
    expect(arrangeGroups([])).toEqual({ current: [], upcoming: [], finished: [] });
  });
});

describe('ordre des membres', () => {
  it('les membres actifs d’abord, par nom puis prénom (sans tenir compte des accents) ; les parcours interrompus ensuite', () => {
    const sorted = sortMembers([
      { firstName: 'Lucas', lastName: 'Martin', membership: 'dropped' },
      { firstName: 'Inès', lastName: 'Émile', membership: 'active' },
      { firstName: 'Sarah', lastName: 'Dubois', membership: 'active' },
      { firstName: 'Amina', lastName: 'Dubois', membership: 'active' },
      { firstName: 'Hugo', lastName: 'Bernard', membership: 'dropped' },
    ]);
    expect(sorted.map((member) => `${member.firstName} ${member.lastName}`)).toEqual(['Amina Dubois', 'Sarah Dubois', 'Inès Émile', 'Hugo Bernard', 'Lucas Martin']);
  });
});

describe('textes des cartes', () => {
  it('liste les formateurs comme on le dirait', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Camille Laurent'])).toBe('Camille Laurent');
    expect(joinNames(['Camille Laurent', 'Hugo Roux'])).toBe('Camille Laurent et Hugo Roux');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B et C');
  });

  it('horaire compact, qui tient dans une case sur téléphone', () => {
    expect(compactTimeRange('09:00:00', '12:00:00')).toBe('9 h – 12 h');
    expect(compactTimeRange('09:30', '12:15:00')).toBe('9 h 30 – 12 h 15');
    expect(compactTimeRange('14:00:00', null)).toBe('dès 14 h');
    expect(compactTimeRange(null, null)).toBe('');
  });

  it('donne la période d’un groupe, l’année une seule fois quand elle ne change pas', () => {
    expect(dateSpan('2026-10-23', '2026-12-04')).toBe('du 23 oct. au 4 déc. 2026');
    expect(dateSpan('2026-12-15', '2027-01-20')).toBe('du 15 déc. 2026 au 20 janv. 2027');
    expect(dateSpan('2026-10-23', null)).toBe('à partir du 23 oct. 2026');
    expect(dateSpan(null, '2026-12-04')).toBe('jusqu’au 4 déc. 2026');
    expect(dateSpan(null, null)).toBe('dates à définir');
    expect(dateSpan('pas une date', null)).toBe('dates à définir');
  });
});

describe('compétences révélées', () => {
  it('compte une fois chaque compétence observée (note renseignée) par personne', () => {
    const counts = revealedSkillCounts([
      { participantId: 'p1', skillKey: 'transversal:ecoute', score: 2 },
      { participantId: 'p1', skillKey: 'transversal:ecoute', score: 3 },
      { participantId: 'p1', skillKey: 'transversal:cooperation', score: 1 },
      { participantId: 'p1', skillKey: 'transversal:autonomie', score: null },
      { participantId: 'p2', skillKey: 'transversal:ecoute', score: null },
    ]);
    expect(counts.get('p1')).toBe(2);
    expect(counts.get('p2') ?? 0).toBe(0);
    expect(counts.get('inconnu') ?? 0).toBe(0);
  });
});
