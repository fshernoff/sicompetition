# G5b: the GM is a person (the student never sees the engine)

## Goal

The owner's steer after G5 (Oct 28): "we present that the GM works thousands of weeks. that doesn't make sense.
they don't need to see the training under the hood ... for the students, this is a 'real' person they give
incentives to and he goes to work." And: "it is a game. nobody plays madden and cares about how the opposing team
simulates making coaching decisions." G4b changed the words; the screen still narrated the simulation: the weeks
count in the status, "settled into its routine" (the learner's "stable"), the bonus curve over thousands of weeks,
and the replay cycling through the GM's weeks while it learned. A real owner hires a manager, hands over a pay plan,
and reads the week. After G5b the student's screen is exactly that, and the AI is the game engine underneath: the
learner still trains to stable, at full speed, out of sight; the class sees the GM run one week.

Round 1 trains exactly as it does now (the learner, the seeds and the stopping rule are untouched; only pacing
goes, and pacing never changed the trajectory): `npm run pilot` gives G2's twenty episode counts.

## What the class sees

1. The page as before G5b above the button: the round line, the plan and its sentence, the prediction, and beside it
   an empty panel labelled "What the GM did". Under the button, the watching area is now one thing: the yard (the
   replay), bigger, centred, captioned "The GM's week".
2. **Put the GM to work.** The page scrolls to the yard. The status says "The GM is getting ready for Monday." and
   nothing else: no number, no progress; the yard shows "Monday, before opening: the GM is getting ready." in place
   of the usual placeholder (Astra: an in-world wait, not a loading screen). Underneath, the learner trains unpaced (Round 1 is stable in about 0.2 s of
   training on the Mac; the slowest plans reach the 150,000-week cap in a few seconds; the 60 s budget of D6 stays).
3. **The week.** The status says "The GM is running the week." and the yard plays the GM's week once, block by
   block (6 s and a 1.5 s hold on Friday's pickup). This is the final greedy week, the one the readout describes.
   Nothing plays while the learner trains: the untrained GM's muddle was the learner showing through.
4. **The result.** When the week has played, the sentence appears beside the prediction ("What the GM did"), the
   weekly P&L and operations report appears below the yard, "Watch the week again" appears under it, the status says
   "The week is over: what the GM did is beside your prediction, and the full report is below.", and the page
   scrolls back up to the prediction and the sentence, side by side, the box score after the game. The controls
   unlock then, not before.
5. No weeks count, no "settled" or "still changing", no curve, no "Time is up". A plan the learner never settles on
   is, for the student, just the week the GM ran; the teacher's check line says it did not settle.

The teacher keeps everything in the tray (G5): the round radios, the seed, the hidden rules, the export, the check
line, and a new button, "Show the learning curve", that prints the bonus curve (G2's chart, unchanged) under the
report with a teacher's caption, for a debrief about how the GM was built if the teacher wants one. The speed
control goes: pacing existed so the class could watch the curve climb, and there is no curve on the student's screen
to pace. A bigger yard is also the owner's G4 question about the smartboard answered: at 1366 × 768 the replay is
about 670 px wide instead of 420, its text about 20 px.

## Decisions (D50 to D52, superseding parts of D33, D40, D41, D42, D45 and D48)

- **D50 The GM is a person; the AI is the game engine.** The student's screen never shows the learner: no weeks
  counts, no convergence words, no learning curve, no weeks played while it learns. The class puts the GM to work and
  watches one week, the final greedy week, then reads it. The learner's evidence (the curve, the check line, the
  export's learner block) is the teacher's.
- **D51 The readout arrives when the week is over.** The sentence, the report and the "watch again" button appear
  after the week has played once, and the page then scrolls to the prediction and the sentence side by side; the
  controls unlock then. Two times, named: the engine's (the click to the final week computed and its first frame
  drawn), which the 60 s budget of D6 bounds and the check line and the export report; and the week's playback after
  it (a fixed 7.5 s), which is presentation. The pilot mode, which measures the machine, writes its readout as soon
  as each seed's final week is computed, stops its clock after that rendering (D6: rendering included) and never
  waits for a playback. "Watch the week again" replays the saved week only: no training, no republishing, no scroll.
- **D52 No speed control; training is always unpaced.** Pacing (D33, D48) was for watching the curve. The seed, the
  round, the hidden rules, the learning curve, the export and the check line remain the teacher's (section 11).

## Acceptance

1. `npm test` green, every changed test seen failing first: the student's status as a pure function of a phase
   (`idle`, `preparing`, `playing`, `done`, `changed`), five fixed sentences with no digit and none of the learner's
   or the class's words (weeks into the job, settled, routine, practise, train, learn, point); the page's words (the
   student's HTML outside the tray and the learning section carries no "learn", "settled", "routine", "weeks", no
   curve; the curve and its caption are inside `#learning`, hidden by default; the readout label "What the GM did";
   the replay caption "The GM's week"; the tray has `#show-curve` and no `#speed`); the export without `speed`
   (thirteen keys). `speed.ts` and its test go.
2. `npm run e2e` under 60 s of Playwright time: on load the tray, the rules and the learning section are hidden and
   no curve is visible; at 1366 × 768 the button's bottom ≤ 700 px; Round 1 untouched: after the click every status
   write is one of the four phase sentences (none carries a digit), the replay's `data-week` goes `preparing` then
   `final`, the readout and the table stay empty while the week plays, the yard (with the tray open) sits above the
   tray with the status at the top, and when the status says the week is over the sentence equals the node-side
   twin's, the table's totals match, the export equals the twin's week and carries no `speed`, and the prediction
   and the sentence are in view above the tray; the check line ends "stable · target met"; "Show the learning curve"
   shows a drawn curve and hides it; the edited plan, the unsettled plan (its status says the week is over, its check
   line "not stable"), the round change through the tray and the clears behave as in G5; the pilot mode is 2 of 2
   and its export is seed 2's.
3. `npm run pilot -- --seeds 20 --budget 60000`: 20 of 20 with G2's counts; `npm run lint`, `npm run build` clean;
   `npm run capture` still records one Round 1 run (now about 15 s: the wait, the week, the hold).
4. Owner gate: Fred plays a round as a student would and finds nothing that shows the engine.

## Seams (main thread, before the packages)

- `src/ui/status.ts`: `StudentPhase = 'idle' | 'preparing' | 'playing' | 'done' | 'changed'`;
  `studentStatus(phase: StudentPhase): string`, the five sentences above (`idle` and `changed` are G4b's).
- `src/ui/export.ts`: `RunExportInput` and `RunExport` lose `speed`; `RunSetup` in `app.ts` loses `speed`.
- `src/ui/app.ts` (WP1 builds it, the contract fixed here): `runTraining(page, seed, startedAt, label)` always
  unpaced (`runFor(10 ms)` per frame), the 10 Hz check line and the 60 s budget as before; it ends by setting
  `page.trace` to the final week, `page.result`, the replay's `data-week` `final` and `data-key`, inside the clock,
  and writes nothing the student reads but the status; it never paints a week on the yard. `playWeek(page):
  Promise<boolean>` plays `page.trace` once from its first block, bumps `#replay[data-plays]`, and resolves true when
  it has played and held, false if `clearRun` moved the token, and rejects on a drawing error. `showReadout(page)`
  writes the sentence, the readout label, the table, the "watch again" button and the done status, and sets
  `page.readoutShown`; the export is enabled only with `readoutShown` (cleared by `clearRun`). The click owns its run:
  lock, clear, setup, status `preparing`, `data-week` `preparing`, the in-world placeholder, scroll to `#watch`,
  start `runTraining` and read `page.token` as the owner's; after each await continue only while the token is
  unchanged: status `playing`, `playWeek`, `showReadout`, scroll to `.compare`, unlock and the button's text; an
  error shows the error line and unlocks; a moved token does nothing. The pilot: train, `showReadout`, then its
  clock stops; next seed. `drawReplay`'s options gain `placeholder?: string` (`src/ui/replay.ts`, WP1). The yard's
  width is set from the room left in the window (the status, the caption and the button, and the open tray's
  measured height), at least 560 px at 1366 × 768 with the tray open. `Page` drops `speed` and gains `learning: HTMLElement`, `showCurve: HTMLButtonElement`. The curve is drawn
  only while `#learning` is shown (on show, at the 10 Hz redraw, on resize).
- `index.html` (WP1 writes it, ids fixed here): `#watch` holds `#status` and one figure: `#replay`,
  `#replay-caption` ("The GM's week"), `#replay-again`; `#readout-label` "What the GM did"; the tray drops `#speed`
  and gains `#show-curve` ("Show the learning curve" / "Hide the learning curve"); a section `<section id="learning"
  hidden>` after `#rules` holds `#learning-title`, `#curve` and `#curve-caption` (the teacher's caption, the learner's
  words allowed there).

## Packages

| Package | Model | Files | What it builds |
|---|---|---|---|
| WP1 the page | Opus | `src/ui/app.ts`, `src/ui/teacher.ts`, `src/ui/pilot.ts`, `src/ui/replay.ts` (the placeholder option only), `index.html`, `src/style.css` | The flow above, the bigger centred yard (fits above an open tray at 1366 × 768), the learning section and its button, the speed control gone. |
| WP2 the pure modules and the docs | Sonnet | `src/ui/status.ts`, `src/ui/export.ts`, `docs/capture.md`, `README.md` | The five sentences; the export without `speed`; the shot list and the README in the new flow. |

The main thread writes the seams, the tests, the e2e, BRIEF sections 1, 10.2, 11 and 13, D50 to D52, the roadmap,
HANDOFF and the triages, and removes `src/ui/speed.ts` and `tests/ui/speed.test.ts` once WP1 no longer imports them.

## What the owner will see

Put the GM to work: the page slides to a big yard and a status that says the GM is getting ready for Monday; a
moment later the GM runs the week in the yard; when Friday's pickup has held, the page slides back up to the team's
prediction beside "What the GM did", with the report one scroll down. Nothing on the screen counts weeks or draws a
learning curve. In the tray, "Show the learning curve" brings G2's chart back for the teacher.

## Plan review

Astra (`.claude/docs/reviews/g5b-plan-astra-triage.md`): eight findings, five accepted and three in part. The
changes: the pilot's clock stops after its readout and D51 names the engine's time and the playback's; the click owns
its run through the token after every await; the export waits for the published readout and a playback error
unlocks with the error line; the wait shows an in-world placeholder and its length on the Chromebook is a gate item;
`data-plays` counts the weeks played and the unsettled plan is sampled while the GM gets ready; the status and week
logs record every write; "Watch the week again" never republishes; the yard's width is budgeted with its caption,
its button and the open tray.

## Result (2026-10-28, session 5; every number from this session's runs on the owner's Mac)

**Tests.** `npm test`: 33 files, 298 tests, all passing. The status test (2 cases) and 6 of the 8 words cases were
seen failing on the stub and the G5 HTML; the export test's `speed` case passed at once because its seam edit removed
the field in the same step. `speed.ts` and its 10 tests are gone (D52). The new e2e was run against G5's build before
any package started: 5 of 7 failed (the load test on the caption, Round 1 waiting for "The GM is running the week.",
the edited and unsettled plans waiting for the week to be over, the pilot's export still carrying `speed`), and the
two editor-only tests passed, as they should. `npm run lint` exit 0; `npm run build` clean (75.1 kB of script).

**Round 1 unchanged.** `node src/learn/pilot.ts --seeds 20 --budget 60000`: 20 of 20 target met; episodes 24,000,
27,500, 23,500, 25,500, 28,000, 22,500, 22,000, 23,500, 27,500, 23,500, 27,000, 27,500, 28,000, 24,000, 31,000,
25,000, 25,000, 25,000, 25,000, 22,000: G2's twenty.

**Page.** `npm run e2e`: 7 passed in 41.8 s of Playwright's own time (42.2 s wall clock, `/usr/bin/time -p`; 31.5 s
in G5: every run now plays its week, 7.5 s each). Round 1 from the click to the readout took 8,343 ms, of which the
engine's part was 0.3 s (the check line: "Weeks trained 24,000 · ε 0.10 · evaluations 49 · stable · target met ·
0.3 s"); the status went "The GM is getting ready for Monday." → "The GM is running the week." → "The week is over:
…" with no other write and no digit; `data-week` went none → preparing → final and `data-plays` was 1; the readout,
the table and Watch the week again stayed out while the week played; the sentence, the table's totals, the export's
report and the replay's `data-key` equal the node-side twin's; the export has 13 keys and no `speed`; Show the
learning curve drew the curve and hid it. The edited plan settled at 28,000 weeks (0.4 s) and survived a resize mid-
week; the incidents-only plan ran to 150,000 weeks in 1.3 s; an in-page sampler checked every frame while the GM got
ready (17 frames for Round 1, 79 for the incidents-only plan): the yard's placeholder only, no readout, no table;
the incidents-only plan and its student status was simply "The week is over: …" with "not stable" on the check line; the pilot
mode was 2 of 2.

**The fold** (1366 × 768, the tray open, from the e2e): the button's bottom 600 px on load; the tray 96 px tall, its
top 672 px; while the week plays the status 8 px from the top, the yard 619 px wide (420 in G5) with its bottom at
566 px and its caption at 598 px; with the yard scrolled back into view, Watch the week again ends at 647 px; after
the week the page scrolls to the prediction and the sentence (top 8 px, bottom 123 px). With the tray closed the
yard's CSS gives about 732 px (computed, not measured).

**The capture.** `node e2e/capture.ts`: 20.5 s at 1366 × 768 (the wait, the week, the 8 s hold),
`Temp/capture/reward-the-pack-round1-seed1-20261028-084602.webm`.

**Packages.** WP1 (Opus): `app.ts` (the person flow, run ownership, `playWeek`, `showReadout`), `teacher.ts` (the
learning curve's toggle, the export gated on the readout), `pilot.ts` (its clock after the readout), `replay.ts` (the
placeholder option), `index.html`, `style.css` (the yard sized to the room). WP2 (Sonnet): `status.ts`,
`docs/capture.md`, the README's two paragraphs. The main thread: the plan, the seams, the tests, the e2e, BRIEF
sections 1, 10.2, 11 and 13, D50 to D52, CLAUDE.md's words, the roadmap, the removal of `speed.ts`, the triages.

**What moved.** (1) Astra's plan review: eight findings, five accepted and three in part (the triage). (2) The
packages landed with no test dispute. (3) Astra's diff review (`.claude/docs/reviews/g5b-astra-triage.md`): seven findings, none high, six accepted and one
in part: the click's whole locked lifecycle is guarded with an owner-checked unlock, the pilot's timing is one number
everywhere, the narrow yard keeps its height budget, the wait is sampled in the browser every frame, the `data-week`
transitions are exact, a stale error writes nothing, the post-clear resize really resizes.
