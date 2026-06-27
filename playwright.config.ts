import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Retro Football Arena e2e tests.
 * `pnpm test:e2e` (or `bun run test:e2e`) runs these against the dev server.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-landscape',
      use: { ...devices['Pixel 5'], viewport: { width: 740, height: 360 } },
    },
  ],
  webServer: [
    {
      command: 'bun run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'cd mini-services/game-server && bun run dev',
      url: 'http://localhost:3003',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
