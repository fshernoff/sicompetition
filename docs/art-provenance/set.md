# The set and the GM: provenance (G5d, D59)

The board (the lawn, the slab, the path, the fence and the gate, the clubhouse, the bushes, the planter, the water
bowl) and the GM orb in its three states are **modelled in code and rendered offline**. No image model made any of
them, and no outside model, texture, photo, font or asset pack went in: every vertex and colour is written in
`Tools/Art/set/src/`. The code is **AI-assisted**: written on 2026-10-28 by Claude (Anthropic's Opus model, running
as a Claude Code agent, package WP4b of G5d) at the owner's direction, from spike B's pipeline (`Temp/spike-b/`,
written the same day by another Claude agent for the D59 spike). The brief it was written to is "WP4b the set and the
GM" in `.claude/docs/plans/g5d-packages.md`. Disclose it as "the set modelled with AI-assisted code" (the cast is the
generated part: `docs/art-provenance/README.md`).

## What ships

| File (`src/assets/art/`) | What | Size | Bytes | SHA-256 (first 12) |
|---|---|---|---|---|
| `set/board.webp` | the board, with its key-light shadows and its soft shadow on the page; 24 px of clear transparency on every side | 2395 × 1467 | 118,610 | `52b91d3d8813` |
| `set/gm-ready.webp` | the GM getting ready: the amber band turned low | 114 × 240 | 2,446 | `fe2d83398fc1` |
| `set/gm-running.webp` | the GM running the week: the amber band lit | 114 × 240 | 3,104 | `17348d3a544a` |
| `set/gm-done.webp` | the week is over: the band lit green | 114 × 240 | 2,766 | `a45aa92689db` |
| `set/gm-page-ready.webp`, `set/gm-page-running.webp`, `set/gm-page-done.webp` | the same three at the page's size (64 CSS px), for the status line, the orb centred | 128 × 128 | 2,200; 2,724; 2,520 | `d4b7bfb2b2d9`, `23e8fa0b7bc1`, `50c2056da31a` |
| `set.json` | the contract (`manifest.ts`'s `SetManifest`): the board's map, the GM's anchors and `gmSpot`, plus `gmPage`, `walk`, `shadow` and `_notes` | | 3,427 | `516b986a9dce` |

Every image is at 2× the yard's CSS size, lossy WebP with a real alpha channel. The hashes are this render's; the
render is deterministic (two runs on Oct 28 gave byte-identical files), so a rerun on the same tools reproduces them.
These are not D58 passes: the three readers' passes go in `qa.md`.

**The second render (Oct 28, after the readers' first passes):** the lawn's straight vertical tone steps removed (a
regular grid's diagonals run exactly up a 2:1 screen; the grid is now jittered within each cell, and a shadow-pass
ordering bug that could lay the ground's soft shadow over a wall or a post is fixed); the seeded hash inherited from
spike B fixed (it returned values from -1 to 1, so every jitter, facet tone and noise leaned dark; it now returns
0 to 1), which changes every facet's tone slightly; the garden runs on under the clubhouse (skipping cells there left
see-through slivers at its edges); the large hedge bush made round;
the hedge moved clear of the clubhouse's edge (no cypress sliver); 24 px of clear transparency round the board, its
page shadow included (the map and `gmSpot` moved with it); the done state made a green band, the orb in the same place
in every state at both sizes, no ring; the page's orb centred.

## The tools

- three.js **0.186.1** (MIT), installed in `Tools/Art/set/` only (its own `package.json` and lockfile; never in the
  page's dependencies, never shipped).
- The renderer: three.js's `WebGLRenderer` in **Chromium 156.0.8078.4** (Playwright 1.64.1, the repo's
  devDependency), headless, WebGL through ANGLE and SwiftShader; Node 24.21.0 drives it.
- The WebP encoder: Chromium's own (`canvas.toDataURL('image/webp', q)`), quality 0.90 for the board and 0.92 for the
  GM.
- The checks: `Tools/Agent/art_qa.py` (Pillow 13.0.0 in a scratch venv) and the depth audit in `src/page.js`.

Reproduce, from the repo root (about 22 s):

```
(cd Tools/Art/set && npm ci)
node Tools/Art/set/render.mjs          # the set, the GM, set.json, the depth audit, the composites in Temp/set/
node Tools/Art/set/render.mjs compose  # only the composites, from the files already written
node Tools/Art/set/render.mjs cast     # the board with WP4a's cast (src/assets/art/cast.json): Temp/set/composite-cast-*
```

## The steps

1. **One camera** (`src/stage.js`, gate 1): orthographic, azimuth 45°, elevation 30°, the 2:1 isometric of
   `manifest.ts`; 88 px per metre at the yard's 1× (spike B's scale, which the hybrid's cast was matched to), shipped
   at 2× (176), rendered at 2× that and box-downsampled. So a metre along the lawn's x is (+124.45, −62.23) image px,
   along y (−124.45, −62.23), a metre up (0, −152.42): `ppm` 139.14 along the lawn's edges.
2. **One light**: a warm key from the screen's upper left and a little toward the viewer, 55° up (spike B's direction,
   so the shadows of the set and of the cast agree), with a hemisphere fill. Toward the cast's finish (gate 4) the key
   is warmer and weaker against a stronger fill than spike B's (lower contrast).
3. **The plan** (`src/layout.js`): a 7.2 × 7.2 m lawn of 6 × 6 tiles in two greens; the fence on the two back sides
   with a closed, ledged-and-braced gate in the right-back one; the clubhouse **off the lawn** in its left-back corner,
   its front wall with the door on the fence line (the door 2.0 m, about 1.2 × WP4a's crew, who stands about 1.65 m:
   245 px from the foot anchor to the crown at 152.4 px per vertical metre); a hedge
   behind the fence; a flagstone path along the open front-right edge (the walk) that turns the corner to the gate;
   on the lawn, against the back edges only, a bush in the back corner, a cone at the left corner, a bush on the
   right-back fence, a planter by the door and a water bowl. The hedge's every bush stands clear of the clubhouse's
   edge on the screen, so none shows as a sliver beside it. The slab has square corners, a grass (or stone) lip and
   a soil edge.
4. **The rule the plan keeps:** the yard draws every figure over the board, so nothing on the board may stand in front
   of a place a figure can stand. The clubhouse and the hedge are behind the lawn; the lawn behind each prop (where a
   figure would be partly hidden by it) is in `blocked`. **The depth audit** proves it: from 1,756 places a figure may
   stand (the lawn inside the margin and off `blocked`, every 0.15 m, and the walk strip), 25 rays each toward the
   camera from a figure's volume (to 0.6 m either side on the screen and 0.9 m up for a dog, 0.25 m and 1.8 m for the
   crew): **0 hit** the fence, the clubhouse, the plants or the props.
5. **The models** (`src/board.js`, `src/gm.js`): flat-shaded, vertex-coloured triangles (10,490 for the board). Denser
   facets than spike B (lawn cells of 0.15 m, heights jittered ±0.7 cm, each vertex off the tile lines moved up to
   0.18 of a cell in the plane, so no cell diagonal runs straight up the screen and every cell stays convex; the tile
   lines stay straight), round bushes as one body and a crown lobe inside its outline, the fence
   board by board, the clubhouse plank by plank with a plinth, a parapet roof in panels, a panelled door with a lever
   handle and a step, a two-pane window with a sill. **Soft occlusion is baked** into the vertex colours: the ground
   darkens toward the clubhouse, the fence, the bushes, the planter and the bowl; walls and posts darken where they
   meet the ground and under the eaves; the roof darkens against its parapet; the slab's soil darkens toward its foot.
6. **The board's render** (`src/render.js`): a colour pass; the key light's shadows on the lawn and the path as a
   separate mask, blurred (1.6 px at 1×) and laid on at 30% in a deep green-black, kept to the ground; the grade
   (contrast 0.95, saturation 0.97, a touch warmer); the slab's own shadow on the page under it, softer and lighter
   (16%), so it reads on a light page and vanishes on a dark one; the frame holds that shadow's whole footprint and
   blur, and the image is trimmed to its faintest pixel with 24 px of clear transparency on every side. In the mask
   passes every depth-only occluder is drawn before the ground, so no mask (and no shadow) shows through a wall or a
   post.
7. **The GM** (`src/gm.js`): a faceted charcoal icosphere cut at its equator. The cut's vertices are put on one exact
   circle, a skirt closes the rim and the band is built on the rim's own polygon, so the band's edges are the shells'
   edges exactly (spike B's band showed notches at 8×); the band is unlit, its light on the nearest facets is baked
   into their colours, and there is no 2D glow round it (spike B's haze could read as a halo). Ready: the amber band
   turned low (`#7C5A26`), a faint warmth beside it. Running: the amber band lit (`#FFB21E`) with a hot core line.
   Done: the band lit green (`#34A866`, the page's ok green a little brighter so it reads lit, with a pale core and its
   light on the nearest facets, the same finish as the amber): the status light's convention, amber working and green
   done, which also differs from amber in lightness for a colour-blind viewer; no face, no halo, no ring, no arrow or
   chevron (never "up"). The orb is in the same place in every state, 0.85 m over its spot. The yard's three share one
   frame and one anchor (the point it hovers over, on the roof at `gmSpot`, inside the image); the page's three share
   one 128 px frame with the orb centred. The GM's grade is lighter (contrast 0.96).
8. **The map** (`set.json`): `origin` is the image pixel of the lawn's front corner, measured by projecting it through
   the render's own camera, as are `gmSpot` and the GM's anchors.

## The checks (the package's own, not D58's)

- `Tools/Agent/art_qa.py` on every shipped image (crops on cream and near-black in `Temp/set/qa/`, and native 2×
  tiles of the board in `Temp/set/qa/board-tiles/`): the board 1 figure and 0 specks; each GM 1 figure and 0 specks.
  Partly transparent edge pixels much darker than their opaque neighbour: 1 of 50,842 on the board (a fence board's
  antialiased edge); 0 to 9 on the GM, where the charcoal orb's own edge meets its lit band, not a halo.
- Hard vertical tone steps on the ground (a jump of 3 or more in luma across 2 px, flat on both sides, held for 30
  rows or more, on the lawn, garden and path only, by the render's own ground mask): **0** (the first render had them
  on the lawn). See-through pixels inside the slab's top (its projected outline, 3 px in): **0** of 1,263,831. Clear
  transparency round the board: 24, 24, 24 and 24 px. The page GMs: the orb 16 px from the top and the bottom, 20
  from each side.
- The composites with spike A's cast (the hybrid's, scaled by 1.0484 to spike B's corgi), placed **by `set.json`'s map
  alone**, with the hybrid's code shadows: `Temp/set/composite-packed-{1x,2x}.png` (18 dogs, the crew, the GM running;
  2 touching pixels at 1×, antialiasing), `composite-walk-{1x,2x}.png` (12 on the lawn, 6 and the crew in a file on the
  path, the GM done; 0 touching), `composite-ready-{1x,2x}.png` (the crew alone, the GM getting ready), and
  `composite-page-fit.png` (the board fitted to the page's yard at 1366 × 768: 0.68 of its 1×).
- The same with WP4a's cast as it stood on Oct 28 (`cast.json`, the same 176 px per metre, no factor):
  `Temp/set/composite-cast-{1x,2x}.png`, 18 dogs of every breed and the crew, 0 touching pixels.
- The GM on the page's surfaces: `Temp/set/gm-page-sheet.png` (white, the steel page, the navy bar, at 1× and 2×),
  `Temp/set/gm-yard-sheet.png`.
