import { test, expect } from '@playwright/test';

test.describe('Year range filter', () => {
  test('changing year range updates URL params', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('[aria-label="Start year"]');
    await fromInput.fill('2022');
    await fromInput.press('Enter');
    await expect(page).toHaveURL(/from=2022/);
  });

  test('year range reflects in the rankings hero', async ({ page }) => {
    await page.goto('/?from=2022&to=2024');
    await expect(
      page.getByText(/Draft success score · 3 seasons in window/i),
    ).toBeVisible();
  });

  test('year range persists on team navigation', async ({ page }) => {
    await page.goto('/?from=2022&to=2024');
    await page.locator('.rankings-table tbody tr').first().click();
    await expect(page.locator('.team-hero')).toBeVisible();
    expect(page.url()).toContain('from=2022');
    expect(page.url()).toContain('to=2024');
  });

  test('direct URL with year params loads correct range', async ({ page }) => {
    await page.goto('/DET?from=2023&to=2025');
    await expect(page.locator('.team-hero')).toBeVisible();
    await expect(page.locator('.class-grid .class-card')).toHaveCount(3);
  });

  test('invalid year range is corrected to defaults', async ({ page }) => {
    await page.goto('/?from=abc&to=xyz');
    await expect(page).toHaveURL(/from=2021/);
    await expect(page).toHaveURL(/to=2025/);
  });
});
