import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';

import { loadCertificate } from '@/lib/attendance/load';
import { getCurrentUser, hasPermission } from '@/lib/auth/session';
import { CertificateDocument } from '@/lib/pdf/certificate-document';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Certificat de réalisation d'un participant pour un groupe (?groupe=…), en PDF.
 * Accès : administrateur, formateurs du groupe, organisme du participant (RLS : appartenance
 * au groupe, séances et présences doivent être lisibles par l'utilisateur).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const groupId = request.nextUrl.searchParams.get('groupe');
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(participantId) || !isUuid(groupId)) return NextResponse.json({ error: 'Certificat introuvable.' }, { status: 404 });
  if (user.role === 'participant') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  if (user.role === 'organisme' && !(hasPermission(user, 'org.exports') && hasPermission(user, 'org.attendance.read'))) {
    return NextResponse.json({ error: 'Téléchargement non autorisé pour ce compte.' }, { status: 403 });
  }

  const supabase = await createClient();
  // Un formateur n'édite le certificat que pour un groupe qu'il anime (pas via l'annuaire).
  if (user.role === 'formateur') {
    const { data: trains } = await supabase.from('group_trainers').select('group_id').eq('group_id', groupId).eq('trainer_id', user.id).maybeSingle();
    if (!trains) return NextResponse.json({ error: 'Certificat introuvable.' }, { status: 404 });
  }
  const certificate = await loadCertificate(supabase, participantId, groupId);
  if (!certificate) return NextResponse.json({ error: 'Certificat introuvable.' }, { status: 404 });

  const buffer = await renderToBuffer(<CertificateDocument certificate={certificate} generatedAt={new Date()} />);
  await supabase.rpc('log_event', {
    p_action: 'export.certificate_pdf',
    p_entity_type: 'participant',
    p_entity_id: participantId,
    p_metadata: { document: 'certificat_realisation', group_id: groupId, sha256: certificate.fingerprint },
  });
  const slug = `${certificate.participant.firstName}-${certificate.participant.lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificat-realisation-${slug}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
