// The status line in the student's words (BRIEF section 1, D38): how many weeks the GM has practised and whether it
// has settled or is still changing its mind, nothing else. The e2e waits for "has settled", so no sentence may say
// "settled" before the trainer is stable.
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

/** The learner's instruments and the words the student's screen never carries (D38, section 1). */
const LEARNERS_WORDS = ['ε', 'epsilon', 'evaluation', 'target', 'Episode', 'episode', 'stable', 'paced', 'limit', ' s ', 'ms'];

describe('studentStatus', () => {
  it('counts the weeks practised while the GM trains', () => {
    expect(studentStatus(snap({}), false)).toBe('The GM has practised 12,000 weeks so far and is still changing its mind.');
    expect(studentStatus(snap({ episodes: 1 }), false)).toBe('The GM has practised 1 week so far and is still changing its mind.');
    expect(studentStatus(snap({ episodes: 0 }), false)).toBe('The GM has practised 0 weeks so far and is still changing its mind.');
  });

  it('says settled when the trainer is stable, late or not, target or not', () => {
    const settled = 'The GM practised 24,000 weeks and has settled on how it runs the week.';
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1 }), false)).toBe(settled);
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1, hasTarget: true, targetMet: true }), false)).toBe(settled);
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1, hasTarget: true, targetMet: false }), false)).toBe(settled);
    expect(studentStatus(snap({ stable: true, done: true, episodes: 24_000, epsilon: 0.1 }), true)).toBe(settled);
  });

  it('says the GM is still changing its mind when a run ends without settling', () => {
    expect(studentStatus(snap({ done: true, episodes: 150_000, epsilon: 0.1 }), false)).toBe(
      'The GM practised 150,000 weeks and is still changing its mind.',
    );
    expect(studentStatus(snap({ episodes: 72_000, epsilon: 0.1 }), true)).toBe(
      'Time is up: the GM practised 72,000 weeks and is still changing its mind.',
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
      expect(s).toMatch(/^(The GM|Time is up: the GM) /);
      expect(s).toMatch(/\.$/);
    }
  });
});
