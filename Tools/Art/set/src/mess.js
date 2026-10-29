// The mess (review round 2, row 15; D60): three decals the yard lays on the board by the frame's cleanliness, modelled
// in the board's own language (flat-shaded, vertex-coloured facets from the board's palette, the lawn's own cells) and
// rendered through the board's own frame (render.js, renderDecal), so each lands exactly in its light and perspective.
//   mud     flat wet mud, darker and glossier toward its middle, two tracks of paw prints leading out of it, fading as
//           the mud wears off the paws
//   kibble  a spill of kibble fanning out from a heap, a red rubber ring and a tennis ball
//   bowl    a steel water bowl knocked over on its side, the puddle flowing out of its mouth, a few drops beyond it
// A decal carries no lawn: only its own pieces and their shadows, so laid on the board it leaves every other pixel exactly
// as it was (render.js, renderDecal). Each is, as board.js's decalGroup() takes it:
//   flats, objects      Meshers: flat pieces just over the lawn (the mud, its sheen, the prints, the puddle, the drops;
//                       they take shadows, cast none) and objects (kibble, the ring, the ball, the bowl; they cast the
//                       key light's shadow).
//   veils               flat pieces laid at an opacity, as { m: Mesher, opacity } (the paw prints, the mud wearing off
//                       them: on the board they fade into the lawn itself, never toward a guess at its colour).
//   contacts            the yard's contact shadow under each object (render.js, contactLayer), to its lower right.
//   blocked, top        for anything higher than 8 cm (the bowl on its side): its footprint and the lawn behind it, as
//                       layout.js's blockRect keeps the board's props, and its height.
// Every piece is drawn a little larger than life, so the mess reads where the yard draws the board at a third of its
// pixels. Restrained on purpose: a studio game's dirt, never gross; no lumps that could read as anything but mud.
import * as THREE from 'three';
import { Mesher, blob, V, W, col, hash, noise2, sstep, clamp } from './lib.js';
import { C, lawnColour } from './board.js';
import { MESS, blockRect } from './layout.js';
import { KEY, VIEW } from './stage.js';

const UP = V(0, 1, 0);
const FLAT = 0.011; // the flats' height: over the lawn's highest facet (0.7 cm), too low to show as lifted
const toWorld = (p) => [-p.z, -p.x, p.y];

// The mess's colours: the board's own (the slab's soil, the fence's tan, the bowl's steel, the water) plus the kibble's,
// the toys', the mud's sheen and the steel's highlight.
export const MC = {
  mud: C.soil, mudDeep: C.soilDeep, sheen: col('#9C8C78'),
  kibble: col('#B5773D'), kibbleLight: col('#CF9858'),
  ring: col('#C8432F'), ball: col('#D3E84A'), seam: col('#F6F5EE'),
  water: C.water, waterLight: col('#B9D3DD'),
  bowl: C.bowl, bowlIn: C.bowlIn, shine: col('#F4F6F8'),
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

// A paw print at (x, y), its toes toward `ang` (radians in the lawn's plane, 0 along +x), `s` its scale: a pad and four
// toes, flat on the lawn.
function pawPrint(m, x, y, ang, s, color, h = FLAT) {
  const at = (u, v) => { const [a, b] = turn([u * s, v * s], ang); return [x + a, y + b]; };
  // the pad: wider than long, its back edge a shallow notch
  const pad = [[-0.026, 0], [-0.034, 0.03], [-0.008, 0.046], [0.02, 0.036], [0.03, 0], [0.02, -0.036], [-0.008, -0.046], [-0.034, -0.03]];
  flatPoly(m, pad.map(([u, v]) => at(u, v)), h, color);
  for (const [u, v, r] of [[0.062, 0.047, 0.016], [0.083, 0.017, 0.018], [0.083, -0.017, 0.018], [0.062, -0.047, 0.016]]) {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + 0.3;
      pts.push(at(u + Math.cos(t) * r * 1.12, v + Math.sin(t) * r));
    }
    flatPoly(m, pts, h, color);
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
  const flats = new Mesher({ seed: 201 }), objects = new Mesher({ seed: 202 });
  // the outline: organic all round, many points, slow waves and a little play, no straight run
  const edge = outline(s.x, s.y, s.a, s.b, s.rot, 48, (t, k) => 1 + 0.09 * Math.sin(2 * t + 0.7) + 0.06 * Math.sin(3 * t + 2.2)
    + 0.035 * Math.sin(5 * t + 0.4) + 0.018 * Math.sin(9 * t + 1.3) + (hash(500, k) - 0.5) * 0.025);
  // the pool lies flat, its colour a smooth field vertex by vertex (no bands, no rim): olive-brown where it thins into
  // the grass, the slab's soil, then darker and wetter toward the middle
  const [cx, cy] = mean(edge);
  const wet = (x, y) => {
    const t = clamp(-polySigned([x, y], edge) / 0.4, 0, 1); // 0 at the edge, 1 from 0.4 m in
    const n = noise2(x / 0.3 + 11, y / 0.3 + 5, 43);
    return MC.mud.clone().lerp(lawnColour(x, y), 0.2 * (1 - sstep(0, 0.3, t)))
      .lerp(MC.mudDeep.clone().multiplyScalar(0.82), sstep(0.15, 1, t) * (0.8 + 0.4 * (n - 0.5)));
  };
  const pool = new Mesher({ seed: 203, toneJitter: 0.012, tint: (p) => { const [x, y] = toWorld(p); return wet(x, y); } });
  const rings = [edge, ...[0.76, 0.52, 0.28].map((f, i) => edge.map(([x, y], k) => {
    const g = f * (1 + (hash(510 + i, k) - 0.5) * 0.1);
    return [cx + (x - cx) * g, cy + (y - cy) * g];
  }))];
  flatRings(pool, rings, FLAT, () => [MC.mud, null]);
  append(flats, pool);
  // the wet sheen: two soft streaks of sky on the wettest mud, a hair above it
  for (const [u, v, rx, ry, a] of [[-0.06, 0.05, 0.2, 0.032, -0.62], [0.13, -0.07, 0.1, 0.022, -0.7]]) {
    const [ox, oy] = turn([u, v], s.rot);
    const streak = outline(cx + ox, cy + oy, rx, ry, a, 10, (t, k) => 1 + (hash(520, k) - 0.5) * 0.12);
    flatPoly(flats, streak, FLAT + 0.001, MC.sheen, (k) => 1 + (hash(521, k) - 0.5) * 0.04);
  }
  // the prints: a trot's left and right in turn, the mud wearing off them as they go (each fainter, a hair over the
  // pool so the first lies cleanly on its edge)
  const tracks = s.trails.map((t) => along(...t.p, 0.24, t.n));
  const veils = [];
  tracks.forEach(({ prints }, ti) => prints.forEach(({ p, ang }, k) => {
    const [ox, oy] = turn([0, (k % 2 ? 1 : -1) * 0.07], ang);
    const fade = 0.04 + 0.6 * (k / Math.max(1, prints.length - 1));
    const m = new Mesher({ seed: 205 });
    pawPrint(m, p[0] + ox, p[1] + oy, ang + (hash(ti, k, 5) - 0.5) * 0.25, 1.5, MC.mudDeep, FLAT + 0.0015);
    veils.push({ m, opacity: 1 - fade });
  }));
  return { id: s.id, below: s.below, flats, objects, veils };
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

  // the toys, each darker where it meets the grass and grounded by the yard's contact shadow to its lower right
  const toys = new Mesher({ seed: 213, toneJitter: 0.03, shade: (p) => 0.8 + 0.2 * sstep(0, 0.05, p.y) });
  // a plain red rubber ring lying flat (25 cm across, 4.8 cm high)
  const Rg = s.ring, R = 0.1, tr = 0.024;
  const torus = new THREE.TorusGeometry(R, tr, 7, 24).toNonIndexed();
  torus.rotateX(Math.PI / 2);
  torus.rotateY(0.13);
  torus.translate(...W(Rg.x, Rg.y, tr).toArray());
  meshInto(toys, torus, () => MC.ring);
  // a tennis ball: fluorescent yellow-green, its white seam the ball's own curve (7.8 cm high)
  const Bl = s.ball, br = 0.039;
  const bc = W(Bl.x, Bl.y, br);
  const turnSeam = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.9, 0.3));
  const seam = Array.from({ length: 240 }, (_, k) => {
    const t = (k / 240) * Math.PI * 2, a = 0.68, b = 0.32;
    return V(a * Math.cos(t) + b * Math.cos(3 * t), a * Math.sin(t) - b * Math.sin(3 * t), 2 * Math.sqrt(a * b) * Math.sin(2 * t)).normalize().applyQuaternion(turnSeam);
  });
  const ball = new THREE.IcosahedronGeometry(br, 3); // (already non-indexed)
  ball.translate(bc.x, bc.y, bc.z);
  meshInto(toys, ball, (cen) => {
    const n = cen.clone().sub(bc).normalize();
    return seam.some((q) => n.dot(q) > 0.988) ? MC.seam : MC.ball;
  });
  append(objects, toys);
  const contacts = [
    ...Array.from({ length: 12 }, (_, k) => {
      const t = (k / 12) * Math.PI * 2;
      return { x: Rg.x + Math.cos(t) * R, y: Rg.y + Math.sin(t) * R, r: 0.032, dx: 0.35, dy: 0.45 };
    }),
    { x: Bl.x, y: Bl.y, r: 0.034, dx: 0.45, dy: 0.5 },
  ];
  return { id: s.id, below: s.below, flats, objects, contacts };
}

function bowl(s) {
  const flats = new Mesher({ seed: 221 }), objects = new Mesher({ seed: 222 });
  const [ux, uy] = [Math.cos(s.dir), Math.sin(s.dir)], [vx, vy] = [-uy, ux];
  // the bowl: a flared steel dog bowl (30 cm across its rolled lip, 7.4 cm deep), knocked over onto its side: it rests
  // on its wall and lip, its mouth toward `dir` and tipped a little up, so its inside shows (24 cm high)
  const R = 0.145, Rb = 0.1, Hb = 0.072, th = 0.01;
  const prof = [[0, th], [Rb - 0.012, th], [R - 0.012, Hb], [R + 0.004, Hb + 0.002], [R + 0.006, Hb - 0.01], [Rb, 0], [0, 0]];
  const SEG = 24;
  const g = new THREE.LatheGeometry(prof.map(([rad, h]) => new THREE.Vector2(rad, h)), SEG).toNonIndexed();
  // onto its side: turned about z until the line from the foot to the lip's outer edge lies flat at the bottom
  const [fx, fy] = [prof[4][0] - prof[5][0], prof[4][1] - prof[5][1]];
  g.rotateZ(-Math.PI / 2 - Math.atan2(-fx, fy));
  const pos = g.getAttribute('position');
  let lift = Infinity;
  for (let i = 0; i < pos.count; i++) lift = Math.min(lift, pos.getY(i));
  g.translate(0, -lift, 0);
  // the lip's point on the grass (the outermost low vertex toward +x), then aimed along `dir` and set on (x, y)
  let lip = null;
  for (let i = 0; i < pos.count; i++) {
    const p = V().fromBufferAttribute(pos, i);
    if (p.y < 0.002 && (!lip || p.x > lip.x)) lip = p;
  }
  g.rotateY(Math.atan2(ux, -uy));
  lip.applyAxisAngle(V(0, 1, 0), Math.atan2(ux, -uy));
  const to = W(s.x, s.y, 0).sub(lip);
  g.translate(to.x, to.y, to.z);
  // steel: every facet's own brightness from the sky it faces, and a bright highlight where it mirrors the key light
  // toward the camera (as the board's own bowl reads as steel); the inside darker
  const half = KEY.clone().add(VIEW.d).normalize();
  const steel = (base, n) => {
    const m = n.dot(VIEW.d) < 0 ? n.clone().negate() : n;
    const spec = sstep(0.8, 0.97, m.dot(half));
    return base.clone().multiplyScalar(0.84 + 0.22 * Math.max(0, m.y)).lerp(MC.shine, 0.85 * spec);
  };
  const metal = new Mesher({ seed: 223, toneJitter: 0, shade: (p) => 0.86 + 0.14 * sstep(0, 0.06, p.y) });
  const P = g.getAttribute('position');
  const per = 2 * (prof.length - 1); // three's lathe: for each segment, two triangles per profile step
  let top = 0;
  for (let f = 0; f < P.count / 3; f++) {
    const a = V().fromBufferAttribute(P, 3 * f), b = V().fromBufferAttribute(P, 3 * f + 1), c = V().fromBufferAttribute(P, 3 * f + 2);
    const n = V().subVectors(b, a).cross(V().subVectors(c, a)).normalize();
    const step = Math.floor((f % per) / 2);
    metal.tri(a, b, c, steel(step <= 1 ? MC.bowlIn : MC.bowl, n), null, 1);
    for (const p of [a, b, c]) top = Math.max(top, p.y);
  }
  append(objects, metal);

  // the puddle, flowing out of the mouth: narrow at the lip, widening, a rounded front; a ring of shallow water round a
  // deeper pool, every facet its own tone, a streak of sky along it, no darker band round it
  const L = s.puddle.len, Wd = s.puddle.width / 2, N = 14;
  const width = (f) => Wd * (0.3 + 0.7 * sstep(0, 0.55, f)) * Math.sqrt(Math.max(0, 1 - Math.max(0, (f - 0.55) / 0.45) ** 2));
  const at = (u, v) => [s.x + ux * u + vx * v, s.y + uy * u + vy * v];
  const side = (sgn, seed) => Array.from({ length: N + 1 }, (_, k) => {
    const f = k / N;
    return at(-0.05 + f * L, sgn * width(f) * (1 + (hash(seed, k) - 0.5) * 0.16));
  });
  const edge = [...side(1, 600), ...side(-1, 601).reverse().slice(1, -1)];
  const [mx, my] = mean(edge);
  const inner = edge.map(([x, y], k) => { const q = 0.6 * (1 + (hash(602, k) - 0.5) * 0.1); return [mx + (x - mx) * q, my + (y - my) * q]; });
  flatRings(flats, [edge, inner], FLAT, (ring, k) => [MC.water, ring === 0 ? 0.985 + (hash(603, k) - 0.5) * 0.03 : 1 + (hash(604, k) - 0.5) * 0.04]);
  const [sx, sy] = at(0.5 * L, -0.04 * Wd);
  flatPoly(flats, outline(sx, sy, 0.24 * L, 0.05, s.dir + 0.12, 9), FLAT + 0.001, MC.waterLight, 1);
  // a few drops flung beyond its front
  const drops = [[1.1, 0.15, 0.04], [1.2, -0.3, 0.03], [1.28, 0.32, 0.026], [1.36, -0.05, 0.022]].map(([f, v, r]) => [...at(f * L, v * Wd), r]);
  drops.forEach(([x, y, r], k) => flatPoly(flats, outline(x, y, r * 1.15, r, k, 7), FLAT, MC.water, 1 - k * 0.01));

  // grounded, its shadow below and to the lower right as the ring's and the ball's: a tight, light contact where the lip
  // touches the grass, and a softer one under the mouth toward the lower right; none along the line it rests on, which
  // runs back under the dome toward the light (D58, Oct 29: that read as a smudge on the light-facing side)
  const lipAt = at(0, 0), mouthAt = at(-0.02, 0);
  const contacts = [
    { x: lipAt[0], y: lipAt[1], r: 0.035, dx: 0.4, dy: 0.5, k: 0.6 },
    { x: mouthAt[0], y: mouthAt[1], r: 0.08, dx: 0.9, dy: 0.9, k: 0.55 },
  ];
  // the bowl is taller than a paw: its footprint and the lawn behind it are blocked, as the board's props are
  const xs = [], ys = [];
  for (let i = 0; i < P.count; i++) { xs.push(-P.getZ(i)); ys.push(-P.getX(i)); }
  const blockedRect = blockRect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), top);
  return { id: s.id, below: s.below, flats, objects, contacts, blocked: blockedRect ? [blockedRect] : [], top };
}

// Every triangle of a non-indexed geometry into a Mesher, coloured by colorAt(centroid) with its own winding.
function meshInto(m, geo, colorAt) {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const a = V().fromBufferAttribute(p, i), b = V().fromBufferAttribute(p, i + 1), c = V().fromBufferAttribute(p, i + 2);
    m.tri(a, b, c, colorAt(a.clone().add(b).add(c).multiplyScalar(1 / 3)));
  }
}
// One Mesher's triangles appended to another's (their colours already baked).
function append(dst, src) {
  dst.pos.push(...src.pos);
  dst.col.push(...src.col);
}

const BUILD = { mud, kibble, bowl };

// One decal by its id in layout.js's MESS.
export function buildMess(id) {
  const s = MESS.find((m) => m.id === id);
  if (!s) throw new Error(`no mess ${id}`);
  return BUILD[id](s);
}

// Several at once, for the check (the board with every decal in place): their flats, objects and contact shadows merged.
export function combineMess(list) {
  const merge = (k) => {
    const m = new Mesher();
    for (const d of list) { m.pos.push(...d[k].pos); m.col.push(...d[k].col); }
    return m;
  };
  return {
    contacts: list.flatMap((d) => d.contacts ?? []),
    veils: list.flatMap((d) => d.veils ?? []),
    flats: merge('flats'),
    objects: merge('objects'),
  };
}
