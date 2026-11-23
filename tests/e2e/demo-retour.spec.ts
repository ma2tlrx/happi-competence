import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { signInWith } from './helpers';

/**
 * « Quitter la démonstration » : un administrateur qui a ouvert un espace de démonstration retrouve son tableau de bord
 * administrateur ; sans cette ouverture, la sortie ferme la session. Compte administrateur réel créé pour le test.
 */
function env() {
  const values: Record<string, string> = {};
  for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const index = line.indexOf('=');
    if (index > 0 && !line.startsWith('#')) values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

test('un administrateur quitte la démonstration et retrouve son tableau de bord', async ({ page }) => {
  test.setTimeout(120_000);
  const values = env();
  expect(values.NEXT_PUBLIC_SUPABASE_URL).toMatch(/localhost|127\.0\.0\.1/);
  const service = createClient(values.NEXT_PUBLIC_SUPABASE_URL!, values.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `admin.retour.${randomBytes(4).toString('hex')}@happi-test.fr`;
  const password = `Mdp-${randomBytes(8).toString('hex')}-A1`;
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'Retour', last_name: 'Admin', account_type: 'participant' } });
  expect(error).toBeNull();
  const id = created.user!.id;
  try {
    await service.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', id);
    await signInWith(page, email, password);
    await page.goto('/admin/demonstration');
    await page.getByRole('button', { name: /Ouvrir l’espace formateur/ }).click();
    await expect(page).toHaveURL(/\/formateur\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText('Compte de démonstration')).toBeVisible();
    await page.getByRole('button', { name: 'Quitter la démonstration' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText('Compte de démonstration')).toHaveCount(0);
  } finally {
    await service.auth.admin.deleteUser(id);
  }
});
