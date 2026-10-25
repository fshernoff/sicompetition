# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-25, end of session 1)

- `main`: scaffold (`ce78079`) and G0 (`6740b05`). Branch `g1-simulator`: G1, one commit, not pushed, not merged.
- G1 is built and green: `npm test` 19 files / 123 tests, `npm run lint`, `npm run build`, `npm run e2e` all pass
  in this session. The numbers are in `.claude/docs/plans/g1-simulator.md` (Result) and the Astra triage in
  `.claude/docs/reviews/g1-astra-triage.md`.
- Astra tooling works: `Tools/Agent/astra.sh -e low "reply with the word pong"` → `pong` in 6.7 s; a `-e high`
  review takes 5 to 10 minutes, run it in the background.

## The owner gate for G1 (Fred)

```
git checkout g1-simulator
npm install
npm test
npm run sim -- --episodes 200 --seed 1 --reward round1 --policy recklessCovered
npm run calibrate
```

Compare with the plan's Result table. Then merge `g1-simulator` into `main` if satisfied.

## Decisions the owner should look at before G2 (all in docs/DECISIONS.md)

- **D8** KPI 1 is "Profit today", not the brief's "Revenue today": a revenue-only GM is indifferent to staffing, so
  the one-staffer behaviour cannot come from it. The plain-words plan reads "10 points per $100 of profit".
- **D9** The drop-off action is the day plan (27 choices); the drop-off block's activity is fixed to free play.
- **D15, D17, D18, D19, D23, D24, D25** Numbers that moved after Astra's reviews and the calibration: wages $300,
  a $250 supplies cost per clean, reputation slope 0.05, add-on $10, incident slope 0.08 above the legal line, rate
  effects +3/−1, and the call-out rule (after three solo days, scheduling the staffer alone closes the day;
  scheduling help brings everyone in). Each has a one-line reason.
- **D26, D27** Presets carry the suggested weights for KPIs that are off; the pickup reputation on the readout is
  the end-of-day value, sick dogs included.
- The reckless week has about 8 incidents, not the brief's illustrative 11: by Friday the sick dogs have shrunk the
  roster toward the legal line. The readout will show that shrinkage, which is its own lesson.
- The best fixed policy puts the help day on Tuesday, not Thursday, and walks on the help day; either way it is
  "one staffer on four days, no nap, no clean".

## Next thread does first (G2: the learner and the training curve)

1. Read `.claude/docs/ROADMAP.md`, `docs/BRIEF.md` sections 3.1, 7 and 13, and the G1 plan's Result.
2. Write `.claude/docs/plans/g2-learner.md`: observation coarsening (3.1), tabular Q-learning with γ = 1 (section 13),
   a training loop with a wall-clock budget, the training curve on canvas, and the pilot measurement (20 seeds ×
   greedy evaluation, all in the Round 1 outcome class, under 60 s on the target Chromebook). Astra reviews it.
3. Seams: `src/learn/` types and failing tests, including one that asserts the greedy policy after training on seed
   1 lands in the Round 1 outcome class.
4. The learner must never import a world rule: it sees `State`, `legalActions`, `step` and `rewardFor` only.
