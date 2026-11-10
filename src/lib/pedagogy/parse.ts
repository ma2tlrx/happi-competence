/**
 * Analyse un support pédagogique Markdown et le découpe en séquences pour le lecteur.
 *
 * Convention (voir docs/format-supports-pedagogiques.md) :
 *   # Titre de la session
 *   ## Objectifs / ## Compétences observées / ## Matériel   → informations de session
 *   ## Titre de séquence                                    → une séquence du déroulé
 *   - **Durée** : 10 min                                    → fiche de la séquence
 *   - **Type** : Activité
 *   ### À dire / ### Consigne… / ### À observer / ### À retenir / ### Questions…
 *
 * L'analyse est tolérante : un fichier qui ne suit pas la convention reste lisible,
 * chaque titre de niveau 2 devenant une séquence et tout le contenu étant conservé.
 */

export type PartKind =
  | 'say'
  | 'do'
  | 'observe'
  | 'retain'
  | 'questions'
  | 'objectives'
  | 'debrief'
  | 'transition'
  | 'skills'
  | 'material'
  | 'content';

export type SequenceType = 'intro' | 'theory' | 'activity' | 'discussion' | 'break' | 'debrief' | 'transition' | 'quiz' | 'other';

export type SequencePart = { kind: PartKind; title: string | null; markdown: string };

export type Sequence = {
  /** Clé stable servant aux notes et minuteurs (rang + titre normalisé). */
  key: string;
  index: number;
  title: string;
  type: SequenceType;
  durationMinutes: number | null;
  objective: string | null;
  skills: string[];
  meta: { label: string; value: string }[];
  parts: SequencePart[];
};

export type SessionInfo = { kind: PartKind; title: string; markdown: string };

export type SessionScript = {
  title: string | null;
  /** Texte placé entre le titre et la première section (présentation, avertissement). */
  intro: string;
  meta: { label: string; value: string }[];
  info: SessionInfo[];
  sequences: Sequence[];
  totalMinutes: number;
};

export const PART_LABELS: Record<PartKind, string> = {
  say: 'À dire',
  do: 'Ce que font les participants',
  observe: 'À observer',
  retain: 'À retenir',
  questions: 'Questions à poser',
  objectives: 'Objectifs',
  debrief: 'Débriefing',
  transition: 'Transition',
  skills: 'Compétences mobilisées',
  material: 'Matériel',
  content: 'Contenu',
};

export const SEQUENCE_TYPE_LABELS: Record<SequenceType, string> = {
  intro: 'Introduction',
  theory: 'Apport théorique',
  activity: 'Activité',
  discussion: 'Débat',
  break: 'Pause',
  debrief: 'Débriefing',
  transition: 'Transition',
  quiz: 'Quiz',
  other: 'Séquence',
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .trim();

const slugify = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** « 10 min », « 1 h 30 », « 1h30 », « 90 minutes », « 2 h » → minutes. */
export function parseDuration(text: string): number | null {
  const value = normalize(text);
  const hours = value.match(/(\d+(?:[.,]\d+)?)\s*h(?:eures?)?\s*(\d{1,2})?/);
  if (hours) {
    const total = Math.round(parseFloat(hours[1]!.replace(',', '.')) * 60) + (hours[2] ? parseInt(hours[2], 10) : 0);
    return total > 0 ? total : null;
  }
  const minutes = value.match(/(\d+)\s*(?:min(?:utes?)?|mn|')/);
  if (minutes) return parseInt(minutes[1]!, 10) || null;
  return null;
}

export function classifyPart(title: string): PartKind {
  const value = normalize(title);
  if (/^(a dire|discours|texte a (dire|lire|presenter)|script|notions? cles? a transmettre|a transmettre)/.test(value)) return 'say';
  if (/(consigne|participants? (font|doivent)|ce que font|a faire|deroule (du jeu|de l activite))/.test(value)) return 'do';
  if (/(a observer|observation|points? d observation|indicateurs?)/.test(value)) return 'observe';
  if (/(a retenir|point(s)? a retenir|conseil|rappel|indication|pour le formateur|vigilance)/.test(value)) return 'retain';
  if (/question/.test(value)) return 'questions';
  if (/^objectif/.test(value)) return 'objectives';
  if (/debrief/.test(value)) return 'debrief';
  if (/transition/.test(value)) return 'transition';
  if (/competences? (mobilisees?|observees?|travaillees?|visees?)/.test(value)) return 'skills';
  if (/^(materiel|preparation|prerequis)/.test(value)) return 'material';
  return 'content';
}

export function classifySequence(typeLabel: string | null, title: string): SequenceType {
  const value = normalize(typeLabel ?? '');
  const source = value || normalize(title);
  if (/pause/.test(source)) return 'break';
  if (/transition/.test(source)) return 'transition';
  if (/(debrief|conclusion|bilan|mise en commun)/.test(source)) return 'debrief';
  if (/quiz/.test(source)) return 'quiz';
  if (/(debat|discussion|echange)/.test(source)) return 'discussion';
  if (/(theor|apport|notions?|cours)/.test(source)) return 'theory';
  if (/(activite|jeu|atelier|pratique|icebreaker|mise en situation|exercice)/.test(source)) return 'activity';
  if (/(introduction|accueil|cadrage|presentation)/.test(source)) return 'intro';
  return 'other';
}

type RawSection = { title: string; lines: string[] };

/** Découpe un texte selon les titres d'un niveau donné, en ignorant les blocs de code. */
function splitByHeading(lines: string[], level: number): { preamble: string[]; sections: RawSection[] } {
  const marker = `${'#'.repeat(level)} `;
  const preamble: string[] = [];
  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith(marker)) {
      current = { title: line.slice(marker.length).replace(/\s+#+\s*$/, '').trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  return { preamble, sections };
}

const META_LINE = /^\s*[-*]\s+\*\*([^*]+?)\*\*\s*:\s*(.+?)\s*$/;

/** Extrait la « fiche » (liste de clés en gras) placée en tête d'un bloc. */
function extractMeta(lines: string[]): { meta: { label: string; value: string }[]; rest: string[] } {
  const meta: { label: string; value: string }[] = [];
  let index = 0;
  while (index < lines.length && lines[index]!.trim() === '') index += 1;
  let cursor = index;
  while (cursor < lines.length) {
    const match = lines[cursor]!.match(META_LINE);
    if (!match) break;
    meta.push({ label: match[1]!.trim(), value: match[2]!.trim() });
    cursor += 1;
  }
  if (meta.length === 0) return { meta, rest: lines };
  return { meta, rest: lines.slice(cursor) };
}

const SESSION_INFO = /^(objectifs?|competences?|materiel|preparation|prerequis|en bref|vue d ensemble|avant la session)/;

const clean = (lines: string[]) => lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

export function parseSessionScript(source: string): SessionScript {
  let text = source.replace(/\r\n?/g, '\n');
  const meta: { label: string; value: string }[] = [];

  // En-tête YAML facultatif (clé: valeur), repris comme métadonnées.
  const frontMatter = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (frontMatter) {
    for (const line of frontMatter[1]!.split('\n')) {
      const pair = line.match(/^([^:#]+):\s*(.+)$/);
      if (pair) meta.push({ label: pair[1]!.trim(), value: pair[2]!.trim().replace(/^["']|["']$/g, '') });
    }
    text = text.slice(frontMatter[0].length);
  }

  const lines = text.split('\n');
  let title: string | null = null;
  const titleIndex = lines.findIndex((line) => line.startsWith('# '));
  let body = lines;
  if (titleIndex >= 0) {
    title = lines[titleIndex]!.slice(2).trim();
    body = [...lines.slice(0, titleIndex), ...lines.slice(titleIndex + 1)];
  }

  const { preamble, sections } = splitByHeading(body, 2);
  const preambleMeta = extractMeta(preamble.filter((line, index, all) => !(index === 0 && line.trim() === '' && all.length === 1)));
  // La fiche de session peut suivre un paragraphe d'introduction : on la cherche aussi plus bas.
  const introLines: string[] = [];
  for (const line of preamble) {
    const match = line.match(META_LINE);
    if (match) meta.push({ label: match[1]!.trim(), value: match[2]!.trim() });
    else introLines.push(line);
  }
  void preambleMeta;

  const info: SessionInfo[] = [];
  const sequences: Sequence[] = [];

  for (const section of sections) {
    const { meta: fiche, rest } = extractMeta(section.lines);
    const headingDuration = section.title.match(/[(—–-]\s*((?:\d+\s*h\s*\d*|\d+\s*(?:min(?:utes?)?|mn)))\s*\)?\s*$/i);
    const cleanTitle = headingDuration ? section.title.slice(0, headingDuration.index).replace(/[\s(—–-]+$/, '').trim() : section.title;

    const find = (pattern: RegExp) => fiche.find((item) => pattern.test(normalize(item.label)))?.value ?? null;
    const durationText = find(/^duree/) ?? headingDuration?.[1] ?? null;
    const duration = durationText ? parseDuration(durationText) : null;

    if (duration === null && SESSION_INFO.test(normalize(cleanTitle))) {
      info.push({ kind: classifyPart(cleanTitle), title: cleanTitle, markdown: clean(section.lines) });
      continue;
    }

    const { preamble: lead, sections: subsections } = splitByHeading(rest, 3);
    const parts: SequencePart[] = [];
    const leadText = clean(lead);
    if (leadText) parts.push({ kind: 'content', title: null, markdown: leadText });
    for (const subsection of subsections) {
      const markdown = clean(subsection.lines);
      if (!markdown) continue;
      parts.push({ kind: classifyPart(subsection.title), title: subsection.title, markdown });
    }

    const skillsText = find(/^competences?/);
    const index = sequences.length;
    sequences.push({
      key: `${index + 1}-${slugify(cleanTitle) || 'sequence'}`,
      index,
      title: cleanTitle,
      type: classifySequence(find(/^type/), cleanTitle),
      durationMinutes: duration,
      objective: find(/^objectif/),
      skills: skillsText && !/a renseigner/.test(normalize(skillsText)) ? skillsText.split(/[,;]/).map((item) => item.trim()).filter(Boolean) : [],
      meta: fiche.filter((item) => !/^(duree|type|objectif|competences?)/.test(normalize(item.label))),
      parts,
    });
  }

  return {
    title,
    intro: clean(introLines),
    meta,
    info,
    sequences,
    totalMinutes: sequences.reduce((sum, sequence) => sum + (sequence.durationMinutes ?? 0), 0),
  };
}
