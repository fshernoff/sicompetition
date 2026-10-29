// Low-poly geometry helpers (from spike B, G5d): a mesher that collects flat-shaded, vertex-coloured triangles with a
// per-vertex shade (the baked soft occlusion), faceted blobs and boxes, a stable hash, and the world axes.
import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// The art contract's world (src/assets/art/manifest.ts): metres on the lawn, x to the right-back, y to the left-back,
// h up, the origin at the lawn's front corner. three.js is y-up and its camera looks from +X +Z, so the contract's
// x is three's -Z and its y is three's -X (a proper rotation, so nothing is mirrored).
export const W = (x, y, h = 0) => V(-y, h, -x);

// A stable hash in [0, 1) from integers, so the same model rendered twice has the same facets. (Spike B's version left
// `h` a signed 32-bit int after the last xor, so it returned (-1, 1) and every jitter leaned negative; kept unsigned.)
export function hash(...n) {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    h = (h ^ ((v * 2654435761) >>> 0)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
  }
  return (h % 1000003) / 1000003;
}

// Smooth value noise in [0, 1] on the plane (for the lawn's low-frequency tone), from the hash.
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}

export const col = (hex) => new THREE.Color(hex);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const deg = (d) => (d * Math.PI) / 180;

export class Mesher {
  // shade(p, n) -> a multiplier for the vertex at world point p on a face with normal n (the baked occlusion).
  // tint(p, color) -> the colour at the vertex at p instead of the face's (the mess's trampled and wet grass, a soft
  // field like the occlusion); none keeps the face's colour at every vertex.
  constructor({ toneJitter = 0.06, seed = 1, shade = null, tint = null } = {}) {
    this.pos = [];
    this.col = [];
    this.n = 0;
    this.toneJitter = toneJitter;
    this.seed = seed;
    this.shade = shade;
    this.tint = tint;
  }
  // One triangle. `out` is a direction the face should point along, or null to keep the winding.
  tri(a, b, c, color, out = null, tone = null) {
    const A = a.clone(), B = b.clone(), C = c.clone();
    const n = V().subVectors(B, A).cross(V().subVectors(C, A));
    if (n.lengthSq() < 1e-14) return;
    if (out && n.dot(out) < 0) { B.copy(c); C.copy(b); n.negate(); }
    n.normalize();
    this.pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
    const j = tone ?? 1 + (hash(this.seed, this.n++, 31) - 0.5) * 2 * this.toneJitter;
    for (const p of [A, B, C]) {
      const k = j * (this.shade ? this.shade(p, n) : 1);
      const c = this.tint ? this.tint(p, color) : color;
      this.col.push(c.r * k, c.g * k, c.b * k);
    }
  }
  quad(a, b, c, d, color, out = null, tone = null) {
    const t = tone ?? 1 + (hash(this.seed, this.n++, 37) - 0.5) * 2 * this.toneJitter;
    this.tri(a, b, c, color, out, t);
    this.tri(a, c, d, color, out, t);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
  get tris() { return this.pos.length / 9; }
}

// A faceted blob (an icosahedron), scaled and placed at c (three.js space); color is a Color or fn(centroid) -> Color.
// `jitter` moves each vertex in or out by up to that fraction of the radius (the same vertex the same way, so the
// surface stays closed): an irregular, hand-made outline.
export function blob(m, c, r, color, { detail = 0, rot = null, tone = null, jitter = 0, seed = 0 } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.getAttribute('position');
  const S = new THREE.Matrix4().compose(c, rot ?? new THREE.Quaternion(), V(r[0], r[1], r[2]));
  const vert = (i) => {
    const u = V().fromBufferAttribute(p, i);
    if (jitter) u.multiplyScalar(1 + (hash(seed, Math.round(u.x * 997), Math.round(u.y * 991), Math.round(u.z * 983)) - 0.5) * 2 * jitter);
    return u.applyMatrix4(S);
  };
  for (let i = 0; i < p.count; i += 3) {
    const a = vert(i), b = vert(i + 1), cc = vert(i + 2);
    const cen = V().add(a).add(b).add(cc).multiplyScalar(1 / 3);
    m.tri(a, b, cc, typeof color === 'function' ? color(cen) : color, cen.clone().sub(c), tone);
  }
}

// A faceted cone (a conifer shrub): `sides` around, `rings` up, its apex at c + (0, h, 0), jittered.
export function cone(m, c, r, h, color, { sides = 7, rings = 3, seed = 1 } = {}) {
  const ring = (k) => {
    const t = k / rings, rr = r * (1 - t) ** 0.9, y = c.y + h * t;
    const out = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (k % 2 ? Math.PI / sides : 0);
      const s = 1 + (hash(seed, k, i) - 0.5) * 0.22;
      out.push(V(c.x + Math.cos(a) * rr * s, y + (hash(seed, k, i, 3) - 0.5) * h * 0.05, c.z + Math.sin(a) * rr * s));
    }
    return out;
  };
  const rs = [];
  for (let k = 0; k < rings; k++) rs.push(ring(k));
  const apex = V(c.x, c.y + h, c.z);
  const axis = (p) => V(p.x - c.x, 0, p.z - c.z);
  for (let k = 0; k < rings - 1; k++) {
    for (let i = 0; i < sides; i++) {
      const a = rs[k][i], b = rs[k][(i + 1) % sides], d = rs[k + 1][i], e = rs[k + 1][(i + 1) % sides];
      const mid = V().add(a).add(b).add(d).add(e).multiplyScalar(0.25);
      const clr = typeof color === 'function' ? color(mid) : color;
      m.tri(a, b, e, clr, axis(mid));
      m.tri(a, e, d, clr, axis(mid));
    }
  }
  for (let i = 0; i < sides; i++) {
    const a = rs[rings - 1][i], b = rs[rings - 1][(i + 1) % sides];
    const mid = V().add(a).add(b).add(apex).multiplyScalar(1 / 3);
    m.tri(a, b, apex, typeof color === 'function' ? color(mid) : color, axis(mid));
  }
  // the base, so the inside never shows
  for (let i = 0; i < sides; i++) m.tri(rs[0][i], rs[0][(i + 1) % sides], c, typeof color === 'function' ? color(c) : color, V(0, -1, 0));
}

// A box (three.js space) centred at c with size [sx, sy, sz], optionally rotated; colorFn(centroid, normal) -> Color.
export function box(m, c, size, color, { rot = null, colorFn = null, tone = null } = {}) {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed();
  const p = g.getAttribute('position');
  const S = new THREE.Matrix4().compose(c, rot ?? new THREE.Quaternion(), V(1, 1, 1));
  for (let i = 0; i < p.count; i += 3) {
    const a = V().fromBufferAttribute(p, i).applyMatrix4(S);
    const b = V().fromBufferAttribute(p, i + 1).applyMatrix4(S);
    const cc = V().fromBufferAttribute(p, i + 2).applyMatrix4(S);
    const cen = V().add(a).add(b).add(cc).multiplyScalar(1 / 3);
    const nrm = V().subVectors(b, a).cross(V().subVectors(cc, a)).normalize();
    m.tri(a, b, cc, colorFn ? colorFn(cen, nrm) : color, null, tone);
  }
}

// A box in the contract's world: x0..x0+wx along x, y0..y0+wy along y, h0..h0+hh up.
export function boxW(m, x0, y0, h0, wx, wy, hh, color, opts = {}) {
  box(m, W(x0 + wx / 2, y0 + wy / 2, h0 + hh / 2), [wy, hh, wx], color, opts);
}
