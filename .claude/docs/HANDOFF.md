# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-26, end of session 3)

- `main`: scaffold (`ce78079`) and G0 (`6740b05`). Branches, stacked: `g1-simulator` (G1), `g2-learner` (G2),
  `g3-editor` (G3 and the D38/D39 docs commit), `g4-replay` (G4, this session's one commit on top of `g3-editor`).
  Nothing pushed, nothing merged: the owner has not yet run the G1 to G3 gates, so G4 was branched from `g3-editor`.
- G4 is green: `npm test` 30 files / 246 tests, `npm run lint`, `npm run build`, `npm run e2e` (7 tests, 29.4 s),
  `npm run pilot -- --seeds 20 --budget 60000` 20 of 20 with G2's episode counts. The numbers and the commands are in
  the Result of `.claude/docs/plans/g4-replay.md`; the Astra triages are `g4-plan-astra-triage.md` and
  `g4-astra-triage.md` in `.claude/docs/reviews/`.
- The student's screen now carries business words only (D38): the status line says weeks practised and settled or
  still changing its mind (D41); the curve is captioned as the GM getting better at earning its bonus; the readout is
  three views of one greedy week (D40): the sentence beside the prediction, the week replay on canvas, and the weekly
  P&L and operations report as a table (BRIEF 10.1 and 10.2). What remains of the teacher's on the page is the D39
  debt for G5: the seed field, the Fast checkbox and the round selector beside Train.
- Astra tooling: run it detached (`nohup Tools/Agent/astra.sh -e high "$(cat prompt.txt)" > reply.md 2>&1 &`) and
  wait with a background loop on the reply file; a plain background call returns the moment the wrapper exits, not
  when Astra answers. It cannot run vitest or Playwright; it can run node, lint, build and the pilot (CODEX.md).
- Gotcha from this session: the Playwright geometry poll during the paced run must wait for the smooth scroll to
  land (status top ≤ 16 px), or it samples mid-scroll and proves less than it claims.

## The owner gate for G4 (Fred)

```
git checkout g4-replay         # contains G1, G2 and G3
npm install
npm test
npm run e2e
npm run dev
```

On the page: press Train on Round 1. The page slides down to the status line, the curve and the yard; the GM's
current test week plays and the sentence beside your prediction describes it; by the third or fourth week the yard
is packed with one staffer. When it settles, the final week plays once more and holds on Friday; "Watch the week
again" replays it; the weekly P&L and operations report is below. Read the report cold and say what the GM did (the
gate). Then on a Chromebook at 1366 × 768: Train should be on screen without scrolling, the status, curve and replay
in view after the click, the table one scroll down; `?pilot=20` should still be 20 of 20 in time with the replay
drawing, and one paced Round 1 run should look smooth. The replay's text is small on a desktop (about 12 px at the
page's width); say whether the smartboard needs it bigger (G5 can add a switch).

Then the G1 to G3 gates from the previous HANDOFFs still stand. Merge `g4-replay` into `main` if satisfied (it
brings G1 to G3 with it).

## Decisions the owner should look at (all in docs/DECISIONS.md)

- **D40** one greedy week, three views; the sentence follows the replay's week during training; the table appears
  only when the run ends.
- **D41** the status line's three sentences, with "Time is up:" when the 60 s ran out.
- **D42** the fold: one column, the page scrolls the watching area to the top on Train, the table below.
- **D43** the gauge marks 15 and nothing below it (10 is H1's, hidden).
- **D44** captions name events, never rules ("Walk photo posted", not "+3"); bonus points carry two decimals.
- The bible changed in section 1 (the status sentences, the curve's words, the three views) and section 10 (10.1 the
  table, 10.2 the replay).

## What G4 found that later groups should know

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
3. Seams and failing tests first; Astra reviews the plan; keep the words.
