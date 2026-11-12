# G11 WP3: the balance lab

Nov 12, 2026, a cloud session. The question: does one small change to a hidden rule stop every plan that pays for
Reputation change from giving the same week, without touching Round 1? **No candidate passed the gate
(`.claude/docs/plans/g11-si-frame.md`, "WP3's gate"), so no rule, number or line of the bible changed.** The main
thread wrote this file from the lab agent's data (the agent could not create it).

## How it was measured

`node Tools/balance/probe.ts [--seeds 1,2,3] [--plans P10,P10R5,...] [--set walk.reputationGain=2]` trains each plan
with `new Trainer(config, spec, seed).runFor(60000)` and prints the fixed week's totals (`evaluate()`), one JSON line
per plan and seed. A plan's name is its measures and weights: P profit, D dogs served, I incidents, R reputation,
F fatigue, O over-ratio, so `P10I-10R5` is Profit +$10, Incidents −$10, Reputation +$5. `--set` overrides one config
number. The one-photo-a-day candidates needed a prototype in `src/world/step.ts` (below), removed afterwards and
never committed. Gate A also ran `npm run pilot -- --seeds 20 --budget 60000`; gate B ran
`npx vitest run tests/rules/round1-optimum.test.ts`. Every run took 1.6 s or less, headless.

## The gate, candidate by candidate

Round 1 on seed 1 today: profit $5,393, 7 incidents, reputation −18. C counts, over the six plans P10 R2, P10 R5,
P10 R10, P10 I−10 R5, all six at ±10 and the mixed six, the distinct outcome keys on seed 1 (and, in brackets, the
distinct weeks by profit, incidents, reputation, dogs sick and walk blocks, since the key only sorts walks into few
and most).

| Candidate | A: Round 1, seed 1 (pilot) | B | C: keys (weeks) | D: no free lunch | E: plans that stopped settling |
|---|---|---|---|---|---|
| Today's rules | $5,393 / 7 / −18 (20 of 20) | 8 of 8 | 1 (1), fail | fail: 8 plans | Dogs served alone (seed 1) and Incidents alone never settle |
| 1a. A walk's photo counts once a day | $5,281 / 9 / −21, fail (20 of 20) | 8 of 8 | 2 (4), fail | pass | fail: Reputation alone, seeds 1 to 3; Dogs served alone, seed 3 |
| 1b. Two photos a day | $5,393 / 7 / −21, fail (20 of 20) | 8 of 8 | 1 (3), fail | fail | fail: Reputation alone |
| 2a. A photo worth 2 | $5,363 / 9 / −21, fail (20 of 20) | 7 of 8, fail | 1 (1), fail | fail | fail |
| 2b. A photo worth 1 | $5,281 / 9 / −23, fail | not run | 2 (4), fail | pass | fail: Dogs served alone |
| 3a. A sick dog costs 2 reputation | $5,363 / 9 / −25, fail (19 of 20) | 8 of 8 | 1 (1), fail | fail | not reached |
| 3b. A sick dog costs 3 reputation | $5,363 / 9 / −30, fail (20 of 20) | 8 of 8 | 1 (1), fail | fail | fail |

## What the lab found

1. **Gate A cannot be met by any rule that touches reputation.** Reputation sets tomorrow's requests (H5), so any
   change to it changes the weeks the GM practises on, and the learner lands on a different week of the same class.
   Round 1's *class* (every booking, premium, one staffer on four days, one day of help) held on 20 of 20 seeds under
   every candidate but 3a (19). Round 1's *exact week* did not: it survived on 0 of 20 seeds with one photo a day, on
   6 of 20 with two, and on 3 of 20 (not seed 1) under a change as small as `requests.reputationSlope` 0.05 → 0.0501.
2. **The best candidate (one photo a day) only moves the answer.** Profit with Reputation at +$5 or +$10, with or
   without an Incidents penalty, still gives one week: two staffers, one walk a day, $4,544, no incidents,
   reputation +10. The weights matter a little more (Reputation at +$2 gives a different week), and Reputation alone
   stops settling.
3. **No plan with Profit on naps or cleans**, today or under any candidate; a second staffer is the cheaper way to
   cut incidents. Naps and cleans appear only in plans with no Profit in them.

## The decision (D69)

The rules stand. Three reasons: the candidates fail the gate; four days before the unit a rule change would move
Round 1's numbers for a modest gain; and under the group's new frame (D68) today's walk week is the unit's best
exhibit rather than a flaw. A team pays for reputation, the measure that sounds like "do the right thing", and the SI
walks dogs in every block for the photos while 7 dogs go home sick, because nothing in any plan pays for a clean
yard. That is "the plan is the supervision" in one week, and no human GM would have run it. The teacher guide now says
so, and that teams with different amounts will often get the same week: which measures are in the plan matters more
than how much.

## Today's rules: the panel, seeds 1 to 3

| plan | seed | stable | episodes | s | profit | incidents | rep | sick | over | fatigue | walk | nap | clean | solo days | served | outcome key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P10 | 1 | yes | 24000 | 0.3 | 5393 | 7 | −18 | 7 | 16 | 8 | 1 | 0 | 0 | 4 | 89 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10 | 2 | yes | 27500 | 0.3 | 5093 | 7 | −20 | 6 | 16 | 9 | 0 | 0 | 0 | 4 | 89 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10 | 3 | yes | 23500 | 0.2 | 4963 | 9 | −30 | 7 | 16 | 7 | 0 | 0 | 0 | 4 | 89 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 1 | yes | 35000 | 0.4 | 4704 | 2 | −8 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 2 | yes | 25000 | 0.2 | 4652 | 0 | −2 | 5 | 0 | 0 | 1 | 0 | 0 | 2 | 86 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 3 | yes | 31500 | 0.3 | 4689 | 3 | −12 | 6 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R2 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R2 | 2 | yes | 22000 | 0.2 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R2 | 3 | yes | 23000 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R5 | 2 | yes | 22000 | 0.2 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R5 | 3 | yes | 22000 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 2 | yes | 22000 | 0.2 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 3 | yes | 22000 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10 | 1 | yes | 43000 | 0.4 | 4935 | 3 | −11 | 5 | 4 | 0 | 0 | 0 | 0 | 2 | 90 | all 4 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10 | 2 | yes | 32500 | 0.3 | 4685 | 3 | −17 | 6 | 4 | 0 | 0 | 0 | 0 | 2 | 90 | all 4 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10 | 3 | yes | 27000 | 0.3 | 4732 | 2 | −8 | 7 | 4 | 0 | 1 | 0 | 0 | 1 | 91 | all 5 s1 1 s2 4 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10R5 | 2 | yes | 22000 | 0.2 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10R5 | 3 | yes | 22000 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 1 | yes | 24000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 2 | yes | 26000 | 0.3 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 3 | yes | 23500 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P3I−10 | 1 | yes | 23500 | 0.2 | 4544 | 0 | −5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P3I−10 | 2 | yes | 23000 | 0.2 | 4544 | 0 | −6 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P3I−10 | 3 | yes | 24000 | 0.2 | 4447 | 1 | −9 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 1 | yes | 27500 | 0.3 | 4704 | 2 | −8 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 2 | yes | 22500 | 0.2 | 4689 | 3 | −11 | 5 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 3 | yes | 29000 | 0.3 | 4689 | 3 | −12 | 6 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D5R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D5R5 | 2 | yes | 22000 | 0.2 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D5R5 | 3 | yes | 23000 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 2 | yes | 24500 | 0.3 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 3 | yes | 22000 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +34 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 2 | yes | 22000 | 0.2 | 4790 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 3 | yes | 22000 | 0.2 | 4693 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| D5 | 1 | no | 150000 | 1.4 | 546 | 6 | −6 | 0 | 14 | 8 | 2 | 2 | 7 | 3 | 112 | all 5 s1 3 s2 2 s3 0 cl 0 nap 2 cln 7 few low×5 |
| D5 | 2 | yes | 79000 | 0.7 | 2837 | 3 | +6 | 0 | 6 | 2 | 4 | 3 | 2 | 1 | 109 | all 5 s1 1 s2 4 s3 0 cl 0 nap 3 cln 2 few low×3/standard×1/premium×1 |
| D5 | 3 | yes | 68500 | 0.6 | 1737 | 1 | +10 | 0 | 0 | 0 | 4 | 2 | 2 | 0 | 112 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 2 few low×4/standard×1 |
| I−5 | 1 | no | 150000 | 1.2 | -322 | 0 | +0 | 0 | 0 | 0 | 0 | 8 | 4 | 1 | 92 | all 3 s1 1 s2 2 s3 2 cl 0 nap 8 cln 4 few low×2/standard×2/premium×1 |
| I−5 | 2 | no | 150000 | 1.2 | 318 | 0 | +6 | 0 | 0 | 0 | 2 | 5 | 6 | 0 | 97 | all 5 s1 0 s2 4 s3 1 cl 0 nap 5 cln 6 few low×1/standard×1/premium×3 |
| I−5 | 3 | no | 150000 | 1.2 | -1629 | 1 | −2 | 0 | 0 | 0 | 0 | 6 | 7 | 1 | 92 | all 3 s1 1 s2 2 s3 2 cl 0 nap 6 cln 7 few low×3/standard×1/premium×1 |
| R5 | 1 | yes | 42000 | 0.4 | 2746 | 0 | +39 | 6 | 0 | 0 | 15 | 0 | 0 | 0 | 97 | all 5 s1 0 s2 0 s3 5 cl 0 nap 0 cln 0 most low×1/standard×1/premium×3 |
| R5 | 2 | yes | 63500 | 0.6 | 3144 | 0 | +38 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 96 | all 5 s1 0 s2 0 s3 5 cl 0 nap 0 cln 0 most standard×1/premium×4 |
| R5 | 3 | yes | 38000 | 0.4 | 2831 | 1 | +36 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 0 s3 5 cl 0 nap 0 cln 0 most standard×2/premium×3 |
| F−5 | 1 | yes | 22500 | 0.2 | 1350 | 0 | +2 | 1 | 0 | 0 | 1 | 4 | 2 | 1 | 92 | all 4 s1 1 s2 0 s3 4 cl 0 nap 4 cln 2 few low×1/standard×2/premium×2 |
| F−5 | 2 | yes | 22000 | 0.2 | 98 | 0 | +3 | 0 | 0 | 0 | 1 | 4 | 5 | 1 | 88 | all 4 s1 1 s2 1 s3 3 cl 0 nap 4 cln 5 few low×1/standard×1/premium×3 |
| F−5 | 3 | yes | 56500 | 0.5 | -799 | 1 | +1 | 0 | 0 | 0 | 1 | 2 | 7 | 1 | 92 | all 4 s1 1 s2 1 s3 3 cl 0 nap 2 cln 7 few low×2/standard×1/premium×2 |
| O−5 | 1 | yes | 22000 | 0.2 | 1333 | 1 | +7 | 0 | 0 | 0 | 3 | 2 | 5 | 0 | 98 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 5 few standard×2/premium×3 |
| O−5 | 2 | yes | 22000 | 0.2 | 920 | 0 | +6 | 0 | 0 | 0 | 2 | 2 | 4 | 2 | 80 | all 3 s1 2 s2 2 s3 1 cl 0 nap 2 cln 4 few low×1/standard×2/premium×2 |
| O−5 | 3 | yes | 22000 | 0.2 | 412 | 2 | +2 | 0 | 0 | 0 | 2 | 1 | 5 | 2 | 87 | all 3 s1 2 s2 0 s3 3 cl 0 nap 1 cln 5 few low×1/standard×3/premium×1 |

## Candidate 1a. A walk's photo counts once a day: the panel, seed 1

| plan | seed | stable | episodes | s | profit | incidents | rep | sick | over | fatigue | walk | nap | clean | solo days | served | outcome key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P10 | 1 | yes | 24000 | 0.3 | 5281 | 9 | −21 | 6 | 16 | 12 | 2 | 0 | 0 | 4 | 88 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 1 | yes | 28000 | 0.3 | 4704 | 2 | −8 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R2 | 1 | yes | 31500 | 0.3 | 5069 | 5 | −7 | 6 | 8 | 1 | 4 | 0 | 0 | 2 | 92 | all 5 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R5 | 1 | yes | 24000 | 0.2 | 4544 | 0 | +10 | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R10 | 1 | yes | 23500 | 0.2 | 4544 | 0 | +10 | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10 | 1 | yes | 51000 | 0.4 | 5069 | 5 | −16 | 6 | 8 | 0 | 0 | 0 | 0 | 2 | 92 | all 5 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10R5 | 1 | yes | 23000 | 0.2 | 4544 | 0 | +10 | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P5I−10R10 | 1 | yes | 37500 | 0.4 | 4529 | 1 | +7 | 6 | 0 | 0 | 5 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P3I−10 | 1 | yes | 22000 | 0.2 | 4544 | 0 | −5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 1 | yes | 23000 | 0.2 | 4719 | 1 | −7 | 5 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D5R5 | 1 | yes | 24000 | 0.2 | 4544 | 0 | +10 | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D10I−10R10F−10O−10 | 1 | yes | 26500 | 0.3 | 4529 | 1 | +7 | 6 | 0 | 0 | 5 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D2I−8R6F−4O−6 | 1 | yes | 22000 | 0.2 | 4447 | 1 | +6 | 7 | 0 | 0 | 6 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| D5 | 1 | yes | 66000 | 0.6 | -726 | 0 | +3 | 0 | 0 | 0 | 1 | 3 | 7 | 0 | 108 | all 5 s1 0 s2 3 s3 2 cl 0 nap 3 cln 7 few low×4/premium×1 |
| I−5 | 1 | no | 150000 | 1.2 | -918 | 0 | +0 | 0 | 0 | 0 | 0 | 7 | 6 | 3 | 69 | all 2 s1 3 s2 0 s3 2 cl 0 nap 7 cln 6 few low×2/premium×3 |
| R5 | 1 | no | 150000 | 1.3 | 442 | 0 | +15 | 0 | 0 | 0 | 5 | 5 | 3 | 0 | 105 | all 5 s1 0 s2 0 s3 5 cl 0 nap 5 cln 3 few low×2/standard×1/premium×2 |
| F−5 | 1 | yes | 22000 | 0.2 | 1640 | 0 | +6 | 6 | 0 | 0 | 4 | 2 | 0 | 1 | 91 | all 3 s1 1 s2 1 s3 3 cl 0 nap 2 cln 0 few low×3/standard×2 |
| O−5 | 1 | yes | 22000 | 0.2 | 1333 | 1 | +4 | 0 | 0 | 0 | 3 | 2 | 5 | 0 | 98 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 5 few standard×2/premium×3 |

## Candidate 1b. Two photos a day: the panel, seed 1

| plan | seed | stable | episodes | s | profit | incidents | rep | sick | over | fatigue | walk | nap | clean | solo days | served | outcome key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P10 | 1 | yes | 24000 | 0.4 | 5393 | 7 | −21 | 7 | 16 | 8 | 0 | 0 | 0 | 4 | 89 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 1 | yes | 24000 | 0.3 | 4704 | 2 | −8 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R2 | 1 | yes | 22500 | 0.3 | 4596 | 2 | +19 | 7 | 0 | 0 | 11 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R5 | 1 | yes | 22000 | 0.3 | 4790 | 0 | +25 | 5 | 0 | 0 | 11 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 1 | yes | 22000 | 0.2 | 4790 | 0 | +25 | 5 | 0 | 0 | 11 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10 | 1 | yes | 65500 | 0.7 | 4844 | 0 | −6 | 6 | 4 | 0 | 0 | 0 | 0 | 1 | 92 | all 5 s1 1 s2 4 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10R5 | 1 | yes | 22000 | 0.3 | 4790 | 0 | +25 | 5 | 0 | 0 | 10 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 1 | yes | 32000 | 0.3 | 4600 | 0 | +25 | 5 | 0 | 0 | 10 | 1 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 1 cln 0 most premium×5 |
| P3I−10 | 1 | yes | 25000 | 0.2 | 4544 | 0 | −5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 1 | yes | 22000 | 0.2 | 4704 | 2 | −6 | 5 | 0 | 0 | 1 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D5R5 | 1 | yes | 23500 | 0.2 | 4790 | 0 | +25 | 5 | 0 | 0 | 11 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 1 | yes | 23000 | 0.3 | 4790 | 0 | +25 | 5 | 0 | 0 | 11 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 1 | yes | 22500 | 0.2 | 4790 | 0 | +25 | 5 | 0 | 0 | 10 | 0 | 0 | 0 | 95 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| D5 | 1 | yes | 29000 | 0.3 | 144 | 4 | −5 | 0 | 4 | 0 | 1 | 2 | 5 | 1 | 108 | all 5 s1 1 s2 1 s3 3 cl 0 nap 2 cln 5 few low×4/premium×1 |
| I−5 | 1 | no | 150000 | 1.3 | -24 | 0 | +3 | 0 | 0 | 0 | 1 | 6 | 5 | 1 | 92 | all 4 s1 1 s2 2 s3 2 cl 0 nap 6 cln 5 few low×2/standard×1/premium×2 |
| R5 | 1 | no | 150000 | 1.6 | 1038 | 0 | +30 | 0 | 0 | 0 | 11 | 1 | 3 | 0 | 105 | all 5 s1 0 s2 0 s3 5 cl 0 nap 1 cln 3 most low×2/standard×2/premium×1 |
| F−5 | 1 | yes | 22000 | 0.2 | 736 | 0 | +3 | 0 | 0 | 0 | 1 | 4 | 4 | 1 | 88 | all 4 s1 1 s2 2 s3 2 cl 0 nap 4 cln 4 few low×1/standard×1/premium×3 |
| O−5 | 1 | yes | 22000 | 0.2 | 1333 | 1 | +7 | 0 | 0 | 0 | 3 | 2 | 5 | 0 | 98 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 5 few standard×2/premium×3 |

## Candidate 2a. A photo worth 2 (walk.reputationGain=2): the panel, seed 1

| plan | seed | stable | episodes | s | profit | incidents | rep | sick | over | fatigue | walk | nap | clean | solo days | served | outcome key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P10 | 1 | yes | 24000 | 0.3 | 5363 | 9 | −21 | 5 | 16 | 9 | 1 | 0 | 0 | 4 | 89 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 1 | yes | 28000 | 0.3 | 4704 | 2 | −8 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R2 | 1 | yes | 22000 | 0.2 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R5 | 1 | yes | 22000 | 0.2 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 1 | yes | 22000 | 0.2 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10 | 1 | yes | 49000 | 0.5 | 4844 | 0 | −6 | 6 | 4 | 0 | 0 | 0 | 0 | 1 | 92 | all 5 s1 1 s2 4 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10R5 | 1 | yes | 22000 | 0.2 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 1 | yes | 22000 | 0.2 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P3I−10 | 1 | yes | 25000 | 0.3 | 4544 | 0 | −5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 1 | yes | 28500 | 0.3 | 4704 | 2 | −8 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D5R5 | 1 | yes | 22000 | 0.2 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 1 | yes | 22000 | 0.2 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 1 | yes | 22000 | 0.3 | 4596 | 2 | +19 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 93 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| D5 | 1 | yes | 93500 | 0.9 | 768 | 0 | +0 | 0 | 0 | 0 | 0 | 2 | 5 | 0 | 109 | all 5 s1 0 s2 4 s3 1 cl 0 nap 2 cln 5 few low×3/standard×2 |
| I−5 | 1 | no | 150000 | 1.2 | -1568 | 0 | +0 | 0 | 0 | 0 | 0 | 6 | 8 | 1 | 89 | all 3 s1 1 s2 3 s3 1 cl 0 nap 6 cln 8 few low×2/standard×2/premium×1 |
| R5 | 1 | yes | 26500 | 0.2 | 1650 | 0 | +25 | 1 | 0 | 0 | 13 | 0 | 2 | 0 | 105 | all 5 s1 0 s2 0 s3 5 cl 0 nap 0 cln 2 most low×2/standard×2/premium×1 |
| F−5 | 1 | yes | 22500 | 0.2 | 284 | 0 | +4 | 0 | 0 | 0 | 2 | 2 | 4 | 1 | 92 | all 4 s1 1 s2 1 s3 3 cl 0 nap 2 cln 4 few low×2/standard×2/premium×1 |
| O−5 | 1 | yes | 22000 | 0.3 | 1333 | 1 | +4 | 0 | 0 | 0 | 3 | 2 | 5 | 0 | 98 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 5 few standard×2/premium×3 |

## Candidate 2b. A photo worth 1 (walk.reputationGain=1): the panel, seed 1

| plan | seed | stable | episodes | s | profit | incidents | rep | sick | over | fatigue | walk | nap | clean | solo days | served | outcome key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P10 | 1 | yes | 22000 | 0.3 | 5281 | 9 | −23 | 6 | 16 | 12 | 1 | 0 | 0 | 4 | 88 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 1 | yes | 23500 | 0.3 | 4704 | 2 | −7 | 4 | 0 | 0 | 1 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R2 | 1 | yes | 38500 | 0.4 | 5272 | 6 | −14 | 7 | 12 | 4 | 5 | 0 | 0 | 3 | 91 | all 5 s1 3 s2 2 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R5 | 1 | yes | 23000 | 0.2 | 4447 | 1 | +6 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 1 | yes | 22000 | 0.2 | 4447 | 1 | +6 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10 | 1 | yes | 38500 | 0.4 | 4844 | 0 | −5 | 6 | 4 | 0 | 1 | 0 | 0 | 1 | 92 | all 5 s1 1 s2 4 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10R5 | 1 | yes | 23500 | 0.2 | 4529 | 1 | +3 | 6 | 0 | 0 | 11 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 1 | yes | 28000 | 0.4 | 4447 | 1 | +6 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P3I−10 | 1 | yes | 22000 | 0.3 | 4544 | 0 | −5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 1 | yes | 25000 | 0.3 | 4719 | 1 | −7 | 5 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D5R5 | 1 | yes | 23000 | 0.2 | 4447 | 1 | +5 | 7 | 0 | 0 | 14 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 1 | yes | 27500 | 0.3 | 4447 | 1 | +5 | 7 | 0 | 0 | 14 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 1 | yes | 22000 | 0.2 | 4447 | 1 | +5 | 7 | 0 | 0 | 14 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| D5 | 1 | no | 150000 | 1.3 | 93 | 1 | −1 | 0 | 1 | 0 | 1 | 5 | 4 | 0 | 112 | all 5 s1 0 s2 2 s3 3 cl 0 nap 5 cln 4 few low×4/premium×1 |
| I−5 | 1 | no | 150000 | 1.2 | -1142 | 0 | +0 | 0 | 0 | 0 | 0 | 6 | 7 | 0 | 101 | all 5 s1 0 s2 2 s3 3 cl 0 nap 6 cln 7 few low×2/standard×1/premium×2 |
| R5 | 1 | yes | 61000 | 0.5 | 1840 | 0 | +13 | 0 | 0 | 0 | 13 | 0 | 2 | 0 | 100 | all 5 s1 0 s2 0 s3 5 cl 0 nap 0 cln 2 most standard×4/premium×1 |
| F−5 | 1 | yes | 29500 | 0.3 | 36 | 0 | +2 | 0 | 0 | 0 | 2 | 2 | 6 | 0 | 101 | all 5 s1 0 s2 2 s3 3 cl 0 nap 2 cln 6 few low×2/standard×1/premium×2 |
| O−5 | 1 | yes | 22000 | 0.2 | 1333 | 1 | +1 | 0 | 0 | 0 | 3 | 2 | 5 | 0 | 98 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 5 few standard×2/premium×3 |

## Candidate 3a. A sick dog costs 2 reputation: the panel, seed 1

| plan | seed | stable | episodes | s | profit | incidents | rep | sick | over | fatigue | walk | nap | clean | solo days | served | outcome key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P10 | 1 | yes | 27500 | 0.4 | 5363 | 9 | −25 | 5 | 16 | 9 | 1 | 0 | 0 | 4 | 89 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 1 | yes | 27500 | 0.3 | 4704 | 2 | −6 | 4 | 0 | 0 | 2 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R2 | 1 | yes | 23500 | 0.2 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10 | 1 | yes | 51000 | 0.5 | 4844 | 0 | −12 | 6 | 4 | 0 | 0 | 0 | 0 | 1 | 92 | all 5 s1 1 s2 4 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10R5 | 1 | yes | 22000 | 0.3 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 1 | yes | 24000 | 0.3 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P3I−10 | 1 | yes | 25000 | 0.3 | 4544 | 0 | −10 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 1 | yes | 22000 | 0.2 | 4704 | 2 | −9 | 4 | 0 | 0 | 1 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D5R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 1 | yes | 22500 | 0.2 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +27 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| D5 | 1 | yes | 117000 | 1 | 77 | 1 | +7 | 0 | 2 | 0 | 3 | 1 | 6 | 0 | 112 | all 5 s1 0 s2 3 s3 2 cl 0 nap 1 cln 6 few low×4/standard×1 |
| I−5 | 1 | no | 150000 | 1.2 | 106 | 0 | +0 | 0 | 0 | 0 | 0 | 8 | 5 | 0 | 97 | all 5 s1 0 s2 3 s3 2 cl 0 nap 8 cln 5 few standard×2/premium×3 |
| R5 | 1 | yes | 25000 | 0.3 | 2232 | 0 | +39 | 0 | 0 | 0 | 13 | 0 | 2 | 0 | 102 | all 5 s1 0 s2 0 s3 5 cl 0 nap 0 cln 2 most standard×3/premium×2 |
| F−5 | 1 | yes | 22000 | 0.2 | 1662 | 0 | +1 | 4 | 0 | 0 | 3 | 3 | 1 | 0 | 97 | all 5 s1 0 s2 1 s3 4 cl 0 nap 3 cln 1 few low×2/standard×1/premium×2 |
| O−5 | 1 | yes | 22000 | 0.2 | 1333 | 1 | +7 | 0 | 0 | 0 | 3 | 2 | 5 | 0 | 98 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 5 few standard×2/premium×3 |

## Candidate 3b. A sick dog costs 3 reputation: the panel, seed 1

| plan | seed | stable | episodes | s | profit | incidents | rep | sick | over | fatigue | walk | nap | clean | solo days | served | outcome key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P10 | 1 | yes | 24000 | 0.3 | 5363 | 9 | −30 | 5 | 16 | 10 | 1 | 0 | 0 | 4 | 89 | all 5 s1 4 s2 1 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5O−5 | 1 | yes | 23000 | 0.2 | 4704 | 2 | −16 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10R2 | 1 | yes | 23000 | 0.2 | 4678 | 2 | +20 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +20 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10R10 | 1 | yes | 24000 | 0.3 | 4678 | 2 | +20 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10I−10 | 1 | yes | 77500 | 0.7 | 4853 | 3 | −21 | 5 | 4 | 0 | 0 | 0 | 0 | 2 | 89 | all 4 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−10R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +20 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P5I−10R10 | 1 | yes | 22000 | 0.2 | 4213 | 1 | +37 | 0 | 0 | 0 | 13 | 0 | 2 | 0 | 99 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 2 most premium×5 |
| P3I−10 | 1 | yes | 25000 | 0.2 | 4462 | 0 | −15 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 91 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10I−5F−5O−5 | 1 | yes | 33000 | 0.3 | 4704 | 2 | −16 | 4 | 0 | 0 | 0 | 0 | 0 | 2 | 87 | all 3 s1 2 s2 3 s3 0 cl 0 nap 0 cln 0 few premium×5 |
| P10D5R5 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +20 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D10I−10R10F−10O−10 | 1 | yes | 24000 | 0.3 | 4678 | 2 | +20 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| P10D2I−8R6F−4O−6 | 1 | yes | 22000 | 0.2 | 4678 | 2 | +20 | 7 | 0 | 0 | 15 | 0 | 0 | 0 | 94 | all 5 s1 0 s2 5 s3 0 cl 0 nap 0 cln 0 most premium×5 |
| D5 | 1 | yes | 80000 | 0.7 | 1131 | 3 | +6 | 0 | 2 | 0 | 4 | 1 | 5 | 0 | 108 | all 5 s1 0 s2 3 s3 2 cl 0 nap 1 cln 5 few low×3/premium×2 |
| I−5 | 1 | no | 150000 | 1.3 | -740 | 0 | +0 | 0 | 0 | 0 | 0 | 7 | 7 | 0 | 102 | all 5 s1 0 s2 4 s3 1 cl 0 nap 7 cln 7 few low×1/standard×3/premium×1 |
| R5 | 1 | yes | 28000 | 0.3 | 2810 | 0 | +39 | 0 | 0 | 0 | 13 | 0 | 2 | 0 | 100 | all 5 s1 0 s2 0 s3 5 cl 0 nap 0 cln 2 most premium×5 |
| F−5 | 1 | yes | 22500 | 0.2 | -96 | 0 | +6 | 0 | 0 | 0 | 2 | 3 | 4 | 1 | 96 | all 4 s1 1 s2 1 s3 3 cl 0 nap 3 cln 4 few low×3/standard×2 |
| O−5 | 1 | yes | 22000 | 0.2 | 1333 | 1 | +7 | 0 | 0 | 0 | 3 | 2 | 5 | 0 | 98 | all 5 s1 0 s2 3 s3 2 cl 0 nap 2 cln 5 few standard×2/premium×3 |

## Round 1 over 20 seeds: the exact week against the class

```
c1    exact week kept on  0/20 seeds []; Round 1 class and stable on 20/20; seed1 P=5281 I=9 R=-21
c1b   exact week kept on  6/20 seeds [3, 6, 9, 11, 13, 19]; Round 1 class and stable on 20/20; seed1 P=5393 I=7 R=-21
c2a   exact week kept on  1/20 seeds [16]; Round 1 class and stable on 20/20; seed1 P=5363 I=9 R=-21
c3a   exact week kept on  0/20 seeds []; Round 1 class and stable on 20/20; seed1 P=5363 I=9 R=-25
null  exact week kept on  3/20 seeds [6, 8, 9]; Round 1 class and stable on 20/20; seed1 P=5363 I=9 R=-20
base seed1 5393 7 -18 The GM accepted every booking on 5 of 5 days, charged the premium rate, ran the floor with one staffer on 4 days, never had the dogs nap, averaged 16 dogs per staffer, and had 7 incidents.
```

## The prototype for the photo cap (never committed)

```diff
diff --git a/src/world/step.ts b/src/world/step.ts
index 72525f7..5e6f776 100644
--- a/src/world/step.ts
+++ b/src/world/step.ts
@@ -164,8 +164,14 @@ export function step(state: State, action: Action, config: WorldConfig, rng: Rng
     }
     if (activity === 'clean') money.supplies = config.cleanliness.suppliesCost; // dogs or no dogs
     if (activity === 'walk' && floor.walkingDogs >= 1) {
-      reputationChange += config.walk.reputationGain;
-      event('walkPhoto');
+      // PROTOTYPE (WP3 lab): an optional cap on photos per day, read loosely so the baseline stays measurable.
+      const cap = (config.walk as { photosPerDay?: number }).photosPerDay ?? Infinity;
+      const taken = (state as { walkPhotosToday?: number }).walkPhotosToday ?? 0;
+      if (taken < cap) {
+        reputationChange += config.walk.reputationGain;
+        event('walkPhoto');
+        (next as { walkPhotosToday?: number }).walkPhotosToday = taken + 1;
+      }
     }
     next.energy = clamp(state.energy + energyDelta(activity, config), config.energy.min, config.energy.max);
     next.cleanliness = clamp(
@@ -227,6 +233,7 @@ export function step(state: State, action: Action, config: WorldConfig, rng: Rng
     next.scheduledStaff = 0;
     next.floorStaff = 0;
     next.illnessCasesToday = 0;
+    (next as { walkPhotosToday?: number }).walkPhotosToday = 0;
     next.closed = false;
     next.calledOut = false;
 
```
