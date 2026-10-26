// The status line's words (G3 plan: a run that ends without stable says the GM is still changing its mind). The e2e
// waits for "stable", so nothing here may say it before the trainer does.
import { describe, expect, it } from 'vitest';
import type { TrainingSnapshot } from '../../src/learn/train.ts';
import { BUDGET_MS, statusText } from '../../src/ui/app.ts';

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
    hasTarget: false,
    targetMet: false,
    done: false,
    reachedObservations: 500,
    ...over,
  };
}

describe('statusText', () => {
  it('counts while training and never says stable early', () => {
    const s = statusText(snap({}), 10_000, false, true);
    expect(s).toMatch(/^paced · Episodes 12,000 · ε 0\.46 · 10\.0 s · 25 evaluations$/);
    expect(s).not.toMatch(/stable|target|changing/);
  });

  it('says stable, and target met only when the plan has a target that was met', () => {
    expect(statusText(snap({ stable: true, done: true, hasTarget: true, targetMet: true }), 20_500, false, true)).toMatch(/stable · target met$/);
    expect(statusText(snap({ stable: true, done: true, hasTarget: false }), 20_500, false, true)).toMatch(/· stable$/);
    expect(statusText(snap({ stable: true, done: true, hasTarget: true, targetMet: false }), 20_500, false, false)).toMatch(/· stable$/);
  });

  it('says the GM is still changing its mind when a run ends without stable', () => {
    const capped = statusText(snap({ done: true, episodes: 150_000, epsilon: 0.1 }), 2_000, false, false);
    expect(capped).toMatch(/stopped at the episode limit, the GM is still changing its mind$/);
    expect(capped).not.toMatch(/stable/);
    const late = statusText(snap({ episodes: 72_000, epsilon: 0.1 }), BUDGET_MS, true, true);
    expect(late).toMatch(/60 s is up, the GM is still changing its mind$/);
    expect(late).not.toMatch(/stable/);
  });

  it('keeps the over-the-limit note for a run that was stable but late', () => {
    expect(statusText(snap({ stable: true, done: true }), BUDGET_MS + 10, true, true)).toMatch(/stable · over the 60 s limit$/);
  });
});
