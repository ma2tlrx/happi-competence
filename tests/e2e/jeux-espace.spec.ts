import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { login, signInWith } from './helpers';

/** « Jeux » garde l'espace dans lequel on se trouve : un administrateur qui consulte l'espace formateur n'est pas renvoyé dans le sien. */
function env() {
  const values: Record<string, string> = {};
  for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const index = line.indexOf('=');
    if (index > 0 && !line.startsWith('#')) values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

test('depuis l’espace formateur, « Jeux » reste dans l’espace formateur (formateur, puis administrateur en visite)', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'formateur@demo.happi.test');
  await page.goto('/formateur/dashboard');
  await page.getByRole('navigation').getByRole('link', { name: 'Jeux' }).first().click();
  await expect(page).toHaveURL(/\/jeux$/);
  await expect(page.getByText('Espace formateur').first()).toBeVisible();

  const values = env();
  const service = createClient(values.NEXT_PUBLIC_SUPABASE_URL!, values.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `admin.jeux.${randomBytes(4).toString('hex')}@happi-test.fr`;
  const password = `Mdp-${randomBytes(8).toString('hex')}-A1`;
  const { data: created } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'Jeux', last_name: 'Admin', account_type: 'participant' } });
  const id = created.user!.id;
  try {
    await service.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', id);
    await page.context().clearCookies();
    await signInWith(page, email, password);
    await page.goto('/formateur/dashboard');
    await page.getByRole('navigation').getByRole('link', { name: 'Jeux' }).first().click();
    await expect(page).toHaveURL(/\/jeux$/);
    await expect(page.getByText('Espace formateur').first()).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('href', '/formateur/dashboard');
    // Depuis l'espace administrateur, « Jeux » reste dans l'espace administrateur.
    await page.goto('/admin/dashboard');
    await page.getByRole('navigation').getByRole('link', { name: 'Jeux' }).first().click();
    await expect(page.getByText('Administration', { exact: true }).first()).toBeVisible();
  } finally {
    await service.auth.admin.deleteUser(id);
  }
});
