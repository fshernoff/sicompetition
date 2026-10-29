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

const PORT = Number(process.env.SHOTS_PORT ?? 4189); // a parallel worktree passes its own
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

async function weekOver(page: Page): Promise<void> {
  // The status line, not the button: a rerun's button reads "again" from the start.
  await statusSays(page, 'getting ready');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('The week is over') ?? false, undefined, { timeout: 120_000 });
  await pause(1500);
}

async function pick(page: Page, chips: string[]): Promise<void> {
  for (const chip of chips) await page.click(`label[for="${chip}"]`);
}

/** Sets a measure's slider the way a drag ends: the value, then input and change. */
async function slide(page: Page, key: string, value: number): Promise<void> {
  await page.locator(`#kpi-${key}-weight`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function toRound3(page: Page): Promise<void> {
  await page.click('#teacher-open');
  await page.check('#round-round3');
  await page.click('#teacher-close');
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
      await shot(page, '03-getting-ready'); // at once: getting ready can take under 600 ms
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

      // The stress states (G5d plan review, finding 9).
      const missed = await open(browser, url, 1366, 768);
      await pick(missed, ['pick-acceptAll-none', 'pick-rate-low', 'pick-solo-0', 'pick-naps-6plus', 'pick-incidents-0-2']);
      await missed.click('#train');
      await weekOver(missed);
      await shot(missed, '13-scorecard-all-missed');
      await missed.close();

      const mixed = await open(browser, url, 1366, 768);
      await pick(mixed, ['pick-acceptAll-all', 'pick-rate-low', 'pick-solo-3-4', 'pick-naps-1-5', 'pick-incidents-7plus']);
      await mixed.fill('#prediction', 'We think it will take every booking it can because profit is all it is paid on, keep one staffer on the floor to save on wages, skip naps because a nap block earns nothing, and the yard will get crowded enough that incidents pile up by the end of the week, especially on the busy days.');
      await shot(mixed, '14-long-why');
      await mixed.click('#train');
      await weekOver(mixed);
      await shot(mixed, '15-scorecard-mixed');
      await mixed.close();

      const extremes = await open(browser, url, 1366, 768);
      await toRound3(extremes);
      for (const key of ['dogsServed', 'incidents', 'reputation', 'fatigue', 'overRatio']) await extremes.check(`#kpi-${key}-on`);
      for (const [key, v] of [['profit', 10], ['dogsServed', -10], ['incidents', -10], ['reputation', 10], ['fatigue', -10], ['overRatio', -10]] as const) await slide(extremes, key, v);
      await pause(400);
      await shot(extremes, '16-sliders-extremes');
      await extremes.close();

      const careful = await open(browser, url, 1366, 768);
      await toRound3(careful);
      for (const key of ['incidents', 'fatigue', 'overRatio']) await careful.check(`#kpi-${key}-on`);
      for (const key of ['incidents', 'fatigue', 'overRatio']) await slide(careful, key, -10);
      await pick(careful, ['pick-acceptAll-some', 'pick-rate-standard', 'pick-solo-0', 'pick-naps-6plus', 'pick-incidents-0-2']);
      await careful.click('#train');
      await statusSays(careful, 'running the week');
      await pause(3500);
      await shot(careful, '17-careful-mid-week');
      await careful.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('The week is over') ?? false, undefined, { timeout: 120_000 });
      await pause(1500);
      await shot(careful, '18-careful-scorecard');
      await careful.locator('#report').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await pause(400);
      await shot(careful, '19-careful-report');
      await careful.close();

      // The drawn yard, when the art cannot load.
      const vector = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      await vector.route(/\.(webp|png|svg)(\?.*)?$/, (route) => route.abort());
      await vector.goto(url);
      await settled(vector);
      await pick(vector, PACKED);
      await vector.click('#train');
      await statusSays(vector, 'running the week');
      await pause(3500);
      await shot(vector, '20-fallback-yard-mid-week');
      await vector.close();

      // The tray after a run, at the stacked width.
      const narrowRun = await open(browser, url, 1024, 768);
      await pick(narrowRun, PACKED);
      await narrowRun.click('#train');
      await weekOver(narrowRun);
      await narrowRun.click('#teacher-open');
      await pause(600);
      await shot(narrowRun, '21-tray-after-run-1024');
      await narrowRun.close();
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
