import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Trainer } from '../src/learn/train.ts';
import { describeWeek, outcomeKey } from '../src/sim/readout.ts';
import { formatMoney, withCents } from '../src/ui/report.ts';
import { setWeight, toggleKpi } from '../src/world/bonusPlan.ts';
import { loadDefaultConfig, loadPreset } from '../src/world/config.ts';
import { STUDENT_ALLOWED, STUDENT_BANS, aiWords } from '../tests/ui/bans.ts';

// The one Playwright smoke, in parts: the built page loads clean and makes no request beyond its own origin, the
// teacher panel is closed by default and holds the teacher's controls (G5), and Round 1 trains to the reckless week
// in headless Chromium (G2 plan, acceptance 3) with its export equal to a node-side twin (G5). Since G5b the student
// sees the GM as a person (D50): the engine trains out of sight, then the GM's one week plays and the readout follows.
const ORIGIN = `http://127.0.0.1:${process.env.E2E_PORT ?? 4173}`; // playwright.config.ts's port

/** The fixed keys of an export (BRIEF section 11; the export test pins the same list). */
const EXPORT_KEYS = ['app', 'config', 'curve', 'evaluations', 'exportedAt', 'learner', 'plan', 'planWords', 'prediction', 'predictionCheck', 'predictionPicks', 'readout', 'round', 'seed', 'version'].sort();
/** The packed-yard prediction (D56): Round 1 on seed 1 calls all five. */
const PACKED = { acceptAll: 'all', rate: 'premium', solo: '3-4', naps: '0', incidents: '7plus' } as const;

/** The student's status sentences (src/ui/status.ts, D50). */
const IDLE = 'Write your prediction, then put the GM to work.';
const PREPARING = 'The GM is getting ready for Monday.';
const PLAYING = 'The GM is running the week.';
const DONE = 'The week is over.'; // BRIEF section 1 (G5d round 2, row 26)
const CHANGED = 'The plan changed. Put the GM to work to see what it does with this one.';

/**
 * Installs, before a click, a sampler that runs every animation frame inside the page while the status says the GM
 * is getting ready, and records what the yard and the readout show in that frame: so a short wait is sampled whole,
 * in the browser, not by separate round trips that can miss it (Astra, G5b diff review).
 */
async function samplePreparing(page: Page): Promise<void> {
  await page.evaluate((preparing) => {
    const samples: { drawn: number; sig: number; readout: string; reportHidden: boolean; week: string }[] = [];
    (window as unknown as { __prep?: typeof samples }).__prep = samples;
    const canvas = document.querySelector('#replay') as HTMLCanvasElement;
    const tick = (): void => {
      const status = document.querySelector('#status')?.textContent ?? '';
      if (status === preparing) {
        const ctx = canvas.getContext('2d');
        const d = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : new Uint8ClampedArray(4);
        let differ = 0;
        let sig = 0; // the picture's signature: equal for the same picture
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) differ++;
          sig += (d[i] as number) + 3 * (d[i + 1] as number) + 7 * (d[i + 2] as number) + 11 * (d[i + 3] as number);
        }
        samples.push({
          drawn: differ / (d.length / 4),
          sig,
          readout: document.querySelector('#readout')?.textContent ?? '',
          reportHidden: (document.querySelector('#report') as HTMLElement | null)?.hidden === true,
          week: canvas.getAttribute('data-week') ?? '',
        });
      }
      if (samples.length < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, PREPARING);
}

/** The frames sampled while the GM was getting ready: each shows the placeholder only and nothing of the readout. */
async function expectPreparingClean(page: Page): Promise<number> {
  const samples = await page.evaluate(() => (window as unknown as { __prep?: { drawn: number; readout: string; reportHidden: boolean; week: string }[] }).__prep ?? []);
  expect(samples.length).toBeGreaterThan(0);
  for (const x of samples) {
    expect(x.drawn).toBeLessThan(0.02); // the placeholder's line of text, never a yard
    expect(x.readout).toBe('');
    expect(x.reportHidden).toBe(true);
    expect(x.week).toBe('preparing');
  }
  return samples.length;
}

/**
 * How many different pictures the yard showed among the sampled getting-ready frames that drew anything (the orb on the
 * roof and its label): more than one while the orb breathes, one under reduced motion (G5d round 3, row 10).
 */
async function preparingPictures(page: Page): Promise<number> {
  const samples = await page.evaluate(() => (window as unknown as { __prep?: { drawn: number; sig: number }[] }).__prep ?? []);
  return new Set(samples.filter((x) => x.drawn > 0).map((x) => x.sig)).size;
}

/** Waits for the run to end as a student sees it: the week has played and the readout is out. */
async function weekOver(page: Page, timeout = 90_000): Promise<void> {
  await expect(page.locator('#status')).toHaveText(DONE, { timeout });
  await expect(page.locator('#train')).toHaveText('Put the GM to work again');
  await expect(page.locator('#train')).toBeEnabled();
}

/** The share of a canvas's pixels that differ from its first pixel: about 0 for the placeholder, well above 0.05 for the yard. */
async function drawnFraction(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let differ = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) differ++;
    return differ / (d.length / 4);
  });
}

/** The status texts the page has written so far, recorded by the observer installed before the click. */
async function statusLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __statusLog?: string[] }).__statusLog ?? []);
}

/** Collects every request whose origin is not the page's own. */
function watchRequests(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).origin !== ORIGIN) foreign.push(req.url());
  });
  return foreign;
}

/** Opens the teacher tray (the tab in the corner) if it is closed. */
/**
 * Makes the five picks (D56) the way a student does: a click on each visible chip (the label of the radio
 * "#pick-<field>-<value>"), never a forced check (Astra, G5c plan review), and the radio is then checked.
 */
async function makePicks(page: Page, picks: Record<string, string> = PACKED): Promise<void> {
  for (const [field, value] of Object.entries(picks)) {
    await page.click(`label[for="pick-${field}-${value}"]`);
    await expect(page.locator(`#pick-${field}-${value}`)).toBeChecked();
  }
}

async function openTray(page: Page): Promise<void> {
  if (await page.locator('#teacher').isHidden()) await page.click('#teacher-open');
  await expect(page.locator('#teacher')).toBeVisible();
}

/** Presses Export and returns the downloaded document and its suggested filename. */
async function exportRun(page: Page): Promise<{ file: Record<string, unknown>; name: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const path = await download.path();
  expect(path).not.toBeNull();
  return { file: JSON.parse(readFileSync(path as string, 'utf8')) as Record<string, unknown>, name: download.suggestedFilename() };
}

/** Two animation frames, so anything a cleared run might still have scheduled has had its turn. */
async function twoFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/**
 * The page's text under the open tray (G5d round 4): every visible line of text outside the tray, cut to what its
 * scrolling ancestors show, whose box meets the tray's box. Empty when no line of the page is under the tray.
 */
async function textUnderTray(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const tray = document.querySelector('#teacher');
    if (!(tray instanceof HTMLElement) || tray.hidden) return ['(the tray is not open)'];
    const t = tray.getBoundingClientRect();
    const hits: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const host = node.parentElement;
      if (text === '' || host === null || tray.contains(host) || getComputedStyle(host).visibility !== 'visible') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        let top = r.top;
        let bottom = r.bottom;
        let left = r.left;
        let right = r.right;
        for (let a: Element | null = host; a !== null && a !== document.documentElement; a = a.parentElement) {
          const style = getComputedStyle(a);
          if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
          const clip = a.getBoundingClientRect();
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
        }
        if (bottom - top < 2 || right - left < 2) continue; // clipped away, or a screen reader's 1 px text
        if (top < t.bottom && bottom > t.top && left < t.right && right > t.left) hits.push(`"${text.slice(0, 40)}" at ${Math.round(top)} px (tray top ${Math.round(t.top)})`);
      }
    }
    return hits;
  });
}

/** Lines of the page cut by the open tray's top edge: shown above it only in part (G5d round 4). */
async function linesCutAtTrayEdge(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const tray = document.querySelector('#teacher');
    if (!(tray instanceof HTMLElement) || tray.hidden) return ['(the tray is not open)'];
    const edge = tray.getBoundingClientRect().top;
    const hits: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const host = node.parentElement;
      if (text === '' || host === null || tray.contains(host) || host.closest('.visually-hidden') !== null) continue;
      if (getComputedStyle(host).visibility !== 'visible') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        if (r.height >= 2 && r.width >= 2 && r.top < edge - 1 && r.bottom > edge + 1) hits.push(`"${text.slice(0, 40)}" ${Math.round(r.top)} to ${Math.round(r.bottom)} px (edge ${Math.round(edge)})`);
      }
    }
    // A text box's lines too (the Why quoted after the week): its value is not a text node (G6, R4).
    for (const box of Array.from(document.querySelectorAll('textarea'))) {
      if (tray.contains(box) || box.getClientRects().length === 0 || box.value.trim() === '') continue;
      const cs = getComputedStyle(box);
      const line = parseFloat(cs.lineHeight);
      const r = box.getBoundingClientRect();
      const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) - box.scrollTop;
      const count = Math.round((box.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / line);
      for (let i = 0; i < count; i++) {
        const a = Math.max(top + i * line, r.top);
        const b = Math.min(top + (i + 1) * line, r.bottom);
        if (b - a >= 2 && a < edge - 1 && b > edge + 1) hits.push(`the Why's line ${i + 1} ${Math.round(a)} to ${Math.round(b)} px (edge ${Math.round(edge)})`);
      }
    }
    return hits;
  });
}

test('the page loads offline-clean, the tray closed, the rules hidden', async ({ page }) => {
  const foreign = watchRequests(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Reward the Pack');
  // The built page references its assets by relative paths (D2: the same dist/ works on Netlify and on a subpath).
  const html = await (await page.request.get('/')).text();
  expect(html).toMatch(/src="\.\/assets\//);
  expect(html).not.toMatch(/src="\/assets\//);
  expect(html).not.toMatch(/https?:\/\//);
  expect(html).not.toContain('10 dogs per staffer'); // the safe ratio is H1's number until the teacher reveals it (D43)
  await expect(page.locator('canvas#replay')).toBeVisible();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'none');
  await expect(page.locator('#replay-caption')).toHaveText("The GM's week");
  await expect(page.locator('#readout-label')).toHaveText('What the GM did');
  await expect(page.locator('#learning')).toBeHidden(); // no learning curve on the student's page (D50)
  await expect(page.locator('canvas#curve')).toBeHidden();
  await expect(page.locator('#report')).toBeHidden();
  await expect(page.locator('#report-table tr')).toHaveCount(0);
  await expect(page.locator('#replay-again')).toBeHidden();
  await expect(page.locator('#train')).toBeVisible();
  // The student's page: the round is a line, the teacher's controls are in the tray, which is closed (D34, D39).
  await expect(page.locator('#round-label')).toHaveText('Round 1: profit only');
  await expect(page.locator('#teacher')).toBeHidden();
  await expect(page.locator('#teacher-open')).toBeVisible();
  await expect(page.locator('#teacher-open')).toHaveText('Teacher');
  await expect(page.locator('#seed')).toBeHidden();
  await expect(page.locator('#speed')).toHaveCount(0); // no speed control (D52)
  await expect(page.locator('#rules')).toBeHidden();
  await expect(page.locator('#seed')).toHaveValue('1');
  // The tray: the check line before a run, the export off, Normal speed, Round 1.
  await openTray(page);
  await expect(page.locator('#check')).toHaveText('No run yet.');
  await expect(page.locator('#export')).toBeDisabled();
  await expect(page.locator('#reveal')).toBeEnabled();
  await expect(page.locator('#show-curve')).toHaveText('Show the learning curve');
  await expect(page.locator('#round-round1')).toBeChecked();
  // Reveal the hidden rules: twelve lines on the page, H1's safe ratio among them; a second press hides them.
  await page.click('#reveal');
  await expect(page.locator('#rules')).toBeVisible();
  await expect(page.locator('#rules-list li')).toHaveCount(12);
  await expect(page.locator('#rules-list')).toContainText('Up to 10 dogs per staffer');
  await expect(page.locator('#rules-list')).toContainText('H12');
  await expect(page.locator('#rules')).not.toContainText(/injur/i);
  await expect(page.locator('#reveal')).toHaveText('Hide the hidden rules');
  await page.click('#reveal');
  await expect(page.locator('#rules')).toBeHidden();
  await expect(page.locator('#reveal')).toHaveText('Reveal the hidden rules');
  // A bad seed, left by the teacher with the tray closed, never reaches the student's status (Astra, plan review).
  await page.fill('#seed', '');
  await page.click('#teacher-close');
  await expect(page.locator('#teacher')).toBeHidden();
  await makePicks(page);
  await page.click('#train');
  await expect(page.locator('#teacher')).toBeVisible();
  await expect(page.locator('#check')).toContainText('whole number');
  await expect(page.locator('#seed')).toBeFocused();
  await expect(page.locator('#status')).toHaveText(IDLE);
  await expect(page.locator('#train')).toBeEnabled();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'none');
  await page.fill('#seed', '1');
  await page.click('#teacher-close');
  await expect(page.locator('#teacher')).toBeHidden();
  expect(foreign).toEqual([]);
});

test('Round 1: the GM runs its week, the readout follows, and the export is the twin\'s week', async ({ page }) => {
  test.setTimeout(150_000);
  const foreign = watchRequests(page);
  await page.setViewportSize({ width: 1366, height: 768 }); // the Chromebook (G4 plan, the fold)
  await page.goto('/');
  // Put the GM to work is within reach on the Chromebook without scrolling (the target is 680, the gate 700).
  const trainBox = await page.locator('#train').boundingBox();
  expect(trainBox).not.toBeNull();
  const trainBottom = (trainBox?.y ?? 0) + (trainBox?.height ?? 0);
  console.log(`[e2e] Train's bottom on load at 1366 wide: ${Math.round(trainBottom)} px`);
  expect(trainBottom).toBeLessThanOrEqual(700);
  // The tray open: the button is still above it and has not moved (G5 plan: the tray overlays, D46).
  await openTray(page);
  const trayBox = await page.locator('#teacher').boundingBox();
  expect(trayBox).not.toBeNull();
  console.log(`[e2e] the tray open at 1366 × 768: top ${Math.round(trayBox?.y ?? 0)} px, height ${Math.round(trayBox?.height ?? 0)} px`);
  expect((trayBox?.y ?? 0) + (trayBox?.height ?? 0)).toBeLessThanOrEqual(768);
  const trainBoxOpen = await page.locator('#train').boundingBox();
  const trainBottomOpen = (trainBoxOpen?.y ?? 0) + (trainBoxOpen?.height ?? 0);
  expect(trainBottomOpen).toBe(trainBottom);
  expect(trainBottomOpen).toBeLessThanOrEqual(trayBox?.y ?? 0);
  await page.fill('#seed', '1');
  await expect(page.locator('#export')).toBeDisabled();
  const prediction = 'All the dogs it can take, one staffer, lots of incidents.';
  await page.fill('#prediction', prediction);
  // Every status text from the click is one of the person's sentences (D50). The observer logs each mutation record's
  // own text, so two writes in one task are both seen (Astra, plan review); none may carry a number.
  await page.evaluate(() => {
    const el = document.querySelector('#status');
    const log: string[] = [];
    (window as unknown as { __statusLog?: string[] }).__statusLog = log;
    if (!el) return;
    log.push(el.textContent ?? '');
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') log.push(r.target.textContent ?? '');
        for (const n of Array.from(r.addedNodes)) log.push(n.textContent ?? '');
      }
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  // The replay's data-week from the click, every value in order (attributeOldValue gives each one it held):
  // "preparing" while the GM gets ready, "final" once its week is on the yard.
  await page.evaluate(() => {
    const el = document.querySelector('#replay');
    const log: string[] = [];
    (window as unknown as { __weekLog?: string[] }).__weekLog = log;
    if (!el) return;
    new MutationObserver((records) => {
      for (const r of records) log.push(r.oldValue ?? '');
    }).observe(el, { attributes: true, attributeFilter: ['data-week'], attributeOldValue: true });
  });
  // Put the GM to work waits for the five picks (D56): predict before the run.
  await expect(page.locator('#train')).toBeDisabled();
  await expect(page.locator('#picks-hint')).toHaveText('Make all five picks to put the GM to work.');
  await makePicks(page, { acceptAll: 'all', rate: 'premium', solo: '3-4', naps: '0' });
  await expect(page.locator('#train')).toBeDisabled();
  await makePicks(page);
  await expect(page.locator('#train')).toBeEnabled();
  await expect(page.locator('#picks-hint')).toBeHidden();
  await samplePreparing(page);
  const started = Date.now();
  await page.click('#train');
  // The week plays: every control stays off until the readout is out (D51).
  await expect(page.locator('#status')).toHaveText(PLAYING, { timeout: 60_000 });
  await expect(page.locator('#scorecard')).toBeHidden(); // nothing of the result before the week is over (D51)
  await expect(page.locator('input[name^="pick-"]:enabled')).toHaveCount(0); // the picks lock with the run
  for (const id of ['#prediction', '#round-round1', '#round-round2', '#kpi-profit-on', '#kpi-profit-weight', '#seed', '#train', '#export']) {
    await expect(page.locator(id)).toBeDisabled();
  }
  await expect(page.locator('#reveal')).toBeEnabled(); // the teacher may reveal the rules at any time
  // While the week plays the readout is not out yet: the sentence, the table and the watch-again button wait (D51).
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#report')).toBeHidden();
  await expect(page.locator('#replay-again')).toBeHidden();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'final');
  // The fold while the week plays: the page scrolled to the yard, which sits whole above the open tray.
  const geometry = () =>
    page.evaluate(() => {
      const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? new DOMRect(-1, -1, 0, 0);
      const tray = document.querySelector('#teacher') as HTMLElement | null;
      return {
        statusTop: Math.round(box('#status').top),
        barBottom: Math.round(box('.topbar').bottom), // the slim brand bar stays at the top while the week plays
        replayWidth: Math.round(box('#replay').width),
        replayBottom: Math.round(box('#replay').bottom),
        replayCaptionBottom: Math.round(box('#replay-caption').bottom),
        compareTop: Math.round(box('.compare').top),
        compareBottom: Math.round(box('.compare').bottom),
        trayTop: tray && !tray.hidden ? Math.round(tray.getBoundingClientRect().top) : window.innerHeight,
        // The rail's last line while the week plays: the whole rail fits the window (G5d round 2 follow-up; the status
        // is pinned under the brand bar then, so the rail cannot scroll).
        railLast: Math.round(
          Array.from(document.querySelectorAll('#rail-live p, #rail-live .meter-name, #rail-live .meter-num'))
            .filter((el) => el.getClientRects().length > 0)
            .reduce((bottom, el) => Math.max(bottom, el.getBoundingClientRect().bottom), 0),
        ),
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        status: document.querySelector('#status')?.textContent ?? '',
      };
    });
  await expect
    .poll(async () => {
      const g = await geometry();
      return g.status === PLAYING && g.barBottom > 0 && g.statusTop >= g.barBottom && g.statusTop <= g.barBottom + 16 && g.replayBottom <= g.trayTop && g.replayCaptionBottom <= g.trayTop && g.scrollWidth <= 1366;
    }, { timeout: 5_000, message: 'the week playing, the status just under the brand bar and the yard and its caption above the open tray' })
    .toBe(true);
  const during = await geometry();
  console.log(`[e2e] while the week plays: ${JSON.stringify(during)}`);
  expect(during.replayWidth).toBeGreaterThanOrEqual(560); // the yard is big now, even above an open tray (G4's question)
  expect(during.railLast).toBeGreaterThan(0);
  expect(during.railLast).toBeLessThanOrEqual(during.innerHeight); // the rail's last line in the window at 1366 × 768
  // The day's choices read in the page's ink at 15 px, and "per play block" never splits across two lines (G6, row 9; the
  // whole add-on, "+ $10 a dog per play block", is kept on one line).
  const choices = await page.locator('#rail-live .choices').evaluate((el) => {
    const style = getComputedStyle(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let lines = -1;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const at = node.textContent?.indexOf('per play block') ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 'per play block'.length);
      lines = new Set(Array.from(range.getClientRects(), (r) => Math.round(r.top))).size;
    }
    return { color: style.color, size: style.fontSize, lines };
  });
  expect(choices).toEqual({ color: 'rgb(19, 33, 47)', size: '15px', lines: 1 });
  // The week is over: the readout is out and the page has scrolled back to the prediction beside what the GM did.
  await weekOver(page);
  const ms = Date.now() - started;
  const samples = await statusLog(page);
  expect(samples[0]).toBe(IDLE); // before the click
  const seen = samples.slice(1);
  expect(seen).toContain(PREPARING);
  expect(seen).toContain(PLAYING);
  expect(seen[seen.length - 1]).toBe(DONE);
  for (const text of seen) {
    expect([PREPARING, PLAYING, DONE]).toContain(text);
    expect(text).not.toMatch(/\d/); // no weeks count, no seconds, nothing of the engine (D50)
  }
  const weeks = [...(await page.evaluate(() => (window as unknown as { __weekLog?: string[] }).__weekLog ?? [])), (await page.locator('#replay').getAttribute('data-week')) ?? ''];
  console.log(`[e2e] data-week from the click: ${weeks.join(' → ')}`);
  // Exactly these states, in this order, and nothing else (one week on the yard, never another; D50).
  expect(weeks.filter((w, i) => i === 0 || w !== weeks[i - 1])).toEqual(['none', 'preparing', 'final']);
  console.log(`[e2e] frames sampled while the GM got ready (Round 1): ${await expectPreparingClean(page)}`);
  expect(await preparingPictures(page)).toBeGreaterThan(1); // the orb breathes while the GM gets ready
  await expect(page.locator('#replay')).toHaveAttribute('data-plays', '1'); // the week played once, nothing before it
  for (const id of ['#prediction', '#round-round1', '#seed', '#export']) await expect(page.locator(id)).toBeEnabled();
  await expect(page.locator('#kpi-profit-on')).toBeDisabled(); // Round 1's own lock is back, not the run's
  await expect(page.locator('#kpi-profit-weight')).toBeDisabled();
  const readout = (await page.locator('#readout').textContent()) ?? '';
  expect(readout).toMatch(/accepted every booking on 5 of 5 days/);
  // The prediction card is a scorecard now: each pick beside what the GM did (D56).
  await expect(page.locator('#scorecard [data-field]')).toHaveCount(5);
  await expect(page.locator('#scorecard [data-called="true"]')).toHaveCount(5);
  await expect(page.locator('#called-line')).toHaveText('You called 5 of 5.');
  expect(readout).toMatch(/ran the floor with one staffer on 4 days/); // BRIEF section 10's clauses (G5d round 2, row 23)
  expect(readout).toMatch(/never had the dogs nap/);
  await expect
    .poll(async () => {
      const g = await geometry();
      return g.compareTop >= 0 && g.compareBottom <= g.trayTop;
    }, { timeout: 5_000, message: 'the prediction and what the GM did, side by side in view above the tray' })
    .toBe(true);
  console.log(`[e2e] after the week: ${JSON.stringify(await geometry())}`);
  expect(await textUnderTray(page)).toEqual([]); // the tray has been open since the load: no line of the page under it
  // The teacher's check line has the engine's numbers (D6, section 13); the student's status has none.
  const check = (await page.locator('#check').textContent()) ?? '';
  expect(check).toMatch(/^Weeks trained [\d,]+ · ε 0\.10 · evaluations [\d,]+ · stable · target met · \d+\.\d s$/);
  console.log(`[e2e] the check line: ${check}`);
  // The sentence, the table and the replay describe one week: the node-side Trainer's on the same seed.
  const twin = new Trainer(loadDefaultConfig(), loadPreset('round1').spec, 1);
  const twinEnd = twin.runEpisodes(twin.config.maxEpisodes);
  const week = twin.evaluate();
  expect(readout).toBe(describeWeek(week));
  expect(check).toContain(`Weeks trained ${twinEnd.episodes.toLocaleString('en-US')} ·`);
  await expect(page.locator('#report')).toBeVisible();
  const line = (label: RegExp) => page.locator('#report-table tr').filter({ has: page.locator('th', { hasText: label }) });
  await expect(line(/^Profit before the GM's bonus$/).locator('td').last()).toHaveText(withCents(formatMoney(week.totals.profit))); // BRIEF 10.1's data, rendered with its cents (D66)
  await expect(line(/^Incidents$/).locator('td').last()).toHaveText(String(week.totals.incidents));
  await expect(line(/^Dogs accepted$/).locator('td').last()).toHaveText(String(week.totals.dogsServed));
  // On screen the owners' result comes before the GM's pay that made it (G6, row 6; D73); the export keeps the data's order.
  expect(await page.locator('#report-table tbody th.group').allTextContents()).toEqual(['Money ($)', "The owners' bottom line ($)", "The GM's pay under the plan", 'Operations']);
  // The report ends with the way back to the scorecard (G6, row 10).
  await expect(page.locator('#back-to-scorecard')).toBeVisible();
  await expect(page.locator('#back-to-scorecard')).toHaveText('Back to your scorecard ↑');
  await expect(page.locator('#replay-again')).toBeVisible();
  await expect(page.locator('#replay-again')).toHaveText('Replay the week'); // D71
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'final');
  await expect(page.locator('#replay')).toHaveAttribute('data-key', outcomeKey(week)); // the week on the yard is the twin's
  expect(await drawnFraction(page, '#replay')).toBeGreaterThan(0.05); // the yard is drawn, not the placeholder
  // Scrolled back to the yard, its whole stack (the caption and Watch the week again) sits above the open tray.
  const stack = await page.evaluate(() => {
    document.querySelector('#watch')?.scrollIntoView({ block: 'start' });
    const tray = document.querySelector('#teacher');
    return {
      caption: Math.round(document.querySelector('#replay-caption')?.getBoundingClientRect().bottom ?? 9999),
      again: Math.round(document.querySelector('#replay-again')?.getBoundingClientRect().bottom ?? 9999),
      trayTop: Math.round(tray?.getBoundingClientRect().top ?? 0),
    };
  });
  console.log(`[e2e] the yard's stack scrolled into view: ${JSON.stringify(stack)}`);
  expect(stack.caption).toBeLessThanOrEqual(stack.trayTop);
  expect(stack.again).toBeLessThanOrEqual(stack.trayTop);
  // The export is what the page holds at the end of the run (D47): the prediction and the seed of the click.
  await page.fill('#prediction', 'changed after the run');
  await page.fill('#seed', '7');
  await expect(page.locator('#export')).toBeEnabled(); // a prediction or seed change is not a plan change
  const { file, name } = await exportRun(page);
  expect(name).toMatch(/^reward-the-pack-round1-seed1-\d{8}-\d{4}\.json$/);
  expect(Object.keys(file).sort()).toEqual(EXPORT_KEYS);
  expect(file['version']).toBe(1);
  expect(file['config']).toBe('default');
  expect(file['round']).toBe('round1');
  expect(file['seed']).toBe(1);
  expect(file['plan']).toEqual(loadPreset('round1').spec);
  expect(file['planWords']).toBe('Each day, the GM earns $10 per $100 of profit.');
  expect(file['prediction']).toBe(prediction);
  expect(file['predictionPicks']).toEqual(PACKED);
  expect((file['predictionCheck'] as { called: boolean }[]).every((c) => c.called)).toBe(true);
  const exported = file['readout'] as { sentence: string; report: unknown };
  expect(exported.sentence).toBe(readout);
  expect(exported.report).toEqual(week);
  const curve = file['curve'] as { weeks: number[]; bonus: number[]; average: number[] };
  expect(curve.weeks.length).toBe(twinEnd.episodes);
  expect(curve.bonus.length).toBe(twinEnd.episodes);
  expect(curve.average.length).toBe(twinEnd.episodes);
  expect((file['evaluations'] as unknown[]).length).toBe(twin.evals().length);
  const learner = file['learner'] as Record<string, unknown>;
  expect(learner['weeksTrained']).toBe(twinEnd.episodes);
  expect(learner['stable']).toBe(true);
  expect(learner['targetMet']).toBe(true);
  expect(learner['outOfBudget']).toBe(false);
  expect(JSON.stringify(file)).not.toMatch(/"(student|team|email|user)/i);
  // The teacher's learning curve: shown on request, drawn, hidden again; the student never sees it otherwise.
  await page.click('#show-curve');
  await expect(page.locator('#learning')).toBeVisible();
  await expect(page.locator('#show-curve')).toHaveText('Hide the learning curve');
  await expect.poll(() => drawnFraction(page, '#curve'), { timeout: 3_000 }).toBeGreaterThan(0.02);
  // The teacher's view says SI too, never AI (D67): the open tray, the curve's caption and its label.
  expect(aiWords(await studentText(page))).toEqual([]);
  await page.click('#show-curve');
  await expect(page.locator('#learning')).toBeHidden();
  await expect(page.locator('#show-curve')).toHaveText('Show the learning curve');
  // The page's content can always scroll clear of the open tray: the report's last row, then the revealed rules.
  const clearsTray = (selector: string) =>
    page.evaluate((sel) => {
      // The page's scroller: the body while the tray is open (its box ends at the tray's top, G5d round 4).
      const scroller = document.documentElement.classList.contains('teacher-open') ? document.body : (document.scrollingElement ?? document.documentElement);
      scroller.scrollTo(0, scroller.scrollHeight);
      const rows = document.querySelectorAll(sel);
      const last = rows[rows.length - 1];
      const tray = document.querySelector('#teacher');
      if (!last || !tray) return { bottom: -1, trayTop: -1 };
      return { bottom: Math.round(last.getBoundingClientRect().bottom), trayTop: Math.round(tray.getBoundingClientRect().top) };
    }, selector);
  const rowEnd = await clearsTray('#report-table tr');
  console.log(`[e2e] scrolled to the bottom with the tray open: the report's last row ends at ${rowEnd.bottom} px, the tray starts at ${rowEnd.trayTop} px`);
  expect(rowEnd.bottom).toBeGreaterThan(0);
  expect(rowEnd.bottom).toBeLessThanOrEqual(rowEnd.trayTop);
  await page.click('#reveal');
  await expect(page.locator('#rules')).toBeVisible();
  const ruleEnd = await clearsTray('#rules-list li');
  expect(ruleEnd.bottom).toBeGreaterThan(0);
  expect(ruleEnd.bottom).toBeLessThanOrEqual(ruleEnd.trayTop);
  console.log(`[e2e] Round 1 from the click to the readout in ${ms} ms: ${readout}`);
  expect(ms).toBeLessThan(60_000);
  // "Make a new prediction" is a clear (D37, D56): the scorecard and the run go, the picks come back as they were, the
  // status is the idle sentence, the export goes off, and the button is ready for the same picks.
  await page.click('#teacher-close');
  // From the report's end, back to the scorecard: the page scrolls to it and the focus is on the called line (G6, row 10).
  await page.locator('#back-to-scorecard').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#called-line')).toBeFocused();
  // The called line in the window, under the sticky bar, once the scroll has played out.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const line = document.querySelector('#called-line')?.getBoundingClientRect();
          const bar = document.querySelector('.topbar')?.getBoundingClientRect();
          return line !== undefined && bar !== undefined && line.top >= bar.bottom - 1 && line.bottom <= window.innerHeight;
        }),
      { timeout: 5_000, message: 'the called line in view under the bar' },
    )
    .toBe(true);
  await page.click('#new-prediction');
  await expect(page.locator('#back-to-scorecard')).toBeHidden(); // cleared with the run
  await expect(page.locator('#scorecard')).toBeHidden();
  await expect(page.locator('#called-line')).toBeHidden();
  for (const [field, value] of Object.entries(PACKED)) await expect(page.locator(`#pick-${field}-${value}`)).toBeChecked();
  await expect(page.locator('input[name^="pick-"]:enabled')).toHaveCount(17);
  await expect(page.locator('#status')).toHaveText(IDLE);
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#export')).toBeDisabled();
  await expect(page.locator('#train')).toBeEnabled();
  expect(foreign).toEqual([]);
});

test('the fold holds on Round 1 and on Round 3 with all six measures on, after the fonts and the art have loaded', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const address of ['/', '/?round=3']) {
    await page.goto(address);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (img) => (img.complete ? null : img.decode().catch(() => null))));
    });
    if (address !== '/') {
      for (const key of ['dogsServed', 'incidents', 'reputation', 'fatigue', 'overRatio']) await page.check(`#kpi-${key}-on`);
      await expect(page.locator('#limit')).toHaveText('6 of 6 measures on.');
    }
    await makePicks(page);
    const bottom = async (): Promise<number> => {
      const box = await page.locator('#train').boundingBox();
      return (box?.y ?? 9999) + (box?.height ?? 0);
    };
    const closed = await bottom();
    await openTray(page);
    const open = await bottom();
    const trayTop = (await page.locator('#teacher').boundingBox())?.y ?? 0;
    console.log(`[e2e] ${address}: the button's bottom ${Math.round(closed)} px (tray open: ${Math.round(open)}, tray top ${Math.round(trayTop)})`);
    expect(closed).toBeLessThanOrEqual(700);
    expect(open).toBe(closed); // the tray overlays; the button does not move (D46)
    expect(open).toBeLessThanOrEqual(trayTop);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  }
});

test('the open tray never has a line of the page under it, after a run at 1024 × 768, 1366 × 768 and 1366 × 640, wherever the page is scrolled (G5d round 4; G6, R4)', async ({ page }) => {
  test.setTimeout(200_000);
  for (const [width, height] of [
    [1024, 768],
    [1366, 768],
    [1366, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await makePicks(page);
    await writeWhy(page, WHY_300); // the Why quoted after the week: its lines count too (G6, R4)
    await page.click('#train');
    await weekOver(page);
    await openTray(page);
    // Where the tray opening moved the page (the class's buttons kept above it), no line is cut by its edge either.
    expect(await linesCutAtTrayEdge(page), `${width} × ${height}, the page where the tray left it`).toEqual([]);
    const where: string[] = [];
    for (const at of [0, 0.5, 1]) {
      // The page's scroller while the tray is open is the body, whose box ends at the tray's top; nothing scrolls under it.
      if (at > 0) await page.evaluate((f) => document.body.scrollTo(0, (document.body.scrollHeight - document.body.clientHeight) * f), at);
      const under = await textUnderTray(page);
      where.push(`${at}: ${under.length}`);
      expect(under, `${width} × ${height}, scrolled to ${at} of the page`).toEqual([]);
    }
    console.log(`[e2e] ${width} × ${height}, the tray open after a run: lines under it by scroll position ${where.join(', ')}`);
  }
});

// G3: the bonus plan editor (G3 plan, acceptance 2). Sliders are set the way a drag sets them: the value, then an
// input event.
async function setSlider(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const ROUND1_WORDS = 'Each day, the GM earns $10 per $100 of profit.';

test('Round 1 locks the plan; Round 2 unlocks it and reloads the preset', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#round-label')).toHaveText('Round 1: profit only');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#limit')).toContainText('Round 1: the plan is set.');
  await expect(page.locator('#kpi-profit-on')).toBeChecked();
  await expect(page.locator('#kpi-profit-on')).toBeDisabled();
  await expect(page.locator('#kpi-profit-weight')).toBeDisabled();
  await expect(page.locator('#kpi-profit-value')).toHaveText('+$10');
  await expect(page.locator('#kpi-incidents-on')).not.toBeChecked();
  await expect(page.locator('#kpi-incidents-on')).toBeDisabled();
  await expect(page.locator('#kpi-incidents-weight')).toBeDisabled();
  await expect(page.locator('#kpi-incidents-value')).toHaveText('−$5');
  await openTray(page);
  await page.check('#round-round2');
  await expect(page.locator('#round-label')).toHaveText('Round 2: up to three measures');
  await expect(page.locator('#limit')).toContainText('1 of 3 measures on.');
  await expect(page.locator('#kpi-profit-on')).toBeEnabled();
  await expect(page.locator('#kpi-profit-weight')).toBeEnabled();
  await expect(page.locator('#kpi-incidents-on')).toBeEnabled();
  await expect(page.locator('#kpi-incidents-weight')).toBeDisabled(); // off: its slider waits for the toggle
  await setSlider(page, '#kpi-profit-weight', '3');
  await expect(page.locator('#kpi-profit-value')).toHaveText('+$3');
  await expect(page.locator('#plan-words')).toHaveText('Each day, the GM earns $3 per $100 of profit.');
  await page.check('#round-round1');
  await expect(page.locator('#round-label')).toHaveText('Round 1: profit only');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS); // the preset reloads
  await expect(page.locator('#kpi-profit-weight')).toBeDisabled();
});

test('Round 2 refuses a fourth measure', async ({ page }) => {
  await page.goto('/?round=2');
  await expect(page.locator('#round-round2')).toBeChecked();
  await expect(page.locator('#round-label')).toHaveText('Round 2: up to three measures');
  await expect(page.locator('#limit')).toHaveText('1 of 3 measures on.');
  await page.check('#kpi-incidents-on');
  await page.check('#kpi-reputation-on');
  await expect(page.locator('#limit')).toHaveText('3 of 3 measures on. Turn one off to turn another on.');
  await expect(page.locator('#kpi-fatigue-on')).toBeDisabled();
  await expect(page.locator('#kpi-overRatio-on')).toBeDisabled();
  await expect(page.locator('#kpi-dogsServed-on')).toBeDisabled();
  await expect(page.locator('#kpi-reputation-on')).toBeEnabled(); // what is on can always go off
  await expect(page.locator('#plan-words')).toHaveText(
    'Each day, the GM earns $10 per $100 of profit, loses $5 per incident, and earns $5 per point of reputation gained.',
  );
  await expect(page.locator('#plan-note')).toHaveText(
    'Profit and reputation count both ways: a $100 loss or a one-point drop counts the opposite of a $100 gain or a one-point rise.',
  );
  await page.uncheck('#kpi-incidents-on');
  await expect(page.locator('#limit')).toHaveText('2 of 3 measures on.');
  await expect(page.locator('#kpi-fatigue-on')).toBeEnabled();
  await expect(page.locator('#plan-words')).toHaveText(
    'Each day, the GM earns $10 per $100 of profit and earns $5 per point of reputation gained.',
  );
});

test('the editor: the words follow the sliders, the edited plan is what trains, the prediction stays, the export follows the run', async ({ page }) => {
  test.setTimeout(120_000); // three runs (G6: a rerun straight after a run)
  const foreign = watchRequests(page);
  await page.goto('/?round=3');
  await expect(page.locator('#round-round3')).toBeChecked();
  await expect(page.locator('#round-label')).toHaveText('Round 3: all six measures');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#kpi-incidents-weight')).toBeDisabled();
  await page.check('#kpi-incidents-on');
  await expect(page.locator('#kpi-incidents-weight')).toBeEnabled();
  await setSlider(page, '#kpi-incidents-weight', '-7');
  await expect(page.locator('#kpi-incidents-value')).toHaveText('−$7');
  const words = 'Each day, the GM earns $10 per $100 of profit and loses $7 per incident.';
  await expect(page.locator('#plan-words')).toHaveText(words);
  await expect(page.locator('#plan-note')).toHaveText('Profit counts both ways: a $100 loss counts the opposite of a $100 gain.');
  const prediction = 'Fewer dogs, fewer incidents, less profit.';
  await page.fill('#prediction', prediction);
  await openTray(page);
  await page.fill('#seed', '1');
  await page.click('#reveal'); // the rules are the config's, not the run's: they stay through clears and runs
  await expect(page.locator('#rules')).toBeVisible();
  await expect(page.locator('#export')).toBeDisabled();
  // Mixed on purpose: the edited plan's week accepts every booking on 5 of 5 days and runs solo on 2 (called), naps 0
  // times and has 5 incidents (missed), so the scorecard must show both.
  await makePicks(page, { acceptAll: 'all', rate: 'mix', solo: '1-2', naps: '1-5', incidents: '0-2' });
  await page.click('#train');
  // A resize mid-week neither restarts nor ends the week: it plays on and the readout follows (Astra, plan review).
  await expect(page.locator('#status')).toHaveText(PLAYING, { timeout: 60_000 });
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(page.locator('#readout')).toHaveText('');
  await weekOver(page);
  await expect(page.locator('#replay')).toHaveAttribute('data-plays', '1');
  const status = (await page.locator('#status').textContent()) ?? '';
  expect(status).toBe(DONE);
  await expect(page.locator('#check')).toContainText('no target for this plan'); // D36: only the Round 1 plan has a target
  await expect(page.locator('#prediction')).toBeEnabled();
  await expect(page.locator('#prediction')).toBeVisible();
  await expect(page.locator('#prediction')).toHaveValue(prediction);
  await expect(page.locator('#plan-words')).toHaveText(words);
  await expect(page.locator('#kpi-incidents-weight')).toBeEnabled();
  await expect(page.locator('#kpi-dogsServed-on')).toBeEnabled(); // Round 3's own rules are back: 2 of 6 on
  await expect(page.locator('#round-round1')).toBeEnabled();
  await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('#rules')).toBeVisible();
  // The page trained the edited plan, not Round 1 and not a neighbouring weight: the same spec and seed in node
  // give the same test week and the same episode count (−7, −8 and −9 share the sentence on seed 1, not the count).
  const world = loadDefaultConfig();
  const edited = setWeight(toggleKpi(loadPreset('round3').spec, 'incidents', 6) as NonNullable<ReturnType<typeof toggleKpi>>, 'incidents', -7);
  const twin = new Trainer(world, edited, 1);
  const twinEnd = twin.runEpisodes(twin.config.maxEpisodes);
  const expected = describeWeek(twin.evaluate());
  const round1 = new Trainer(world, loadPreset('round1').spec, 1);
  round1.runEpisodes(round1.config.maxEpisodes);
  expect(expected).not.toBe(describeWeek(round1.evaluate()));
  await expect(page.locator('#readout')).toHaveText(expected);
  await expect(page.locator('#report')).toBeVisible();
  await expect(page.locator('#replay-again')).toBeVisible();
  await expect(page.locator('#check')).toContainText(`Weeks trained ${twinEnd.episodes.toLocaleString('en-US')} ·`);
  console.log(`[e2e] edited plan: ${await page.locator('#check').textContent()} · ${expected}`);
  const { file } = await exportRun(page);
  expect(file['round']).toBe('round3');
  expect(file['plan']).toEqual(edited);
  expect(file['planWords']).toBe(words);
  expect(file['prediction']).toBe(prediction);
  expect((file['readout'] as { sentence: string }).sentence).toBe(expected);
  expect((file['learner'] as { hasTarget: boolean; targetMet: boolean }).hasTarget).toBe(false);
  // A mixed scorecard: every row on the page is the export's check, called or missed (D56; Astra, G5c plan review).
  const check = file['predictionCheck'] as { field: string; picked: string | null; actual: string; called: boolean }[];
  expect(check.some((c) => c.called)).toBe(true);
  expect(check.some((c) => !c.called)).toBe(true);
  await expect(page.locator('#scorecard [data-called="true"]')).toHaveCount(check.filter((c) => c.called).length);
  await expect(page.locator('#scorecard [data-called="false"]')).toHaveCount(check.filter((c) => !c.called).length);
  for (const c of check) {
    const row = page.locator(`#scorecard [data-field="${c.field}"]`);
    await expect(row).toHaveAttribute('data-called', String(c.called));
    await expect(row).toContainText(c.actual);
    if (c.picked !== null) await expect(row).toContainText(c.picked);
  }
  await expect(page.locator('#called-line')).toHaveText(`You called ${check.filter((c) => c.called).length} of 5.`);
  await expect(page.locator('input[name^="pick-"]:enabled')).toHaveCount(0); // the scorecard is the click's picks
  // A slider edit after a run clears that run's results, even while the final week is playing (D37; Astra, diff
  // review: the clear must cancel a live producer, not only an idle one), and the export goes off with them.
  await page.click('#replay-again');
  await page.waitForTimeout(150);
  expect(await drawnFraction(page, '#replay')).toBeGreaterThan(0.05);
  await setSlider(page, '#kpi-profit-weight', '5');
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#status')).toHaveText(CHANGED);
  await expect(page.locator('#report')).toBeHidden(); // the table and the replay are results too (D37)
  await expect(page.locator('#report-table tr')).toHaveCount(0);
  await expect(page.locator('#replay-again')).toBeHidden();
  await expect(page.locator('#back-to-scorecard')).toBeHidden(); // the way back goes with the scorecard (G6, row 10)
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'none');
  await expect(page.locator('#export')).toBeDisabled();
  await expect(page.locator('#check')).toHaveText('No run yet.');
  // The scorecard goes with the run and the picks come back, as they were (D37 extended to the prediction, D56).
  await expect(page.locator('#scorecard')).toBeHidden();
  await expect(page.locator('#pick-rate-mix')).toBeChecked();
  await expect(page.locator('input[name^="pick-"]:enabled')).toHaveCount(17);
  await expect(page.locator('#rules')).toBeVisible(); // the rules survive the clear
  // The clear cancels the replay's producer: nothing redraws the old week on a later frame or a resize (Astra).
  await twoFrames(page);
  await page.setViewportSize({ width: 1100, height: 760 }); // a different size from the mid-week resize, so it runs
  await twoFrames(page);
  await twoFrames(page);
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#report-table tr')).toHaveCount(0);
  await expect(page.locator('#replay-again')).toBeHidden();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'none');
  await expect(page.locator('#export')).toBeDisabled(); // and stays off a frame later
  expect(await drawnFraction(page, '#replay')).toBeLessThan(0.02); // the placeholder: one line of text, no yard
  await expect(page.locator('#plan-words')).toHaveText('Each day, the GM earns $5 per $100 of profit and loses $7 per incident.');
  // A second run, then a round change through the tray clears it and reloads the preset.
  await page.click('#train');
  await weekOver(page);
  await expect(page.locator('#back-to-scorecard')).toBeVisible(); // the rerun's scorecard brings its way back
  // "Put the GM to work again" right after a run: the click clears the run, the way back with it (G6, row 10).
  await page.click('#train');
  await expect(page.locator('#back-to-scorecard')).toBeHidden();
  await weekOver(page);
  await expect(page.locator('#scorecard [data-field]')).toHaveCount(5); // the rerun is scored with the same picks
  await expect(page.locator('#called-line')).toHaveText(/^You called [0-5] of 5\.$/);
  await expect(page.locator('#readout')).toContainText(/The GM accepted every booking on \d of 5 days/);
  await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('#rules')).toBeVisible(); // and the next run
  await expect(page.locator('#rules-list li')).toHaveCount(12);
  await page.check('#round-round2');
  await expect(page.locator('#round-label')).toHaveText('Round 2: up to three measures');
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#status')).toContainText('The plan changed.');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#limit')).toHaveText('1 of 3 measures on.');
  await expect(page.locator('#export')).toBeDisabled();
  await expect(page.locator('#rules')).toBeVisible();
  expect(foreign).toEqual([]);
});

test('a plan the engine never settles on is, for the student, just the week the GM ran', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?round=3');
  await page.uncheck('#kpi-profit-on');
  await page.check('#kpi-incidents-on');
  await expect(page.locator('#plan-words')).toHaveText('Each day, the GM loses $5 per incident.');
  await expect(page.locator('#plan-note')).toHaveText('');
  await openTray(page);
  await page.fill('#seed', '1');
  // While the GM gets ready (the engine runs to its cap, about a second here) every frame shows the placeholder and
  // nothing of the readout, sampled in the browser (Astra, plan and diff reviews: prove nothing plays while it trains).
  // Under reduced motion, so the orb holds its ready picture the whole time (G5d round 3, row 10).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await samplePreparing(page);
  await makePicks(page);
  await page.click('#train');
  await weekOver(page);
  console.log(`[e2e] frames sampled while the GM got ready (the unsettled plan): ${await expectPreparingClean(page)}`);
  expect(await preparingPictures(page)).toBe(1); // reduced motion: the orb holds its ready picture
  await expect(page.locator('#replay')).toHaveAttribute('data-plays', '1');
  // For the student a plan the engine never settles on is just the week the GM ran (D50); the check line says so.
  const status = (await page.locator('#status').textContent()) ?? '';
  expect(status).toBe(DONE);
  await expect(page.locator('#readout-label')).toHaveText('What the GM did');
  await expect(page.locator('#check')).toContainText(/^Weeks trained 150,000 · ε 0\.10 · evaluations [\d,]+ · not stable · no target for this plan · \d+\.\d s$/);
  // Deterministic to the cap: the same plan and seed in node give the same sentence.
  const world = loadDefaultConfig();
  const incidentsOnly = toggleKpi(toggleKpi(loadPreset('round3').spec, 'profit', 6) as NonNullable<ReturnType<typeof toggleKpi>>, 'incidents', 6) as NonNullable<ReturnType<typeof toggleKpi>>;
  const twin = new Trainer(world, incidentsOnly, 1);
  const end = twin.runEpisodes(twin.config.maxEpisodes);
  expect(end.stable).toBe(false);
  expect(end.episodes).toBe(twin.config.maxEpisodes);
  await expect(page.locator('#readout')).toHaveText(describeWeek(twin.evaluate()));
  await expect(page.locator('#check')).toContainText(`Weeks trained ${end.episodes.toLocaleString('en-US')} ·`);
  console.log(`[e2e] unsettled plan: ${status} · ${await page.locator('#check').textContent()}`);
});

test('the pilot mode trains Round 1 whatever the address says, and its export is the last seed\'s run', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?pilot=2&round=3');
  await expect(page.locator('#pilot h2')).toContainText('Round 1');
  await expect(page.locator('.pilot-summary')).toHaveText('2 of 2 seeds target met in under 60 s', { timeout: 60_000 });
  await expect(page.locator('#scorecard')).toBeHidden(); // the pilot predicts nothing and scores nothing (D56)
  await expect(page.locator('#report')).toBeVisible();
  await expect(page.locator('#back-to-scorecard')).toHaveCount(1);
  await expect(page.locator('#back-to-scorecard')).toBeHidden(); // no scorecard, so no way back to one (G6, row 10)
  await expect(page.locator('#train')).toBeDisabled(); // and the button waits for a class's five picks
  await expect(page.locator('#picks-hint')).toBeVisible();
  await expect(page.locator('#round-round1')).toBeChecked();
  await expect(page.locator('#round-label')).toHaveText('Round 1: profit only');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#pilot tbody tr')).toHaveCount(2);
  await expect(page.locator('#pilot tbody tr').nth(1).locator('td').nth(4)).toHaveText('yes');
  const episodesCell = (await page.locator('#pilot tbody tr').nth(1).locator('td').nth(1).textContent()) ?? '';
  await expect(page.locator('#check')).toContainText(`Weeks trained ${episodesCell} ·`);
  await expect(page.locator('#check')).toContainText('stable · target met');
  // The export after the pilot is seed 2's run, unpaced (Astra, plan review: not seed 1's setup carried over).
  await openTray(page);
  await expect(page.locator('#export')).toBeEnabled();
  const { file, name } = await exportRun(page);
  expect(name).toMatch(/^reward-the-pack-round1-seed2-\d{8}-\d{4}\.json$/);
  expect(file['seed']).toBe(2);
  expect(file).not.toHaveProperty('speed');
  expect(file['round']).toBe('round1');
  expect(file['prediction']).toBe('');
  expect(file['predictionPicks']).toEqual({ acceptAll: null, rate: null, solo: null, naps: null, incidents: null }); // the pilot predicts nothing
  const twin = new Trainer(loadDefaultConfig(), loadPreset('round1').spec, 2);
  const end = twin.runEpisodes(twin.config.maxEpisodes);
  expect((file['readout'] as { report: unknown }).report).toEqual(twin.evaluate());
  expect((file['learner'] as { weeksTrained: number }).weeksTrained).toBe(end.episodes);
  expect(Number(episodesCell.replace(/,/g, ''))).toBe(end.episodes);
});

/** Presses Tab until the element with `id` has focus (at most `limit` presses); a keyboard user's way there. */
async function tabTo(page: Page, id: string, limit = 80): Promise<void> {
  for (let i = 0; i < limit && !(await page.evaluate((want) => document.activeElement?.id === want, id)); i++) await page.keyboard.press('Tab');
  await expect(page.locator(`#${id}`)).toBeFocused();
}

/** What a student reads at this moment: the rendered text (the closed tray and hidden sections are not rendered) and
 * the labels a screen reader says. */
async function studentText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>('[aria-label], [placeholder], [title], [alt]'))
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ['aria-label', 'placeholder', 'title', 'alt'].map((a) => el.getAttribute(a) ?? '').join(' '));
    return `${document.body.innerText} ${labels.join(' ')}`;
  });
}

test('a student runs the week by keyboard alone, and nothing the page shows, the yard included, uses a word a student never reads', async ({ page }) => {
  // Every string drawn on a canvas, the yard's captions and HUD included (G5d acceptance 6).
  await page.addInitScript(() => {
    const drawn: string[] = [];
    (window as unknown as { __drawn: string[] }).__drawn = drawn;
    for (const proto of [CanvasRenderingContext2D.prototype, globalThis.OffscreenCanvasRenderingContext2D?.prototype]) {
      if (!proto) continue;
      for (const name of ['fillText', 'strokeText'] as const) {
        const original = proto[name] as (...args: unknown[]) => void;
        (proto as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
          drawn.push(String(args[0]));
          return original.apply(this, args);
        };
      }
    }
  });
  await page.goto('/');
  const shown = [await studentText(page)];
  // The five picks: Tab into each group, Space takes its first option, the arrows move to the pick (and take it).
  await tabTo(page, 'pick-acceptAll-none');
  const moves: Record<keyof typeof PACKED, number> = { acceptAll: 2, rate: 2, solo: 2, naps: 0, incidents: 2 };
  for (const [i, [, n]] of Object.entries(moves).entries()) {
    if (i > 0) await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    for (let k = 0; k < n; k++) await page.keyboard.press('ArrowRight');
  }
  for (const [field, value] of Object.entries(PACKED)) await expect(page.locator(`#pick-${field}-${value}`)).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.locator('#prediction')).toBeFocused();
  await page.keyboard.type('It packs the yard with one staffer and never naps.');
  await page.keyboard.press('Tab');
  await expect(page.locator('#train')).toBeFocused();
  shown.push(await studentText(page));
  await page.keyboard.press('Enter');
  await expect(page.locator('#status')).toHaveText(PREPARING);
  shown.push(await studentText(page));
  await expect(page.locator('#status')).toHaveText(PLAYING, { timeout: 90_000 });
  shown.push(await studentText(page));
  await expect(page.locator('#train')).toHaveText('Put the GM to work again', { timeout: 90_000 });
  // The result first: focus goes to the called line (G5c acceptance 5).
  await expect(page.locator('#called-line')).toBeFocused();
  shown.push(await studentText(page));
  // The tray opens from the keyboard and gives focus back to its tab when it closes.
  await tabTo(page, 'teacher-open');
  await page.keyboard.press('Enter');
  await expect(page.locator('#teacher')).toBeVisible();
  await tabTo(page, 'teacher-close');
  await page.keyboard.press('Enter');
  await expect(page.locator('#teacher')).toBeHidden();
  await expect(page.locator('#teacher-open')).toBeFocused();
  const drawn = await page.evaluate(() => (window as unknown as { __drawn: string[] }).__drawn);
  expect(drawn.length).toBeGreaterThan(0);
  const text = STUDENT_ALLOWED.reduce((t, phrase) => t.replace(phrase, ' '), `${shown.join('\n')}\n${drawn.join('\n')}`);
  const hits = STUDENT_BANS.flatMap((word) => (text.match(new RegExp(`.{0,40}${word.source}.{0,40}`, word.flags.includes('i') ? 'gi' : 'g')) ?? []));
  expect(hits).toEqual([]);
});

test('without its pictures the yard draws no figures and says so, keeping its chips, in words a student reads (D64)', async ({ page }) => {
  // Every string drawn on a canvas; the strings and the pictures drawn on the yard's.
  await page.addInitScript(() => {
    const seen = { drawn: [] as string[], yard: [] as string[], pictures: 0 };
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of ['fillText', 'strokeText', 'drawImage', 'putImageData']) {
      const original = proto[name] as (...args: unknown[]) => unknown;
      proto[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        const onYard = this.canvas.id === 'replay';
        if (name === 'fillText' || name === 'strokeText') {
          seen.drawn.push(String(args[0]));
          if (onYard) seen.yard.push(String(args[0]));
        } else if (onYard) seen.pictures += 1;
        return original.apply(this, args);
      };
    }
  });
  await page.route(/\.(webp|png|svg)(\?.*)?$/, (route) => route.abort());
  await page.goto('/');
  type Seen = { drawn: string[]; yard: string[]; pictures: number };
  const seen = (): Promise<Seen> => page.evaluate(() => (window as unknown as { __seen: Seen }).__seen);
  // The notice (BRIEF 10.2, D64), its lines wrapped to the yard's box; never "beside", which the stacked layout makes wrong.
  const NOTICE = ["The yard's pictures did not load on this computer.", 'Everything the GM does is in the panel and the report.'];
  // On load: the notice, and no label for a GM the yard cannot show (a label beside no orb points at nothing).
  await expect.poll(async () => (await seen()).yard.join(' '), { timeout: 10_000 }).toContain(NOTICE[1]);
  expect((await seen()).yard).not.toContain('The GM');
  await makePicks(page);
  await page.click('#train');
  await expect(page.locator('#status')).toHaveText(PLAYING, { timeout: 90_000 });
  await page.evaluate(() => {
    (window as unknown as { __seen: Seen }).__seen.yard.length = 0;
  });
  // The week's own frames: the notice, and a block's events on their chips under "This block"; still no GM label.
  await expect.poll(async () => (await seen()).yard, { timeout: 30_000 }).toContain('This block');
  const { drawn, yard, pictures } = await seen();
  expect(yard.join(' ')).toContain(NOTICE[0]);
  expect(yard.join(' ')).toContain(NOTICE[1]);
  expect(yard).not.toContain('The GM');
  const CHIP = /^(Closed|Incident|Vet bill \$[\d,]+|Inspector: \$[\d,]+ fine|\d+ dogs? found sick at pickup|The staffer called out: closed today|Walk photo posted)$/;
  expect(yard.filter((t) => CHIP.test(t)).length).toBeGreaterThan(0);
  // Nothing else: no picture (no board, no figure, no orb), and no words but the notice's and the chips'.
  expect(pictures).toBe(0);
  expect([...new Set(yard.filter((t) => !NOTICE.some((n) => n.includes(t)) && t !== 'This block' && !CHIP.test(t)))]).toEqual([]);
  const text = STUDENT_ALLOWED.reduce((t, phrase) => t.replace(phrase, ' '), `${await studentText(page)}\n${drawn.join('\n')}`);
  const hits = STUDENT_BANS.flatMap((word) => (text.match(new RegExp(`.{0,40}${word.source}.{0,40}`, word.flags.includes('i') ? 'gi' : 'g')) ?? []));
  expect(hits).toEqual([]);
});

// ---------- G6: the Chromebook's browser window and the layout's round 4 rows ----------

/** A Why of about 300 characters (G6 acceptance 2: a team that writes its reasons out). */
const WHY_300 =
  'It will take every booking it can, because profit is all the plan pays for, and keep one staffer on the floor to save on wages. It skips naps, since a nap block earns nothing. By Thursday the yard is packed, the crew is worn out and the incidents pile up, and the owners pay for that later in the term.';
const SIX = ['dogsServed', 'incidents', 'reputation', 'fatigue', 'overRatio'] as const;

type Box = { top: number; bottom: number; left: number; right: number };
type WindowBoxes = { scrollY: number; innerHeight: number; innerWidth: number; boxes: Record<string, Box | null> };

/** Each selector's box (the union of its rendered matches) against the window, and the window's scroll. */
async function windowBoxes(page: Page, selectors: readonly string[]): Promise<WindowBoxes> {
  return page.evaluate((sels) => {
    const boxes: Record<string, { top: number; bottom: number; left: number; right: number } | null> = {};
    for (const s of sels) {
      const rects = Array.from(document.querySelectorAll(s))
        .filter((e) => e.getClientRects().length > 0)
        .map((e) => e.getBoundingClientRect());
      const r = (n: number): number => Math.round(n * 10) / 10;
      boxes[s] = rects.length === 0 ? null : { top: r(Math.min(...rects.map((x) => x.top))), bottom: r(Math.max(...rects.map((x) => x.bottom))), left: r(Math.min(...rects.map((x) => x.left))), right: r(Math.max(...rects.map((x) => x.right))) };
    }
    return { scrollY: window.scrollY, innerHeight: window.innerHeight, innerWidth: window.innerWidth, boxes };
  }, selectors);
}

/** The selectors whose whole box is not inside the window (missing, or cut at an edge), with where they are. */
function notInWindow(m: WindowBoxes): string[] {
  return Object.entries(m.boxes)
    .filter(([, b]) => b === null || b.top < 0 || b.left < 0 || b.bottom > m.innerHeight || b.right > m.innerWidth)
    .map(([s, b]) => (b === null ? `${s}: not shown` : `${s}: ${b.top} to ${b.bottom} px (window ${m.innerHeight})`));
}

/** The fonts and the pictures in, as a class sees the page once it has loaded. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => (img.complete ? null : img.decode().catch(() => null))));
  });
}

/** Round 3's six measures on, by the switches' own clicks in the page (a click that scrolls nothing). */
async function allSixOn(page: Page): Promise<void> {
  for (const key of SIX) await page.locator(`#kpi-${key}-on`).evaluate((el) => (el as HTMLInputElement).click());
  await expect(page.locator('#limit')).toHaveText('6 of 6 measures on.');
}

/** The Why typed in as it stands (the value and its input event; no focus, so no scroll). */
async function writeWhy(page: Page, why: string): Promise<void> {
  await page.locator('#prediction').evaluate((el, text) => {
    (el as HTMLTextAreaElement).value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, why);
}

/**
 * The five picks made by a mouse click where each chip is on screen: unlike Playwright's own click, it never scrolls
 * the page to reach a chip, so a chip below the window is simply not picked (G6 acceptance 2).
 */
async function pickInPlace(page: Page, picks: Record<string, string> = PACKED): Promise<void> {
  for (const [field, value] of Object.entries(picks)) {
    const box = await page.locator(`label[for="pick-${field}-${value}"]`).boundingBox();
    expect(box, `the chip ${field} ${value}`).not.toBeNull();
    await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    await expect(page.locator(`#pick-${field}-${value}`)).toBeChecked();
  }
}

/** Puts the GM to work by a mouse click on the button where it is (no scroll to reach it). */
async function trainInPlace(page: Page): Promise<void> {
  const box = await page.locator('#train').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
}

for (const [width, height] of [
  [1366, 640],
  [1280, 640],
] as const) {
  test(`at ${width} × ${height}, the five picks and the whole of Put the GM to work are on screen without scrolling, on load and with the picks made, Round 1 and Round 3 with all six on (D72)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const address of ['/', '/?round=3']) {
      await page.goto(address);
      await settle(page);
      if (address !== '/') await allSixOn(page);
      await writeWhy(page, WHY_300);
      // The hint under the button: in the window at 1366 × 640; at 1280 × 640 it may sit below (G6, R1).
      const onLoad = await windowBoxes(page, width === 1366 ? ['#picks', '#train', '#picks-hint'] : ['#picks', '#train']);
      // The Why's box shows whole lines: its text box a whole number of lines (three), and its padding no deeper than a
      // line's leading, so a box scrolled to its end shows no glyph of a cut line (G6, R1).
      const why = await page.locator('#prediction').evaluate((el) => {
        const cs = getComputedStyle(el);
        const line = parseFloat(cs.lineHeight);
        const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
        return { lines: (el.getBoundingClientRect().height - border - pad) / line, padTop: parseFloat(cs.paddingTop), leading: (line - parseFloat(cs.fontSize)) / 2 };
      });
      console.log(`[e2e] ${width} × ${height} ${address} the Why's box: ${JSON.stringify(why)}`);
      expect(Math.abs(why.lines - 3), `${address}: the Why's box is three whole lines`).toBeLessThan(0.05);
      expect(why.padTop).toBeLessThanOrEqual(why.leading + 0.5);
      console.log(`[e2e] ${width} × ${height} ${address} on load: ${JSON.stringify(onLoad.boxes)}`);
      expect(onLoad.scrollY, `${address}: the page is not scrolled`).toBe(0);
      expect(notInWindow(onLoad), `${address} on load`).toEqual([]);
      await pickInPlace(page);
      await expect(page.locator('#train')).toBeEnabled();
      const picked = await windowBoxes(page, ['#picks', '#train']);
      console.log(`[e2e] ${width} × ${height} ${address} with the picks made: ${JSON.stringify(picked.boxes)}`);
      expect(picked.scrollY, `${address}: the picks scrolled nothing`).toBe(0);
      expect(notInWindow(picked), `${address} with the picks made`).toEqual([]);
      // The bar: one height in every phase (G6, row 7).
      expect(Math.round((await page.locator('.topbar').boundingBox())?.height ?? 0)).toBe(40);
      // Typed in, the Why's box scrolls with the caret, a whole number of lines; left, it rests on its first line (no
      // line sliced at its top). Last, as the caret's own scrolling may move the window.
      await page.locator('#prediction').focus();
      await page.keyboard.press('Control+End');
      const typing = await page.evaluate(() => (document.querySelector('#prediction') as HTMLTextAreaElement).scrollTop);
      await page.locator('#prediction').blur();
      const rest = await page.evaluate(() => (document.querySelector('#prediction') as HTMLTextAreaElement).scrollTop);
      console.log(`[e2e] ${width} × ${height} ${address} the Why scrolled ${typing} px while typed in, ${rest} px at rest`);
      expect(typing, `${address}: a 300-character Why scrolls inside its box`).toBeGreaterThan(0);
      expect(rest, `${address}: the Why at rest from its first line`).toBe(0);
    }
  });

  test(`at ${width} × ${height}, the status line and the three meters are on screen at every block of the week, then "You called N of 5" and the whole of "Put the GM to work again", Round 1 and Round 3 with all six on (D72)`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height });
    for (const address of ['/', '/?round=3']) {
      await page.goto(address);
      await settle(page);
      if (address !== '/') await allSixOn(page);
      await writeWhy(page, WHY_300);
      await pickInPlace(page);
      // Every frame while the week plays: the block on the rail, the window's scroll and the boxes, in the page itself,
      // so no block is missed between round trips.
      await page.evaluate((playing) => {
        type Sample = { when: string; scrollY: number; status: number[]; meters: number[]; bar: number; walkParts: number[] };
        const samples: Sample[] = [];
        (window as unknown as { __blocks: Sample[] }).__blocks = samples;
        const union = (sel: string): number[] => {
          const rects = Array.from(document.querySelectorAll(sel))
            .filter((e) => e.getClientRects().length > 0)
            .map((e) => e.getBoundingClientRect());
          return rects.length === 0 ? [] : [Math.min(...rects.map((r) => r.top)), Math.max(...rects.map((r) => r.bottom))];
        };
        const tick = (): void => {
          const status = document.querySelector('#status')?.textContent ?? '';
          if (status === playing) {
            samples.push({
              when: document.querySelector('#rail-live .when')?.textContent ?? '',
              scrollY: window.scrollY,
              status: union('#status'),
              meters: union('#rail-live .live-meters > *'),
              // A walk's block line: the lines each part between the dots takes (1 each: it breaks only at a "·").
              walkParts: (document.querySelector('#rail-live .this-block')?.textContent ?? '').includes('out walking')
                ? Array.from(document.querySelectorAll('#rail-live .this-block > .phrase')).map((p) => new Set(Array.from(p.getClientRects()).map((r) => Math.round(r.top))).size)
                : [],
              bar: document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0,
            });
          }
          if (!status.startsWith('The week is over')) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, PLAYING);
      await trainInPlace(page);
      await weekOver(page);
      const samples = await page.evaluate(() => (window as unknown as { __blocks: { when: string; scrollY: number; status: number[]; meters: number[]; bar: number; walkParts: number[] }[] }).__blocks);
      const blocks = new Set(samples.map((s) => s.when));
      expect(blocks.size, `${address}: every block of the week sampled`).toBe(20);
      const inside = (span: number[]): boolean => span.length === 2 && (span[0] as number) >= 0 && (span[1] as number) <= height;
      const worst = samples.reduce((w, s) => Math.max(w, s.meters[1] ?? 9999), 0);
      console.log(`[e2e] ${width} × ${height} ${address} while the week plays: the meters' lowest edge ${Math.round(worst)} px, status ${JSON.stringify(samples[0]?.status.map(Math.round))}`);
      const off = samples.filter((s) => s.scrollY !== 0 || !inside(s.status) || !inside(s.meters) || Math.round(s.bar) !== 40).map((s) => `${s.when}: scroll ${s.scrollY}, status ${s.status.map(Math.round).join('-')}, meters ${s.meters.map(Math.round).join('-')}, bar ${s.bar}`);
      expect([...new Set(off)], `${address}: blocks with the status or a meter off screen`).toEqual([]);
      // A walk's block line names both groups and breaks only at a "·" (G6, R2): Round 3's week walks (D69).
      const walks = samples.filter((s) => s.walkParts.length > 0);
      if (address !== '/') expect(walks.length, 'Round 3: frames with a walk block').toBeGreaterThan(0);
      for (const w of walks) expect(w.walkParts, `${w.when}: each part on one line`).toEqual([1, 1, 1]);
      // The scorecard: the count of the call and the whole of the rerun's button, the page not scrolled.
      await twoFrames(page);
      await expect(page.locator('#called-line')).toHaveText(/^You called \d of 5\.$/);
      const done = await windowBoxes(page, ['#called-line', '#train', '.topbar']);
      console.log(`[e2e] ${width} × ${height} ${address} with the scorecard up: ${JSON.stringify(done.boxes)}`);
      expect(done.scrollY, `${address}: the scorecard not scrolled`).toBe(0);
      expect(notInWindow(done), `${address} with the scorecard up`).toEqual([]);
      expect(Math.round((done.boxes['.topbar']?.bottom ?? 0) - (done.boxes['.topbar']?.top ?? 0))).toBe(40);
    }
  });
}

test('closing the tray puts the page back where opening it moved it, and keeps a scroll the reader made while it was open, at 640 and 768 high (G6, row 21)', async ({ page }) => {
  test.setTimeout(180_000);
  for (const height of [640, 768]) {
    await page.setViewportSize({ width: 1366, height });
    await page.goto('/');
    await settle(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // The reader does not scroll: the tray may move the page to keep the button above it; closing puts it back.
    await page.click('#teacher-open');
    await expect(page.locator('#teacher')).toBeVisible();
    console.log(`[e2e] 1366 × ${height}: opening the tray on the load screen moved the page ${await page.evaluate(() => document.body.scrollTop)} px`);
    await page.click('#teacher-close');
    await expect(page.locator('#teacher')).toBeHidden();
    expect(await page.evaluate(() => window.scrollY), `${height}: back where it was after open and close`).toBe(0);
    // The same through a round change in the tray (Round 3's console).
    await page.click('#teacher-open');
    await page.locator('#round-round3').check();
    await page.click('#teacher-close');
    await expect(page.locator('#round-label')).toContainText('Round 3');
    expect(await page.evaluate(() => window.scrollY), `${height}: back where it was after a round change in the tray`).toBe(0);
    // Round 1 again (a round change clears nothing the next part needs).
    await page.click('#teacher-open');
    await page.locator('#round-round1').check();
    await page.click('#teacher-close');
    // Round 3 with all six on (its button lowest): the tray and its training details open over the button and move the
    // page up to keep it clear; the reader does not scroll; closing puts the page back where it was.
    await page.goto('/?round=3');
    await settle(page);
    await allSixOn(page);
    await pickInPlace(page);
    await page.click('#teacher-open');
    await expect(page.locator('#teacher')).toBeVisible();
    await page.click('#training-details');
    await expect(page.locator('#teacher-foot')).toBeVisible();
    const moved = await page.evaluate(() => document.body.scrollTop);
    console.log(`[e2e] 1366 × ${height}: the tray and its details moved the page ${moved} px`);
    expect(moved, `${height}: the tray moved the page to keep the button above it`).toBeGreaterThan(0);
    await page.click('#teacher-close');
    await expect(page.locator('#teacher')).toBeHidden();
    expect(await page.evaluate(() => window.scrollY), `${height}: back where it was before the tray moved it`).toBe(0);
    // The details stay open from here: a taller tray that moves the page each time it opens.
    const bodyTop = (): Promise<number> => page.evaluate(() => document.body.scrollTop);
    const settled = async (): Promise<number> => {
      let last = -1;
      for (let i = 0; i < 40; i++) {
        const now = await bodyTop();
        if (now === last) return now;
        last = now;
        await page.waitForTimeout(60);
      }
      return last;
    };
    // Open, close, open, close: back each time (Astra, A2).
    for (let i = 0; i < 2; i++) {
      await page.click('#teacher-open');
      expect(await bodyTop(), `${height}: open ${i + 1} moved the page`).toBeGreaterThan(0);
      await page.click('#teacher-close');
      expect(await page.evaluate(() => window.scrollY), `${height}: back after close ${i + 1}`).toBe(0);
    }
    // The reader scrolls away and comes back to the very place the tray left the page: that is still the reader's
    // scroll, so closing keeps it (A2: equal positions do not prove the reader never scrolled).
    await page.click('#teacher-open');
    const trayPlace = await bodyTop();
    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, 60);
    const away = await settled();
    await page.mouse.wheel(0, -60);
    const back = await settled();
    console.log(`[e2e] 1366 × ${height}: the tray left the page at ${trayPlace} px; the reader scrolled to ${away} and back to ${back}`);
    expect(away).toBeGreaterThan(trayPlace);
    expect(Math.abs(back - trayPlace)).toBeLessThanOrEqual(1);
    await page.click('#teacher-close');
    // Kept: where the reader left it, as far as the window, taller now the tray is gone, can scroll.
    const kept = await page.evaluate((at) => ({ y: window.scrollY, want: Math.min(at, document.documentElement.scrollHeight - window.innerHeight) }), back);
    expect(kept.want, `${height}: the window can scroll to the reader's place, or near it`).toBeGreaterThan(0);
    expect(Math.abs(kept.y - kept.want), `${height}: the reader's place kept`).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    // A resize while the tray is open: closing still puts the page back where it was.
    await page.click('#teacher-open');
    expect(await bodyTop()).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height });
    await page.click('#teacher-close');
    expect(await page.evaluate(() => window.scrollY), `${height}: back after a resize while open`).toBe(0);
    await page.setViewportSize({ width: 1366, height });
    // The revealed rules: the page scrolls to them, and closing keeps them in view.
    await page.click('#teacher-open');
    await page.click('#reveal');
    await expect(page.locator('#rules')).toBeVisible();
    await settled();
    await page.click('#teacher-close');
    const rules = await page.evaluate(() => ({ scrollY: window.scrollY, top: document.querySelector('#rules-title')?.getBoundingClientRect().top ?? -1, inner: window.innerHeight }));
    console.log(`[e2e] 1366 × ${height}: the revealed rules after the close ${JSON.stringify(rules)}`);
    expect(rules.scrollY, `${height}: the rules' place kept`).toBeGreaterThan(0);
    expect(rules.top).toBeGreaterThanOrEqual(0);
    expect(rules.top).toBeLessThan(rules.inner);
    await page.click('#teacher-open');
    await page.click('#reveal'); // hidden again
    await page.click('#teacher-close');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#train');
    await weekOver(page);
    // The reader scrolls while the tray is open, with the wheel, to the report: closing keeps that place.
    await page.click('#teacher-open');
    await expect(page.locator('#teacher')).toBeVisible();
    await page.mouse.move(600, 200);
    for (let i = 0; i < 20 && (await page.evaluate(() => document.querySelector('#report-title')?.getBoundingClientRect().top ?? 0)) > 150; i++) await page.mouse.wheel(0, 300);
    await settled();
    const reading = await page.evaluate(() => ({ body: document.body.scrollTop, title: Math.round(document.querySelector('#report-title')?.getBoundingClientRect().top ?? -1) }));
    await page.click('#teacher-close');
    await expect(page.locator('#teacher')).toBeHidden();
    const after = await page.evaluate(() => ({ scrollY: window.scrollY, title: Math.round(document.querySelector('#report-title')?.getBoundingClientRect().top ?? -1) }));
    console.log(`[e2e] 1366 × ${height}: reading the report with the tray open at ${JSON.stringify(reading)}, after the close ${JSON.stringify(after)}`);
    expect(reading.body).toBeGreaterThan(200);
    expect(Math.abs(after.scrollY - reading.body), `${height}: the reader's place kept`).toBeLessThanOrEqual(1);
    expect(Math.abs(after.title - reading.title)).toBeLessThanOrEqual(1);
  }
});

test("at 1024 and 1366 wide: what happens next while the GM gets ready, the rail's two scoped labels over their numbers, and the report's headline amounts whole in their tiles (G6, rows 15b, 17, 22)", async ({ page }) => {
  test.setTimeout(180_000);
  for (const width of [1024, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/');
    await settle(page);
    await makePicks(page);
    await page.evaluate(
      ([preparing, playing]) => {
        type Seen = { ready: { shown: boolean; top: number; bottom: number; yardBottom: number }[]; labels: { lines: Record<string, number>; below: Record<string, boolean> }[] };
        const seen: Seen = { ready: [], labels: [] };
        (window as unknown as { __seen6: Seen }).__seen6 = seen;
        /** The rendered lines a phrase takes inside an element (0 when the phrase is not there). */
        const lines = (el: Element | null, phrase: string): number => {
          if (el === null) return 0;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const nodes: Text[] = [];
          for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) nodes.push(n as Text);
          const all = nodes.map((n) => n.textContent ?? '').join('');
          const at = all.indexOf(phrase);
          if (at < 0) return 0;
          // The phrase's range across the text nodes it spans.
          const range = document.createRange();
          let pos = 0;
          for (const n of nodes) {
            const len = (n.textContent ?? '').length;
            if (pos <= at && at < pos + len) range.setStart(n, at - pos);
            if (pos < at + phrase.length && at + phrase.length <= pos + len) range.setEnd(n, at + phrase.length - pos);
            pos += len;
          }
          return new Set(Array.from(range.getClientRects()).filter((r) => r.width > 1).map((r) => Math.round(r.top))).size;
        };
        const tick = (): void => {
          const status = document.querySelector('#status')?.textContent ?? '';
          if (status === preparing) {
            const card = document.querySelector('.next-card');
            const r = card?.getBoundingClientRect();
            seen.ready.push({ shown: card !== null && card.getClientRects().length > 0, top: r?.top ?? -1, bottom: r?.bottom ?? -1, yardBottom: document.querySelector('.yard-frame')?.getBoundingClientRect().bottom ?? -1 });
          }
          if (status === playing && seen.labels.length < 40) {
            const today = document.querySelector('#rail-live .stat-today');
            const bonusLab = document.querySelector('#rail-live .stat-bonus .stat-lab');
            const todayNum = today?.querySelector('b')?.getBoundingClientRect();
            const bonusNum = document.querySelector('#rail-live .stat-bonus .stat-val')?.getBoundingClientRect();
            const todayLabel = today?.querySelector('.stat-sub-label') ?? null;
            seen.labels.push({
              lines: {
                "Today's profit so far,": lines(today, "Today's profit so far,"),
                "after the GM's pay": lines(today, "after the GM's pay"),
                "The GM's bonus": lines(bonusLab, "The GM's bonus"),
                'this week so far': lines(bonusLab, 'this week so far'),
              },
              below: {
                today: todayNum !== undefined && todayLabel !== null && todayNum.top >= todayLabel.getBoundingClientRect().bottom - 1,
                bonus: bonusNum !== undefined && bonusLab !== null && bonusNum.top >= bonusLab.getBoundingClientRect().bottom - 1,
              },
            });
          }
          if (!status.startsWith('The week is over')) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      [PREPARING, PLAYING],
    );
    await page.click('#train');
    await weekOver(page);
    type Seen = { ready: { shown: boolean; top: number; bottom: number; yardBottom: number }[]; labels: { lines: Record<string, number>; below: Record<string, boolean> }[] };
    const seen = await page.evaluate(() => (window as unknown as { __seen6: Seen }).__seen6);
    // Row 15b: while the GM gets ready, "What happens next" under the yard, in the window.
    expect(seen.ready.length, `${width}: frames sampled while the GM got ready`).toBeGreaterThan(0);
    console.log(`[e2e] ${width} × 768 getting ready, what happens next: ${JSON.stringify(seen.ready[0])}`);
    for (const r of seen.ready) {
      expect(r.shown, `${width}: what happens next shown while the GM gets ready`).toBe(true);
      expect(r.top).toBeGreaterThanOrEqual(r.yardBottom);
      expect(r.bottom).toBeLessThanOrEqual(768);
    }
    // Row 17: each label whole phrase by phrase, over its number.
    expect(seen.labels.length).toBeGreaterThan(0);
    console.log(`[e2e] ${width} × 768 the rail's scoped labels: ${JSON.stringify(seen.labels[0])}`);
    for (const l of seen.labels) {
      expect(l.lines, `${width}: each phrase on one line`).toEqual({ "Today's profit so far,": 1, "after the GM's pay": 1, "The GM's bonus": 1, 'this week so far': 1 });
      expect(l.below, `${width}: each label over its number`).toEqual({ today: true, bonus: true });
    }
    // Row 22: the headline's amounts whole in their tiles.
    await page.locator('#report').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect(page.locator('#report-tiles .tile')).toHaveCount(5);
    const tiles = await page.locator('#report-tiles .tile-value').evaluateAll((els) => els.map((el) => ({ text: el.textContent ?? '', scroll: el.scrollWidth, client: el.clientWidth })));
    console.log(`[e2e] ${width} × 768 the headline's amounts: ${JSON.stringify(tiles)}`);
    for (const t of tiles) expect(t.scroll, `${width}: "${t.text}" whole in its tile`).toBeLessThanOrEqual(t.client);
  }
});

test("the sliders' zero, as drawn: a tick 4 px taller than the track, centred on the track's zero, on every editable row (G6, row 5)", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?round=3');
  await settle(page);
  const ticks = await page.locator('.plan .kpi-scale').evaluateAll((scales) =>
    scales.map((scale) => {
      const tick = getComputedStyle(scale, '::before');
      const slider = scale.querySelector('input') as HTMLInputElement;
      const box = scale.getBoundingClientRect();
      const s = slider.getBoundingClientRect();
      return {
        content: tick.content,
        display: tick.display,
        height: tick.height,
        width: tick.width,
        color: tick.backgroundColor,
        // The tick's centre against the slider's centre, both ways (left: 50% − 1 px of a 2 px tick; top: 50% − 6 px).
        dx: Math.abs(box.left + parseFloat(tick.left) + parseFloat(tick.width) / 2 - (s.left + s.width / 2)),
        dy: Math.abs(box.top + parseFloat(tick.top) + parseFloat(tick.marginTop) + parseFloat(tick.height) / 2 - (s.top + s.height / 2)),
      };
    }),
  );
  console.log(`[e2e] the zero ticks: ${JSON.stringify(ticks[0])}`);
  expect(ticks).toHaveLength(6);
  for (const t of ticks) {
    expect({ content: t.content, display: t.display, height: t.height, width: t.width, color: t.color }).toEqual({ content: '""', display: 'block', height: '12px', width: '2px', color: 'rgb(63, 76, 89)' });
    expect(t.dx).toBeLessThanOrEqual(0.5);
    expect(t.dy).toBeLessThanOrEqual(0.5);
  }
});
