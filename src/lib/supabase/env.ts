/**
 * Lecture centralisée de la configuration Supabase.
 * Accepte l'ancienne (anon / service_role) et la nouvelle (publishable / secret) dénomination des clés.
 */
export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Configuration manquante : NEXT_PUBLIC_SUPABASE_URL.');
  return url;
}

export function getSupabasePublicKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Configuration manquante : NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  return key;
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );
}
