import { cookies } from 'next/headers';

import { SpaceShell } from '@/components/app/shell-loader';
import type { AppSpace } from '@/components/app/nav-config';
import { requireUser } from '@/lib/auth/session';

/** Pages communes à tous les comptes, affichées dans l'espace correspondant au rôle. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Un administrateur qui consulte l'espace formateur reste dans cet espace sur les pages communes (« Jeux »).
  const visited = (await cookies()).get('happi_space')?.value;
  const space: AppSpace = user.role === 'admin' && visited === 'formateur' ? 'formateur' : (user.role as AppSpace);
  return (
    <SpaceShell space={space} user={user}>
      {children}
    </SpaceShell>
  );
}
