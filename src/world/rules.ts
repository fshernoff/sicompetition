// Pure rule functions, one per hidden rule. BRIEF section 6. Every number comes from the config passed in.
import type { Bookings, FloorActivity, Rate, WorldConfig } from './types.ts';

/** Clamp `x` into min..max. */
export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/**
 * Removes floating-point dust (19.499999999 becomes 19.5) so a half-up round or a "has a fractional part" test sees
 * the number the bible's arithmetic gives.
 */
export function tidy(x: number): number {
  return Math.round(x * 1e9) / 1e9;
}

/** Dogs per staffer; 0 when there are no dogs (or no staff). */
export function ratioOf(dogs: number, staff: number): number {
  return dogs === 0 || staff === 0 ? 0 : dogs / staff;
}

/** Dogs accepted at drop-off for a bookings choice and a scheduled staff count. BRIEF section 4. */
export function bookingsAccepted(requests: number, bookings: Bookings, staff: number, config: WorldConfig): number {
  if (bookings === 'legal') return Math.min(requests, config.bookings.legalRatio * staff);
  if (bookings === 'safe') return Math.min(requests, config.bookings.safeRatio * staff);
  return requests;
}

/** H1: base incident probability per block for a floor ratio; 0 when the ratio is 0 (no dogs). */
export function incidentBaseProbability(ratio: number, config: WorldConfig): number {
  if (ratio <= 0) return 0;
  const { baseBelowSafe, slopeSafeToLegal, slopeAboveLegal, cap } = config.incident;
  const safe = config.bookings.safeRatio; // 10 dogs per staffer
  const legal = config.bookings.legalRatio; // 15 dogs per staffer
  let p: number;
  if (ratio <= safe) {
    p = baseBelowSafe;
  } else if (ratio <= legal) {
    p = baseBelowSafe + slopeSafeToLegal * (ratio - safe);
  } else {
    p = baseBelowSafe + slopeSafeToLegal * (legal - safe) + slopeAboveLegal * (ratio - legal);
  }
  return Math.min(cap, p);
}

/** H3: 0.5 + energy / 100. */
export function energyFactor(energy: number, config: WorldConfig): number {
  return config.incident.energyFactorBase + energy / config.energy.max;
}

/** H1 + H3: base × energy factor × activity multiplier, capped. `activity` is the resolved activity. */
export function incidentProbability(ratio: number, energy: number, activity: FloorActivity, config: WorldConfig): number {
  const p =
    incidentBaseProbability(ratio, config) * energyFactor(energy, config) * config.activityIncidentMultiplier[activity];
  return Math.min(config.incident.cap, p);
}

/** H5: tomorrow's requests. `rate` is null on a closed day. `noise` is already drawn (0 by default). */
export function requestsTomorrow(
  reputation: number,
  rate: Rate | null,
  illnessCases: number,
  config: WorldConfig,
  noise = 0,
): number {
  const r = config.requests;
  // Half-up rounding, as JS Math.round: 19.5 → 20. The pivot is the starting reputation, 50.
  const fromReviews = Math.round(tidy(r.base + r.reputationSlope * (reputation - config.reputation.weekStart)));
  const rateEffect = rate === null ? 0 : r.rateEffect[rate];
  const cancelled = illnessCases * config.illness.requestHit;
  return clamp(fromReviews + rateEffect - cancelled + noise, 0, r.max);
}

/** H6: expected illness cases at pickup. */
export function illnessExpected(dogs: number, cleanliness: number, config: WorldConfig): number {
  const { threshold, maxRate } = config.illness;
  if (cleanliness >= threshold) return 0;
  return tidy((dogs * maxRate * (threshold - cleanliness)) / threshold);
}

/** H6: cleanliness change for one block, given the dogs present (walkers included) and the resolved activity. */
export function cleanlinessDelta(dogs: number, activity: FloorActivity, config: WorldConfig): number {
  if (activity === 'clean') return config.cleanliness.cleanBlock;
  if (activity === 'nap') return dogs * config.cleanliness.perDogNapBlock;
  return dogs * config.cleanliness.perDogPlayBlock; // freePlay, structuredPlay, walk
}

/** H3: energy change for one block, given the resolved activity. */
export function energyDelta(activity: FloorActivity, config: WorldConfig): number {
  return config.energy.delta[activity];
}

/** H11: fatigue gained in one open block at a floor ratio. */
export function fatigueGain(ratio: number, config: WorldConfig): number {
  const f = config.fatigue;
  return f.perBlockBase + f.perBlockPerDogOverFloor * Math.max(0, ratio - f.ratioFloor);
}

export interface FloorForBlock {
  activity: FloorActivity; // after fallbacks
  dogs: number; // on the floor for H1, H2, H11
  staff: number;
  ratio: number; // dogs ÷ staff, 0 when dogs is 0
  walkingDogs: number; // min(6, dogsOnFloor) during a walk, else 0; a photo needs at least 1
  fellBack: 'walkFellBack' | 'structuredFellBack' | null;
}

/** H8 + H9: who is on the floor for this block and what the floor actually runs. */
export function floorForActivity(
  dogsOnFloor: number,
  floorStaff: number,
  activity: FloorActivity,
  config: WorldConfig,
): FloorForBlock {
  const whole = (resolved: FloorActivity, fellBack: FloorForBlock['fellBack']): FloorForBlock => ({
    activity: resolved,
    dogs: dogsOnFloor,
    staff: floorStaff,
    ratio: ratioOf(dogsOnFloor, floorStaff),
    walkingDogs: 0,
    fellBack,
  });

  if (activity === 'walk') {
    // H8: a walk needs a second staffer; alone, the floor stays in free play.
    if (floorStaff < config.walk.minStaff) return whole('freePlay', 'walkFellBack');
    // One staffer and up to six dogs leave; the floor runs on what is left behind.
    const walkingDogs = Math.min(config.walk.groupSize, dogsOnFloor);
    const dogs = dogsOnFloor - walkingDogs;
    const staff = floorStaff - 1;
    return { activity: 'walk', dogs, staff, ratio: ratioOf(dogs, staff), walkingDogs, fellBack: null };
  }

  if (activity === 'structuredPlay' && ratioOf(dogsOnFloor, floorStaff) > config.structuredPlayMaxRatio) {
    // H9: above 10 dogs per staffer the class is free play with a clipboard.
    return whole('freePlay', 'structuredFellBack');
  }

  return whole(activity, null);
}

/** H10: whether a resolved activity earns the add-on. */
export function isPlayBlock(activity: FloorActivity): boolean {
  return activity === 'freePlay' || activity === 'structuredPlay' || activity === 'walk';
}
