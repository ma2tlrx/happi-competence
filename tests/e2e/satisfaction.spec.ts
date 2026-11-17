import { expect, test, type Page } from '@playwright/test';

import { createE2eFixture, destroyE2eFixture, service, type E2eFixture } from './fixtures';
import { signInWith } from './helpers';

/**
 * Satisfaction « à chaud » : le participant d'un groupe terminé répond une fois, puis ne peut
 * plus répondre ; sa réponse est enregistrée. Jeu de données propre (groupe terminé il y a 5 jours).
 */
let f: E2eFixture;
test.beforeAll(async () => {
  f = await createE2eFixture();
});
test.afterAll(async () => {
  await destroyE2eFixture(f);
});

const answerLink = (page: Page) => page.locator('a[href*="/participant/satisfaction?groupe="]', { hasText: 'Répondre' });

test('le participant d’un groupe terminé donne son avis à chaud, une seule fois', async ({ page }) => {
  await signInWith(page, f.graduate.email, f.graduate.password);
  // L'invitation figure sur le tableau de bord.
  await page.goto('/participant/dashboard');
  await expect(answerLink(page)).toBeVisible();

  await page.goto('/participant/satisfaction');
  await answerLink(page).click();
  await expect(page).toHaveURL(new RegExp(`groupe=${f.groupDone}&moment=hot`));
  const submit = page.getByRole('button', { name: 'Envoyer mon avis' });
  await expect(submit).toBeDisabled();

  // Réponse à chaque question : la dernière option des échelles et choix, un texte libre sinon.
  const questions = page.locator('form fieldset');
  const count = await questions.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const question = questions.nth(index);
    if ((await question.getByRole('radio').count()) > 0) await question.locator('label').last().click();
    else await question.getByRole('textbox').fill('Des séances vivantes, merci.');
  }
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText('Merci pour votre réponse')).toBeVisible();
  await expect(page.getByText('Déjà répondu')).toBeVisible();
  await expect(answerLink(page)).toHaveCount(0);

  // Le lien direct ne rouvre pas le formulaire.
  await page.goto(`/participant/satisfaction?groupe=${f.groupDone}&moment=hot`);
  await expect(page.getByText('Vous avez déjà répondu à cette enquête')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Envoyer mon avis' })).toHaveCount(0);

  const { data } = await service.from('satisfaction_responses').select('id, moment').eq('group_id', f.groupDone);
  expect(data).toHaveLength(1);
  expect(data![0]!.moment).toBe('hot');
});
