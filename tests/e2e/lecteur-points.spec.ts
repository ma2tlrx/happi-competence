import { expect, test } from '@playwright/test';

import { createE2eFixture, destroyE2eFixture, service } from './fixtures';
import { signInWith } from './helpers';

const shots = process.env.E2E_SHOTS_DIR;

// Points en direct : « + » horodatés pendant l'animation, repère affiché ensuite dans l'évaluation (aide-mémoire, sans note).
test('le formateur note des « + » en direct, les annule, puis retrouve leur repère dans l’évaluation', async ({ page }) => {
  const f = await createE2eFixture();
  try {
    await signInWith(page, f.trainer.email, f.trainer.password);
    await page.goto(`/formateur/sessions/${f.sessionToday}/lecteur`);
    await expect(page.locator('#lecteur-contenu h1')).toBeVisible();

    // Chronomètre de session lancé et passage au premier bloc : le repère porte le bloc et les minutes.
    await page.getByRole('button', { name: 'Démarrer le chronomètre de session' }).click();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: /Points en direct/ }).first().click();
    const panel = page.getByRole('complementary', { name: 'Points en direct' });
    await expect(panel).toBeVisible();
    // Les trois présents sont proposés, avec prénom et initiale du nom.
    await expect(panel.getByRole('button', { name: /Ajouter un plus à Apprenante J\./ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Ajouter un plus à Signataire T\./ })).toBeVisible();

    // Un appui = un « + » immédiat ; le sélecteur de compétence est facultatif.
    const learner = panel.getByRole('button', { name: /Ajouter un plus à Apprenante J\./ });
    await learner.click();
    await expect(learner).toContainText('1');
    const picker = panel.getByRole('group', { name: /Compétence pour le point de Apprenante J\./ });
    await expect(picker).toBeVisible();
    await picker.getByRole('button').nth(1).click(); // première compétence (la 0 est « Général »)
    await expect(picker).toBeHidden();

    // Second « + » général, laissé sans choix : le sélecteur se referme seul au bout de 4 s.
    await learner.click();
    await expect(learner).toContainText('2');
    if (shots) await page.screenshot({ path: `${shots}/lecteur-points-bureau.png` });
    await expect(picker).toBeHidden({ timeout: 6000 });

    // Annulation du dernier.
    await panel.getByRole('button', { name: /Annuler le dernier point/ }).click();
    await expect(learner).toContainText('1');
    await expect(panel.getByText('Tous les points sont enregistrés.')).toBeVisible({ timeout: 8000 });

    // En base : un seul « + », rattaché à une compétence, avec bloc et minutes ; aucune note créée.
    const fetchRows = async () => (await service.from('session_live_marks').select('participant_id, skill_code, block_index, block_title, elapsed_seconds').eq('session_id', f.sessionToday)).data ?? [];
    // L'annulation d'un point déjà envoyé part en arrière-plan : on attend qu'elle soit effective.
    await expect.poll(async () => (await fetchRows()).length).toBe(1);
    const rows = await fetchRows();
    expect(rows![0]!.participant_id).toBe(f.participants.learner);
    expect(rows![0]!.skill_code).toMatch(/^[a-z0-9_]+$/);
    expect(rows![0]!.block_index).toBe(0);
    expect(rows![0]!.block_title).toBeTruthy();
    expect(rows![0]!.elapsed_seconds).not.toBeNull();
    const { count } = await service.from('evaluations').select('id', { count: 'exact', head: true }).eq('session_id', f.sessionToday);
    expect(count).toBe(0);

    // Version téléphone du panneau.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    if (shots) await page.screenshot({ path: `${shots}/lecteur-points-telephone.png` });
    await page.setViewportSize({ width: 1280, height: 800 });

    // Évaluation : le repère s'affiche en lecture seule, sans remplir de note.
    await page.goto(`/formateur/sessions/${f.sessionToday}/evaluations?participant=${f.participants.learner}`);
    const hints = page.getByTestId('live-marks-hints');
    await expect(hints).toBeVisible();
    await hints.getByRole('button', { name: /Points en direct pour Apprenante/ }).click();
    await expect(hints).toContainText(/pendant «.+» \(bloc 1\)/);
    await expect(hints).toContainText(/à \d+ min/);
    await expect(page.getByTestId('skill-mark-hint').first()).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/evaluation-points-bureau.png`, fullPage: false });
    await expect(page.getByText('0/', { exact: false }).first()).toBeVisible();

    // Masquer / ignorer : disparaît de l'aide sans toucher à la base.
    await hints.getByRole('button', { name: /Masquer ce point/ }).click();
    await expect(page.getByTestId('skill-mark-hint')).toHaveCount(0);
    await expect(hints.getByText('Tous les points sont masqués.')).toBeVisible();
    await hints.getByRole('button', { name: /Afficher les 1 masqué/ }).click();
    await expect(page.getByTestId('skill-mark-hint').first()).toBeVisible();
    const after = await service.from('session_live_marks').select('id', { count: 'exact', head: true }).eq('session_id', f.sessionToday);
    expect(after.count).toBe(1);
  } finally {
    await destroyE2eFixture(f);
  }
});
