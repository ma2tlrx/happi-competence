import { expect, test } from '@playwright/test';

import { createE2eFixture, destroyE2eFixture, type E2eFixture } from './fixtures';
import { signInWith } from './helpers';

/**
 * Abandon déclaré par le formateur, visible dans « Suivis à faire », puis saisie de la
 * situation de sortie (qui passe dans « Renseignés »). Jeu de données propre.
 */
let f: E2eFixture;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  f = await createE2eFixture();
});
test.afterAll(async () => {
  await destroyE2eFixture(f);
});

test('un abandon déclaré apparaît dans les suivis, puis la situation de sortie est saisie', async ({ page }) => {
  const leaver = `Partant Abandon${f.tag}`;
  const listed = `ABANDON${f.tag.toUpperCase()} Partant`;
  await signInWith(page, f.trainer.email, f.trainer.password);

  // Déclaration de l'abandon depuis la fiche du groupe.
  await page.goto(`/formateur/groupes/${f.groupToday}`);
  await page.getByRole('button', { name: `Déclarer l’abandon de ${leaver}` }).click();
  const dialog = page.getByRole('dialog', { name: `Déclarer l’abandon de ${leaver}` });
  await expect(dialog).toBeVisible();
  // Motif obligatoire : refus tant qu'il manque.
  await dialog.getByRole('button', { name: 'Déclarer l’abandon' }).click();
  await expect(dialog.getByText('Choisissez un motif.')).toBeVisible();
  await dialog.getByLabel('Motif').selectOption({ label: 'Emploi trouvé' });
  await dialog.getByLabel('Précisions').fill('CDI dans la logistique.');
  await dialog.getByRole('button', { name: 'Déclarer l’abandon' }).click();
  await expect(page.getByText(`Abandon de ${leaver} enregistré.`)).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: `Modifier l’abandon de ${leaver}` })).toBeVisible();

  // L'abandon ouvre un suivi « Sortie » à faire.
  await page.goto('/formateur/suivis');
  const due = page.getByRole('region', { name: 'Suivis : À faire' });
  const row = due.getByRole('row').filter({ hasText: listed }).filter({ hasText: 'Sortie' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('abandon');
  await expect(row).toContainText('Non renseigné');

  // Saisie de la situation de sortie.
  await row.getByRole('button', { name: `Saisir la situation (sortie) de ${listed}` }).click();
  const outcome = page.getByRole('dialog', { name: `Sortie · ${listed}` });
  await outcome.getByLabel('Situation').selectOption({ label: 'Emploi durable (CDI, CDD de 6 mois ou plus)' });
  await outcome.getByLabel('Précisions').fill('Préparateur de commandes, CDI.');
  await outcome.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(outcome).toBeHidden();

  await page.reload();
  await expect(page.getByRole('region', { name: 'Suivis : À faire' }).getByRole('row').filter({ hasText: listed }).filter({ hasText: 'Sortie' })).toHaveCount(0);
  const done = page.getByRole('heading', { name: /^Renseignés \(\d+\)$/ });
  await expect(done).toBeVisible();
  await page.getByText('Afficher la liste').last().click();
  const saved = page.getByRole('region', { name: 'Suivis : Renseignés' }).getByRole('row').filter({ hasText: listed });
  await expect(saved).toContainText('Emploi durable');
});
