# G6 plan: Astra's review, triaged (Nov 12, 2026)

`Tools/Agent/astra.sh -e high` over `.claude/docs/plans/g6-fixes.md`, the bible's sections it touches and the page's
source. 0 blocking, 2 high, 9 medium. All taken; the plan carries the changes.

| # | Severity | Finding | Triage |
|---|---|---|---|
| 1 | High | Row 21 omits `src/ui/teacher.ts`, which owns the tray's scroll hand-over; a blanket reset to the top would regress closing the tray while reading the report or the revealed rules | Taken: the file added; the fix restores the untouched position and keeps a deliberate scroll |
| 2 | High | The 640 gate names no round, Why length, tray state or block; Playwright's clicks scroll, so a bounds check alone does not prove "without scrolling" | Taken: the matrix (Round 1, Round 3 with six measures, a 300-character Why, the tray closed), `scrollY === 0`, whole boxes, the meters at every block |
| 3 | Medium | "Total costs" excludes the GM's pay, so a total is followed by another cost | Taken: "Costs before the GM's bonus", defined, with a reconciliation test |
| 4 | Medium | Row 6 changes D62's presentation without saying so and omits Operations | Taken: D73 amends it; the full order named |
| 5 | Medium | Row 15(a): dropping the minimum height does not put the report's title at the fold at 1024 or with long reasons, and the gate allowed moving navigation to keep tests green | Taken: 15(a) declined for now, open in the ledger |
| 6 | Medium | Row 18: a height rule cannot know a team's reasons fit, and the run phase includes getting ready | Taken: declined for now, open in the ledger as a low |
| 7 | Medium | Row 17: the shorter labels drop "so far" and "this week", which keep the two numbers from reading as comparable | Taken: the words stay; the label sits over its number |
| 8 | Medium | Row 10: `?pilot=N` shows a report with no scorecard | Taken: the button only with a scorecard, cleared with the run, focus moved |
| 9 | Medium | Row 12: the report also shows "(structured play asked)" | Taken: one general footnote |
| 10 | Medium | Rows 1 and 6: the model tests could pass with nothing changed on screen | Taken: rendered assertions; the end of a scale entered and left; fatigue's warning kept |
| 11 | Medium | `npm run perf` enforces nothing; "the pilot stays 20 of 20" names no command | Taken: thresholds in the script; the pilot's command named |

Not reviewed by Astra: the engine, the art, G11's triage, the submission branch, the deploy; no rendered screens.
