import type { Metadata } from 'next';
import Link from 'next/link';

import { UndercoverCreate } from '@/components/jeux/undercover/undercover-create';
import { PageHeader } from '@/components/ui/primitives';
import { requireGamesAccess } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Undercover — Fourmi Caché' };

export default async function UndercoverHomePage() {
  const user = await requireGamesAccess();
  return (
    <>
      <PageHeader
        back={
          <Link href="/jeux" className="font-medium text-petrol-700 underline underline-offset-4 hover:text-petrol-950">
            ← Jeux d’animation
          </Link>
        }
        title="Undercover — Fourmi Caché"
        description="Chaque joueur reçoit un mot sur son téléphone. Une Fourmi a un mot voisin, et un Espion n’en a pas : à la discussion et au vote de les démasquer. Il faut au moins 3 joueurs."
      />
      <div id="configurations">
        <UndercoverCreate defaultNickname={user.firstName} />
      </div>
    </>
  );
}
