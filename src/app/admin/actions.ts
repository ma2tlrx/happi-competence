'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { isRole, ORGANIZATION_TYPES } from '@/lib/auth/roles';
import { requireRole } from '@/lib/auth/session';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

type Simple = { ok: boolean; message?: string };
const uuid = z.string().uuid();
const done = (error: { code?: string; message?: string } | null, paths: string[] = []): Simple => {
  for (const path of paths) revalidatePath(path, 'layout');
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
};
const entries = (formData: FormData) => Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));

async function admin() {
  const user = await requireRole('admin');
  return { user, supabase: await createClient() };
}

// ── Comptes ──────────────────────────────────────────────────────────────────
export async function setUserRole(userId: string, role: string): Promise<Simple> {
  const { user, supabase } = await admin();
  if (!uuid.safeParse(userId).success || !isRole(role)) return { ok: false, message: 'Données invalides.' };
  if (userId === user.id) return { ok: false, message: 'Vous ne pouvez pas modifier votre propre rôle.' };
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  return done(error, ['/admin']);
}

/** Désactive ou réactive un compte : statut applicatif et blocage de la connexion. */
export async function setUserStatus(userId: string, status: 'active' | 'disabled'): Promise<Simple> {
  const { user, supabase } = await admin();
  if (!uuid.safeParse(userId).success) return { ok: false, message: 'Compte invalide.' };
  if (userId === user.id) return { ok: false, message: 'Vous ne pouvez pas désactiver votre propre compte.' };
  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
  if (error) return done(error);
  if (isAdminClientConfigured()) {
    // Bloque aussi les sessions existantes et toute nouvelle connexion.
    await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: status === 'disabled' ? '876000h' : 'none' });
  }
  return done(null, ['/admin']);
}

// ── Organismes ───────────────────────────────────────────────────────────────
export async function setOrganizationStatus(organizationId: string, status: 'active' | 'suspended' | 'rejected' | 'pending', reason?: string): Promise<Simple> {
  const { supabase } = await admin();
  if (!uuid.safeParse(organizationId).success) return { ok: false, message: 'Organisme invalide.' };
  const { error } = await supabase.from('organizations').update({ status, status_reason: reason?.trim() || null }).eq('id', organizationId);
  return done(error, ['/admin']);
}

const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez le nom.').max(160),
  type: z.enum(Object.keys(ORGANIZATION_TYPES) as [keyof typeof ORGANIZATION_TYPES]),
  city: z.string().trim().max(120).transform((v) => v || null),
  siret: z.string().trim().transform((v) => v.replace(/\s/g, '')).refine((v) => v === '' || /^\d{14}$/.test(v), 'Le SIRET comporte 14 chiffres.').transform((v) => v || null),
  contactEmail: z.union([z.string().trim().toLowerCase().email('Adresse invalide.'), z.literal('')]).transform((v) => v || null),
});

export async function createOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase } = await admin();
  const parsed = organizationSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { error } = await supabase.from('organizations').insert({
    name: parsed.data.name,
    type: parsed.data.type,
    city: parsed.data.city,
    siret: parsed.data.siret,
    contact_email: parsed.data.contactEmail,
    status: 'active',
    created_by: user.id,
  });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/admin/organismes');
  return actionSuccess('Organisme créé. Générez un code d’accès « organisme » pour inviter ses membres.');
}

export async function updateOrganization(organizationId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = organizationSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { error } = await supabase
    .from('organizations')
    .update({ name: parsed.data.name, type: parsed.data.type, city: parsed.data.city, siret: parsed.data.siret, contact_email: parsed.data.contactEmail })
    .eq('id', organizationId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/admin/organismes');
  return actionSuccess('Organisme mis à jour.');
}

// ── Rattachements, formateurs, permissions ───────────────────────────────────
export async function setParticipantOrganization(participantId: string, organizationId: string | null): Promise<Simple> {
  const { supabase } = await admin();
  const { error } = await supabase.from('participants').update({ organization_id: organizationId }).eq('id', participantId);
  return done(error, ['/admin/participants']);
}

export async function assignTrainer(groupId: string, trainerId: string): Promise<Simple> {
  const { user, supabase } = await admin();
  if (!uuid.safeParse(groupId).success || !uuid.safeParse(trainerId).success) return { ok: false, message: 'Données invalides.' };
  const { error } = await supabase.from('group_trainers').insert({ group_id: groupId, trainer_id: trainerId, assigned_by: user.id });
  return done(error, ['/admin/groupes']);
}

export async function unassignTrainer(groupId: string, trainerId: string): Promise<Simple> {
  const { supabase } = await admin();
  const { error } = await supabase.from('group_trainers').delete().eq('group_id', groupId).eq('trainer_id', trainerId);
  return done(error, ['/admin/groupes']);
}

export async function togglePermission(role: string, permission: string, enabled: boolean): Promise<Simple> {
  const { supabase } = await admin();
  const { error } = enabled
    ? await supabase.from('role_permissions').insert({ role_code: role, permission_code: permission })
    : await supabase.from('role_permissions').delete().eq('role_code', role).eq('permission_code', permission);
  return done(error, ['/admin/utilisateurs']);
}

// ── Codes d'accès ────────────────────────────────────────────────────────────
export async function createAccessCode(_: ActionState<{ code: string }>, formData: FormData): Promise<ActionState<{ code: string }>> {
  const { supabase } = await admin();
  const parsed = z
    .object({
      role: z.enum(['formateur', 'admin', 'organisme']),
      label: z.string().trim().max(160),
      expiresAt: z.string().trim().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Date invalide.'),
      organizationId: z.string().trim(),
    })
    .safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { data, error } = await supabase.rpc('create_invitation_code', {
    p_role: parsed.data.role,
    p_label: parsed.data.label || undefined,
    p_expires_at: parsed.data.expiresAt ? new Date(`${parsed.data.expiresAt}T23:59:59`).toISOString() : undefined,
    p_organization_id: parsed.data.role === 'organisme' && parsed.data.organizationId ? parsed.data.organizationId : undefined,
  });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/admin/codes-acces');
  const row = (data as { id: string; code: string }[])[0]!;
  return actionSuccess('Code généré. Copiez-le maintenant : il ne sera plus jamais affiché.', { code: row.code });
}

export async function revokeAccessCode(id: string): Promise<Simple> {
  const { supabase } = await admin();
  const { error } = await supabase.rpc('revoke_invitation_code', { p_id: id });
  return done(error, ['/admin/codes-acces']);
}

// ── Programmes ───────────────────────────────────────────────────────────────
const programSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).transform((v) => v || null),
    sessionsCount: z.coerce.number().int().min(1).max(24),
    sessionDuration: z.coerce.number().int().min(15).max(600),
    minGroupSize: z.coerce.number().int().min(1).max(50),
    maxGroupSize: z.coerce.number().int().min(1).max(50),
  })
  .refine((v) => v.maxGroupSize >= v.minGroupSize, { message: 'La taille maximale doit être supérieure ou égale à la minimale.', path: ['maxGroupSize'] });

export async function saveProgram(programId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase } = await admin();
  const parsed = programSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const values = {
    name: parsed.data.name,
    description: parsed.data.description,
    sessions_count: parsed.data.sessionsCount,
    session_duration_minutes: parsed.data.sessionDuration,
    min_group_size: parsed.data.minGroupSize,
    max_group_size: parsed.data.maxGroupSize,
  };
  if (programId) {
    const { error } = await supabase.from('programs').update(values).eq('id', programId);
    if (error) return actionError(databaseErrorMessage(error));
  } else {
    const { data, error } = await supabase.from('programs').insert({ ...values, status: 'active', created_by: user.id }).select('id').single();
    if (error) return actionError(databaseErrorMessage(error));
    // Trame vide d'une session par numéro, à compléter.
    await supabase.from('program_sessions').insert(
      Array.from({ length: parsed.data.sessionsCount }, (_, index) => ({ program_id: data.id, number: index + 1, title: `Session ${index + 1}`, is_provisional: true })),
    );
  }
  revalidatePath('/admin/programmes');
  return actionSuccess('Programme enregistré.');
}

const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 30);

export async function saveProgramSession(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const data = entries(formData);
  const title = (data.title ?? '').trim();
  if (title.length < 2) return actionError('Indiquez un titre.', { title: 'Indiquez un titre.' });
  const { error } = await supabase
    .from('program_sessions')
    .update({
      title: title.slice(0, 160),
      summary: (data.summary ?? '').trim().slice(0, 1000) || null,
      objectives: lines(data.objectives ?? ''),
      activities: lines(data.activities ?? ''),
      key_notions: lines(data.keyNotions ?? ''),
      takeaways: lines(data.takeaways ?? ''),
      is_provisional: data.isProvisional === 'on',
    })
    .eq('id', id);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/admin/programmes');
  return actionSuccess('Session de la trame enregistrée.');
}

export async function setProgramPublic(programId: string): Promise<Simple> {
  const { supabase } = await admin();
  await supabase.from('programs').update({ is_public: false }).eq('is_public', true);
  const { error } = await supabase.from('programs').update({ is_public: true }).eq('id', programId);
  return done(error, ['/admin/programmes', '/']);
}

export async function activateFrameworkVersion(programId: string, frameworkId: string, versionId: string): Promise<Simple> {
  const { supabase } = await admin();
  const { error } = await supabase.from('program_frameworks').upsert({ program_id: programId, framework_id: frameworkId, framework_version_id: versionId });
  return done(error, ['/admin/programmes', '/admin/referentiels']);
}

// ── Messages et demandes RGPD ────────────────────────────────────────────────
export async function setContactMessageStatus(id: string, status: 'new' | 'read' | 'archived'): Promise<Simple> {
  const { user, supabase } = await admin();
  const { error } = await supabase.from('contact_messages').update({ status, handled_by: user.id, handled_at: new Date().toISOString() }).eq('id', id);
  return done(error, ['/admin/parametres']);
}

export async function resolveDataRequest(id: string, decision: 'completed' | 'rejected', note: string): Promise<Simple> {
  const { user, supabase } = await admin();
  const { data: request } = await supabase.from('data_requests').select('id, type, user_id, status').eq('id', id).single();
  if (!request || request.status !== 'pending') return { ok: false, message: 'Demande introuvable ou déjà traitée.' };
  if (request.type === 'deletion' && decision === 'completed') {
    if (!isAdminClientConfigured()) return { ok: false, message: 'La clé de service est nécessaire pour supprimer le compte.' };
    const { data: userId, error } = await supabase.rpc('process_deletion_request', { p_request_id: id, p_note: note });
    if (error) return done(error);
    // Le compte d'authentification est supprimé en dernier (le profil suit par cascade).
    const removal = await createAdminClient().auth.admin.deleteUser(userId as string);
    if (removal.error) return { ok: false, message: `Données supprimées, mais le compte n’a pas pu être supprimé : ${removal.error.message}` };
    return done(null, ['/admin/parametres']);
  }
  const { error } = await supabase
    .from('data_requests')
    .update({ status: decision, resolution_note: note.trim() || null, processed_by: user.id, processed_at: new Date().toISOString() })
    .eq('id', id);
  return done(error, ['/admin/parametres']);
}

export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const data = entries(formData);
  const keys = ['contact.email', 'legal.company_name', 'legal.legal_form', 'legal.siret', 'legal.address', 'legal.publication_director', 'legal.host', 'legal.dpo_contact'];
  const rows: { key: string; value: NonNullable<Json>; is_public: boolean }[] = keys.map((key) => ({ key, value: (data[key] ?? '').trim().slice(0, 300), is_public: true }));
  rows.push({ key: 'contact.phones', value: (data['contact.phones'] ?? '').split(',').map((v) => v.trim()).filter(Boolean), is_public: true });
  rows.push({ key: 'platform.organization_signup_enabled', value: data['platform.organization_signup_enabled'] === 'on', is_public: true });
  const retention = Number(data['platform.data_retention_months']);
  rows.push({ key: 'platform.data_retention_months', value: Number.isFinite(retention) && retention > 0 ? Math.min(120, Math.round(retention)) : 36, is_public: false });
  const { error } = await supabase.from('app_settings').upsert(rows);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/', 'layout');
  return actionSuccess('Paramètres enregistrés.');
}
