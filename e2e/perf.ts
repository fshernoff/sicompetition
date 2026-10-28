// The performance probe (G5d acceptance 7): Round 1 on the built page in headless Chromium with the CPU throttled
// (4x by default, a stand-in for a classroom Chromebook), three runs in a row. Prints one JSON line:
//   readyMs     from the click to the week's first frame, per run (the GM getting ready, then the first block drawn)
//   frameP95Ms  the 95th percentile of the gaps between animation frames while the week plays, per run
//   longTasks   tasks over 50 ms while the week plays, per run
//   heapMB      the JS heap after the third run and a garbage collection
//
//   node e2e/perf.ts [--url URL] [--cpu 4]
//
// The owner's Chromebook is the real check; this is the regression guard the look is measured against.
import type { ChildProcess } from 'node:child_process';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { pause, serveDist, stopServer } from './serve.ts';

const PORT = 4196; // not 4190: the fetch standard blocks it ("bad port")
const PACKED = ['pick-acceptAll-all', 'pick-rate-premium', 'pick-solo-3-4', 'pick-naps-0', 'pick-incidents-7plus'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function p95(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

/** One run from the click: the time to the week's first frame, then the frame gaps and long tasks until it ends. */
async function run(page: Page, button: string): Promise<{ readyMs: number; frameP95Ms: number; longTasks: number }> {
  await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[]; __long: number; __playing: number; __stop: boolean };
    w.__stop = false;
    w.__gaps = [];
    w.__long = 0;
    w.__playing = 0;
    new PerformanceObserver((list) => {
      if (w.__playing) w.__long += list.getEntries().length;
    }).observe({ type: 'longtask' });
    let last = 0;
    const tick = (t: number): void => {
      const playing = document.querySelector('#status')?.textContent?.includes('running the week') ?? false;
      if (playing && !w.__playing) w.__playing = performance.now();
      if (playing && last) w.__gaps.push(t - last);
      last = playing ? t : 0;
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const clicked = await page.evaluate(() => performance.now());
  await page.click(button);
  // Wait for this run to start (the last run's status still says the week is over) before waiting for it to end.
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('getting ready') ?? false, undefined, { timeout: 30_000 });
  // The button keeps "again" through a rerun; the status line says when the week is over.
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('The week is over') ?? false, undefined, { timeout: 300_000 });
  await pause(500);
  const m = await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[]; __long: number; __playing: number; __stop: boolean };
    w.__stop = true;
    return { gaps: w.__gaps, long: w.__long, playing: w.__playing };
  });
  return { readyMs: Math.round(m.playing - clicked), frameP95Ms: Math.round(p95(m.gaps) * 10) / 10, longTasks: m.long };
}

async function main(): Promise<void> {
  const cpu = Number(arg('cpu') ?? '4');
  let url = arg('url');
  let server: ChildProcess | undefined;
  try {
    if (!url) ({ url, server } = await serveDist(PORT));
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await page.goto(url);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      for (const chip of PACKED) await page.click(`label[for="${chip}"]`);
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await run(page, '#train'));
      await cdp.send('HeapProfiler.collectGarbage');
      const heap = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
      console.log(JSON.stringify({ cpu, runs, heapMB: Math.round((heap.usedSize / 1048576) * 10) / 10 }));
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
