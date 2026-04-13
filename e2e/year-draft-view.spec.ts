import { test, expect } from '@playwright/test';

test.describe('Year draft view (all picks in one draft)', () => {
  test('deep link /year/2020 shows full draft heading and pick list', async ({
    page,
  }) => {
    await page.goto('/year/2020');
    await expect(
      page.getByRole('heading', { name: /2020 NFL Draft — all picks/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: /2020 NFL draft — all picks/i }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('list', { name: /draft picks/i }),
    ).toBeVisible();
    await expect(page.getByRole('listitem').first()).toBeVisible();
  });

  test('Drafts link from home opens drafts view; picker changes year', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Drafts$/i }).click();
    await expect(page).toHaveURL(/\/year\/2025$/);
    await page
      .getByRole('combobox', {
        name: /draft year \(all picks in that draft\)/i,
      })
      .selectOption('2019');
    await expect(page).toHaveURL(/\/year\/2019$/);
    await page.getByRole('button', { name: /^Team rankings$/i }).click();
    await expect(page).toHaveURL(/\?from=/);
  });

  test('inspect draft dropdown switches year on year view', async ({
    page,
  }) => {
    await page.goto('/year/2020');
    await page
      .getByRole('combobox', {
        name: /draft year \(all picks in that draft\)/i,
      })
      .selectOption('2018');
    await expect(page).toHaveURL(/\/year\/2018$/);
    await expect(
      page.getByRole('heading', { name: /2018 NFL Draft — all picks/i }),
    ).toBeVisible();
  });
});
