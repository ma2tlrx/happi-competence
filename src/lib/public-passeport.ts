import { PASSEPORT_FACTS } from '@/lib/passeport-numerique/meta';

/**
 * Textes publics du Passeport Numérique (site vitrine).
 * Les titres de mondes et d'exercices sont ceux de l'application (private/passeport-numerique/index.html) ;
 * les chiffres viennent de PASSEPORT_FACTS. Rien n'est ajouté à ce que l'application fait réellement.
 */
export const passeportFacts = PASSEPORT_FACTS;

export const PASSEPORT_ANCHOR = '/programmes#passeport-numerique';
export const PASSEPORT_SIGNUP = '/inscription?espace=participant';

export const passeportSteps = [
  {
    title: 'Je m’inscris',
    text: 'Je crée mon compte et je choisis le Passeport Numérique comme programme.',
  },
  {
    title: 'Un guide m’accompagne',
    text: 'Pas à pas, à mon rythme. Chaque consigne est écrite simplement et peut être lue à voix haute.',
  },
  {
    title: 'Je m’entraîne sans risque',
    text: 'Les exercices se font sur des écrans simulés : rien n’est envoyé, rien ne se perd. Je peux recommencer.',
  },
  {
    title: 'Je garde des traces',
    text: 'Des notes mémo à imprimer, des défis chrono pour s’amuser et, à la fin du parcours, un certificat de réussite.',
  },
] as const;

/** Aperçu de mondes réels de l'application. */
export const passeportWorlds = [
  {
    name: 'Les premiers gestes',
    exercises: ['Toucher les ronds', 'Faire défiler une page', 'Glisser-déposer'],
  },
  {
    name: 'Reconnaître les arnaques',
    exercises: ['Vrai ou arnaque ?', 'Faux SMS et faux appels', 'Quiz : le bon réflexe'],
  },
  {
    name: 'Les mails',
    exercises: ['Ouvrir et lire un mail', 'Écrire un nouveau mail', 'Ouvrir une pièce jointe'],
  },
  {
    name: 'Démarches et rendez-vous',
    exercises: ['Prendre rendez-vous chez le médecin', 'Se connecter avec FranceConnect', 'Les bons sites pour ses démarches'],
  },
] as const;

/** Autres mondes de l'application, cités en complément. */
export const passeportMoreWorlds = [
  'Le clavier',
  'Les photos et les proches',
  'Imprimer',
  'Internet au quotidien',
  'Appeler et garder le contact',
  'Un appareil confortable',
  'Applications et astuces',
  'Acheter en ligne sans risque',
  'Les applis du quotidien',
  'L’IA au quotidien',
  'Mon espace santé',
  'Les réseaux sociaux',
  'Vraie ou fausse information ?',
  'Sauvegarder ses photos',
  'Wi-Fi, Bluetooth et mises à jour',
] as const;

/** « Pour qui » : personnes éloignées du numérique. */
export const passeportAudience = {
  title: 'Pour les personnes éloignées du numérique',
  intro:
    'Le téléphone, l’ordinateur ou internet vous semblent compliqués, ou vous évitez de vous en servir ? Le Passeport Numérique est fait pour vous : on avance à votre rythme, sans jugement.',
  items: [
    'Gagner en autonomie : prendre son téléphone ou son ordinateur en main sans demander à quelqu’un.',
    'Prendre confiance : s’entraîner sur des écrans simulés, sans risque de se tromper pour de vrai.',
    'Éviter les arnaques : repérer les faux messages, les faux appels et les faux sites.',
    'Faire ses démarches en ligne : rendez-vous médical, connexion à un compte administratif, mails.',
    'Rester en lien : messagerie, appels vidéo, photos de ses proches.',
  ],
} as const;

export const passeportAccess = [
  'Une aide en 6 langues',
  'Une lecture à voix haute des consignes',
  'De grands textes et de gros boutons',
] as const;
