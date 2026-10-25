// The page controller: the seed field, the Train button, the status line, the training curve and the readout.
// Training runs in requestAnimationFrame: each frame trains for 10 ms (Trainer.runFor) and nothing else; the curve,
// the status line and the readout are redrawn at most 10 times a second. A run stops when the trainer is done or
// 60 s after the click, whichever comes first (BRIEF section 13: rendering counts against the budget).
import { DEFAULT_LEARNER, Trainer } from '../learn/train.ts';
import type { TrainingSnapshot } from '../learn/train.ts';
import { describeWeek } from '../sim/readout.ts';
import { loadDefaultConfig, loadPreset } from '../world/config.ts';
import type { RewardSpec, WorldConfig } from '../world/types.ts';
import { drawCurve } from './curve.ts';
import type { CurveColors } from './curve.ts';

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

export interface Page {
  seed: HTMLInputElement;
  train: HTMLButtonElement;
  fast: HTMLInputElement; // checked: no pacing, train as fast as the machine allows
  status: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  readout: HTMLElement;
  pilot: HTMLElement;
  colors: CurveColors;
  world: WorldConfig;
  spec: RewardSpec; // Round 1: profit only, +10 per $100
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
  if (s.targetMet) parts.push('target met');
  if (outOfBudget) parts.push(`over the ${BUDGET_MS / 1000} s limit`);
  else if (s.done && !s.stable) parts.push('stopped at the episode limit');
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

/** Finds the page's elements, draws the empty chart and wires the Train button. */
export function mountApp(): Page {
  const canvas = byId('curve', HTMLCanvasElement);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('page: this browser has no 2D canvas');
  const page: Page = {
    seed: byId('seed', HTMLInputElement),
    train: byId('train', HTMLButtonElement),
    fast: byId('fast', HTMLInputElement),
    status: byId('status', HTMLElement),
    canvas,
    ctx,
    readout: byId('readout', HTMLElement),
    pilot: byId('pilot', HTMLElement),
    colors: readColors(),
    world: loadDefaultConfig(),
    spec: loadPreset('round1').spec,
    trainer: null,
  };

  page.train.addEventListener('click', () => {
    const clickedAt = performance.now();
    const seed = readSeed(page.seed);
    if (seed === null) {
      page.status.textContent = `The seed must be a whole number from 0 to ${MAX_SEED}.`;
      return;
    }
    page.train.disabled = true;
    page.seed.disabled = true;
    page.fast.disabled = true;
    page.readout.textContent = '';
    page.status.textContent = `Training the GM on seed ${seed}…`;
    runTraining(page, seed, clickedAt, '', !page.fast.checked)
      .catch((err: unknown) => showError(page, err))
      .finally(() => {
        page.train.disabled = false;
        page.seed.disabled = false;
        page.fast.disabled = false;
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
