// WP3: the config and reward validators and the presets (contract in src/world/config.ts).
import { describe, expect, it } from 'vitest';
import { loadDefaultConfig, loadPreset, validateConfig, validateRewardSpec } from '../../src/world/config.ts';
import { config, round1, withConfig } from '../helpers.ts';

describe('config validation', () => {
  it('accepts the default config unchanged', () => {
    expect(validateConfig(structuredClone(config))).toEqual(config);
    expect(loadDefaultConfig()).toEqual(config);
  });

  it('names the first bad key', () => {
    const unknown = { ...structuredClone(config), extra: 1 };
    expect(() => validateConfig(unknown)).toThrow(/config: extra/);
    const nested = structuredClone(config) as unknown as { incident: Record<string, unknown> };
    nested.incident['bogus'] = 2;
    expect(() => validateConfig(nested)).toThrow(/config: incident\.bogus/);
    expect(() => validateConfig(withConfig((c) => { c.incident.vetChance = 1.5; }))).toThrow(/config: incident\.vetChance/);
    expect(() => validateConfig(withConfig((c) => { c.days = 4; }))).toThrow(/config: days/);
    expect(() => validateConfig(withConfig((c) => { c.wagePerStaffDay = -1; }))).toThrow(/config: wagePerStaffDay/);
    expect(() => validateConfig(withConfig((c) => { c.energy.dayStart = 120; }))).toThrow(/config: energy\.dayStart/);
    const missing = structuredClone(config) as unknown as Record<string, unknown>;
    delete missing['walk'];
    expect(() => validateConfig(missing)).toThrow(/config: walk/);
    expect(() => validateConfig(withConfig((c) => { (c.rates as Record<string, unknown>)['premium'] = 'high'; }))).toThrow(/config: rates\.premium/);
    expect(() => validateConfig(null)).toThrow(/config/);
  });

  it('rejects values the arithmetic cannot take', () => {
    expect(() => validateConfig(withConfig((c) => { c.requests.noise = 0.5; }))).toThrow(/config: requests\.noise/);
    expect(() => validateConfig(withConfig((c) => { c.requests.day1 = 31; }))).toThrow(/config: requests\.day1/);
    expect(() => validateConfig(withConfig((c) => { c.walk.minStaff = 1; }))).toThrow(/config: walk\.minStaff/);
    expect(() => validateConfig(withConfig((c) => { c.walk.groupSize = 2.5; }))).toThrow(/config: walk\.groupSize/);
    expect(() => validateConfig(withConfig((c) => { c.energy.max = 0; c.energy.dayStart = 0; }))).toThrow(/config: energy\.max/);
    expect(() => validateConfig(withConfig((c) => { c.bookings.safeRatio = 16; }))).toThrow(/config: bookings\.safeRatio/);
    expect(() => validateConfig(withConfig((c) => { c.callOut.soloDaysBeforeCallOut = 0; }))).toThrow(/config: callOut\.soloDaysBeforeCallOut/);
  });
});

describe('reward validation', () => {
  it('accepts a well-formed spec', () => {
    expect(validateRewardSpec(structuredClone(round1))).toEqual(round1);
  });

  it('rejects the wrong version, a missing or extra KPI, a non-integer or out-of-range weight', () => {
    expect(() => validateRewardSpec({ ...structuredClone(round1), version: 2 })).toThrow(/reward: version/);
    const missing = structuredClone(round1) as unknown as { kpis: Record<string, unknown> };
    delete missing.kpis['fatigue'];
    expect(() => validateRewardSpec(missing)).toThrow(/reward: kpis\.fatigue/);
    const extra = structuredClone(round1) as unknown as { kpis: Record<string, unknown> };
    extra.kpis['tips'] = { on: true, weight: 1 };
    expect(() => validateRewardSpec(extra)).toThrow(/reward: kpis\.tips/);
    const big = structuredClone(round1);
    big.kpis.profit.weight = 12;
    expect(() => validateRewardSpec(big)).toThrow(/reward: kpis\.profit\.weight/);
    const frac = structuredClone(round1);
    frac.kpis.profit.weight = 2.5;
    expect(() => validateRewardSpec(frac)).toThrow(/reward: kpis\.profit\.weight/);
    const notBool = structuredClone(round1) as unknown as { kpis: { profit: { on: unknown } } };
    notBool.kpis.profit.on = 'yes';
    expect(() => validateRewardSpec(notBool)).toThrow(/reward: kpis\.profit\.on/);
  });
});

describe('presets', () => {
  const roundPreset = {
    version: 1,
    kpis: {
      profit: { on: true, weight: 10 },
      dogsServed: { on: false, weight: 5 },
      incidents: { on: false, weight: -5 },
      reputation: { on: false, weight: 5 },
      fatigue: { on: false, weight: -5 },
      overRatio: { on: false, weight: -5 },
    },
  };

  it('round1 is profit +10 on, the suggested weights off, one KPI allowed', () => {
    const p = loadPreset('round1');
    expect(p.spec).toEqual(roundPreset);
    expect(p.maxActive).toBe(1);
  });

  it('round2 and round3 start as round1 and allow 3 and 6', () => {
    expect(loadPreset('round2').spec).toEqual(roundPreset);
    expect(loadPreset('round2').maxActive).toBe(3);
    expect(loadPreset('round3').spec).toEqual(roundPreset);
    expect(loadPreset('round3').maxActive).toBe(6);
  });

  it('a preset scores the same as a plan with the off KPIs at 0', () => {
    expect(validateRewardSpec(roundPreset)).toEqual(roundPreset);
    expect(round1.kpis.profit).toEqual(roundPreset.kpis.profit);
  });

  it('balanced is profit +10, incidents −5, over-ratio −5', () => {
    const p = loadPreset('balanced');
    expect(p.spec.kpis.profit).toEqual({ on: true, weight: 10 });
    expect(p.spec.kpis.incidents).toEqual({ on: true, weight: -5 });
    expect(p.spec.kpis.overRatio).toEqual({ on: true, weight: -5 });
    expect(p.spec.kpis.dogsServed).toEqual({ on: false, weight: 5 });
    expect(p.spec.kpis.reputation).toEqual({ on: false, weight: 5 });
    expect(p.spec.kpis.fatigue).toEqual({ on: false, weight: -5 });
    expect(p.maxActive).toBe(6);
    expect(validateRewardSpec(p.spec)).toEqual(p.spec);
  });
});
