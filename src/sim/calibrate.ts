// Prints the Round 1 calibration (plan acceptance 3) as a table: `npm run calibrate -- [--episodes N] [--seed S]`.
// The ranking is the same restricted-policy search the test runs; this is for reading the margins, not asserting them.
import process from 'node:process';
import { loadDefaultConfig, loadPreset } from '../world/config.ts';
import { evaluateStationaryPolicies, scorePolicy } from './search.ts';
import type { PolicyScore } from './search.ts';

const args = process.argv.slice(2);
const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const raw = args[i + 1];
  if (raw === undefined || !/^\d+$/.test(raw)) {
    process.stderr.write(`calibrate: ${name} needs a non-negative integer, got ${raw ?? 'nothing'}\n`);
    process.exit(2);
  }
  return Number(raw);
};
const episodes = flag('--episodes', 100);
const seed = flag('--seed', 1);
if (episodes < 1 || seed > 4294967295) {
  process.stderr.write('calibrate: --episodes must be 1 or more and --seed at most 4294967295\n');
  process.exit(2);
}
const config = loadDefaultConfig();
const spec = loadPreset('round1').spec;

const scores = evaluateStationaryPolicies(config, spec, episodes, seed);
const best = scores[0]!;
const napsOrCleans = (s: PolicyScore) => s.patterns.some((p) => p.some((a) => a === 'nap' || a === 'clean'));
const describe = (s: PolicyScore): string => {
  const bookings = [...new Set(s.plans.map((p) => p.bookings))].join('/');
  const rates = [...new Set(s.plans.map((p) => p.rate))].join('/');
  const staff = s.plans.map((d) => d.staff).join('');
  return `${s.stage} ${bookings} ${rates} staff ${staff} ${s.patternName}`;
};
const row = (rank: number, s: PolicyScore): string =>
  `${String(rank).padStart(3)}  ${describe(s).padEnd(62)} profit ${s.meanProfit.toFixed(1).padStart(8)} ±${s.stdProfit.toFixed(0).padStart(4)}  incidents ${s.meanIncidents.toFixed(2)}  solo ${s.daysOneStaffer.toFixed(1)} closed ${s.daysClosed.toFixed(2)} acceptAll ${s.daysAcceptedAll.toFixed(1)}`;

console.log(`Round 1 calibration: ${scores.length} candidates × ${episodes} episodes, seed ${seed}\n`);
scores.slice(0, 10).forEach((s, i) => console.log(row(i + 1, s)));
const stage = (st: PolicyScore['stage']) => scores.filter((s) => s.stage === st);
const comparators: [string, PolicyScore | undefined][] = [
  ['best nap-or-clean anywhere', scores.find(napsOrCleans)],
  ['best one-day nap (C)', stage('C').find((s) => s.patternName.includes('+napAfternoon@'))],
  ['best one-day clean (C)', stage('C').find((s) => s.patternName.includes('+cleanAtPickup@'))],
  ['best single nap block (E)', stage('E').find((s) => s.patternName.includes('|nap@'))],
  ['best single clean block (E)', stage('E').find((s) => s.patternName.includes('|clean@'))],
  ['best one-day cheaper rate (D)', stage('D').find((s) => s.plans.some((p) => p.rate !== 'premium'))],
  ['best one-day fewer bookings (D)', stage('D').find((s) => s.plans.some((p) => p.bookings !== 'all'))],
  ['best 2 staff every day (A)', stage('A').find((s) => s.plans.every((p) => p.staff === 2))],
  ['best 3 staff every day (A)', stage('A').find((s) => s.plans.every((p) => p.staff === 3))],
  ['best legal every day (A)', stage('A').find((s) => s.plans.every((p) => p.bookings === 'legal'))],
  ['best standard every day (A)', stage('A').find((s) => s.plans.every((p) => p.rate === 'standard'))],
];
console.log('\nComparators (margin = best − candidate, mean weekly profit):');
for (const [label, s] of comparators) {
  if (!s) continue;
  const rank = scores.indexOf(s) + 1;
  console.log(`  ${label.padEnd(32)} rank ${String(rank).padStart(3)}  margin ${(best.meanProfit - s.meanProfit).toFixed(1).padStart(7)}  ${describe(s)}`);
}
const nc = scores.find(napsOrCleans)!;
const rd = stage('D').find((s) => s.plans.some((p) => p.rate !== 'premium'))!;
const b2 = scorePolicy(best, config, spec, episodes, seed + 1);
const n2 = scorePolicy(nc, config, spec, episodes, seed + 1);
const r2 = scorePolicy(rd, config, spec, episodes, seed + 1);
console.log(`\nOut of sample (seed ${seed + 1}): best ${b2.meanProfit.toFixed(1)}; nap-or-clean margin ${(b2.meanProfit - n2.meanProfit).toFixed(1)}; cheaper-rate margin ${(b2.meanProfit - r2.meanProfit).toFixed(1)}`);
