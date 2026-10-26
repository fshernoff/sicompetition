# G4b: Astra's review of the words diff, triaged

`Tools/Agent/astra.sh -e high` over the staged G4b diff (21 files against `g4-replay`), 2026-10-26. Astra ran lint
(clean), the Round 1 pilot (20 of 20, every count matching G2), formatting probes over the slider values, signed
cents, comma grouping, zero and fractional ticks (all passed), and in-memory probes of the words guards. It confirmed
that the learner, the simulator, the Trainer, the editor's rules, the report's arithmetic, the replay's frames, the
status's conditions, `clearRun` and the run token are unchanged. Four findings, none high: three accepted, one
accepted in part.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | Medium: the e2e's "same week" check sees `data-week="final"` and drawn pixels, not the replay's trace; a stale yard would pass while the sentence and the table match the twin (predates G4b) | **Accepted in part** | Not closed in a words group: the page has no hook for the trace and `showWeek` is the one function that sets the sentence and the replay together (Astra's own lifecycle probe in G4). Carried to G5 in HANDOFF: the export is the hook (the exported readout must equal the twin's report) and a `data-step` on `#replay` would let the e2e pin the replay's week. |
| 2 | Low: the HTML guard missed "practising", "Watch the GM train" and "Train again"; the CSS guard read single-quoted strings only, so a later double-quoted `content: "Training"` would pass | **Accepted** | The words test checks the visible text (the HTML with its tags stripped) and the accessible labels (aria-label, placeholder, title, alt) for `practi`, `\btrain`, `weight`, `points`, `test week`, the learner's words; ids and classes keep their names (`#train`). The stylesheet test reads both quote styles, pins the readout declaration's text and that it is declared once. |
| 3 | Low: no tick case with a fractional step above a dollar (`niceStep` gives 2.5 for a span of 10 to 12.5); a `step < 1` implementation would pass and print "$3" for $2.50 | **Accepted** | Cases for 2.5, −7.5 and 10 at a 2.5 step; the test and the plan say "cents whenever the step has cents". |
| 4 | Low: BRIEF sections 11 and 13 still named the student's button "Train" | **Accepted** | "Put the GM to work" in both (D39, D45). |

Not reviewed by Astra: browser rendering, screen-reader output, Chromebook performance, G5; it did not run vitest,
Playwright or the build and edited no files.
