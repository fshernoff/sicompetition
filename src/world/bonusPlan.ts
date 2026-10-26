// The bonus plan on the page: the catalogue of measures (BRIEF section 7), the plan in plain words (section 7's
// template), and the editor's rules (the round limit of section 8, the clamping of weights). Pure functions over a
// RewardSpec: nothing here touches the DOM, and nothing mutates its input. WP1 (Sonnet).
import type { RewardPreset } from './config.ts';
import { KPI_KEYS, KPI_UNITS } from './types.ts';
import type { KpiKey, RewardSpec, WorldConfig } from './types.ts';

export interface KpiInfo {
  key: KpiKey;
  /** The name on the page, section 7. The 70 of "Staff fatigue above 70%" is `fatigue.kpiThreshold`. */
  name: string;
  /** The unit hint beside the slider: "per $100", "per dog", "per incident", "per point", "per block", "per block". */
  per: string;
}

const PER: Readonly<Record<KpiKey, string>> = {
  profit: `per $${KPI_UNITS.profit}`,
  dogsServed: 'per dog',
  incidents: 'per incident',
  reputation: 'per point',
  fatigue: 'per block',
  overRatio: 'per block',
};

/** The six measures in section 7 order, with the names on the page. */
export function kpiInfo(world: WorldConfig): readonly KpiInfo[] {
  const names: Record<KpiKey, string> = {
    profit: 'Profit today ($)',
    dogsServed: 'Dogs served',
    incidents: 'Incidents',
    reputation: 'Reputation change',
    fatigue: `Staff fatigue above ${world.fatigue.kpiThreshold}%`,
    overRatio: 'Blocks over the legal ratio',
  };
  return KPI_KEYS.map((key) => ({ key, name: names[key], per: PER[key] }));
}

/** What follows "earns N points" or "loses N points" for each measure. */
function tail(key: KpiKey, world: WorldConfig): string {
  switch (key) {
    case 'profit':
      return `per $${KPI_UNITS.profit} of profit`;
    case 'dogsServed':
      return 'per dog served';
    case 'incidents':
      return 'per incident';
    case 'reputation':
      return 'per point of reputation gained';
    case 'fatigue':
      return `for every block the crew's fatigue is above ${world.fatigue.kpiThreshold}%`;
    case 'overRatio':
      return `for every block the floor runs over ${world.bookings.legalRatio} dogs per staffer`;
  }
}

/**
 * The plan in plain words. The measures that are on, in section 7 order, one clause each, after "Each day, the GM ":
 * one clause ends with a period; two are joined with " and "; three or more with ", " and ", and " before the last.
 * A positive weight reads "earns N points", a negative one "loses N points" (the absolute value); "1 point" for one;
 * a weight of 0 while on reads "earns 0 points". Off measures are never mentioned, whatever their weight.
 */
export function describeBonusPlan(spec: RewardSpec, world: WorldConfig): string {
  const clauses = KPI_KEYS.filter((k) => spec.kpis[k].on).map((k) => {
    const w = spec.kpis[k].weight;
    const n = Math.abs(w);
    return `${w < 0 ? 'loses' : 'earns'} ${n} ${n === 1 ? 'point' : 'points'} ${tail(k, world)}`;
  });
  if (clauses.length === 0) return 'The GM is paid nothing: no measure is on.';
  const last = clauses[clauses.length - 1] as string;
  let joined: string;
  if (clauses.length === 1) joined = last;
  else if (clauses.length === 2) joined = `${clauses[0]} and ${last}`;
  else joined = `${clauses.slice(0, -1).join(', ')}, and ${last}`;
  return `Each day, the GM ${joined}.`;
}

/**
 * The hint under the sentence (Astra, plan review): profit and reputation deltas are signed, so a loss or a drop
 * counts the opposite of a gain. Null unless profit or reputation is on with a non-zero weight.
 */
export function signedNote(spec: RewardSpec): string | null {
  const counts = (k: KpiKey): boolean => spec.kpis[k].on && spec.kpis[k].weight !== 0;
  const profit = counts('profit');
  const rep = counts('reputation');
  const unit = `$${KPI_UNITS.profit}`;
  if (profit && rep) {
    return `Profit and reputation count both ways: a ${unit} loss or a one-point drop counts the opposite of a ${unit} gain or a one-point rise.`;
  }
  if (profit) return `Profit counts both ways: a ${unit} loss counts the opposite of a ${unit} gain.`;
  if (rep) return 'Reputation counts both ways: a one-point drop counts the opposite of a one-point rise.';
  return null;
}

/** How many measures are on. */
export function activeCount(spec: RewardSpec): number {
  return KPI_KEYS.filter((k) => spec.kpis[k].on).length;
}

/**
 * A preset that already uses its whole allowance (as many measures on as maxActive: Round 1 is 1 of 1) is locked
 * entirely: no toggle moves and no slider moves; the team reads the plan and predicts (section 8, D35).
 */
export function planLocked(preset: RewardPreset): boolean {
  return activeCount(preset.spec) >= preset.maxActive;
}

/**
 * The toggle of one measure. Turning off is always allowed. Turning on keeps the stored weight (the preset's
 * suggested weight, D26) and is refused with null when `maxActive` measures are already on. Returns a new spec.
 */
export function toggleKpi(spec: RewardSpec, key: KpiKey, maxActive: number): RewardSpec | null {
  const turningOn = !spec.kpis[key].on;
  if (turningOn && activeCount(spec) >= maxActive) return null;
  const next = structuredClone(spec);
  next.kpis[key].on = turningOn;
  return next;
}

/**
 * The weight of one measure, on or off: rounded to an integer (Math.round) and clamped to -10..+10; a value that is
 * not finite leaves the weight unchanged. Returns a new spec that passes validateRewardSpec.
 */
export function setWeight(spec: RewardSpec, key: KpiKey, value: number): RewardSpec {
  const next = structuredClone(spec);
  if (Number.isFinite(value)) {
    // `+ 0` turns a -0 (from rounding -0.4) into 0, which the validator and toEqual treat as different.
    next.kpis[key].weight = Math.max(-10, Math.min(10, Math.round(value))) + 0;
  }
  return next;
}
