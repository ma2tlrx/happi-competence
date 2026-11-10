import { SpaceShell } from '@/components/app/shell-loader';
import { requireRole } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('admin');
  return (
    <SpaceShell space="admin" user={user}>
      {children}
    </SpaceShell>
  );
}
