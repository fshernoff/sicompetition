import { expect, test } from '@playwright/test';

// The one Playwright smoke: the built page loads, has the title, draws the canvas, and makes no network request
// beyond its own origin.
test('the page loads offline-clean', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (req) => {
    if (!req.url().startsWith('http://127.0.0.1:4173')) foreign.push(req.url());
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Reward the Pack');
  await expect(page.locator('canvas#yard')).toBeVisible();
  expect(foreign).toEqual([]);
});
