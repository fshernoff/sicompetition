// The hidden rules in plain words, for the teacher's reveal at the debrief (BRIEF sections 6 and 11): one line per
// rule, H1 to H12, every number read from the config passed in, never a literal. The words are the owner's (an
// incident, never an injury; the GM, the crew, the floor). The exact sentences for the default config are pinned in
// tests/world/hidden-rules.test.ts. A pure function: no DOM. WP2 (Sonnet).
import type { WorldConfig } from './types.ts';

export type RuleId = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H8' | 'H9' | 'H10' | 'H11' | 'H12';

export interface RuleLine {
  id: RuleId;
  /** The rule in one sentence, ending with a period: "Wages are $300 per staffer per day." */
  title: string;
  /** The rule's arithmetic in plain words, one to four sentences. */
  words: string;
}

const num = (n: number): string => n.toLocaleString('en-US');
const abs = (n: number): string => num(Math.abs(n));
const usd = (n: number): string => `$${num(n)}`;
const chance = (p: number): string => `${Math.round(p * 100)} in 100`;
const signed = (n: number): string => (n > 0 ? `+${num(n)}` : n === 0 ? '0' : `\u2212${abs(n)}`);
const points = (n: number): string => `${num(n)} reputation point${n === 1 ? '' : 's'}`;
const requests = (n: number): string => `${num(n)} request${n === 1 ? '' : 's'}`;
/** An energy change as words: 0 "changes nothing", +5 "adds 5", −30 "takes off 30". */
const deltaWords = (n: number): string => (n === 0 ? 'changes nothing' : n > 0 ? `adds ${num(n)}` : `takes off ${abs(n)}`);
/** The incident chance under a multiplier: 1 is "the full incident chance", otherwise "the incident chance times 0.8". */
const chanceTimes = (m: number): string => (m === 1 ? 'the full incident chance' : `the incident chance times ${num(m)}`);

/**
 * The twelve hidden rules in plain words, H1 to H12, in order. Every number is read from the config passed in.
 * Formats: a chance p as "N in 100" (Math.round(p * 100)); dollars as "$300", "$2,000" (en-US commas); plain numbers
 * en-US ("0.5", "1,200"); the rate effects signed with the typographic minus ("+3", "0", "\u22121").
 */
export function hiddenRules(config: WorldConfig): readonly RuleLine[] {
  const c = config;
  const inc = c.incident;
  const mult = c.activityIncidentMultiplier;
  const delta = c.energy.delta;
  const legal = num(c.bookings.legalRatio);
  const safe = num(c.bookings.safeRatio);
  const days = num(c.callOut.soloDaysBeforeCallOut);
  return [
    {
      id: 'H1',
      title: `Incident risk climbs steeply above ${safe} dogs per staffer.`,
      words:
        `Up to ${safe} dogs per staffer, the chance of an incident in a block is ${chance(inc.baseBelowSafe)}. ` +
        `From ${safe} to ${legal} it rises by ${chance(inc.slopeSafeToLegal)} for every extra dog per staffer, ` +
        `and above ${legal} by ${chance(inc.slopeAboveLegal)}, up to ${chance(inc.cap)}. ` +
        `With no dogs on the floor the chance is zero.`,
    },
    {
      id: 'H2',
      title: `The legal maximum is ${legal} dogs per staffer, and an inspector may fine the business over it.`,
      words:
        `A block over ${legal} dogs per staffer counts as a block over the legal ratio. ` +
        `In each such block the inspector shows up with a chance of ${chance(c.inspector.chancePerOverBlock)}: ` +
        `a ${usd(c.inspector.fine)} fine and ${points(c.inspector.reputationHit)} lost.`,
    },
    {
      id: 'H3',
      title: 'Free play winds the dogs up, a nap calms them down, and wound-up dogs in a crowd is where incidents happen.',
      words:
        `Energy starts each day at ${num(c.energy.dayStart)}. ` +
        `A block of free play adds ${num(delta.freePlay)}, structured play ${num(delta.structuredPlay)} ` +
        `(or ${num(delta.freePlay)} when it falls back to free play), ` +
        `a nap takes off ${abs(delta.nap)}, a walk ${abs(delta.walk)}, and cleaning ${deltaWords(delta.clean)}. ` +
        `A block's incident chance is the ratio's chance times (${num(inc.energyFactorBase)} + energy \u00f7 ${num(c.energy.max)}) times the activity: ` +
        `free play ${num(mult.freePlay)}, structured play ${num(mult.structuredPlay)}, nap ${num(mult.nap)}, ` +
        `walk ${num(mult.walk)}, clean ${num(mult.clean)}; never more than ${chance(inc.cap)}, and at most one incident per block.`,
    },
    {
      id: 'H4',
      title: 'Every incident means a refund, a chance of a vet bill and a review drop.',
      words: `Each incident costs a ${usd(inc.refund)} refund, a ${chance(inc.vetChance)} chance of a ${usd(inc.vetCost)} vet bill, and ${points(inc.reputationHit)}.`,
    },
    {
      id: 'H5',
      title: "Reviews set tomorrow's requests.",
      words:
        `Tomorrow's requests start from ${num(c.requests.base)} at a reputation of ${num(c.reputation.weekStart)} ` +
        `and move ${num(c.requests.reputationSlope)} for every point of reputation above or below it; ` +
        `the rate moves them too (low ${signed(c.requests.rateEffect.low)}, standard ${signed(c.requests.rateEffect.standard)}, premium ${signed(c.requests.rateEffect.premium)}), ` +
        `and each dog found sick at pickup today cancels ${requests(c.illness.requestHit)}; never more than ${num(c.requests.max)}. ` +
        `Monday's requests are ${num(c.requests.day1)}.`,
    },
    {
      id: 'H6',
      title: 'A dirty floor causes illness and cancellations.',
      words:
        `Cleanliness starts the week at ${num(c.cleanliness.weekStart)}. ` +
        `Each play block takes off ${abs(c.cleanliness.perDogPlayBlock)} per dog present, a nap ${abs(c.cleanliness.perDogNapBlock)} per dog, ` +
        `a clean adds ${num(c.cleanliness.cleanBlock)} (the dogs are crated), and the night adds ${num(c.cleanliness.overnight)}. ` +
        `At pickup, if cleanliness is below ${num(c.illness.threshold)}, dogs are found sick: on average up to ${chance(c.illness.maxRate)} of them ` +
        `when the floor is at its dirtiest, fewer the cleaner it is, with the fraction of a case settled by a draw; ` +
        `each case costs ${points(c.illness.reputationHit)} and cancels ${requests(c.illness.requestHit)} tomorrow.`,
    },
    {
      id: 'H7',
      title: `A staffer who works ${days} days without help calls out.`,
      words:
        `The streak counts the days in a row the floor ran with exactly one staffer. ` +
        `Once it reaches ${days}, a day planned with one staffer does not open: the staffer calls out, every request is turned away, ` +
        `there is no revenue and no wage, and reputation drops ${num(c.callOut.closureReputationHit)}. ` +
        `Planning more than one staffer means everyone comes in. A day with help, or a closed day, resets the streak.`,
    },
    {
      id: 'H8',
      title: "Walks earn app photos that lift reputation but cost a staffer's block.",
      words:
        `A walk needs at least ${num(c.walk.minStaff)} staffers on the floor; with fewer it becomes free play and there is no photo. ` +
        `One staffer takes up to ${num(c.walk.groupSize)} dogs out for the block and the floor runs with the rest; the walkers have no incidents. ` +
        `Each walk with at least one dog posts a photo worth ${points(c.walk.reputationGain)}. ` +
        `A walk is a play block: every dog, walkers included, pays the add-on and dirties the floor.`,
    },
    {
      id: 'H9',
      title: `Structured play needs a staffer per ${num(c.structuredPlayMaxRatio)} dogs.`,
      words:
        `At ${num(c.structuredPlayMaxRatio)} dogs per staffer or fewer, structured play is a led class: energy up ${num(delta.structuredPlay)} ` +
        `and the incident chance times ${num(mult.structuredPlay)}. ` +
        `Above that it is free play with a clipboard: energy up ${num(delta.freePlay)} and ${chanceTimes(mult.freePlay)}. ` +
        `The add-on is earned either way.`,
    },
    {
      id: 'H10',
      title: 'Only play earns the add-on, and cleaning costs supplies.',
      words:
        `A play block (free play, structured play or a walk) earns ${usd(c.addOnPerDogPerPlayBlock)} per dog. ` +
        `A nap and a clean earn nothing, and a clean costs ${usd(c.cleanliness.suppliesCost)} in supplies on any open day, dogs or no dogs.`,
    },
    {
      id: 'H11',
      title: "The crew's fatigue builds with the ratio, and nothing but the bonus plan counts it.",
      words:
        `Fatigue starts the week at ${num(c.fatigue.weekStart)}. ` +
        `Every block the daycare is open adds ${num(c.fatigue.perBlockBase)}, plus ${num(c.fatigue.perBlockPerDogOverFloor)} for each dog per staffer above ${num(c.fatigue.ratioFloor)}; ` +
        `the night takes off ${num(c.fatigue.overnightRecovery)}. ` +
        `A block that ends above ${num(c.fatigue.kpiThreshold)} counts for the fatigue measure. ` +
        `Fatigue does nothing else: it is not what makes the staffer call out (that is the solo streak), ` +
        `and the only cost of a tired crew is whatever the bonus plan says.`,
    },
    {
      id: 'H12',
      title: `Wages are ${usd(c.wagePerStaffDay)} per staffer per day.`,
      words: `Each staffer scheduled costs ${usd(c.wagePerStaffDay)} for the day, charged at drop-off; a closed day pays no wages.`,
    },
  ];
}
