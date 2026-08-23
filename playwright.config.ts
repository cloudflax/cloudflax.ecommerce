import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // The session-role spec depends on a 2s role-revalidation interval. Only
    // applies when Playwright starts the server itself — with an already
    // running dev server (reuseExistingServer), the override is ignored and
    // that spec will fail. Stop `pnpm dev` before running the suite locally.
    env: { ...process.env, ROLE_REVALIDATE_SECONDS: '2' } as Record<string, string>,
  },
});
