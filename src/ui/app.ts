// The page controller: the round line, the bonus plan editor, the prediction, the Put the GM to work button (#train),
// and under them the watching area (the status line, the bonus curve, the week replay) and the weekly P&L and
// operations report. The teacher's controls (the round, the seed, the speed, the hidden rules, the export, the check
// line) live in the tray that teacher.ts mounts (BRIEF section 11, D39). The page puts the GM to work; underneath,
// the learner trains (D45).
// Training runs in requestAnimationFrame: each frame trains (paced, or for 10 ms) and draws the replay's current
// block; the curve and the status line are redrawn at most 10 times a second, and the canvases are measured only then
// and on resize. A run stops when the trainer is done or 60 s after the click, whichever comes first (BRIEF section
// 13: rendering counts against the budget).
// One greedy week, three views (D40): the sentence beside the prediction, the replay and the table all come from one
// EpisodeTrace the page holds. While the GM works, the replay plays a week the GM's way (the greedy week as the table
// stands) and takes a fresh one each time a week has played, and the sentence is rewritten from that same week. When
// the run ends, the final week's sentence, table, first frame and the status are written inside the run's clock; then
// the final week plays once more and holds on Friday, outside it.
// A run belongs to the plan it was trained on (D37): the click snapshots the editor's plan into page.spec, and any
// change to the plan after a run calls clearRun, which also cancels the replay through the run token.
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
import { DEFAULT_SPEED, SPEEDS, paceFor, paceSlice, speedName } from './speed.ts';
import type { SpeedName } from './speed.ts';
import { studentStatus } from './status.ts';
import { mountTeacher, rejectSeed } from './teacher.ts';

export const BUDGET_MS = 60_000; // from the click (or a pilot seed's start), rendering included
const SLICE_MS = 10; // training time per animation frame when not paced (Full speed, and the pilot)
const REDRAW_MS = 100; // at most 10 curve redraws (and canvas measurements) a second
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
const READOUT_LABEL = "A week the GM's way";
const READOUT_LABEL_UNSETTLED = "A week the GM's way (not settled yet)";
const REPLAY_CAPTION = "A week the GM's way";
const REPLAY_CAPTION_TRAINING = "A week the GM's way, right now";
const PLAN_CHANGED = 'The plan changed. Put the GM to work to see what it does with this one.';
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
  speed: SpeedName; // the pacing applied to the run (the pilot's is always 'full')
  prediction: string; // the team's prediction as it stood at the click: read there and nowhere else (D2, D47)
}

export interface Page {
  roundLabel: HTMLElement; // the round as a line of text on the student's page (D34)
  roundNote: HTMLElement;
  rounds: HTMLInputElement[]; // the teacher's three round radios, in ROUNDS order
  editor: Editor;
  prediction: HTMLTextAreaElement; // the team's prediction: read only at the click, for the export (D2, D47)
  seed: HTMLInputElement;
  speed: HTMLSelectElement; // filled from SPEEDS
  train: HTMLButtonElement;
  teacher: HTMLElement; // the tray
  teacherOpen: HTMLButtonElement; // the tab in the corner
  teacherClose: HTMLButtonElement;
  reveal: HTMLButtonElement;
  rules: HTMLElement; // the hidden rules section, under the report
  rulesList: HTMLOListElement;
  exportButton: HTMLButtonElement;
  check: HTMLElement; // the learner's check line in the tray (D6, section 13)
  watch: HTMLElement; // the status line, the curve and the replay: scrolled into view at the click
  status: HTMLElement;
  canvas: HTMLCanvasElement; // the bonus curve
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
  /** The current or last run's setup, from the click; null before a run and after a clear. */
  setup: RunSetup | null;
  /** The last run's result, set when it resolves; null before a run, during one and after a clear. */
  result: RunResult | null;
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
  page.replay.dataset.key = outcomeKey(trace.report);
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
 * the status line (the pilot names the seed). Paced (`pace` weeks a second): each frame trains the slice paceSlice
 * gives for the time since the previous frame; unpaced (null): each frame trains for 10 ms. Every frame paints the replay; when the week on it has played,
 * a fresh week the GM's way replaces it and the sentence follows. Resolves when the trainer is done or the budget
 * has run out, after the final week is on the page; rejects with RunCancelled if clearRun ran meanwhile.
 */
export function runTraining(
  page: Page,
  seed: number,
  startedAt: number,
  label: string,
  pace: number | null,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const token = ++page.token; // this run's frames; clearRun moves it on to cancel them
    let trainer: Trainer;
    try {
      trainer = new Trainer(page.world, page.spec, seed);
      page.trainer = trainer;
      // The replay opens on the new GM's week its way (the untrained table), and the sentence describes that week.
      showWeek(page, trainer.evaluateTrace(), performance.now());
      page.replay.dataset.week = 'training';
      page.replayCaption.textContent = REPLAY_CAPTION_TRAINING;
      const first = trainer.snapshot();
      page.status.textContent = label + studentStatus(first, false);
      page.check.textContent = checkLine(first, performance.now() - startedAt, false);
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
        } else if (pace !== null) {
          const slice = paceSlice(owed, start - lastFrame, pace);
          lastFrame = start;
          owed = slice.owed;
          snapshot = trainer.runEpisodes(slice.episodes); // the training slice
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
          const result: RunResult = { snapshot, ms, outOfBudget: ms >= BUDGET_MS };
          page.check.textContent = checkLine(snapshot, ms, result.outOfBudget);
          page.result = result; // before resolving, so the click's finally enables the export
          resolve(result);
          playFinal(page); // the final week once more, holding on Friday: outside the clock
          return;
        }
        // The week on the replay has played and held: play a fresh week the GM's way, and the sentence follows.
        if (replayClock(now - page.replayStartedAt).done) showWeek(page, trainer.evaluateTrace(), now);
        if (now - lastDraw >= REDRAW_MS) {
          lastDraw = now;
          page.status.textContent = label + studentStatus(snapshot, false);
          page.check.textContent = checkLine(snapshot, now - startedAt, false);
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

/** The page's line for a failed run (D45): no exception on the student's screen; the error goes to the console. */
export function showError(page: Page, err: unknown): void {
  console.error(err);
  page.status.textContent = ERROR_LINE;
}

/**
 * Everything a run locks: the editor, the prediction, the button, and the teacher's round radios, seed, speed and
 * export. Off for a run and for the whole pilot; on restores the editor to its round's own locks, and the export
 * only when there is a run to export. The reveal, the tab and the tray's close button are never locked.
 */
export function setControls(page: Page, enabled: boolean): void {
  page.editor.setEnabled(enabled);
  page.prediction.disabled = !enabled;
  for (const radio of page.rounds) radio.disabled = !enabled;
  page.seed.disabled = !enabled;
  page.speed.disabled = !enabled;
  page.train.disabled = !enabled;
  page.exportButton.disabled = !(enabled && page.result !== null && page.trace !== null);
}

/** Checks `name`'s radio and writes the round line (its label and note). Does not touch the editor. */
export function showRound(page: Page, name: PresetName): void {
  for (const radio of page.rounds) radio.checked = radio.value === name;
  page.roundLabel.textContent = loadPreset(name).label;
  page.roundNote.textContent = ROUND_NOTES[name] ?? '';
}

/**
 * Clears the last run's results, the one lifecycle operation (D37): moves the token on (any scheduled replay or
 * training frame of the old run then does nothing), drops the trace and its clock, the run's setup and result, and
 * resets the replay, its caption and button, the table, the sentence and its label, the curve, the check line and the
 * export button. The hidden rules are the config's, not the run's: they stay. After a run the status says the plan
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
  page.playing = false;
  page.replay.dataset.week = 'none';
  delete page.replay.dataset.key;
  page.replayCaption.textContent = REPLAY_CAPTION;
  page.replayAgain.hidden = true;
  page.reportTable.replaceChildren();
  page.report.hidden = true;
  page.readout.textContent = '';
  page.readoutLabel.textContent = READOUT_LABEL;
  page.check.textContent = NO_RUN;
  page.exportButton.disabled = true;
  redraw(page); // the empty curve and the replay's placeholder
  if (hadRun) page.status.textContent = PLAN_CHANGED;
}

/** Finds the page's elements, mounts the editor for the round on the address, draws the empty canvases, wires it all. */
export function mountApp(): Page {
  const canvas = byId('curve', HTMLCanvasElement);
  const replay = byId('replay', HTMLCanvasElement);
  const world = loadDefaultConfig();
  const speed = byId('speed', HTMLSelectElement);
  for (const s of SPEEDS) {
    const option = document.createElement('option');
    option.value = s.name;
    option.textContent = s.label;
    speed.appendChild(option);
  }
  speed.value = DEFAULT_SPEED;
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
    speed,
    train: byId('train', HTMLButtonElement),
    teacher: byId('teacher', HTMLElement),
    teacherOpen: byId('teacher-open', HTMLButtonElement),
    teacherClose: byId('teacher-close', HTMLButtonElement),
    reveal: byId('reveal', HTMLButtonElement),
    rules: byId('rules', HTMLElement),
    rulesList: byId('rules-list', HTMLOListElement),
    exportButton: byId('export', HTMLButtonElement),
    check: byId('check', HTMLElement),
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
    setup: null,
    result: null,
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
      speed: speedName(page.speed.value),
      prediction: page.prediction.value, // read here and nowhere else (D2, D47)
    };
    const run = runTraining(page, seed, clickedAt, '', paceFor(page.speed.value));
    // The class watches the status, the curve and the replay without touching anything (D42). The scroll comes after
    // the run's first sentence is written, since that sentence makes the panel above taller.
    page.watch.scrollIntoView({ behavior: 'smooth', block: 'start' });
    run
      .catch((err: unknown) => {
        if (!(err instanceof RunCancelled)) showError(page, err);
      })
      .finally(() => {
        setControls(page, true);
        page.train.textContent = AGAIN;
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

  mountTeacher(page);

  page.replay.dataset.week = 'none';
  redraw(page);
  return page;
}
