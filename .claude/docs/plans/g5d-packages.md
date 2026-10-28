# G5d Phase 2: the package briefs

Every package reads first: `CLAUDE.md`; `.claude/docs/plans/g5d-look.md` (the bar, severity, D58, acceptance 1 to 9,
file ownership); `.claude/docs/reviews/g5d-directions.md` (why Floor, the fix list rows 1 to 15, the spike's verdict
and gates 1 to 8); `src/assets/art/manifest.ts` (the art contract). The look to build: `Temp/direction/floor/`
(`screen.png`, `yard.png`, `report.png`, `tile.png`, and its HTML/CSS in `screen.html`, `yard.html`, `report.html`,
`brand.css`: borrow freely, it is ours). Words: nothing new on the student's screen unless this brief names it; the
bans are `tests/ui/bans.ts`; the GM is "it". Never edit a file outside your package's list. Report the tests and checks
you ran with their numbers.

Check your work with `npm run build`, then `npm run shots` (22 states into `Temp/shots/<stamp>/`; look at every one at
full size), `npm test`, `npm run lint`, `npm run e2e`, `npm run perf`. In a worktree, set your own ports
(`E2E_PORT`, `SHOTS_PORT`, `PERF_PORT`) so you never collide with another package.

## WP2 the brand and the page (Opus, in a worktree)

**Files:** `index.html`, `src/style.css`, `src/report.css`, `src/main.ts`, `src/ui/app.ts`, `src/ui/editor.ts`,
`src/ui/teacher.ts`, `src/ui/icons.ts`, `src/ui/report.ts` (markup and formatting only), `src/ui/rail.ts` (build
`railModel`; its tests are `tests/ui/rail.test.ts`, failing 7 on the stub), `package.json` and `package-lock.json`
(fonts only: add `@fontsource-variable/archivo`, remove Fredoka and Nunito).

**Build:** Floor's page at 1366 × 768: the navy bar with the wordmark, "Good Dog Daycare", the round badge and the
Teacher control; the left rail with the premise first (the tagline and the round's note), then the bonus plan as a
labelled table (Measure / In the plan / Amount; locked, editable, on and off distinct), then the five picks on one
grid with room for every word, then the Why (at least four lines) and Put the GM to work, in one reading order; the
yard on the right (the canvas, WP3's). While the week runs, the rail shows `railModel`'s values for the block (the
status line, the day and block, the GM's choices as the second line in plain weight, dogs per staffer against 15 with
the over-limit part marked, incidents this week and this block, cash with its start, reputation with its change, the
meters, tomorrow, the solo days, sick this week and this block) and the timeline Mon to Fri. When the week is over:
the scorecard beside how the business did (profit, incidents, reputation, blocks over the limit) with equal weight;
"You called N of 5." stays, never styled as a win. The report as Floor's P&L: the headline tiles, "Profit this week"
labelled before the GM's bonus, the bonus row with cents always ("+$128.00"), rules and zeros at 4.5:1. The tray as a
teacher's panel, grouped. The GM on the page is the set's orb (`src/assets/art/set/gm-*.webp` from WP4b; until they
land use `Temp/spike-b/sprites/gm-*.png` copied into your worktree as placeholders, and say so); if an image fails
to load nothing broken shows (no broken-image icon, no alt text on the stage). Keep every id, the picks' contract
(`src/ui/prediction.ts` ids), the fold (the button's bottom ≤ 700 px at 1366 × 768, above the open tray), focus to the
called line, reduced motion, contrast. Canvas tokens: expose `--c-ink`, `--c-muted`, `--c-surface`, `--c-amber`,
`--c-danger`, `--c-ok` and `--font-ui` on `:root` for WP3.

**Done when:** `tests/ui/rail.test.ts` green, the whole suite green except `tests/art/qa.test.ts`, lint, build, the
e2e (all 9) green, the perf budgets in the plan's acceptance 7 met, and your own look at all 22 shots finds nothing
you would not ship. Commit on your worktree's branch (do not push, do not merge) and hand back the branch name.

## WP3 the yard (Opus, in a worktree)

**Files:** `src/ui/replay.ts` (and `tests/ui/replay.test.ts` only if a frame test must follow a moved function; say
so).

**Build:** the canvas draws only the yard: the set's board image (`set.json`), the cast (`cast.json`) placed on the
board's world map by the trace (the frame's floor dogs, crew, walkers, naps, a clean, a closed day), each figure on its
foot anchor; depth by the ground point; one scale per breed (never rescaled); a minimum spacing so no head or leg
overlaps another figure; every anchor inside the fence and off the blocked footprints; no two neighbours the same
sprite; facing chosen per figure and mirrored only as `manifest.ts` allows; contact shadows drawn in code, one spec
(a projected silhouette plus a contact ellipse, matched to the set's softness); the GM orb in its state at
`set.gmSpot`; an incident shown as a pulse on the floor and the badge, never on a particular dog (D60: nothing moves
to show an action the trace does not record; visual randomness from its own seeded generator, never the engine's);
captions as the frame gives them, drawn small or left to the rail (WP2 shows them too: pick one and say which). The
HUD leaves the canvas (WP2's rail). Keep the G4 vector drawing as the fallback if the art fails, `replayFrame`,
`replayClock`, `planWords` and their tests unchanged, the backing caps, reduced motion. Until WP4a and WP4b land, use
placeholders in your worktree: `Temp/spike-b/board.png` with a `set.json` you write from `Temp/spike-b/board.json`,
`Temp/spike-a/sprites/*` with a `cast.json` from `Temp/spike-a/anchors.json`, `Temp/spike-b/sprites/gm-*.png` (they are
dropped at the merge; WP4's files win).

**Done when:** the suite green except `tests/art/qa.test.ts`, lint, build, the e2e green, perf within budget, and
your own look at the mid-week shots (Round 1 packed, the careful week, the fallback) finds nothing you would not ship.
Commit on your worktree's branch and hand back the branch name.

## WP4a the cast (Opus, in the main checkout)

**Files:** new files only: `src/assets/art/cast/*`, `src/assets/art/cast.json`, `docs/art-provenance/cast/*` (the
generated originals, losslessly), `Tools/Art/cast/*` (your scripts), and the cast's rows in
`docs/art-provenance/README.md`.

**Build:** the cast through `Tools/Agent/mockup.sh` under the eight gates: five or six breeds (golden, corgi, collie,
beagle, poodle, lab) with two or three coats where one model can carry them, each in moving, sitting and asleep; the
crew, an adult, with a leash, a ball and a mop. One subject's strip per call on a flat key colour, the breed's first
clean strip as its locked reference for the rest, the camera of `manifest.ts` (the backs visible), no baked shadows;
keyed, cut, colour-graded and lightly sharpened to one finish, scaled to the scale table, written as WebP with
`cast.json`. Every sprite checked by you figure by figure with `Tools/Agent/art_qa.py` (your check does not count as
one of D58's three). Gate 8 first: a 6 × 3 contact sheet on the board (`Temp/spike-b/board.png` until WP4b's lands) at
1× and 2× in `Temp/cast/contact-1x.png` and `contact-2x.png`; hand that back before the last breeds if it shows a
problem with the method. Budget: about 20 image calls; on CODEX USAGE LIMIT HIT or CODEX LOGIN STALE stop and say so.
Do not run `npm run build`, the e2e or the shots (the worktrees do). Provenance: tool, model, date, every prompt
verbatim, the reference used, every transformation.

**Done when:** `cast.json` lists every sprite, every file is WebP with real alpha and no fringe on light or dark, the
contact sheets are made, and the provenance is written. Hand back the list with your own read of each.

## WP4b the set and the GM (Opus, in the main checkout)

**Files:** new files only: `Tools/Art/set/*` (its own `package.json` with three.js, installed there, never in the
root `package.json`), `src/assets/art/set/*`, `src/assets/art/set.json`, `docs/art-provenance/set.md`.

**Build:** from spike B's pipeline (`Temp/spike-b/`, the code is ours to reuse): the board (the lawn in two greens,
square corners, the soil edge, the fence on the back two sides and a gate, the clubhouse to scale: its door about
1.2 × the crew's height, a few bushes and props at the edges only, a water bowl), rendered from the one camera at the
size the yard needs (about 1100 × 800 CSS px at 2×), re-rendered toward the cast's finish (denser facets, soft
occlusion, the cast's warmer palette, lower contrast) so the two meet in the middle; `set.json` with the board map in
`manifest.ts`'s shape (the origin, the pixels per metre, the lawn, the margin, the blocked rectangles). The GM orb in
three states with a clean band edge: getting ready (dim), running the week (bright), the week is over (bright with a
cue that reads "done": a settled ring or a check of light, never a halo or a face, never "up"), each also rendered at
the page's size (about 64 CSS px) for WP2. Your own checks with `Tools/Agent/art_qa.py` (not one of D58's three).
Provenance: AI-assisted code, the tools, the renderer and its version, the steps.

**Done when:** `set.json` and every image land, a composite of the board with the spike's cast at 1× and 2× is in
`Temp/set/`, and the provenance is written. Hand back the paths and your own read.

## WP5 the words around it (Sonnet, after the merge)

`README.md` (the walkthrough and the disclosure: the cast generated, the set modelled with AI-assisted code),
`docs/capture.md`, `docs/lesson/teacher-guide.md` where a screen it describes changed. Briefed when WP2 to WP4 are in.
