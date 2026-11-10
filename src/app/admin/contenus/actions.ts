'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { parseSessionScript } from '@/lib/pedagogy/parse';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 400_000;

/** Import d'un support Markdown : crée une nouvelle version, publiée ou non. */
export async function importSupport(programSessionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const file = formData.get('file');
  let markdown = String(formData.get('markdown') ?? '');
  let filename: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return actionError('Le fichier dépasse 400 Ko.');
    if (!/\.(md|markdown|txt)$/i.test(file.name)) return actionError('Importez un fichier Markdown (.md).');
    markdown = await file.text();
    filename = file.name;
  }
  markdown = markdown.replace(/\r\n?/g, '\n').trim();
  if (!markdown) return actionError('Ajoutez un fichier ou collez le contenu Markdown.');
  const script = parseSessionScript(markdown);
  const supabase = await createClient();
  const { error } = await supabase.rpc('import_pedagogical_version', {
    p_program_session_id: programSessionId,
    p_markdown: markdown,
    p_source_filename: filename ?? undefined,
    p_change_note: String(formData.get('note') ?? '').trim() || undefined,
    p_is_provisional: formData.get('isProvisional') === 'on',
    p_publish: formData.get('publish') === 'on',
  });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/admin/contenus', 'layout');
  return actionSuccess(
    `Version importée : ${script.sequences.length} séquence(s) reconnue(s), ${script.totalMinutes} min au total.${script.sequences.length === 0 ? ' Aucune séquence « ## » détectée : vérifiez la structure du fichier.' : ''}`,
  );
}

export async function publishSupportVersion(versionId: string) {
  await requireRole('admin');
  const supabase = await createClient();
  const { error } = await supabase.rpc('publish_pedagogical_version', { p_version_id: versionId });
  revalidatePath('/admin/contenus', 'layout');
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}
