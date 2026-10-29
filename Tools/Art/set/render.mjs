// The set's driver (G5d WP4b): serves the repo, opens Tools/Art/set/index.html in headless Chromium (Playwright's, from
// the repo's devDependencies), renders the board and the GM through the one camera, and writes:
//   src/assets/art/set/board.webp, gm-{ready,running,done}.webp, gm-page-{ready,running,done}.webp
//   src/assets/art/set.json (the contract's SetManifest, src/assets/art/manifest.ts, plus documented extras)
//   src/assets/art/set/mess-{mud,kibble,bowl}.webp (the mess decals, review round 2, row 15)
//   Temp/set/: the lossless PNG masters, the composites with spike A's cast at 1x and 2x, the page-fit preview, the
//   page GM sheet.
// Run from the repo root:  node Tools/Art/set/render.mjs [all|compose|cast|mess]
//   mess: only the decals, through the board's frame, after proving the board it renders is byte for byte the shipped
//   board.webp (never rewritten in this mode); set.json's `mess` list and its note patched in place; the check against
//   the board rendered with the mess in place; the composites in Temp/set/mess-*.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAWN, MARGIN, PATH, WALK, blocked } from './src/layout.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const ART = path.join(ROOT, 'src/assets/art');
const OUT = path.join(ART, 'set');
const TEMP = path.join(ROOT, 'Temp/set');
const mode = process.argv[2] ?? 'all';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
await page.goto(`${base}/Tools/Art/set/index.html`);
await page.waitForFunction(() => window.SET_READY === true, null, { timeout: 30000 });

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TEMP, { recursive: true });
const write = (file, dataUrl) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return fs.statSync(file).size;
};
const rel = (f) => path.relative(ROOT, f);
const call = (fn, arg) => page.evaluate(([f, a]) => window.SET[f](a), [fn, arg]);

const STATES = ['ready', 'running', 'done'];
const r3 = (v) => Math.round(v * 1000) / 1000;
const setFile = path.join(ART, 'set.json');

// --- the mess (review round 2, row 15) ------------------------------------------------------------------------------
const MESS_Q = 1; // the decals' WebP: Chromium encodes quality 1 losslessly (lossy put a grey fringe on their soft edges)
const MESS_NOTE = "mess: the decals the yard lays on the board by the frame's cleanliness (D60: state, nothing invented), each shown while cleanliness is under `below` (so under 10 all three show): drawn with its top-left corner on the board-image pixel `at`, at the board's own scale, over the board and under every figure. Each carries no lawn: only its pieces (with their own edge alpha) and their shadows (the board's shadow tint at the shadow's alpha, the yard's contact shadow under each object), rendered through the board's own frame, light and grade; its alpha is 0 wherever the mess changes nothing, so laid on board.webp it leaves every other pixel exactly as it is. Anything in one higher than 8 cm (the bowl on its side, 24 cm) comes with `blocked`: [x, y, w, h] in world metres, padded as map.blocked, where no figure may stand while the decal shows.";
async function renderMess() {
  const r = await call('mess', { quality: MESS_Q, boardQuality: 0.9 });
  const shipped = fs.readFileSync(path.join(OUT, 'board.webp'));
  const mine = Buffer.from(r.board.webp.split(',')[1], 'base64');
  if (!mine.equals(shipped)) throw new Error(`the board rendered for the decals is not the shipped board.webp (${mine.length} B against ${shipped.length} B): the decals would not match it`);
  console.log(`mess: the board rendered again is byte for byte the shipped board.webp (${shipped.length} B), its crop offset ${r.board.offset}`);
  write(path.join(TEMP, 'mess-board.png'), r.board.png);
  if (r.full) {
    if (r.full.offset.join() !== r.board.offset.join()) throw new Error(`the board with the mess in place has another crop (${r.full.offset} against ${r.board.offset})`);
    write(path.join(TEMP, 'mess-full.png'), r.full.png);
  }
  const list = r.decals.map((d) => {
    const file = `set/mess-${d.id}.webp`;
    const bytes = write(path.join(ART, file), d.webp);
    write(path.join(TEMP, `mess-${d.id}.png`), d.png);
    write(path.join(TEMP, `mess-shadow-${d.id}.png`), d.shadow); // the shadow layer alone, the decal's crop
    console.log(`${file} ${d.size.join(' x ')} at ${d.at} below ${d.below}: ${bytes} B (${d.cleared} px cleared where the mess changes nothing)`);
    return { id: d.id, file, size: d.size, at: d.at, below: d.below, ...(d.blocked.length ? { blocked: d.blocked } : {}) };
  });
  console.log(`mess renders ${r.ms} ms in the page`);
  const au = await call('auditMess', { step: 0.15 });
  for (const x of au.filter((q) => q.id)) console.log(`depth audit, ${x.id}: tallest ${x.top} m, blocked ${JSON.stringify(x.blocked)}; ${x.spots} places a figure may stand: ${x.faults} faults`);
  return list;
}

if (mode === 'all') {
  let t0 = Date.now();
  const b = await call('board', { quality: 0.9 });
  console.log(`board ${b.size.join(' x ')}, ${b.tris} triangles, ${b.ms} ms in the page; ${write(path.join(TEMP, 'board.png'), b.png)} B png, ${write(path.join(OUT, 'board.webp'), b.webp)} B webp`);
  console.log(`  map: origin ${b.origin}, ppm ${b.ppm.toFixed(3)}, axes ${JSON.stringify(b.axes)}, gmSpot ${b.gmSpot}`);
  t0 = Date.now();
  const gy = await call('gmYard', { quality: 0.92 });
  const gp = await call('gmPage', { fit: 128, quality: 0.92 });
  for (const s of STATES) {
    console.log(`gm-${s} ${gy[s].size.join(' x ')} anchor ${gy[s].anchor}: ${write(path.join(TEMP, `gm-${s}.png`), gy[s].png)} B png, ${write(path.join(OUT, `gm-${s}.webp`), gy[s].webp)} B webp`);
    console.log(`gm-page-${s} ${gp[s].size.join(' x ')}: ${write(path.join(TEMP, `gm-page-${s}.png`), gp[s].png)} B png, ${write(path.join(OUT, `gm-page-${s}.webp`), gp[s].webp)} B webp`);
  }
  console.log(`gm renders ${Date.now() - t0} ms`);

  // The light, for the yard's code shadows: the screen throw of the key light's shadow per px of a figure's height.
  const light = await page.evaluate(async () => {
    const { VIEW, KEY } = await import('./src/stage.js');
    const el = Math.sqrt(1 - VIEW.d.y * VIEW.d.y);
    const gx = -KEY.x / KEY.y, gz = -KEY.z / KEY.y;
    const A = (gx * VIEW.right.x + gz * VIEW.right.z) / el, B = -(gx * VIEW.up.x + gz * VIEW.up.z) / el;
    return { throw: [Math.round(A * 1000) / 1000, Math.round(B * 1000) / 1000] };
  });

  const manifest = {
    board: {
      file: 'set/board.webp', size: b.size,
      map: { ppm: Math.round(b.ppm * 1000) / 1000, origin: b.origin, lawn: LAWN.map(r3), margin: MARGIN, blocked: blocked(0.2) },
    },
    gm: Object.fromEntries(STATES.map((s) => [s, { file: `set/gm-${s}.webp`, size: gy[s].size, anchor: gy[s].anchor }])),
    gmSpot: b.gmSpot,
    gmPage: Object.fromEntries(STATES.map((s) => [s, { file: `set/gm-page-${s}.webp`, size: gp[s].size }])),
    walk: WALK.map(r3),
    shadow: { tint: [12, 30, 18], alpha: 0.3, blur: 1.6, contactAlpha: 0.42, contactBlur: 2.6, throw: light.throw },
    mess: await renderMess(),
    _notes: [
      'SetManifest (src/assets/art/manifest.ts) plus three extras: gmPage, walk, shadow. Every pixel value is in the image\'s own pixels, at 2x the yard\'s CSS size. The board keeps at least 24 px of clear transparency on every side, its shadow on the page included.',
      `The map: world (x, y) in metres lands at origin + x * ppm * (2, -1) / sqrt(5) + y * ppm * (-2, -1) / sqrt(5); a metre along x is ${JSON.stringify(b.axes.x)} px, along y ${JSON.stringify(b.axes.y)} px, a metre straight up ${JSON.stringify(b.axes.h)} px.`,
      'The lawn is [0, lawn[0]] x [0, lawn[1]] inside the fence lines (the fence on the two back sides, the gate in the right-back one at y 1.3 to 2.6); the front two sides are open. blocked: [x, y, w, h] footprints already padded by 0.2 m.',
      `walk: [x, y, w, h], where the walking group stands: the flagstone path along the lawn's front-right edge (y from -${PATH} to 0), outside the lawn.`,
      'gm: drawn with its anchor (the point it hovers over, inside the image) on gmSpot; the three states share one size, one anchor and one place for the orb: ready is the amber band turned low, running the amber band lit, done the band lit a pale warm white (neutral: finished, not good or bad). gmPage: the same three at 128 px square (64 CSS px), the orb centred and in the same place in each.',
      'shadow: the board\'s cast shadows, for the cast\'s code shadows: tint rgb, alpha, blur in px at the yard\'s 1x (x2 in these images); a contact ellipse at contactAlpha and contactBlur; throw: the screen offset (dx, dy) of a shadow point per px of height above the anchor (the key light from the upper left, shadows to the right).',
      MESS_NOTE,
    ],
  };
  fs.writeFileSync(setFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${rel(setFile)}`);
  const a = await call('audit', { step: 0.15 });
  console.log(`depth audit: ${a.spots} places a figure may stand x ${a.rays} rays toward the camera: ${a.faults} faults${a.faults ? ` ${JSON.stringify(a.first)}` : ''} (${a.ms} ms)`);
}

// `node Tools/Art/set/render.mjs mess`: the decals alone (the board and the GM are never rewritten), then the checks
if (mode === 'mess') {
  const list = await renderMess();
  // set.json's `mess` list and its note, in place (before _notes), everything else as it was
  const old = JSON.parse(fs.readFileSync(setFile, 'utf8'));
  const next = {};
  for (const [k, v] of Object.entries(old)) {
    if (k === 'mess') continue;
    if (k === '_notes') next.mess = list;
    next[k] = k === '_notes' ? [...v.filter((n) => !n.startsWith('mess: ')), MESS_NOTE] : v;
  }
  fs.writeFileSync(setFile, JSON.stringify(next, null, 2) + '\n');
  console.log(`patched ${rel(setFile)}: mess and its note`);
  const set = next;
  const decals = (ext) => set.mess.map((d) => ({ ...d, file: ext === 'png' ? `/Temp/set/mess-${d.id}.png` : `/src/assets/art/${d.file}` }));
  // the check: the board with the decals laid on it against the board rendered with the mess in place, as shipped
  // (both WebPs) and as rendered (the lossless masters)
  for (const [tag, boardFile, ds] of [['shipped', `/src/assets/art/${set.board.file}`, decals('webp')], ['masters', '/Temp/set/mess-board.png', decals('png')]]) {
    const c = await call('checkMess', { boardFile, decals: ds, fullFile: '/Temp/set/mess-full.png', cleanFile: '/Temp/set/mess-board.png' });
    console.log(`exact (${tag}): ${c.exact.map((e) => `${e.file}: ${e.unchanged} px the mess leaves alone (the renders with and without it agree), ${e.moved} of them moved; ${e.mess} px of the mess itself`).join('; ')}`);
    write(path.join(TEMP, `mess-check-${tag}-heat.png`), c.heat);
    console.log(`check (${tag}): ${c.stats.map((z) => `${z.zone}: max ${z.max}, mean ${z.mean}, ${z.over4} px over 4`).join('; ')}`);
    if (tag === 'shipped') for (const e of c.edges) console.log(`  ${e.file}: border alpha max ${e.border}; ${e.opaque} opaque px, worst against the full render ${e.worstOpaque}; ${e.partial} partly clear px, ${e.darkFringe} much darker than an opaque neighbour`);
  }
  // the yard at four levels of cleanliness (none, one, two, three decals) at about the size the yard draws the board
  const gm = { file: `/src/assets/art/${set.gm.running.file}`, anchor: set.gm.running.anchor };
  for (let n = 0; n <= 3; n++) {
    const r = await call('compose', { k: 0.48, boardFile: `/src/assets/art/${set.board.file}`, map: set.board.map, gmSpot: set.gmSpot, figures: [], gm, decals: decals('webp').slice(0, n) });
    write(path.join(TEMP, `mess-level-${n}.png`), r.png);
  }
  console.log('Temp/set/mess-level-{0,1,2,3}.png: the board at 0.48 of its 2x (about 1,150 px wide) with 0 to 3 decals');
  // with WP4a's cast: 18 dogs and the crew over all three, at the yard's 1x and fitted to the page at 1366 x 768
  const cast = JSON.parse(fs.readFileSync(path.join(ART, 'cast.json'), 'utf8'));
  const dogs = cast.sprites.filter((c) => c.kind === 'dog');
  const crew = cast.sprites.find((c) => c.kind === 'crew' && c.pose === 'leash') ?? cast.sprites.find((c) => c.kind === 'crew');
  const B = [...set.board.map.blocked, ...set.mess.flatMap((d) => d.blocked ?? [])], [X, Y] = set.board.map.lawn, M = set.board.map.margin;
  const inB = ([x, y]) => B.some(([bx, by, bw, bh]) => x >= bx && x <= bx + bw && y >= by && y <= by + bh);
  let seed = 11;
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const spots = [[2.6, 4.4]];
  for (let tries = 0; spots.length < 19 && tries < 20000; tries++) {
    const p = [M + rnd() * (X - 2 * M), M + rnd() * (Y - 2 * M)];
    if (inB(p) || spots.some((q) => Math.abs((p[0] - q[0]) - (p[1] - q[1])) * Math.SQRT1_2 < 1.05 && (Math.abs((p[0] - q[0]) + (p[1] - q[1])) * Math.SQRT1_2) / 2 < 0.58)) continue;
    spots.push(p);
  }
  const order = dogs.map((d, i) => [d, (i * 7) % dogs.length]).sort((p, q) => p[1] - q[1]).map(([d]) => d);
  const fig = (c, world, mirror, name) => ({ file: `/src/assets/art/${c.file}`, anchor: c.anchor, scale: 1, mirror, world, name });
  const figs = [fig(crew, spots[0], false, 'crew'), ...spots.slice(1).map((p, i) => fig(order[i % order.length], p, i % 3 === 1, `${order[i % order.length].id}#${i}`))];
  const withCast = await call('compose', { k: 0.5, boardFile: `/src/assets/art/${set.board.file}`, map: set.board.map, gmSpot: set.gmSpot, figures: figs, gm, decals: decals('webp') });
  write(path.join(TEMP, 'mess-cast-1x.png'), withCast.png);
  const fit = await call('pageFit', { compositeFile: '/Temp/set/mess-cast-1x.png', boardSize: set.board.size });
  write(path.join(TEMP, 'mess-cast-page-fit.png'), fit.png);
  console.log(`Temp/set/mess-cast-1x.png (${figs.length} figures), Temp/set/mess-cast-page-fit.png (the board at ${fit.scale.toFixed(3)} of its 1x)`);
  await browser.close();
  server.close();
  process.exit(0);
}

// --- the composites: spike A's cast (the hybrid's) placed by the map alone ------------------------------------------
const set = JSON.parse(fs.readFileSync(setFile, 'utf8'));
const AA = JSON.parse(fs.readFileSync(path.join(ROOT, 'Temp/spike-a/anchors.json'), 'utf8'));
const AB = JSON.parse(fs.readFileSync(path.join(ROOT, 'Temp/spike-b/anchors.json'), 'utf8'));
const S = AB['sprites/corgi-trot-r.png'].size[0] / AA['corgi-trot.png'].size[0]; // the hybrid's one scale for A's cast
const sprite = (name) => ({ file: `/Temp/spike-a/sprites/${name}.png`, anchor: AA[`${name}.png`].anchor, scale: S, name });
const DOGS = ['golden-trot', 'corgi-sit', 'golden-sleep', 'corgi-trot', 'golden-sit', 'corgi-sleep'];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inBlocked = ([x, y]) => set.board.map.blocked.some(([bx, by, bw, bh]) => x >= bx && x <= bx + bw && y >= by && y <= by + bh);
// screen-space distance between two ground points, in screen metres (x across, y up the screen)
const screenGap = (p, q) => [Math.abs((p[0] - q[0]) - (p[1] - q[1])) * Math.SQRT1_2, Math.abs((p[0] - q[0]) + (p[1] - q[1])) * Math.SQRT1_2 / 2];

function scatter(n, seed, avoid = []) {
  const r = rng(seed), [X, Y] = LAWN, m = MARGIN;
  const pts = [];
  for (let tries = 0; pts.length < n && tries < 20000; tries++) {
    const p = [m + r() * (X - 2 * m), m + r() * (Y - 2 * m)];
    if (inBlocked(p)) continue;
    if ([...pts.map((q) => q.world), ...avoid].some((q) => { const [dx, dy] = screenGap(p, q); return dx < 1.05 && dy < 0.58; })) continue;
    pts.push({ world: p });
  }
  // no two neighbours the same figure: each takes the first of the 12 (sprite x facing) not used within 2.4 m
  pts.forEach((p, i) => {
    const near = pts.slice(0, i).filter((q) => Math.hypot(q.world[0] - p.world[0], q.world[1] - p.world[1]) < 2.4).map((q) => q.key);
    for (let k = 0; k < 12; k++) {
      const key = (i + k) % 12;
      if (!near.includes(key)) { p.key = key; break; }
    }
    p.key ??= i % 12;
  });
  return pts.map((p, i) => ({ ...sprite(DOGS[p.key % 6]), mirror: p.key >= 6, world: p.world, name: `${DOGS[p.key % 6]}${p.key >= 6 ? '-l' : ''}#${i}` }));
}

async function best(label, n, crew, seeds, extra = []) {
  let pick = null;
  for (const seed of seeds) {
    const dogs = scatter(n, seed, crew.map((c) => c.world));
    if (dogs.length < n) { console.log(`  seed ${seed}: only ${dogs.length} of ${n} placed`); continue; }
    const figs = [...dogs, ...crew, ...extra];
    const r = await call('compose', { k: 0.5, boardFile: `/src/assets/art/${set.board.file}`, map: set.board.map, gmSpot: set.gmSpot, figures: figs, gm: null });
    const t = Object.values(r.touches).reduce((a, b) => a + b, 0);
    if (!pick || t < pick.t) pick = { seed, figs, t, touches: r.touches };
    if (t === 0) break;
  }
  if (!pick) throw new Error(`${label}: no seed placed ${n} dogs`);
  console.log(`${label}: seed ${pick.seed}, ${pick.figs.length} figures, touching pixels ${pick.t} ${JSON.stringify(pick.touches)}`);
  return pick.figs;
}

const gmOf = (state) => ({ file: `/src/assets/art/${set.gm[state].file}`, anchor: set.gm[state].anchor, state });
const crewAt = (world, mirror = false) => ({ ...sprite('crew-leash'), mirror, world, name: 'crew' });
// `node Tools/Art/set/render.mjs cast`: the same check with WP4a's cast (src/assets/art/cast.json) when it is there,
// at its own scale (no factor: its ppm is the set's 176)
if (mode === 'cast') {
  const cast = JSON.parse(fs.readFileSync(path.join(ART, 'cast.json'), 'utf8'));
  const dogs = cast.sprites.filter((c) => c.kind === 'dog');
  const crew = cast.sprites.find((c) => c.kind === 'crew' && c.pose === 'leash') ?? cast.sprites.find((c) => c.kind === 'crew');
  const asFig = (c, world, mirror, name) => ({ file: `/src/assets/art/${c.file}`, anchor: c.anchor, scale: 1, mirror, world, name });
  let pick = null;
  for (let seed = 1; seed <= 60 && !(pick && pick.t === 0); seed++) {
    const spots = scatter(18, seed, [[2.6, 4.4]]);
    if (spots.length < 18) continue;
    // each spot a different sprite from the whole cast, in an order that spreads breeds and poses
    const order = dogs.map((d, i) => [d, (i * 7) % dogs.length]).sort((a, b) => a[1] - b[1]).map(([d]) => d);
    const figs = spots.map((sp, i) => asFig(order[i % order.length], sp.world, i % 3 === 1, `${order[i % order.length].id}#${i}`));
    figs.push(asFig(crew, [2.6, 4.4], false, 'crew'));
    const r = await call('compose', { k: 0.5, boardFile: `/src/assets/art/${set.board.file}`, map: set.board.map, gmSpot: set.gmSpot, figures: figs, gm: null });
    const t = Object.values(r.touches).reduce((a, b) => a + b, 0);
    if (!pick || t < pick.t) pick = { seed, figs, t, touches: r.touches };
  }
  console.log(`cast: seed ${pick.seed}, touching pixels ${pick.t} ${JSON.stringify(pick.touches)}`);
  for (const [k, tag] of [[0.5, '1x'], [1, '2x']]) {
    const r = await call('compose', { k, boardFile: `/src/assets/art/${set.board.file}`, map: set.board.map, gmSpot: set.gmSpot, figures: pick.figs, gm: gmOf('running') });
    write(path.join(TEMP, `composite-cast-${tag}.png`), r.png);
    console.log(`Temp/set/composite-cast-${tag}.png ${r.size.join(' x ')}`);
  }
  await browser.close();
  server.close();
  process.exit(0);
}
const scenes = [];
// the packed week: 18 dogs, one crew member, the GM running
const crew1 = [crewAt([2.6, 4.4])];
scenes.push({ name: 'packed', figs: await best('packed', 18, crew1, Array.from({ length: 60 }, (_, i) => i + 1)), gm: gmOf('running') });
// a walk: 6 dogs and the crew on the path, 12 on the lawn, the week over (the GM's done state, for the look)
// the file along the path: the crew in front (the far end), six dogs behind at 1.15 m, all facing the way they walk
const walkers = [crewAt([WALK[0] + WALK[2] - 0.1, WALK[1] + WALK[3] / 2])];
['corgi-trot', 'golden-trot', 'corgi-trot', 'golden-trot', 'corgi-trot', 'golden-trot'].forEach((d, i) => {
  walkers.push({ ...sprite(d), mirror: false, world: [WALK[0] + WALK[2] - 1.1 - i * 1.2, WALK[1] + WALK[3] / 2 + (i % 2 ? 0.1 : -0.1)], name: `walk-${d}#${i}` });
});
scenes.push({ name: 'walk', figs: await best('walk', 12, [], Array.from({ length: 60 }, (_, i) => 100 + i), walkers), gm: gmOf('done') });
// getting ready: the crew in the yard before drop-off, no dogs, the GM getting ready
scenes.push({ name: 'ready', figs: [crewAt([2.9, 4.3])], gm: gmOf('ready') });

for (const sc of scenes) {
  for (const [k, tag] of [[0.5, '1x'], [1, '2x']]) {
    const r = await call('compose', { k, boardFile: `/src/assets/art/${set.board.file}`, map: set.board.map, gmSpot: set.gmSpot, figures: sc.figs, gm: sc.gm });
    const f = path.join(TEMP, `composite-${sc.name}-${tag}.png`);
    write(f, r.png);
    console.log(`${rel(f)} ${r.size.join(' x ')}${Object.keys(r.touches).length ? ` touching ${JSON.stringify(r.touches)}` : ''}`);
  }
}
const fit = await call('pageFit', { compositeFile: '/Temp/set/composite-packed-1x.png', boardSize: set.board.size });
write(path.join(TEMP, 'composite-page-fit.png'), fit.png);
console.log(`Temp/set/composite-page-fit.png: the board at ${fit.scale.toFixed(3)} of its 1x in a 1366 x 768 frame`);
const sheet = await call('gmSheet', { files: STATES.map((s) => `/src/assets/art/${set.gmPage[s].file}`) });
write(path.join(TEMP, 'gm-page-sheet.png'), sheet.png);
const sheetY = await call('gmSheet', { files: STATES.map((s) => `/src/assets/art/${set.gm[s].file}`) });
write(path.join(TEMP, 'gm-yard-sheet.png'), sheetY.png);
console.log('Temp/set/gm-page-sheet.png, Temp/set/gm-yard-sheet.png');

await browser.close();
server.close();
