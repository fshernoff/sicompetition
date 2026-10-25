// Evaluates fixed policies so the design numbers can be checked without a learner. Plan acceptance 3; BRIEF
// section 7 (what the profit-only bonus plan should buy) and section 9 (the same seeds for every candidate).
import { episodeSeeds } from '../world/rng.ts';
import type { DayPlan, EpisodeSeeds, RewardSpec, WorldConfig } from '../world/types.ts';
import { BOOKINGS, FLOOR_ACTIVITIES, RATES, STAFF_COUNTS } from '../world/types.ts';
import { mean, runEpisode, sampleStd } from './episode.ts';
import { dayPlanPolicy, FLOOR_PATTERNS } from './policies.ts';
import type { FloorPattern } from './policies.ts';

/** Which stage of the search produced a candidate (see evaluateStationaryPolicies). */
export type Stage = 'A' | 'B' | 'C' | 'D' | 'E';

export interface PolicyScore {
  stage: Stage;
  plans: readonly DayPlan[]; // 5 entries; a stationary policy repeats one plan
  patternName: string; // a FLOOR_PATTERNS key; '<base>+<other>@<day>' (C); '<base>|<change>@<day>[.<block>]' (D, E)
  patterns: readonly FloorPattern[]; // 5 entries, one per day
  meanProfit: number;
  stdProfit: number; // sample standard deviation of weekly profit
  meanReward: number;
  meanIncidents: number;
  daysOneStaffer: number; // means of the readout's week totals, so the outcome class can be checked on reports
  daysClosed: number;
  daysAcceptedAll: number;
  napCleanBlocks: number;
}

type Candidate = Pick<PolicyScore, 'stage' | 'plans' | 'patternName' | 'patterns'>;

const DAYS = [0, 1, 2, 3, 4];
const BLOCKS = [0, 1, 2]; // pattern slots for blocks 1..3

function checkArgs(episodes: number, seed: number): void {
  if (!Number.isInteger(episodes) || episodes < 1) throw new Error(`search: episodes must be an integer of 1 or more, got ${episodes}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error(`search: seed must be an integer from 0 to 4294967295, got ${seed}`);
}

function seedBatch(episodes: number, seed: number): EpisodeSeeds[] {
  return Array.from({ length: episodes }, (_, i) => episodeSeeds(seed, i));
}

function score(candidate: Candidate, config: WorldConfig, spec: RewardSpec, seeds: readonly EpisodeSeeds[]): PolicyScore {
  const policy = dayPlanPolicy(candidate.plans, candidate.patterns);
  const totals = seeds.map((s) => runEpisode(config, spec, policy, s).report.totals);
  const profits = totals.map((t) => t.profit);
  return {
    ...candidate,
    meanProfit: mean(profits),
    stdProfit: sampleStd(profits),
    meanReward: mean(totals.map((t) => t.reward)),
    meanIncidents: mean(totals.map((t) => t.incidents)),
    daysOneStaffer: mean(totals.map((t) => t.daysOneStaffer)),
    daysClosed: mean(totals.map((t) => t.daysClosed)),
    daysAcceptedAll: mean(totals.map((t) => t.daysAcceptedAll)),
    napCleanBlocks: mean(totals.map((t) => t.napBlocks + t.cleanBlocks)),
  };
}

/** The first candidate with the highest mean reward (ties keep candidate order). */
function bestOf(scores: readonly PolicyScore[]): PolicyScore {
  let best = scores[0];
  if (best === undefined) throw new Error('search: no candidates');
  for (const s of scores) if (s.meanReward > best.meanReward) best = s;
  return best;
}

/**
 * A restricted-policy calibration, not a proof of optimality (the learner in G2 is that). Candidates, in order:
 *   A. the 135 stationary policies (BOOKINGS × RATES × STAFF_COUNTS × FLOOR_PATTERNS, in that nesting order);
 *   B. for the best A-candidate of EACH floor pattern AND each stationary staff level (by meanReward over bookings ×
 *      rate), the ten variants with one day's staff set to each of the two other levels (day 0..4, then the other
 *      levels in STAFF_COUNTS order): 5 × 3 × 10 = 150, patternName unchanged. Building from every staff level is
 *      what reaches "one staffer with one day of help" even when two staffers every day is the best stationary plan;
 *   C. for the best of A ∪ B, the twenty variants where one day uses another FLOOR_PATTERNS entry (day 0..4, then
 *      the other four patterns in FLOOR_PATTERNS order), patternName '<base>+<other>@<day>';
 *   D. for the best of A ∪ B ∪ C, the twenty one-day plan deviations: each day, the two other bookings choices then
 *      the two other rates (BOOKINGS and RATES order), patternName '<base>|<choice>@<day>';
 *   E. for the same base, the sixty single-block activity deviations: each day, each of blocks 1..3, each of the four
 *      other activities (FLOOR_ACTIVITIES order), patternName '<base>|<activity>@<day>.<block>'.
 * 385 in all. D and E are where a learner would defect one decision at a time, so they are the margins that matter.
 * Every candidate runs `episodes` weeks on episodeSeeds(seed, 0..episodes−1), the same seeds for all. Sorted by
 * meanReward, best first; ties keep candidate order.
 */
export function evaluateStationaryPolicies(
  config: WorldConfig,
  spec: RewardSpec,
  episodes: number,
  seed: number,
): PolicyScore[] {
  checkArgs(episodes, seed);
  const seeds = seedBatch(episodes, seed);
  const patternEntries = Object.entries(FLOOR_PATTERNS);
  const run = (c: Candidate) => score(c, config, spec, seeds);

  const a: PolicyScore[] = [];
  for (const bookings of BOOKINGS) {
    for (const rate of RATES) {
      for (const staff of STAFF_COUNTS) {
        for (const [name, pattern] of patternEntries) {
          const plan: DayPlan = { bookings, rate, staff };
          a.push(run({ stage: 'A', plans: DAYS.map(() => plan), patternName: name, patterns: DAYS.map(() => pattern) }));
        }
      }
    }
  }

  const b: PolicyScore[] = [];
  for (const [name] of patternEntries) {
    for (const level of STAFF_COUNTS) {
      const base = bestOf(a.filter((s) => s.patternName === name && s.plans[0]?.staff === level));
      for (const day of DAYS) {
        for (const staff of STAFF_COUNTS) {
          if (staff === level) continue;
          const plans = base.plans.map((p, d) => (d === day ? { ...p, staff } : p));
          b.push(run({ stage: 'B', plans, patternName: name, patterns: base.patterns }));
        }
      }
    }
  }

  const c: PolicyScore[] = [];
  const baseC = bestOf([...a, ...b]);
  for (const day of DAYS) {
    for (const [other, otherPattern] of patternEntries) {
      if (other === baseC.patternName) continue;
      const patterns = baseC.patterns.map((p, d) => (d === day ? otherPattern : p));
      c.push(run({ stage: 'C', plans: baseC.plans, patternName: `${baseC.patternName}+${other}@${day}`, patterns }));
    }
  }

  const d: PolicyScore[] = [];
  const e: PolicyScore[] = [];
  const base = bestOf([...a, ...b, ...c]);
  for (const day of DAYS) {
    const today = base.plans[day];
    if (today === undefined) throw new Error(`search: no plan for day ${day}`);
    for (const bookings of BOOKINGS) {
      if (bookings === today.bookings) continue;
      const plans = base.plans.map((p, i) => (i === day ? { ...p, bookings } : p));
      d.push(run({ stage: 'D', plans, patternName: `${base.patternName}|${bookings}@${day}`, patterns: base.patterns }));
    }
    for (const rate of RATES) {
      if (rate === today.rate) continue;
      const plans = base.plans.map((p, i) => (i === day ? { ...p, rate } : p));
      d.push(run({ stage: 'D', plans, patternName: `${base.patternName}|${rate}@${day}`, patterns: base.patterns }));
    }
  }
  for (const day of DAYS) {
    const pattern = base.patterns[day];
    if (pattern === undefined) throw new Error(`search: no pattern for day ${day}`);
    for (const block of BLOCKS) {
      for (const activity of FLOOR_ACTIVITIES) {
        if (activity === pattern[block]) continue;
        const changed: FloorPattern = [
          block === 0 ? activity : pattern[0],
          block === 1 ? activity : pattern[1],
          block === 2 ? activity : pattern[2],
        ];
        const patterns = base.patterns.map((p, i) => (i === day ? changed : p));
        e.push(run({ stage: 'E', plans: base.plans, patternName: `${base.patternName}|${activity}@${day}.${block + 1}`, patterns }));
      }
    }
  }

  return [...a, ...b, ...c, ...d, ...e].sort((x, y) => y.meanReward - x.meanReward);
}

/** Re-runs one candidate on a fresh seed batch so a margin can be checked out of sample. */
export function scorePolicy(
  candidate: Candidate,
  config: WorldConfig,
  spec: RewardSpec,
  episodes: number,
  seed: number,
): PolicyScore {
  checkArgs(episodes, seed);
  return score(candidate, config, spec, seedBatch(episodes, seed));
}
