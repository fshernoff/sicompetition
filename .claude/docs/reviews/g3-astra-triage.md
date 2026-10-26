# G3: Astra's review of the editor diff, triaged

`Tools/Agent/astra.sh -e high` over the staged G3 diff, 2026-10-26. Astra ran the Round 1 pilot (20 of 20, every
episode count matching G2's table), the balanced pilot (5 of 5, 23,000 to 35,000, `target n/a`, exit 0; budget and
cap failures exit 1, argument and file failures exit 2), a direct check of the renderer, the hint and the target
derivation over 117,649 weight and toggle combinations including changed config thresholds, a comparison of
default-target and null-target trainers (identical curves and scheduled evaluations), and a search for any editor
path that lets a fractional, out-of-range or fourth Round 2 measure reach the Trainer (none). Lint passed; the build
passed its type check and Vite's temporary config write hit the sandbox. Five findings, all about tests; no
production defect. All five accepted, the last in part.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | Medium: the six-week predicate test compared outcome keys, and all six weeks share the Round 1 key, so a trainer evaluating the fixed week six times would pass | **Accepted** | The predicate records full `WeekReport`s; the test compares each to `evaluate()` and `evaluateOn(1..5)` with `toEqual` and asserts six distinct reports; the refusing predicate's fourth report must equal week 3's. |
| 2 | Medium: the file-versus-preset harness row included the elapsed seconds, a scheduling-dependent number | **Accepted** | The row is compared with the seconds field blanked (its presence and shape are asserted separately) and both exit codes are asserted. |
| 3 | Low: Profit +10 with Incidents −7, −8 or −9 gives the same sentence on seed 1, so the readout alone does not prove the weight; the episode counts differ (28,000, 48,000, 28,500) | **Accepted** | The e2e also asserts the status line's episode count against the node-side twin's. |
| 4 | Low: the disabled-control assertions after a Fast click could race the run's end | **Accepted** | They moved to the paced Round 1 run (about 20 s), which also checks that every control comes back and that Round 1's own lock is what remains. The Fast test checks only the restored state. |
| 5 | Low: no coverage of an unsettled run's label, of clearing after a slider edit and a round change, or of an error path | **Accepted in part** | A seventh e2e trains Incidents alone to the 150,000 cap (2.9 s) and checks "stopped at the episode limit, the GM is still changing its mind", the readout label, and the sentence against a node-side run to the cap; the editor test now clears after a slider edit, trains again, and clears on a round change with the preset reloaded. No error path is forced: the page has no hook for one and adding a test-only hook was not worth it; `showError` and the `finally` are read, not tested. The curve's clearing is not asserted (a canvas). |
