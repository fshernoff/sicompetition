// What a week's readout says. BRIEF section 7 (outcome classes) and section 10 (the sentence).
import { KPI_KEYS, RATES } from '../world/types.ts';
import type { Rate, RewardSpec, WeekReport } from '../world/types.ts';

/** The coarse shape of a week: what the bonus plan bought. Compared across evaluations for stability. */
export type WalkBucket = 'few' | 'most'; // fewer than 8 walk blocks, or 8 and more

export interface OutcomeClass {
  daysAcceptedAll: number;
  daysOneStaffer: number;
  daysTwoStaffers: number;
  daysThreeStaffers: number;
  daysClosed: number;
  napBlocks: number;
  cleanBlocks: number;
  walks: WalkBucket; // < 8 → few, 8+ → most (a walk-or-not flip on one help day is not a change of mind)
  rateDays: Record<Rate, number>; // open days charged at each rate (a closed day charges nothing)
}

export function outcomeClass(report: WeekReport): OutcomeClass {
  const t = report.totals;
  const rateDays: Record<Rate, number> = { low: 0, standard: 0, premium: 0 };
  for (const d of report.days) if (!d.closed && d.rate !== null) rateDays[d.rate] += 1;
  return {
    daysAcceptedAll: t.daysAcceptedAll,
    daysOneStaffer: t.daysOneStaffer,
    daysTwoStaffers: report.days.filter((d) => d.floorStaff === 2).length,
    daysThreeStaffers: report.days.filter((d) => d.floorStaff === 3).length,
    daysClosed: t.daysClosed,
    napBlocks: t.napBlocks,
    cleanBlocks: t.cleanBlocks,
    walks: t.walkBlocks < 8 ? 'few' : 'most',
    rateDays,
  };
}

/** A string key of the outcome class, so two weeks can be compared with ===. */
export function outcomeKey(report: WeekReport): string {
  const o = outcomeClass(report);
  const rates = RATES.filter((r) => o.rateDays[r] > 0).map((r) => `${r}×${o.rateDays[r]}`).join('/');
  return `acceptAll=${o.daysAcceptedAll} staff1=${o.daysOneStaffer} staff2=${o.daysTwoStaffers} staff3=${o.daysThreeStaffers} closed=${o.daysClosed} nap=${o.napBlocks} clean=${o.cleanBlocks} walks=${o.walks} rates=${rates}`;
}

/** The Round 1 outcome class of BRIEF section 7: the reckless week with one day of real help. */
export function isRound1Outcome(report: WeekReport): boolean {
  const o = outcomeClass(report);
  return (
    o.daysAcceptedAll === 5 &&
    o.daysOneStaffer === 4 &&
    o.daysTwoStaffers === 1 &&
    o.daysThreeStaffers === 0 &&
    o.daysClosed === 0 &&
    o.napBlocks === 0 &&
    o.cleanBlocks === 0 &&
    o.rateDays.premium === 5
  );
}

/**
 * The rate clause (BRIEF section 10, G5d round 3), from the open days' rates: "charged the premium rate", or "charged
 * a mix of rates (low × 1, premium × 4)" in the table's week-cell words, low, standard, premium order; null for a week
 * closed every day (it charged nothing).
 */
function rateClause(report: WeekReport): string | null {
  const open = report.days.filter((d) => !d.closed && d.rate !== null);
  const counts = RATES.map((r) => ({ r, n: open.filter((d) => d.rate === r).length })).filter((x) => x.n > 0);
  if (counts.length === 0) return null;
  if (counts.length === 1) return `charged the ${counts[0]?.r ?? ''} rate`;
  return `charged a mix of rates (${counts.map((x) => `${x.r} × ${x.n}`).join(', ')})`;
}

/**
 * The sentence of BRIEF section 10, in business English (G5d). With no closure:
 *   "The GM accepted every booking on 5 of 5 days, charged the premium rate, ran the floor with one staffer on 4 days,
 *    never had the dogs nap, averaged 16 dogs per staffer, and had 8 incidents."
 * With a closure the last clause moves: "..., averaged 19 dogs per staffer, had 9 incidents, and was closed on 1 day."
 * The clauses: the rate (rateClause; none for a week closed every day); "ran the floor with one staffer on 1 day" /
 * "on N days" / "never ran the floor with one staffer"; "had the dogs nap in 1 block" / "in N blocks" / "never had the
 * dogs nap"; "had 1 incident" / "had N incidents" / "had no incidents". Numbers from totals: daysAcceptedAll,
 * daysOneStaffer, napBlocks, avgDogsPerStaffer rounded to a whole number (Math.round), incidents, daysClosed.
 */
export function describeWeek(report: WeekReport): string {
  const t = report.totals;
  const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  const rate = rateClause(report);
  const solo = t.daysOneStaffer === 0 ? 'never ran the floor with one staffer' : `ran the floor with one staffer on ${count(t.daysOneStaffer, 'day', 'days')}`;
  const naps = t.napBlocks === 0 ? 'never had the dogs nap' : `had the dogs nap in ${count(t.napBlocks, 'block', 'blocks')}`;
  const head = `The GM accepted every booking on ${t.daysAcceptedAll} of 5 days, ${rate === null ? '' : `${rate}, `}${solo}, ${naps}, averaged ${Math.round(t.avgDogsPerStaffer)} dogs per staffer`;
  const incidents = t.incidents === 0 ? 'no incidents' : count(t.incidents, 'incident', 'incidents');
  if (t.daysClosed === 0) return `${head}, and had ${incidents}.`;
  return `${head}, had ${incidents}, and was closed on ${count(t.daysClosed, 'day', 'days')}.`;
}

/** A plan's target class: true when a week's readout is in it. */
export type TargetPredicate = (report: WeekReport) => boolean;

/**
 * The outcome class a plan is expected to reach, when the bible defines one: the Round 1 class (section 7) when
 * Profit is on with a positive weight and every other measure is off or weighs 0 (it then contributes nothing), and
 * null for every other plan, which then has no target and can only be reported stable (D36). A positive scale keeps
 * the objective and the intended class, not the exact trajectory (Astra, plan review).
 */
export function targetOutcome(spec: RewardSpec): TargetPredicate | null {
  const profit = spec.kpis.profit;
  if (!profit.on || profit.weight <= 0) return null;
  for (const key of KPI_KEYS) {
    if (key === 'profit') continue;
    const setting = spec.kpis[key];
    if (setting.on && setting.weight !== 0) return null;
  }
  return isRound1Outcome;
}
