import { join } from 'node:path';

import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getPassport } from '@/lib/passport';
import { qrPngDataUri } from '@/lib/passport-share/qr';
import { revealShareToken, shareUrl } from '@/lib/passport-share/server';
import { SkillsCvDocument } from '@/lib/pdf/skills-cv-document';
import { buildSkillsCv } from '@/lib/skills-cv';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

const CODE = /^[A-Za-z0-9_.:-]{1,80}$/;

/**
 * CV de compétences « Mes compétences observées » (une page). Réservé au participant
 * lui-même : il choisit les compétences (?c=code, répété) ; sans choix, toutes les
 * compétences observées. QR code : son lien de partage actif le plus récent, s'il en a un.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(participantId) || user.role !== 'participant' || user.participantId !== participantId) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }
  const supabase = await createClient();
  const passport = await getPassport(supabase, participantId);
  if (!passport) return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });

  const codes = request.nextUrl.searchParams.getAll('c').filter((code) => CODE.test(code)).slice(0, 100);
  const cv = buildSkillsCv(passport, request.nextUrl.searchParams.has('choix') ? codes : null);

  let qr: string | null = null;
  const { data: share } = await supabase
    .from('passport_shares')
    .select('id')
    .eq('participant_id', participantId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (share) {
    const token = await revealShareToken(supabase, share.id);
    if (token) qr = await qrPngDataUri(shareUrl(token));
  }

  const buffer = await renderToBuffer(<SkillsCvDocument cv={cv} mascotPath={join(process.cwd(), 'public', 'brand', 'happi-mascotte.png')} generatedAt={new Date()} qr={qr} />);
  const slug = `${passport.participant.firstName}-${passport.participant.lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="competences-observees-${slug}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
