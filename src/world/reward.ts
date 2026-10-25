// The bonus plan applied to a step's KPI deltas. BRIEF section 7.
import { KPI_KEYS, KPI_UNITS } from './types.ts';
import type { KpiDeltas, RewardSpec } from './types.ts';

const WEIGHT_MIN = -10;
const WEIGHT_MAX = 10;

export function emptyDeltas(): KpiDeltas {
  return { profit: 0, dogsServed: 0, incidents: 0, reputation: 0, fatigue: 0, overRatio: 0 };
}

export function addDeltas(a: KpiDeltas, b: KpiDeltas): KpiDeltas {
  const sum = emptyDeltas();
  for (const k of KPI_KEYS) sum[k] = a[k] + b[k];
  return sum;
}

/** Weights outside −10..+10 are clamped; non-integers are rounded; KPIs that are off contribute 0. */
export function rewardFor(deltas: KpiDeltas, spec: RewardSpec): number {
  let reward = 0;
  for (const k of KPI_KEYS) {
    const setting = spec.kpis[k];
    if (!setting.on) continue;
    const weight = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(setting.weight)));
    // weight × (delta ÷ unit): 10 points per $100 of profit under Round 1.
    reward += weight * (deltas[k] / KPI_UNITS[k]);
  }
  return reward;
}
