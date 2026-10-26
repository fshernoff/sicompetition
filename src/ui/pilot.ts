// The pilot mode, ?pilot=N: the Chromebook measurement of BRIEF section 13. Seeds 1..N train in turn with the same
// frame loop and rendering as the Put the GM to work button, each with its own 60 s budget, and each adds a row to a
// table.
// The pilot is never paced: it measures the machine. It always trains the Round 1 plan, whatever ?round= says: it
// loads Round 1 into the selector, the editor and the training spec, and keeps every control off for the whole run.
// The replay plays during its runs like any other: the pilot measures the page as the class sees it.
import { loadPreset, validateRewardSpec } from '../world/config.ts';
import { AGAIN, BUDGET_MS, clearRun, runTraining, setControls, showError, showRound } from './app.ts';
import type { Page } from './app.ts';

const MAX_PILOT_SEEDS = 200;

/** N from "?pilot=N" when it is a whole number 1..200, otherwise null (no pilot). */
export function pilotCount(search: string): number | null {
  const value = new URLSearchParams(search).get('pilot');
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_PILOT_SEEDS ? n : null;
}

function cell(row: HTMLTableRowElement, text: string, tag: 'td' | 'th' = 'td'): void {
  const el = document.createElement(tag);
  el.textContent = text;
  row.appendChild(el);
}

export async function runPilot(page: Page, n: number): Promise<void> {
  showRound(page, 'round1');
  page.editor.load(loadPreset('round1'));
  page.spec = validateRewardSpec(page.editor.spec());
  setControls(page, false);
  try {
    await pilotSeeds(page, n);
  } finally {
    setControls(page, true);
    page.train.textContent = AGAIN;
  }
}

async function pilotSeeds(page: Page, n: number): Promise<void> {
  const heading = document.createElement('h2');
  heading.textContent = `Pilot: seeds 1 to ${n}, ${BUDGET_MS / 1000} s each, the Round 1 plan`;
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const title of ['Seed', 'Episodes', 'Seconds', 'Stable', 'Target met']) cell(head, title, 'th');
  const body = table.createTBody();
  page.pilot.replaceChildren(heading, table);

  let metInTime = 0;
  for (let seed = 1; seed <= n; seed++) {
    page.seed.value = String(seed);
    clearRun(page); // each seed starts clean: the replay, the sentence, the table and the curve (D37)
    let result;
    try {
      result = await runTraining(page, seed, performance.now(), `Pilot seed ${seed} of ${n} · `, false);
    } catch (err) {
      showError(page, err);
      break;
    }
    const s = result.snapshot;
    if (s.targetMet && !result.outOfBudget) metInTime++;
    const row = body.insertRow();
    cell(row, String(seed));
    cell(row, s.episodes.toLocaleString('en-US'));
    cell(row, result.outOfBudget ? 'budget' : (result.ms / 1000).toFixed(1));
    cell(row, s.stable ? 'yes' : 'no');
    cell(row, s.targetMet ? 'yes' : 'no');
    // Let the browser paint the new row before the next seed starts.
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  const summary = document.createElement('p');
  summary.className = 'pilot-summary';
  summary.textContent = `${metInTime} of ${n} seeds target met in under ${BUDGET_MS / 1000} s`;
  page.pilot.appendChild(summary);
}
