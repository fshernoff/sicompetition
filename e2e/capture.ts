// The 30-second screen capture of the pilot (BRIEF section 11, the G5 plan): one paced Round 1 run, recorded in
// headless Chromium at 1366 x 768 against the built page. The owner's own recording on the smartboard is the one
// for the Challenge video; this one is the repeatable stand-in. Shot list: docs/capture.md.
//
//   node e2e/capture.ts [--url URL] [--out DIR] [--seed N] [--hold SECONDS]
//
// Without --url it serves dist/ itself (vite preview on 127.0.0.1:4188). --seed needs the G5 page (the teacher tray).
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { pause, serveDist, stamp, stopServer } from './serve.ts';

const PORT = 4188;
const VIEWPORT = { width: 1366, height: 768 };
const PREDICTION = 'Every dog it can take, one staffer on the floor, and a lot of incidents.';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const outDir = arg('out') ?? 'Temp/capture';
  const seed = arg('seed');
  const hold = Number(arg('hold') ?? '8');
  let url = arg('url');
  let server: ChildProcess | undefined;
  try {
    if (!url) ({ url, server } = await serveDist(PORT));
    mkdirSync(outDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: outDir, size: VIEWPORT } });
      const started = Date.now();
      const page = await context.newPage();
      await page.goto(url);
      if (seed !== undefined) {
        await page.click('#teacher-open');
        await page.fill('#seed', seed);
        await page.click('#teacher-close');
      }
      await pause(2000);
      // The packed-yard picks, made by clicking the visible chips (D56), then the Why.
      for (const chip of ['pick-acceptAll-all', 'pick-rate-premium', 'pick-solo-3-4', 'pick-naps-0', 'pick-incidents-7plus']) {
        await page.click(`label[for="${chip}"]`);
        await pause(500);
      }
      await page.fill('#prediction', PREDICTION);
      await pause(1000);
      await page.click('#train');
      // The run has ended when the button offers another go ("still changing" is also the running sentence).
      await page.waitForFunction(() => document.querySelector('#train')?.textContent === 'Put the GM to work again', undefined, { timeout: 90_000 });
      await pause(hold * 1000);
      const video = page.video();
      await context.close();
      const seconds = (Date.now() - started) / 1000;
      const from = await video?.path();
      if (!from) throw new Error('no video was recorded');
      const to = `${outDir}/reward-the-pack-round1-seed${seed ?? '1'}-${stamp(new Date())}.webm`; // the field's default is 1
      if (existsSync(to)) throw new Error(`${to} already exists; the recording is still at ${from}`);
      renameSync(from, to);
      console.log(`video: ${to}`);
      console.log(`viewport: ${VIEWPORT.width} x ${VIEWPORT.height}`);
      console.log(`length: ${seconds.toFixed(1)} s`);
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
