import { NextResponse } from 'next/server';

import { isAuthorizedCron } from '@/lib/email/cron-auth';
import { enqueueReminders } from '@/lib/email/events';
import { processOutbox } from '@/lib/email/outbox';

/** Plusieurs lots peuvent partir en une passe : on laisse le temps aux fournisseurs de répondre. */
export const maxDuration = 300;

/**
 * Tâche planifiée quotidienne (vercel.json → crons) : met en file les rappels J-1 des séances du
 * lendemain (heure de Paris), puis vide la file d'envoi (nouveaux messages et échecs à reprendre).
 * Protégée par CRON_SECRET : Vercel l'envoie dans « Authorization: Bearer … ».
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  const reminders = await enqueueReminders();
  const outbox = await processOutbox({ origin: new URL(request.url).origin, maxBatches: 8 });
  // Comptes uniquement : aucune adresse ni donnée personnelle dans la réponse ou les journaux.
  return NextResponse.json({ ok: true, reminders, outbox }, { headers: { 'cache-control': 'no-store' } });
}
