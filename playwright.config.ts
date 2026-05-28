import { defineConfig, devices } from '@playwright/test';

const isCrossBrowser = process.env.CROSS_BROWSER === 'true';

const chromiumOnly = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
];

const allBrowsers = [
  ...chromiumOnly,
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
];

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/fixtures/auth-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // En dev, la 1ere requete d'une route declenche une compilation JIT qui
  // peut depasser le defaut Playwright (30s) ; on relache le timeout des
  // tests (le webServer `npm run dev` n'est pas pre-build).
  timeout: 90_000,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: isCrossBrowser ? allBrowsers : chromiumOnly,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
