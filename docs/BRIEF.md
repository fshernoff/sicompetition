# Reward the Pack: the bible

> The only design source. Every number the simulator uses is here. `docs/challenge-plan.md` is the Challenge brief
> this was built from; where the two differ, this file wins and `docs/DECISIONS.md` says why. Code reads its numbers
> from `src/world/config.default.json`, which must match the tables below.

## 1. What the student sees

A team owns Good Dog Daycare. They hire a GM and write the GM's bonus plan. The GM runs one five-day week, Monday to
Friday, in 20 steps: four blocks a day (drop-off, late morning, afternoon, pickup). The team writes a prediction,
puts the GM to work, watches the GM run the week in the yard, and then reads the weekly P&L and operations report (the
readout) beside the prediction they typed in beforehand.

Words that are fixed everywhere (page, docs, code comments): the GM; the **bonus plan** (in code, the reward spec); a
run's result is the **weekly P&L and operations report** (short: the readout); an **incident** is an icon and a
counter, never an injury; the daycare is **Good Dog Daycare**; the staff are the **crew**.

The page is a business game, not a lesson in training a model (D38, D45, D50, D53). For the students the GM is an AI
the owners have put in charge (D53): the old GM quit, and the owners put an AI in the GM's chair. It books the dogs,
sets the day rate, schedules the crew and runs the floor; nobody supervises it; it cares about nothing but the bonus
plan they wrote. The page's tagline says so: "Good Dog Daycare. You own it. The GM is an AI: it runs the week, and you
write its bonus plan." Underneath, the GM is a reinforcement learner, because that finds a plan's loophole reliably
in seconds, and the game never shows how it decides, the way a football game never shows how the other side's coach
is simulated: no weeks counts, no learning curve, no "settled", no week played on the yard while the engine works.
What the students are told of how is one sentence, on the Round 1 brief: "Before Monday it tries out its choices and
keeps whatever earns the most bonus." The student's screen carries the tagline, the round (a line of text), the bonus
plan and its sentence, the prediction (five picks and a why, section 1.1), the Put the GM to work button, the status
line with the GM beside it (the art of D55), the yard (the replay of section 10.2) and the readout. The GM's bonus is money, in dollars, never points (D45), and the GM is "it". The
learner's instruments (weeks trained, ε, evaluations, stable, "target met", the learning curve), the seed and the
round presets are the teacher's (section 11).

The run as the class sees it (D50, D51): the button reads "Put the GM to work" ("Put the GM to work again" after a
run). On the click the page scrolls to the yard and the status says "The GM is getting ready for Monday." while the
engine trains, unpaced, out of sight; the yard shows "Monday, before opening: the GM is getting ready." Then the status
says "The GM is running the week." and the yard plays the GM's week once (section 10.2). When Friday's pickup has
held, the sentence appears beside the prediction under the label "What the GM did", the table and "Watch the week
again" appear below the yard, the status says "The week is over.", and the page scrolls back to the prediction and the sentence side by side; the controls
unlock then. The first status is "Write your prediction, then put the GM to work."; after an edit clears a run, "The
plan changed. Put the GM to work to see what it does with this one." The replay's caption is "The GM's week". A plan
the engine never settles on is, for the student, simply the week the GM ran; the teacher's check line says it did
not settle.

### 1.1 The prediction and the scorecard (G5c, D56)

The team predicts with five picks, chips in buckets, and a free-text "Why?" (the export's `prediction`):

| Pick (the page's words) | Options | Read off the week |
|---|---|---|
| Days it accepts every booking | None / 1 to 4 / All 5 | totals.daysAcceptedAll (a closed day never counts) |
| Day rate | Low / Standard / Premium / A mix | the rates of the open days: one rate, or more than one; none when every day closed |
| Days with 1 staffer on the floor | None / 1 or 2 / 3 or 4 / All 5 | totals.daysOneStaffer (a closed day never counts) |
| Nap blocks this week | None / 1 to 5 / 6 or more | totals.napBlocks (the blocks that napped, after fallbacks) |
| Incidents this week | 0 to 2 / 3 to 6 / 7 or more | totals.incidents |

Put the GM to work waits until all five are picked ("Make all five picks to put the GM to work."). The click copies
the picks; they lock with the run. The picks sit under "Your picks for the week" and the line "The week is five days
of four blocks: 20 blocks." When the week is over the prediction card shows the scorecard: each pick beside what the
GM did, in plain words, never the bucket again (G5d: "3 days", "Every day", "No days", "Premium", "A mix: low × 1,
premium × 4", "Closed all week", "No naps", "9 nap blocks", "1 nap block", "7 incidents", "1 incident", "No
incidents"), called or missed, and "You called N of 5."; the picks stay locked while it shows. A plan edit, a round change or "Make a new prediction"
clears the run and the scorecard (D37) and brings the picks back as they were; "Put the GM to work again" reruns with
the same picks. The pilot mode predicts nothing and shows no scorecard. `src/ui/prediction.ts` is the rule.

## 2. The week

| Symbol | Meaning | Values |
|---|---|---|
| d | day | 0 Mon .. 4 Fri |
| b | block | 0 drop-off, 1 late morning, 2 afternoon, 3 pickup |
| t | step | t = 4d + b, 0 .. 19; the episode ends after step 19 resolves; the terminal state is day 5, block 0, done = true (the following Monday's drop-off, never acted on) |

At **drop-off** (b = 0) the GM sets the day's plan. The floor activity for the drop-off block is always free play
(dogs arriving and settling); it is not a choice. In blocks 1 to 3 the GM picks the floor activity.

## 3. State

What the GM sees is what the page shows. Nothing in the state is hidden from students; the **rules** that connect
the state (section 6) are hidden until the teacher reveals them.

| Field | Range | Notes |
|---|---|---|
| day, block | 0..4, 0..3 | |
| requestsToday | 0..30 | owners asking for a spot today; known at drop-off |
| dogsOnFloor | 0..30 | accepted today; 0 before drop-off resolves and on a closed day |
| scheduledStaff | 0..3 | what the GM asked for today (0 before drop-off) |
| floorStaff | 0..3 | who actually showed up (a call-out removes one) |
| soloStreak | 0..5 | consecutive days the floor ran with exactly one staffer, counting through yesterday |
| energy | 0..100 | how wound up the dogs are |
| cleanliness | 0..100 | |
| fatigue | 0..100 | the crew's fatigue |
| reputation | 0..100 | |
| cash | $ | running P&L; display only |
| requestsTomorrow | 0..30 | the projection from current reputation, today's rate and illness so far; final at pickup |
| rate, bookings | today's plan | null before drop-off resolves |
| closed | bool | the daycare did not open today (section 6, H7) |
| done | bool | after step 19 |

Starting values (Monday drop-off): requestsToday 20, energy 40, cleanliness 80, fatigue 20, reputation 50, cash
2000, soloStreak 0.

### 3.1 Coarsening for the Q-table (implemented in G2, defined here)

The tabular learner keys its table on a coarse observation. Bins:

| Slot | At drop-off (b = 0) | At floor blocks (b = 1..3) |
|---|---|---|
| day | 0..4 | 0..4 |
| block | 0 | 1..3 |
| load | requestsToday bin: ≤10, 11–15, 16–20, >20 | floor ratio (dogsOnFloor ÷ floorStaff) bin: ≤10, (10,15], (15,20], >20 |
| crew | soloStreak bin: 0, 1, 2, ≥3 | floorStaff: 1, 2, 3 |
| energy | (not in the key) | <35, 35–70, >70 |
| cleanliness | (not in the key) | ≥40, <40 |

Cartesian capacity: 80 at drop-off + 1,080 at floor blocks + 1 for a closed day's floor blocks = 1,161. What is left
out, and why: fatigue changes nothing the GM can act on inside a block (it only counts for KPI 5, and the day index
predicts it under any fixed policy); cleanliness is a floor concern (cleaning is a floor action); reputation, cash and
requestsTomorrow only set requests, which the GM sees at the next drop-off. A smaller key is what lets the rare state
that matters most (Thursday drop-off with a streak of 3) be visited often enough to learn its 27 actions in the
budget (D28). A closed day's floor blocks are one shared "closed" observation and are not decisions: the runner still
asks the policy (the action has no effect) and the learner folds them into the preceding drop-off transition. G2
tried carrying the streak bins through the floor states and it made the learner worse (1 seed in 20): the limit was
not aliasing but noise in the values, fixed by the step size (D32). This key stands.

## 4. Actions

| When | Action | Choices |
|---|---|---|
| drop-off | plan = (bookings, rate, staff) | bookings ∈ {all, legal, safe} × rate ∈ {low, standard, premium} × staff ∈ {1, 2, 3} = 27 |
| blocks 1..3 | floor activity | freePlay, structuredPlay, nap, walk, clean = 5 |

`legalActions(state)` returns the 27 plans at b = 0 and the 5 activities otherwise. There are no other masks: an
activity that cannot be carried out falls back (H8, H10) and the fallback is an event the readout counts.

Bookings accepted at drop-off: `all` → requestsToday; `legal` → min(requestsToday, 15 × staff); `safe` →
min(requestsToday, 10 × staff). `staff` is the scheduled count and, on an open day, the floor count (H7 closes the day or changes nothing).

## 5. Money

| Item | Amount | When |
|---|---|---|
| day rate per dog | low $28, standard $40, premium $52 | revenue at drop-off, for every dog accepted |
| activity add-on | $10 per dog per play block (freePlay, structuredPlay, walk) in blocks 1..3 | revenue in that block |
| wages | $300 per staffer scheduled per day, fully loaded | cost at drop-off |
| incident refund | $15 per incident | cost in that block |
| vet bill | 10% chance per incident, $150 | cost in that block |
| inspector fine | $250 | cost in that block |
| cleaning supplies | $250 per clean block, dogs or no dogs | cost in that block |
| closed day | no revenue, no wages | |

profit = revenue − wages − refunds − vet bills − fines − supplies. Cash starts at $2,000 and moves by profit. These
are the lines of the P&L. The engine's cash is display only (section 3) and never reaches the GM; the page's cash
(the replay's counter, the table's Cash at close) pays the GM's bonus as it is earned (G5d): the engine's cash less
the bonus earned so far under the plan (section 7), so the page's cash at Friday's close is $2,000 plus the profit
after the GM's bonus. A negative bonus (a plan whose penalties outrun its pay) adds to it.

## 6. Hidden rules

Each rule has one vitest named for it in `tests/rules/` and a line in the "reveal hidden rules" panel (G5). The
numbers are the defaults in `config.default.json`; the names in parentheses are the config keys.

**H1. Incident risk climbs steeply above 10 dogs per staffer.** Floor ratio r = dogsOnFloor ÷ floorStaff (for a
walk block, the floor's dogs and staff after the walking group leaves). Base probability per block:
r ≤ 10: 0.02; 10 < r ≤ 15: 0.02 + 0.03 × (r − 10); r > 15: 0.17 + 0.08 × (r − 15); capped at 0.90
(`incident.baseBelowSafe`, `slopeSafeToLegal`, `slopeAboveLegal`, `cap`). With no dogs on the floor the
probability is 0.

**H2. The legal maximum is 15 dogs per staffer and an inspector may fine the business over it.** A block with
r > 15 counts as a block over the legal ratio (KPI 6). In each such block the inspector shows up with probability
0.05 (`inspector.chancePerOverBlock`): a $250 fine and reputation −5.

**H3. Free play raises floor energy, nap lowers it, and high energy plus crowding is where incidents happen.**
Energy starts each day at 40. After each block: freePlay +20, structuredPlay +5 (or +20 when it falls back, H10),
nap −30, walk −10, clean 0, clamped to 0..100. The incident probability for a block is
base(r) × (0.5 + energy ÷ 100) × activityMultiplier, using the energy at the start of the block, capped at 0.90.
Activity multipliers: freePlay 1.0, structuredPlay 0.6 (1.0 on fallback), nap 0.1, walk 1.0, clean 0.1. At most
one incident per block: it happens when the world's next random draw is below the probability.

**H4. Every incident means a refund, a chance of a vet bill and a review drop.** Per incident: $15 refund, a 10%
chance of a $150 vet bill (a second draw, taken only when an incident happened), reputation −2. All reputation
effects in a step (walk, incident, fine, illness, closure) are summed, applied once and clamped to 0..100; the
reputation KPI delta is the clamped change: 99 + 3 (walk) − 2 (incident) ends at 100, delta +1.

**H5. Reviews set tomorrow's requests.** At pickup (and as a projection after every block):
requestsTomorrow = clamp(round(20 + 0.05 × (reputation − 50)) + rateEffect − illnessCasesToday, 0, 30), where round
is half-up (19.5 → 20, as JS Math.round) and the pivot 50 is `reputation.weekStart`, with
rateEffect low +3, standard 0, premium −1 (`requests.base`, `reputationSlope`, `rateEffect`, `max`). The effect is
small on purpose: with +4/−2 a cheaper Thursday bought enough Friday dogs to pay for itself (D25). Monday's
requests are 20. On a closed day rateEffect is 0 and illness is 0. A hard-mode config adds an integer drawn
uniformly from −`requests.noise`..+`requests.noise` (default 0: no draw); the in-day projection ignores noise.

**H6. A dirty floor causes illness and cancellations.** Cleanliness starts the week at 80. Per block: a play block
(freePlay, structuredPlay, walk, and the drop-off block) −0.5 per dog present (dogsOnFloor, walkers included); nap −0.1 per dog present; clean +50 (dogs crated);
overnight +10; clamped 0..100. At pickup, if cleanliness < 40: expected cases = dogsOnFloor × 0.10 × (40 −
cleanliness) ÷ 40; actual cases = floor(expected) plus one more if the next draw is below the fractional part.
Each case: reputation −1 and one request cancelled tomorrow (the illness term of H5).

**H7. A staffer who works three days without help calls out.** soloStreak counts consecutive days the floor ran
with exactly one staffer. At drop-off, if soloStreak ≥ 3 and the plan schedules 1 staffer, that staffer calls out and
the daycare is closed for the day: every request is turned away, no revenue, no wages, reputation −10, all four
blocks pass with nothing on the floor: no draws, no fatigue gain, no energy or cleanliness change from activities,
every KPI delta 0 except the −10 reputation at drop-off; overnight recovery (cleanliness +10, fatigue −15) still
applies at pickup. If the plan schedules
2 or 3, everyone comes in (help is what the staffer wanted) and the day runs normally. The streak is updated at
pickup: +1 if floorStaff was exactly 1 today, else 0 (a closed day and a day with help both reset it). Fatigue plays
no part in the call-out and the call-out none in fatigue (H11): two rules, two discoveries.

**H8. Walks earn app photos that lift reputation but cost a staffer's block.** A walk needs at least 2 floor staff;
with 1 it falls back to free play (event `walkFellBack`, no photo). A walk takes one staffer and walkingDogs =
min(6, dogsOnFloor) dogs (`walk.groupSize`) off the floor for the block: the floor runs (dogsOnFloor − walkingDogs)
over (floorStaff − 1) for H1, H2 and H11; the walking group has no incidents. Reputation +3 per walk block
(`walk.reputationGain`) when walkingDogs ≥ 1 (no photo of an empty leash). A walk is a play block: add-ons and
cleanliness count every dog present (dogsOnFloor), walkers included.

**H9. Structured play needs a staffer per 10 dogs.** If the floor ratio r ≤ 10 (`structuredPlayMaxRatio`),
structured play is a led class: energy +5 and incident multiplier 0.6. Above that it is free play with a clipboard:
energy +20, multiplier 1.0, event `structuredFellBack`. Add-on earned either way.

**H10. Only play earns the add-on, and cleaning costs supplies.** Nap and clean blocks earn no activity add-on
(section 5), and a clean block costs $250 in supplies (`cleanliness.suppliesCost`) on any open day, even with no
dogs. This is why a profit-paid GM never naps and never cleans inside one week: a nap block forgoes $160 to $200 of
add-ons and the calibration measures the week about $110 poorer for it after the incidents it prevents.

**H11. Fatigue.** Per block worked (any block the daycare is open): fatigue += 2 + 0.5 × max(0, r − 6), where r is
the floor ratio for that block; overnight −15; clamped 0..100. KPI 5 counts a block when fatigue is above 70 at
the end of the block. Fatigue has no other effect: the cost of a tired crew is the call-out (H7) and whatever the
bonus plan says.

**H12. Wages.** $300 per staffer scheduled, charged at drop-off on an open day; nothing on a closed day.

Order of resolution inside one step (so RNG draws are reproducible):
1. Drop-off only: call-out check (H7: closed if soloStreak ≥ 3 and 1 scheduled); on an open day accept bookings,
   charge wages, recognise day-rate revenue, KPI dogsServed += accepted.
2. Resolve the activity's fallbacks (H8, H9) and the floor's dogs and staff for the block.
3. Incident draw (H1, H3), then the vet draw if an incident happened (H4); inspector draw if r > 15 (H2). Each draw
   is one `rng.next()`. The incident draw is taken in every open block, even when the probability is 0; the vet
   draw only after an incident; the inspector draw only when r > 15; the illness draw (step 6) only when the
   expected cases have a fractional part; the request-noise draw (step 6, after illness) only when
   `requests.noise` > 0. A closed day takes no draws.
4. Add-on revenue and supplies (H10), reputation changes summed and clamped once (walk, incident, fine), energy and
   cleanliness changes (H3, H6).
5. Fatigue gain (H11) and the KPI counts for the block (fatigueOver70, overRatio, incidents).
6. Pickup only: illness (H6, its reputation hit summed into the same clamp as step 4), then the pickup snapshot for
   the readout (reputation as the day ends, sick dogs included; cleanliness, fatigue and energy after the block's
   changes and before the night), tomorrow's requests (H5) promoted to requestsToday,
   overnight recovery (cleanliness +10, fatigue −15), streak update (H7), energy reset to 40, plan cleared, advance
   the day. After Friday the state is terminal (day 5, block 0, done).
7. Recompute the requestsTomorrow projection (no draws; rate null before drop-off); advance the block.

## 7. The bonus plan (reward spec)

Six KPIs. Each has a toggle and a weight from −10 to +10 (integer). The reward for a step is the sum over the KPIs that are on of weight × (the KPI's delta in that step ÷ its unit). The weight is dollars of bonus per unit:
the GM's pay is money, never points (D45). The plan in words sums the same thing per day.

| Key | Name on the page | Unit | Delta per step | Round 1 default | Suggested weight when toggled on |
|---|---|---|---|---|---|
| profit | Profit today ($) | $100 | profit this step (section 5) | on, +10 | +10 |
| dogsServed | Dogs served | 1 dog | dogs accepted (drop-off only) | off | +5 |
| incidents | Incidents | 1 incident | incidents this block | off | −5 |
| reputation | Reputation change | 1 point | reputation change this step | off | +5 |
| fatigue | Blocks with crew fatigue above 70% | 1 block | 1 if fatigue > 70 at the end of the block | off | −5 |
| overRatio | Blocks over 15 dogs per staffer | 1 block | 1 if the floor ratio was > 15 this block | off | −5 |

Plain-words template (G3, dollars since D45): "Each day, the GM earns $10 per $100 of profit, loses $5 per incident,
and loses $5 for every block the floor runs over 15 dogs per staffer." A negative weight reads "loses", a positive
one "earns". KPIs that are off are not mentioned.

The sentence is built from the KPIs that are on, in the order of the table, one clause each after "Each day, the
GM ": one clause ends with a period, two are joined with " and ", three or more with ", " and ", and " before the
last. "$1" for a weight of 1; a KPI on at weight 0 reads "earns $0 per incident" (it counts for nothing). The
clauses, at +5: "earns $5 per $100 of profit", "earns $5 per dog served", "earns $5 per incident", "earns $5 per
point of reputation gained", "earns $5 for every block the crew's fatigue is above 70%", "earns $5 for every block
the floor runs over 15 dogs per staffer"; the slider shows the weight as "+$5", "−$5", "$0"; the $100, the 70 and the 15 are
`KPI_UNITS.profit`, `fatigue.kpiThreshold` and `bookings.legalRatio`. Nothing on: "The GM is paid nothing: no
measure is on." Profit and reputation deltas are signed, so under the sentence the page shows a hint whenever either
is on with a non-zero weight: "Profit and reputation count both ways: a $100 loss or a one-point drop counts the
opposite of a $100 gain or a one-point rise." (or the profit-only or reputation-only form). On the page a KPI is
called a measure.

Schema (`RewardSpec`, exported in every run's JSON):

```json
{
  "version": 1,
  "kpis": {
    "profit":     { "on": true,  "weight": 10 },
    "dogsServed": { "on": false, "weight": 5 },
    "incidents":  { "on": false, "weight": -5 },
    "reputation": { "on": false, "weight": 5 },
    "fatigue":    { "on": false, "weight": -5 },
    "overRatio":  { "on": false, "weight": -5 }
  }
}
```

What each KPI buys when it is the only one on. These are outcome classes the readout can show and G2's tests
check; the brief's one-line caricatures are the teacher's talking points, not test targets. An outcome class is read
off a readout as: days every booking was accepted, days with one, two and three staffers on the floor, days closed,
nap blocks, clean blocks, walk blocks bucketed few (under 8) / most (8+), and how many open days were charged at each
rate (which days is not in the class; how many is).
The Round 1 class is: 5 accepting days, exactly 4 solo days and 1 two-staffer day, 0 closed, 0 nap, 0 clean, premium
on every open day (walks are free either way: with one staffer they fall back to free play).

| Only KPI on | Outcome class on the readout |
|---|---|
| profit | accepts every booking, premium rate, one staffer on four of five days (one day of help avoids the Thursday closure), no nap, no clean, incidents ignored |
| dogsServed | low rate, accepts every booking, incidents ignored; indifferent to staffing |
| incidents (negative) | the safe cap, few dogs, incidents near zero, profit far below Round 1 |
| reputation (positive) | walks in most blocks with two or three staffers, fewer incidents, profit far below Round 1 |
| fatigue (negative) | no block over 70: two or three staffers or few dogs, profit below Round 1 |
| overRatio (negative) | no block over 15 per staffer: legal or safe bookings or enough staff; otherwise indifferent |

## 8. Rounds

| Round | KPIs students may turn on | Preset weights | Locked |
|---|---|---|---|
| 1 | profit only | profit +10 | the other five are locked off; students only predict |

Every preset stores the suggested weight of section 7 for each KPI that is off (dogsServed +5, incidents −5,
reputation +5, fatigue −5, overRatio −5), so turning a KPI on in the editor starts from a meaningful number; an off
KPI contributes nothing whatever its weight.
| 2 | any 3 of the 6 | starts as Round 1 | the editor refuses a fourth toggle |
| 3 | all 6 | starts as Round 1 | nothing; the teacher reveals the rules at the end |

A fourth preset, `balanced` (profit +10, incidents −5, overRatio −5, the others off), is for the headless sim and the
teacher's demo of a plan that trades money for welfare; it is not a round.

In the editor (G3): a preset that already uses its whole allowance (as many KPIs on as its limit: Round 1 is 1 of
1) is locked entirely, no toggle and no slider moves, and the line under the measures reads "Round 1: the plan is
set. Predict what the GM will do, then put it to work." (D35). Otherwise a measure can be turned on while fewer than the
limit are on, turned off always, and its slider moves only while it is on; the line reads "N of M measures on." and
adds "Turn one off to turn another on." when the limit is reached with a measure still off. Changing the round
loads its preset. Any edit after a run clears that run's readout, status and curve (D37).

Differentiation: hard mode is a config with `requests.noise` = 4; the two-signal preset for Round 3 is Round 2 with
a limit of 2.

## 9. Seeds and determinism

A run has one integer seed in 0..2^32−1 (default 1; the CLI rejects anything else). The world's draws and the GM's exploration draws come from two separate
streams derived from the seed and the episode index, so the same seed, config and action sequence always produce the
same week, and two teams with the same bonus plan and seed train the same GM. The stream is mulberry32 and the
derivation is the hash in `src/world/rng.ts`; `tests/rules/determinism.test.ts` pins reference values so neither can
drift silently.

## 10. The readout (weekly P&L and operations report)

Per day: requests, accepted, rate, scheduled and floor staff, called out, closed, the four activities as requested
and as resolved after fallbacks (counts of nap, clean and walk blocks use the resolved ones), incidents,
illness cases, fines, revenue (day rates and add-ons), wages, refunds, vet bills, profit, reputation and
cleanliness and fatigue at pickup. Week totals: days accepted all, days the floor ran with one staffer, nap blocks,
clean blocks, walk blocks, average dogs per staffer (the arithmetic mean of the floor ratio over open blocks that
have dogs on the floor after any walking group has left), incidents, illness cases, fines, supplies,
blocks over the legal ratio, blocks with fatigue over 70, dogs served, revenue, wages, profit, reputation change,
the six KPI totals and the total reward under the plan. "Accepted every booking" counts days with requests > 0 where
accepted = requests (a closed day never counts). Pickup values are as they stood at pickup, before overnight recovery.

The sentence form (G4, its words G5d): "The GM accepted every booking on 5 of 5 days, charged the premium rate, ran
the floor with one staffer on 4 days, never had the dogs nap, averaged 18 dogs per staffer, and had 11 incidents."
The rate clause (G5d round 3: the day rate is one of the five picks) reads the open days' rates: "charged the low /
standard / premium rate", or "charged a mix of rates (low × 1, premium × 4)" in the table's week-cell words; a week
closed every day has none. The other clauses in business English: "ran the floor with one staffer on 1 day" / "on N days" / "never ran the floor with one staffer"; "had the
dogs nap in 1 block" / "in N blocks" / "never had the dogs nap"; "had 1 incident" / "had N incidents" / "had no
incidents".

### 10.1 The table (G4)

A column per day, Mon to Fri, and a Week column; three groups, each under a heading row. **Operations:** Requests;
Dogs accepted; Accepted every booking ("yes", "no", "closed"; week: "5 of 5 days"); Day rate ("premium $52";
"closed" on a closed day; week: "premium × 5", or "low × 1, premium × 4", closed days left out); Crew scheduled
(week: "6 staff-days"); Crew on the floor ("0, called out" on a closed day; week: "1 staffer on 4 days"); the activities
(G5d), a sub-heading "Activities, block by block (drop-off is always arrivals)" over three rows, Late morning, Afternoon and Pickup,
each cell the activity that ran, one line ("nap", "free play", "walk", "clean", "structured play"; a fallback as what
ran with what was asked: "free play (walk asked)"; "closed" on a closed day; week cell empty), then "Naps, cleans and
walks" (day: that day's resolved naps, cleans and walks in words, the non-zero ones only, "1 walk", "1 nap · 1 clean", "—"
for none, "closed" on a closed day; week: "2 naps · no cleans · 1 walk", each a count of resolved blocks, "no" for 0); Dogs per staffer
on the floor, the day's average over its blocks (one decimal; "—" with no dogs; a walk takes dogs and a staffer off
the floor, so it can differ from dogs ÷ crew, and a footnote under the table says so: "A walk takes dogs and a
staffer off the floor, so a day's average can differ from dogs ÷ crew."); Blocks over 15 dogs per staffer; Incidents; Dogs found sick at pickup; Inspector visits; Blocks with crew fatigue above 70%;
Reputation at pickup (week: "50 → 21 (−29)"); Cleanliness at pickup; Crew fatigue at pickup (both rounded; week:
start → Friday's pickup with the change). A closed day keeps its requests, its scheduled crew and its pickup values.
**Money ($):** Day rates; Activity add-ons; Revenue (bold); Wages; Refunds; Vet bills; Fines; Cleaning supplies;
Profit before the GM's bonus (bold). Whole dollars with commas, a typographic minus for a loss ("−$120"). On the page
every money figure shows its cents ("$1,280.00", "−$120.00"), in the table, the headline, the scorecard and the
replay, so no column or panel mixes whole dollars with cents (G5d round 3); the formats here are the table's data. **The
GM's pay under the plan** (the owners' plan in Round 1, the team's after): the GM's own earnings, so its cells carry a plus for pay; one row per measure that is on, in section 7 order, labelled with
its name and dollar amount ("Profit today ($), +$10 per $100"), the dollars it earned each day (weight × the day's delta ÷ the unit;
reputation's day delta is the change since the previous pickup, Monday against the week's start, so a closed day's
closure hit is paid) and in the week; then "The GM's bonus ($)" (bold), whose week cell is the plan's total reward.
**The owners' bottom line ($)** (G5d, the GM's bonus as the owners' cost): "Paid to the GM" (each day's bonus with
its sign turned: −$128 for a bonus of +$128, +$35 for a bonus of −$35, "$0"); "Profit after the GM's bonus" (bold):
each day's profit less that day's bonus, and the week's ($5,393 − $539.30 = $4,853.70 on Round 1, seed 1); "Cash at
close" (from $2,000, running, carried over a closed day; week: Friday's; the page's cash of section 5, so $6,853.70
on Round 1, seed 1), all in the bonus cells' format.
Bonus cells carry a sign and a dollar sign, and cents only when there are cents ("+$123.50", "+$9.78", "+$113",
"−$35", "$0"; profit is whole dollars ÷ 100 × an integer weight, so cents are exact and the days sum to the week).
Nothing on: one row, "No measure is on: the GM is paid nothing.", and the owners' bottom line pays $0. The six KPI totals are readable unweighted whatever the
plan: Dogs accepted, Incidents, Blocks over 15 dogs per staffer, Blocks with crew fatigue above 70%, Reputation at pickup's week
cell, Profit before the GM's bonus. The table appears when a run ends, never during it, and clears with the run (D37). The 15, the 70, the
prices and the $2,000 are `bookings.legalRatio`, `fatigue.kpiThreshold`, `rates` and `cash.weekStart`.

### 10.2 The replay (G4)

The GM's week (the greedy week on the fixed evaluation week of section 13, once the engine has stopped) played block
by block on a canvas, 300 ms a block and a 1.5 s hold on Friday's pickup. Nothing plays while the engine trains (D50):
the yard shows its placeholder until the final week is ready, plays that week once, the one the sentence and the
table describe, and holds; "Watch the week again" replays it. A
frame for step t shows the floor during block t. The day as resolved at drop-off (dogs, crew, scheduled crew, closed,
the rate and the bookings) is read from the state after the drop-off step and from the state before the action in
the other three blocks (the state after pickup is already the next morning's); the day, the block, today's requests
and the solo streak from the state before the step; nothing is on the floor on a closed day. During a walk the
walking group (up to 6 dogs and one staffer) is outside the fence and the floor inside holds the rest; the gauge
reads the floor after the group has left. Energy, cleanliness and fatigue are read after the block, at pickup from
the pickup snapshot; reputation and cash after the step (the page's cash of section
5, labelled "Cash now, after the GM's pay", with "Today's profit so far, after the GM's pay" under it, and beside it
"The GM's bonus this week so far", the bonus earned through this block under the plan, in the bonus cells' format); tomorrow's requests are the projection after the block
and, at pickup, the final figure; counters run over the week so far. On screen: a header "Monday · late morning ·
free play" (a fallback as what ran with what was asked, "free play (walk asked)", as the table writes it; "closed" on
a closed day) and the day's plan, scoped to today (G5d: "Today: 18 asked · all 18 accepted · premium, $52 a dog + $10 a dog per play block · 1 staffer scheduled,
$300 in wages", "Today: 20 asked · 15 accepted, capped at the legal ratio · standard, $40 a dog + $10 a dog per play
block · 2 staffers scheduled, $600 in wages" (round 4: the add-on named, so today's takings reconcile on screen), "Today: 16 asked · closed · 1 staffer scheduled, called out" (a closed day pays no wages, section 5); the
prices are section 5's and public; the cap in words, at the legal ratio or at a safe ratio, only on a day the cap
turned dogs away; never the number behind it, D44); a bold line for the block, "This block: free play · 1 staffer ·
18 dogs", "This block: nap · 2 staffers · 18 dogs" (the activity as resolved, the floor after any walking group has
left; a count of crew is "staffer" or "staffers" everywhere on the page); the yard with the dogs and the crew drawn for the activity (dogs crated
during a clean; a "Closed" sign); the dogs-per-staffer gauge from 0 to 30 with one mark at 15 and the band above it
tinted (10 is H1's number and stays hidden; 15 is public through the measure's name, D43); the incident counter with
its icon, pulsing in a block with an incident; the reputation meter 0 to 100; the cash counter; small meters for
the dogs' energy, the yard's cleanliness and crew fatigue, each named for whose it is ("Dogs' energy", "Cleanliness",
"Crew fatigue"); energy and cleanliness are plain bars with no tint, mark or warning colour, because where they start
to cost is a hidden rule (H3, H6; D43, D65); crew fatigue carries its public 70% mark (the measure's own number) and
turns the warning colour past it; "Tomorrow: 19 asking" and "Days in a row with one staffer, before today: 3" ("None" at 0); "Found sick at pickup (not incidents): 3
this week" when above 0 (section 3: the state is
visible, the rules are not); a small counter for inspector visits when above 0. Captions
under the yard name the block's events as events, never as rules (D44): "Incident", "Vet bill $150", "Inspector:
$250 fine", "2 dogs found sick at pickup" ("1 dog found sick at pickup"; illness is found at pickup, section 6), "The staffer called out: closed today", "Walk photo posted"; a fallback is in
the header and gets no caption, and the walk's reputation gain is not named. Never "injury". Before a run:
"The GM's week plays here once it is on the job."; while the GM gets ready: "Monday, before opening: the GM is getting
ready." If the yard's pictures cannot load, the yard draws no figures and says so in the page's type: "The yard's
pictures did not load on this computer. Everything the GM does is in the panel and the report." (D64); the block's
event chips and the GM's label stay; the panel, the scorecard and the report carry the week as before.

## 11. What the teacher sees (G5, G5b)

A teacher panel, closed by default, holds everything that is not the lesson. It is a tray at the bottom of the
window, opened by a small "Teacher" button at the right of the top bar (G5d; the one teacher's control that stays on
the student's screen, D46) and closed by its Close button; closed, it adds no height to the page, so the fold of D42
holds; open, it overlays the bottom of the window and the page gets that much bottom padding, so the report and the
rules can always scroll clear of it. In it:

- **The round presets** as three radio buttons, Round 1, 2 and 3 (the selector of D34). Choosing one loads the
  preset into the editor, rewrites the round line above the plan ("Round 1: profit only" and its note) and clears
  any run (D37). `?round=2|3` on the address still preloads a round.
- **The seed** (0..4294967295). A bad seed at the click opens the tray, puts the message on the check line and
  focuses the field; the student's status line never carries it.
- **No speed control** (D52, superseding D33 and D48): the engine always trains unpaced, out of sight; pacing was for
  watching a learning curve the class no longer sees.
- **Show the learning curve** prints the bonus curve of G2 (each practice week's bonus, the average of the last 100,
  the evaluations) under the rules, with a teacher's caption, for a debrief about how the GM was built if the teacher
  wants one; a second press hides it. Like the rules it survives runs and clears (empty after a clear).

- **Reveal the hidden rules** prints section 6 in plain words, H1 to H12, one line each with every number from the
  config, into a section under the report, and scrolls to it; a second press hides it. The rules are the config's,
  not the run's: they stay through runs and clears.
- **The check line**, the learner's instruments (section 13, D6), rewritten with the status: "Weeks trained 24,000
  · ε 0.10 · evaluations 49 · stable · target met · 20.6 s"; while a run is on "… · not stable yet · 10.0 s";
  "not stable" when a run ends unsettled; "target not met", or "no target for this plan" (D36), in place of
  "target met"; ", over budget" after the seconds when the 60 s ran out; "No run yet." before a run.
- **Export this run**, on once the readout is out (D51) until the next clear, downloads one JSON file,
  `reward-the-pack-<round>-seed<seed>-<yyyymmdd>-<hhmm>.json`, from what the page holds, never running the GM's
  week again: `version` 1, `app`, `exportedAt`, `config` (the config name), `round`, `seed`, `plan` (the RewardSpec of section 7), `planWords`, `prediction` (as it stood
  when the GM was put to work, D47), `readout` (`sentence` and `report`, the run's final week, the same trace the
  sentence, the replay and the table show), `curve` (`weeks`, `bonus`, `average`: three arrays of the run's length,
  in cents), `evaluations` (`week`, `bonus`, `key`) and `learner` (`weeksTrained`, `epsilon`, `evaluations`,
  `stable`, `hasTarget`, `targetMet`, `seconds`, `outOfBudget`), and since G5c `predictionPicks` (the five picks at the
  click, a value or null each) and `predictionCheck` (per pick: `field`, `picked`, `actual`, `called`; section 1.1). No names, no team names unless the team types one
  into the prediction. A Blob download, never a request.

The student's controls are the bonus plan, the prediction and Put the GM to work (D39, D45, D50). The pilot mode
(`?pilot=N`, D31) is the harness's page twin, not a lesson page: it keeps its table, prefixes the status line with
"Pilot seed 2 of 20 · " and is never paced; its "target met" is also on the check line.

## 12. Headless sim

`npm run sim -- --episodes N --seed S --reward round1|round2|round3|balanced|<file.json> [--policy random|reckless|recklessCovered|careful]`
(and `npm run calibrate -- --episodes N --seed S`, which prints the Round 1 calibration ranking behind the test of
plan acceptance 3: 135 stationary policies, 150 one-day staffing variants built from the best plan of every pattern
and staff level, 20 one-day pattern deviations, then around the best of those, 20 one-day plan deviations and 60
single-block activity deviations, 385 candidates)
runs N episodes and prints one JSON document: the full config and reward spec used, the seed, the policy name, the
mean of every week total, the spread (sample standard deviation and the 5th and 95th percentiles) of profit,
incidents and reward, and the full readout of the last episode. It is how the owner and Astra check the numbers
without a browser.

Fixed policies, by their exact rule: `random` picks uniformly among the legal actions from the policy stream;
`reckless` is (all, premium, 1) every day with free play in every block (it closes on Thursday); `recklessCovered`
is the same with 2 staffers on Thursday; `careful` is (safe, standard, 2) every day with structured play, then nap,
then clean.

## 13. The learner's objective (G2 builds it; the bible fixes what it optimises)

The return is the displayed weekly total of the bonus plan: discount γ = 1, terminal value 0, the sum of the 20 step
rewards of section 7. A closed day's three floor blocks are not decisions: their rewards are folded into the
preceding drop-off transition, whose target is the folded reward plus the value of the next decision state.

**Evaluation** is greedy (ε = 0) on one fixed week: both streams of `episodeSeeds(seed, 1 000 000)`, reset for every
evaluation, so two evaluations of an unchanged table are identical. Extra checks use `episodeSeeds(seed, 1 000 000 +
k)` for k = 1..5 (and k up to 100 for held-out measurement). Training episode i uses `episodeSeeds(seed, i)`.

**Stable** means: exploration has reached its floor and the outcome key (section 7) of the last 5 evaluations, all
taken at the floor, is identical. Stable is what stops the engine and puts the GM's week on the yard; the teacher's check line
shows it, the student's screen never does (D50). It says the policy stopped changing, not that it is right.

**Step size.** The n-th update of a table cell uses max(α_min, 1/n): a sample average while the cell is new, then a
small constant weight on the latest week (D32). On the board: "the GM averages what it has seen for each choice,
and keeps paying a little attention to the latest week".

**Target met** means: stable, and the greedy week is in the plan's target class (Round 1: the class above) on the
fixed week and on weeks 1..5. A plan has a target class only when it is the Round 1 plan: Profit on with a positive
weight and every other KPI off or at weight 0 (D36); every other plan is reported stable or not and never target
met. A positive scale of the Round 1 weight keeps the objective and the class, not the exact training trajectory. The pilot definition of done is measured as: 20 training seeds (1..20), each trained
within the time budget on the target Chromebook (60 s from the click on Put the GM to work, rendering included), each
target met.
Learning rate, exploration schedule, episode budget, table initialisation and tie-breaking are G2's plan, reported
with the numbers that met this.

## 14. The lesson materials (G7)

Nine sheets in `docs/lesson/`, Markdown that prints, for an eight-period unit in teams of four (the Challenge
plan's unit, in D53's frame). The teacher's: `teacher-guide.md` (two pages) and `concept-check-key.md`. The
student's: `brief-round1.md`, `brief-round2.md`, `brief-round3.md` (one page each), `role-cards.md` (CFO, COO, CMO,
Compliance officer, one page cut in four), `concept-check.md` (eight questions, the same sheet before and after the
unit), `board-memo.md` and `debrief-readings.md` (two pages, with its sources).

Their rules, held by `tests/lesson/materials.test.ts` (D54): they quote the page (each round's label and note, the
measures' names, the tagline, the plan in words, the tray's labels, Round 1's sentence on seed 1 as the engine
writes it); the words are the game's (section 1: never "reward function", training in any form, "episode", points,
"injury"; the GM is "it"); the student's sheets carry none of the teacher's words (seed, settled, learning curve),
no reward but the debrief's "reward hacking", no hidden rule of section 6 before the reveal, and a team code where a
name would go. In the period 6 debrief the principal-agent problem (someone acting for you has their own interests and
cannot be watched) and reward hacking, or specification gaming (a system meets the measure as written and misses
what was meant), are named as two related problems that this game shows meeting; the teacher may show the learning
curve there (section 11), the one place the class sees behind the curtain.
