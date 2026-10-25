// The trainer: tabular Q-learning over the week, with a wall-clock budget. G2 plan, settings table; BRIEF section 13.
import type { Action, EpisodeSeeds, Policy, RewardSpec, Rng, State, WeekReport, WorldConfig } from '../world/types.ts';
import type { OutcomeClass } from '../sim/readout.ts';
import { isRound1Outcome, outcomeClass, outcomeKey } from '../sim/readout.ts';
import { runEpisode } from '../sim/episode.ts';
import { rewardFor } from '../world/reward.ts';
import { episodeSeeds, makeRng } from '../world/rng.ts';
import { initialState, legalActions, step } from '../world/step.ts';
import { isDecision, observe } from './observe.ts';
import { QTable, chooseAction } from './qlearn.ts';

export interface LearnerConfig {
  /**
   * The floor of the step size. The n-th update of a cell uses α_n = max(alphaMin, 1 / n): a sample average while the
   * cell is new, then a small constant weight on the latest week (D32).
   */
  alphaMin: number;
  epsilonStart: number;
  epsilonEnd: number;
  epsilonDecayEpisodes: number; // linear from start to end over this many episodes, then flat at end
  maxEpisodes: number;
  evalEvery: number; // episodes between greedy evaluations
  stableEvals: number; // consecutive evaluations with the same outcome key
  movingAverageWindow: number;
}

export const DEFAULT_LEARNER: LearnerConfig = {
  alphaMin: 0.05,
  epsilonStart: 1,
  epsilonEnd: 0.1,
  epsilonDecayEpisodes: 20000,
  maxEpisodes: 150000,
  evalEvery: 500,
  stableEvals: 5,
  movingAverageWindow: 100,
};

/**
 * Every scheduled evaluation runs on episodeSeeds(seed, EVAL_BASE_INDEX), both streams reset, so an unchanged table
 * evaluates identically twice (D30). evaluateOn(k) uses EVAL_BASE_INDEX + k for extra checks (k = 1..5 for target
 * met, up to 100 for held-out measurement). Never a training week.
 */
export const EVAL_BASE_INDEX = 1_000_000;

/** Section 13: target met checks the fixed week and evaluation weeks 1..5. */
const TARGET_EXTRA_WEEKS = 5;

/** The mean of the last `window` values pushed; the mean of what there is before the window fills. */
export class MovingAverage {
  readonly window: number;
  private readonly ring: Float64Array;
  private count = 0; // values pushed so far
  private sum = 0; // over the values in the ring

  constructor(window: number) {
    if (!Number.isInteger(window) || window < 1) throw new Error(`MovingAverage: window must be a positive integer, got ${window}`);
    this.window = window;
    this.ring = new Float64Array(window);
  }

  push(value: number): number {
    const slot = this.count % this.window;
    if (this.count >= this.window) this.sum -= this.ring[slot] as number;
    this.ring[slot] = value;
    this.sum += value;
    this.count += 1;
    return this.value;
  }

  get value(): number {
    const n = Math.min(this.count, this.window);
    return n === 0 ? 0 : this.sum / n;
  }
}

/** Picks the index of an action in `legal` for a decision state. The default is ε-greedy (chooseAction). */
export type Chooser = (state: State, obs: number, legal: readonly Action[], epsilon: number, rng: Rng) => number;

/**
 * One training episode of Q-learning against `q`, in place. World stream makeRng(seeds.world), policy stream
 * makeRng(seeds.policy). At each decision state: observe, choose with `choose`, step, reward. The update for a
 * decision (obs, a) is made when the next decision state is reached: target = the rewards accumulated since
 * (including any closed-day floor blocks, which are stepped with their first legal action and never observed or
 * updated) + q.maxValue(nextObs, nextLegal.length); at the end of the week the target is the accumulated reward
 * alone. Each update's step size is α = max(alphaMin, 1 / (q.visits(obs, a) + 1)), computed right before q.update
 * (D32): the n-th update of a cell is a sample average until 1 / n falls to alphaMin. Returns the episode's total
 * reward.
 */
export function trainEpisode(
  q: QTable,
  world: WorldConfig,
  spec: RewardSpec,
  seeds: EpisodeSeeds,
  epsilon: number,
  alphaMin: number,
  choose?: Chooser,
): number {
  const worldRng = makeRng(seeds.world);
  const policyRng = makeRng(seeds.policy);
  let state = initialState(world);
  let total = 0;
  // The decision waiting for its update: its observation, its action index, and the rewards since it was taken.
  let pendingObs = -1;
  let pendingAction = 0;
  let pendingReward = 0;
  while (!state.done) {
    const legal = legalActions(state);
    let action: Action;
    if (isDecision(state)) {
      const obs = observe(state, world);
      // γ = 1 (section 13): the pending decision's target is its folded reward plus this state's value.
      if (pendingObs >= 0) {
        const target = pendingReward + q.maxValue(obs, legal.length);
        q.update(pendingObs, pendingAction, target, stepSize(q, pendingObs, pendingAction, alphaMin));
      }
      const a = choose === undefined ? chooseAction(q, obs, legal.length, epsilon, policyRng) : choose(state, obs, legal, epsilon, policyRng);
      action = legal[a] as Action;
      pendingObs = obs;
      pendingAction = a;
      pendingReward = 0;
    } else {
      // A closed day's floor block (H7): not a decision, the action has no effect, its reward folds into drop-off.
      action = legal[0] as Action;
    }
    const result = step(state, action, world, worldRng);
    const r = rewardFor(result.deltas, spec);
    pendingReward += r;
    total += r;
    state = result.state;
  }
  // Terminal value 0: the last decision's target is its own accumulated reward.
  if (pendingObs >= 0) q.update(pendingObs, pendingAction, pendingReward, stepSize(q, pendingObs, pendingAction, alphaMin));
  return total;
}

/** D32: the step size of the next update of (obs, a), α_n = max(alphaMin, 1 / n) where n counts this update. */
function stepSize(q: QTable, obs: number, action: number, alphaMin: number): number {
  return Math.max(alphaMin, 1 / (q.visits(obs, action) + 1));
}

export interface CurvePoint {
  episode: number; // 1-based
  reward: number; // this episode's total reward under the bonus plan
  movingAverage: number; // over the last `movingAverageWindow` episodes including this one
}

export interface EvalPoint {
  episode: number; // episodes trained when the evaluation ran
  reward: number;
  outcome: OutcomeClass;
  key: string;
  report: WeekReport;
}

export interface TrainingSnapshot {
  episodes: number;
  epsilon: number; // for the next episode
  elapsedMs: number; // training time only, summed over runEpisodes/runFor calls
  lastReward: number;
  movingAverage: number;
  evaluations: number;
  lastEval: EvalPoint | null;
  stable: boolean; // ε at its floor and the last `stableEvals` outcome keys identical (D29)
  targetMet: boolean; // stable and isRound1Outcome on the fixed week and on evaluateOn(1..5); computed when stable
  done: boolean; // stable, or maxEpisodes reached
  reachedObservations: number;
}

/** The ε for episode `index` (0-based) under `config`. */
export function epsilonAt(index: number, config: LearnerConfig): number {
  if (index >= config.epsilonDecayEpisodes) return config.epsilonEnd;
  return config.epsilonStart + ((config.epsilonEnd - config.epsilonStart) * index) / config.epsilonDecayEpisodes;
}

const now = (): number => globalThis.performance.now();

export class Trainer {
  readonly world: WorldConfig;
  readonly spec: RewardSpec;
  readonly seed: number;
  readonly config: LearnerConfig;
  readonly q: QTable;

  private episodes = 0;
  private elapsedMs = 0;
  private lastReward = 0;
  private readonly average: MovingAverage;
  private readonly points: CurvePoint[] = [];
  /** Every evaluation in order: the untrained GM at construction (episode 0), then evalEvery, 2 × evalEvery, ... */
  private readonly scheduled: EvalPoint[] = [];
  private stable = false;
  private targetMet = false;
  private done = false;
  private readonly chooser: Chooser;

  constructor(world: WorldConfig, spec: RewardSpec, seed: number, learner: Partial<LearnerConfig> = {}) {
    this.world = world;
    this.spec = spec;
    this.seed = seed;
    this.config = { ...DEFAULT_LEARNER, ...learner };
    this.q = new QTable();
    this.average = new MovingAverage(this.config.movingAverageWindow);
    // One chooser for the whole run, so an episode allocates no closure (ε-greedy over this table).
    this.chooser = (_state, obs, legal, epsilon, rng) => chooseAction(this.q, obs, legal.length, epsilon, rng);
    this.scheduled.push(this.evalPoint()); // the untrained GM, episode 0
    this.done = this.config.maxEpisodes <= 0;
  }

  /**
   * Trains up to `n` more episodes with trainEpisode, stopping early when done. Episode i (0-based over the whole
   * run, whatever the call boundaries) uses episodeSeeds(seed, i) and epsilonAt(i). Every `evalEvery` episodes,
   * evaluate() runs, the curve gets an EvalPoint, and stable / targetMet / done are recomputed.
   */
  runEpisodes(n: number): TrainingSnapshot {
    const start = now();
    for (let i = 0; i < n && !this.done; i++) this.trainOne();
    this.elapsedMs += now() - start;
    return this.snapshot();
  }

  /** Trains episodes until at least `budgetMs` of training time has elapsed in this call, or done. */
  runFor(budgetMs: number): TrainingSnapshot {
    const start = now();
    let t = start;
    while (!this.done && t - start < budgetMs) {
      this.trainOne();
      t = now();
    }
    this.elapsedMs += t - start;
    return this.snapshot();
  }

  snapshot(): TrainingSnapshot {
    const lastEval = this.lastEval();
    return {
      episodes: this.episodes,
      epsilon: epsilonAt(this.episodes, this.config),
      elapsedMs: this.elapsedMs,
      lastReward: this.lastReward,
      movingAverage: this.average.value,
      evaluations: this.scheduled.length,
      lastEval,
      stable: this.stable,
      targetMet: this.targetMet,
      done: this.done,
      reachedObservations: this.q.reachedObservations(),
    };
  }

  curve(): readonly CurvePoint[] {
    return this.points;
  }

  /** Every evaluation in order: the untrained GM at episode 0, then one every evalEvery episodes. */
  evals(): readonly EvalPoint[] {
    return this.scheduled;
  }

  /** Greedy over the table; ties broken by the rng the runner passes (the policy stream). */
  greedyPolicy(): Policy {
    const q = this.q;
    const world = this.world;
    return (state, legal, rng) => {
      // A closed day's floor block: nothing to decide, the action has no effect.
      if (!isDecision(state)) return legal[0] as Action;
      return legal[q.best(observe(state, world), legal.length, rng)] as Action;
    };
  }

  /** The greedy GM on the fixed evaluation week (index EVAL_BASE_INDEX, both streams reset). */
  evaluate(): WeekReport {
    return this.evaluateOn(0);
  }

  /** The greedy GM on evaluation week k (index EVAL_BASE_INDEX + k). */
  evaluateOn(k: number): WeekReport {
    return runEpisode(this.world, this.spec, this.greedyPolicy(), episodeSeeds(this.seed, EVAL_BASE_INDEX + k)).report;
  }

  private lastEval(): EvalPoint {
    return this.scheduled[this.scheduled.length - 1] as EvalPoint; // never empty: episode 0 is evaluated at construction
  }

  private evalPoint(): EvalPoint {
    const report = this.evaluate();
    return { episode: this.episodes, reward: report.totals.reward, outcome: outcomeClass(report), key: outcomeKey(report), report };
  }

  /** One training episode, its curve point, and the scheduled evaluation when one falls due. */
  private trainOne(): void {
    const i = this.episodes;
    const reward = trainEpisode(this.q, this.world, this.spec, episodeSeeds(this.seed, i), epsilonAt(i, this.config), this.config.alphaMin, this.chooser);
    this.episodes = i + 1;
    this.lastReward = reward;
    this.points.push({ episode: this.episodes, reward, movingAverage: this.average.push(reward) });
    if (this.episodes % this.config.evalEvery === 0) {
      this.scheduled.push(this.evalPoint());
      this.stable = this.isStable();
      // Target met is only asked of a stable GM (section 13); the five extra weeks cost five more greedy runs.
      this.targetMet = this.stable && this.meetsTarget();
    }
    this.done = this.stable || this.episodes >= this.config.maxEpisodes;
  }

  /**
   * Stable (D29, section 13): exploration has reached its floor (ε for the next episode is epsilonEnd) and the last
   * `stableEvals` evaluations, all taken since ε reached its floor, have the same outcome key.
   */
  private isStable(): boolean {
    const { stableEvals, epsilonDecayEpisodes } = this.config;
    if (this.episodes < epsilonDecayEpisodes) return false;
    const n = this.scheduled.length;
    if (n < stableEvals) return false;
    const first = this.scheduled[n - stableEvals] as EvalPoint;
    if (first.episode < epsilonDecayEpisodes) return false;
    for (let j = n - stableEvals + 1; j < n; j++) {
      if ((this.scheduled[j] as EvalPoint).key !== first.key) return false;
    }
    return true;
  }

  /** The Round 1 class (section 7) on the fixed week and on evaluation weeks 1..5. */
  private meetsTarget(): boolean {
    if (!isRound1Outcome(this.lastEval().report)) return false;
    for (let k = 1; k <= TARGET_EXTRA_WEEKS; k++) {
      if (!isRound1Outcome(this.evaluateOn(k))) return false;
    }
    return true;
  }
}
