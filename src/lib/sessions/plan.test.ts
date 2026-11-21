import { describe, expect, it } from 'vitest';

import { checkPlan, copyForward, firstFilledIndex, initialRows, readPlanRows, type PlanRow } from './plan';

/**
 * Parcours visés (formateur) :
 *  • donner à chaque session sa date, son horaire et son lieu ;
 *  • recopier une ligne sur les suivantes, une semaine plus tard, pour aller vite ;
 *  • être prévenu, sur la bonne ligne, quand une date est dans le désordre.
 */
const row = (number: number, values: Partial<Omit<PlanRow, 'number'>> = {}): PlanRow => ({ number, date: '', start: '', end: '', location: '', ...values });

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('lecture du formulaire', () => {
  it('lit date, début, fin et lieu de chaque session demandée, sans espaces superflus', () => {
    const data = form({ 'date-2': ' 2026-12-07 ', 'start-2': '14:00', 'end-2': '17:00', 'location-2': '  Salle B ', 'date-9': '2026-12-31' });
    expect(readPlanRows(data, [2, 3])).toEqual([row(2, { date: '2026-12-07', start: '14:00', end: '17:00', location: 'Salle B' }), row(3)]);
  });

  it('ignore une valeur qui n’est pas du texte (fichier)', () => {
    const data = new FormData();
    data.set('location-1', new Blob(['x']), 'lieu.txt');
    expect(readPlanRows(data, [1])).toEqual([row(1)]);
  });
});

describe('vérification ligne par ligne', () => {
  it('accepte des lignes vides : date, horaires et lieu sont facultatifs', () => {
    expect(checkPlan([row(1), row(2)])).toEqual({
      ok: true,
      sessions: [
        { number: 1, date: null, start: null, end: null, location: null },
        { number: 2, date: null, start: null, end: null, location: null },
      ],
    });
  });

  it('garde l’horaire et le lieu propres à chaque session', () => {
    const result = checkPlan([
      row(1, { date: '2026-12-01', start: '09:00', end: '12:00', location: 'Salle A' }),
      row(2, { date: '2026-12-08', start: '14:00', end: '17:30', location: 'Médiathèque' }),
    ]);
    expect(result).toEqual({
      ok: true,
      sessions: [
        { number: 1, date: '2026-12-01', start: '09:00', end: '12:00', location: 'Salle A' },
        { number: 2, date: '2026-12-08', start: '14:00', end: '17:30', location: 'Médiathèque' },
      ],
    });
  });

  it('accepte un début sans fin, ou une fin sans début', () => {
    expect(checkPlan([row(1, { start: '09:00' }), row(2, { end: '12:00' })]).ok).toBe(true);
  });

  it('refuse une date mal formée ou qui n’existe pas', () => {
    expect(checkPlan([row(1, { date: '01/12/2026' }), row(2, { date: '2026-02-30' })])).toEqual({
      ok: false,
      errors: { 'date-1': 'Date invalide.', 'date-2': 'Date invalide.' },
    });
  });

  it('refuse un horaire invalide, sur le bon champ', () => {
    expect(checkPlan([row(3, { start: '25:00', end: '9h' })])).toEqual({ ok: false, errors: { 'start-3': 'Horaire invalide.', 'end-3': 'Horaire invalide.' } });
  });

  it('exige une fin après le début', () => {
    const message = 'L’heure de fin doit suivre l’heure de début.';
    expect(checkPlan([row(3, { start: '12:00', end: '09:00' })])).toEqual({ ok: false, errors: { 'end-3': message } });
    expect(checkPlan([row(4, { start: '10:00', end: '10:00' })])).toEqual({ ok: false, errors: { 'end-4': message } });
  });

  it('limite le lieu à 200 caractères', () => {
    expect(checkPlan([row(4, { location: 'x'.repeat(200) })]).ok).toBe(true);
    expect(checkPlan([row(4, { location: 'x'.repeat(201) })])).toEqual({ ok: false, errors: { 'location-4': 'Le lieu est trop long (200 caractères au plus).' } });
  });

  it('signale toutes les lignes fautives à la fois', () => {
    const result = checkPlan([row(1, { start: '14:00', end: '13:00' }), row(2), row(3, { date: 'demain', location: 'y'.repeat(300) })]);
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['date-3', 'end-1', 'location-3']);
  });
});

describe('ordre des dates', () => {
  const weekly = ['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29', '2027-01-05'];
  const rows = (dates: string[]) => dates.map((date, index) => row(index + 1, { date }));

  it('accepte des dates qui suivent l’ordre des sessions, y compris le même jour', () => {
    expect(checkPlan(rows(weekly)).ok).toBe(true);
    expect(checkPlan(rows(['2026-12-01', '2026-12-01'])).ok).toBe(true);
  });

  it('refuse une date qui précède celle de la session d’avant, sur la ligne fautive', () => {
    const dates = [...weekly];
    dates[3] = '2026-12-14';
    expect(checkPlan(rows(dates))).toEqual({ ok: false, errors: { 'date-4': 'Cette date précède celle de la session 3.' } });
  });

  it('le bilan individuel (session 6) vient après la session 5', () => {
    const dates = [...weekly];
    dates[5] = '2026-12-28';
    expect(checkPlan(rows(dates))).toEqual({ ok: false, errors: { 'date-6': 'Cette date précède celle de la session 5.' } });
  });

  it('nomme la session la plus tardive parmi les précédentes, sessions sans date ignorées', () => {
    expect(checkPlan([row(1, { date: '2026-12-20' }), row(2, { date: '2026-12-10' }), row(3), row(4, { date: '2026-12-15' })])).toEqual({
      ok: false,
      errors: { 'date-2': 'Cette date précède celle de la session 1.', 'date-4': 'Cette date précède celle de la session 1.' },
    });
  });

  it('tient compte des sessions déjà planifiées du groupe', () => {
    const planned = [
      { number: 1, date: '2026-12-01' },
      { number: 2, date: '2026-12-08' },
      { number: 4, date: '2026-12-22' },
      { number: 5, date: null },
    ];
    expect(checkPlan([row(3, { date: '2026-12-15' }), row(6, { date: '2027-01-05' })], planned).ok).toBe(true);
    expect(checkPlan([row(3, { date: '2026-12-05' })], planned)).toEqual({ ok: false, errors: { 'date-3': 'Cette date précède celle de la session 2.' } });
    expect(checkPlan([row(3, { date: '2026-12-23' })], planned)).toEqual({ ok: false, errors: { 'date-3': 'Cette date suit celle de la session 4.' } });
    expect(checkPlan([row(6, { date: '2026-12-21' })], planned)).toEqual({ ok: false, errors: { 'date-6': 'Cette date précède celle de la session 4.' } });
  });

  it('une date invalide n’entre pas dans la comparaison', () => {
    expect(checkPlan([row(1, { date: '2026-13-01' }), row(2, { date: '2026-12-01' })])).toEqual({ ok: false, errors: { 'date-1': 'Date invalide.' } });
  });
});

describe('valeurs de départ', () => {
  it('propose une date par semaine depuis le début du groupe, 09:00–12:00, lieu vide', () => {
    expect(initialRows([{ number: 1 }, { number: 2 }, { number: 3 }], '2026-12-28')).toEqual([
      row(1, { date: '2026-12-28', start: '09:00', end: '12:00' }),
      row(2, { date: '2027-01-04', start: '09:00', end: '12:00' }),
      row(3, { date: '2027-01-11', start: '09:00', end: '12:00' }),
    ]);
  });

  it('cale la date sur le numéro de la session quand les premières existent déjà', () => {
    expect(initialRows([{ number: 3 }, { number: 6 }], '2026-12-01').map((item) => item.date)).toEqual(['2026-12-15', '2027-01-05']);
  });

  it('laisse les dates vides sans date de début, et ne dépend pas du changement d’heure', () => {
    expect(initialRows([{ number: 1 }], null)).toEqual([row(1, { start: '09:00', end: '12:00' })]);
    expect(initialRows([{ number: 2 }], '2026-10-19')[0]!.date).toBe('2026-10-26');
  });
});

describe('recopier sur les suivantes', () => {
  const filled = row(1, { date: '2026-12-01', start: '14:00', end: '17:00', location: 'Salle B' });

  it('reprend la première ligne datée, sinon la première ligne remplie', () => {
    expect(firstFilledIndex([row(1, { start: '09:00' }), row(2, { date: '2026-12-08' })])).toBe(1);
    expect(firstFilledIndex([row(1), row(2, { location: 'Salle B' })])).toBe(1);
    expect(firstFilledIndex([row(1), row(2)])).toBe(-1);
  });

  it('propose les suivantes une semaine plus tard, mêmes horaires et même lieu', () => {
    const before = [filled, row(2, { date: '2026-12-31', start: '08:00' }), row(3)];
    expect(copyForward(before, 0)).toEqual([
      filled,
      row(2, { date: '2026-12-08', start: '14:00', end: '17:00', location: 'Salle B' }),
      row(3, { date: '2026-12-15', start: '14:00', end: '17:00', location: 'Salle B' }),
    ]);
    expect(before[1]).toEqual(row(2, { date: '2026-12-31', start: '08:00' }));
  });

  it('ne touche pas aux lignes précédentes et suit le numéro des sessions', () => {
    const result = copyForward([row(1, { date: '2026-11-01' }), row(2, { date: '2026-12-01', start: '10:00' }), row(5)], 1);
    expect(result[0]).toEqual(row(1, { date: '2026-11-01' }));
    expect(result[2]).toEqual(row(5, { date: '2026-12-22', start: '10:00' }));
  });

  it('sans date de départ, recopie horaires et lieu et garde les dates', () => {
    expect(copyForward([row(1, { start: '13:30', location: 'Salle C' }), row(2, { date: '2026-12-08' })], 0)[1]).toEqual(
      row(2, { date: '2026-12-08', start: '13:30', location: 'Salle C' }),
    );
  });

  it('ne fait rien sans ligne de départ', () => {
    const rows = [row(1), row(2)];
    expect(copyForward(rows, -1)).toEqual(rows);
  });
});
