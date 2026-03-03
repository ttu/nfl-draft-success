import { test, expect } from '@playwright/test';

test.describe('Role filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();
  });

  test('role filter opens and shows all roles', async ({ page }) => {
    await page.locator('[aria-label="Filter by role"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const checkboxes = dialog.locator('.role-filter__checkbox');
    await expect(checkboxes).toHaveCount(5);
  });

  test('selecting Starters preset filters to starter roles only', async ({
    page,
  }) => {
    const playerCountBefore = await page.locator('.player-card').count();

    await page.locator('[aria-label="Filter by role"]').click();
    await page.locator('.role-filter__preset', { hasText: 'Starters' }).click();
    await page.locator('[aria-label="Close"]').click();

    const playerCountAfter = await page.locator('.player-card').count();
    expect(playerCountAfter).toBeLessThanOrEqual(playerCountBefore);

    const badges = page.locator('[data-testid="role-badge"]');
    const roles = await badges.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-role')),
    );
    for (const role of roles) {
      expect(['core_starter', 'starter_when_healthy']).toContain(role);
    }
  });

  test('filter state persists after team navigation', async ({ page }) => {
    await page.locator('[aria-label="Filter by role"]').click();
    await page.locator('.role-filter__preset', { hasText: 'Starters' }).click();
    await page.locator('[aria-label="Close"]').click();

    const selector = page.locator('[aria-label="Select team"]');
    await selector.selectOption('KC');
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();

    await expect(page.locator('[aria-label="Filter by role"]')).toHaveText(
      '2 roles',
    );
  });

  test('selecting All preset shows all players', async ({ page }) => {
    await page.locator('[aria-label="Filter by role"]').click();
    await page.locator('.role-filter__preset', { hasText: 'Starters' }).click();
    await page.locator('[aria-label="Close"]').click();
    const restrictedCount = await page.locator('.player-card').count();

    await page.locator('[aria-label="Filter by role"]').click();
    await page.locator('.role-filter__preset', { hasText: 'All' }).click();
    await page.locator('[aria-label="Close"]').click();
    const allCount = await page.locator('.player-card').count();

    expect(allCount).toBeGreaterThanOrEqual(restrictedCount);
    await expect(page.locator('[aria-label="Filter by role"]')).toHaveText(
      'All roles',
    );
  });
});
