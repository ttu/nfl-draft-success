import { test, expect } from '@playwright/test';

test.describe('Departed players toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('.team-hero')).toBeVisible();
  });

  test('toggle is checked by default', async ({ page }) => {
    const toggle = page.locator('[aria-label="Show departed players"]');
    await expect(toggle).toBeChecked();
  });

  test('departed player rows are shown by default', async ({ page }) => {
    await expect(
      page.locator('#team-roster .roster-table .role-chip.gone').first(),
    ).toBeVisible();
  });

  test('disabling the toggle hides departed players', async ({ page }) => {
    const totalBefore = await page
      .locator('#team-roster .roster-table tbody tr')
      .count();

    await page.locator('[aria-label="Show departed players"]').uncheck();

    await expect(
      page.locator('#team-roster .roster-table .role-chip.gone'),
    ).toHaveCount(0);

    const totalAfter = await page
      .locator('#team-roster .roster-table tbody tr')
      .count();
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  test('departed player rows show the current team', async ({ page }) => {
    const departedRows = page.locator('#team-roster .roster-table tbody tr', {
      has: page.locator('.role-chip.gone'),
    });
    const count = await departedRows.count();
    expect(count).toBeGreaterThan(0);
    // A departed player only shows a "→ TEAM" marker when they landed on a new
    // roster; players out of the league show none. At least one should have it.
    const texts = await departedRows.allTextContents();
    expect(texts.some((t) => /→\s*\w+/.test(t))).toBe(true);
  });
});
