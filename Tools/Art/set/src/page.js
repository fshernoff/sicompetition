// What the driver calls in the page: the board, the GM (the yard's and the page's), and the composites that check the
// set against a cast by the contract's map alone.
/* global document, Image */
import * as THREE from 'three';
import { W } from './lib.js';
import { VIEW, KEY, PPM, SPRITE_SCALE, alphaBox, crop } from './stage.js';
import { buildBoard, decalGroup } from './board.js';
import { buildGM, GM } from './gm.js';
import { renderBoard, renderGM, renderDecal, SHADOW } from './render.js';
import { buildMess, combineMess } from './mess.js';
import { GM_SPOT, CLUB, LAWN, MARGIN, WALK, MESS, blocked } from './layout.js';

const png = (c) => c.toDataURL('image/png');
const webp = (c, q) => c.toDataURL('image/webp', q);
const r2 = (v) => Math.round(v * 100) / 100;

// Room over the roof for the GM at its highest, so the board image holds everything the yard draws on it.
function gmRoom() {
  const top = GM_SPOT.h + GM.hover + 2 * GM.r + 0.08;
  const extra = [];
  for (const dx of [-0.4, 0.4]) for (const dy of [-0.4, 0.4]) extra.push(W(GM_SPOT.x + dx, GM_SPOT.y + dy, top));
  return extra;
}

export function board({ quality = 0.9 } = {}) {
  const t0 = performance.now();
  const g = buildBoard();
  const extra = gmRoom();
  const r = renderBoard(g, { extra });
  const o = r.px(W(0, 0, 0)), ex = r.px(W(1, 0, 0)), ey = r.px(W(0, 1, 0)), eh = r.px(W(0, 0, 1));
  const spot = r.px(W(GM_SPOT.x, GM_SPOT.y, GM_SPOT.h));
  return {
    png: png(r.canvas), webp: webp(r.canvas, quality), size: [r.canvas.width, r.canvas.height], tris: r.tris,
    origin: o.map(r2), ppm: Math.hypot(ex[0] - o[0], ex[1] - o[1]),
    axes: { x: [ex[0] - o[0], ex[1] - o[1]].map(r2), y: [ey[0] - o[0], ey[1] - o[1]].map(r2), h: [eh[0] - o[0], eh[1] - o[1]].map(r2) },
    gmSpot: spot.map(r2), ms: Math.round(performance.now() - t0),
  };
}

// The mess decals (review round 2, row 15). The clean board is rendered again for its frame and its crop, and its WebP
// is returned so the driver can prove it is byte for byte the shipped board (the decals are only right on that board);
// then each decal through that frame: its image, its size and `at`, the board-image pixel of its top-left corner. With
// `check`: the board rendered with all three in place, to compare with the board and the decals laid on it.
export function mess({ quality = 0.9, boardQuality = 0.9 } = {}) {
  const t0 = performance.now();
  const extra = gmRoom();
  const b = renderBoard(buildBoard(), { extra });
  // the board with all three in place: where it equals the clean board, the mess changes nothing, and each decal's
  // alpha there is set to 0 (a sliver of an edge or a shadow's last tail that rounds to nothing on the render's lawn
  // could otherwise round to a level on the shipped board's)
  const all = combineMess(MESS.map((s) => buildMess(s.id)));
  const f = renderBoard(buildBoard({ mess: all }), { extra, contacts: all.contacts });
  const out = { board: { png: png(b.canvas), webp: webp(b.canvas, boardQuality), size: [b.canvas.width, b.canvas.height], offset: b.offset }, decals: [] };
  out.full = { png: png(f.canvas), size: [f.canvas.width, f.canvas.height], offset: f.offset };
  const Wb = b.canvas.width;
  const C = b.canvas.getContext('2d').getImageData(0, 0, Wb, b.canvas.height).data;
  const Fd = f.canvas.getContext('2d').getImageData(0, 0, Wb, f.canvas.height).data;
  for (const spec of MESS) {
    const m = buildMess(spec.id);
    const d = onlyWhereChanged(renderDecal(decalGroup(m), b.F, b.offset), C, Fd, Wb);
    out.decals.push({ id: spec.id, below: spec.below, png: png(d.canvas), webp: webp(d.canvas, quality), size: [d.canvas.width, d.canvas.height], at: d.at, blocked: m.blocked ?? [], top: m.top, cleared: d.cleared });
  }
  out.ms = Math.round(performance.now() - t0);
  return out;
}

// A decal's alpha set to 0 wherever the board rendered with the mess (Fd) equals the clean board (C), both RGBA in the
// board image's pixels, W wide; then cropped again to its faintest pixel plus 2 px.
function onlyWhereChanged({ canvas, at }, C, Fd, W, pad = 2) {
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const D = img.data;
  let cleared = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const k = (y * canvas.width + x) * 4, i = ((y + at[1]) * W + x + at[0]) * 4;
    if (!D[k + 3]) continue;
    if (C[i] === Fd[i] && C[i + 1] === Fd[i + 1] && C[i + 2] === Fd[i + 2] && C[i + 3] === Fd[i + 3]) { D[k] = D[k + 1] = D[k + 2] = D[k + 3] = 0; cleared++; }
  }
  g.putImageData(img, 0, 0);
  const box = alphaBox(canvas, 1);
  const bx = { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad };
  return { canvas: crop(canvas, bx), at: [at[0] + bx.x0, at[1] + bx.y0], cleared };
}

// The check: the board with the decals laid on it at their `at` (as the yard would, pixel for pixel at the image's
// scale) against the board rendered with the mess in place. Inside each decal's box and outside every box, the largest
// and the mean difference per channel, and how many pixels differ by more than 4; a heat map of the difference (x8).
export async function checkMess({ boardFile, decals, fullFile, cleanFile }) {
  const [bimg, fimg, cimg, ...dimgs] = await Promise.all([load(boardFile), load(fullFile), load(cleanFile), ...decals.map((d) => load(d.file))]);
  const w = bimg.width, h = bimg.height;
  const comp = canvas2d(w, h), cg = comp.getContext('2d');
  cg.drawImage(bimg, 0, 0);
  dimgs.forEach((im, i) => cg.drawImage(im, decals[i].at[0], decals[i].at[1]));
  const full = canvas2d(w, h), fg = full.getContext('2d');
  fg.drawImage(fimg, 0, 0);
  const A = cg.getImageData(0, 0, w, h).data, B = fg.getImageData(0, 0, w, h).data;
  // exactness: in each decal's box, the pixels the mess leaves alone (the lossless renders with and without it agree in
  // every channel) must come out of the composite exactly as the board went in
  const cc = canvas2d(w, h), ccg = cc.getContext('2d');
  ccg.drawImage(cimg, 0, 0);
  const Cl = ccg.getImageData(0, 0, w, h).data;
  const bb = canvas2d(w, h), bbg = bb.getContext('2d');
  bbg.drawImage(bimg, 0, 0);
  const Bd = bbg.getImageData(0, 0, w, h).data;
  const exact = decals.map((d) => {
    let unchanged = 0, moved = 0, mess = 0;
    for (let y = d.at[1]; y < d.at[1] + d.size[1]; y++) for (let x = d.at[0]; x < d.at[0] + d.size[0]; x++) {
      const i = (y * w + x) * 4;
      if (B[i] === Cl[i] && B[i + 1] === Cl[i + 1] && B[i + 2] === Cl[i + 2] && B[i + 3] === Cl[i + 3]) {
        unchanged++;
        if (A[i] !== Bd[i] || A[i + 1] !== Bd[i + 1] || A[i + 2] !== Bd[i + 2] || A[i + 3] !== Bd[i + 3]) moved++;
      } else mess++;
    }
    return { file: d.file, unchanged, moved, mess };
  });
  const boxes = decals.map((d) => [d.at[0], d.at[1], d.at[0] + d.size[0], d.at[1] + d.size[1]]);
  const zone = (x, y) => boxes.findIndex(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
  const stats = [...decals.map((d) => ({ zone: d.file })), { zone: 'outside the decals' }].map((z) => ({ ...z, max: 0, sum: 0, n: 0, over4: 0 }));
  const heat = cg.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let m = 0;
    for (let c = 0; c < 4; c++) m = Math.max(m, Math.abs(A[i + c] - B[i + c]));
    const z = zone(x, y);
    const st = stats[z < 0 ? stats.length - 1 : z];
    st.max = Math.max(st.max, m); st.sum += m; st.n++; if (m > 4) st.over4++;
    heat.data[i] = Math.min(255, m * 8); heat.data[i + 1] = Math.min(255, m * 8); heat.data[i + 2] = Math.min(255, m * 8); heat.data[i + 3] = 255;
  }
  const hc = canvas2d(w, h);
  hc.getContext('2d').putImageData(heat, 0, 0);
  // each decal on its own: its border clear (nothing cut off); its opaque pixels against the full render; its partly
  // clear pixels much darker than an opaque neighbour (a dark fringe)
  const edges = dimgs.map((im, i) => {
    const c = canvas2d(im.width, im.height), g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    const D = g.getImageData(0, 0, im.width, im.height).data, iw = im.width, ih = im.height;
    const [ox, oy] = decals[i].at;
    const luma = (k) => 0.299 * D[k] + 0.587 * D[k + 1] + 0.114 * D[k + 2];
    let border = 0, opaque = 0, worst = 0, partial = 0, dark = 0;
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      const k = (y * iw + x) * 4, a = D[k + 3];
      if (x === 0 || y === 0 || x === iw - 1 || y === ih - 1) border = Math.max(border, a);
      if (!a) continue;
      if (a === 255) {
        opaque++;
        const f = ((y + oy) * w + x + ox) * 4;
        for (let ch = 0; ch < 3; ch++) worst = Math.max(worst, Math.abs(D[k + ch] - B[f + ch]));
        continue;
      }
      partial++;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([u, v]) => u >= 0 && v >= 0 && u < iw && v < ih && D[(v * iw + u) * 4 + 3] === 255);
      if (nb.length && Math.min(...nb.map(([u, v]) => luma((v * iw + u) * 4))) - luma(k) > 40) dark++;
    }
    return { file: decals[i].file, border, opaque, worstOpaque: worst, partial, darkFringe: dark };
  });
  return { stats: stats.map(({ zone, max, sum, n, over4 }) => ({ zone, max, mean: Math.round((sum / n) * 1000) / 1000, over4 })), exact, edges, heat: png(hc), composite: png(comp) };
}

// The board's layers before they are combined (a diagnostic for the art QA).
export function boardLayers() {
  const layers = {};
  renderBoard(buildBoard(), { layers });
  return Object.fromEntries(Object.entries(layers).map(([k, c]) => [k, png(c)]));
}

const STATES = ['ready', 'running', 'done'];

// The yard's GM: the yard's scale (2x), one frame for the three states, anchored on the point it hovers over.
export function gmYard({ quality = 0.92 } = {}) {
  const r = renderGM((s) => buildGM(s), STATES);
  return Object.fromEntries(STATES.map((s) => {
    const x = r.states[s];
    return [s, { png: png(x.canvas), webp: webp(x.canvas, quality), size: x.size, anchor: x.anchor.map(r2) }];
  }));
}

// The page's GM: `fit` px square (2x of the page's size), the orb centred in it, in the same place in every state.
export function gmPage({ fit = 128, quality = 0.92 } = {}) {
  const r = renderGM((s) => buildGM(s), STATES, { fit, pad: 0.1 });
  return Object.fromEntries(STATES.map((s) => {
    const x = r.states[s];
    return [s, { png: png(x.canvas), webp: webp(x.canvas, quality), size: x.size, anchor: x.anchor.map(r2) }];
  }));
}

// --- the depth audit ---------------------------------------------------------------------------------------------
// The yard draws every figure over the board, so a figure must never stand where something on the board is in front of
// it. From every place a figure may stand (the lawn inside the margin and off the blocked rectangles, and the walk
// strip), rays go toward the camera from points of a figure's volume (up to 0.6 m either side on the screen and 0.9 m
// up for a dog, 0.3 m and 1.8 m for the crew); any that hits the board's fence, clubhouse, plants or props is a fault.
export function audit({ step = 0.15 } = {}) {
  const t0 = performance.now();
  const g = buildBoard();
  g.updateMatrixWorld(true);
  const targets = [];
  g.traverse((o) => { if (o.isMesh && !o.userData.ground) { o.material.side = THREE.DoubleSide; targets.push(o); } });
  const rc = new THREE.Raycaster();
  const probes = [];
  // the paws, the body and the head of a dog (a golden is about 1.2 m across on the screen), the crew to 1.8 m
  for (const o of [-0.35, 0, 0.35]) probes.push([o, 0.04]);
  for (const h of [0.3, 0.6]) for (const o of [-0.6, -0.3, 0, 0.3, 0.6]) probes.push([o, h]);
  for (const o of [-0.45, 0, 0.45]) probes.push([o, 0.9]);
  for (const h of [1.2, 1.5, 1.8]) for (const o of [-0.25, 0, 0.25]) probes.push([o, h]);
  const B = blocked(0.2);
  const inB = (x, y) => B.some(([bx, by, bw, bh]) => x >= bx && x <= bx + bw && y >= by && y <= by + bh);
  const spots = [];
  for (let x = MARGIN; x <= LAWN[0] - MARGIN + 1e-9; x += step) for (let y = MARGIN; y <= LAWN[1] - MARGIN + 1e-9; y += step) if (!inB(x, y)) spots.push([x, y]);
  for (let x = WALK[0]; x <= WALK[0] + WALK[2] + 1e-9; x += step) for (const y of [WALK[1], WALK[1] + WALK[3] / 2, WALK[1] + WALK[3]]) spots.push([x, y]);
  const faults = [];
  for (const [x, y] of spots) {
    for (const [o, h] of probes) {
      rc.set(W(x, y, h).addScaledVector(VIEW.right, o), VIEW.d);
      // anything lower than 8 cm (the door's step, the curb, the bowl's rim) is stood on, not hidden behind
      const hit = rc.intersectObjects(targets, false).find((i) => i.point.y > 0.08);
      if (hit) { faults.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, o, h, hit.object.name]); break; }
    }
  }
  return { spots: spots.length, rays: probes.length, faults: faults.length, first: faults.slice(0, 12), ms: Math.round(performance.now() - t0) };
}

// The depth audit for the mess: from every place a figure may stand (the lawn inside the margin, off the board's blocked
// rectangles and off the decal's own), the same rays as audit(); any that hits a decal's object higher than 8 cm is a
// fault (the yard draws every figure over the decals).
export function auditMess({ step = 0.15 } = {}) {
  const t0 = performance.now();
  const rc = new THREE.Raycaster();
  const probes = [];
  for (const o of [-0.35, 0, 0.35]) probes.push([o, 0.04]);
  for (const h of [0.3, 0.6]) for (const o of [-0.6, -0.3, 0, 0.3, 0.6]) probes.push([o, h]);
  for (const o of [-0.45, 0, 0.45]) probes.push([o, 0.9]);
  for (const h of [1.2, 1.5, 1.8]) for (const o of [-0.25, 0, 0.25]) probes.push([o, h]);
  return MESS.map((spec) => {
    const m = buildMess(spec.id);
    const mesh = new THREE.Mesh(m.objects.geometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld(true);
    const B = [...blocked(0.2), ...(m.blocked ?? [])];
    const inB = (x, y) => B.some(([bx, by, bw, bh]) => x >= bx && x <= bx + bw && y >= by && y <= by + bh);
    let spots = 0, faults = 0;
    for (let x = MARGIN; x <= LAWN[0] - MARGIN + 1e-9; x += step) for (let y = MARGIN; y <= LAWN[1] - MARGIN + 1e-9; y += step) {
      if (inB(x, y)) continue;
      spots++;
      for (const [o, h] of probes) {
        rc.set(W(x, y, h).addScaledVector(VIEW.right, o), VIEW.d);
        if (rc.intersectObject(mesh, false).some((i) => i.point.y > 0.08)) { faults++; break; }
      }
    }
    let top = 0;
    for (let i = 1; i < m.objects.pos.length; i += 3) top = Math.max(top, m.objects.pos[i]);
    return { id: spec.id, top: Math.round(top * 1000) / 1000, blocked: m.blocked ?? [], spots, faults };
  }).concat([{ ms: Math.round(performance.now() - t0) }]);
}

// --- composites ------------------------------------------------------------------------------------------------------
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
const canvas2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function mirrored(img) {
  const c = canvas2d(img.width, img.height);
  const g = c.getContext('2d');
  g.translate(img.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0);
  return c;
}

// A flat sprite's shadow (the hybrid's spec, the yard's to match): the sprite thrown along the key light's ground
// direction as a card standing at its anchor, blurred like the board's shadows, plus a soft contact ellipse.
function projectedShadow(img, ax, ay, s) {
  const el = Math.sqrt(1 - VIEW.d.y * VIEW.d.y);
  const gdir = new THREE.Vector3(-KEY.x / KEY.y, 0, -KEY.z / KEY.y);
  const A = gdir.dot(VIEW.right) / el, B = -gdir.dot(VIEW.up) / el;
  const w = img.width * s, h = img.height * s, pad = 40 * s;
  const Wc = Math.ceil(w + h * Math.abs(A) + 2 * pad), Hc = Math.ceil(h * Math.abs(B) + 2 * pad + 20 * s);
  const ox = pad + ax * s + h * Math.max(0, -A), oy = pad + h * Math.max(0, -B);
  const c = canvas2d(Wc, Hc);
  const cg = c.getContext('2d');
  cg.setTransform(s, 0, -A * s, -B * s, ox - ax * s + A * ay * s, oy + B * ay * s);
  cg.drawImage(img, 0, 0);
  cg.setTransform(1, 0, 0, 1, 0, 0);
  const tint = (src, px, alpha) => {
    const t = canvas2d(Wc, Hc), tg = t.getContext('2d');
    tg.filter = `blur(${px}px)`; tg.drawImage(src, 0, 0); tg.filter = 'none';
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = `rgba(${SHADOW.tint.join(',')}, ${alpha})`; tg.fillRect(0, 0, Wc, Hc);
    return t;
  };
  const cast = tint(c, SHADOW.blur * s * 2, SHADOW.alpha);
  const e = canvas2d(Wc, Hc), eg = e.getContext('2d');
  eg.fillStyle = '#000';
  eg.beginPath(); eg.ellipse(ox + (w / 2 - ax * s) * 0.5, oy - 2 * s, w * 0.42, w * 0.11, 0, 0, Math.PI * 2); eg.fill();
  const contact = tint(e, 2.6 * s * 2, 0.42);
  const out = canvas2d(Wc, Hc), og = out.getContext('2d');
  const d1 = cast.getContext('2d').getImageData(0, 0, Wc, Hc).data, d2 = contact.getContext('2d').getImageData(0, 0, Wc, Hc).data;
  const im = og.createImageData(Wc, Hc);
  for (let i = 0; i < d1.length; i += 4) {
    const a = 1 - (1 - d1[i + 3] / 255) * (1 - d2[i + 3] / 255);
    im.data[i] = SHADOW.tint[0]; im.data[i + 1] = SHADOW.tint[1]; im.data[i + 2] = SHADOW.tint[2]; im.data[i + 3] = Math.round(a * 255);
  }
  og.putImageData(im, 0, 0);
  return { canvas: out, ax: ox, ay: oy };
}

// The board and a cast placed by the contract's map only (origin, ppm, the 2:1 axes), as the yard would place them.
// k: 0.5 draws the yard's 1x, 1 the 2x. figures: {file, anchor, scale, mirror, world: [x, y]}. gm: {file, anchor}.
// decals: the mess, {file, at, size}, drawn over the board at its scale and under every figure.
export async function compose({ k = 0.5, boardFile, map, gmSpot, figures, gm, decals = [], bg = '#E9EDF0', margin = 24 }) {
  const bimg = await load(boardFile);
  const Wc = Math.round(bimg.width * k) + 2 * margin, Hc = Math.round(bimg.height * k) + 2 * margin;
  const c = canvas2d(Wc, Hc);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.fillStyle = bg; g.fillRect(0, 0, Wc, Hc);
  g.drawImage(bimg, margin, margin, bimg.width * k, bimg.height * k);
  for (const d of decals) g.drawImage(await load(d.file), margin + d.at[0] * k, margin + d.at[1] * k, d.size[0] * k, d.size[1] * k);
  const ax = (map.ppm * 2) / Math.sqrt(5), ay = map.ppm / Math.sqrt(5);
  const toPx = ([x, y]) => [margin + (map.origin[0] + (x - y) * ax) * k, margin + (map.origin[1] - (x + y) * ay) * k];
  const placed = [];
  for (const f of figures) {
    let img = await load(f.file);
    let anchor = f.anchor;
    if (f.mirror) { img = mirrored(img); anchor = [img.width - f.anchor[0], f.anchor[1]]; }
    const [x, y] = toPx(f.world);
    placed.push({ ...f, img, anchor, x, y, s: (f.scale ?? 1) * k, depth: f.world[0] + f.world[1] });
  }
  for (const f of placed) {
    const sh = projectedShadow(f.img, f.anchor[0], f.anchor[1], f.s);
    g.drawImage(sh.canvas, f.x - sh.ax, f.y - sh.ay);
  }
  placed.sort((a, b) => b.depth - a.depth);
  // every figure's opaque pixels, to find any two that touch (a real overlap, not a box overlap)
  const owner = new Int16Array(Wc * Hc).fill(-1);
  const touches = new Map();
  placed.forEach((f, i) => {
    const x = f.x - f.anchor[0] * f.s, y = f.y - f.anchor[1] * f.s;
    g.drawImage(f.img, x, y, f.img.width * f.s, f.img.height * f.s);
    const t = canvas2d(Wc, Hc), tg = t.getContext('2d');
    tg.drawImage(f.img, x, y, f.img.width * f.s, f.img.height * f.s);
    const d = tg.getImageData(0, 0, Wc, Hc).data;
    for (let p = 0; p < owner.length; p++) {
      if (d[p * 4 + 3] < 40) continue;
      if (owner[p] >= 0) { const key = `${placed[owner[p]].name} / ${f.name}`; touches.set(key, (touches.get(key) ?? 0) + 1); }
      owner[p] = i;
    }
  });
  if (gm) {
    const img = await load(gm.file);
    const [sx, sy] = [margin + gmSpot[0] * k, margin + gmSpot[1] * k];
    // the GM's shadow on the roof, a soft round contact shadow as the yard would draw it
    const rw = GM.r * PPM * SPRITE_SCALE * k * 1.05;
    const e = canvas2d(Wc, Hc), eg = e.getContext('2d');
    eg.filter = `blur(${5 * k * 2}px)`;
    eg.fillStyle = 'rgba(20, 22, 26, 0.26)';
    eg.beginPath(); eg.ellipse(sx, sy, rw, rw * 0.5, 0, 0, Math.PI * 2); eg.fill();
    g.drawImage(e, 0, 0);
    g.drawImage(img, sx - gm.anchor[0] * k, sy - gm.anchor[1] * k, img.width * k, img.height * k);
  }
  return { png: png(c), size: [Wc, Hc], touches: Object.fromEntries(touches), club: CLUB };
}

// A frame the size of the page's yard at 1366 x 768 (the rail to its left), the board scaled to fit it: a preview of
// the scale the yard will most likely draw, nothing more.
export async function pageFit({ compositeFile, boardSize, k = 0.5, margin = 24, rail = 540, bar = 52 }) {
  const img = await load(compositeFile);
  const c = canvas2d(1366, 768), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.fillStyle = '#E9EDF0'; g.fillRect(0, 0, 1366, 768);
  const yw = 1366 - rail, yh = 768 - bar;
  const bw = boardSize[0] * k, bh = boardSize[1] * k;
  const f = Math.min((yw - 16) / bw, (yh - 16) / bh);
  const dx = rail + (yw - bw * f) / 2, dy = bar + (yh - bh * f) / 2;
  g.drawImage(img, margin, margin, bw, bh, dx, dy, bw * f, bh * f);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, bar, rail, yh);
  g.fillStyle = '#13212F'; g.fillRect(0, 0, 1366, bar);
  return { png: png(c), scale: f };
}

// The page's GM on the page's three surfaces (white, the steel page, the navy bar) at 1x and 2x.
export async function gmSheet({ files }) {
  const imgs = await Promise.all(files.map(load));
  const bgs = ['#FFFFFF', '#E9EDF0', '#13212F'];
  const cell = Math.max(150, ...imgs.map((i) => Math.max(i.width, i.height) + 24));
  const c = canvas2d(cell * imgs.length * 2, cell * bgs.length), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  bgs.forEach((bg, j) => {
    g.fillStyle = bg; g.fillRect(0, j * cell, c.width, cell);
    imgs.forEach((im, i) => {
      g.drawImage(im, i * cell + (cell - im.width / 2) / 2, j * cell + (cell - im.height / 2) / 2, im.width / 2, im.height / 2);
      const x2 = (imgs.length + i) * cell;
      g.drawImage(im, x2 + (cell - im.width) / 2, j * cell + (cell - im.height) / 2);
    });
  });
  return { png: png(c) };
}

