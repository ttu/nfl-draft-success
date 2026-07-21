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

interface PageProblems {
  readonly consoleErrors: string[];
  readonly failedRequests: string[];
}

/**
 * Records same-origin subresource failures and console errors for the page.
 *
 * The main document is excluded: GitHub Pages answers any deep link with
 * `404.html` under an HTTP 404 status, which is the SPA fallback working as
 * intended, not a broken deployment.
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

  test('deep link renders the app via the SPA fallback', async ({
    page,
    baseURL,
  }) => {
    const problems = watchForProblems(page, baseURL);

    // A direct load — not client-side navigation — is the only thing that
    // exercises `404.html`. Static hosts serve it with a 404 status, so the
    // assertion is on rendered content rather than on `response.status()`.
    await page.goto('/DET?from=2021&to=2025');

    await expect(page.locator('.team-hero')).toBeVisible();
    await expect(page.locator('.team-hero__abbrev')).toHaveText('DET');
    expect(problems.failedRequests).toEqual([]);
  });

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
