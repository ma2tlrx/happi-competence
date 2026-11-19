'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Correspondances HAPPI ↔ référentiels publics. Chaque action vérifie le rôle
 * administrateur côté serveur ; la base le revérifie (RLS) et horodate elle-même la
 * validation (déclencheur private.skill_mappings_guard), qui reste nominative.
 */

type Simple = { ok: boolean; message?: string };
const PATH = '/admin/referentiels/correspondances';
const id = z.uuid('Identifiant invalide.');

async function ctx() {
  await requireRole('admin');
  return createClient();
}

const proposeSchema = z.object({
  frameworkId: z.uuid('Référentiel HAPPI invalide.'),
  skillCode: z.string().regex(/^[a-z0-9_]{1,80}$/, 'Compétence invalide.'),
  externalSkillId: z.uuid('Choisissez un élément du référentiel public.'),
  linkType: z.enum(['equivalent', 'close', 'partial'], 'Choisissez le type de lien.'),
  justification: z
    .string()
    .trim()
    .max(1000, '1 000 caractères au plus.')
    .transform((value) => value || null),
});

export async function proposeMapping(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await ctx();
  const parsed = proposeSchema.safeParse({
    frameworkId: formData.get('frameworkId'),
    skillCode: formData.get('skillCode'),
    externalSkillId: formData.get('externalSkillId') ?? '',
    linkType: formData.get('linkType'),
    justification: formData.get('justification') ?? '',
  });
  if (!parsed.success) return validationError(parsed.error);
  const { error } = await supabase.from('skill_mappings').insert({
    framework_id: parsed.data.frameworkId,
    skill_code: parsed.data.skillCode,
    external_skill_id: parsed.data.externalSkillId,
    link_type: parsed.data.linkType,
    justification: parsed.data.justification,
    origin: 'manual',
  });
  if (error) return actionError(error.code === '23505' ? 'Cette correspondance existe déjà pour cette compétence.' : databaseErrorMessage(error));
  revalidatePath(PATH);
  return actionSuccess('Correspondance proposée. Elle restera invisible hors administration tant qu’elle n’est pas validée.');
}

async function setStatus(mappingId: string, status: 'proposed' | 'validated'): Promise<Simple> {
  const supabase = await ctx();
  if (!id.safeParse(mappingId).success) return { ok: false, message: 'Correspondance introuvable.' };
  const { data, error } = await supabase.from('skill_mappings').update({ status }).eq('id', mappingId).select('id');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  if (!data?.length) return { ok: false, message: 'Correspondance introuvable.' };
  revalidatePath(PATH);
  return { ok: true };
}

export async function validateMapping(mappingId: string) {
  return setStatus(mappingId, 'validated');
}

export async function unvalidateMapping(mappingId: string) {
  return setStatus(mappingId, 'proposed');
}

export async function setMappingLinkType(mappingId: string, linkType: string): Promise<Simple> {
  const supabase = await ctx();
  const parsed = z.object({ mappingId: id, linkType: z.enum(['equivalent', 'close', 'partial']) }).safeParse({ mappingId, linkType });
  if (!parsed.success) return { ok: false, message: 'Type de lien invalide.' };
  // Une correspondance validée n'est pas modifiable (la base le refuse aussi) : la repasser d'abord en « proposée ».
  const { data, error } = await supabase.from('skill_mappings').update({ link_type: parsed.data.linkType }).eq('id', mappingId).eq('status', 'proposed').select('id');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  if (!data?.length) return { ok: false, message: 'Seule une correspondance proposée peut changer de type de lien.' };
  revalidatePath(PATH);
  return { ok: true };
}

export async function removeMapping(mappingId: string): Promise<Simple> {
  const supabase = await ctx();
  if (!id.safeParse(mappingId).success) return { ok: false, message: 'Correspondance introuvable.' };
  const { data, error } = await supabase.from('skill_mappings').delete().eq('id', mappingId).select('id');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  if (!data?.length) return { ok: false, message: 'Correspondance introuvable.' };
  revalidatePath(PATH);
  return { ok: true };
}
