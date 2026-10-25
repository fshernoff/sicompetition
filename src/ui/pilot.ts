// The pilot mode, ?pilot=N: the Chromebook measurement of BRIEF section 13. Seeds 1..N train in turn with the same
// frame loop and rendering as the Train button, each with its own 60 s budget, and each adds a row to a table.
// The pilot is never paced: it measures the machine.
import { BUDGET_MS, runTraining, showError } from './app.ts';
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
  page.train.disabled = true;
  page.seed.disabled = true;
  page.fast.disabled = true;

  const heading = document.createElement('h2');
  heading.textContent = `Pilot: seeds 1 to ${n}, ${BUDGET_MS / 1000} s each`;
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const title of ['Seed', 'Episodes', 'Seconds', 'Stable', 'Target met']) cell(head, title, 'th');
  const body = table.createTBody();
  page.pilot.replaceChildren(heading, table);

  let metInTime = 0;
  for (let seed = 1; seed <= n; seed++) {
    page.seed.value = String(seed);
    page.readout.textContent = '';
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

  page.train.disabled = false;
  page.seed.disabled = false;
  page.fast.disabled = false;
  page.train.textContent = 'Train again';
}
