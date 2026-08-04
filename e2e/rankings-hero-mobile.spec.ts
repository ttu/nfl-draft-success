import { test, expect } from '@playwright/test';

/**
 * The mobile rankings hero exists to answer "who drafted best?" in the first
 * screenful. It used to take a 34px headline, a 60-word paragraph and three
 * stat blocks to get there, with the range controls on three rows above it.
 * These tests pin what that redesign bought: the podium above the fold, one
 * row of chrome, and no horizontal scroll.
 */

// 320 is the narrowest phone still worth supporting (iPhone SE 1st gen).
const PHONE_WIDTHS = [390, 360, 320];

for (const width of PHONE_WIDTHS) {
  test.describe(`Rankings hero at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await page.goto('/?from=2021&to=2025');
      await expect(page.locator('.podium')).toBeVisible();
    });

    test('shows the whole podium without scrolling', async ({ page }) => {
      const bottom = await page
        .locator('.podium-strip')
        .evaluate((el) => el.getBoundingClientRect().bottom);
      expect(bottom).toBeLessThanOrEqual(760);
    });

    test('fits the viewport without horizontal scrolling', async ({ page }) => {
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('never runs a range chip under the edit toggle', async ({ page }) => {
      // The presets scroll inside their own box, so whatever they do the
      // toggle keeps its own space — the overlap that made the row look broken.
      const presetsRight = await page
        .locator('.subbar__presets')
        .evaluate((el) => el.getBoundingClientRect().right);
      const editLeft = await page
        .locator('.subbar__range-edit')
        .evaluate((el) => el.getBoundingClientRect().left);
      expect(presetsRight).toBeLessThanOrEqual(editLeft + 1);
    });

    test('keeps the range control to a single row', async ({ page }) => {
      // One chip (28px) plus the row's 9px padding. A second row would take it
      // past 60 — the wrap this layout exists to prevent.
      const height = await page
        .locator('.subbar')
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(height).toBeLessThanOrEqual(50);
    });

    test('lists the board from #4, the podium having taken the top three', async ({
      page,
    }) => {
      const firstRank = page
        .locator('.rankings-table tbody tr')
        .first()
        .locator('.rank-num');
      await expect(firstRank).toHaveText('4');
    });
  });
}

test.describe('Rankings hero before the data arrives', () => {
  test('reserves the podium so the strip does not move when teams land', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 760 });

    // Hold every data request open: the app stays in its boot state, which is
    // the frame the placeholder podium exists for.
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/data/*.json', async (route) => {
      await held;
      await route.continue();
    });

    await page.goto('/?from=2021&to=2025');
    await expect(page.locator('.podium--placeholder')).toBeVisible();
    const bootStripTop = await page
      .locator('.podium-strip')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));

    release();
    await expect(page.locator('.podium--placeholder')).toHaveCount(0);
    await expect(page.locator('.podium__col--lead')).toBeVisible();
    const loadedStripTop = await page
      .locator('.podium-strip')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));

    expect(loadedStripTop).toBe(bootStripTop);
  });
});

/**
 * The other tabs put a breadcrumb ahead of the same range control. On a phone
 * the two cannot share a line — the presets end up squeezed into a sliver and
 * render as a chip cut down the middle — so the breadcrumb takes the line above.
 */
test.describe('Range control on the breadcrumb tabs at 390px', () => {
  const TABS = [
    { name: 'Highlights', path: '/highlights?from=2021&to=2025' },
    { name: 'Position', path: '/position/QB?from=2021&to=2025' },
    { name: 'Team detail', path: '/DET?from=2021&to=2025' },
  ];

  for (const tab of TABS) {
    test(`${tab.name} shows every preset in full`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 760 });
      await page.goto(tab.path);
      await expect(page.locator('.subbar__presets')).toBeVisible();

      const overflow = await page
        .locator('.subbar__presets')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      // The breadcrumb sits on its own line above, not beside the chips.
      const crumbBottom = await page
        .locator('.subbar__crumb')
        .evaluate((el) => el.getBoundingClientRect().bottom);
      const presetsTop = await page
        .locator('.subbar__presets')
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(presetsTop).toBeGreaterThanOrEqual(crumbBottom - 1);
    });
  }
});

test.describe('Rankings hero controls at 390px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/?from=2021&to=2025');
  });

  test('opens the custom year fields in place of the preset chips', async ({
    page,
  }) => {
    const inputs = page.locator('.subbar__range-inputs');
    await expect(inputs).toBeHidden();

    await page.locator('.subbar__range-edit').click();
    await expect(inputs).toBeVisible();
    await expect(page.locator('.subbar__chip').first()).toBeHidden();
    // Still one row, and still on screen.
    const box = await inputs.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });

  test('shows all four range presets without scrolling', async ({ page }) => {
    const overflow = await page
      .locator('.subbar__presets')
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    // 320px phones still scroll here; 390 is where the row must simply fit.
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('opens the team page from the podium bar, not just the name', async ({
    page,
  }) => {
    await page.locator('.podium__col--3 .podium__bar').click();
    await expect(page.locator('.team-hero')).toBeVisible();
  });

  test('keeps Info and the theme toggle in the masthead as icon buttons', async ({
    page,
  }) => {
    const controls = page.locator('.mast__controls .mast__ctrl-btn');
    await expect(controls).toHaveCount(2);
    await expect(controls.first()).toBeVisible();
    await expect(page.locator('.mast__ctrl-label').first()).toBeHidden();

    // Sharing the brand's row is what keeps the podium near the top.
    const brandTop = await page
      .locator('.mast__brand')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const ctrlTop = await controls
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    expect(Math.abs(ctrlTop - brandTop)).toBeLessThan(40);
  });
});
