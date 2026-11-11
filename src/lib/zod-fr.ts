import { z } from 'zod';

/**
 * Messages de validation en français clair, pour les règles qui n'ont pas de message
 * explicite dans les schémas. Les messages écrits dans les schémas restent prioritaires.
 */
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'too_big':
        if (issue.origin === 'string') return `Ce champ est trop long (${issue.maximum} caractères au plus).`;
        if (issue.origin === 'number') return `La valeur doit être inférieure ou égale à ${issue.maximum}.`;
        if (issue.origin === 'array') return `Pas plus de ${issue.maximum} éléments.`;
        return 'Valeur trop grande.';
      case 'too_small':
        if (issue.origin === 'string') return Number(issue.minimum) <= 1 ? 'Ce champ est obligatoire.' : `Au moins ${issue.minimum} caractères.`;
        if (issue.origin === 'number') return `La valeur doit être supérieure ou égale à ${issue.minimum}.`;
        if (issue.origin === 'array') return `Au moins ${issue.minimum} élément(s).`;
        return 'Valeur trop petite.';
      case 'invalid_type':
        return issue.input === undefined || issue.input === null || issue.input === '' ? 'Ce champ est obligatoire.' : 'Valeur invalide.';
      case 'invalid_format':
        if (issue.format === 'email') return 'Adresse e-mail invalide.';
        if (issue.format === 'url') return 'Adresse web invalide.';
        return 'Format invalide.';
      case 'invalid_value':
        return 'Valeur non autorisée.';
      default:
        return undefined;
    }
  },
});

export {};
