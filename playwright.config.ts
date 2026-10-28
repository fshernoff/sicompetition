import { defineConfig } from '@playwright/test';

// E2E_PORT lets two worktrees run the smoke at once (G5d's parallel packages); 4173 otherwise.
const PORT = Number(process.env.E2E_PORT ?? 4173);

// One smoke test against the production build, served locally. No network beyond localhost.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, headless: true },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
