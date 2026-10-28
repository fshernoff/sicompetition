// The team's prediction as five picks (G5c, D56): the same five things the readout's sentence reports (BRIEF section
// 10), so when the week is over each pick flips to what the GM did, called or missed. The "Why?" box stays free text
// and is the export's `prediction` (D47). Pure: the page renders the picks and the scorecard; nothing here touches
// the DOM. The main thread's seam; the page package renders it.
import { RATES } from '../world/types.ts';
import type { WeekReport } from '../world/types.ts';

export type PickField = 'acceptAll' | 'rate' | 'solo' | 'naps' | 'incidents';

export interface PickOption {
  value: string;
  /** The words on the chip. */
  label: string;
}

export interface PickInfo {
  field: PickField;
  /** The question on the page and on the paper briefs (D54). */
  label: string;
  options: readonly PickOption[];
}

/** The five picks, in the order of the readout's sentence (the rate, which the sentence leaves to the table, second). */
export const PICKS: readonly PickInfo[] = [
  {
    field: 'acceptAll',
    label: 'Days it accepts every booking',
    options: [
      { value: 'none', label: 'None' },
      { value: 'some', label: '1 to 4' },
      { value: 'all', label: 'All 5' },
    ],
  },
  {
    field: 'rate',
    label: 'Day rate',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'standard', label: 'Standard' },
      { value: 'premium', label: 'Premium' },
      { value: 'mix', label: 'A mix' },
    ],
  },
  {
    field: 'solo',
    label: 'Days with 1 staffer on the floor',
    options: [
      { value: '0', label: 'None' },
      { value: '1-2', label: '1 or 2' },
      { value: '3-4', label: '3 or 4' },
      { value: '5', label: 'All 5' },
    ],
  },
  {
    field: 'naps',
    label: 'Nap blocks',
    options: [
      { value: '0', label: 'None' },
      { value: '1-5', label: '1 to 5' },
      { value: '6plus', label: '6 or more' },
    ],
  },
  {
    field: 'incidents',
    label: 'Incidents',
    options: [
      { value: '0-2', label: '0 to 2' },
      { value: '3-6', label: '3 to 6' },
      { value: '7plus', label: '7 or more' },
    ],
  },
];

/**
 * The page's controls (the e2e's contract): one radio group per field, name "pick-<field>", each radio
 * id "pick-<field>-<value>" with its chip as the label; values are safe in an id. After the week: "#scorecard" holds
 * one row per field with data-field and data-called="true|false", and "#called-line" the calledLine. While a pick is
 * missing the button is disabled and "#picks-hint" says "Make all five picks to put the GM to work."
 */
export const PICKS_HINT = 'Make all five picks to put the GM to work.';

/** A team's picks: a value per field, or null while not picked. */
export type Picks = Record<PickField, string | null>;

export function emptyPicks(): Picks {
  return { acceptAll: null, rate: null, solo: null, naps: null, incidents: null };
}

/** True when every one of the five is picked: the button waits for it (predict before the run, D56). */
export function picksComplete(picks: Picks): boolean {
  return PICKS.every((p) => picks[p.field] !== null);
}

export interface PickResult {
  field: PickField;
  label: string;
  /** The team's pick, as its chip's words, or null if none was made. */
  picked: string | null;
  /**
   * What the GM did, as the option's words, with the exact number after a range ("1 to 4 (3)", "6 or more (9)",
   * "3 or 4 (4)") and alone after an exact option ("None", "All 5"); the rate as "Premium", or "A mix (low × 1,
   * premium × 4)" in low, standard, premium order; "Closed all week" when no day opened.
   */
  actual: string;
  /** The option value the week falls in, or null when it falls in none (the rate on a week closed every day). */
  actualValue: string | null;
  called: boolean;
}

/** The rate on the open days: one rate, 'mix', or null when no day opened (a closed day keeps its planned rate). */
function rateValue(report: WeekReport): string | null {
  const rates = new Set(report.days.filter((d) => !d.closed && d.rate !== null).map((d) => d.rate));
  if (rates.size === 0) return null;
  return rates.size === 1 ? ([...rates][0] as string) : 'mix';
}

/** The option a week falls in, for each field (null for the rate when no day opened). */
export function actualValue(field: PickField, report: WeekReport): string | null {
  const t = report.totals;
  switch (field) {
    case 'acceptAll':
      return t.daysAcceptedAll === 0 ? 'none' : t.daysAcceptedAll >= 5 ? 'all' : 'some';
    case 'rate':
      return rateValue(report);
    case 'solo':
      return t.daysOneStaffer === 0 ? '0' : t.daysOneStaffer <= 2 ? '1-2' : t.daysOneStaffer <= 4 ? '3-4' : '5';
    case 'naps':
      return t.napBlocks === 0 ? '0' : t.napBlocks <= 5 ? '1-5' : '6plus';
    case 'incidents':
      return t.incidents <= 2 ? '0-2' : t.incidents <= 6 ? '3-6' : '7plus';
  }
}

const EXACT = new Set(['none', 'all', '0', '5', 'low', 'standard', 'premium']);
const COUNT: Record<PickField, (t: WeekReport['totals']) => number> = {
  acceptAll: (t) => t.daysAcceptedAll,
  rate: () => 0,
  solo: (t) => t.daysOneStaffer,
  naps: (t) => t.napBlocks,
  incidents: (t) => t.incidents,
};

function actualWords(info: PickInfo, value: string | null, report: WeekReport): string {
  if (value === null) return 'Closed all week';
  const label = info.options.find((o) => o.value === value)?.label ?? value;
  if (info.field === 'rate') {
    if (value !== 'mix') return label;
    const open = report.days.filter((d) => !d.closed);
    const parts = RATES.map((r) => ({ r, n: open.filter((d) => d.rate === r).length }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.r} × ${x.n}`);
    return `${label} (${parts.join(', ')})`;
  }
  if (EXACT.has(value)) return label;
  return `${label} (${COUNT[info.field](report.totals)})`;
}

/** Each pick beside what the GM did, in PICKS order. */
export function checkPrediction(picks: Picks, report: WeekReport): PickResult[] {
  return PICKS.map((info) => {
    const value = actualValue(info.field, report);
    const pickedValue = picks[info.field];
    return {
      field: info.field,
      label: info.label,
      picked: info.options.find((o) => o.value === pickedValue)?.label ?? null,
      actual: actualWords(info, value, report),
      actualValue: value,
      called: value !== null && pickedValue === value,
    };
  });
}

/** "You called 4 of 5." (and "You called 1 of 5.", "You called 0 of 5."). */
export function calledLine(results: readonly PickResult[]): string {
  return `You called ${results.filter((r) => r.called).length} of 5.`;
}
