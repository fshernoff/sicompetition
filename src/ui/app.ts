// The page controller: the round selector, the bonus plan editor, the prediction, the seed field, the Train button,
// the status line, the training curve and the readout.
// Training runs in requestAnimationFrame: each frame trains for 10 ms (Trainer.runFor) and nothing else; the curve,
// the status line and the readout are redrawn at most 10 times a second. A run stops when the trainer is done or
// 60 s after the click, whichever comes first (BRIEF section 13: rendering counts against the budget).
// A run belongs to the plan it was trained on: the click snapshots the editor's plan into page.spec, and any change
// to the plan after a run clears that run's readout, status and curve (G3 plan, design calls).
import { DEFAULT_LEARNER, Trainer } from '../learn/train.ts';
import type { TrainingSnapshot } from '../learn/train.ts';
import { describeWeek } from '../sim/readout.ts';
import { loadDefaultConfig, loadPreset, validateRewardSpec } from '../world/config.ts';
import type { PresetName } from '../world/config.ts';
import type { RewardSpec, WorldConfig } from '../world/types.ts';
import { drawCurve } from './curve.ts';
import type { CurveColors } from './curve.ts';
import { mountEditor, roundFromSearch } from './editor.ts';
import type { Editor } from './editor.ts';

export const BUDGET_MS = 60_000; // from the click (or a pilot seed's start), rendering included
const SLICE_MS = 10; // training time per animation frame when not paced (Fast, and the pilot)
/**
 * Episodes per second when paced. The hook of the lesson is that the class watches the GM learn: unpaced, Round 1
 * is stable in a fraction of a second; at this pace the curve climbs for about 20 to 40 s (stable needs 22,000 to
 * 46,000 episodes). G5's speed slider replaces it.
 */
export const PACE = 1200;
const MAX_FRAME_SECONDS = 0.1; // a slow or skipped frame never makes up more than a tenth of a second of training
const REDRAW_MS = 100; // at most 10 redraws a second
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
const PLAN_CHANGED = 'The plan changed. Train the GM to see what it does with this one.';

export interface Page {
  round: HTMLSelectElement; // the round selector (G5 moves it into the teacher panel)
  roundNote: HTMLElement;
  editor: Editor;
  prediction: HTMLTextAreaElement; // the team's prediction: never read, never stored (D2)
  seed: HTMLInputElement;
  train: HTMLButtonElement;
  fast: HTMLInputElement; // checked: no pacing, train as fast as the machine allows
  status: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  readout: HTMLElement;
  readoutLabel: HTMLElement;
  pilot: HTMLElement;
  colors: CurveColors;
  world: WorldConfig;
  spec: RewardSpec; // the plan of the current or last run, snapshotted and validated at the click
  trainer: Trainer | null; // the last run, kept so a window resize can redraw its curve
}

export interface RunResult {
  snapshot: TrainingSnapshot;
  ms: number; // from the start to the stop
  outOfBudget: boolean; // the run (training, the final evaluation and the redraw included) passed 60 s
}

function byId<T extends HTMLElement>(id: string, kind: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) throw new Error(`page: #${id} is missing or the wrong element`);
  return el;
}

/** Colours come from the page's CSS custom properties, so the stylesheet is the one place to change them. */
function readColors(): CurveColors {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    background: get('--chart-paper', '#ffffff'),
    ink: get('--ink', '#1f2a1f'),
    grid: get('--chart-grid', 'rgba(31, 42, 31, 0.14)'),
    raw: get('--chart-week', 'rgba(31, 42, 31, 0.22)'),
    average: get('--chart-average', '#1d5fbf'),
    evaluation: get('--chart-test', '#d9480f'),
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
function sizeCanvas(canvas: HTMLCanvasElement): { width: number; height: number; ratio: number } {
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

export function redraw(page: Page): void {
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
 * The status line. Careful with words: the e2e test waits for "stable" to appear, so nothing here may contain it
 * until the trainer says so.
 */
export function statusText(s: TrainingSnapshot, ms: number, outOfBudget: boolean, paced: boolean): string {
  const parts = [
    ...(paced ? ['paced'] : []),
    `Episodes ${s.episodes.toLocaleString('en-US')}`,
    `ε ${s.epsilon.toFixed(2)}`,
    `${(ms / 1000).toFixed(1)} s`,
    `${s.evaluations} ${s.evaluations === 1 ? 'evaluation' : 'evaluations'}`,
  ];
  if (s.stable) parts.push('stable');
  if (s.stable && s.targetMet) parts.push('target met');
  if (outOfBudget) {
    parts.push(s.stable ? `over the ${BUDGET_MS / 1000} s limit` : `${BUDGET_MS / 1000} s is up, the GM is still changing its mind`);
  } else if (s.done && !s.stable) {
    parts.push('stopped at the episode limit, the GM is still changing its mind');
  }
  return parts.join(' · ');
}

/**
 * Trains one seed with the frame loop, from `startedAt` (performance.now() at the click). `label` goes in front of
 * the status line (the pilot names the seed). Paced: each frame trains PACE episodes per second of the time since the
 * previous frame; unpaced: each frame trains for 10 ms. Resolves when the trainer is done or the budget has run out.
 */
export function runTraining(
  page: Page,
  seed: number,
  startedAt: number,
  label: string,
  paced: boolean,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let trainer: Trainer;
    try {
      trainer = new Trainer(page.world, page.spec, seed);
    } catch (err) {
      reject(err);
      return;
    }
    page.trainer = trainer;
    let lastDraw = -Infinity;
    let lastFrame = startedAt;
    let owed = 0; // paced: the fractional episodes carried from frame to frame, so the pace holds at any frame rate
    let shownEvaluations = 0;

    const frame = (): void => {
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
        const finished = snapshot.done || now - startedAt >= BUDGET_MS;
        if (finished) {
          // The readout first, so that by the time the status line says "stable" the sentence is final; the clock
          // stops after that work, so a run that finishes its last slice past the deadline is counted as late.
          page.readout.textContent = describeWeek(trainer.evaluate());
          page.readoutLabel.textContent = snapshot.stable ? READOUT_LABEL : READOUT_LABEL_UNSETTLED;
          redraw(page);
          const ms = performance.now() - startedAt;
          const outOfBudget = ms >= BUDGET_MS;
          page.status.textContent = label + statusText(snapshot, ms, outOfBudget, paced);
          resolve({ snapshot, ms, outOfBudget });
          return;
        }
        const ms = now - startedAt;
        if (now - lastDraw >= REDRAW_MS) {
          lastDraw = now;
          if (snapshot.evaluations !== shownEvaluations && snapshot.lastEval) {
            shownEvaluations = snapshot.evaluations;
            page.readout.textContent = describeWeek(snapshot.lastEval.report);
          }
          redraw(page);
          page.status.textContent = label + statusText(snapshot, ms, false, paced);
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

/** Clears the last run's results: the curve, the readout, its label, and (after a run) the status line. */
function clearRun(page: Page): void {
  const hadRun = page.trainer !== null;
  page.trainer = null;
  redraw(page);
  page.readout.textContent = '';
  page.readoutLabel.textContent = READOUT_LABEL;
  if (hadRun) page.status.textContent = PLAN_CHANGED;
}

/** Finds the page's elements, mounts the editor for the round on the address, draws the empty chart, wires it all. */
export function mountApp(): Page {
  const canvas = byId('curve', HTMLCanvasElement);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('page: this browser has no 2D canvas');
  const world = loadDefaultConfig();
  const round = byId('round', HTMLSelectElement);
  for (const option of Array.from(round.options)) {
    if ((ROUNDS as readonly string[]).includes(option.value)) option.textContent = loadPreset(option.value as PresetName).label;
  }
  const first = roundFromSearch(window.location.search);
  const editor = mountEditor(byId('editor', HTMLElement), world, loadPreset(first));
  const page: Page = {
    round,
    roundNote: byId('round-note', HTMLElement),
    editor,
    prediction: byId('prediction', HTMLTextAreaElement),
    seed: byId('seed', HTMLInputElement),
    train: byId('train', HTMLButtonElement),
    fast: byId('fast', HTMLInputElement),
    status: byId('status', HTMLElement),
    canvas,
    ctx,
    readout: byId('readout', HTMLElement),
    readoutLabel: byId('readout-label', HTMLElement),
    pilot: byId('pilot', HTMLElement),
    colors: readColors(),
    world,
    spec: editor.spec(),
    trainer: null,
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
    page.readout.textContent = '';
    page.readoutLabel.textContent = READOUT_LABEL;
    page.status.textContent = `Training the GM on seed ${seed}…`;
    runTraining(page, seed, clickedAt, '', !page.fast.checked)
      .catch((err: unknown) => showError(page, err))
      .finally(() => {
        setControls(page, true);
        page.train.textContent = 'Train again';
      });
  });

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      redraw(page);
    });
  });

  redraw(page);
  return page;
}
