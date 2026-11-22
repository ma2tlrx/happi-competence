import { SECTORS } from '@/lib/intake/codes';

/**
 * Secteurs visés (questionnaire d'accueil, étape 4) → grands domaines (« K ») ou domaines
 * professionnels (« K12 ») du ROME. Alignement de nomenclatures, documenté dans
 * docs/pistes-metiers.md et modifiable ici : il ne touche ni aux niveaux ni aux barèmes.
 */
export const SECTOR_ROME_PREFIXES: Record<keyof typeof SECTORS, readonly string[]> = {
  commerce_vente: ['D', 'M17'],
  informatique_numerique: ['M18', 'I14'],
  sante_social: ['J', 'K11', 'K12', 'K13'],
  securite_defense: ['K17', 'K25'],
  art_design: ['B', 'E', 'L11', 'L12', 'L13', 'L15'],
  hotellerie_restauration: ['G11', 'G13', 'G14', 'G15', 'G16', 'G17', 'G18'],
  btp_artisanat: ['F', 'B', 'D11'],
  sport_animation: ['G12', 'L14', 'K12'],
  finance_gestion: ['C', 'M12', 'M13', 'M14'],
  education_formation: ['K21'],
  transport_logistique: ['N'],
  industrie_production: ['H', 'I'],
  autre: [],
};

export const isSectorCode = (code: string): code is keyof typeof SECTORS => Object.prototype.hasOwnProperty.call(SECTORS, code);

export function sectorLabel(code: keyof typeof SECTORS): string {
  return SECTORS[code];
}
