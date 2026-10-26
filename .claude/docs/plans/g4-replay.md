# G4: the week replay and the readout

## Goal

After G4 the student's screen is the lesson (BRIEF section 1, D38, D39): the round, the bonus plan and its sentence,
the prediction, Train, the training curve captioned as the GM getting better at earning its bonus, and the readout.
(The seed field, the Fast checkbox and the round selector stay beside Train until G5's teacher panel: that is the
D39 debt, not G4's.) The readout grows from one sentence into three views of the same greedy week: the sentence
beside the prediction (G3's `.compare` panel, kept), a week replay on canvas (the yard, the dogs, the crew, a
dogs-per-staffer gauge, an incident counter, a reputation meter, a cash counter; an incident is an icon and a
counter, never an injury), and the weekly P&L and operations report as a table (section 10.1 names every line). The
status line is rewritten in the student's words: weeks practised, and settled or still changing its mind. The layout
under the controls is rebuilt for the Chromebook fold. Round 1 trains exactly as it does now; the pilot mode keeps its
table with "target met" (until G5's teacher panel it is where the owner reads it on the page).

Owner gate: Fred reads a report cold and can say what the GM did.

## Acceptance

1. `npm test` green with the new tests, each seen failing first: the student's status words (a pure function of the
   `TrainingSnapshot`), the report table (a pure function from a `WeekReport`, the plan and the config to rows), the
   replay's frames (a pure function from the 20 `StepRecord`s and a step index to what the canvas shows) and its
   clock, the Trainer's `evaluateTrace` and that evaluating between slices never changes a run, the curve's words,
   and the words on the page (no learner's word in `index.html`); plus everything from G1 to G3.
2. `npm run e2e`, Playwright's own time under 60 s in all: the page loads offline-clean with the replay canvas (its
   `data-week` "none"), the curve caption and no report table; at 1366 × 768 the Train button's bottom is within
   700 px of the top on load; the untouched Round 1 plan trains, paced, until the status says the GM has settled, in
   under 60 s, every status text sampled from the click in the student's form and free of ε, "evaluation", "target
   met", "Episodes", "stable" and "paced"; during the run (the table still hidden) the status line, the curve and
   the replay sit inside the viewport with no horizontal scroll, and again after it; the readout sentence equals a
   node-side Trainer's `describeWeek` for seed 1, the table's Profit, Incidents and Dogs accepted lines equal that
   week's totals, the replay is in its final week (`data-week` "final") and drawn; the edited-plan test (Round 3,
   Profit +10, Incidents −7) asserts the weeks practised against the twin's episode count and that an edit afterwards
   clears the table, the sentence and the replay and that they stay cleared after two animation frames and a resize
   (D37); the unsettled plan (Fast) ends "The GM practised 150,000 weeks and is still changing its mind."; the pilot
   mode is unchanged (its table still says "target met"). No request leaves the origin.
3. `npm run pilot -- --seeds 20 --budget 60000`: still 20 of 20 with G2's episode counts (nothing in the learner
   changes; `evaluateTrace` is a refactor of `evaluateOn`, read-only over the table).
4. Owner gate: Fred opens the page, trains Round 1 on the smartboard and on a Chromebook, and after the run reads the
   sentence, the replay and the table cold and says what the GM did (took every dog at the premium rate, ran one
   staffer four days, never napped or cleaned, and what it cost in incidents and sick dogs). `?pilot=20` on the
   Chromebook is still 20 of 20 in time with the replay drawing.
5. `npm run lint` and `npm run build` clean; the scaffold test still pins no off-origin script, style or font.

## Design calls (the decisions file carries the one-liners)

- **Three views of one week (D40).** The sentence, the replay and the table all come from one `EpisodeTrace` of the
  greedy GM on the fixed evaluation week: `trainer.evaluateTrace()` (new, the seam) runs
  `runEpisode(world, spec, trainer.greedyPolicy(), episodeSeeds(seed, EVAL_BASE_INDEX))` and returns the 20
  `StepRecord`s and the report `evaluate()` returns (a test pins that they are equal, and another that calling it
  between training slices changes nothing about the run). The page keeps the trace; the replay and the table are
  pure functions of it and keep no state of their own.
- **The replay during training is the hook, and the sentence follows it.** While the GM trains, the replay plays
  its current test week: at the start of a run and each time a week finishes playing, the page asks the trainer for
  a fresh `evaluateTrace()`, plays that, and writes `describeWeek(trace.report)` into `#readout` at the same moment,
  so the sentence and the yard always describe the same week (Astra: in G3 the sentence followed every scheduled
  evaluation, every 0.4 s paced, and would have drifted from a replay that holds a week for 7.5 s). Paced, a Round 1
  run lasts 20 to 30 s and a week plays in 6 s (300 ms a block, 20 blocks) plus a 1.5 s hold on Friday's pickup, so
  the class sees three or four weeks go by: the untrained GM's muddle, then the packed yard with one staffer. When
  the run ends, one final `evaluateTrace()` is taken and the sentence, the table, the replay's first frame and the
  status are written from it together, inside the run's clock (the `ms` the pilot records); then the final week
  plays once more and holds on Friday, outside the clock. A "Watch the week again" button under the replay replays
  it. Fast runs end in a fraction of a second and show the final week only. The replay is drawn every animation
  frame while it plays; the curve stays at 10 redraws a second; the canvases are measured (`getBoundingClientRect`)
  at most at that rate and on resize, not every frame.
- **The table appears when the run ends**, never during it: a 30-row table re-rendering at every evaluation would
  fight the replay for the eye and the frame. During training the report area stays empty.
- **A run belongs to its plan (D37), and clearing cancels the producer.** One lifecycle operation, `clearRun`,
  stops the replay (a run token that any scheduled animation frame checks before drawing), discards the trace and
  its clock, hides the replay button, resets the captions and `data-week` to "none", clears the table, the sentence,
  the status and the curve. Any edit or round change after a run calls it; so does the start of a new run and of
  each pilot seed. The canvas carries `data-week="none" | "training" | "final"` so the e2e can see the state.
- **The status line in the student's words (D41).** `studentStatus(snapshot, outOfBudget)` gives one of three
  sentences: running, "The GM has practised 12,000 weeks so far and is still changing its mind."; settled, "The GM
  practised 24,000 weeks and has settled on how it runs the week."; ended without settling, "The GM practised
  150,000 weeks and is still changing its mind.", with "Time is up: the GM practised 72,000 weeks and is still
  changing its mind." when the 60 s ran out first. Nothing else: no ε, no evaluation count, no seconds, no "paced",
  no "target met", no "episode", and no "Training the GM on seed 1…" at the click (the click writes the running
  sentence at 0 weeks). A settled run that crossed 60 s in its last slice says settled (the lateness is the pilot
  table's, an instrument). The pilot's "Pilot seed 3 of 20 · " label prefix stays (the pilot is the teacher's). The
  e2e waits for "has settled" where it waited for "stable", so no sentence may contain "settled" before the trainer
  is stable.
- **The curve is captioned, not explained.** The canvas keeps its axes but the x axis reads "Weeks of practice" (not
  "Training weeks (episodes)") and the legend "Each practice week", "Average of the last 100 weeks", "Test week"
  (`curveWords`). An HTML caption under it reads: "Watch the GM get better at earning its bonus. The dots are its
  test weeks: how it would run the week right now without trying anything new." ("tries things, keeps what pays" is
  the one thing a student knows about the GM, section 1.)
- **The fold (D42).** The page stays one column: the plan, the prediction panel and Train above; under the controls
  a `#watch` section (the status line, then the curve and the replay side by side above 900 px, stacked below), then
  the report table full width. On the Train click the page scrolls `#watch` to the top of the viewport (smooth,
  `scroll-margin-top`); `#watch` has `min-height: 100vh` so the scroll has room even while the table is hidden
  (Astra: a short last section cannot be scrolled to the top). The class then sees the status, the curve and the
  replay without touching anything, and scrolls down to the table when the run ends. The editor's rows, the compare
  panel and the margins above are tightened so Train sits within 700 px of the top at 1366 wide on load (target 680,
  the Chromebook's own bars take about 90 px; the number WP3 reaches is recorded in the result). WP3 measures the
  built page in headless Chromium at 1366 × 768: Train's bottom on load, `#watch`'s top during the run, the curve's
  and the replay's bottom during and after the run, and the document's scroll width; the e2e pins them.
- **The replay's picture.** A fenced yard in the page's grass colour; dogs as simple two-circle figures with ears in
  three coat colours, placed on a jittered grid from the dog's index (the same dog keeps its spot from block to
  block, no world draws); crew as taller figures; the activity changes the picture: free play scattered, structured
  play in rows facing a staffer, nap as flat dogs with "zz", walk with the walking group (`walkingDogs` and one
  staffer) on a path outside the fence and the floor's remaining dogs (`floorDogs`, `floorStaff`) inside, clean with
  the dogs in a crate row at the side and the crew with a broom, a closed day as an empty yard with a "Closed" sign.
  A header: "Monday · late morning · free play" (a fallback reads "walk → free play"; "closed" on a closed day) and
  under it the day's plan in business words: "20 asked · 20 accepted, every booking · premium rate · crew 1 scheduled, 1 in" (the booking choice in
words: every booking, capped at the legal ratio, capped at a safe ratio; never the number behind it, D44). The
  HUD down the right: dogs and crew on the floor; the dogs-per-staffer gauge (0 to 30, one mark at 15 labelled "15",
  the band above 15 tinted; nothing marks 10, H1's number is hidden until the teacher reveals it, while 15 is already
  public through the measure "Blocks over the legal ratio" and the sentence "over 15 dogs per staffer", D43); the
  incident counter with its icon (a rounded badge with "!") that pulses in a block with an incident; the reputation
  meter 0 to 100; the cash counter; small meters for energy, cleanliness and crew fatigue; "Tomorrow: 19 asking"
  (`requestsTomorrow`) and "Days the crew ran solo: 3" (`soloStreak`; section 3: nothing in the state is hidden from
  students, Astra asked for both); small counters for dogs sent home sick and inspector visits when above 0.
  Captions under the yard name the block's events as events, never as rules (Astra: "a walk needs two staffers"
  explains H8; the bible hides the rules, not the state): "Incident", "Vet bill $150", "Inspector: $250 fine",
  "2 dogs sent home sick", "The staffer called out: closed today", "Walk photo posted". A fallback is in the header
  ("walk → free play") and gets no caption; the walk's reputation gain is not named (its number is H8's, and the
  step's clamp can make the real change differ). Never "injury". Before a run the canvas shows "The GM's week plays
  here while it trains."
- **What a frame shows for step t** (every field's source, Astra's finding 7). Let `dayState` be the step's
  `result.state` at drop-off (block 0) and the step's `state` (before the action) in blocks 1 to 3: it carries the
  day as resolved at drop-off and still holds it at pickup (the state after pickup is already the next morning's).
  From `dayState`: `dogs`, `staff` (the day's dogs and crew; 0 on a closed day), `scheduledStaff`, `closed`,
  `calledOut`, and the plan's `rate` and `bookings` (null on a closed day and before drop-off). From the step's
  `state`: `day`, `block`, `requests` (`requestsToday`), `soloStreak` (days alone through yesterday). `accepted` is
  `dogs`. The walking group: for a resolved walk, `walkingDogs = min(walk.groupSize, dogs)` and `walkingStaff = 1`,
  else 0; `floorDogs = dogs − walkingDogs`, `floorStaff = staff − walkingStaff` (the picture inside the fence and the
  gauge's population); `ratio` is `result.floorRatio`. Energy, cleanliness and fatigue: after the block
  (`result.state`), except at pickup where `result.pickup` is used. Reputation and cash: `result.state` (applied in
  the step, not reset overnight). `requestsTomorrow`: `result.state.requestsTomorrow` (the projection after the
  block), and at pickup `result.state.requestsToday` (the final figure, promoted). Counters sum `deltas` and events
  over steps 0..t. Captions come from `result.events` of step t.
- **The table's lines** (section 10.1, every one of section 10; a column per day Mon to Fri and a Week column;
  three groups with a heading row each). Operations: Requests; Dogs accepted; Accepted every booking ("yes", "no",
  "closed"; week "5 of 5 days", `daysAcceptedAll`); Day rate ("premium $52", "closed" on a closed day; week:
  "premium × 5" or "low × 1, premium × 4", closed days left out); Crew scheduled (week "6 staff-days"); Crew on the
  floor ("0, called out"; week: "1 staffer on 4 days"); Activities (drop-off · late morning · afternoon · pickup),
  one cell per day with the four blocks, the drop-off written "arrivals" (always free play, not a choice, section 2),
  a fallback as "walk → free play", "closed" on a closed day (week: "nap 0, clean 0, walk 0"); Dogs per staffer (one
  decimal, "—" with no dogs); Blocks over 15 dogs per staffer; Incidents; Dogs sent home sick; Inspector visits;
  Blocks with crew fatigue above 70%; Reputation at pickup (week: "50 → 21 (−29)"); Cleanliness at pickup; Crew
  fatigue at pickup (both rounded; week: start → Friday's pickup with the change). Money ($): Day rates; Activity
  add-ons; Revenue (bold); Wages; Refunds; Vet bills; Fines; Cleaning supplies; Profit (bold); Cash at close (running
  from $2,000; week: the Friday figure). The GM's bonus: one row per measure that is on, labelled with the measure's
  name and its weight ("Profit today ($), +10 per $100"), the points earned each day and in the week; then "Bonus
  points this week" (bold) whose week cell is the plan's total reward (`totals.reward`, authoritative; the day cells
  are weight × the day's delta ÷ unit, the day's reputation delta being the change since the previous pickup, Monday
  against `reputationStart`; a closed day's reputation delta is its closure hit, so a reputation measure pays on it).
  A plan with nothing on shows one row: "No measure is on: the GM is paid nothing." Money is whole dollars with
  commas and a typographic minus ("−$120"); points carry a sign and at most two decimals ("+123.5", "+9.78", "−35",
  "0": profit is whole dollars ÷ 100 × an integer weight, so two decimals are exact and the day cells sum to the week
  cell; Astra's probe at weight +1 showed one decimal losing points). The 15, the 70 and the $2,000 are
  `bookings.legalRatio`, `fatigue.kpiThreshold` and `cash.weekStart`. The six KPI totals are readable unweighted in
  the operations and money rows whatever the plan: Dogs accepted, Incidents, Blocks over 15, Blocks with crew fatigue
  above 70%, Reputation at pickup's week cell, Profit.
- **Words.** GM, bonus plan, readout, incident, crew, measure, Good Dog Daycare. Never "injury", never "reward
  function", never "episode", "ε", "evaluation", "stable", "target met" on the student's screen. A test reads
  `index.html` for the learner's words and the forbidden ones; the pure functions' tests check their output; the e2e
  samples the status line from the click.
- **The pilot mode** (`?pilot=N`) is unchanged: its table (seed, episodes, seconds, stable, target met) stays, its
  status prefix stays, and the replay plays during its runs like any other (the pilot measures the page as the
  class sees it; the replay is part of that page now). Each seed starts with `clearRun`.
- **Costs.** The replay draw is one canvas pass over at most 30 dogs, 3 crew, the HUD and the captions, well under
  a millisecond on the Mac; `evaluateTrace()` is one greedy week (20 steps). Neither touches the Q-table. The final
  trace, the table render and the first final frame are inside the run's clock, so the pilot's seconds include them.
  The Chromebook check is acceptance 4 and `?pilot=20` on the owner's machine; the unpaced pilot does not exercise
  a full paced playback, so the owner also watches one paced Round 1 run there.

## Seams (written by the main thread before any package starts)

- `src/learn/train.ts`: `Trainer.evaluateTrace(k = 0): EpisodeTrace` (the greedy GM on evaluation week k, both
  streams reset); `evaluateOn(k)` becomes `this.evaluateTrace(k).report`. No other change to the learner.
- `src/ui/status.ts` (new): `studentStatus(s: TrainingSnapshot, outOfBudget: boolean): string`. Stub throws.
- `src/ui/report.ts` (new): `ReportRow`, `ReportGroup`, `ReportTable`, `reportTable(report, spec, world)`,
  `renderReport(table, data)`, `formatMoney`, `formatPoints`; the contract is in the file's comments.
- `src/ui/replay.ts` (new): `STEP_MS`, `HOLD_MS`, `ReplayClock`, `replayClock`, `ReplayFrame`, `replayFrame(steps, t,
  world)`, `ReplayColors`, `ReplayOptions`, `drawReplay`; the contract is in the file's comments.
- `src/ui/curve.ts`: `curveWords(averageWindow)` (done), used by `drawCurve` for its text (WP3 wires it).
- `index.html`: the ids the page and the e2e use: `#status`, `#watch` (section), `#curve`, `#curve-caption`, `#replay`
  (canvas, `data-week`), `#replay-caption`, `#replay-again` (button, hidden until a run ends), `#report` (section,
  hidden while empty), `#report-table`. `#prediction`, `#readout`, `#readout-label`, `#pilot` and every G3 id stay.
- Tests, all seen failing on the stubs: `tests/ui/status.test.ts` (rewritten), `tests/ui/report.test.ts`,
  `tests/ui/replay.test.ts`, `tests/ui/words.test.ts`, two `evaluateTrace` cases in `tests/learn/train.test.ts`, a
  `curveWords` case; the e2e rewritten (run after the build, as in G3).

## Packages (in parallel; none edits a seam's signature, a helper or a test; a package that believes a test is
wrong reports it with the bible line that contradicts it)

| WP | Model | Files | Builds |
|---|---|---|---|
| WP1 the replay | Opus | `src/ui/replay.ts` | `replayFrame`, `replayClock`, `drawReplay` and the words, to the design calls above; the picture is its judgment within them |
| WP2 the report table | Sonnet | `src/ui/report.ts` | `reportTable`, `renderReport`, `formatMoney`, `formatPoints`, to the lines above |
| WP3 the page | Opus | `src/ui/app.ts`, `src/ui/status.ts`, `src/ui/curve.ts` (the words only), `src/ui/pilot.ts` (clearRun per seed), `index.html`, `src/style.css` | The status in the student's words, the `#watch` section and the scroll, the replay loop (during and after training, the button, the sentence following the replay's week, the run token), the table at the end of a run inside the clock, `clearRun` (D37), the curve caption and words, the layout and its Chromebook measurement |

The main thread writes the seams, the tests, the Trainer change, the e2e, the bible lines (section 1's status
sentences and curve words, section 10.1 the table, 10.2 the replay), the decisions, the roadmap and the README
paragraph.

## Plan review

Astra's review of the first draft (`.claude/docs/reviews/g4-plan-astra-triage.md`): 13 findings, 11 accepted, 2 in
part. The ones that changed the design: the sentence now follows the replay's week during training (1); captions
name events, not rules (2); points carry two decimals (3); the table shows four blocks and the days every booking
was accepted (5); the frame contract names every field's source and the floor's population during a walk (6, 7) and
exposes tomorrow's requests and the solo streak (8); the final trace, table and first frame are inside the run's
clock (9); `clearRun` cancels the replay and the e2e checks the clear survives frames and a resize (10); `#watch`
has room to scroll and the e2e measures during the run (11); the e2e samples the status from the click (12, 13).

## What the owner will see

Open the page, press Train. The page slides down to the status line ("The GM has practised 1,200 weeks so far and is
still changing its mind."), the curve climbing on the left and the yard on the right, where the GM's current test
week plays: on the first week the yard changes every block as the untrained GM tries naps, walks, cleaning and odd
staffing, and the sentence beside the prediction describes that week; by the third week the yard is packed with one
staffer and free play all day, the gauge reads 20, the incident counter climbs. Then "The GM practised 24,000 weeks
and has settled on how it runs the week.", the final week plays once more and holds on Friday's pickup, and under it
the weekly P&L and operations report: five day columns and the week, every booking accepted at $52, one staffer on
four days, free play in every block, the money lines, the profit, and the bonus points the GM earned. Touch a slider
in Round 3 and all of it clears.

On a Chromebook at 1366 × 768: Train is reachable without scrolling; after the click the status, the curve and the
replay are in view; the table is one scroll down.

## Risks

- The replay's drawing cost on a Chromebook during a paced run: measured by the owner with `?pilot=20` and one paced
  Round 1 run (acceptance 4); the draw is small by construction.
- The e2e's 60 s: the Round 1 paced run is 20 s; the twins add a second; the status sampling rides inside the run.
- The words: a package may reach for "episode" or "injury", or a caption that explains a rule; the tests and the
  review catch it.

## Result (2026-10-26, session 3; every number from this session's runs on the owner's Mac)

**Tests.** `npm test`: 30 files, 246 tests, all passing (4.7 s). 37 are new. Seen failing on the stubs before any
package started: the 5 status sentences, the 12 replay cases, 3 of the 4 word cases (the ids, the caption and
`curveWords`; the forbidden-words scan of `index.html` passed at once, as it should), the `evaluateTrace` case, and
the whole report file (its fixture calls `reportTable` at collection, so the file failed as one until WP2 built it;
then 16 of 17 passed and the 17th was the main thread's own mistake: a one-staffer week closes on Thursday, so its
"low × 5" could only be "low × 4"; it was rewritten as a genuinely mixed-rate week that stays open, and that
rewrite found the one defect in WP2's table, "1 staffer on 1 days"). The interleaved-evaluation case Astra asked
for was written after `evaluateTrace` existed and passed at once; it pins a property, not a build; so was the
`planWords` case added after the diff review. `npm run lint`
exit 0; `npm run build` clean (63.0 kB of script, 6.1 kB of style).

**Round 1 unchanged.** `npm run pilot -- --seeds 20 --budget 60000`: 20 of 20 target met, 3.6 s for all twenty;
episodes to stable 24,000, 27,500, 23,500, 25,500, 28,000, 22,500, 22,000, 23,500, 27,500, 23,500, 27,000, 27,500,
28,000, 24,000, 31,000, 25,000, 25,000, 25,000, 25,000, 22,000: G2's twenty numbers.

**Page.** `npm run e2e`: 7 passed in 29.4 s of Playwright's own time (29.9 s wall clock with the build and the server
start, `/usr/bin/time -p`; 28.9 s before the diff review added the status observer, the live-playback clear and the
placeholder check). The untouched Round 1 page, paced, was settled 20,598 ms after the click with the same
readout sentence as G2 and G3 ("accepted every booking on 5 of 5 days, ran the floor with 1 staffer on 4 days, chose
nap 0 times, averaged 16 dogs per staffer, and had 7 incidents") and the status "The GM practised 24,000 weeks and
has settled on how it runs the week."; every status text the page wrote from before the click (a mutation observer,
over 50 writes) was in the student's form; the table's Profit, Incidents and Dogs accepted lines equalled the node-side twin's totals and the replay was in
its final week and drawn. The edited plan (Round 3, Profit +10, Incidents −7, Fast) settled at 28,000 weeks with the
twin's sentence, and a slider edit while the final week was playing again cleared the sentence, the table and the
replay, which stayed cleared (the placeholder's pixels, not only the attributes) after two animation frames and a
resize. Incidents alone ended "The GM practised 150,000 weeks and is still changing
its mind." The pilot mode is unchanged (its table still says target met).

**The fold** (headless Chromium, 1366 × 768, from the e2e's own measurements): the Train button's bottom edge is
604 px from the top on load (target 680, gate 700; G3 measured the button's top at 685 to 705); during the run, with
the table still hidden and the replay in its training week, the smooth scroll lands with the status line 11 px from
the top and the curve's and the replay's bottoms at 403 px (one polled sample proves all of it); after the run the
status is at 8 px and the bottoms at 400 px, with the table below; the document's scroll width is 1366 (no
horizontal scroll). At 390 px wide the table scrolls inside its section and the page does not (WP3's measurement).

**What the owner sees** is the "What the owner will see" section above, as built: the replay opens on the untrained
GM's week (odd staffing, naps, walks, a low rate), the sentence beside the prediction describes that week, and three
or four weeks later the yard is packed with one staffer; the final week holds on Friday with "Watch the week again"
under it and the table below. Screenshots from the build are not kept in the repo.

**What moved during G4, in order.** (1) Astra's plan review (`.claude/docs/reviews/g4-plan-astra-triage.md`): 13
findings, 11 accepted and 2 in part; the sentence now follows the replay's week during training, captions name
events and not rules, points carry two decimals, the table shows four blocks and the days every booking was
accepted, the frame contract names every field's source, the final trace and table are inside the run's clock,
`clearRun` cancels the replay through a token, `#watch` has room to scroll, the e2e samples the status from the
click. (2) The packages landed with one test dispute (WP2's, upheld: the main thread's test was wrong) and one
one-word fix in review (the singular day). (3) Astra's diff review (`.claude/docs/reviews/g4-astra-triage.md`):
five findings, none high, four accepted and one in part; the booking choice now reads in the replay's plan line
("20 accepted, every booking", "capped at the legal ratio", "capped at a safe ratio") through a tested `planWords`,
a walk with no dogs still shows its staffer, and the e2e records every status write from before the click, clears
a live playback and checks the placeholder's pixels, and proves the run, the hidden table and the landed scroll in
one sample. Astra probed 250 weeks and 5,000 frames of the table's bonus arithmetic and the frame sources against
`step.ts` and found no wrong field, and confirmed the pilot at G2's twenty counts.

**Packages.** WP1 (Opus): `replay.ts` (1,167 lines; `replayClock`, `replayFrame`, `drawReplay` and the figures).
WP2 (Sonnet): `report.ts`. WP3 (Opus): `app.ts` (rewritten around the trace, the token and `clearRun`),
`status.ts`, `curve.ts` (the words wired), `pilot.ts` (one line), `index.html`, `style.css`. The main thread wrote
the seams, the tests, the e2e, `evaluateTrace`, the bible's sections 1, 10.1 and 10.2, D40 to D44, the roadmap, the
README paragraph and the triages.

**Known debts, not bugs.** The seed field, the Fast checkbox and the round selector stay beside Train until G5
(D39). On a desktop the replay's text is about 12 px at 420 px wide; the smartboard reads it at the browser's zoom
or stacked (below 900 px the replay is 640 px wide and its text about 20 px); G5's teacher panel may add a "big
replay" switch if the owner asks. The Activities cell wraps to several lines when a day has two fallbacks.
