import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders rankings table with all 32 teams', async ({ page }) => {
    const section = page.locator('[aria-label="Team draft rankings"]');
    await expect(section).toBeVisible();
    const items = section.locator('.team-rankings-view__item');
    await expect(items).toHaveCount(32);
  });

  test('shows app title and header', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('NFL Draft Success');
    await expect(page.locator('header.app-header')).toBeVisible();
  });

  test('default year range is 2021-2025', async ({ page }) => {
    const title = page.locator('.team-rankings-view__title');
    await expect(title).toContainText(
      'Rolling draft score rankings, 5 seasons',
    );
  });

  test('teams are sorted by score descending', async ({ page }) => {
    const scores = page.locator('.team-rankings-view__score');
    const allScores = await scores.allTextContents();
    const numeric = allScores.map((s) => parseFloat(s));
    for (let i = 1; i < numeric.length; i++) {
      expect(numeric[i]).toBeLessThanOrEqual(numeric[i - 1]);
    }
  });

  test('each team row shows rank, name, and score', async ({ page }) => {
    const firstItem = page.locator('.team-rankings-view__item').first();
    await expect(firstItem.locator('.team-rankings-view__rank')).toHaveText(
      '1',
    );
    await expect(
      firstItem.locator('.team-rankings-view__name'),
    ).not.toBeEmpty();
    await expect(
      firstItem.locator('.team-rankings-view__score'),
    ).not.toBeEmpty();
  });

  test('clicking a team row navigates to team detail', async ({ page }) => {
    const firstTeam = page.locator('.team-rankings-view__item').first();
    await firstTeam.click();
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();
    expect(page.url()).toMatch(/\/[A-Z]{2,3}\?/);
  });

  test('info opens from menu About item', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).click();
    await page
      .getByRole('dialog', { name: /^menu$/i })
      .getByRole('button', { name: /^About$/ })
      .click();
    await expect(
      page.getByRole('dialog', { name: /About NFL Draft Success/i }),
    ).toBeVisible();
  });
});

test.describe('Landing page intro banner', () => {
  test('dismiss persists after reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.removeItem('nfl-draft-success-landing-intro-dismissed'),
    );
    await page.reload();
    await expect(
      page.locator('[aria-labelledby="site-intro-banner-title"]'),
    ).toBeVisible();
    await page.locator('[aria-label="Dismiss site introduction"]').click();
    await expect(
      page.locator('[aria-labelledby="site-intro-banner-title"]'),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.locator('[aria-labelledby="site-intro-banner-title"]'),
    ).toHaveCount(0);
  });
});
