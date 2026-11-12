/**
 * Masquage des données personnelles dans les textes libres envoyés à l'IA (commentaires
 * des formateurs, auto-évaluation, observations complémentaires).
 *
 * Le dossier transmis ne contient ni nom ni structure ; mais un commentaire saisi à la
 * main peut contenir une adresse e-mail, un numéro de téléphone, un numéro de sécurité
 * sociale ou d'identifiant, une adresse postale, ou le nom de la personne. Ces éléments
 * sont remplacés par une mention neutre avant tout envoi. Le filtre est volontairement
 * prudent (il préfère masquer un numéro de trop) ; il ne remplace pas la consigne donnée
 * aux formateurs de ne saisir aucune donnée de santé ni information sensible.
 */

export const REDACTED = {
  email: '[e-mail masqué]',
  phone: '[téléphone masqué]',
  number: '[numéro masqué]',
  address: '[adresse masquée]',
  name: '[nom masqué]',
} as const;

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;

// IBAN (FR76 3000 6000 0112 3456 7890 189, ou sans espaces).
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;

// Numéro de sécurité sociale (NIR) : sexe, année, mois, département (dont 2A/2B), commune, ordre, clé.
const NIR = /\b[12][ .-]?\d{2}[ .-]?(?:0[1-9]|1[0-2]|[2-9]\d)[ .-]?(?:\d{2}|2[AB])[ .-]?\d{3}[ .-]?\d{3}(?:[ .-]?\d{2})?\b/gi;

// Téléphones : français (06 12 34 56 78, +33 6 12 34 56 78, 0033…) et internationaux (+44 20 7946 0958).
const PHONE_FR = /(?:\+33[ .-]?(?:\(0\)[ .-]?)?|0033[ .-]?|\b0)[1-9](?:[ .-]?\d{2}){4}\b/g;
const PHONE_INTL = /\+\d{1,3}(?:[ .-]?\(?\d+\)?){2,6}/g;

// Identifiants introduits par un mot-clé : « identifiant France Travail : 1234567A », « n° de dossier 2024-AB-778 ».
const KEYWORD_ID =
  /\b(identifiant|id|n°|no|numéro|numero|matricule|dossier|référence|reference|réf\.?|ref\.?|carte vitale|sécurité sociale|securite sociale|passeport|titre de séjour|carte d’identité|carte d'identité|CNI|INE|NIR|SIRET|SIREN)(\s*(?:de\s+\S+\s*|France Travail\s*|Pôle emploi\s*|CAF\s*|allocataire\s*)?[:#°]?\s*)([A-Z0-9][A-Z0-9./-]{3,}[A-Z0-9]|\d{2,}(?: \d{2,})+)/giu;

// Suite d'au moins 9 chiffres (séparateurs espace, point ou tiret) : identifiants, numéros de compte…
const LONG_NUMBER = /\b\d(?:[ .-]?\d){8,}\b/g;

// Adresses postales : « 12 rue des Lilas », « 3 bis avenue Foch », « BP 45 », « 34000 Montpellier ».
const STREET =
  /\b\d{1,4}\s*(?:bis|ter|quater|[a-d])?\s*,?\s+(?:rue|avenue|av\.|boulevard|bd|place|pl\.|allée|allee|impasse|chemin|route|quai|square|résidence|residence|lotissement|lieu-dit|faubourg|rond-point|cité|cite|hameau|sentier|esplanade|parvis)\b[^,;\n]{0,60}/giu;
const PO_BOX = /\b(?:BP|CS|TSA)\s*\d{1,6}\b/g;
const POSTCODE_CITY = /\b(?:F-)?(?:0[1-9]|[1-8]\d|9[0-8])\d{3}\s+(?:C[EÉ]DEX\s*)?[A-ZÀ-Ý][\p{L}'’-]+(?:[ -](?:[Ss]ur|[Ll]es?|[Ll]a|[Ee]n|[Dd]e|[Ss]ous|[A-ZÀ-Ý][\p{L}'’-]+))*(?:\s+C[EÉ]DEX(?:\s*\d{1,2})?)?/gu;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Masque le prénom et le nom de la personne (mot entier, sans tenir compte de la casse ni des accents saisis tels quels). */
function redactNames(text: string, names: string[]) {
  let result = text;
  for (const name of names) {
    const value = name.trim();
    if (value.length < 2) continue;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, 'giu');
    result = result.replace(pattern, REDACTED.name);
  }
  return result;
}

/**
 * Remplace les données personnelles reconnues dans un texte libre. Les textes vides
 * ou absents sont rendus tels quels (même type), pour ne rien changer à la structure.
 */
export function redactPersonalData<T extends string | null | undefined>(text: T, options: { names?: string[] } = {}): T {
  if (!text) return text;
  let result: string = text;
  result = result.replace(EMAIL, REDACTED.email);
  result = result.replace(IBAN, (match) => (/\d{2}.*\d{4}/.test(match) && /^[A-Z]{2}\d{2}/.test(match) ? REDACTED.number : match));
  result = result.replace(NIR, REDACTED.number);
  result = result.replace(PHONE_FR, REDACTED.phone);
  result = result.replace(PHONE_INTL, (match) => (match.replace(/\D/g, '').length >= 8 ? REDACTED.phone : match));
  result = result.replace(KEYWORD_ID, (match, keyword: string, separator: string, value: string) =>
    /\d/.test(value) ? `${keyword}${separator}${REDACTED.number}` : match,
  );
  result = result.replace(LONG_NUMBER, REDACTED.number);
  result = result.replace(STREET, REDACTED.address);
  result = result.replace(PO_BOX, REDACTED.address);
  result = result.replace(POSTCODE_CITY, REDACTED.address);
  if (options.names?.length) result = redactNames(result, options.names);
  return result as T;
}
