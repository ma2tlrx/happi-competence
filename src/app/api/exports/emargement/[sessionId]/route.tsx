import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';

import { loadSignatureSheet } from '@/lib/attendance/load';
import { getCurrentUser, hasPermission } from '@/lib/auth/session';
import { SignatureSheetDocument } from '@/lib/pdf/signature-sheet-document';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Feuille d'émargement signée d'une séance (PDF).
 * Accès : administrateur, formateurs du groupe, organisme (lecture, limitée par RLS à ses participants).
 */
export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Séance introuvable.' }, { status: 404 });
  if (user.role === 'participant') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  if (user.role === 'organisme' && !(hasPermission(user, 'org.exports') && hasPermission(user, 'org.attendance.read'))) {
    return NextResponse.json({ error: 'Téléchargement non autorisé pour ce compte.' }, { status: 403 });
  }

  const supabase = await createClient();
  const sheet = await loadSignatureSheet(supabase, sessionId);
  if (!sheet) return NextResponse.json({ error: 'Séance introuvable.' }, { status: 404 });

  const buffer = await renderToBuffer(<SignatureSheetDocument sheet={sheet} generatedAt={new Date()} partial={user.role === 'organisme'} />);
  // Action journalisable existante ; une action dédiée « export.signature_sheet_pdf » est proposée.
  await supabase.rpc('log_event', {
    p_action: 'export.attendance_pdf',
    p_entity_type: 'session',
    p_entity_id: sessionId,
    p_metadata: { document: 'emargement', sha256: sheet.fingerprint, countersigned: Boolean(sheet.countersignature) },
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="emargement-session-${sheet.session.number}-${sheet.session.date ?? 'sans-date'}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
