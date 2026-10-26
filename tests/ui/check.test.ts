// The learner's check line in the teacher panel (BRIEF sections 11 and 13, D6): the instruments the student's
// status never shows, as one line. A pure function of the snapshot, the elapsed milliseconds and the budget flag.
import { describe, expect, it } from 'vitest';
import type { TrainingSnapshot } from '../../src/learn/train.ts';
import { checkLine } from '../../src/ui/check.ts';

function snap(over: Partial<TrainingSnapshot>): TrainingSnapshot {
  return {
    episodes: 12_000,
    epsilon: 0.46,
    elapsedMs: 1000,
    lastReward: 400,
    movingAverage: 380,
    evaluations: 25,
    lastEval: null,
    stable: false,
    hasTarget: true,
    targetMet: false,
    done: false,
    reachedObservations: 500,
    ...over,
  };
}

const settled = { episodes: 24_000, epsilon: 0.1, evaluations: 49, stable: true, done: true };

describe('checkLine', () => {
  it('says no run yet before a run', () => {
    expect(checkLine(null, null, false)).toBe('No run yet.');
  });

  it('counts the weeks, ε, the evaluations and the seconds while a run is on, without a target clause', () => {
    expect(checkLine(snap({}), 10_040, false)).toBe('Weeks trained 12,000 · ε 0.46 · evaluations 25 · not stable yet · 10.0 s');
    expect(checkLine(snap({ episodes: 0, epsilon: 1, evaluations: 1 }), 0, false)).toBe('Weeks trained 0 · ε 1.00 · evaluations 1 · not stable yet · 0.0 s');
    expect(checkLine(snap({}), null, false)).toBe('Weeks trained 12,000 · ε 0.46 · evaluations 25 · not stable yet');
  });

  it('says stable and target met, target not met, or no target for this plan when a run has settled', () => {
    expect(checkLine(snap({ ...settled, targetMet: true }), 20_598, false)).toBe('Weeks trained 24,000 · ε 0.10 · evaluations 49 · stable · target met · 20.6 s');
    expect(checkLine(snap({ ...settled, targetMet: false }), 20_598, false)).toBe('Weeks trained 24,000 · ε 0.10 · evaluations 49 · stable · target not met · 20.6 s');
    expect(checkLine(snap({ ...settled, hasTarget: false }), 20_598, false)).toBe('Weeks trained 24,000 · ε 0.10 · evaluations 49 · stable · no target for this plan · 20.6 s');
  });

  it('says not stable when a run ends unsettled, and over budget when the 60 s ran out', () => {
    expect(checkLine(snap({ episodes: 150_000, epsilon: 0.1, evaluations: 301, done: true }), 61_234, true)).toBe(
      'Weeks trained 150,000 · ε 0.10 · evaluations 301 · not stable · target not met · 61.2 s, over budget',
    );
    expect(checkLine(snap({ episodes: 150_000, epsilon: 0.1, evaluations: 301, done: true, hasTarget: false }), 9_876, false)).toBe(
      'Weeks trained 150,000 · ε 0.10 · evaluations 301 · not stable · no target for this plan · 9.9 s',
    );
    // Time up before the trainer was done: the run has ended, so "not stable", not "not stable yet".
    expect(checkLine(snap({ episodes: 72_000, epsilon: 0.1, evaluations: 145 }), 60_400, true)).toBe(
      'Weeks trained 72,000 · ε 0.10 · evaluations 145 · not stable · target not met · 60.4 s, over budget',
    );
    // A settled run that crossed the budget in its last slice is stable and over budget (the pilot table's late row).
    expect(checkLine(snap({ ...settled, targetMet: true }), 60_120, true)).toBe('Weeks trained 24,000 · ε 0.10 · evaluations 49 · stable · target met · 60.1 s, over budget');
  });
});
