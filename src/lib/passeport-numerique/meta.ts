/**
 * Contenu du Passeport Numérique (application d'origine) tel que la plateforme le présente.
 * Le nombre de mondes est vérifié par un test contre le fichier d'origine : s'il change, le test le dit.
 */
export const PASSEPORT_WORLD_COUNT = 19;

export const PASSEPORT_FACTS = [
  { label: 'Mondes d’exercices', value: String(PASSEPORT_WORLD_COUNT) },
  { label: 'Langues d’aide', value: '6' },
  { label: 'Durée d’un atelier', value: '2 h' },
] as const;
