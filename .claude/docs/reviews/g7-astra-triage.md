# G7: Astra's review of the staged diff, triaged

`Tools/Agent/astra.sh -e high` over `git diff --cached` (the nine sheets, the lesson test, the seam, the tagline and
caption, the bible, the decisions, CLAUDE.md, README), 2026-10-28. Astra ran lint (green) and a node check that
reproduced the Round 1 sentence, $5,393 and 50 → 32; it checked the Wells Fargo and CoastRunners claims against the
CFPB release and OpenAI's account, and all eleven plan-triage entries (the main folds landed). It found no hidden rule
H1 to H12 disclosed on a student sheet. Nine findings: all accepted.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | Medium: Round 2's "a loss counts against" and "a drop counts against" are false under a negative amount (−$10 on profit, −$5 on reputation paid +$15 for a $100 loss and a one-point drop); "a negative amount is a penalty" likewise | **Accepted** | The page's own form: "A loss counts the opposite of a gain.", "A one-point drop counts the opposite of a one-point rise."; Rounds 2 and 3: "A negative amount takes that much away from the GM for each one counted." |
| 2 | Medium: question 8's full credit needs the reading's own answer (accounts nobody asked for) | **Accepted** | The key accepts any linked goal, measure and cheap way to meet the measure while missing the goal; unauthorised accounts are one example, talking customers into accounts they will never use another. |
| 3 | Medium: periods 2, 4 and 7 need reports the page no longer holds after a reload | **Accepted** | Each brief has "From the report: dogs accepted, crew on the floor, incidents, profit, reputation" (tested); the guide says the page keeps no run after a reload, that teams copy the numbers, and that the same plan and seed give the same week, so the teacher can put Round 1 on seed 1 or a team's copied plan to work again on the smartboard. |
| 4 | Medium: Round 1 lists an activity choice for every block; drop-off is always arrivals (sections 2, 4) | **Accepted** | "Then, in the late morning, afternoon and pickup blocks, it decides what the dogs and the crew do on the floor. Drop-off is always arrivals." and the list reads "Late morning, afternoon and pickup". |
| 5 | Medium: "It knows nothing the plan does not pay for" confuses incentives with knowledge | **Accepted** | "It sees everything on the floor, but it protects nothing the plan leaves out for its own sake." |
| 6 | Medium: question 7's Score 1 and Score 0 overlap | **Accepted** | Two parts scored: a fix that addresses the flaw and a plausible risk; both 2, one 1, neither 0; a change that makes the flaw worse earns nothing for the fix; the examples follow the rule. |
| 7 | Low: "any whole number" for the seed; the page takes 0 to 4,294,967,295 | **Accepted** | The guide gives the range. |
| 8 | Low: period 3 still summed to 45 minutes | **Accepted** | Compare is 10 minutes again (the review's own fold had cut it to 5): 10 + 15 + 5 + 5 + 10 + 5 = 50. |
| 9 | Low: the exceptions let "one-point bonuses" through, and "reward hacking" was allowed on every student sheet | **Accepted** | The point exceptions are "point of reputation", "reputation point(s)" and "one-point drop" or "rise" only ("per point" is gone; no sheet used it); "reward hacking" is allowed on `debrief-readings.md` only; the helper's test has the two negative examples ("one-point bonuses", "paid per point"). |

Not reviewed by Astra: the printed pages, the live layout, the classroom timing, the Chromebook, the full text of every
scholarly source.
