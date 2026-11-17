import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth/session';
import { mfaStep } from '@/lib/auth/mfa';
import { archiveFilename, buildReversibilityArchive, type ExportPayload } from '@/lib/ops/reversibility';
import { createClient } from '@/lib/supabase/server';

/** Un export complet peut être volumineux : on laisse le temps à la base et à la compression. */
export const maxDuration = 120;

/**
 * Réversibilité : archive ZIP de toutes les données d'un organisme (?organisme=<uuid>) ou de
 * toute la plateforme (sans paramètre). Administrateur uniquement — contrôlé ici, puis par la
 * base (public.export_platform_data vérifie private.is_admin() et journalise l'export).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.status !== 'active' || user.role !== 'admin' || mfaStep(user.mfa) !== null) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }
  const raw = request.nextUrl.searchParams.get('organisme');
  const parsed = z.uuid().nullable().safeParse(raw || null);
  if (!parsed.success) return NextResponse.json({ error: 'Organisme invalide.' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('export_platform_data', { p_organization_id: parsed.data });
  if (error || !data) {
    const status = error?.code === 'P0002' ? 404 : error?.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: status === 404 ? 'Organisme introuvable.' : 'Export impossible.' }, { status });
  }
  const payload = data as unknown as ExportPayload;
  const organizationName = payload.scope === 'organisme' ? ((payload.data.organismes?.[0]?.name as string | undefined) ?? null) : null;
  const archive = buildReversibilityArchive(payload, organizationName);
  return new NextResponse(Buffer.from(archive), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${archiveFilename(payload, organizationName)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
