import { test, expect, type Page } from '@playwright/test';

/** Slide-over menu panel */
function headerMenu(page: Page) {
  return page.getByRole('dialog', { name: /^menu$/i });
}

function headerRegion(page: Page) {
  return page.locator('header.app-header');
}

/** `getMainContent` → TeamRankingsView: ranked team rows must render. */
async function expectTeamRankingsMainContent(page: Page) {
  const section = page.locator('[aria-label="Team draft rankings"]');
  await expect(section).toBeVisible();
  const rows = section.locator('.team-rankings-view__item');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBe(32);
}

/**
 * `getMainContent` → TeamDetailContent | PositionDraftView | YearDraftView:
 * each renders one or more PlayerList (`role="list"` name Draft picks) with cards.
 */
async function expectMainContentHasPlayerLists(page: Page) {
  const main = page.locator('main.app');
  await expect(main).toBeVisible();
  const lists = main.getByRole('list', { name: /^Draft picks$/ });
  await expect(lists.first()).toBeVisible();
  expect(await lists.count()).toBeGreaterThan(0);
  const cards = main.locator('.player-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
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

  test('rankings → team → rankings → position → drafts with filters and copy', async ({
    page,
  }) => {
    await test.step('Rankings: year range filters + titles', async () => {
      await page.goto('/');

      await expect(
        page.locator('[aria-label="Team draft rankings"]'),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /^Team rankings$/ }),
      ).toBeVisible();
      await expect(page.locator('.team-rankings-view__subtitle')).toContainText(
        'Rolling draft score',
      );
      await expect(page.locator('.team-rankings-view__subtitle')).toContainText(
        'seasons in window',
      );

      const header = headerRegion(page);
      await expect(
        header.getByText('Draft years', { exact: true }),
      ).toBeVisible();
      await expect(
        header.getByText(/Classes in this window feed team scores/i),
      ).toBeVisible();

      await expect(
        page.getByRole('group', {
          name: /Years included in team scores and rankings below/i,
        }),
      ).toBeVisible();

      const startYear = page.locator('[aria-label="Start year"]');
      const endYear = page.locator('[aria-label="End year"]');
      await startYear.fill('2022');
      await startYear.press('Enter');
      await endYear.fill('2024');
      await endYear.press('Enter');

      await expect(page).toHaveURL(/from=2022/);
      await expect(page).toHaveURL(/to=2024/);
      await expect(page.locator('.team-rankings-view__subtitle')).toContainText(
        '3 seasons',
      );

      await expectTeamRankingsMainContent(page);

      await expect(
        page.getByText(
          /NFLDraftSuccess\.com is an independent analytics site/i,
        ),
      ).toBeVisible();
    });

    await test.step('Team detail: header filters, score copy, roster, role filter', async () => {
      await page.locator('.team-rankings-view__item').first().click();
      await expect(
        page.locator('[aria-label="Current roster draft picks"]'),
      ).toBeVisible();
      expect(page.url()).toMatch(/\/[A-Z]{2,3}\?/);
      expect(page.url()).toContain('from=2022');
      expect(page.url()).toContain('to=2024');

      await expectMainContentHasPlayerLists(page);

      const header = headerRegion(page);
      await expect(
        header.getByRole('group', { name: /Team navigation/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: /^Select team$/i }),
      ).toBeVisible();

      await expect(
        header.getByText('Draft years', { exact: true }),
      ).toBeVisible();
      await expect(
        header.getByText(
          /Rolling score, draft cards, and roster use this window/i,
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('group', {
          name: /Years included in rolling score, draft cards, and roster below/i,
        }),
      ).toBeVisible();

      const scoreArticle = page.locator(
        '[aria-labelledby="draft-score-title"]',
      );
      await expect(
        scoreArticle.getByRole('heading', { name: /^Rolling draft score$/ }),
      ).toBeVisible();
      await expect(
        scoreArticle.locator('dt', { hasText: /^Score$/ }),
      ).toBeVisible();
      await expect(
        scoreArticle.locator('dt', { hasText: /^Core Starter %$/ }),
      ).toBeVisible();
      await expect(
        scoreArticle.locator('dt', { hasText: /^Retention %$/ }),
      ).toBeVisible();
      await expect(
        scoreArticle.locator('dt', { hasText: /^Total picks$/ }),
      ).toBeVisible();

      await expect(
        page.locator('[aria-label="Draft class metrics by year"]'),
      ).toBeVisible();

      await expect(
        page.getByRole('heading', { name: /^Current roster$/ }),
      ).toBeVisible();
      await expect(
        page.getByRole('checkbox', { name: /Show departed players/i }),
      ).toBeVisible();
      await expect(page.getByText('Show departed')).toBeVisible();

      await expect(page.locator('[aria-label="Filter by role"]')).toHaveText(
        /All roles|\d+ roles/,
      );

      await page.locator('[aria-label="Filter by role"]').click();
      const roleDialog = page.getByRole('dialog', { name: /Show roles/i });
      await expect(roleDialog).toBeVisible();
      await expect(roleDialog.locator('.role-filter__checkbox')).toHaveCount(6);
      await roleDialog
        .locator('.role-filter__preset', { hasText: 'Starters' })
        .click();
      await roleDialog.getByRole('button', { name: /^Close$/ }).click();

      await expect(page.locator('[aria-label="Filter by role"]')).toHaveText(
        '2 roles',
      );
      const badges = page.locator('[data-testid="role-badge"]');
      const roleAttrs = await badges.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-role')),
      );
      for (const role of roleAttrs) {
        expect(['core_starter', 'starter_when_healthy']).toContain(role);
      }

      const endInHeader = headerRegion(page).locator('[aria-label="End year"]');
      await endInHeader.fill('2025');
      await endInHeader.press('Enter');
      await expect(page).toHaveURL(/to=2025/);
    });

    await test.step('Menu → Team rankings (year params preserved)', async () => {
      await page.getByRole('button', { name: /open menu/i }).click();
      await headerMenu(page)
        .getByRole('button', { name: /^Team rankings$/i })
        .click();

      await expect(
        page.locator('[aria-label="Team draft rankings"]'),
      ).toBeVisible();
      await expect(page).toHaveURL(/from=2022/);
      await expect(page).toHaveURL(/to=2025/);

      await expectTeamRankingsMainContent(page);
    });

    await test.step('Menu → By position: year range, intro copy, position filter', async () => {
      await page.getByRole('button', { name: /open menu/i }).click();
      await headerMenu(page)
        .getByRole('link', { name: /^By position$/i })
        .click();

      await expect(page).toHaveURL(/\/position\/QB/);
      await expect(page).toHaveURL(/from=2022/);
      await expect(page).toHaveURL(/to=2025/);

      await expect(
        page.getByRole('heading', {
          name: /Quarterback \(QB\).*2022.*2025/i,
        }),
      ).toBeVisible();
      await expectMainContentHasPlayerLists(page);

      await expect(
        page.getByText(/All quarterback \(QB\) picks in this range/i),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^team rankings$/i }),
      ).toBeVisible();

      await expect(
        page.getByRole('group', {
          name: /Years shown for player lists below \(same window as team scores\)/i,
        }),
      ).toBeVisible();
      await expect(
        headerRegion(page).getByText('Player lists below use this range.', {
          exact: true,
        }),
      ).toBeVisible();

      const posSelect = page.getByRole('combobox', {
        name: /^Select position$/i,
      });
      await expect(posSelect).toBeVisible();
      await posSelect.selectOption('WR');
      await expect(page).toHaveURL(/\/position\/WR/);
      await expect(
        page.getByRole('heading', {
          name: /Wide receiver \(WR\).*2022.*2025/i,
        }),
      ).toBeVisible();

      const startInHeader = headerRegion(page).locator(
        '[aria-label="Start year"]',
      );
      await startInHeader.fill('2023');
      await startInHeader.press('Enter');
      await expect(page).toHaveURL(/from=2023/);
      await expect(
        page.getByRole('heading', {
          name: /Wide receiver \(WR\).*2023.*2025/i,
        }),
      ).toBeVisible();

      await expectMainContentHasPlayerLists(page);
    });

    await test.step('Menu → Drafts: which-draft header, year picker, intro copy', async () => {
      await page.getByRole('button', { name: /open menu/i }).click();
      await headerMenu(page)
        .getByRole('link', { name: /^Drafts$/i })
        .click();

      await expect(page).toHaveURL(/\/year\/2025$/);
      await expect(
        page.getByRole('heading', { name: /2025 NFL Draft — all picks/i }),
      ).toBeVisible();
      await expectMainContentHasPlayerLists(page);

      await expect(
        page.getByText(/Every pick in draft order \(all teams\)/i),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^team rankings$/i }),
      ).toBeVisible();

      await expect(
        headerRegion(page).getByText('Which draft', { exact: true }),
      ).toBeVisible();
      await expect(
        headerRegion(page).getByText(
          /Pick a year to load that draft's full pick list/i,
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('combobox', {
          name: /draft year \(all picks in that draft\)/i,
        }),
      ).toBeVisible();

      await page
        .getByRole('combobox', {
          name: /draft year \(all picks in that draft\)/i,
        })
        .selectOption('2020');
      await expect(page).toHaveURL(/\/year\/2020$/);
      await expect(
        page.getByRole('heading', { name: /2020 NFL Draft — all picks/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: /2020 NFL draft — all picks/i }),
      ).toBeVisible();

      await expectMainContentHasPlayerLists(page);
    });
  });
});
