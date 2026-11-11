import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { generateReportContent } from './ai';
import { buildReportData } from './build';
import { emptyContent, reportOptionsSchema } from './content';
import { fixturePassport } from './fixtures';

const data = buildReportData(fixturePassport({ attended: [1], evaluated: [1], ct: { relationnel: [[1, 4, 'Écoute les autres.']] } }), new Map());
const options = reportOptionsSchema.parse({});
const valid = { ...emptyContent(data), introduction: 'Bienvenue.', conclusion: 'Bravo pour votre engagement.' };

function fakeClient(responses: Array<Record<string, unknown> | Error>) {
  const calls: unknown[] = [];
  const parse = vi.fn(async (body: unknown) => {
    calls.push(JSON.parse(JSON.stringify(body)));
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { model: 'test-model', content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', ...next };
  });
  return { client: { beta: { messages: { parse } } } as never, calls, parse };
}

describe('rédaction automatique', () => {
  it('renvoie le texte validé et n’envoie aucune donnée d’identité', async () => {
    const fake = fakeClient([{ parsed_output: valid }]);
    const result = await generateReportContent(data, options, { client: fake.client, provider: 'openrouter', model: 'anthropic/claude-opus-5.5' });
    expect(result).toEqual({ ok: true, content: valid, model: 'test-model' });
    // Le dossier (messages) ne contient ni le nom, ni la structure ; la consigne générale peut citer des types de structures.
    const body = JSON.stringify((fake.calls[0] as { messages: unknown }).messages);
    expect(body).not.toContain('Camille');
    expect(body).not.toContain('Exemple');
    expect(body).not.toContain('Mission Locale d’exemple');
    expect(body).toContain('Écoute les autres.');
    expect(JSON.stringify(fake.calls[0])).not.toContain('fallbacks');
  });

  it('active le repli automatique sur l’API Claude directe', async () => {
    const fake = fakeClient([{ parsed_output: valid }]);
    await generateReportContent(data, options, { client: fake.client, provider: 'anthropic', model: 'claude-opus-5-5' });
    expect(fake.calls[0]).toMatchObject({ fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] });
  });

  it('redemande une correction quand le texte cite une note, puis accepte la version corrigée', async () => {
    const fake = fakeClient([{ parsed_output: { ...valid, conclusion: 'Votre relationnel atteint 4/5.' } }, { parsed_output: valid }]);
    const result = await generateReportContent(data, options, { client: fake.client, provider: 'openrouter', model: 'm' });
    expect(result.ok).toBe(true);
    expect(fake.parse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fake.calls[1])).toContain('conclusion');
  });

  it('échoue proprement si le texte reste incohérent', async () => {
    const bad = { ...valid, skills: [{ code: 'rigueur', observed: 'a', strengths: 'b', progress: 'c', professional: 'd' }] };
    const fake = fakeClient([{ parsed_output: bad }, { parsed_output: bad }]);
    const result = await generateReportContent(data, options, { client: fake.client, provider: 'openrouter', model: 'm' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues?.[0]?.path).toBe('skills.0.code');
  });

  it('gère le refus, la réponse illisible et le crédit épuisé', async () => {
    const refusal = await generateReportContent(data, options, { ...fakeClient([{ stop_reason: 'refusal', parsed_output: null }]), provider: 'anthropic', model: 'm' });
    expect(refusal).toMatchObject({ ok: false, message: expect.stringContaining('refusé') });
    const unreadable = await generateReportContent(data, options, { ...fakeClient([{ parsed_output: null }]), provider: 'anthropic', model: 'm' });
    expect(unreadable).toMatchObject({ ok: false, message: expect.stringContaining('format attendu') });
    const credit = new Anthropic.APIError(402, { error: { message: 'credits' } }, 'credits', new Headers());
    const noCredit = await generateReportContent(data, options, { ...fakeClient([credit]), provider: 'openrouter', model: 'm' });
    expect(noCredit).toMatchObject({ ok: false, message: expect.stringContaining('crédit') });
  });

  it('n’appelle pas le service quand il n’y a aucune observation', async () => {
    const empty = buildReportData(fixturePassport({ withGroup: false }), new Map());
    const fake = fakeClient([]);
    const result = await generateReportContent(empty, options, { client: fake.client, provider: 'openrouter', model: 'm' });
    expect(result.ok).toBe(false);
    expect(fake.parse).not.toHaveBeenCalled();
  });
});
