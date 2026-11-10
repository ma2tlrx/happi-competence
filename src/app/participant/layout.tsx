import { SpaceShell } from '@/components/app/shell-loader';
import { requireRole } from '@/lib/auth/session';

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('participant');
  return (
    <SpaceShell space="participant" user={user}>
      {children}
    </SpaceShell>
  );
}
