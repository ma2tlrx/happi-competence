import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/utils';

/**
 * Point d'arrivée des liens envoyés par e-mail (confirmation d'adresse, réinitialisation
 * du mot de passe). Gère le flux PKCE (?code=) et le flux par jeton (?token_hash=&type=).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeInternalPath(url.searchParams.get('suite'), '/connexion');
  const supabase = await createClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = new URL(ok ? (next === '/connexion' ? '/' : next) : '/connexion', url.origin);
  if (!ok) target.searchParams.set('lien', 'expire');
  if (ok && next === '/connexion') {
    // Adresse confirmée : on renvoie vers l'espace du compte.
    target.pathname = '/espace';
  }
  return NextResponse.redirect(target);
}
