import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// The one Playwright smoke, in two parts: the built page loads clean and makes no request beyond its own origin, and
// Round 1 trains to the reckless week in headless Chromium (G2 plan, acceptance 3).
const ORIGIN = 'http://127.0.0.1:4173';

/** Collects every request whose origin is not the page's own. */
function watchRequests(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).origin !== ORIGIN) foreign.push(req.url());
  });
  return foreign;
}

test('the page loads offline-clean', async ({ page }) => {
  const foreign = watchRequests(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Reward the Pack');
  await expect(page.locator('canvas#curve')).toBeVisible();
  await expect(page.locator('#train')).toBeVisible();
  await expect(page.locator('#seed')).toHaveValue('1');
  expect(foreign).toEqual([]);
});

test('Round 1 trains to the reckless week', async ({ page }) => {
  test.setTimeout(150_000);
  const foreign = watchRequests(page);
  await page.goto('/');
  await page.fill('#seed', '1');
  const started = Date.now();
  await page.click('#train');
  await expect(page.locator('#status')).toContainText('stable', { timeout: 120_000 });
  const ms = Date.now() - started;
  const readout = (await page.locator('#readout').textContent()) ?? '';
  expect(readout).toMatch(/accepted every booking on 5 of 5 days/);
  expect(readout).toMatch(/ran the floor with 1 staffer on 4 days/);
  expect(readout).toMatch(/chose nap 0 times/);
  console.log(`[e2e] Round 1 stable in ${ms} ms: ${readout}`);
  expect(ms).toBeLessThan(60_000);
  expect(foreign).toEqual([]);
});
