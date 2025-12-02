import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: '.cache/test-results',
  reporter: [
    ['./src/clean-reporter.ts']
  ],
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    ignoreHTTPSErrors: true,
  },
});