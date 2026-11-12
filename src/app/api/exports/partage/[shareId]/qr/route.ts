import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { qrPng, qrSvg } from '@/lib/passport-share/qr';
import { revealShareToken, shareUrl } from '@/lib/passport-share/server';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * QR code d'un lien de partage actif, téléchargé par son titulaire (PNG ou SVG).
 * La base ne livre le jeton chiffré qu'au participant propriétaire du lien.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.role !== 'participant' || user.status !== 'active' || !isUuid(shareId)) return NextResponse.json({ error: 'Lien introuvable.' }, { status: 404 });

  const token = await revealShareToken(await createClient(), shareId);
  if (!token) return NextResponse.json({ error: 'Lien introuvable.' }, { status: 404 });
  const url = shareUrl(token);
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

  if (request.nextUrl.searchParams.get('format') === 'svg') {
    return new NextResponse(await qrSvg(url), {
      headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': 'attachment; filename="qr-passeport-happi.svg"' },
    });
  }
  return new NextResponse(new Uint8Array(await qrPng(url, 1024)), {
    headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="qr-passeport-happi.png"' },
  });
}
