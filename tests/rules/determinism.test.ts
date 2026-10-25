// BRIEF section 9: seeds and determinism. DECISIONS D14.
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { randomPolicy, recklessPolicy } from '../../src/sim/policies.ts';
import { episodeSeeds, makeRng } from '../../src/world/rng.ts';
import { step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState, round1 } from '../helpers.ts';

describe('determinism', () => {
  it('a seed gives the same stream every time, and a different seed a different one', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const c = makeRng(43);
    const da = [a.next(), a.next(), a.next(), a.next(), a.next()];
    const db = [b.next(), b.next(), b.next(), b.next(), b.next()];
    const dc = [c.next(), c.next(), c.next(), c.next(), c.next()];
    expect(da).toEqual(db);
    expect(da).not.toEqual(dc);
    for (const v of da) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is mulberry32: the reference draws for seed 1 and seed 0', () => {
    const r1 = makeRng(1);
    expect([r1.next(), r1.next(), r1.next()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    const r0 = makeRng(0);
    expect([r0.next(), r0.next()]).toEqual([0.26642920868471265, 0.0003297457005828619]);
  });

  it('derives the reference episode seeds', () => {
    expect(episodeSeeds(1, 0)).toEqual({ world: 4243865792, policy: 3608504855 });
    expect(episodeSeeds(1, 1)).toEqual({ world: 4254168476, policy: 3817739047 });
    expect(episodeSeeds(2, 0)).toEqual({ world: 3196991580, policy: 2976790591 });
  });

  it('derives distinct world and policy seeds per episode, stably', () => {
    const s = episodeSeeds(1, 0);
    expect(s.world).not.toBe(s.policy);
    expect(episodeSeeds(1, 0)).toEqual(s);
    expect(episodeSeeds(1, 1)).not.toEqual(s);
    expect(episodeSeeds(2, 0)).not.toEqual(s);
  });

  it('the same seed and policy replay the same week exactly', () => {
    const seeds = episodeSeeds(7, 3);
    const a = runEpisode(config, round1, randomPolicy, seeds);
    const b = runEpisode(config, round1, randomPolicy, seeds);
    expect(a).toEqual(b);
  });

  it('the policy stream never touches the world: a policy that ignores it gets the same week for any policy seed', () => {
    const world = episodeSeeds(11, 0).world;
    const a = runEpisode(config, round1, recklessPolicy, { world, policy: 1 });
    const b = runEpisode(config, round1, recklessPolicy, { world, policy: 2 });
    expect(a.report.days).toEqual(b.report.days);
    expect(a.report.totals).toEqual(b.report.totals);
    expect(a.steps.map((s) => s.action)).toEqual(b.steps.map((s) => s.action));
  });

  it('different seeds give different weeks under the random policy', () => {
    const a = runEpisode(config, round1, randomPolicy, episodeSeeds(1, 0));
    const b = runEpisode(config, round1, randomPolicy, episodeSeeds(2, 0));
    expect(a.report.totals).not.toEqual(b.report.totals);
  });

  it('step never mutates the state it is given', () => {
    const before = floorState();
    const frozen = structuredClone(before);
    step(before, floorAction('freePlay'), config, constRng(0.0));
    expect(before).toEqual(frozen);
  });
});
