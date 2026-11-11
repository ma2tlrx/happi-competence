'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { siteConfig } from '@/config/site';
import { actionError, actionSuccess, validationError, type ActionState } from '@/lib/action-state';
import { ORGANIZATION_TYPES } from '@/lib/auth/roles';
import { getCurrentUser, homePathFor } from '@/lib/auth/session';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/utils';

const email = z.string().trim().toLowerCase().email('Indiquez une adresse e-mail valide.').max(254);
const password = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(128, 'Le mot de passe est trop long.')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.');
const name = (label: string) => z.string().trim().min(1, `Indiquez votre ${label}.`).max(80, `Ce ${label} est trop long.`);

/**
 * Origine des liens envoyés par e-mail (confirmation, mot de passe oublié). L'adresse
 * officielle du site prime : les en-têtes Host / X-Forwarded-Host sont fournis par le
 * client et ne doivent pas décider de la destination d'un lien de connexion.
 */
async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : siteConfig.url;
}

// ── Connexion ────────────────────────────────────────────────────────────────
export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, 'Indiquez votre mot de passe.') }).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === 'email_not_confirmed') {
      return actionError('Votre adresse e-mail n’est pas encore confirmée. Ouvrez le lien reçu par e-mail pour activer votre compte.');
    }
    if (error.code === 'user_banned') return actionError('Ce compte est désactivé. Contactez l’équipe HAPPI.');
    if (error.status === 429) return actionError('Trop de tentatives. Patientez quelques minutes avant de réessayer.');
    return actionError('Adresse e-mail ou mot de passe incorrect.');
  }

  const user = await getCurrentUser();
  if (!user) return actionError('Votre compte n’a pas pu être chargé. Réessayez dans un instant.');
  if (user.status !== 'active') {
    await supabase.auth.signOut();
    return actionError('Ce compte est désactivé. Contactez l’équipe HAPPI.');
  }
  await supabase.rpc('log_event', { p_action: 'auth.signed_in' });

  const next = safeInternalPath(String(formData.get('suite') ?? ''), '');
  // On ne suit la page demandée que si elle appartient à l'espace du compte.
  const home = homePathFor(user);
  const sameSpace = next && home.split('/')[1] === next.split('/')[1];
  redirect(sameSpace || next === '/compte' ? next : home);
}

// ── Inscription participant ──────────────────────────────────────────────────
const consentSchema = {
  terms: z.literal('on', { message: 'Vous devez accepter les conditions d’utilisation.' }),
  privacy: z.literal('on', { message: 'Votre consentement est nécessaire pour créer votre passeport.' }),
};

function withPasswordConfirmation<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({ ...shape, password, passwordConfirm: z.string() })
    .refine(
      (value) => {
        const { password: first, passwordConfirm: second } = value as { password: string; passwordConfirm: string };
        return first === second;
      },
      { message: 'Les deux mots de passe ne correspondent pas.', path: ['passwordConfirm'] },
    );
}

const participantSchema = withPasswordConfirmation({ firstName: name('prénom'), lastName: name('nom'), email, ...consentSchema });

const organizationSchema = withPasswordConfirmation({
  firstName: name('prénom'),
  lastName: name('nom'),
  email,
  organizationName: z.string().trim().min(2, 'Indiquez le nom de la structure.').max(160),
  organizationType: z.enum(Object.keys(ORGANIZATION_TYPES) as [keyof typeof ORGANIZATION_TYPES], { message: 'Choisissez le type de structure.' }),
  organizationCity: z.string().trim().max(120).optional(),
  organizationSiret: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, ''))
    .refine((value) => value === '' || /^\d{14}$/.test(value), 'Le SIRET comporte 14 chiffres.')
    .optional(),
  ...consentSchema,
});

function formEntries(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : undefined]));
}

async function createAccount(
  values: { email: string; password: string },
  metadata: Record<string, string | boolean>,
): Promise<{ ok: true; needsConfirmation: boolean } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: { ...metadata, consent_version: siteConfig.consentVersion },
      emailRedirectTo: `${await siteOrigin()}/auth/confirmation`,
    },
  });
  if (error) {
    if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) {
      return { ok: false, message: 'Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.' };
    }
    if (error.code === 'weak_password') return { ok: false, message: 'Ce mot de passe est trop faible. Choisissez-en un plus long.' };
    if (error.status === 429) return { ok: false, message: 'Trop de demandes. Patientez quelques minutes avant de réessayer.' };
    console.error('Création de compte impossible', error.message);
    return { ok: false, message: 'Le compte n’a pas pu être créé. Réessayez dans un instant.' };
  }
  // Adresse déjà utilisée lorsque la confirmation par e-mail est activée : Supabase renvoie un utilisateur sans identité.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, message: 'Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.' };
  }
  return { ok: true, needsConfirmation: !data.session };
}

export async function signUpParticipant(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = participantSchema.safeParse(formEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const result = await createAccount(parsed.data, {
    account_type: 'participant',
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    terms_accepted: true,
    privacy_consent: true,
  });
  if (!result.ok) return actionError(result.message);
  if (result.needsConfirmation) {
    return actionSuccess('Votre compte est créé. Ouvrez le lien envoyé à votre adresse e-mail pour l’activer, puis connectez-vous.');
  }
  redirect('/participant/auto-evaluation?bienvenue=1');
}

export async function signUpOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = organizationSchema.safeParse(formEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const result = await createAccount(parsed.data, {
    account_type: 'organisme',
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    organization_name: parsed.data.organizationName,
    organization_type: parsed.data.organizationType,
    organization_city: parsed.data.organizationCity ?? '',
    organization_siret: parsed.data.organizationSiret ?? '',
    terms_accepted: true,
    privacy_consent: true,
  });
  if (!result.ok) return actionError(result.message);
  if (result.needsConfirmation) {
    return actionSuccess('Votre demande est enregistrée. Confirmez votre adresse e-mail ; l’équipe HAPPI validera ensuite votre espace.');
  }
  redirect('/organisme/dashboard');
}

// ── Accès professionnel par code ─────────────────────────────────────────────
const CODE_ERRORS: Record<string, string> = {
  invalid: 'Ce code d’accès n’est pas valide. Vérifiez sa saisie.',
  used: 'Ce code d’accès a déjà été utilisé.',
  expired: 'Ce code d’accès a expiré. Demandez-en un nouveau à l’administrateur.',
  revoked: 'Ce code d’accès a été révoqué.',
};

const codeSchema = z.string().trim().min(8, 'Indiquez le code d’accès reçu.').max(64);

/** Création d'un compte formateur, administrateur ou membre d'organisme à partir d'un code. */
export async function signUpWithAccessCode(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = withPasswordConfirmation({
    firstName: name('prénom'),
    lastName: name('nom'),
    email,
    code: codeSchema,
    ...consentSchema,
  }).safeParse(formEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!isAdminClientConfigured()) return actionError('L’activation des codes est momentanément indisponible.');

  const admin = createAdminClient();
  const { data: check } = await admin.rpc('check_invitation_code', { p_code: parsed.data.code });
  const verdict = check as { valid: boolean; reason?: string } | null;
  if (!verdict?.valid) return actionError(CODE_ERRORS[verdict?.reason ?? 'invalid'] ?? CODE_ERRORS.invalid!, { code: 'Code refusé.' });

  const result = await createAccount(parsed.data, {
    account_type: 'pro',
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    terms_accepted: true,
    privacy_consent: true,
  });
  if (!result.ok) return actionError(result.message);

  const { data: created } = await admin.from('profiles').select('id').eq('email', parsed.data.email).maybeSingle();
  if (!created) return actionError('Le compte n’a pas pu être finalisé. Contactez l’administrateur.');
  const { error } = await admin.rpc('redeem_invitation_code', { p_code: parsed.data.code, p_user_id: created.id });
  if (error) {
    const reason = error.message.match(/(INVALID|USED|EXPIRED|REVOKED)_CODE/)?.[1]?.toLowerCase();
    return actionError(reason ? CODE_ERRORS[reason]! : 'Le code n’a pas pu être appliqué. Contactez l’administrateur.');
  }
  if (result.needsConfirmation) {
    return actionSuccess('Votre accès est activé. Confirmez votre adresse e-mail grâce au lien reçu, puis connectez-vous.');
  }
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user) : '/connexion');
}

/** Activation d'un code par un compte déjà connecté (inscription interrompue). */
export async function redeemAccessCode(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = codeSchema.safeParse(formData.get('code'));
  if (!parsed.success) return actionError(parsed.error.issues[0]!.message, { code: parsed.error.issues[0]!.message });
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  if (!isAdminClientConfigured()) return actionError('L’activation des codes est momentanément indisponible.');
  const { error } = await createAdminClient().rpc('redeem_invitation_code', { p_code: parsed.data, p_user_id: user.id });
  if (error) {
    const reason = error.message.match(/(INVALID|USED|EXPIRED|REVOKED)_CODE/)?.[1]?.toLowerCase();
    if (error.message.includes('ACCOUNT_NOT_ELIGIBLE')) return actionError('Ce compte est déjà un compte participant ou organisme : un code d’accès ne peut pas lui être appliqué.');
    return actionError(reason ? CODE_ERRORS[reason]! : 'Le code n’a pas pu être appliqué.', { code: 'Code refusé.' });
  }
  const refreshed = await getCurrentUser();
  redirect(refreshed ? homePathFor(refreshed) : '/');
}

// ── Mot de passe ─────────────────────────────────────────────────────────────
export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = email.safeParse(formData.get('email'));
  if (!parsed.success) return actionError(parsed.error.issues[0]!.message, { email: parsed.error.issues[0]!.message });
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/confirmation?suite=/nouveau-mot-de-passe`,
  });
  if (error?.status === 429) return actionError('Trop de demandes. Patientez quelques minutes avant de réessayer.');
  // Réponse identique que le compte existe ou non : on ne révèle pas les adresses inscrites.
  return actionSuccess('Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.');
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, passwordConfirm: z.string() })
    .refine((value) => value.password === value.passwordConfirm, { message: 'Les deux mots de passe ne correspondent pas.', path: ['passwordConfirm'] })
    .safeParse(formEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') return actionError('Choisissez un mot de passe différent de l’actuel.');
    return actionError('Le lien a expiré ou le mot de passe n’a pas pu être modifié. Refaites une demande de réinitialisation.');
  }
  await supabase.rpc('log_event', { p_action: 'auth.password_changed' });
  return actionSuccess('Votre mot de passe a été modifié.');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
