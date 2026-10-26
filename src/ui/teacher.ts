// The teacher's tray (BRIEF section 11, D39, D46): a small "Teacher" tab in the bottom-right corner opens a tray
// fixed to the bottom of the window, holding the round radios, the seed, the speed, the reveal of the hidden rules,
// the export and the learner's check line. The tray overlays the page and never moves the lesson; while it is open
// the page gets its measured height as bottom padding, so the last rows can still scroll above it.
// The export builds its file from what the page holds at the end of the run (D47): the trace the sentence, the
// replay and the table show, the setup snapshotted at the click, the run's result and the trainer's curve. It never
// runs the GM's week again.
import { hiddenRules } from '../world/hiddenRules.ts';
import { describeBonusPlan } from '../world/bonusPlan.ts';
import type { Page } from './app.ts';
import { buildExport, downloadJson, exportFilename } from './export.ts';
import type { RunExportInput } from './export.ts';

const REVEAL = 'Reveal the hidden rules';
const HIDE = 'Hide the hidden rules';

/** Writes the open tray's height to --tray-height, the padding the page keeps under it. */
function measureTray(page: Page): void {
  if (page.teacher.hidden) return;
  document.documentElement.style.setProperty('--tray-height', `${page.teacher.offsetHeight}px`);
}

export function openTray(page: Page): void {
  page.teacher.hidden = false;
  page.teacherOpen.setAttribute('aria-expanded', 'true');
  page.teacherOpen.hidden = true; // the tray covers the corner; its own Close button closes it
  document.documentElement.classList.add('teacher-open');
  measureTray(page);
}

export function closeTray(page: Page): void {
  page.teacher.hidden = true;
  page.teacherOpen.setAttribute('aria-expanded', 'false');
  page.teacherOpen.hidden = false;
  document.documentElement.classList.remove('teacher-open');
}

/** A seed that is not a whole number 0..4294967295: the message goes to the tray, never to the student's status. */
export function rejectSeed(page: Page, message: string): void {
  openTray(page);
  page.check.textContent = message;
  measureTray(page); // the message may wrap to another line
  page.seed.focus();
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
  page.rules.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * The export's input, from what the page holds: null unless a run has ended and not been cleared. Reads only; it
 * never runs the GM's week again.
 */
export function exportInput(page: Page): RunExportInput | null {
  const { trace, setup, result, trainer } = page;
  if (trace === null || setup === null || result === null || trainer === null) return null;
  return {
    configName: page.world.name,
    round: setup.round,
    seed: setup.seed,
    speed: setup.speed,
    spec: page.spec,
    planWords: describeBonusPlan(page.spec, page.world),
    prediction: setup.prediction,
    trace,
    curve: trainer.curve(),
    evals: trainer.evals(),
    snapshot: result.snapshot,
    ms: result.ms,
    outOfBudget: result.outOfBudget,
    exportedAt: new Date(),
  };
}

/** Wires the tab, the tray's close button, the reveal and the export. */
export function mountTeacher(page: Page): void {
  page.teacherOpen.addEventListener('click', () => openTray(page));
  page.teacherClose.addEventListener('click', () => {
    closeTray(page);
    page.teacherOpen.focus();
  });
  window.addEventListener('resize', () => measureTray(page));
  // The check line is rewritten during a run and can wrap at a narrow width: the padding follows the tray's own
  // size, not only the window's (Astra, G5 diff review).
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => measureTray(page)).observe(page.teacher);
  page.reveal.addEventListener('click', () => toggleRules(page));
  page.exportButton.addEventListener('click', () => {
    const input = exportInput(page);
    if (!input) return;
    downloadJson(exportFilename(input), buildExport(input));
  });
}
