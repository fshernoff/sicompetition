// The status line (BRIEF section 1, D50): the GM is a person; the line says where the GM is in its week and never
// shows the engine underneath: no digit, no weeks count, no "settled", none of the learner's words.
import { describe, expect, it } from 'vitest';
import { studentStatus } from '../../src/ui/status.ts';
import type { StudentPhase } from '../../src/ui/status.ts';

const PHASES: readonly StudentPhase[] = ['idle', 'preparing', 'playing', 'done', 'changed'];

describe('studentStatus', () => {
  it('says one fixed sentence per phase', () => {
    expect(studentStatus('idle')).toBe('Write your prediction, then put the GM to work.');
    expect(studentStatus('preparing')).toBe('The GM is getting ready for Monday.');
    expect(studentStatus('playing')).toBe('The GM is running the week.');
    expect(studentStatus('done')).toBe('The week is over: what the GM did is beside your prediction, and the full report is below.');
    expect(studentStatus('changed')).toBe('The plan changed. Put the GM to work to see what it does with this one.');
  });

  it('never shows the engine: no digit, no weeks, nothing of the learner or the class (D50)', () => {
    for (const phase of PHASES) {
      const s = studentStatus(phase);
      expect(s, phase).not.toMatch(/\d/);
      expect(s, phase).not.toMatch(/weeks|settled|routine|still changing|practi|train|learn|points?\b|episode|stable|ε|time is up/i);
      expect(s).toMatch(/\.$/);
    }
    expect(new Set(PHASES.map(studentStatus)).size).toBe(PHASES.length);
  });
});
