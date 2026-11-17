import { describe, expect, it } from 'vitest';

import { formatParisDateTime, parisLocalToIso } from './dates';
import { compatibility, dayOf, freeSeats, groupSlots, rankCandidates, slotOf } from './compatibility';
import { mentionsHealth, referralFormValues, referralRow, referralSchema, shortName } from './fields';
import { allowedTargets, canTransition, isClosed, referralBuckets, REFERRAL_STATUSES, requiresReason } from './status';

describe('machine d’états des orientations', () => {
  it('suit le parcours envoyée → reçue → entretien → acceptée', () => {
    expect(canTransition('sent', 'received')).toBe(true);
    expect(canTransition('received', 'interview_scheduled')).toBe(true);
    expect(canTransition('interview_scheduled', 'accepted')).toBe(true);
  });

  it('autorise la liste d’attente puis l’acceptation, et la replanification d’un entretien', () => {
    expect(canTransition('received', 'waitlisted')).toBe(true);
    expect(canTransition('waitlisted', 'accepted')).toBe(true);
    expect(canTransition('interview_scheduled', 'interview_scheduled')).toBe(true);
  });

  it('interdit tout retour en arrière et tout changement après une décision', () => {
    expect(canTransition('waitlisted', 'received')).toBe(false);
    expect(canTransition('interview_scheduled', 'sent')).toBe(false);
    for (const closed of ['accepted', 'refused', 'cancelled'] as const) {
      expect(isClosed(closed)).toBe(true);
      for (const to of REFERRAL_STATUSES) expect(canTransition(closed, to)).toBe(false);
    }
  });

  it('réserve l’annulation au prescripteur et le traitement à l’équipe HAPPI', () => {
    expect(allowedTargets('sent', 'prescriber')).toEqual(['cancelled']);
    expect(allowedTargets('sent', 'staff')).not.toContain('cancelled');
    expect(canTransition('received', 'refused', 'prescriber')).toBe(false);
    expect(canTransition('received', 'cancelled', 'staff')).toBe(false);
    expect(allowedTargets('accepted', 'prescriber')).toEqual([]);
  });

  it('exige un motif pour un refus ou une annulation', () => {
    expect(requiresReason('refused')).toBe(true);
    expect(requiresReason('cancelled')).toBe(true);
    expect(requiresReason('waitlisted')).toBe(false);
  });

  it('répartit les orientations pour le tableau de bord', () => {
    expect(referralBuckets(['sent', 'received', 'interview_scheduled', 'waitlisted', 'accepted', 'refused', 'cancelled'])).toEqual({
      pending: 2,
      inProgress: 2,
      accepted: 1,
      closed: 2,
    });
  });
});

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) data.append(key, item);
  return data;
}

const minimal = {
  firstName: ' Inès ',
  lastName: 'Benali',
  email: ' Ines.Benali@Exemple.FR ',
  reason: 'Souhaite reprendre confiance avant une entrée en formation.',
  informed: 'on',
};

describe('fiche d’orientation : minimisation', () => {
  it('accepte une fiche minimale et normalise l’adresse', () => {
    const parsed = referralSchema.parse(referralFormValues(form(minimal)));
    expect(parsed.email).toBe('ines.benali@exemple.fr');
    expect(parsed.firstName).toBe('Inès');
    expect(parsed.phone).toBeNull();
    expect(parsed.ageBand).toBeNull();
    expect(parsed.consentImage).toBe(false);
    expect(parsed.consentShareResults).toBe(false);
  });

  it('exige que la personne ait été informée', () => {
    const result = referralSchema.safeParse(referralFormValues(form({ ...minimal, informed: '' })));
    expect(result.success).toBe(false);
  });

  it('refuse les champs non prévus (pas de date de naissance, pas de détail de santé)', () => {
    const values = { ...referralFormValues(form(minimal)), birthDate: '2001-02-03' };
    expect(referralSchema.safeParse(values).success).toBe(false);
    const healthDetails = { ...referralFormValues(form(minimal)), accommodationDetails: 'fauteuil' };
    expect(referralSchema.safeParse(healthDetails).success).toBe(false);
  });

  it('écarte les informations de santé des textes libres', () => {
    expect(mentionsHealth('Suivi psychiatrique en cours')).toBe(true);
    expect(mentionsHealth('Reconnaissance RQTH')).toBe(true);
    expect(mentionsHealth('Problèmes de santé')).toBe(true);
    expect(mentionsHealth('Souhaite travailler la prise de parole en groupe')).toBe(false);
    const result = referralSchema.safeParse(referralFormValues(form({ ...minimal, constraintsDetails: 'Rendez-vous médicaux le mardi' })));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['constraintsDetails']);
  });

  it('borne la longueur du motif à 1000 caractères', () => {
    expect(referralSchema.safeParse(referralFormValues(form({ ...minimal, reason: 'a'.repeat(1001) }))).success).toBe(false);
    expect(referralSchema.safeParse(referralFormValues(form({ ...minimal, reason: 'trop court' }))).success).toBe(true);
    expect(referralSchema.safeParse(referralFormValues(form({ ...minimal, reason: 'court' }))).success).toBe(false);
  });

  it('ne garde que des codes connus pour les disponibilités et contraintes', () => {
    const ok = referralSchema.parse(referralFormValues(form({ ...minimal, availabilityDays: ['lundi', 'lundi', 'mardi'], availabilitySlots: 'matin' })));
    expect(ok.availabilityDays).toEqual(['lundi', 'mardi']);
    expect(referralSchema.safeParse(referralFormValues(form({ ...minimal, availabilityDays: 'dimanche' }))).success).toBe(false);
    expect(referralSchema.safeParse(referralFormValues(form({ ...minimal, practicalConstraints: 'handicap' }))).success).toBe(false);
  });

  it('refuse une date de démarrage passée', () => {
    expect(referralSchema.safeParse(referralFormValues(form({ ...minimal, desiredStartDate: '2020-01-01' }))).success).toBe(false);
  });

  it('n’écrit en base que les colonnes de la fiche', () => {
    const row = referralRow(referralSchema.parse(referralFormValues(form({ ...minimal, consentImage: 'oui' }))), 'org');
    expect(Object.keys(row).sort()).toEqual(
      [
        'age_band', 'availability_days', 'availability_slots', 'consent_image', 'consent_share_results', 'constraints_details',
        'desired_start_date', 'email', 'first_name', 'information_acknowledged_at', 'information_version', 'last_name',
        'needs_accommodation', 'objectives', 'organization_id', 'phone', 'practical_constraints', 'program_id', 'reason',
      ].sort(),
    );
    expect(row.consent_image).toBe(true);
  });

  it('abrège le nom dans les messages', () => {
    expect(shortName('Inès', 'benali')).toBe('Inès B.');
    expect(shortName('', '')).toBe('la personne');
  });
});

describe('compatibilité avec un groupe', () => {
  const today = '2026-11-16';
  // 2026-11-23 : lundi ; 2026-11-25 : mercredi.
  const group = {
    programId: 'p1',
    startDate: '2026-11-23',
    endDate: '2026-12-20',
    sessions: [
      { date: '2026-11-23', startTime: '09:00:00', status: 'planned' },
      { date: '2026-11-25', startTime: '09:30:00', status: 'planned' },
      { date: '2026-11-02', startTime: '14:00:00', status: 'completed' },
    ],
  };
  const candidate = { programId: 'p1', availabilityDays: ['lundi', 'mercredi', 'jeudi'], availabilitySlots: ['matin'], desiredStartDate: null };

  it('calcule jours et demi-journées', () => {
    expect(dayOf('2026-11-23')).toBe('lundi');
    expect(dayOf('2026-11-22')).toBeNull();
    expect(slotOf('11:59:00')).toBe('matin');
    expect(slotOf('12:00:00')).toBe('apres_midi');
    expect(groupSlots(group.sessions, today)).toEqual({ days: ['lundi', 'mercredi'], slots: ['matin'] });
  });

  it('retient une personne disponible sur les créneaux du groupe', () => {
    expect(compatibility(candidate, group, today).compatible).toBe(true);
  });

  it('écarte un autre programme, des créneaux incompatibles ou un démarrage trop tardif', () => {
    expect(compatibility({ ...candidate, programId: 'p2' }, group, today).compatible).toBe(false);
    expect(compatibility({ ...candidate, availabilityDays: ['lundi'] }, group, today).compatible).toBe(false);
    expect(compatibility({ ...candidate, availabilitySlots: ['apres_midi'] }, group, today).compatible).toBe(false);
    expect(compatibility({ ...candidate, desiredStartDate: '2027-01-10' }, group, today).compatible).toBe(false);
  });

  it('garde les personnes sans disponibilités renseignées, après les autres', () => {
    const ranked = rankCandidates(
      [
        { ...candidate, availabilityDays: [], availabilitySlots: [], programId: null, createdAt: '2026-10-01' },
        { ...candidate, createdAt: '2026-11-01' },
        { ...candidate, programId: 'p2', createdAt: '2026-09-01' },
      ],
      group,
      today,
    );
    expect(ranked.map((entry) => entry.candidate.createdAt)).toEqual(['2026-11-01', '2026-10-01']);
  });

  it('calcule les places restantes', () => {
    expect(freeSeats(null, 8, 5)).toBe(3);
    expect(freeSeats(6, 8, 5)).toBe(1);
    expect(freeSeats(12, 8, 5)).toBe(3);
    expect(freeSeats(4, 8, 5)).toBe(0);
  });
});

describe('dates d’entretien (heure de Paris)', () => {
  it('convertit l’heure saisie en UTC, en hiver comme en été', () => {
    expect(parisLocalToIso('2026-11-20T10:00')).toBe('2026-11-20T09:00:00.000Z');
    expect(parisLocalToIso('2026-07-01T10:00')).toBe('2026-07-01T08:00:00.000Z');
    expect(parisLocalToIso('demain')).toBeNull();
    expect(formatParisDateTime('2026-11-20T09:00:00.000Z')).toBe('vendredi 20 novembre 2026 à 10:00');
  });
});
