import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Déconnexion par formulaire (POST uniquement, pour éviter les déconnexions par simple lien).
 * Une requête venue d'un autre site est ignorée : un tiers ne peut pas déconnecter l'utilisateur.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.nextUrl.origin), { status: 303 });
}
