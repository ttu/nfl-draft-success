import { test, expect } from '@playwright/test';

test.describe('Team detail view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();
  });

  test('shows five-year score card with score and rank', async ({ page }) => {
    const scoreCard = page.locator('[aria-labelledby="draft-score-title"]');
    await expect(scoreCard).toBeVisible();
    await expect(scoreCard.locator('.draft-score__number')).not.toBeEmpty();
    await expect(scoreCard.locator('.draft-score__rank')).toBeVisible();
  });

  test('renders draft class cards for each year in range', async ({ page }) => {
    const cardsSection = page.locator(
      '[aria-label="Draft class metrics by year"]',
    );
    await expect(cardsSection).toBeVisible();
    const cards = cardsSection.locator(':scope > *');
    await expect(cards).toHaveCount(5);
  });

  test('shows player cards with role badges', async ({ page }) => {
    const playerCards = page.locator('.player-card');
    const count = await playerCards.count();
    expect(count).toBeGreaterThan(0);
    await expect(
      playerCards.first().locator('[data-testid="role-badge"]'),
    ).toBeVisible();
  });

  test('player cards show name, position, and pick number', async ({
    page,
  }) => {
    const firstCard = page.locator('.player-card').first();
    await expect(firstCard.locator('.player-card__name')).not.toBeEmpty();
    await expect(firstCard.locator('.player-card__meta')).toContainText('Pick');
    await expect(firstCard.locator('.player-card__draft')).toContainText('RD');
  });

  test('player name toggles career breakdown with season stats table', async ({
    page,
  }) => {
    const firstCard = page.locator('.player-card').first();
    await expect(
      firstCard.getByTestId('player-career-panel'),
    ).not.toBeVisible();
    await firstCard.getByRole('button').first().click();
    await expect(firstCard.getByTestId('player-career-panel')).toBeVisible();
    const careerTable = firstCard.locator('.player-card__career-table');
    await expect(
      careerTable.getByRole('columnheader', { name: 'Season' }),
    ).toBeVisible();
    await expect(
      careerTable.locator('thead th').filter({ hasText: 'Avg snap' }),
    ).toBeVisible();
    await expect(
      careerTable.locator('thead th').filter({ hasText: /^Load$/ }),
    ).toBeVisible();
  });

  test('back navigation returns to rankings', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).click();
    await page
      .getByRole('dialog', { name: /^menu$/i })
      .getByRole('button', { name: /^Team rankings$/i })
      .click();
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();
  });

  test('team selector dropdown changes team', async ({ page }) => {
    const selector = page.locator('[aria-label="Select team"]');
    await selector.selectOption('KC');
    await expect(page).toHaveURL(/\/KC\?/);
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();
  });

  test('roster grouped by draft year with section headers', async ({
    page,
  }) => {
    const yearHeaders = page.locator('.roster-year-section__title');
    const count = await yearHeaders.count();
    expect(count).toBeGreaterThan(0);
    const firstHeader = await yearHeaders.first().textContent();
    expect(firstHeader).toMatch(/^Draft \d{4}$/);
  });

  test('navigating to invalid team shows rankings view', async ({ page }) => {
    await page.goto('/INVALID?from=2021&to=2025');
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();
  });
});
