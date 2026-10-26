// The weekly P&L and operations report as a table (BRIEF section 10.1; the G4 plan names the groups, the labels and
// the formats). `reportTable` is a pure function from a WeekReport, the plan and the config to rows; `renderReport`
// puts the rows into a <table>. No DOM access at module top level: reportTable is tested under node.
// Seam written by the main thread; WP2 (Sonnet) builds it.
import { kpiInfo } from '../world/bonusPlan.ts';
import { KPI_UNITS, RATES } from '../world/types.ts';
import type { DayReport, FloorActivity, KpiKey, RewardSpec, WeekReport, WorldConfig } from '../world/types.ts';
import { signedWeight } from './editor.ts';

export interface ReportRow {
  label: string;
  /** One cell per day, Monday to Friday. */
  days: string[];
  /** The Week column. */
  week: string;
  /** Revenue, Profit and the bonus total are set in bold. */
  emphasis?: boolean;
}

export interface ReportGroup {
  title: string; // 'Operations' | 'Money ($)' | "The GM's bonus"
  rows: ReportRow[];
}

export interface ReportTable {
  /** 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Week'. */
  columns: string[];
  groups: ReportGroup[];
}

/** Whole dollars, en-US commas, a typographic minus (U+2212): "$1,234", "−$120", "$0" (−0.2 rounds to "$0"). */
export function formatMoney(dollars: number): string {
  const whole = Math.round(dollars);
  if (whole === 0) return '$0';
  const body = `$${Math.abs(whole).toLocaleString('en-US')}`;
  return whole < 0 ? `−${body}` : body;
}

/**
 * Bonus points: rounded to two decimals (Math.round(x × 100) ÷ 100; profit is whole dollars ÷ 100 × an integer
 * weight, so two decimals are exact), trailing zeros dropped, the sign always shown for a non-zero value, a
 * typographic minus: "+123.5", "+9.78", "+113", "−35", "0" (and "0" for anything that rounds to zero).
 */
export function formatPoints(points: number): string {
  const r = Math.round(points * 100) / 100;
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `−${-r}`;
}

const ACTIVITY_WORDS: Record<FloorActivity, string> = {
  freePlay: 'free play',
  structuredPlay: 'structured play',
  nap: 'nap',
  walk: 'walk',
  clean: 'clean',
};

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** A pickup meter's week cell: "50 → 21 (−29)". */
function meterWeek(from: number, to: number): string {
  const change = to - from;
  const sign = change > 0 ? `+${change}` : change < 0 ? `−${-change}` : '0';
  return `${from} → ${to} (${sign})`;
}

/** The activities cell for one day: arrivals, then the three floor blocks. */
function activitiesCell(d: DayReport): string {
  if (d.closed) return 'closed';
  const blocks = ['arrivals'];
  for (let b = 1; b < 4; b++) {
    const resolved = d.activities[b];
    const asked = d.requested[b];
    const word = resolved === null || resolved === undefined ? '' : ACTIVITY_WORDS[resolved];
    blocks.push(asked !== null && asked !== undefined && asked !== resolved ? `${ACTIVITY_WORDS[asked]} → ${word}` : word);
  }
  return blocks.join(' · ');
}

/** The change in one measure on one day, in the measure's own units before the unit divisor. */
function dayDelta(key: KpiKey, d: DayReport, i: number, report: WeekReport): number {
  switch (key) {
    case 'profit':
      return d.profit;
    case 'dogsServed':
      return d.accepted;
    case 'incidents':
      return d.incidents;
    case 'fatigue':
      return d.blocksFatigueOver70;
    case 'overRatio':
      return d.blocksOverRatio;
    case 'reputation': {
      const before = i === 0 ? report.totals.reputationStart : (report.days[i - 1]?.reputationAtPickup ?? 0);
      return d.reputationAtPickup - before;
    }
  }
}

/**
 * The table of section 10.1 for one week. Three groups:
 *
 * Operations: Requests; Dogs accepted; Accepted every booking ("yes" when requests > 0 and accepted = requests,
 * "no" otherwise, "closed" on a closed day; week "5 of 5 days" from totals.daysAcceptedAll); Day rate ("premium
 * $52"; "closed" on a closed day; week "premium × 5" or "low × 1, premium × 4" in low, standard, premium order,
 * rates with 0 open days left out); Crew scheduled (week "6 staff-days", the sum); Crew on the floor ("0, called
 * out" on a closed day; week "1 staffer on 4 days", "1 staffer on 1 day", from totals.daysOneStaffer); Activities (drop-off · late morning
 * · afternoon · pickup) (the four blocks joined with " · ", the drop-off always written "arrivals", a floor block
 * whose resolved activity differs from the requested one as "walk → free play", "closed" on a closed day; week
 * "nap 0, clean 0, walk 0" from the totals); Dogs per staffer (one decimal from DayReport.avgRatio, "—" when 0;
 * week avgDogsPerStaffer); Blocks over 15 dogs per staffer; Incidents; Dogs sent home sick; Inspector visits (fines
 * counted); Blocks with crew fatigue above 70%; Reputation at pickup (week "50 → 21 (−29)" from reputationStart to
 * reputationEnd); Cleanliness at pickup (Math.round; week "80 → 0 (−80)" from cleanliness.weekStart to Friday's
 * pickup); Crew fatigue at pickup (Math.round; week "20 → 100 (+80)" from fatigue.weekStart). Counts in the week
 * column are the totals of the report. A closed day keeps its requests, its scheduled crew and its pickup meters.
 *
 * Money ($): Day rates; Activity add-ons; Revenue (bold; day rates + add-ons); Wages; Refunds; Vet bills; Fines;
 * Cleaning supplies; Profit (bold); Cash at close (cash.weekStart plus the profit so far, carried unchanged over a
 * closed day; week: the Friday figure, totals.cashEnd). All through formatMoney.
 *
 * The GM's bonus: one row per measure that is on, in KPI_KEYS order, labelled "<name>, <signed weight> <per>" with
 * the name and the per-hint of kpiInfo(world) and the weight signed as the editor shows it ("+10", "−5", "0"):
 * "Profit today ($), +10 per $100", "Incidents, −5 per incident", "Blocks over the legal ratio, −5 per block". The
 * day cells are the points that measure earned that day: weight × (the day's delta ÷ KPI_UNITS[key]), where the
 * day's deltas are DayReport.profit, accepted, incidents, blocksFatigueOver70, blocksOverRatio, and for reputation
 * the change since the previous pickup (reputationAtPickup[d] − reputationAtPickup[d − 1], Monday against
 * totals.reputationStart; a closed day's delta is its closure hit). The week cell is weight × totals.kpi[key] ÷
 * unit. Last, "Bonus points this week" (bold): the day cells sum the measures' day cells; the week cell is
 * totals.reward (authoritative; it equals the sum when `spec` is the plan the week was run under). A plan with
 * nothing on has the one row "No measure is on: the GM is paid nothing." with "0" in every cell. All through
 * formatPoints.
 *
 * The 15, the 70, the rates' prices and the $2,000 are world.bookings.legalRatio, world.fatigue.kpiThreshold,
 * world.rates and world.cash.weekStart. The rate words are low, standard, premium; the activity words free play,
 * structured play, nap, walk, clean.
 */
export function reportTable(report: WeekReport, spec: RewardSpec, world: WorldConfig): ReportTable {
  const days = report.days;
  const t = report.totals;
  const perDay = (f: (d: DayReport, i: number) => string): string[] => days.map(f);
  const num = (f: (d: DayReport) => number): string[] => days.map((d) => String(f(d)));
  const money = (f: (d: DayReport) => number): string[] => days.map((d) => formatMoney(f(d)));
  const last = days[days.length - 1];

  // Day rate week cell: open days per rate, in low, standard, premium order.
  const rateCounts = RATES.map((r) => ({ r, n: days.filter((d) => !d.closed && d.rate === r).length })).filter((x) => x.n > 0);

  // Cash at close: the running sum of profit on top of the week's starting cash.
  let cash = world.cash.weekStart;
  const cashCells = days.map((d) => {
    cash += d.profit;
    return formatMoney(cash);
  });

  const operations: ReportRow[] = [
    { label: 'Requests', days: num((d) => d.requests), week: String(sum(days.map((d) => d.requests))) },
    { label: 'Dogs accepted', days: num((d) => d.accepted), week: String(sum(days.map((d) => d.accepted))) },
    {
      label: 'Accepted every booking',
      days: perDay((d) => (d.closed ? 'closed' : d.requests > 0 && d.accepted === d.requests ? 'yes' : 'no')),
      week: `${t.daysAcceptedAll} of ${days.length} days`,
    },
    {
      label: 'Day rate',
      days: perDay((d) => (d.closed || d.rate === null ? 'closed' : `${d.rate} ${formatMoney(world.rates[d.rate])}`)),
      week: rateCounts.map((x) => `${x.r} × ${x.n}`).join(', '),
    },
    { label: 'Crew scheduled', days: num((d) => d.scheduledStaff), week: `${sum(days.map((d) => d.scheduledStaff))} staff-days` },
    {
      label: 'Crew on the floor',
      days: perDay((d) => (d.closed ? '0, called out' : String(d.floorStaff))),
      week: `1 staffer on ${t.daysOneStaffer} ${t.daysOneStaffer === 1 ? 'day' : 'days'}`,
    },
    {
      label: 'Activities (drop-off · late morning · afternoon · pickup)',
      days: perDay(activitiesCell),
      week: `nap ${t.napBlocks}, clean ${t.cleanBlocks}, walk ${t.walkBlocks}`,
    },
    {
      label: 'Dogs per staffer',
      days: perDay((d) => (d.avgRatio === 0 ? '—' : d.avgRatio.toFixed(1))),
      week: t.avgDogsPerStaffer.toFixed(1),
    },
    { label: `Blocks over ${world.bookings.legalRatio} dogs per staffer`, days: num((d) => d.blocksOverRatio), week: String(t.blocksOverRatio) },
    { label: 'Incidents', days: num((d) => d.incidents), week: String(t.incidents) },
    { label: 'Dogs sent home sick', days: num((d) => d.illnessCases), week: String(t.illnessCases) },
    { label: 'Inspector visits', days: num((d) => d.fines), week: String(t.fines) },
    {
      label: `Blocks with crew fatigue above ${world.fatigue.kpiThreshold}%`,
      days: num((d) => d.blocksFatigueOver70),
      week: String(t.blocksFatigueOver70),
    },
    {
      label: 'Reputation at pickup',
      days: num((d) => d.reputationAtPickup),
      week: meterWeek(t.reputationStart, t.reputationEnd),
    },
    {
      label: 'Cleanliness at pickup',
      days: num((d) => Math.round(d.cleanlinessAtPickup)),
      week: meterWeek(world.cleanliness.weekStart, Math.round(last?.cleanlinessAtPickup ?? world.cleanliness.weekStart)),
    },
    {
      label: 'Crew fatigue at pickup',
      days: num((d) => Math.round(d.fatigueAtPickup)),
      week: meterWeek(world.fatigue.weekStart, Math.round(last?.fatigueAtPickup ?? world.fatigue.weekStart)),
    },
  ];

  const moneyRows: ReportRow[] = [
    { label: 'Day rates', days: money((d) => d.dayRateRevenue), week: formatMoney(sum(days.map((d) => d.dayRateRevenue))) },
    { label: 'Activity add-ons', days: money((d) => d.addOnRevenue), week: formatMoney(sum(days.map((d) => d.addOnRevenue))) },
    { label: 'Revenue', days: money((d) => d.dayRateRevenue + d.addOnRevenue), week: formatMoney(t.revenue), emphasis: true },
    { label: 'Wages', days: money((d) => d.wages), week: formatMoney(t.wages) },
    { label: 'Refunds', days: money((d) => d.refunds), week: formatMoney(t.refunds) },
    { label: 'Vet bills', days: money((d) => d.vetCost), week: formatMoney(t.vetCost) },
    { label: 'Fines', days: money((d) => d.fineCost), week: formatMoney(t.fineCost) },
    { label: 'Cleaning supplies', days: money((d) => d.suppliesCost), week: formatMoney(t.supplies) },
    { label: 'Profit', days: money((d) => d.profit), week: formatMoney(t.profit), emphasis: true },
    { label: 'Cash at close', days: cashCells, week: formatMoney(t.cashEnd) },
  ];

  // The bonus: one row per measure that is on, each day's points, then the total.
  const bonusRows: ReportRow[] = [];
  const dayTotals = days.map(() => 0);
  for (const info of kpiInfo(world)) {
    const setting = spec.kpis[info.key];
    if (!setting.on) continue;
    const unit = KPI_UNITS[info.key];
    const points = days.map((d, i) => (setting.weight * dayDelta(info.key, d, i, report)) / unit);
    points.forEach((p, i) => {
      dayTotals[i] = (dayTotals[i] ?? 0) + p;
    });
    bonusRows.push({
      label: `${info.name}, ${signedWeight(setting.weight)} ${info.per}`,
      days: points.map(formatPoints),
      week: formatPoints((setting.weight * t.kpi[info.key]) / unit),
    });
  }
  if (bonusRows.length === 0) {
    bonusRows.push({
      label: 'No measure is on: the GM is paid nothing.',
      days: days.map(() => '0'),
      week: '0',
    });
  } else {
    bonusRows.push({ label: 'Bonus points this week', days: dayTotals.map(formatPoints), week: formatPoints(t.reward), emphasis: true });
  }

  return {
    columns: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Week'],
    groups: [
      { title: 'Operations', rows: operations },
      { title: 'Money ($)', rows: moneyRows },
      { title: "The GM's bonus", rows: bonusRows },
    ],
  };
}

/**
 * Replaces the table's content: a <thead> row with an empty first cell and the columns; per group a <tbody> whose
 * first row is a heading (<th scope="colgroup" colspan="7"> with the title) followed by one <tr> per row (<th
 * scope="row"> label, five <td> day cells, one <td> week cell); an emphasised row gets class "emphasis". The table
 * gets a <caption> "Monday to Friday, and the week".
 */
export function renderReport(table: HTMLTableElement, data: ReportTable): void {
  const doc = table.ownerDocument;
  const el = (tag: string, text?: string, cls?: string): HTMLElement => {
    const e = doc.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls !== undefined) e.className = cls;
    return e;
  };

  const caption = el('caption', 'Monday to Friday, and the week');
  const head = el('thead');
  const headRow = el('tr');
  headRow.append(el('th'));
  for (const c of data.columns) {
    const th = el('th', c);
    th.setAttribute('scope', 'col');
    headRow.append(th);
  }
  head.append(headRow);

  const bodies = data.groups.map((group) => {
    const tbody = el('tbody');
    const titleRow = el('tr');
    const title = el('th', group.title, 'group');
    title.setAttribute('scope', 'colgroup');
    title.setAttribute('colspan', '7');
    titleRow.append(title);
    tbody.append(titleRow);
    for (const r of group.rows) {
      const tr = el('tr');
      if (r.emphasis === true) tr.className = 'emphasis';
      const label = el('th', r.label);
      label.setAttribute('scope', 'row');
      tr.append(label);
      for (const d of r.days) tr.append(el('td', d));
      tr.append(el('td', r.week, 'week'));
      tbody.append(tr);
    }
    return tbody;
  });

  table.replaceChildren(caption, head, ...bodies);
}
