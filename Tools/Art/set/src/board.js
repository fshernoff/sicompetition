// The board: the lawn in two greens on a slab with square corners and a soil edge, the walk path, the fence on the
// back two sides with a gate, the clubhouse to scale, a few bushes, a planter and a water bowl, all from layout.js.
// Every surface carries a baked soft occlusion (darker where it meets the ground, under the eaves, near the fence and
// the clubhouse), the set's half of meeting the cast's finish (gate 4).
import * as THREE from 'three';
import { Mesher, blob, cone, boxW, V, W, col, hash, noise2, sstep } from './lib.js';
import { TILE, LAWN, PATH, FENCE, SLAB, PATH_X, LAWN_Y1, SIDE_END, CLUB, DOOR, WINDOW, GATE, BUSHES, GARDEN, PLANTER, BOWL, occluders } from './layout.js';

const [X, Y] = LAWN;
const L = FENCE.line;

export const C = {
  lawnA: col('#9BBB58'), lawnB: col('#8BAD4F'), garden: col('#7B9F48'),
  lip: col('#77A046'), lipGarden: col('#6D9441'), soil: col('#86643F'), soilDeep: col('#6E5135'),
  stone: col('#DCD4C4'), stoneB: col('#D1C8B6'), joint: col('#ABA190'), curb: col('#C4BAA7'),
  wood: col('#DECAA4'), post: col('#CDB389'), cap: col('#C3A87C'),
  wallA: col('#F4E8D2'), wallB: col('#ECDEC4'), plinth: col('#C4B7A1'),
  roof: col('#A09DA0'), parapet: col('#8C8A8F'), parapetTop: col('#A7A5A8'),
  door: col('#5C6268'), doorPanel: col('#535960'), doorFrame: col('#767A80'), handle: col('#D4D6D8'), step: col('#C9C1B3'),
  trim: col('#F3ECDF'), glass: col('#6E8995'), glassLight: col('#93ADB8'),
  bush: col('#62913F'), bushDark: col('#4D7834'), cone: col('#5E9241'), coneDark: col('#4B7A36'),
  planter: col('#CFB892'), pot: col('#5F4832'),
  bowl: col('#BCC1C7'), bowlIn: col('#959BA2'), water: col('#8DB4C4'),
  iron: col('#4A4D52'),
};

// --- the baked soft occlusion ------------------------------------------------------------------------------------
const OCC = occluders();
const rectDist = (x, y, [x0, y0, x1, y1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
export function groundAO(x, y) {
  let k = 1;
  for (const o of OCC.rects) k *= 1 - o.s * (1 - sstep(0, o.reach, rectDist(x, y, o.r)));
  for (const o of OCC.circles) k *= 1 - o.s * (1 - sstep(0, o.reach, Math.max(0, Math.hypot(x - o.x, y - o.y) - o.r)));
  return k;
}
const toWorld = (p) => [-p.z, -p.x, p.y];
// The ground (lawn, path): occlusion from what stands on it.
const groundShade = (p) => { const [x, y] = toWorld(p); return groundAO(x, y); };
// Anything standing up: darker where it meets the ground; a horizontal face is left alone.
const standShade = (p, n) => (Math.abs(n.y) < 0.6 ? 1 - 0.2 * (1 - sstep(0, 0.45, p.y)) : 1);
// The clubhouse's walls: the ground contact and the eaves.
const wallShade = (p, n) => standShade(p, n) * (Math.abs(n.y) < 0.6 ? 1 - 0.13 * sstep(CLUB.wall - 0.32, CLUB.wall, p.y) : 1);
// The roof: darker against the parapet.
const roofShade = (p, n) => {
  if (n.y < 0.6 || p.y < CLUB.roof - 0.01 || p.y > CLUB.roof + 0.05) return 1;
  const [x, y] = toWorld(p);
  const e = 0.1; // the parapet's width
  const d = Math.min(x - (CLUB.x0 + e), CLUB.x1 - e - x, y - (CLUB.y0 + e), CLUB.y1 - e - y);
  return 1 - 0.2 * (1 - sstep(0, 0.4, d));
};
// The slab's sides: darker toward the bottom.
const sideShade = (p) => 0.84 + 0.16 * sstep(-SLAB.depth, -0.08, p.y);

// --- the parts --------------------------------------------------------------------------------------------------
const JIT = 0.36; // the in-plane jitter of the ground grids, as a fraction of a cell (plus or minus half of it)
const LAWN_JITTER = 0.018; // the lawn's per-facet tone jitter (its Mesher's toneJitter)

// The lawn's colour at a point: its tile's green and its two tones, before a facet's jitter and the baked occlusion
// (the same sum as lawn() below; the mess's paw prints fade toward it).
export function lawnColour(x, y) {
  const ti = Math.min(Math.floor(x / TILE), 5), tj = Math.min(Math.floor(y / TILE), 5);
  const base = (ti + tj) % 2 ? C.lawnB : C.lawnA;
  return base.clone().multiplyScalar(1 + (noise2(x / 1.6, y / 1.6, 5) - 0.5) * 0.08 + (noise2(x / 0.55, y / 0.55, 6) - 0.5) * 0.03);
}

// The lawn. With a `mess` (mess.js: tintAt(p, colour) -> the colour at a vertex or null, shadeAt(p) -> its baked
// occlusion), the cells it touches are tinted vertex by vertex: in place (`inPlace`, the whole board with the mess, for
// the check), or else copied alone, with the lawn's own vertices, facet tones and occlusion, into a mesh of their own,
// which is returned (the decal's cells). Without one, the lawn is exactly as it was (the shipped board's bytes depend
// on it).
function lawn(mess = null, { inPlace = false } = {}) {
  const messShade = mess ? (p) => groundShade(p) * mess.shadeAt(p) : null;
  const messTint = mess ? (p, c) => mess.tintAt(p, c) ?? c : null;
  const m = mess && inPlace
    ? new Mesher({ toneJitter: LAWN_JITTER, seed: 3, shade: messShade, tint: messTint })
    : new Mesher({ toneJitter: LAWN_JITTER, seed: 3, shade: groundShade });
  const cells = mess && !inPlace ? new Mesher({ seed: 3, shade: messShade, tint: messTint }) : null;
  // the tone Mesher.tri gives its k-th triangle when none is passed
  const toneOf = (k) => 1 + (hash(3, k, 31) - 0.5) * 2 * LAWN_JITTER;
  const c = TILE / 8;
  const xs = [], ys = [];
  for (let i = 0; i * c < X - 1e-6; i++) xs.push(i * c);
  xs.push(X, PATH_X);
  for (let j = 0; j * c < Y - 1e-6; j++) ys.push(j * c);
  ys.push(Y, LAWN_Y1);
  const onLine = (i, n) => i === 0 || i >= n - 2 || i % 8 === 0;
  const hgt = (i, j) => (onLine(i, xs.length) || onLine(j, ys.length) ? 0 : (hash(i, j, 9) - 0.5) * 0.014);
  // Each vertex off the tile lines moves a little in the plane too: a regular grid's diagonals run exactly up the
  // screen in a 2:1 view, and a column of them reads as a straight, pasted-on step. The tile lines stay straight. At
  // most 0.18 of a cell along each axis, so every cell stays convex and its two triangles cover it without a gap.
  const P = (i, j) => W(
    xs[i] + (onLine(i, xs.length) ? 0 : (hash(i, j, 21) - 0.5) * JIT * c),
    ys[j] + (onLine(j, ys.length) ? 0 : (hash(i, j, 22) - 0.5) * JIT * c),
    hgt(i, j));
  const up = V(0, 1, 0);
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const xm = (xs[i] + xs[i + 1]) / 2, ym = (ys[j] + ys[j + 1]) / 2;
    const ti = Math.min(Math.floor(xm / TILE), 5), tj = Math.min(Math.floor(ym / TILE), 5);
    const base = (ti + tj) % 2 ? C.lawnB : C.lawnA;
    const tone = 1 + (noise2(xm / 1.6, ym / 1.6, 5) - 0.5) * 0.08 + (noise2(xm / 0.55, ym / 0.55, 6) - 0.5) * 0.03;
    const clr = base.clone().multiplyScalar(tone);
    const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
    const k0 = m.n;
    if (hash(i, j, 2) > 0.5) { m.tri(a, b, cc, clr, up); m.tri(a, cc, d, clr, up); }
    else { m.tri(a, b, d, clr, up); m.tri(b, cc, d, clr, up); }
    if (cells && [a, b, cc, d].some((p) => mess.tintAt(p, clr) !== null || mess.shadeAt(p) < 1)) {
      if (m.n - k0 !== 2) throw new Error(`lawn: cell ${i},${j} has a degenerate facet`);
      const t0 = toneOf(k0), t1 = toneOf(k0 + 1);
      if (hash(i, j, 2) > 0.5) { cells.tri(a, b, cc, clr, up, t0); cells.tri(a, cc, d, clr, up, t1); }
      else { cells.tri(a, b, d, clr, up, t0); cells.tri(b, cc, d, clr, up, t1); }
    }
  }
  return cells ?? m;
}

// The garden outside the fence: behind the left-back fence round the clubhouse, and beyond the side path's end
// outside the right-back fence. One darker green, faceted like the lawn.
function garden() {
  const m = new Mesher({ toneJitter: 0.025, seed: 5, shade: groundShade });
  const c = TILE / 8, up = V(0, 1, 0);
  const area = (x0, x1, y0, y1, seed) => {
    const xs = [], ys = [];
    for (let x = x0; x < x1 - 1e-6; x += c) xs.push(x);
    xs.push(x1);
    for (let y = y0; y < y1 - 1e-6; y += c) ys.push(y);
    ys.push(y1);
    const ei = (i) => i === 0 || i === xs.length - 1, ej = (j) => j === 0 || j === ys.length - 1;
    const P = (i, j) => W(
      xs[i] + (ei(i) ? 0 : (hash(seed, i, j, 23) - 0.5) * JIT * c),
      ys[j] + (ej(j) ? 0 : (hash(seed, i, j, 24) - 0.5) * JIT * c),
      ei(i) || ej(j) ? 0 : (hash(seed, i, j, 19) - 0.5) * 0.014);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const xm = (xs[i] + xs[i + 1]) / 2, ym = (ys[j] + ys[j + 1]) / 2;
      // (the garden runs on under the clubhouse: skipping cells there left slivers of nothing at its edges)
      const clr = C.garden.clone().multiplyScalar(1 + (noise2(xm / 1.2, ym / 1.2, 7) - 0.5) * 0.08);
      const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
      if (hash(seed, i, j, 12) > 0.5) { m.tri(a, b, cc, clr, up); m.tri(a, cc, d, clr, up); }
      else { m.tri(a, b, d, clr, up); m.tri(b, cc, d, clr, up); }
    }
  };
  area(0, SLAB.x1, LAWN_Y1, SLAB.y1, 1);
  area(PATH_X, SLAB.x1, SIDE_END, LAWN_Y1, 2);
  return m;
}

// The path: flagstones in a running bond, two across, on a gravel bed, with a curb along the lawn's front-right edge.
function path() {
  const m = new Mesher({ toneJitter: 0.035, seed: 11, shade: groundShade });
  const up = V(0, 1, 0);
  const bed = (x0, y0, x1, y1) => m.quad(W(x0, y0, 0), W(x1, y0, 0), W(x1, y1, 0), W(x0, y1, 0), C.joint, up);
  const gap = 0.035;
  // A strip of flagstones, `rows` across: `along` runs from a0 to a1, `across` from b0 to b1; at(a, b) -> [x, y].
  const strip = (a0, a1, b0, b1, at, seed, rows) => {
    const bw = (b1 - b0 - gap * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      const bb0 = b0 + gap + r * (bw + gap), bb1 = bb0 + bw;
      let a = a0 + gap - (r % 2 ? 0.32 : 0);
      let k = 0;
      while (a < a1 - gap) {
        const len = 0.56 + hash(seed, r, k, 1) * 0.14;
        const s0 = Math.max(a, a0 + gap), s1 = Math.min(a + len, a1 - gap);
        if (s1 - s0 > 0.12) {
          const h = 0.022 + (hash(seed, r, k, 2) - 0.5) * 0.008;
          const tone = 1 + (hash(seed, r, k, 3) - 0.5) * 0.09;
          const clr = (hash(seed, r, k, 4) > 0.5 ? C.stone : C.stoneB).clone().multiplyScalar(tone);
          const [x0, y0] = at(s0, bb0), [x1, y1] = at(s1, bb1);
          const lo = [Math.min(x0, x1), Math.min(y0, y1)], hi = [Math.max(x0, x1), Math.max(y0, y1)];
          // the top, split on a diagonal with a slight tilt so each stone catches the light its own way
          const tz = (u, v) => h + (hash(seed, r, k, u, v) - 0.5) * 0.006;
          const A = W(lo[0], lo[1], tz(0, 0)), B = W(hi[0], lo[1], tz(1, 0)), Cc = W(hi[0], hi[1], tz(1, 1)), D = W(lo[0], hi[1], tz(0, 1));
          m.tri(A, B, Cc, clr, up, tone); m.tri(A, Cc, D, clr, up, tone);
          // the two sides the camera sees (facing -x and -y)
          const side = clr.clone().multiplyScalar(0.86);
          m.quad(W(lo[0], lo[1], 0), W(lo[0], hi[1], 0), D, A, side, W(-1, 0, 0).sub(W(0, 0, 0)));
          m.quad(W(lo[0], lo[1], 0), A, B, W(hi[0], lo[1], 0), side, W(0, -1, 0).sub(W(0, 0, 0)));
        }
        a += len + gap;
        k++;
      }
    }
  };
  // the front strip, along x, the full width of the slab
  bed(0, -PATH, SLAB.x1, -0.07);
  strip(0, SLAB.x1, -PATH, -0.07, (a, b) => [a, b], 21, 2);
  // the side strip outside the right-back fence, along y
  bed(PATH_X, -0.07, SLAB.x1, SIDE_END);
  strip(-0.07, SIDE_END, PATH_X, SLAB.x1, (a, b) => [b, a], 22, 1);
  // the curb between the lawn and the front strip
  boxW(m, 0, -0.07, 0, PATH_X, 0.07, 0.035, C.curb, { tone: 1 });
  return m;
}

// The slab's two visible sides: a grass (or stone) lip over the soil, with a ragged line between them.
function slabSides() {
  const m = new Mesher({ toneJitter: 0.035, seed: 4, shade: sideShade });
  const D = SLAB.depth;
  const face = (p0, p1, out, lipColor, seed) => {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const n = Math.round(len / 0.16);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const a = [p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0];
      const b = [p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1];
      const lc = typeof lipColor === 'function' ? lipColor((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) : lipColor;
      const la = -SLAB.lip - (hash(seed, k, 1) - 0.5) * 0.04, lb = -SLAB.lip - (hash(seed, k + 1, 1) - 0.5) * 0.04;
      const ma = -D * 0.62 - (hash(seed, k, 2) - 0.5) * 0.05, mb = -D * 0.62 - (hash(seed, k + 1, 2) - 0.5) * 0.05;
      m.quad(W(a[0], a[1], 0), W(b[0], b[1], 0), W(b[0], b[1], lb), W(a[0], a[1], la), lc, out);
      m.quad(W(a[0], a[1], la), W(b[0], b[1], lb), W(b[0], b[1], mb), W(a[0], a[1], ma), C.soil, out);
      m.quad(W(a[0], a[1], ma), W(b[0], b[1], mb), W(b[0], b[1], -D), W(a[0], a[1], -D), C.soilDeep, out);
    }
  };
  const outX = V(0, 0, 1), outY = V(1, 0, 0); // the contract's -x and -y, in three.js
  // the front-left side (x = 0): stone under the path, grass under the lawn
  face([0, -PATH], [0, SLAB.y1], outX, (x, y) => (y < -0.07 ? C.stoneB : y < 0 ? C.curb : y < LAWN_Y1 ? C.lip : C.lipGarden), 31);
  // the front-right side (y = -PATH): all path
  face([0, -PATH], [SLAB.x1, -PATH], outY, C.stoneB, 32);
  // the back sides and the bottom close the slab (never seen; they cast its shadow on the page)
  face([SLAB.x1, -PATH], [SLAB.x1, SLAB.y1], V(0, 0, -1), (x, y) => (y < SIDE_END ? C.stoneB : C.lipGarden), 33);
  face([0, SLAB.y1], [SLAB.x1, SLAB.y1], V(-1, 0, 0), C.lipGarden, 34);
  return m;
}

function post(m, x, y, h, w = FENCE.post) {
  boxW(m, x - w / 2, y - w / 2, 0, w, w, h, C.post);
  boxW(m, x - w / 2 - 0.018, y - w / 2 - 0.018, h, w + 0.036, w + 0.036, 0.03, C.cap);
  boxW(m, x - w / 2 + 0.012, y - w / 2 + 0.012, h + 0.03, w - 0.024, w - 0.024, 0.022, C.cap);
}

// Horizontal boards between two posts: along x when `alongX`, else along y; four boards with gaps.
function boards(m, a0, a1, line, alongX, seed) {
  const t = 0.032;
  for (let k = 0; k < 4; k++) {
    const h0 = 0.08 + k * 0.24, hh = 0.19;
    const tone = 1 + (hash(seed, k, 5) - 0.5) * 0.09;
    if (alongX) boxW(m, a0, line - t / 2, h0, a1 - a0, t, hh, C.wood, { tone });
    else boxW(m, line - t / 2, a0, h0, t, a1 - a0, hh, C.wood, { tone });
  }
}

function fence() {
  const m = new Mesher({ toneJitter: 0.04, seed: 6, shade: standShade });
  const fx = X + L, fy = Y + L; // the two fence lines
  // posts evenly about a tile apart between two stops, boards between them
  const run = (s0, s1, line, alongX, seed, endPosts = [true, true]) => {
    const n = Math.max(1, Math.round((s1 - s0) / TILE));
    const at = (k) => s0 + ((s1 - s0) * k) / n;
    for (let k = 0; k <= n; k++) {
      if ((k === 0 && !endPosts[0]) || (k === n && !endPosts[1])) continue;
      const s = at(k);
      if (alongX) post(m, s, line, FENCE.postH); else post(m, line, s, FENCE.postH);
    }
    for (let k = 0; k < n; k++) boards(m, at(k) + FENCE.post / 2 - 0.01, at(k + 1) - FENCE.post / 2 + 0.01, line, alongX, seed + k);
  };
  // the left-back run, from the clubhouse's wall to the back corner
  run(CLUB.x1 + FENCE.post / 2, fx, fy, true, 40, [true, true]);
  // the right-back run, from the back corner to the gate, and from the gate to the lawn's right corner
  run(GATE.y1, fy, fx, false, 50, [false, false]);
  run(0, GATE.y0, fx, false, 60, [true, false]);
  gate(m, fx);
  return m;
}

// The gate: two taller posts and a ledged-and-braced leaf of vertical boards, rails and brace on the lawn's side.
function gate(m, fx) {
  const { y0, y1, postH } = GATE;
  post(m, fx, y0, postH, 0.14);
  post(m, fx, y1, postH, 0.14);
  const t = 0.03, g0 = y0 + 0.09, g1 = y1 - 0.09;
  const n = 9, bw = (g1 - g0 - (n - 1) * 0.022) / n;
  for (let k = 0; k < n; k++) {
    const s = g0 + k * (bw + 0.022);
    const top = 1.04 - Math.abs(k - (n - 1) / 2) * 0.012; // a shallow crown
    boxW(m, fx - t / 2, s, 0.1, t, bw, top - 0.1, C.wood, { tone: 1 + (hash(70, k) - 0.5) * 0.08 });
  }
  const rx = fx - t / 2 - 0.028; // the lawn's face of the leaf
  for (const h of [0.27, 0.82]) boxW(m, rx, g0, h, 0.028, g1 - g0, 0.09, C.post);
  // the brace, from the low rail at the hinge side to the high rail at the latch side
  const a = W(rx + 0.014, g1 - 0.08, 0.36), b = W(rx + 0.014, g0 + 0.08, 0.82);
  const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  const br = new THREE.BoxGeometry(0.075, len, 0.026).toNonIndexed();
  br.applyQuaternion(q); br.translate(mid.x, mid.y, mid.z);
  const p = br.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const A = V().fromBufferAttribute(p, i), B = V().fromBufferAttribute(p, i + 1), Cc = V().fromBufferAttribute(p, i + 2);
    m.tri(A, B, Cc, C.post, null, 0.97);
  }
  // the hinge straps and the latch, in iron
  for (const h of [0.29, 0.84]) boxW(m, rx - 0.008, g1 - 0.3, h + 0.02, 0.01, 0.3, 0.05, C.iron, { tone: 1 });
  boxW(m, rx - 0.03, g0 - 0.06, 0.66, 0.03, 0.14, 0.05, C.iron, { tone: 1 });
}

function clubhouse() {
  const walls = new Mesher({ toneJitter: 0.0, seed: 8, shade: wallShade });
  const { x0, x1, y0, y1, wall } = CLUB;
  // the plinth
  boxW(walls, x0 - 0.025, y0 - 0.025, 0, x1 - x0 + 0.05, y1 - y0 + 0.05, 0.15, C.plinth, { tone: 1 });
  // vertical planks on every face, in two close tones
  const planks = (a, b, out) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(len / 0.17);
    for (let k = 0; k < n; k++) {
      const p = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
      const q = [a[0] + ((b[0] - a[0]) * (k + 1)) / n, a[1] + ((b[1] - a[1]) * (k + 1)) / n];
      const c = (k % 2 ? C.wallA : C.wallB).clone().multiplyScalar(1 + (hash(80, k, a[0] * 10) - 0.5) * 0.03);
      walls.quad(W(p[0], p[1], 0.15), W(q[0], q[1], 0.15), W(q[0], q[1], wall), W(p[0], p[1], wall), c, out, 1);
    }
  };
  planks([x0, y0], [x1, y0], V(1, 0, 0)); // the face toward the lawn (-y): the door
  planks([x0, y1], [x0, y0], V(0, 0, 1)); // the face toward the front-left (-x): the window
  planks([x1, y0], [x1, y1], V(0, 0, -1));
  planks([x1, y1], [x0, y1], V(-1, 0, 0));

  // the roof: a slab with an overhang, a parapet round it and panels inside
  const roof = new Mesher({ toneJitter: 0.0, seed: 9, shade: roofShade });
  const o = CLUB.overhang, pw = 0.1, top = CLUB.roof + CLUB.parapet;
  boxW(roof, x0 - o, y0 - o, wall, x1 - x0 + 2 * o, y1 - y0 + 2 * o, CLUB.roof - wall, C.parapet, { tone: 1 });
  boxW(roof, x0 - o, y0 - o, wall, pw + o, y1 - y0 + 2 * o, top - wall, C.parapet, { tone: 1 });
  boxW(roof, x1 - pw, y0 - o, wall, pw + o, y1 - y0 + 2 * o, top - wall, C.parapet, { tone: 1 });
  boxW(roof, x0 + pw, y0 - o, wall, x1 - x0 - 2 * pw, pw + o, top - wall, C.parapet, { tone: 1 });
  boxW(roof, x0 + pw, y1 - pw, wall, x1 - x0 - 2 * pw, pw + o, top - wall, C.parapet, { tone: 1 });
  // the parapet's top, a touch lighter (it faces the sky)
  const cap = (a0, b0, a1, b1) => roof.quad(W(a0, b0, top + 0.001), W(a1, b0, top + 0.001), W(a1, b1, top + 0.001), W(a0, b1, top + 0.001), C.parapetTop, V(0, 1, 0), 1);
  cap(x0 - o, y0 - o, x1 + o, y0 + pw); cap(x0 - o, y1 - pw, x1 + o, y1 + o);
  cap(x0 - o, y0 + pw, x0 + pw, y1 - pw); cap(x1 - pw, y0 + pw, x1 + o, y1 - pw);
  // roof panels, 4 x 3, each its own tone
  const ix0 = x0 + pw, ix1 = x1 - pw, iy0 = y0 + pw, iy1 = y1 - pw, nx = 4, ny = 3;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const a0 = ix0 + ((ix1 - ix0) * i) / nx, a1 = ix0 + ((ix1 - ix0) * (i + 1)) / nx;
    const b0 = iy0 + ((iy1 - iy0) * j) / ny, b1 = iy0 + ((iy1 - iy0) * (j + 1)) / ny;
    const t = 1 + (hash(90, i, j) - 0.5) * 0.05;
    const g = 0.008;
    roof.quad(W(a0 + g, b0 + g, CLUB.roof + 0.002), W(a1 - g, b0 + g, CLUB.roof + 0.002), W(a1 - g, b1 - g, CLUB.roof + 0.002), W(a0 + g, b1 - g, CLUB.roof + 0.002), C.roof, V(0, 1, 0), t);
  }

  // the door on the lawn's face, with its frame, two sunk panels, a lever handle and a step
  const det = new Mesher({ toneJitter: 0.0, seed: 10, shade: standShade });
  const dx0 = DOOR.x - DOOR.w / 2;
  boxW(det, dx0 - 0.07, y0 - 0.035, 0.15, DOOR.w + 0.14, 0.035, DOOR.h + 0.06 - 0.15, C.doorFrame, { tone: 1 });
  boxW(det, dx0, y0 - 0.05, 0.15, DOOR.w, 0.02, DOOR.h - 0.15, C.door, { tone: 1 });
  for (const [h0, h1] of [[0.3, 0.95], [1.1, DOOR.h - 0.14]]) {
    det.quad(W(dx0 + 0.13, y0 - 0.052, h0), W(dx0 + DOOR.w - 0.13, y0 - 0.052, h0), W(dx0 + DOOR.w - 0.13, y0 - 0.052, h1), W(dx0 + 0.13, y0 - 0.052, h1), C.doorPanel, V(1, 0, 0), 1);
  }
  boxW(det, dx0 + DOOR.w - 0.2, y0 - 0.1, 0.99, 0.13, 0.05, 0.035, C.handle, { tone: 1 });
  boxW(det, dx0 + DOOR.w - 0.12, y0 - 0.075, 0.94, 0.04, 0.03, 0.12, C.handle, { tone: 0.92 });
  boxW(det, dx0 - 0.16, y0 - 0.36, 0, DOOR.w + 0.32, 0.36, 0.06, C.step, { tone: 1 });

  // the window on the front-left face: a white trim, a sill, two panes with a soft reflection
  const wy0 = WINDOW.y - WINDOW.w / 2, wy1 = WINDOW.y + WINDOW.w / 2;
  boxW(det, x0 - 0.035, wy0 - 0.07, WINDOW.z0 - 0.06, 0.035, WINDOW.w + 0.14, WINDOW.z1 - WINDOW.z0 + 0.12, C.trim, { tone: 1 });
  boxW(det, x0 - 0.09, wy0 - 0.1, WINDOW.z0 - 0.1, 0.09, WINDOW.w + 0.2, 0.05, C.trim, { tone: 0.97 });
  const gx = x0 - 0.04, out = V(0, 0, 1);
  const pane = (a, b) => {
    det.quad(W(gx, a, WINDOW.z0), W(gx, b, WINDOW.z0), W(gx, b, WINDOW.z1), W(gx, a, WINDOW.z1), C.glass, out, 1);
    // a diagonal band of reflected sky
    const t0 = 0.25, t1 = 0.5, H = WINDOW.z1 - WINDOW.z0, Wd = b - a;
    det.tri(W(gx - 0.001, a, WINDOW.z0 + H * t0), W(gx - 0.001, a + Wd * t0, WINDOW.z0), W(gx - 0.001, a + Wd * t1, WINDOW.z0), C.glassLight, out, 1);
    det.tri(W(gx - 0.001, a, WINDOW.z0 + H * t0), W(gx - 0.001, a + Wd * t1, WINDOW.z0), W(gx - 0.001, a, WINDOW.z0 + H * t1), C.glassLight, out, 1);
  };
  const mid = WINDOW.y, mw = 0.035;
  pane(wy0, mid - mw); pane(mid + mw, wy1);
  boxW(det, x0 - 0.05, mid - mw, WINDOW.z0, 0.05, 2 * mw, WINDOW.z1 - WINDOW.z0, C.trim, { tone: 1 });
  return [walls, roof, det];
}

function plants() {
  const m = new Mesher({ toneJitter: 0.07, seed: 12 });
  const roundBush = (x, y, r, h, seed) => {
    const base = W(x, y, 0);
    const clr = (c) => (c.y > base.y + h * 0.55 ? C.bush : C.bushDark);
    // one rounded body and a crown lobe inside its outline: round, never notched
    blob(m, W(x, y, h * 0.48), [r, h * 0.5, r], clr, { detail: 1, jitter: 0.05, seed });
    blob(m, W(x, y, h * 0.62), [r * 0.74, h * 0.36, r * 0.74], clr, { detail: 1, jitter: 0.05, seed: seed + 1 });
  };
  const coneBush = (x, y, r, h, h0, seed) => {
    const base = W(x, y, h0);
    cone(m, base, r, h, (c) => (c.y > base.y + h * 0.35 ? C.cone : C.coneDark), { sides: 7, rings: 4, seed });
  };
  [...BUSHES, ...GARDEN].forEach((b, i) => (b.kind === 'round' ? roundBush(b.x, b.y, b.r, b.h, 100 + i) : coneBush(b.x, b.y, b.r, b.h, 0, 100 + i)));
  coneBush(PLANTER.x, PLANTER.y, PLANTER.shrub.r, PLANTER.shrub.h, PLANTER.h - 0.02, 120);
  return m;
}

function planterAndBowl() {
  const m = new Mesher({ toneJitter: 0.03, seed: 13, shade: standShade });
  const P = PLANTER;
  boxW(m, P.x - P.w / 2, P.y - P.d / 2, 0, P.w, P.d, P.h, C.planter);
  boxW(m, P.x - P.w / 2 - 0.02, P.y - P.d / 2 - 0.02, P.h - 0.04, P.w + 0.04, P.d + 0.04, 0.04, C.planter, { tone: 1.04 });
  boxW(m, P.x - P.w / 2 + 0.04, P.y - P.d / 2 + 0.04, P.h - 0.03, P.w - 0.08, P.d - 0.08, 0.035, C.pot, { tone: 1 });
  // the water bowl: a lathed steel bowl and the water in it
  const B = BOWL;
  const prof = [[0.0, 0.012], [B.r - 0.045, 0.012], [B.r - 0.025, B.h], [B.r, B.h], [B.r - 0.012, 0.004], [B.r - 0.03, 0]];
  const g = new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), 14).toNonIndexed();
  const p = g.getAttribute('position');
  const c0 = W(B.x, B.y, 0);
  for (let i = 0; i < p.count; i += 3) {
    const a = V().fromBufferAttribute(p, i).add(c0), b = V().fromBufferAttribute(p, i + 1).add(c0), c = V().fromBufferAttribute(p, i + 2).add(c0);
    const cen = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const rr = Math.hypot(cen.x - c0.x, cen.z - c0.z);
    m.tri(a, b, c, rr < B.r - 0.03 ? C.bowlIn : C.bowl);
  }
  const wr = B.r - 0.034, wh = B.h * 0.62;
  for (let k = 0; k < 14; k++) {
    const a0 = (k / 14) * Math.PI * 2, a1 = ((k + 1) / 14) * Math.PI * 2;
    m.tri(W(B.x, B.y, wh), W(B.x + Math.cos(a0) * wr, B.y + Math.sin(a0) * wr, wh), W(B.x + Math.cos(a1) * wr, B.y + Math.sin(a1) * wr, wh), C.water, V(0, 1, 0), 1);
  }
  return m;
}

// The board as a group of meshes, each tagged: `ground` (the lawn and the path receive the cast shadows) or not.
// With a `mess` (mess.js, the check of the decals only): the lawn's cells tinted in place, the mess's flat pieces as
// ground and its objects as casters, exactly as the decals are rendered.
export function buildBoard({ mess = null } = {}) {
  const mat = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const grp = new THREE.Group();
  const mk = (m, { ground = false, cast = true, double = false, name = '' } = {}) => {
    const o = new THREE.Mesh(m.geometry(), mat());
    o.name = name;
    if (double) o.material.side = THREE.DoubleSide;
    o.castShadow = cast; o.receiveShadow = ground;
    o.userData.ground = ground;
    grp.add(o);
    return m.tris;
  };
  let tris = 0;
  tris += mk(lawn(mess, { inPlace: true }), { ground: true, cast: false, name: 'lawn' });
  tris += mk(garden(), { ground: true, cast: false, name: 'garden' });
  tris += mk(path(), { ground: true, cast: false, name: 'path' });
  tris += mk(slabSides(), { cast: false, name: 'slab' });
  tris += mk(fence(), { name: 'fence' });
  clubhouse().forEach((part, i) => { tris += mk(part, { name: ['walls', 'roof', 'door, step, window'][i] }); });
  tris += mk(plants(), { name: 'plants' });
  tris += mk(planterAndBowl(), { double: true, name: 'planter, bowl' }); // the lathed bowl is seen from inside and out
  if (mess) {
    if (mess.flats.tris) tris += mk(mess.flats, { ground: true, cast: false, name: 'mess flats' });
    if (mess.objects.tris) tris += mk(mess.objects, { double: true, name: 'mess objects' });
  }
  grp.userData.tris = tris;
  return grp;
}

// The decal's own meshes, tagged by role for its passes (render.js, renderDecal): the clean lawn (an occluder and the
// shadow's receiver), the tinted cells, the flat pieces (ground: they take shadows) and the objects (casters).
export function decalGroup(mess) {
  const mat = (double = false) => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    if (double) m.side = THREE.DoubleSide;
    return m;
  };
  const grp = new THREE.Group();
  const add = (m, role, { receive = false, cast = false, double = false } = {}) => {
    if (!m.tris) return;
    const o = new THREE.Mesh(m.geometry(), mat(double));
    o.name = role;
    o.userData.role = role;
    o.castShadow = cast; o.receiveShadow = receive;
    grp.add(o);
  };
  add(lawn(), 'lawn', { receive: true });
  add(lawn(mess), 'cells');
  add(mess.flats, 'flats', { receive: true });
  add(mess.objects, 'objects', { cast: true, double: true });
  return grp;
}

// The slab as one box, for its shadow on the page under it.
export function slabCaster() {
  const g = new THREE.BoxGeometry(SLAB.y1 - SLAB.y0, SLAB.depth, SLAB.x1 - SLAB.x0);
  const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false }));
  o.position.copy(W((SLAB.x0 + SLAB.x1) / 2, (SLAB.y0 + SLAB.y1) / 2, -SLAB.depth / 2));
  o.castShadow = true;
  return o;
}
