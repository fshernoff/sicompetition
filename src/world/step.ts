// The step function. BRIEF sections 2 to 6, in the order of resolution at the end of section 6.
import { emptyDeltas } from './reward.ts';
import {
  bookingsAccepted,
  clamp,
  cleanlinessDelta,
  energyDelta,
  fatigueGain,
  floorForActivity,
  illnessExpected,
  incidentProbability,
  isPlayBlock,
  requestsTomorrow,
  tidy,
} from './rules.ts';
import { BOOKINGS, FLOOR_ACTIVITIES, RATES, STAFF_COUNTS } from './types.ts';
import type {
  Action,
  FloorActivity,
  MoneyLines,
  PickupSnapshot,
  Rate,
  Rng,
  State,
  StepResult,
  WorldConfig,
  WorldEvent,
} from './types.ts';

/** The 27 drop-off plans: bookings × rate × staff. BRIEF section 4. */
const PLAN_ACTIONS: readonly Action[] = BOOKINGS.flatMap((bookings) =>
  RATES.flatMap((rate) => STAFF_COUNTS.map((staff): Action => ({ kind: 'plan', plan: { bookings, rate, staff } }))),
);

/** The 5 floor activities for blocks 1..3. */
const FLOOR_ACTIONS: readonly Action[] = FLOOR_ACTIVITIES.map((activity): Action => ({ kind: 'floor', activity }));

/** Monday drop-off, before any action. */
export function initialState(config: WorldConfig): State {
  const reputation = config.reputation.weekStart;
  return {
    day: 0,
    block: 0,
    requestsToday: config.requests.day1,
    dogsOnFloor: 0,
    scheduledStaff: 0,
    floorStaff: 0,
    soloStreak: 0,
    energy: config.energy.dayStart,
    cleanliness: config.cleanliness.weekStart,
    fatigue: config.fatigue.weekStart,
    reputation,
    cash: config.cash.weekStart,
    requestsTomorrow: requestsTomorrow(reputation, null, 0, config), // no plan yet, so no rate effect
    plan: null,
    illnessCasesToday: 0,
    closed: false,
    calledOut: false,
    done: false,
  };
}

/** The 27 plans at block 0, the 5 activities otherwise; empty when done. */
export function legalActions(state: State): readonly Action[] {
  if (state.done) return [];
  return state.block === 0 ? PLAN_ACTIONS : FLOOR_ACTIONS;
}

function emptyMoney(): MoneyLines {
  return { dayRateRevenue: 0, addOnRevenue: 0, wages: 0, refunds: 0, vetCost: 0, fineCost: 0, supplies: 0 };
}

/** Section 5: profit = revenue − wages − refunds − vet bills − fines − supplies. */
function profitOf(m: MoneyLines): number {
  return m.dayRateRevenue + m.addOnRevenue - m.wages - m.refunds - m.vetCost - m.fineCost - m.supplies;
}

/** Today's rate for H5, or null before drop-off resolves and on a closed day. */
function rateToday(state: State): Rate | null {
  return state.closed || state.plan === null ? null : state.plan.rate;
}

/** One step. Never mutates `state`. Takes draws from `rng` in the order BRIEF section 6 lists. */
export function step(state: State, action: Action, config: WorldConfig, rng: Rng): StepResult {
  if (state.done) throw new Error('step: the week is over (state.done is true)');
  const isDropOff = state.block === 0;
  const isPickup = state.block === config.blocksPerDay - 1;
  if (isDropOff && action.kind !== 'plan') throw new Error('step: block 0 (drop-off) takes a plan action');
  if (!isDropOff && action.kind !== 'floor') throw new Error(`step: block ${state.block} takes a floor action`);

  const next: State = { ...state };
  const money = emptyMoney();
  const deltas = emptyDeltas();
  const events: WorldEvent[] = [];
  const event = (type: WorldEvent['type'], amount?: number): void => {
    events.push(amount === undefined ? { type, day: state.day, block: state.block } : { type, day: state.day, block: state.block, amount });
  };
  let reputationChange = 0; // every reputation effect in the step, summed and applied once (H4)
  let activity: FloorActivity | null = null;
  let floorRatio = 0;

  // 1. Drop-off only: the call-out check (H7), then bookings, wages (H12) and the day rate.
  if (action.kind === 'plan') {
    const plan = { ...action.plan };
    next.plan = plan;
    next.scheduledStaff = plan.staff;
    if (state.soloStreak >= config.callOut.soloDaysBeforeCallOut && plan.staff === 1) {
      // H7: the lone staffer calls out and the daycare is closed today. No revenue, no wages, no draws.
      next.closed = true;
      next.calledOut = true;
      next.floorStaff = 0;
      next.dogsOnFloor = 0;
      reputationChange -= config.callOut.closureReputationHit;
      event('callOut');
      event('closed');
    } else {
      // Scheduling help (2 or 3) brings everyone in: the floor count is the scheduled count.
      const dogs = bookingsAccepted(state.requestsToday, plan.bookings, plan.staff, config);
      next.closed = false;
      next.calledOut = false;
      next.floorStaff = plan.staff;
      next.dogsOnFloor = dogs;
      money.wages = plan.staff * config.wagePerStaffDay; // H12
      money.dayRateRevenue = dogs * config.rates[plan.rate];
      deltas.dogsServed = dogs;
    }
  }

  // Steps 2 to 5 run only on an open day. A closed day's blocks pass with nothing on the floor and no draws.
  if (!next.closed) {
    // 2. Fallbacks (H8, H9) and who is on the floor. The drop-off block is always free play.
    const requested: FloorActivity = action.kind === 'floor' ? action.activity : 'freePlay';
    const floor = floorForActivity(next.dogsOnFloor, next.floorStaff, requested, config);
    activity = floor.activity;
    floorRatio = floor.ratio;
    if (floor.fellBack !== null) event(floor.fellBack);

    // 3. Draws. The incident draw is always taken (H1, H3), using the energy at the start of the block.
    const pIncident = incidentProbability(floor.ratio, state.energy, floor.activity, config);
    if (rng.next() < pIncident) {
      // H4: a refund, a review drop, and a vet bill on a second draw.
      deltas.incidents = 1;
      money.refunds += config.incident.refund;
      reputationChange -= config.incident.reputationHit;
      event('incident');
      if (rng.next() < config.incident.vetChance) {
        money.vetCost += config.incident.vetCost;
        event('vetBill', config.incident.vetCost);
      }
    }
    if (floor.ratio > config.bookings.legalRatio) {
      // H2: over the legal ratio; the inspector draw is taken only here.
      deltas.overRatio = 1;
      if (rng.next() < config.inspector.chancePerOverBlock) {
        money.fineCost += config.inspector.fine;
        reputationChange -= config.inspector.reputationHit;
        event('inspection', config.inspector.fine);
      }
    }

    // 4. Add-on revenue and supplies (H10), the walk photo (H8), energy (H3) and cleanliness (H6).
    if (!isDropOff && isPlayBlock(activity)) {
      money.addOnRevenue = config.addOnPerDogPerPlayBlock * next.dogsOnFloor; // walkers included
    }
    if (activity === 'clean') money.supplies = config.cleanliness.suppliesCost; // dogs or no dogs
    if (activity === 'walk' && floor.walkingDogs >= 1) {
      reputationChange += config.walk.reputationGain;
      event('walkPhoto');
    }
    next.energy = clamp(state.energy + energyDelta(activity, config), config.energy.min, config.energy.max);
    next.cleanliness = clamp(
      state.cleanliness + cleanlinessDelta(next.dogsOnFloor, activity, config),
      config.cleanliness.min,
      config.cleanliness.max,
    );

    // 5. Fatigue (H11): the gain for the block, then the KPI if it ends the block above 70.
    next.fatigue = clamp(state.fatigue + fatigueGain(floor.ratio, config), config.fatigue.min, config.fatigue.max);
    if (next.fatigue > config.fatigue.kpiThreshold) deltas.fatigue = 1;
  }

  // 6a. Pickup, open day only: illness from a dirty floor (H6). Its reputation joins the step's single clamp.
  let illnessCases = 0;
  if (isPickup && !next.closed) {
    const expected = illnessExpected(next.dogsOnFloor, next.cleanliness, config);
    const whole = Math.floor(expected);
    const fraction = tidy(expected - whole);
    illnessCases = whole + (fraction > 0 && rng.next() < fraction ? 1 : 0);
    if (illnessCases > 0) {
      reputationChange -= illnessCases * config.illness.reputationHit;
      event('illness', illnessCases);
    }
    next.illnessCasesToday = illnessCases;
  }

  // Reputation: every effect of the step summed, applied once, clamped (H4). The KPI is the clamped change.
  next.reputation = clamp(state.reputation + reputationChange, config.reputation.min, config.reputation.max);
  deltas.reputation = next.reputation - state.reputation;

  // The P&L for the step (section 5).
  deltas.profit = profitOf(money);
  next.cash = state.cash + deltas.profit;

  let pickup: PickupSnapshot | undefined;
  if (isPickup) {
    // 6b. The snapshot for the readout: values as they stand after the block and illness, before the night.
    pickup = {
      reputation: next.reputation,
      cleanliness: next.cleanliness,
      fatigue: next.fatigue,
      energy: next.energy,
      illnessCases,
    };

    // H5: tomorrow's requests become requestsToday. The noise draw (hard mode) comes after illness, open days only.
    const n = config.requests.noise;
    const noise = !next.closed && n > 0 ? Math.floor(rng.next() * (2 * n + 1)) - n : 0;
    next.requestsToday = requestsTomorrow(next.reputation, rateToday(next), illnessCases, config, noise);

    // Overnight recovery (H6, H11), the solo streak (H7), the energy reset (H3), the plan cleared.
    next.cleanliness = clamp(next.cleanliness + config.cleanliness.overnight, config.cleanliness.min, config.cleanliness.max);
    next.fatigue = clamp(next.fatigue - config.fatigue.overnightRecovery, config.fatigue.min, config.fatigue.max);
    next.soloStreak = next.floorStaff === 1 ? state.soloStreak + 1 : 0;
    next.energy = config.energy.dayStart;
    next.plan = null;
    next.dogsOnFloor = 0;
    next.scheduledStaff = 0;
    next.floorStaff = 0;
    next.illnessCasesToday = 0;
    next.closed = false;
    next.calledOut = false;

    // Advance the day. After Friday the state is terminal: day 5, block 0, done.
    next.day = state.day + 1;
    next.block = 0;
    next.done = next.day >= config.days;
  } else {
    // 7. Advance the block.
    next.block = state.block + 1;
  }

  // 7. The requestsTomorrow projection: no draws, no noise, no rate before drop-off resolves.
  next.requestsTomorrow = requestsTomorrow(next.reputation, rateToday(next), next.illnessCasesToday, config);

  const result: StepResult = { state: next, deltas, money, events, activity, floorRatio };
  if (pickup !== undefined) result.pickup = pickup;
  return result;
}
