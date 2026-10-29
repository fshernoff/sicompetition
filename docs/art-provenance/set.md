# The set and the GM: provenance (G5d, D59)

The board (the lawn, the slab, the path, the fence and the gate, the clubhouse, the bushes, the planter, the water
bowl), the GM orb in its three states and the three mess decals are **modelled in code and rendered offline**. No image model made any of
them, and no outside model, texture, photo, font or asset pack went in: every vertex and colour is written in
`Tools/Art/set/src/`. The code is **AI-assisted**: written on 2026-10-28 by Claude (Anthropic's Opus model, running
as a Claude Code agent, package WP4b of G5d) at the owner's direction, from spike B's pipeline (`Temp/spike-b/`,
written the same day by another Claude agent for the D59 spike). The brief it was written to is "WP4b the set and the
GM" in `.claude/docs/plans/g5d-packages.md`. The mess decals' code (`Tools/Art/set/src/mess.js` and its hooks in
`board.js`, `render.js`, `page.js` and `render.mjs`) was written on 2026-10-29 by Claude (the same model, as a Claude
Code agent, package WP4b-r2) to review round 2, row 15 of `.claude/docs/reviews/g5d-look-rounds.md`. Disclose it as
"the set modelled with AI-assisted code" (the cast is the generated part: `docs/art-provenance/README.md`).

## What ships

| File (`src/assets/art/`) | What | Size | Bytes | SHA-256 (first 12) |
|---|---|---|---|---|
| `set/board.webp` | the board, with its key-light shadows and its soft shadow on the page; 24 px of clear transparency on every side | 2395 × 1467 | 118,610 | `52b91d3d8813` |
| `set/gm-ready.webp` | the GM getting ready: the amber band turned low | 114 × 240 | 2,446 | `fe2d83398fc1` |
| `set/gm-running.webp` | the GM running the week: the amber band lit | 114 × 240 | 3,104 | `17348d3a544a` |
| `set/gm-done.webp` | the week is over: the band lit a pale warm white | 114 × 240 | 2,834 | `e12e5f32915d` |
| `set/gm-page-ready.webp`, `set/gm-page-running.webp`, `set/gm-page-done.webp` | the same three at the page's size (64 CSS px), for the status line, the orb centred | 128 × 128 | 2,200; 2,724; 2,512 | `d4b7bfb2b2d9`, `23e8fa0b7bc1`, `d44de11da266` |
| `set/mess-mud.webp` | the mess under cleanliness 50: flat wet mud, darker and glossier toward its middle, two tracks of paw prints leading out of it | 241 × 373 | 22,358 | `2538e3870c85` |
| `set/mess-kibble.webp` | under 30: a spill of kibble from a heap, a red rubber ring and a tennis ball | 200 × 149 | 17,308 | `34718d943253` |
| `set/mess-bowl.webp` | under 10: a steel water bowl knocked over on its side, the puddle flowing out of its mouth, a few drops | 264 × 85 | 7,910 | `e0c927c837bc` |
| `set.json` | the contract (`manifest.ts`'s `SetManifest`): the board's map, the GM's anchors and `gmSpot`, `mess`, plus `gmPage`, `walk`, `shadow` and `_notes` | | 5,014 | `f27c751045ab` |

Every image is at 2× the yard's CSS size, lossy WebP with a real alpha channel (the mess decals: lossless WebP). The hashes are this render's; the
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

**The third render (Oct 28, after review round 1):** the critic read the green done band as "good" on a bad week (the
scorecard must never read as a win), so done is now a neutral band: a steady pale warm white. Only `gm-done.webp` and
`gm-page-done.webp` changed; the board and the other four GM files are byte-identical to the second render, and
`set.json` changed only in its `_notes` line describing done.

**The mess decals (Oct 29, review round 2, row 15):** at cleanliness 0 the lawn stayed immaculate beside the number.
Three decals were added, new files only: the board and the six GM files are byte-identical to the third render (their
SHA-256 before and after, in full, unchanged), and `set.json` gained its `mess` list and one `_notes` line. The yard
(WP3) shows each while the frame's cleanliness is under its `below` (D60: the frame's state, nothing invented).

**The mess decals' second render (Oct 29, after their D58 passes):** Astra and Sonnet found defects in all three (the
mud read as a raised crater, with a straight wall and step at its upper right and a brown stain glow beyond it; the rope
toy read as a knobbed bone with tape bands and a stray streak, floating on a faint offset shadow, and the ball as an
olive blob with a pale lower fringe; the upturned bowl read upright, its soft shadow flared toward the light, a darker
band round its puddle). All three were remade: the mud flat and wet, its colour a smooth field with no bands, a sheen,
no stain; the toys a red rubber ring and a fluorescent tennis ball with its white seam, each grounded by the yard's
contact shadow to its lower right; the bowl on its side, steel with a highlight, its mouth pouring the puddle, its
shadow to the lower right only, no band; the kibble pieces as they were. The board, the six GM files and the cast are
byte-identical (SHA-256 before and after); `set.json` changed only in its `mess` list (new sizes and places, and the
bowl's `blocked`) and its `mess` note; `manifest.ts` gained `MessDecal.blocked`. A bug found on the way: the contact
shadow was first drawn onto a canvas `tinted()` leaves in `source-in`, which wiped every other shadow in the layer
(the decal check caught it as differences along the fence's shadows).

**The kibble's third render (Oct 29, after the second D58 passes):** the mud and the bowl came back clean from all
three readers and keep their bytes. The kibble had one defect (Sonnet; the main thread had seen it too): a soft pale
wash, about +7 to +12 in R and B, lightened and flattened the board's lawn round the pile and the ring (the checker's
darker diamond with it). It was the decal's own "trampled grass" tint, a lerp toward the fence's tan of up to 0.18. It
is gone: the grass under the kibble is now copied unchanged, as round the mud and the bowl; the kibble pieces, the ring
and the ball are as they were. Only `mess-kibble.webp` and `set.json` (the kibble's width, 326 to 307, and the mess
note's wording: the lawn copied, not tinted) changed; every other file under `src/assets/art/` is byte-identical
(SHA-256 before and after).

**The decals' fourth render (Oct 29, exact against the shipped board):** Astra still marked the kibble with a lawn
colour mismatch, a diagonal seam below the pile, read from the polygonal pattern in the ×16 difference maps; the main
thread measured all three on the shipped board and found 60 to 67% of each decal's copied lawn 1 level off (the
lossless render's lawn against the lossy `board.webp`'s), so the mud and the bowl carried the same property. All three
now carry no lawn at all: only their pieces, with their own edge alpha, and their shadows, as the board's shadow tint
at the shadow's alpha; their alpha is 0 wherever the mess changes nothing, so laid on `board.webp` each leaves every
other pixel exactly as it was (0 levels, counted). The pieces, their places, `below` and `blocked` are as they were;
each decal's size shrank to its pieces and shadows, so its `at` moved with its crop. The paw prints are now laid at an
opacity (the mud wearing off them) instead of a colour faded toward a guess at the lawn's, so on the board they fade
into the lawn itself. Only the three decals and `set.json` (their sizes, places and note) changed; the board, the six
GM files and the cast are byte-identical (SHA-256 before and after).

## The tools

- three.js **0.186.1** (MIT), installed in `Tools/Art/set/` only (its own `package.json` and lockfile; never in the
  page's dependencies, never shipped).
- The renderer: three.js's `WebGLRenderer` in **Chromium 156.0.8078.4** (Playwright 1.64.1, the repo's
  devDependency), headless, WebGL through ANGLE and SwiftShader; Node 24.21.0 drives it.
- The WebP encoder: Chromium's own (`canvas.toDataURL('image/webp', q)`), quality 0.90 for the board and 0.92 for the
  GM; quality 1 for the mess decals, which Chromium encodes losslessly (each decodes to exactly its PNG master).
- The checks: `Tools/Agent/art_qa.py` (Pillow 13.0.0 in a scratch venv) and the depth audit in `src/page.js`.

Reproduce, from the repo root (about 22 s):

```
(cd Tools/Art/set && npm ci)
node Tools/Art/set/render.mjs          # the set, the GM, set.json, the depth audit, the composites in Temp/set/
node Tools/Art/set/render.mjs compose  # only the composites, from the files already written
node Tools/Art/set/render.mjs cast     # the board with WP4a's cast (src/assets/art/cast.json): Temp/set/composite-cast-*
node Tools/Art/set/render.mjs mess     # only the mess decals, set.json's `mess` patched in place, the checks, Temp/set/mess-*
```

`all` renders the decals too (after the board, through its frame). `mess` never writes the board or the GM: it renders
the board again only to take its frame and crop, and stops unless that render's WebP is byte for byte the shipped
`board.webp` (the decals are only right on that board). About 15 s.

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
   Done: the band lit a steady pale warm white (`#FFF1D6`, a white core, its light on the nearest facets, the same
   finish as the amber): neutral, so it says the week is finished and never whether it went well (no green, no red),
   and it differs from the dim and the lit amber in both hue and lightness; no face, no halo, no ring, no arrow or
   chevron (never "up"). The orb is in the same place in every state, 0.85 m over its spot. The yard's three share one
   frame and one anchor (the point it hovers over, on the roof at `gmSpot`, inside the image); the page's three share
   one 128 px frame with the orb centred. The GM's grade is lighter (contrast 0.96).
8. **The map** (`set.json`): `origin` is the image pixel of the lawn's front corner, measured by projecting it through
   the render's own camera, as are `gmSpot` and the GM's anchors.
9. **The mess** (`src/mess.js`, the places in `layout.js`'s `MESS`). Each decal is the board's own render of its mess
   alone, its pieces and their shadows and nothing of the lawn, so it lands in the board's camera, light, shadows and
   grade by construction and leaves the board's own pixels alone everywhere else:
   - *Where:* on open lawn where dogs stand, inside the margin, off every blocked footprint, clear of the clubhouse,
     the fence and the walk, the three spread over the lawn's front (the mud), its right (the kibble) and its left
     (the bowl). The yard draws them over the board and under every figure, so anything higher than 8 cm (the depth
     audit's own rule) needs a blocked footprint as the board's props have: only the bowl on its side (23.9 cm), whose
     footprint and the lawn behind it are its `blocked` in `set.json`, by `layout.js`'s `blockRect`, the board's own
     rule. Measured: the kibble decal's tallest point 7.8 cm (the ball), the flat pieces 1.1 to 1.2 cm.
   - *The pieces,* in the board's language and palette (flat-shaded, vertex-coloured facets; the slab's soil, the
     fence's tan, the bowl's steel, the water; new: a golden kibble brown, the mud's sheen, a rubber red, a tennis-ball
     yellow-green and its white seam, the steel's highlight). Flat pieces 1.1 cm over the lawn: the mud as one flat
     pool with an organic outline all round (48 points, slow waves, no straight run), its colour a smooth field vertex
     by vertex (olive-brown where it thins into the grass, the slab's soil, then darker and wetter toward the middle;
     no bands, no rim) and two soft streaks of sky on the wettest mud; paw prints, a pad and four toes, in a trot's
     left and right, in the wettest mud's colour laid at an opacity from 0.96 down to 0.36 as the mud wears off; the
     puddle, narrow at the bowl's lip and widening to a rounded
     front, in two rings with a streak of sky; drops. Objects that cast the key light's shadow: 44 kibble pieces
     fanning from a heap, three on top (unchanged); a plain red rubber ring lying flat (25 cm across, 4.8 cm high); a
     tennis ball (7.8 cm), fluorescent yellow-green, its white seam the ball's own curve; a flared steel dog bowl (30
     cm across its rolled lip) knocked over on its side, resting on its wall and lip, its mouth toward the front
     right and a little up so its inside shows, every facet's steel brightness from the sky it faces and a bright
     highlight where it mirrors the key light toward the camera. The toys and the bowl are a little darker where they
     meet the grass. Each piece is a little larger than life so the mess reads where the yard draws the board at about
     a third of its pixels.
   - *No lawn:* a decal carries none of the grass round its pieces (no stain, no wash, no band, no copy). Its pieces are
     therefore separate where they lie apart (the prints, the drops, the scattered kibble), each with its own edge.
   - *Grounded:* each object has the yard's own contact shadow (`set.json`'s `contactAlpha` 0.42 and `contactBlur`
     2.6, the figures' spec) as soft ellipses on the ground under it, moved toward its lower right; the ring along its
     circle, the bowl along the line it rests on. No soft occlusion round any object (it showed as a halo on the side
     facing the light).
   - *The render* (`render.js`, `renderDecal`): through the board's own frame (the same camera, size and
     supersampling as the board, recomputed from the board and checked by re-rendering it), with the board's lights;
     the clean lawn drawn only into depth, exactly where the board's lawn stands, so it hides just what the board's
     lawn hides; the objects' key-light shadows on the lawn and the flat pieces as a mask, blurred and laid at 30% in
     the deep green-black, exactly as the board's, with the contact shadows laid in the same layer, kept to the
     ground; the board's grade. The decal is the pieces with their own edge alpha and the shadows as the tint at the
     shadow's alpha: the board lays its shadows the same way (the tint over the lawn, then the grade, which is affine
     per channel and so passes through the alpha), so laid on the shipped board a shadow darkens the board's own
     pixels as the board's render darkens its lawn. Then the guarantee: the board is rendered with all three in place
     and, wherever that render equals the clean board in every channel (the mess changes nothing there, an edge's last
     sliver or a shadow's last tail rounding away), the decal's alpha is set to 0 (`onlyWhereChanged` in `page.js`;
     0 pixels needed it in the final render). Cropped to its faintest pixel plus 2 px; `at` is where that crop's
     top-left corner falls in the board image.
   - *The encoding:* lossless. Lossy WebP at the board's 0.90 put a faint grey fringe on the decals' soft outer edge
     (the encoder blends the colour of a partly clear edge pixel with the black under the clear ones: a master pixel
     (128, 159, 69) at alpha 48 came back (138, 152, 92)); Chromium encodes quality 1 losslessly, and each decal now
     decodes to exactly its PNG master. 48 KB for the three.

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
- **The mess decals** (their fourth render, Oct 29, `node Tools/Art/set/render.mjs mess`, run twice: byte-identical
  files):
  - The board rendered again for their frame is byte for byte the shipped `board.webp` (118,610 B), its crop offset
    55, 124; the board rendered with all three in place (and their contact shadows) has the same crop.
  - **Exact against the shipped board:** each decal laid at its `at` on the decoded `board.webp`, against that board.
    In each decal's box, the pixels the mess leaves alone (the lossless renders with and without it agree in every
    channel): mud 64,365, kibble 23,380, bowl 13,924, of which **0** changed; the mess itself 25,528, 6,420 and 8,516
    pixels (the driver's own count). The same from a separate Pillow script, over each box padded by 30 px: 104,805,
    47,920 and 38,464 pixels the mess leaves alone, **0** changed. Outside the boxes a decal has no pixels. The maps
    (the composite beside |composite − board| × 16, 2×): `Temp/set/mess-exact-{mud,kibble,bowl}.png`: black
    everywhere but the pieces and their shadows.
  - Against the board rendered with the mess in place: on the lossless masters, at most 3, 3 and 2 levels in any
    channel inside each decal's box (mean 0.044, 0.066, 0.042; 0 pixels over 4; the rounding of the shadows' alpha)
    and 0 outside; on the shipped files, every opaque decal pixel equals that render exactly (21,228, 2,755 and 7,212
    pixels; worst difference 0). The images' borders are clear (nothing cut off). Partly clear pixels (4,300, 3,665
    and 1,304, the pieces' edges and the shadows) much darker than an opaque neighbour: 0, 30 and 15, the pieces' own
    darker outlines (the bowl's outer rim beside its lit inside, a kibble's shaded facet) and the contact shadow
    against an object's base, not a fringe (`Temp/set/mess-darkedge-{bowl,kibble}.png`, 8×).
  - The depth audit for the decals (`auditMess`: the board's rays from every place a figure may stand, off the
    board's blocked rectangles and the decal's own): mud 1,612 places, kibble 1,612, bowl 1,548 (its `blocked`
    [0.91, 4.81, 1.27, 1.22]): **0** rays hit anything of a decal higher than 8 cm.
  - Shadow directions, on the shipped board, the grass round each object (luma change, mean): the ring −2.47 to its
    right and −2.69 below against −1.92 left and −1.71 above (the grass inside the ring is in its own shadow); the ball
    −1.96 right, −1.89 below against −0.70 left, −0.68 above; the bowl −0.77 right, −0.69 below against −0.14 left,
    −0.14 above. At 6× (`Temp/set/mess-zoom6-{ring,ball,bowl,kibble}.png`) every shadow and contact shadow falls to
    the object's lower right, its tail smooth (the board's blur), none toward the light.
  - `Tools/Agent/art_qa.py` on the three shipped files (crops at 2× on cream and near-black in `Temp/set/qa-mess/`):
    the mud 2 figures and 14 "specks", the kibble 15 figures, the bowl 1 figure and 4 "specks". With no lawn to join
    them, the separate pieces are separate: the mud's specks are its paw prints (the faintest, at the end of each
    track, below the tool's alpha of 40) and the bowl's are its four drops; nothing else. Each decal whole on cream and
    near-black at 3×: `Temp/set/mess-whole-{mud,kibble,bowl}.png`.
  - The composites: `Temp/set/mess-level-{0,1,2,3}.png` (the board at 0.48 of its 2×, about 1,150 px wide, with
    none, one, two and three decals, the GM running);
    `Temp/set/mess-cast-1x.png` and `mess-cast-page-fit.png` (all three under WP4a's cast, 18 dogs and the crew, at
    the yard's 1× and fitted to the 1366 × 768 page at 0.68 of its 1×). From scratch Pillow scripts (not kept): the
    exact maps, the whole decals, the 6× and 8× crops above.
