// The speed control of the teacher panel (BRIEF section 11, D33, D48): four named speeds, each a number of weeks
// (training episodes) a second, or no pacing at all. Normal is the constant the Put the GM to work button paced
// at before G5 (1,200 weeks a second), so Round 1 trains exactly as it did; the pilot mode is never paced. A pure
// module: no DOM. WP3 (Sonnet).

export type SpeedName = 'slow' | 'normal' | 'fast' | 'full';

export interface Speed {
  name: SpeedName;
  /** The option's text in the panel, naming the number: "Normal: 1,200 weeks a second"; Full says no pacing. */
  label: string;
  /** Weeks a second, or null for no pacing (each frame trains for 10 ms). */
  pace: number | null;
}

/** The four speeds in the panel's order: slow (600), normal (1,200), fast (2,400), full (null). */
export const SPEEDS: readonly Speed[] = [
  { name: 'slow', label: 'Slow: 600 weeks a second', pace: 600 },
  { name: 'normal', label: 'Normal: 1,200 weeks a second', pace: 1200 },
  { name: 'fast', label: 'Fast: 2,400 weeks a second', pace: 2400 },
  { name: 'full', label: 'Full speed: no pacing', pace: null },
];

export const DEFAULT_SPEED: SpeedName = 'normal';

/** The pace for a speed name: null for full speed; an unknown name gives Normal's pace. */
export function paceFor(name: string): number | null {
  const found = SPEEDS.find((s) => s.name === name) ?? SPEEDS.find((s) => s.name === DEFAULT_SPEED);
  return found === undefined ? 1200 : found.pace;
}

/** The speed name a select's value stands for; an unknown value is Normal. */
export function speedName(value: string): SpeedName {
  return SPEEDS.find((s) => s.name === value)?.name ?? DEFAULT_SPEED;
}

/** A frame never makes up more than this much training time, however late it is (D33). */
export const MAX_FRAME_SECONDS = 0.1;

export interface PaceSlice {
  /** The weeks to train this frame: at least 1. */
  episodes: number;
  /** The fractional weeks carried to the next frame (negative after a frame that trained its minimum of 1). */
  owed: number;
}

/**
 * The per-frame arithmetic of a paced run, exactly as the button had it before G5: the elapsed time since the
 * previous frame, capped at MAX_FRAME_SECONDS, times the pace is added to the owed weeks; the frame trains the
 * whole weeks owed, at least 1, and the remainder carries. `elapsedMs` below 0 counts as 0.
 */
export function paceSlice(owed: number, elapsedMs: number, pace: number): PaceSlice {
  const seconds = Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsedMs) / 1000);
  const total = owed + pace * seconds;
  const episodes = Math.max(1, Math.floor(total));
  return { episodes, owed: total - episodes };
}
