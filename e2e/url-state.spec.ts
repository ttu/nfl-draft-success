import { test, expect } from '@playwright/test';

test.describe('URL state management', () => {
  test('deep link to team with year range loads correctly', async ({
    page,
  }) => {
    await page.goto('/SF?from=2020&to=2023');
    await expect(page.locator('.team-hero')).toBeVisible();
    await expect(page.locator('.team-hero__score')).not.toBeEmpty();
    await expect(page.locator('.class-grid .class-card')).toHaveCount(4);
  });

  test('browser back/forward navigates between views', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();

    await page.locator('.rankings-table tbody tr').first().click();
    await expect(page.locator('.team-hero')).toBeVisible();

    await page.goBack();
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();

    await page.goForward();
    await expect(page.locator('.team-hero')).toBeVisible();
  });

  test('navigating between teams updates the URL', async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await expect(page.locator('.team-hero__abbrev')).toHaveText('DET');

    await page.locator('.subbar__crumb', { hasText: 'Rankings' }).click();
    const bufRow = page.locator('.rankings-table tbody tr', {
      has: page.locator('.team-row__id', { hasText: /^BUF$/ }),
    });
    await bufRow.click();
    await expect(page).toHaveURL(/\/BUF\?/);
    await expect(page.locator('.team-hero__abbrev')).toHaveText('BUF');
  });

  test('URL with only from param still works', async ({ page }) => {
    await page.goto('/?from=2022');
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();
  });
});
