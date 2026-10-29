// The page controller: the round line, the bonus plan editor, the prediction, the Put the GM to work button (#train),
// the watching area (the status line, the rail of the block's values and the yard, the week replay) and the weekly P&L
// and operations report. The teacher's controls (the round, the seed, the hidden rules, the learning curve, the
// export, the check line) live in the tray that teacher.ts mounts (BRIEF section 11, D39).
// G5d (D59, Floor): one screen in three phases on #watch[data-phase] (syncPhase): the console (the premise, the plan,
// the picks, the Why and the button) beside the yard; the run (the GM's status and the rail beside a wide yard); and
// after the week the scorecard beside how the business did, the plan and the Why under them, the yard beside.
// The GM is an AI the owners put in charge, and how it decides never shows (D50, D53). The click puts the GM to work:
// the learner trains unpaced in requestAnimationFrame slices, out of sight, while the yard shows the in-world wait; the
// teacher's check line and, when the teacher shows it, the learning curve are redrawn at most 10 times a second.
// Training stops when the trainer is done or 60 s after the click (D6, BRIEF section 13: the final week computed and
// its first frame drawn count against the budget). Then the GM's one week, the final greedy week, plays once on the
// yard, and only when it has played does the readout come out: the sentence beside the prediction, the table and
// "Watch the week again" (D51). One greedy week, three views (D40): the sentence, the replay and the table all come
// from the one EpisodeTrace the page holds. A run belongs to the plan it was trained on (D37): the click snapshots the
// editor's plan into page.spec, and any change to the plan after a run calls clearRun, which also cancels the run and
// the replay through the run token.
import { DEFAULT_LEARNER, Trainer } from '../learn/train.ts';
import type { TrainingSnapshot } from '../learn/train.ts';
import { describeWeek, outcomeKey } from '../sim/readout.ts';
import { loadDefaultConfig, loadPreset, validateRewardSpec } from '../world/config.ts';
import type { PresetName } from '../world/config.ts';
import type { EpisodeTrace, RewardSpec, WorldConfig } from '../world/types.ts';
import { checkLine } from './check.ts';
import { drawCurve } from './curve.ts';
import type { CurveColors } from './curve.ts';
import { mountEditor, planLines, roundFromSearch } from './editor.ts';
import type { Editor } from './editor.ts';
import { YARD_ASPECT, drawReplay, replayArtReady, replayClock, replayFrame } from './replay.ts';
import type { ReplayColors, ReplayFonts, ReplayFrame, ReplayOptions } from './replay.ts';
import { appendArrowed, bonusWithCents, formatDollars, formatMoney, headlineTiles, renderReport, renderTiles, reportTable, withCents } from './report.ts';
import { PICKS, PICKS_HINT, calledLine, checkPrediction, emptyPicks, picksComplete } from './prediction.ts';
import type { PickField, PickResult, Picks } from './prediction.ts';
import { describeBonusPlan } from '../world/bonusPlan.ts';
// The GM on the page is the set's orb in its three states (D59), rendered at the page's size (WP4b: 128 px, 64 CSS px).
import gmDoneUrl from '../assets/art/set/gm-page-done.webp';
import gmReadyUrl from '../assets/art/set/gm-page-ready.webp';
import gmRunningUrl from '../assets/art/set/gm-page-running.webp';
import { BONUS_ICON_PATHS, MEASURE_ICON_PATHS, UI_ICON_PATHS, iconSvg } from './icons.ts';
import { mountRail, railModel } from './rail.ts';
import type { RailIcon, RailView } from './rail.ts';
import { ROUND_NOTES } from './roundNotes.ts';
import { studentStatus } from './status.ts';
import { mountTeacher, rejectSeed } from './teacher.ts';

export const BUDGET_MS = 60_000; // from the click (or a pilot seed's start), rendering included
const SLICE_MS = 10; // training time per animation frame (always unpaced, D52)
const REDRAW_MS = 100; // at most 10 check-line and curve redraws (and canvas measurements) a second
const MAX_SEED = 4_294_967_295;
const MAX_BACKING_WIDTH = 1920;
const MAX_BACKING_HEIGHT = 1080;

/** The rounds the teacher's radios offer (BRIEF section 8), in order; their labels come from the presets. */
export const ROUNDS: readonly PresetName[] = ['round1', 'round2', 'round3'];
const READOUT_LABEL = 'What the GM did';
const REPLAY_CAPTION = "The GM's week";
/** The yard while the GM gets ready (the learner trains, out of sight): an in-world wait, not a loading screen. */
const PREPARING_PLACEHOLDER = 'Monday, before opening: the GM is getting ready.';
/** The button's words after a run (and after the pilot). */
export const AGAIN = 'Put the GM to work again';
/** The placeholder's background: clear, so the dimmed yard behind the canvas shows (G5c). */
const CLEAR = 'rgba(0, 0, 0, 0)';
const ERROR_LINE = 'The GM stopped because of a problem. Ask your teacher for help.';
/** Four blocks a day (BRIEF section 2): the denominator of "blocks over the limit" (G5d round 1, row 15). */
const BLOCKS_PER_DAY = 4;
const NO_RUN = 'No run yet.';
const SEED_MESSAGE = `The seed must be a whole number from 0 to ${MAX_SEED}.`;

interface CanvasSize {
  width: number; // CSS pixels
  height: number;
  ratio: number; // backing-store pixels per CSS pixel
}

/** What a run was started with, snapshotted at the click (D47); the pilot's own for each seed. */
export interface RunSetup {
  seed: number;
  round: PresetName;
  prediction: string; // the team's prediction as it stood at the click: read there and nowhere else (D2, D47)
  picks: Picks; // the five picks as they stood at the click (D47, D56)
}

export interface Page {
  roundLabel: HTMLElement; // the round as a line of text on the student's page (D34)
  roundNote: HTMLElement;
  rounds: HTMLInputElement[]; // the teacher's three round radios, in ROUNDS order
  editor: Editor;
  prediction: HTMLTextAreaElement; // the team's "Why?": read only at the click, for the export (D2, D47)
  /** The five picks' radios (D56), every option of every pick, in PICKS order. */
  pickRadios: HTMLInputElement[];
  picksBox: HTMLElement; // the five pick rows
  picksHint: HTMLElement; // "Make all five picks to put the GM to work.", tied to the button while a pick is missing
  /** After the week: the called line, what the GM did and the scorecard, in place of the picks. */
  resultBox: HTMLElement;
  scorecard: HTMLElement;
  calledLine: HTMLElement;
  newPrediction: HTMLButtonElement; // "Make a new prediction": a clear (D56)
  /** The scorecard shows the click's picks: the radios stay locked until a clear (D56). */
  scorecardShown: boolean;
  /** False while a run (or the pilot) holds the controls (setControls). */
  controlsEnabled: boolean;
  stagePlan: HTMLElement; // the plan the GM works to, beside the yard during and after a run
  stagePlanWords: HTMLElement;
  stageWhy: HTMLElement; // the team's reasons beside the yard while the GM gets ready and runs the week (round 1, row 20)
  stageWhyText: HTMLElement;
  stageFoot: HTMLElement; // under the yard: the next steps on load, the picks and reasons while it plays, the readout after
  runSeed: HTMLElement; // the tray's "This run" seed, read-only (round 3, row 20)
  readReport: HTMLButtonElement; // after the week, the primary way on: to the weekly P&L (round 3, row 11)
  stagePicks: HTMLElement; // the team's five picks beside the yard, so the class watches the week against them
  stagePicksList: HTMLElement;
  seed: HTMLInputElement;
  train: HTMLButtonElement;
  teacher: HTMLElement; // the tray
  teacherOpen: HTMLButtonElement; // the tab in the corner
  teacherClose: HTMLButtonElement;
  reveal: HTMLButtonElement;
  rules: HTMLElement; // the hidden rules section, under the report
  rulesList: HTMLOListElement;
  learning: HTMLElement; // the teacher's learning curve section, under the rules; hidden until the teacher shows it
  showCurve: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  check: HTMLElement; // the learner's check line in the tray (D6, section 13)
  compare: HTMLElement; // the prediction beside what the GM did: scrolled into view when the week is over
  watch: HTMLElement; // the status line and the yard: scrolled into view at the click
  status: HTMLElement;
  canvas: HTMLCanvasElement; // the learning curve, in the teacher's section
  ctx: CanvasRenderingContext2D;
  /** The week replay. data-week is "none", "preparing" or "final"; data-plays counts the playbacks clicks started. */
  replayCtx: CanvasRenderingContext2D;
  replayCaption: HTMLElement;
  replayAgain: HTMLButtonElement;
  readout: HTMLElement;
  readoutLabel: HTMLElement;
  report: HTMLElement; // the weekly P&L and operations report, hidden until a run ends
  reportTable: HTMLTableElement;
  reportTiles: HTMLElement; // the report's headline numbers, above the table (WP3's tiles)
  pilot: HTMLElement;
  colors: CurveColors;
  replayColors: ReplayColors;
  world: WorldConfig;
  spec: RewardSpec; // the plan of the current or last run, snapshotted and validated at the click
  trainer: Trainer | null; // the last run, kept so a window resize can redraw its curve
  replay: HTMLCanvasElement;
  /** The run's final week, which the replay, the sentence and the table show; null before a run, while the GM gets
   * ready and after a clear. */
  trace: EpisodeTrace | null;
  /** performance.now() when the replay of `trace` started playing. */
  replayStartedAt: number;
  /** Bumped by clearRun and at the start of a run; a scheduled frame holding an older token draws nothing. */
  token: number;
  /** The playback loop running now, if any: a second start while it plays restarts it instead of starting another. */
  playback: Promise<boolean> | null;
  /** The replay canvas's size, measured at the 10 Hz redraw and on resize, never every frame. */
  replaySize: CanvasSize | null;
  /** The rail beside the yard (G5d): the block's values in words, written once per block while a week is on the yard. */
  railView: RailView;
  /** The block the rail and the stage's day chip show now; -1 when no week is on the yard. */
  railStep: number;
  stageWhen: HTMLElement; // the day and block, over the yard while the week plays
  business: HTMLElement; // after the week: how the business did, beside what the team called
  pickDots: HTMLElement[]; // the hint's five dots, one filled per pick made
  /** The page's canvas font (--font-ui), for the yard's words. */
  fonts: ReplayFonts;
  /** The current or last run's setup, from the click; null before a run and after a clear. */
  setup: RunSetup | null;
  /** The last run's result, set when it resolves; null before a run, during one and after a clear. */
  result: RunResult | null;
  /** The readout (the sentence, the table, Watch the week again) is out; the export waits for it (D51). */
  readoutShown: boolean;
  /** True from the week's end until settleYard: the yard keeps the size it played at (G5d, acceptance 7). */
  keepYardSize: boolean;
}

export interface RunResult {
  snapshot: TrainingSnapshot;
  ms: number; // from the start to the stop
  outOfBudget: boolean; // the run (training, the final week computed and its first frame drawn) passed 60 s
}

/** A run whose results were cleared while it trained: its frames stop and write nothing. */
export class RunCancelled extends Error {
  constructor() {
    super('The run was cleared before it finished.');
    this.name = 'RunCancelled';
  }
}

/** The prediction card: the picks, and after the week the scorecard and what the GM did. */
function compareArea(): HTMLElement {
  const el = document.querySelector('.compare');
  if (!(el instanceof HTMLElement)) throw new Error('page: .compare is missing');
  return el;
}

function byId<T extends HTMLElement>(id: string, kind: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) throw new Error(`page: #${id} is missing or the wrong element`);
  return el;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('page: this browser has no 2D canvas');
  return ctx;
}

/** Reads the page's CSS custom properties, so the stylesheet is the one place to change a colour. */
function cssVars(): (name: string, fallback: string) => string {
  const css = getComputedStyle(document.documentElement);
  return (name, fallback) => css.getPropertyValue(name).trim() || fallback;
}

function readColors(get: (name: string, fallback: string) => string): CurveColors {
  return {
    background: get('--chart-paper', '#ffffff'),
    ink: get('--ink', '#1f2a1f'),
    grid: get('--chart-grid', 'rgba(31, 42, 31, 0.14)'),
    raw: get('--chart-week', 'rgba(31, 42, 31, 0.22)'),
    average: get('--chart-average', '#1d5fbf'),
    evaluation: get('--chart-test', '#d9480f'),
  };
}

/** The yard's colours, from the canvas tokens (G5d: --c-*, shared with WP3) and the G4 drawing's own. */
function readReplayColors(get: (name: string, fallback: string) => string): ReplayColors {
  return {
    background: get('--c-surface', '#ffffff'),
    ink: get('--c-ink', '#13212f'),
    muted: get('--c-muted', '#4e5a66'),
    grass: get('--grass', '#cfe2b4'),
    fence: get('--replay-fence', '#a88a5c'),
    dog: [get('--replay-dog-1', '#c98a3c'), get('--replay-dog-2', '#3b3631'), get('--replay-dog-3', '#8a96a0')],
    crew: get('--replay-crew', '#1e6f8a'),
    incident: get('--c-danger', '#c23a26'),
    reputation: get('--replay-reputation', '#a8740f'),
    cash: get('--c-ok', '#1e6b41'),
    gaugeOver: get('--replay-gauge-over', 'rgba(194, 58, 38, 0.2)'),
    heading: get('--c-ink', '#13212f'),
    accent: get('--c-amber', '#f4a51c'),
  };
}

/** The page's own face for the words on the yard (--font-ui). */
function readFonts(get: (name: string, fallback: string) => string): ReplayFonts {
  const ui = get('--font-ui', "system-ui, -apple-system, 'Segoe UI', sans-serif");
  return { display: ui, body: ui };
}

/** Smooth scrolling, or instant under prefers-reduced-motion: reduce (G5c, acceptance 5). */
/**
 * The element the page scrolls in: the body while the teacher's tray is open (its box ends at the tray's top, so no
 * line is ever under the tray: G5d round 4), the document otherwise.
 */
export function pageScroller(): Element {
  return document.documentElement.classList.contains('teacher-open') ? document.body : (document.scrollingElement ?? document.documentElement);
}

export function scrollBehavior(): ScrollBehavior {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * The yard's art, decoded once (WP2's replayArtReady: memoised, never rejects; the yard keeps its vector drawing if an
 * image fails). Started at mount, awaited before the first week plays.
 */
function replayArt(): Promise<void> {
  return replayArtReady();
}

/**
 * Where the page is (G5d, D59), on #watch[data-phase]: "load" (the console: the premise, the plan, the picks, the Why
 * and the button, the yard beside it), "run" (the GM getting ready and running the week: the rail of the block's
 * values beside a wide yard; a run or the pilot holds the controls) and "done" (the scorecard beside how the business
 * did, the plan and the Why under them, the yard beside). And the GM's state on #watch[data-gm], which picks the orb:
 * idle, preparing (getting ready), playing (running the week), done (the week is over). Called before anything is
 * measured or scrolled, so the layout is the phase's from the first frame.
 */
export function syncPhase(page: Page): void {
  const week = page.replay.dataset.week;
  const phase = page.scorecardShown ? 'done' : !page.controlsEnabled && (week === 'preparing' || week === 'final') ? 'run' : 'load';
  if (page.watch.dataset.phase !== phase) page.watch.dataset.phase = phase;
  // The page's own phase too, for the bar (slim and sticky on the run, round 3, row 9).
  if (document.documentElement.dataset.phase !== phase) document.documentElement.dataset.phase = phase;
  const gm = page.readoutShown ? 'done' : week === 'preparing' ? 'preparing' : week === 'final' ? 'playing' : 'idle';
  if (page.watch.dataset.gm !== gm) page.watch.dataset.gm = gm;
  // The class's picks and reasons: in the rail under the plan while the GM gets ready (the rail has room then), under
  // the yard while the week plays (the rail is the block's values). Moved, not copied: one element each.
  const home = gm === 'preparing' ? page.stagePlan.parentElement : page.stageFoot;
  const before = gm === 'preparing' ? null : page.stageFoot.querySelector('.readout-box');
  if (home !== null && page.stagePicks.parentElement !== home) {
    home.insertBefore(page.stagePicks, before);
    home.insertBefore(page.stageWhy, before);
  }
}

/**
 * The status line's kind on #watch[data-status], for the console: on the load screen the line is shown only when it
 * has something to say beyond the premise (the plan changed after a run, or a run failed).
 */
function statusKind(text: string): string {
  if (text === studentStatus('changed')) return 'changed';
  if (text === ERROR_LINE) return 'error';
  return '';
}

/** The rail's icons, in the measures' shapes (one icon per measure everywhere) and the banknote for cash. */
function railIcon(name: RailIcon): string {
  if (name === 'cash') return iconSvg(UI_ICON_PATHS.cash, 18, 1.9);
  if (name === 'bonus') return iconSvg(BONUS_ICON_PATHS, 18, 1.9);
  return iconSvg(MEASURE_ICON_PATHS[name], 18, 1.9);
}

/**
 * One block of the week in words, beside the yard: the rail, and the day chip over the yard (the block's events are
 * the yard's own chips, WP3). Written once per block (the playback's frames between blocks write nothing); null
 * clears them.
 */
function showBlock(page: Page, frame: ReplayFrame | null): void {
  if (frame === null) {
    page.railView(null);
    page.stageWhen.hidden = true;
    return;
  }
  // Today's change of cash: from the day's opening cash, the week's start on Monday, the last pickup's after.
  const trace = page.trace;
  const openStep = frame.day * BLOCKS_PER_DAY - 1;
  const opened = openStep < 0 || trace === null ? null : replayFrame(trace.steps, openStep, page.world);
  const dayStart = opened === null ? page.world.cash.weekStart : opened.cash - opened.bonusSoFar;
  const model = railModel(frame, page.world, dayStart);
  page.railView(model);
  page.stageWhen.textContent = `${model.when} block`; // "Wednesday · pickup block" (round 3, row 8)
  page.stageWhen.hidden = false;
}

const CHECK_ICON = iconSvg(UI_ICON_PATHS.check, 16, 3);
const CROSS_ICON = iconSvg(UI_ICON_PATHS.cross, 16, 3);

/**
 * The five picks (D56): a fieldset per pick with its legend (the pick's label) and its options as chips: native
 * radios (name "pick-<field>", id "pick-<field>-<value>"), each with its label[for] as the chip; a chosen chip shows
 * a check mark, not colour alone. Returns the radios in PICKS order.
 */
function renderPicks(container: HTMLElement): HTMLInputElement[] {
  const radios: HTMLInputElement[] = [];
  const sets = PICKS.map((pick) => {
    const set = document.createElement('fieldset');
    set.className = 'pick';
    set.dataset.field = pick.field;
    const legend = document.createElement('legend');
    legend.className = 'pick-label';
    legend.textContent = pick.label;
    const chips = document.createElement('div');
    chips.className = 'pick-chips';
    for (const option of pick.options) {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'pick-input';
      radio.name = `pick-${pick.field}`;
      radio.id = `pick-${pick.field}-${option.value}`;
      radio.value = option.value;
      const label = document.createElement('label');
      label.className = 'pick-chip';
      label.htmlFor = radio.id;
      const tick = document.createElement('span');
      tick.className = 'pick-tick';
      tick.setAttribute('aria-hidden', 'true');
      tick.innerHTML = CHECK_ICON;
      label.append(tick, option.label);
      chips.append(radio, label);
      radios.push(radio);
    }
    set.append(legend, chips);
    return set;
  });
  container.replaceChildren(...sets);
  return radios;
}

/** The picks as the radios hold them now. */
export function readPicks(page: Page): Picks {
  const picks = emptyPicks();
  for (const radio of page.pickRadios) {
    if (!radio.checked) continue;
    const field = radio.name.slice('pick-'.length) as PickField;
    picks[field] = radio.value;
  }
  return picks;
}

/**
 * The picks and the button follow the controls and the scorecard: the radios are locked while a run (or the pilot)
 * holds the controls and while the scorecard shows the click's picks; Put the GM to work waits for all five, and the
 * hint, tied to the button while it waits, says so (D56).
 */
function syncPicks(page: Page): void {
  const locked = !page.controlsEnabled || page.scorecardShown;
  for (const radio of page.pickRadios) radio.disabled = locked;
  const picks = readPicks(page);
  const made = PICKS.filter((p) => picks[p.field] !== null).length;
  page.pickDots.forEach((dot, i) => dot.classList.toggle('on', i < made));
  const complete = picksComplete(picks);
  page.train.disabled = !page.controlsEnabled || !complete;
  page.picksHint.hidden = complete;
  if (complete) page.train.removeAttribute('aria-describedby');
  else page.train.setAttribute('aria-describedby', page.picksHint.id);
}

/**
 * "Your picks" beside the yard: the click's five picks (page.setup.picks), as the page's labels and chip words, so
 * the class watches the week against its prediction. Nothing of what the GM did shows until the week is over; then
 * `results` adds each row's called or missed mark. Hidden when the run has no complete picks (the pilot).
 */
function showStagePicks(page: Page, results: readonly PickResult[] | null = null): void {
  const picks = page.setup?.picks;
  if (picks === undefined || !picksComplete(picks)) {
    page.stagePicks.hidden = true;
    page.stagePicksList.replaceChildren();
    return;
  }
  const rows = PICKS.map((pick) => {
    const li = document.createElement('li');
    li.className = 'stage-pick';
    const label = document.createElement('span');
    label.className = 'stage-pick-label';
    label.textContent = pick.label;
    const chip = document.createElement('span');
    chip.className = 'stage-pick-chip';
    chip.textContent = pick.options.find((o) => o.value === picks[pick.field])?.label ?? '—';
    li.append(label, chip);
    const result = results?.find((r) => r.field === pick.field);
    if (result !== undefined) {
      li.classList.add(result.called ? 'called' : 'missed');
      const mark = document.createElement('span');
      mark.className = 'stage-pick-mark';
      mark.innerHTML = result.called ? CHECK_ICON : CROSS_ICON;
      mark.firstElementChild?.setAttribute('aria-hidden', 'true');
      const word = document.createElement('span');
      word.className = 'visually-hidden';
      word.textContent = result.called ? 'Called' : 'Missed';
      mark.appendChild(word);
      li.appendChild(mark);
    }
    return li;
  });
  page.stagePicksList.replaceChildren(...rows);
  page.stagePicks.hidden = false;
}

/** One clause of the business headline: its words, and whether it went against the business (the warning colour). */
export interface BusinessClause {
  text: string;
  hurt: boolean;
}

/**
 * The week in three short lines, the owners' bottom line first (G5d round 2, row 5; D62; round 3, rows 7 and 21):
 * "Profit $4,853.70 after the GM's bonus", "7 incidents", "reputation down 18". Facts only, no verdict; money with its
 * cents (D66). A number is tied to its neighbours by non-breaking spaces, so a line never splits a number from its noun.
 */
export function businessClauses(totals: EpisodeTrace['report']['totals']): BusinessClause[] {
  // A number keeps its neighbours ("$4,853.70 after", "7 incidents", "down 18"); the words may wrap between them.
  const keep = (text: string): string => text.replace(/(\d) /g, '$1\u00a0').replace(/ (?=[$−\d])/g, '\u00a0');
  const after = totals.profit - totals.reward;
  const incidents = totals.incidents === 0 ? 'no incidents' : `${totals.incidents} ${totals.incidents === 1 ? 'incident' : 'incidents'}`;
  const change = totals.reputationEnd - totals.reputationStart;
  const reputation = change < 0 ? `reputation down ${-change}` : change > 0 ? `reputation up ${change}` : 'reputation unchanged';
  return [
    { text: keep(`Profit ${withCents(formatDollars(after))} after the GM's bonus`), hurt: after < 0 },
    { text: keep(incidents), hurt: totals.incidents > 0 },
    { text: keep(reputation), hurt: change < 0 },
  ];
}

/**
 * How the business did (G5d, Acceptance 5; round 1, rows 6 and 15; round 2, rows 1 and 5): a factual headline the
 * size of "You called N of 5." (businessClauses: incidents and reputation lost in the warning colour), then the week's
 * figures as a table beside the picks' table, in the report's own formats and words, the owners' bottom line first:
 * the profit after the GM's bonus, the profit before it, what was paid to the GM (a cost, D62), incidents, reputation
 * and the blocks over the legal limit out of the week's twenty. A figure that went against the business is a hurt
 * (red, with its icon and words as the cue beyond colour).
 */
function renderBusiness(page: Page, trace: EpisodeTrace): void {
  const t = trace.report.totals;
  const tiles = headlineTiles(trace.report, page.spec, page.world);
  const doc = page.business.ownerDocument;
  const headline = doc.createElement('p');
  headline.className = 'business-line';
  // One clause a line (round 3, row 21: no line ends on a dangling dot); the dots stay in the text for a screen reader.
  businessClauses(t).forEach((clause, i) => {
    if (i > 0) {
      const dot = doc.createElement('span');
      dot.className = 'visually-hidden';
      dot.textContent = ' · ';
      headline.append(dot);
    }
    const span = doc.createElement('span');
    span.textContent = clause.text;
    span.className = clause.hurt ? 'clause hurt' : 'clause';
    headline.append(span);
  });
  const blocks = trace.report.days.length * BLOCKS_PER_DAY;
  const after = t.profit - t.reward;
  const rows: { icon: string; label: string; value: string; hurt: boolean; strong?: boolean }[] = [
    { icon: MEASURE_ICON_PATHS.profit, label: "Profit after the GM's bonus", value: withCents(formatDollars(after)), hurt: after < 0, strong: true },
    { icon: MEASURE_ICON_PATHS.profit, label: "Profit before the GM's bonus", value: withCents(formatMoney(t.profit)), hurt: t.profit < 0 },
    { icon: BONUS_ICON_PATHS, label: tiles[1]?.label ?? 'Paid to the GM', value: bonusWithCents(tiles[1]?.value ?? ''), hurt: false },
    { icon: MEASURE_ICON_PATHS.incidents, label: tiles[2]?.label ?? '', value: tiles[2]?.value ?? '', hurt: t.incidents > 0 },
    { icon: MEASURE_ICON_PATHS.reputation, label: tiles[3]?.label ?? '', value: tiles[3]?.value ?? '', hurt: t.reputationEnd < t.reputationStart },
    { icon: MEASURE_ICON_PATHS.overRatio, label: tiles[4]?.label ?? '', value: `${tiles[4]?.value ?? ''} of ${blocks}`, hurt: t.blocksOverRatio > 0 },
  ];
  const table = doc.createElement('table');
  table.className = 'biz-table';
  const body = table.createTBody();
  for (const r of rows) {
    const row = body.insertRow();
    row.className = `${r.hurt ? 'hurt' : ''}${r.strong === true ? ' strong' : ''}`.trim();
    const th = doc.createElement('th');
    th.scope = 'row';
    const glyph = doc.createElement('span');
    glyph.className = 'biz-icon';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML = iconSvg(r.icon, 16, 1.9);
    th.append(glyph, r.label);
    const td = row.insertCell();
    td.className = 'biz-val';
    appendArrowed(td, r.value);
    row.prepend(th);
  }
  page.business.replaceChildren(headline, table);
}

/**
 * After the week (D56): the scorecard of the click's picks (page.setup.picks) against the week the page holds: a row
 * per pick with the team's pick, what the GM did and called or missed (a mark and a word), and the called line, beside
 * how the business did (G5d). The radios stay locked until a clear.
 */
function showScorecard(page: Page): void {
  const trace = page.trace;
  const setup = page.setup;
  if (trace === null || setup === null) return;
  renderBusiness(page, trace);
  const results = checkPrediction(setup.picks, trace.report);
  const table = document.createElement('table');
  table.className = 'score-table';
  const head = table.createTHead().insertRow();
  for (const [text, cls] of [
    ['The pick', 'score-h-label'],
    ['Your pick', 'score-h-pick'],
    ['The GM did', 'score-h-actual'],
    ['', 'score-h-mark'],
  ] as const) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = cls;
    if (text === '') {
      const hidden = document.createElement('span');
      hidden.className = 'visually-hidden';
      hidden.textContent = 'Called or missed';
      th.appendChild(hidden);
    } else {
      th.textContent = text;
    }
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const r of results) {
    const row = body.insertRow();
    row.className = r.called ? 'score-row called' : 'score-row missed';
    row.dataset.field = r.field;
    row.dataset.called = String(r.called);
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = r.label;
    const picked = row.insertCell();
    picked.className = 'score-pick';
    picked.textContent = r.picked ?? '—';
    const actual = row.insertCell();
    actual.className = 'score-actual';
    actual.textContent = r.actual.replace(/(\d) /g, '$1\u00a0'); // "7 incidents" never splits (round 2, row 17)
    if (r.actual.includes(':')) actual.classList.add('long'); // "A mix: low × 1, premium × 4" may wrap at its comma
    const mark = row.insertCell();
    mark.className = 'score-mark';
    const badge = document.createElement('span');
    badge.className = 'mark';
    const glyph = document.createElement('span');
    glyph.className = 'mark-icon';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML = r.called ? CHECK_ICON : CROSS_ICON;
    badge.append(glyph, r.called ? 'Called' : 'Missed');
    mark.appendChild(badge);
    row.prepend(label);
  }
  page.scorecard.replaceChildren(table);
  showStagePicks(page, results);
  page.calledLine.textContent = calledLine(results);
  page.calledLine.hidden = false;
  page.scorecard.hidden = false;
  page.picksBox.hidden = true;
  page.newPrediction.hidden = false;
  page.compare.dataset.state = 'scorecard';
  page.scorecardShown = true;
  syncPicks(page);
  syncPhase(page);
  page.prediction.scrollTop = 0; // the reasons are quoted from their first line (now that the phase shows them)
}

/** The scorecard goes (with the run, D37) and the picks come back as they were, unlocked unless a run holds them. */
function hideScorecard(page: Page): void {
  page.scorecard.replaceChildren();
  page.scorecard.hidden = true;
  page.calledLine.textContent = '';
  page.calledLine.hidden = true;
  page.resultBox.hidden = true;
  page.picksBox.hidden = false;
  page.newPrediction.hidden = true;
  page.business.replaceChildren();
  page.compare.dataset.state = 'picks';
  page.scorecardShown = false;
  syncPicks(page);
  syncPhase(page);
}

/** The seed field as an integer 0..4294967295, or null if it is anything else. */
export function readSeed(input: HTMLInputElement): number | null {
  const text = input.value.trim();
  if (!/^\d+$/.test(text)) return null;
  const seed = Number(text);
  return seed <= MAX_SEED ? seed : null;
}

/** Sizes the canvas backing store to its element: devicePixelRatio capped at 2, at most 1920 × 1080 pixels. */
function sizeCanvas(canvas: HTMLCanvasElement): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const ratio = Math.min(2, window.devicePixelRatio || 1, MAX_BACKING_WIDTH / width, MAX_BACKING_HEIGHT / height);
  const w = Math.round(width * ratio);
  const h = Math.round(height * ratio);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { width, height, ratio };
}

/**
 * Draws the replay as the page holds it at time `now`: the placeholder without a trace, otherwise the block the
 * clock is on. Uses the cached size. Returns true when the week has played and held (or there is nothing to play).
 */
function paintReplay(page: Page, now: number): boolean {
  const size = page.replaySize ?? (page.replaySize = sizeCanvas(page.replay));
  const options: ReplayOptions = {
    pixelRatio: size.ratio,
    colors: page.replayColors,
    progress: 0,
    legalRatio: page.world.bookings.legalRatio,
    gaugeMax: page.world.requests.max,
    fonts: page.fonts,
    // The orb on the yard in the status line's state: running while the week plays, done once it is over (WP3).
    gm: page.readoutShown ? 'done' : 'running',
  };
  const trace = page.trace;
  if (trace === null) {
    // Before a week and while the GM gets ready, the canvas is clear and the board behind it shows through (the
    // stage's CSS): nothing is drawn on the load screen, and only the getting-ready line while the GM gets ready.
    // Cleared here first, so no earlier week stays under it.
    const ctx = page.replayCtx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, page.replay.width, page.replay.height);
    ctx.restore();
    const clear = { ...options, colors: { ...page.replayColors, background: CLEAR } };
    const preparing = page.replay.dataset.week === 'preparing';
    drawReplay(ctx, size.width, size.height, null, { ...clear, placeholder: preparing ? PREPARING_PLACEHOLDER : '' });
    if (page.railStep !== -1) {
      page.railStep = -1;
      showBlock(page, null);
    }
    return true;
  }
  const clock = replayClock(now - page.replayStartedAt);
  options.progress = clock.progress;
  const frame = replayFrame(trace.steps, clock.step, page.world);
  drawReplay(page.replayCtx, size.width, size.height, frame, options);
  if (page.railStep !== clock.step) {
    page.railStep = clock.step; // the rail's words change once a block, not every frame
    showBlock(page, frame);
  }
  return clock.done;
}

/**
 * Measures the replay and paints it at `now`, and, only while the teacher's learning section is shown, measures and
 * draws the curve. Called at most 10 times a second during a run, on resize, when the learning section is shown, and
 * when a run starts, ends or is cleared; between redraws the playback's frames paint only the replay.
 */
export function redraw(page: Page, now: number = performance.now()): void {
  syncPhase(page);
  // When the week ends the yard first keeps the size it played at (the stage shows that picture fitted to its
  // narrower box, object-fit in style.css), so the end of the week builds nothing new; settleYard draws it at its own
  // size once the page is still.
  const keep = page.keepYardSize && page.trace !== null && page.replaySize !== null;
  if (!keep) page.replaySize = sizeCanvas(page.replay);
  paintReplay(page, now);
  if (page.learning.hidden) return; // a hidden canvas has no size; the curve waits until it is shown
  const { width, height, ratio } = sizeCanvas(page.canvas);
  const t = page.trainer;
  drawCurve(page.ctx, width, height, t ? t.curve() : [], t ? t.evals() : [], {
    pixelRatio: ratio,
    colors: page.colors,
    averageWindow: t ? t.config.movingAverageWindow : DEFAULT_LEARNER.movingAverageWindow,
    minEpisodes: 2000,
  });
}

/**
 * After the week, once the page is still (the scroll to the scorecard has played out, then idle time): the yard drawn
 * at its own after-week size, so its labels are their size again (acceptance 6). The yard's caches are built for that
 * size here, one task, away from the week and its end (acceptance 7). A clear or a new run meanwhile cancels it.
 */
function settleYard(page: Page): void {
  const token = page.token;
  const settle = (): void => {
    if (page.token !== token || !page.keepYardSize) return;
    page.keepYardSize = false;
    redraw(page);
  };
  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(settle, { timeout: 1000 });
    else settle();
  }, 800);
}

/**
 * Plays the run's week on the replay once from its first block and holds on Friday's pickup. Shared by the click's
 * playback and "Watch the week again": a second start while the week plays restarts it on the one loop instead of
 * starting another. Resolves true when the week has played and held, false if clearRun moved the token meanwhile (the
 * loop then stops and draws nothing); rejects if painting throws.
 */
function startPlayback(page: Page): Promise<boolean> {
  if (page.trace === null) return Promise.resolve(false);
  page.replayStartedAt = performance.now();
  if (page.playback !== null) return page.playback; // the loop already running picks up the new start
  const token = page.token;
  const playback = new Promise<boolean>((resolve, reject) => {
    const frame = (now: number): void => {
      if (token !== page.token) {
        resolve(false); // cleared: clearRun has dropped the loop and drawn the placeholder
        return;
      }
      try {
        if (paintReplay(page, now)) {
          page.playback = null;
          resolve(true);
          return;
        }
      } catch (err) {
        page.playback = null;
        reject(err);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  page.playback = playback;
  return playback;
}

/**
 * The GM's week, played once for the class (D51): from its first block, holding on Friday's pickup, and counted in
 * #replay[data-plays]. Resolves true when it has played, false if the run was cleared meanwhile; rejects on a drawing
 * error.
 */
export function playWeek(page: Page): Promise<boolean> {
  page.replay.dataset.plays = String(Number(page.replay.dataset.plays ?? '0') + 1);
  return startPlayback(page);
}

/**
 * The readout, once the week has played (D51): the sentence beside the prediction, the table, Watch the week again
 * and the done status (`label` in front of it: the pilot names the seed). Sets readoutShown, which the export waits
 * for.
 */
export function showReadout(page: Page, label = ''): void {
  const trace = page.trace;
  if (trace === null) throw new Error('page: no week to read out');
  page.readout.textContent = describeWeek(trace.report);
  page.readoutLabel.textContent = READOUT_LABEL;
  page.replayCaption.textContent = REPLAY_CAPTION;
  page.runSeed.textContent = page.setup === null ? '—' : String(page.setup.seed);
  const build = (): void => {
    renderReport(page.reportTable, reportTable(trace.report, page.spec, page.world));
    renderTiles(page.reportTiles, headlineTiles(trace.report, page.spec, page.world), { blocks: trace.report.days.length * BLOCKS_PER_DAY });
    page.report.hidden = false;
  };
  // A class's week: the report under the scorecard is built in a task of its own after the scorecard's frame, and laid
  // out in the frame after that, so the week's end is short tasks, never a long one (G5d, acceptance 7; round 3: the
  // P&L's fixed columns and cents made "build and lay out in one frame" a long task on a Chromebook); a clear in
  // between keeps it away. The pilot (a label) builds it at once: its clock stops after the readout's rendering (D6).
  if (label !== '') {
    build();
  } else {
    const token = page.token;
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (page.token === token && page.readoutShown) build();
      }, 0);
    });
  }
  page.replayAgain.hidden = false;
  page.status.textContent = label + studentStatus('done');
  page.resultBox.hidden = false; // what the GM did, beside the scorecard
  page.readoutShown = true;
  syncPhase(page);
}

/**
 * Trains one seed with the frame loop, from `startedAt` (performance.now() at the click, or the pilot seed's start),
 * always unpaced (D52): each frame trains for 10 ms. Nothing of a week is on the yard while it trains: the yard holds
 * its placeholder, and the teacher's check line (and the curve, when shown) is redrawn at most 10 times a second.
 * When the trainer is done or the budget has run out, inside the clock, the final week becomes the page's trace and
 * its first frame is drawn; then the clock stops. Writes nothing the student reads: the caller writes the status
 * (`label` is kept for the caller's sake and the pilot's). Resolves with the result; rejects with RunCancelled if
 * clearRun ran meanwhile.
 */
export function runTraining(page: Page, seed: number, startedAt: number, label: string): Promise<RunResult> {
  void label; // the student's words are the caller's (D50): the click's statuses, the pilot's own
  return new Promise((resolve, reject) => {
    const token = ++page.token; // this run's frames; clearRun moves it on to cancel them
    let trainer: Trainer;
    try {
      trainer = new Trainer(page.world, page.spec, seed);
      page.trainer = trainer;
      page.check.textContent = checkLine(trainer.snapshot(), performance.now() - startedAt, false);
      redraw(page);
    } catch (err) {
      reject(err);
      return;
    }
    let lastDraw = performance.now();

    const frame = (): void => {
      if (token !== page.token) {
        reject(new RunCancelled());
        return;
      }
      try {
        // The deadline is checked before a slice, so no training is started past it.
        const snapshot = performance.now() - startedAt >= BUDGET_MS ? trainer.snapshot() : trainer.runFor(SLICE_MS);
        const now = performance.now();
        const timeUp = now - startedAt >= BUDGET_MS;
        if (snapshot.done || timeUp) {
          // The final week, inside the run's clock: it becomes the page's trace, and its first frame is drawn.
          const final = trainer.evaluateTrace();
          page.trace = final;
          page.replayStartedAt = performance.now();
          page.replay.dataset.week = 'final';
          page.replay.dataset.key = outcomeKey(final.report);
          redraw(page, page.replayStartedAt); // the first block, and the curve if the teacher shows it
          // The clock stops after that work, so a run that finishes its last slice near the deadline is counted late.
          const ms = performance.now() - startedAt;
          const result: RunResult = { snapshot, ms, outOfBudget: ms >= BUDGET_MS };
          page.result = result;
          page.check.textContent = checkLine(snapshot, ms, result.outOfBudget);
          resolve(result);
          return;
        }
        if (now - lastDraw >= REDRAW_MS) {
          lastDraw = now;
          page.check.textContent = checkLine(snapshot, now - startedAt, false);
          redraw(page, now);
        }
        requestAnimationFrame(frame);
      } catch (err) {
        reject(err);
      }
    };
    requestAnimationFrame(frame);
  });
}

/** The page's line for a failed run (D45): no exception on the student's screen; the error goes to the console. */
export function showError(page: Page, err: unknown): void {
  console.error(err);
  page.status.textContent = ERROR_LINE;
}

/**
 * Everything a run locks: the editor, the prediction, the button, and the teacher's round radios, seed and export.
 * Off for a run and for the whole pilot; on restores the editor to its round's own locks, and the export only once a
 * run's readout is out (D51). The reveal, the learning curve, the tab and the tray's close button are never locked.
 */
export function setControls(page: Page, enabled: boolean): void {
  page.controlsEnabled = enabled;
  page.editor.setEnabled(enabled);
  page.prediction.disabled = !enabled;
  for (const radio of page.rounds) radio.disabled = !enabled;
  page.seed.disabled = !enabled;
  page.newPrediction.disabled = !enabled;
  syncPicks(page); // the picks and the button: on only with the five picked and no scorecard holding them (D56)
  page.exportButton.disabled = !(enabled && page.readoutShown && page.result !== null && page.trace !== null);
  syncPhase(page);
}

/** Checks `name`'s radio and writes the round line (its label and note). Does not touch the editor. */
export function showRound(page: Page, name: PresetName): void {
  for (const radio of page.rounds) radio.checked = radio.value === name;
  page.roundLabel.textContent = loadPreset(name).label;
  page.roundNote.textContent = ROUND_NOTES[name] ?? '';
}

/**
 * Clears the last run's results, the one lifecycle operation (D37): moves the token on (any scheduled replay or
 * training frame of the old run then does nothing), drops the trace and its clock, the run's setup and result and the
 * published readout, and resets the replay (its data-week and data-plays), its caption and button, the table, the
 * sentence and its label, the curve, the check line and the export button. The hidden rules are the config's, not the
 * run's, and the learning section is the teacher's: they stay (an empty curve). After a run the status says the plan
 * changed.
 * Called by an edit, a round change, the button's click before a run, and the pilot before each seed. The click passes
 * `draw` false: it draws the yard itself once the run's layout is in place, so the page is not laid out in between.
 */
export function clearRun(page: Page, draw = true): void {
  const hadRun = page.trainer !== null;
  page.token++;
  page.trainer = null;
  page.trace = null;
  page.setup = null;
  page.result = null;
  page.replayStartedAt = 0;
  page.playback = null;
  page.readoutShown = false;
  page.keepYardSize = false;
  page.replay.dataset.week = 'none';
  page.replay.dataset.plays = '0';
  delete page.replay.dataset.key;
  page.replayCaption.textContent = REPLAY_CAPTION;
  page.replayAgain.hidden = true;
  page.reportTable.replaceChildren();
  page.reportTiles.replaceChildren();
  page.report.hidden = true;
  hideScorecard(page); // the scorecard goes with the run; the picks come back as they were (D56)
  page.stagePlan.hidden = true;
  page.stageWhy.hidden = true;
  page.stageWhyText.textContent = '';
  page.stagePicks.hidden = true;
  page.stagePicksList.replaceChildren();
  page.readout.textContent = '';
  page.readoutLabel.textContent = READOUT_LABEL;
  page.check.textContent = NO_RUN;
  page.runSeed.textContent = '—';
  page.exportButton.disabled = true;
  if (draw) redraw(page); // the replay's placeholder, and the empty curve if the teacher shows it
  if (hadRun) page.status.textContent = studentStatus('changed');
}

/** Finds the page's elements, mounts the editor for the round on the address, draws the empty canvases, wires it all. */
export function mountApp(): Page {
  const canvas = byId('curve', HTMLCanvasElement);
  const replay = byId('replay', HTMLCanvasElement);
  const world = loadDefaultConfig();
  const first = roundFromSearch(window.location.search);
  const editor = mountEditor(byId('editor', HTMLElement), world, loadPreset(first));
  const picksBox = byId('picks', HTMLElement);
  const pickRadios = renderPicks(picksBox);
  const art: Readonly<Record<string, string>> = {
    'gm-ready': gmReadyUrl,
    'gm-running': gmRunningUrl,
    'gm-done': gmDoneUrl,
  };
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-art]')) {
    const url = art[img.dataset.art ?? ''];
    if (url === undefined) continue;
    // An image that fails leaves nothing broken: it goes, and its orb is drawn by the stylesheet instead.
    img.addEventListener('error', () => {
      img.hidden = true;
      img.closest('.orb')?.classList.add('art-failed');
    });
    img.src = url;
  }
  const css = cssVars();
  const status = byId('status', HTMLElement);
  const watch = byId('watch', HTMLElement);
  const railLive = byId('rail-live', HTMLElement);
  const page: Page = {
    roundLabel: byId('round-label', HTMLElement),
    roundNote: byId('round-note', HTMLElement),
    rounds: ROUNDS.map((name) => byId(`round-${name}`, HTMLInputElement)),
    editor,
    prediction: byId('prediction', HTMLTextAreaElement),
    pickRadios,
    picksBox,
    picksHint: byId('picks-hint', HTMLElement),
    resultBox: byId('result', HTMLElement),
    scorecard: byId('scorecard', HTMLElement),
    calledLine: byId('called-line', HTMLElement),
    newPrediction: byId('new-prediction', HTMLButtonElement),
    scorecardShown: false,
    controlsEnabled: true,
    stagePlan: byId('stage-plan', HTMLElement),
    stagePlanWords: byId('stage-plan-words', HTMLElement),
    stageWhy: byId('stage-why', HTMLElement),
    stageWhyText: byId('stage-why-text', HTMLElement),
    stageFoot: document.querySelector<HTMLElement>('.stage-foot') ?? byId('watch', HTMLElement),
    runSeed: byId('run-seed', HTMLElement),
    readReport: byId('read-report', HTMLButtonElement),
    stagePicks: byId('stage-picks', HTMLElement),
    stagePicksList: byId('stage-picks-list', HTMLElement),
    seed: byId('seed', HTMLInputElement),
    train: byId('train', HTMLButtonElement),
    teacher: byId('teacher', HTMLElement),
    teacherOpen: byId('teacher-open', HTMLButtonElement),
    teacherClose: byId('teacher-close', HTMLButtonElement),
    reveal: byId('reveal', HTMLButtonElement),
    rules: byId('rules', HTMLElement),
    rulesList: byId('rules-list', HTMLOListElement),
    learning: byId('learning', HTMLElement),
    showCurve: byId('show-curve', HTMLButtonElement),
    exportButton: byId('export', HTMLButtonElement),
    check: byId('check', HTMLElement),
    compare: compareArea(),
    watch,
    status,
    canvas,
    ctx: context2d(canvas),
    replay,
    replayCtx: context2d(replay),
    replayCaption: byId('replay-caption', HTMLElement),
    replayAgain: byId('replay-again', HTMLButtonElement),
    readout: byId('readout', HTMLElement),
    readoutLabel: byId('readout-label', HTMLElement),
    report: byId('report', HTMLElement),
    reportTable: byId('report-table', HTMLTableElement),
    reportTiles: byId('report-tiles', HTMLElement),
    pilot: byId('pilot', HTMLElement),
    colors: readColors(css),
    replayColors: readReplayColors(css),
    world,
    spec: editor.spec(),
    trainer: null,
    trace: null,
    replayStartedAt: 0,
    token: 0,
    playback: null,
    replaySize: null,
    railView: mountRail(railLive, world.requests.max, railIcon),
    railStep: -1,
    stageWhen: byId('stage-when', HTMLElement),
    business: byId('business', HTMLElement),
    pickDots: Array.from(document.querySelectorAll<HTMLElement>('#picks-hint .pick-dots i')),
    fonts: readFonts(css),
    setup: null,
    result: null,
    readoutShown: false,
    keepYardSize: false,
  };
  page.railView(null);
  // The yard's box has the board's shape in every state (WP3's YARD_ASPECT; round 2, rows 18 and 30).
  page.watch.style.setProperty('--yard-aspect', String(YARD_ASPECT));
  showRound(page, first);
  const hintText = page.picksHint.querySelector('.picks-hint-text');
  if (hintText) hintText.textContent = PICKS_HINT;
  else page.picksHint.textContent = PICKS_HINT;
  syncPicks(page);
  void replayArt(); // decode the yard's art while the class makes its picks

  // The status line's kind follows its words wherever they are written (the page, the pilot).
  const syncStatus = (): void => {
    const kind = statusKind(status.textContent ?? '');
    if ((watch.dataset.status ?? '') !== kind) watch.dataset.status = kind;
  };
  new MutationObserver(syncStatus).observe(status, { childList: true, characterData: true, subtree: true });
  syncStatus();

  // The stage changes size with the phase (the console beside a narrow yard, the rail beside a wide one): the yard is
  // drawn again at its new size, once, on the next frame.
  let stageQueued = false;
  const stageResized = (): void => {
    if (stageQueued) return;
    stageQueued = true;
    requestAnimationFrame(() => {
      stageQueued = false;
      redraw(page);
    });
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(stageResized).observe(replay);

  // A pick is part of the prediction, not the plan: it never clears a run; it only lets the button on (D56).
  for (const radio of pickRadios) radio.addEventListener('change', () => syncPicks(page));

  // Make a new prediction: a clear (D37, D56). The run and its scorecard go, the picks come back as they were.
  page.newPrediction.addEventListener('click', () => {
    clearRun(page);
    page.status.textContent = studentStatus('idle');
    const first = pickRadios.find((r) => r.checked) ?? pickRadios[0];
    first?.focus({ preventScroll: true });
    pageScroller().scrollTo({ top: 0, behavior: scrollBehavior() }); // the console again, as on the load screen
  });

  editor.onChange = () => clearRun(page);
  for (const radio of page.rounds) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const name = (ROUNDS as readonly string[]).includes(radio.value) ? (radio.value as PresetName) : 'round1';
      showRound(page, name);
      editor.load(loadPreset(name));
    });
  }

  page.train.addEventListener('click', () => {
    const clickedAt = performance.now();
    const seed = readSeed(page.seed);
    if (seed === null) {
      rejectSeed(page, SEED_MESSAGE); // into the tray, never the student's status (Astra, plan review)
      return;
    }
    try {
      page.spec = validateRewardSpec(page.editor.spec());
    } catch (err) {
      showError(page, err);
      return;
    }
    setControls(page, false);
    clearRun(page, false);
    page.setup = {
      seed,
      round: page.editor.preset().name,
      prediction: page.prediction.value, // read here and nowhere else (D2, D47)
      picks: readPicks(page), // a fresh copy at the click: the scorecard and the export read this (D47, D56)
    };
    planLines(page.stagePlanWords, describeBonusPlan(page.spec, page.world)); // a clause a line, as the plan shows it
    page.stagePlan.hidden = false;
    page.stageWhyText.textContent = page.setup.prediction.trim();
    page.stageWhy.hidden = page.stageWhyText.textContent === '';
    showStagePicks(page);
    page.status.textContent = studentStatus('preparing');
    page.replay.dataset.week = 'preparing';
    syncPhase(page); // the run's layout (the rail beside a wide yard) before the scroll is measured
    // The class watches the yard without touching anything (D42).
    // At once, not smoothly: the run's layout replaces the console in the same moment, so a smooth scroll would glide
    // over a page that is changing under it (round 2, row 30).
    page.watch.scrollIntoView({ behavior: 'auto', block: 'start' });
    let owner = -1;
    // The whole locked lifecycle is one guarded operation; only the run's owner writes an error or unlocks (Astra,
    // G5b diff review: a drawing failure in recovery must not strand the controls, a stale run must not write).
    void (async () => {
      try {
        redraw(page); // the yard's in-world wait
        // The yard's art is decoded before the engine starts, so no frame of the week is ever drawn without it (it
        // started loading at mount; on a cold Chromebook the wait counts in the run's 60 s, from the click).
        await replayArt();
        const run = runTraining(page, seed, clickedAt, '');
        owner = page.token; // runTraining moved the token on as it started: this click owns that run
        await run;
        if (page.token !== owner) return;
        page.status.textContent = studentStatus('playing');
        const played = await playWeek(page);
        if (!played || page.token !== owner) return;
        // The yard keeps the picture it played at while the page turns to the scorecard (no new caches at the week's
        // end: the canvas shows it fitted to the column), until settleYard draws it at the column's own size.
        page.keepYardSize = true;
        showReadout(page);
        showScorecard(page);
        page.calledLine.focus({ preventScroll: true }); // the result first, for a keyboard and a screen reader
        // On the next frame: Friday's pickup with the orb in its done state (a redraw draws what the page holds, so it
        // needs no token), and the box score after the game (round 2, row 30). The scroll waits for that frame so the
        // scorecard's layout is that frame's, not forced inside this task (round 3: one task, under 50 ms).
        requestAnimationFrame(() => {
          redraw(page);
          if (page.token === owner) page.compare.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
        settleYard(page);
      } catch (err) {
        if (err instanceof RunCancelled) return;
        if (owner !== -1 && page.token !== owner) return; // a newer run owns the page now
        showError(page, err);
        if (page.trace === null) {
          page.replay.dataset.week = 'none'; // the GM is no longer getting ready: the yard's usual placeholder
          try {
            redraw(page);
          } catch (drawErr) {
            console.error(drawErr); // best effort: the controls come back either way
          }
        }
      } finally {
        if (owner === -1 || page.token === owner) {
          setControls(page, true);
          page.train.textContent = AGAIN;
        }
      }
    })();
  });

  // Watch the week again: the saved week only, no training, no republishing, no scroll (D51).
  // After the week, the primary way on: the weekly P&L (round 3, row 11).
  page.readReport.addEventListener('click', () => {
    page.report.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    const title = document.getElementById('report-title');
    if (title !== null) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  });

  page.replayAgain.addEventListener('click', () => {
    startPlayback(page).catch((err: unknown) => showError(page, err));
  });

  // A resize draws what the page holds at that moment (after a clear, the empty curve and the placeholder), so it
  // never brings a cleared week back and needs no token.
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      redraw(page);
    });
  });

  mountTeacher(page);

  page.replay.dataset.week = 'none';
  page.replay.dataset.plays = '0';
  redraw(page);
  // The placeholder is painted before the bundled faces arrive; paint it again in the display face once they have.
  void document.fonts.ready.then(() => redraw(page));
  return page;
}
