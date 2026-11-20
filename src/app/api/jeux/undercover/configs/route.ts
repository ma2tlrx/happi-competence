import { createConfig, listConfigs } from '@/lib/jeux/data';
import { json, readBody, requireManager, serverError } from '@/lib/jeux/http';
import { undercoverConfigSchema } from '@/lib/jeux/schemas';

/** Paires de mots enregistrées par l'animateur connecté. */
export async function GET(request: Request) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  try {
    return json({ configs: await listConfigs(guard.manager.db, guard.manager.user.id) });
  } catch (cause) {
    return serverError('configs GET', cause);
  }
}

export async function POST(request: Request) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const body = await readBody(request, undercoverConfigSchema);
  if (!body.ok) return body.response;
  try {
    return json({ config: await createConfig(guard.manager.db, guard.manager.user.id, body.data) }, 201);
  } catch (cause) {
    return serverError('configs POST', cause);
  }
}
