import { defineConfig, devices } from '@playwright/test';

/** Local preview URL used when `E2E_BASE_URL` is unset. Remote example: `https://www.nfldraftsuccess.com` */
const LOCAL_PREVIEW = 'http://localhost:4173';
const baseURL = process.env.E2E_BASE_URL?.trim() || LOCAL_PREVIEW;

function isLocalBaseURL(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return true;
  }
}

const runLocalServer = isLocalBaseURL(baseURL);

export default defineConfig({
  testDir: './e2e',
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
  ...(runLocalServer
    ? {
        webServer: {
          command: 'npm run preview',
          url: LOCAL_PREVIEW,
          reuseExistingServer: !process.env.CI,
        },
      }
    : {}),
});
