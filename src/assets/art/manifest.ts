// The art's contract (G5d, D59): what the yard (WP3) reads and what the art packages (WP4a the cast, WP4b the set and
// the GM) write. The cast is generated (D55, D58) and the set is modelled in code and rendered offline from one
// camera; both land here as images plus two JSON files, src/assets/art/cast.json and src/assets/art/set.json, in the
// shapes below. Pixel values are in the image's own pixels; every image is drawn at 2× the yard's CSS size.

/** The one camera (gate 1): 2:1 isometric, about 30° elevation. */
export const CAMERA = { projection: '2:1 isometric', elevationDeg: 30, lightFrom: 'upper left' } as const;

export type Breed = 'golden' | 'corgi' | 'collie' | 'beagle' | 'poodle' | 'lab';
export type DogPose = 'moving' | 'sitting' | 'asleep';
/** A crew member's pose. kneel: crouched at a dog's height, one hand out low as if greeting a dog; tired: standing,
 * shoulders down, a hand at the back of the neck, worn out (G5d round 2, row 13). Each person has all five. */
export type CrewPose = 'leash' | 'ball' | 'mop' | 'kneel' | 'tired';
export type Facing = 'right' | 'left';

/** One cast sprite: a dog of a breed and coat in a pose, or the crew in a pose; drawn with its foot anchor on the ground point. */
export interface CastSprite {
  id: string; // 'golden-cream-moving'
  file: string; // relative to src/assets/art/, e.g. 'cast/golden-cream-moving.webp'
  kind: 'dog' | 'crew';
  breed?: Breed; // dogs only
  coat?: string; // dogs only: 'cream', 'red', ... (gate 6: recolours of one model)
  pose: DogPose | CrewPose;
  /** The way the sprite faces as drawn; the yard mirrors it for the other way (gate 5). */
  facing: Facing;
  /** [width, height] of the image. */
  size: [number, number];
  /** The point that touches the ground, in the image's pixels. */
  anchor: [number, number];
}

export interface CastManifest {
  /** The scale table (gate 1): every sprite is already at this scale; the yard never rescales one breed differently. */
  scale: { corgiLength: number; goldenToCorgi: number; crewToStandingGolden: number };
  sprites: CastSprite[];
}

/** The board's world-to-image map: world metres (x right-back, y left-back on the lawn) to the board image's pixels. */
export interface BoardMap {
  /** Pixels per metre along the lawn's edges, and the image pixel of world (0, 0), the lawn's front corner. */
  ppm: number;
  origin: [number, number];
  /** The lawn's size in metres, and the margin inside the fence a figure's anchor must keep. */
  lawn: [number, number];
  margin: number;
  /** Where nothing may stand: the clubhouse footprint and any prop, as world-metre rectangles [x, y, w, h]. */
  blocked: [number, number, number, number][];
}

export interface SetManifest {
  /** The board with its fence, clubhouse and props, as one image; the walk path outside the gate if there is one. */
  board: { file: string; size: [number, number]; map: BoardMap };
  /** The GM in its three states (the status line's three), each with the point it hovers over. */
  gm: Record<'ready' | 'running' | 'done', { file: string; size: [number, number]; anchor: [number, number] }>;
  /** Where the GM hovers on the board, in board-image pixels. */
  gmSpot: [number, number];
  /** The GM at the page's size (about 64 CSS px), the same three states, for the page beside the status line. */
  gmPage: Record<'ready' | 'running' | 'done', { file: string; size: [number, number] }>;
  /** The walkers' strip on the front path, in world metres [x, y, w, h] (y may be negative: outside the lawn). */
  walk: [number, number, number, number];
  /** The set's own shadow, so the yard's code shadows match it (gate 3): tint RGB, alpha and blur of the cast
   * shadow, the contact ellipse's alpha and blur, and the key light's throw on the ground per pixel of height. */
  shadow: { tint: [number, number, number]; alpha: number; blur: number; contactAlpha: number; contactBlur: number; throw: [number, number] };
}
