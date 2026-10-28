# G5d: the look, reopened (a studio's product at first glance, with no defect a person can find)

## Goal

The owner, Oct 28, after G5c went live: the brown poodle at the right of the header has two heads, "its unacceptable.
the previous thread was told to not stop until this looked like it was produced by a multimillion dollar company. it
looks like a nice ai generated web app. reopen the goal for opus, sonnet agents with astra through codex cli."

G5c's goal stands ("do not settle until you feel people would think this is created by a multimillion dollar ed
tech company at first glance"); G5d is the work to meet it. Nothing in the engine, the rules, the flow of D50 to D53,
the five picks (D56) or the words changes, except where this plan names a word change and the bible changes first;
the pilot's numbers cannot move.

## Why G5c fell short (the main thread's read and Astra's unanchored read, Oct 28)

1. **Nobody looked at the art figure by figure.** Every review judged the page at 1366 × 768, where the hero is a
   150 px band; Astra was asked about layout. The two-headed poodle (x2000 to 2260 of the original) sat in every
   screenshot.
2. **Defects at full size:** the two-headed poodle; the crew drawn as a child in both poses, hands unclear on the ball
   and the mop; the sheets came back with red and yellow streaks for "transparent".
3. **The art reads as generated and is not one system:** GPT's painterly storybook scene, plush big-eyed figures, a
   plastic stock robot (white, visor face, cap, clipboard), flat outline icons; figures with no shared camera or ground
   contact ("stickers over a painting"); four poses stamped 18 times; a washed band under the front fence.
4. **The UI reads as a template:** a preschool register (Fredoka, cream, plush) for AP Business; every row a card or a
   pill, containers in containers; read-only On/Off pills that look clickable; a ragged prediction grid with the Why
   box indented around the robot; a waiting screen of empty lawn and a big robot; the mascot taking a third of the
   stage mid-week; a HUD with unclear scopes ("2 dogs sent home sick" beside "Sent home sick 3"); the tray like a
   debug toolbar.
5. **The hierarchy teaches the wrong thing in two places:** "You called 5 of 5" celebrates a week with 7 incidents
   (prediction accuracy reads as business success), and the report does not read as a P&L.

## The bar, severity and the stop rule

**The bar.** Shown cold, for five seconds, to a teacher, a 16-year-old or a judge: they believe a well-funded edtech
studio made it; a closer look finds no blocking or high defect.

**Severity.** *Blocking:* an anatomy error, a child as crew, text or a logo in art, a halo or fringe visible on the
page, a broken contract (fold, ids, words, no network), a pick or count that disagrees with the trace. *High:* a
style clash between parts of the set, a figure off the ground or out of the scene's camera, a clone pair side by side,
text below the minimum size, an unclear scope, a state whose primary question is not answered first. *Medium:*
misalignment, uneven spacing, a weak hierarchy inside one card, a control state that is ambiguous. *Low:* taste.

**The stop rule.** A review round is fresh shots (`npm run shots`), fresh art QA crops (`Tools/Agent/art_qa.py`), and
three independent reads: the main thread, Astra (`-e high`, viewing the images), and a fresh Opus critic given the bar,
the severity scale and the images and nothing else. Done when two rounds in a row return no blocking or high finding
and no more than three mediums from any reader, every shipped image has its three clean D58 passes, and the suite is
green; a round counts only if something changed since the last. **Budget:** four review rounds and three regenerations
per asset; past that the owner decides between shipping, the fallback or more time. Then the owner's gate.

## Decisions

- **D58 No image ships without three clean figure-by-figure passes on its exact bytes.** Amends D55. Each image in
  `src/assets/art/` is read by three independent readers (the main thread, Astra, a fresh Sonnet agent) from
  `Tools/Agent/art_qa.py` crops at 2× or more on light and on dark, from the full image at 1×, and from the page's own
  crop of it in the shots. Each pass is a row in `docs/art-provenance/qa.md` carrying the first 12 hex digits of the
  file's SHA-256; `tests/art/qa.test.ts` fails unless every shipped file has a clean pass from each reader on its
  current bytes, no open defect, and a provenance entry. **The checklist:** each animal's visible parts coherent (one
  head, the eyes, ears, nose, mouth, legs and paws that the pose shows, plausible occlusion, nothing merged or doubled,
  the tail by breed), the breed readable; each person an adult by proportion (head about a seventh of the height, not
  a child's head-to-body ratio or eyes), arms, hands and legs coherent, clothes continuous; the GM the same character
  in every pose; no text, letters or logos; no halo, fringe or speck on light or dark after resizing; one camera, one
  light direction, one finish across the set; no figure cut by the image's edges or the page's crop (scenery may run
  off the frame). A defect means regenerate, or a controlled
  repair recorded in the provenance with a full re-review; never "too small to see".
- **D59 The direction is reset for the audience** (written when the sprint picks it): the chosen direction, why, what
  it rejects. G5c's concept A is superseded.
- **D60 Motion never invents business behaviour** (written with WP3): nothing on the yard moves to show an action the
  trace does not record; idle life (a breath, a tail) is the only decoration and never suggests supervision, walking
  or care; the visual randomness has its own seeded generator, never the engine's.

## Acceptance

1. Everything G5c's acceptance pins still holds (`.claude/docs/plans/g5c-look.md`, Acceptance 1 to 5): the tests and
   the e2e (the picks' ids and lifecycle, the scorecard, the export), every geometry assertion after fonts and images
   load on Rounds 1 and 3 (the button's bottom ≤ 700 px at 1366 × 768 and above the open tray; the yard ≥ 560 px wide
   with its caption and button above the tray; the comparison in view after the week), the transfer under 1.5 MB,
   lint, build, `npm run pilot -- --seeds 20 --budget 60000` at G2's twenty counts, native controls, contrast ≥ 4.5:1
   for text and ≥ 3:1 for focus, the check mark on a chosen chip, reduced motion in both renderers, no remote URL, the
   word bans and the briefs.
2. **D58**: `tests/art/qa.test.ts` green (seen failing on G5c's art: 20 failures).
3. **The art**: one illustration system across the hero, the yard, the characters and the icons, in one camera; at
   least four breeds, each at least moving and asleep, mirrored, placed so no two neighbours are the same figure; adult
   crew; one GM treatment that reads as an AI at a glance and is not the stock visor robot (restrained is allowed).
4. **The brand**: a wordmark (SVG, code), a grown-up type pairing (OFL, bundled from `@fontsource`, at most three
   files), tokens for palette, type, spacing and radius, and every surface built from the same components.
5. **Each state answers its primary question first:** the load (what do I do: read the plan, make five picks, put
   the GM to work); getting ready (the GM is preparing; what we predicted); mid-week (what the GM is doing now and
   what it is costing: the crowding, the incidents, the cash); the scorecard (**how the business did** beside **what
   you called**, with equal weight; D56's words stay); the report (a P&L: money first in aligned columns, then
   operations); the tray (the teacher's controls, grouped, not a debug strip).
6. **Readable and usable:** text ≥ 15 px and canvas labels ≥ 16 px at 1366 × 768; warnings and thresholds carry a
   non-colour cue; a keyboard-only e2e (the picks, Why, Put the GM to work, focus to the called line, the tray opens and
   returns focus); an e2e that collects the page's text and every canvas string across a run and asserts the bans;
   the sick counts scoped in words (BRIEF first).
7. **Performance, throttled headless (CPU 4×, `npm run perf` after a build), no regression beyond 10% on G5c's
   numbers.** G5c's baseline, three probes on Oct 28 on the owner's Mac: the click to the week's first frame
   1,389 to 1,418 ms on the first run and 1,109 to 1,145 ms on the reruns; frame time p95 16.7 to 16.8 ms; 0 long
   tasks while the week plays; 4.4 MB of heap after three runs. Budgets: first run ≤ 1,560 ms, reruns ≤ 1,260 ms,
   p95 ≤ 18.4 ms, 0 long tasks, heap ≤ 4.9 MB. The owner's Chromebook run is the real check.
8. **Disclosure**: provenance for every shipped image (tool, model, date, prompt, references, transformations,
   repairs; AI-assisted SVG included), a fonts inventory with the licence notices, the README's disclosure, and the
   submission checklist's Approach and References rows current.
9. **The stop rule** holds, with every round's findings and triage in `.claude/docs/reviews/g5d-look-rounds.md`.

## Schedule (freeze Nov 5; pilot Nov 9)

| Date | Step |
|---|---|
| Oct 28 | Plan, Astra's plan review, seams and tools; WP0 the fallback; WP1 the direction sprint starts |
| Oct 29 to 30 | The three directions; the ranking (main thread, Astra, critic); the owner's checkpoint; D59; the manifest and token seams |
| Oct 30 to Nov 2 | Phase 2 production; review round 1 on Nov 1 |
| Nov 2 to 4 | Review rounds 2 to 4 and fixes; Astra on the group's diff; the commit |
| Nov 4 to 5 | The owner's gate: the Mac, the Chromebook (cold load, `?pilot=20`, a Round 3 plan), the projector from the back row; merge or the fallback |
| Nov 6 to 8 | Deploy, verify the live page, print, pilot prep; only blocking fixes after the freeze |

## Seams and tools (main thread)

Done on Oct 28: `npm run shots` (`e2e/shots.ts`, the preview server shared with the capture in
`e2e/serve.ts`); `Tools/Agent/art_qa.py` (figures by connected opacity, scenes in ~700 px tiles, 2× on cream and
near-black, a contact sheet); `docs/art-provenance/qa.md` and `tests/art/qa.test.ts` (failing, 20); `npm run perf` (`e2e/perf.ts`, the
throttled probe and its baseline above); the keyboard and runtime-words e2e (the bans shared in `tests/ui/bans.ts`;
it failed first on the product's name and the reputation unit "per point", both now listed as allowed, and passes on
G5c). WP0 done: `g5c-fallback` at `611145a` (the header's calm middle, three clean passes).

Before Phase 2: the shots' added states (finding 9); `src/assets/art/manifest.ts` (each asset's id, file, kind, native
size, foot anchor, facing) with the loader's failure behaviour; the canvas token names WP3 reads from CSS custom
properties; the keyboard e2e and the runtime-words e2e (failing where the new look must change something); the
performance probe and its baseline numbers.

## File ownership

| Owner | Files |
|---|---|
| Main thread | the plan, the reviews, `docs/art-provenance/qa.md`, `src/assets/art/manifest.ts`, `e2e/*`, `tests/*`, `docs/BRIEF.md`, `docs/DECISIONS.md`, `docs/submission-checklist.md`, `CLAUDE.md`, the roadmap, HANDOFF, `package.json` scripts |
| WP2 | `index.html`, `src/style.css`, `src/report.css`, `src/main.ts`, `src/ui/app.ts`, `src/ui/editor.ts`, `src/ui/teacher.ts`, `src/ui/icons.ts`, `src/ui/report.ts` (markup), `src/ui/status.ts` (words only if the bible changed), `package.json` dependencies and `package-lock.json` (fonts only) |
| WP3 | `src/ui/replay.ts` |
| WP4 | `src/assets/art/*` except the manifest, `docs/art-provenance/` except `qa.md`, `Tools/Agent/cut_sprites.py` |
| WP5 | `README.md`, `docs/capture.md`, `docs/lesson/teacher-guide.md` (only a screen it describes) |

## The work

**WP0, the fallback (main thread, now).** G5c with the hero repaired: the right edge with the poodle and the tunnel
cropped out, re-encoded, three D58 passes, e2e green, on branch `g5c-fallback` at a recorded commit. If G5d misses
the gate, that commit deploys.

**Phase 1, the direction sprint (WP1, Opus, creative director).** Three directions that differ in hierarchy,
composition and illustration method, not in palette; at least one draws its illustration in code (SVG). Each: a
rationale; a style tile; the load screen at 1366 × 768 in real HTML with the real copy; the crowded yard mid-week (18
dogs, one adult crew member, the GM, the HUD) and a report excerpt with money first; an illustration key frame
(`Tools/Agent/mockup.sh`, at most three image calls per direction), checked figure by figure by WP1 itself. The main
thread, Astra and a fresh Opus critic rank them against the bar; the owner sees the three (a checkpoint, one look; the
team's pick stands if he says nothing); the main thread writes D59.

**The brief.** Audience: 16 to 18 year olds in AP Business on Chromebooks and a classroom projector, and judges who
see it cold. Feel: a premium management game from a well-funded studio: confident, warm, a little witty, grown-up;
the polish of Duolingo, Brilliant or Headspace and the at-a-glance clarity of a good tycoon game's UI. Light theme.
Each state answers its primary question first (Acceptance 5). Avoid the tells: rounded-everything with pastel icon
squares, a cream page of soft-shadow cards, a rounded "kids" display face, sparkles and emoji energy, a stock robot,
painterly texture beside flat UI, the same sprite repeated, gradients for no reason, text inside images.

**Phase 2, production** (parallel after D59 and the seams):

| Package | Model | What it builds |
|---|---|---|
| WP2 the brand and the page | Opus | The wordmark, the type, the tokens and components; the hero; the plan (locked, editable, on and off states distinct); the picks on one grid with the Why and the button aligned; the scorecard with the business beside the call; the GM beside the status line, restrained; the waiting state; the report as a P&L; the tray as a teacher's panel; focus, motion, the fold. G5c's ids, words and contracts stay. |
| WP3 the yard | Opus | The week in one camera: figures on their foot anchors with contact shadows, depth by y, breeds and poses varied and mirrored with no clone neighbours, adult crew, the scene's front edge whole (no washed band), the HUD in WP2's tokens with clear scopes, getting ready, the vector fallback, reduced motion, D60. `replayFrame` and its tests unchanged. Starts behind the manifest on today's sprites; swaps in WP4's set. |
| WP4 the art | Opus | The direction's images: one figure or a small strip per generation on a flat key colour, or SVG if D59 says so; masks checked after resizing; cut and compressed; the provenance and the fonts inventory; its own check is not one of the three passes. Regenerate (or repair with a record) until clean, within the budget. |
| WP5 the words around it | Sonnet | The README's walkthrough and disclosure, the capture's shot list, the teacher guide where a screen it describes changed. |

**Phase 3, review rounds** until the stop rule: shots and crops; the three reads; the D58 passes for each new or
changed image (the Sonnet reader a fresh agent each time); triage into the rounds file; fixes to the package that
owns the file. Then Astra on the group's diff, the triage, one commit.

## What the owner will see

At the checkpoint: three directions side by side (the load screen, the crowded yard, the report) with the team's
ranking. At the gate: the page cold on the Mac, the Chromebook and the projector, a product with a brand and one
illustration world, a GM that is not a stock robot, a week in the yard that looks like one place, a scorecard that
shows how the business did beside what was called, a report that reads as a P&L; and the trail: the directions, every
round's findings, the QA ledger with each image checked figure by figure by three readers.

## Plan review

Astra (`.claude/docs/reviews/g5d-plan-astra-triage.md`): an unanchored read of the art and screens (confirmed the
poodle and the child crew; found the scorecard and report hierarchy problems, the sticker yard, the unclear sick-count
scopes), then fifteen plan findings, all accepted, three in part (the Chromebook and the screen reader are the
owner's devices; the pixel binding was already built). The changes: severity and a budget for the stop rule; a fixed,
tested fallback now; a dated schedule; harder states in the sprint and an owner checkpoint; exclusive file ownership
and the manifest and token seams; throttled performance budgets; minimum sizes; keyboard and runtime-word e2e; more
shot states; D60 on motion; the full disclosure chain; per-state primary questions; D58 reworded; ornament cut first.
