// The page controller: the round line, the bonus plan editor, the prediction, the Put the GM to work button (#train),
// and under them the watching area (the status line and the yard, the week replay) and the weekly P&L and operations
// report. The teacher's controls (the round, the seed, the hidden rules, the learning curve, the export, the check
// line) live in the tray that teacher.ts mounts (BRIEF section 11, D39).
// The GM is a person; the AI is the game engine (D50). The click puts the GM to work: the learner trains unpaced in
// requestAnimationFrame slices, out of sight, while the yard shows the in-world wait; the teacher's check line and,
// when the teacher shows it, the learning curve are redrawn at most 10 times a second. Training stops when the trainer
// is done or 60 s after the click (D6, BRIEF section 13: the final week computed and its first frame drawn count
// against the budget). Then the GM's one week, the final greedy week, plays once on the yard, and only when it has
// played does the readout come out: the sentence beside the prediction, the table and "Watch the week again" (D51).
// One greedy week, three views (D40): the sentence, the replay and the table all come from the one EpisodeTrace the
// page holds. A run belongs to the plan it was trained on (D37): the click snapshots the editor's plan into
// page.spec, and any change to the plan after a run calls clearRun, which also cancels the run and the replay through
// the run token.
import { DEFAULT_LEARNER, Trainer } from '../learn/train.ts';
import type { TrainingSnapshot } from '../learn/train.ts';
import { describeWeek, outcomeKey } from '../sim/readout.ts';
import { loadDefaultConfig, loadPreset, validateRewardSpec } from '../world/config.ts';
import type { PresetName } from '../world/config.ts';
import type { EpisodeTrace, RewardSpec, WorldConfig } from '../world/types.ts';
import { checkLine } from './check.ts';
import { drawCurve } from './curve.ts';
import type { CurveColors } from './curve.ts';
import { mountEditor, roundFromSearch } from './editor.ts';
import type { Editor } from './editor.ts';
import { drawReplay, replayClock, replayFrame } from './replay.ts';
import type { ReplayColors } from './replay.ts';
import { renderReport, reportTable } from './report.ts';
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
/** The one line beside the round's label, per round. */
const ROUND_NOTES: Readonly<Partial<Record<PresetName, string>>> = {
  round1: 'The GM is paid on profit and nothing else. Read the plan, predict what the GM will do, then put it to work.',
  round2: 'Turn on up to three measures and set their dollar amounts. Write your prediction, then put the GM to work.',
  round3: 'All six measures are yours. Write your prediction, then put the GM to work.',
};
const READOUT_LABEL = 'What the GM did';
const REPLAY_CAPTION = "The GM's week";
/** The yard while the GM gets ready (the learner trains, out of sight): an in-world wait, not a loading screen. */
const PREPARING_PLACEHOLDER = 'Monday, before opening: the GM is getting ready.';
/** The button's words after a run (and after the pilot). */
export const AGAIN = 'Put the GM to work again';
const ERROR_LINE = 'The GM stopped because of a problem. Ask your teacher for help.';
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
}

export interface Page {
  roundLabel: HTMLElement; // the round as a line of text on the student's page (D34)
  roundNote: HTMLElement;
  rounds: HTMLInputElement[]; // the teacher's three round radios, in ROUNDS order
  editor: Editor;
  prediction: HTMLTextAreaElement; // the team's prediction: read only at the click, for the export (D2, D47)
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
  /** The current or last run's setup, from the click; null before a run and after a clear. */
  setup: RunSetup | null;
  /** The last run's result, set when it resolves; null before a run, during one and after a clear. */
  result: RunResult | null;
  /** The readout (the sentence, the table, Watch the week again) is out; the export waits for it (D51). */
  readoutShown: boolean;
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

/** The prediction beside what the GM did. */
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

function readReplayColors(get: (name: string, fallback: string) => string): ReplayColors {
  return {
    background: get('--chart-paper', '#ffffff'),
    ink: get('--ink', '#1f2a1f'),
    muted: get('--muted', '#55604f'),
    grass: get('--grass', '#cfe8b9'),
    fence: get('--replay-fence', '#8a6a46'),
    dog: [get('--replay-dog-1', '#c0702f'), get('--replay-dog-2', '#3d3027'), get('--replay-dog-3', '#8a96a0')],
    crew: get('--replay-crew', '#1d5fbf'),
    incident: get('--replay-incident', '#d03a1b'),
    reputation: get('--replay-reputation', '#b8860b'),
    cash: get('--replay-cash', '#2b8a3e'),
    gaugeOver: get('--replay-gauge-over', 'rgba(208, 58, 27, 0.2)'),
  };
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
  const options = {
    pixelRatio: size.ratio,
    colors: page.replayColors,
    progress: 0,
    legalRatio: page.world.bookings.legalRatio,
    gaugeMax: page.world.requests.max,
  };
  const trace = page.trace;
  if (trace === null) {
    const preparing = page.replay.dataset.week === 'preparing';
    drawReplay(page.replayCtx, size.width, size.height, null, preparing ? { ...options, placeholder: PREPARING_PLACEHOLDER } : options);
    return true;
  }
  const clock = replayClock(now - page.replayStartedAt);
  options.progress = clock.progress;
  drawReplay(page.replayCtx, size.width, size.height, replayFrame(trace.steps, clock.step, page.world), options);
  return clock.done;
}

/**
 * Measures the replay and paints it at `now`, and, only while the teacher's learning section is shown, measures and
 * draws the curve. Called at most 10 times a second during a run, on resize, when the learning section is shown, and
 * when a run starts, ends or is cleared; between redraws the playback's frames paint only the replay.
 */
export function redraw(page: Page, now: number = performance.now()): void {
  page.replaySize = sizeCanvas(page.replay);
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
  renderReport(page.reportTable, reportTable(trace.report, page.spec, page.world));
  page.report.hidden = false;
  page.replayAgain.hidden = false;
  page.status.textContent = label + studentStatus('done');
  page.readoutShown = true;
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
  page.editor.setEnabled(enabled);
  page.prediction.disabled = !enabled;
  for (const radio of page.rounds) radio.disabled = !enabled;
  page.seed.disabled = !enabled;
  page.train.disabled = !enabled;
  page.exportButton.disabled = !(enabled && page.readoutShown && page.result !== null && page.trace !== null);
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
 * Called by an edit, a round change, the button's click before a run, and the pilot before each seed.
 */
export function clearRun(page: Page): void {
  const hadRun = page.trainer !== null;
  page.token++;
  page.trainer = null;
  page.trace = null;
  page.setup = null;
  page.result = null;
  page.replayStartedAt = 0;
  page.playback = null;
  page.readoutShown = false;
  page.replay.dataset.week = 'none';
  page.replay.dataset.plays = '0';
  delete page.replay.dataset.key;
  page.replayCaption.textContent = REPLAY_CAPTION;
  page.replayAgain.hidden = true;
  page.reportTable.replaceChildren();
  page.report.hidden = true;
  page.readout.textContent = '';
  page.readoutLabel.textContent = READOUT_LABEL;
  page.check.textContent = NO_RUN;
  page.exportButton.disabled = true;
  redraw(page); // the replay's placeholder, and the empty curve if the teacher shows it
  if (hadRun) page.status.textContent = studentStatus('changed');
}

/** Finds the page's elements, mounts the editor for the round on the address, draws the empty canvases, wires it all. */
export function mountApp(): Page {
  const canvas = byId('curve', HTMLCanvasElement);
  const replay = byId('replay', HTMLCanvasElement);
  const world = loadDefaultConfig();
  const first = roundFromSearch(window.location.search);
  const editor = mountEditor(byId('editor', HTMLElement), world, loadPreset(first));
  const css = cssVars();
  const page: Page = {
    roundLabel: byId('round-label', HTMLElement),
    roundNote: byId('round-note', HTMLElement),
    rounds: ROUNDS.map((name) => byId(`round-${name}`, HTMLInputElement)),
    editor,
    prediction: byId('prediction', HTMLTextAreaElement),
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
    watch: byId('watch', HTMLElement),
    status: byId('status', HTMLElement),
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
    setup: null,
    result: null,
    readoutShown: false,
  };
  showRound(page, first);

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
    clearRun(page);
    page.setup = {
      seed,
      round: page.editor.preset().name,
      prediction: page.prediction.value, // read here and nowhere else (D2, D47)
    };
    page.status.textContent = studentStatus('preparing');
    page.replay.dataset.week = 'preparing';
    // The class watches the yard without touching anything (D42).
    page.watch.scrollIntoView({ behavior: 'smooth', block: 'start' });
    let owner = -1;
    // The whole locked lifecycle is one guarded operation; only the run's owner writes an error or unlocks (Astra,
    // G5b diff review: a drawing failure in recovery must not strand the controls, a stale run must not write).
    void (async () => {
      try {
        redraw(page); // the yard's in-world wait
        const run = runTraining(page, seed, clickedAt, '');
        owner = page.token; // runTraining moved the token on as it started: this click owns that run
        await run;
        if (page.token !== owner) return;
        page.status.textContent = studentStatus('playing');
        const played = await playWeek(page);
        if (!played || page.token !== owner) return;
        showReadout(page);
        page.compare.scrollIntoView({ behavior: 'smooth', block: 'start' }); // the box score after the game
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
  return page;
}
