import 'server-only';

import type { ReactNode } from 'react';

import { ROLE_LABELS } from '@/lib/auth/roles';
import type { CurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

import { AppShell } from './app-shell';
import type { AppSpace } from './nav-config';

/** Coque d'un espace privé, alimentée côté serveur (utilisateur, notifications non lues). */
export async function SpaceShell({ space, user, banner, children }: { space: AppSpace; user: CurrentUser; banner?: ReactNode; children: ReactNode }) {
  const supabase = await createClient();
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  const demoBanner = user.isDemo ? (
    <aside aria-label="Démonstration" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-orange-100 px-4 py-2 text-center text-sm text-petrol-950">
      <span>
        <span className="font-semibold">Compte de démonstration</span> · toutes les données affichées sont fictives et marquées « démo ».
      </span>
      <form action="/deconnexion" method="post">
        <button type="submit" className="font-semibold underline underline-offset-4 hover:text-petrol-700">
          Quitter la démonstration
        </button>
      </form>
    </aside>
  ) : null;
  return (
    <AppShell
      space={space}
      unreadCount={count ?? 0}
      banner={
        demoBanner || banner ? (
          <>
            {demoBanner}
            {banner}
          </>
        ) : undefined
      }
      user={{
        firstName: user.firstName || 'Utilisateur',
        lastName: user.lastName,
        email: user.email,
        roleLabel: ROLE_LABELS[user.role],
        isAdmin: user.role === 'admin',
      }}
    >
      {children}
    </AppShell>
  );
}
