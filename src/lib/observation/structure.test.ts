import { describe, expect, it } from 'vitest';

import { appendToComment, criterionRef, excerptInNotes, factCommentText, structuredNotesSchema, validateStructured, type CatalogSkill } from './structure';

const catalog: CatalogSkill[] = [
  {
    code: 'relationnel',
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Relationnel',
    description: null,
    framework: 'Compétences transversales',
    criteria: [
      { ref: criterionRef('relationnel', 0), id: 'c1', label: 'Écoute les autres' },
      { ref: criterionRef('relationnel', 1), id: 'c2', label: 'Reformule' },
    ],
  },
  { code: 'organisation', id: '22222222-2222-4222-8222-222222222222', name: 'Organisation', description: null, framework: 'Compétences transversales', criteria: [] },
];
const notes = 'A proposé de répartir les rôles avant la partie. Il a relu la consigne à voix haute pour le groupe.\nPas venu à la pause.';
const levels = ['Non acquis', 'En cours d’acquisition', 'Acquis', 'Maîtrise'];

describe('schéma de sortie de l’assistant d’observation', () => {
  it('accepte une sortie conforme et refuse un champ manquant', () => {
    expect(structuredNotesSchema.safeParse({ facts: [{ skillCode: 'x', criterionRef: null, fact: 'f', excerpt: 'e' }], unattached: [] }).success).toBe(true);
    expect(structuredNotesSchema.safeParse({ facts: [{ skillCode: 'x', fact: 'f' }], unattached: [] }).success).toBe(false);
  });
});

describe('validation serveur des faits proposés', () => {
  it('garde un fait valide, avec son critère et son extrait', () => {
    const result = validateStructured(
      {
        facts: [{ skillCode: 'relationnel', criterionRef: 'relationnel#2', fact: 'Relit la consigne pour le groupe.', excerpt: 'il a relu la consigne à voix haute' }],
        unattached: [{ excerpt: 'Pas venu à la pause.' }],
      },
      catalog,
      notes,
      levels,
    );
    expect(result.issues).toEqual([]);
    expect(result.facts).toEqual([
      expect.objectContaining({ skillCode: 'relationnel', skillId: catalog[0]!.id, criterionId: 'c2', criterionLabel: 'Reformule', fact: 'Relit la consigne pour le groupe.' }),
    ]);
    expect(result.unattached).toEqual(['Pas venu à la pause.']);
  });

  it('écarte un code de compétence ou de critère qui n’existe pas dans la séance', () => {
    const result = validateStructured(
      {
        facts: [
          { skillCode: 'leadership', criterionRef: null, fact: 'Prend la tête.', excerpt: 'A proposé de répartir les rôles' },
          { skillCode: 'organisation', criterionRef: 'organisation#1', fact: 'Répartit les rôles.', excerpt: 'A proposé de répartir les rôles' },
        ],
        unattached: [],
      },
      catalog,
      notes,
    );
    expect(result.facts).toEqual([]);
    expect(result.issues.map((issue) => issue.path)).toEqual(['facts.0', 'facts.1']);
  });

  it('écarte un fait dont l’extrait n’est pas dans les notes (rien d’inventé)', () => {
    const result = validateStructured(
      { facts: [{ skillCode: 'organisation', criterionRef: null, fact: 'Planifie la partie.', excerpt: 'a établi un planning détaillé' }], unattached: [{ excerpt: 'Inventé de toutes pièces.' }] },
      catalog,
      notes,
    );
    expect(result.facts).toEqual([]);
    expect(result.unattached).toEqual([]);
    expect(result.issues).toHaveLength(2);
  });

  it('écarte tout fait qui propose une note, un niveau ou un libellé de niveau', () => {
    for (const fact of ['Mérite 4/5 en organisation.', 'Niveau élevé en organisation.', 'Organisation : Acquis.', 'Score très bon.']) {
      const result = validateStructured({ facts: [{ skillCode: 'organisation', criterionRef: null, fact, excerpt: 'répartir les rôles' }], unattached: [] }, catalog, notes, levels);
      expect(result.facts, fact).toEqual([]);
      expect(result.issues[0]!.message).toMatch(/niveau/);
    }
  });

  it('écarte tout diagnostic ou étiquette psychologique', () => {
    for (const fact of ['Semble avoir un trouble de l’attention.', 'Personnalité introvertie.', 'Probablement TDAH.', 'Montre de l’anxiété en groupe.']) {
      const result = validateStructured({ facts: [{ skillCode: 'relationnel', criterionRef: null, fact, excerpt: 'relu la consigne' }], unattached: [] }, catalog, notes);
      expect(result.facts, fact).toEqual([]);
      expect(result.issues[0]!.message).toMatch(/diagnostic/);
    }
  });

  it('tolère les différences de casse, d’espaces et d’apostrophes dans l’extrait', () => {
    expect(excerptInNotes('IL  a relu la consigne', notes)).toBe(true);
    expect(excerptInNotes('l’équipe', "toute l'équipe")).toBe(true);
    expect(excerptInNotes('ok', notes)).toBe(false);
  });
});

describe('reprise dans les commentaires', () => {
  it('marque le texte comme issu de l’IA et n’ajoute pas deux fois le même fait', () => {
    const text = factCommentText({ fact: 'Relit la consigne.', criterionLabel: 'Reformule' });
    expect(text).toBe('[Aide IA] (Reformule) Relit la consigne.');
    const once = appendToComment('Bonne écoute.', text, 1500);
    expect(once).toBe(`Bonne écoute.\n${text}`);
    expect(appendToComment(once, text, 1500)).toBe(once);
    expect(appendToComment('x'.repeat(1499), text, 1500)).toBe('x'.repeat(1499));
  });
});
