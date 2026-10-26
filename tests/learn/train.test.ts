// The trainer: G2 plan, settings table; BRIEF section 13.
import { describe, expect, it } from 'vitest';
import { CLOSED_OBSERVATION, OBSERVATION_COUNT } from '../../src/learn/observe.ts';
import { MAX_ACTIONS, QTable } from '../../src/learn/qlearn.ts';
import { DEFAULT_LEARNER, EVAL_BASE_INDEX, MovingAverage, Trainer, epsilonAt, trainEpisode } from '../../src/learn/train.ts';
import type { Chooser } from '../../src/learn/train.ts';
import { runEpisode } from '../../src/sim/episode.ts';
import { recklessPolicy } from '../../src/sim/policies.ts';
import { isRound1Outcome, outcomeKey } from '../../src/sim/readout.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import type { WeekReport } from '../../src/world/types.ts';
import { loadPreset } from '../../src/world/config.ts';
import { config, round1, spec } from '../helpers.ts';

const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
const RECKLESS_PLAN_INDEX = 6; // (all, premium, 1) in BOOKINGS × RATES × STAFF_COUNTS order

describe('MovingAverage', () => {
  it('averages the last window values, and what there is before the window fills', () => {
    const m = new MovingAverage(2);
    expect(m.push(1)).toBe(1);
    expect(m.push(2)).toBe(1.5);
    expect(m.push(3)).toBe(2.5);
    expect(m.value).toBe(2.5);
  });
});

describe('epsilon schedule', () => {
  it('falls linearly from 1 to 0.1 over 20,000 episodes, then stays', () => {
    expect(epsilonAt(0, DEFAULT_LEARNER)).toBeCloseTo(1, 10);
    expect(epsilonAt(5000, DEFAULT_LEARNER)).toBeCloseTo(0.775, 10);
    expect(epsilonAt(20000, DEFAULT_LEARNER)).toBeCloseTo(0.1, 10);
    expect(epsilonAt(40000, DEFAULT_LEARNER)).toBeCloseTo(0.1, 10);
  });
});

describe('trainEpisode', () => {
  // A chooser that forces the literal reckless week (all, premium, 1 every day, free play) and records observations.
  const recorder = () => {
    const seen = new Map<string, number>();
    const choose: Chooser = (state, obs, _legal) => {
      seen.set(`${state.day}.${state.block}`, obs);
      return state.block === 0 ? RECKLESS_PLAN_INDEX : 0;
    };
    return { choose, seen };
  };
  const seeds = episodeSeeds(1, 0);

  it('folds a closed Thursday into the drop-off transition and never touches the sentinel', () => {
    const pass1 = recorder();
    trainEpisode(new QTable(), config, round1, seeds, 0, 0.1, pass1.choose);
    const thu = pass1.seen.get('3.0')!;
    const fri = pass1.seen.get('4.0')!;
    expect(pass1.seen.has('3.1')).toBe(false); // closed blocks are never observed
    const q = new QTable();
    for (let a = 0; a < MAX_ACTIONS; a++) {
      q.set(CLOSED_OBSERVATION, a, 999);
      q.set(fri, a, 100);
    }
    // Twenty earlier visits of the Thursday cell, so the step size is at its floor 0.1 (1/21 < 0.1), value still 0.
    for (let i = 0; i < 20; i++) q.update(thu, RECKLESS_PLAN_INDEX, 0, 1);
    const pass2 = recorder();
    trainEpisode(q, config, round1, seeds, 0, 0.1, pass2.choose);
    expect(pass2.seen.get('3.0')).toBe(thu);
    expect(q.get(thu, RECKLESS_PLAN_INDEX)).toBeCloseTo(10, 10); // 0.1 × (0 + 0 + 0 + 0 + 100)
    expect(q.visits(thu, RECKLESS_PLAN_INDEX)).toBe(21);
    for (let a = 0; a < MAX_ACTIONS; a++) {
      expect(q.get(CLOSED_OBSERVATION, a)).toBe(999);
      expect(q.visits(CLOSED_OBSERVATION, a)).toBe(0);
    }
  });

  it('uses the step reward alone as the terminal target, and a first visit is a sample average', () => {
    const q = new QTable();
    const pass = recorder();
    const total = trainEpisode(q, config, round1, seeds, 0, 0.05, pass.choose);
    const trace = runEpisode(config, round1, recklessPolicy, seeds);
    expect(total).toBeCloseTo(trace.report.totals.reward, 6);
    expect(q.get(pass.seen.get('4.3')!, 0)).toBeCloseTo(trace.steps[19]!.reward, 6); // α_1 = 1: the value is the target
    const fri = pass.seen.get('4.0')!;
    // One-step Q-learning, forward pass: Friday's drop-off cell is updated when block 1 is reached, whose cells are
    // still 0 in a fresh table, so its first value is the drop-off step's reward alone (α_1 = 1).
    expect(q.get(fri, RECKLESS_PLAN_INDEX)).toBeCloseTo(trace.steps[16]!.reward, 6);
  });
});

describe('Trainer', () => {
  it('is deterministic for a seed, whatever the call boundaries', () => {
    const a = new Trainer(config, round1, 1);
    const b = new Trainer(config, round1, 1);
    const sa = a.runEpisodes(10000);
    let sb = b.snapshot();
    for (let i = 0; i < 100; i++) sb = b.runEpisodes(100);
    expect(sa.episodes).toBe(10000);
    expect({ ...sa, elapsedMs: 0 }).toEqual({ ...sb, elapsedMs: 0 });
    expect(a.curve()).toEqual(b.curve());
    expect(a.evals().map((e) => [e.episode, e.key, e.reward])).toEqual(b.evals().map((e) => [e.episode, e.key, e.reward]));
    let visited = 0;
    for (let o = 0; o < OBSERVATION_COUNT; o++) {
      for (let x = 0; x < MAX_ACTIONS; x++) {
        if (a.q.get(o, x) !== b.q.get(o, x)) throw new Error(`table differs at ${o}, ${x}`);
        if (a.q.visits(o, x) !== b.q.visits(o, x)) throw new Error(`visits differ at ${o}, ${x}`);
        visited += a.q.visits(o, x);
      }
    }
    expect(visited).toBeGreaterThan(10000 * 15);
    expect(a.evaluate()).toEqual(b.evaluate());
  });

  it('never writes the closed observation', () => {
    const t = new Trainer(config, round1, 1);
    t.runEpisodes(2000);
    for (let x = 0; x < MAX_ACTIONS; x++) {
      expect(t.q.get(CLOSED_OBSERVATION, x)).toBe(0);
      expect(t.q.visits(CLOSED_OBSERVATION, x)).toBe(0);
    }
  });

  it('runFor trains for about the budget and keeps counting across calls', () => {
    // A configuration that cannot finish inside the two calls, so the budget accounting is what is measured.
    const t = new Trainer(config, round1, 2, { maxEpisodes: 1e9, stableEvals: 1e9 });
    const s1 = t.runFor(50);
    expect(s1.episodes).toBeGreaterThanOrEqual(1);
    expect(s1.elapsedMs).toBeGreaterThanOrEqual(50);
    expect(s1.elapsedMs).toBeLessThan(1000); // one episode past the budget, plus scheduler noise
    expect(s1.done).toBe(false);
    const s2 = t.runFor(50);
    expect(s2.episodes).toBeGreaterThan(s1.episodes);
    expect(s2.elapsedMs).toBeGreaterThan(s1.elapsedMs);
  });

  it('keeps a curve whose moving average matches the rewards and ends higher than it starts', () => {
    const t = new Trainer(config, round1, 1);
    t.runEpisodes(20000);
    const c = t.curve();
    expect(c.length).toBe(20000);
    expect(c[0]?.episode).toBe(1);
    expect(c[19999]?.episode).toBe(20000);
    expect(c[19999]!.movingAverage).toBeCloseTo(mean(c.slice(-100).map((p) => p.reward)), 6);
    expect(c[49]!.movingAverage).toBeCloseTo(mean(c.slice(0, 50).map((p) => p.reward)), 6);
    expect(mean(c.slice(-500).map((p) => p.reward))).toBeGreaterThan(mean(c.slice(0, 500).map((p) => p.reward)) + 150);
  });

  it('evaluates the greedy GM on the fixed week through the runner, identically every time', () => {
    const t = new Trainer(config, round1, 1);
    t.runEpisodes(1000);
    const direct = runEpisode(config, round1, t.greedyPolicy(), episodeSeeds(1, EVAL_BASE_INDEX)).report;
    expect(t.evaluate()).toEqual(direct);
    expect(t.evaluate()).toEqual(direct);
    expect(t.evaluateOn(0)).toEqual(direct);
    const other = runEpisode(config, round1, t.greedyPolicy(), episodeSeeds(1, EVAL_BASE_INDEX + 3)).report;
    expect(t.evaluateOn(3)).toEqual(other);
    expect(t.evals().length).toBe(3); // the untrained GM at episode 0, then 500 and 1000
    expect(t.evals()[0]?.episode).toBe(0);
    expect(t.evals()[2]?.episode).toBe(1000);
  });

  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: Round 1 trains to the reckless week, stays there, and beats its untrained self held out`, () => {
      const untrained = new Trainer(config, round1, seed);
      const before = Array.from({ length: 100 }, (_, k) => untrained.evaluateOn(k + 1).totals.reward);
      const t = new Trainer(config, round1, seed);
      const s = t.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
      expect(s.done).toBe(true);
      expect(s.stable).toBe(true);
      expect(s.targetMet).toBe(true);
      expect(s.episodes).toBeGreaterThanOrEqual(DEFAULT_LEARNER.epsilonDecayEpisodes + (DEFAULT_LEARNER.stableEvals - 1) * DEFAULT_LEARNER.evalEvery);
      expect(s.episodes).toBeLessThanOrEqual(40000); // the plan's documented bound for seeds 1 to 3; the cap is far above it
      expect(s.episodes % DEFAULT_LEARNER.evalEvery).toBe(0);
      expect(s.evaluations).toBe(s.episodes / DEFAULT_LEARNER.evalEvery + 1);
      expect(s.lastEval?.episode).toBe(s.episodes);
      expect(s.lastEval?.key).toBe(outcomeKey(s.lastEval!.report));
      expect(s.epsilon).toBeCloseTo(DEFAULT_LEARNER.epsilonEnd, 10);
      expect(s.reachedObservations).toBeGreaterThan(100);
      expect(s.reachedObservations).toBeLessThan(OBSERVATION_COUNT);
      const keys = t.evals().slice(-DEFAULT_LEARNER.stableEvals).map((e) => e.key);
      expect(new Set(keys).size).toBe(1);
      expect(isRound1Outcome(t.evaluate())).toBe(true);
      for (let k = 1; k <= 5; k++) expect(isRound1Outcome(t.evaluateOn(k))).toBe(true);
      const after = Array.from({ length: 100 }, (_, k) => t.evaluateOn(k + 1));
      expect(mean(after.map((r) => r.totals.reward))).toBeGreaterThan(mean(before) + 200);
      expect(after.filter(isRound1Outcome).length).toBeGreaterThanOrEqual(90);
    }, 180_000);
  }

  it('stops at maxEpisodes when asked for more', () => {
    const t = new Trainer(config, round1, 1, { maxEpisodes: 1000, evalEvery: 100, stableEvals: 100 });
    const s = t.runEpisodes(5000);
    expect(s.episodes).toBe(1000);
    expect(s.done).toBe(true);
    expect(s.stable).toBe(false);
    expect(s.targetMet).toBe(false);
    expect(t.runEpisodes(10).episodes).toBe(1000);
  });
});

// G3: the target class is the plan's, not the trainer's (D36). A plan without one is only ever "stable".
describe('Trainer target', () => {
  it('given null, reports no target and never target met, even when the week is the Round 1 class', () => {
    const t = new Trainer(config, round1, 1, {}, null);
    const s = t.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    expect(s.hasTarget).toBe(false);
    expect(s.stable).toBe(true);
    expect(s.done).toBe(true);
    expect(s.targetMet).toBe(false);
    expect(isRound1Outcome(t.evaluate())).toBe(true);
  }, 60_000);

  it('does not change what is learned: the curve and the evaluations match the Round 1 trainer', () => {
    const withTarget = new Trainer(config, round1, 2);
    const without = new Trainer(config, round1, 2, {}, null);
    const a = withTarget.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    const b = without.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    expect(a.hasTarget).toBe(true);
    expect(a.targetMet).toBe(true);
    expect(b.targetMet).toBe(false);
    expect(b.episodes).toBe(a.episodes);
    expect(without.curve()).toEqual(withTarget.curve());
    expect(without.evals().map((e) => e.key)).toEqual(withTarget.evals().map((e) => e.key));
  }, 60_000);

  it('asks a custom predicate about the fixed week and then weeks 1..5, once, when the GM first becomes stable', () => {
    // Full reports, not keys: all six weeks share the Round 1 key, so only the reports tell week 3 from week 0
    // (Astra, G3 diff review).
    const seen: WeekReport[] = [];
    const all = new Trainer(config, round1, 1, {}, (r) => {
      seen.push(r);
      return true;
    });
    const yes = all.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    expect(yes.hasTarget).toBe(true);
    expect(yes.stable).toBe(true);
    expect(yes.targetMet).toBe(true);
    expect(seen.length).toBe(6);
    expect(seen[0]).toEqual(all.evaluate());
    for (let k = 1; k <= 5; k++) expect(seen[k]).toEqual(all.evaluateOn(k));
    expect(new Set(seen.map((r) => JSON.stringify(r))).size).toBe(6); // six different weeks, not the fixed week six times
    // A predicate that accepts the fixed week but rejects week 3: not met, and stopping is unchanged.
    const asked: WeekReport[] = [];
    const third = new Trainer(config, round1, 1, {}, (r) => {
      asked.push(r);
      return asked.length !== 4;
    });
    const no = third.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    expect(no.stable).toBe(true);
    expect(no.targetMet).toBe(false);
    expect(no.episodes).toBe(yes.episodes);
    expect(asked.length).toBe(4); // stops asking at the first refusal
    expect(asked[3]).toEqual(third.evaluateOn(3)); // and the refused report was week 3's
    // A predicate that accepts a week the Round 1 class rejects, on a plan the Round 1 predicate would fail.
    const careful = new Trainer(config, loadPreset('balanced').spec, 1, {}, (r) => !isRound1Outcome(r));
    const other = careful.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    expect(other.hasTarget).toBe(true);
    expect(other.stable).toBe(true);
    expect(other.targetMet).toBe(true);
  }, 60_000);

  it('derives the default target from the plan', () => {
    const nudged = structuredClone(round1);
    nudged.kpis.incidents = { on: false, weight: -10 };
    expect(new Trainer(config, nudged, 1).snapshot().hasTarget).toBe(true);
    expect(new Trainer(config, round1, 1).snapshot().hasTarget).toBe(true);
    expect(new Trainer(config, spec({ profit: 3 }), 1).snapshot().hasTarget).toBe(true);
    expect(new Trainer(config, spec({ profit: 10, incidents: -5 }), 1).snapshot().hasTarget).toBe(false);
    expect(new Trainer(config, spec({ profit: -10 }), 1).snapshot().hasTarget).toBe(false);
    expect(new Trainer(config, spec({}), 1).snapshot().hasTarget).toBe(false);
  });

  it('trains an edited plan to a stable week with no target, and the all-off plan to a stable week paid nothing', () => {
    const balanced = new Trainer(config, loadPreset('balanced').spec, 1);
    const s = balanced.runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    expect(s.hasTarget).toBe(false);
    expect(s.stable).toBe(true);
    expect(s.done).toBe(true);
    expect(s.targetMet).toBe(false);
    expect(s.lastEval?.key).toBe(outcomeKey(balanced.evaluate()));
    const empty = new Trainer(config, spec({}), 1).runEpisodes(DEFAULT_LEARNER.maxEpisodes);
    expect(empty.stable).toBe(true);
    expect(empty.lastReward).toBe(0);
    expect(empty.movingAverage).toBe(0);
    expect(empty.lastEval?.reward).toBe(0);
  }, 60_000);
});
