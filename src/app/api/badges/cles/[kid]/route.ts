import { connection } from 'next/server';

import { notFoundJson, publicJson } from '@/lib/badges/public-json';
import { badgeSigning } from '@/lib/badges/server';

/** Clé publique désignée par le « kid » de l'en-tête d'un badge (adresse déréférençable vers un JWK). */
export async function GET(_: Request, { params }: { params: Promise<{ kid: string }> }) {
  await connection();
  const { kid } = await params;
  const signing = badgeSigning();
  if (!signing.ok || kid !== signing.thumbprint) return notFoundJson();
  return publicJson(signing.publicJwk);
}
