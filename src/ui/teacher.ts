// The teacher's tray (BRIEF section 11, D39, D46): the "Teacher" button in the bar opens a panel fixed to the bottom of
// the window, one row in three labelled groups (Round; This run: the seed and the export; Behind the curtain: the
// reveal of the hidden rules, the learning curve, D50: the teacher's view of the AI behind the GM, and the training
// details, which show the learner's check line at the panel's foot; G5d). The tray overlays the page and never moves the lesson; while it is open the page gets its measured
// height as bottom padding, so the last rows can still scroll above it.
// The export builds its file from what the page holds once the run's readout is out (D47, D51): the trace the
// sentence, the replay and the table show, the setup snapshotted at the click, the run's result and the trainer's
// curve. It never runs the GM's week again.
import { hiddenRules } from '../world/hiddenRules.ts';
import { describeBonusPlan } from '../world/bonusPlan.ts';
import { redraw, scrollBehavior } from './app.ts';
import type { Page } from './app.ts';
import { buildExport, downloadJson, exportFilename } from './export.ts';
import type { RunExportInput } from './export.ts';
import { uiIconSvg } from './icons.ts';

const REVEAL = 'Reveal the hidden rules';
const HIDE = 'Hide the hidden rules';
const SHOW_CURVE = 'Show the learning curve';
const HIDE_CURVE = 'Hide the learning curve';

/** Writes the open tray's height to --tray-height, the padding the page keeps under it. */
function measureTray(page: Page): void {
  if (page.teacher.hidden) return;
  document.documentElement.style.setProperty('--tray-height', `${page.teacher.offsetHeight}px`);
}

/**
 * The page's controls that must never sit under the open tray (G5d round 2, row 4): the buttons a class presses. When
 * the tray opens over one, the page (which keeps the tray's height as bottom padding) scrolls it clear, at once.
 */
const KEEP_CLEAR = ['#train', '#new-prediction', '#replay-again'];

function keepClear(page: Page): void {
  const trayTop = page.teacher.getBoundingClientRect().top;
  let overlap = 0;
  for (const selector of KEEP_CLEAR) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el === null || el.hidden || el.getClientRects().length === 0) continue;
    const box = el.getBoundingClientRect();
    if (box.bottom <= 0 || box.top >= window.innerHeight) continue; // off screen: not covered by the tray
    if (box.bottom > trayTop) overlap = Math.max(overlap, box.bottom - trayTop + 12);
  }
  if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'auto' });
}

export function openTray(page: Page): void {
  page.teacher.hidden = false;
  page.teacherOpen.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('teacher-open');
  measureTray(page);
  keepClear(page);
}

export function closeTray(page: Page): void {
  page.teacher.hidden = true;
  page.teacherOpen.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('teacher-open');
}

/** A seed that is not a whole number 0..4294967295: the message goes to the tray, never to the student's status. */
export function rejectSeed(page: Page, message: string): void {
  openTray(page);
  page.check.textContent = message;
  showDetails(page, true); // the message is the teacher's to read
  measureTray(page); // the message may wrap to another line
  page.seed.focus();
}

/**
 * The training details (G5d round 1, row 28): the learner's check line and the export's note, under a disclosure in
 * the panel's row, so the panel is one row until the teacher asks for them.
 */
function showDetails(page: Page, open: boolean): void {
  const button = page.teacher.querySelector<HTMLButtonElement>('#training-details');
  const foot = page.teacher.querySelector<HTMLElement>('#teacher-foot');
  if (button === null || foot === null) return;
  foot.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  measureTray(page);
}

/** The hidden rules, written into the list once: the config's, so no run or clear ever touches them. */
function renderRules(page: Page): void {
  if (page.rulesList.childElementCount > 0) return;
  for (const rule of hiddenRules(page.world)) {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = `${rule.id}. ${rule.title}`;
    li.append(strong, ` ${rule.words}`);
    page.rulesList.appendChild(li);
  }
}

function toggleRules(page: Page): void {
  if (!page.rules.hidden) {
    page.rules.hidden = true;
    page.reveal.textContent = REVEAL;
    return;
  }
  renderRules(page);
  page.rules.hidden = false;
  page.reveal.textContent = HIDE;
  page.rules.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

/**
 * The learning curve under the report: shown, it is measured and drawn now (the page skips it while hidden); like the
 * rules it survives clears, with an empty curve.
 */
function toggleCurve(page: Page): void {
  if (!page.learning.hidden) {
    page.learning.hidden = true;
    page.showCurve.textContent = SHOW_CURVE;
    return;
  }
  page.learning.hidden = false;
  page.showCurve.textContent = HIDE_CURVE;
  redraw(page);
  page.learning.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

/**
 * The export's input, from what the page holds: null unless a run's readout is out and has not been cleared. Reads
 * only; it never runs the GM's week again.
 */
export function exportInput(page: Page): RunExportInput | null {
  const { trace, setup, result, trainer } = page;
  if (!page.readoutShown || trace === null || setup === null || result === null || trainer === null) return null;
  return {
    configName: page.world.name,
    round: setup.round,
    seed: setup.seed,
    spec: page.spec,
    planWords: describeBonusPlan(page.spec, page.world),
    prediction: setup.prediction,
    picks: setup.picks,
    trace,
    curve: trainer.curve(),
    evals: trainer.evals(),
    snapshot: result.snapshot,
    ms: result.ms,
    outOfBudget: result.outOfBudget,
    exportedAt: new Date(),
  };
}

/**
 * Wires the Teacher button in the bar (it opens the tray and, pressed again, closes it), the tray's close button, the
 * reveal, the learning curve and the export. A key beside "Teacher" in the bar and the tray's title (decoration only).
 */
export function mountTeacher(page: Page): void {
  for (const el of [page.teacherOpen, page.teacher.querySelector('.teacher-title')]) {
    if (el) el.insertAdjacentHTML('afterbegin', uiIconSvg('key', 18, 2));
  }
  page.teacherOpen.addEventListener('click', () => {
    if (page.teacher.hidden) openTray(page);
    else closeTray(page);
  });
  page.teacherClose.addEventListener('click', () => {
    closeTray(page);
    page.teacherOpen.focus();
  });
  window.addEventListener('resize', () => measureTray(page));
  // The check line is rewritten during a run and can wrap at a narrow width: the padding follows the tray's own
  // size, not only the window's (Astra, G5 diff review).
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => measureTray(page)).observe(page.teacher);
  page.reveal.addEventListener('click', () => toggleRules(page));
  page.teacher.querySelector('#training-details')?.addEventListener('click', (e) => {
    showDetails(page, (e.currentTarget as HTMLElement).getAttribute('aria-expanded') !== 'true');
  });
  page.showCurve.addEventListener('click', () => toggleCurve(page));
  page.exportButton.addEventListener('click', () => {
    const input = exportInput(page);
    if (!input) return;
    downloadJson(exportFilename(input), buildExport(input));
  });
}
