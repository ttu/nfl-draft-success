import { test, expect, type Page } from '@playwright/test';

/**
 * Undrafted free agents on the team page. They live inside the roster's draft
 * year groups — one list per class, picks first — and are opt-in behind the
 * "Show free agents" toggle.
 *
 * This spec exists because no e2e covered the free-agent surfaces at all, and
 * that gap let a mobile overflow ship.
 */

const TEAM_URL = '/DET?from=2021&to=2025';

/** The roster row tag reads `R1·30` for a pick and `UDFA` for everyone else. */
const PICK_TAG = /R\d+·\d+/;

async function openTeam(page: Page, { withFreeAgents = true } = {}) {
  await page.goto(TEAM_URL);
  await expect(page.locator('.team-hero')).toBeVisible();
  await expect(page.locator('#team-roster')).toBeVisible();
  if (withFreeAgents) {
    await page.getByRole('checkbox', { name: /show free agents/i }).check();
    await expect(
      page.locator('#team-roster .pick-tag', { hasText: /UDFA/ }).first(),
    ).toBeAttached();
  }
}

test.describe('Undrafted free agents in the roster', () => {
  test('are absent until the toggle asks for them', async ({ page }) => {
    await openTeam(page, { withFreeAgents: false });

    const tags = page.locator('#team-roster .roster-table .pick-tag');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);
    // Every row is a pick, so the roster reads exactly as it did before.
    for (let i = 0; i < count; i++) {
      await expect(tags.nth(i)).toContainText(PICK_TAG);
    }
  });

  test('appear inside a draft year group, after that year’s picks', async ({
    page,
  }) => {
    await openTeam(page);

    const group = page.locator('.roster-year').first();
    const tags = group.locator('.pick-tag');
    const labels = await tags.allTextContents();
    const firstUndrafted = labels.findIndex((t) => /UDFA/.test(t));

    if (firstUndrafted !== -1) {
      // Nothing drafted may follow an undrafted row inside the same year.
      const after = labels.slice(firstUndrafted);
      expect(after.every((t) => /UDFA/.test(t))).toBe(true);
    }
  });

  test('are counted separately in the year heading', async ({ page }) => {
    await openTeam(page);

    const heading = page
      .locator('.roster-year')
      .filter({ has: page.locator('.pick-tag', { hasText: /UDFA/ }) })
      .first()
      .locator('.roster-year__head');

    await expect(heading).toContainText(/\d{1,3} picks · \d{1,3} undrafted/);
  });

  test('open a player page that claims neither a draft nor a signing', async ({
    page,
  }) => {
    await openTeam(page);

    const row = page
      .locator('#team-roster tbody tr')
      .filter({ has: page.locator('.pick-tag', { hasText: /UDFA/ }) })
      .first();
    await row.click();

    await expect(page.locator('.player-view')).toBeVisible();
    await expect(page.locator('.player-hero__meta')).toContainText(
      /debuted with/i,
    );
    await expect(page.locator('.player-hero__meta')).not.toContainText(
      /signed by|drafted by/i,
    );
  });
});

// 375 is the iPhone SE / mini width the roster table already fits exactly; the
// undrafted rows used to blow past the container because the per-row
// "undrafted" tag is half again as wide as a pick's "R1·30".
const PHONE_WIDTHS = [390, 375, 360];

for (const width of PHONE_WIDTHS) {
  test.describe(`Undrafted free agents at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openTeam(page);
    });

    test('fits the viewport, in every year group', async ({ page }) => {
      // Measured against the VIEWPORT, not the container: the container is a
      // grid track that grows with its content, so a table and its container
      // can agree with each other while both sit off the side of the screen.
      // That is exactly how a 521px-wide roster once passed this check.
      const widest = await page.evaluate(() => {
        const tables = [
          ...document.querySelectorAll('#team-roster .roster-table'),
        ];
        return Math.max(...tables.map((t) => t.scrollWidth));
      });
      expect(widest).toBeLessThanOrEqual(width);
    });

    test('keeps every row on the same column count', async ({ page }) => {
      // Picks and undrafted players share one table. Hiding a whole cell on
      // one population leaves its rows a column short, which adds a column to
      // the table and pushes it past the screen — hide the label, not the cell.
      const counts = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#team-roster tbody tr')];
        return [
          ...new Set(
            rows.map(
              (r) =>
                [...r.children].filter(
                  (c) => getComputedStyle(c).display !== 'none',
                ).length,
            ),
          ),
        ];
      });
      expect(counts).toHaveLength(1);
    });

    test('leaves the page itself without a horizontal scrollbar', async ({
      page,
    }) => {
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}

test.describe('Undrafted highlights', () => {
  test('ranks the best undrafted players on their own score', async ({
    page,
  }) => {
    await page.goto('/highlights?from=2021&to=2025');

    const band = page
      .locator('.highlights-band')
      .filter({ hasText: 'Best undrafted players' });
    await expect(band).toBeVisible();

    const firstRow = band.locator('.highlight-row').first();
    // The headline is the score, and the meta names what the residual is
    // measured against — not a draft slot the player never had.
    await expect(firstRow).toContainText(/vs undrafted average/i);
    await expect(firstRow).toContainText(/UDFA/);
    await expect(firstRow).not.toContainText(/R\d{1,2} #\d{1,3}/);
  });
});
