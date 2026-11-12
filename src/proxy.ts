import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Préfixes réservés aux utilisateurs connectés. Le contrôle du rôle est fait côté serveur, dans les layouts. */
const PROTECTED_PREFIXES = ['/participant', '/organisme', '/formateur', '/admin', '/compte', '/notifications', '/api/exports'];
/** Pages publiques dont l'adresse porte un jeton (vérification d'un passeport partagé). */
const TOKEN_PREFIXES = ['/verifier'];

/** Ni cache partagé, ni en-tête Referer : le jeton ne doit pas sortir de la page. */
function protectToken(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

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
  // Route publique : aucune session à exiger ni à rafraîchir (la page n'utilise pas la session).
  if (TOKEN_PREFIXES.some((prefix) => pathname.startsWith(`${prefix}/`))) return protectToken(NextResponse.next({ request }));
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

  if (isProtected) {
    // Les pages privées ne doivent jamais être mises en cache par un intermédiaire.
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
};
