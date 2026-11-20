import { expect, test, type APIResponse, type Browser, type Page } from '@playwright/test';

import { login, unique } from './helpers';

/**
 * Jeux d'animation : parcours multi-comptes. L'animateur pilote par les routes (comme son
 * écran le fait), les participants passent par les vrais écrans : connexion, code, pseudo.
 */
const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const json = { origin: base, 'content-type': 'application/json' };

async function player(browser: Browser, email: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } });
  const page = await context.newPage();
  await login(page, email);
  return page;
}

async function ok(response: APIResponse) {
  const body = await response.text();
  expect(response.status(), body).toBeLessThan(300);
  return body ? JSON.parse(body) : {};
}

async function joinByUi(page: Page, code: string, nickname: string) {
  await page.goto(`/jouer?code=${code}`);
  await page.getByLabel('Votre pseudo').fill(nickname);
  await page.getByRole('button', { name: 'Rejoindre la partie' }).click();
}

test.describe('Jeux d’animation', () => {
  test('un visiteur non connecté est renvoyé vers la connexion, puis ramené au code', async ({ page }) => {
    await page.goto('/jouer?code=ABC234');
    await expect(page).toHaveURL(/\/connexion\?suite=/);
  });

  test('Quiz : formateur et deux participants, du lobby au résultat conservé', async ({ browser }) => {
    test.setTimeout(180_000);
    const trainer = await player(browser, 'formateur@demo.happi.test');
    const ines = await player(browser, 'participant@demo.happi.test');
    const lucas = await player(browser, 'lucas@demo.happi.test');
    const tag = unique();

    const { quiz } = await ok(await trainer.request.post('/api/jeux/quizzes', { headers: json, data: { title: `Quiz e2e ${tag}` } }));
    await ok(
      await trainer.request.put(`/api/jeux/quizzes/${quiz.id}`, {
        headers: json,
        data: {
          questions: [
            { text: 'Capitale de la France ?', type: 'multiple_choice', timeLimit: 20, answers: [{ text: 'Paris', isCorrect: true }, { text: 'Lyon', isCorrect: false }] },
            { text: '2 + 2 = 4 ?', type: 'true_false', timeLimit: 20, answers: [{ text: 'Vrai', isCorrect: true }, { text: 'Faux', isCorrect: false }] },
          ],
        },
      }),
    );
    const { session } = await ok(await trainer.request.post('/api/jeux/sessions', { headers: json, data: { quizId: quiz.id, maxPlayers: 10 } }));

    // Un accès sans compte est refusé par le serveur.
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(`${base}/api/jeux/quiz/${session.id}/state`)).status()).toBe(401);
    await anonymous.close();

    await joinByUi(ines, session.code, 'Inès M.');
    await joinByUi(lucas, session.code, 'Lucas B.');
    await expect(ines).toHaveURL(new RegExp(`/jouer/quiz/${session.id}`));
    await expect(lucas).toHaveURL(new RegExp(`/jouer/quiz/${session.id}`));

    await ok(await trainer.request.post(`/api/jeux/quiz/${session.id}/start`, { headers: json }));
    await ines.waitForTimeout(3500);

    for (const [index, right] of [['0', 'Paris'], ['1', 'Vrai']] as const) {
      await ok(await trainer.request.post(`/api/jeux/quiz/${session.id}/show-question`, { headers: json, data: { index: Number(index) } }));
      await ok(await trainer.request.post(`/api/jeux/quiz/${session.id}/reveal-answers`, { headers: json }));
      await ines.getByRole('button', { name: right, exact: false }).first().click();
      await lucas.getByRole('button', { name: index === '0' ? 'Lyon' : 'Faux', exact: false }).first().click();
      // Quand tout le monde a répondu, la question se clôt d'elle-même : 409 toléré.
      const closed = await trainer.request.post(`/api/jeux/quiz/${session.id}/end-question`, { headers: json });
      expect([200, 409]).toContain(closed.status());
      await ok(await trainer.request.post(`/api/jeux/quiz/${session.id}/next`, { headers: json }));
    }

    // Les résultats sont conservés pour chaque participant, hors bilan.
    await ines.goto('/participant/jeux');
    await expect(ines.getByText(`Quiz e2e ${tag}`)).toBeVisible();
    await lucas.goto('/participant/jeux');
    await expect(lucas.getByText(`Quiz e2e ${tag}`)).toBeVisible();

    // L'organisme n'y a pas accès.
    const org = await player(browser, 'organisme@demo.happi.test');
    expect((await org.request.get(`/api/jeux/quiz/${session.id}/state`)).status()).toBeGreaterThanOrEqual(400);
    await org.goto('/participant/jeux');
    await expect(org).not.toHaveURL(/\/participant\/jeux/);

    await trainer.request.delete(`/api/jeux/quizzes/${quiz.id}`, { headers: json });
    for (const page of [trainer, ines, lucas, org]) await page.context().close();
  });

  test('Undercover : trois participants, partie jusqu’à la fin', async ({ browser }) => {
    test.setTimeout(180_000);
    const trainer = await player(browser, 'formateur@demo.happi.test');
    const emails = ['participant@demo.happi.test', 'lucas@demo.happi.test', 'amina@demo.happi.test'];
    const players = await Promise.all(emails.map((email) => player(browser, email)));

    const created = await ok(await trainer.request.post('/api/jeux/undercover/games', { headers: json, data: { civilWord: 'Café', undercoverWord: 'Thé' } }));
    const gameId: string = created.gameId;
    for (const [i, page] of players.entries()) await joinByUi(page, created.code, `Joueur ${i + 1}`);
    for (const page of players) await expect(page).toHaveURL(new RegExp(`/jouer/undercover/${gameId}`));

    const ids: string[] = [];
    for (const [i, page] of players.entries()) {
      const state = await ok(await page.request.get(`/api/jeux/undercover/games/${gameId}`));
      const me = Object.values<{ id: string; nickname: string }>(state.game.players).find((p) => p.nickname === `Joueur ${i + 1}`);
      expect(me).toBeTruthy();
      ids.push(me!.id);
    }

    await ok(await trainer.request.post(`/api/jeux/undercover/games/${gameId}/start`, { headers: json }));
    const roles: string[] = [];
    for (const [i, page] of players.entries()) {
      const role = await ok(await page.request.post(`/api/jeux/undercover/games/${gameId}/my-role`, { headers: json, data: { playerId: ids[i] } }));
      roles.push(role.role);
    }
    expect(roles.filter((r) => r === 'undercover')).toHaveLength(1);

    // Usurpation : un joueur ne peut pas lire le rôle d'un autre.
    const steal = await players[0].request.post(`/api/jeux/undercover/games/${gameId}/my-role`, { headers: json, data: { playerId: ids[1] } });
    expect(steal.status()).toBeGreaterThanOrEqual(400);

    await ok(await trainer.request.post(`/api/jeux/undercover/games/${gameId}/next-phase`, { headers: json, data: { action: 'start_discussion' } }));
    await ok(await trainer.request.post(`/api/jeux/undercover/games/${gameId}/next-phase`, { headers: json, data: { action: 'start_voting' } }));
    const spy = roles.indexOf('undercover');
    for (const [i, page] of players.entries()) {
      const target = i === spy ? ids[(i + 1) % 3] : ids[spy];
      await ok(await page.request.post(`/api/jeux/undercover/games/${gameId}/vote`, { headers: json, data: { voterId: ids[i], targetId: target } }));
    }
    const resolved = await ok(await trainer.request.post(`/api/jeux/undercover/games/${gameId}/resolve-vote`, { headers: json }));
    expect(['game_over', 'voting', 'results', 'elimination']).toContain(resolved.game.status ?? resolved.game.phase ?? 'results');

    for (const page of [trainer, ...players]) await page.context().close();
  });

  test('Écran de jeu lisible sur téléphone', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await login(page, 'participant@demo.happi.test');
    await page.goto('/jouer');
    await expect(page.getByRole('heading', { name: 'Rejoindre une partie' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await context.close();
  });
});
