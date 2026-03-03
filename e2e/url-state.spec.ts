import { test, expect } from '@playwright/test';

test.describe('URL state management', () => {
  test('deep link to team with year range loads correctly', async ({
    page,
  }) => {
    await page.goto('/SF?from=2020&to=2023');
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();
    await expect(page.locator('.draft-score__number')).not.toBeEmpty();
    const cards = page.locator(
      '[aria-label="Draft class metrics by year"] > *',
    );
    await expect(cards).toHaveCount(4);
  });

  test('browser back/forward navigates between views', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();

    await page.locator('.team-rankings-view__item').first().click();
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();

    await page.goBack();
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();

    await page.goForward();
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();
  });

  test('changing team updates URL without full reload', async ({ page }) => {
    await page.goto('/DET?from=2021&to=2025');
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();

    const selector = page.locator('[aria-label="Select team"]');
    await selector.selectOption('BUF');
    await expect(page).toHaveURL(/\/BUF\?/);
    await expect(page.locator('.draft-score__number')).toBeVisible();
  });

  test('URL with only from param still works', async ({ page }) => {
    await page.goto('/?from=2022');
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();
  });
});
