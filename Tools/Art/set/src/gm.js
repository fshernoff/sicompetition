// The GM: a faceted charcoal orb split by one band of amber light (D59), from spike B, reworked for G5d's three states
// (the status line's three; gate 7):
//   ready   the GM is getting ready: the band turned low, a faint warmth beside it.
//   running the GM is running the week: the band bright, a hot core line, its light on the shell's nearest facets.
//   done    the week is over: bright as running, the orb settled lower, a ring of light settled on the surface under it.
// No face, no limbs, no halo (nothing above or around the head), no chevron or arrow (never "up"). The band's edges
// are the shell's cut edges: crisp, with no 2D glow laid round them.
import * as THREE from 'three';
import { V, hash, sstep } from './lib.js';

export const GM = { r: 0.27, gap: 0.05, hover: 0.85, hoverDone: 0.4, ring: [0.31, 0.355] };
const AMBER = new THREE.Color('#FFB21E');
const CORE = new THREE.Color('#FFE2A6');
const DIM = new THREE.Color('#7C5A26');
const SHELL = [new THREE.Color('#3B4047'), new THREE.Color('#4B5159')];
const CUT = new THREE.Color('#141518');

// A faceted half-sphere, cut at the equator and pulled apart by the gap; `spill` (0 to 1) tints the facets nearest
// the band with its light. Returns the mesh and the rim: the cut's vertices, on one exact circle, in angle order.
function shell(top, spill, light = AMBER) {
  const src = new THREE.IcosahedronGeometry(GM.r, 2).toNonIndexed();
  const p = src.getAttribute('position');
  const pos = [], colr = [];
  const lit = light.clone().multiplyScalar(0.95);
  const y0 = top ? GM.gap / 2 : -GM.gap / 2, sgn = top ? 1 : -1;
  const rim = new Map();
  const tint = (base, d) => base.clone().lerp(lit, spill * (1 - sstep(0, 0.085, d)));
  const put = (v, c) => { pos.push(v.x, v.y, v.z); colr.push(c.r, c.g, c.b); };
  for (let i = 0; i < p.count; i += 3) {
    const vs = [0, 1, 2].map((k) => V().fromBufferAttribute(p, i + k));
    const cy = (vs[0].y + vs[1].y + vs[2].y) / 3;
    if (top ? cy < 0 : cy > 0) continue;
    const base = SHELL[0].clone().lerp(SHELL[1], hash(i, top ? 3 : 4) * 0.6);
    for (const v of vs) {
      // a vertex on or across the cut goes onto one exact circle
      if (top ? v.y <= 1e-6 : v.y >= -1e-6) {
        const k = (GM.r * 0.995) / Math.hypot(v.x, v.z);
        v.x *= k; v.z *= k; v.y = 0;
        rim.set(Math.round(Math.atan2(v.z, v.x) * 1e4), [v.x, v.z]);
      }
      v.y += y0;
      put(v, tint(base, Math.abs(v.y) - GM.gap / 2));
    }
  }
  const ring = [...rim.entries()].sort((a, b) => a[0] - b[0]).map(([, xz]) => xz);
  // a skirt from the rim inward, in the shell's colour, so no notch of the inside ever shows at the band's edges
  const skirt = SHELL[0].clone().lerp(SHELL[1], 0.3);
  for (let k = 0; k < ring.length; k++) {
    const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
    const A = V(ax, y0, az), B = V(bx, y0, bz), C = V(bx * 0.86, y0 + sgn * 0.05, bz * 0.86), D = V(ax * 0.86, y0 + sgn * 0.05, az * 0.86);
    const cl = tint(skirt, 0), cu = tint(skirt, 0.05);
    for (const [v, c] of top ? [[A, cl], [C, cu], [B, cl], [A, cl], [D, cu], [C, cu]] : [[A, cl], [B, cl], [C, cu], [A, cl], [C, cu], [D, cu]]) put(v, c);
  }
  // the cut face, a fan on the rim, so the inside never shows
  for (let k = 0; k < ring.length; k++) {
    const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
    const P0 = V(0, y0, 0), P1 = V(ax * 0.99, y0, az * 0.99), P2 = V(bx * 0.99, y0, bz * 0.99);
    for (const v of top ? [P0, P2, P1] : [P0, P1, P2]) put(v, CUT);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.computeVertexNormals();
  return { mesh: new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })), ring };
}

// The band: a strip on the rim's own polygon, so its edges are exactly the shells' cut edges. Unlit (it is the light).
function band(ring, scale, half, color) {
  const pos = [];
  for (let k = 0; k < ring.length; k++) {
    const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
    const A = [ax * scale, -half, az * scale], B = [bx * scale, -half, bz * scale], C = [bx * scale, half, bz * scale], D = [ax * scale, half, az * scale];
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
}

// The GM in a state, its ground point (the point it hovers over) at the origin. `hover` overrides the state's height.
export function buildGM(state = 'running', { hover } = {}) {
  const bright = state !== 'ready';
  const g = new THREE.Group();
  const orb = new THREE.Group();
  // ready: the band turned low, a faint warmth on the facets beside it; running and done: the band lit
  const upper = bright ? shell(true, 0.5) : shell(true, 0.14, DIM), lower = bright ? shell(false, 0.42) : shell(false, 0.12, DIM);
  orb.add(upper.mesh, lower.mesh);
  const g2 = GM.gap / 2;
  if (bright) {
    orb.add(band(upper.ring, 0.997, g2, AMBER));
    orb.add(band(upper.ring, 0.999, g2 * 0.34, CORE)); // the hot core line in the band's middle
  } else {
    orb.add(band(upper.ring, 0.997, g2, DIM));
  }
  const h = hover ?? (state === 'done' ? GM.hoverDone : GM.hover);
  orb.position.y = h + GM.r;
  g.add(orb);
  if (state === 'done') {
    // the settled ring: flat on the surface under the orb, the band's colour, crisp
    const ring = new THREE.Mesh(new THREE.RingGeometry(GM.ring[0], GM.ring[1], 96, 1), new THREE.MeshBasicMaterial({ color: AMBER, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    g.add(ring);
  }
  return g;
}
