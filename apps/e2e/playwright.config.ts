import { defineConfig } from '@playwright/test';
import { BASE_URL } from './tests/stack';

// The tests share one Docker stack and some of them restart it or delete its volume, so they run
// one at a time. The stack is private to the tests (its own project name, port and volume).
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    launchOptions: {
      // Optional: use an already installed Chromium instead of the one `playwright install` fetches.
      ...(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}),
      // Needed when the browser runs as root, for example in some CI containers.
      ...(process.env.E2E_NO_SANDBOX ? { args: ['--no-sandbox'] } : {}),
    },
  },
});
