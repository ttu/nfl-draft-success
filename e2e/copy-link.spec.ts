import { test, expect } from '@playwright/test';

test.describe('Copy link', () => {
  test('copy link button shows feedback after click', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/DET?from=2021&to=2025');
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();

    await page.locator('[aria-label="Copy shareable link"]').click();
    await expect(page.locator('[aria-label="Copied!"]')).toBeVisible();
  });

  test('copied URL includes current filters', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/DET?from=2022&to=2024');
    await expect(
      page.locator('[aria-label="Current roster draft picks"]'),
    ).toBeVisible();

    await page.locator('[aria-label="Copy shareable link"]').click();
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain('/DET');
    expect(clipboardText).toContain('from=2022');
    expect(clipboardText).toContain('to=2024');
  });
});
