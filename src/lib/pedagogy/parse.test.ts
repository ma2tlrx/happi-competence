import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyPart, classifySequence, parseDuration, parseSessionScript } from './parse';

const support = (number: number) => readFileSync(join(process.cwd(), 'content', 'supports', `session-${number}.md`), 'utf8');

describe('durées', () => {
  it('comprend les écritures usuelles', () => {
    expect(parseDuration('10 min')).toBe(10);
    expect(parseDuration('90 minutes')).toBe(90);
    expect(parseDuration('1 h 30')).toBe(90);
    expect(parseDuration('1h30')).toBe(90);
    expect(parseDuration('3 h')).toBe(180);
    expect(parseDuration('3 h 05')).toBe(185);
    expect(parseDuration('à définir')).toBeNull();
  });
});

describe('classification', () => {
  it('reconnaît les quatre registres du formateur', () => {
    expect(classifyPart('À dire')).toBe('say');
    expect(classifyPart('Notions clés à transmettre')).toBe('say');
    expect(classifyPart('Consigne pour les participants')).toBe('do');
    expect(classifyPart('À observer')).toBe('observe');
    expect(classifyPart('À retenir')).toBe('retain');
    expect(classifyPart('Conseil au formateur')).toBe('retain');
    expect(classifyPart('Questions à poser')).toBe('questions');
    expect(classifyPart('Règles du débat')).toBe('content');
  });

  it('déduit le type de séquence du champ Type ou, à défaut, du titre', () => {
    expect(classifySequence('Pause', 'Pause')).toBe('break');
    expect(classifySequence('Apport théorique', 'Introduction à la communication')).toBe('theory');
    expect(classifySequence(null, 'Débat thématique — Questions OUI / NON')).toBe('discussion');
    expect(classifySequence(null, 'Conclusion & Mise en commun')).toBe('debrief');
    expect(classifySequence(null, 'Accueil & Présentation du programme')).toBe('intro');
  });
});

describe('supports livrés', () => {
  it('découpe la session 1 en 9 séquences chronométrées', () => {
    const script = parseSessionScript(support(1));
    expect(script.title).toBe('Session 1 — La communication');
    expect(script.sequences).toHaveLength(9);
    expect(script.totalMinutes).toBe(185);
    expect(script.info.map((section) => section.title)).toEqual(['Objectifs', 'Compétences observées']);
    expect(script.intro).toContain('Support provisoire');

    const [welcome, theory, , , debate, pause] = script.sequences;
    expect(welcome!.title).toBe('Accueil & Présentation du programme');
    expect(welcome!.type).toBe('intro');
    expect(welcome!.durationMinutes).toBe(10);
    expect(welcome!.parts.map((part) => part.kind)).toEqual(['objectives', 'content', 'retain', 'observe']);
    expect(theory!.parts[0]!.kind).toBe('say');
    expect(theory!.parts.at(-2)!.kind).toBe('do');
    expect(debate!.type).toBe('discussion');
    expect(pause!.type).toBe('break');
    // Les clés sont stables : elles identifient les notes et minuteurs du formateur.
    expect(welcome!.key).toBe('1-accueil-presentation-du-programme');
    expect(new Set(script.sequences.map((sequence) => sequence.key)).size).toBe(9);
  });

  it('analyse les six supports sans perdre de séquence', () => {
    for (let number = 1; number <= 6; number += 1) {
      const script = parseSessionScript(support(number));
      expect(script.title, `session ${number}`).toMatch(new RegExp(`^Session ${number} — `));
      expect(script.sequences.length, `session ${number}`).toBeGreaterThanOrEqual(6);
      expect(script.totalMinutes, `session ${number}`).toBeGreaterThan(0);
      for (const sequence of script.sequences) expect(sequence.durationMinutes, sequence.title).not.toBeNull();
    }
  });

  it('expose tous les types de blocs dans le gabarit de la session 6', () => {
    const script = parseSessionScript(support(6));
    const kinds = new Set(script.sequences.flatMap((sequence) => sequence.parts.map((part) => part.kind)));
    for (const kind of ['say', 'do', 'observe', 'retain', 'questions'] as const) expect(kinds.has(kind)).toBe(true);
    expect(script.sequences.map((sequence) => sequence.type)).toEqual(['intro', 'theory', 'activity', 'break', 'transition', 'debrief']);
    expect(script.sequences[0]!.objective).toBe('à renseigner');
    expect(script.sequences[2]!.skills).toEqual([]);
  });
});

describe('fichiers libres', () => {
  it('lit la durée dans le titre et conserve tableaux et mises en forme', () => {
    const script = parseSessionScript(`# Atelier test

Présentation libre.

## Brise-glace (15 min)

Texte **important**.

| Manche | Mot |
| --- | --- |
| 1 | Réunion |

### À dire

Bonjour à tous.

## Suite sans durée

Du contenu.
`);
    expect(script.sequences).toHaveLength(2);
    expect(script.sequences[0]!.title).toBe('Brise-glace');
    expect(script.sequences[0]!.durationMinutes).toBe(15);
    expect(script.sequences[0]!.parts[0]!.markdown).toContain('| Manche | Mot |');
    expect(script.sequences[0]!.parts[1]).toMatchObject({ kind: 'say', title: 'À dire', markdown: 'Bonjour à tous.' });
    expect(script.sequences[1]!.durationMinutes).toBeNull();
    expect(script.intro).toBe('Présentation libre.');
  });

  it('ne coupe pas sur un titre placé dans un bloc de code', () => {
    const script = parseSessionScript('# T\n\n## Séquence\n\n```\n## pas un titre\n```\n\nSuite.\n');
    expect(script.sequences).toHaveLength(1);
    expect(script.sequences[0]!.parts[0]!.markdown).toContain('## pas un titre');
  });

  it('accepte un en-tête YAML et un fichier sans aucune structure', () => {
    const withFrontMatter = parseSessionScript('---\ntitre: Essai\nduree: 3 h\n---\n# Session\n\n## Une séquence\n\nTexte.\n');
    expect(withFrontMatter.meta).toContainEqual({ label: 'titre', value: 'Essai' });
    const bare = parseSessionScript('Juste un paragraphe.');
    expect(bare.title).toBeNull();
    expect(bare.sequences).toEqual([]);
    expect(bare.intro).toBe('Juste un paragraphe.');
  });
});
