# G6: the group's reviews, triaged (Nov 12, 2026)

Two reads of the built group on `g6-fixes` at `935ce8c`: Astra (`Tools/Agent/astra.sh -e high`) over the diff
`f0b8477...HEAD` (the page, the tests, the e2e, the print tool, the bible), and a fresh Opus reader, shown no plan
and no code, over the 32 shots in `Temp/shots/20261112-134341/` (768, 1024, 1920 and the new 1366 × 640 set).
The main thread re-ran the suite first (708 tests, lint, build, e2e 17 of 17) and read the 640 shots.

## Astra: 0 blocking, 0 high, 2 medium, 3 low

| # | Severity | Finding | Triage |
|---|---|---|---|
| A1 | Medium | `e2e/perf.ts`: the new long-task filter keys on when the sampler notices playback, not the week's first frame, so a task just after the first frame is dropped | Taken: the real boundary recorded, entries kept and classified afterwards, proved with an injected task |
| A2 | Medium | `src/ui/teacher.ts`: equal positions do not prove the reader never scrolled; scroll away and back, then close, snaps to the top | Taken: the reader's scroll tracked apart from the tray's; the e2e covers away-and-back, a resize, the revealed rules, open and close twice |
| A3 | Low | `e2e/perf.ts`: 5.24 MB rounds to 5.2 and passes | Taken: the unrounded heap is compared |
| A4 | Low | The teacher guide's button sentence drops the plan's clause that the page keeps the Why as it stands at the click | Declined: the sheet is at its word limit, and "ask for the Why too" does not contradict the page |
| A5 | Low | The zero tick's test passes with `content: none`; the shadow's tests pass with the old calculation inside `castShadow` | Taken: the rendered pseudo-element in the e2e; `castShadow` driven with a recording context |

Confirmed by Astra with direct checks: the report's order without data mutation; the subtotal's arithmetic on closed
days, supplies and negative bonuses; the reused meter's class removal; the ten sheets' text preserved by the print
renderer; no defect found in the export's order, the scorecard button's lifecycle, the short-height CSS's scope, the
shadow's transforms or the new student wording. Not run by Astra: vitest, the e2e, perf, the pilot, the PDFs.

## The fresh reader: 0 blocking, 0 high, 4 medium, 6 low; every number on every screen reconciles

| # | Severity | Finding | Triage |
|---|---|---|---|
| R1 | Medium | At 640 the Why box is about 48 px: a line of the team's reasons is sliced at its top edge (22, 23, 29) | Taken: a whole number of lines |
| R2 | Medium | Round 3's walk block: the rail says "walk · 1 staffer · 13 dogs" on a day with 2 scheduled, and the scorecard says no day had 1 staffer on the floor (30, 31) | Taken (BRIEF 10.2 first): the line names who is on the floor and who is out walking. Older than G6, and D69 makes the walk week Round 3's common case |
| R3 | Medium-low | At 640 the Why's placeholder loses its last words (22, 29) | With R1 |
| R4 | Medium-low | At 640 the open tray cuts the last line of "What the GM did" (28) | Taken: the tray e2e runs at 640 too |
| R5 | Low | The "70%" mark sits nearer the Cleanliness bar than the Crew fatigue bar | Open, a low: moving it costs height the 640 window does not have |
| R6 | Low | The scorecard has no fatigue row, so a plan that pays on fatigue cannot be checked from it | Declined: the scorecard is the five picks (D56); the report has the row |
| R7 | Low | "Pay", "paid" and "bonus" for one sum | Declined under D62; open for the owner's ear |
| R8 | Low, unsure | "Put the GM to work again" grey in six shots, white in three | Checked: see the result |
| R9 | Low | Below the fold at 640: "What happens next" while getting ready, "Your picks" mid-week | Declined: no control is lost (D72) |
| R10 | Low, unsure | A walking dog at the path's far corner (30) | Declined: a framing nit; the figure and its shadow are whole |

The reader's arithmetic (Round 1, the careful week, the walk week): revenue, costs, profit before and after the
bonus, cash at close, the day columns against the week, and the rail against the report at Wednesday's close all agree.
