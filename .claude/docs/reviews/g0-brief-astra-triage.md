# G0: Astra's review of docs/BRIEF.md, triaged

`Tools/Agent/astra.sh -e high`, 2026-10-25, reply in `Temp/AgentCodex/` (git-ignored). Astra ran its own in-memory
simulation of sections 5 and 6 (150k to 200k weeks per comparison) and reported dollar figures; those are Astra's
numbers, not this session's, and the G1 calibration test is what checks them against the real code.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | Reckless does not win: one Tuesday clean beats never cleaning by ~$104; two staffers walking all day beat it by $58 to $158 | **Accepted** | Wages $200 → $300 (D15), $250 supplies per clean (D18), reputation→requests slope 0.1 → 0.05 (D19). The calibration test now compares against every one-day nap/clean deviation with a $100 floor and an out-of-sample batch. Numbers are verified when WP1+WP2 land, not before. |
| 2 | Scheduling an absent worker: [1,1,1,2,1] runs solo all week at no cost | **Accepted** | H7 rewritten: after three solo days, scheduling 1 closes the day; scheduling 2 or 3 brings everyone in at full wages (D17). "One staffer on four days" survives as the outcome, now with real help on the fifth. |
| 3 | Coarsening merges streak 2 and 3; reputation omission argued loosely; 2,400 is capacity not coverage | **Accepted** | Streak bins 0, 1, 2, ≥3 (320 drop-off states); section 3.1 now calls the count a capacity and leaves a requests-projection bin to G2's measurement. |
| 4 | Single-KPI targets impossible as written (no "almost no dogs with three staff"; "unprofitable" is false) | **Accepted** | Section 7's table is now outcome classes the readout can show (D20). No "accept nobody" option added: the action set stays the brief's. |
| 5 | Convergence settings unspecified; "every time" needs a protocol | **Accepted, partly deferred to G2** | New section 13 fixes γ = 1, terminal 0, greedy evaluation, a definition of "stable", and the pilot measurement (20 seeds). Learning rate, ε schedule, budget and Chromebook timing are G2's plan (D22). |
| 6 | Fatigue and call-out are different mechanisms presented as one | **Accepted** | H7 and H11 now say so explicitly: two rules, two discoveries. |
| 7 | Walk accounting incomplete (fewer than six dogs, which count drives dirt and add-ons, empty-leash photo) | **Accepted** | H8: walkingDogs = min(6, dogsOnFloor); floor = rest over staff − 1; add-ons and cleanliness count every dog present; photo needs ≥ 1 walker; fixtures for 0, 5, 6, 20 dogs in `h08-walk.test.ts`. |
| 8 | Closed days and day boundaries need invented rules; day 5 out of range | **Accepted** | Closed steps fully defined (no draws, no effects, one −10), pickup promotion and plan clearing in the resolution order, terminal state defined as day 5 block 0 done, learner skips closed floor blocks. |
| 9 | No reproducibility contract (PRNG, seed domain, noise, draw consumption) | **Accepted** | mulberry32 and the derivation named in `rng.ts` with reference values pinned in `determinism.test.ts`; seeds 0..2^32−1; noise an integer −n..n drawn once at pickup; projections take no draws; zero-probability incident draw is taken, zero-fraction illness draw is not. |
| 10 | One test per rule cannot pin coefficients | **Already done** | The tests written in this session pin exact numbers (0.02/0.17/0.42/0.90, 0.378, $15/$150/0.10/0.05). Added the cleanliness-30 half-case fixture. Astra read the plan's table, not the test files, which did not exist yet. |
| 11 | Reputation clamp order and rounding undefined | **Accepted** | Sum, clamp once, KPI delta = clamped change (D21); 99 + 3 − 2 = 100 pinned; rounding is half-up. |
| 12 | Readout cannot distinguish requested from resolved activities; avg ratio and pickup values ambiguous | **Accepted** | `DayReport.requested` added; counts use resolved; average ratio is the mean of block ratios over open blocks with dogs; pickup snapshot taken before overnight recovery (`StepResult.pickup`). |
| 13 | Headless contracts undefined (policies, spread, export) | **Accepted** | Section 12 names the four policies by rule (`reckless` literal, `recklessCovered`, `careful`, `random`); spread = sample std and p5/p95; the CLI prints the full config. Export of learner settings is G5's contract, noted for its plan. |

Not reviewed by Astra, by its own account: implementation, Chromebook performance, exhaustive optimality, the
Challenge rules, the classroom instruments. The two intentional deviations from the challenge brief (Profit instead of
Revenue, D8; fixed drop-off activity, D9) were accepted by Astra as decisions.
