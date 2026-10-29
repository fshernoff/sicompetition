// The mess (review round 2, row 15; D60): three decals the yard lays on the board by the frame's cleanliness, modelled
// in the board's own language (flat-shaded, vertex-coloured facets from the board's palette, the lawn's own cells) and
// rendered through the board's own frame (render.js, renderDecal), so each lands exactly in its light and perspective.
//   mud     a trampled muddy patch, two tracks of paw prints leading out of it, fading as the mud wears off the paws
//   kibble  a spill of kibble fanning out from a heap, a chewed rope toy and a ball, on trampled grass
//   bowl    a water bowl knocked upside down, its puddle on wet grass, a few drops beyond it
// Each is three parts, as board.js's lawn() and decalGroup() take them:
//   tintAt(p, colour)   the grass it tints round its pieces (mud smeared in, trampled, wet), vertex by vertex as a soft
//                       field fading to nothing, like the board's baked occlusion; null leaves a vertex alone. The
//                       lawn's cells it touches are copied with the lawn's own vertices, facet tones and occlusion, so
//                       they meet the board's lawn exactly; they also join a decal's pieces into one patch (no loose
//                       specks).
//   shadeAt(p)          its own baked soft occlusion on the ground round what stands on it (1 elsewhere).
//   flats, objects      Meshers: flat pieces just over the lawn (the mud, the prints, the puddle, the drops, the rope's
//                       frayed ends; they take shadows, cast none) and small objects (kibble, the toy, the ball, the
//                       bowl; they cast the key light's shadow). Nothing is higher than 8 cm.
// Every piece is drawn a little larger than life, so the mess reads where the yard draws the board at a third of its
// pixels. Restrained on purpose: a studio game's dirt, never gross; no lumps that could read as anything but mud.
import * as THREE from 'three';
import { Mesher, blob, V, W, col, hash, noise2, sstep, clamp } from './lib.js';
import { C, lawnColour } from './board.js';
import { MESS } from './layout.js';

const UP = V(0, 1, 0);
const FLAT = 0.011; // the flats' height: over the lawn's highest facet (0.7 cm), too low to show as lifted
const toWorld = (p) => [-p.z, -p.x, p.y];

// The mess's colours: the board's own (the slab's soil, the fence's tan, the bowl's steel, the gate's iron, the water)
// plus four for the kibble and the toys.
export const MC = {
  mud: C.soil, mudDeep: C.soilDeep,
  worn: C.wood, // trampled grass yellows toward the fence's tan
  kibble: col('#B5773D'), kibbleLight: col('#CF9858'),
  rope: col('#EEE5D2'), stripe: col('#5F7F96'), // the stripe is the window glass's slate blue, a touch deeper
  ball: col('#CDD15A'), seam: col('#F3ECDF'),
  water: C.water, waterLight: col('#B9D3DD'),
  bowl: C.bowl, rubber: C.iron,
};

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const turn = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const mean = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// --- the shared pieces -------------------------------------------------------------------------------------------
// A flat polygon on the lawn ([x, y] points in order round it), fanned from its middle at height h.
function flatPoly(m, pts, h, color, tone = 1) {
  const [cx, cy] = mean(pts);
  const c = W(cx, cy, h);
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k], q = pts[(k + 1) % pts.length];
    m.tri(c, W(p[0], p[1], h), W(q[0], q[1], h), typeof color === 'function' ? color(k) : color, UP, typeof tone === 'function' ? tone(k) : tone);
  }
}
// A flat pool in rings: `rings` outlines from the outside in (the same count of points each, in order), the last fanned
// to its middle; fill(ring, k, x, y) -> [colour, tone] for each facet.
function flatRings(m, rings, h, fill) {
  const n = rings[0].length;
  for (let r = 0; r < rings.length; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let k = 0; k < n; k++) {
      const a0 = A[k], a1 = A[(k + 1) % n];
      if (B) {
        const b0 = B[k], b1 = B[(k + 1) % n];
        const [x, y] = mean([a0, a1, b0, b1]);
        const [clr, tone] = fill(r, k, x, y);
        m.tri(W(a0[0], a0[1], h), W(a1[0], a1[1], h), W(b1[0], b1[1], h), clr, UP, tone);
        m.tri(W(a0[0], a0[1], h), W(b1[0], b1[1], h), W(b0[0], b0[1], h), clr, UP, tone);
      } else {
        const [cx, cy] = mean(A);
        const [x, y] = mean([a0, a1, [cx, cy]]);
        const [clr, tone] = fill(r, k, x, y);
        m.tri(W(cx, cy, h), W(a0[0], a0[1], h), W(a1[0], a1[1], h), clr, UP, tone);
      }
    }
  }
}
// n points round (x, y) on an ellipse rx x ry turned by `rot`, each radius times wob(angle, k).
function outline(x, y, rx, ry, rot, n, wob = () => 1) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    const w = wob(t, k);
    const [u, v] = turn([Math.cos(t) * rx * w, Math.sin(t) * ry * w], rot);
    pts.push([x + u, y + v]);
  }
  return pts;
}
// the same outline drawn in toward its middle by f (with a little play per point)
const inset = (pts, f, seed, play = 0.08) => {
  const [cx, cy] = mean(pts);
  return pts.map(([x, y], k) => { const g = f * (1 + (hash(seed, k) - 0.5) * play); return [cx + (x - cx) * g, cy + (y - cy) * g]; });
};
// a ragged ellipse: 1 on its outline, by angle
const ragged = (phase) => (t) => 1 + 0.12 * Math.sin(3 * t + phase) + 0.07 * Math.sin(5 * t + 2.3 * phase + 0.4) + 0.04 * Math.sin(8 * t + phase * 3.1);
function pointInPoly([x, y], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
const polyDist = (p, pts, closed = true) => {
  let d = Infinity;
  for (let k = 0; k < pts.length - (closed ? 0 : 1); k++) d = Math.min(d, segDist(p, pts[k], pts[(k + 1) % pts.length]));
  return d;
};
// signed: negative inside the polygon
const polySigned = (p, pts) => (pointInPoly(p, pts) ? -1 : 1) * polyDist(p, pts);
// the convex hull of points (monotone chain), counter-clockwise
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
// the baked soft occlusion of round things on the ground: [x, y, r, strength, reach]
const occlusion = (discs) => (x, y) => {
  let k = 1;
  for (const [ox, oy, r, s, reach] of discs) k *= 1 - s * (1 - sstep(0, reach, Math.max(0, Math.hypot(x - ox, y - oy) - r)));
  return k;
};
const shadeOf = (fn) => (p) => { const [x, y] = toWorld(p); return fn(x, y); };

// A paw print at (x, y), its toes toward `ang` (radians in the lawn's plane, 0 along +x), `s` its scale: a pad and four
// toes, flat on the lawn.
function pawPrint(m, x, y, ang, s, color) {
  const at = (u, v) => { const [a, b] = turn([u * s, v * s], ang); return [x + a, y + b]; };
  // the pad: wider than long, its back edge a shallow notch
  const pad = [[-0.026, 0], [-0.034, 0.03], [-0.008, 0.046], [0.02, 0.036], [0.03, 0], [0.02, -0.036], [-0.008, -0.046], [-0.034, -0.03]];
  flatPoly(m, pad.map(([u, v]) => at(u, v)), FLAT, color);
  for (const [u, v, r] of [[0.062, 0.047, 0.016], [0.083, 0.017, 0.018], [0.083, -0.017, 0.018], [0.062, -0.047, 0.016]]) {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + 0.3;
      pts.push(at(u + Math.cos(t) * r * 1.12, v + Math.sin(t) * r));
    }
    flatPoly(m, pts, FLAT, color);
  }
}
// A quadratic Bezier through three points, sampled by arc length: [{ p, ang }] every `step` metres from its start, and
// the line itself.
function along(p0, p1, p2, step, n) {
  const B = (t) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  const fine = Array.from({ length: 401 }, (_, k) => B(k / 400));
  const out = [];
  let acc = 0, next = 0;
  for (let k = 1; k < fine.length && out.length < n; k++) {
    const d = Math.hypot(fine[k][0] - fine[k - 1][0], fine[k][1] - fine[k - 1][1]);
    while (acc + d >= next && out.length < n) {
      const f = (next - acc) / d;
      const p = [fine[k - 1][0] + (fine[k][0] - fine[k - 1][0]) * f, fine[k - 1][1] + (fine[k][1] - fine[k - 1][1]) * f];
      out.push({ p, ang: Math.atan2(fine[k][1] - fine[k - 1][1], fine[k][0] - fine[k - 1][0]) });
      next += step;
    }
    acc += d;
  }
  return { prints: out, line: fine.filter((_, k) => k % 10 === 0) };
}

// --- the three ---------------------------------------------------------------------------------------------------
function mud(s) {
  const flats = new Mesher({ seed: 201, toneJitter: 0.05 }), objects = new Mesher({ seed: 202 });
  // the mud: a ragged pool in three bands, drier and lighter at its edge, wettest in the middle, every facet its own tone
  const edge = outline(s.x, s.y, s.a, s.b, s.rot, 26, (t, k) => ragged(0.8)(t) + (hash(500, k) - 0.5) * 0.09);
  const rings = [edge, inset(edge, 0.74, 501), inset(edge, 0.42, 502, 0.2)];
  const wet = (x, y) => noise2(x / 0.28 + 11, y / 0.28 + 5, 43);
  flatRings(flats, rings, FLAT, (r, k, x, y) => {
    if (r === 0) return [MC.mud.clone().lerp(lawnColour(x, y), 0.16), null];
    if (r === 1) return [MC.mud.clone().lerp(MC.mudDeep, clamp(wet(x, y) * 0.9, 0, 0.8)), null];
    return [MC.mudDeep.clone().multiplyScalar(0.93 + wet(x, y) * 0.08), null];
  });
  // the prints: a trot's left and right in turn, the mud wearing off them as they go
  const tracks = s.trails.map((t) => along(...t.p, 0.24, t.n));
  tracks.forEach(({ prints }, ti) => prints.forEach(({ p, ang }, k) => {
    const [ox, oy] = turn([0, (k % 2 ? 1 : -1) * 0.07], ang);
    const x = p[0] + ox, y = p[1] + oy;
    const fade = 0.04 + 0.6 * (k / Math.max(1, prints.length - 1));
    pawPrint(flats, x, y, ang + (hash(ti, k, 5) - 0.5) * 0.25, 1.5, MC.mudDeep.clone().lerp(lawnColour(x, y), fade));
  }));
  const lines = tracks.map((t) => t.line);
  // round it, the grass smeared with mud and trampled; along the tracks, trampled
  const tintAt = (p, clr) => {
    const [x, y] = toWorld(p);
    const d = polySigned([x, y], edge); // metres outside the mud's edge
    const smear = 1 - sstep(-0.02, 0.24, d), tramp = 1 - sstep(0.04, 0.42, d);
    const track = Math.max(0, ...lines.map((l) => 1 - sstep(0.03, 0.18, polyDist([x, y], l, false))));
    if (smear <= 0 && tramp <= 0 && track <= 0) return null;
    return clr.clone().lerp(MC.worn, 0.13 * Math.max(tramp, 0.6 * track)).lerp(MC.mud, 0.3 * smear);
  };
  return { id: s.id, below: s.below, tintAt, shadeAt: () => 1, flats, objects };
}

function kibble(s) {
  const flats = new Mesher({ seed: 211 }), objects = new Mesher({ seed: 212 });
  const r = rng(s.seed);
  const [ux, uy] = [Math.cos(s.dir), Math.sin(s.dir)], [px, py] = [-uy, ux];
  // where it landed, a small heap (a few on top of the others); then a fan, wider the further it went
  const pieces = [];
  let inHeap = 0;
  for (let k = 0; pieces.length < s.n && k < 20000; k++) {
    const heap = inHeap === pieces.length && pieces.length < s.heap && k < 2000;
    const t = heap ? r() * 0.12 : 0.08 + r() ** 0.8 * s.len;
    const w = heap ? (r() - 0.5) * 0.18 : (r() - 0.5) * (0.14 + t * 0.85);
    const x = s.x + ux * t + px * w, y = s.y + uy * t + py * w;
    if (pieces.some((q) => Math.hypot(q.x - x, q.y - y) < (heap ? 0.05 : 0.075))) continue;
    pieces.push({ x, y, h: 0, size: 0.9 + r() * 0.25, yaw: r() * Math.PI, tone: r() });
    if (heap) inHeap++;
  }
  // three on top of the heap, each across two below it
  for (let k = 0; k < 3; k++) {
    const a = pieces[k], b = pieces[(k + 3) % inHeap];
    pieces.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, h: 0.017, size: 0.9, yaw: r() * Math.PI, tone: r() });
  }
  pieces.forEach((q, k) => {
    const rot = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), q.yaw);
    const clr = MC.kibble.clone().lerp(MC.kibbleLight, q.tone);
    blob(objects, W(q.x, q.y, q.h + 0.012 * q.size), [0.037 * q.size, 0.019 * q.size, 0.03 * q.size], clr, { detail: 0, rot, jitter: 0.1, seed: 300 + k });
  });

  // the rope toy: a twisted rope with two slate stripes, a knot at each end, the chewed end frayed (7.8 cm at the knots)
  const T = s.toy, L = 0.55, N = 11, rr = 0.025;
  const [tx, ty] = [Math.cos(T.ang), Math.sin(T.ang)];
  const rope = Array.from({ length: N + 1 }, (_, k) => {
    const f = k / N - 0.5;
    const bend = Math.sin((k / N) * Math.PI * 2) * 0.03;
    return [T.x + tx * f * L - ty * bend, T.y + ty * f * L + tx * bend];
  });
  for (let k = 0; k < N; k++) {
    const a = W(rope[k][0], rope[k][1], rr), b = W(rope[k + 1][0], rope[k + 1][1], rr);
    tube(objects, a, b, rr, k === 4 || k === 6 ? MC.stripe : MC.rope);
  }
  rope.forEach(([x, y], k) => {
    if (k === 0 || k === N) blob(objects, W(x, y, 0.037), [0.044, 0.04, 0.044], MC.rope, { detail: 1, jitter: 0.08, seed: 330 + k });
  });
  // the frayed ends: loose strands splayed on the grass, longer at the chewed end
  for (const [end, dirSign, n, len] of [[rope[0], -1, 7, 0.11], [rope[N], 1, 5, 0.065]]) {
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(ty * dirSign, tx * dirSign) + (k / (n - 1) - 0.5) * 1.4 + (hash(340, k, n) - 0.5) * 0.2;
      const l = len * (0.7 + hash(341, k, n) * 0.5);
      const [cx, cy] = [Math.cos(a), Math.sin(a)];
      const b0 = [end[0] + cx * 0.03 - cy * 0.01, end[1] + cy * 0.03 + cx * 0.01];
      const b1 = [end[0] + cx * 0.03 + cy * 0.01, end[1] + cy * 0.03 - cx * 0.01];
      const tip = [end[0] + cx * (0.03 + l), end[1] + cy * (0.03 + l)];
      flats.tri(W(b0[0], b0[1], FLAT), W(b1[0], b1[1], FLAT), W(tip[0], tip[1], FLAT), k === 3 && n > 5 ? MC.stripe : MC.rope.clone().multiplyScalar(0.94), UP, 1);
    }
  }

  // the ball: a tennis ball, its seam a pale band, a little squashed and scuffed from chewing (7.4 cm high)
  const Bl = s.ball, br = 0.04;
  const bc = W(Bl.x, Bl.y, br * 0.92);
  const axis = V(0.45, 0.8, 0.4).normalize();
  blob(objects, bc, [br, br * 0.92, br], (c) => {
    const n = c.clone().sub(bc).normalize();
    return Math.abs(n.dot(axis)) < 0.2 ? MC.seam : MC.ball.clone().multiplyScalar(0.94 + hash(Math.round(c.x * 1e4), Math.round(c.z * 1e4), 7) * 0.1);
  }, { detail: 1, jitter: 0.05, seed: 350 });

  // trampled grass under all of it (one patch: the hull of everything, a little wider), more round the heap
  const all = [...pieces.map((q) => [q.x, q.y]), ...rope, [Bl.x, Bl.y]];
  const H = hull(all);
  const shadeAt = occlusion([
    ...rope.filter((_, k) => k % 2 === 0).map(([x, y]) => [x, y, 0.02, 0.16, 0.07]),
    [rope[0][0], rope[0][1], 0.035, 0.2, 0.08], [rope[N][0], rope[N][1], 0.035, 0.2, 0.08],
    [Bl.x, Bl.y, br * 0.7, 0.22, 0.09],
  ]);
  const tintAt = (p, clr) => {
    const [x, y] = toWorld(p);
    const tramp = 1 - sstep(-0.06, 0.2, polySigned([x, y], H)), heap = 1 - sstep(0.05, 0.32, Math.hypot(x - s.x, y - s.y));
    if (tramp <= 0 && heap <= 0) return null;
    return clr.clone().lerp(MC.worn, 0.1 * tramp + 0.08 * heap);
  };
  return { id: s.id, below: s.below, tintAt, shadeAt: shadeOf(shadeAt), flats, objects };
}

function bowl(s) {
  const flats = new Mesher({ seed: 221 }), objects = new Mesher({ seed: 222 });
  const P = s.puddle;
  const edge = outline(P.x, P.y, P.rx, P.ry, P.rot, 24, (t, k) => ragged(2.1)(t) + (hash(400, k) - 0.5) * 0.09);
  // the puddle: a ring of shallow water round a deeper pool, every facet its own tone; a streak of sky across it
  flatRings(flats, [edge, inset(edge, 0.62, 403)], FLAT, (r, k) => [MC.water, r === 0 ? 0.975 + (hash(402, k) - 0.5) * 0.04 : 1 + (hash(404, k) - 0.5) * 0.05]);
  const [sx, sy] = turn([0.42, 0], P.rot + 0.5);
  const streak = outline(P.x - sx * 0.25, P.y - sy * 0.25, P.rx * 0.42, P.ry * 0.12, P.rot + 0.5, 8);
  flatPoly(flats, streak, FLAT + 0.001, MC.waterLight, 1);
  // a few drops flung beyond it, the way it spilled
  const [dx, dy] = turn([1, -0.15], P.rot);
  const drops = [[1.2, 0.0, 0.04], [1.36, 0.36, 0.03], [1.3, -0.4, 0.034], [1.55, 0.08, 0.024]].map(([f, side, r]) => [
    P.x + dx * P.rx * f - dy * P.ry * side, P.y + dy * P.rx * f + dx * P.ry * side, r]);
  drops.forEach(([x, y, r], k) => flatPoly(flats, outline(x, y, r * 1.15, r, k, 7), FLAT, MC.water, 1 - k * 0.01));

  // the bowl, knocked upside down at the puddle's back edge: a steel dog bowl turned over, its rim on the grass, its
  // base on top with the black non-slip ring such bowls have (6.7 cm high)
  const prof = [[0.0, 0.01], [0.1, 0.01], [0.156, 0.062], [0.174, 0.062], [0.168, 0.054], [0.112, 0.0], [0.0, 0.0]];
  const Hb = 0.062;
  const g = new THREE.LatheGeometry(prof.map(([rad, h]) => new THREE.Vector2(rad, h)), 16).toNonIndexed();
  g.rotateX(Math.PI);
  g.translate(0, Hb, 0);
  g.rotateY(0.21); // its facets not square to the camera
  const c = W(s.x, s.y, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const a = V().fromBufferAttribute(p, i).add(c), b = V().fromBufferAttribute(p, i + 1).add(c), d = V().fromBufferAttribute(p, i + 2).add(c);
    const cen = a.clone().add(b).add(d).multiplyScalar(1 / 3);
    const top = cen.y > Hb - 0.003;
    objects.tri(a, b, d, top ? MC.bowl.clone().multiplyScalar(1.03) : MC.bowl, null, 1);
  }
  // the ring on its base
  for (let k = 0; k < 16; k++) {
    const t0 = (k / 16) * Math.PI * 2 + 0.21, t1 = ((k + 1) / 16) * Math.PI * 2 + 0.21;
    const q = (rad, t) => W(s.x + Math.cos(t) * rad, s.y + Math.sin(t) * rad, Hb + 0.003);
    objects.quad(q(0.098, t0), q(0.098, t1), q(0.068, t1), q(0.068, t0), MC.rubber, UP, 1);
  }

  const shadeAt = occlusion([[s.x, s.y, 0.15, 0.22, 0.12]]);
  // wet grass round the puddle, the bowl and the drops: darker and a touch bluer
  const tintAt = (p, clr) => {
    const [x, y] = toWorld(p);
    const d = Math.min(polySigned([x, y], edge), Math.hypot(x - s.x, y - s.y) - 0.17, ...drops.map(([x2, y2, r]) => Math.hypot(x - x2, y - y2) - r));
    const wet = 1 - sstep(0, 0.17, d);
    if (wet <= 0) return null;
    return clr.clone().multiplyScalar(1 - 0.16 * wet).lerp(MC.water, 0.07 * wet);
  };
  return { id: s.id, below: s.below, tintAt, shadeAt: shadeOf(shadeAt), flats, objects };
}

// A closed tube of `sides` facets from a to b (three.js space), radius r.
function tube(m, a, b, r, color, sides = 7) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, sides, 1, false).toNonIndexed();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) m.tri(V().fromBufferAttribute(p, i), V().fromBufferAttribute(p, i + 1), V().fromBufferAttribute(p, i + 2), color);
}

const BUILD = { mud, kibble, bowl };

// One decal by its id in layout.js's MESS.
export function buildMess(id) {
  const s = MESS.find((m) => m.id === id);
  if (!s) throw new Error(`no mess ${id}`);
  return BUILD[id](s);
}

// Several at once, for the check (the board with every decal in place): the first decal that tints a vertex wins (they
// never overlap), their occlusions multiply, their flats and objects are merged.
export function combineMess(list) {
  const merge = (k) => {
    const m = new Mesher();
    for (const d of list) { m.pos.push(...d[k].pos); m.col.push(...d[k].col); }
    return m;
  };
  return {
    tintAt: (p, clr) => { for (const d of list) { const c = d.tintAt(p, clr); if (c) return c; } return null; },
    shadeAt: (p) => list.reduce((k, d) => k * d.shadeAt(p), 1),
    flats: merge('flats'),
    objects: merge('objects'),
  };
}
