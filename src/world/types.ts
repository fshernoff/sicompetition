// The seam every G1 package builds against. Names follow docs/BRIEF.md; change the bible first.

export type Bookings = 'all' | 'legal' | 'safe';
export type Rate = 'low' | 'standard' | 'premium';
export type StaffCount = 1 | 2 | 3;
export type FloorActivity = 'freePlay' | 'structuredPlay' | 'nap' | 'walk' | 'clean';

export const BOOKINGS: readonly Bookings[] = ['all', 'legal', 'safe'];
export const RATES: readonly Rate[] = ['low', 'standard', 'premium'];
export const STAFF_COUNTS: readonly StaffCount[] = [1, 2, 3];
export const FLOOR_ACTIVITIES: readonly FloorActivity[] = ['freePlay', 'structuredPlay', 'nap', 'walk', 'clean'];

export interface DayPlan {
  bookings: Bookings;
  rate: Rate;
  staff: StaffCount;
}

/** At drop-off (block 0) the GM sets the day's plan; in blocks 1..3 it picks the floor activity. */
export type Action = { kind: 'plan'; plan: DayPlan } | { kind: 'floor'; activity: FloorActivity };

/** Everything the page shows. Nothing here is hidden from students; the rules are. BRIEF section 3. */
export interface State {
  day: number; // 0 Mon .. 4 Fri
  block: number; // 0 drop-off, 1 late morning, 2 afternoon, 3 pickup
  requestsToday: number;
  dogsOnFloor: number;
  scheduledStaff: number; // 0 before drop-off resolves
  floorStaff: number; // 0 before drop-off resolves, and on a closed day
  soloStreak: number; // consecutive days the floor ran with exactly one staffer, through yesterday
  energy: number;
  cleanliness: number;
  fatigue: number;
  reputation: number;
  cash: number;
  requestsTomorrow: number; // projection until pickup, final after
  plan: DayPlan | null; // today's plan once drop-off resolves
  illnessCasesToday: number;
  closed: boolean;
  calledOut: boolean;
  done: boolean;
}

export type KpiKey = 'profit' | 'dogsServed' | 'incidents' | 'reputation' | 'fatigue' | 'overRatio';
export const KPI_KEYS: readonly KpiKey[] = ['profit', 'dogsServed', 'incidents', 'reputation', 'fatigue', 'overRatio'];
/** Divisor applied to a KPI delta before weighting. BRIEF section 7. */
export const KPI_UNITS: Readonly<Record<KpiKey, number>> = {
  profit: 100,
  dogsServed: 1,
  incidents: 1,
  reputation: 1,
  fatigue: 1,
  overRatio: 1,
};
export type KpiDeltas = Record<KpiKey, number>;

export interface KpiSetting {
  on: boolean;
  weight: number; // integer −10..+10
}
export interface RewardSpec {
  version: 1;
  kpis: Record<KpiKey, KpiSetting>;
}

export type WorldEventType =
  | 'incident'
  | 'vetBill'
  | 'inspection'
  | 'illness'
  | 'callOut'
  | 'closed'
  | 'walkPhoto'
  | 'walkFellBack'
  | 'structuredFellBack';
export interface WorldEvent {
  type: WorldEventType;
  day: number;
  block: number;
  amount?: number; // dollars for vetBill and inspection, cases for illness
}

/** The P&L lines a step moved. Σ = deltas.profit. */
export interface MoneyLines {
  dayRateRevenue: number;
  addOnRevenue: number;
  wages: number;
  refunds: number;
  vetCost: number;
  fineCost: number;
  supplies: number;
}

/** What the readout shows for the day, captured at pickup before overnight recovery and the energy reset. */
export interface PickupSnapshot {
  reputation: number;
  cleanliness: number;
  fatigue: number;
  energy: number;
  illnessCases: number;
}

export interface StepResult {
  state: State;
  deltas: KpiDeltas;
  money: MoneyLines;
  events: WorldEvent[];
  /** Present only for a pickup step (block 3), closed days included. */
  pickup?: PickupSnapshot;
  /** The activity the floor actually ran this block after fallbacks (freePlay at drop-off; null on a closed day). */
  activity: FloorActivity | null;
  /** dogs ÷ staff on the floor for this block after a walking group leaves; 0 with no dogs or a closed day. */
  floorRatio: number;
}

/** One stream of draws in [0, 1). The world takes them in the order BRIEF section 6 lists. */
export interface Rng {
  next(): number;
}
export interface EpisodeSeeds {
  world: number;
  policy: number;
}

export type Policy = (state: State, legal: readonly Action[], rng: Rng) => Action;

export interface DayReport {
  day: number;
  requests: number;
  accepted: number;
  rate: Rate | null;
  scheduledStaff: number;
  floorStaff: number;
  calledOut: boolean;
  closed: boolean;
  requested: (FloorActivity | null)[]; // 4 entries, what the GM asked for; null at drop-off
  activities: (FloorActivity | null)[]; // 4 entries, resolved after fallbacks; null on a closed day
  incidents: number;
  illnessCases: number;
  fines: number;
  vetBills: number;
  dayRateRevenue: number;
  addOnRevenue: number;
  wages: number;
  refunds: number;
  vetCost: number;
  fineCost: number;
  suppliesCost: number;
  profit: number;
  blocksOverRatio: number;
  blocksFatigueOver70: number;
  avgRatio: number; // over this day's open blocks with dogs; 0 otherwise
  reputationAtPickup: number;
  cleanlinessAtPickup: number;
  fatigueAtPickup: number;
  energyAtPickup: number;
}

export interface WeekTotals {
  daysAcceptedAll: number; // days where accepted === requests and requests > 0
  daysOneStaffer: number; // days the floor ran with exactly 1 staffer
  daysClosed: number;
  freePlayBlocks: number;
  structuredPlayBlocks: number;
  napBlocks: number;
  walkBlocks: number;
  cleanBlocks: number;
  avgDogsPerStaffer: number; // over open blocks with dogs, all week
  incidents: number;
  illnessCases: number;
  fines: number;
  vetBills: number;
  blocksOverRatio: number;
  blocksFatigueOver70: number;
  dogsServed: number;
  revenue: number;
  wages: number;
  refunds: number;
  vetCost: number;
  fineCost: number;
  supplies: number;
  profit: number;
  reputationStart: number;
  reputationEnd: number;
  reputationChange: number;
  cashEnd: number;
  kpi: KpiDeltas;
  reward: number;
}

export interface WeekReport {
  seeds: EpisodeSeeds;
  days: DayReport[];
  totals: WeekTotals;
}

export interface StepRecord {
  state: State; // before the action
  action: Action;
  result: StepResult;
  reward: number;
}

export interface EpisodeTrace {
  seeds: EpisodeSeeds;
  steps: StepRecord[];
  report: WeekReport;
}

export interface WorldConfig {
  name: string;
  days: number;
  blocksPerDay: number;
  requests: {
    day1: number;
    base: number;
    max: number;
    reputationSlope: number;
    rateEffect: Record<Rate, number>;
    noise: number;
  };
  rates: Record<Rate, number>;
  addOnPerDogPerPlayBlock: number;
  wagePerStaffDay: number;
  bookings: { legalRatio: number; safeRatio: number };
  incident: {
    baseBelowSafe: number;
    slopeSafeToLegal: number;
    slopeAboveLegal: number;
    cap: number;
    energyFactorBase: number;
    refund: number;
    vetChance: number;
    vetCost: number;
    reputationHit: number;
  };
  activityIncidentMultiplier: Record<FloorActivity, number>;
  energy: { dayStart: number; min: number; max: number; delta: Record<FloorActivity, number> };
  cleanliness: {
    weekStart: number;
    min: number;
    max: number;
    perDogPlayBlock: number;
    perDogNapBlock: number;
    cleanBlock: number;
    overnight: number;
    suppliesCost: number;
  };
  illness: { threshold: number; maxRate: number; reputationHit: number; requestHit: number };
  inspector: { chancePerOverBlock: number; fine: number; reputationHit: number };
  fatigue: {
    weekStart: number;
    min: number;
    max: number;
    perBlockBase: number;
    perBlockPerDogOverFloor: number;
    ratioFloor: number;
    overnightRecovery: number;
    kpiThreshold: number;
  };
  callOut: { soloDaysBeforeCallOut: number; closureReputationHit: number };
  walk: { groupSize: number; reputationGain: number; minStaff: number };
  structuredPlayMaxRatio: number;
  reputation: { weekStart: number; min: number; max: number };
  cash: { weekStart: number };
}
