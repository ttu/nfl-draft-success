import { test, expect, type Page } from '@playwright/test';

/**
 * The career table is the player view's primary content, and on a phone it used
 * to scroll horizontally: the Season column slid off the left edge before the
 * Score column came into view, so no single position answered "which year, and
 * what did it score?". These tests pin the fit — six columns, no scroll.
 */

// 320 is the narrowest phone still worth supporting (iPhone SE 1st gen); the
// six columns fit it with nothing to spare, so it is the width that regresses
// first if anything is added back to this table.
const PHONE_WIDTHS = [390, 360, 320];

async function openPlayerCareer(page: Page) {
  await page.goto('/DET?from=2021&to=2025');
  await page.locator('.roster-table tbody tr').first().click();
  await expect(page.locator('.player-career table')).toBeVisible();
}

for (const width of PHONE_WIDTHS) {
  test.describe(`Player career table at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openPlayerCareer(page);
    });

    test('fits the viewport without horizontal scrolling', async ({ page }) => {
      const overflow = await page
        .locator('.player-career__scroll')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      // 1px of slack for sub-pixel layout rounding.
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('shows both the season and its score in one view', async ({
      page,
    }) => {
      const firstRow = page.locator('.player-career tbody tr').first();
      await expect(firstRow.locator('.player-career__year')).toBeVisible();
      await expect(firstRow.locator('.player-career__score')).toBeVisible();
    });

    test('hides the Load column', async ({ page }) => {
      await expect(page.locator('.player-career th.career-load')).toBeHidden();
      await expect(page.locator('.player-career td.career-load')).toHaveCount(
        await page.locator('.player-career tbody tr').count(),
      );
      await expect(
        page.locator('.player-career td.career-load').first(),
      ).toBeHidden();
    });

    test('keeps every row aligned to the same column count', async ({
      page,
    }) => {
      // The rookie-window gap rows carry a colSpan; if it over-spans, their
      // Score cell lands in a different column from every other row's.
      const scoreEdges = await page
        .locator('.player-career tbody tr')
        .evaluateAll((rows) =>
          rows.map((row) => {
            const cells = row.querySelectorAll('td');
            const score = cells[cells.length - 2];
            return score ? Math.round(score.getBoundingClientRect().right) : -1;
          }),
        );
      expect(new Set(scoreEdges).size).toBe(1);
    });

    test('the uncounted-season ✕ clears the score digits', async ({ page }) => {
      // Clelin Ferrell, LV 2019 — four seasons for the drafting team, then
      // three elsewhere, so his Score column carries the ✕ marker. The marker
      // is parked in the cell's right padding; when that padding was trimmed
      // for mobile it landed on top of the last digit.
      await page.goto('/player/FerrCl00');
      await expect(page.locator('.player-career table')).toBeVisible();
      const marks = page.locator('.season-uncounted-mark');
      expect(await marks.count()).toBeGreaterThan(0);

      const worstOverlap = await page
        .locator('.player-career tbody tr')
        .evaluateAll((rows) =>
          Math.max(
            ...rows.map((row) => {
              const cell = row.querySelector('.player-career__score');
              const mark = cell?.querySelector('.season-uncounted-mark');
              if (!cell || !mark) return 0;
              const digits = [...cell.childNodes].find(
                (n) => n.nodeType === Node.TEXT_NODE,
              );
              if (!digits) return 0;
              const range = document.createRange();
              range.selectNode(digits);
              return (
                range.getBoundingClientRect().right -
                mark.getBoundingClientRect().left
              );
            }),
          ),
        );
      expect(worstOverlap).toBeLessThanOrEqual(0);
    });
  });
}
