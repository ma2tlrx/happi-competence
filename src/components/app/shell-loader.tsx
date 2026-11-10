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
  return (
    <AppShell
      space={space}
      unreadCount={count ?? 0}
      banner={banner}
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
