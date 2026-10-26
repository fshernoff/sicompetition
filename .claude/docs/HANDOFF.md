# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-26, end of session 2)

- `main`: scaffold (`ce78079`) and G0 (`6740b05`). Branch `g1-simulator`: G1 (`c4f255c`). Branch `g2-learner`:
  G2 (`d16903e`) on top of it. Branch `g3-editor`: G3 (`040cd7e`) on top of `g2-learner`, then one docs-only commit
  (below). Nothing pushed, nothing merged: the owner has not yet run the G1/G2 gate, so G3 was branched from
  `g2-learner`.
- G3 is green: `npm test` 27 files / 209 tests, `npm run lint`, `npm run build`, `npm run e2e` (7 tests, 29.3 s),
  `npm run pilot -- --seeds 20 --budget 60000` 20 of 20 with G2's episode counts. The numbers and the commands are in
  the Result of `.claude/docs/plans/g3-editor.md`; the Astra triages are `g3-plan-astra-triage.md` and
  `g3-astra-triage.md` in `.claude/docs/reviews/`.
- The docs commit records the owner's steer of Oct 26: the page is an incentive-design lesson for business students,
  the GM is the employee and not the subject, and the student's screen carries business words only. BRIEF sections
  1 and 11, D38 and D39, ROADMAP G4 and G5 and CLAUDE.md changed; no code did, the suite is as above. Three things
  on today's page are therefore known debts, not bugs: the status line ("Episodes 25,000 · ε 0.10 · 21.3 s · 51
  evaluations · stable · target met"), which G4 rewrites in the student's words; the Seed field and the Fast
  checkbox beside Train, which G5 moves into the teacher panel with the round selector.
- Astra tooling works (`Tools/Agent/astra.sh -e high`, 5 to 15 minutes, run in the background). It cannot run
  vitest or Playwright in its sandbox; it can run node, `npm run lint`, `npm run build`, `npm run pilot` (CODEX.md).
- Gotcha from this session: the auto-mode classifier can drop a verdict mid-turn and refuse a batch of Bash calls;
  nothing ran, so check `git status` and redo them.

## The owner gate for G3 (Fred)

```
git checkout g3-editor         # contains G1 and G2
npm install
npm test
npm run e2e
npm run dev
```

On the page: pick Round 3 in the selector, tick measures, drag sliders, read the sentence change as you drag, type a
prediction, press Train (tick Fast if you do not want to watch). The sentence must say what you set; the status
says "stable" (or that the GM is still changing its mind) and never "target met" unless the plan is Profit alone;
the readout sits beside your prediction; touch the plan again and the readout clears until you train again. Round
1 is locked (no toggle, no slider): that is section 8's "students only predict". `?round=3` on the address opens
Round 3 directly. `?pilot=20` is unchanged and still measures Round 1 whatever the selector showed. The status line
still shows ε, the evaluation count and "target met" in this build; that is the debt D38 names, cleared in G4.

Look at on the Chromebook: at 1366 × 768 the curve is below the fold (the Train button is about 700 px from the
top). Say whether the curve should move up, shrink, or stay: G4 rebuilds the area under the controls (the replay
and the P&L table), so the layout decision belongs there.

Then the G1/G2 gate from the previous HANDOFF still stands (`?pilot=20` on a Chromebook, three seeds by hand). Merge
`g3-editor` into `main` if satisfied (it brings G1 and G2 with it).

## Decisions the owner should look at (all in docs/DECISIONS.md)

- **D34** the round selector is on the page until G5's teacher panel.
- **D35** Round 1 is locked entirely (no toggle, no slider); the first draft left the Profit slider editable and
  Astra read section 8 the other way.
- **D36** only the Round 1 plan (Profit positive, everything else off or at 0) has a target class; every other plan
  is only ever "stable". The page cannot say "target met" for a plan the bible has not defined a class for.
- **D37** a run belongs to its plan: any edit afterwards clears the readout, status and curve.
- **D38** the student's screen carries business words only; ε, evaluation counts and "target met" are the
  teacher's, the status line says weeks practised and settled or still changing its mind, the curve is captioned as
  the GM getting better at earning its bonus.
- **D39** seed, speed and the round selector are teacher controls; the student keeps the plan, the prediction and
  Train.
- The bible changed in sections 1 (what the lesson is and what the student's screen carries), 7 (the clauses of the
  words, the empty-plan sentence, the hint), 8 (the lock and limit rules), 11 (the teacher panel holds everything
  that is not the lesson) and 13 (which plans have a target).

## What G3 found that later groups should know

- Plans indifferent to some choices (Incidents only, Dogs served only) may never meet D29's stability rule and run
  to the 150,000 cap: paced, that is the full 60 s and "60 s is up, the GM is still changing its mind". Plans with
  money in them settle in 22,000 to 35,000 episodes (18 to 29 s paced). G5's speed control is the lever; the
  harness measures any plan: `npm run pilot -- --seeds 5 --reward <preset or file.json>`.
- `Trainer.evals()` keeps the full `WeekReport` of every scheduled evaluation and `trainer.evaluate()` gives the
  greedy week on demand. For the replay, `runEpisode(world, spec, trainer.greedyPolicy(), episodeSeeds(seed,
  EVAL_BASE_INDEX))` (`src/sim/episode.ts`, `src/world/rng.ts`, `src/learn/train.ts`) returns the 20 `StepRecord`s
  and the same report `evaluate()` returns: G4 draws from those without touching the learner.
- Measured at 1366 × 768: the Train button sits about 700 px from the top, so the curve starts below the fold.

## Next thread does first (G4: the week replay and the readout)

1. Read `.claude/docs/ROADMAP.md`, `docs/BRIEF.md` sections 1, 5, 10, 11 and 13, D34 to D39, and the Results of the
   G2 and G3 plans. Section 1 now says what the lesson is and what the student's screen may carry; the G4 plan is
   written against it.
2. Write `.claude/docs/plans/g4-replay.md`: the week replay on canvas (yard, dogs, crew, ratio gauge, incident
   counter, reputation meter, cash counter; an incident is an icon and a counter); the weekly P&L and operations
   report as a table from `WeekReport` (section 10 names every line) and the readout sentence in section 10's form;
   the prediction beside the readout (the `.compare` panel of G3 is the seam: keep `#prediction` and `#readout`);
   the status line in the student's words (D38: weeks practised, settled or still changing its mind, nothing else;
   `tests/ui/status.test.ts` and the e2e assertions on "Episodes", "stable" and "target met" are rewritten with it);
   the curve kept and captioned as the GM getting better at earning its bonus; the layout under the controls and
   the Chromebook fold. The pilot mode keeps its table (seed, episodes, seconds, stable, target met): until G5 it is
   where the owner reads "target met" on the page (`?pilot=1` for one seed). Astra reviews the plan.
3. Seams and failing tests first: a pure function from a `WeekReport` to the table's rows; a pure function from the
   snapshot to the student's status words; the replay reads the `StepRecord`s of one greedy week and keeps no state
   of its own.
4. Keep the words: GM, bonus plan, readout, incident (an icon and a counter, never an injury), crew, measure. Nothing
   of the learner's (ε, evaluations, target met, episodes as a word) on the student's screen.
