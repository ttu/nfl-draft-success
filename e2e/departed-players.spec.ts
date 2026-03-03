import { test, expect } from '@playwright/test';

test.describe('Departed players toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();
  });

  test('toggle is unchecked by default', async ({ page }) => {
    const toggle = page.locator('[aria-label="Show departed players"]');
    await expect(toggle).not.toBeChecked();
  });

  test('no departed player cards shown by default', async ({ page }) => {
    const departed = page.locator('.player-card--departed');
    await expect(departed).toHaveCount(0);
  });

  test('enabling toggle shows departed players with distinct styling', async ({
    page,
  }) => {
    await page.locator('[aria-label="Show departed players"]').check();
    const allCards = await page.locator('.player-card').count();
    const departedCards = await page.locator('.player-card--departed').count();
    expect(departedCards).toBeGreaterThan(0);
    expect(allCards).toBeGreaterThan(departedCards);
  });

  test('departed player cards show current team info', async ({ page }) => {
    await page.locator('[aria-label="Show departed players"]').check();
    const departedMeta = page.locator(
      '.player-card--departed .player-card__departed-team',
    );
    const count = await departedMeta.count();
    expect(count).toBeGreaterThan(0);
    const texts = await departedMeta.allTextContents();
    for (const text of texts) {
      expect(text).toMatch(/→\s*\w+/);
    }
  });
});
