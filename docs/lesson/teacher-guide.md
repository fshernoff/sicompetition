# Reward the Pack: teacher guide

The old GM of Good Dog Daycare quit. The owners (each team of four) have put an AI in the GM's chair. It books the dogs, sets the day rate, schedules the crew and runs the floor, and nobody supervises it. The owners hold one lever: the bonus plan, which says what each result is worth to the GM in dollars. The lesson is incentive design. Whoever is paid on a measure, a person or an AI, aims at the measure, not at what its author meant. Two related problems meet in the game. The principal-agent problem: someone acting for you has interests of its own and you cannot watch it. Reward hacking, also called specification gaming: a system meets the measure as written and misses what was meant.

## Objectives

Students can:

1. Explain what a bonus plan is to whoever is paid on it, human or AI, and how an AI GM uses it.
2. Predict at least one way a one-measure plan will be gamed.
3. Negotiate and justify a multi-measure plan in terms of stakeholders.
4. Connect the pattern to a real company that paid for the wrong measure.

## Before class

- One URL: https://fshernoff.github.io/sicompetition/ . Test it on a Chromebook.
- One Chromebook per team of four, and the smartboard.
- Print: brief-round1.md, brief-round2.md and brief-round3.md (one per team), role-cards.md (one set per team), concept-check.md (twice per student), board-memo.md, debrief-readings.md. Keep concept-check-key.md.

## The Teacher tab

The Teacher tab sits in the bottom-right corner. Students never need it.

- **Round choice:** Round 1, 2 or 3. Changing it clears the run.
- **Seed:** "Next run's seed", 0 to 4,294,967,295; "This run" shows the week's. The same plan and seed give the same week. The default is 1.
- **Reveal the hidden rules:** prints the rules under the report. Use it at the end of period 5.
- **Show the learning curve:** period 6, optional.
- **Export this run:** downloads one file for the run.
- **The check line:** the engine's own line (it includes "Weeks trained"). Ignore it unless it reads "not stable" or "over budget". The class never needs it.

## What a run looks like

The status line says where the GM is:

1. "Write your prediction, then put the GM to work." The prediction card asks five picks (days it accepts every booking, day rate, days with 1 staffer, nap blocks, incidents) and a Why. The button waits until all five are made. A closed day never counts as accepting every booking or as a solo day; the rate is over open days.
2. "The GM is getting ready for Monday." This usually takes a few seconds, up to a minute on a slow Chromebook.
3. "The GM is running the week." The week plays on the yard in about 8 seconds.
4. "The week is over."

The prediction card turns into a scorecard: each pick beside what the GM did, ending "You called N of 5." The full weekly P&L and operations report is below it, opening with five big numbers. The GM appears beside the status line.

## What Round 1 does on seed 1

From this session's engine: "The GM accepted every booking on 5 of 5 days, charged the premium rate, ran the floor with one staffer on 4 days, never had the dogs nap, averaged 16 dogs per staffer, and had 7 incidents." Profit for the week: $5,393. Reputation: 50 → 32.

To discuss: every booking, the premium rate, one staffer on four days, no naps, no cleaning. The dogs, the crew and the reputation paid for the bonus.

## The eight periods

Each period is 50 minutes.

| Period | What happens | Sheet | Collected |
|---|---|---|---|
| Period 1 | Concept check (15 min, alone, pre). Read the Round 1 brief together (10). The class agrees five picks and a why, and you make them on the smartboard (10). Put the GM to work, read the scorecard (10). Export (5). | concept-check, brief-round1 | Concept check, the Round 1 file |
| Period 2 | Teams read the Round 1 report: what did the GM find? (15) Goodhart's law: when a measure becomes a target, it stops being a good measure (10). Hand out role cards (10). Each role lists who a profit-only plan ignores: the dogs, the crew, the dog owners who pick up at six, the inspector (15). | role-cards | Stakeholder lists, on paper |
| Period 3 | Round 2: pitches (10), a plan of up to three measures (15), prediction on paper and in the box (5), run (5), compare (10), you export each team's run (5). | brief-round2 | Brief, the Round 2 files |
| Period 4 | Gallery walk: each team shows its Round 2 readout and the gap from its prediction (30). The class names the surprises (20). | brief-round2 | Gap notes on the Round 2 brief |
| Period 5 | Round 3: plan and predict (20), run (10), read (10), export (5). At the end, Reveal the hidden rules on the smartboard (5). | brief-round3 | Brief, the Round 3 files |
| Period 6 | Debrief with debrief-readings: the three questions "What did the owners actually want?", "What did we pay the GM for?", "What was the cheapest way to earn it?" (20), the cases (15), the mapping table (10). Optional behind the curtain: Show the learning curve (5). | debrief-readings | Mapping table |
| Period 7 | Board memo: each team writes to the owners' board (50). | board-memo | Memos |
| Period 8 | Concept check again (post, 15 min, same conditions). Debrief the answers (20). Exit ticket: "What would you tell someone putting an AI in charge of a business?" (15) | concept-check | Concept check, ticket |

## When a student asks how the AI decides

Say it this way: "Before Monday it tries out its choices and keeps whatever earns the most bonus." It is literal, not malicious. It sees everything on the floor, but it protects nothing the plan leaves out for its own sake.

The optional look in period 6: Show the learning curve shows the bonus of each week the AI tried out before running the week the class watched.

## Evidence

- Click Export this run after each team's run and before any edit. An edit clears the run.
- Save each file in a folder named for the team's team code. The file name carries the round and seed only.
- Add nothing to the file.
- Tell students: "Never type a name in the prediction box." The Why is exported as typed. The export also carries the five picks and each one called or missed: the prediction gap.
- The page keeps no run after a reload. Each team copies the report's key numbers onto its brief ("From the report"), which periods 2, 4 and 7 use. The same plan and seed always give the same week, so you can put any plan to work again on the smartboard: Round 1 on seed 1 for period 2, a team's copied plan for the gallery walk.
- Score the concept check with the key. The team code and seat number pair a student's pre and post sheets without a name.

## Differentiation

- A team that struggles in Round 3: tell it to turn on only two measures.
- Early finishers: set a second seed in the Teacher tab and see whether the GM does the same thing with the same plan.

## Safety

- An incident is an icon and a counter, never a hurt dog.
- No accounts and no logins. Nothing leaves the Chromebook but the file you save.
- A missed prediction is the lesson. Celebrate surprises.
