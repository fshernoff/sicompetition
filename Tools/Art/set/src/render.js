// Page-side rendering: the board (a colour pass, the key light's shadows on the ground as a soft mask, the slab's
// shadow on the page, the grade) and the GM in its three states (one frame shared by the three, so they never jump).
/* global document */
import * as THREE from 'three';
import { V, W } from './lib.js';
import { KEY, PPM, SPRITE_SCALE, SS, makeRenderer, addLights, frame, screenBox, downsample, alphaBox, crop } from './stage.js';
import { slabCaster } from './board.js';
import { SLAB } from './layout.js';

// The shadow spec the board uses, which the yard's code shadows for the cast match (D59 gate 3).
export const SHADOW = { tint: [12, 30, 18], alpha: 0.3, blur: 1.6 }; // blur in px at the yard's 1x (x2 in the image)
export const MARGIN_PX = 24; // clear transparency round the board image

// Every vertex of an object in world space (a frame fitted to these is tight; a bounding box's corners are not).
function corners(obj) {
  obj.updateMatrixWorld(true);
  const pts = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) pts.push(V().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
  });
  return pts;
}

const canvas2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// A mask's alpha blurred and tinted: `px` blur, the result's colour `rgb` at `alpha`.
function tinted(mask, px, rgb, alpha) {
  const c = canvas2d(mask.width, mask.height);
  const g = c.getContext('2d');
  g.filter = `blur(${px}px)`;
  g.drawImage(mask, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = `rgba(${rgb.join(',')}, ${alpha})`;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// The grade every set image gets (gate 4: the set meets the cast's finish): a little less contrast and saturation, a
// little warmer. Alpha is untouched.
export function grade(canvas, { contrast = 0.95, saturation = 0.97, warm = 0.012 } = {}) {
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    r = l + (r - l) * saturation; gg = l + (gg - l) * saturation; b = l + (b - l) * saturation;
    r = 0.5 + (r - 0.5) * contrast; gg = 0.5 + (gg - 0.5) * contrast; b = 0.5 + (b - 0.5) * contrast;
    r *= 1 + warm; b *= 1 - warm * 1.5;
    d[i] = Math.round(Math.min(1, Math.max(0, r)) * 255);
    d[i + 1] = Math.round(Math.min(1, Math.max(0, gg)) * 255);
    d[i + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

// One pass with every mesh's material swapped by `pick(mesh) -> material | null` (null hides it), plus `extra` objects
// and an optional shadow-casting key light.
function pass(group, F, pick, { extra = [], light = null, lit = false } = {}) {
  const renderer = makeRenderer(F.w, F.h);
  renderer.shadowMap.enabled = !!light;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  if (lit) addLights(scene); // a colour pass (the decals'): the board's own lights
  const ghost = group.clone(true);
  ghost.traverse((o) => {
    if (!o.isMesh) return;
    const m = pick(o);
    if (m === null) o.visible = false; else o.material = m;
    // a depth-only occluder must be drawn before the ground: drawn after, it cannot take back ground already drawn
    // behind it, and the mask (and the shadow laid through it) would show through walls and posts
    o.renderOrder = m && m.colorWrite === false ? -1 : 0;
  });
  scene.add(ghost, ...extra);
  if (light) scene.add(light, light.target);
  renderer.render(scene, F.cam);
  const out = downsample(renderer.domElement, SS);
  renderer.dispose();
  return out;
}

function keyLight(centre, box) {
  const l = new THREE.DirectionalLight(0xffffff, 1);
  l.position.copy(centre).addScaledVector(KEY, 30);
  l.target.position.copy(centre);
  l.castShadow = true;
  l.shadow.mapSize.set(4096, 4096);
  Object.assign(l.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: 1, far: 80 });
  l.shadow.bias = -0.0006;
  l.shadow.radius = 2;
  return l;
}

// The yard's contact shadow under a figure (set.json's shadow.contactAlpha and contactBlur), for the mess's objects:
// soft ellipses on the ground, each a ground circle of radius r round (x, y) moved toward the lower right by (dx, dy)
// of its own size, in the shadow's tint; laid with the key light's shadows and kept to the ground with them.
export const CONTACT = { alpha: 0.42, blur: 2.6 }; // blur in px at the yard's 1x (x2 in these images)
function contactLayer(F, contacts, w, h) {
  const c = canvas2d(w, h), g = c.getContext('2d');
  g.fillStyle = '#000';
  const s = PPM * SPRITE_SCALE; // a ground circle of radius r is an ellipse r * s across and r * s / 2 high
  for (const { x, y, r, dx = 0.3, dy = 0.3 } of contacts) {
    const [px, py] = F.px(W(x, y, 0)).map((v) => v / SS);
    const a = r * s, b = (r * s) / 2;
    g.beginPath();
    g.ellipse(px + dx * a, py + dy * b, a, b, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tinted(c, CONTACT.blur * SPRITE_SCALE, SHADOW.tint, CONTACT.alpha);
}

// The board: returns the shipped (2x) canvas and the contract's map. `extra` are world points the image must contain
// (the GM's room over the roof). `contacts` (the check of the mess decals only): contact shadows, as contactLayer.
export function renderBoard(group, { extra = [], layers = null, contacts = null } = {}) {
  const ppm = PPM * SPRITE_SCALE * SS;
  group.updateMatrixWorld(true);
  // the slab's shadow on the page reaches past the slab: its footprint is part of the frame, with room for its blur
  const fall = KEY.clone().multiplyScalar(-SLAB.depth / KEY.y);
  const footprint = [[SLAB.x0, SLAB.y0], [SLAB.x1, SLAB.y0], [SLAB.x1, SLAB.y1], [SLAB.x0, SLAB.y1]].map(([x, y]) => W(x, y, 0).add(fall));
  const sb = screenBox([...corners(group), ...extra, ...footprint]);
  const F = frame(sb, ppm, 0.45);

  // the colour pass
  const colour = (() => {
    const renderer = makeRenderer(F.w, F.h);
    const scene = new THREE.Scene();
    addLights(scene);
    scene.add(group);
    renderer.render(scene, F.cam);
    const c = downsample(renderer.domElement, SS);
    scene.remove(group);
    renderer.dispose();
    return c;
  })();
  const W2 = colour.width, H2 = colour.height;
  const centre = W((SLAB.x0 + SLAB.x1) / 2, (SLAB.y0 + SLAB.y1) / 2, 0);
  const hidden = () => new THREE.MeshBasicMaterial({ colorWrite: false }); // still hides what is behind it

  // the key light's shadows on the ground (the lawn and the path), as a mask
  const shadowMask = pass(group, F, (o) => (o.userData.ground
    ? new THREE.ShadowMaterial({ color: 0x000000, opacity: 1 })
    : hidden()), { light: keyLight(centre, 8.5) });
  // where the ground shows, so a blurred shadow never spills onto a wall or a post
  const groundMask = pass(group, F, (o) => (o.userData.ground ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : hidden()));
  // the slab's shadow on the page under it
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x000000, opacity: 1 }));
  plane.position.y = -SLAB.depth;
  plane.receiveShadow = true;
  const pageMask = pass(group, F, () => null, { extra: [plane, slabCaster()], light: keyLight(centre, 9.5) });

  if (layers) Object.assign(layers, { colour, shadowMask, groundMask, pageMask });
  const out = canvas2d(W2, H2);
  const g = out.getContext('2d');
  g.drawImage(colour, 0, 0);
  const sh = tinted(shadowMask, SHADOW.blur * SPRITE_SCALE, SHADOW.tint, SHADOW.alpha);
  const sg = sh.getContext('2d');
  if (contacts && contacts.length) {
    sg.globalCompositeOperation = 'source-over'; // (tinted leaves its canvas in source-in)
    sg.drawImage(contactLayer(F, contacts, W2, H2), 0, 0);
  }
  sg.globalCompositeOperation = 'destination-in';
  sg.drawImage(groundMask, 0, 0);
  g.drawImage(sh, 0, 0);
  grade(out);
  // the page shadow goes under everything, softer and lighter (it is the page, not the lawn)
  const ps = tinted(pageMask, 6 * SPRITE_SCALE, [20, 28, 36], 0.16);
  g.globalCompositeOperation = 'destination-over';
  g.drawImage(ps, 0, 0);
  g.globalCompositeOperation = 'source-over';

  // at least MARGIN px of clear transparency on every side, the page shadow's faintest pixel included
  const box = alphaBox(out, 1);
  const pad = MARGIN_PX;
  const x0 = Math.max(0, box.x0 - pad), y0 = Math.max(0, box.y0 - pad);
  const cropped = crop(out, { x0, y0, x1: Math.min(W2 - 1, box.x1 + pad), y1: Math.min(H2 - 1, box.y1 + pad) });
  const px = (p) => { const [x, y] = F.px(p); return [x / SS - x0, y / SS - y0]; };
  // F and the crop's offset: the frame a decal is rendered through, and where its pixels land in the board image
  return { canvas: cropped, px, tris: group.userData.tris, F, offset: [x0, y0] };
}

// A mess decal (review round 2, row 15) through the board's own frame `F` and lights, so it lands exactly in the board's
// light and perspective; `offset` is the board's crop (renderBoard's). `group` is board.js's decalGroup: the clean lawn
// hides what sinks below it and takes the objects' shadows, never drawn; the flat pieces lie on it, the objects stand
// on it. The same passes as the board's: colour; the key light's shadows on the ground as a mask, blurred and laid at
// 30% in the deep green-black, with the yard's contact shadow under each object (group.userData.contacts), kept to the
// ground; the grade. The decal carries no lawn: only its pieces, with their own edge alpha, and their shadows, as the
// board's tint at the shadow's alpha. The board lays its shadows the same way (the tint over the lawn, then the grade,
// which is affine per channel, so it passes through the alpha), so laid on the shipped board a shadow darkens the
// board's own pixels exactly as the board's render darkens its lawn; everywhere else its alpha is 0 and the board is
// left exactly as it is.
// Returns the decal cropped to its faintest pixel plus `pad`, and `at`: the board-image pixel of its top-left corner.
export function renderDecal(group, F, offset, { pad = 2 } = {}) {
  group.updateMatrixWorld(true);
  const role = (o) => o.userData.role;
  const hidden = (o = {}) => new THREE.MeshBasicMaterial({ colorWrite: false, ...o });
  // the lawn writes depth only, exactly as the board's lawn stands, so it hides just what the board's lawn hides
  const colour = pass(group, F, (o) => (role(o) === 'lawn' ? hidden() : o.material), { lit: true });
  const centre = W((SLAB.x0 + SLAB.x1) / 2, (SLAB.y0 + SLAB.y1) / 2, 0);
  const shadowMask = pass(group, F, (o) => ({
    lawn: new THREE.ShadowMaterial({ color: 0x000000, opacity: 1 }),
    flats: new THREE.ShadowMaterial({ color: 0x000000, opacity: 1 }),
    objects: hidden(),
  })[role(o)], { light: keyLight(centre, 8.5) });
  const groundMask = pass(group, F, (o) => (role(o) === 'objects' ? hidden() : new THREE.MeshBasicMaterial({ color: 0xffffff })));

  const out = canvas2d(colour.width, colour.height);
  const g = out.getContext('2d');
  g.drawImage(colour, 0, 0);
  const sh = tinted(shadowMask, SHADOW.blur * SPRITE_SCALE, SHADOW.tint, SHADOW.alpha);
  const sg = sh.getContext('2d');
  const contacts = group.userData.contacts ?? [];
  if (contacts.length) {
    sg.globalCompositeOperation = 'source-over'; // (tinted leaves its canvas in source-in)
    sg.drawImage(contactLayer(F, contacts, out.width, out.height), 0, 0);
  }
  sg.globalCompositeOperation = 'destination-in';
  sg.drawImage(groundMask, 0, 0);
  g.drawImage(sh, 0, 0);
  grade(out);
  const box = alphaBox(out, 1);
  const b = { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad };
  return { canvas: crop(out, b), at: [b.x0 - offset[0], b.y0 - offset[1]] };
}

// The GM in its three states through one frame. `fit`: null for the yard (the yard's scale, the frame fitted to the
// three states and their anchor), or a square size in px for the page (the orb scaled to fill it, centred).
export function renderGM(build, states, { fit = null, pad = 0.05 } = {}) {
  const objs = Object.fromEntries(states.map((s) => [s, build(s)]));
  for (const o of Object.values(objs)) o.updateMatrixWorld(true);
  // the yard's frame runs down to the point the GM hovers over (its anchor, inside the image); the page's frame is
  // the orb alone, centred
  const sb = screenBox(Object.values(objs).flatMap(corners).concat(fit ? [] : [V(0, 0, 0)]));
  let F, ppmOut;
  if (fit) {
    const span = Math.max(sb.x1 - sb.x0, sb.y1 - sb.y0) + 2 * pad;
    ppmOut = fit / span;
    const cx = (sb.x0 + sb.x1) / 2, cy = (sb.y0 + sb.y1) / 2, half = fit / ppmOut / 2;
    F = frame({ x0: cx - half + pad, x1: cx + half - pad, y0: cy - half + pad, y1: cy + half - pad }, ppmOut * SS, pad, [fit * SS, fit * SS]);
  } else {
    ppmOut = PPM * SPRITE_SCALE;
    F = frame(sb, ppmOut * SS, pad);
  }
  const out = {};
  for (const s of states) {
    const renderer = makeRenderer(F.w, F.h);
    const scene = new THREE.Scene();
    addLights(scene);
    scene.add(objs[s]);
    renderer.render(scene, F.cam);
    const c = grade(downsample(renderer.domElement, SS), { contrast: 0.96, saturation: 0.97, warm: 0.008 });
    renderer.dispose();
    const a = F.px(V(0, 0, 0)).map((v) => v / SS);
    out[s] = { canvas: c, anchor: a, size: [c.width, c.height] };
  }
  return { states: out, ppm: ppmOut };
}
