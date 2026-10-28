// Screenshots of every state of the page for a look review (G5d): each reviewer, the main thread, Astra and the critic,
// reads the same files. Headless Chromium against the built page, after the fonts and every image have loaded.
//
//   node e2e/shots.ts [--url URL] [--out DIR]
//
// Without --url it serves dist/ itself (vite preview on 127.0.0.1:4189). Without --out the files go to
// Temp/shots/<yyyymmdd-hhmmss>/, named in the order a student meets them.
import type { ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { pause, serveDist, stamp, stopServer } from './serve.ts';

const PORT = 4189;
const PACKED = ['pick-acceptAll-all', 'pick-rate-premium', 'pick-solo-3-4', 'pick-naps-0', 'pick-incidents-7plus'];
const WHY = 'It packs the yard with one staffer and never naps, so lots of incidents.';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Waits until the fonts are in and every image on the page has decoded, so a shot never shows a half-loaded page. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
  });
  await pause(400);
}

async function open(browser: Browser, url: string, width: number, height: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url);
  await settled(page);
  return page;
}

async function statusSays(page: Page, words: string, timeout = 90_000): Promise<void> {
  await page.waitForFunction((w) => document.querySelector('#status')?.textContent?.includes(w) ?? false, words, { timeout });
}

async function main(): Promise<void> {
  const outDir = arg('out') ?? `Temp/shots/${stamp(new Date())}`;
  let url = arg('url');
  let server: ChildProcess | undefined;
  try {
    if (!url) ({ url, server } = await serveDist(PORT));
    mkdirSync(outDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const shot = async (page: Page, name: string, fullPage = false): Promise<void> => {
      await page.screenshot({ path: `${outDir}/${name}.png`, fullPage });
      console.log(`${outDir}/${name}.png`);
    };
    try {
      // Round 1 at the Chromebook's size, from the cold load to the report.
      const page = await open(browser, url, 1366, 768);
      await shot(page, '01-load');
      await shot(page, '00-full-page-load', true);
      for (const chip of PACKED) await page.click(`label[for="${chip}"]`);
      await page.fill('#prediction', WHY);
      await shot(page, '02-picks-made');
      await page.click('#train');
      await statusSays(page, 'getting ready');
      await pause(600);
      await shot(page, '03-getting-ready');
      await statusSays(page, 'running the week');
      await pause(3500);
      await shot(page, '04-mid-week');
      await page.waitForFunction(() => document.querySelector('#train')?.textContent === 'Put the GM to work again', undefined, { timeout: 120_000 });
      await pause(1500);
      await shot(page, '05-scorecard');
      await page.locator('#watch').scrollIntoViewIfNeeded();
      await pause(400);
      await shot(page, '06-yard-after');
      await page.locator('#report').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await pause(400);
      await shot(page, '07-report');
      await shot(page, '00-full-page-after', true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click('#teacher-open');
      await pause(600);
      await shot(page, '08-tray');
      await page.close();

      // Round 3 with all six measures on (the longest plan sentence).
      const r3 = await open(browser, url, 1366, 768);
      await r3.click('#teacher-open');
      await r3.check('#round-round3');
      await r3.click('#teacher-close');
      for (const key of ['dogsServed', 'incidents', 'reputation', 'fatigue', 'overRatio']) await r3.check(`#kpi-${key}-on`);
      await pause(400);
      await shot(r3, '09-round3-all-on');
      await r3.close();

      // The stacked layout, and the projector.
      const narrow = await open(browser, url, 1024, 768);
      await shot(narrow, '10-stacked-1024');
      await narrow.close();
      const big = await open(browser, url, 1920, 1080);
      await shot(big, '11-projector-1920');
      for (const chip of PACKED) await big.click(`label[for="${chip}"]`);
      await big.click('#train');
      await statusSays(big, 'running the week');
      await pause(3500);
      await shot(big, '12-projector-mid-week');
      await big.close();
    } finally {
      await browser.close();
    }
  } finally {
    if (server) await stopServer(server);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
