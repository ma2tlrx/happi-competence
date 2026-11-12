import { describe, expect, it } from 'vitest';

import { csvCell, indicatorsCsv, participantsCsv } from './csv';
import { buildImpactReport, filterDataset, formatRatio, ratio, type ImpactDataset } from './impact';

const today = '2026-11-11';

function dataset(): ImpactDataset {
  return {
    groups: [
      { id: 'g1', name: 'Cohorte printemps', programId: 'p1', programName: 'HAPPI', organizationId: 'o1', organizationName: 'Mission A', startDate: '2026-03-01', endDate: '2026-04-30', status: 'completed' },
      { id: 'g2', name: 'Cohorte automne', programId: 'p2', programName: 'Autre', organizationId: 'o2', organizationName: 'Mission B', startDate: '2026-10-01', endDate: '2026-12-15', status: 'active' },
    ],
    participants: [
      { id: 'a', firstName: 'Ana', lastName: 'Aubert', organizationId: 'o1', organizationName: 'Mission A' },
      { id: 'b', firstName: 'Bilal', lastName: 'Bernard', organizationId: 'o1', organizationName: 'Mission A' },
      { id: 'c', firstName: 'Chloé', lastName: 'Colin', organizationId: 'o2', organizationName: 'Mission B' },
      { id: 'd', firstName: 'Dan', lastName: 'Durand', organizationId: null, organizationName: null },
      { id: 'e', firstName: 'Eva', lastName: 'Erreur', organizationId: 'o1', organizationName: 'Mission A' },
    ],
    memberships: [
      { groupId: 'g1', participantId: 'a', status: 'active', dropReason: null, droppedAt: null },
      { groupId: 'g1', participantId: 'b', status: 'dropped', dropReason: 'emploi_trouve', droppedAt: '2026-03-20' },
      { groupId: 'g2', participantId: 'c', status: 'active', dropReason: null, droppedAt: null },
      { groupId: 'g2', participantId: 'd', status: 'active', dropReason: null, droppedAt: null },
      { groupId: 'g1', participantId: 'e', status: 'removed', dropReason: null, droppedAt: null },
    ],
    sessions: [
      { id: 's1', groupId: 'g1', status: 'completed', date: '2026-03-05', number: 1 },
      { id: 's2', groupId: 'g1', status: 'completed', date: '2026-03-12', number: 2 },
      { id: 's3', groupId: 'g2', status: 'completed', date: '2026-10-05', number: 1 },
      { id: 's4', groupId: 'g2', status: 'planned', date: '2026-11-20', number: 2 },
    ],
    attendance: [
      { sessionId: 's1', participantId: 'a', status: 'present' },
      { sessionId: 's2', participantId: 'a', status: 'late' },
      { sessionId: 's1', participantId: 'b', status: 'present' },
      { sessionId: 's2', participantId: 'b', status: 'absent' },
      { sessionId: 's3', participantId: 'c', status: 'present' },
      // d : aucune présence saisie (non renseigné, pas absent).
      { sessionId: 's1', participantId: 'e', status: 'absent' },
    ],
    observations: [
      { participantId: 'a', sessionId: 's1', skillId: 'k1', score: 2 },
      { participantId: 'a', sessionId: 's2', skillId: 'k1', score: 3 },
      { participantId: 'b', sessionId: 's1', skillId: 'k1', score: 3 },
      { participantId: 'b', sessionId: 's2', skillId: 'k1', score: 3 },
      { participantId: 'c', sessionId: 's3', skillId: 'k1', score: 4 },
    ],
    outcomes: [
      { participantId: 'a', groupId: 'g1', kind: 'entry', situation: 'recherche_emploi' },
      { participantId: 'a', groupId: 'g1', kind: 'exit', situation: 'formation_qualifiante' },
      { participantId: 'b', groupId: 'g1', kind: 'exit', situation: 'emploi_durable' },
      { participantId: 'b', groupId: 'g1', kind: 'followup_6m', situation: 'sans_nouvelles' },
    ],
  };
}

describe('tableau de bord d’impact', () => {
  const report = buildImpactReport(dataset(), today);

  it('compte inscrits, actifs et abandons en excluant les retraits', () => {
    expect(report.total).toMatchObject({ enrolled: 4, active: 3, dropped: 1 });
    expect(report.total.dropRate).toEqual(ratio(1, 4));
    expect(report.total.dropReasons.emploi_trouve).toBe(1);
    expect(report.participants.map((row) => row.participant.id)).not.toContain('e');
  });

  it('assiduité sur les séances terminées, présences non saisies hors dénominateur', () => {
    // a : 2/2, b : 1/2, c : 1/1, d : 0/0 → 4/5.
    expect(report.total.attendance).toEqual(ratio(4, 5));
    const d = report.participants.find((row) => row.participant.id === 'd')!;
    expect(d.detail.attendance).toEqual({ count: 0, n: 0, rate: null });
    expect(report.total.sessionsCompleted).toBe(3);
  });

  it('progression observée : au moins une compétence vue deux fois, en hausse', () => {
    // a : 2 → 3 (progression) ; b : 3 → 3 (pas de progression) ; c et d : non évaluables.
    expect(report.total.progression).toMatchObject({ count: 1, n: 2, insufficient: 2 });
  });

  it('situations : attendues à échéance, non renseignées distinguées, jamais comptées comme zéro', () => {
    const { entry, exit, followup_3m, followup_6m } = report.total.outcomes;
    expect(entry).toMatchObject({ expected: 4, recorded: 1, missing: 3 });
    // Sortie attendue pour a (groupe terminé) et b (abandon) ; g2 n'est pas terminé.
    expect(exit).toMatchObject({ expected: 2, recorded: 2, missing: 0, rate: 100 });
    expect(exit.bySituation).toMatchObject({ emploi_durable: 1, formation_qualifiante: 1, recherche_emploi: 0 });
    // 3 mois : a (30/07) et b (20/06) attendus, aucun renseigné.
    expect(followup_3m).toMatchObject({ expected: 2, recorded: 0, missing: 2, rate: 0 });
    // 6 mois : b (20/09) attendu et renseigné « sans nouvelles » ; a (30/10) attendu, non renseigné.
    expect(followup_6m).toMatchObject({ expected: 2, recorded: 1, missing: 1 });
    expect(followup_6m.bySituation.sans_nouvelles).toBe(1);
    const c = report.participants.find((row) => row.participant.id === 'c')!;
    expect(c.detail.outcomes).toEqual({ entry: null, exit: undefined, followup_3m: undefined, followup_6m: undefined });
  });

  it('un taux sans effectif vaut null, pas zéro', () => {
    const empty = buildImpactReport({ ...dataset(), memberships: [] }, today);
    expect(empty.total.attendance.rate).toBeNull();
    expect(empty.total.outcomes.exit.rate).toBeNull();
    expect(formatRatio(empty.total.attendance)).toBe('— (n = 0)');
    expect(formatRatio(ratio(3, 4))).toBe('75 % (n = 4)');
  });

  it('regroupe par cohorte et par organisme du participant', () => {
    expect(report.cohorts.map((row) => [row.group.id, row.indicators.enrolled])).toEqual([['g2', 2], ['g1', 2]]);
    expect(report.organizations.map((row) => [row.organizationName, row.indicators.enrolled])).toEqual([
      ['Mission A', 2],
      ['Mission B', 1],
      ['Sans organisme', 1],
    ]);
  });

  it('filtre par période, programme et organisme', () => {
    const spring = filterDataset(dataset(), { from: '2026-01-01', to: '2026-06-30' });
    expect(spring.groups.map((group) => group.id)).toEqual(['g1']);
    const program = filterDataset(dataset(), { programId: 'p2' });
    expect(program.memberships.map((m) => m.participantId)).toEqual(['c', 'd']);
    const organization = filterDataset(dataset(), { organizationId: 'o1' });
    expect(organization.memberships.map((m) => m.participantId)).toEqual(['a', 'b']);
    expect(organization.groups.map((group) => group.id)).toEqual(['g1']);
    expect(organization.participants.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('exports CSV', () => {
  it('neutralise les formules et échappe les guillemets', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+33 6')).toBe('"\'+33 6"');
    expect(csvCell('-1')).toBe('"\'-1"');
    expect(csvCell('@SUM')).toBe('"\'@SUM"');
    expect(csvCell('Dupont')).toBe('"Dupont"');
    expect(csvCell(null)).toBe('""');
  });

  it('les indicateurs et le détail affichent « Non renseigné » plutôt que zéro', () => {
    const report = buildImpactReport(dataset(), today);
    const indicators = indicatorsCsv(report);
    expect(indicators.startsWith('﻿')).toBe(true);
    expect(indicators).toContain('"Cohorte";"Cohorte automne"');
    const detail = participantsCsv({ ...report, participants: report.participants.filter((row) => row.participant.id === 'd') });
    const line = detail.split('\r\n')[1]!;
    expect(line).toContain('"Non évaluable"');
    expect(line).toContain('"Non renseigné"');
    expect(line).toContain('"Pas encore attendu"');
  });
});
