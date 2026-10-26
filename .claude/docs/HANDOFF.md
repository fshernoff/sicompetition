# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-26, end of session 3)

- `main`: scaffold (`ce78079`) and G0 (`6740b05`). Branches, stacked: `g1-simulator` (G1), `g2-learner` (G2),
  `g3-editor` (G3 and the D38/D39 docs commit), `g4-replay` (G4, `971643e`), `g4b-words` (G4b, the owner's words,
  one commit on top of `g4-replay`). Nothing pushed, nothing merged: the owner liked G4 on the Mac ("I really like
  it") and asked for the words change before G5; the Chromebook checks of the G4 gate are still his.
- G4b is green: `npm test` 30 files / 249 tests, `npm run lint`, `npm run build`, `npm run e2e` (7 tests, 29.2 s),
  `npm run pilot -- --seeds 20 --budget 60000` 20 of 20 with G2's episode counts. The numbers and the commands are in
  the Results of `.claude/docs/plans/g4-replay.md` and `g4b-words.md`; the Astra triages are `g4-plan-astra-triage.md`,
  `g4-astra-triage.md`, `g4b-plan-astra-triage.md` and `g4b-astra-triage.md` in `.claude/docs/reviews/`.
- The student's screen carries the owner's words only (D38, D45): the bonus plan is in dollars ("earns $10 per $100
  of profit"); the button puts the GM to work; the status says weeks on the job and settled into its routine or still
  changing how it runs the place (D41, D45); the curve is the GM's bonus for the week in dollars over weeks on the job;
  the readout is three views of one week the GM's way (D40): the sentence beside the prediction, the week replay on
  canvas, and the weekly P&L and operations report as a table (BRIEF 10.1 and 10.2), whose last group is the GM's
  pay under the plan. What remains of the teacher's on the page is the D39 debt for G5: the seed field, the Fast
  checkbox and the round selector beside the button.
- Astra tooling: run it detached (`nohup Tools/Agent/astra.sh -e high "$(cat prompt.txt)" > reply.md 2>&1 &`) and
  wait with a background loop on the reply file; a plain background call returns the moment the wrapper exits, not
  when Astra answers. It cannot run vitest or Playwright; it can run node, lint, build and the pilot (CODEX.md).
- Gotcha from this session: the Playwright geometry poll during the paced run must wait for the smooth scroll to
  land (status top ≤ 16 px), or it samples mid-scroll and proves less than it claims.

## The owner gate for G4 and G4b (Fred)

```
git checkout g4b-words         # contains G1 to G4
npm install
npm test
npm run e2e
npm run dev
```

On the page: read every word a student sees once more; the bonus plan should read as a pay plan ("earns $10 per
$100 of profit"), the button "Put the GM to work", the status "weeks on the job", the readout "A week the GM's way",
the table's last group "The GM's pay under your plan (the profit above is before this pay)". Say any word that still
sounds like a class about AI. Press the button on Round 1: the page slides down to the status line, the curve and
the yard; the GM's current week plays and the sentence beside your prediction describes it; by the third or fourth
week the yard is packed with one staffer. When it settles, the final week plays once more and holds on Friday;
"Watch the week again" replays it; the weekly P&L and operations report is below. Read the report cold and say what
the GM did (the G4 gate). Then on a Chromebook at 1366 × 768: the button should be on screen without scrolling, the
status, curve and replay in view after the click, the table one scroll down; `?pilot=20` should still be 20 of 20 in
time with the replay drawing, and one paced Round 1 run should look smooth. The replay's text is small on a desktop
(about 12 px at the page's width); say whether the smartboard needs it bigger (G5 can add a switch).

Then the G1 to G3 gates from the previous HANDOFFs still stand. Merge `g4b-words` into `main` if satisfied (it
brings G1 to G4 with it).

## Decisions the owner should look at (all in docs/DECISIONS.md)

- **D40** one greedy week, three views; the sentence follows the replay's week during training; the table appears
  only when the run ends.
- **D41** the status line's three sentences, with "Time is up:" when the 60 s ran out.
- **D42** the fold: one column, the page scrolls the watching area to the top on Train, the table below.
- **D43** the gauge marks 15 and nothing below it (10 is H1's, hidden).
- **D44** captions name events, never rules ("Walk photo posted", not "+3"); the bonus carries cents.
- **D45** the GM's bonus is dollars and the page speaks of the job, never of training (the owner's steer after G4).
- The bible changed in section 1 (the status sentences, the curve's words, the three views, then the owner's words),
  section 7 (the plan in dollars), section 8 (the lock line) and section 10 (10.1 the table, 10.2 the replay).

## What G4 and G4b found that later groups should know

- The words are the owner's and a test holds them: `tests/ui/words.test.ts` reads `index.html` and the stylesheet's
  `content:` strings for the learner's and the class's vocabulary, and the pure functions' tests pin every sentence.
  A new student-facing string anywhere else (a canvas string, a caption, an error line) needs a test or a review eye;
  G4b found one in `style.css` that way.
- A known test gap (Astra, G4 and G4b diff reviews): the e2e proves the sentence and the table against a node-side
  twin and that the replay is drawn in its final week, but it cannot see the replay's trace. G5's export is the hook:
  the exported readout must equal the twin's report, and a `data-step` on `#replay` (or the export of the frame)
  would let the e2e pin the replay's week too.

- `Trainer.evaluateTrace(k)` gives the greedy week with its 20 step records; the page holds one trace and the
  sentence, the replay and the table are pure functions of it. A test pins that evaluating between slices changes
  nothing about a run.
- `clearRun(page)` in `src/ui/app.ts` is the one lifecycle operation (D37): it bumps the run token, and every
  scheduled frame checks the token before drawing. G5's export should snapshot `page.trace`, `page.spec` and the
  prediction at the end of a run, not re-evaluate.
- The replay draws every animation frame while a week plays; the canvases are measured at the 10 Hz redraw and on
  resize only. On the Mac this is invisible; the Chromebook is the owner's measurement.
- Paced, a week plays in 6 s plus a 1.5 s hold, so a 20 to 30 s Round 1 run shows three or four weeks.

## Next thread does first (G5: the teacher panel, export, deploy)

1. Read `.claude/docs/ROADMAP.md`, `docs/BRIEF.md` sections 1, 11 and 13, D33, D34, D38, D39, and the Results of
   the G3 and G4 plans.
2. Write `.claude/docs/plans/g5-teacher.md`: the teacher panel, closed by default (round presets replacing the
   selector, D34; the seed field; the speed control replacing Fast, D33; "reveal hidden rules" printing section 6 in
   plain words; the learner's check line with weeks trained, ε, evaluations, stable, target met, which is where
   "target met" moves from the pilot table); the JSON export (config name, reward spec, prediction text, the readout
   as `trace.report`, the training curve, the seed; no identifiers); Netlify deploy with relative asset paths; the
   30-second screen capture. The student's page keeps the plan, the prediction and Train.
3. Seams and failing tests first; Astra reviews the plan; keep the words (D45: the teacher panel may use the learner's
   words, that is what it is for; the student's page may not).
