import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { structureNotes } from './ai';
import type { CatalogSkill } from './structure';

const catalog: CatalogSkill[] = [{ code: 'organisation', id: 'id-orga', name: 'Organisation', description: 'S’organiser.', framework: 'Compétences transversales', criteria: [] }];
const notes = 'Camille a proposé de répartir les rôles. Joignable au 06 12 34 56 78. Est arrivée en retard.';

function fakeClient(responses: Array<Record<string, unknown>>) {
  const calls: unknown[] = [];
  const parse = vi.fn(async (body: unknown) => {
    calls.push(JSON.parse(JSON.stringify(body)));
    return { model: 'test-model', content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', ...responses.shift() };
  });
  return { client: { beta: { messages: { parse } } } as never, calls, parse };
}

describe('structuration des notes par l’IA', () => {
  it('masque le nom et le téléphone avant envoi, et ne garde que les faits vérifiés', async () => {
    const fake = fakeClient([
      {
        parsed_output: {
          facts: [{ skillCode: 'organisation', criterionRef: null, fact: 'Propose une répartition des rôles.', excerpt: '[nom masqué] a proposé de répartir les rôles' }],
          unattached: [{ excerpt: 'Est arrivée en retard.' }],
        },
      },
    ]);
    const result = await structureNotes(notes, catalog, { names: ['Camille', 'Exemple'], levelLabels: [] }, { client: fake.client, provider: 'openrouter', model: 'm' });
    const sent = JSON.stringify((fake.calls[0] as { messages: unknown }).messages);
    expect(sent).not.toContain('Camille');
    expect(sent).not.toContain('06 12 34 56 78');
    expect(result).toMatchObject({ ok: true, discarded: 0, unattached: ['Est arrivée en retard.'] });
    expect(result.ok && result.facts[0]!.skillId).toBe('id-orga');
  });

  it('redemande une correction, puis écarte ce qui reste invalide', async () => {
    const bad = { facts: [{ skillCode: 'inconnue', criterionRef: null, fact: 'Fait.', excerpt: 'a proposé' }], unattached: [] };
    const fake = fakeClient([{ parsed_output: bad }, { parsed_output: bad }]);
    const result = await structureNotes(notes, catalog, { names: [], levelLabels: [] }, { client: fake.client, provider: 'anthropic', model: 'm' });
    expect(fake.parse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fake.calls[1])).toContain('Compétence inconnue');
    expect(result).toMatchObject({ ok: true, facts: [], discarded: 1 });
  });

  it('sans clé, renvoie un message clair sans rien envoyer', async () => {
    const previous = { openrouter: process.env.OPENROUTER_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY };
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const result = await structureNotes(notes, catalog, { names: [], levelLabels: [] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/dictée et la saisie restent disponibles/);
    if (previous.openrouter) process.env.OPENROUTER_API_KEY = previous.openrouter;
    if (previous.anthropic) process.env.ANTHROPIC_API_KEY = previous.anthropic;
  });
});
