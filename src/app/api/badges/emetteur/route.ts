import { connection } from 'next/server';

import { OB_CONTEXT, VC_CONTEXT } from '@/lib/badges/credential';
import { publicJson } from '@/lib/badges/public-json';
import { badgeUrls, issuerInfo, publicKeys } from '@/lib/badges/server';

/**
 * Profil de l'émetteur (Profile Open Badges 3.0) : adresse inscrite dans le champ « issuer »
 * de chaque badge. Il publie aussi la clé publique de signature (méthode de vérification
 * JsonWebKey, à la manière d'un document d'identifiant contrôlé) et l'adresse du JWKS.
 */
export async function GET() {
  await connection();
  const issuer = issuerInfo();
  const keys = publicKeys();
  return publicJson({
    '@context': [VC_CONTEXT, OB_CONTEXT],
    id: issuer.id,
    type: ['Profile'],
    name: issuer.name,
    url: issuer.url,
    ...(issuer.email ? { email: issuer.email } : {}),
    verificationMethod: keys.map((key) => ({ id: key.kid, type: 'JsonWebKey', controller: issuer.id, publicKeyJwk: key })),
    assertionMethod: keys.map((key) => key.kid),
    jwks_uri: badgeUrls.jwks(),
  });
}
