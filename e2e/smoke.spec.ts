import { test, expect, type Page } from '@playwright/test';

/**
 * Post-deploy smoke tests.
 *
 * These target the failure modes that only appear once the site is *served*:
 * wrong asset base path, missing SPA fallback, unpublished `public/data/*.json`,
 * or build-time artifacts (sitemap, og-image) that never made it into `dist/`.
 * They deliberately avoid asserting on data values — that is what the unit and
 * full E2E suites are for. Keep this file small and boring so a red smoke run
 * always means "the deployment is broken", never "the assertion was brittle".
 *
 * Run against production with `pnpm run test:e2e:smoke:prod`.
 */

/** Failures on third-party origins (fonts, CDNs) must not fail a smoke run. */
function isSameOrigin(url: string, baseURL: string | undefined): boolean {
  if (!baseURL) return true;
  try {
    return new URL(url).origin === new URL(baseURL).origin;
  } catch {
    return false;
  }
}

/**
 * True when this run targets the Vite dev server, which answers every path from
 * memory and has no built `dist/` behind it.
 *
 * Read from the environment rather than the `baseURL` fixture so the
 * pre-render test can be *registered* conditionally instead of skipped inside
 * the test body: a dev-server run then reports what it actually covered.
 * `playwright.config.ts` resolves the same variable, defaulting to the dev
 * server when it is unset.
 */
const DEV_SERVER_RUN = ((): boolean => {
  const target = process.env.E2E_BASE_URL?.trim();
  if (!target) return true;
  try {
    return new URL(target).port === '3273';
  } catch {
    return false;
  }
})();

interface PageProblems {
  readonly consoleErrors: string[];
  readonly failedRequests: string[];
}

/**
 * Records same-origin subresource failures and console errors for the page.
 *
 * The main document is excluded: routes outside the sitemap — player pages,
 * typos — are still answered with `404.html` under an HTTP 404 status, which is
 * the SPA fallback working as intended, not a broken deployment. Sitemap routes
 * get a page of their own; the test below holds them to a real 200.
 */
function watchForProblems(
  page: Page,
  baseURL: string | undefined,
): PageProblems {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('response', (response) => {
    const url = response.url();
    if (response.request().resourceType() === 'document') return;
    if (!isSameOrigin(url, baseURL)) return;
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${url}`);
    }
  });

  // A request that never gets an HTTP response at all (DNS failure, connection
  // reset, blocked) fires no `response` event, so it would otherwise slip past
  // the check above and read as a clean page.
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (request.resourceType() === 'document') return;
    if (!isSameOrigin(url, baseURL)) return;
    const reason = request.failure()?.errorText ?? 'request failed';
    failedRequests.push(`${reason} ${url}`);
  });

  return { consoleErrors, failedRequests };
}

test.describe('Deployment smoke', { tag: '@smoke' }, () => {
  test('landing page boots and renders the full rankings table', async ({
    page,
  }) => {
    await page.goto('/');

    const section = page.locator('[aria-label="Team draft rankings"]');
    await expect(section).toBeVisible();
    await expect(section.locator('.rankings-table tbody tr')).toHaveCount(32);
  });

  test('serves no broken same-origin assets on the landing page', async ({
    page,
    baseURL,
  }) => {
    const problems = watchForProblems(page, baseURL);

    await page.goto('/');
    await expect(
      page.locator('[aria-label="Team draft rankings"]'),
    ).toBeVisible();
    await expect(page.locator('header.masthead')).toBeVisible();

    expect(problems.failedRequests).toEqual([]);
    expect(problems.consoleErrors).toEqual([]);
  });

  test('deep link renders the team view and titles the document', async ({
    page,
    baseURL,
  }) => {
    const problems = watchForProblems(page, baseURL);

    await page.goto('/DET?from=2021&to=2025');

    await expect(page.locator('.team-hero')).toBeVisible();
    await expect(page.locator('.team-hero__abbrev')).toHaveText('DET');
    await expect(page).toHaveTitle(
      'Detroit Lions Draft Results | NFL Draft Success',
    );
    expect(problems.failedRequests).toEqual([]);
  });

  /**
   * The head has to keep up once the SPA takes over: every route renders the
   * same component tree, so nothing remounts and the title, canonical and share
   * card would otherwise stay on whichever page was loaded first.
   */
  test('client-side navigation moves the document head with it', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('NFL Draft Success');

    await page
      .getByRole('link', { name: /Detroit Lions/ })
      .first()
      .click();

    await expect(page).toHaveTitle(
      'Detroit Lions Draft Results | NFL Draft Success',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.nfldraftsuccess.com/DET',
    );
  });

  /**
   * What the sitemap is for. Before `scripts/seo/prerender-routes.ts` these URLs had
   * no file of their own, so the host answered each with `404.html`: a browser
   * rendered the right page, a crawler read the 404 status and dropped it, and
   * every shared link unfurled the landing page's card.
   */
  const prerenderTest = DEV_SERVER_RUN ? test.skip : test;
  prerenderTest(
    'serves a pre-rendered page for each kind of sitemap route',
    async ({ request }) => {
      const routes = [
        { path: '/', title: 'NFL Draft Success' },
        {
          path: '/DET',
          title: 'Detroit Lions Draft Results | NFL Draft Success',
        },
        {
          path: '/year/2025',
          title: '2025 NFL Draft Class Results | NFL Draft Success',
        },
        {
          path: '/position/QB',
          title: 'QB Draft Picks by Year | NFL Draft Success',
        },
        {
          path: '/highlights',
          title: 'Draft Steals &amp; Busts | NFL Draft Success',
        },
      ];

      for (const { path, title } of routes) {
        const response = await request.get(path);
        expect(response.status(), `${path} should be served, not 404`).toBe(
          200,
        );

        const html = await response.text();
        expect(html, `${path} should carry its own title`).toContain(
          `<title>${title}</title>`,
        );
        expect(html, `${path} should canonicalise to itself`).toContain(
          `href="https://www.nfldraftsuccess.com${path}"`,
        );
      }
    },
  );

  test('publishes draft data and surfaces the synced date', async ({
    page,
    request,
  }) => {
    const meta = await request.get('/data/data-meta.json');
    expect(meta.status()).toBe(200);
    const { lastUpdated } = (await meta.json()) as { lastUpdated?: string };
    expect(lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.goto('/');
    await expect(page.locator('.mast__meta')).toContainText(
      /Data synced\s+\d{1,2} \w+ \d{4}/,
      { timeout: 15_000 },
    );
  });

  test('publishes build-generated static artifacts', async ({ request }) => {
    for (const path of [
      '/sitemap.xml',
      '/robots.txt',
      '/og-image.png',
      '/favicon.svg',
    ]) {
      const response = await request.get(path);
      expect(response.status(), `${path} should be served`).toBe(200);
    }
  });
});
