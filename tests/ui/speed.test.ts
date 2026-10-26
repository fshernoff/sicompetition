// The speed control's mapping to weeks a second (BRIEF section 11, D33, D48). Normal is the constant the button
// paced at before G5, so Round 1 trains exactly as it did; Full is unpaced; the pilot mode never reads it.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, MAX_FRAME_SECONDS, SPEEDS, paceFor, paceSlice, speedName } from '../../src/ui/speed.ts';

describe('speed', () => {
  it("Normal is 1,200 weeks a second, the default, and D33's constant", () => {
    expect(paceFor('normal')).toBe(1200);
    expect(DEFAULT_SPEED).toBe('normal');
    expect(paceFor(DEFAULT_SPEED)).toBe(1200);
  });

  it('Full speed is no pacing', () => {
    expect(paceFor('full')).toBeNull();
  });

  it('Slow is 600 and Fast is 2,400 weeks a second, exactly (Astra, plan review: an ordering test allows 599)', () => {
    expect(paceFor('slow')).toBe(600);
    expect(paceFor('fast')).toBe(2400);
  });

  it('an unknown name is Normal', () => {
    expect(paceFor('warp')).toBe(1200);
    expect(paceFor('')).toBe(1200);
    expect(speedName('warp')).toBe('normal');
    expect(speedName('')).toBe('normal');
    expect(speedName('full')).toBe('full');
    expect(speedName('slow')).toBe('slow');
  });

  it('lists the four speeds in order, each labelled with its weeks a second', () => {
    expect(SPEEDS.map((s) => s.name)).toEqual(['slow', 'normal', 'fast', 'full']);
    for (const s of SPEEDS) {
      expect(s.pace).toBe(paceFor(s.name));
      expect(s.label).toMatch(/^[A-Z]/);
      if (s.pace === null) expect(s.label).toMatch(/no pacing/i);
      else expect(s.label).toContain(`${s.pace.toLocaleString('en-US')} weeks a second`);
    }
    expect(SPEEDS.find((s) => s.name === 'normal')?.label).toBe('Normal: 1,200 weeks a second');
  });

  it("at Slow, G2's largest Round 1 count (31,000 weeks) takes about 52 s, nominal, inside the 60 s budget", () => {
    expect(31_000 / (paceFor('slow') as number)).toBeCloseTo(51.7, 1);
    expect(31_000 / (paceFor('slow') as number)).toBeLessThan(60);
  });
});

describe('paceSlice', () => {
  it("is D33's arithmetic: elapsed time times the pace, carried as a fraction, at least one week a frame", () => {
    expect(MAX_FRAME_SECONDS).toBe(0.1);
    // A 60 Hz frame at Normal: 16.7 ms × 1,200 = 20.04 weeks: 20 trained, 0.04 carried.
    const a = paceSlice(0, 16.7, 1200);
    expect(a.episodes).toBe(20);
    expect(a.owed).toBeCloseTo(0.04, 10);
    // Frames of 31.25 ms (exact in binary) owe 37.5 weeks each: 37 then 38, the half carried and spent in turn.
    let owed = 0;
    const trained: number[] = [];
    for (let i = 0; i < 4; i++) {
      const s = paceSlice(owed, 31.25, 1200);
      owed = s.owed;
      trained.push(s.episodes);
    }
    expect(trained).toEqual([37, 38, 37, 38]);
    expect(owed).toBe(0);
    // Nothing is lost or invented over many frames: the weeks trained plus the carry equal the pace times the time
    // (floating-point drift only moves a week across a frame boundary, never out of the total).
    owed = 0;
    let total = 0;
    for (let i = 0; i < 25; i++) {
      const s = paceSlice(owed, 16.7, 1200);
      owed = s.owed;
      total += s.episodes;
    }
    expect(total + owed).toBeCloseTo(25 * 20.04, 6);
    expect(total).toBeGreaterThanOrEqual(500);
    expect(total).toBeLessThanOrEqual(501);
  });

  it('never makes up more than 100 ms of training in one frame, however late the frame', () => {
    expect(paceSlice(0, 500, 1200)).toEqual({ episodes: 120, owed: 0 }); // 0.1 s × 1,200
    expect(paceSlice(0, 100, 600)).toEqual({ episodes: 60, owed: 0 });
    expect(paceSlice(0.5, 1000, 2400)).toEqual({ episodes: 240, owed: 0.5 });
  });

  it('trains at least one week in a frame, carrying the shortfall as a negative owed', () => {
    const s = paceSlice(0, 0.3, 1200); // 0.36 weeks owed: one trains, −0.64 carries
    expect(s.episodes).toBe(1);
    expect(s.owed).toBeCloseTo(-0.64, 10);
    const next = paceSlice(s.owed, 0.3, 1200); // still short: another single week, −1.28 carried
    expect(next.episodes).toBe(1);
    expect(next.owed).toBeCloseTo(-1.28, 10);
    expect(paceSlice(0, 0, 1200)).toEqual({ episodes: 1, owed: -1 });
    expect(paceSlice(0, -5, 1200)).toEqual({ episodes: 1, owed: -1 }); // a clock that went backwards counts as 0
  });

  it('is the same at every speed: the pace only scales the weeks', () => {
    expect(paceSlice(0, 50, 600)).toEqual({ episodes: 30, owed: 0 });
    expect(paceSlice(0, 50, 2400)).toEqual({ episodes: 120, owed: 0 });
    expect(paceSlice(0.75, 50, 1200).episodes).toBe(60); // 60.75 → 60, 0.75 carried
    expect(paceSlice(0.75, 50, 1200).owed).toBeCloseTo(0.75, 10);
  });
});
