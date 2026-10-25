// The 20-seed pilot harness (G2 plan, acceptance 2, and the tuning instrument of D31). Node only:
//   node src/learn/pilot.ts [--seeds N] [--budget MS] [--max-episodes N] [--no-stop]
//                           [--epsilon-end E] [--decay N] [--alpha-min A] [--init V] [--stable-evals N] [--eval-every N]
// For seed s in 1..N it trains the Round 1 bonus plan until done or the budget, checks target met (BRIEF section 13:
// stable and the Round 1 class on the fixed week and weeks 1..5), prints one row per seed and a summary line.
// Exit 0 when every seed met the target, 1 otherwise, 2 on bad arguments.
import process from 'node:process';
import { loadDefaultConfig, loadPreset } from '../world/config.ts';
import { isRound1Outcome } from '../sim/readout.ts';
import { DEFAULT_LEARNER, Trainer } from './train.ts';
import type { LearnerConfig } from './train.ts';

const USAGE = `Usage: node src/learn/pilot.ts [options]

Trains the Round 1 GM from seeds 1..N and prints, per seed, the episodes, the training seconds, stable and target met.

Options:
  --seeds N          how many seeds, 1..N (default 20)
  --budget MS        training time per seed in milliseconds (default 60000)
  --max-episodes N   the learner's episode cap (default ${DEFAULT_LEARNER.maxEpisodes})
  --no-stop          never stop on stability: train to the budget or the cap and report when the Round 1 class
                     first appeared on the fixed week (tuning protocol step 1)
  --epsilon-end E    the exploration floor (default ${DEFAULT_LEARNER.epsilonEnd})
  --decay N          episodes over which exploration falls to its floor (default ${DEFAULT_LEARNER.epsilonDecayEpisodes})
  --alpha-min A      the floor of the step size, max(A, 1/n) (default ${DEFAULT_LEARNER.alphaMin})
  --init V           every Q-table cell's starting value (default 0)
  --stable-evals N   identical evaluations that make the GM stable (default ${DEFAULT_LEARNER.stableEvals})
  --eval-every N     episodes between evaluations (default ${DEFAULT_LEARNER.evalEvery})
  --help             show this text
`;

class UsageError extends Error {}

interface Options {
  seeds: number;
  budget: number;
  noStop: boolean;
  init: number;
  learner: Partial<LearnerConfig>;
}

const NO_STOP_EVALS = Number.MAX_SAFE_INTEGER;

function positiveInteger(flag: string, value: string): number {
  const n = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(n) || n < 1) throw new UsageError(`${flag} must be an integer of 1 or more, got ${value}`);
  return n;
}

function finiteNumber(flag: string, value: string, min: number, max: number): number {
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n) || n < min || n > max) throw new UsageError(`${flag} must be a number from ${min} to ${max}, got ${value}`);
  return n;
}

function parse(argv: readonly string[]): Options | null {
  const o: Options = { seeds: 20, budget: 60000, noStop: false, init: 0, learner: {} };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] as string;
    if (flag === '--help' || flag === '-h') return null;
    if (flag === '--no-stop') {
      o.noStop = true;
      continue;
    }
    if (!['--seeds', '--budget', '--max-episodes', '--epsilon-end', '--decay', '--alpha-min', '--init', '--stable-evals', '--eval-every'].includes(flag)) {
      throw new UsageError(`unknown argument ${flag} (try --help)`);
    }
    const value = argv[++i];
    if (value === undefined) throw new UsageError(`${flag} needs a value`);
    if (flag === '--seeds') o.seeds = positiveInteger(flag, value);
    else if (flag === '--budget') o.budget = finiteNumber(flag, value, 1, Number.MAX_SAFE_INTEGER);
    else if (flag === '--max-episodes') o.learner.maxEpisodes = positiveInteger(flag, value);
    else if (flag === '--epsilon-end') o.learner.epsilonEnd = finiteNumber(flag, value, 0, 1);
    else if (flag === '--decay') o.learner.epsilonDecayEpisodes = positiveInteger(flag, value);
    else if (flag === '--alpha-min') o.learner.alphaMin = finiteNumber(flag, value, Number.MIN_VALUE, 1);
    else if (flag === '--stable-evals') o.learner.stableEvals = positiveInteger(flag, value);
    else if (flag === '--eval-every') o.learner.evalEvery = positiveInteger(flag, value);
    else o.init = finiteNumber(flag, value, -1e6, 1e6);
  }
  if (o.noStop) o.learner.stableEvals = NO_STOP_EVALS;
  return o;
}

const yesNo = (b: boolean): string => (b ? 'yes' : 'no ');
const pad = (x: number | string, width: number): string => String(x).padStart(width);

interface SeedResult {
  targetMet: boolean;
}

function runSeed(seed: number, o: Options): SeedResult {
  const world = loadDefaultConfig();
  const spec = loadPreset('round1').spec;
  const t = new Trainer(world, spec, seed, o.learner);
  // An optimistic start (tuning protocol step 2): fill every cell before the first episode.
  if (o.init !== 0) {
    for (let obs = 0; obs < t.q.observations; obs++) for (let a = 0; a < t.q.maxActions; a++) t.q.set(obs, a, o.init);
  }
  const s = t.runFor(o.budget);
  // Section 13: the Round 1 class on the fixed week and on weeks 1..5 (120 checks over 20 seeds).
  let classHolds = isRound1Outcome(t.evaluate());
  for (let k = 1; k <= 5 && classHolds; k++) classHolds = isRound1Outcome(t.evaluateOn(k));
  // Target met counts only inside the budget: a last slice that crossed it is a miss (Astra, G2 review).
  const targetMet = s.stable && classHolds && s.elapsedMs <= o.budget;
  let row = `seed ${pad(seed, 2)}  episodes ${pad(s.episodes, 6)}  seconds ${pad((s.elapsedMs / 1000).toFixed(1), 5)}  stable ${yesNo(s.stable)}  target ${yesNo(targetMet)}`;
  if (o.noStop) {
    // Tuning protocol step 1: the first evaluation with the Round 1 class on the fixed week, and the evaluation from
    // which it held to the end (none if the last evaluation is not in the class).
    const evals = t.evals();
    const first = evals.find((e) => isRound1Outcome(e.report));
    let holdsFrom: number | null = null;
    for (let j = evals.length - 1; j >= 0 && isRound1Outcome((evals[j] as (typeof evals)[number]).report); j--) holdsFrom = (evals[j] as (typeof evals)[number]).episode;
    row += `  class6 ${yesNo(classHolds)}  first R1 eval ${pad(first?.episode ?? '-', 6)}  holds from ${pad(holdsFrom ?? '-', 6)}`;
  }
  process.stdout.write(`${row.trimEnd()}\n`);
  return { targetMet };
}

function main(argv: readonly string[]): number {
  const o = parse(argv);
  if (o === null) {
    process.stdout.write(USAGE);
    return 0;
  }
  const settings = { ...DEFAULT_LEARNER, ...o.learner };
  const stop = o.noStop ? 'off' : `${settings.stableEvals} evaluations`;
  process.stdout.write(
    `Round 1 pilot: seeds 1..${o.seeds}, budget ${o.budget} ms, alpha min ${settings.alphaMin}, epsilon ${settings.epsilonStart} -> ${settings.epsilonEnd} over ${settings.epsilonDecayEpisodes}, max ${settings.maxEpisodes} episodes, Q init ${o.init}, early stop ${stop}\n`,
  );
  let met = 0;
  for (let seed = 1; seed <= o.seeds; seed++) if (runSeed(seed, o).targetMet) met += 1;
  process.stdout.write(`${met} of ${o.seeds} seeds target met\n`);
  return met === o.seeds ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`pilot: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
