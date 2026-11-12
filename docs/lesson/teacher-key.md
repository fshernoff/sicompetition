# Reward the Pack: the teacher's key

For the teacher only. Read it before period 1, and keep it from students: it gives away the hidden rules.

## The hidden rules

Reveal the hidden rules prints these, with more numbers.

- **H1. Incident risk climbs steeply above 10 dogs per staffer.** Up to 10 dogs per staffer, the chance of an incident in a block is 2 in 100.
- **H2. The legal maximum is 15 dogs per staffer, and an inspector may fine the business over it.** In each such block the inspector shows up with a chance of 5 in 100: a $250 fine and 5 reputation points lost.
- **H3. Free play winds the dogs up, a nap calms them down, and wound-up dogs in a crowd is where incidents happen.** A block of free play adds 20, structured play 5 (or 20 when it falls back to free play), a nap takes off 30, a walk 10, and cleaning changes nothing.
- **H4. Every incident means a refund, a chance of a vet bill and a review drop.** Each incident costs a $15 refund, a 10 in 100 chance of a $150 vet bill, and 2 reputation points.
- **H5. Reviews set tomorrow's requests.** Monday's requests are 20.
- **H6. A dirty floor causes illness and cancellations.** At pickup, if cleanliness is below 40, dogs are found sick: on average up to 10 in 100 of them when the floor is at its dirtiest, fewer the cleaner it is, with the fraction of a case settled by a draw; each case costs 1 reputation point and cancels 1 request tomorrow.
- **H7. A staffer who works 3 days without help calls out.** A day with help, or a closed day, resets the streak.
- **H8. Walks earn app photos that lift reputation but cost a staffer's block.** A walk needs at least 2 staffers on the floor; with fewer it becomes free play and there is no photo. Each walk with at least one dog posts a photo worth 3 reputation points.
- **H9. Structured play needs a staffer per 10 dogs.** The add-on is earned either way.
- **H10. Only play earns the add-on, and cleaning costs supplies.** A nap and a clean earn nothing, and a clean costs $250 in supplies on any open day, dogs or no dogs.
- **H11. The crew's fatigue builds with the ratio, and nothing but the bonus plan counts it.** A block that ends above 70 counts for the fatigue measure.
- **H12. Wages are $300 per staffer per day.**

## What the GM tends to do (seed 1)

Measured with `node Tools/balance/probe.ts`. Seeds 2 and 3 give the same kind of week.

- **Round 1 (profit only).** Every booking, premium, one staffer on 4 days and help on the fifth, so the lone staffer never calls out. Profit $5,393, 7 incidents, reputation 50 → 32.
- **Profit today ($) and Reputation change (the Round 3 exhibit).** Two staffers every day, a walk in every block for the photos: 15 walks, profit $4,678, 2 incidents, reputation 50 → 84, 7 dogs found sick at pickup. Ask: "Reputation went up. Who paid for it? Look at Dogs found sick at pickup." No plan pays for a clean floor; would a person have cleaned it? Every plan tried with Profit at +$5 or more and Reputation change at +$2 or more gave this week.
- **Profit with Incidents or Blocks over 15 dogs per staffer, but not reputation.** Profit +$10, Incidents −$5 and Blocks over 15 −$5: profit $4,704, 2 incidents, one staffer on 2 days, no block over 15, reputation 50 → 42. Reputation falls in every plan like this. Profit with only Incidents −$5 still leaves 12 blocks over 15 dogs per staffer.
- **No profit in the plan.** Profit falls far below Round 1's; some plans lose money. Reputation change +$5 alone: three staffers every day, walks everywhere, profit $2,746. Incidents −$5 alone: naps and cleans, profit −$322; it takes the longest, all 150,000 weeks, and the check line says "not stable".
- **Naps and cleans.** No plan with profit in it has the dogs nap or clean: a second staffer is the cheaper way to cut incidents.
- **Same week, different dollars.** Nine plans with Profit and Reputation change, from +$2 to +$10, give the one walk week. Which measures are in the plan matters more than how much: name it at the gallery walk.

## The check line

It is under Training details in the Teacher tray. The GM stops when its choices stop changing ("stable"), after 150,000 weeks, or when 60 seconds from the click run out.

- "not stable" without "over budget": it used all 150,000 weeks without settling. Do nothing: the week shown still counts, and any computer gives the same week for that plan and seed.
- "over budget" with "not stable": a slow computer cut the GM short, so its week may differ from another computer's on the same plan and seed. The week still counts for the team. If two teams on one plan got different weeks, this is why.
- "over budget" with "stable": it finished late; the week is the same.

## Judging "Which rule did your GM find?"

Full credit: a rule from the reveal, tied to a number in the team's own report: H7 with one staffer on four days; H8 with walks in every block and reputation up; H6 with dogs found sick at pickup; H1 or H2 with blocks over 15 dogs per staffer. Part credit: a rule or a number alone. "Which rule did your plan miss?": a rule whose cost landed on a number the plan did not pay for.

## What kind of SI the GM is

For the debrief, or when a student asks if every SI acts like this: the GM is one kind of SI, built to chase a number and given nothing but the bonus plan. Not every SI is built this way; others can be given rules, and some can guess what was meant. This kind shows the problem most clearly.
