# G1: the simulator

## Goal

A headless, deterministic model of one week at Good Dog Daycare that implements every rule in `docs/BRIEF.md`
section 6 with the numbers in `src/world/config.default.json`, computes the six KPI deltas per step, scores them
under a reward spec, and runs N episodes under a policy from the command line. No learner, no canvas.

## Acceptance

1. `npm test` runs one test per hidden rule (H1 to H12), a determinism test, an episode-shape test and the Round 1
   optimum test, and they pass. Each was seen failing before the packages started.
2. `npm run sim -- --episodes 200 --seed 1 --reward round1 --policy random` prints the JSON report; the main thread
   times it (target under 5 s wall clock including npm startup) and records the number in the result section.
3. The Round 1 calibration test (`tests/rules/round1-optimum.test.ts`): a restricted-policy calibration, not a proof
   of optimality (G2's learner is that). Candidates: the 135 stationary policies (bookings × rate × staff × five
   floor patterns); for the best stationary policy of each pattern, the ten variants with one day's staff set to 2
   or 3 (50); for the best of those 185, the twenty variants where one day uses another pattern (one-day
   deviations, which is where a learner would defect). 205 candidates, each on the same 100 seeds. The best mean
   reward belongs to a policy that accepts all, charges premium, runs one staffer on at least four days and has no
   nap or clean anywhere; every candidate that naps or cleans on any day trails it by at least $100 of mean weekly
   profit, and so does two staffers every day; the margin against the best nap-or-clean candidate holds on a second
   seed batch. If this fails: first rule out an implementation error with the H-tests and a hand-checked week, then
   the numbers in the bible move (owner informed in HANDOFF), then the config, then the test's thresholds last.
4. `npm run lint` clean; `npm run build` clean (the page still only draws the placeholder).
5. README has a Run section a judge can follow.

## Seams (written by the main thread before any package)

- `src/world/types.ts`: `State`, `DayPlan`, `FloorActivity`, `Action`, `WorldConfig`, `RewardSpec`, `KpiKey`,
  `KpiDeltas`, `WorldEvent`, `StepResult`, `Rng`, `DayReport`, `WeekReport`, `Policy`.
- `src/world/config.default.json`: the bible's numbers.
- `src/world/rules.ts`, `src/world/step.ts`, `src/world/reward.ts`, `src/world/rng.ts`, `src/world/config.ts`,
  `src/sim/episode.ts`, `src/sim/policies.ts`, `src/sim/search.ts`: exported signatures with bodies that throw
  `NotImplemented`, with the contract in each doc comment (RNG algorithm and reference values, draw order, report
  invariants, validation rules, preset weights, candidate set).
- `tests/helpers.ts` and `tests/rules/*.test.ts`: one file per rule, failing, with exact numbers from the bible.
- Packages never edit `types.ts`, `helpers.ts` or any test. A package that believes a test is wrong says so in its
  report with the bible line that contradicts it; the main thread decides.

## Work packages (run in parallel; each returns its diff and the test output it saw)

| WP | Model | Files | Delivers |
|---|---|---|---|
| WP1 world | Opus | `src/world/rules.ts`, `src/world/step.ts`, `src/world/reward.ts` | The pure rule functions, `initialState`, `step` (with `money`, `pickup`, `activity`, `floorRatio`), `legalActions`, `rewardFor`, in the resolution order of BRIEF section 6. Makes `tests/rules/h*.test.ts` and `reward.test.ts` pass. |
| WP2 runner | Opus | `src/world/rng.ts`, `src/sim/episode.ts`, `src/sim/policies.ts`, `src/sim/search.ts` | mulberry32 and the seed derivation (reference values pinned), `runEpisode` → `EpisodeTrace`, `buildReport` from `result.money`/`pickup`/`deltas` only, `summarize`, the four named policies, `evaluateStationaryPolicies` (205 candidates) and `scorePolicy`. Makes `determinism`, `episode-shape` and `round1-optimum` pass once WP1 lands. |
| WP3 cli | Sonnet | `src/sim/cli.ts`, `src/world/presets.json`, `src/world/config.ts`, `README.md` (Run section) | Arg parsing (`--episodes`, `--seed`, `--reward`, `--policy`, `--config`, `--help`), `validateConfig` and `validateRewardSpec` exactly as the stub comments specify, the four presets, the JSON envelope `{ config, reward, seed, episodes, policy, summary, last }`, exit codes 0/2; the README Run section. Makes `cli.test.ts` pass. |

WP1 and WP2 build against the seam types only; WP2's tests pass when both land. WP3 imports only the seams and
the runner's signatures.

## Tests (tests/rules/, one per rule, named for it)

| File | Pins |
|---|---|
| `h01-incident-risk-ratio.test.ts` | base probability at r = 5, 10, 12, 15, 20, 30; 0 with no dogs |
| `h02-legal-ratio-inspector.test.ts` | overRatio counted at r > 15 only; fine $250 and reputation −5 when the draw is below 0.05 |
| `h03-energy.test.ts` | +20 free play, −30 nap, day start 40, clamp; probability scales by 0.5 + e/100; multipliers |
| `h04-incident-costs.test.ts` | $15 refund, vet $150 on the second draw at < 0.10, reputation −2, KPI incidents +1 |
| `h05-requests-tomorrow.test.ts` | the formula at reputation 50, 30, 70; rate effects; clamp 0..30; Monday 20 |
| `h06-dirty-floor-illness.test.ts` | cleanliness deltas; illness cases at c = 0, 20, 40; each case −1 reputation and −1 request |
| `h07-call-out.test.ts` | streak counting; call-out on day 4 after three solo days; closed day with 0 staff |
| `h08-walk.test.ts` | +3 reputation; floor runs (dogs − 6)/(staff − 1); fallback with 1 staffer |
| `h09-structured-play.test.ts` | led class at r ≤ 10; fallback above |
| `h10-add-on-revenue.test.ts` | $5 per dog per play block; none for nap and clean; none at drop-off |
| `h11-fatigue.test.ts` | per-block gain at r = 4, 10, 20; overnight −15; KPI counts blocks > 70 |
| `h12-wages.test.ts` | $200 per scheduled staffer at drop-off; unpaid on call-out |
| `reward.test.ts` | weighted sum with units; off KPIs ignored; weights clamp |
| `determinism.test.ts` | same seed and actions → identical trajectory; different policy stream → same world rolls |
| `episode-shape.test.ts` | 20 steps, done after 19, report totals add up |
| `round1-optimum.test.ts` | acceptance 3 (the calibration) |
| `cli.test.ts` | the CLI parses args, rejects bad ones with exit 2, prints valid JSON |

## Astra's plan review

`.claude/docs/reviews/g1-plan-astra-triage.md`. The accepted findings are folded in above (seams carry the contracts,
`StepResult` carries money and the pickup snapshot, the calibration is symmetric and out-of-sample, the terminal
state and the RNG are pinned, WP3's validation and presets are specified).

## What the owner will see

`npm test` green with ~17 files; `npm run sim` printing a week report whose numbers match the plan's result
section; README's Run section. No page change.

## Result

(Filled in at the end of G1: the test count, the sim numbers for Round 1 over 200 random episodes, the optimum test
margin, what Astra found and what changed.)
