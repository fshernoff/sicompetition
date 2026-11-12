# Reward the Pack: the teacher's key

For the teacher only. Read it before period 1, and keep it from students: it gives away the hidden rules.

## The hidden rules

The reveal prints these, with more numbers.

- **H1. Incident risk climbs steeply above 10 dogs per staffer.** Up to 10 dogs per staffer, the chance of an incident in a block is 2 in 100.
- **H2. The legal maximum is 15 dogs per staffer, and an inspector may fine the business over it.** In each such block the inspector shows up with a chance of 5 in 100: a $250 fine and 5 reputation points lost.
- **H3. Free play winds the dogs up, a nap calms them down, and wound-up dogs in a crowd is where incidents happen.** A block's incident chance is the ratio's chance times (0.5 + energy ÷ 100) times the activity: free play 1, structured play 0.6, nap 0.1, walk 1, clean 0.1; never more than 90 in 100, and at most one incident per block.
- **H4. Every incident means a refund, a chance of a vet bill and a review drop.** Each incident costs a $15 refund, a 10 in 100 chance of a $150 vet bill, and 2 reputation points.
- **H5. Reviews set tomorrow's requests.** Monday's requests are 20.
- **H6. A dirty floor causes illness and cancellations.** At pickup, if cleanliness is below 40, dogs are found sick: on average up to 10 in 100 of them when the floor is at its dirtiest, fewer the cleaner it is, with the fraction of a case settled by a draw; each case costs 1 reputation point and cancels 1 request tomorrow.
- **H7. A staffer who works 3 days without help calls out.** A day with help, or a closed day, resets the streak.
- **H8. Walks earn app photos that lift reputation but cost a staffer's block.** Each walk with at least one dog posts a photo worth 3 reputation points.
- **H9. Structured play needs a staffer per 10 dogs.** The add-on is earned either way.
- **H10. Only play earns the add-on, and cleaning costs supplies.** A nap and a clean earn nothing, and a clean costs $250 in supplies on any open day, dogs or no dogs.
- **H11. The crew's fatigue builds with the ratio, and nothing but the bonus plan counts it.** A block that ends above 70 counts for the fatigue measure.
- **H12. Wages are $300 per staffer per day.** Each staffer scheduled costs $300 for the day, charged at drop-off; a closed day pays no wages.

## What the GM tends to do (seed 1)

Measured with `node Tools/balance/probe.ts`; seeds 2 and 3 are alike.

- **Round 1 (profit only).** Every booking, premium, one staffer on 4 days with help on Tuesday, so the lone staffer never calls out. Profit $5,393 before the GM's bonus, 7 incidents, reputation 50 → 32.
- **Profit today ($) and Reputation change (the Round 3 exhibit).** Two staffers every day and a walk in every block: 15 walks, profit $4,678, 2 incidents, reputation 50 → 84, 7 dogs found sick at pickup. Ask: "Reputation went up. Who paid for it? Look at Dogs found sick at pickup." No plan pays directly for a clean floor; the sick dogs cost 7 reputation points and the photos earn 45. Would a person have cleaned?
- **Profit with Incidents or Blocks over 15 dogs per staffer, but not reputation.** Profit +$10, Incidents −$5 and Blocks over 15 −$5: profit $4,704, 2 incidents, one staffer on 2 days, no block over 15, reputation 50 → 42. Reputation falls in every plan like this. Profit with only Incidents −$5 still leaves 12 blocks over 15 dogs per staffer.
- **No profit in the plan.** Reputation change +$5 alone: three staffers every day, walks everywhere, profit $2,746. Incidents −$5 alone: naps and cleans, profit −$322, all 150,000 weeks, then "not stable" on the check line.
- **Naps and cleans.** No plan tried with Profit at +$1 or more has the dogs nap or clean: a second staffer cuts incidents more cheaply. At $0 or below they do: Profit at −$1 alone cleans every block.
- **Same week, different dollars.** Every plan tried with Profit at +$5 to +$10 and Reputation change at +$2 to +$10 gives the walk week, fines or not. With Profit small beside reputation (+$2 against +$10) the GM hires a third staffer. Which measures are in the plan matters more than how much: name it at the gallery walk.

## The check line

It is under Training details in the Teacher tray. The GM stops when it gives the same kind of week on five checks in a row ("stable"; its days may still differ in detail), after 150,000 weeks, or when 60 seconds from the click run out.

- "not stable" without "over budget": it used all 150,000 weeks. Do nothing: the week still counts, and any computer gives the same week for that plan and seed.
- "over budget" with "not stable": a slow computer cut the GM short, so its week may differ from another computer's on the same plan and seed. If two teams on one plan got different weeks, this is why.
- "over budget" with "stable": it finished late; the week is the same.

## Judging "Which rule did your GM find?"

Full credit: a rule from the reveal, tied to a number in the team's own report (H7 with one staffer on four days; H6 with dogs found sick at pickup). Part credit: a rule or a number alone. "Which rule did your plan miss?": a rule whose cost landed on a number the plan did not pay for.

## What kind of SI the GM is

For the debrief: the GM is one kind of SI, built to chase a number and given nothing but the bonus plan. It looks after what the plan leaves out only where that earns bonus. Not every SI is built this way; others can be given rules, and some can guess what was meant. This kind shows the problem most clearly.
