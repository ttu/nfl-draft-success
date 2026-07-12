import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders rankings table with all 32 teams', async ({ page }) => {
    const section = page.locator('[aria-label="Team draft rankings"]');
    await expect(section).toBeVisible();
    const rows = section.locator('.rankings-table tbody tr');
    await expect(rows).toHaveCount(32);
  });

  test('shows masthead brand and hero headline', async ({ page }) => {
    await expect(page.locator('header.masthead')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /NFL Draft Success — home/i }),
    ).toBeVisible();
    await expect(page.locator('.page-hero__headline')).toContainText(
      /Which teams draft/i,
    );
  });

  test('default year range is 2021-2025 (5 seasons)', async ({ page }) => {
    await expect(page).toHaveURL(/from=2021/);
    await expect(page).toHaveURL(/to=2025/);
    await expect(
      page.getByText(/Draft success score · 5 seasons in window/i),
    ).toBeVisible();
  });

  test('teams are sorted by score descending', async ({ page }) => {
    const scores = page.locator('.rankings-table .score-big');
    await expect(scores).toHaveCount(32);
    const allScores = await scores.allTextContents();
    const numeric = allScores.map((s) => parseFloat(s));
    for (let i = 1; i < numeric.length; i++) {
      expect(numeric[i]).toBeLessThanOrEqual(numeric[i - 1]);
    }
  });

  test('each team row shows rank, name, and score', async ({ page }) => {
    const firstRow = page.locator('.rankings-table tbody tr').first();
    await expect(firstRow.locator('.rank-num')).toHaveText('1');
    await expect(firstRow.locator('.team-row__name')).not.toBeEmpty();
    await expect(firstRow.locator('.score-big')).not.toBeEmpty();
  });

  test('clicking a team row navigates to team detail', async ({ page }) => {
    await page.locator('.rankings-table tbody tr').first().click();
    await expect(page.locator('.team-hero')).toBeVisible();
    expect(page.url()).toMatch(/\/[A-Z]{2,3}\?/);
  });

  test('info sheet opens from the masthead Info button', async ({ page }) => {
    await page.getByRole('button', { name: /methodology/i }).click();
    await expect(
      page.getByRole('dialog', { name: /How the Index is built/i }),
    ).toBeVisible();
  });

  test('info sheet shows data last updated from data-meta', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /methodology/i }).click();
    const dialog = page.getByRole('dialog', {
      name: /How the Index is built/i,
    });
    await expect(dialog).toBeVisible();
    const lastUpdated = dialog.locator('.info-kv', { hasText: 'Last updated' });
    await expect(lastUpdated).toContainText(/\d{1,2} \w+ \d{4}/, {
      timeout: 15_000,
    });
  });

  test('masthead shows the data synced date', async ({ page }) => {
    await expect(page.locator('.mast__meta')).toContainText(
      /Data synced\s+\d{1,2} \w+ \d{4}/,
      { timeout: 15_000 },
    );
  });
});

test.describe('Landing page intro banner', () => {
  test('dismiss persists after reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.removeItem('nfl-draft-success-landing-intro-dismissed'),
    );
    await page.reload();
    await expect(page.locator('.site-intro')).toBeVisible();
    await page.locator('.site-intro__dismiss').click();
    await expect(page.locator('.site-intro')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.site-intro')).toHaveCount(0);
  });
});
