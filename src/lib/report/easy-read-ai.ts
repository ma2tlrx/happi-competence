import 'server-only';

import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type Anthropic from '@anthropic-ai/sdk';

import { aiProvider, apiErrorMessage, createAiClient, fallbackOptions, type AiInjection } from './ai';
import type { ContentIssue, ReportContent } from './content';
import { buildEasyReadDossier, checkEasyRead, EASY_READ_SYSTEM_PROMPT, easyReadSchema, type EasyReadContent } from './easy-read';
import type { ReportData } from './model';

export type EasyReadResult = { ok: true; content: EasyReadContent; model: string } | { ok: false; message: string; issues?: ContentIssue[] };

/**
 * Propose une version facile à lire d'un bilan validé. Sortie structurée (schéma),
 * puis contrôles `checkEasyRead` ; une seconde demande liste les corrections ; si
 * l'écart persiste, rien n'est proposé. Le formateur relit et valide toujours.
 */
export async function generateEasyRead(data: ReportData, content: ReportContent, injected?: AiInjection): Promise<EasyReadResult> {
  const provider = injected ? { name: injected.provider, model: injected.model } : aiProvider();
  if (!provider) {
    return { ok: false, message: 'La rédaction automatique n’est pas configurée sur ce serveur (clé OPENROUTER_API_KEY ou ANTHROPIC_API_KEY absente). Vous pouvez rédiger la version facile à lire à la main.' };
  }
  const api = injected?.client ?? createAiClient(provider);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Bilan validé (JSON) :\n\n${JSON.stringify(buildEasyReadDossier(data, content), null, 1)}` },
  ];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await api.beta.messages.parse({
        model: provider.model,
        max_tokens: 6000,
        ...fallbackOptions(provider.name),
        system: [{ type: 'text', text: EASY_READ_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(easyReadSchema) },
        messages,
      });
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error) };
    }
    if (response.stop_reason === 'refusal') return { ok: false, message: 'Le service de rédaction a refusé la demande. Rédigez la version à la main.' };
    if (response.stop_reason === 'max_tokens') return { ok: false, message: 'Le texte produit était trop long et a été interrompu. Réessayez.' };
    const output = response.parsed_output;
    if (!output) return { ok: false, message: 'La réponse reçue n’a pas le format attendu. Réessayez.' };
    const issues = checkEasyRead(output, data);
    if (issues.length === 0) return { ok: true, content: output, model: response.model };
    if (attempt === 1) {
      return { ok: false, message: 'Le texte produit ne respecte pas les règles de la version facile à lire, même après correction. Réessayez ou rédigez-la à la main.', issues };
    }
    messages.push({ role: 'assistant', content: response.content.filter((block) => block.type === 'text') });
    messages.push({ role: 'user', content: `Ce texte ne respecte pas les règles. Corrige uniquement ces points et renvoie le texte complet :\n${issues.map((issue) => `- ${issue.path} : ${issue.message}`).join('\n')}` });
  }
  return { ok: false, message: 'La rédaction n’a pas abouti. Réessayez.' };
}
