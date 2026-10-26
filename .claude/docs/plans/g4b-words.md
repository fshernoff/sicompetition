# G4b: the owner's words (money and the job, not points and training)

## Goal

The owner's steer after the G4 gate (Oct 26): the page still read like an AI-training class. The content was already
the business (money, the crew, the customers, fines, sick dogs); the wrapper vocabulary was the learner's: points,
practice, test week, training curve, Train. AP Business students care about money and the people, not points. This
group changes words only. The arithmetic, the learner, the seams and every number in every test stay the same; a
point was always a dollar in disguise (10 points per $100 of profit becomes $10 per $100 of profit, the same
number). It goes before G5 because the teacher panel, the export and the 30-second capture all use these words.

## The vocabulary (D45; BRIEF sections 1, 7, 8, 10.1, 10.2, 13 carry it)

| Where | Was | Is |
|---|---|---|
| The plan in words | "earns 10 points per $100 of profit", "loses 5 points per incident", "1 point", "earns 0 points" | "earns $10 per $100 of profit", "loses $5 per incident", "$1", "earns $0 per incident" |
| The slider's value | "+10", "−5", "0" | "+$10", "−$5", "$0" (`signedDollars`) |
| The button | "Train the GM", "Train again" | "Put the GM to work", "Put the GM to work again" |
| The first status | "Write your prediction, then press Train the GM." | "Write your prediction, then put the GM to work." |
| The round notes, the Round 1 lock line, the plan-changed line | "then train it", "then train the GM", "then train.", "Train the GM to see what it does" | "then put it to work", "then put the GM to work", "then put it to work.", "Put the GM to work to see what it does with this one." |
| The status, running | "The GM has practised 12,000 weeks so far and is still changing its mind." | "The GM is 12,000 weeks into the job and still changing how it runs the place." |
| The status, settled | "The GM practised 24,000 weeks and has settled on how it runs the week." | "After 24,000 weeks on the job, the GM has settled into its routine." |
| The status, ended unsettled | "The GM practised 150,000 weeks and is still changing its mind." | "After 150,000 weeks on the job, the GM is still changing how it runs the place." |
| The status, time up | "Time is up: the GM practised 72,000 weeks and is still changing its mind." | "Time is up: after 72,000 weeks on the job, the GM is still changing how it runs the place." |
| The readout label | "The GM's test week", "(still changing its mind)" | "A week the GM's way", "A week the GM's way (not settled yet)" |
| The replay caption | "The GM's test week", "…, as it would run it right now" | "A week the GM's way", "A week the GM's way, right now" |
| The replay placeholder | "The GM's week plays here while it trains." | "The GM's week plays here once it is on the job." |
| The curve's axes | "Weeks of practice", "Bonus points per week" | "Weeks on the job", "The GM's bonus for the week ($)"; the y ticks carry a dollar sign ("$600", "−$200") |
| The curve's legend | "Each practice week", "Average of the last 100 weeks", "Test week" | "Each week on the job", "Average of the last 100 weeks", "A week run its current way" |
| The curve's empty text | "The curve appears here when the GM trains." | "The curve appears here once the GM is on the job." |
| The curve's caption | "Watch the GM get better at earning its bonus. The dots are its test weeks: …" | "You wrote the bonus plan. Watch the GM's bonus climb as it learns how to earn it. Each dot is a week run its current way, nothing new tried." (Astra: the replay shows the GM at work, so not "you never see it work"; the GM maximises its bonus and has no effort cost, so not "the cheapest way") |
| The table's bonus group | "The GM's bonus"; "Profit today ($), +10 per $100"; "Bonus points this week"; "+97.8", "−35", "0" | "The GM's pay under your plan (the profit above is before this pay)" (Astra: the P&L does not deduct it, so the heading says so); "Profit today ($), +$10 per $100"; "Bonus this week ($)"; "+$97.80", "+$113", "−$35", "$0" (`formatBonus`: a sign, a dollar sign, cents only when there are cents) |
| The prediction label | "(write it before you train)" | "(write it before you put the GM to work)" |
| The error line | "Training stopped with an error: <the exception>" | "The GM stopped because of a problem. Ask your teacher for help." (the exception goes to `console.error`, never to the page; Astra) |
| "Weights" in copy | "set their weights" (the Round 2 note), aria "Weight for Profit today ($)" | "set their dollar amounts", aria "Bonus amount for Profit today ($)" (Astra) |
| The curve's y ticks | whole numbers ("0, 0, 0, 1, 1, 1" on a flat curve at zero, where the ticks are 0.2 apart) | `yTickLabel(value, step)`: "$600", "−$200", "$1,500", and cents whenever the step has cents ("$0.20", "$2.50"); the x ticks stay plain counts (Astra) |
| aria labels | "Watch the GM train", "The training curve: …", "The GM's test week, played block by block" | "Watch the GM at work", "The GM's weekly bonus as it learns the job", "A week the GM's way, played block by block" |

Unchanged on purpose: the readout sentence (already the owner's view), the pilot table and its heading (the
teacher's), the title, "Seed" and "Fast (no pacing)" (D39, G5), the ids (`#train` stays `#train`), the words GM,
bonus plan, crew, measure, incident, Good Dog Daycare.

Morale: the crew's state is fatigue and the call-out, which is morale by another name; a separate morale number
would be a mechanics change and waits for after the pilot (the debrief can name it).

## Acceptance

1. `npm test` green: the bonus-plan words, the status sentences, the curve words, the report labels and bonus cells,
   the page's words (`index.html` carries none of: training, practice, practise, test week, points), all seen
   failing first; the numbers in every test unchanged.
2. `npm run e2e` green under 60 s with the new strings (the plan in dollars, the slider values, the button, the status
   forms, the readout label); `npm run pilot -- --seeds 20 --budget 60000` still 20 of 20 with G2's counts (nothing
   in the learner changes); `npm run lint` and `npm run build` clean.
3. Owner gate: Fred reads the page once more and finds no word of the learner's; the bonus plan reads as a pay plan.

## Seams and packages

- The main thread: the bible (sections 1, 7, 8, 10.1, 10.2, 13), D45, this plan, the tests and the e2e, CLAUDE.md's
  words line, the README, `signedDollars` in `src/world/bonusPlan.ts` and `formatBonus` in `src/ui/report.ts` as
  seams (stubs that throw; the old `formatPoints` goes).
- WP1 (Opus): the words in `src/world/bonusPlan.ts` (`describeBonusPlan`, `signedDollars`), `src/ui/editor.ts` (the
  value span and aria-valuetext through `signedDollars`, the lock line), `src/ui/status.ts`, `src/ui/curve.ts`
  (`curveWords`, the y tick labels, the empty text), `src/ui/report.ts` (`formatBonus`, the labels), `src/ui/app.ts`
  (the constants, the button texts, the error line), `src/ui/pilot.ts` (the button text), `src/ui/replay.ts` (the
  placeholder only), `index.html`. No logic changes; every number stays.

## Plan review

Astra (`.claude/docs/reviews/g4b-plan-astra-triage.md`): 7 findings; 6 accepted, 1 already done (the bible had not
been written when it read the tree). The changes: the stale caption assertion in the e2e; the bonus group's heading
says the profit above is before the GM's pay; the caption no longer claims the owner never sees the GM work nor that
the GM finds the "cheapest" way; dollar tick labels with cents on a flat curve; "weights" becomes "dollar amounts";
the error line no longer prints the exception.

## Result (2026-10-26, session 3, after the G4 commit; every number from this session's runs on the owner's Mac)

**Tests.** `npm test`: 30 files, 249 tests, all passing. 28 were seen failing on the stubs and the old words after the
tests were re-pinned (the plan sentences, the status sentences, the curve words, the page's words, the report's
labels and bonus cells); 3 were added during the group (`yTickLabel`, the stylesheet's own text, the caption's new
line) and pinned behaviour as it was built. Every number in every test is unchanged. `npm run lint` exit 0;
`npm run build` clean (63.8 kB of script, 6.1 kB of style).

**Round 1 unchanged.** `npm run pilot -- --seeds 20 --budget 60000`: 20 of 20, the same twenty episode counts as G2
and G4 (24,000 … 22,000; the list is in the G4 result).

**Page.** `npm run e2e`: 7 passed in 29.2 s of Playwright's own time (29.9 s wall clock). Round 1, paced, settled
20,657 ms after the click with the G2 sentence and the status "After 24,000 weeks on the job, the GM has settled into
its routine."; every status write from before the click was in the owner's form with none of the learner's words
and none of the class's (practise, point, train); the edited plan settled at 28,000 weeks; the unsettled plan read
"After 150,000 weeks on the job, the GM is still changing how it runs the place."; the slider values read "+$10",
"−$5", "−$7", "+$3" and the plan in words "Each day, the GM earns $10 per $100 of profit and loses $7 per incident."
The Put the GM to work button's bottom edge is 626 px from the top on load at 1366 wide (604 px in G4: the longer
prediction label and button; the gate is 700).

**What moved.** (1) Astra's plan review (`.claude/docs/reviews/g4b-plan-astra-triage.md`): 7 findings, 6 accepted
(the stale e2e caption; the bonus group's heading says the profit above is before the GM's pay; the caption no
longer says the owner never sees the GM work nor "the cheapest way"; dollar tick labels with cents on a flat curve;
"weights" became "dollar amounts"; the error line no longer prints the exception), 1 resolved (the bible edits had
been delayed by a blocked command). (2) The package (Opus, every student-facing file) landed with no test dispute and
found one student-visible string outside its files, the empty readout's line in `style.css` ("…after training"),
now "…once the GM is on the job." with a test over the stylesheet's `content:` strings; it also found three stale
phrases in the bible, fixed. (3) Astra's diff review (`.claude/docs/reviews/g4b-astra-triage.md`): four findings,
none high; the words guards now read the visible text and the accessible labels and both CSS quote styles, the tick
test covers a $2.50 step, the bible's sections 11 and 13 name the button; the e2e's "same week" gap (it cannot see
the replay's trace) is carried to G5, whose export gives the hook. Astra confirmed no mechanics changed and the
pilot at G2's counts.

**Unchanged on purpose.** The readout sentence, the pilot table and its heading, the title, Seed and Fast (D39, G5),
the ids (`#train`, `#kpi-<key>-weight`), the JSON of the sim and the harness.
