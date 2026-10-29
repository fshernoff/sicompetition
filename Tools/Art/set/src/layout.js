// The yard's plan in the art contract's world (metres; x to the right-back, y to the left-back, h up; the origin at
// the lawn's front corner). The board's meshes, its baked occlusion, the blocked rectangles of set.json and the
// composites all read this one plan.
//
// The rule the plan keeps: the yard draws every figure on top of the board image, so nothing the board holds may stand
// in front of a place a figure can stand. The clubhouse and the hedge are off the lawn, behind its left-back edge; the
// fence and the gate run along the two back edges; the few props on the lawn sit against the back edges, and the lawn
// behind each one (where a figure would be partly hidden by it) is blocked. `audit` in page.js checks this by rays.

export const TILE = 1.2; // a lawn tile (the two greens alternate by tile)
export const LAWN = [6 * TILE, 6 * TILE]; // [7.2, 7.2]: the lawn inside the fence lines (room for 18 dogs and the crew)
const [X, Y] = LAWN;
export const FENCE = { h: 1.0, post: 0.12, postH: 1.08, line: 0.06 }; // the fence lines sit 0.06 outside the lawn
export const PATH = 1.0; // the front path (the walk) along the lawn's front-right edge
export const SIDE = 0.6; // the path round the corner, outside the right-back fence, to the gate
export const PATH_X = X + 2 * FENCE.line; // where the lawn ends and the side path begins
export const LAWN_Y1 = Y + 2 * FENCE.line; // where the lawn ends and the garden behind the left-back fence begins

// The clubhouse, off the lawn in its left-back corner: its front wall, with the door, stands on the left-back fence
// line, so the whole lawn is in front of it. WP4a's crew is about 1.65 m tall at the cast's scale (245 px from the foot
// anchor to the crown at 152.4 px per vertical metre), so the door is 2.0 m (about 1.2 x the crew, gate 7).
export const CLUB = { x0: 0.15, x1: 3.75, y0: Y + FENCE.line, y1: Y + FENCE.line + 2.1, wall: 2.75, roof: 2.86, parapet: 0.13, overhang: 0.06 };
export const DOOR = { x: 2.45, w: 0.92, h: 2.0 }; // centred at x on the face y = CLUB.y0
export const WINDOW = { y: CLUB.y0 + 1.1, w: 1.1, z0: 1.0, z1: 1.85 }; // centred at y on the face x = CLUB.x0

export const SLAB = {
  x0: 0, x1: PATH_X + SIDE,
  y0: -PATH, y1: CLUB.y1 + 0.1,
  depth: 0.4, lip: 0.07, // the soil's depth under the grass (or stone) lip
};

// The gate: one tile of the right-back fence, the second from the right corner, closed (it never moves: D60).
export const GATE = { y0: TILE, y1: 2 * TILE, postH: 1.24 };
// The side path ends a little past the gate; beyond it, outside the fence, is garden.
export const SIDE_END = GATE.y1 + 0.6;

// On the lawn, against the back edges only: a bush in the back corner, a cone at the left corner, a bush on the
// right-back fence, a planter by the door, a water bowl.
export const BUSHES = [
  { kind: 'round', x: X - 0.46, y: Y - 0.46, r: 0.42, h: 0.72 },
  { kind: 'cone', x: 0.36, y: Y - 0.34, r: 0.25, h: 1.0 },
  { kind: 'round', x: X - 0.32, y: 4.75, r: 0.3, h: 0.52 },
];
export const PLANTER = { x: DOOR.x + DOOR.w / 2 + 0.42, y: Y - 0.3, w: 0.44, d: 0.44, h: 0.32, shrub: { r: 0.19, h: 0.78 } };
export const BOWL = { x: X - 0.32, y: 3.4, r: 0.17, h: 0.07 };
// Off the lawn, behind the left-back fence: a hedge that shows over it. Each one stands clear of the clubhouse's
// right edge on the screen (x - y above -3.51 by its radius / 0.707 and a little), so none shows as a sliver beside it.
export const GARDEN = [
  { kind: 'round', x: 5.15, y: Y + 0.62, r: 0.42, h: 0.85 },
  { kind: 'cone', x: 5.95, y: Y + 1.5, r: 0.32, h: 1.5 },
  { kind: 'round', x: 6.55, y: Y + 1.0, r: 0.5, h: 1.0 },
  { kind: 'cone', x: 7.05, y: Y + 0.55, r: 0.26, h: 1.2 },
];

// The margin a figure's anchor keeps inside the fence lines and the lawn's open edges.
export const MARGIN = 0.45;

// The GM hovers over the middle of the clubhouse's roof.
export const GM_SPOT = { x: (CLUB.x0 + CLUB.x1) / 2, y: (CLUB.y0 + CLUB.y1) / 2, h: CLUB.roof };

// How far behind a prop (in +x and in +y) a figure would still be partly hidden by it: a figure up to 0.6 m wide on
// the screen overlaps the prop's column for about 1.3 m, and clears its top once it is 2.45 x its height further back.
const tail = (h) => Math.min(1.3, 2.45 * h);

// Where no figure's anchor may stand, as [x, y, w, h] on the lawn (w along x, h along y): each prop's footprint padded
// by `pad` (by 0.45 m round a prop taller than a paw, so a wide figure's tail or head never sinks into it), and the
// lawn behind it.
export function blocked(pad = 0.2) {
  const out = [];
  const add = (x0, y0, x1, y1, h) => {
    const p = h > 0.25 ? pad + 0.25 : pad;
    const a = Math.max(0, x0 - p), b = Math.max(0, y0 - p);
    const c = Math.min(X, x1 + p + tail(h)), d = Math.min(Y, y1 + p + tail(h));
    if (c > a && d > b) out.push([a, b, c - a, d - b].map((v) => Math.round(v * 100) / 100));
  };
  for (const b of BUSHES) add(b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r, b.h);
  add(PLANTER.x - PLANTER.w / 2, PLANTER.y - PLANTER.d / 2, PLANTER.x + PLANTER.w / 2, PLANTER.y + PLANTER.d / 2, PLANTER.h + PLANTER.shrub.h);
  add(BOWL.x - BOWL.r, BOWL.y - BOWL.r, BOWL.x + BOWL.r, BOWL.y + BOWL.r, BOWL.h);
  return out;
}

// The mess (review round 2, row 15; D60: the frame's cleanliness is state, so the yard may show it): three decals the
// yard lays on the board, each from a cleanliness under `below` on. Each lies flat on open lawn where dogs stand (inside
// the margin, off every blocked footprint, clear of the clubhouse, the fence and the walk), the three spread over the
// lawn's front, its right and its left so the yard reads as getting messier; nothing in one is higher than 8 cm (the
// depth audit's rule: lower is stood on, not hidden behind), so the yard draws them over the board and under every
// figure. The shapes are in mess.js.
export const MESS = [
  // a trampled muddy patch, two tracks of paw prints leading out of it (each fading as the mud wears off the paws)
  { id: 'mud', below: 50, x: 2.0, y: 2.3, a: 0.8, b: 0.55, rot: 0.35,
    trails: [{ p: [[2.72, 2.78], [3.25, 3.3], [4.25, 3.52]], n: 8 }, { p: [[1.5, 1.78], [1.3, 1.4], [0.98, 1.06]], n: 4 }] },
  // a spill of kibble fanning out from a heap where it landed, a chewed rope toy and a ball
  { id: 'kibble', below: 30, x: 5.0, y: 1.3, dir: 2.1, len: 0.8, n: 44, heap: 12, seed: 7,
    toy: { x: 5.42, y: 1.8, ang: -0.62 }, ball: { x: 4.52, y: 1.02 } },
  // a water bowl knocked upside down, its puddle spreading toward the front, a few drops beyond it
  { id: 'bowl', below: 10, x: 1.15, y: 5.2, puddle: { x: 1.6, y: 4.75, rx: 0.62, ry: 0.4, rot: -0.85 } },
];

// The walkers' strip on the front path: [x, y, w, h] for their anchors (the path's middle, clear of the slab's lip),
// from near the front corner to past the lawn's right corner: room for six dogs and the crew in a file.
export const WALK = [0.4, -PATH + 0.35, PATH_X + SIDE - 0.8, PATH - 0.7];

// The occluders of the baked soft occlusion on the ground: rectangles [x0, y0, x1, y1] and circles, with a strength
// (how dark at contact) and a reach in metres.
export function occluders() {
  const L = FENCE.line;
  const disc = (b, s) => ({ x: b.x, y: b.y, r: b.r * 0.85, s, reach: b.r * 0.9 });
  return {
    rects: [
      { r: [CLUB.x0, CLUB.y0, CLUB.x1, CLUB.y1], s: 0.34, reach: 0.7 },
      { r: [CLUB.x1, Y + L - 0.05, X + L + 0.05, Y + L + 0.05], s: 0.24, reach: 0.34 }, // the left-back fence
      { r: [X + L - 0.05, -0.06, X + L + 0.05, Y + L + 0.05], s: 0.24, reach: 0.34 }, // the right-back fence
      { r: [PLANTER.x - PLANTER.w / 2, PLANTER.y - PLANTER.d / 2, PLANTER.x + PLANTER.w / 2, PLANTER.y + PLANTER.d / 2], s: 0.26, reach: 0.3 },
    ],
    circles: [...BUSHES.map((b) => disc(b, 0.3)), ...GARDEN.map((b) => disc(b, 0.32)), { x: BOWL.x, y: BOWL.y, r: BOWL.r, s: 0.22, reach: 0.12 }],
  };
}
