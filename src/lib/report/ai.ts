import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

import { checkContent, reportContentSchema, type ContentIssue, type ReportContent, type ReportOptions } from './content';
import type { ReportData } from './model';
import { buildDossier, SYSTEM_PROMPT } from './prompt';

/**
 * Fournisseur de rédaction, choisi par les variables d'environnement du serveur :
 * - OPENROUTER_API_KEY : passage par OpenRouter (point d'accès compatible avec l'API Claude) ;
 * - sinon ANTHROPIC_API_KEY : API Claude directe.
 * REPORT_AI_MODEL remplace le modèle par défaut. Les clés ne quittent jamais le serveur.
 */
export function aiProvider() {
  if (process.env.OPENROUTER_API_KEY) {
    return { name: 'openrouter' as const, model: process.env.REPORT_AI_MODEL || 'anthropic/claude-opus-5.5' };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { name: 'anthropic' as const, model: process.env.REPORT_AI_MODEL || 'claude-opus-5-5' };
  }
  return null;
}

export function isAiConfigured() {
  return aiProvider() !== null;
}

function createClient(provider: NonNullable<ReturnType<typeof aiProvider>>) {
  const common = { maxRetries: 2, timeout: 170_000 };
  if (provider.name === 'openrouter') {
    return new Anthropic({ ...common, baseURL: 'https://openrouter.ai/api', apiKey: null, authToken: process.env.OPENROUTER_API_KEY });
  }
  return new Anthropic(common);
}

export type GenerationResult =
  | { ok: true; content: ReportContent; model: string }
  | { ok: false; message: string; issues?: ContentIssue[] };

type Client = Pick<Anthropic, 'beta'>;

/**
 * Rédige le texte d'un bilan à partir de sa photographie. Les résultats ne sont
 * jamais modifiés ici. Le texte est validé (schéma, puis cohérence avec les
 * résultats) ; en cas d'écart, une seconde demande signale les problèmes à corriger.
 */
export async function generateReportContent(
  data: ReportData,
  options: ReportOptions,
  injected?: { client: Client; provider: 'openrouter' | 'anthropic'; model: string },
): Promise<GenerationResult> {
  const provider = injected ? { name: injected.provider, model: injected.model } : aiProvider();
  if (!provider) {
    return { ok: false, message: 'La rédaction automatique n’est pas configurée sur ce serveur (clé OPENROUTER_API_KEY ou ANTHROPIC_API_KEY absente). Vous pouvez rédiger le bilan manuellement.' };
  }
  if (data.counts.observations === 0) {
    return { ok: false, message: 'Aucune observation validée : il n’y a rien à interpréter. Validez au moins une évaluation de session.' };
  }
  const api = injected?.client ?? createClient(provider);
  // Repli automatique en cas de refus : propre à l'API Claude directe (OpenRouter gère son propre routage).
  const fallback: { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: 'default' } =
    provider.name === 'anthropic' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Dossier du participant (JSON) :\n\n${JSON.stringify(buildDossier(data, options), null, 1)}` },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await api.beta.messages.parse({
        model: provider.model,
        max_tokens: 16000,
        ...fallback,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(reportContentSchema) },
        messages,
      });
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error) };
    }
    if (response.stop_reason === 'refusal') {
      return { ok: false, message: 'Le service de rédaction a refusé la demande. Réessayez ou rédigez le bilan manuellement.' };
    }
    if (response.stop_reason === 'max_tokens') {
      return { ok: false, message: 'Le texte produit était trop long et a été interrompu. Réessayez.' };
    }
    const content = response.parsed_output;
    if (!content) return { ok: false, message: 'La réponse reçue n’a pas le format attendu. Réessayez.' };
    const issues = checkContent(content, data);
    if (issues.length === 0) return { ok: true, content, model: response.model };
    if (attempt === 1) {
      return { ok: false, message: 'Le texte produit ne respecte pas les règles du bilan, même après correction. Réessayez ou rédigez-le manuellement.', issues };
    }
    messages.push({ role: 'assistant', content: response.content.filter((block) => block.type === 'text') });
    messages.push({
      role: 'user',
      content: `Ce texte ne respecte pas les règles. Corrige uniquement ces points et renvoie le bilan complet :\n${issues.map((issue) => `- ${issue.path} : ${issue.message}`).join('\n')}`,
    });
  }
  return { ok: false, message: 'La rédaction n’a pas abouti. Réessayez.' };
}

function apiErrorMessage(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return 'La clé du service de rédaction est refusée. Vérifiez la variable ANTHROPIC_API_KEY du serveur.';
  }
  if (error instanceof Anthropic.APIError && error.status === 402) {
    return 'Le crédit du service de rédaction est épuisé. Rechargez le compte (OpenRouter) puis réessayez.';
  }
  if (error instanceof Anthropic.RateLimitError) return 'Le service de rédaction est saturé. Réessayez dans une minute.';
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'Le service de rédaction a mis trop de temps à répondre. Réessayez.';
  if (error instanceof Anthropic.APIConnectionError) return 'Le service de rédaction est injoignable. Réessayez dans un instant.';
  if (error instanceof Anthropic.APIError) return `Le service de rédaction a renvoyé une erreur (${error.status ?? 'inconnue'}). Réessayez.`;
  return 'La rédaction a échoué de façon inattendue. Réessayez.';
}
