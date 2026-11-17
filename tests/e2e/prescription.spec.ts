import { expect, test } from '@playwright/test';

import { login, unique } from './helpers';

/**
 * Prescription en ligne : le conseiller oriente une personne, l'administrateur l'affecte à un groupe,
 * la personne devient participante invitée (fiche créée, invitation à créer son compte).
 * Comptes de démonstration (npm run demo:seed) ; migration 20261116100000_referrals.sql appliquée.
 */
test('un organisme oriente une personne, l’administrateur l’affecte, la personne est invitée', async ({ browser }) => {
  const id = unique();
  const firstName = 'Orientée';
  const lastName = `E2e${id}`;
  const email = `orientee.${id}@demo.happi.test`;

  // 1. Le conseiller remplit la fiche d'orientation.
  const prescriber = await browser.newPage();
  await login(prescriber, 'organisme@demo.happi.test');
  await prescriber.goto('/organisme/orientations');
  await prescriber.getByRole('link', { name: 'Orienter une personne' }).first().click();
  await expect(prescriber.getByRole('heading', { level: 1 })).toHaveText('Orienter une personne');
  await prescriber.getByLabel('Prénom').fill(firstName);
  await prescriber.getByLabel('Nom', { exact: true }).fill(lastName);
  await prescriber.getByLabel('Adresse e-mail de la personne').fill(email);
  await prescriber.getByLabel('Tranche d’âge').selectOption('18_25');
  await prescriber.getByLabel('Motif de l’orientation').fill('Souhaite reprendre confiance et travailler la prise de parole avant une formation.');
  await prescriber.getByLabel('Lundi').check();
  await prescriber.getByLabel('Matin').check();
  await prescriber.getByRole('group', { name: /besoin d’une adaptation/ }).getByLabel('Non').check();
  await prescriber.getByLabel(/J’ai informé la personne/).check();
  await prescriber.getByRole('group', { name: /photo ou filmée/ }).getByLabel('Non').check();
  await prescriber.getByRole('group', { name: /consulte ses présences/ }).getByLabel('Oui').check();
  await prescriber.getByRole('button', { name: 'Envoyer l’orientation' }).click();
  await prescriber.waitForURL(/\/organisme\/orientations\/[0-9a-f-]{36}\?envoyee=1/);
  await expect(prescriber.getByText('Orientation envoyée', { exact: true }).first()).toBeVisible();
  await expect(prescriber.getByText('Envoyée', { exact: true }).first()).toBeVisible();
  const referralUrl = prescriber.url().replace(/\?.*$/, '');

  // 2. L'administrateur la retrouve dans la file et l'affecte au groupe Horizon.
  const admin = await browser.newPage();
  await login(admin, 'admin@demo.happi.test');
  await admin.goto('/admin/orientations');
  await admin.getByRole('link', { name: `${firstName} ${lastName}` }).click();
  await admin.waitForURL(/\/admin\/orientations\/[0-9a-f-]{36}/);
  const groupSelect = admin.getByLabel('Groupe', { exact: true });
  const horizon = groupSelect.locator('option', { hasText: 'Horizon' }).first();
  await groupSelect.selectOption(await horizon.getAttribute('value') ?? '');
  await admin.getByRole('button', { name: 'Affecter au groupe' }).click();
  await expect(admin.getByText(/Personne affectée au groupe/)).toBeVisible();
  await admin.reload();
  await expect(admin.getByText('Acceptée', { exact: true }).first()).toBeVisible();

  // 3. La fiche participant est créée au statut « invité » dans le groupe.
  await admin.getByRole('link', { name: /Horizon/ }).first().click();
  await admin.waitForURL(/\/formateur\/groupes\/[0-9a-f-]{36}/);
  const memberRow = admin.getByRole('row', { name: new RegExp(lastName) });
  await expect(memberRow).toBeVisible();
  await expect(memberRow.getByText('Invité')).toBeVisible();

  // 4. Le conseiller voit l'orientation acceptée.
  await prescriber.goto(referralUrl);
  await expect(prescriber.getByText('Acceptée', { exact: true }).first()).toBeVisible();
  await expect(prescriber.getByText('Personne inscrite dans un groupe')).toBeVisible();

  await prescriber.close();
  await admin.close();
});

test('un participant n’accède pas aux orientations', async ({ page }) => {
  await login(page, 'participant@demo.happi.test');
  await page.goto('/organisme/orientations');
  await expect(page).not.toHaveURL(/\/organisme\//);
  await page.goto('/participant/consentements');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes consentements');
});
