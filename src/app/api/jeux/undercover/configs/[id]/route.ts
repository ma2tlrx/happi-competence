import { deleteConfig } from '@/lib/jeux/data';
import { error, json, requireManager, serverError, uuidParam, type Params } from '@/lib/jeux/http';

/** Supprime une configuration de l'animateur (la RLS ne laisse supprimer que les siennes, ou toutes pour un administrateur). */
export async function DELETE(request: Request, context: Params<'id'>) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const id = await uuidParam(context, 'id');
  if (!id) return error('Configuration introuvable', 404);
  try {
    return (await deleteConfig(guard.manager.db, id)) ? json({ ok: true }) : error('Configuration introuvable', 404);
  } catch (cause) {
    return serverError('config DELETE', cause);
  }
}
