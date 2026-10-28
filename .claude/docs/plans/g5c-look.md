# G5c: the look (a game a class would believe a real studio made)

## Goal

The owner, Oct 28, after seeing the page at 1366 × 768: it must not look like a hacked-together AI website; it
should look "professional, polished and gamified", and "do not settle until you feel people would think this is
created by a multimillion dollar ed tech company at first glance". He allowed GPT image through the Codex CLI "for
mockups or production graphics if used carefully and sparingly" (D55).

Today the page is correct and plain: a heading, grey sliders, a small blue button, a white box below the fold, a yard
of flat vector dogs, and a dense spreadsheet. After G5c it reads as a product: an illustrated Good Dog Daycare world,
the AI GM as a character, the bonus plan as a set of chunky measure cards, the prediction as five quick picks that
flip to a scorecard when the week is over, an illustrated yard with real sprites, and a report that leads with its
headline numbers. Nothing in the engine, the rules, the flow of D50 to D53 or the words changes; the pilot's numbers
cannot move.

## Art direction (chosen from three generated concepts, `Temp/AgentMockups/concept-*.png`)

Concept A, "warm illustrated" (premium consumer edtech): cream page, an illustrated yard across the top, rounded
chunky cards with soft shadows, a confident rounded display face and a friendly body face, deep teal, coral, sunny
yellow and cream, generous spacing. Light, because a projector in a lit classroom washes out dark panels (concept B);
illustrated, because a brand needs a world (concept C had none). Borrowed from B: bold tabular numerals for money and
counts, and the GM as a character card.

## Decisions

- **D55 Generated art may ship, sparingly, with the owner's approval and disclosed.** Supersedes D16. GPT image
  through the Codex CLI (`Tools/Agent/mockup.sh`) makes the concepts (references, never shipped) and four production
  images: the hero yard, the AI GM in three poses, the dog and crew sprite sheet, and the empty yard the week is drawn
  on. Each shipped image lives in `src/assets/art/` with its prompt in `src/assets/art/PROMPTS.md`; the README's
  disclosure names them. Icons, controls and every word stay code (CSS, SVG, HTML). They are new images made for the
  Challenge after August 1, 2026 (D1). Provenance in `docs/art-provenance/README.md` (tool, model, date, each prompt
  verbatim, the originals, the steps to each shipped file); the submission's References and Acknowledgements carry
  it. (Owner, Oct 28.)
- **D56 The prediction is five picks and a why; the readout flips them to a scorecard.** The five picks are five of
  the report's measures (days it accepts every booking, the day rate, days with 1 staffer on the floor, nap blocks,
  incidents; the sentence's four counts and the rate), as chips in buckets; "Why?" stays free text and is the export's `prediction` (D47).
  Put the GM to work waits until all five are picked (predict before the run). When the week is over each pick shows
  what the GM did, called or missed, and "You called 3 of 5." The export adds the picks and the check. The paper
  briefs ask the same five with the same words (D54). Gamified without points: the bonus stays dollars (D45) and
  nothing on the page is a score of the GM. The lifecycle: the picks lock with the run and stay locked while the
  scorecard shows the click's picks; a plan edit, a round change or "Make a new prediction" clears the run with its
  scorecard (D37) and brings the picks back as they were; "Put the GM to work again" reruns with the same picks. The
  pilot predicts nothing and shows no scorecard. Definitions (briefs and guide): a closed day never counts as accepting
  every booking or as a solo day; the rate is over the open days ("A mix" is more than one); naps count the blocks
  that napped.
- **D57 Above the fold, the plan and the prediction side by side.** Revises D42's one column: D42 rejected two
  columns because the editor's rows and the learning curve could not share a row at 1366 px; the curve has left the
  student's page (D50) and the prediction is now five short rows, so the plan and the prediction share the row and
  the button sits in the prediction card. Below 1100 px wide they stack. The fold's numbers stay (the button's bottom
  ≤ 700 px at 1366 × 768, above the open tray).

## Acceptance

1. `npm test` green, every new or changed test seen failing first:
   - `tests/ui/prediction.test.ts` (the seam, `src/ui/prediction.ts`): the five picks' labels and options; complete
     only when all five are picked; the buckets at their edges; the rate off the open days (one rate, a mix, none on a
     closed week); the scorecard's words ("1 to 4 (3)", "A mix (low × 1, premium × 4)", "Closed all week"); "You called
     3 of 5."; Round 1 on seed 1 called 5 of 5 by the packed-yard picks.
   - `tests/ui/report.test.ts`: the headline tiles (the seam `headlineTiles` in `report.ts`): profit, the GM's bonus,
     incidents, reputation start → end, blocks over the legal ratio, in that order, with the report's own formatting.
   - `tests/ui/export.test.ts`: the export carries `predictionPicks` and `predictionCheck`.
   - `tests/ui/words.test.ts`: the page's ids the e2e uses, the bans unchanged, the pick labels on the page, the art
     loaded from local files only; `tests/scaffold.test.ts` unchanged (no remote URL).
   - `tests/lesson/materials.test.ts`: each round brief asks the five picks by the page's labels.
2. `npm run e2e` under 60 s of Playwright time: the picks are made before the click and the button waits for them; at
   1366 × 768 the Put the GM to work button's bottom ≤ 700 px on load; the flow and the twin checks unchanged; the
   scorecard shows 5 rows and the called line after the week; the export's picks and check match.
3. Every existing geometry assertion of the e2e holds after fonts and images load (the button, the open tray, the
   yard ≥ 560 px with its caption and button above the tray, the comparison in view after the week), on Round 1 and
   on Round 3. `npm run build` with the art: the page's total transfer (HTML, CSS, JS, fonts, images) under 1.5 MB; `npm run lint`;
   `npm run pilot -- --seeds 20 --budget 60000` at G2's twenty counts.
4. The look, judged on screenshots at 1366 × 768 (load, the GM getting ready, mid-week, the scorecard, the report,
   the tray open) by the main thread and by a second reader (Astra reads the screenshots), against one question: would
   a teacher seeing it cold believe a well-funded edtech company made it? Iterate until yes, up to the freeze on
   Nov 5. The fallback is `main` at `f784bbd` (G7, already signed off). The gate is the owner's rehearsal on the
   Chromebook and the projector: prediction → run → scorecard → export → edit → rerun, cold load included.
5. Accessibility and motion: native radios in labelled fieldsets, native checkboxes and ranges, the hint tied to the
   button, a check mark (not colour alone) on a chosen chip, focus to the called line after the week, text contrast
   ≥ 4.5:1 and focus rings ≥ 3:1; `prefers-reduced-motion` gives instant scrolls and no flip, bob, pulse or tween,
   with the same week block by block.

## Seams (main thread, before any package)

- `src/ui/prediction.ts` (types, `PICKS`, `emptyPicks`, stubs) and its test.
- `headlineTiles(report, spec, world)` in `src/ui/report.ts` (stub) and its test.
- The export's two new fields in `RunExportInput` and `RunExport` (types) and the test.
- The art in `src/assets/art/` (cut, trimmed, compressed by the main thread from the four generated images) and
  `PROMPTS.md`.
- The e2e's pick-making helper and the scorecard checks.

## Packages

| Package | Model | Files | What it builds |
|---|---|---|---|
| WP1 the page | Opus | `index.html`, `src/style.css`, `src/main.ts`, `src/ui/app.ts`, `src/ui/editor.ts`, `src/ui/teacher.ts`, `package.json` (the two font packages) | The design system (tokens, the display and body faces bundled from `@fontsource`, cards, chips, toggles, buttons, focus states, motion that respects reduced motion); the hero (the yard art, the title, the tagline, the round badge); the GM character beside the status line in its three poses (getting ready: thinking; the week: standing; the week is over: presenting); the bonus plan as measure rows with an icon each (inline SVG), a toggle and the dollar amount; the prediction card with the five pick rows as chips and the Why? box; the button inside it, disabled until the picks are made, with a line saying so; after the week the card flips to the scorecard (each pick, what the GM did, called or missed) with "What the GM did" and the called line; the tray restyled; the fold. |
| WP2 the yard | Opus | `src/ui/replay.ts` (drawing only), the replay's colours | Art decoded once before the first week plays, the yard cached offscreen per resize, the G4 vector drawing kept as the fallback if an image fails, the backing caps kept, reduced motion honoured (no pulse or tween). The week drawn on the yard art with the sprites: dogs (four breeds, playing or asleep for a nap), the crew (with a ball, or a mop for a clean), crated dogs during a clean, the walk group outside the gate, the closed sign; depth by y; a HUD in the design's cards (the ratio gauge, incidents with a pulse, reputation, cash in bold numerals, the small meters); captions as pills; readable from the back of a room. `replayFrame` and the frame tests unchanged. |
| WP3 the report and the picks | Sonnet | `src/ui/report.ts`, `src/report.css`, `src/ui/prediction.ts`, `src/ui/export.ts` | `headlineTiles` and their rendering above the table; the table tidied (sticky first column, group headings, the activities as small chips, a red tint on cells over the legal ratio, the week column set apart); the prediction functions; the export's two fields. |
| WP4 the sheets and the capture | Sonnet | `docs/lesson/brief-round*.md`, `docs/lesson/teacher-guide.md`, `e2e/capture.ts`, `docs/capture.md`, `README.md` (the walkthrough) | The five picks by the page's labels on each brief (circle one) with the definitions, the Why line; the guide's run description and Period 1 (the class makes five picks together) and the scorecard; the capture makes the packed-yard picks through the chips; the shot list and the README's walkthrough with the picks and the scorecard. |

The main thread writes the seams, the tests, the e2e, the art pipeline, BRIEF sections 1, 10 and 11 for the picks and
the scorecard, D55 and D56, the README's disclosure of the art, CLAUDE.md, the roadmap, HANDOFF and the triages, and
runs the screenshot loop.

## What the owner will see

The page at 1366 × 768: an illustrated yard across the top with the title and the round badge; the GM's bonus plan
as six measure rows with icons and toggles on the left; the team's prediction on the right as five rows of chips and
a Why? box, with a big coral "Put the GM to work" that lights up when the five are picked. On the click, the page
slides to an illustrated yard where the GM, thinking, gets ready for Monday; then the week plays with real dogs and
crew; then the page slides back to the prediction card, now a scorecard: "You called 4 of 5." with each pick beside
what the GM did, and below the yard the report opens with five big numbers.

## Plan review

Astra (`.claude/docs/reviews/g5c-plan-astra-triage.md`): twelve findings, ten accepted and two in part. The changes:
the picks' lifecycle (locked with the run and while the scorecard shows; cleared with the run; back as they were);
the click's copy feeds the scorecard and the export; the provenance record; every geometry assertion kept, after the
art loads, on Rounds 1 and 3, with height budgets and D57; the closed day keeps its rate in the fixtures and a real
reckless week is tested; the definitions; the capture, the README and the guide for the picks; the e2e picks through
the chips and compares a mixed scorecard with the export; decode once, cache the yard, keep the vector fallback; the
accessibility and reduced-motion policies; a freeze on Nov 5 with `f784bbd` as the fallback.


## Result (2026-10-28, session 6; every number from this session's runs on the owner's Mac)

**Tests.** `npx vitest run`: 35 files, 370 tests, all passing (360 before G5c). New: `tests/ui/prediction.test.ts`
(8, seen failing on the stubs, then rewritten after the plan review with closed days that keep their rate and the real
reckless week), `headlineTiles` in `tests/ui/report.test.ts` (seen failing), the export's two fields
(`tests/ui/export.test.ts`, seen failing at collection), the curve caption and tagline unchanged, the briefs' five
picks (`tests/lesson/materials.test.ts`, seen failing on 3 briefs). `npm run lint` exit 0; `npm run build` clean.

**Page.** `npm run e2e`: 8 passed in 44.3 s of Playwright's time (44.8 s wall clock). The button's bottom at 637 px
at 1366 × 768 on Round 1 and on Round 3 with all six measures on, after the fonts and the art had loaded, unmoved
under the open tray (its top at 663 px); the yard 686 px wide above the open tray; the scorecard of the packed-yard
picks 5 of 5 called and equal to the export; a mixed scorecard (the edited plan) with called and missed rows equal to
the export's check; "Make a new prediction" clears with the picks kept; the rerun scored; the pilot with no scorecard
and the button waiting; Round 1 from the click to the readout in 8,359 ms. The placeholder's drawn pixels at most 1%
(WP2's measure on the built page: 0.0097 while the GM got ready).

**Round 1 unchanged.** `node src/learn/pilot.ts --seeds 20 --budget 60000`: 20 of 20 target met; episodes to stable
24,000, 27,500, 23,500, 25,500, 28,000, 22,500, 22,000, 23,500, 27,500, 23,500, 27,000, 27,500, 28,000, 24,000,
31,000, 25,000, 25,000, 25,000, 25,000, 22,000: G2's twenty numbers.

**Weight.** The built page a browser fetches (HTML, JS, CSS, the three woff2 faces, the WebP art): 612 KB (`du` over
`dist/`). The yard draws in about 0.8 ms a frame at 811 × 684 in headless Chromium (WP2's bench). `npm run capture`:
23.2 s.

**The look**, judged on seven screenshots at 1366 × 768 (`Temp/g5c-shots/`: load, picks, getting ready, mid-week,
scorecard, report, tray) by the main thread over three rounds and by Astra twice. The page opens on an illustrated
yard band with the title and the round badge; the bonus plan as measure rows with one icon and colour per measure
(read-only On/Off pills in Round 1, switches and sliders when the round unlocks); the prediction as five rows of
chips, a Why box and a coral button that waits for the five; while the GM gets ready the stage shows the yard before
opening and the GM thinking; the week plays on the illustrated yard with the art's dogs and crew and a HUD in cards;
the prediction card becomes a scorecard ("You called 5 of 5."); the report opens with five big numbers.

**What moved during G5c, in order.** (1) The owner's ask and his permission for GPT image (D55). (2) Three concepts;
concept A chosen. (3) Four production images (hero, the GM in three poses, the sprite sheet, the empty yard), cut and
compressed by `Tools/Agent/cut_sprites.py`, 392 KB; provenance in `docs/art-provenance/`. (4) Astra's plan review
(`.claude/docs/reviews/g5c-plan-astra-triage.md`): twelve findings, ten accepted, two in part. (5) Four packages,
then three rounds of review on screenshots: round two (the yard behind the wait, the picks card on the stage, the
breed mix, the sidewalk, the report's chips); round three from Astra's review of the diff and the screenshots
(`.claude/docs/reviews/g5c-astra-triage.md`: fifteen findings, fourteen accepted, one in part: the yard as one
painting, the report at 15 px, the scorecard's reading order, Round 1 read-only, one icon per measure, the hero crop,
one message while waiting, the art before the first frame, reduced motion on the fallback, the Round 3 fold test,
spoken slider units, contrast, three font files, the mixed-scorecard and lifecycle tests). (6) The main thread's own
fixes: the placeholder repainted once the fonts load, the report tiles on the shared icons, the canvas on the shipped
Nunito weight, the guide's pick definitions, the report tiles' icons in their measures' colours. (7) Astra's second
look review: L2, L3, L4 and L6 resolved, L1, L5 and L7 improved; "not yet" on five polish items, all done in a fourth
round (the lawn seam blended and 12 to 20 dogs never overlapping, the chips one size with the check inside, a compact
Teacher tab with the page's bottom clear of it, the tiles' icons coloured, the waiting caption quieter: its words
are the bible's and stay).

**Packages.** WP1 (Opus): the page (`index.html`, `style.css`, `main.ts`, `app.ts`, `editor.ts`, `teacher.ts`,
`icons.ts`, the fonts). WP2 (Opus): the yard (`replay.ts`). WP3 (Sonnet): the picks' rules, the report's tiles and
table (`prediction.ts`, `report.ts`, `report.css`). WP4 (Sonnet): the briefs, the guide, the capture, the shot list,
the README's walkthrough. The main thread: the plan, the art and its provenance, the seams, the tests and the e2e,
BRIEF 1.1 and 11, D55 to D57, the triages, the docs.

**Not done, on purpose.** The projector and the Chromebook (the owner's rehearsal, the gate); a contrast audit with a
tool beyond the computed pairs; the freeze is Nov 5 and the fallback `main` at `f784bbd`.
