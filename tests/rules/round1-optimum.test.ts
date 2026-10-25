// Plan acceptance 3: a restricted-policy calibration. Under Round 1 the best fixed policy is the reckless outcome
// class, judged on its own readouts, and every one-decision defection a learner could make (a nap or clean block, a
// cheaper rate or fewer bookings on one day) trails it, on the ranking batch and on a second seed batch. The learner
// in G2 is the real optimum check.
import { describe, expect, it } from 'vitest';
import { evaluateStationaryPolicies, scorePolicy } from '../../src/sim/search.ts';
import type { PolicyScore } from '../../src/sim/search.ts';
import { config, round1 } from '../helpers.ts';

const napsOrCleans = (s: PolicyScore) => s.patterns.some((p) => p.some((a) => a === 'nap' || a === 'clean'));
const cheaperRate = (s: PolicyScore) => s.plans.some((p) => p.rate !== 'premium');
const fewerBookings = (s: PolicyScore) => s.plans.some((p) => p.bookings !== 'all');

describe('Round 1 calibration', () => {
  const scores = evaluateStationaryPolicies(config, round1, 100, 1);
  const best = scores[0]!;
  const stage = (st: PolicyScore['stage']) => scores.filter((s) => s.stage === st);
  const bestNapOrClean = scores.find(napsOrCleans)!;
  const bestCheaperRate = stage('D').find(cheaperRate)!;

  it('evaluates 135 stationary, 150 staffing, 20 pattern, 20 plan and 60 activity candidates, best first', () => {
    expect(scores.length).toBe(385);
    expect(stage('A').length).toBe(135);
    expect(stage('B').length).toBe(150);
    expect(stage('C').length).toBe(20);
    expect(stage('D').length).toBe(20);
    expect(stage('E').length).toBe(60);
    for (let i = 1; i < scores.length; i++) expect(scores[i - 1]!.meanReward).toBeGreaterThanOrEqual(scores[i]!.meanReward);
    for (const s of scores) {
      expect(s.plans.length).toBe(5);
      expect(s.patterns.length).toBe(5);
      expect(Number.isFinite(s.stdProfit)).toBe(true);
    }
  });

  it('the best policy is the Round 1 outcome class, on its plans and on its readouts', () => {
    expect(best.plans.every((p) => p.bookings === 'all')).toBe(true);
    expect(best.plans.every((p) => p.rate === 'premium')).toBe(true);
    expect(best.plans.filter((p) => p.staff === 1).length).toBe(4);
    expect(napsOrCleans(best)).toBe(false);
    expect(best.daysOneStaffer).toBe(4);
    expect(best.daysClosed).toBe(0);
    expect(best.daysAcceptedAll).toBe(5);
    expect(best.napCleanBlocks).toBe(0);
  });

  it('every candidate that naps or cleans anywhere, even one block, trails by at least $100', () => {
    const deviants = scores.filter(napsOrCleans);
    expect(deviants.length).toBeGreaterThanOrEqual(54 + 60 + 10 + 30);
    for (const s of deviants) expect(best.meanProfit - s.meanProfit).toBeGreaterThanOrEqual(100);
  });

  it('a cheaper rate on any one day trails by at least $50, and fewer bookings on any one day never wins', () => {
    const rates = stage('D').filter(cheaperRate);
    expect(rates.length).toBe(10);
    for (const s of rates) expect(best.meanProfit - s.meanProfit).toBeGreaterThanOrEqual(50);
    const bookings = stage('D').filter(fewerBookings);
    expect(bookings.length).toBe(10);
    for (const s of bookings) expect(best.meanProfit - s.meanProfit).toBeGreaterThanOrEqual(0);
    expect(bookings.filter((s) => best.meanProfit - s.meanProfit >= 100).length).toBeGreaterThanOrEqual(2); // Monday, 20 requests
  });

  it('two staffers every day trails one staffer', () => {
    const two = stage('A').find((s) => s.patternName === 'allFree' && s.plans.every((p) => p.staff === 2 && p.bookings === 'all' && p.rate === 'premium'))!;
    expect(best.meanProfit - two.meanProfit).toBeGreaterThanOrEqual(100);
  });

  it('the margins hold on an independent seed batch', () => {
    const b = scorePolicy(best, config, round1, 100, 2);
    const n = scorePolicy(bestNapOrClean, config, round1, 100, 2);
    const r = scorePolicy(bestCheaperRate, config, round1, 100, 2);
    expect(b.meanProfit - n.meanProfit).toBeGreaterThanOrEqual(100);
    expect(b.meanProfit - r.meanProfit).toBeGreaterThanOrEqual(50);
  });

  it('the reckless week still has the incidents the lesson needs', () => {
    expect(best.meanIncidents).toBeGreaterThanOrEqual(6);
  });

  it('rejects an empty or nonsense evaluation', () => {
    expect(() => evaluateStationaryPolicies(config, round1, 0, 1)).toThrow(/episodes/);
    expect(() => scorePolicy(best, config, round1, 10, -1)).toThrow(/seed/);
  });
});
