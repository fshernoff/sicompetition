# G5d directions: the four rankings and the pick (2026-10-28)

WP1 (Opus, creative director) made three directions in `Temp/direction/` (git-ignored; `compare.html` shows them
side by side): **Floor** (a low-poly isometric management game, generated art), **Ledger** (editorial, art drawn in
code), **Casebook** (a clean-line comic, generated art). Each: a style tile, the first screen, the crowded Wednesday
yard, the P&L, a key frame, all at 1366 × 768 with the page's real copy and Round 1's packed week.

Four independent rankings. Astra and the critic saw only the bar and the images (`rank-prompt.txt` in the session's
scratchpad), not the rationales or any other ranking; the main thread wrote its own before reading the others.

| Reader | 1 | 2 | 3 | Clears the bar? |
|---|---|---|---|---|
| Main thread | Floor | Ledger | Casebook | Floor closest |
| WP1 (its own work) | Floor | Ledger | Casebook | not claimed |
| Astra (`-e high`) | Floor | Casebook | Ledger | none yet; Floor closest |
| Opus critic (fresh) | Floor | Casebook | Ledger | none yet; Floor closest at five seconds, fails the closer look on layout, not anatomy |

**The pick: Floor (D59).** Unanimous. The only one read cold as a studio's game rather than a styled web page; the
only GM that avoids the cute-robot tell; its yard shows one person swamped by 18 dogs before a number is read; the
strongest yard rail and report hero.

## What Floor must fix before and in production (both critics, merged)

| # | Finding | Source | Verdict | Where it goes |
|---|---|---|---|---|
| 1 | Generated sprites drift in camera, light and facet density; a material clash (faceted dogs, photographic grass, a semi-real face) | both | **Accepted** | The pipeline spike (below), then WP4 |
| 2 | One scale per breed; no size variation on the board | critic | **Accepted** | WP3 (placement) |
| 3 | Overlaps: a beagle across a collie, a corgi under a golden's tail, a golden through the fence, a paw on the board lip, a toy in a dog's legs | both | **Accepted** | WP3: minimum spacing, depth sort, inside the fence, no head or leg overlaps |
| 4 | Repeated sprites announce reuse | both | **Accepted** | WP4 (breeds × poses × coats) and WP3 (no clone neighbours) |
| 5 | The board's chamfered front-right corner looks cropped | both | **Accepted** | The board from the pipeline's own camera, square or a deliberate chamfer the fence follows |
| 6 | The GM is a smooth sphere in the UI and a faceted one in the scene; only two states shown | both | **Accepted** | One GM asset in three states (getting ready, running the week, the week is over) used by the page and the yard |
| 7 | First screen reading order: the "you own it" card floats in the art | both | **Accepted** | WP2: the premise at the top of the left rail, then the plan, the picks, the Why and the button in one flow |
| 8 | The GM's choices on the yard are small grey text | both | **Accepted** | WP2: the choices as the rail's second line, in plain weight |
| 9 | The Incident badge with a marker on the dog involved | critic | **Accepted in part** | The trace counts incidents per block, not per dog: marking a dog would invent behaviour (D60). The board marks the block (a pulse at the floor, the badge), never a particular dog |
| 10 | Profit headline should say it is before the GM's bonus; show after-bonus profit ($4,853.70) | Astra | **Accepted in part** | WP2 labels the headline "before the GM's bonus" (the table already says so). An after-bonus figure is a new number on the report and in the sheets: an owner decision, listed for the gate, not built |
| 11 | "+$128" beside "+$95.80" | critic | **Accepted** | WP2: the bonus row always shows cents |
| 12 | Text: an orphan "in", "Standard" and "Premium" cramped, a two-line Why box, wrapped HUD labels | critic | **Accepted** | WP2: the Why at least four lines; segments sized to their words; no orphans at 1366 |
| 13 | The labelled bonus-plan table (Measure / In the plan / Amount) from Ledger | critic | **Accepted** | WP2 |
| 14 | Projector: the board on a grey surround, pale rules, grey zeros | both | **Accepted** | The owner's rehearsal; WP2 darkens rules and zeros to pass 4.5:1 |
| 15 | The orb could read as cold or surveillant to a teacher | critic | **Noted** | A judgement for the owner at the checkpoint |

## The pipeline spike (decides D59's production method by Oct 30)

Two Opus agents in parallel, the same sample, the same locked camera and light (Floor's key frame `wp1-floor-key2`):

- **Spike A, generated:** GPT image through `Tools/Agent/mockup.sh`, one breed's strip per call on a flat key colour,
  the key frame as the style and camera reference; cut, normalised to one scale, baked shadows removed, contact
  shadows in code.
- **Spike B, modelled:** low-poly models built in code with three.js (a devDependency, used only at build time),
  rendered headless to transparent sprites from one isometric camera and one light. The board, the clubhouse, the
  fence, the dogs, the crew and the GM all from the same camera.

The sample: a corgi and a golden in three poses each (moving, sitting, asleep), an adult crew member, the GM in three
states, and a 4 × 4 piece of the board with the fence, composed into one frame at the yard's scale. The three readers
judge the two samples side by side against the bar and D58; the better one is D59's method.

## The spike's verdict (Oct 28): the hybrid

Spike A (generated, `Temp/spike-a/`), spike B (three.js models rendered from one camera, `Temp/spike-b/`) and the
hybrid H (B's board and GM, A's dogs and crew, `Temp/spike-hybrid/`), judged side by side by the three readers:

| Reader | Ranking | Which method for which part |
|---|---|---|
| Main thread | H, A, B | dogs and crew A; board and GM B, re-rendered to the figures' finish |
| Sonnet (fresh, saw only the images) | H, A, B | dogs and crew A; board and GM B |
| Astra | A, H, B (as results) | for the final bar, artist-authored low-poly dogs and crew through B's camera; within what we can make, H is the development route; GM and board B |

Why not B's dogs: all three readers found them below the bar (the golden reads as a deer or a seal, the corgi a fox,
the crew a mannequin). Why not A's board and GM: a bare, serrated board and three GM states that are three different
objects. Why not an asset pack or an artist: D1 and the Challenge's rule (100% original content made for the Challenge
after Aug 1, 2026) rule out bought or CC0 models, and there is no artist; generated images made for the project and
disclosed are within the rules (D55).

**The method (D59):** the cast (dogs and crew) generated, the set (board, clubhouse, fence, props) and the GM modelled
in code and rendered offline from one camera. The gates the readers set, all accepted:

1. One camera spec (2:1 isometric, about 30° elevation, the backs of the dogs visible) and one scale table pinned in
   code; a generated sprite outside the camera is rejected, not used.
2. A locked reference per breed (its first clean strip) for every later pose; coat drift is a reject.
3. No baked shadows; every shadow drawn in code to one spec that matches the set's softness.
4. One colour grade and a light sharpen on every cast sprite, so the cast sits in the set's finish; the set
   re-rendered with denser facets, soft occlusion and the cast's palette (both sides meet in the middle).
5. Facing: the cast mirrored at run time only after a mirrored contact sheet passes; movement kept to the two
   camera-facing diagonals (no back views needed).
6. Fewer unique dogs, more recolours (one model, two or three coats), to keep the defect rate down.
7. The set's architecture to scale (the clubhouse door about 1.2 × the crew's height); the GM orb's band edge clean;
   the done state reads "done", not "up" or a halo.
8. Before the full cast: a 6 × 3 contact sheet on the board at 1× and 2×, read by the three readers.
