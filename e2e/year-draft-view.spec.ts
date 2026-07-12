import { test, expect, type Page } from '@playwright/test';

/** Masthead primary-nav tab by label. */
function navTab(page: Page, name: string | RegExp) {
  return page.locator('.mast__nav').getByRole('button', { name });
}

/** Subbar year chip by exact year label. */
function yearChip(page: Page, year: number) {
  return page
    .locator('.subbar__chip')
    .filter({ hasText: new RegExp(`^${year}$`) });
}

test.describe('Year draft view (all picks in one draft)', () => {
  test('deep link /year/2020 shows the class numeral and pick ledger', async ({
    page,
  }) => {
    await page.goto('/year/2020');
    const view = page.locator('.year-draft-view');
    await expect(view).toBeVisible();
    await expect(view.locator('.year-numeral')).toHaveText('2020');
    await expect(view.getByText('The Class Of')).toBeVisible();
    expect(await page.locator('.pick-ledger-row').count()).toBeGreaterThan(0);
  });

  test('Draft Year tab from home opens the year view; chips change year', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();

    await navTab(page, /^Draft Year$/).click();
    // The masthead tab keeps the active year range in the query string; the
    // year chips below navigate to a bare /year/{y}.
    await expect(page).toHaveURL(/\/year\/2025(?:\?|$)/);
    await expect(page.locator('.year-numeral')).toHaveText('2025');

    await yearChip(page, 2019).click();
    await expect(page).toHaveURL(/\/year\/2019$/);
    await expect(page.locator('.year-numeral')).toHaveText('2019');

    await page.locator('.subbar__crumb', { hasText: 'Rankings' }).click();
    await expect(page).toHaveURL(/\?from=/);
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();
  });

  test('2026 draft (latest, no season data yet) renders its board', async ({
    page,
  }) => {
    await page.goto('/year/2026');
    await expect(page.locator('.year-numeral')).toHaveText('2026');
    expect(await page.locator('.pick-ledger-row').count()).toBeGreaterThan(0);
  });

  test('year chip switches year on the year view', async ({ page }) => {
    await page.goto('/year/2020');
    await expect(page.locator('.year-numeral')).toHaveText('2020');
    await yearChip(page, 2018).click();
    await expect(page).toHaveURL(/\/year\/2018$/);
    await expect(page.locator('.year-numeral')).toHaveText('2018');
  });
});
