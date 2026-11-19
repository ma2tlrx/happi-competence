import { NextResponse, type NextRequest } from 'next/server';

import { credentialSha256, envelopedCredential } from '@/lib/badges/credential';
import { revealCredential } from '@/lib/badges/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Badge signé, à télécharger par son titulaire (ou un administrateur) :
 * ?format=jwt (par défaut) : JWS compact brut, fichier Open Badges 3.0 de référence (§ 5.1 : le contenu
 *   du fichier DOIT être le JWS compact, extension .jwt ou .jws ; § 5.2 : text/plain) ;
 * ?format=json : même badge « enveloppé » dans le JSON du modèle VC 2.0 (EnvelopedVerifiableCredential).
 * La base ne remet la copie chiffrée qu'au titulaire d'un badge non révoqué, ou à un administrateur.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(id) || !['participant', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Badge introuvable.' }, { status: 404 });

  const supabase = await createClient();
  const [jwt, { data: row }] = await Promise.all([
    revealCredential(supabase, id),
    supabase.from('badge_assertions').select('credential_sha256, badge_classes ( name )').eq('id', id).maybeSingle(),
  ]);
  // Copie altérée ou chiffrée avec une autre clé : on ne remet rien plutôt qu'un badge invérifiable.
  if (!jwt || !row || credentialSha256(jwt) !== row.credential_sha256) return NextResponse.json({ error: 'Badge introuvable ou révoqué.' }, { status: 404 });

  const slug = (row.badge_classes?.name ?? 'badge')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  const asJwt = request.nextUrl.searchParams.get('format') !== 'json';
  return new NextResponse(asJwt ? jwt : JSON.stringify(envelopedCredential(jwt), null, 2), {
    headers: {
      'Content-Type': asJwt ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="open-badge-${slug || 'badge'}.${asJwt ? 'jwt' : 'json'}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
