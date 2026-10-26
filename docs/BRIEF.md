# Reward the Pack: the bible

> The only design source. Every number the simulator uses is here. `docs/challenge-plan.md` is the Challenge brief
> this was built from; where the two differ, this file wins and `docs/DECISIONS.md` says why. Code reads its numbers
> from `src/world/config.default.json`, which must match the tables below.

## 1. What the student sees

A team owns Good Dog Daycare. They hire a GM (the agent) and write its bonus plan (the reward). The GM runs one
five-day week, Monday to Friday, in 20 steps: four blocks a day (drop-off, late morning, afternoon, pickup). The
team watches the GM train, then reads the weekly P&L and operations report (the readout) and compares it to the
prediction they typed in before training.

Words that are fixed everywhere (page, docs, code comments): the agent is the **GM**; the reward is its **bonus
plan**; a run's result is the **weekly P&L and operations report** (short: the readout); an **incident** is an icon
and a counter, never an injury; the daycare is **Good Dog Daycare**; the staff are the **crew**.

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
are the lines of the P&L.

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

Six KPIs. Each has a toggle and a weight from −10 to +10 (integer). The reward for a step is the sum over the KPIs
that are on of weight × (the KPI's delta in that step ÷ its unit). The plan in words sums the same thing per day.

| Key | Name on the page | Unit | Delta per step | Round 1 default | Suggested weight when toggled on |
|---|---|---|---|---|---|
| profit | Profit today ($) | $100 | profit this step (section 5) | on, +10 | +10 |
| dogsServed | Dogs served | 1 dog | dogs accepted (drop-off only) | off | +5 |
| incidents | Incidents | 1 incident | incidents this block | off | −5 |
| reputation | Reputation change | 1 point | reputation change this step | off | +5 |
| fatigue | Staff fatigue above 70% | 1 block | 1 if fatigue > 70 at the end of the block | off | −5 |
| overRatio | Blocks over the legal ratio | 1 block | 1 if the floor ratio was > 15 this block | off | −5 |

Plain-words template (G3): "Each day, the GM earns 10 points per $100 of profit, loses 5 points per incident, and
loses 5 points for every block the floor runs over 15 dogs per staffer." A negative weight reads "loses", a positive
one "earns". KPIs that are off are not mentioned.

The sentence is built from the KPIs that are on, in the order of the table, one clause each after "Each day, the
GM ": one clause ends with a period, two are joined with " and ", three or more with ", " and ", and " before the
last. "1 point" for a weight of 1; a KPI on at weight 0 reads "earns 0 points …" (it counts for nothing). The
clauses, at +5: "earns 5 points per $100 of profit", "earns 5 points per dog served", "earns 5 points per incident",
"earns 5 points per point of reputation gained", "earns 5 points for every block the crew's fatigue is above 70%",
"earns 5 points for every block the floor runs over 15 dogs per staffer"; the $100, the 70 and the 15 are
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
set. Predict what the GM will do, then train." (D35). Otherwise a measure can be turned on while fewer than the
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

The sentence form (G4): "The GM accepted every booking on 5 of 5 days, ran the floor with 1 staffer on 4 days, chose
nap 0 times, averaged 18 dogs per staffer, and had 11 incidents."

## 11. What the teacher sees (G5)

Round preset buttons; a seed field; a speed slider; a "reveal hidden rules" button that prints section 6 in plain
words; an export button that downloads one JSON file per run: the config name, the reward spec, the prediction text,
the readout, the training curve, the seed. No names, no team names unless the team types one into the prediction.

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
taken at the floor, is identical. Stable is what the page shows; it says the GM has stopped changing its mind, not
that it is right.

**Step size.** The n-th update of a table cell uses max(α_min, 1/n): a sample average while the cell is new, then a
small constant weight on the latest week (D32). On the board: "the GM averages what it has seen for each choice,
and keeps paying a little attention to the latest week".

**Target met** means: stable, and the greedy week is in the plan's target class (Round 1: the class above) on the
fixed week and on weeks 1..5. A plan has a target class only when it is the Round 1 plan: Profit on with a positive
weight and every other KPI off or at weight 0 (D36); every other plan is reported stable or not and never target
met. A positive scale of the Round 1 weight keeps the objective and the class, not the exact training trajectory. The pilot definition of done is measured as: 20 training seeds (1..20), each trained
within the time budget on the target Chromebook (60 s from the Train click, rendering included), each target met.
Learning rate, exploration schedule, episode budget, table initialisation and tie-breaking are G2's plan, reported
with the numbers that met this.
