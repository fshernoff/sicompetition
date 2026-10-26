import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Trainer } from '../src/learn/train.ts';
import { describeWeek } from '../src/sim/readout.ts';
import { setWeight, toggleKpi } from '../src/world/bonusPlan.ts';
import { loadDefaultConfig, loadPreset } from '../src/world/config.ts';

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
  // Paced, the run lasts about 20 s: long enough to see every control off, and on again after (G3).
  for (const id of ['#prediction', '#round', '#kpi-profit-on', '#kpi-profit-weight', '#seed', '#fast', '#train']) {
    await expect(page.locator(id)).toBeDisabled();
  }
  await expect(page.locator('#status')).toContainText('stable', { timeout: 120_000 });
  const ms = Date.now() - started;
  await expect(page.locator('#train')).toBeEnabled();
  for (const id of ['#prediction', '#round', '#seed', '#fast']) await expect(page.locator(id)).toBeEnabled();
  await expect(page.locator('#kpi-profit-on')).toBeDisabled(); // Round 1's own lock is back, not the run's
  await expect(page.locator('#kpi-profit-weight')).toBeDisabled();
  const readout = (await page.locator('#readout').textContent()) ?? '';
  expect(readout).toMatch(/accepted every booking on 5 of 5 days/);
  expect(readout).toMatch(/ran the floor with 1 staffer on 4 days/);
  expect(readout).toMatch(/chose nap 0 times/);
  console.log(`[e2e] Round 1 stable in ${ms} ms: ${readout}`);
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

const ROUND1_WORDS = 'Each day, the GM earns 10 points per $100 of profit.';

test('Round 1 locks the plan; Round 2 unlocks it and reloads the preset', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#round')).toHaveValue('round1');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#limit')).toContainText('Round 1: the plan is set.');
  await expect(page.locator('#kpi-profit-on')).toBeChecked();
  await expect(page.locator('#kpi-profit-on')).toBeDisabled();
  await expect(page.locator('#kpi-profit-weight')).toBeDisabled();
  await expect(page.locator('#kpi-profit-value')).toHaveText('+10');
  await expect(page.locator('#kpi-incidents-on')).not.toBeChecked();
  await expect(page.locator('#kpi-incidents-on')).toBeDisabled();
  await expect(page.locator('#kpi-incidents-weight')).toBeDisabled();
  await expect(page.locator('#kpi-incidents-value')).toHaveText('−5');
  await page.selectOption('#round', 'round2');
  await expect(page.locator('#limit')).toContainText('1 of 3 measures on.');
  await expect(page.locator('#kpi-profit-on')).toBeEnabled();
  await expect(page.locator('#kpi-profit-weight')).toBeEnabled();
  await expect(page.locator('#kpi-incidents-on')).toBeEnabled();
  await expect(page.locator('#kpi-incidents-weight')).toBeDisabled(); // off: its slider waits for the toggle
  await setSlider(page, '#kpi-profit-weight', '3');
  await expect(page.locator('#kpi-profit-value')).toHaveText('+3');
  await expect(page.locator('#plan-words')).toHaveText('Each day, the GM earns 3 points per $100 of profit.');
  await page.selectOption('#round', 'round1');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS); // the preset reloads
  await expect(page.locator('#kpi-profit-weight')).toBeDisabled();
});

test('Round 2 refuses a fourth measure', async ({ page }) => {
  await page.goto('/?round=2');
  await expect(page.locator('#round')).toHaveValue('round2');
  await expect(page.locator('#limit')).toHaveText('1 of 3 measures on.');
  await page.check('#kpi-incidents-on');
  await page.check('#kpi-reputation-on');
  await expect(page.locator('#limit')).toHaveText('3 of 3 measures on. Turn one off to turn another on.');
  await expect(page.locator('#kpi-fatigue-on')).toBeDisabled();
  await expect(page.locator('#kpi-overRatio-on')).toBeDisabled();
  await expect(page.locator('#kpi-dogsServed-on')).toBeDisabled();
  await expect(page.locator('#kpi-reputation-on')).toBeEnabled(); // what is on can always go off
  await expect(page.locator('#plan-words')).toHaveText(
    'Each day, the GM earns 10 points per $100 of profit, loses 5 points per incident, and earns 5 points per point of reputation gained.',
  );
  await expect(page.locator('#plan-note')).toHaveText(
    'Profit and reputation count both ways: a $100 loss or a one-point drop counts the opposite of a $100 gain or a one-point rise.',
  );
  await page.uncheck('#kpi-incidents-on');
  await expect(page.locator('#limit')).toHaveText('2 of 3 measures on.');
  await expect(page.locator('#kpi-fatigue-on')).toBeEnabled();
  await expect(page.locator('#plan-words')).toHaveText(
    'Each day, the GM earns 10 points per $100 of profit and earns 5 points per point of reputation gained.',
  );
});

test('the editor: the words follow the sliders, the edited plan is what trains, the prediction stays', async ({ page }) => {
  test.setTimeout(90_000);
  const foreign = watchRequests(page);
  await page.goto('/?round=3');
  await expect(page.locator('#round')).toHaveValue('round3');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#kpi-incidents-weight')).toBeDisabled();
  await page.check('#kpi-incidents-on');
  await expect(page.locator('#kpi-incidents-weight')).toBeEnabled();
  await setSlider(page, '#kpi-incidents-weight', '-7');
  await expect(page.locator('#kpi-incidents-value')).toHaveText('−7');
  const words = 'Each day, the GM earns 10 points per $100 of profit and loses 7 points per incident.';
  await expect(page.locator('#plan-words')).toHaveText(words);
  await expect(page.locator('#plan-note')).toHaveText('Profit counts both ways: a $100 loss counts the opposite of a $100 gain.');
  const prediction = 'Fewer dogs, fewer incidents, less profit.';
  await page.fill('#prediction', prediction);
  await page.check('#fast');
  await page.fill('#seed', '1');
  await page.click('#train');
  await expect(page.locator('#train')).toHaveText('Train again', { timeout: 60_000 });
  await expect(page.locator('#train')).toBeEnabled();
  const status = (await page.locator('#status').textContent()) ?? '';
  expect(status).not.toContain('target met');
  expect(status).toMatch(/stable|still changing its mind/);
  await expect(page.locator('#prediction')).toBeEnabled();
  await expect(page.locator('#prediction')).toBeVisible();
  await expect(page.locator('#prediction')).toHaveValue(prediction);
  await expect(page.locator('#plan-words')).toHaveText(words);
  await expect(page.locator('#kpi-incidents-weight')).toBeEnabled();
  await expect(page.locator('#kpi-dogsServed-on')).toBeEnabled(); // Round 3's own rules are back: 2 of 6 on
  await expect(page.locator('#round')).toBeEnabled();
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
  expect(status).toContain(`Episodes ${twinEnd.episodes.toLocaleString('en-US')}`);
  console.log(`[e2e] edited plan: ${status} · ${expected}`);
  // A slider edit after a run clears that run's results.
  await setSlider(page, '#kpi-profit-weight', '5');
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#status')).toContainText('The plan changed.');
  await expect(page.locator('#plan-words')).toHaveText('Each day, the GM earns 5 points per $100 of profit and loses 7 points per incident.');
  // A second run, then a round change clears it and reloads the preset.
  await page.click('#train');
  await expect(page.locator('#train')).toHaveText('Train again', { timeout: 60_000 });
  await expect(page.locator('#train')).toBeEnabled();
  await expect(page.locator('#readout')).toContainText(/The GM accepted every booking on \d of 5 days/);
  await page.selectOption('#round', 'round2');
  await expect(page.locator('#readout')).toHaveText('');
  await expect(page.locator('#status')).toContainText('The plan changed.');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#limit')).toHaveText('1 of 3 measures on.');
  expect(foreign).toEqual([]);
});

test('a plan that does not settle ends at the episode limit, still changing its mind', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?round=3');
  await page.uncheck('#kpi-profit-on');
  await page.check('#kpi-incidents-on');
  await expect(page.locator('#plan-words')).toHaveText('Each day, the GM loses 5 points per incident.');
  await expect(page.locator('#plan-note')).toHaveText('');
  await page.check('#fast');
  await page.fill('#seed', '1');
  await page.click('#train');
  await expect(page.locator('#train')).toHaveText('Train again', { timeout: 60_000 });
  const status = (await page.locator('#status').textContent()) ?? '';
  expect(status).toMatch(/stopped at the episode limit, the GM is still changing its mind$/);
  expect(status).not.toContain('stable');
  await expect(page.locator('#readout-label')).toHaveText("The GM's test week (still changing its mind)");
  // Deterministic to the cap: the same plan and seed in node give the same sentence.
  const world = loadDefaultConfig();
  const incidentsOnly = toggleKpi(toggleKpi(loadPreset('round3').spec, 'profit', 6) as NonNullable<ReturnType<typeof toggleKpi>>, 'incidents', 6) as NonNullable<ReturnType<typeof toggleKpi>>;
  const twin = new Trainer(world, incidentsOnly, 1);
  const end = twin.runEpisodes(twin.config.maxEpisodes);
  expect(end.stable).toBe(false);
  expect(end.episodes).toBe(twin.config.maxEpisodes);
  await expect(page.locator('#readout')).toHaveText(describeWeek(twin.evaluate()));
  expect(status).toContain(`Episodes ${end.episodes.toLocaleString('en-US')}`);
  console.log(`[e2e] unsettled plan: ${status}`);
});

test('the pilot mode trains Round 1 whatever the address says about the round', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?pilot=1&round=3');
  await expect(page.locator('#pilot h2')).toContainText('Round 1');
  await expect(page.locator('.pilot-summary')).toHaveText('1 of 1 seeds target met in under 60 s', { timeout: 60_000 });
  await expect(page.locator('#round')).toHaveValue('round1');
  await expect(page.locator('#plan-words')).toHaveText(ROUND1_WORDS);
  await expect(page.locator('#pilot tbody tr')).toHaveCount(1);
  await expect(page.locator('#pilot tbody tr td').nth(4)).toHaveText('yes');
});
