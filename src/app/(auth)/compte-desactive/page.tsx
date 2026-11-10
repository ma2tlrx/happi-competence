import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';

import { signOut } from '../actions';
import { AuthHeading } from '../auth-heading';

export const metadata: Metadata = { title: 'Compte désactivé', robots: { index: false } };

export default function CompteDesactivePage() {
  return (
    <>
      <AuthHeading title="Ce compte est désactivé" intro="Pour le réactiver ou obtenir des informations, contactez l’équipe HAPPI à contact@happicompetence.fr." />
      <form action={signOut}>
        <Button type="submit" variant="outline">Me déconnecter</Button>
      </form>
    </>
  );
}
