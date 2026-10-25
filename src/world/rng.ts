// Seeded RNG. BRIEF section 9, DECISIONS D14: one seed, two streams (world and policy) per episode.
import type { EpisodeSeeds, Rng } from './types.ts';

/**
 * mulberry32: state a = seed >>> 0; each draw: a = (a + 0x6d2b79f5) >>> 0; t = imul(a ^ (a >>> 15), 1 | a);
 * t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 2^32.
 * Reference: makeRng(1) draws 0.6270739405881613, 0.002735721180215478, 0.5274470399599522.
 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** The hash that turns (seed, episode index, stream) into one stream's seed. */
function derive(seed: number, index: number, stream: number): number {
  let t = ((seed ^ 0x9e3779b9) + Math.imul(index, 0x85ebca6b) + Math.imul(stream + 1, 0xc2b2ae35)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 0x2c1b3c6d) >>> 0;
  t = Math.imul(t ^ (t >>> 12), 0x297a2d39) >>> 0;
  return (t ^ (t >>> 15)) >>> 0;
}

/**
 * derive(seed, index, stream): t = ((seed ^ 0x9e3779b9) + imul(index, 0x85ebca6b) + imul(stream + 1, 0xc2b2ae35)) >>> 0;
 * t = imul(t ^ (t >>> 15), 0x2c1b3c6d) >>> 0; t = imul(t ^ (t >>> 12), 0x297a2d39) >>> 0; return (t ^ (t >>> 15)) >>> 0.
 * world = derive(seed, index, 0), policy = derive(seed, index, 1).
 * Reference: episodeSeeds(1, 0) = { world: 4243865792, policy: 3608504855 }; episodeSeeds(1, 1) = { world: 4254168476, policy: 3817739047 }.
 */
export function episodeSeeds(seed: number, index: number): EpisodeSeeds {
  return { world: derive(seed, index, 0), policy: derive(seed, index, 1) };
}
