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
import setJson from '../../src/assets/art/set.json' with { type: 'json' };
import type { SetManifest } from '../../src/assets/art/manifest.ts';
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

// The crew's poses (G5d round 2, the faceted crew): in a play or nap block no two staff on the floor share a pose (one
// holds the ball, one kneels beside a dog that faces it, a third stands by with a leash); a clean keeps the mop and a
// walk the leash; above the crew fatigue limit (the config's KPI threshold, 70) the staff of a play or nap block stand
// tired instead, never in a clean or a walk (D60: the frame's state, shown).
describe('the crew on the yard', () => {
  const LIMIT = config.fatigue.kpiThreshold;
  const PLAY_OR_NAP = new Set(['freePlay', 'structuredPlay', 'nap']);
  const seen = { tired: 0, kneel: 0, play: 0 };

  for (const [name, trace] of WEEKS) {
    it(`${name}: no two staff share a pose, tired exactly above the fatigue limit in play and nap`, () => {
      const found: string[] = [];
      for (let t = 0; t < 20; t++) {
        const frame = replayFrame(trace.steps, t, config);
        if (frame.closed || frame.activity === null) continue;
        const { figures } = arrangeYard(frame, REFERENCE_YARD[0], REFERENCE_YARD[1]);
        const floor = figures.filter((f) => f.kind === 'crew' && !f.walking);
        const walkers = figures.filter((f) => f.kind === 'crew' && f.walking);
        const where = `${frame.dayName} ${frame.blockName} (${frame.activityWords}, fatigue ${frame.fatigue})`;
        if (floor.length !== frame.floorStaff) found.push(`${where}: ${floor.length} staff drawn on the floor of ${frame.floorStaff}`);
        if (walkers.some((f) => f.pose !== 'leash')) found.push(`${where}: a walker without the leash`);
        const poses = floor.map((f) => f.pose);
        if (PLAY_OR_NAP.has(frame.activity)) {
          seen.play += 1;
          if (frame.fatigue > LIMIT) {
            seen.tired += 1;
            if (poses.some((p) => p !== 'tired')) found.push(`${where}: ${poses.join(', ')}, not tired`);
          } else {
            if (poses.includes('tired')) found.push(`${where}: tired at or under the limit`);
            if (new Set(poses).size !== poses.length) found.push(`${where}: two staff share a pose (${poses.join(', ')})`);
          }
          for (const k of floor.filter((f) => f.pose === 'kneel')) {
            seen.kneel += 1;
            const sign = k.facing === 'right' ? 1 : -1;
            const beside = figures.some((d) => d.kind === 'dog' && !d.walking && (d.x - k.x) * sign > 0 && Math.abs(d.x - k.x) < 75 && Math.abs(d.y - k.y) < 40 && d.facing !== k.facing);
            if (!beside) found.push(`${where}: a kneeling staffer with no dog at its hand facing it`);
          }
        } else {
          if (poses.includes('tired')) found.push(`${where}: tired in a ${frame.activity}`);
          if (frame.activity === 'clean' && poses.some((p) => p !== 'mop')) found.push(`${where}: a clean without the mop (${poses.join(', ')})`);
        }
      }
      expect(found).toEqual([]);
    });
  }

  it('saw the tired pose, a kneeling staffer and play blocks in the fixture weeks', () => {
    expect(seen.play).toBeGreaterThan(20);
    expect(seen.tired).toBeGreaterThan(0);
    expect(seen.kneel).toBeGreaterThan(0);
  });
});

// The mess decals (G5d round 2, row 15): a decal that stands up (the bowl on its side) carries `blocked` areas in
// set.json, its footprint and the lawn behind it; no figure's anchor is ever in one, so none stands on it or wrongly
// behind it, whether or not the decal shows (a day's places hold all day, D60).
describe('the yard keeps off the mess', () => {
  const blocked = ((setJson as unknown as SetManifest).mess ?? []).flatMap((d) => d.blocked ?? []);

  it('has a decal with blocked areas to keep off', () => {
    expect(blocked.length).toBeGreaterThan(0);
  });

  for (const [name, trace] of WEEKS) {
    it(`${name}: no figure stands in a decal's blocked area`, () => {
      const found: string[] = [];
      for (let t = 0; t < 20; t++) {
        const frame = replayFrame(trace.steps, t, config);
        for (const f of arrangeYard(frame, REFERENCE_YARD[0], REFERENCE_YARD[1]).figures) {
          if (blocked.some(([x, y, w, h]) => f.mx > x && f.mx < x + w && f.my > y && f.my < y + h)) found.push(`${frame.dayName} ${frame.blockName}: ${f.id} at (${f.mx.toFixed(2)}, ${f.my.toFixed(2)})`);
        }
      }
      expect(found).toEqual([]);
    });
  }
});

// A sprite not yet in the yard before any repeat (G5d round 3, row 24): where the activity's poses give every dog of the
// block a sprite of its own, no dog sprite appears twice, however far apart. Free play, a clean and the floor during a
// walk take two poses (moving or sitting; sitting or asleep), so two dogs of one breed and coat; structured play (all
// sitting) and a nap (asleep) one. The cast has twelve breeds and coats, so the 18 to 23 dogs of a packed day's play.
describe('the yard shows a sprite not yet used before it repeats one (round 3, row 24)', () => {
  const SPRITES_EACH: Readonly<Record<string, number>> = { freePlay: 2, walk: 2, clean: 2, structuredPlay: 1, nap: 1 };
  const seen = { blocks: 0, most: 0 };
  const identity = (f: YardFigure): string => `${f.breed ?? ''}|${f.coat ?? ''}`;

  for (const [name, trace] of WEEKS) {
    for (const [w, h] of SIZES) {
      it(`${name}, at ${w} × ${h}: no dog sprite twice where the activity has enough`, () => {
        const found: string[] = [];
        for (let t = 0; t < 20; t++) {
          const frame = replayFrame(trace.steps, t, config);
          if (frame.closed || frame.activity === null) continue;
          const dogs = arrangeYard(frame, w, h).figures.filter((f) => f.kind === 'dog');
          const perIdentity = new Map<string, number>();
          for (const d of dogs) perIdentity.set(identity(d), (perIdentity.get(identity(d)) ?? 0) + 1);
          if (Math.max(0, ...perIdentity.values()) > (SPRITES_EACH[frame.activity] ?? 1)) continue;
          seen.blocks += 1;
          seen.most = Math.max(seen.most, dogs.length);
          const ids = dogs.map((d) => d.id);
          const twice = [...new Set(ids.filter((id, k) => ids.indexOf(id) !== k))];
          if (twice.length > 0) found.push(`${frame.dayName} ${frame.blockName} (${frame.activityWords}, ${dogs.length} dogs): ${twice.join(', ')} twice`);
        }
        expect(found).toEqual([]);
      });
    }
  }

  it('checked blocks of 18 dogs and more', () => {
    expect(seen.most).toBeGreaterThanOrEqual(18);
    expect(seen.blocks).toBeGreaterThan(100);
  });
});
