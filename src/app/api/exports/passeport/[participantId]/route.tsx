import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/auth/session';
import { getPassport } from '@/lib/passport';
import { qrPngDataUri } from '@/lib/passport-share/qr';
import { revealShareToken, shareUrl } from '@/lib/passport-share/server';
import { PassportDocument } from '@/lib/pdf/passport-document';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Passeport de compétences en PDF. L'accès est celui de la fiche : RLS ne renvoie le
 * participant qu'à lui-même, à ses formateurs, à son organisme et aux administrateurs.
 * Avec ?partage=<lien>, le participant lui-même obtient un PDF portant le QR code de
 * vérification de l'un de ses liens actifs (sinon, pas de QR code).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(participantId)) return NextResponse.json({ error: 'Participant introuvable.' }, { status: 404 });
  if (user.role === 'organisme' && !hasPermission(user, 'org.exports')) {
    return NextResponse.json({ error: 'Téléchargement non autorisé pour ce compte.' }, { status: 403 });
  }

  const supabase = await createClient();
  const passport = await getPassport(supabase, participantId);
  if (!passport) return NextResponse.json({ error: 'Participant introuvable.' }, { status: 404 });

  let verification: { qr: string } | null = null;
  const shareId = request.nextUrl.searchParams.get('partage');
  if (shareId && isUuid(shareId) && user.role === 'participant' && user.participantId === participantId) {
    const token = await revealShareToken(supabase, shareId);
    if (token) verification = { qr: await qrPngDataUri(shareUrl(token)) };
  }

  const buffer = await renderToBuffer(
    <PassportDocument
      passport={passport}
      mascotPath={join(process.cwd(), 'public', 'brand', 'happi-mascotte.png')}
      generatedAt={new Date()}
      verification={verification}
    />,
  );
  await supabase.rpc('log_event', { p_action: 'export.passport_pdf', p_entity_type: 'participant', p_entity_id: participantId, p_metadata: verification ? { with_qr: true } : {} });

  const slug = `${passport.participant.firstName}-${passport.participant.lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="passeport-happi-${slug}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
