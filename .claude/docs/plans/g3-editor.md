# G3: the bonus plan editor

## Goal

The team writes the GM's bonus plan on the page. Six KPIs (BRIEF section 7), each with a toggle and an integer
slider from −10 to +10; the plan shown in plain words as it is edited; a prediction box the team types into before
training, kept beside the readout sentence after training; the round's limit on how many KPIs may be on (section 8:
Round 1 profit only, Round 2 any three, Round 3 all six). The page passes the edited RewardSpec to the Trainer. No
replay, no P&L table (G4); no teacher panel, no export (G5). Round 1 trains exactly as it did in G2.

## Acceptance

1. `npm test` green with the new tests, each seen failing first: the plain-words renderer (a pure function over a
   RewardSpec and the config), the editor rules (the round limit, the clamping, the locked toggles, the round from the
   address), `targetOutcome` and the Trainer's optional target, the pilot harness's `--reward` option, plus
   everything from G1 and G2.
2. `npm run e2e`, the tests' own time (as Playwright reports it; the build and the server start are outside it)
   under 60 s in all: the two G2 tests (the page loads offline-clean with the editor present; the untouched Round 1
   plan trains, paced, to the reckless week in under 60 s, with every control off during the run and Round 1's own
   lock back after it), plus five: Round 1 is locked and Round 2 unlocks it and reloads the preset; on `?round=2` a
   fourth toggle is refused and `#limit` says so; on `?round=3`, turning Incidents on and sliding it to −7 makes the
   words read exactly "Each day, the GM earns 10 points per $100 of profit and loses 7 points per incident.", a
   prediction typed before Train is still there with its exact text after a Fast run ends, that run's status never
   says "target met", its readout and episode count equal those of a node-side Trainer run of the same edited spec
   and seed (and the readout differs from Round 1's), a slider edit clears the run's results, a second run and a
   round change clear them again and reload the preset; Incidents alone trains to the 150,000 cap and ends "stopped
   at the episode limit, the GM is still changing its mind" with the label to match and the node-side sentence;
   `?pilot=1&round=3` trains Round 1 and says so. No request leaves the origin.
3. `npm run pilot -- --seeds 20 --budget 60000`: still 20 of 20 (the editor must not change what Round 1 learns).
   `npm run pilot -- --seeds 5 --reward balanced` (and `--reward <file.json>` for an edited plan) reports episodes to
   stable, stable, `target n/a` and the outcome key per seed, and exits 0 only when every seed is stable within its
   budget; the result section records these numbers for the plans named in "Plans that may exhaust the budget".
4. Owner gate: Fred opens the page, edits a plan without reading any instructions (picks a round, flips toggles,
   moves sliders, types a prediction), trains, and the words on the page match what he set; the readout sits beside
   his prediction.
5. `npm run lint` and `npm run build` clean; `tests/scaffold.test.ts` still pins no off-origin script, style or font.

## Design calls (recorded here; the decisions file carries the one-liners)

- **The round selector.** The round buttons are G5's (the teacher panel). G3 exposes the limit through a small
  `<select id="round">` on the page with the three round presets (labels from `presets.json`), default Round 1, and
  `?round=2` / `?round=3` (or `round2`, `round3`) on the address preloads it; anything else is Round 1. Changing the
  round loads the preset (Round 2 and 3 "start as Round 1", section 8) and keeps the prediction text. G5 moves the
  selector into the teacher panel. (D34)
- **What Round 1 locks.** Section 8 says the other five KPIs are locked off and students only predict, so Round 1
  is locked entirely: no toggle and no slider moves, and `#limit` reads "Round 1: the plan is set. Predict what the
  GM will do, then train." The rule the editor applies is derived from the preset, not from the round's name: a
  preset that already uses its whole allowance (as many KPIs on as `maxActive`: Round 1 is 1 of 1) is locked
  (`planLocked`). Round 2 (1 of 3) and Round 3 (1 of 6) toggle freely up to the limit; `#limit` reads "N of M
  measures on." and, when the limit is reached with a measure still off, adds "Turn one off to turn another on."; a
  toggle that would pass the limit is disabled. Turning off is always allowed. The first draft left the Profit
  slider editable in Round 1; Astra's review read section 8 the other way and the bible wins. (D35)
- **An off KPI** keeps its weight (the preset's suggested weight, D26), shows it, and has its slider disabled and its
  row dimmed; turning it on enables the slider at that weight.
- **The target class is derived from the plan.** `targetOutcome(spec)` is `isRound1Outcome` when Profit is on
  with a positive weight and every other measure is off or weighs 0 (a measure on at 0 contributes nothing), and
  `null` for every other plan. A positive scale keeps the objective and the intended class, not the exact
  trajectory: Astra's probes of +1, +3 and +7 each reached 20 of 20 while stopping at different episode counts from
  +10. `Trainer` takes an optional target predicate that defaults to `targetOutcome(spec)`; with `null` it never
  runs the five extra weeks and reports `hasTarget: false`, `targetMet: false`; the target never touches training,
  the curve or the scheduled evaluations (a test compares a null-target run with the Round 1 run). The page then
  shows "stable" only, never "target met". The pilot harness and the G2 tests pass the Round 1 plan and are
  unchanged. (D36)
- **Plans that may exhaust the budget.** Stable (D29) needs five identical outcome keys. A plan that is indifferent
  to some choices (Incidents only, Dogs served only) may keep flipping the choices it does not pay for and reach the
  150,000-episode cap (Fast: about 1 s; paced: the 60 s budget first): in this session's scratch run, Incidents only
  reached the cap on seeds 1..5, Dogs served only on seeds 1 and 5 and was stable at 68,500 to 79,000 episodes on
  seeds 2..4 (Astra's probe agrees). The page does not hide this: when a run ends without stable, the status says
  "stopped at the episode limit, the GM is still changing its mind" or "60 s is up, the GM is still changing its
  mind", the readout label says "still changing its mind", and the readout shows the fresh greedy evaluation of the
  table as it stands (what `app.ts` already does at the end of a run). The plans with money in them (balanced,
  profit with reputation, all six at the suggested weights, every slider at +10) settled in 22,000 to 35,000
  episodes (18 to 30 s paced) on seeds 1..5. The result section records the same plans through the harness's
  `--reward`. No change to the learner or the key.
- **An all-off plan** trains: every value stays 0, the greedy GM breaks ties from the policy stream, and the run is
  stable (the same draws every evaluation). The words say "The GM is paid nothing: no measure is on." Not blocked;
  the readout teaches it.
- **Every slider at +10** pays the GM for incidents and fatigue. The words say so ("earns 10 points per incident")
  and nothing stops it (brief, Risks).
- **The prediction** is a `<textarea id="prediction">` placed beside the readout sentence in a two-column panel
  above the Train button, so the team meets it before training and reads the readout next to it after. Disabled
  during training, editable after, nothing stored anywhere (D2). G5's export snapshots the text at the click.
- **A run belongs to the plan it was trained on.** The click snapshots the editor's spec (validated) into
  `page.spec` and the Trainer gets that. Any edit or round change after a run clears the run's results (readout,
  status, curve) and the status says "The plan changed. Train the GM to see what it does with this one." so a
  sentence never sits beside a readout of another plan.
- **Controls during a run.** Training and the whole pilot disable everything the team can touch (the editor, the
  round selector, the prediction, the seed, Fast, Train) and restore them in `finally`, the editor to its round's
  own locks, on success and on error alike.
- **The words' hint.** Profit and reputation deltas are signed. The sentence keeps the bible's template; under it,
  `#plan-note` shows `signedNote(spec)` ("Profit and reputation count both ways: a $100 loss or a one-point drop
  counts the opposite of a $100 gain or a one-point rise.", or the profit-only or reputation-only form) whenever
  either is on with a non-zero weight, and nothing otherwise.
- **The pilot mode** (`?pilot=N`) loads Round 1 into the selector, the editor, the words and the training spec
  together, whatever `?round=` says, and its heading says "Round 1"; it stays the Chromebook measurement of
  section 13.
- **Words on the page.** The six names of section 7 (the 70% and the 15 come from the config); the collective noun
  is "measure" (the presets' labels already say "up to three measures"); never "reward function", never "injury".

## The plain-words renderer (BRIEF section 7, the template)

`describeBonusPlan(spec, world)`: the KPIs that are on, in section 7 order, one clause each, joined "A." / "A and
B." / "A, B, and C." after "Each day, the GM ". A positive weight reads "earns", a negative one "loses", with the
absolute value; "1 point", otherwise "N points"; a weight of 0 while on reads "earns 0 points …" (honest: it counts
for nothing). Clauses:

| KPI | Clause (weight +5 shown) |
|---|---|
| profit | earns 5 points per $100 of profit |
| dogsServed | earns 5 points per dog served |
| incidents | earns 5 points per incident |
| reputation | earns 5 points per point of reputation gained |
| fatigue | earns 5 points for every block the crew's fatigue is above 70% |
| overRatio | earns 5 points for every block the floor runs over 15 dogs per staffer |

The $100 is `KPI_UNITS.profit`, the 70 is `fatigue.kpiThreshold`, the 15 is `bookings.legalRatio`. The deltas are
signed, so "earns 5 points per point of reputation gained" also loses 5 per point lost; the words name the positive
direction and G4's KPI totals show the sign. Nothing on: "The GM is paid nothing: no measure is on."

`kpiInfo(world)`: the six rows for the editor, in order: key, the name on the page (section 7: "Profit today ($)",
"Dogs served", "Incidents", "Reputation change", "Staff fatigue above 70%", "Blocks over the legal ratio") and the
short unit hint ("per $100", "per dog", "per incident", "per point", "per block", "per block"). Only the fatigue
name carries a config number; the legal ratio appears in the clause, not the name.

## Seams (written by the main thread before any package)

- `src/world/bonusPlan.ts`: `KpiInfo`, `kpiInfo(world)`, `describeBonusPlan(spec, world)`, `signedNote(spec)`,
  `activeCount(spec)`, `planLocked(preset)`, `toggleKpi(spec, key, maxActive): RewardSpec | null` (null when
  refused; never mutates), `setWeight(spec, key, value): RewardSpec` (rounds, clamps to −10..+10; a non-finite
  value leaves the weight unchanged; never mutates). Every spec these return passes `validateRewardSpec`.
- `src/sim/readout.ts`: `TargetPredicate`, `targetOutcome(spec)` (implemented by the main thread).
- `src/learn/train.ts`: `Trainer(world, spec, seed, learner = {}, target = targetOutcome(spec))`,
  `TrainingSnapshot.hasTarget` (implemented by the main thread).
- `src/ui/editor.ts`: `roundFromSearch(search): PresetName`, `Editor` (`element`, `spec()`, `preset()`,
  `load(preset)`, `setEnabled(on)`, `onChange`), `mountEditor(container, world, preset): Editor` (stub). No DOM
  access at module top level: `roundFromSearch` is tested under node.
- `src/ui/app.ts`: `statusText` keeps its signature; its three endings are pinned by `tests/ui/status.test.ts`.
- Ids the e2e and the stylesheet rely on: `#round`, `#round-note`, `#editor`, `#kpi-<key>-on`, `#kpi-<key>-weight`,
  `#kpi-<key>-value`, `#limit`, `#plan-words`, `#plan-note`, `#prediction`, and from G2 `#seed`, `#train`, `#fast`,
  `#status`, `#curve`, `#readout`, `#pilot` (with `h2`, `tbody tr`, `.pilot-summary`).
- `tests/plan/bonus-plan.test.ts`, `tests/plan/editor-rules.test.ts`, `tests/ui/status.test.ts`, the added cases in
  `tests/sim/readout.test.ts`, `tests/learn/train.test.ts` and `tests/learn/pilot.test.ts`, the extended
  `e2e/smoke.spec.ts` (seven tests after the diff review): 38 seen failing under vitest, the new e2e tests fail on
  the stub.
- Packages never edit types, seams' signatures, helpers or tests; a package that believes a test is wrong says so in
  its report with the bible or plan line that contradicts it.

## Work packages (parallel; each returns its diff and the test output it saw)

| WP | Model | Files | Delivers |
|---|---|---|---|
| WP1 words and rules | Sonnet | `src/world/bonusPlan.ts`, `README.md` (one paragraph under Run: the editor, the rounds, `?round=`) | The catalogue, the renderer and the editing rules above, to the letter of `tests/plan/*.test.ts`. |
| WP2 page | Opus | `src/ui/editor.ts`, `src/ui/app.ts`, `src/ui/pilot.ts`, `src/main.ts`, `index.html`, `src/style.css` | The editor (six rows: checkbox, name, slider −10..+10 step 1, the signed weight, the unit hint; the limit line; the words and the hint, re-rendered on every input; locked plans and disabled toggles at the limit), the round selector and `?round=`, the round note, the prediction beside the readout, the status wording for the three endings (`tests/ui/status.test.ts`), the click handler that snapshots and validates the edited spec and passes it to `new Trainer(world, spec, seed)`, the clearing of a run's results when the plan changes, every control disabled during a run and the pilot and restored in `finally`, the pilot mode loading Round 1 into everything, the layout that works on a Chromebook screen (1366 × 768) and a phone width without horizontal scroll. Makes the extended `e2e/smoke.spec.ts` pass once WP1 lands. |
| WP3 harness | Sonnet | `src/learn/pilot.ts` | `--reward round1|round2|round3|balanced|<file.json>` (as the sim CLI reads it, exit 2 on an unknown name, a missing value, a malformed or invalid file); every row ends with `key <outcomeKey>`; a plan without a target prints `target n/a`, its summary reads "N of M seeds stable within budget" and its exit code asks for stable within budget on every seed; the usage text and the heading name the plan. Makes the added `tests/learn/pilot.test.ts` cases pass. |

The main thread implements `targetOutcome` and the Trainer's target itself (a dozen lines inside seams it owns).

## Tests

| File | Pins |
|---|---|
| `tests/plan/bonus-plan.test.ts` | `kpiInfo`: six entries in section 7 order, all six names and unit hints pinned, `kpiThreshold` 60 changes the fatigue name only; `describeBonusPlan`: the Round 1 preset → "Each day, the GM earns 10 points per $100 of profit."; the bible's template sentence from profit +10, incidents −5, overRatio −5, character for character; two clauses joined with "and"; "loses" for negatives and "earns" for positives in every measure; "1 point"; "earns 0 points" at weight 0 on; every KPI on at +10 → six clauses in order; all off → the empty sentence; off KPIs with weights unmentioned; `legalRatio` 12 and `kpiThreshold` 60 change the clauses; the input not mutated; `signedNote`: the three forms, null when neither profit nor reputation is on with a weight |
| `tests/plan/editor-rules.test.ts` | `activeCount`; `toggleKpi` turns a KPI on at its stored weight (D26) and returns a new object; refuses the (maxActive + 1)-th with null; off always allowed; `setWeight` 12 → 10, −11 → −10, 3.7 → 4, 2.5 → 3, −2.4 → −2, NaN and Infinity → unchanged; nothing mutates its input; every result passes `validateRewardSpec`; `planLocked`: round1 true, round2, round3 and balanced false; `roundFromSearch`: "" → round1, `?round=2` → round2, `?round=round3` → round3, `?round=9`, `?round=balanced`, `?round=` → round1, `?pilot=20&round=3` → round3 |
| `tests/ui/status.test.ts` | `statusText`: the counting line never says stable, target or changing; "stable" then "target met" only with a target that was met; "stopped at the episode limit, the GM is still changing its mind"; "60 s is up, the GM is still changing its mind"; "stable · over the 60 s limit" for a late stable run |
| `tests/sim/readout.test.ts` (added) | `targetOutcome`: the Round 1 preset and profit +3 alone → `isRound1Outcome`; profit +10 with incidents on at 0, profit +1 with the other five on at 0 → `isRound1Outcome`; profit 0, profit −10, profit +10 with incidents −5, profit with overRatio −1, dogsServed alone, all off, balanced → null |
| `tests/learn/train.test.ts` (added) | a Trainer given `null` reports `hasTarget` false and, stable on seed 1 with the Round 1 week on its readout, `targetMet` false; a null-target run on seed 2 has the same episodes, curve and evaluation keys as the Round 1 run; a recording predicate is asked about the fixed week then weeks 1..5, six calls, on the first stable evaluation; a predicate refusing the fourth call gives not met with stopping unchanged; a predicate accepting a non-Round-1 week on the balanced plan is met; the default derives from the spec; the balanced plan trains to stable with no target; the all-off plan is stable with every reward 0; the G2 seed tests unchanged |
| `tests/learn/pilot.test.ts` (added) | `--reward balanced --seeds 1` prints `stable yes`, `target n/a`, `key acceptAll=…` and "1 of 1 seeds stable within budget", exit 0; the Round 1 row ends with its key; a plan from a JSON file gives the same row as its preset; an invalid file, a malformed file, `--reward nosuch` and a bare `--reward` exit 2; `--budget 1` on balanced prints `stable no`, "0 of 1 seeds stable within budget", exit 1 |
| `e2e/smoke.spec.ts` | acceptance 2 |

## What the owner will see

`npm run dev`: under the title, a round selector (Round 1 chosen) and one line about the round; the six measures,
Profit on at +10 and the other five dimmed with their suggested weights, all of them locked ("Round 1: the plan is
set. Predict what the GM will do, then train."); the sentence "Each day, the GM earns 10 points per $100 of profit."
with the hint that profit counts both ways; a prediction box beside an empty readout; Seed, Train the GM, Fast; the
status line and the curve. Choosing Round 3 unlocks the plan; ticking Incidents and dragging to −7 rewrites the
sentence as he drags. Train runs the plan he wrote; the status says "stable" (no "target met" unless the plan is
Profit alone, positive) or that the GM is still changing its mind; the readout fills in beside his prediction. Touch
the plan again and the readout clears until he trains again. `?pilot=20` still measures Round 1.

## Risks

- Paced training of an edited plan that does not settle runs the full 60 s and ends "60 s is up, the GM is still
  changing its mind". The measured plans: see the result section. G5's speed slider is the lever; G3 reports the
  numbers.
- The editor is DOM code tested by the e2e only (vitest runs under node, no DOM library is added). The rules behind
  it are pure and unit-tested.
- In Round 2 or 3 a student can set Profit to a negative weight and train a GM that loses money. The words say
  "loses 10 points per $100 of profit" and the hint says a loss counts the opposite of a gain. Left in: it is a
  lesson.

## Astra's plan review

`.claude/docs/reviews/g3-plan-astra-triage.md`: 12 findings, 11 accepted and 1 accepted in part. Round 1 is now
locked entirely, a run's results clear when the plan changes, the controls' lifecycle is specified, a measure on at
weight 0 counts as off for the target, the e2e ties the readout to a node-side run of the same spec, the harness
tests cover the failure paths, and the status wording is unit-tested.

## Result (2026-10-26, session 2; every number from this session's runs on the owner's Mac)

**Tests.** `npm test`: 27 files, 209 tests, all passing (4.2 s). 41 are new; 38 were seen failing on the stubs before
any package started (the other 3, in `tests/ui/status.test.ts`, pin status wording G2 already had). The four new
e2e tests were not run against the stub by the main thread (the stub's `mountEditor` throws, so the page would not
load); they name elements the G2 page did not have, and WP2 ran them while building. `npm run lint` exit 0;
`npm run build` clean (38.5 kB of script, 4.1 kB of style).

**Page.** `npm run e2e`: 7 passed in 29.3 s of Playwright's own time (29.7 s wall clock with the build and the
server start, `/usr/bin/time -p`; 6 passed in 25.1 s before the diff review added the seventh and lengthened the
fifth). The untouched Round 1 page, paced, was stable 20,112 ms after the click with the readout "accepted every
booking on 5 of 5 days, ran the floor with 1 staffer on 4 days, chose nap 0 times, averaged 16 dogs per staffer,
and had 7 incidents" (G2: 20.5 s, the same sentence), every control off during the run and Round 1's lock back
after it. The edited plan of the e2e (Round 3, Profit +10 and Incidents −7, seed 1, Fast) was stable at 28,000
episodes after 0.4 s of training with the readout "ran the floor with 1 staffer on 2 days, averaged 13 dogs per
staffer, and had 5 incidents", the same sentence and episode count a node-side Trainer gives for that spec and seed,
and the status never said "target met" (2.4 s with the second run and the round change). Incidents alone (seed 1,
Fast) ran to the 150,000 cap in 1.4 s of training with 301 evaluations and ended "stopped at the episode limit, the
GM is still changing its mind" with the node-side sentence (2.9 s). The Round 2 limit and the Round 1 lock tests
take under 0.3 s each; the pilot-mode test (`?pilot=1&round=3`) 0.4 s.

**Round 1 unchanged.** `npm run pilot -- --seeds 20 --budget 60000`: 20 of 20 target met, 3.6 s for all twenty;
episodes to stable mean 25,350, minimum 22,000, maximum 31,000: the same twenty numbers as G2's table. A test also
pins that a null-target Trainer on seed 2 has the same episodes, curve and evaluation keys as the Round 1 one.

**Edited plans through the harness** (`npm run pilot -- --seeds 5 --reward balanced`, and `--reward <file.json>`
for the others; the files are the spec with the named measures on at the given weights and the rest off at their
suggested weights; the outcome key is the fixed week's):

| Plan | Seeds 1..5 | Episodes to stable | What the GM settled on |
|---|---|---|---|
| balanced (profit +10, incidents −5, overRatio −5) | 5 of 5 stable | 23,000 to 35,000 | accepts all on 3 days, 2 solo days and 3 with two staffers, premium, no nap or clean |
| profit +10, reputation +5 | 5 of 5 | 22,000 (the floor) | two staffers every day, walks in most blocks, premium, accepts every booking |
| all six at the suggested weights | 5 of 5 | 22,000 | the same two-staffer, walking week |
| every measure at +10 | 5 of 5 | 22,000 to 24,500 | the same two-staffer, walking week (paid for incidents, it still finds walks worth more) |
| profit +10, incidents −7 (the e2e plan) | 5 of 5 | 28,000 to 34,000 | accepts every booking, 2 or 3 solo days, the rest with two staffers, premium |
| all off | 5 of 5 | 22,000 | a different random week per seed, stable because every value stays 0 and the ties break the same way every evaluation |
| dogs served +5 alone | 3 of 5 | 68,500 to 79,000; seeds 1 and 5 hit the 150,000 cap | low rate on most days, every booking accepted, naps and cleans scattered |
| incidents −5 alone | 0 of 5 | the 150,000 cap on every seed (0.8 to 1.0 s unpaced) | naps and cleans, two or three staffers, the rate and bookings flip between evaluations |

Paced at 1,200 weeks a second, 22,000 to 35,000 episodes is 18 to 29 s; the two indifferent plans run the full 60 s
and end "60 s is up, the GM is still changing its mind" (Fast: about a second and "stopped at the episode limit").

**Chromebook.** WP2 measured the built page in headless Chromium: no horizontal scroll at 1366 × 768 (Round 1 and
Round 3), 360 × 740, 700 and 701 px wide. At 1366 × 768 the Train button sits about 685 to 705 px from the top, so
with the browser's own bars the curve is below the fold: the class scrolls once after the click. The owner judges
this on the real machine; G4 reshapes the area under the controls anyway.

**What moved during G3, in order.** (1) Astra's plan review: Round 1 locked entirely (D35), the hint under the
words, the zero-weight rule in `targetOutcome`, a run's results cleared on a plan change (D37), the controls'
lifecycle, the e2e tied to a node-side run, the harness failure paths, the status wording unit-tested; the full
triage is `.claude/docs/reviews/g3-plan-astra-triage.md`. (2) The packages landed without a test dispute; no
package code was changed in review. (3) Astra's diff review (`.claude/docs/reviews/g3-astra-triage.md`): five
findings, all about tests and all accepted (one in part), no production defect; the six-week predicate test now
compares full reports, the harness row comparison ignores the machine's seconds, the e2e pins the episode count,
moves the disabled-control checks to the paced run, and adds the unsettled-plan and round-change cases. Astra
confirmed the Round 1 pilot at G2's episode counts, the harness exit codes, the renderer over 117,649 combinations
and that no editor path lets an invalid spec reach the Trainer.

**Packages.** WP1 (Sonnet): `bonusPlan.ts`, the README paragraph. WP2 (Opus): `editor.ts`, `app.ts`, `pilot.ts`,
`index.html`, `style.css`; `main.ts` needed no change. WP3 (Sonnet): `pilot.ts --reward`. The main thread wrote
the seams, the tests, `targetOutcome`, the Trainer's target, and the bible, decisions and roadmap lines.
