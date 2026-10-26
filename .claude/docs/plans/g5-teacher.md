# G5: the teacher panel, the export, the deploy, the capture

## Goal

After G5 the student's screen is the lesson and nothing else (BRIEF section 1, D38, D39, D45): the round as a line
of text, the bonus plan and its sentence, the prediction, Put the GM to work, the status line, the bonus curve, the
replay and the weekly P&L and operations report. Everything that is not the lesson moves into a teacher panel that
is closed by default (BRIEF section 11): the round presets (the selector of D34), the seed field, the speed control
(the Fast checkbox of D33), a button that reveals the hidden rules (section 6 in plain words, for the debrief), the
learner's check line (weeks trained, ε, evaluations, stable, target met, seconds: the instruments of section 13 and
D6, which until now the owner reads only in the pilot table) and the export button, which downloads one JSON file
per run (the config name, the round, the seed, the bonus plan and its sentence, the prediction, the readout as the
run's week report, the bonus curve, the evaluations, the learner's numbers; no names, no identifiers). Then the
Netlify deploy (relative asset paths, Node 24) and the 30-second screen capture for the pilot: a script that records
one paced Round 1 run in headless Chromium at 1366 × 768, and a shot list for the owner's own recording.

Round 1 trains exactly as it does now: `npm run pilot` still gives G2's twenty episode counts, and the page's Normal
speed is D33's 1,200 weeks a second. The pilot mode (`?pilot=N`) keeps its table as the harness's page twin.

Owner gate: the pilot class, Nov 9. Target Nov 8.

## What the class sees, and why each piece is built the way it is

- **The round is a line, not a control.** "Round 1: profit only" (the preset's label) and its one-line note sit
  above the plan where the selector was. A team never changes its round; the teacher does, in the panel (D34).
- **Seed and speed leave the page.** The seed is the teacher's instrument for "two teams with the same plan and seed
  train the same GM" (section 9) and the speed is the teacher's pacing of the class; neither is a word in the lesson
  (D39). The controls row keeps the button alone.
- **The panel is a tray at the bottom of the window, opened by a small "Teacher" tab in the bottom-right corner.**
  Closed, it adds no height to the page, so the Put the GM to work button stays above the fold (its bottom is 600 px
  from the top at 1366 wide as built, 626 in G4b: the round line is shorter than the round bar was; the gate is 700).
  Open, it overlays the bottom of the window (96 px tall at 1366 wide as built: the controls row, the check line and
  a hint) and the page gets that much bottom padding so the table's last rows can still scroll above it; it does not
  move the lesson. A tray rather than a panel at the top of the page because of
  the pilot: on the click the page scrolls the watching area to the top (D42) and a panel at the top would be out
  of view exactly when the owner wants to read the check line; the tray is in view during and after the run. On a
  1366 × 768 Chromebook with the tray open the button's bottom (600) is still above the tray's top (672): the e2e
  measures both, and after a run it scrolls the report's last row and the revealed rules to the bottom of the
  window and checks that they clear the tray (the padding under an open tray is the tray's measured height). The tab
  is not a lesson word, but it is the one teacher's control that stays on the student's screen: small, in the
  corner, labelled "Teacher" (D46).
- **A bad seed never reaches the student's status.** The seed is validated at the click: if it is not a whole number
  in 0..4294967295 the tray opens, the message goes to the check line, the seed field takes focus and nothing runs;
  the student's status line is untouched (Astra, plan review).
- **The round presets are three radio buttons** in the tray (Round 1, Round 2, Round 3). Choosing one does what the
  selector did: it loads the preset into the editor (which clears any run, D37) and rewrites the round line.
  `?round=2|3` on the address still preloads a round.
- **The speed is four named speeds, not a slider:** Slow (600 weeks a second), Normal (1,200, D33's constant and the
  default), Fast (2,400) and Full speed (no pacing: the old Fast checkbox). A teacher reads "600 weeks a second"
  and knows what a run costs in seconds; a slider's number would mean nothing. At Slow, G2's largest Round 1 count
  (31,000 weeks) takes about 52 s, nominal: the per-frame arithmetic caps a slow frame at 0.1 s of training, so a
  machine under 10 frames a second trains fewer, and a Slow run may hit the 60 s limit; the tray's hint says so and
  the Chromebook measurement decides. The pilot mode is never paced, whatever the control says (D33), and the
  paced arithmetic (the fractional carry, the 0.1 s cap, at least one week a frame) is a pure seam, `paceSlice`,
  pinned by a test and called by `runTraining`.
- **Reveal the hidden rules** prints section 6 in plain words into a section at the bottom of the page (under the
  report, above the pilot table), one line per rule, H1 to H12, every number read from the config, and scrolls to
  it; a second press hides it again. The rules are not the run's: they stay through runs and clears. The words are
  the owner's (incident, never injury; the GM; the crew; the floor), with the numbers the class has not seen: the
  safe ratio of 10 (D43), the chances, the energy and cleanliness arithmetic, the call-out streak, the walk's
  photo. They print on the page, not in the tray, so the class reads them on the board at the debrief.
- **The check line** is one line in the tray, rewritten with the status (10 times a second during a run): "Weeks
  trained 12,000 · ε 0.46 · evaluations 25 · not stable yet · 10.0 s" during a run; "Weeks trained 24,000 · ε 0.10
  · evaluations 49 · stable · target met · 20.6 s" after; "target not met" or "no target for this plan" (D36) in
  place of "target met"; "not stable" when a run ends unsettled; ", over budget" after the seconds when the 60 s ran
  out (the pilot table's "budget"); "No run yet." before a run. It is the pilot table's row for the run on the page
  (D6, section 13), for the owner during the pilot and for a teacher who wants to know whether the GM settled.
- **Export this run** is enabled from the moment a run ends until the next clear, and downloads one JSON file. The
  file carries what the page holds at the end of the run and nothing is re-evaluated: the readout is the run's
  final week (`page.trace.report`, the same trace the sentence, the replay and the table show), the curve is the
  trainer's, the learner's numbers are the run's snapshot. The prediction is the text as it stood when the GM was put
  to work, snapshotted at the click (D47): the evidence plan reads the prediction-versus-readout gap, which an edit
  after the readout would erase; the tray's hint says so. The file's `speed` is the pacing that was applied to the run (a pilot seed says `full`). The file is a Blob
  download (no request); its name is
  `reward-the-pack-<round>-seed<seed>-<yyyymmdd>-<hhmm>.json`. No names and no identifiers: the top-level keys are
  fixed and the only free text is the prediction (and a team that types its name there has done so itself, section
  11).
- **The pilot mode is unchanged** except that the speed control, like the Fast checkbox before it, is ignored
  (never paced) and the check line now also shows each seed's numbers as it runs; the pilot table stays. Each seed
  has its own setup (seed, Round 1, `full`, an empty prediction), so the export after a pilot is the last seed's.
- **The replay names its week.** `showWeek` writes the outcome key of the trace it hands the renderer to
  `data-key` on `#replay`, so the e2e can check that the week on the yard is the twin's; what the pixels show
  remains unproven (there is no oracle for the drawing), as Astra noted in G4 and again here.

## Acceptance

1. `npm test` green with the new tests, each seen failing first on stubs: the speed control's mapping to weeks a
   second (exactly 600, 1,200, 2,400 and unpaced; an unknown name is Normal) and the paced slice arithmetic under
   irregular frame times, the check line's words as a pure function
   of the snapshot, the elapsed time and the budget flag, the export's JSON shape as a pure function of the page's
   state (the readout equals the trace's report, the curve is the trainer's rounded to cents, the prediction passes
   verbatim, the keys are fixed, the document survives a JSON round trip, a 150,000-week curve serialises under
   4 MB compact, the filename, and the handler's source calls no evaluate method), the hidden rules' twelve lines with every
   number from `config.default.json` (one patched field at a time changes the words), and the page's
   words (the teacher's elements are inside `#teacher` and the student's HTML outside it carries none of the
   learner's words; the panel is hidden by default). Everything from G1 to G4b stays green and every number in
   every existing test is unchanged.
2. `npm run e2e`, Playwright's own time under 60 s: the page loads offline-clean with the tray hidden, the tab
   visible, the round line reading "Round 1: profit only", no Seed or Fast on the student's page, the rules section
   hidden; opening the tray shows the check line "No run yet."; Reveal prints twelve rules naming the safe ratio of
   10 (which the student's HTML never names) and a second press hides them; a blank seed left with the tray closed
   opens the tray with the message on the check line and leaves the student's status alone; at 1366 × 768 the
   button's bottom is within 700 px on load and, with the tray open, above the tray's top; the untouched Round 1
   plan trains at Normal with a typed prediction until the status says settled in under 60 s, every status sample
   in the owner's form (unchanged), the export off before and during the run, the check line ending "stable ·
   target met" with the status's week count, the geometry of the fold as in G4 with the tray's top sampled in the
   same poll and both canvases and their captions above it; then, after the prediction box is edited and the seed
   and the speed changed, Export downloads a file whose readout report equals the node-side twin's week (the whole
   report), whose sentence equals `#readout`, whose `data-key` on the replay equals the twin's outcome key, whose
   prediction is the text typed before the click, whose plan is Round 1, whose seed is 1 and speed `normal` (the
   click's, not the fields'), and whose curve has the twin's episode count; the report's last row and the revealed
   rules scroll clear of the open tray; the edited plan (Round 3, Profit +10, Incidents −7, Full speed) trains as in
   G4, its export comes on, goes off at a slider edit and stays off a frame later, the rules stay revealed through
   the clear and the next run; a round change through the tray's radio clears the run and reloads the preset; the
   unsettled plan ends as in G4 with the check line saying "not stable"; the pilot mode (`?pilot=2`) trains Round 1
   whatever the address says, its table still says target met, and its export is seed 2's run at `full` with the
   twin's report. No request leaves the origin; the built `index.html` references its assets by relative paths.
3. `npm run pilot -- --seeds 20 --budget 60000`: 20 of 20 with G2's twenty episode counts (nothing in the learner
   changes; the page's Normal speed is the old constant).
4. `npm run lint`, `npm run build` clean; the scaffold test still pins no off-origin script, style or font.
   `netlify.toml` pins Node 24 for the build; the README says how to deploy (connect the repo, or drop `dist/`).
5. `npm run capture` writes a 1366 × 768 recording of one paced Round 1 run (the prediction typed, the click, the
   curve and the replay, the final week once more, about 30 s) under `Temp/capture/` and prints its path and
   length; `docs/capture.md` is the shot list for the owner's own recording on the smartboard.
6. Owner gate: Fred runs the pilot class on Nov 9 from the deployed page: opens the tray, picks the round and the
   seed, closes it, and the class sees only the lesson; after each run a team exports its file; at the debrief the
   rules are revealed on the board. Before that, on a Chromebook: the tray opens and closes without moving the
   lesson, the check line reads right during a run, `?pilot=20` is still 20 of 20 in time.

## Seams (written by the main thread before any package starts)

- `src/ui/speed.ts`: `SpeedName = 'slow' | 'normal' | 'fast' | 'full'`; `SPEEDS: readonly Speed[]` with
  `{ name, label, pace: number | null }` (`label` names the weeks a second: "Normal: 1,200 weeks a second", "Full
  speed: no pacing"); `DEFAULT_SPEED = 'normal'`; `paceFor(name: string): number | null` (null is unpaced; an
  unknown name gives Normal's pace); `speedName(value: string): SpeedName` (an unknown value is Normal);
  `paceSlice(owed, elapsedMs, pace): { episodes, owed }`, the per-frame arithmetic of D33 exactly as `runTraining`
  had it (the elapsed time capped at 100 ms, the owed weeks carried as a fraction, at least one week a frame).
  Normal's pace is 1,200 (D33).
- `src/ui/check.ts`: `checkLine(s: TrainingSnapshot | null, ms: number | null, outOfBudget: boolean): string`, the
  words above. ε with two decimals; weeks and evaluations with en-US commas; seconds with one decimal.
- `src/ui/export.ts`: `RunExportInput` (configName, round, seed, speed, spec, planWords, prediction, trace, curve,
  evals, snapshot, ms, outOfBudget, exportedAt: Date); `RunExport` (`version: 1`, `app: 'Reward the Pack'`,
  `exportedAt` ISO, `config`, `round`, `seed`, `speed`, `plan` (the RewardSpec), `planWords`, `prediction`,
  `readout: { sentence, report }`, `curve: { weeks, bonus, average }` (three equal-length number arrays, bonus and
  average rounded to cents), `evaluations: { week, bonus, key }[]`, `learner: { weeksTrained, epsilon, evaluations,
  stable, hasTarget, targetMet, seconds, outOfBudget }`); `buildExport(input): RunExport` (a deep copy: mutating the
  result never touches the page's trace); `exportFilename(input): string`; `downloadJson(filename, data): void`
  (browser only: a Blob, an `<a download>`, click, revoke; never a request).
- `src/world/hiddenRules.ts`: `RuleLine = { id: 'H1' … 'H12', title, words }`; `hiddenRules(config: WorldConfig):
  readonly RuleLine[]`, twelve lines in order, the exact sentences in `tests/world/hidden-rules.test.ts`, every
  number from the config passed in (chances as "N in 100", dollars with a dollar sign and en-US commas, the
  signed rate effects).
- `src/ui/app.ts` (WP1 changes it, the contract is fixed here): `Page` drops `round: HTMLSelectElement` and
  `fast`, and gains `roundLabel: HTMLElement`, `rounds: HTMLInputElement[]` (the three radios), `speed:
  HTMLSelectElement`, `teacher: HTMLElement`, `teacherOpen: HTMLButtonElement`, `teacherClose: HTMLButtonElement`,
  `reveal: HTMLButtonElement`, `rules: HTMLElement`, `rulesList: HTMLOListElement`, `exportButton:
  HTMLButtonElement`, `check: HTMLElement`, `setup: RunSetup | null` (`{ seed, round, speed, prediction }`,
  snapshotted at the click, where `speed` is the pacing applied; the pilot's own for each seed: Round 1, `full`, an
  empty prediction), `result: RunResult | null` (set when a run resolves). `runTraining(page, seed, startedAt,
  label, pace: number | null)` replaces the `paced` boolean (the pilot passes null) and takes each frame's slice from
  `paceSlice`. `showWeek` writes `outcomeKey(trace.report)` to `data-key` on `#replay`. The click validates the
  seed into the tray (above). The export handler in `src/ui/teacher.ts` builds its input from `page.trace`,
  `page.setup`, `page.result` and the trainer's `curve()` and `evals()`; it never calls an evaluate method. `setControls` also covers the radios, the speed and the export (the
  export is on only with a result); `clearRun` clears `setup`, `result`, disables the export and writes "No run
  yet." to the check line; `showRound(page, name)` checks the radio and writes the round line. The check line is
  written wherever the status is. `studentStatus` does not change. `PACE` goes; `SPEEDS` is the lever.
- `index.html` (WP1 writes it, the ids are fixed here): the round line `#round-label` and `#round-note`; the
  controls row holds `#train` only; the tab `#teacher-open` (`aria-controls="teacher"`, `aria-expanded`); the tray
  `<aside id="teacher" hidden>` holding `<fieldset id="round">` with `#round-round1`, `#round-round2`,
  `#round-round3` (radios named `round`), `#seed`, `#speed` (a select the page fills from `SPEEDS`), `#reveal`,
  `#export` (disabled), `#teacher-close`, and the check line `#check`; the rules section `<section id="rules"
  hidden>` with `#rules-title` and `<ol id="rules-list">`, between `#report` and `#pilot`. The student's HTML
  outside `#teacher` carries none of the learner's words and neither `#seed` nor `#speed`.

## Packages

| Package | Model | Files | What it builds |
|---|---|---|---|
| WP1 the panel | Opus | `src/ui/app.ts`, `src/ui/teacher.ts` (new), `src/ui/pilot.ts`, `index.html`, `src/style.css` | The tray and the tab, the round radios and the round line, the speed select filled from `SPEEDS`, the reveal button and the rules section (rendered once from `hiddenRules`, shown and hidden, scrolled to), the export button (builds the input from the page and calls `buildExport` and `downloadJson`), the check line written with the status, `setup` at the click, `result` at the end, the pace through `runTraining`, the padding under an open tray, the lock during a run. No logic in the pure modules changes. |
| WP2 the words of the rules | Sonnet | `src/world/hiddenRules.ts` | The twelve lines, interpolated from the config, pinned by the test. |
| WP3 the small pure modules | Sonnet | `src/ui/speed.ts`, `src/ui/check.ts`, `src/ui/export.ts` | The speeds, the check line, the export document, the filename, the download. |
| WP4 the capture and the deploy notes | Sonnet | `e2e/capture.ts` (new), `docs/capture.md` (new), `README.md` (two paragraphs), `netlify.toml` (Node 24), `package.json` (`capture` script) | A Playwright script that serves `dist/`, records one paced Round 1 run at 1366 × 768 to `Temp/capture/`, prints the path and the length; the shot list; how to deploy. |

Packages never edit types, seams' signatures, helpers or tests; a package that believes a test is wrong reports it
with the bible line that contradicts it. The main thread writes the seams, the tests, the e2e, the bible's section
11 as built, D46 to D48, the roadmap, HANDOFF and the triages.

## Tests (main thread, seen failing first)

- `tests/ui/speed.test.ts`: exactly 600, 1,200 (the default), 2,400 and null; an unknown name is Normal; every
  label carries its number of weeks a second (Full says no pacing); the names are the four; `paceSlice` under
  irregular frames (16.7 ms, a 500 ms hang capped at 100 ms, 0.3 ms giving one week and a negative carry, the
  fractional carry adding up over frames).
- `tests/ui/check.test.ts`: the sentences above, one case each: no run; running; settled with target met; settled,
  target not met; settled, no target; ended unsettled; over budget; the formats (ε two decimals, commas, one
  decimal of seconds).
- `tests/ui/export.test.ts`: on a real Trainer (seed 1, Round 1, 600 episodes): the keys, the readout equals the
  trace's report and `describeWeek` of it, the curve's three arrays of the trainer's length with cents, the
  evaluations, the learner block, the prediction verbatim (quotes and a newline), a deep copy, the JSON round trip,
  a synthetic 150,000-week curve under 4 MB of compact JSON (the download is compact), the filename for a fixed date; and that `src/ui/teacher.ts`
  calls `buildExport` and no evaluate method.
- `tests/world/hidden-rules.test.ts`: twelve lines H1 to H12 with the exact sentences for the default config;
  one patched field at a time (the legal and safe ratios, the base chance, the fine, the premium rate effect, the
  call-out streak, the walk's group size, the wage) changes the one line it belongs to; no line carries "injur",
  "reward", "episode" or "ε"; H11 says fatigue is not what makes the staffer call out.
- `tests/ui/words.test.ts`: the new ids; the teacher's elements inside `#teacher`; the student's HTML outside it
  free of the learner's words, of `#seed`, `#speed` and "Fast"; the tray hidden by default; the rules section
  hidden by default.
- `e2e/smoke.spec.ts`: as in acceptance 2.

## What the owner will see

On load the page is the lesson: the title, the round line ("Round 1: profit only. The GM is paid on profit and
nothing else. …"), the plan, the prediction beside the readout, the one button, the status, the two canvases.
A small "Teacher" tab sits in the bottom-right corner. Pressing it slides a tray up from the bottom: Round 1 · 2 · 3
as radio buttons, Seed, Speed (Normal), "Reveal the hidden rules", "Export this run" (greyed until a run ends),
Close, and under them the check line ("No run yet."). Choosing Round 2 rewrites the round line and unlocks the plan
exactly as the selector did. During a run the tray's controls are greyed and the check line counts the weeks, the
ε, the evaluations and the seconds; when the GM settles it ends "stable · target met · 20.6 s" (Round 1) and the
export button comes on. Pressing it downloads `reward-the-pack-round1-seed1-20261108-1530.json`. Pressing "Reveal
the hidden rules" prints the twelve rules under the report and scrolls there; pressing it again hides them. On a
1366 × 768 Chromebook the tray covers the bottom 120 px or so and the button is still visible above it.

## Not in this group

- A "big replay" switch for the smartboard (the owner has not asked; the HANDOFF's question stands).
- Hard mode (`requests.noise` 4) and the two-signal preset as teacher presets: section 8 names them, nothing on the
  page loads them yet; a config selector is G6's if the pilot asks.
- The deploy itself: linking the repository to a Netlify site needs the owner's account (ask before sending anything
  outside the repo).

## Plan review

Astra (`.claude/docs/reviews/g5-plan-astra-triage.md`): nine findings; six accepted, two in part, one resolved
while it read. The changes: the seed is validated into the tray, never into the student's status; the e2e samples
the tray's top with the fold and scrolls the report and the rules clear of it; the speeds are pinned exactly and the
paced arithmetic is a seam with its own test; the export's lifecycle (off, on, off after a clear, the click's seed
and speed, the pilot's last seed) is in the e2e; the exported speed is the pacing applied; a source test pins that
the handler never re-evaluates; the replay carries `data-key`; Slow's guarantee is nominal; H11 no longer ties
fatigue to the call-out; the config test patches one field at a time; a 150,000-week export is measured.

## Result (2026-10-26, session 4; every number from this session's runs on the owner's Mac)

**Tests.** `npm test`: 34 files, 310 tests, all passing (4.7 s). 61 are new: 60 in the four new files (`speed`
10, `check` 4, `export` 11, `hidden-rules` 35) and one in `words`. Seen failing before any package started: the
15 cases of `speed`, `check` and the rewritten `words` on the stubs and the old HTML, and the `export` and
`hidden-rules` files as a whole (their fixtures call the stubs at collection), then all 7 e2e tests on the old page
(every one timed out on `#teacher-open` or failed on `#round-label`). Two tests were changed after a package
disputed them, both disputes upheld: WP2's (the incident cap belongs to H3 as well as H1, section 6: "capped at
0.90", so patching it must change both lines) and WP3's (the carry test assumed 25 × 20.04 is exactly 501 in
floating point; it now uses frames of 31.25 ms, exact in binary, and a conservation check, and `paceSlice` keeps
the exact pre-G5 arithmetic with no epsilon). `npm run lint` exit 0; `npm run build` clean (74.6 kB of script,
7.3 kB of style, 4.5 kB of HTML).

**Round 1 unchanged.** `node src/learn/pilot.ts --seeds 20 --budget 60000`: 20 of 20 target met; episodes to
stable 24,000, 27,500, 23,500, 25,500, 28,000, 22,500, 22,000, 23,500, 27,500, 23,500, 27,000, 27,500, 28,000,
24,000, 31,000, 25,000, 25,000, 25,000, 25,000, 22,000: G2's twenty numbers.

**Page.** `npm run e2e`: 7 passed in 31.5 s of Playwright's own time (31.9 s wall clock with the build and the
server start, `/usr/bin/time -p`; 31.3 s before the diff review's folds). The untouched Round 1 page at Normal settled 20,705 ms after the click with the
G2 sentence ("accepted every booking on 5 of 5 days, ran the floor with 1 staffer on 4 days, chose nap 0 times,
averaged 16 dogs per staffer, and had 7 incidents") and the status "After 24,000 weeks on the job, the GM has
settled into its routine."; every status write from before the click was in the owner's form; the check line read
"Weeks trained 24,000 · ε 0.10 · evaluations 49 · stable · target met · 20.0 s"; the export (after the prediction
box, the seed and the speed had been changed) carried the click's prediction, seed 1 and `normal`, the Round 1 plan,
a readout report deep-equal to the node-side twin's week, a sentence equal to `#readout`, a curve of the twin's
24,000 weeks and 49 evaluations, and the replay's `data-key` was the twin's outcome key. The edited plan (Round 3,
Profit +10, Incidents −7, Full speed) settled at 28,000 weeks with the twin's sentence, its export said `round3`,
`full` and no target, a slider edit turned the export off and the clear held two frames and a resize later, the
rules stayed revealed through the clear, the next run and a round change through the tray; the unsettled plan read
"After 150,000 weeks on the job, the GM is still changing how it runs the place." with the check line "not stable ·
no target for this plan"; `?pilot=2&round=3` trained Round 1 twice, 2 of 2, and its export was seed 2's run at
`full` with the twin's report. No request left the origin; the built page references `./assets/`.

**The fold** (headless Chromium, 1366 × 768, from the e2e's own measurements): the Put the GM to work button's
bottom is 600 px from the top on load (626 in G4b; the round line is shorter than the round bar; the gate is 700);
the tray open is 96 px tall with its top at 672 px, so the button clears it by 72 px; during the run the status
landed 9 px from the top, the canvases' bottoms at 400 px and their captions at 459 and 432 px, all above the
tray; after the run 8 and 399 px; scrolled to the bottom with the tray open, the report's last row ends at 655 px
and the revealed rules' last line also clears the tray's top at 672; the document's scroll width stays 1366.

**The export's size** (`npx vitest run tests/ui/export.test.ts` and a node probe of `buildExport`): a synthetic
150,000-week run is 2.93 MB compact (2,928,720 bytes; 6.08 MB with two-space indentation, which is why the
download is compact); Round 1 on seed 1 (24,000 weeks) is 446 KB.

**The capture.** `node e2e/capture.ts` (after `npm run build`): 31.4 s at 1366 × 768,
`Temp/capture/reward-the-pack-round1-seed1-20261026-180234.webm`, about 5 MB; not kept in the repo (Temp/ is
ignored); no Vite process left on its port afterwards (`lsof -iTCP:4188`).
The first try of the script stopped after 11.5 s because it waited for "still changing", which is also the running
sentence; it now waits for the button to offer another go.

**What the owner sees** is the "What the owner will see" section above, as built, with the tray 96 px tall.

**What moved during G5, in order.** (1) Astra's plan review (`.claude/docs/reviews/g5-plan-astra-triage.md`): nine
findings, six accepted, two in part, one resolved while it read; the seed is validated into the tray, the e2e
samples the tray's top with the fold and scrolls the report and the rules clear of it, the speeds are pinned exactly
and the paced arithmetic is the `paceSlice` seam, the export's lifecycle and the pilot's last seed are in the e2e,
the exported speed is the pacing applied, a source test pins that the handler never runs the week again, the replay
carries `data-key`, H11 no longer ties fatigue to the call-out, the config test patches one field at a time, the
export at the cap is measured. (2) The packages landed with two test disputes, both upheld (above), and one fix in
review: the capture's wait. (3) Astra's diff review (`.claude/docs/reviews/g5-astra-triage.md`): eight findings,
none high, seven accepted and one in part; the capture now owns its server (Vite spawned directly, a busy port
refused, the process stopped and awaited), stamps seconds and refuses to overwrite; H6 says "on average" and names
the draw; the tray's padding follows a `ResizeObserver`; "cleaning changes nothing" and "the full incident chance"
read their config fields; the e2e measures the button again with the tray open; the export test checks every number
is finite; the pilot mode's status prefix is named in section 11 as the harness's (D31). Astra confirmed the pilot at
G2's counts, `paceSlice` equivalent to the pre-G5 arithmetic under irregular frames, and the export's lifecycle.

**Packages.** WP1 (Opus): `app.ts`, `teacher.ts` (new), `pilot.ts`, `index.html`, `style.css`. WP2 (Sonnet):
`hiddenRules.ts`. WP3 (Sonnet): `speed.ts`, `check.ts`, `export.ts`. WP4 (Sonnet): `e2e/capture.ts`,
`docs/capture.md`, the README's two sections, `netlify.toml`, the `capture` script. The main thread wrote the plan,
the seams, the tests, the e2e, the bible's section 11, D46 to D49, the roadmap, CLAUDE.md's command list, the
README's two stale sentences, the capture's wait, and the triages.

**Not built, on purpose.** The "big replay" switch (the owner has not asked); hard mode and the two-signal preset
as teacher presets (G6 if the pilot asks); the Netlify site itself (the owner's account).
