import { describe, expect, it } from 'vitest';

import { complaintSchema, evidenceHref, improvementActionSchema, needsAssessmentSchema, periodSchema, qualificationSchema, reportSchema } from './schemas';

const today = '2026-11-16';
const complaint = {
  source: 'financeur',
  channel: 'telephone',
  receivedOn: '2026-11-10',
  subject: 'Pièces manquantes',
  description: 'Feuilles d’émargement non reçues',
  reporterName: '',
  status: 'received',
  response: '',
  respondedOn: '',
};

describe('réclamation saisie par l’administrateur', () => {
  it('accepte une réclamation reçue sans réponse', () => {
    const parsed = complaintSchema(today).parse(complaint);
    expect(parsed).toMatchObject({ response: null, respondedOn: null, reporterName: null });
  });
  it('exige réponse et date pour la marquer traitée', () => {
    const result = complaintSchema(today).safeParse({ ...complaint, status: 'resolved' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['response', 'respondedOn']));
  });
  it('refuse une date future ou une réponse antérieure à la réception', () => {
    expect(complaintSchema(today).safeParse({ ...complaint, receivedOn: '2026-12-01' }).success).toBe(false);
    expect(complaintSchema(today).safeParse({ ...complaint, response: 'ok', respondedOn: '2026-11-01' }).success).toBe(false);
  });
});

describe('signalement depuis un espace', () => {
  it('description d’au moins 10 caractères', () => {
    expect(reportSchema.safeParse({ subject: 'Salle', description: 'Trop court' }).success).toBe(true);
    expect(reportSchema.safeParse({ subject: 'Salle', description: 'Court' }).success).toBe(false);
  });
});

describe('action d’amélioration', () => {
  const action = { origin: 'audit', originDetails: '', complaintId: '', watchEntryId: '', title: 'Revoir le livret', description: '', ownerName: '', dueOn: '', status: 'planned', effectiveness: '' };
  it('exige la réclamation liée pour l’origine « réclamation »', () => {
    expect(improvementActionSchema().safeParse({ ...action, origin: 'reclamation' }).success).toBe(false);
  });
  it('ne garde un lien que pour l’origine correspondante', () => {
    const id = '7c1a1c33-77b1-48d6-a19e-a3b61e8bb8c2';
    expect(improvementActionSchema().parse({ ...action, complaintId: id }).complaintId).toBeNull();
    expect(improvementActionSchema().parse({ ...action, origin: 'reclamation', complaintId: id }).complaintId).toBe(id);
  });
});

describe('registre des intervenants', () => {
  const row = { kind: 'formation', title: 'Usage de l’IA', provider: '', description: '', startedOn: '', completedOn: '2026-03-01', isAiTraining: 'on', evidence: '' };
  it('formation à l’IA : seulement pour une formation suivie', () => {
    expect(qualificationSchema.parse(row).isAiTraining).toBe(true);
    expect(qualificationSchema.safeParse({ ...row, kind: 'diplome' }).success).toBe(false);
  });
  it('pièce justificative : référence libre ou adresse https', () => {
    expect(qualificationSchema.safeParse({ ...row, evidence: 'Attestation classée au dossier RH' }).success).toBe(true);
    expect(qualificationSchema.safeParse({ ...row, evidence: 'https://exemple.fr/attestation.pdf' }).success).toBe(true);
    expect(qualificationSchema.safeParse({ ...row, evidence: 'javascript:alert(1)' }).success).toBe(false);
    expect(evidenceHref('javascript:alert(1)')).toBeNull();
    expect(evidenceHref('https://exemple.fr/a.pdf')).toBe('https://exemple.fr/a.pdf');
  });
});

describe('analyse du besoin', () => {
  const base = { assessedOn: '2026-11-01', expectations: 'Reprendre confiance', constraintsNotes: '', prerequisites: '', prerequisitesMet: '', disabilityReferent: '' };
  it('adaptation « oui » : l’adaptation prévue est obligatoire', () => {
    expect(needsAssessmentSchema(today).safeParse({ ...base, adaptationNeeded: 'oui', adaptationPlanned: '' }).success).toBe(false);
    expect(needsAssessmentSchema(today).parse({ ...base, adaptationNeeded: 'oui', adaptationPlanned: 'Pauses' }).adaptationNeeded).toBe(true);
  });
  it('adaptation « non » : aucune description conservée', () => {
    expect(needsAssessmentSchema(today).parse({ ...base, adaptationNeeded: 'non', adaptationPlanned: 'x' }).adaptationPlanned).toBeNull();
  });
});

describe('période', () => {
  it('fin après début', () => {
    expect(periodSchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(true);
    expect(periodSchema.safeParse({ from: '2026-12-31', to: '2026-01-01' }).success).toBe(false);
  });
});
