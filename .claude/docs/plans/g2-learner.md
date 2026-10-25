# G2: the learner and the training curve

## Goal

The GM learns. Tabular Q-learning over the coarse observation of BRIEF section 3.1, with the objective of section 13
(γ = 1, the displayed weekly total), trains in the browser inside a wall-clock budget, draws its training curve on the
canvas, and shows the greedy GM's week in one sentence. Round 1 (profit only) trains to the reckless outcome class
every time. No bonus plan editor (G3), no replay or P&L table (G4), no presets or teacher panel (G5): the page trains
the Round 1 plan from a seed field and a button, and has a pilot mode for the Chromebook measurement.

## Acceptance

1. `npm test` green with the new files: observation coarsening, Q-table arithmetic, the trainer (closed-day folding
   with a poisoned sentinel, determinism across chunked calls, the ε schedule on the global episode index, the
   moving average, a held-out comparison of the untrained and trained greedy GM, target met on seeds 1 to 3), the
   readout sentence, plus everything from G1.
2. `npm run pilot -- --seeds 20 --budget 60000` (node): seeds 1..20, each trained until done or 60 s of training
   time, each evaluated on the fixed week and on weeks 1..5 (120 checks); every seed target met; exit 0 (1 if any
   seed fails or runs out of budget, 2 on bad arguments). The result section records episodes-to-stable and seconds
   per seed on the Mac.
3. `npm run e2e`: the built page, in headless Chromium, trains Round 1 from seed 1 to "stable" and the readout line
   says the GM ran the floor with 1 staffer on 4 days and chose nap 0 times; the time from the click is printed and
   recorded. No request leaves the origin.
4. Owner gate (section 13's measurement): Fred opens the built page on a Chromebook with `?pilot=20`; the page trains
   seeds 1..20 in turn with the real rendering loop and prints a table (seed, episodes, seconds from start, stable,
   target met) and a summary line; all 20 target met in under 60 s each. Then three seeds of his choice by hand, to
   watch the curve and the sentence.
5. `npm run lint` and `npm run build` clean.

## The learner's settings (starting values; WP1 tunes them with the harness and the result section reports what met acceptance 2)

| Setting | Value | Why |
|---|---|---|
| observation | section 3.1: 80 drop-off + 1,080 floor + 1 "closed" sentinel = 1,161 (D28) | the rare Thursday-with-streak-3 state must be visited often enough to rank 27 actions |
| actions | the index of the action in `legalActions(state)`: 27 at drop-off, 5 on the floor | one flat table of 1,161 × 27 doubles (251 KB) |
| γ | 1, terminal value 0 | section 13 |
| step size | max(0.05, 1/n) for the n-th update of a cell (D32) | a sample average while a cell is new, then a small constant weight; constant α 0.1 left half the seeds one help day too cautious |
| ε | 1.0 → 0.1 linearly over the first 20,000 episodes, then 0.1 | random weeks first (the hook), then a floor high enough that a 27-way drop-off action is retried about once per 270 visits |
| Q init | 0 | pessimistic start; WP1 tested an optimistic start of 300 and it did not help |
| ties | one draw from the policy stream, only when tied | deterministic given the seed, no bias toward the first action |
| closed days | folded into the preceding drop-off transition (section 13) | keeps Friday's value inside the Thursday-closure branch |
| evaluation | every 500 episodes on the fixed week `episodeSeeds(seed, 1 000 000)`, both streams reset (D30) | comparable evaluations |
| stable | ε at its floor and the outcome key of the last 5 evaluations identical (D29) | section 13 |
| target met | stable and `isRound1Outcome` on the fixed week and weeks 1..5 | section 13 |
| done | stable, or `maxEpisodes` = 150,000 | the page stops training; the pilot harness also stops at its budget |
| pace | the Train button trains 1,200 weeks a second unless Fast is checked; the pilot mode is unpaced (D33) | the class watches the curve climb for 20 to 40 s |
| streams | training episode i: `episodeSeeds(seed, i)` | D14 |

WP1's tuning protocol, as run (the result section has the numbers): (1) the harness on seeds 1..20 with early
stopping off under constant α 0.1: 14 of 20 held the class at 40,000, 10 of 20 with early stopping; the failures
added a second help day (808 of the failing held-out weeks) or capped bookings (205); (2) the ε floor at 0.15, the
decay at 15,000, α 0.05, an optimistic start of 300, and their combinations: 6 to 17 of 20, none steady; (3) the
observation experiments of section 3.1 on scratch copies: streak through every floor state 1 of 20, streak on solo
floor states 1 of 20, so the key stands; (4) the visit-count step size max(0.05, 1/n) with the decay at 20,000 and
the cap at 150,000: 20 of 20, and 58 of 60 on seeds 1..60 (the two misses add a second help day), mean 29,858 and
maximum 46,000 episodes to stable, 0.21 s per seed on the Mac. Adopted (D32).

## Seams (written by the main thread before any package)

- `src/learn/observe.ts`: bin functions, `observe(state, config)`, `isDecision(state)`, the constants.
- `src/learn/qlearn.ts`: `QTable` and `chooseAction` with the draw order in the doc comment.
- `src/learn/train.ts`: `LearnerConfig`, `DEFAULT_LEARNER`, `MovingAverage`, `Chooser`, `trainEpisode` (one episode
  of Q-learning against a table, with folding; the trainer and the tests both use it), `CurvePoint`, `EvalPoint`,
  `TrainingSnapshot` (with `targetMet`), `Trainer`.
- `src/sim/readout.ts`: `outcomeClass`, `outcomeKey`, `isRound1Outcome` (implemented by the main thread) and
  `describeWeek` (stub).
- `tests/learn/*.test.ts`, `tests/sim/readout.test.ts`, the extended `e2e/smoke.spec.ts`: failing.
- Packages never edit types, seams' signatures, helpers or tests; a package that believes a test is wrong says so in
  its report with the bible or plan line that contradicts it.

## Work packages (parallel; each returns its diff and the test output it saw)

| WP | Model | Files | Delivers |
|---|---|---|---|
| WP1 learner | Opus | `src/learn/observe.ts`, `src/learn/qlearn.ts`, `src/learn/train.ts`, `src/learn/pilot.ts`, `package.json` (the `pilot` script) | The coarsening, the table, `trainEpisode` with folding, the trainer (ε on the global episode index, fixed-week evaluation, stable and target met, scalar curve data with an incremental moving average, `runFor` with `performance.now()`), the 20-seed harness with its table and exit codes, and the tuning protocol above with its numbers. Makes `tests/learn/*.test.ts` pass. |
| WP2 page | Opus | `src/ui/curve.ts`, `src/ui/app.ts`, `src/ui/pilot.ts`, `src/main.ts`, `src/style.css`, `index.html` | The page: seed field (`#seed`, default 1), Train button (`#train`), status line (`#status`: episodes, ε, seconds since the click, evaluations, "stable" when stable, "target met" when met), the training curve on `canvas#curve` (per-episode reward faint, moving average bold, evaluation marks, axes with labels; downsampled to at most two points per horizontal pixel; backing store capped at 1,920 wide), the greedy week's sentence (`#readout`), Train again. Training runs in `requestAnimationFrame` with `Trainer.runFor(10)` per frame and a redraw at most 10 times a second; stops when `done` or at 60 s from the click. `?pilot=N` runs seeds 1..N in turn with the same loop and prints the table of acceptance 4 (`#pilot`). No framework, no network, no fonts off-origin, no step records retained. Makes the extended `e2e/smoke.spec.ts` pass once WP1 and WP3 land. |
| WP3 readout | Sonnet | `src/sim/readout.ts` (`describeWeek` only), `README.md` (one paragraph under Run: the page, the pilot mode, `npm run pilot`) | The sentence of BRIEF section 10 and the README lines. Makes `tests/sim/readout.test.ts` pass. |

WP2 builds against `Trainer`'s signatures and can be exercised by hand with `npm run dev` only after WP1 lands; its
acceptance is the e2e test and the pilot page. WP3 imports nothing from the learner.

## Tests

| File | Pins |
|---|---|
| `tests/learn/observe.test.ts` | the counts (80, 1,080, 1,161); every bin boundary; drop-off 0..79 and floor 80..1,159 disjoint; fatigue ignored everywhere and cleanliness at drop-off; a closed floor block → the sentinel, not a decision; a done state throws |
| `tests/learn/qlearn.test.ts` | `update` arithmetic; `maxValue`/`best` over the first nActions slots; ties cost exactly one draw; `chooseAction` draw order |
| `tests/learn/train.test.ts` | `MovingAverage` 1, 2, 3 with window 2 → 1, 1.5, 2.5; `epsilonAt` 0, 2,500, 10,000, 20,000; a forced Thursday closure folds into the drop-off transition (0 → 10 with α 0.1 and a Friday value of 100) and never reads or writes a sentinel poisoned with 999; the terminal target is the step reward alone; 10,000 episodes in one call equal 100 calls of 100 (table, visits, curve, evaluations); the closed row untouched after training; `runFor` budget; evaluation equals the runner on the fixed week and repeats identically; seeds 1, 2, 3 target met within 40,000 episodes, stable only after the ε floor, the held-out trained GM beating the untrained one by 200 on 100 weeks with the target class on at least 90 of them; `maxEpisodes` stop |
| `tests/learn/pilot.test.ts` | exit 2 on bad arguments; a one-seed run exits 0 and prints its table |
| `tests/sim/readout.test.ts` | `outcomeKey` and `isRound1Outcome` on the covered reckless, the literal reckless and the careful weeks, a three-staffer help day rejected; `describeWeek` sentences |
| `e2e/smoke.spec.ts` | acceptance 3 |

## What the owner will see

`npm run dev` (or the built page): a seed field, a Train button, a curve that starts as noise around 150 and climbs
toward 500 as ε falls, the status line counting episodes, and the sentence under the curve settling on "accepted
every booking on 5 of 5 days, ran the floor with 1 staffer on 4 days, chose nap 0 times" with "stable" and "target
met" shown. `?pilot=20` prints the twenty-seed table. The result section records the Mac numbers.

## Chromebook

The main thread cannot measure a Chromebook: the result section reports Mac and headless-Chromium numbers, and the
owner gate (acceptance 4) is the Chromebook pilot page. If the Chromebook needs more than 60 s, the levers in order
are: fewer evaluations, a smaller `maxEpisodes`, a shorter decay (last, see the tuning protocol). The brief's risk
table names a precomputed Round 1 replay as the fallback; D3 names a policy-gradient agent. Neither is built here, and
neither would count as passing the 20-seed measurement.

## Astra's plan review

`.claude/docs/reviews/g2-plan-astra-triage.md`: 12 findings; the key, the stopping rule, the evaluation streams, the
folding test, the pilot harness and the page budget all changed because of it.

## Result (2026-10-25, session 1; every number from this session's runs on the owner's Mac)

**Tests.** `npm test`: 24 files, 168 tests, all passing (39 of the G2 tests were seen failing on the stubs; the
rest were added or changed while folding the two Astra reviews). `npm run lint`, `npm run build` clean.

**Pilot harness.** `npm run pilot -- --seeds 20 --budget 60000`: 20 of 20 seeds target met, exit 0, 4.0 s for all
twenty (0.1 to 0.3 s of training per seed). Episodes to stable: mean 25,350, minimum 22,000 (the floor: 20,000 of
decay plus four more evaluations), maximum 31,000 (seed 15). On a wider sweep during tuning (seeds 1..60, before
the walk bucket), 58 of 60; the two misses added a second help day.

| Seed | Episodes | Seed | Episodes | Seed | Episodes | Seed | Episodes |
|---|---|---|---|---|---|---|---|
| 1 | 24,000 | 6 | 22,500 | 11 | 27,000 | 16 | 25,000 |
| 2 | 27,500 | 7 | 22,000 | 12 | 27,500 | 17 | 25,000 |
| 3 | 23,500 | 8 | 23,500 | 13 | 28,000 | 18 | 25,000 |
| 4 | 25,500 | 9 | 27,500 | 14 | 24,000 | 19 | 25,000 |
| 5 | 28,000 | 10 | 23,500 | 15 | 31,000 | 20 | 22,000 |

**Page.** `npm run e2e`: both tests pass; paced at 1,200 weeks a second, seed 1 is stable 20.5 s after the click in
headless Chromium, with the readout "accepted every booking on 5 of 5 days, ran the floor with 1 staffer on 4 days,
chose nap 0 times, averaged 16 dogs per staffer, and had 7 incidents". Unpaced (Fast), the same run takes 0.2 s.
The curve climbs from a moving average near 150 to about 480 while the greedy test weeks settle near 545. Training
costs 7 µs an episode on the Mac (WP1's measurement); a 150,000-episode cap is 1 s here.

**What moved during G2.** Astra's plan review and its probe: the key shrank (D28), stable and target met were
separated (D29), the evaluation week was pinned (D30), the browser pilot mode was added (D31). WP1's tuning
protocol: a constant step size reached 10 of 20 seeds (the failures one help day too cautious), the observation
experiments made it worse, and the visit-count step size reached 20 of 20 (D32). The page paces training so the
class can watch (D33). Three of the main thread's test expectations were wrong (an unreachable floor index, a cell
outside the smaller table, a Friday value that assumed a full return in one forward pass) and were corrected
against the implementers' arithmetic.

**What this establishes and what it does not.** On this Mac, 20 of 20 seeds reach the Round 1 class and stay
there, in a fraction of a second unpaced and in 20 to 26 s paced. It does not establish the Chromebook number:
that is acceptance 4, the `?pilot=20` page on the owner's machine. Seeds beyond the pilot's twenty miss about one
time in thirty by adding a second help day; that week still accepts every booking at premium with no nap and no
clean, and the lesson survives it, but the readout will say "1 staffer on 3 days".

**Astra.** `.claude/docs/reviews/g2-astra-triage.md`: 8 findings, all accepted; the two that mattered were deadline
accounting in the page's pilot mode and the harness (a last slice crossing 60 s no longer counts as in time) and
the stability key now counting days at each rate.
