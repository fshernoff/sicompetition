// The one camera and the one light (gate 1; from spike B). The board and the GM are rendered through these; the cast
// is generated against the same camera spec (src/assets/art/manifest.ts, CAMERA).
/* global document */
import * as THREE from 'three';
import { V } from './lib.js';

// Orthographic, azimuth 45 degrees, elevation 30 degrees: a 2:1 isometric (ground lines at 26.57 degrees).
export const CAM = { az: 45, el: 30 };
export const PPM = 88; // orthographic pixels per metre at the yard's 1x (spike B's scale, which the hybrid's cast matches)
export const SPRITE_SCALE = 2; // everything ships at 2x the yard's CSS size
export const SS = 2; // rendered at 2x the shipped size and box-downsampled

const camDir = () => {
  const az = THREE.MathUtils.degToRad(CAM.az), el = THREE.MathUtils.degToRad(CAM.el);
  return V(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
};
export const VIEW = (() => {
  const d = camDir();
  const right = V().crossVectors(V(0, 1, 0), d).normalize(); // screen right
  const up = V().crossVectors(d, right).normalize();
  return { d, right, up };
})();

// The key light: from the screen's upper left and a little towards the viewer, 55 degrees up (shadows fall right and a
// little back). Unchanged from spike B, so the set and the spike's cast shadows agree.
export const KEY = (() => {
  const toward = V(VIEW.d.x, 0, VIEW.d.z).normalize();
  const h = VIEW.right.clone().multiplyScalar(-0.82).addScaledVector(toward, 0.42).normalize();
  const el = THREE.MathUtils.degToRad(55);
  return h.multiplyScalar(Math.cos(el)).add(V(0, Math.sin(el), 0)).normalize();
})();

// Toward the cast's finish (gate 4): a warmer key, a softer key-to-fill ratio (lower contrast), a warm bounce.
export const LIGHT = {
  key: { color: '#FFEBD0', intensity: 1.85 },
  sky: '#E4E9EE', ground: '#B9B07E', ambient: 1.62,
};

export function makeRenderer(w, h) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NoToneMapping;
  return r;
}

export function addLights(scene, { keyIntensity } = {}) {
  scene.add(new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.ambient));
  const key = new THREE.DirectionalLight(LIGHT.key.color, keyIntensity ?? LIGHT.key.intensity);
  key.position.copy(KEY).multiplyScalar(20);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);
  return key;
}

// An orthographic camera looking at `centre`, framing w x h pixels at `ppm` pixels per metre.
export function makeCamera(centre, w, h, ppm) {
  const cam = new THREE.OrthographicCamera(-w / 2 / ppm, w / 2 / ppm, h / 2 / ppm, -h / 2 / ppm, 0.1, 200);
  cam.position.copy(centre).addScaledVector(VIEW.d, 60);
  cam.up.set(0, 1, 0);
  cam.lookAt(centre);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

// Screen-space (metres) extent of a set of points, on the camera's right and up axes.
export function screenBox(points) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) {
    const x = p.dot(VIEW.right), y = p.dot(VIEW.up);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
}

// A frame: a camera and a canvas size covering screen box `sb` (metres) plus `pad`, at `ppm` (or exactly `size`,
// centred on the box); px(p) maps a point to the rendered canvas's pixels.
export function frame(sb, ppm, pad, size = null) {
  let w = Math.ceil((sb.x1 - sb.x0 + 2 * pad) * ppm - 1e-6), h = Math.ceil((sb.y1 - sb.y0 + 2 * pad) * ppm - 1e-6);
  w += w % 4 ? 4 - (w % 4) : 0; h += h % 4 ? 4 - (h % 4) : 0;
  if (size) [w, h] = size;
  const cx = (sb.x0 + sb.x1) / 2, cy = (sb.y0 + sb.y1) / 2;
  const centre = VIEW.right.clone().multiplyScalar(cx).addScaledVector(VIEW.up, cy);
  const cam = makeCamera(centre, w, h, ppm);
  const px = (p) => [(p.dot(VIEW.right) - cx) * ppm + w / 2, -(p.dot(VIEW.up) - cy) * ppm + h / 2];
  return { w, h, cam, px };
}

// Downsample a canvas by `f` (box steps of 2) into a 2D canvas.
export function downsample(src, f) {
  let cur = src, w = src.width, h = src.height;
  while (f > 1) {
    const c = document.createElement('canvas');
    c.width = Math.round(w / 2); c.height = Math.round(h / 2);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c; w = c.width; h = c.height; f /= 2;
  }
  if (cur === src) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0);
    cur = c;
  }
  return cur;
}

export function alphaBox(canvas, thr = 1) {
  const { data, width: w, height: h } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] >= thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function crop(canvas, b, pad = 0) {
  const c = document.createElement('canvas');
  c.width = b.x1 - b.x0 + 1 + 2 * pad; c.height = b.y1 - b.y0 + 1 + 2 * pad;
  c.getContext('2d').drawImage(canvas, b.x0 - pad, b.y0 - pad, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}
