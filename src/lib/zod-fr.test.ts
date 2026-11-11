import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import './zod-fr';

describe('messages de validation', () => {
  it('sont en français clair', () => {
    expect(z.string().max(80).safeParse('x'.repeat(81)).error?.issues[0]?.message).toBe('Ce champ est trop long (80 caractères au plus).');
    expect(z.string().min(2).safeParse('a').error?.issues[0]?.message).toBe('Au moins 2 caractères.');
    expect(z.coerce.number().int().min(1).max(24).safeParse('30').error?.issues[0]?.message).toBe('La valeur doit être inférieure ou égale à 24.');
    expect(z.string().email().safeParse('nope').error?.issues[0]?.message).toBe('Adresse e-mail invalide.');
  });

  it('laissent la priorité aux messages des schémas', () => {
    expect(z.string().min(1, 'Indiquez votre prénom.').safeParse('').error?.issues[0]?.message).toBe('Indiquez votre prénom.');
  });
});
