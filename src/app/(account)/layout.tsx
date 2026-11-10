import { SpaceShell } from '@/components/app/shell-loader';
import type { AppSpace } from '@/components/app/nav-config';
import { requireUser } from '@/lib/auth/session';

/** Pages communes à tous les comptes, affichées dans l'espace correspondant au rôle. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <SpaceShell space={user.role as AppSpace} user={user}>
      {children}
    </SpaceShell>
  );
}
