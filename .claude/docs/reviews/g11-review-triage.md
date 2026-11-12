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
