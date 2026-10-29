// The weekly P&L and operations report as a table: a pure function from a WeekReport, the plan and the config to
// rows (BRIEF section 10.1 names every line, its groups, its labels and its formats).
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { carefulPolicy, dayPlanPolicy, recklessCoveredPolicy, recklessPolicy, stationaryPolicy } from '../../src/sim/policies.ts';
import { formatBonus, formatDollars, formatMoney, reportTable } from '../../src/ui/report.ts';
import type { ReportRow, ReportTable } from '../../src/ui/report.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import type { DayPlan } from '../../src/world/types.ts';
import { config, round1, spec } from '../helpers.ts';

const covered = runEpisode(config, round1, recklessCoveredPolicy, episodeSeeds(1, 0)).report;
const literal = runEpisode(config, round1, recklessPolicy, episodeSeeds(1, 0)).report; // closes on Thursday
const careful = runEpisode(config, round1, carefulPolicy, episodeSeeds(1, 0)).report;
const soloWalk = runEpisode(
  config,
  round1,
  stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 1 }, ['walk', 'structuredPlay', 'nap']),
  episodeSeeds(1, 0),
).report; // every walk and every class falls back

// G5d: the activities as three one-line rows under a sub-heading, and their week as counts in words
const ACTIVITIES = 'Activities (drop-off is always arrivals)';
const BLOCKS = ['Late morning', 'Afternoon', 'Pickup'] as const;
const MIX = 'Naps, cleans and walks';
const FOOTNOTE = "A walk takes dogs and a staffer off the floor, so a day's average can differ from dogs ÷ crew.";
const PAY = "The GM's pay under your plan";
const BOTTOM = "The owners' bottom line ($)";

function rows(t: ReportTable): ReportRow[] {
  return t.groups.flatMap((g) => g.rows);
}
function row(t: ReportTable, label: string): ReportRow {
  const r = rows(t).find((x) => x.label === label);
  if (r === undefined) throw new Error(`no row "${label}" among ${rows(t).map((x) => x.label).join(' | ')}`);
  return r;
}
const cells = (t: ReportTable, label: string): string[] => [...row(t, label).days, row(t, label).week];

describe('formatMoney and formatPoints', () => {
  it('writes whole dollars with commas and a typographic minus', () => {
    expect(formatMoney(1234)).toBe('$1,234');
    expect(formatMoney(-120)).toBe('−$120');
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(1234.5)).toBe('$1,235');
    expect(formatMoney(-0.2)).toBe('$0');
  });

  it('writes the bonus as signed dollars, with cents only when there are cents (D45)', () => {
    expect(formatBonus(123.45)).toBe('+$123.45');
    expect(formatBonus(123.456)).toBe('+$123.46');
    expect(formatBonus(113)).toBe('+$113');
    expect(formatBonus(97.80000000000001)).toBe('+$97.80');
    expect(formatBonus(9.78)).toBe('+$9.78');
    expect(formatBonus(10.6)).toBe('+$10.60');
    expect(formatBonus(-35)).toBe('−$35');
    expect(formatBonus(0)).toBe('$0');
    expect(formatBonus(0.004)).toBe('$0');
    expect(formatBonus(-0.004)).toBe('$0');
    expect(formatBonus(4881 / 10)).toBe('+$488.10');
    expect(formatBonus(1234.5)).toBe('+$1,234.50');
    expect(formatBonus(-1234)).toBe('−$1,234');
  });
});

describe('reportTable: shape', () => {
  const table = reportTable(covered, round1, config);

  it('has a column per day and the week, and four groups with every line of section 10', () => {
    expect(table.columns).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Week']);
    expect(table.groups.map((g) => g.title)).toEqual(['Operations', 'Money ($)', PAY, BOTTOM]);
    expect(table.groups[0]?.rows.map((r) => r.label)).toEqual([
      'Requests',
      'Dogs accepted',
      'Accepted every booking',
      'Day rate',
      'Crew scheduled',
      'Crew on the floor',
      ACTIVITIES,
      ...BLOCKS,
      MIX,
      "Dogs per staffer, the day's average",
      'Blocks over 15 dogs per staffer',
      'Incidents',
      'Dogs sent home sick',
      'Inspector visits',
      'Blocks with crew fatigue above 70%',
      'Reputation at pickup',
      'Cleanliness at pickup',
      'Crew fatigue at pickup',
    ]);
    expect(table.groups[1]?.rows.map((r) => r.label)).toEqual([
      'Day rates',
      'Activity add-ons',
      'Revenue',
      'Wages',
      'Refunds',
      'Vet bills',
      'Fines',
      'Cleaning supplies',
      "Profit before the GM's bonus",
    ]);
    expect(table.groups[2]?.rows.map((r) => r.label)).toEqual(['Profit today ($), +$10 per $100', "The GM's bonus ($)"]);
    expect(table.groups[3]?.rows.map((r) => r.label)).toEqual(['Paid to the GM', "Profit after the GM's bonus", 'Cash at close']);
    for (const r of rows(table)) expect(r.days, r.label).toHaveLength(5);
    expect(rows(table).filter((r) => r.emphasis === true).map((r) => r.label)).toEqual([
      'Revenue',
      "Profit before the GM's bonus",
      "The GM's bonus ($)",
      "Profit after the GM's bonus",
    ]);
  });

  it("explains under the table why a day's average can differ from dogs ÷ crew (G5d)", () => {
    expect(table.footnote).toBe(FOOTNOTE);
  });

  it('takes the 15, the 70 and the $2,000 from the config', () => {
    const other = structuredClone(config);
    other.bookings.legalRatio = 12;
    other.fatigue.kpiThreshold = 60;
    other.cash.weekStart = 500;
    const t = reportTable(covered, round1, other);
    expect(rows(t).map((r) => r.label)).toContain('Blocks over 12 dogs per staffer');
    expect(rows(t).map((r) => r.label)).toContain('Blocks with crew fatigue above 60%');
    expect(cells(t, 'Cash at close')[0]).toBe('$1,517'); // $500 + Monday's $1,130 − the GM's $113
  });
});

describe('reportTable: the covered reckless week on seed 1', () => {
  const table = reportTable(covered, round1, config);

  it('fills the operations lines', () => {
    expect(cells(table, 'Requests')).toEqual(['20', '19', '17', '16', '16', '88']);
    expect(cells(table, 'Dogs accepted')).toEqual(['20', '19', '17', '16', '16', '88']);
    expect(cells(table, 'Accepted every booking')).toEqual(['yes', 'yes', 'yes', 'yes', 'yes', '5 of 5 days']);
    expect(cells(table, 'Day rate')).toEqual(['premium $52', 'premium $52', 'premium $52', 'premium $52', 'premium $52', 'premium × 5']);
    expect(cells(table, 'Crew scheduled')).toEqual(['1', '1', '1', '2', '1', '6 staff-days']);
    expect(cells(table, 'Crew on the floor')).toEqual(['1', '1', '1', '2', '1', '1 staffer on 4 days']);
    expect(cells(table, ACTIVITIES)).toEqual(['', '', '', '', '', '']);
    for (const block of BLOCKS) expect(cells(table, block), block).toEqual(['free play', 'free play', 'free play', 'free play', 'free play', '']);
    expect(cells(table, MIX)).toEqual(['', '', '', '', '', 'no naps · no cleans · no walks']);
    expect(cells(table, "Dogs per staffer, the day's average")).toEqual(['20.0', '19.0', '17.0', '8.0', '16.0', '16.0']);
    expect(cells(table, 'Blocks over 15 dogs per staffer')).toEqual(['4', '4', '4', '0', '4', '16']);
    expect(cells(table, 'Incidents')).toEqual(['4', '2', '2', '0', '1', '9']);
    expect(cells(table, 'Dogs sent home sick')).toEqual(['0', '1', '2', '2', '1', '6']);
    expect(cells(table, 'Inspector visits')).toEqual(['0', '1', '0', '0', '0', '1']);
    expect(cells(table, 'Blocks with crew fatigue above 70%')).toEqual(['0', '1', '3', '4', '4', '12']);
    expect(cells(table, 'Reputation at pickup')).toEqual(['42', '32', '26', '24', '21', '50 → 21 (−29)']);
    expect(cells(table, 'Cleanliness at pickup')).toEqual(['40', '12', '0', '0', '0', '80 → 0 (−80)']);
    expect(cells(table, 'Crew fatigue at pickup')).toEqual(['56', '75', '90', '87', '100', '20 → 100 (+80)']);
  });

  it('fills the money lines, every one from the report', () => {
    expect(cells(table, 'Day rates')).toEqual(['$1,040', '$988', '$884', '$832', '$832', '$4,576']);
    expect(cells(table, 'Activity add-ons')).toEqual(['$600', '$570', '$510', '$480', '$480', '$2,640']);
    expect(cells(table, 'Revenue')).toEqual(['$1,640', '$1,558', '$1,394', '$1,312', '$1,312', '$7,216']);
    expect(cells(table, 'Wages')).toEqual(['$300', '$300', '$300', '$600', '$300', '$1,800']);
    expect(cells(table, 'Refunds')).toEqual(['$60', '$30', '$30', '$0', '$15', '$135']);
    expect(cells(table, 'Vet bills')).toEqual(['$150', '$0', '$0', '$0', '$0', '$150']);
    expect(cells(table, 'Fines')).toEqual(['$0', '$250', '$0', '$0', '$0', '$250']);
    expect(cells(table, 'Cleaning supplies')).toEqual(['$0', '$0', '$0', '$0', '$0', '$0']);
    expect(cells(table, "Profit before the GM's bonus")).toEqual(['$1,130', '$978', '$1,064', '$712', '$997', '$4,881']);
    expect(row(table, "Profit before the GM's bonus").week).toBe(formatMoney(covered.totals.profit));
  });

  it('pays the Round 1 bonus per day, in dollars, and sums to the total reward', () => {
    expect(cells(table, 'Profit today ($), +$10 per $100')).toEqual(['+$113', '+$97.80', '+$106.40', '+$71.20', '+$99.70', '+$488.10']);
    expect(cells(table, "The GM's bonus ($)")).toEqual(['+$113', '+$97.80', '+$106.40', '+$71.20', '+$99.70', '+$488.10']);
    expect(row(table, "The GM's bonus ($)").week).toBe(formatBonus(covered.totals.reward));
  });

  it("ends with the owners' bottom line: the GM paid as a cost, the profit after it, and cash that paid it (G5d)", () => {
    expect(table.groups[3]?.title).toBe(BOTTOM);
    expect(cells(table, 'Paid to the GM')).toEqual(['−$113', '−$97.80', '−$106.40', '−$71.20', '−$99.70', '−$488.10']);
    expect(row(table, "Profit after the GM's bonus").emphasis).toBe(true);
    expect(cells(table, "Profit after the GM's bonus")).toEqual(['$1,017', '$880.20', '$957.60', '$640.80', '$897.30', '$4,392.90']);
    // the page's cash pays the GM as it earns (BRIEF section 5): $2,000 plus the profit after the bonus, running
    expect(cells(table, 'Cash at close')).toEqual(['$3,017', '$3,897.20', '$4,854.80', '$5,495.60', '$6,392.90', '$6,392.90']);
    expect(row(table, 'Cash at close').week).toBe(formatDollars(covered.totals.cashEnd - covered.totals.reward));
    expect(formatDollars(covered.totals.profit - covered.totals.reward)).toBe('$4,392.90');
    expect([formatDollars(-120), formatDollars(0), formatDollars(4853.7), formatDollars(-35.5)]).toEqual(['−$120', '$0', '$4,853.70', '−$35.50']);
  });
});

describe('reportTable: other weeks', () => {
  it('marks a closed day in every line that depends on the floor', () => {
    const t = reportTable(literal, round1, config);
    expect(cells(t, 'Requests')[3]).toBe('16');
    expect(cells(t, 'Dogs accepted')[3]).toBe('0');
    expect(cells(t, 'Accepted every booking')).toEqual(['yes', 'yes', 'yes', 'closed', 'yes', '4 of 5 days']);
    expect(cells(t, 'Day rate')[3]).toBe('closed');
    expect(cells(t, 'Day rate')[5]).toBe('premium × 4');
    expect(cells(t, 'Crew scheduled')[3]).toBe('1');
    expect(cells(t, 'Crew scheduled')[5]).toBe('5 staff-days');
    expect(cells(t, 'Crew on the floor')[3]).toBe('0, called out');
    expect(cells(t, 'Crew on the floor')[5]).toBe('1 staffer on 4 days');
    for (const block of BLOCKS) expect(cells(t, block)[3], block).toBe('closed');
    expect(cells(t, "Dogs per staffer, the day's average")[3]).toBe('—');
    expect(cells(t, 'Incidents')[3]).toBe('0');
    expect(cells(t, 'Reputation at pickup')[3]).toBe('16');
    expect(cells(t, 'Cleanliness at pickup')[3]).toBe('10');
    expect(cells(t, 'Crew fatigue at pickup')[3]).toBe('75');
    for (const label of ['Day rates', 'Activity add-ons', 'Revenue', 'Wages', 'Refunds', 'Vet bills', 'Fines', 'Cleaning supplies', "Profit before the GM's bonus"]) {
      expect(cells(t, label)[3], label).toBe('$0');
    }
    expect(cells(t, 'Cash at close')[3]).toBe(cells(t, 'Cash at close')[2]);
    expect(cells(t, 'Profit today ($), +$10 per $100')[3]).toBe('$0');
    expect(cells(t, 'Paid to the GM')[3]).toBe('$0');
  });

  it('pays a reputation measure on a closed day: the closure is a reputation change', () => {
    const plan = spec({ reputation: 5 });
    const report = runEpisode(config, plan, recklessPolicy, episodeSeeds(1, 0)).report;
    const t = reportTable(report, plan, config);
    expect(cells(t, 'Reputation at pickup')).toEqual(['42', '32', '26', '16', '11', '50 → 11 (−39)']);
    expect(cells(t, 'Reputation change, +$5 per point')).toEqual(['−$40', '−$50', '−$30', '−$50', '−$25', '−$195']);
    expect(row(t, "The GM's bonus ($)").week).toBe(formatBonus(report.totals.reward));
  });

  it('shows a fallback as what ran, with what was asked, on one line', () => {
    const t = reportTable(soloWalk, round1, config);
    expect(BLOCKS.map((b) => cells(t, b)[0])).toEqual(['free play (walk asked)', 'free play (structured play asked)', 'nap']);
    expect(BLOCKS.map((b) => cells(t, b)[3])).toEqual(['closed', 'closed', 'closed']);
    expect(cells(t, MIX)[5]).toBe('4 naps · no cleans · no walks');
    expect(cells(t, 'Cleanliness at pickup')).toEqual(['48', '28', '10', '20', '0', '80 → 0 (−80)']);
  });

  it('renders the careful week', () => {
    const t = reportTable(careful, round1, config);
    expect(cells(t, 'Day rate')).toEqual(['standard $40', 'standard $40', 'standard $40', 'standard $40', 'standard $40', 'standard × 5']);
    expect(cells(t, 'Crew on the floor')[5]).toBe('1 staffer on 0 days');
    expect(cells(t, 'Crew scheduled')[5]).toBe('10 staff-days');
    expect(BLOCKS.map((b) => cells(t, b)[0])).toEqual(['structured play', 'nap', 'clean']);
    expect(BLOCKS.map((b) => cells(t, b)[4])).toEqual(['structured play', 'nap', 'clean']);
    expect(cells(t, MIX)[5]).toBe('5 naps · 5 cleans · no walks');
    expect(cells(t, 'Cleaning supplies')).toEqual(['$250', '$250', '$250', '$250', '$250', '$1,250']);
    expect(cells(t, "Dogs per staffer, the day's average")).toEqual(['10.0', '10.0', '10.0', '10.0', '10.0', '10.0']);
    expect(cells(t, "The GM's bonus ($)")[5]).toBe('+$73.50');
  });

  it('shows mixed rates as counts in the week column, and a day that turned bookings away', () => {
    // Monday: the safe cap with one staffer at the low rate (10 of 20 accepted); then help every day at premium.
    const help: DayPlan = { bookings: 'all', rate: 'premium', staff: 2 };
    const free = ['freePlay', 'freePlay', 'freePlay'] as const;
    const t = reportTable(
      runEpisode(config, round1, dayPlanPolicy([{ bookings: 'safe', rate: 'low', staff: 1 }, help, help, help, help], [free, free, free, free, free]), episodeSeeds(1, 0)).report,
      round1,
      config,
    );
    expect(cells(t, 'Day rate')[0]).toBe('low $28');
    expect(cells(t, 'Day rate')[1]).toBe('premium $52');
    expect(cells(t, 'Day rate')[5]).toBe('low × 1, premium × 4');
    expect(cells(t, 'Dogs accepted')[0]).toBe('10');
    expect(cells(t, 'Accepted every booking')).toEqual(['no', 'yes', 'yes', 'yes', 'yes', '4 of 5 days']);
    expect(cells(t, 'Crew on the floor')[5]).toBe('1 staffer on 1 day');
  });
});

describe('reportTable: the bonus group follows the plan', () => {
  it('lists every measure that is on, with its weight, and pays the signed deltas', () => {
    const balanced = spec({ profit: 10, incidents: -5, overRatio: -5 });
    const report = runEpisode(config, balanced, recklessCoveredPolicy, episodeSeeds(1, 0)).report;
    const t = reportTable(report, balanced, config);
    expect(t.groups[2]?.rows.map((r) => r.label)).toEqual([
      'Profit today ($), +$10 per $100',
      'Incidents, −$5 per incident',
      'Blocks over 15 dogs per staffer, −$5 per block',
      "The GM's bonus ($)",
    ]);
    expect(cells(t, 'Incidents, −$5 per incident')).toEqual(['−$20', '−$10', '−$10', '$0', '−$5', '−$45']);
    expect(cells(t, 'Blocks over 15 dogs per staffer, −$5 per block')).toEqual(['−$20', '−$20', '−$20', '$0', '−$20', '−$80']);
    expect(cells(t, "The GM's bonus ($)")).toEqual(['+$73', '+$67.80', '+$76.40', '+$71.20', '+$74.70', '+$363.10']);
    expect(row(t, "The GM's bonus ($)").week).toBe(formatBonus(report.totals.reward));
  });

  it('pays reputation on the change since the previous pickup, and dogs served, fatigue blocks', () => {
    const plan = spec({ reputation: 5, dogsServed: 1, fatigue: -2 });
    const report = runEpisode(config, plan, recklessCoveredPolicy, episodeSeeds(1, 0)).report;
    const t = reportTable(report, plan, config);
    expect(t.groups[2]?.rows.map((r) => r.label)).toEqual([
      'Dogs served, +$1 per dog',
      'Reputation change, +$5 per point',
      'Blocks with crew fatigue above 70%, −$2 per block',
      "The GM's bonus ($)",
    ]);
    expect(cells(t, 'Reputation change, +$5 per point')).toEqual(['−$40', '−$50', '−$30', '−$10', '−$15', '−$145']);
    expect(cells(t, 'Dogs served, +$1 per dog')).toEqual(['+$20', '+$19', '+$17', '+$16', '+$16', '+$88']);
    expect(cells(t, 'Blocks with crew fatigue above 70%, −$2 per block')).toEqual(['$0', '−$2', '−$6', '−$8', '−$8', '−$24']);
    expect(row(t, "The GM's bonus ($)").week).toBe(formatBonus(report.totals.reward));
    expect(row(t, "The GM's bonus ($)").week).toBe('−$81');
    expect(row(t, 'Paid to the GM').week).toBe('+$81'); // a negative bonus comes back to the owners
  });

  it('says so when no measure is on', () => {
    const none = spec({});
    const t = reportTable(runEpisode(config, none, recklessCoveredPolicy, episodeSeeds(1, 0)).report, none, config);
    expect(t.groups[2]?.rows.map((r) => r.label)).toEqual(['No measure is on: the GM is paid nothing.']);
    expect(cells(t, 'No measure is on: the GM is paid nothing.')).toEqual(['$0', '$0', '$0', '$0', '$0', '$0']);
    expect(cells(t, 'Paid to the GM')).toEqual(['$0', '$0', '$0', '$0', '$0', '$0']);
    expect(row(t, "Profit after the GM's bonus").week).toBe(row(t, "Profit before the GM's bonus").week);
  });

  it('ignores a measure that is off whatever its weight, names a weight of 1 or 0 as the editor does, and keeps two decimals', () => {
    const plan = spec({ profit: 1, incidents: 0 });
    plan.kpis.dogsServed = { on: false, weight: 7 };
    const report = runEpisode(config, plan, recklessCoveredPolicy, episodeSeeds(1, 0)).report;
    const t = reportTable(report, plan, config);
    expect(t.groups[2]?.rows.map((r) => r.label)).toEqual(['Profit today ($), +$1 per $100', 'Incidents, $0 per incident', "The GM's bonus ($)"]);
    expect(cells(t, 'Incidents, $0 per incident')).toEqual(['$0', '$0', '$0', '$0', '$0', '$0']);
    expect(cells(t, 'Profit today ($), +$1 per $100')).toEqual(['+$11.30', '+$9.78', '+$10.64', '+$7.12', '+$9.97', '+$48.81']);
    expect(cells(t, "The GM's bonus ($)")).toEqual(['+$11.30', '+$9.78', '+$10.64', '+$7.12', '+$9.97', '+$48.81']);
    expect(row(t, "The GM's bonus ($)").week).toBe(formatBonus(report.totals.reward));
  });
});

describe('reportTable: words', () => {
  it("never says injury, reward, episode or the learner's words", () => {
    const text = JSON.stringify(reportTable(soloWalk, spec({ profit: 10, incidents: -5, reputation: 5, fatigue: -5, overRatio: -5, dogsServed: 5 }), config));
    expect(text).not.toMatch(/injur|reward|episode|epsilon|ε|evaluation|target met|stable|\bpoints\b|practi|train/i);
  });
});

describe('headlineTiles (G5c; G5d: the owners\' bottom line leads)', () => {
  it('opens the report with five numbers in the table\'s own formats, the profit after the GM\'s bonus first', async () => {
    const { headlineTiles } = await import('../../src/ui/report.ts');
    const { Trainer } = await import('../../src/learn/train.ts');
    const { loadDefaultConfig, loadPreset } = await import('../../src/world/config.ts');
    const w = loadDefaultConfig();
    const s = loadPreset('round1').spec;
    const trainer = new Trainer(w, s, 1);
    trainer.runEpisodes(trainer.config.maxEpisodes);
    expect(headlineTiles(trainer.evaluate(), s, w)).toEqual([
      { label: "Profit after the GM's bonus", value: '$4,853.70', note: "$5,393 before the GM's bonus" },
      { label: 'Paid to the GM', value: '−$539.30' },
      { label: 'Incidents', value: '7' },
      { label: 'Reputation', value: '50 → 32' },
      { label: 'Blocks over 15 dogs per staffer', value: '16' },
    ]);
    const patched = structuredClone(w);
    patched.bookings.legalRatio = 12;
    expect(headlineTiles(trainer.evaluate(), s, patched)[4]?.label).toBe('Blocks over 12 dogs per staffer');
  });
});
