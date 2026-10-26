# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-26, end of session 4)

- `main`: scaffold (`ce78079`) and G0 (`6740b05`). Branches, stacked: `g1-simulator` (G1), `g2-learner` (G2),
  `g3-editor` (G3 and the D38/D39 docs commit), `g4-replay` (G4, `971643e`), `g4b-words` (G4b, `f05f0de`),
  `g5-teacher` (G5, one commit on top of `g4b-words`). Nothing pushed, nothing merged: the owner's gates for G4, G4b
  and G5 are all still his (he liked G4 on the Mac; the Chromebook checks and the pilot class are ahead).
- G5 is green: `npm test` 34 files / 310 tests, `npm run lint`, `npm run build`, `npm run e2e` (7 tests, 31.5 s),
  `node src/learn/pilot.ts --seeds 20 --budget 60000` 20 of 20 with G2's episode counts, `node e2e/capture.ts`
  31.4 s. The numbers and the commands are in the Result of `.claude/docs/plans/g5-teacher.md`; the Astra triages are
  `g5-plan-astra-triage.md` and `g5-astra-triage.md` in `.claude/docs/reviews/`.
- The student's screen is now the lesson and nothing else (D39, D46): the round line, the plan, the prediction
  beside the readout, Put the GM to work, the status, the curve, the replay, the table; plus one small "Teacher" tab
  in the bottom-right corner. The tab opens a tray at the bottom of the window with the round radios, the seed, the
  speed (Slow 600, Normal 1,200, Fast 2,400 weeks a second, Full speed; D48), Reveal the hidden rules (section 6 in
  plain words, printed under the report), Export this run (one compact JSON file per run; D47, D49) and the
  learner's check line (weeks trained, ε, evaluations, stable, target met, seconds). BRIEF section 11 is the
  contract as built.
- Astra tooling: run it detached (`nohup Tools/Agent/astra.sh -e high "$(cat prompt.txt)" > reply.md 2>&1 &`) and
  wait with a background loop on the reply file. Tell it not to run `npm run build` while an e2e or the capture is
  using `dist/`. It cannot run vitest or Playwright.
- Gotchas from this session: the ended-unsettled status and the running status both say "still changing", so a
  script waiting for the end of a run must wait for the button's "Put the GM to work again" (the capture's first
  try stopped after 11.5 s); 25 frames of 20.04 weeks are not exactly 501 in floating point (a test of the paced
  carry needs binary-exact frame times); a bare `=====` word in a zsh `echo` is an `=cmd` expansion and fails the
  command.

## The owner gate for G5 (Fred): the pilot class, Nov 9

```
git checkout g5-teacher        # contains G1 to G5
npm install
npm test
npm run e2e
npm run build && npm run capture   # a 30-second recording in Temp/capture/ (the shot list: docs/capture.md)
npm run dev
```

On the page: the student's screen should carry nothing of the teacher's but the small Teacher tab in the corner.
Press the tab: the tray should open at the bottom without moving the lesson; pick Round 2, type a seed, pick a
speed, press Close. Put the GM to work on Round 1 with the tray open and read the check line as it counts; when
the GM settles it should end "stable · target met · 20.x s" and Export this run should come on; press it and open
the file (the prediction in it is the one you typed before the click, D47). Press Reveal the hidden rules: the twelve
rules print under the report in the owner's words; say whether any sentence would confuse the class at the debrief
or gives away a number you would rather keep. Then on a Chromebook at 1366 × 768: the button on screen without
scrolling, the tray open with the button still above it, the check line readable during a run, `?pilot=20` still
20 of 20 in time, one paced Round 1 run at Normal, one at Slow (nominal 37 to 52 s on seeds 1 to 20; it may hit the
60 s limit on a slow machine, D48). The deploy: connect the repository to a Netlify site (build `npm run build`,
publish `dist/`, Node 24 from `netlify.toml`) or drag `dist/` onto Netlify Drop; then run the Chromebook checks
on the deployed address. The G1 to G4b gates from the previous HANDOFFs still stand. Merge `g5-teacher` into `main`
if satisfied (it brings G1 to G5 with it).

## Decisions the owner should look at (all in docs/DECISIONS.md)

- **D46** the tray at the bottom, opened by the corner tab; the tab is the one teacher's control on the student's
  screen.
- **D47** the export carries the prediction as it stood at the click.
- **D48** four named speeds; Normal is D33's constant; the pilot is never paced.
- **D49** the export is the whole run, columnar, compact JSON, in cents; `speed` is the pacing applied.
- The bible's section 11 is rewritten as built; sections 1 and 13 are unchanged.

## What G5 found that later groups should know

- The export is the hook for any "same week" check: `readout.report` in the file is `page.trace.report`, the same
  trace the sentence, the replay and the table show, and the e2e compares the whole report with a node-side twin.
  `#replay[data-key]` is the outcome key of the trace the renderer was handed; what the pixels show is still
  unproven (no oracle for the drawing).
- `page.setup` (seed, round, speed, prediction) is snapshotted at the click and `page.result` set when a run
  resolves; `clearRun` drops both and turns the export off. A seed or speed change after a run does not clear it
  (the file carries the click's); a plan edit or a round change does (D37).
- The hidden rules are the config's, not the run's: `hiddenRules(config)` is rendered once and the section stays
  through runs and clears. Every number in it is a config read; the test patches one field at a time.
- The tray is 96 px tall at 1366 wide and the button's bottom is at 600 px; `html.teacher-open` carries the tray's
  measured height as `--tray-height` for the page's bottom padding.
- A known test gap: the exported file's `speed` for a paced run is the select's value at the click, which is also
  what `runTraining` paced at; nothing checks the pace actually applied beyond the e2e's 20.7 s Round 1 timing.

## Next thread does first (G6: fixes from the pilot's three confusions; G7: the lesson materials)

1. Read `.claude/docs/ROADMAP.md`, the Result of `.claude/docs/plans/g5-teacher.md`, the two G5 triages, and the
   owner's notes from the pilot class (Nov 9): the three most common confusions, the time to train on the
   Chromebooks, whether students read the readout cold.
2. Write `.claude/docs/plans/g6-pilot-fixes.md` from those notes; the words stay the owner's (D45) and the student's
   screen stays the lesson (D39). If the owner asks for the "big replay" switch or the hard-mode preset, they go in
   the tray (section 11).
3. G7 (the teacher guide, the round briefs, the role cards, the concept check, the memo template) is Sonnet packages
   under `docs/lesson/`, Astra reviewing for clarity; it can start before the pilot if the owner wants it for
   period 1.
