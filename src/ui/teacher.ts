// The teacher's tray (BRIEF section 11, D39, D46): the "Teacher" button in the bar opens a panel fixed to the bottom of
// the window, one row in three labelled groups (Round; This run: the seed and the export; Behind the curtain: the
// reveal of the hidden rules, the learning curve, D50: the teacher's view of the AI behind the GM, and the training
// details, which show the learner's check line at the panel's foot; G5d). The tray overlays the bottom of the window and
// never moves the lesson; while it is open the page scrolls in the body, whose box ends at the tray's measured top, so
// no line of the page is ever under the tray and the last rows scroll clear of it (G5d round 4).
// The export builds its file from what the page holds once the run's readout is out (D47, D51): the trace the
// sentence, the replay and the table show, the setup snapshotted at the click, the run's result and the trainer's
// curve. It never runs the GM's week again.
import { hiddenRules } from '../world/hiddenRules.ts';
import { describeBonusPlan } from '../world/bonusPlan.ts';
import { pageScroller, redraw, scrollBehavior } from './app.ts';
import type { Page } from './app.ts';
import { buildExport, downloadJson, exportFilename } from './export.ts';
import type { RunExportInput } from './export.ts';
import { uiIconSvg } from './icons.ts';

const REVEAL = 'Reveal the hidden rules';
const HIDE = 'Hide the hidden rules';
const SHOW_CURVE = 'Show the learning curve';
const HIDE_CURVE = 'Hide the learning curve';

/** Writes the open tray's height to --tray-height: the body, the page's scroller then, ends that far above the window's bottom. */
function measureTray(page: Page): void {
  if (page.teacher.hidden) return;
  document.documentElement.style.setProperty('--tray-height', `${page.teacher.offsetHeight}px`);
}

/**
 * The page's controls that stay in view when the tray opens (G5d round 2, row 4): the buttons a class presses. When the
 * tray opens over one that was in the window, the page scrolls it above the tray, at once.
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
  if (overlap > 0) {
    pageScroller().scrollBy({ top: overlap, behavior: 'auto' });
    clearEdge(page); // the page moved: it lands with no line cut by the tray's edge
  }
}

/**
 * No line of the page cut by the tray's top edge where the tray has moved the page (G5d round 4): if the page's
 * scroller (the body, whose box ends at the tray's top) shows a line of text only in part at that edge, it scrolls a
 * few pixels more so the line is whole, shown (preferred) or below the edge, keeping the class's buttons above it.
 * Text in a sticky box does not move with the scroll and is left out. A page the tray did not move stays where it is
 * (D46: the tray never moves the lesson).
 */
function clearEdge(page: Page): void {
  if (page.teacher.hidden) return;
  const body = document.body;
  const edge = body.getBoundingClientRect().top + body.clientHeight;
  const lines: Array<[number, number]> = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const host = node.parentElement;
    if (host === null || (node.textContent ?? '').trim() === '' || page.teacher.contains(host) || host.closest('.visually-hidden') !== null) continue;
    let moves = true;
    for (let a: Element | null = host; a !== null && a !== body; a = a.parentElement) {
      if (getComputedStyle(a).position === 'sticky') moves = false;
    }
    if (!moves) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) if (r.height >= 2 && r.width >= 2) lines.push([r.top, r.bottom]);
  }
  const buttons = KEEP_CLEAR.map((s) => document.querySelector<HTMLElement>(s))
    .filter((el): el is HTMLElement => el !== null && el.getClientRects().length > 0)
    .map((el) => el.getBoundingClientRect().bottom)
    .filter((bottom) => bottom > 0 && bottom <= edge);
  const cut = (d: number): boolean => lines.some(([top, bottom]) => top - d < edge - 1 && bottom - d > edge + 1);
  if (!cut(0)) return;
  const room = body.scrollHeight - body.clientHeight;
  // The smallest move first, a reveal (down the page) weighed at half a hide (up), so the cut line is shown if it can be.
  const moves = Array.from({ length: 48 }, (_, i) => i + 1)
    .flatMap((n) => [n, -n])
    .sort((a, b) => (a > 0 ? a : -2 * a) - (b > 0 ? b : -2 * b));
  for (const d of moves) {
    if (body.scrollTop + d < 0 || body.scrollTop + d > room) continue;
    if (d < 0 && buttons.some((bottom) => bottom - d > edge)) continue;
    if (!cut(d)) {
      body.scrollTop += d;
      return;
    }
  }
}

export function openTray(page: Page): void {
  const wasOpen = document.documentElement.classList.contains('teacher-open');
  const top = pageScroller().scrollTop;
  page.teacher.hidden = false;
  page.teacherOpen.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('teacher-open');
  measureTray(page);
  if (!wasOpen) document.body.scrollTop = top; // the page stays where it was, now scrolling above the tray
  keepClear(page);
}

export function closeTray(page: Page): void {
  const wasOpen = document.documentElement.classList.contains('teacher-open');
  const top = pageScroller().scrollTop;
  page.teacher.hidden = true;
  page.teacherOpen.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('teacher-open');
  if (wasOpen) window.scrollTo({ top, behavior: 'auto' }); // the window scrolls again, from where the body was
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
  keepClear(page); // a taller tray may now cover a button
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
