import { defineConfig, devices } from '@playwright/test';

/**
 * Default local target: `vite` dev server (`vite.config.ts` server.port).
 * Use `E2E_BASE_URL=http://localhost:4173` (or `npm run test:e2e:preview`) to test `dist/` via `vite preview`.
 * Remote example: `https://www.nfldraftsuccess.com`
 */
const LOCAL_DEV = 'http://localhost:3273';
const LOCAL_PREVIEW = 'http://localhost:4173';
const baseURL = process.env.E2E_BASE_URL?.trim() || LOCAL_DEV;

function isLocalBaseURL(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return true;
  }
}

function localWebServer():
  { command: string; url: string; reuseExistingServer: boolean } | undefined {
  if (!isLocalBaseURL(baseURL)) return undefined;
  let u: URL;
  try {
    u = new URL(baseURL);
  } catch {
    return undefined;
  }
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');

  if (port === '4173') {
    return {
      command: 'pnpm run preview',
      url: LOCAL_PREVIEW,
      reuseExistingServer: !process.env.CI,
    };
  }

  if (port === '3273') {
    return {
      command: 'pnpm run dev',
      url: LOCAL_DEV,
      reuseExistingServer: !process.env.CI,
    };
  }

  return undefined;
}

const webServer = localWebServer();

export default defineConfig({
  testDir: './e2e',
  // A cold Vite dev server compiles on first request, and `fullyParallel` has
  // several workers racing for that first response. On an idle machine a test
  // takes ~2s, but under load the default 30s budget has proven too thin — a
  // genuine hang still fails the run, just later.
  timeout: 60_000,
  expect: {
    // Range changes re-fetch draft-class JSON before the UI settles.
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(webServer ? { webServer } : {}),
});
