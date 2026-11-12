# G6: the look's deferred findings and the Chromebook window

Nov 12, 2026, branch `g6-fixes` (from `main` at `0b33197`, fast-forwarded to G11's `aa56d50`, plus the tray scroll
fix `f0b8477`). The owner's call (Nov 12): "finish EVERYTHING including merging and preparing the live site"; the
main thread plans and reviews, Opus and Sonnet build. The class test follows, then the submission.

The roadmap's G6 was "fixes from the pilot". The pilot has not run (`Evidence/pilot/pilot-notes.md` is the blank
template), so this group closes what the repo itself says is open: G5d round 4's deferred findings
(`.claude/docs/reviews/g5d-look-rounds.md`), the short Chromebook window (the critic's C4), and Astra's read of G11
(a separate package, `.claude/docs/reviews/g11-astra-triage.md`). The pilot's own fixes become a later group.

## Goal

The page a class opens on Monday has no finding from round 4 left open without a recorded decision, and works in a
1366 × 640 window: the picks and "Put the GM to work" are on screen without scrolling.

## Acceptance

1. Every round 4 medium and low has a row below: fixed, or declined with the decision that covers it.
2. At 1366 × 640 (and 1280 × 640): on load and with the picks made, the five picks and the whole of "Put the GM to
   work" are inside the window; with the scorecard up, "You called N of 5" and the whole of "Put the GM to work
   again"; while the week plays, the status line and all three meters. An e2e pins each, seen failing first.
   The matrix: Round 1 and Round 3 (all six measures on), a Why of about 300 characters, the tray closed. Each
   check asserts `window.scrollY === 0` and the element's whole box inside the window (the picks are made without
   a scrolling click, or the scroll is checked after); the meters are checked at every block of the week.
3. Nothing regresses at 1366 × 768, 1024 × 768 and 1920 × 1080: the existing fold e2e and the tray e2e hold; shots
   of every state at 768 and 640 are read by the main thread and by one fresh reader.
4. The bible first: every changed word is in `docs/BRIEF.md` before its test, and its test fails before the code.
5. No shipped image's bytes change (`tests/art/qa.test.ts` green). No engine or rule change; the pilot stays 20 of 20.
6. `npm test`, `npm run lint`, `npm run build`, `npm run e2e` green on the final tree; `npm run perf` exits
   non-zero past 0 long tasks or 5.2 MB of heap (WP2 adds the thresholds) and its numbers are recorded;
   `npm run pilot -- --seeds 20 --budget 60000` 20 of 20; a sheet that quotes a changed page word changes here.
7. Astra reads the group's diff before the commit; triage in `.claude/docs/reviews/g6-astra-triage.md`.

## The decisions (the main thread's; the packages do not reopen them)

Facts and line numbers are from the recon of Nov 12 (Astra's round 4 text: `Temp/AgentCodex/20261029-132113.md`;
current shots `Temp/shots/recon-768/`, `Temp/shots/640-recon/`).

| # | Finding | Decision |
|---|---|---|
| 1 | Cleanliness at 0% looks neutral (A5, C8) | Fix, amending D65 (new D70): a meter at the bad end of its own scale (energy 0%, cleanliness 0%, crew fatigue 100%) shows its number in `--red-ink` and its track outlined. The ends of a scale are public, so no hidden threshold shows. The report's row stays plain. |
| 2 | The Why helper contradicts itself (A7, C17) | Fix. The helper reads "Optional: your team's reasons, for the debrief." The teacher guide's line 45 is wrong today and becomes "The button waits for the five picks; the Why is optional, and the page keeps it as it stands at the click." |
| 3 | "Put the GM to work again" against "Watch the week again" (A10, C12) | Fix (D71). The yard's button is "Replay the week"; its note "Shows this same week on the yard again. The GM does nothing new." "Put the GM to work again" keeps its words. |
| 4 | The headline wraps (A9, C11) | Fix. A small label "Profit after the GM's bonus" over the amount alone, then the incidents and reputation clauses as now. |
| 5 | The sliders' zero (A6) | Fix. The zero tick stands 4 px taller than the track on every row, in `--ink-2`. Chrome is the target; Firefox must not look broken. |
| 6 | The P&L shows the GM's pay before the owners' result (A8) | Fix (D73, amending D62's order of presentation). On screen the groups read Money, The owners' bottom line, The GM's pay under the plan, Operations. The data order and the export do not change. A rendered test pins the order on screen. |
| 7 | The bar's height changes when the run starts | Fix. 40 px in every phase. |
| 8 | The bonus is "+" in the rail and "−" elsewhere | Decline under D62: the rail's box is the GM's own pay, where the plus stays. Recorded in the ledger. |
| 9 | The day's choices are small grey text | Fix. `--ink`, 15 px; "per play block" does not break. It must not add a line at 1366 × 640. |
| 10 | The report ends with no next step | Fix. A quiet button after the table, "Back to your scorecard ↑", shown only when a scorecard exists (never in `?pilot=N`), cleared with the run; it scrolls to the scorecard and moves focus to `#called-line`. |
| 11 | Costs have no subtotal | Fix. A bold row "Costs before the GM's bonus" after Cleaning supplies: wages, refunds, vet bills, fines and cleaning supplies, for each day and the week, cents as D66. A test holds revenue minus this row equal to profit before the bonus on every day, a closed day and a plan with a negative bonus included. The export is untouched. |
| 12 | "(walk asked)" is unexplained | Fix. A second footnote that covers both cases the report can show ("walk asked", "structured play asked"): "Words in brackets show what the GM asked for; the activity before them is what ran." It says nothing of why (H8 stays hidden). |
| 13 | Two numbered sequences on the first screen | Fix. "What happens next" loses its numerals (plain dots). |
| 14 | Round 3's notice skips setting the plan | Fix. "All six measures are yours: turn on the ones you want and set their dollar amounts. Write your prediction, then put the GM to work." `docs/lesson/brief-round3.md` line 3 changes with it (the test pins the pair). |
| 15 | Dead space: getting ready (M1) and the scorecards | (a) The scorecards: declined for now (the plan review: at 1024 the done layout stacks, long reasons add height, and the scroll landing would move days before a class); stays open in the ledger. (b) Getting ready: fix. "What happens next" sits in the empty column during getting ready, if placement and CSS alone do it; otherwise decline and say why. |
| 16 | The people's ground shadow is a sliver | Fix. `castShadow` widens the contact ellipse for tall sprites; drawn at runtime, no image changes. |
| 17 | Two lines wrap in the rail (M2) | Fix by layout, not words (the plan review: the time scopes "so far" and "this week" keep the two numbers from reading as comparable). Both labels keep the BRIEF's words and sit over their numbers by design, so nothing breaks mid-phrase. |
| 18 | The reasons card is cut while the week plays (M3) | Declined for now (the plan review: a height rule cannot know a team's text fits, and the run phase includes getting ready, where the reasons sit in the rail on purpose); a low, stays open in the ledger. |
| 19 | The fallback yard is two sentences in a large panel (A4) | Decline under D64: a broken device only. Recorded. |
| 20 | The 640 window (C4) | Fix (D72: 1366 × 640 is a supported window). The measured set: the 40 px bar, the one-line Why helper, a shorter Why box under 700 px of height; then the picks' hint, the three meters mid-week (the facts line may sit below the fold at 640) and the scorecard's button. |
| 21 | 640 only: opening then closing the tray leaves the page scrolled 90 px under the bar | Fix in `src/ui/teacher.ts` (`openTray`, `keepClear`, `closeTray`), with an e2e: closing returns the page to where it was before the tray moved it when the reader did not scroll, and keeps a deliberate scroll made while the tray was open (the report, the revealed rules). No blanket reset to the top. |
| 22 | Found by WP1 at 1024 × 768, on the old build too: the report's navy profit tile clips "$4,853.70" to "$4,853.7" | Fix (WP2): the headline tiles' amounts fit their tiles at 1024, 1366 and 1920; an e2e holds each tile's `scrollWidth` within its `clientWidth` at 1024. |
| 23 | After WP1, Round 3's longer notice wraps to two lines at 1366 (about 20 px) | WP2 counts it in row 20's 640 budget; the words stay. |

## Packages

Both run on `g6-fixes` in the main checkout, one after the other (they share `src/style.css` and `src/ui/app.ts`,
and WP2 measures heights on WP1's final words). Each writes the BRIEF and DECISIONS lines for its rows first, then
the failing tests, then the code, and reports the failures it saw.

- **WP1, the words and the report (Opus):** rows 2, 3, 4, 6, 9, 10, 11, 12, 14, and the ledger entries for 8,
  15(a), 18 and 19. Files: `docs/BRIEF.md` (1, 10, 10.1, 10.2), `docs/DECISIONS.md`, `index.html`, `src/ui/app.ts`,
  `src/ui/rail.ts`, `src/ui/report.ts`, `src/ui/roundNotes.ts`, `src/report.css`, `src/style.css`, `tests/ui/`,
  `e2e/` (the scripts that wait on the renamed button), `docs/lesson/brief-round3.md` line 3,
  `docs/lesson/teacher-guide.md` line 45.
- **WP2, the layout and the 640 window (Opus):** rows 1, 5, 7, 13, 15(b), 16, 17, 20, 21, 22, 23. Files: `docs/BRIEF.md`,
  `docs/DECISIONS.md` (D70, D72), `src/style.css`, `src/ui/app.ts`, `src/ui/rail.ts`, `src/ui/teacher.ts`,
  `src/ui/replay.ts` (`castShadow` only), `src/ui/editor.ts`, `index.html`, `tests/ui/`, `e2e/smoke.spec.ts` (the
  640 tests), `e2e/shots.ts` (a 1366 × 640 set), `e2e/perf.ts` (the thresholds). Row 1's test is on the rendered
  meter: the end of a scale entered and left on a reused meter, fatigue's warning above 70% kept.
- **WP-L, Astra on G11 and the sheets (Opus, a worktree; running):** the triage, the fixes inside `docs/lesson/`,
  `docs/evidence/`, `tests/lesson/`, `README.md`, and each sheet's printed page count.
- **WP-S, the submission branch (Opus, after the merge):** `main` merged into `submission` (two conflicts), the
  drafts moved to SI and to D68's frame, the ban extended to `docs/submission/`, `npm run submission:pdf` green.
  The drafts stay off `main`: they carry the owner's placeholders.

## The plan review (Astra, Nov 12)

2 high, 9 medium, all taken; triage in `.claude/docs/reviews/g6-plan-astra-triage.md`. It changed rows 6, 10, 11,
12, 15, 17, 18 and 21, acceptance 2 and 6, and WP2's files.

## Review

The main thread reads each package's diff and the shots at 768 and 640. One fresh Opus reader looks at the final
shots unanchored (regressions were round 4's blockers). Astra reads the group's diff. Then the merge to `main`
(fast-forward) and the push, which deploys; the live page is checked after the workflow.

## What the owner sees

The same page, with: one bar height; "Replay the week"; a scorecard headline that reads in three lines; the report
with the owners' result before the GM's pay, a "Total costs" row and a way back up; red on a meter that has hit the
end of its scale; and the button on screen in a Chromebook window without scrolling.

## Result

(to be written)
