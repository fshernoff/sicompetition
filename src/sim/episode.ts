// Runs one week and builds the readout. BRIEF sections 2 (the week), 7 (the bonus plan), 9 (seeds) and 10 (the
// weekly P&L and operations report). No world rule lives here: the runner calls step and reads what it returns.
import { addDeltas, emptyDeltas, rewardFor } from '../world/reward.ts';
import { makeRng } from '../world/rng.ts';
import { initialState, legalActions, step } from '../world/step.ts';
import type {
  DayReport,
  EpisodeSeeds,
  EpisodeTrace,
  FloorActivity,
  Policy,
  RewardSpec,
  StepRecord,
  WeekReport,
  WeekTotals,
  WorldConfig,
} from '../world/types.ts';
import { KPI_KEYS } from '../world/types.ts';

/** BRIEF section 2: five days of four blocks. */
const DAYS = 5;
const BLOCKS_PER_DAY = 4;
const STEPS_PER_WEEK = DAYS * BLOCKS_PER_DAY;

/**
 * 20 steps from initialState under `policy`; the world draws from makeRng(seeds.world), the policy from
 * makeRng(seeds.policy). The policy is called exactly 20 times, never on a done state. The trace's final state is
 * the terminal one: day 5, block 0, done true (BRIEF section 2).
 */
export function runEpisode(config: WorldConfig, spec: RewardSpec, policy: Policy, seeds: EpisodeSeeds): EpisodeTrace {
  const worldRng = makeRng(seeds.world);
  const policyRng = makeRng(seeds.policy);
  let state = initialState(config);
  const steps: StepRecord[] = [];
  for (let t = 0; t < STEPS_PER_WEEK; t++) {
    if (state.done) throw new Error(`runEpisode: the week ended early, at step ${t}`);
    const action = policy(state, legalActions(state), policyRng);
    const result = step(state, action, config, worldRng);
    steps.push({ state, action, result, reward: rewardFor(result.deltas, spec) });
    state = result.state;
  }
  if (!state.done) throw new Error('runEpisode: the week did not end after step 19');
  return { seeds, steps, report: buildReport(steps, seeds) };
}

const sum = (xs: readonly number[]): number => xs.reduce((a, x) => a + x, 0);

/** Arithmetic mean; 0 for an empty list. */
export function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : sum(xs) / xs.length;
}

/** Sample standard deviation (n − 1); 0 for fewer than two values. */
export function sampleStd(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/**
 * The floor ratios of the open blocks that have dogs on the floor after any walking group has left (BRIEF section
 * 10, average dogs per staffer). A ratio of 0 means an empty floor, so it is left out.
 */
function ratiosWithDogs(day: readonly StepRecord[]): number[] {
  return day.filter((s) => s.result.activity !== null && s.result.floorRatio > 0).map((s) => s.result.floorRatio);
}

function dayReport(day: number, records: readonly StepRecord[]): DayReport {
  const dropOff = records[0];
  const pickupStep = records[BLOCKS_PER_DAY - 1];
  if (dropOff === undefined || pickupStep === undefined || records.length !== BLOCKS_PER_DAY) {
    throw new Error(`buildReport: day ${day} does not have ${BLOCKS_PER_DAY} steps`);
  }
  const pickup = pickupStep.result.pickup;
  if (pickup === undefined) throw new Error(`buildReport: day ${day} has no pickup snapshot`);
  const afterDropOff = dropOff.result.state;
  const events = records.flatMap((s) => s.result.events);
  const count = (type: string) => events.filter((e) => e.type === type).length;
  const money = (pick: (s: StepRecord) => number) => sum(records.map(pick));
  const accepted = afterDropOff.dogsOnFloor;
  const requested = records.map((s) => (s.action.kind === 'floor' ? s.action.activity : null));
  return {
    day,
    requests: dropOff.state.requestsToday,
    accepted,
    rate: afterDropOff.plan?.rate ?? null,
    scheduledStaff: afterDropOff.scheduledStaff,
    floorStaff: afterDropOff.floorStaff,
    calledOut: afterDropOff.calledOut,
    closed: afterDropOff.closed,
    requested,
    activities: records.map((s) => s.result.activity),
    incidents: count('incident'),
    illnessCases: sum(events.filter((e) => e.type === 'illness').map((e) => e.amount ?? 1)),
    fines: count('inspection'),
    vetBills: count('vetBill'),
    dayRateRevenue: money((s) => s.result.money.dayRateRevenue),
    addOnRevenue: money((s) => s.result.money.addOnRevenue),
    wages: money((s) => s.result.money.wages),
    refunds: money((s) => s.result.money.refunds),
    vetCost: money((s) => s.result.money.vetCost),
    fineCost: money((s) => s.result.money.fineCost),
    suppliesCost: money((s) => s.result.money.supplies),
    profit: money((s) => s.result.deltas.profit),
    blocksOverRatio: money((s) => s.result.deltas.overRatio),
    blocksFatigueOver70: money((s) => s.result.deltas.fatigue),
    avgRatio: mean(ratiosWithDogs(records)),
    reputationAtPickup: pickup.reputation,
    cleanlinessAtPickup: pickup.cleanliness,
    fatigueAtPickup: pickup.fatigue,
    energyAtPickup: pickup.energy,
  };
}

/**
 * The weekly P&L and operations report from a trace's steps, using result.money, result.pickup and result.deltas
 * only (no rule logic here). Invariants the tests pin: Σ money per day = day profit; Σ day profit = totals.profit =
 * cashEnd − cash.weekStart; totals.kpi = Σ step deltas; totals.reward = Σ step rewards.
 */
export function buildReport(steps: readonly StepRecord[], seeds: EpisodeSeeds): WeekReport {
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (first === undefined || last === undefined || steps.length !== STEPS_PER_WEEK) {
    throw new Error(`buildReport: a week has ${STEPS_PER_WEEK} steps, got ${steps.length}`);
  }
  const days: DayReport[] = [];
  const weekRatios: number[] = [];
  for (let d = 0; d < DAYS; d++) {
    const records = steps.slice(d * BLOCKS_PER_DAY, (d + 1) * BLOCKS_PER_DAY);
    const report = dayReport(d, records);
    days.push(report);
    weekRatios.push(...ratiosWithDogs(records));
  }
  const total = (pick: (d: DayReport) => number) => sum(days.map(pick));
  const blocksOf = (activity: FloorActivity) => sum(days.map((d) => d.activities.filter((a) => a === activity).length));
  const terminal = last.result.state;
  const totals: WeekTotals = {
    daysAcceptedAll: days.filter((d) => !d.closed && d.requests > 0 && d.accepted === d.requests).length,
    daysOneStaffer: days.filter((d) => d.floorStaff === 1).length,
    daysClosed: days.filter((d) => d.closed).length,
    freePlayBlocks: blocksOf('freePlay'),
    structuredPlayBlocks: blocksOf('structuredPlay'),
    napBlocks: blocksOf('nap'),
    walkBlocks: blocksOf('walk'),
    cleanBlocks: blocksOf('clean'),
    avgDogsPerStaffer: mean(weekRatios),
    incidents: total((d) => d.incidents),
    illnessCases: total((d) => d.illnessCases),
    fines: total((d) => d.fines),
    vetBills: total((d) => d.vetBills),
    blocksOverRatio: total((d) => d.blocksOverRatio),
    blocksFatigueOver70: total((d) => d.blocksFatigueOver70),
    dogsServed: total((d) => d.accepted),
    revenue: total((d) => d.dayRateRevenue + d.addOnRevenue),
    wages: total((d) => d.wages),
    refunds: total((d) => d.refunds),
    vetCost: total((d) => d.vetCost),
    fineCost: total((d) => d.fineCost),
    supplies: total((d) => d.suppliesCost),
    profit: total((d) => d.profit),
    reputationStart: first.state.reputation,
    reputationEnd: terminal.reputation,
    reputationChange: terminal.reputation - first.state.reputation,
    cashEnd: terminal.cash,
    kpi: steps.reduce((acc, s) => addDeltas(acc, s.result.deltas), emptyDeltas()),
    reward: sum(steps.map((s) => s.reward)),
  };
  return { seeds, days, totals };
}

export interface Spread {
  std: number; // sample standard deviation (n − 1); 0 for one episode
  p5: number; // nearest-rank percentiles over the sorted values
  p95: number;
}

/**
 * mean: every numeric field of totals averaged (kpi too); min, max and spread over profit, incidents and reward.
 */
export interface WeekSummary {
  episodes: number;
  mean: WeekReport['totals'];
  min: Pick<WeekReport['totals'], 'profit' | 'incidents' | 'reward'>;
  max: Pick<WeekReport['totals'], 'profit' | 'incidents' | 'reward'>;
  spread: Record<'profit' | 'incidents' | 'reward', Spread>;
}

/** Nearest-rank percentile of already sorted values: the value at rank ceil(p/100 × n). */
function nearestRank(sorted: readonly number[], p: number): number {
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] ?? 0;
}

type Spotlit = 'profit' | 'incidents' | 'reward';

type NumericTotal = Exclude<keyof WeekTotals, 'kpi'>;

export function summarize(reports: readonly WeekReport[]): WeekSummary {
  const first = reports[0];
  if (first === undefined) throw new Error('summarize: no episodes');
  const all = reports.map((r) => r.totals);
  const meanTotals: WeekTotals = { ...first.totals, kpi: { ...first.totals.kpi } };
  for (const key of Object.keys(first.totals) as (keyof WeekTotals)[]) {
    if (key === 'kpi') continue;
    const k: NumericTotal = key;
    meanTotals[k] = mean(all.map((t) => t[k]));
  }
  for (const k of KPI_KEYS) meanTotals.kpi[k] = mean(all.map((t) => t.kpi[k]));
  const sorted = (k: Spotlit) => all.map((t) => t[k]).sort((a, b) => a - b);
  const byKey = { profit: sorted('profit'), incidents: sorted('incidents'), reward: sorted('reward') };
  const pick = (f: (xs: readonly number[]) => number) => ({ profit: f(byKey.profit), incidents: f(byKey.incidents), reward: f(byKey.reward) });
  const spread = (xs: readonly number[]): Spread => ({ std: sampleStd(xs), p5: nearestRank(xs, 5), p95: nearestRank(xs, 95) });
  return {
    episodes: reports.length,
    mean: meanTotals,
    min: pick((xs) => xs[0] ?? 0),
    max: pick((xs) => xs[xs.length - 1] ?? 0),
    spread: { profit: spread(byKey.profit), incidents: spread(byKey.incidents), reward: spread(byKey.reward) },
  };
}
