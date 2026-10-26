# G4b: Astra's review of the words plan, triaged

`Tools/Agent/astra.sh -e high` over `.claude/docs/plans/g4b-words.md`, the tests already pinned to the new words and
the code to change, 2026-10-26. Astra read the tree a minute before the bible edits landed (a blocked command delayed
them), so its finding 2 was true when written and resolved before the package started. It ran the Round 1 pilot
(20 of 20, G2's counts) and a node probe of the curve's tick labels. 7 findings: 6 accepted, 1 resolved.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | High: the first e2e still asserted the old caption while the words test asserted the new one | **Accepted** | The e2e asserts the new caption. |
| 2 | Medium: the bible and D45 were not in the tree | **Resolved** | They are (sections 1, 7, 8, 10.1, 10.2, 13; D45); the triage records why they were late. |
| 3 | Medium: "The GM's pay under your plan" sits under a profit and a cash line that do not deduct it, so the P&L reads as ambiguous | **Accepted** | The group's heading is "The GM's pay under your plan (the profit above is before this pay)"; the arithmetic is unchanged (deducting the pay would be a mechanics change, out of scope). |
| 4 | Medium: "You never see the GM work" beside a replay that shows it working; "the cheapest way to earn it" implies an effort cost the GM does not have | **Accepted** | The caption reads "You wrote the bonus plan. Watch the GM's bonus climb as it learns how to earn it. Each dot is a week run its current way, nothing new tried." |
| 5 | Medium: whole-number tick labels on a flat curve at zero (an all-off plan) read "0, 0, 0, 1, 1, 1"; adding a dollar sign keeps the duplicates | **Accepted** | `yTickLabel(value, step)` in `curve.ts`, tested: whole dollars with commas and a typographic minus, cents when the step is under a dollar; the x ticks stay plain counts. |
| 6 | Low: "set their weights" in the Round 2 note and "Weight for …" in the sliders' aria labels | **Accepted** | "set their dollar amounts"; aria "Bonus amount for …"; the words test forbids "weight" in the HTML. |
| 7 | Low: the error line appends the raw exception, which can expose implementation names | **Accepted** | "The GM stopped because of a problem. Ask your teacher for help."; the exception goes to `console.error`. |

Astra confirmed: "earns $0 per incident" reads right for a measure on at 0; a negative profit weight reads
"loses $10 per $100 of profit" with the existing "counts both ways" note; reputation's "per point" is the measure's
unit, not a bonus point; no new hidden-rule disclosure in the vocabulary. Not reviewed: the unbuilt implementation,
the browser, the Chromebook, G5.
