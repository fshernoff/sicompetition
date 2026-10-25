// What a week's readout says. BRIEF section 7 (outcome classes) and section 10 (the sentence).
import { RATES } from '../world/types.ts';
import type { Rate, WeekReport } from '../world/types.ts';

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
 * The sentence of BRIEF section 10. With no closure:
 *   "The GM accepted every booking on 5 of 5 days, ran the floor with 1 staffer on 4 days, chose nap 0 times,
 *    averaged 16 dogs per staffer, and had 8 incidents."
 * With a closure the last clause moves: "..., averaged 19 dogs per staffer, had 9 incidents, and was closed on 1 day."
 * Numbers from totals: daysAcceptedAll, daysOneStaffer, napBlocks, avgDogsPerStaffer rounded to a whole number
 * (Math.round), incidents, daysClosed. Singulars: "1 time", "1 incident", "1 day"; otherwise "times", "incidents",
 * "days". "1 staffer" is always singular (it counts days with exactly one). WP3 (Sonnet).
 */
export function describeWeek(report: WeekReport): string {
  const t = report.totals;
  const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  const head = `The GM accepted every booking on ${t.daysAcceptedAll} of 5 days, ran the floor with 1 staffer on ${count(t.daysOneStaffer, 'day', 'days')}, chose nap ${count(t.napBlocks, 'time', 'times')}, averaged ${Math.round(t.avgDogsPerStaffer)} dogs per staffer`;
  const incidents = count(t.incidents, 'incident', 'incidents');
  if (t.daysClosed === 0) return `${head}, and had ${incidents}.`;
  return `${head}, had ${incidents}, and was closed on ${count(t.daysClosed, 'day', 'days')}.`;
}
