// The week replay's frames and clock: pure functions from the 20 StepRecords of one greedy week (G4 plan, "What a
// frame shows for step t"; BRIEF section 10.2) and from the elapsed time. The drawing itself is reviewed by eye and
// covered by the e2e.
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { carefulPolicy, recklessCoveredPolicy, recklessPolicy, stationaryPolicy } from '../../src/sim/policies.ts';
import { HOLD_MS, STEP_MS, planWords, replayClock, replayFrame } from '../../src/ui/replay.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import type { EpisodeTrace } from '../../src/world/types.ts';
import { config, round1, withConfig } from '../helpers.ts';

const covered = runEpisode(config, round1, recklessCoveredPolicy, episodeSeeds(1, 0));
const literal = runEpisode(config, round1, recklessPolicy, episodeSeeds(1, 0)); // closes on Thursday
const careful = runEpisode(config, round1, carefulPolicy, episodeSeeds(1, 0));
const walkers = runEpisode(config, round1, stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 2 }, ['walk', 'walk', 'walk']), episodeSeeds(1, 0));
const soloWalk = runEpisode(config, round1, stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 1 }, ['walk', 'structuredPlay', 'nap']), episodeSeeds(1, 0));

const at = (trace: EpisodeTrace, t: number) => trace.steps[t]!;
const frame = (trace: EpisodeTrace, t: number) => replayFrame(trace.steps, t, config);

describe('replayClock', () => {
  it('plays 20 blocks of STEP_MS and holds HOLD_MS on the last', () => {
    expect(STEP_MS).toBe(300);
    expect(HOLD_MS).toBe(1500);
    expect(replayClock(0)).toEqual({ step: 0, progress: 0, done: false });
    expect(replayClock(STEP_MS * 5 + STEP_MS / 2)).toEqual({ step: 5, progress: 0.5, done: false });
    expect(replayClock(STEP_MS * 19)).toEqual({ step: 19, progress: 0, done: false });
    expect(replayClock(STEP_MS * 20)).toEqual({ step: 19, progress: 1, done: false }); // holding on Friday's pickup
    expect(replayClock(STEP_MS * 20 + HOLD_MS - 1)).toEqual({ step: 19, progress: 1, done: false });
    expect(replayClock(STEP_MS * 20 + HOLD_MS)).toEqual({ step: 19, progress: 1, done: true });
    expect(replayClock(1e9)).toEqual({ step: 19, progress: 1, done: true });
    expect(replayClock(-50)).toEqual({ step: 0, progress: 0, done: false });
  });

  it('takes other step and hold lengths', () => {
    expect(replayClock(1000, 100, 50)).toEqual({ step: 10, progress: 0, done: false });
    expect(replayClock(2049, 100, 50)).toEqual({ step: 19, progress: 1, done: false });
    expect(replayClock(2050, 100, 50)).toEqual({ step: 19, progress: 1, done: true });
  });
});

describe('replayFrame: the floor during block t', () => {
  it("shows the day's arrivals at drop-off from the step's result", () => {
    const f = frame(covered, 0);
    const step = at(covered, 0);
    expect(f).toMatchObject({ day: 0, block: 0, dayName: 'Monday', blockName: 'drop-off', closed: false, calledOut: false });
    expect(f.activity).toBe('freePlay');
    expect(f.requested).toBeNull();
    expect(f.activityWords).toBe('free play');
    expect(f).toMatchObject({ dogs: 20, staff: 1, scheduledStaff: 1, walkingDogs: 0, walkingStaff: 0, floorDogs: 20, floorStaff: 1, ratio: 20 });
    expect(f).toMatchObject({ rate: 'premium', bookings: 'all', requests: 20, accepted: 20, soloStreak: 0 });
    expect(f.requestsTomorrow).toBe(step.result.state.requestsTomorrow); // the projection after the block
    expect(f.energy).toBe(step.result.state.energy); // 60: after the arrivals' free play
    expect(f.cleanliness).toBe(step.result.state.cleanliness);
    expect(f.fatigue).toBe(step.result.state.fatigue);
    expect(f.reputation).toBe(step.result.state.reputation);
    expect(f.cash).toBe(step.result.state.cash);
    expect(f.incidentsSoFar).toBe(1);
    expect(f.dogsServedSoFar).toBe(20);
    expect(f.events).toEqual(step.result.events);
    expect(f.captions).toEqual(['Incident', 'Vet bill $150']);
  });

  it("carries the day's floor through the late morning and the afternoon", () => {
    const morning = frame(covered, 1);
    expect(morning).toMatchObject({ day: 0, block: 1, blockName: 'late morning', dogs: 20, staff: 1, floorDogs: 20, floorStaff: 1, ratio: 20, activity: 'freePlay', requested: 'freePlay' });
    expect(morning).toMatchObject({ rate: 'premium', bookings: 'all', requests: 20, accepted: 20, scheduledStaff: 1 });
    expect(morning.energy).toBe(at(covered, 1).result.state.energy);
    expect(morning.cleanliness).toBe(at(covered, 1).result.state.cleanliness);
    expect(morning.fatigue).toBe(at(covered, 1).result.state.fatigue);
    expect(morning.requestsTomorrow).toBe(at(covered, 1).result.state.requestsTomorrow);
    expect(morning.incidentsSoFar).toBe(2);
    expect(frame(covered, 2).blockName).toBe('afternoon');
    expect(frame(covered, 2).dogs).toBe(20);
  });

  it('uses the pickup snapshot at pickup, not the next morning', () => {
    const f = frame(covered, 3);
    const step = at(covered, 3);
    expect(f).toMatchObject({ day: 0, block: 3, blockName: 'pickup', dogs: 20, staff: 1, rate: 'premium', requests: 20, accepted: 20 });
    expect(f.energy).toBe(step.result.pickup?.energy); // 100, not the reset 40
    expect(f.cleanliness).toBe(step.result.pickup?.cleanliness); // before the night's +10
    expect(f.fatigue).toBe(step.result.pickup?.fatigue); // before the night's −15
    expect(f.energy).not.toBe(step.result.state.energy);
    expect(f.cleanliness).not.toBe(step.result.state.cleanliness);
    expect(f.reputation).toBe(step.result.state.reputation); // 42, applied in the step and not reset
    expect(f.cash).toBe(step.result.state.cash); // 3130
    expect(f.requestsTomorrow).toBe(step.result.state.requestsToday); // the final figure, promoted
    expect(f.requestsTomorrow).toBe(covered.report.days[1]?.requests);
    expect(f.sickSoFar).toBe(0);
    expect(f.captions).toEqual(['Incident']);
  });

  it('names the days and counts the week to its end', () => {
    expect(frame(covered, 4).dayName).toBe('Tuesday');
    expect(frame(covered, 8).dayName).toBe('Wednesday');
    expect(frame(covered, 12).dayName).toBe('Thursday');
    expect(frame(covered, 16).dayName).toBe('Friday');
    expect(frame(covered, 4).captions).toEqual(['Inspector: $250 fine']);
    expect(frame(covered, 4).finesSoFar).toBe(1);
    expect(frame(covered, 7).captions).toEqual(['Incident', '1 dog sick at pickup']); // G5d: illness is found at pickup
    expect(frame(covered, 7).sickSoFar).toBe(1);
    expect(frame(covered, 11).captions).toEqual(['Incident', '2 dogs sick at pickup']);
    expect(frame(covered, 12)).toMatchObject({ staff: 2, scheduledStaff: 2, soloStreak: 3 }); // Thursday's help after three solo days
    expect(frame(covered, 13).ratio).toBe(8);
    expect(frame(covered, 16).soloStreak).toBe(0); // the help day reset it
    const last = frame(covered, 19);
    const totals = covered.report.totals;
    expect(last).toMatchObject({ day: 4, block: 3, dayName: 'Friday', blockName: 'pickup' });
    expect(last.incidentsSoFar).toBe(totals.incidents);
    expect(last.finesSoFar).toBe(totals.fines);
    expect(last.sickSoFar).toBe(totals.illnessCases);
    expect(last.dogsServedSoFar).toBe(totals.dogsServed);
    expect(last.cash).toBe(totals.cashEnd);
    expect(last.reputation).toBe(totals.reputationEnd);
  });

  it('shows the walking group off the floor and the gauge after it has left', () => {
    const f = frame(walkers, 1);
    expect(f).toMatchObject({ activity: 'walk', requested: 'walk', activityWords: 'walk', dogs: 20, staff: 2, walkingDogs: 6, walkingStaff: 1, floorDogs: 14, floorStaff: 1 });
    expect(f.ratio).toBe(14);
    expect(f.ratio).toBe(at(walkers, 1).result.floorRatio);
    expect(f.captions).toEqual(['Incident', 'Walk photo posted']);
    expect(frame(walkers, 2).captions).toEqual(['Walk photo posted']);
    expect(frame(walkers, 3)).toMatchObject({ activity: 'walk', walkingDogs: 6, floorDogs: 14, floorStaff: 1 }); // a walk at pickup too
  });

  it('lets a walk take every dog off the floor', () => {
    const small = withConfig((c) => {
      c.requests.day1 = 5;
    });
    const trace = runEpisode(small, round1, stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 2 }, ['walk', 'walk', 'walk']), episodeSeeds(1, 0));
    const f = replayFrame(trace.steps, 1, small);
    expect(f).toMatchObject({ dogs: 5, staff: 2, walkingDogs: 5, walkingStaff: 1, floorDogs: 0, floorStaff: 1, ratio: 0 });
    expect(f.captions).toEqual(['Walk photo posted']);
  });

  it('names a fallback in the header, not in a caption', () => {
    const walk = frame(soloWalk, 1);
    expect(walk).toMatchObject({ activity: 'freePlay', requested: 'walk', activityWords: 'free play (walk asked)', walkingDogs: 0, walkingStaff: 0, floorDogs: 20, floorStaff: 1, ratio: 20 });
    expect(walk.captions).toEqual(['Incident']); // the walkFellBack event gets no caption
    const cls = frame(soloWalk, 2);
    expect(cls).toMatchObject({ activity: 'freePlay', requested: 'structuredPlay', activityWords: 'free play (structured play asked)' });
    expect(cls.captions).toEqual(['Incident']);
    expect(frame(soloWalk, 3)).toMatchObject({ activity: 'nap', activityWords: 'nap' });
    expect(frame(careful, 1)).toMatchObject({ activity: 'structuredPlay', activityWords: 'structured play', ratio: 10 });
    expect(frame(careful, 3)).toMatchObject({ activity: 'clean', activityWords: 'clean' });
  });

  it('shows a closed day as an empty yard', () => {
    const dropOff = frame(literal, 12);
    expect(dropOff).toMatchObject({ day: 3, block: 0, dayName: 'Thursday', closed: true, calledOut: true, dogs: 0, staff: 0, scheduledStaff: 1, floorDogs: 0, floorStaff: 0, ratio: 0, activity: null, activityWords: 'closed' });
    expect(dropOff).toMatchObject({ requests: 16, accepted: 0, rate: null, bookings: null, soloStreak: 3 });
    expect(dropOff.captions).toEqual(['The staffer called out: closed today']);
    expect(dropOff.reputation).toBe(at(literal, 12).result.state.reputation);
    const noon = frame(literal, 13);
    expect(noon).toMatchObject({ closed: true, calledOut: true, dogs: 0, staff: 0, activity: null, requested: 'freePlay', activityWords: 'closed', walkingDogs: 0, rate: null });
    expect(noon.captions).toEqual([]);
    const pickup = frame(literal, 15);
    expect(pickup).toMatchObject({ closed: true, dogs: 0, activityWords: 'closed' });
    expect(pickup.energy).toBe(at(literal, 15).result.pickup?.energy);
    expect(pickup.cleanliness).toBe(at(literal, 15).result.pickup?.cleanliness);
    expect(pickup.requestsTomorrow).toBe(literal.report.days[4]?.requests);
    expect(frame(literal, 16)).toMatchObject({ closed: false, calledOut: false, dogs: 18, staff: 1, soloStreak: 0, rate: 'premium' });
    expect(frame(literal, 19).incidentsSoFar).toBe(literal.report.totals.incidents);
  });

  it("writes today's plan in business words, naming a cap only on a day it turned dogs away (G5d)", () => {
    expect(planWords(frame(covered, 0))).toBe('Today: 20 asked · all 20 accepted · premium rate · 1 staffer scheduled');
    expect(planWords(frame(covered, 13))).toBe('Today: 16 asked · all 16 accepted · premium rate · 2 staff scheduled');
    expect(planWords(frame(literal, 12))).toBe('Today: 16 asked · closed · 1 staffer scheduled, called out');
    expect(planWords({ ...frame(covered, 13), staff: 1 })).toBe('Today: 16 asked · all 16 accepted · premium rate · 2 staff scheduled, 1 called out');
    // the careful week caps at a safe ratio, but two staff hold every dog who asked: no cap is named
    const easy = frame(careful, 0);
    expect(easy.bookings).toBe('safe');
    expect(easy.accepted).toBe(easy.requests);
    expect(planWords(easy)).toBe(`Today: ${easy.requests} asked · all ${easy.requests} accepted · standard rate · 2 staff scheduled`);
    const safe = runEpisode(config, round1, stationaryPolicy({ bookings: 'safe', rate: 'low', staff: 1 }, ['freePlay', 'freePlay', 'freePlay']), episodeSeeds(1, 0));
    expect(planWords(replayFrame(safe.steps, 0, config))).toBe('Today: 20 asked · 10 accepted, capped at a safe ratio · low rate · 1 staffer scheduled');
    const legal = runEpisode(config, round1, stationaryPolicy({ bookings: 'legal', rate: 'standard', staff: 1 }, ['freePlay', 'freePlay', 'freePlay']), episodeSeeds(1, 0));
    expect(planWords(replayFrame(legal.steps, 0, config))).toBe('Today: 20 asked · 15 accepted, capped at the legal ratio · standard rate · 1 staffer scheduled');
    for (const t of [frame(covered, 0), frame(literal, 12)]) expect(planWords(t)).not.toMatch(/\d+ per staffer|per dog|injur|reward|episode/i);
  });

  it("carries the GM's bonus earned through this block, the plan's reward summed over steps 0..t (G5d)", () => {
    for (const trace of [covered, literal, careful]) {
      let sum = 0;
      for (let t = 0; t < 20; t++) {
        sum += trace.steps[t]?.reward ?? 0;
        expect(frame(trace, t).bonusSoFar).toBeCloseTo(sum, 9);
      }
      expect(frame(trace, 19).bonusSoFar).toBeCloseTo(trace.report.totals.reward, 9);
    }
  });

  it('refuses a step outside the week', () => {
    expect(() => replayFrame(covered.steps, -1, config)).toThrow();
    expect(() => replayFrame(covered.steps, 20, config)).toThrow();
    expect(() => replayFrame(covered.steps.slice(0, 19), 0, config)).toThrow();
  });

  it('uses business words only, and names events, never rules', () => {
    for (const trace of [covered, literal, careful, walkers, soloWalk]) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        const words = [f.dayName, f.blockName, f.activityWords, ...f.captions].join(' ');
        expect(words).not.toMatch(/injur|reward|episode|epsilon|ε|evaluation|stable|target/i);
        for (const caption of f.captions) expect(caption).not.toMatch(/needs|too many|\+3|reputation|instead/i);
      }
    }
  });
});
