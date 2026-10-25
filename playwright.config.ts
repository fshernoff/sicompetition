import { defineConfig } from '@playwright/test';

// One smoke test against the production build, served locally. No network beyond localhost.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
