// Headless simulator CLI: `npm run sim -- --episodes N --seed S --reward <preset|file.json>`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { runEpisode, summarize } from './episode.ts';
import { POLICIES } from './policies.ts';
import type { PolicyName } from './policies.ts';
import { loadDefaultConfig, loadPreset, validateConfig, validateRewardSpec } from '../world/config.ts';
import type { PresetName } from '../world/config.ts';
import { episodeSeeds } from '../world/rng.ts';
import type { WeekReport } from '../world/types.ts';

const USAGE = `Usage: node src/sim/cli.ts [options]

Runs the daycare week many times under one bonus plan and one policy, and prints one JSON document.

Options:
  --episodes N     number of weeks to run, an integer of 1 or more (default 200)
  --seed S         base seed, an integer from 0 to 4294967295 (default 1)
  --reward R       round1 | round2 | round3 | balanced | path to a bonus plan JSON file (default round1)
  --policy P       random | reckless | recklessCovered | careful (default random)
  --config FILE    path to a world config JSON file (default: the built-in config)
  --help           show this text
`;

class UsageError extends Error {}

const PRESETS: readonly string[] = ['round1', 'round2', 'round3', 'balanced'];

function readJson(file: string, what: string): unknown {
  try {
    return JSON.parse(readFileSync(resolve(file), 'utf8'));
  } catch (e) {
    throw new UsageError(`${what}: cannot read ${file} as JSON (${e instanceof Error ? e.message : String(e)})`);
  }
}

function main(argv: string[]): void {
  let episodes = 200;
  let seed = 1;
  let reward = 'round1';
  let policy = 'random';
  let configFile: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] as string;
    if (flag === '--help' || flag === '-h') {
      process.stdout.write(USAGE);
      return;
    }
    if (!['--episodes', '--seed', '--reward', '--policy', '--config'].includes(flag)) {
      throw new UsageError(`unknown argument ${flag} (try --help)`);
    }
    const value = argv[++i];
    if (value === undefined) throw new UsageError(`${flag} needs a value`);
    if (flag === '--episodes') {
      if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
        throw new UsageError(`--episodes must be an integer of 1 or more, got ${value}`);
      }
      episodes = Number(value);
    } else if (flag === '--seed') {
      if (!/^\d+$/.test(value) || Number(value) > 4294967295) {
        throw new UsageError(`--seed must be an integer from 0 to 4294967295, got ${value}`);
      }
      seed = Number(value);
    } else if (flag === '--reward') reward = value;
    else if (flag === '--policy') policy = value;
    else configFile = value;
  }

  if (!Object.hasOwn(POLICIES, policy)) {
    throw new UsageError(`unknown policy ${policy} (one of ${Object.keys(POLICIES).join(', ')})`);
  }
  const config = configFile === null ? loadDefaultConfig() : validateConfig(readJson(configFile, 'config'));
  let spec;
  if (PRESETS.includes(reward)) spec = loadPreset(reward as PresetName).spec;
  else if (/\.json$/i.test(reward)) spec = validateRewardSpec(readJson(reward, 'reward'));
  else throw new UsageError(`unknown reward ${reward} (one of ${PRESETS.join(', ')}, or a path to a .json file)`);

  const chosen = POLICIES[policy as PolicyName];
  const reports: WeekReport[] = [];
  for (let i = 0; i < episodes; i++) {
    reports.push(runEpisode(config, spec, chosen, episodeSeeds(seed, i)).report);
  }
  const doc = { config, reward: spec, seed, episodes, policy, summary: summarize(reports), last: reports[reports.length - 1] };
  process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
}

try {
  main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`sim: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
}
