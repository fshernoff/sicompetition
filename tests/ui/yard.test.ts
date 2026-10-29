// The yard's placement (G5d round 2, finding 9; D60): in screen space, after the camera's projection, the same sprite
// (breed, coat and pose, either facing) never stands within 160 px of itself, and the same breed in the same pose (any
// coat) never within 110 px, at the yard's size at 1366 × 768, the distances scaling with the yard's drawn size. The
// placement is the yard's own seeded generator's, so it is the same every time. Checked on every block of the fixture
// weeks, at the 1366 yard and at the projector's.
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { carefulPolicy, recklessCoveredPolicy, recklessPolicy, stationaryPolicy } from '../../src/sim/policies.ts';
import { REFERENCE_YARD, arrangeYard, replayFrame } from '../../src/ui/replay.ts';
import type { YardFigure } from '../../src/ui/replay.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import type { EpisodeTrace } from '../../src/world/types.ts';
import { config, round1 } from '../helpers.ts';

const SAME_SPRITE_PX = 160;
const SAME_BREED_POSE_PX = 110;

const run = (policy: Parameters<typeof runEpisode>[2]): EpisodeTrace => runEpisode(config, round1, policy, episodeSeeds(1, 0));
const WEEKS: readonly [string, EpisodeTrace][] = [
  ['the packed week', run(recklessCoveredPolicy)],
  ['the week that closes on Thursday', run(recklessPolicy)],
  ['the careful week', run(carefulPolicy)],
  ['walks every block', run(stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 2 }, ['walk', 'walk', 'walk']))],
  ['a walk, structured play and a nap with one staffer', run(stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 1 }, ['walk', 'structuredPlay', 'nap']))],
  ['three staff in free play', run(stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 3 }, ['freePlay', 'freePlay', 'freePlay']))],
  ['three staff: structured play, a clean, a nap', run(stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 3 }, ['structuredPlay', 'clean', 'nap']))],
  ['the low rate, every booking, naps', run(stationaryPolicy({ bookings: 'all', rate: 'low', staff: 2 }, ['freePlay', 'nap', 'freePlay']))],
];
/** The yard while the week plays at 1366 × 768, and at the projector's 1920 × 1080 (WP2's columns, Oct 29). */
const SIZES: readonly (readonly [number, number])[] = [REFERENCE_YARD, [1102, 971]];

/** Every pair of dogs closer than a rule allows, in words, for the failure message. */
function breaches(figures: readonly YardFigure[], scale: number): string[] {
  const dogs = figures.filter((f) => f.kind === 'dog');
  const found: string[] = [];
  for (let i = 0; i < dogs.length; i++) {
    for (let j = i + 1; j < dogs.length; j++) {
      const a = dogs[i] as YardFigure;
      const b = dogs[j] as YardFigure;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (a.id === b.id && d < SAME_SPRITE_PX * scale) found.push(`${a.id} twice, ${Math.round(d)} px apart`);
      else if (a.breed === b.breed && a.pose === b.pose && d < SAME_BREED_POSE_PX * scale) found.push(`${a.id} and ${b.id}, ${Math.round(d)} px apart`);
    }
  }
  return found;
}

describe('the yard keeps a sprite and a breed in one pose apart (round 2, finding 9)', () => {
  it('measures the rules at the yard of 1366 × 768', () => {
    const f = replayFrame((WEEKS[0] as [string, EpisodeTrace])[1].steps, 1, config);
    expect(arrangeYard(f, REFERENCE_YARD[0], REFERENCE_YARD[1]).scale).toBeCloseTo(1, 6);
    expect(arrangeYard(f, 1102, 971).scale).toBeGreaterThan(1.3);
  });

  for (const [name, trace] of WEEKS) {
    for (const [w, h] of SIZES) {
      it(`${name}, every block, at ${w} × ${h}`, () => {
        const found: string[] = [];
        for (let t = 0; t < 20; t++) {
          const frame = replayFrame(trace.steps, t, config);
          const { figures, scale } = arrangeYard(frame, w, h);
          expect(figures.filter((f) => f.kind === 'dog')).toHaveLength(frame.floorDogs + frame.walkingDogs);
          for (const b of breaches(figures, scale)) found.push(`${frame.dayName} ${frame.blockName} (${frame.activityWords}): ${b}`);
        }
        expect(found).toEqual([]);
      });
    }
  }

  it('is the same arrangement every time it is asked (its own seeded generator, D60)', () => {
    const trace = (WEEKS[2] as [string, EpisodeTrace])[1];
    for (const t of [0, 1, 3, 9]) {
      const frame = replayFrame(trace.steps, t, config);
      expect(arrangeYard(frame, 784, 690)).toEqual(arrangeYard(frame, 784, 690));
    }
  });
});
