// The weekly P&L and operations report as a table (BRIEF section 10.1; the G4 plan names the groups, the labels and
// the formats). `reportTable` is a pure function from a WeekReport, the plan and the config to rows; `renderReport`
// puts the rows into a <table>. No DOM access at module top level: reportTable is tested under node.
// Seam written by the main thread; WP2 (Sonnet) builds it.
import { kpiInfo, signedDollars } from '../world/bonusPlan.ts';
import { BONUS_ICON_PATHS, MEASURE_ICON_PATHS } from './icons.ts';
import { KPI_UNITS, RATES } from '../world/types.ts';
import type { DayReport, FloorActivity, KpiKey, RewardSpec, WeekReport, WorldConfig } from '../world/types.ts';

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
  title: string; // 'Operations' | 'Money ($)' | "The GM's pay under your plan (the profit above is before this pay)"
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
 * The GM's bonus in dollars (D45): rounded to cents (Math.round(x × 100) ÷ 100; profit is whole dollars ÷ 100 × an
 * integer weight, so cents are exact), the sign always shown for a non-zero value with a typographic minus, en-US
 * commas, and cents only when there are cents: "+$123.50", "+$9.78", "+$113", "−$35", "+$1,234.50", "$0" (and "$0"
 * for anything that rounds to zero).
 */
export function formatBonus(dollars: number): string {
  const r = Math.round(dollars * 100) / 100;
  if (r === 0) return '$0';
  const abs = Math.abs(r);
  const body = Number.isInteger(abs) ? abs.toLocaleString('en-US') : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return r > 0 ? `+$${body}` : `−$${body}`;
}

/**
 * Dollars and cents with no plus sign (G5d: the owners' bottom line): rounded to cents, en-US commas, a typographic
 * minus, and cents only when there are cents: "$4,853.70", "$1,017", "−$120", "−$35.50", "$0".
 */
export function formatDollars(dollars: number): string {
  const r = Math.round(dollars * 100) / 100;
  if (r === 0) return '$0';
  const abs = Math.abs(r);
  const body = Number.isInteger(abs) ? abs.toLocaleString('en-US') : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return r < 0 ? `−$${body}` : `$${body}`;
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

export interface HeadlineTile {
  /** The tile's caption. */
  label: string;
  /** The big number, in the table's own formats. */
  value: string;
}

/**
 * The five numbers the report opens with (G5c), above the table, in this order and these words:
 *   "Profit this week" — formatMoney(totals.profit): "$5,393";
 *   "The GM's bonus" — formatBonus(totals.reward): "+$539.30";
 *   "Incidents" — String(totals.incidents): "7";
 *   "Reputation" — "50 → 32", reputationStart → reputationEnd (the change is the table's to give);
 *   "Blocks over 15 dogs per staffer" — String(totals.blocksOverRatio): "16" (the 15 is world.bookings.legalRatio).
 * The bonus is the plan's own total (totals.reward); `spec` is accepted for symmetry with reportTable. WP3 (Sonnet).
 */
export function headlineTiles(report: WeekReport, spec: RewardSpec, world: WorldConfig): HeadlineTile[] {
  void spec;
  const t = report.totals;
  return [
    { label: 'Profit this week', value: formatMoney(t.profit) },
    { label: "The GM's bonus", value: formatBonus(t.reward) },
    { label: 'Incidents', value: String(t.incidents) },
    { label: 'Reputation', value: `${t.reputationStart} → ${t.reputationEnd}` },
    { label: `Blocks over ${world.bookings.legalRatio} dogs per staffer`, value: String(t.blocksOverRatio) },
  ];
}

/** The tiles' icons, in tile order: the measures' own shapes (src/ui/icons.ts), the bonus as the money bag (G5c: one icon per measure). */
const TILE_ICONS: readonly string[] = [
  MEASURE_ICON_PATHS.profit,
  BONUS_ICON_PATHS,
  MEASURE_ICON_PATHS.incidents,
  MEASURE_ICON_PATHS.reputation,
  MEASURE_ICON_PATHS.overRatio,
];

/** The arrow of "50 → 32" drawn as a glyph (U+2192 is outside the bundled Latin face, so a display size draws it). */
const ARROW_SVG =
  '<svg class="arrow-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></svg>';

/**
 * Appends `text` to `el`, each " → " drawn as the arrow glyph with the character itself kept, visually hidden, so the
 * element's text (and what a screen reader says) is unchanged: "50 → 32".
 */
export function appendArrowed(el: HTMLElement, text: string): void {
  const doc = el.ownerDocument;
  text.split('→').forEach((part, i) => {
    if (i > 0) {
      const arrow = doc.createElement('span');
      arrow.className = 'arrow';
      arrow.innerHTML = ARROW_SVG;
      const word = doc.createElement('span');
      word.className = 'visually-hidden';
      word.textContent = '→';
      arrow.appendChild(word);
      el.appendChild(arrow);
    }
    if (part !== '') el.append(part);
  });
}

/** The GM's bonus as the report prints it (G5d): always with cents, "+$128.00", "−$35.00", "$0.00". */
export function bonusWithCents(text: string): string {
  return /^[+−]?\$[\d,]+$/.test(text) ? `${text}.00` : text;
}

/** What the headline adds to headlineTiles' five cells (G5d, round 1): the owners' bottom line and a week's blocks. */
export interface TileNotes {
  /** The week's profit after the GM's bonus, through formatDollars ("$4,853.70"). */
  afterBonus: string;
  /** The blocks in a week (five days of four), the denominator of the blocks over the limit ("16 of 20"). */
  blocks: number;
}

/**
 * Renders the headline: one strip of five cells, profit first on navy with "Before the GM's bonus" and the bottom line
 * ("After the GM's bonus: $4,853.70") under it, then the GM's bonus (always with cents, "Paid to the GM"), then
 * incidents, reputation and the blocks over the limit ("16 of 20"), each a hurt (a red wash and figure, with its icon
 * and label as the cue beyond colour) when it went against the business. The cells' values and labels are
 * headlineTiles' own.
 */
export function renderTiles(container: HTMLElement, tiles: HeadlineTile[], notes?: TileNotes): void {
  const doc = container.ownerDocument;
  const sub = (card: HTMLElement, text: string, cls = 'tile-sub'): void => {
    const line = doc.createElement('div');
    line.className = cls;
    line.textContent = text;
    card.appendChild(line);
  };
  const nodes = tiles.map((tile, i) => {
    const card = doc.createElement('div');
    card.className = 'tile';
    const label = doc.createElement('div');
    label.className = 'tile-label';
    const icon = doc.createElement('span');
    icon.className = 'tile-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false">${TILE_ICONS[i % TILE_ICONS.length] ?? ''}</svg>`;
    label.append(icon, tile.label);
    const value = doc.createElement('div');
    value.className = 'tile-value';
    appendArrowed(value, i === 1 ? bonusWithCents(tile.value) : tile.value);
    if (i === 4 && notes !== undefined) {
      const of = doc.createElement('span');
      of.className = 'tile-of';
      of.textContent = ` of ${notes.blocks}`;
      value.appendChild(of);
    }
    card.append(label, value);
    if (i === 0) {
      card.classList.add('tile-profit');
      sub(card, "Before the GM's bonus");
      if (notes !== undefined) sub(card, `After the GM's bonus: ${notes.afterBonus}`, 'tile-sub tile-after');
    }
    if (i === 1) {
      card.classList.add('tile-bonus');
      sub(card, 'Paid to the GM');
    }
    const hurt =
      (i === 2 && Number(tile.value) > 0) ||
      (i === 3 && /^(\d+) → (\d+)$/.test(tile.value) && Number(tile.value.split(' → ')[1]) < Number(tile.value.split(' → ')[0])) ||
      (i === 4 && Number(tile.value) > 0);
    if (hurt) card.classList.add('hurt');
    return card;
  });
  container.replaceChildren(...nodes);
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
 * "nap 0, clean 0, walk 0" from the totals); Dogs per staffer, the day's average (on the floor, over the day's
 * blocks: one decimal from DayReport.avgRatio, "—" when 0; week avgDogsPerStaffer); Blocks over 15 dogs per staffer; Incidents; Dogs sent home sick; Inspector visits (fines
 * counted); Blocks with crew fatigue above 70%; Reputation at pickup (week "50 → 21 (−29)" from reputationStart to
 * reputationEnd); Cleanliness at pickup (Math.round; week "80 → 0 (−80)" from cleanliness.weekStart to Friday's
 * pickup); Crew fatigue at pickup (Math.round; week "20 → 100 (+80)" from fatigue.weekStart). Counts in the week
 * column are the totals of the report. A closed day keeps its requests, its scheduled crew and its pickup meters.
 *
 * Money ($): Day rates; Activity add-ons; Revenue (bold; day rates + add-ons); Wages; Refunds; Vet bills; Fines;
 * Cleaning supplies; Profit (bold); Cash at close (cash.weekStart plus the profit so far, carried unchanged over a
 * closed day; week: the Friday figure, totals.cashEnd). All through formatMoney.
 *
 * The GM's pay under your plan (the profit above is before this pay; the P&L does not deduct it): one row per
 * measure that is on, in KPI_KEYS order, labelled "<name>, <dollar amount> <per>" with the name and the per-hint of
 * kpiInfo(world) and the weight in dollars as the editor shows it (signedDollars: "+$10", "−$5", "$0"):
 * "Profit today ($), +$10 per $100", "Incidents, −$5 per incident", "Blocks over the legal ratio, −$5 per block". The
 * day cells are the dollars that measure earned that day: weight × (the day's delta ÷ KPI_UNITS[key]), where the
 * day's deltas are DayReport.profit, accepted, incidents, blocksFatigueOver70, blocksOverRatio, and for reputation
 * the change since the previous pickup (reputationAtPickup[d] − reputationAtPickup[d − 1], Monday against
 * totals.reputationStart; a closed day's delta is its closure hit). The week cell is weight × totals.kpi[key] ÷
 * unit. Then "The GM's bonus ($)" (bold): the day cells sum the measures' day cells; the week cell is
 * totals.reward (authoritative; it equals the sum when `spec` is the plan the week was run under). Last, "Profit after
 * the GM's bonus ($)" (bold, G5d): each day's profit less that day's bonus, and the week's profit less the week's
 * reward, through formatDollars ("$4,853.70"). A plan with nothing on has the one row "No measure is on: the GM is
 * paid nothing." with "$0" in every cell. The measures and the bonus through formatBonus ("+$113", "+$97.80",
 * "−$35", "$0").
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
      label: "Dogs per staffer, the day's average",
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

  // The GM's pay: one row per measure that is on, each day's dollars, then the total.
  const bonusRows: ReportRow[] = [];
  const dayTotals = days.map(() => 0);
  for (const info of kpiInfo(world)) {
    const setting = spec.kpis[info.key];
    if (!setting.on) continue;
    const unit = KPI_UNITS[info.key];
    const dollars = days.map((d, i) => (setting.weight * dayDelta(info.key, d, i, report)) / unit);
    dollars.forEach((p, i) => {
      dayTotals[i] = (dayTotals[i] ?? 0) + p;
    });
    bonusRows.push({
      label: `${info.name}, ${signedDollars(setting.weight)} ${info.per}`,
      days: dollars.map(formatBonus),
      week: formatBonus((setting.weight * t.kpi[info.key]) / unit),
    });
  }
  if (bonusRows.length === 0) {
    bonusRows.push({
      label: 'No measure is on: the GM is paid nothing.',
      days: days.map(() => formatBonus(0)),
      week: formatBonus(0),
    });
  } else {
    bonusRows.push({ label: "The GM's bonus ($)", days: dayTotals.map(formatBonus), week: formatBonus(t.reward), emphasis: true });
    // The owners' bottom line (G5d): each day's profit less that day's bonus, and the week's.
    bonusRows.push({
      label: "Profit after the GM's bonus ($)",
      days: days.map((d, i) => formatDollars(d.profit - (dayTotals[i] ?? 0))),
      week: formatDollars(t.profit - t.reward),
      emphasis: true,
    });
  }

  return {
    columns: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Week'],
    groups: [
      { title: 'Operations', rows: operations },
      { title: 'Money ($)', rows: moneyRows },
      { title: "The GM's pay under your plan (the profit above is before this pay)", rows: bonusRows },
    ],
  };
}

/** A cell that reads as nothing happened ("$0", "0", "$0.00", "—"): set in the muted ink, still at 4.5:1. */
const ZERO = /^(\$0(\.00)?|0|—)$/;

/**
 * Replaces the table's content as a P&L (G5d, Acceptance 5): a <thead> row with an empty first cell and the columns;
 * then the groups money first, in this order: Money ($), the GM's pay under your plan, Operations. Per group a
 * <tbody> whose first row is a heading (<th scope="colgroup" colspan="7"> with the title, its parenthesis set as a
 * note) followed by one <tr> per row (<th scope="row"> label, five <td> day cells, one <td> week cell). Rows: Revenue
 * and the bonus total "emphasis", Profit "profit" (a ruled band), the profit after the GM's bonus "bottom-line"; the
 * GM's pay always with cents ("+$128.00"); the activities with their key ("asked → ran") under the label, each block
 * on its own line; a cell that reads as nothing happened "zero"; a block over the legal limit "warn". The table gets a
 * <caption> "Monday to Friday, and the week".
 */
export function renderReport(table: HTMLTableElement, data: ReportTable): void {
  const doc = table.ownerDocument;
  const el = (tag: string, text?: string, cls?: string): HTMLElement => {
    const e = doc.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls !== undefined) e.className = cls;
    return e;
  };

  // The activities cell: each block on its own line, the " · " kept (hidden) so textContent is unchanged; a fallback
  // ("walk → free play") breaks only at its arrow, never inside an activity's name (G5d round 1, row 16).
  const chips = (td: HTMLElement, text: string): HTMLElement => {
    text.split(' · ').forEach((part, i) => {
      if (i > 0) td.append(el('span', ' · ', 'sep'));
      const block = el('span', undefined, i === 0 ? 'chip muted' : 'chip');
      part.split(' → ').forEach((phrase, k) => {
        if (k > 0) appendArrowed(block, ' → ');
        block.append(el('span', phrase, 'phrase'));
      });
      td.append(block);
    });
    td.classList.add('chips');
    return td;
  };

  const caption = el('caption', 'Monday to Friday, and the week');
  const head = el('thead');
  const headRow = el('tr');
  headRow.append(el('th'));
  for (const c of data.columns) {
    const th = el('th', c, c === 'Week' ? 'week' : undefined);
    th.setAttribute('scope', 'col');
    headRow.append(th);
  }
  head.append(headRow);

  // Money first (the P&L), then the GM's pay, then the operations behind them.
  const ordered = [...data.groups.filter((g) => g.title !== 'Operations'), ...data.groups.filter((g) => g.title === 'Operations')];
  const bodies = ordered.map((group) => {
    const pay = group.title.startsWith("The GM's pay");
    const tbody = el('tbody');
    const titleRow = el('tr');
    const title = el('th', undefined, 'group');
    title.setAttribute('scope', 'colgroup');
    title.setAttribute('colspan', '7');
    const paren = group.title.indexOf(' (');
    if (paren > 0) title.append(group.title.slice(0, paren), el('span', group.title.slice(paren), 'group-note'));
    else title.textContent = group.title;
    titleRow.append(title);
    tbody.append(titleRow);
    for (const r of group.rows) {
      const tr = el('tr');
      if (r.label === 'Profit') tr.className = 'profit';
      else if (r.label.startsWith('Profit after')) tr.className = 'bottom-line';
      else if (r.emphasis === true) tr.className = 'emphasis';
      const label = el('th', r.label);
      label.setAttribute('scope', 'row');
      // The activities' key: a fallback is written as what was asked and what ran.
      if (r.label.startsWith('Activities')) {
        const key = el('span', undefined, 'row-key');
        appendArrowed(key, 'asked → ran');
        label.append(key);
        tr.className = 'activities';
      }
      tr.append(label);
      const overRatio = /^Blocks over /.test(r.label);
      const cell = (text: string, cls?: string): HTMLElement => {
        const shown = pay ? bonusWithCents(text) : text;
        const td = shown.includes(' · ') ? chips(el('td', undefined, cls), shown) : el('td', undefined, cls);
        if (!shown.includes(' · ')) appendArrowed(td, shown);
        if (ZERO.test(shown)) td.classList.add('zero');
        return td;
      };
      for (const d of r.days) {
        const td = cell(d);
        if (overRatio && Number(d) > 0) td.classList.add('warn');
        tr.append(td);
      }
      const week = cell(r.week, 'week');
      if (overRatio && Number(r.week) > 0) week.classList.add('warn');
      tr.append(week);
      tbody.append(tr);
    }
    return tbody;
  });

  table.replaceChildren(caption, head, ...bodies);
}
