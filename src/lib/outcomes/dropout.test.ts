import { describe, expect, it } from 'vitest';

import { dropoutAlerts, type DropoutAttendance, type DropoutSession } from './dropout';

const sessions: DropoutSession[] = [
  { id: 's1', status: 'completed', date: '2026-09-01', number: 1 },
  { id: 's2', status: 'completed', date: '2026-09-08', number: 2 },
  { id: 's3', status: 'completed', date: '2026-09-15', number: 3 },
  { id: 's4', status: 'planned', date: '2026-09-22', number: 4 },
];
const row = (participantId: string, sessionId: string, status: string): DropoutAttendance => ({ participantId, sessionId, status });

describe('alerte de décrochage', () => {
  it('signale deux absences consécutives (absent ou excusé) sur les séances terminées', () => {
    const alerts = dropoutAlerts(['a'], sessions, [row('a', 's1', 'present'), row('a', 's2', 'excused'), row('a', 's3', 'excused')]);
    expect(alerts).toEqual([{ participantId: 'a', reasons: ['consecutive_absences'], trailingAbsences: 2, lastSessionId: 's3' }]);
  });

  it('signale une absence sans motif à la dernière séance terminée', () => {
    const alerts = dropoutAlerts(['a'], sessions, [row('a', 's1', 'present'), row('a', 's2', 'present'), row('a', 's3', 'absent')]);
    expect(alerts[0]?.reasons).toEqual(['unexcused_last_session']);
  });

  it('cumule les deux motifs', () => {
    const alerts = dropoutAlerts(['a'], sessions, [row('a', 's2', 'absent'), row('a', 's3', 'absent')]);
    expect(alerts[0]?.reasons).toEqual(['consecutive_absences', 'unexcused_last_session']);
  });

  it('ne signale rien pour une seule absence excusée, ni pour une présence en retard', () => {
    expect(dropoutAlerts(['a'], sessions, [row('a', 's1', 'present'), row('a', 's2', 'late'), row('a', 's3', 'excused')])).toEqual([]);
  });

  it('une absence suivie d’une présence ne déclenche rien', () => {
    expect(dropoutAlerts(['a'], sessions, [row('a', 's1', 'absent'), row('a', 's2', 'absent'), row('a', 's3', 'present')])).toEqual([]);
  });

  it('une présence non saisie n’est pas une absence : elle est ignorée', () => {
    // s2 non renseignée : les absences de s1 et s3 se suivent parmi les séances renseignées.
    const alerts = dropoutAlerts(['a'], sessions, [row('a', 's1', 'excused'), row('a', 's3', 'excused')]);
    expect(alerts[0]?.reasons).toEqual(['consecutive_absences']);
    // Aucune saisie : aucune alerte.
    expect(dropoutAlerts(['b'], sessions, [])).toEqual([]);
  });

  it('ignore les séances non terminées et les participants non fournis (abandons, retraits)', () => {
    const planned = sessions.map((session) => ({ ...session, status: 'planned' }));
    expect(dropoutAlerts(['a'], planned, [row('a', 's1', 'absent'), row('a', 's2', 'absent')])).toEqual([]);
    expect(dropoutAlerts([], sessions, [row('a', 's2', 'absent'), row('a', 's3', 'absent')])).toEqual([]);
  });

  it('ordonne les séances par date puis par numéro', () => {
    const shuffled: DropoutSession[] = [
      { id: 'late', status: 'completed', date: '2026-10-01', number: 2 },
      { id: 'early', status: 'completed', date: '2026-09-01', number: 1 },
    ];
    const alerts = dropoutAlerts(['a'], shuffled, [row('a', 'early', 'absent'), row('a', 'late', 'present')]);
    expect(alerts).toEqual([]);
  });
});
