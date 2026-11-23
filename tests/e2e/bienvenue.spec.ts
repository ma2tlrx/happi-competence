import { expect, test, type Page } from '@playwright/test';

import { createE2eFixture, destroyE2eFixture, service, type E2eFixture } from './fixtures';
import { signInWith } from './helpers';

/**
 * Questionnaire d'accueil (« Formulaire HaPPi » repris de l'ancien outil) : six étapes, la sixième étant
 * l'auto-évaluation. Jeu de données neuf : la personne n'a encore rien rempli.
 */
let f: E2eFixture;

test.beforeAll(async () => {
  f = await createE2eFixture();
});

test.afterAll(async () => {
  await destroyE2eFixture(f);
});

const next = (page: Page) => page.getByRole('button', { name: /^Suivant/ }).click();

test('le participant remplit les cinq étapes puis arrive sur son auto-évaluation (étape 6)', async ({ page }) => {
  await signInWith(page, f.learner.email, f.learner.password);
  await page.goto('/participant/dashboard');
  await expect(page.getByRole('heading', { name: 'Faisons connaissance' })).toBeVisible();
  await page.getByRole('link', { name: 'Commencer' }).click();
  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.waitForLoadState('networkidle');

  // Étape 1 : rien de rempli, les questions obligatoires sont signalées.
  await expect(page.getByText('Étape 1 sur 6')).toBeVisible();
  // Même coque que l'auto-évaluation : menu participant, barre de progression collante, cartes pleine largeur (pas de colonne étroite).
  await expect(page.getByRole('navigation', { name: 'Mon passeport' })).toBeAttached();
  await expect(page.getByText('Réponses enregistrées à chaque étape')).toBeVisible();
  const card = page.locator('fieldset').first();
  const box = (await card.boundingBox())!;
  expect(box.width).toBeGreaterThan(640);
  // Cibles tactiles des choix : 44 px au moins.
  const choice = page.getByText('18 - 21 ans');
  expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await next(page);
  await expect(page.getByText('Indique ton âge.')).toBeVisible();
  // Le focus va sur la première question à corriger.
  await expect(page.locator('input[name=age_band]').first()).toBeFocused();
  await page.getByText('18 - 21 ans').click();
  await page.getByText('Demandeur(se) d’emploi').click();
  await page.getByText('Autre ville').click();
  await page.getByLabel('Précise ta ville / ton village').fill('Sérignan');
  await page.getByLabel('Ton numéro de téléphone').fill('06 12 34 56 78');
  await next(page);

  // Étape 2
  await expect(page.getByRole('heading', { name: 'Parcours académique' })).toBeVisible();
  await page.getByText('Bac professionnel').click();
  await page.getByLabel('Dans quel domaine as-tu étudié ?').fill('Cuisine');
  await next(page);

  // Étape 3 : les précisions n'apparaissent qu'avec la bonne réponse.
  await expect(page.getByRole('heading', { name: 'Bénévolat & expériences' })).toBeVisible();
  await page.getByText('Oui, ponctuellement').click();
  await page.getByText('Sport / Loisirs').click();
  await page.getByText('Oui, dans un autre domaine').click();
  await page.getByLabel('Décris brièvement ton expérience').fill('Serveur, 6 mois');
  await next(page);

  // Étape 4
  await expect(page.getByRole('heading', { name: 'Ambitions professionnelles' })).toBeVisible();
  await page.getByText('Hôtellerie & restauration').click();
  await page.getByText('Être en emploi dans mon domaine cible').click();
  await next(page);

  // Étape 5 (facultative) puis l'auto-évaluation.
  await expect(page.getByRole('heading', { name: 'Aptitudes personnelles' })).toBeVisible();
  await page.getByLabel('Ponctualité : 4 sur 5').check({ force: true });
  await page.getByRole('button', { name: 'Suivant : mon auto-évaluation' }).click();
  await expect(page).toHaveURL(/\/participant\/auto-evaluation\?bienvenue=1&etape=6/);
  await expect(page.getByText('Étape 6 sur 6 · Auto-évaluation des compétences')).toBeVisible();

  const { data: intake } = await service.from('participant_intakes').select('*').eq('participant_id', f.participants.learner).single();
  expect(intake).toMatchObject({
    age_band: '18_21',
    situation: 'demandeur_emploi',
    residence: 'autre_ville',
    residence_detail: 'Sérignan',
    study_level: 'bac_pro',
    study_field: 'Cuisine',
    volunteering: 'ponctuel',
    volunteering_fields: ['sport_loisirs'],
    experience: 'autre_domaine',
    experience_detail: 'Serveur, 6 mois',
    sectors: ['hotellerie_restauration'],
    two_year_plan: 'emploi',
    aptitude_punctuality: 4,
    last_step: 5,
  });
  expect(intake?.completed_at).not.toBeNull();
  const { data: participant } = await service.from('participants').select('phone').eq('id', f.participants.learner).single();
  expect(participant?.phone).toBe('06 12 34 56 78');

  // Le profil montre les réponses, modifiables ; l'accueil ne propose plus le questionnaire.
  await page.goto('/participant/profil');
  await expect(page.getByText('Sérignan')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Modifier mes réponses' })).toHaveAttribute('href', '/bienvenue?modifier=1');
  await page.goto('/participant/dashboard');
  await expect(page.getByRole('heading', { name: 'Faisons connaissance' })).toHaveCount(0);
});
