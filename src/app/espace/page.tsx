import { redirect } from 'next/navigation';

import { getCurrentUser, homePathFor } from '@/lib/auth/session';

/** Redirige vers l'espace correspondant au compte connecté. */
export default async function EspacePage() {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user) : '/connexion');
}
