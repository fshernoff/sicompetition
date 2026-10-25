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
   floor patterns); for the best stationary plan of each pattern and each staff level, the ten variants with one
   day's staff changed (150, so "one staffer with one day of help" is always generated); for the best so far, the
   twenty one-day pattern deviations; for the best so far, the twenty one-day plan deviations (other bookings, other
   rates) and the sixty single-block activity deviations: the one-decision defections a learner would try. 385
   candidates, each on the same 100 seeds. The best mean reward belongs to a policy whose readouts show the Round 1
   outcome class (all, premium, exactly four solo days, no closure, every booking accepted, no nap or clean block);
   every candidate with a nap or clean anywhere trails it by at least $100 of mean weekly profit, a cheaper rate on
   any one day by at least $50, fewer bookings on any one day never wins, two staffers every day trails by at least
   $100; the nap-or-clean and cheaper-rate margins hold on a second seed batch. If this fails: first rule out an
   implementation error with the H-tests and a hand-checked week, then the numbers in the bible move (owner informed
   in HANDOFF), then the config, then the test's thresholds last.
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

## Result (2026-10-25, session 1; every number below is from this session's runs on the owner's Mac)

**Tests.** `npm test`: 19 files, 123 tests, all passing. 105 were seen failing on the stubs before the packages
started; the rest were added while folding the two Astra reviews and seen failing or red before their fix. `npm run
lint` clean; `npm run build` clean; `npm run e2e` 1 passed.

**Sim.** `node src/sim/cli.ts --episodes 200 --seed 1 --reward round1 --policy <p>`: 0.09 s wall clock through
node, 0.19 s through `npm run sim --silent` (`/usr/bin/time -p`).

| Policy | Mean profit | std | p5 / p95 | Incidents | Sick dogs | Solo days | Closed | Naps | Cleans | Avg dogs/staffer | Blocks over 15 | Fatigue > 70 | Reputation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| random | 1505.7 | 766 | 260 / 2640 | 1.70 | 0.63 | 1.67 | 0.04 | 3.05 | 3.07 | 10.9 | 2.5 | 0.4 | 50 → 51.0 |
| reckless | 4394.3 | 323 | 3806 / 4830 | 8.86 | 4.88 | 4.00 | 1.00 | 0.00 | 0.00 | 18.6 | 16.0 | 7.1 | 50 → 12.7 |
| recklessCovered | 4965.1 | 314 | 4360 / 5393 | 8.10 | 6.29 | 4.00 | 0.00 | 0.00 | 0.00 | 16.0 | 15.9 | 12.0 | 50 → 22.8 |
| careful | 746.6 | 17 | 735 / 750 | 0.13 | 0.00 | 0.00 | 0.00 | 5.00 | 5.00 | 10.0 | 0.0 | 0.0 | 50 → 49.8 |

**Calibration** (`npm run calibrate`: 385 candidates × 100 episodes, seed 1, 0.9 s). Best: (all, premium) every day,
staff 1-2-1-1-1 (help on Tuesday, the day with the most dogs after Monday), walks on the help day, free play
otherwise; mean profit 5169.0 ± 290, 8.10 incidents, 4 solo days, 0 closed, every booking accepted, 0 nap or clean
blocks. Margins below it (mean weekly profit): best single nap block $106, best one-day nap $117, best single clean
block $170, best one-day clean $178, best cheaper rate on one day $134 (standard on Thursday), fewer bookings on one
day $0 (a no-op: legal on the help day accepts everyone anyway) and ≥ $100 on Monday, two staffers every day $485,
three staffers $1,908, legal every day $485, standard every day $1,374. Out of sample (seed 2): best 5171.5,
nap-or-clean margin $118, cheaper-rate margin $129.

**What moved during G1, in order.** (1) First calibration (add-on $5, slope above the legal line 0.05): a one-day nap
trailed by only $46 to $68 and the week had 5.8 incidents → add-on $10 (D23), slope 0.08 (D24), incident floor 7 → 6.
(2) Astra's diff review: with rate effects +4/−2 the search's own winner charged low on Thursday → +3/−1 (D25), and
stages D and E added so the one-decision defections are measured. (3) That change exposed the search's blind spot:
staffing variants came only from each pattern's best stationary plan, which was now two staffers, so "one staffer
with help" was never generated → stage B builds from every pattern and staff level (150 variants). Other folds from
the review: validator tightened, presets carry the suggested off weights (D26), average ratio excludes an empty
floor, the test judges the winner on its readouts, the pickup reputation is the end-of-day value (D27). One test of
the main thread's was wrong (it compared whole reports, which carry the policy seed). No package code was changed
during review except two comments, the average-ratio filter and the search's candidate generation.

**Packages.** WP1 (Opus): rules.ts, step.ts, reward.ts; hand-traced a no-incident reckless week against the rules and
matched every number. WP2 (Opus): rng.ts, episode.ts, policies.ts, search.ts. WP3 (Sonnet): config.ts, presets.json,
cli.ts, README Run section. The main thread added src/sim/calibrate.ts and the stage D/E search.

**Astra.** `.claude/docs/reviews/g1-astra-triage.md`: 8 findings, 7 accepted, 1 resolved by correcting the bible.

**For G2.** The reward is dense (profit moves every step) and the Round 1 optimum is a fixed-shape week a tabular
learner can represent (day in the key). The hardest part of the policy to learn is the help day: five drop-off
states differ only by day and streak, and the payoff of "2 staffers today" arrives on Thursday as a closure avoided.
The streak bin in the observation (3.1) is what makes it learnable.
