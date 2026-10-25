# G1: Astra's review of the simulator diff, triaged

`Tools/Agent/astra.sh -e high` over the staged G1 diff, 2026-10-25. Astra ran `npm run lint`, a 50-episode sim and
`npm run calibrate`; it could not run `npm test` (its read-only sandbox blocks Vite's temp config write; noted in
`Tools/Agent/CODEX.md`). Eight findings.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | P1: a profit GM can rationally charge low on Thursday (+4 requests Friday × $82 a dog beats the $360 it gives up); hand-calculated net +$43 | **Accepted, confirmed by measurement** | Under the old +4/−2 the search's own best candidate was "low on Thursday" (+$21 over the base). Rate effects are now low +3, premium −1 (D25). The search gained stage D (one-day plan deviations) and stage E (single-block activity deviations) around the final winner, and the test asserts a cheaper rate on any day trails by ≥ $50 (measured $134, out of sample $129). |
| 2 | P1: calibration margins compared unequally optimised policies; staffing variants only from each pattern's best stationary plan; stage C not around the final winner | **Accepted, and it bit** | After D25 the best stationary plan of every pattern became two staffers, so "one staffer with Tuesday help" was never generated and the ranking crowned two staffers walking. Stage B now builds from the best plan of every pattern **and** staff level (150 variants); C, D, E build on the best so far. The misleading "legal bookings" comparator in `calibrate.ts` was replaced by one-day deviations. |
| 3 | P2: the pickup snapshot's reputation is taken after illness, contrary to the bible's step 6 | **Rejected as a code change; the bible was wrong** | The readout's "reputation at pickup" is what the owners see that evening, sick dogs included; the bible's step 6 now says so (D27) and `h06` pins `pickup.reputation` = 48 in the two-case example. |
| 4 | P2: the validator accepts fractional noise, `day1 > max`, a zero energy divisor, `minStaff = 1` | **Accepted** | Integers for requests.*, groupSize, minStaff, soloDaysBeforeCallOut; `day1 ≤ max`; `minStaff ≥ 2`; `soloDaysBeforeCallOut ≥ 1`; `energy.max` and `illness.threshold` positive; `safeRatio ≤ legalRatio`. Seven rejection cases added to `config.test.ts`. |
| 5 | P2: presets store 0 for KPIs that are off, not the bible's suggested weights | **Accepted** | Presets carry +5 / −5 / +5 / −5 / −5 for the off KPIs (D26); the bible's section 8 says so; `config.test.ts` expects them. The sim is unchanged: `rewardFor` ignores off KPIs. |
| 6 | P2: average ratio counts walk blocks with an empty floor as 0 | **Accepted** | `ratiosWithDogs` keeps blocks with dogs on the floor after the walking group leaves; the bible's section 10 defines the denominator that way; `episode-shape` pins 6 dogs, 2 staffers, walks all day → 3.0. |
| 7 | P2: `calibrate.ts` and the search accept an empty or nonsense evaluation | **Accepted** | `calibrate.ts` validates its two flags (exit 2); `evaluateStationaryPolicies` and `scorePolicy` throw on episodes < 1 or a bad seed; tested. |
| 8 | P2: the Round 1 test accepted a Thursday-closing winner ("≥ 4 solo days" includes 5) | **Accepted** | `PolicyScore` carries the readout means (`daysOneStaffer`, `daysClosed`, `daysAcceptedAll`, `napCleanBlocks`); the test asserts exactly 4 solo days, 0 closed, 5 accepting days, 0 nap/clean blocks on the winner's own reports. |

Also from the review: H7's "every KPI delta 0" wording now excepts the −10 reputation at drop-off. Astra found no
wrong hand-calculated expectation in the H1 to H12 tests and confirmed the draw order, the single reputation clamp,
closed-day handling, the terminal state, the report reconciliation and the spread arithmetic.

What this cost: the calibration grew from 205 to 385 candidates (0.9 s), the bible moved one number (D25), and the
plan's acceptance 3 was rewritten to judge the winner on its readouts and its one-decision defections.
