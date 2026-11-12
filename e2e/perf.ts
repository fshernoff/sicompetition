// The performance probe (G5d acceptance 7): Round 1 on the built page in headless Chromium with the CPU throttled
// (4x by default, a stand-in for a classroom Chromebook), three runs in a row. Prints one JSON line:
//   readyMs     from the click to the week's first frame as drawn, per run (the GM getting ready, then the first block)
//   frameP95Ms  the 95th percentile of the gaps between animation frames while the week plays, per run
//   longTasks   tasks over 50 ms while the week plays (ending after its first frame as drawn), per run
//   heapMB      the JS heap after the third run and a garbage collection
//
//   node e2e/perf.ts [--url URL] [--cpu 4]
//
// It exits non-zero past the thresholds (G6 acceptance 6): any long task while the week plays, in any run, or a heap
// over 5.2 MB after the third run. The owner's Chromebook is the real check; this is the regression guard the look is
// measured against.
import type { ChildProcess } from 'node:child_process';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { pause, serveDist, stopServer } from './serve.ts';

const PORT = Number(process.env.PERF_PORT ?? 4196); // not 4190: the fetch standard blocks it ("bad port")
const PACKED = ['pick-acceptAll-all', 'pick-rate-premium', 'pick-solo-3-4', 'pick-naps-0', 'pick-incidents-7plus'];
/** The thresholds (G6 acceptance 6): no long task while the week plays, and the heap after three runs. */
const MAX_LONG_TASKS = 0;
const MAX_HEAP_MB = 5.2;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function p95(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

type Probe = { gaps: number[]; playing: number; first: number; stop: boolean; tasks: { start: number; end: number }[]; installed?: boolean };

/**
 * One run from the click: the time to the week's first frame, then the frame gaps and long tasks until it ends.
 *
 * The long tasks (G6; Astra, A1): every entry the observer reports is kept with its start and end, and classified after
 * the run against the week's first frame as the page draws it: the moment the rail is first written while the status
 * says the GM is running the week (the rail is written in the frame that draws the yard's first block). A task counts
 * when it ends after that moment, so the first frame's own task and any task after it count, and the getting ready's
 * last task (the engine's last slice, which writes the status and ends before that frame) does not, though the
 * observer may report it later.
 */
async function run(page: Page, button: string): Promise<{ readyMs: number; frameP95Ms: number; longTasks: number }> {
  await page.evaluate(() => {
    const w = window as unknown as { __perf: Probe };
    const fresh = { gaps: [], playing: 0, first: 0, stop: false, tasks: [] };
    if (w.__perf?.installed) {
      Object.assign(w.__perf, fresh);
    } else {
      // Installed once for the page: an observer per run would report each task to every earlier run's observer too.
      w.__perf = { ...fresh, installed: true };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__perf.tasks.push({ start: e.startTime, end: e.startTime + e.duration });
      }).observe({ type: 'longtask' });
      const rail = document.querySelector('#rail-live');
      if (rail !== null) {
        new MutationObserver(() => {
          const running = document.querySelector('#status')?.textContent?.includes('running the week') ?? false;
          if (running && w.__perf.first === 0) w.__perf.first = performance.now();
        }).observe(rail, { childList: true, characterData: true, subtree: true });
      }
    }
    let last = 0;
    const tick = (t: number): void => {
      const playing = document.querySelector('#status')?.textContent?.includes('running the week') ?? false;
      if (playing && !w.__perf.playing) w.__perf.playing = performance.now();
      if (playing && last) w.__perf.gaps.push(t - last);
      last = playing ? t : 0;
      if (!w.__perf.stop) requestAnimationFrame(tick);
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
    const w = window as unknown as { __perf: Probe };
    w.__perf.stop = true;
    return { gaps: w.__perf.gaps, playing: w.__perf.playing, first: w.__perf.first, tasks: w.__perf.tasks };
  });
  if (m.first === 0) throw new Error('perf: the week\'s first frame was not seen (the rail was never written)');
  const longTasks = m.tasks.filter((t) => t.end > m.first).length;
  return { readyMs: Math.round(m.first - clicked), frameP95Ms: Math.round(p95(m.gaps) * 10) / 10, longTasks };
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
      const heapRaw = heap.usedSize / 1048576; // compared unrounded (A3); rounded only where it is printed
      const heapMB = Math.round(heapRaw * 10) / 10;
      console.log(JSON.stringify({ cpu, runs, heapMB }));
      const over: string[] = [];
      const longest = Math.max(...runs.map((r) => r.longTasks));
      if (longest > MAX_LONG_TASKS) over.push(`${longest} long tasks in a run (at most ${MAX_LONG_TASKS})`);
      if (heapRaw > MAX_HEAP_MB) over.push(`heap ${heapRaw.toFixed(3)} MB (at most ${MAX_HEAP_MB} MB)`);
      if (over.length > 0) {
        console.error(`perf: past the thresholds: ${over.join('; ')}`);
        process.exitCode = 1;
      }
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
