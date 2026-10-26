// The page controller: the round selector, the bonus plan editor, the prediction, the seed field, the Train button,
// and under them the watching area (the status line, the training curve, the week replay) and the weekly P&L and
// operations report.
// Training runs in requestAnimationFrame: each frame trains (paced, or for 10 ms) and draws the replay's current
// block; the curve and the status line are redrawn at most 10 times a second, and the canvases are measured only then
// and on resize. A run stops when the trainer is done or 60 s after the click, whichever comes first (BRIEF section
// 13: rendering counts against the budget).
// One greedy week, three views (D40): the sentence beside the prediction, the replay and the table all come from one
// EpisodeTrace the page holds. While the GM trains, the replay plays its current test week and takes a fresh one
// each time a week has played, and the sentence is rewritten from that same week. When the run ends, the final
// week's sentence, table, first frame and the status are written inside the run's clock; then the final week plays
// once more and holds on Friday, outside it.
// A run belongs to the plan it was trained on (D37): the click snapshots the editor's plan into page.spec, and any
// change to the plan after a run calls clearRun, which also cancels the replay through the run token.
import { DEFAULT_LEARNER, Trainer } from '../learn/train.ts';
import type { TrainingSnapshot } from '../learn/train.ts';
import { describeWeek } from '../sim/readout.ts';
import { loadDefaultConfig, loadPreset, validateRewardSpec } from '../world/config.ts';
import type { PresetName } from '../world/config.ts';
import type { EpisodeTrace, RewardSpec, WorldConfig } from '../world/types.ts';
import { drawCurve } from './curve.ts';
import type { CurveColors } from './curve.ts';
import { mountEditor, roundFromSearch } from './editor.ts';
import type { Editor } from './editor.ts';
import { drawReplay, replayClock, replayFrame } from './replay.ts';
import type { ReplayColors } from './replay.ts';
import { renderReport, reportTable } from './report.ts';
import { studentStatus } from './status.ts';

export const BUDGET_MS = 60_000; // from the click (or a pilot seed's start), rendering included
const SLICE_MS = 10; // training time per animation frame when not paced (Fast, and the pilot)
/**
 * Episodes per second when paced. The hook of the lesson is that the class watches the GM learn: unpaced, Round 1
 * is stable in a fraction of a second; at this pace the curve climbs for about 20 to 40 s (stable needs 22,000 to
 * 46,000 episodes). G5's speed slider replaces it.
 */
export const PACE = 1200;
const MAX_FRAME_SECONDS = 0.1; // a slow or skipped frame never makes up more than a tenth of a second of training
const REDRAW_MS = 100; // at most 10 curve redraws (and canvas measurements) a second
const MAX_SEED = 4_294_967_295;
const MAX_BACKING_WIDTH = 1920;
const MAX_BACKING_HEIGHT = 1080;

/** The rounds the selector offers (BRIEF section 8), in order; their labels come from the presets. */
export const ROUNDS: readonly PresetName[] = ['round1', 'round2', 'round3'];
/** The one line under the selector, per round. */
const ROUND_NOTES: Readonly<Partial<Record<PresetName, string>>> = {
  round1: 'The GM is paid on profit and nothing else. Read the plan, predict what the GM will do, then train it.',
  round2: 'Turn on up to three measures and set their weights. Write your prediction, then train the GM.',
  round3: 'All six measures are yours. Write your prediction, then train the GM.',
};
const READOUT_LABEL = "The GM's test week";
const READOUT_LABEL_UNSETTLED = "The GM's test week (still changing its mind)";
const REPLAY_CAPTION = "The GM's test week";
const REPLAY_CAPTION_TRAINING = "The GM's test week, as it would run it right now";
const PLAN_CHANGED = 'The plan changed. Train the GM to see what it does with this one.';

interface CanvasSize {
  width: number; // CSS pixels
  height: number;
  ratio: number; // backing-store pixels per CSS pixel
}

export interface Page {
  round: HTMLSelectElement; // the round selector (G5 moves it into the teacher panel)
  roundNote: HTMLElement;
  editor: Editor;
  prediction: HTMLTextAreaElement; // the team's prediction: never read, never stored (D2)
  seed: HTMLInputElement;
  train: HTMLButtonElement;
  fast: HTMLInputElement; // checked: no pacing, train as fast as the machine allows
  watch: HTMLElement; // the status line, the curve and the replay: scrolled into view at the click
  status: HTMLElement;
  canvas: HTMLCanvasElement; // the training curve
  ctx: CanvasRenderingContext2D;
  replay: HTMLCanvasElement; // the week replay; data-week is "none", "training" or "final"
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
  /** The week the sentence and the replay show (and the table, after a run); null before a run and after a clear. */
  trace: EpisodeTrace | null;
  /** performance.now() when the replay of `trace` started playing. */
  replayStartedAt: number;
  /** Bumped by clearRun and at the start of a run; a scheduled frame holding an older token draws nothing. */
  token: number;
  /** A final-week playback loop is running, so "Watch the week again" restarts it instead of starting another. */
  playing: boolean;
  /** The replay canvas's size, measured at the 10 Hz redraw and on resize, never every frame. */
  replaySize: CanvasSize | null;
}

export interface RunResult {
  snapshot: TrainingSnapshot;
  ms: number; // from the start to the stop
  outOfBudget: boolean; // the run (training, the final week's sentence, table and frame included) passed 60 s
}

/** A run whose results were cleared while it trained: its frames stop and write nothing. */
export class RunCancelled extends Error {
  constructor() {
    super('The run was cleared before it finished.');
    this.name = 'RunCancelled';
  }
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
    drawReplay(page.replayCtx, size.width, size.height, null, options);
    return true;
  }
  const clock = replayClock(now - page.replayStartedAt);
  options.progress = clock.progress;
  drawReplay(page.replayCtx, size.width, size.height, replayFrame(trace.steps, clock.step, page.world), options);
  return clock.done;
}

/**
 * Measures both canvases, draws the curve, and paints the replay at `now`. Called at most 10 times a second during a
 * run, on resize, and when a run starts, ends or is cleared; between redraws the run's frames paint only the replay.
 */
export function redraw(page: Page, now: number = performance.now()): void {
  page.replaySize = sizeCanvas(page.replay);
  const { width, height, ratio } = sizeCanvas(page.canvas);
  const t = page.trainer;
  drawCurve(page.ctx, width, height, t ? t.curve() : [], t ? t.evals() : [], {
    pixelRatio: ratio,
    colors: page.colors,
    averageWindow: t ? t.config.movingAverageWindow : DEFAULT_LEARNER.movingAverageWindow,
    minEpisodes: 2000,
  });
  paintReplay(page, now);
}

/** Puts `trace` on the replay from its first block and writes its sentence beside the prediction (D40). */
function showWeek(page: Page, trace: EpisodeTrace, now: number): void {
  page.trace = trace;
  page.replayStartedAt = now;
  page.readout.textContent = describeWeek(trace.report);
}

/**
 * Plays the week on the replay once from its first block and holds on Friday's pickup, outside any run's clock.
 * A second call while it plays restarts it. The loop stops when the week is done or the token has moved on.
 */
function playFinal(page: Page): void {
  if (page.trace === null) return;
  page.replayStartedAt = performance.now();
  if (page.playing) return; // the loop already running picks up the new start
  page.playing = true;
  const token = page.token;
  const frame = (now: number): void => {
    if (token !== page.token) return; // cleared: clearRun has reset `playing` and drawn the placeholder
    try {
      if (paintReplay(page, now)) {
        page.playing = false;
        return;
      }
    } catch (err) {
      page.playing = false;
      showError(page, err);
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Trains one seed with the frame loop, from `startedAt` (performance.now() at the click). `label` goes in front of
 * the status line (the pilot names the seed). Paced: each frame trains PACE episodes per second of the time since the
 * previous frame; unpaced: each frame trains for 10 ms. Every frame paints the replay; when the week on it has played,
 * the GM's current test week replaces it and the sentence follows. Resolves when the trainer is done or the budget
 * has run out, after the final week is on the page; rejects with RunCancelled if clearRun ran meanwhile.
 */
export function runTraining(
  page: Page,
  seed: number,
  startedAt: number,
  label: string,
  paced: boolean,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const token = ++page.token; // this run's frames; clearRun moves it on to cancel them
    let trainer: Trainer;
    try {
      trainer = new Trainer(page.world, page.spec, seed);
      page.trainer = trainer;
      // The replay opens on the untrained GM's test week, and the sentence describes that week.
      showWeek(page, trainer.evaluateTrace(), performance.now());
      page.replay.dataset.week = 'training';
      page.replayCaption.textContent = REPLAY_CAPTION_TRAINING;
      page.status.textContent = label + studentStatus(trainer.snapshot(), false);
      redraw(page);
    } catch (err) {
      reject(err);
      return;
    }
    let lastDraw = performance.now();
    let lastFrame = startedAt;
    let owed = 0; // paced: the fractional episodes carried from frame to frame, so the pace holds at any frame rate

    const frame = (): void => {
      if (token !== page.token) {
        reject(new RunCancelled());
        return;
      }
      try {
        let snapshot: TrainingSnapshot;
        const start = performance.now();
        if (start - startedAt >= BUDGET_MS) {
          // The deadline is checked before a slice, so no training is started past it.
          snapshot = trainer.snapshot();
        } else if (paced) {
          const seconds = Math.min(MAX_FRAME_SECONDS, (start - lastFrame) / 1000);
          lastFrame = start;
          owed += PACE * seconds;
          const k = Math.max(1, Math.floor(owed));
          owed -= k;
          snapshot = trainer.runEpisodes(k); // the training slice
        } else {
          snapshot = trainer.runFor(SLICE_MS); // the training slice: no DOM, no drawing
        }
        const now = performance.now();
        const timeUp = now - startedAt >= BUDGET_MS;
        if (snapshot.done || timeUp) {
          // The final week: its sentence, the table, its first frame, the curve and the status, all inside the
          // run's clock, so the status says "settled" only once the rest is on the page.
          const final = trainer.evaluateTrace();
          showWeek(page, final, performance.now());
          const words = snapshot.stable ? READOUT_LABEL : READOUT_LABEL_UNSETTLED;
          page.readoutLabel.textContent = words;
          page.replayCaption.textContent = words;
          renderReport(page.reportTable, reportTable(final.report, page.spec, page.world));
          page.report.hidden = false;
          page.replay.dataset.week = 'final';
          page.replayAgain.hidden = false;
          redraw(page);
          page.status.textContent = label + studentStatus(snapshot, timeUp);
          // The clock stops after that work, so a run that finishes its last slice near the deadline is counted late.
          const ms = performance.now() - startedAt;
          resolve({ snapshot, ms, outOfBudget: ms >= BUDGET_MS });
          playFinal(page); // the final week once more, holding on Friday: outside the clock
          return;
        }
        // The week on the replay has played and held: play the GM's current test week, and the sentence follows.
        if (replayClock(now - page.replayStartedAt).done) showWeek(page, trainer.evaluateTrace(), now);
        if (now - lastDraw >= REDRAW_MS) {
          lastDraw = now;
          page.status.textContent = label + studentStatus(snapshot, false);
          redraw(page, now);
        } else {
          paintReplay(page, now);
        }
        requestAnimationFrame(frame);
      } catch (err) {
        reject(err);
      }
    };
    requestAnimationFrame(frame);
  });
}

export function showError(page: Page, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  page.status.textContent = `Training stopped with an error: ${message}`;
}

/**
 * Everything the team can touch: the editor, the round selector, the prediction, the seed, Fast and Train. Off for a
 * run and for the whole pilot; on restores the editor to its round's own locks.
 */
export function setControls(page: Page, enabled: boolean): void {
  page.editor.setEnabled(enabled);
  page.round.disabled = !enabled;
  page.prediction.disabled = !enabled;
  page.seed.disabled = !enabled;
  page.fast.disabled = !enabled;
  page.train.disabled = !enabled;
}

/** Shows `name` in the selector and its line under it. Does not touch the editor. */
export function showRound(page: Page, name: PresetName): void {
  page.round.value = name;
  page.roundNote.textContent = ROUND_NOTES[name] ?? '';
}

/**
 * Clears the last run's results, the one lifecycle operation (D37): moves the token on (any scheduled replay or
 * training frame of the old run then does nothing), drops the trace and its clock, and resets the replay, its caption
 * and button, the table, the sentence and its label, and the curve. After a run the status says the plan changed.
 * Called by an edit, a round change, the Train click before a run, and the pilot before each seed.
 */
export function clearRun(page: Page): void {
  const hadRun = page.trainer !== null;
  page.token++;
  page.trainer = null;
  page.trace = null;
  page.replayStartedAt = 0;
  page.playing = false;
  page.replay.dataset.week = 'none';
  page.replayCaption.textContent = REPLAY_CAPTION;
  page.replayAgain.hidden = true;
  page.reportTable.replaceChildren();
  page.report.hidden = true;
  page.readout.textContent = '';
  page.readoutLabel.textContent = READOUT_LABEL;
  redraw(page); // the empty curve and the replay's placeholder
  if (hadRun) page.status.textContent = PLAN_CHANGED;
}

/** Finds the page's elements, mounts the editor for the round on the address, draws the empty canvases, wires it all. */
export function mountApp(): Page {
  const canvas = byId('curve', HTMLCanvasElement);
  const replay = byId('replay', HTMLCanvasElement);
  const world = loadDefaultConfig();
  const round = byId('round', HTMLSelectElement);
  for (const option of Array.from(round.options)) {
    if ((ROUNDS as readonly string[]).includes(option.value)) option.textContent = loadPreset(option.value as PresetName).label;
  }
  const first = roundFromSearch(window.location.search);
  const editor = mountEditor(byId('editor', HTMLElement), world, loadPreset(first));
  const css = cssVars();
  const page: Page = {
    round,
    roundNote: byId('round-note', HTMLElement),
    editor,
    prediction: byId('prediction', HTMLTextAreaElement),
    seed: byId('seed', HTMLInputElement),
    train: byId('train', HTMLButtonElement),
    fast: byId('fast', HTMLInputElement),
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
    playing: false,
    replaySize: null,
  };
  showRound(page, first);

  editor.onChange = () => clearRun(page);
  page.round.addEventListener('change', () => {
    const name = (ROUNDS as readonly string[]).includes(page.round.value) ? (page.round.value as PresetName) : 'round1';
    showRound(page, name);
    editor.load(loadPreset(name));
  });

  page.train.addEventListener('click', () => {
    const clickedAt = performance.now();
    const seed = readSeed(page.seed);
    if (seed === null) {
      page.status.textContent = `The seed must be a whole number from 0 to ${MAX_SEED}.`;
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
    const run = runTraining(page, seed, clickedAt, '', !page.fast.checked);
    // The class watches the status, the curve and the replay without touching anything (D42). The scroll comes after
    // the run's first sentence is written, since that sentence makes the panel above taller.
    page.watch.scrollIntoView({ behavior: 'smooth', block: 'start' });
    run
      .catch((err: unknown) => {
        if (!(err instanceof RunCancelled)) showError(page, err);
      })
      .finally(() => {
        setControls(page, true);
        page.train.textContent = 'Train again';
      });
  });

  page.replayAgain.addEventListener('click', () => playFinal(page));

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

  page.replay.dataset.week = 'none';
  redraw(page);
  return page;
}
