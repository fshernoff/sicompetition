// BRIEF sections 2 and 10: 20 steps, and a readout whose totals add up.
import { describe, expect, it } from 'vitest';
import { runEpisode, summarize } from '../../src/sim/episode.ts';
import { carefulPolicy, randomPolicy, recklessCoveredPolicy, recklessPolicy, stationaryPolicy } from '../../src/sim/policies.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import { initialState, legalActions } from '../../src/world/step.ts';
import { KPI_KEYS } from '../../src/world/types.ts';
import type { Policy } from '../../src/world/types.ts';
import { config, floorState, makeState, round1, withConfig } from '../helpers.ts';

describe('episode shape', () => {
  it('offers 27 plans at drop-off, 5 activities on the floor, nothing when done', () => {
    expect(legalActions(initialState(config)).length).toBe(27);
    expect(legalActions(floorState()).length).toBe(5);
    expect(legalActions(makeState({ done: true })).length).toBe(0);
  });

  it('runs exactly 20 steps, day and block in order, done after the last', () => {
    const trace = runEpisode(config, round1, randomPolicy, episodeSeeds(1, 0));
    expect(trace.steps.length).toBe(20);
    trace.steps.forEach((s, i) => {
      expect(s.state.day).toBe(Math.floor(i / 4));
      expect(s.state.block).toBe(i % 4);
      expect(s.state.done).toBe(false);
    });
    const last = trace.steps[19]!.result;
    expect(last.state.done).toBe(true);
    expect(last.state.day).toBe(5);
    expect(last.state.block).toBe(0);
    expect(last.pickup).toBeDefined();
    expect(trace.steps[18]?.result.state.done).toBe(false);
    expect(trace.steps[18]?.result.pickup).toBeUndefined();
  });

  it('calls the policy exactly 20 times, never on a done state', () => {
    let calls = 0;
    const counting: Policy = (state, legal, rng) => {
      calls += 1;
      expect(state.done).toBe(false);
      return randomPolicy(state, legal, rng);
    };
    runEpisode(config, round1, counting, episodeSeeds(1, 0));
    expect(calls).toBe(20);
  });

  it('a pickup snapshot is taken after the block and before overnight recovery', () => {
    const trace = runEpisode(config, round1, recklessPolicy, episodeSeeds(1, 0));
    const monday = trace.steps[3]!.result;
    expect(monday.pickup).toBeDefined();
    expect(monday.pickup!.energy).toBe(100); // 40 +20 +20 +20 +20 clamped, before the reset to 40
    expect(monday.state.energy).toBe(40);
    expect(monday.pickup!.cleanliness + config.cleanliness.overnight).toBeCloseTo(monday.state.cleanliness, 6);
    expect(Math.max(0, monday.pickup!.fatigue - config.fatigue.overnightRecovery)).toBeCloseTo(monday.state.fatigue, 6);
  });

  it('builds a five-day readout whose money adds up', () => {
    for (const policy of [randomPolicy, recklessPolicy, recklessCoveredPolicy, carefulPolicy]) {
      const { report, steps } = runEpisode(config, round1, policy, episodeSeeds(3, 0));
      expect(report.days.length).toBe(5);
      for (const d of report.days) {
        expect(d.activities.length).toBe(4);
        expect(d.requested.length).toBe(4);
        expect(d.requested[0]).toBeNull();
        expect(d.dayRateRevenue + d.addOnRevenue - d.wages - d.refunds - d.vetCost - d.fineCost - d.suppliesCost).toBeCloseTo(d.profit, 6);
      }
      const t = report.totals;
      expect(t.profit).toBeCloseTo(report.days.reduce((a, d) => a + d.profit, 0), 6);
      expect(t.revenue).toBeCloseTo(report.days.reduce((a, d) => a + d.dayRateRevenue + d.addOnRevenue, 0), 6);
      expect(t.supplies).toBeCloseTo(report.days.reduce((a, d) => a + d.suppliesCost, 0), 6);
      expect(t.wages).toBeCloseTo(report.days.reduce((a, d) => a + d.wages, 0), 6);
      expect(t.dogsServed).toBe(report.days.reduce((a, d) => a + d.accepted, 0));
      expect(t.incidents).toBe(report.days.reduce((a, d) => a + d.incidents, 0));
      expect(t.cashEnd).toBeCloseTo(config.cash.weekStart + t.profit, 6);
      for (const k of KPI_KEYS) expect(t.kpi[k]).toBeCloseTo(steps.reduce((a, s) => a + s.result.deltas[k], 0), 6);
      expect(t.kpi.profit).toBeCloseTo(t.profit, 6);
      expect(t.kpi.incidents).toBe(t.incidents);
      expect(t.kpi.dogsServed).toBe(t.dogsServed);
      expect(t.kpi.overRatio).toBe(t.blocksOverRatio);
      expect(t.kpi.fatigue).toBe(t.blocksFatigueOver70);
      expect(t.kpi.reputation).toBe(t.reputationChange);
      for (const s of steps) {
        const m = s.result.money;
        expect(m.dayRateRevenue + m.addOnRevenue - m.wages - m.refunds - m.vetCost - m.fineCost - m.supplies).toBeCloseTo(s.result.deltas.profit, 6);
      }
      expect(t.reputationChange).toBe(t.reputationEnd - t.reputationStart);
      expect(t.reward).toBeCloseTo(steps.reduce((a, s) => a + s.reward, 0), 6);
      expect(t.freePlayBlocks + t.structuredPlayBlocks + t.napBlocks + t.walkBlocks + t.cleanBlocks + 4 * t.daysClosed).toBe(20);
    }
  });

  it('the reckless week is the one the brief describes, and its Thursday closure reads as closed', () => {
    const { report } = runEpisode(config, round1, recklessPolicy, episodeSeeds(1, 0));
    expect(report.totals.daysAcceptedAll).toBe(5 - report.totals.daysClosed);
    expect(report.totals.napBlocks).toBe(0);
    expect(report.totals.cleanBlocks).toBe(0);
    expect(report.totals.daysOneStaffer).toBe(4);
    expect(report.totals.daysClosed).toBe(1);
    const thu = report.days[3]!;
    expect(thu.closed).toBe(true);
    expect(thu.calledOut).toBe(true);
    expect(thu.accepted).toBe(0);
    expect(thu.wages).toBe(0);
    expect(thu.dayRateRevenue + thu.addOnRevenue).toBe(0);
    expect(thu.activities).toEqual([null, null, null, null]);
    expect(thu.floorStaff).toBe(0);
    expect(thu.scheduledStaff).toBe(1);
  });

  it('the covered reckless week has help on Thursday and no closure', () => {
    const { report } = runEpisode(config, round1, recklessCoveredPolicy, episodeSeeds(1, 0));
    expect(report.totals.daysClosed).toBe(0);
    expect(report.totals.daysOneStaffer).toBe(4);
    expect(report.totals.daysAcceptedAll).toBe(5);
    const thu = report.days[3]!;
    expect(thu.scheduledStaff).toBe(2);
    expect(thu.floorStaff).toBe(2);
    expect(thu.wages).toBe(600);
    expect(thu.closed).toBe(false);
  });

  it('the careful week naps and cleans every open day', () => {
    const { report } = runEpisode(config, round1, carefulPolicy, episodeSeeds(1, 0));
    expect(report.totals.napBlocks).toBe(5);
    expect(report.totals.cleanBlocks).toBe(5);
    expect(report.totals.supplies).toBe(1250);
    expect(report.totals.daysClosed).toBe(0);
  });

  it('averages dogs per staffer over blocks that have dogs on the floor', () => {
    // 6 dogs, 2 staffers, walks all day: drop-off runs 3 per staffer, the walks empty the floor
    const six = withConfig((c) => { c.requests.day1 = 6; });
    const { report } = runEpisode(six, round1, stationaryPolicy({ bookings: 'all', rate: 'standard', staff: 2 }, ['walk', 'walk', 'walk']), episodeSeeds(1, 0));
    expect(report.days[0]!.avgRatio).toBe(3);
    expect(report.totals.walkBlocks).toBe(15);
  });

  it('summarizes means over episodes', () => {
    const a = runEpisode(config, round1, randomPolicy, episodeSeeds(1, 0)).report;
    const b = runEpisode(config, round1, randomPolicy, episodeSeeds(1, 1)).report;
    const s = summarize([a, b]);
    expect(s.episodes).toBe(2);
    expect(s.mean.profit).toBeCloseTo((a.totals.profit + b.totals.profit) / 2, 6);
    expect(s.min.profit).toBe(Math.min(a.totals.profit, b.totals.profit));
    expect(s.max.incidents).toBe(Math.max(a.totals.incidents, b.totals.incidents));
  });
});
