import 'server-only';

import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type Anthropic from '@anthropic-ai/sdk';

import { aiProvider, apiErrorMessage, createAiClient, fallbackOptions, type AiInjection } from '@/lib/report/ai';

import { buildObservationDossier, OBSERVATION_SYSTEM_PROMPT } from './prompt';
import { structuredNotesSchema, validateStructured, type CatalogSkill, type ValidFact } from './structure';

export type StructureResult =
  | { ok: true; facts: ValidFact[]; unattached: string[]; discarded: number; model: string }
  | { ok: false; message: string };

export const AI_NOT_CONFIGURED_MESSAGE =
  'L’aide à la structuration n’est pas configurée sur ce serveur (clé OPENROUTER_API_KEY ou ANTHROPIC_API_KEY absente). La dictée et la saisie restent disponibles : reprenez vos notes à la main dans les commentaires.';

/**
 * Structure des notes de séance. Les notes sont masquées (données personnelles) avant
 * envoi ; la sortie est validée (schéma, puis codes, extraits, absence de note et de
 * diagnostic). En cas d'écart, une seconde demande liste les corrections ; les faits
 * encore invalides sont écartés (et comptés), jamais affichés.
 */
export async function structureNotes(
  notes: string,
  catalog: CatalogSkill[],
  context: { names: string[]; levelLabels: string[] },
  injected?: AiInjection,
): Promise<StructureResult> {
  const provider = injected ? { name: injected.provider, model: injected.model } : aiProvider();
  if (!provider) return { ok: false, message: AI_NOT_CONFIGURED_MESSAGE };
  if (!notes.trim()) return { ok: false, message: 'Saisissez ou dictez d’abord vos notes.' };
  if (catalog.length === 0) return { ok: false, message: 'Aucune compétence n’est rattachée à cette séance.' };

  const dossier = buildObservationDossier(notes, catalog, context.names);
  const api = injected?.client ?? createAiClient(provider);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: `Dossier de la séance (JSON) :\n\n${JSON.stringify(dossier, null, 1)}` }];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await api.beta.messages.parse({
        model: provider.model,
        max_tokens: 8000,
        ...fallbackOptions(provider.name),
        system: [{ type: 'text', text: OBSERVATION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: betaZodOutputFormat(structuredNotesSchema) },
        messages,
      });
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error) };
    }
    if (response.stop_reason === 'refusal') return { ok: false, message: 'Le service a refusé la demande. Reprenez vos notes à la main.' };
    if (response.stop_reason === 'max_tokens') return { ok: false, message: 'Les notes sont trop longues pour être structurées en une fois. Raccourcissez-les.' };
    const output = response.parsed_output;
    if (!output) return { ok: false, message: 'La réponse reçue n’a pas le format attendu. Réessayez.' };
    const checked = validateStructured(output, catalog, dossier.notes, context.levelLabels);
    if (checked.issues.length === 0 || attempt === 1) {
      return { ok: true, facts: checked.facts, unattached: checked.unattached, discarded: new Set(checked.issues.map((issue) => issue.path)).size, model: response.model };
    }
    messages.push({ role: 'assistant', content: response.content.filter((block) => block.type === 'text') });
    messages.push({
      role: 'user',
      content: `Certains éléments ne respectent pas les règles. Corrige-les (ou retire-les) et renvoie la liste complète :\n${checked.issues.map((issue) => `- ${issue.path} : ${issue.message}`).join('\n')}`,
    });
  }
  return { ok: false, message: 'La structuration n’a pas abouti. Réessayez.' };
}
