import { connection } from 'next/server';

import { publicJson } from '@/lib/badges/public-json';
import { publicKeys } from '@/lib/badges/server';

/** Clés publiques de vérification des badges (JWKS, RFC 7517). Vide tant que la signature n'est pas configurée. */
export async function GET() {
  await connection();
  return publicJson({ keys: publicKeys() });
}
