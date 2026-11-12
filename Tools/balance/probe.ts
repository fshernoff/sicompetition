// The balance probe (G11 WP3): trains each plan of the panel on the given seeds and prints, per plan and seed, one
// JSON line: stable, episodes, seconds, the outcome key, and the week's totals. Node only:
//   node Tools/balance/probe.ts [--seeds 1,2,3] [--budget 60000] [--plans P10,P10R5,...] [--set walk.reputationGain=2 ...]
// --set overrides one config number (dotted path) without validation, so a candidate can be measured before the
// bible and the schema carry it.
import process from 'node:process';
import { loadDefaultConfig } from '../../src/world/config.ts';
import { describeWeek, outcomeKey } from '../../src/sim/readout.ts';
import { Trainer } from '../../src/learn/train.ts';
import { KPI_KEYS } from '../../src/world/types.ts';
import type { KpiKey, RewardSpec, WorldConfig } from '../../src/world/types.ts';

const LETTER: Record<string, KpiKey> = { P: 'profit', D: 'dogsServed', I: 'incidents', R: 'reputation', F: 'fatigue', O: 'overRatio' };

/** "P10I-5O-5" -> a spec with those measures on at those weights, the rest off. */
function specOf(name: string): RewardSpec {
  const kpis = Object.fromEntries(KPI_KEYS.map((k) => [k, { on: false, weight: 0 }])) as RewardSpec['kpis'];
  for (const m of name.matchAll(/([PDIRFO])(-?\d+)/g)) kpis[LETTER[m[1] as string] as KpiKey] = { on: true, weight: Number(m[2]) };
  return { version: 1, kpis };
}

export const PANEL: readonly string[] = [
  'P10', 'P10I-5O-5', 'P10R2', 'P10R5', 'P10R10', 'P10I-10', 'P10I-10R5', 'P5I-10R10', 'P3I-10', 'P10I-5F-5O-5', 'P10D5R5',
  'P10D10I-10R10F-10O-10', 'P10D2I-8R6F-4O-6', 'D5', 'I-5', 'R5', 'F-5', 'O-5',
];

const args = process.argv.slice(2);
const opt = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i < 0 ? undefined : args[i + 1];
};
const seeds = (opt('--seeds') ?? '1,2,3').split(',').map(Number);
const budget = Number(opt('--budget') ?? 60000);
const plans = opt('--plans')?.split(',') ?? PANEL;
const sets: string[] = [];
args.forEach((a, i) => {
  if (a === '--set') sets.push(args[i + 1] as string);
});

function configured(): WorldConfig {
  const c = loadDefaultConfig() as unknown as Record<string, unknown>;
  for (const s of sets) {
    const [path, value] = s.split('=') as [string, string];
    const keys = path.split('.');
    let o = c;
    for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
    o[keys[keys.length - 1] as string] = Number(value);
  }
  return c as unknown as WorldConfig;
}

for (const plan of plans) {
  for (const seed of seeds) {
    const t = new Trainer(configured(), specOf(plan), seed);
    const s = t.runFor(budget);
    const week = t.evaluate();
    const x = week.totals;
    process.stdout.write(
      `${JSON.stringify({
        plan,
        seed,
        stable: s.stable && s.elapsedMs <= budget,
        episodes: s.episodes,
        seconds: Number((s.elapsedMs / 1000).toFixed(1)),
        profit: x.profit,
        incidents: x.incidents,
        rep: x.reputationChange,
        repEnd: x.reputationEnd,
        sick: x.illnessCases,
        over: x.blocksOverRatio,
        fatigue: x.blocksFatigueOver70,
        walk: x.walkBlocks,
        nap: x.napBlocks,
        clean: x.cleanBlocks,
        solo: x.daysOneStaffer,
        served: x.dogsServed,
        key: outcomeKey(week),
        sentence: describeWeek(week),
        sets,
      })}\n`,
    );
  }
}
