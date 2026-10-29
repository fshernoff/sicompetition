// The bonus plan editor on the page: a labelled table of six rows (the name, a toggle, a slider −10..+10 step 1, the
// dollar amount and the unit hint), the limit line (#limit), the plan in words (#plan-words) and the signed-delta hint (#plan-note),
// re-rendered on every input. DOM only: the rules are the pure functions of src/world/bonusPlan.ts. No DOM access at
// module top level: roundFromSearch is tested under node. WP2 (Opus).
//
// How it works: the rows are built once; the plan (a RewardSpec) is the editor's only state besides the preset and
// the enabled flag. Every input goes through a pure rule (toggleKpi, setWeight), replaces the plan, and render()
// rewrites every row, the limit line, the words and the note from the plan, so the page never drifts from it.
import { activeCount, describeBonusPlan, kpiInfo, planLocked, setWeight, signedDollars, signedNote, toggleKpi } from '../world/bonusPlan.ts';
import type { PresetName, RewardPreset } from '../world/config.ts';
import type { KpiKey, RewardSpec, WorldConfig } from '../world/types.ts';
import { BONUS_ICON_PATHS, iconSvg, measureIconSvg, uiIconSvg } from './icons.ts';

export interface Editor {
  readonly element: HTMLElement;
  /** A copy of the plan as it stands; it passes validateRewardSpec. */
  spec(): RewardSpec;
  preset(): RewardPreset;
  /** Resets the rows to the preset (Round 2 and 3 start as Round 1, section 8). Fires onChange. */
  load(preset: RewardPreset): void;
  /**
   * False during a run and for the whole pilot: every toggle and slider disabled. True restores the round's own
   * locks (planLocked, the limit, off measures' sliders).
   */
  setEnabled(enabled: boolean): void;
  /** Called after every change the user makes and after load(). The page clears the previous run's results. */
  onChange: ((spec: RewardSpec) => void) | null;
}

const ROUNDS: Readonly<Record<string, PresetName>> = {
  '1': 'round1',
  '2': 'round2',
  '3': 'round3',
  round1: 'round1',
  round2: 'round2',
  round3: 'round3',
};

/** The round named by ?round=1|2|3 (or round1|round2|round3) on the address; Round 1 for anything else. */
export function roundFromSearch(search: string): PresetName {
  const value = new URLSearchParams(search).get('round');
  return (value !== null && Object.hasOwn(ROUNDS, value) ? ROUNDS[value] : undefined) ?? 'round1';
}

interface Row {
  key: KpiKey;
  row: HTMLElement;
  toggle: HTMLInputElement;
  slider: HTMLInputElement;
  value: HTMLElement;
  state: HTMLElement;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(key: KpiKey): HTMLElement {
  const tile = el('span', `kpi-icon kpi-icon-${key}`);
  tile.setAttribute('aria-hidden', 'true');
  tile.innerHTML = measureIconSvg(key, 20, 1.9); // one icon per measure everywhere (icons.ts)
  return tile;
}

/**
 * What a screen reader says for a slider: the whole amount, its sign and unit in words ("plus 10 dollars per 100
 * dollars of profit", "minus 5 dollars per incident", "0 dollars per dog served"), since the visible unit is
 * aria-hidden beside it.
 */
export function spokenAmount(key: KpiKey, weight: number, world: WorldConfig): string {
  const unit: Record<KpiKey, string> = {
    profit: 'per 100 dollars of profit',
    dogsServed: 'per dog served',
    incidents: 'per incident',
    reputation: 'per point of reputation gained',
    fatigue: `per block the crew's fatigue is above ${world.fatigue.kpiThreshold}%`,
    overRatio: `per block the floor runs over ${world.bookings.legalRatio} dogs per staffer`,
  };
  const n = Math.abs(weight);
  const sign = weight > 0 ? 'plus ' : weight < 0 ? 'minus ' : '';
  return `${sign}${n} ${n === 1 ? 'dollar' : 'dollars'} ${unit[key]}`;
}

/**
 * Writes the plan in words into `el` one clause a line (G5d round 1, row 29): a line starts at each "earns $N" or
 * "loses $N" (with the "and " before the last), the first line keeps "Each day, the GM", and each clause's amount is
 * bold. The element's text is `sentence`, word for word (the e2e and the export read it).
 */
export function planLines(el: HTMLElement, sentence: string): void {
  const doc = el.ownerDocument;
  const starts = [0];
  for (const m of sentence.matchAll(/(?:and )?(?:earns|loses) \$/g)) if (m.index > 0) starts.push(m.index);
  // The first clause stays on the opening line with "Each day, the GM".
  if (starts.length > 1) starts.splice(1, 1);
  const lines = starts.map((at, i) => {
    const text = sentence.slice(at, starts[i + 1] ?? sentence.length);
    const line = doc.createElement('span');
    line.className = 'plan-line';
    const amount = /(?:earns|loses) (\$[\d,]+)/.exec(text);
    if (amount === null || amount[1] === undefined) {
      line.textContent = text;
    } else {
      const from = amount.index + amount[0].length - amount[1].length;
      const b = doc.createElement('b');
      b.textContent = amount[1];
      line.append(text.slice(0, from), b, text.slice(from + amount[1].length));
    }
    return line;
  });
  el.replaceChildren(...lines);
}

/** "Round 1" from "Round 1: profit only"; the whole label when it has no colon. */
function roundName(preset: RewardPreset): string {
  const colon = preset.label.indexOf(':');
  return colon === -1 ? preset.label : preset.label.slice(0, colon);
}

/**
 * Builds the editor inside `container` (#editor) for `preset` and returns its handle. Ids: #kpi-<key>-on (checkbox),
 * #kpi-<key>-weight (range −10..10 step 1), #kpi-<key>-value (the dollar amount: "+$10", "−$5", "$0"), #limit,
 * #plan-words, #plan-note. An off measure's slider is disabled and its row dimmed; a locked toggle is disabled; a
 * locked plan (Round 1) has every toggle and slider disabled and #limit reads "Round 1: the plan is set." (the round's
 * note says what to do: G5d round 1, row 23); otherwise #limit reads "N of M measures on." with " Turn one off to turn
 * another on." appended when the limit is reached and a measure is still off.
 * The look (G5d, D59): #limit (with a padlock while the plan is set) under the heading, then the plan as a labelled
 * table, Measure / In the plan / Amount: a row per measure with its icon and its name (the toggle's label), whether
 * it is in the plan, and its dollar amount and unit. A set plan (Round 1) shows "In the plan" as a lamp and a word
 * (On, Off) and hides the controls; an editable plan shows the switch (a native checkbox) and the slider beside the
 * amount, the slider filled from a marked zero, a pay in green and a penalty in red (row 13). Then the plan in words in
 * a navy band, one clause a line with the amounts in bold (row 29; the text is describeBonusPlan's, word for word),
 * and the note under it.
 */
export function mountEditor(container: HTMLElement, world: WorldConfig, preset: RewardPreset): Editor {
  let current: RewardPreset = structuredClone(preset);
  let plan: RewardSpec = structuredClone(preset.spec);
  let enabled = true;

  const table = el('div', 'plan-table');
  table.setAttribute('role', 'group');
  table.setAttribute('aria-label', 'The measures in the bonus plan');
  // The column heads are for the eye; each control carries its own name for a screen reader.
  const head = el('div', 'plan-head');
  head.setAttribute('aria-hidden', 'true');
  head.append(el('span', 'plan-head-measure', 'Measure'), el('span', 'plan-head-in', 'In the plan'), el('span', 'plan-head-amount', 'Amount'));
  table.appendChild(head);
  const rows: Row[] = kpiInfo(world).map((info) => {
    const row = el('div', 'kpi-row');
    row.dataset.key = info.key;
    const toggle = el('input', 'toggle');
    toggle.type = 'checkbox';
    toggle.id = `kpi-${info.key}-on`;
    const name = el('label', 'kpi-name', info.name);
    name.htmlFor = toggle.id;
    const slider = el('input', 'kpi-weight');
    slider.type = 'range';
    slider.id = `kpi-${info.key}-weight`;
    slider.min = '-10';
    slider.max = '10';
    slider.step = '1';
    slider.setAttribute('aria-label', `Bonus amount for ${info.name}`);
    const value = el('span', 'kpi-value');
    value.id = `kpi-${info.key}-value`;
    value.setAttribute('aria-hidden', 'true'); // the slider's own value is what a screen reader announces
    const per = el('span', 'kpi-per', info.per);
    per.setAttribute('aria-hidden', 'true');
    const figure = el('span', 'kpi-figure');
    figure.append(value, ' ', per);
    // The slider's range in words at its ends, and its zero marked on the track (round 2, row 16); decoration only,
    // the slider's aria-valuetext says the amount.
    const lo = el('span', 'scale-end', '−$10');
    const hi = el('span', 'scale-end', '+$10');
    lo.setAttribute('aria-hidden', 'true');
    hi.setAttribute('aria-hidden', 'true');
    const scale = el('span', 'kpi-scale');
    scale.append(lo, slider, hi);
    const amount = el('span', 'kpi-amount');
    amount.append(scale, figure);
    // A set plan (Round 1) shows whether the measure is in the plan as a lamp and a word; the toggle and the slider
    // stay in the page, disabled and visually hidden, so the plan reads as set rather than as a broken form.
    const state = el('span', 'kpi-state');
    state.setAttribute('aria-hidden', 'true'); // the checkbox carries the state for a screen reader
    const lamp = el('i', 'lamp');
    const stateWord = el('span', 'kpi-state-word');
    state.append(lamp, stateWord);
    const inPlan = el('span', 'kpi-in');
    inPlan.append(toggle, state);
    row.append(icon(info.key), name, inPlan, amount);
    table.appendChild(row);

    toggle.addEventListener('change', () => {
      const next = toggleKpi(plan, info.key, current.maxActive);
      // A toggle past the limit is disabled, so null should not happen; if it does, render() puts the box back.
      if (next === null) render();
      else change(next);
    });
    slider.addEventListener('input', () => change(setWeight(plan, info.key, Number(slider.value))));
    return { key: info.key, row, toggle, slider, value, state: stateWord };
  });

  const limitLine = el('p', 'plan-limit');
  const lock = el('span', 'plan-lock');
  lock.setAttribute('aria-hidden', 'true');
  lock.innerHTML = uiIconSvg('lock', 16, 2.2);
  const limit = el('span');
  limit.id = 'limit';
  limitLine.append(lock, limit);
  const strip = el('div', 'plan-strip');
  const stripIcon = el('span', 'plan-strip-icon');
  stripIcon.setAttribute('aria-hidden', 'true');
  stripIcon.innerHTML = iconSvg(BONUS_ICON_PATHS, 22, 2);
  const stripText = el('div', 'plan-strip-text');
  // Shown after the week, when the plan stands under the scorecard (G5c).
  const stripLabel = el('p', 'plan-strip-label', 'The plan it worked to');
  const words = el('p', 'plan-words');
  words.id = 'plan-words';
  words.setAttribute('aria-live', 'polite');
  stripText.append(stripLabel, words);
  strip.append(stripIcon, stripText);
  const note = el('p', 'plan-note');
  note.id = 'plan-note';
  container.append(limitLine, table, strip, note);

  function render(): void {
    const locked = planLocked(current);
    const on = activeCount(plan);
    const full = on >= current.maxActive;
    container.classList.toggle('plan-locked', locked);
    for (const r of rows) {
      const setting = plan.kpis[r.key];
      r.toggle.checked = setting.on;
      r.toggle.disabled = !enabled || locked || (!setting.on && full);
      r.slider.value = String(setting.weight);
      // The track is filled from its marked zero (the middle) to the amount: --lo and --hi are the filled part's ends.
      const at = ((setting.weight + 10) / 20) * 100;
      r.slider.style.setProperty('--lo', `${Math.min(at, 50)}%`);
      r.slider.style.setProperty('--hi', `${Math.max(at, 50)}%`);
      r.row.classList.toggle('pay', setting.weight > 0);
      r.row.classList.toggle('penalty', setting.weight < 0);
      r.slider.disabled = !enabled || locked || !setting.on;
      r.value.textContent = signedDollars(setting.weight);
      r.slider.setAttribute('aria-valuetext', spokenAmount(r.key, setting.weight, world));
      r.state.textContent = setting.on ? 'On' : 'Off';
      r.row.classList.toggle('off', !setting.on);
    }
    if (locked) {
      limit.textContent = `${roundName(current)}: the plan is set.`;
    } else {
      const stillOff = on < rows.length;
      limit.textContent = `${on} of ${current.maxActive} measures on.${full && stillOff ? ' Turn one off to turn another on.' : ''}`;
    }
    planLines(words, describeBonusPlan(plan, world));
    note.textContent = signedNote(plan) ?? '';
  }

  function change(next: RewardSpec): void {
    plan = next;
    render();
    editor.onChange?.(structuredClone(plan));
  }

  const editor: Editor = {
    element: container,
    spec: () => structuredClone(plan),
    preset: () => structuredClone(current),
    load(p: RewardPreset): void {
      current = structuredClone(p);
      change(structuredClone(p.spec));
    },
    setEnabled(on: boolean): void {
      enabled = on;
      render();
    },
    onChange: null,
  };

  render();
  return editor;
}
