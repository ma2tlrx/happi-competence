'use server';

import { z } from 'zod';

import { actionError, actionSuccess, validationError, type ActionState } from '@/lib/action-state';
import { hashIp } from '@/lib/security/origin';
import { rateLimit, requestIp } from '@/lib/security/rate-limit';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';

const schema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom.').max(120, 'Ce nom est trop long.'),
  email: z.string().trim().toLowerCase().email('Indiquez une adresse e-mail valide.').max(254),
  organization: z.string().trim().max(160, 'Ce nom de structure est trop long.').optional(),
  audience: z.enum(['participant', 'organisme', 'entreprise', 'autre']).optional(),
  message: z.string().trim().min(10, 'Votre message doit contenir au moins 10 caractères.').max(4000, 'Votre message est trop long (4 000 caractères au maximum).'),
  consent: z.literal('on', { message: 'Vous devez accepter le traitement de votre message.' }),
});

export async function sendContactMessage(_: ActionState, formData: FormData): Promise<ActionState> {
  // Champ piège invisible : un robot le remplit, un humain non.
  if (String(formData.get('website') ?? '').length > 0) return actionSuccess('Merci, votre message a bien été envoyé.');

  const parsed = schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    organization: formData.get('organization') || undefined,
    audience: formData.get('audience') || undefined,
    message: formData.get('message'),
    consent: formData.get('consent') ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  if (!isAdminClientConfigured()) {
    return actionError('Le formulaire est momentanément indisponible. Écrivez-nous directement par e-mail.');
  }

  // Seule une empreinte HMAC de l'adresse IP est conservée, pour limiter les envois répétés.
  const ip = await requestIp();
  const limited = await rateLimit('contact', { ip });
  if (limited) return actionError(limited);
  const originHash = hashIp(ip, 'happi-contact');

  const { error } = await createAdminClient().rpc('submit_contact_message', {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_organization: parsed.data.organization ?? '',
    p_audience: parsed.data.audience ?? '',
    p_message: parsed.data.message,
    p_origin_hash: originHash,
  });
  if (error) {
    if (error.message.includes('RATE_LIMITED')) return actionError('Vous avez envoyé plusieurs messages récemment. Réessayez dans une heure.');
    console.error('Message de contact non enregistré', error.message);
    return actionError('Votre message n’a pas pu être envoyé. Réessayez dans un instant.');
  }
  return actionSuccess('Merci, votre message a bien été envoyé. Nous vous répondons par e-mail.');
}
