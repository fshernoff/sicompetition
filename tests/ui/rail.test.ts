// The yard's rail (G5d, D59; Astra's plan review, finding 12 and the sick counts' scopes): a pure function of one
// ReplayFrame, in business words, with every count's scope said ("this week", "this block").
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { carefulPolicy, recklessCoveredPolicy, recklessPolicy } from '../../src/sim/policies.ts';
import { railModel } from '../../src/ui/rail.ts';
import { planWords, replayFrame } from '../../src/ui/replay.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import type { EpisodeTrace } from '../../src/world/types.ts';
import { config, round1 } from '../helpers.ts';
import { STUDENT_BANS } from './bans.ts';

const covered = runEpisode(config, round1, recklessCoveredPolicy, episodeSeeds(1, 0));
const literal = runEpisode(config, round1, recklessPolicy, episodeSeeds(1, 0)); // closes on Thursday
const careful = runEpisode(config, round1, carefulPolicy, episodeSeeds(1, 0));
const TRACES: readonly [string, EpisodeTrace][] = [['covered', covered], ['literal', literal], ['careful', careful]];

const frame = (trace: EpisodeTrace, t: number) => replayFrame(trace.steps, t, config);
const rail = (trace: EpisodeTrace, t: number) => railModel(frame(trace, t), config);

describe('railModel: the yard in words', () => {
  it('says when, what the floor runs and what the GM chose, as the frame and planWords say them', () => {
    const r = rail(covered, 9);
    expect(r.when).toBe('Wednesday · late morning');
    expect(r.activity).toBe(frame(covered, 9).activityWords);
    expect(r.choices).toBe(planWords(frame(covered, 9)));
    expect([r.day, r.block]).toEqual([2, 1]);
  });

  it('puts dogs per staffer on the floor against the legal limit from the config', () => {
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        const r = rail(trace, t);
        expect(r.perStaffer.limit).toBe(config.bookings.legalRatio);
        expect(r.perStaffer.dogs).toBe(f.floorDogs);
        expect(r.perStaffer.staff).toBe(f.floorStaff);
        expect(r.perStaffer.now).toBe(Math.round(f.ratio));
        expect(r.perStaffer.over).toBe(f.ratio > config.bookings.legalRatio);
      }
    }
  });

  it('counts incidents and sick dogs in two scopes, this week and this block, from the frame', () => {
    let sawSick = false;
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        const r = rail(trace, t);
        expect(r.incidents.week).toBe(f.incidentsSoFar);
        expect(r.incidents.thisBlock).toBe(f.events.filter((e) => e.type === 'incident').length);
        expect(r.sick.week).toBe(f.sickSoFar);
        const sickNow = f.events.filter((e) => e.type === 'illness').reduce((n, e) => n + (e.amount ?? 0), 0);
        expect(r.sick.thisBlock).toBe(sickNow);
        expect(r.sick.thisBlock).toBeLessThanOrEqual(r.sick.week);
        if (sickNow > 0) sawSick = true;
      }
    }
    expect(sawSick).toBe(true); // the fixtures include a block with dogs sent home sick
  });

  it('writes cash as the report writes dollars and says the reputation change since Monday in words', () => {
    const start = config.reputation.weekStart;
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        const r = rail(trace, t);
        expect(r.cash.start).toBe('$2,000');
        expect(r.cash.now).toMatch(/^−?\$\d{1,3}(,\d{3})*$/);
        expect(r.reputation.now).toBe(Math.round(f.reputation));
        const change = Math.round(f.reputation) - start;
        expect(r.reputation.change).toBe(change < 0 ? `Down ${-change} this week` : change > 0 ? `Up ${change} this week` : 'No change this week');
      }
    }
  });

  it('keeps the meters, tomorrow, the solo days and the captions as the frame has them', () => {
    const f = frame(covered, 9);
    const r = rail(covered, 9);
    expect([r.energy, r.cleanliness, r.fatigue]).toEqual([Math.round(f.energy), Math.round(f.cleanliness), Math.round(f.fatigue)]);
    expect([r.tomorrow, r.soloDays]).toEqual([f.requestsTomorrow, f.soloStreak]);
    expect(r.captions).toEqual(f.captions);
  });

  it('on a closed day shows nobody on the floor and nothing over the limit', () => {
    const closed = Array.from({ length: 20 }, (_, t) => t).filter((t) => frame(literal, t).closed);
    expect(closed.length).toBeGreaterThan(0);
    for (const t of closed) {
      const r = rail(literal, t);
      expect(r.closed).toBe(true);
      expect(r.perStaffer.now).toBe(0);
      expect(r.perStaffer.over).toBe(false);
    }
  });

  it('uses no word a student never reads, in any block of any fixture week', () => {
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const text = JSON.stringify(rail(trace, t));
        for (const word of STUDENT_BANS) expect(text, `${String(word)} at t=${t}`).not.toMatch(word);
      }
    }
  });
});
