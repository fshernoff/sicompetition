# G2: Astra's review of the plan, triaged

`Tools/Agent/astra.sh -e high`, 2026-10-25. Astra built an in-memory probe of the proposed learner against the real
simulator and reported that only 1 seed in 20 met the target on all six evaluation weeks under the first draft's
settings and key; that number is Astra's, from its probe, not this session's trainer. The G2 harness measures the
real one.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | High: settings unsupported; ε 0.05 retries a drop-off action once per 540 visits; zero init and constant α keep rare states poor | **Accepted** | ε floor 0.1 and decay 10,000; the plan carries a tuning protocol (early stopping off first, then ε floor, decay, α, optimistic init, then the key) and forbids shortening exploration as the first remedy. The main fix is finding 2's key. |
| 2 | High: floor observations omit the streak; Wednesday floor states alias futures with different Thursday closure risk | **Accepted in part** | The bigger problem the probe exposes is the drop-off split: 16 cleanliness × fatigue bins over 27 actions starve Thursday-with-streak-3. The key now drops fatigue everywhere and cleanliness at drop-off (1,161 observations, D28). Carrying the streak through the floor states is the first listed experiment if 20/20 fails; Astra's own probe of it (2/20) says it is not sufficient alone. |
| 3 | High: "unchanged for 5 evaluations" can stop at 2,500 episodes on a wrong policy; walk counts in the key block stability | **Accepted** | Stable needs ε at its floor; target met is separate and checks the fixed week plus five (D29); walks bucketed none/some/most in the key. |
| 4 | High: evaluation index contradiction (1,000,000 vs 1,000,000 + k) | **Accepted** | Every scheduled evaluation resets both streams at 1,000,000; `evaluateOn(k)` is for extra checks (D30); a test repeats an evaluation on an unchanged table and expects equality. |
| 5 | Medium: folding correct at γ = 1, test inadequate | **Accepted** | `trainEpisode` exported with a `Chooser` hook; the test forces a Thursday closure, poisons the sentinel with 999, sets Friday's value to 100 and expects 0 → 10 at α 0.1, and checks the terminal target with α 1. |
| 6 | Medium: identical runs do not prove the invariants | **Accepted** | 10,000 in one call versus 100 × 100, comparing table, visits, curve and evaluations; ε pinned on the global episode index. |
| 7 | Medium: a rising curve admits a wrong GM | **Accepted** | Kept as a presentation check; added the frozen untrained-versus-trained comparison on 100 held-out weeks (+200 reward, target on ≥ 90) and the moving-average arithmetic test. |
| 8 | Medium: `isRound1Outcome` passes a three-staffer help day | **Accepted** | The outcome class now counts two- and three-staffer days; Round 1 requires exactly one two-staffer day and none with three. |
| 9 | Medium: WP3's pilot script was unspecified | **Accepted** | The harness moved to WP1 (it is the tuning instrument) with seeds 1..20, 60 s each, 120 checks, exit codes 0/1/2, and a test. The e2e timeout was already 150 s. |
| 10 | Medium: 40 ms slices and unbounded redraws on a Chromebook | **Accepted** | 10 ms slices, redraw ≤ 10 Hz, curve downsampled to two points per pixel, backing store capped, scalar curve data only, the 60 s measured from the click. |
| 11 | Medium: three manual Chromebook runs are not the 20-seed measurement | **Accepted** | `?pilot=20` page mode (D31) runs the twenty seeds with the real loop and prints the table; the manual runs stay as the usability check. |
| 12 | Low: D3 misattributed | **Accepted** | The plan now cites the brief's risk table for the replay fallback and D3 for the policy-gradient one, and says neither counts as passing. |
