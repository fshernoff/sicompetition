# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-25, end of session 1)

- `main`: scaffold (`ce78079`) and G0 (`6740b05`). Branch `g1-simulator`: G1 (`c4f255c`). Branch `g2-learner`,
  built on `g1-simulator`: G2, one commit. Nothing pushed, nothing merged.
- G1 and G2 are green: `npm test` 24 files / 168 tests, `npm run lint`, `npm run build`, `npm run e2e` (2 tests,
  23 s), `npm run pilot` 20 of 20. The numbers are in the plans' Result sections and the Astra triages in
  `.claude/docs/reviews/`.
- Astra tooling works (`Tools/Agent/astra.sh`); a `-e high` review takes 5 to 15 minutes, run it in the background.
  Astra cannot run vitest in its sandbox (CODEX.md).

## The owner gate for G1 and G2 (Fred)

```
git checkout g2-learner        # contains G1's commit
npm install
npm test
npm run pilot -- --seeds 20 --budget 60000
npm run dev                    # press Train (about 25 s paced), try two more seeds, tick Fast and train again
```

Then, on a Chromebook, open the built page (or the dev server) with `?pilot=20` and read the table: every seed
should say stable yes, target yes, under 60 s. That is the pilot's definition of done measured (BRIEF section 13).
Merge `g2-learner` into `main` if satisfied (it brings G1 with it).

## Decisions the owner should look at (all in docs/DECISIONS.md)

- **D8, D9** (G0): Profit, not Revenue, as KPI 1; the drop-off action is the day plan.
- **D15 to D27** (G1): the economics that moved after Astra's reviews and the calibration.
- **D28 to D33** (G2): the smaller observation key; stable versus target met; the fixed evaluation week; the
  browser pilot mode; the visit-count step size (the one that made 20 of 20 possible); pacing at 1,200 weeks a
  second with a Fast checkbox.
- Seeds beyond the pilot's twenty miss about one in thirty by adding a second help day (G2 Result). If that bothers
  the lesson, the lever is more training (`maxEpisodes`) or a longer stability window, both in `DEFAULT_LEARNER`.

## Next thread does first (G3: the bonus plan editor)

1. Read `.claude/docs/ROADMAP.md`, `docs/BRIEF.md` sections 7 and 8, and the G2 plan's Result.
2. Write `.claude/docs/plans/g3-editor.md`: six KPIs with toggles and sliders −10..+10, the plan in words (the
   template in section 7), the prediction box, the Round 2 and Round 3 limits (maxActive), and how the page passes
   the spec to the Trainer; the Round 1 preset stays the default. Astra reviews it.
3. Seams and failing tests first: the plain-words renderer is a pure function over a RewardSpec; the editor's
   state is a RewardSpec; the Trainer already takes any spec.
4. Keep the words: GM, bonus plan, readout; the KPI names and units are in section 7.
