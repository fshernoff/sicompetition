// Loads and validates the world config and the reward presets.
import configJson from './config.default.json' with { type: 'json' };
import presetsJson from './presets.json' with { type: 'json' };
import type { RewardSpec, WorldConfig } from './types.ts';
import { KPI_KEYS } from './types.ts';

// Leaf kinds: str = string, num = finite, prob = [0, 1], nonneg = finite and >= 0.
type Leaf = 'str' | 'num' | 'prob' | 'nonneg';
interface Schema {
  [key: string]: Leaf | Schema;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function perKey<T extends string>(keys: readonly T[], leaf: Leaf): Schema {
  return Object.fromEntries(keys.map((k) => [k, leaf]));
}
const RATE_KEYS = ['low', 'standard', 'premium'] as const;
const ACTIVITY_KEYS = ['freePlay', 'structuredPlay', 'nap', 'walk', 'clean'] as const;

const range = (): Schema => ({ min: 'num', max: 'num' });

const CONFIG_SCHEMA: Schema = {
  name: 'str',
  days: 'num',
  blocksPerDay: 'num',
  requests: {
    day1: 'nonneg',
    base: 'nonneg',
    max: 'nonneg',
    reputationSlope: 'num',
    rateEffect: perKey(RATE_KEYS, 'num'),
    noise: 'nonneg',
  },
  rates: perKey(RATE_KEYS, 'nonneg'),
  addOnPerDogPerPlayBlock: 'nonneg',
  wagePerStaffDay: 'nonneg',
  bookings: { legalRatio: 'nonneg', safeRatio: 'nonneg' },
  incident: {
    baseBelowSafe: 'prob',
    slopeSafeToLegal: 'num',
    slopeAboveLegal: 'num',
    cap: 'prob',
    energyFactorBase: 'num',
    refund: 'nonneg',
    vetChance: 'prob',
    vetCost: 'nonneg',
    reputationHit: 'num',
  },
  activityIncidentMultiplier: perKey(ACTIVITY_KEYS, 'prob'),
  energy: { dayStart: 'num', ...range(), delta: perKey(ACTIVITY_KEYS, 'num') },
  cleanliness: {
    weekStart: 'num',
    ...range(),
    perDogPlayBlock: 'num',
    perDogNapBlock: 'num',
    cleanBlock: 'num',
    overnight: 'num',
    suppliesCost: 'nonneg',
  },
  illness: { threshold: 'num', maxRate: 'prob', reputationHit: 'num', requestHit: 'num' },
  inspector: { chancePerOverBlock: 'prob', fine: 'nonneg', reputationHit: 'num' },
  fatigue: {
    weekStart: 'num',
    ...range(),
    perBlockBase: 'num',
    perBlockPerDogOverFloor: 'num',
    ratioFloor: 'num',
    overnightRecovery: 'num',
    kpiThreshold: 'num',
  },
  callOut: { soloDaysBeforeCallOut: 'nonneg', closureReputationHit: 'num' },
  walk: { groupSize: 'nonneg', reputationGain: 'num', minStaff: 'nonneg' },
  structuredPlayMaxRatio: 'num',
  reputation: { weekStart: 'num', ...range() },
  cash: { weekStart: 'num' },
};

function fail(prefix: string, path: string, why: string): never {
  throw new Error(`${prefix}: ${path === '' ? '(root)' : path}: ${why}`);
}

function checkAgainst(prefix: string, schema: Schema, value: unknown, path: string): void {
  if (!isRecord(value)) fail(prefix, path, 'expected an object');
  const obj = value as Record<string, unknown>;
  const join = (k: string): string => (path === '' ? k : `${path}.${k}`);
  for (const key of Object.keys(schema)) {
    if (!(key in obj)) fail(prefix, join(key), 'missing');
  }
  for (const key of Object.keys(obj)) {
    if (!(key in schema)) fail(prefix, join(key), 'unknown key');
  }
  for (const [key, rule] of Object.entries(schema)) {
    const v = obj[key];
    const p = join(key);
    if (typeof rule !== 'string') {
      checkAgainst(prefix, rule, v, p);
    } else if (rule === 'str') {
      if (typeof v !== 'string') fail(prefix, p, 'expected a string');
    } else {
      if (typeof v !== 'number' || !Number.isFinite(v)) fail(prefix, p, 'expected a finite number');
      if (rule === 'prob' && (v < 0 || v > 1)) fail(prefix, p, 'must be between 0 and 1');
      if (rule === 'nonneg' && v < 0) fail(prefix, p, 'must be 0 or more');
    }
  }
}

/**
 * Throws `Error('config: <path>: <why>')` naming the first bad key. Rules: every key of WorldConfig present with
 * its type, no unknown keys at any level, every number finite; probabilities (incident.baseBelowSafe, cap,
 * vetChance, inspector.chancePerOverBlock, illness.maxRate, every activityIncidentMultiplier) in [0, 1]; counts and
 * dollars (requests.* except rateEffect, which is signed; rates.*, wages, refund, vetCost, fine, suppliesCost,
 * groupSize, minStaff, soloDaysBeforeCallOut) ≥ 0;
 * days must be 5 and blocksPerDay 4 (the week is fixed); min ≤ weekStart/dayStart ≤ max for energy, cleanliness,
 * fatigue, reputation; requests.*, walk.groupSize, walk.minStaff and soloDaysBeforeCallOut are integers;
 * requests.day1 ≤ requests.max; walk.minStaff ≥ 2; soloDaysBeforeCallOut ≥ 1; energy.max and illness.threshold
 * positive (divisors); bookings.safeRatio ≤ legalRatio. No defaults are filled in.
 */
export function validateConfig(json: unknown): WorldConfig {
  checkAgainst('config', CONFIG_SCHEMA, json, '');
  const c = structuredClone(json) as WorldConfig;
  if (c.days !== 5) fail('config', 'days', 'must be 5');
  if (c.blocksPerDay !== 4) fail('config', 'blocksPerDay', 'must be 4');
  const integer = (path: string, v: number): void => {
    if (!Number.isInteger(v)) fail('config', path, 'must be an integer');
  };
  integer('requests.day1', c.requests.day1);
  integer('requests.base', c.requests.base);
  integer('requests.max', c.requests.max);
  integer('requests.noise', c.requests.noise);
  integer('walk.groupSize', c.walk.groupSize);
  integer('walk.minStaff', c.walk.minStaff);
  integer('callOut.soloDaysBeforeCallOut', c.callOut.soloDaysBeforeCallOut);
  if (c.requests.day1 > c.requests.max) fail('config', 'requests.day1', 'must not exceed requests.max');
  if (c.walk.minStaff < 2) fail('config', 'walk.minStaff', 'must be at least 2 (a walk leaves someone on the floor)');
  if (c.callOut.soloDaysBeforeCallOut < 1) fail('config', 'callOut.soloDaysBeforeCallOut', 'must be at least 1');
  if (c.energy.max <= 0) fail('config', 'energy.max', 'must be positive (it divides the energy factor)');
  if (c.illness.threshold <= 0) fail('config', 'illness.threshold', 'must be positive (it divides the illness rate)');
  if (c.bookings.safeRatio > c.bookings.legalRatio) fail('config', 'bookings.safeRatio', 'must not exceed bookings.legalRatio');
  const bounded: [string, number, number, number][] = [
    ['energy.dayStart', c.energy.dayStart, c.energy.min, c.energy.max],
    ['cleanliness.weekStart', c.cleanliness.weekStart, c.cleanliness.min, c.cleanliness.max],
    ['fatigue.weekStart', c.fatigue.weekStart, c.fatigue.min, c.fatigue.max],
    ['reputation.weekStart', c.reputation.weekStart, c.reputation.min, c.reputation.max],
  ];
  for (const [path, v, lo, hi] of bounded) {
    if (lo > hi) fail('config', path.replace(/\.\w+$/, '.min'), 'must not exceed max');
    if (v < lo || v > hi) fail('config', path, `must be between min (${lo}) and max (${hi})`);
  }
  return c;
}

/**
 * Throws `Error('reward: <path>: <why>')`. Rules: version === 1; kpis has exactly the six KPI_KEYS; each has
 * `on` boolean and `weight` an integer in −10..+10 (a file with 12 is rejected here; rewardFor clamps only as a
 * defence). No unknown keys.
 */
export function validateRewardSpec(json: unknown): RewardSpec {
  if (!isRecord(json)) fail('reward', '', 'expected an object');
  for (const key of Object.keys(json)) {
    if (key !== 'version' && key !== 'kpis') fail('reward', key, 'unknown key');
  }
  if (json['version'] !== 1) fail('reward', 'version', 'must be 1');
  const kpis = json['kpis'];
  if (!isRecord(kpis)) fail('reward', 'kpis', 'expected an object');
  for (const key of KPI_KEYS) {
    if (!(key in kpis)) fail('reward', `kpis.${key}`, 'missing');
  }
  for (const key of Object.keys(kpis)) {
    if (!(KPI_KEYS as readonly string[]).includes(key)) fail('reward', `kpis.${key}`, 'unknown key');
  }
  for (const key of KPI_KEYS) {
    const k = kpis[key];
    const p = `kpis.${key}`;
    if (!isRecord(k)) fail('reward', p, 'expected an object');
    for (const f of Object.keys(k)) {
      if (f !== 'on' && f !== 'weight') fail('reward', `${p}.${f}`, 'unknown key');
    }
    if (typeof k['on'] !== 'boolean') fail('reward', `${p}.on`, 'expected true or false');
    const w = k['weight'];
    if (typeof w !== 'number' || !Number.isInteger(w)) fail('reward', `${p}.weight`, 'expected an integer');
    if (w < -10 || w > 10) fail('reward', `${p}.weight`, 'must be between -10 and 10');
  }
  return structuredClone(json) as unknown as RewardSpec;
}

export type PresetName = 'round1' | 'round2' | 'round3' | 'balanced';
export interface RewardPreset {
  name: PresetName;
  label: string;
  spec: RewardSpec;
  maxActive: number; // how many KPIs the editor lets students turn on
}

/**
 * Presets (src/world/presets.json, BRIEF section 8): round1 profit +10 only, maxActive 1; round2 the same weights,
 * maxActive 3; round3 the same weights, maxActive 6; balanced profit +10, incidents −5, overRatio −5, others off,
 * maxActive 6. Each preset's spec passes validateRewardSpec.
 */
export function loadPreset(name: PresetName): RewardPreset {
  const raw = (presetsJson as Record<string, { name: string; label: string; spec: unknown; maxActive: number } | undefined>)[name];
  if (raw === undefined) throw new Error(`reward: ${name}: unknown preset`);
  return { name, label: raw.label, spec: validateRewardSpec(raw.spec), maxActive: raw.maxActive };
}

export function loadDefaultConfig(): WorldConfig {
  return validateConfig(configJson);
}
