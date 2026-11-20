/**
 * Thèmes et paires de mots d'Undercover, repris tels quels du jeu d'origine.
 * Contenu PROVISOIRE — À VALIDER par l'équipe HAPPI avant usage en séance : aucune paire n'est un
 * référentiel pédagogique. Le formateur enregistre ses propres paires (game_undercover_configs).
 * Module sans dépendance serveur : utilisable aussi par les pages.
 */
export interface WordPair { civil: string; undercover: string }

export interface WordTheme {
  id: string
  label: string
  emoji: string
  color: string
  pairs: WordPair[]
}

export const THEMES: WordTheme[] = [
  {
    id: 'standard',
    label: 'Standard',
    emoji: '🎲',
    color: '#7B5EA7',
    pairs: [
      { civil: 'Chat', undercover: 'Chien' },
      { civil: 'Mer', undercover: 'Océan' },
      { civil: 'Pizza', undercover: 'Burger' },
      { civil: 'Train', undercover: 'Métro' },
      { civil: 'Café', undercover: 'Thé' },
      { civil: 'Montagne', undercover: 'Colline' },
      { civil: 'Soleil', undercover: 'Lune' },
      { civil: 'Livre', undercover: 'Magazine' },
      { civil: 'Château', undercover: 'Palais' },
      { civil: 'Bougie', undercover: 'Lampe' },
      { civil: 'Roi', undercover: 'Reine' },
      { civil: 'Fromage', undercover: 'Beurre' },
    ],
  },
  {
    id: 'animaux',
    label: 'Animaux',
    emoji: '🦁',
    color: '#E07040',
    pairs: [
      { civil: 'Lion', undercover: 'Tigre' },
      { civil: 'Requin', undercover: 'Dauphin' },
      { civil: 'Chat', undercover: 'Renard' },
      { civil: 'Cigogne', undercover: 'Flamant' },
      { civil: 'Araignée', undercover: 'Scorpion' },
      { civil: 'Aigle', undercover: 'Faucon' },
      { civil: 'Crocodile', undercover: 'Alligator' },
      { civil: 'Perroquet', undercover: 'Toucan' },
      { civil: 'Cheval', undercover: 'Âne' },
      { civil: 'Cochon', undercover: 'Sanglier' },
      { civil: 'Pingouin', undercover: 'Manchot' },
      { civil: 'Poulpe', undercover: 'Seiche' },
    ],
  },
  {
    id: 'cinema',
    label: 'Cinéma & Séries',
    emoji: '🎬',
    color: '#C7572E',
    pairs: [
      { civil: 'Cinéma', undercover: 'Théâtre' },
      { civil: 'Vampire', undercover: 'Zombie' },
      { civil: 'Fantôme', undercover: 'Esprit' },
      { civil: 'Héros', undercover: 'Super-héros' },
      { civil: 'Détective', undercover: 'Espion' },
      { civil: 'Acteur', undercover: 'Comédien' },
      { civil: 'Trailer', undercover: 'Teaser' },
      { civil: 'Popcorn', undercover: 'Bonbons' },
      { civil: 'Oscars', undercover: 'César' },
      { civil: 'Netflix', undercover: 'Disney+' },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    emoji: '⚽',
    color: '#4CAF9F',
    pairs: [
      { civil: 'Tennis', undercover: 'Badminton' },
      { civil: 'Ski', undercover: 'Snowboard' },
      { civil: 'Football', undercover: 'Rugby' },
      { civil: 'Natation', undercover: 'Plongée' },
      { civil: 'Boxe', undercover: 'Karaté' },
      { civil: 'Cyclisme', undercover: 'Triathlon' },
      { civil: 'Basket', undercover: 'Volley' },
      { civil: 'Marathon', undercover: 'Sprint' },
      { civil: 'Arbitre', undercover: 'Juge' },
      { civil: 'Stade', undercover: 'Arène' },
    ],
  },
  {
    id: 'cuisine',
    label: 'Cuisine',
    emoji: '🍕',
    color: '#D4A017',
    pairs: [
      { civil: 'Pizza', undercover: 'Tarte' },
      { civil: 'Chocolat', undercover: 'Caramel' },
      { civil: 'Boulanger', undercover: 'Pâtissier' },
      { civil: 'Banane', undercover: 'Mangue' },
      { civil: 'Steak', undercover: 'Côtelette' },
      { civil: 'Café', undercover: 'Expresso' },
      { civil: 'Rose', undercover: 'Tulipe' },
      { civil: 'Fromage', undercover: 'Yaourt' },
      { civil: 'Crêpe', undercover: 'Gaufre' },
      { civil: 'Sushi', undercover: 'Maki' },
      { civil: 'Croissant', undercover: 'Pain au chocolat' },
      { civil: 'Champagne', undercover: 'Prosecco' },
    ],
  },
  {
    id: 'tech',
    label: 'Technologie',
    emoji: '💻',
    color: '#3B82F6',
    pairs: [
      { civil: 'Instagram', undercover: 'TikTok' },
      { civil: 'Ordinateur', undercover: 'Tablette' },
      { civil: 'Hacker', undercover: 'Développeur' },
      { civil: 'Robot', undercover: 'Androïde' },
      { civil: 'Astronaute', undercover: 'Cosmonaute' },
      { civil: 'Drone', undercover: 'Hélicoptère' },
      { civil: 'Virus', undercover: 'Malware' },
      { civil: 'Google', undercover: 'Bing' },
      { civil: 'iPhone', undercover: 'Android' },
      { civil: 'WiFi', undercover: 'Bluetooth' },
    ],
  },
]

export const ALL_PAIRS: WordPair[] = THEMES.flatMap((t) => t.pairs)

export function getTheme(id: string): WordTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function getRandomWordPairFromTheme(themeId?: string, rng: () => number = Math.random): WordPair {
  const pool = themeId ? getTheme(themeId).pairs : ALL_PAIRS
  return pool[Math.floor(rng() * pool.length)]
}
