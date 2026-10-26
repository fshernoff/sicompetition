// The status line in the owner's words (BRIEF section 1, D38, D41, D45): how many weeks the GM has been on the job and
// whether it has settled into its routine or is still changing how it runs the place, nothing else. The e2e waits
// for "has settled", so no sentence may say "settled" before the trainer is stable.
import { describe, expect, it } from 'vitest';
import type { TrainingSnapshot } from '../../src/learn/train.ts';
import { studentStatus } from '../../src/ui/status.ts';

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

/** The learner's instruments and the words the student's screen never carries (D38, D45, section 1). */
const LEARNERS_WORDS = ['ε', 'epsilon', 'evaluation', 'target', 'Episode', 'episode', 'stable', 'paced', 'limit', ' s ', 'ms', 'practis', 'practice', 'train', 'point', 'mind'];

describe('studentStatus', () => {
  it('counts the weeks on the job while the GM works', () => {
    expect(studentStatus(snap({}), false)).toBe('The GM is 12,000 weeks into the job and still changing how it runs the place.');
    expect(studentStatus(snap({ episodes: 1 }), false)).toBe('The GM is 1 week into the job and still changing how it runs the place.');
    expect(studentStatus(snap({ episodes: 0 }), false)).toBe('The GM is 0 weeks into the job and still changing how it runs the place.');
  });

  it('says settled when the trainer is stable, late or not, target or not', () => {
    const settled = 'After 24,000 weeks on the job, the GM has settled into its routine.';
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1 }), false)).toBe(settled);
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1, hasTarget: true, targetMet: true }), false)).toBe(settled);
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1, hasTarget: true, targetMet: false }), false)).toBe(settled);
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1 }), true)).toBe(settled);
    expect(studentStatus(snap({ stable: true, done: true, episodes: 1 }), false)).toBe('After 1 week on the job, the GM has settled into its routine.');
  });

  it('says the GM is still changing how it runs the place when a run ends without settling', () => {
    expect(studentStatus(snap({ done: true, episodes: 150_000, epsilon: 0.1 }), false)).toBe(
      'After 150,000 weeks on the job, the GM is still changing how it runs the place.',
    );
    expect(studentStatus(snap({ episodes: 72_000, epsilon: 0.1 }), true)).toBe(
      'Time is up: after 72,000 weeks on the job, the GM is still changing how it runs the place.',
    );
  });

  it('never says settled before the trainer is stable', () => {
    expect(studentStatus(snap({}), false)).not.toContain('settled');
    expect(studentStatus(snap({ done: true, episodes: 150_000 }), false)).not.toContain('settled');
    expect(studentStatus(snap({ episodes: 72_000 }), true)).not.toContain('settled');
  });

  it("carries none of the learner's words", () => {
    const sentences = [
      studentStatus(snap({}), false),
      studentStatus(snap({ stable: true, done: true, hasTarget: true, targetMet: true }), false),
      studentStatus(snap({ stable: true, done: true }), true),
      studentStatus(snap({ done: true, episodes: 150_000 }), false),
      studentStatus(snap({ episodes: 72_000 }), true),
    ];
    for (const s of sentences) {
      for (const word of LEARNERS_WORDS) expect(s, `"${s}" carries "${word}"`).not.toContain(word);
      expect(s).toMatch(/^(The GM|After|Time is up: after) /);
      expect(s).toMatch(/\.$/);
    }
  });
});
