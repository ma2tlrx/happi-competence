import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

/** Le site vitrine est indexable ; les espaces connectés et les pages de vérification ne le sont pas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/participant/', '/organisme/', '/formateur/', '/admin/', '/compte', '/notifications', '/api/', '/verifier/'],
    },
    host: siteConfig.url,
  };
}
