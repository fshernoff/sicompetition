// BRIEF section 7 (outcome classes) and section 10 (the sentence).
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { carefulPolicy, dayPlanPolicy, recklessCoveredPolicy, recklessPolicy, stationaryPolicy } from '../../src/sim/policies.ts';
import { describeWeek, isRound1Outcome, outcomeClass, outcomeKey, targetOutcome } from '../../src/sim/readout.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import type { DayPlan } from '../../src/world/types.ts';
import { loadPreset } from '../../src/world/config.ts';
import { config, round1, spec } from '../helpers.ts';

const covered = runEpisode(config, round1, recklessCoveredPolicy, episodeSeeds(1, 0)).report;
const literal = runEpisode(config, round1, recklessPolicy, episodeSeeds(1, 0)).report;
const careful = runEpisode(config, round1, carefulPolicy, episodeSeeds(1, 0)).report;
const R: DayPlan = { bookings: 'all', rate: 'premium', staff: 1 };
const free = ['freePlay', 'freePlay', 'freePlay'] as const;

describe('outcome class', () => {
  it('reads the covered reckless week as the Round 1 outcome', () => {
    expect(outcomeClass(covered)).toEqual({ daysAcceptedAll: 5, daysOneStaffer: 4, daysTwoStaffers: 1, daysThreeStaffers: 0, daysClosed: 0, napBlocks: 0, cleanBlocks: 0, walks: 'few', rateDays: { low: 0, standard: 0, premium: 5 } });
    expect(outcomeKey(covered)).toBe('acceptAll=5 staff1=4 staff2=1 staff3=0 closed=0 nap=0 clean=0 walks=few rates=premium×5');
    expect(isRound1Outcome(covered)).toBe(true);
  });

  it('accepts help on Tuesday or Wednesday too, with or without walks on the help day', () => {
    const tue = runEpisode(config, round1, dayPlanPolicy([R, { ...R, staff: 2 }, R, R, R], [free, ['walk', 'walk', 'walk'], free, free, free]), episodeSeeds(1, 0)).report;
    expect(isRound1Outcome(tue)).toBe(true);
    expect(outcomeClass(tue).walks).toBe('few');
    expect(outcomeKey(tue)).toBe(outcomeKey(covered)); // a walk on the help day is not a change of mind (D29)
    const wed = runEpisode(config, round1, dayPlanPolicy([R, R, { ...R, staff: 2 }, R, R], [free, free, free, free, free]), episodeSeeds(1, 0)).report;
    expect(isRound1Outcome(wed)).toBe(true);
  });

  it('rejects the closing week, a three-staffer help day, and the careful week', () => {
    expect(outcomeKey(literal)).toBe('acceptAll=4 staff1=4 staff2=0 staff3=0 closed=1 nap=0 clean=0 walks=few rates=premium×4');
    expect(isRound1Outcome(literal)).toBe(false);
    const three = runEpisode(config, round1, dayPlanPolicy([R, R, R, { ...R, staff: 3 }, R], [free, free, free, free, free]), episodeSeeds(1, 0)).report;
    expect(outcomeClass(three).daysThreeStaffers).toBe(1);
    expect(isRound1Outcome(three)).toBe(false);
    expect(outcomeKey(careful)).toBe('acceptAll=5 staff1=0 staff2=5 staff3=0 closed=0 nap=5 clean=5 walks=few rates=standard×5');
    expect(isRound1Outcome(careful)).toBe(false);
  });

  it('counts the days at each rate, so moving a cheap day is a change of mind', () => {
    const lowMon = runEpisode(config, round1, dayPlanPolicy([{ ...R, rate: 'low' }, { ...R, staff: 2 }, R, R, R], [free, free, free, free, free]), episodeSeeds(1, 0)).report;
    const lowFri = runEpisode(config, round1, dayPlanPolicy([R, { ...R, staff: 2 }, R, R, { ...R, rate: 'low' }], [free, free, free, free, free]), episodeSeeds(1, 0)).report;
    expect(outcomeClass(lowMon).rateDays).toEqual({ low: 1, standard: 0, premium: 4 });
    expect(outcomeKey(lowMon)).toMatch(/rates=low×1\/premium×4$/);
    expect(outcomeKey(lowMon)).toBe(outcomeKey(lowFri)); // which day is cheap is not in the class, how many are is
    expect(isRound1Outcome(lowMon)).toBe(false);
  });

  it('buckets walks: few (under 8) or most (8 or more)', () => {
    const walkers = runEpisode(config, round1, stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 2 }, ['walk', 'walk', 'walk']), episodeSeeds(1, 0)).report;
    expect(walkers.totals.walkBlocks).toBe(15);
    expect(outcomeClass(walkers).walks).toBe('most');
  });
});

describe('describeWeek', () => {
  it('renders the covered reckless week', () => {
    const t = covered.totals;
    expect(describeWeek(covered)).toBe(
      `The GM accepted every booking on 5 of 5 days, ran the floor with one staffer on 4 days, never had the dogs nap, averaged ${Math.round(t.avgDogsPerStaffer)} dogs per staffer, and had ${t.incidents} incidents.`,
    );
  });

  it('renders the careful week', () => {
    const t = careful.totals;
    const incidents = t.incidents === 0 ? 'no incidents' : t.incidents === 1 ? '1 incident' : `${t.incidents} incidents`;
    expect(describeWeek(careful)).toBe(
      `The GM accepted every booking on 5 of 5 days, never ran the floor with one staffer, had the dogs nap in 5 blocks, averaged ${Math.round(t.avgDogsPerStaffer)} dogs per staffer, and had ${incidents}.`,
    );
  });

  it('moves the closure into the last clause', () => {
    const t = literal.totals;
    const incidents = t.incidents === 1 ? '1 incident' : `${t.incidents} incidents`;
    expect(describeWeek(literal)).toBe(
      `The GM accepted every booking on 4 of 5 days, ran the floor with one staffer on 4 days, never had the dogs nap, averaged ${Math.round(t.avgDogsPerStaffer)} dogs per staffer, had ${incidents}, and was closed on 1 day.`,
    );
  });

  it('uses singulars for one and business words for none (G5d)', () => {
    const one = structuredClone(covered);
    one.totals.daysOneStaffer = 1;
    one.totals.napBlocks = 1;
    one.totals.incidents = 1;
    expect(describeWeek(one)).toMatch(/ran the floor with one staffer on 1 day, had the dogs nap in 1 block, averaged \d+ dogs per staffer, and had 1 incident\.$/);
    const none = structuredClone(covered);
    none.totals.incidents = 0;
    expect(describeWeek(none)).toMatch(/, and had no incidents\.$/);
    expect(describeWeek(none)).not.toMatch(/\b0 (times|days|blocks|incidents)\b|chose nap/);
    const two = structuredClone(literal);
    two.totals.daysClosed = 2;
    expect(describeWeek(two)).toMatch(/, and was closed on 2 days\.$/);
  });
});

describe('targetOutcome', () => {
  it('is the Round 1 class for Profit alone with a positive weight, whatever the off measures carry', () => {
    expect(targetOutcome(loadPreset('round1').spec)).toBe(isRound1Outcome);
    expect(targetOutcome(spec({ profit: 3 }))).toBe(isRound1Outcome);
    const nudged = structuredClone(loadPreset('round1').spec);
    nudged.kpis.incidents.weight = -10;
    expect(targetOutcome(nudged)).toBe(isRound1Outcome);
  });

  it('treats a measure that is on at weight 0 as off: Profit +10 with Incidents on at 0 is the Round 1 plan', () => {
    expect(targetOutcome(spec({ profit: 10, incidents: 0 }))).toBe(isRound1Outcome);
    expect(targetOutcome(spec({ profit: 1, dogsServed: 0, incidents: 0, reputation: 0, fatigue: 0, overRatio: 0 }))).toBe(isRound1Outcome);
    expect(targetOutcome(spec({ profit: 10, incidents: 0, overRatio: -1 }))).toBeNull();
  });

  it('is null for every other plan', () => {
    expect(targetOutcome(spec({ profit: 0 }))).toBeNull();
    expect(targetOutcome(spec({ profit: -10 }))).toBeNull();
    expect(targetOutcome(spec({ profit: 10, incidents: -5 }))).toBeNull();
    expect(targetOutcome(spec({ dogsServed: 5 }))).toBeNull();
    expect(targetOutcome(spec({}))).toBeNull();
    expect(targetOutcome(loadPreset('balanced').spec)).toBeNull();
  });
});
