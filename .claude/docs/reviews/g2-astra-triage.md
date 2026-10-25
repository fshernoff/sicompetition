# G2: Astra's review of the learner diff, triaged

`Tools/Agent/astra.sh -e high` over the staged G2 diff, 2026-10-25. Astra ran lint and the harness on 20 and 40
seeds (20/20 and 39/40: seed 39 stable at 22,000 with the target unmet, which matches the one-in-thirty rate the
result section reports). Eight findings, all accepted.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | High: the browser pilot could count a run as under 60 s when its last slice crossed the deadline and reached stability, and the clock stopped before the final evaluation and redraw | **Accepted** | `runTraining` checks the deadline before starting a slice, stops the clock after the final readout and redraw, and sets `outOfBudget` from the elapsed time alone, done or not. The pilot table's "seconds" is now the rendering-inclusive number section 13 asks for. |
| 2 | Medium: the Node harness could exit 0 after exceeding its training budget | **Accepted** | `targetMet` in `pilot.ts` also requires `elapsedMs ≤ budget`. No deterministic deadline test was added: the step cost is 7 µs and a budget crossing cannot be forced without a fake clock; the page test covers the same rule by measurement. |
| 3 | Medium: the stability key collapsed rates to a unique set, so moving a cheap day between days was not a change of mind | **Accepted** | The outcome class counts open days at each rate (`rateDays`); the key reads `rates=premium×5`; `isRound1Outcome` requires premium on 5 days; bible section 7 says which days is not in the class, how many is; a test pins it. |
| 4 | Low: the moving-average downsampler could draw a column's extremes in the wrong time order | **Accepted** | The column keeps the indices of its lowest and highest value and draws them in index order. |
| 5 | Low: paced training dropped fractional episodes each frame (1,152 a second at 144 Hz) | **Accepted** | The fractional remainder carries across frames; the catch-up cap stays. |
| 6 | Low: the `runFor` test could fail on a fast machine (early completion) or a slow one (400 ms) | **Accepted** | The test uses a configuration that cannot finish and allows 1,000 ms. |
| 7 | Low: "episodes ≤ maxEpisodes" is vacuous; the plan promised 40,000 for seeds 1 to 3 | **Accepted** | The test asserts 40,000 (observed 23,500 to 27,500). |
| 8 | Low: the training e2e did not watch for requests, and the URL check compared prefixes | **Accepted** | Both e2e tests watch requests and compare origins. |

Also from the review, accepted as is: `curve.ts` scans the full history three times per redraw; at the 10 Hz redraw
and the 150,000-episode cap that is 4.5 million index reads a second, well under a millisecond's work on a
Chromebook, so no downsampled cache was added. Astra confirmed the fold of closed days, the terminal target, the
step size, the stream separation, the global episode index, the fixed evaluation week, the stability rule, the
observation indices and the absence of trainer accumulation across pilot seeds.

What Astra says the 20/20 establishes and does not: attainment on the specified Node seeds and six evaluation weeks
each (those seeds also served the tuning, so this is not independent evidence); not the Chromebook gate (acceptance
4, the owner's run), not optimality, not arbitrary seeds (about one in thirty adds a second help day). The result
section says the same.
