import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Trainer } from '../src/learn/train.ts';
import { describeWeek, outcomeKey } from '../src/sim/readout.ts';
import { formatMoney } from '../src/ui/report.ts';
import { setWeight, toggleKpi } from '../src/world/bonusPlan.ts';
import { loadDefaultConfig, loadPreset } from '../src/world/config.ts';
import { STUDENT_ALLOWED, STUDENT_BANS } from '../tests/ui/bans.ts';

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
    const samples: { drawn: number; readout: string; reportHidden: boolean; week: string }[] = [];
    (window as unknown as { __prep?: typeof samples }).__prep = samples;
    const canvas = document.querySelector('#replay') as HTMLCanvasElement;
    const tick = (): void => {
      const status = document.querySelector('#status')?.textContent ?? '';
      if (status === preparing) {
        const ctx = canvas.getContext('2d');
        const d = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : new Uint8ClampedArray(4);
        let differ = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) differ++;
        samples.push({
          drawn: differ / (d.length / 4),
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
        replayWidth: Math.round(box('#replay').width),
        replayBottom: Math.round(box('#replay').bottom),
        replayCaptionBottom: Math.round(box('#replay-caption').bottom),
        compareTop: Math.round(box('.compare').top),
        compareBottom: Math.round(box('.compare').bottom),
        trayTop: tray && !tray.hidden ? Math.round(tray.getBoundingClientRect().top) : window.innerHeight,
        // The rail's last line while the week plays: the whole rail fits the window (G5d round 2 follow-up; the status
        // is pinned to the top then, so the rail cannot scroll).
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
      return g.status === PLAYING && g.statusTop >= 0 && g.statusTop <= 16 && g.replayBottom <= g.trayTop && g.replayCaptionBottom <= g.trayTop && g.scrollWidth <= 1366;
    }, { timeout: 5_000, message: 'the week playing, the status at the top and the yard and its caption above the open tray' })
    .toBe(true);
  const during = await geometry();
  console.log(`[e2e] while the week plays: ${JSON.stringify(during)}`);
  expect(during.replayWidth).toBeGreaterThanOrEqual(560); // the yard is big now, even above an open tray (G4's question)
  expect(during.railLast).toBeGreaterThan(0);
  expect(during.railLast).toBeLessThanOrEqual(during.innerHeight); // the rail's last line in the window at 1366 × 768
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
  await expect(line(/^Profit before the GM's bonus$/).locator('td').last()).toHaveText(formatMoney(week.totals.profit)); // BRIEF 10.1 (G5d)
  await expect(line(/^Incidents$/).locator('td').last()).toHaveText(String(week.totals.incidents));
  await expect(line(/^Dogs accepted$/).locator('td').last()).toHaveText(String(week.totals.dogsServed));
  await expect(page.locator('#replay-again')).toBeVisible();
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
  await page.click('#show-curve');
  await expect(page.locator('#learning')).toBeHidden();
  await expect(page.locator('#show-curve')).toHaveText('Show the learning curve');
  // The page's content can always scroll clear of the open tray: the report's last row, then the revealed rules.
  const clearsTray = (selector: string) =>
    page.evaluate((sel) => {
      window.scrollTo(0, document.documentElement.scrollHeight);
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
  await page.click('#new-prediction');
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
  test.setTimeout(90_000);
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
  await samplePreparing(page);
  await makePicks(page);
  await page.click('#train');
  await weekOver(page);
  console.log(`[e2e] frames sampled while the GM got ready (the unsettled plan): ${await expectPreparingClean(page)}`);
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
