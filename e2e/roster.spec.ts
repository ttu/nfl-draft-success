import { test, expect } from '@playwright/test';

test('a team roster deep link renders and links back to the team page', async ({
  page,
}) => {
  await page.goto('/roster/BUF');
  await expect(
    page.getByRole('heading', { name: /Current roster/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Quarterbacks' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/BUF(\?|$)/);
});

test('the team page opens its current roster', async ({ page }) => {
  await page.goto('/BUF');
  await page.getByRole('link', { name: /Current roster/ }).click();
  await expect(page).toHaveURL(/\/roster\/BUF(\?|$)/);
});
