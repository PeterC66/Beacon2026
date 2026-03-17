// beacon2/e2e/playwright.config.js
// Playwright configuration for Beacon2 user acceptance tests.
// Run with: npm test (from the e2e/ directory)

import { defineConfig, devices } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';

// Load .env file when running locally
loadDotenv();

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',

  // Fail fast: stop after first test failure in CI
  // Remove for full runs: maxFailures: 1,

  // Retry flaky tests once in CI
  retries: process.env.CI ? 1 : 0,

  // Run test files in parallel but tests within a file serially
  // (tests within a file often share state — e.g. created member)
  fullyParallel: false,
  workers: process.env.CI ? 1 : 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    // Frontend base URL — set in .env or environment
    baseURL: process.env.BEACON2_BASE_URL ?? 'http://localhost:5173',

    // Capture screenshots and traces on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Standard viewport
    viewport: { width: 1280, height: 800 },

    // Give pages up to 10 s to load
    navigationTimeout: 10_000,
    actionTimeout: 8_000,
  },

  // Global setup creates (or resets) the test tenant before any tests run.
  // Global teardown is optional — leave the tenant in place for debugging.
  globalSetup: './global-setup.js',
  // globalTeardown: './global-teardown.js',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to also run on Firefox / WebKit:
    // { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',   use: { ...devices['Desktop Safari']  } },
  ],

  // Output folder for test artefacts
  outputDir: 'test-results/',
});
