import { SpaceShell } from '@/components/app/shell-loader';
import { requireRole } from '@/lib/auth/session';

export default async function FormateurLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('formateur', 'admin');
  return (
    <SpaceShell space="formateur" user={user}>
      {children}
    </SpaceShell>
  );
}
