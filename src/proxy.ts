import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { decodeJwtPayload, MFA_CHALLENGE_PATH } from '@/lib/auth/mfa';

/** Préfixes réservés aux utilisateurs connectés. Le contrôle du rôle est fait côté serveur, dans les layouts. */
const PROTECTED_PREFIXES = ['/participant', '/organisme', '/formateur', '/admin', '/compte', '/notifications', '/api/exports'];

/**
 * Rafraîchit la session Supabase à chaque requête et renvoie les visiteurs non
 * connectés vers la page de connexion. Ce filtre est une première barrière :
 * l'autorisation réelle repose sur les contrôles serveur et sur RLS.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  // Visiteur sans session sur une page publique : rien à vérifier ni à rafraîchir (aucun appel réseau).
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
  if (!isProtected && !hasSession) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() valide le jeton auprès du serveur d'authentification (ne pas se fier à getSession() ici).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/connexion';
    loginUrl.search = '';
    loginUrl.searchParams.set('suite', `${pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  // Double authentification : un compte qui a un facteur vérifié doit saisir son code
  // (session aal2) avant d'accéder à une page privée ou à un export. Le jeton vient d'être
  // validé par getUser() : on peut en lire le niveau d'assurance sans revérifier la signature.
  if (isProtected && user?.factors?.some((factor) => factor.status === 'verified')) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (decodeJwtPayload(session?.access_token)?.aal !== 'aal2') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Double authentification requise.' }, { status: 401 });
      }
      const challengeUrl = request.nextUrl.clone();
      challengeUrl.pathname = MFA_CHALLENGE_PATH;
      challengeUrl.search = '';
      challengeUrl.searchParams.set('suite', `${pathname}${request.nextUrl.search}`);
      const redirect = NextResponse.redirect(challengeUrl);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }
  }

  if (isProtected) {
    // Les pages privées ne doivent jamais être mises en cache par un intermédiaire.
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
};
