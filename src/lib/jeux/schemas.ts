/**
 * Validation stricte des corps de requête des routes /api/jeux. Tout ce qui vient du réseau passe
 * par ici : types, longueurs, formats. Les messages sont en français et sans détail technique.
 */
import { z } from 'zod';

const UUID = z.uuid({ message: 'Identifiant invalide.' });
const NO_CONTROL = /^[^\u0000-\u001f\u007f<>]*$/;

/** Pseudo : 2 à 24 caractères, espaces normalisés, ni caractère de contrôle ni chevron. */
export const nicknameSchema = z
  .string({ message: 'Pseudo requis.' })
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Le pseudo doit faire au moins 2 caractères.')
      .max(24, 'Le pseudo ne doit pas dépasser 24 caractères.')
      .regex(NO_CONTROL, 'Ce pseudo contient des caractères non autorisés.'),
  );

/** Code de partie : 6 caractères alphanumériques, saisis en majuscules ou non. */
export const gameCodeSchema = z
  .string({ message: 'Code requis.' })
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, 'Code de partie invalide.'));

const playerToken = z.string({ message: 'Jeton requis.' }).min(16, 'Jeton invalide.').max(128, 'Jeton invalide.');
const shortText = (max: number, label: string) =>
  z
    .string({ message: `${label} requis.` })
    .transform((value) => value.trim())
    .pipe(z.string().min(1, `${label} requis.`).max(max, `${label} : ${max} caractères au maximum.`));

const themeColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB).');
const imageUrl = z
  .string()
  .max(500, 'Adresse d’image trop longue.')
  .regex(/^(https:\/\/[^\s]+|\/[A-Za-z0-9/_.-]+)$/, 'L’adresse de l’image doit commencer par https://.');

// ── Quiz ────────────────────────────────────────────────────────────────────
export const quizCreateSchema = z.object({
  title: shortText(120, 'Titre'),
  description: z.string().max(500, 'Description : 500 caractères au maximum.').optional().default(''),
  themeColor: themeColor.optional(),
});

export const quizPatchSchema = z.object({
  title: shortText(120, 'Titre').optional(),
  description: z.string().max(500, 'Description : 500 caractères au maximum.').optional(),
  themeColor: themeColor.optional(),
});

export const answerSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  text: z.string().max(200, 'Réponse : 200 caractères au maximum.').transform((value) => value.trim()),
  isCorrect: z.boolean(),
});

export const questionSchema = z.object({
  id: z.string().max(64).optional(),
  text: z.string().max(300, 'Énoncé : 300 caractères au maximum.').transform((value) => value.trim()),
  type: z.enum(['multiple_choice', 'true_false', 'multiple_select'], { message: 'Type de question invalide.' }),
  timeLimit: z.number().int('Durée invalide.').min(5, 'Durée minimale : 5 secondes.').max(300, 'Durée maximale : 300 secondes.'),
  imageUrl: z.union([imageUrl, z.literal(''), z.null()]).optional(),
  answers: z.array(answerSchema).min(2, 'Au moins deux réponses par question.').max(8, 'Huit réponses au maximum par question.'),
});

export const quizUpdateSchema = z.object({
  quiz: quizPatchSchema.optional(),
  questions: z.array(questionSchema).max(100, '100 questions au maximum par quiz.').optional(),
});

export type QuestionInput = z.infer<typeof questionSchema>;

/**
 * Une question est jouable si elle a un énoncé, au moins deux réponses renseignées, des textes de
 * réponse distincts et au moins une bonne réponse. Renvoie le message du premier défaut.
 */
export function playableProblem(questions: readonly Pick<QuestionInput, 'text' | 'answers'>[]): string | null {
  for (const [index, question] of questions.entries()) {
    const label = `Question ${index + 1}`;
    if (!question.text.trim()) return `${label} : l’énoncé est vide.`;
    const filled = question.answers.filter((a) => a.text.trim());
    if (filled.length < 2) return `${label} : au moins deux réponses renseignées sont nécessaires.`;
    if (!filled.some((a) => a.isCorrect)) return `${label} : indiquez au moins une bonne réponse.`;
    const texts = filled.map((a) => a.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) return `${label} : deux réponses ont le même texte.`;
  }
  return null;
}

// ── Parties de Quiz ─────────────────────────────────────────────────────────
export const sessionCreateSchema = z.object({
  quizId: UUID,
  maxPlayers: z.number().int().optional().default(10),
});

export const sessionJoinSchema = z.object({
  code: gameCodeSchema,
  // « CHECK_ONLY » : le jeu d'origine vérifie ainsi l'existence du code sans créer de joueur.
  nickname: z.string({ message: 'Pseudo requis.' }).max(64, 'Pseudo invalide.'),
});

export const quizJoinSchema = z.object({
  playerId: UUID,
  playerToken,
  nickname: z.string().max(64).optional(),
});

export const quizAnswerSchema = z.object({
  playerId: UUID,
  answerId: z.string().min(1).max(64),
  playerToken,
});

export const showQuestionSchema = z.object({
  index: z.number().int('Question introuvable.').min(0, 'Question introuvable.').max(999, 'Question introuvable.'),
});

// ── Undercover ──────────────────────────────────────────────────────────────
const word = shortText(60, 'Mot');

export const undercoverConfigSchema = z.object({
  name: shortText(80, 'Nom'),
  civilWord: word,
  undercoverWord: word,
  includeMisterWhite: z.boolean().optional().default(true),
});

export const undercoverCreateSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    civilWord: word.optional(),
    undercoverWord: word.optional(),
    themeId: z.string().min(1).max(32).optional(),
    includeMisterWhite: z.boolean().optional(),
  })
  .refine((v) => (v.civilWord && v.undercoverWord) || (!v.civilWord && !v.undercoverWord && v.themeId), {
    message: 'Les mots civils et imposteur sont obligatoires (ou choisissez un thème).',
  })
  .refine((v) => !v.civilWord || !v.undercoverWord || v.civilWord.toLowerCase() !== v.undercoverWord.toLowerCase(), {
    message: 'Les deux mots doivent être différents.',
  });

export const undercoverJoinSchema = z.object({ nickname: nicknameSchema });
export const undercoverVoteSchema = z.object({ voterId: UUID, targetId: UUID, playerToken });
export const undercoverRoleSchema = z.object({ playerId: UUID, playerToken });
export const undercoverSpyGuessSchema = z.object({ spyId: UUID, playerToken, guess: shortText(60, 'Mot') });
export const undercoverNextPhaseSchema = z.object({
  action: z.enum(['start_discussion', 'next_speaker', 'start_voting'], { message: 'Action invalide' }),
});

export const idParamSchema = UUID;
