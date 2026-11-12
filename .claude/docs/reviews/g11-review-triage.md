# G11: the independent review, triaged

Nov 12, 2026. Astra is not installed in this container, so a fresh Opus reviewer that had not seen the plan's
reasoning read `git diff 0b33197..776da9f` (WP1 and WP2) and every sheet in full, through seven lenses: a student's
single read, the concept check as an instrument, the accuracy of the frame, the project's rules, consistency across
files, the tests, and a judge's cold read. Its checks: `npm test` 626 of 626, `npm run lint` clean. Counts: 0 blocking,
3 high, 7 medium, 6 low. Every finding is taken; the fixes are WP4's.

## High

| # | Finding | Where | Fix |
|---|---|---|---|
| H1 | The concept check never says what an SI is, and the pre-check comes before the Round 1 brief that does; four of eight items turn on the word, so part of any gain would be learning the word. | `concept-check.md` instructions | One line under the instructions: "In these questions, an SI is a computer system that makes the decisions itself." Pinned by a test. |
| H2 | The frame is stated as universal fact: an SI "has none" of a person's brakes, "takes the plan literally", "finds the loophole faster and more completely than a person". True of this game's GM, which is given nothing but a bonus plan; not true of SIs in general, which can be given rules and limits and can be built to infer what was meant. A judge in the field would read it as teaching a misconception and then testing it. | `debrief-readings.md` (a person and an SI on the same plan), `teacher-guide.md` (why this is an SI lesson), the key for Q1, Q2, Q7, BRIEF 14, D68 | Scope every claim to an SI that is given only a bonus plan, like the GM. Add: real SIs can be given rules too, but only the ones the owners write down. "No other instructions" in Q2's stem as in Q1's. "Faster" becomes what the class saw: it found the loophole in one week. |
| H3 | Q1's keyed option restates the stem; Q2's keyed option is the popular picture of a ruthless machine; Q7's stem assumes the answer to Q2. High pre-check scores leave no room to show a gain. | `concept-check.md` Q1, Q2, Q7 | Q1's key reworded so it does not echo the stem; Q2's distractors made as plausible as the key; Q7's stem neutral: what should the owners add to the plan, would a person in that job have needed it written down, and why or why not. |

## Medium

| # | Finding | Fix |
|---|---|---|
| M1 | Q3 option D, "paid only on the staff hours scheduled", reads either way; as pay for few hours it explains one cashier. | "paid for each staff hour scheduled". |
| M2 | Q7's "would never need to tell a person" is contradicted by the unit's own readings (people at Wells Fargo did need telling). | Folded into H3's stem; the key credits "a good salesperson would bring this without being told" and credits a reasoned "a person might need it too". |
| M3 | Case 4 (a school judged on attendance) has no seat for "With an SI in that seat". | "If an SI ran the school ...". |
| M4 | The memo's "Nobody supervises the SI" contradicts asking the owners to check each week, and a test pins it. | "Nobody watches the SI day to day." |
| M5 | The evidence README says the old form is at `5839c16`, which already says SI; a class that sat the pre-check read "AI". | Point to `0b33197` with the command that prints it. |
| M6 | The D68 tests pin whole sentences, so the teacher's ordinary rewording turns the suite red. | Match on the key words of each rule. |
| M7 | The README's lesson section does not carry the frame. | WP2b adds it. |

## Low

"put an SI in its chair" (its points at the old GM): "in the GM's chair". The ban misses "ai" and "Ai", and the
length test never checks the keyed option is not the shortest. "comes from the study of SI" reads oddly. BRIEF 14
still says "D53's frame". The teacher guide's "one day of help" is unexplained. Q8 calls bank staff "the GM".

## Keep (the reviewer's list)

The description "a computer system that makes the decisions itself"; the Round 3 audit question; the "With an SI in
that seat" prompts for cases 1 to 3; the score sheet's `form` column and the rule never to report one gain across
both forms; the option-length test; no concept-check item set in the daycare.

## Nothing found

No hidden rule on a student's sheet before the reveal; no teacher's word on a student's sheet; no "AI" outside cited
titles and company names; the real-company cases and their sources intact; every period's timings add to 50 minutes.

## Round 2 (a second fresh reviewer, on `28b398d`)

It read the nine sheets, BRIEF 1, 7 and 14, D67 to D69, the README and the checklist cold, without the first review.
Counts: 0 blocking, 4 high, 10 medium, 7 low. Fixes are WP5's.

| # | Finding | Call |
|---|---|---|
| H1 | Round 1: the guide has the class agree one set of picks on the smartboard; the Round 1 brief has each team enter its own picks on its own page; the evidence needs each team's picks. A teacher cannot tell which to do. | Taken. One run on the smartboard (the unit's hook); each team circles its own picks on its brief first and marks them against the scorecard's "The GM did"; the briefs are collected as Round 1's prediction evidence. The owner may flip it to a run per team. |
| H2 | "Real SIs can be given other rules too, but only the ones somebody writes down" (the readings, the README) is itself false of SIs in general: some can guess a good deal of what was meant. | Taken: "... and some can guess what was meant, but none of that comes from the bonus plan, and an owner cannot count on it without checking." The guide's fourth point likewise. |
| H3 | Q2 does not say the SI is built to earn as much bonus as it can, so "little changes" is defensible; the premise is only in Q1's stem. | Taken: the premise in Q2's stem. |
| H4 | The guide never tells the teacher the hidden rules; the reveal is first seen live in period 5, yet the teacher judges "Which rule did your GM find?" | Taken, with the judge's point below: a tenth sheet, the teacher's key to the game. |
| M | Q3's "Profits rise" matches the keyed option's "profit". | Taken: "costs fall". |
| M | Q5 (a call centre) and Q8 (a bank) repeat the readings' cases, so a post-check gain may be recall. | Taken: scenarios the unit never uses. |
| M | Q5's rubric splits graders ("go faster" against "rushing"). | Taken. |
| M | Q1's stem gives its key to a careful reader. | Left: the premise must be stated for the item to have one best answer (H3); the short answers carry the gain. |
| M | The role cards already say who a profit-only plan forgets, which is period 2's task. | Taken in the guide: each role finds in the Round 1 report what the plan did to the people it speaks for. |
| M | "Found the loophole in its first week" clashes with the learning curve and with "weeks into the job". | Taken: "found the loophole on its own". |
| M | The check line: the guide says when to notice it, not what to do. | Taken, in the teacher's key: "not stable" needs nothing; "over budget" means a slow computer cut the GM short and its week may differ from another computer's. |
| M | Period 2 reads the Round 1 report, but the page keeps no run after a reload. | Taken: rerun Round 1 on the smartboard (the same seed gives the same week). |
| M | The old concept-check form is not linked from the key. | Taken: the key points to the evidence README's command. |
| M | The Rounds 2 and 3 passage covers only plans with Reputation change on. | Taken, in the teacher's key: the families of plans with this session's numbers. |
| L | "Capped at a safe ratio" gives no number. | Left: D44, the number is a hidden rule. |
| L | Period 6's optional five minutes. | Taken: it comes out of the cases' 15. |
| Judge | The lesson is circular (a learner built to have only the plan shows that an SI has only the plan), and the concept check never measures reading a week for what the plan left out. | Taken: the sheets say the GM is one kind of SI, built to chase a number, where the problem is easiest to see; Q6 becomes an audit item (a small report from a business an SI runs: which number did the plan not pay for, and why did the SI let it get worse); the checklist's objective statement says the same. |

Keep: the Round 3 exhibit and "Who paid for it?"; Q7's rubric; the readings' cases and sources, which check out.
