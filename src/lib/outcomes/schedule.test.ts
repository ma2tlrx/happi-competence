import { describe, expect, it } from 'vitest';

import { addMonths, followupTasks, isGroupFinished, referenceDate, stateFor, type ScheduleGroup } from './schedule';

const finished: ScheduleGroup = { id: 'g1', name: 'Groupe terminé', status: 'completed', endDate: '2026-06-30' };
const running: ScheduleGroup = { id: 'g2', name: 'Groupe en cours', status: 'active', endDate: '2026-12-15' };

describe('dates', () => {
  it('ajoute des mois en restant dans le mois visé', () => {
    expect(addMonths('2026-06-30', 3)).toBe('2026-09-30');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2027-08-31', 6)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('un groupe est terminé par son statut ou sa date de fin dépassée', () => {
    expect(isGroupFinished(finished, '2026-07-01')).toBe(true);
    expect(isGroupFinished(running, '2026-11-11')).toBe(false);
    expect(isGroupFinished({ status: 'active', endDate: '2026-11-01' }, '2026-11-11')).toBe(true);
  });

  it('date de référence : abandon, sinon fin du groupe, sinon dernière séance', () => {
    const today = '2026-11-11';
    expect(referenceDate({ groupId: 'g2', participantId: 'p', status: 'dropped', droppedAt: '2026-10-02' }, running, today)).toBe('2026-10-02');
    expect(referenceDate({ groupId: 'g1', participantId: 'p', status: 'active', droppedAt: null }, finished, today)).toBe('2026-06-30');
    expect(referenceDate({ groupId: 'g2', participantId: 'p', status: 'active', droppedAt: null }, running, today)).toBeUndefined();
    expect(referenceDate({ groupId: 'g1', participantId: 'p', status: 'removed', droppedAt: null }, finished, today)).toBeUndefined();
    expect(
      referenceDate({ groupId: 'g3', participantId: 'p', status: 'active', droppedAt: null }, { id: 'g3', name: '', status: 'completed', endDate: null, lastCompletedSessionDate: '2026-05-20' }, today),
    ).toBe('2026-05-20');
  });

  it('état : à venir, à faire, en retard au-delà de 30 jours, renseigné', () => {
    expect(stateFor('2026-12-01', false, '2026-11-11')).toBe('upcoming');
    expect(stateFor('2026-11-01', false, '2026-11-11')).toBe('due');
    expect(stateFor('2026-09-01', false, '2026-11-11')).toBe('late');
    expect(stateFor('2026-09-01', true, '2026-11-11')).toBe('done');
    expect(stateFor(null, false, '2026-11-11')).toBe('due');
  });
});

describe('échéancier', () => {
  it('produit sortie, 3 mois et 6 mois pour un groupe terminé et un abandon', () => {
    const tasks = followupTasks(
      [
        { groupId: 'g1', participantId: 'a', status: 'active', droppedAt: null },
        { groupId: 'g2', participantId: 'b', status: 'dropped', droppedAt: '2026-10-20' },
        { groupId: 'g2', participantId: 'c', status: 'active', droppedAt: null },
        { groupId: 'g1', participantId: 'd', status: 'removed', droppedAt: null },
      ],
      [finished, running],
      [{ participantId: 'a', groupId: 'g1', kind: 'exit' }],
      '2026-11-11',
    );
    const summary = tasks.map((task) => `${task.participantId}:${task.kind}:${task.dueDate}:${task.state}`);
    expect(summary).toEqual([
      'a:followup_3m:2026-09-30:late',
      'b:exit:2026-10-20:due',
      'a:followup_6m:2026-12-30:upcoming',
      'b:followup_3m:2027-01-20:upcoming',
      'b:followup_6m:2027-04-20:upcoming',
      'a:exit:2026-06-30:done',
    ]);
    expect(tasks.find((task) => task.participantId === 'b')?.dropped).toBe(true);
  });

  it('sans date de fin connue, seule la sortie est attendue', () => {
    const tasks = followupTasks(
      [{ groupId: 'g3', participantId: 'a', status: 'active', droppedAt: null }],
      [{ id: 'g3', name: 'Sans date', status: 'completed', endDate: null }],
      [],
      '2026-11-11',
    );
    expect(tasks.map((task) => [task.kind, task.dueDate, task.state])).toEqual([['exit', null, 'due']]);
  });
});
