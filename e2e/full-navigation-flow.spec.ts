import { test, expect, type Page } from '@playwright/test';

/** Masthead primary-nav tab by label. */
function navTab(page: Page, name: string | RegExp) {
  return page.locator('.mast__nav').getByRole('button', { name });
}

/** `renderMainContent` → TeamRankingsView: 32 ranked team rows must render. */
async function expectTeamRankingsMainContent(page: Page) {
  const section = page.locator('[aria-label="Team draft rankings"]');
  await expect(section).toBeVisible();
  const rows = section.locator('.rankings-table tbody tr');
  await expect(rows.first()).toBeVisible();
  await expect(rows).toHaveCount(32);
}

test.describe('Full navigation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'nfl-draft-success-landing-intro-dismissed',
        JSON.stringify(true),
      );
      localStorage.removeItem('nfl-draft-success-role-filter');
    });
  });

  test('rankings → team → rankings → position → draft year with filters', async ({
    page,
  }) => {
    await test.step('Rankings: hero, year-range inputs, footer', async () => {
      await page.goto('/');

      await expectTeamRankingsMainContent(page);
      await expect(page.locator('.page-hero__headline')).toContainText(
        /Which teams draft/i,
      );
      await expect(
        page.getByText(/Draft success score · 5 seasons in window/i),
      ).toBeVisible();

      const startYear = page.locator('[aria-label="Start year"]');
      const endYear = page.locator('[aria-label="End year"]');
      await startYear.fill('2022');
      await startYear.press('Enter');
      // Sync point: the start year must reach the URL before the end year is
      // edited, so the two commits are asserted in a known order.
      await expect(page).toHaveURL(/from=2022/);
      await endYear.fill('2024');
      await endYear.press('Enter');

      await expect(page).toHaveURL(/to=2024/);
      await expect(page).toHaveURL(/from=2022/);
      await expect(
        page.getByText(/Draft success score · 3 seasons in window/i),
      ).toBeVisible();

      await expect(
        page.getByText(/independent analytics · not affiliated with the NFL/i),
      ).toBeVisible();
    });

    await test.step('Team detail: hero stats, class grid, roster, role pill', async () => {
      await page.locator('.rankings-table tbody tr').first().click();
      await expect(page.locator('.team-hero')).toBeVisible();
      expect(page.url()).toMatch(/\/[A-Z]{2,3}\?/);
      expect(page.url()).toContain('from=2022');
      expect(page.url()).toContain('to=2024');

      const hero = page.locator('.team-hero');
      await expect(hero.getByText('League Rank')).toBeVisible();
      await expect(hero.getByText('Core Starter Rate')).toBeVisible();
      await expect(hero.getByText('Retention', { exact: true })).toBeVisible();
      await expect(hero.getByText('Total Picks')).toBeVisible();

      await expect(page.locator('.class-grid .class-card')).toHaveCount(3);

      await expect(
        page.getByRole('heading', { name: /^Current roster/ }),
      ).toBeVisible();
      await expect(
        page.getByRole('checkbox', { name: /Show departed players/i }),
      ).toBeVisible();

      const pills = page.locator('[aria-label="Filter by role"] .role-pill');
      await expect(pills).toHaveCount(6);
      const nonPill = pills.filter({ hasText: /^Non Contributor$/ });
      await nonPill.click();
      await expect(nonPill).toHaveAttribute('aria-pressed', 'false');

      const endInSubbar = page.locator('[aria-label="End year"]');
      await endInSubbar.fill('2025');
      await endInSubbar.press('Enter');
      await expect(page).toHaveURL(/to=2025/);
      await expect(page).toHaveURL(/from=2022/);
    });

    await test.step('Back to rankings (year params preserved)', async () => {
      await page.locator('.subbar__crumb', { hasText: 'Rankings' }).click();
      await expectTeamRankingsMainContent(page);
      await expect(page).toHaveURL(/from=2022/);
      await expect(page).toHaveURL(/to=2025/);
    });

    await test.step('Position: headline, year range, tab switch', async () => {
      await navTab(page, /^Position$/).click();

      await expect(page).toHaveURL(/\/position\/QB/);
      await expect(page).toHaveURL(/from=2022/);
      await expect(page).toHaveURL(/to=2025/);

      await expect(
        page.getByText(/Position File · QB · 2022.2025/i),
      ).toBeVisible();
      await expect(page.locator('.pos-headline')).toContainText(/Quarterback/i);
      expect(await page.locator('.pos-table tbody tr').count()).toBeGreaterThan(
        0,
      );

      await page
        .locator('.pos-tabstrip [role="tab"]')
        .filter({ hasText: /^WR$/ })
        .click();
      await expect(page).toHaveURL(/\/position\/WR/);
      await expect(page.locator('.pos-headline')).toContainText(
        /Wide receiver/i,
      );

      const startInSubbar = page.locator('[aria-label="Start year"]');
      await startInSubbar.fill('2023');
      await startInSubbar.press('Enter');
      await expect(page).toHaveURL(/from=2023/);
      await expect(
        page.getByText(/Position File · WR · 2023.2025/i),
      ).toBeVisible();
    });

    await test.step('Draft Year: year view + pick ledger', async () => {
      await navTab(page, /^Draft Year$/).click();
      await expect(page).toHaveURL(/\/year\/2025(?:\?|$)/);
      await expect(page.locator('.year-numeral')).toHaveText('2025');
      expect(await page.locator('.pick-ledger-row').count()).toBeGreaterThan(0);
    });
  });
});
