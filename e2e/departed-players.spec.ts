import { test, expect } from '@playwright/test';

test.describe('Departed players toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('.team-hero')).toBeVisible();
  });

  test('toggle is unchecked by default', async ({ page }) => {
    const toggle = page.locator('[aria-label="Show departed players"]');
    await expect(toggle).not.toBeChecked();
  });

  test('no departed player rows shown by default', async ({ page }) => {
    await expect(page.locator('.roster-table .role-chip.gone')).toHaveCount(0);
  });

  test('enabling the toggle reveals departed players', async ({ page }) => {
    const totalBefore = await page.locator('.roster-table tbody tr').count();

    await page.locator('[aria-label="Show departed players"]').check();

    const departedRows = page.locator('.roster-table tbody tr', {
      has: page.locator('.role-chip.gone'),
    });
    expect(await departedRows.count()).toBeGreaterThan(0);

    const totalAfter = await page.locator('.roster-table tbody tr').count();
    expect(totalAfter).toBeGreaterThan(totalBefore);
  });

  test('departed player rows show the current team', async ({ page }) => {
    await page.locator('[aria-label="Show departed players"]').check();
    const departedRows = page.locator('.roster-table tbody tr', {
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
