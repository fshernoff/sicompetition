import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Trainer } from '../src/learn/train.ts';
import { describeWeek, outcomeKey } from '../src/sim/readout.ts';
import { formatMoney } from '../src/ui/report.ts';
import { setWeight, toggleKpi } from '../src/world/bonusPlan.ts';
import { loadDefaultConfig, loadPreset } from '../src/world/config.ts';

// The one Playwright smoke, in parts: the built page loads clean and makes no request beyond its own origin, the
// teacher panel is closed by default and holds the teacher's controls (G5), and Round 1 trains to the reckless week
// in headless Chromium (G2 plan, acceptance 3) with its export equal to a node-side twin (G5).
const ORIGIN = 'http://127.0.0.1:4173';

/** The fixed keys of an export (BRIEF section 11; the export test pins the same list). */
const EXPORT_KEYS = ['app', 'config', 'curve', 'evaluations', 'exportedAt', 'learner', 'plan', 'planWords', 'prediction', 'readout', 'round', 'seed', 'speed', 'version'].sort();

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
  await expect(page.locator('canvas#curve')).toBeVisible();
  await expect(page.locator('canvas#replay')).toBeVisible();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'none');
  await expect(page.locator('#curve-caption')).toContainText("You wrote the bonus plan. Watch the GM's bonus climb as it learns how to earn it.");
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
  await expect(page.locator('#speed')).toBeHidden();
  await expect(page.locator('#rules')).toBeHidden();
  await expect(page.locator('#seed')).toHaveValue('1');
  // The tray: the check line before a run, the export off, Normal speed, Round 1.
  await openTray(page);
  await expect(page.locator('#check')).toHaveText('No run yet.');
  await expect(page.locator('#export')).toBeDisabled();
  await expect(page.locator('#reveal')).toBeEnabled();
  await expect(page.locator('#speed')).toHaveValue('normal');
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
  await page.click('#train');
  await expect(page.locator('#teacher')).toBeVisible();
  await expect(page.locator('#check')).toContainText('whole number');
  await expect(page.locator('#seed')).toBeFocused();
  await expect(page.locator('#status')).toHaveText('Write your prediction, then put the GM to work.');
  await expect(page.locator('#train')).toBeEnabled();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'none');
  await page.fill('#seed', '1');
  await page.click('#teacher-close');
  await expect(page.locator('#teacher')).toBeHidden();
  expect(foreign).toEqual([]);
});

test('Round 1 trains to the reckless week, and the export is the twin\'s week', async ({ page }) => {
  test.setTimeout(150_000);
  const foreign = watchRequests(page);
  await page.setViewportSize({ width: 1366, height: 768 }); // the Chromebook (G4 plan, the fold)
  await page.goto('/');
  // Train is within reach on the Chromebook without scrolling (G4 plan, the fold; the target is 680, the gate 700).
  const trainBox = await page.locator('#train').boundingBox();
  expect(trainBox).not.toBeNull();
  const trainBottom = (trainBox?.y ?? 0) + (trainBox?.height ?? 0);
  console.log(`[e2e] Train's bottom on load at 1366 wide: ${Math.round(trainBottom)} px`);
  expect(trainBottom).toBeLessThanOrEqual(700);
  // The tray open: the button is still above it (G5 plan: the tray overlays, it never moves the lesson).
  await openTray(page);
  const trayBox = await page.locator('#teacher').boundingBox();
  expect(trayBox).not.toBeNull();
  console.log(`[e2e] the tray open at 1366 × 768: top ${Math.round(trayBox?.y ?? 0)} px, height ${Math.round(trayBox?.height ?? 0)} px`);
  expect((trayBox?.y ?? 0) + (trayBox?.height ?? 0)).toBeLessThanOrEqual(768);
  // Measured again with the tray open: the tray overlays, so the button has not moved (Astra, diff review).
  const trainBoxOpen = await page.locator('#train').boundingBox();
  const trainBottomOpen = (trainBoxOpen?.y ?? 0) + (trainBoxOpen?.height ?? 0);
  expect(trainBottomOpen).toBe(trainBottom);
  expect(trainBottomOpen).toBeLessThanOrEqual(trayBox?.y ?? 0);
  await page.fill('#seed', '1');
  await expect(page.locator('#speed')).toHaveValue('normal');
  await expect(page.locator('#export')).toBeDisabled();
  const prediction = 'All the dogs it can take, one staffer, lots of incidents.';
  await page.fill('#prediction', prediction);
  // Every status text from the click is in the student's form (D38, D41): an observer records each write, so a
  // click-time sentence that is overwritten 100 ms later is still seen (Astra, diff review).
  await page.evaluate(() => {
    const el = document.querySelector('#status');
    const log: string[] = [];
    (window as unknown as { __statusLog?: string[] }).__statusLog = log;
    if (!el) return;
    log.push(el.textContent ?? '');
    new MutationObserver(() => log.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true });
  });
  const started = Date.now();
  await page.click('#train');
  // Paced, the run lasts about 20 s: long enough to see every control off, and on again after (G3).
  for (const id of ['#prediction', '#round-round1', '#round-round2', '#kpi-profit-on', '#kpi-profit-weight', '#seed', '#speed', '#train', '#export']) {
    await expect(page.locator(id)).toBeDisabled();
  }
  await expect(page.locator('#reveal')).toBeEnabled(); // the teacher may reveal the rules at any time
  // The fold, during the run while the table is still hidden: the page scrolled the watching area into view, and
  // with the tray open the canvases and their captions sit above it (Astra, plan review).
  const geometry = () =>
    page.evaluate(() => {
      const box = (id: string) => document.querySelector(id)?.getBoundingClientRect() ?? new DOMRect(-1, -1, 0, 0);
      const tray = document.querySelector('#teacher') as HTMLElement | null;
      return {
        statusTop: Math.round(box('#status').top),
        curveBottom: Math.round(box('#curve').bottom),
        replayBottom: Math.round(box('#replay').bottom),
        curveCaptionBottom: Math.round(box('#curve-caption').bottom),
        replayCaptionBottom: Math.round(box('#replay-caption').bottom),
        trayTop: tray && !tray.hidden ? Math.round(tray.getBoundingClientRect().top) : window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        reportHidden: (document.querySelector('#report') as HTMLElement | null)?.hidden ?? false,
        week: document.querySelector('#replay')?.getAttribute('data-week') ?? '',
      };
    });
  await expect
    .poll(async () => {
      const g = await geometry();
      // One sample proves it all: the run is on (the replay in its training week, the table still hidden) and the
      // smooth scroll has landed with the status line at the top (scroll-margin-top 8 px) and both canvases and
      // their captions in view above the tray.
      return (
        g.reportHidden &&
        g.week === 'training' &&
        g.statusTop >= 0 &&
        g.statusTop <= 16 &&
        g.curveBottom <= g.trayTop &&
        g.replayBottom <= g.trayTop &&
        g.curveCaptionBottom <= g.trayTop &&
        g.replayCaptionBottom <= g.trayTop &&
        g.trayTop <= 768 &&
        g.scrollWidth <= 1366
      );
    }, { timeout: 5_000, message: 'the run on, the table hidden, the status at the top and the curve, the replay and their captions above the open tray inside 1366 × 768' })
    .toBe(true);
  console.log(`[e2e] during the run: ${JSON.stringify(await geometry())}`);
  // The check line counts while the run is on, in the teacher's words.
  await expect(page.locator('#check')).toContainText(/^Weeks trained [\d,]+ · ε \d\.\d\d · evaluations [\d,]+ · not stable yet · \d+\.\d s$/);
  await expect(page.locator('#status')).toContainText('has settled', { timeout: 120_000 });
  const samples = await statusLog(page);
  expect(samples.length).toBeGreaterThan(50); // about ten writes a second for 20 s
  expect(samples[0]).toBe('Write your prediction, then put the GM to work.'); // before the click
  for (const text of samples.slice(1)) {
    expect(text).toMatch(/^(The GM is [\d,]+ weeks? into the job and still changing how it runs the place|After [\d,]+ weeks on the job, the GM has settled into its routine)\.$/);
    for (const word of ['ε', 'evaluation', 'target met', 'Episodes', 'stable', 'paced', 'seed', 'practis', 'point', 'train']) expect(text).not.toContain(word);
  }
  const ms = Date.now() - started;
  await expect(page.locator('#train')).toBeEnabled();
  for (const id of ['#prediction', '#round-round1', '#seed', '#speed', '#export']) await expect(page.locator(id)).toBeEnabled();
  await expect(page.locator('#kpi-profit-on')).toBeDisabled(); // Round 1's own lock is back, not the run's
  await expect(page.locator('#kpi-profit-weight')).toBeDisabled();
  const readout = (await page.locator('#readout').textContent()) ?? '';
  expect(readout).toMatch(/accepted every booking on 5 of 5 days/);
  expect(readout).toMatch(/ran the floor with 1 staffer on 4 days/);
  expect(readout).toMatch(/chose nap 0 times/);
  // The status line in the student's words (D38): weeks on the job and settled, nothing of the learner's.
  const status = (await page.locator('#status').textContent()) ?? '';
  expect(status).toMatch(/^After [\d,]+ weeks on the job, the GM has settled into its routine\.$/);
  for (const word of ['ε', 'evaluation', 'target met', 'Episodes', 'stable', 'paced', 'practis', 'point']) expect(status).not.toContain(word);
  // The check line is the pilot table's row for this run (D6, section 13), with the status's week count.
  const check = (await page.locator('#check').textContent()) ?? '';
  expect(check).toMatch(/^Weeks trained [\d,]+ · ε 0\.10 · evaluations [\d,]+ · stable · target met · \d+\.\d s$/);
  const weeks = status.match(/After ([\d,]+) weeks/)?.[1];
  expect(check).toContain(`Weeks trained ${weeks} ·`);
  console.log(`[e2e] the check line: ${check}`);
  // The finished layout: the status, the curve and the replay are still inside the viewport, the table below them.
  const after = await geometry();
  console.log(`[e2e] after the run: ${JSON.stringify(after)}`);
  expect(after.statusTop).toBeGreaterThanOrEqual(0);
  expect(after.curveBottom).toBeLessThanOrEqual(after.trayTop);
  expect(after.replayBottom).toBeLessThanOrEqual(after.trayTop);
  expect(after.scrollWidth).toBeLessThanOrEqual(1366);
  // The sentence, the table and the replay describe one week: the node-side Trainer's on the same seed.
  const twin = new Trainer(loadDefaultConfig(), loadPreset('round1').spec, 1);
  const twinEnd = twin.runEpisodes(twin.config.maxEpisodes);
  const week = twin.evaluate();
  expect(readout).toBe(describeWeek(week));
  await expect(page.locator('#report')).toBeVisible();
  const line = (label: RegExp) => page.locator('#report-table tr').filter({ has: page.locator('th', { hasText: label }) });
  await expect(line(/^Profit$/).locator('td').last()).toHaveText(formatMoney(week.totals.profit));
  await expect(line(/^Incidents$/).locator('td').last()).toHaveText(String(week.totals.incidents));
  await expect(line(/^Dogs accepted$/).locator('td').last()).toHaveText(String(week.totals.dogsServed));
  await expect(page.locator('#replay-again')).toBeVisible();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'final');
  await expect(page.locator('#replay')).toHaveAttribute('data-key', outcomeKey(week)); // the week on the yard is the twin's
  expect(await drawnFraction(page, '#replay')).toBeGreaterThan(0.05); // the yard is drawn, not the placeholder
  // The export is what the page holds at the end of the run (D47): the prediction as it stood at the click, the
  // seed and the speed of the click, not the fields as they stand now; the whole report equals the twin's.
  await page.fill('#prediction', 'changed after the run');
  await page.fill('#seed', '7');
  await page.selectOption('#speed', 'fast');
  await expect(page.locator('#export')).toBeEnabled(); // a prediction, seed or speed change is not a plan change
  const { file, name } = await exportRun(page);
  expect(name).toMatch(/^reward-the-pack-round1-seed1-\d{8}-\d{4}\.json$/);
  expect(Object.keys(file).sort()).toEqual(EXPORT_KEYS);
  expect(file['version']).toBe(1);
  expect(file['config']).toBe('default');
  expect(file['round']).toBe('round1');
  expect(file['seed']).toBe(1);
  expect(file['speed']).toBe('normal');
  expect(file['plan']).toEqual(loadPreset('round1').spec);
  expect(file['planWords']).toBe('Each day, the GM earns $10 per $100 of profit.');
  expect(file['prediction']).toBe(prediction);
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
  console.log(`[e2e] Round 1 settled in ${ms} ms: ${readout} · ${status}`);
  expect(ms).toBeLessThan(60_000);
  expect(foreign).toEqual([]);
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
  await page.selectOption('#speed', 'full');
  await page.fill('#seed', '1');
  await page.click('#reveal'); // the rules are the config's, not the run's: they stay through clears and runs
  await expect(page.locator('#rules')).toBeVisible();
  await expect(page.locator('#export')).toBeDisabled();
  await page.click('#train');
  await expect(page.locator('#train')).toHaveText('Put the GM to work again', { timeout: 60_000 });
  await expect(page.locator('#train')).toBeEnabled();
  const status = (await page.locator('#status').textContent()) ?? '';
  expect(status).not.toContain('target met');
  expect(status).toMatch(/has settled into its routine|still changing how it runs the place/);
  for (const word of ['ε', 'evaluation', 'Episodes', 'stable', 'paced', 'practis', 'point', 'train']) expect(status).not.toContain(word);
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
  expect(status).toContain(`After ${twinEnd.episodes.toLocaleString('en-US')} weeks on the job`);
  console.log(`[e2e] edited plan: ${status} · ${expected}`);
  const { file } = await exportRun(page);
  expect(file['round']).toBe('round3');
  expect(file['speed']).toBe('full');
  expect(file['plan']).toEqual(edited);
  expect(file['planWords']).toBe(words);
  expect(file['prediction']).toBe(prediction);
  expect((file['readout'] as { sentence: string }).sentence).toBe(expected);
  expect((file['learner'] as { hasTarget: boolean; targetMet: boolean }).hasTarget).toBe(false);
  // A slider edit after a run clears that run's results, even while the final week is playing (D37; Astra, diff
  // review: the clear must cancel a live producer, not only an idle one), and the export goes off with them.
  await page.click('#replay-again');
  await page.waitForTimeout(150);
  expect(await drawnFraction(page, '#replay')).toBeGreaterThan(0.05);
  await setSlider(page, '#kpi-profit-weight', '5');
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#status')).toContainText('The plan changed.');
  await expect(page.locator('#report')).toBeHidden(); // the table and the replay are results too (D37)
  await expect(page.locator('#report-table tr')).toHaveCount(0);
  await expect(page.locator('#replay-again')).toBeHidden();
  await expect(page.locator('#replay')).toHaveAttribute('data-week', 'none');
  await expect(page.locator('#export')).toBeDisabled();
  await expect(page.locator('#check')).toHaveText('No run yet.');
  await expect(page.locator('#rules')).toBeVisible(); // the rules survive the clear
  // The clear cancels the replay's producer: nothing redraws the old week on a later frame or a resize (Astra).
  await twoFrames(page);
  await page.setViewportSize({ width: 1200, height: 800 });
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
  await expect(page.locator('#train')).toHaveText('Put the GM to work again', { timeout: 60_000 });
  await expect(page.locator('#train')).toBeEnabled();
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

test('a plan that does not settle ends at the episode limit, still changing its mind', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?round=3');
  await page.uncheck('#kpi-profit-on');
  await page.check('#kpi-incidents-on');
  await expect(page.locator('#plan-words')).toHaveText('Each day, the GM loses $5 per incident.');
  await expect(page.locator('#plan-note')).toHaveText('');
  await openTray(page);
  await page.selectOption('#speed', 'full');
  await page.fill('#seed', '1');
  await page.click('#train');
  await expect(page.locator('#train')).toHaveText('Put the GM to work again', { timeout: 60_000 });
  const status = (await page.locator('#status').textContent()) ?? '';
  expect(status).toBe('After 150,000 weeks on the job, the GM is still changing how it runs the place.');
  expect(status).not.toContain('settled');
  await expect(page.locator('#readout-label')).toHaveText("A week the GM's way (not settled yet)");
  await expect(page.locator('#check')).toContainText(/^Weeks trained 150,000 · ε 0\.10 · evaluations [\d,]+ · not stable · no target for this plan · \d+\.\d s$/);
  // Deterministic to the cap: the same plan and seed in node give the same sentence.
  const world = loadDefaultConfig();
  const incidentsOnly = toggleKpi(toggleKpi(loadPreset('round3').spec, 'profit', 6) as NonNullable<ReturnType<typeof toggleKpi>>, 'incidents', 6) as NonNullable<ReturnType<typeof toggleKpi>>;
  const twin = new Trainer(world, incidentsOnly, 1);
  const end = twin.runEpisodes(twin.config.maxEpisodes);
  expect(end.stable).toBe(false);
  expect(end.episodes).toBe(twin.config.maxEpisodes);
  await expect(page.locator('#readout')).toHaveText(describeWeek(twin.evaluate()));
  expect(status).toContain(`After ${end.episodes.toLocaleString('en-US')} weeks on the job`);
  console.log(`[e2e] unsettled plan: ${status}`);
});

test('the pilot mode trains Round 1 whatever the address says, and its export is the last seed\'s run', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?pilot=2&round=3');
  await expect(page.locator('#pilot h2')).toContainText('Round 1');
  await expect(page.locator('.pilot-summary')).toHaveText('2 of 2 seeds target met in under 60 s', { timeout: 60_000 });
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
  expect(file['speed']).toBe('full');
  expect(file['round']).toBe('round1');
  expect(file['prediction']).toBe('');
  const twin = new Trainer(loadDefaultConfig(), loadPreset('round1').spec, 2);
  const end = twin.runEpisodes(twin.config.maxEpisodes);
  expect((file['readout'] as { report: unknown }).report).toEqual(twin.evaluate());
  expect((file['learner'] as { weeksTrained: number }).weeksTrained).toBe(end.episodes);
  expect(Number(episodesCell.replace(/,/g, ''))).toBe(end.episodes);
});
