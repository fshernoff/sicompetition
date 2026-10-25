// The coarse observation the Q-table is keyed on. BRIEF section 3.1 (D28: no fatigue anywhere, no cleanliness at
// drop-off). Every function here is pure and allocation-free: the trainer calls observe about 20 times an episode.
import type { State, WorldConfig } from '../world/types.ts';

/** day 5 × requestsToday bin 4 × soloStreak bin 4 (D28: no cleanliness or fatigue at drop-off). */
export const DROP_OFF_OBSERVATIONS = 5 * 4 * 4;
/** day 5 × block 3 × ratio bin 4 × floorStaff 3 × energy bin 3 × cleanliness bin 2 (D28: no fatigue). */
export const FLOOR_OBSERVATIONS = 5 * 3 * 4 * 3 * 3 * 2;
/** A closed day's floor block: the runner asks for an action, nothing happens, the learner does not update here. */
export const CLOSED_OBSERVATION = DROP_OFF_OBSERVATIONS + FLOOR_OBSERVATIONS;
export const OBSERVATION_COUNT = CLOSED_OBSERVATION + 1;

/** The top cut of the load and ratio bins (section 3.1): above 20 dogs, or 20 per staffer, is the last bin. */
const CROWDED = 20;
/** Energy bins (section 3.1): below 35 is calm, above 70 is wound up. */
const ENERGY_CALM_BELOW = 35;
const ENERGY_WOUND_ABOVE = 70;
/** soloStreak 3 or more: the next solo day closes (H7). */
const STREAK_TOP = 3;

/** The shared cuts of loadBin and ratioBin: ≤ safeRatio, ≤ legalRatio, ≤ 20, above. */
function cutBin(x: number, config: WorldConfig): number {
  if (x <= config.bookings.safeRatio) return 0;
  if (x <= config.bookings.legalRatio) return 1;
  if (x <= CROWDED) return 2;
  return 3;
}

/** requestsToday → 0: ≤ safeRatio (10); 1: ≤ legalRatio (15); 2: ≤ 20; 3: above. */
export function loadBin(requests: number, config: WorldConfig): number {
  return cutBin(requests, config);
}

/** dogsOnFloor ÷ floorStaff → 0: ≤ 10; 1: ≤ 15; 2: ≤ 20; 3: above (same cuts as loadBin; 0 dogs is bin 0). */
export function ratioBin(ratio: number, config: WorldConfig): number {
  return cutBin(ratio, config);
}

/** soloStreak → 0, 1, 2, 3 (3 means 3 or more: the next solo day closes). */
export function streakBin(soloStreak: number): number {
  return soloStreak >= STREAK_TOP ? STREAK_TOP : soloStreak;
}

/** energy → 0: < 35; 1: 35..70; 2: > 70. */
export function energyBin(energy: number): number {
  if (energy < ENERGY_CALM_BELOW) return 0;
  if (energy <= ENERGY_WOUND_ABOVE) return 1;
  return 2;
}

/** cleanliness → 0: ≥ illness.threshold (40); 1: below (dogs get sick at pickup). */
export function cleanBin(cleanliness: number, config: WorldConfig): number {
  return cleanliness >= config.illness.threshold ? 0 : 1;
}

/** False on a closed day's floor blocks and on a done state: no decision is taken there. */
export function isDecision(state: State): boolean {
  if (state.done) return false;
  return state.block === 0 || !state.closed;
}

/**
 * The observation index. Drop-off (block 0): (day × 4 + loadBin) × 4 + streakBin, in 0..79. Floor (blocks 1..3, open
 * day): DROP_OFF_OBSERVATIONS + (((((day × 3 + block − 1) × 4 + ratioBin) × 3 + floorStaff − 1) × 3 + energyBin) × 2 +
 * cleanBin), in 80..1159. A closed day's floor block: CLOSED_OBSERVATION. Throws on a done state.
 */
export function observe(state: State, config: WorldConfig): number {
  if (state.done) throw new Error('observe: the week is over (state.done is true)');
  if (state.block === 0) {
    return (state.day * 4 + loadBin(state.requestsToday, config)) * 4 + streakBin(state.soloStreak);
  }
  if (state.closed) return CLOSED_OBSERVATION;
  // The floor ratio as the GM sees it before choosing (no walking group yet); 0 dogs is bin 0.
  const ratio = state.dogsOnFloor === 0 || state.floorStaff === 0 ? 0 : state.dogsOnFloor / state.floorStaff;
  const staffSlot = Math.min(3, Math.max(1, state.floorStaff)) - 1;
  return (
    DROP_OFF_OBSERVATIONS +
    (((((state.day * 3 + state.block - 1) * 4 + ratioBin(ratio, config)) * 3 + staffSlot) * 3 + energyBin(state.energy)) * 2 +
      cleanBin(state.cleanliness, config))
  );
}
