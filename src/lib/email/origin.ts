/**
 * Origine absolue des liens d'e-mail. NEXT_PUBLIC_SITE_URL prime (domaine public) ; à défaut,
 * le domaine de production Vercel, puis l'origine de la requête en cours, puis localhost.
 * Contrairement aux liens de connexion, aucun en-tête de requête n'est lu ici : un e-mail
 * peut partir d'une tâche planifiée.
 */
export function emailOrigin(fallback?: string | null, env: Record<string, string | undefined> = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  if (fallback) return fallback.replace(/\/+$/, '');
  return 'http://localhost:3000';
}
