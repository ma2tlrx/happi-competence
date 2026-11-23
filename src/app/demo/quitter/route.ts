import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { DEMO_RETURN_COOKIE, verifyDemoReturn } from '@/lib/demo/return';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const secret = () => process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '';

/**
 * « Quitter la démonstration ».
 * - Un administrateur qui avait ouvert cet espace de démonstration retrouve son tableau de bord administrateur
 *   (témoin signé déposé à l'ouverture, lié à CETTE session démo ; voir src/lib/demo/return.ts).
 * - Dans tous les autres cas (témoin absent, expiré, falsifié, autre compte), la session est fermée et la personne
 *   revient au site : comportement d'origine. Requête venue d'un autre site : refusée.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 });

  const supabase = await createClient();
  const store = await cookies();
  const { data } = await supabase.auth.getUser();
  const current = data.user;
  const adminId = current && current.app_metadata?.is_demo === true ? verifyDemoReturn(secret(), store.get(DEMO_RETURN_COOKIE)?.value, current.id) : null;

  let destination = '/';
  if (adminId && isAdminClientConfigured()) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('email, role, status, is_demo').eq('id', adminId).maybeSingle();
    if (profile && profile.role === 'admin' && profile.status === 'active' && !profile.is_demo) {
      const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: profile.email });
      const tokenHash = link?.properties?.hashed_token;
      if (tokenHash) {
        await supabase.auth.signOut();
        const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
        if (!error) destination = '/admin/dashboard';
      }
    }
  }
  if (destination === '/') await supabase.auth.signOut();
  store.delete(DEMO_RETURN_COOKIE);
  return NextResponse.redirect(new URL(destination, request.nextUrl.origin), { status: 303 });
}
