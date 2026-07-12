import { test, expect } from '@playwright/test';

test.describe('Role filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('.team-hero')).toBeVisible();
  });

  test('renders all six role pills, enabled by default', async ({ page }) => {
    const group = page.locator('[aria-label="Filter by role"]');
    await expect(group).toBeVisible();
    const pills = group.locator('.role-pill');
    await expect(pills).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await expect(pills.nth(i)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('toggling a role off removes those player rows', async ({ page }) => {
    const coreChips = page.locator('.roster-table .role-chip', {
      hasText: /^Core Starter$/,
    });
    const coreCountBefore = await coreChips.count();
    expect(coreCountBefore).toBeGreaterThan(0);

    const totalBefore = await page.locator('.roster-table tbody tr').count();

    const corePill = page
      .locator('.role-pill')
      .filter({ hasText: /^Core Starter$/ });
    await corePill.click();
    await expect(corePill).toHaveAttribute('aria-pressed', 'false');

    await expect(coreChips).toHaveCount(0);
    const totalAfter = await page.locator('.roster-table tbody tr').count();
    expect(totalAfter).toBe(totalBefore - coreCountBefore);
  });

  test('filter state persists after navigating to another team', async ({
    page,
  }) => {
    const corePill = page
      .locator('.role-pill')
      .filter({ hasText: /^Core Starter$/ });
    await corePill.click();
    await expect(corePill).toHaveAttribute('aria-pressed', 'false');

    await page.locator('.subbar__crumb', { hasText: 'Rankings' }).click();
    const kcRow = page.locator('.rankings-table tbody tr', {
      has: page.locator('.team-row__id', { hasText: /^KC$/ }),
    });
    await kcRow.click();
    await expect(page.locator('.team-hero')).toBeVisible();

    await expect(
      page.locator('.role-pill').filter({ hasText: /^Core Starter$/ }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('re-enabling a role restores its player rows', async ({ page }) => {
    const totalBefore = await page.locator('.roster-table tbody tr').count();
    const corePill = page
      .locator('.role-pill')
      .filter({ hasText: /^Core Starter$/ });

    await corePill.click();
    await expect(corePill).toHaveAttribute('aria-pressed', 'false');
    const restricted = await page.locator('.roster-table tbody tr').count();
    expect(restricted).toBeLessThan(totalBefore);

    await corePill.click();
    await expect(corePill).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.roster-table tbody tr')).toHaveCount(
      totalBefore,
    );
  });
});
