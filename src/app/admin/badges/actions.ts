'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { loadMemberships, loadSkillOptions } from '@/lib/badges/eligibility';
import { evaluateRule, parseRule, ruleFromForm } from '@/lib/badges/rules';
import { badgeSigning, signAndIssueBadge } from '@/lib/badges/server';
import type { Json } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

/**
 * Administration des Open Badges. Rôle administrateur vérifié ici ; la base le revérifie
 * (RLS sur badge_classes, issue_badge_assertion, revoke_badge_assertion). Aucune émission
 * automatique : chaque badge est émis par un clic de l'administrateur.
 */

type Simple = { ok: boolean; message?: string };
const PATH = '/admin/badges';
const uuid = z.string().uuid();

async function admin() {
  const user = await requireRole('admin');
  return { user, supabase: await createClient() };
}

const classSchema = z.object({
  id: z.union([z.literal(''), z.string().uuid()]),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  criteria: z.string().trim().min(10).max(4000),
  imageUrl: z.union([z.literal(''), z.string().trim().max(500).regex(/^(https:\/\/\S+|\/[A-Za-z0-9/_.-]+)$/, 'Adresse https:// ou chemin du site commençant par /.')]),
  validated: z.boolean(),
  active: z.boolean(),
});

export async function saveBadgeClass(_: ActionState<{ id: string }>, formData: FormData): Promise<ActionState<{ id: string }>> {
  const { user, supabase } = await admin();
  const form = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === 'string')) as Record<string, string>;
  const parsed = classSchema.safeParse({
    id: form.id ?? '',
    name: form.name ?? '',
    description: form.description ?? '',
    criteria: form.criteria ?? '',
    imageUrl: form.imageUrl?.trim() ?? '',
    validated: form.validated === 'on',
    active: form.active === 'on',
  });
  if (!parsed.success) return validationError(parsed.error);
  const rule = ruleFromForm(form);
  if (!rule.ok) return actionError(rule.message);
  if (parsed.data.active && !parsed.data.validated) {
    return actionError('Un modèle dont le critère est encore provisoire ne peut pas être activé : confirmez d’abord le critère.');
  }

  // Compétences rattachées : uniquement des compétences existantes (libellé relu en base).
  const options = new Map((await loadSkillOptions(supabase)).map((option) => [option.key, option]));
  const related = formData
    .getAll('relatedSkill')
    .filter((value): value is string => typeof value === 'string' && options.has(value))
    .slice(0, 20)
    .map((key) => ({ framework: options.get(key)!.frameworkCode, code: options.get(key)!.skillCode, name: options.get(key)!.name }));
  for (const condition of rule.rule.conditions) {
    if (condition.type === 'skill_level' && !options.has(`${condition.frameworkCode}:${condition.skillCode}`)) return actionError('Compétence inconnue dans la règle.');
  }

  const values = {
    name: parsed.data.name,
    description: parsed.data.description,
    criteria_narrative: parsed.data.criteria,
    image_url: parsed.data.imageUrl || null,
    related_skills: related as unknown as Json,
    award_rule: rule.rule as unknown as Json,
    is_provisional: !parsed.data.validated,
    is_active: parsed.data.active,
  };
  const { data, error } = parsed.data.id
    ? await supabase.from('badge_classes').update(values).eq('id', parsed.data.id).select('id').maybeSingle()
    : await supabase.from('badge_classes').insert({ ...values, created_by: user.id }).select('id').maybeSingle();
  if (error || !data) return actionError(databaseErrorMessage(error, 'Le modèle n’a pas pu être enregistré.'));
  revalidatePath(PATH, 'layout');
  return actionSuccess(parsed.data.id ? 'Modèle enregistré.' : 'Modèle créé.', { id: data.id });
}

/** Émet un badge (manuellement, ou depuis la liste des éligibles). La règle et les faits du moment sont joints à l'émission. */
export async function issueBadge(badgeClassId: string, participantId: string, groupId: string | null): Promise<Simple> {
  const { supabase } = await admin();
  if (!uuid.safeParse(badgeClassId).success || !uuid.safeParse(participantId).success || (groupId !== null && !uuid.safeParse(groupId).success)) {
    return { ok: false, message: 'Données invalides.' };
  }
  const signing = badgeSigning();
  if (!signing.ok) return { ok: false, message: `${signing.message} L’émission est désactivée.` };

  const [{ data: badgeClass }, { data: participant }] = await Promise.all([
    supabase
      .from('badge_classes')
      .select('id, name, description, criteria_narrative, image_url, related_skills, award_rule, is_active, is_provisional')
      .eq('id', badgeClassId)
      .maybeSingle(),
    supabase.from('participants').select('id, first_name, last_name').eq('id', participantId).maybeSingle(),
  ]);
  if (!badgeClass) return { ok: false, message: 'Modèle introuvable.' };
  if (!participant) return { ok: false, message: 'Participant introuvable.' };
  if (!badgeClass.is_active || badgeClass.is_provisional) return { ok: false, message: 'Ce modèle n’est pas actif.' };

  const rule = parseRule(badgeClass.award_rule);
  const membership = groupId ? (await loadMemberships(supabase, { participantId })).find((item) => item.groupId === groupId) : null;
  if (groupId && !membership) return { ok: false, message: 'Ce participant n’est pas membre actif de ce groupe.' };
  const evaluation = membership ? evaluateRule(rule, membership.facts) : null;
  const snapshot = {
    rule,
    mode: evaluation?.eligible ? 'eligible' : 'manual',
    facts: membership?.facts ?? null,
    results: evaluation?.results.map((result) => ({ met: result.met, detail: result.detail })) ?? [],
  } as unknown as Json;

  const result = await signAndIssueBadge(supabase, {
    badgeClass,
    participant: { id: participant.id, firstName: participant.first_name, lastName: participant.last_name },
    groupId,
    snapshot,
  });
  if (!result.ok) return { ok: false, message: result.message ?? databaseErrorMessage(result.error, 'Le badge n’a pas pu être émis.') };
  revalidatePath(PATH, 'layout');
  return { ok: true };
}

export async function revokeBadge(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!uuid.safeParse(id).success) return actionError('Badge introuvable.');
  if (reason.length < 3 || reason.length > 500) return actionError('Indiquez le motif de la révocation (3 à 500 caractères).', { reason: 'Motif obligatoire.' });
  const { error } = await supabase.rpc('revoke_badge_assertion', { p_assertion_id: id, p_reason: reason });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(PATH, 'layout');
  return actionSuccess('Badge révoqué. La page de vérification l’indique désormais.');
}
