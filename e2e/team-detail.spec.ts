import { test, expect } from '@playwright/test';

test.describe('Team detail view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await expect(page.locator('.team-hero')).toBeVisible();
  });

  test('shows team hero with score and league rank', async ({ page }) => {
    const hero = page.locator('.team-hero');
    await expect(hero.locator('.team-hero__abbrev')).toHaveText('DET');
    await expect(hero.locator('.team-hero__score')).not.toBeEmpty();
    await expect(hero.getByText('League Rank')).toBeVisible();
  });

  test('renders draft class cards for each year in range', async ({ page }) => {
    const cards = page.locator('.class-grid .class-card');
    await expect(cards).toHaveCount(5);
    await expect(cards.first().locator('.class-card__year')).toHaveText('2021');
  });

  test('shows roster player rows with role chips', async ({ page }) => {
    const rows = page.locator('.roster-table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(rows.first().locator('.role-chip')).toBeVisible();
  });

  test('player rows show name, position, and pick number', async ({ page }) => {
    const firstRow = page.locator('.roster-table tbody tr').first();
    await expect(firstRow.locator('.pos-chip')).not.toBeEmpty();
    await expect(firstRow.locator('.pick-tag')).toContainText(/R\d+·\d+/);
    // The player name cell is the flexible column between pos-chip and role.
    await expect(firstRow.locator('td').nth(3)).not.toBeEmpty();
  });

  test('clicking a player row opens the player detail view', async ({
    page,
  }) => {
    await page.locator('.roster-table tbody tr').first().click();
    await expect(page.locator('.player-view')).toBeVisible();
    await expect(page.locator('.player-hero__name')).not.toBeEmpty();
    const careerTable = page.locator('.player-career table');
    await expect(
      careerTable.getByRole('columnheader', { name: 'Season' }),
    ).toBeVisible();
    await expect(
      careerTable.getByRole('columnheader', { name: 'Avg snap' }),
    ).toBeVisible();
    await expect(
      careerTable.getByRole('columnheader', { name: /^Load$/ }),
    ).toBeVisible();
  });

  test('back crumb returns to rankings', async ({ page }) => {
    await page.locator('.subbar__crumb', { hasText: 'Rankings' }).click();
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();
  });

  test('navigating via rankings changes the team', async ({ page }) => {
    await page.locator('.subbar__crumb', { hasText: 'Rankings' }).click();
    const kcRow = page.locator('.rankings-table tbody tr', {
      has: page.locator('.team-row__id', { hasText: /^KC$/ }),
    });
    await kcRow.click();
    await expect(page).toHaveURL(/\/KC\?/);
    await expect(page.locator('.team-hero__abbrev')).toHaveText('KC');
  });

  test('roster grouped by draft year with section headers', async ({
    page,
  }) => {
    const yearHeaders = page.locator('.roster-year__title');
    expect(await yearHeaders.count()).toBeGreaterThan(0);
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
