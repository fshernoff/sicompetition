// The bonus plan editor on the page: six rows (a toggle, the name, a slider −10..+10 step 1, the dollar amount, the
// unit hint), the limit line (#limit), the plan in words (#plan-words) and the signed-delta hint (#plan-note),
// re-rendered on every input. DOM only: the rules are the pure functions of src/world/bonusPlan.ts. No DOM access at
// module top level: roundFromSearch is tested under node. WP2 (Opus).
//
// How it works: the rows are built once; the plan (a RewardSpec) is the editor's only state besides the preset and
// the enabled flag. Every input goes through a pure rule (toggleKpi, setWeight), replaces the plan, and render()
// rewrites every row, the limit line, the words and the note from the plan, so the page never drifts from it.
import { activeCount, describeBonusPlan, kpiInfo, planLocked, setWeight, signedDollars, signedNote, toggleKpi } from '../world/bonusPlan.ts';
import type { PresetName, RewardPreset } from '../world/config.ts';
import type { KpiKey, RewardSpec, WorldConfig } from '../world/types.ts';
import { BONUS_ICON_PATHS, iconSvg, measureIconSvg } from './icons.ts';

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
  tile.innerHTML = measureIconSvg(key); // one icon per measure everywhere (icons.ts)
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

/** "Round 1" from "Round 1: profit only"; the whole label when it has no colon. */
function roundName(preset: RewardPreset): string {
  const colon = preset.label.indexOf(':');
  return colon === -1 ? preset.label : preset.label.slice(0, colon);
}

/**
 * Builds the editor inside `container` (#editor) for `preset` and returns its handle. Ids: #kpi-<key>-on (checkbox),
 * #kpi-<key>-weight (range −10..10 step 1), #kpi-<key>-value (the dollar amount: "+$10", "−$5", "$0"), #limit,
 * #plan-words, #plan-note. An off measure's slider is disabled and its row dimmed; a locked toggle is disabled; a
 * locked plan (Round 1) has every toggle and slider disabled and #limit reads "Round 1: the plan is set. Predict
 * what the GM will do, then put it to work."; otherwise #limit reads "N of M measures on." with " Turn one off to turn
 * another on." appended when the limit is reached and a measure is still off.
 * The look (G5c): #limit under the card's heading, then a row per measure (its icon, its name as the toggle's label,
 * the dollar amount and its unit, the slider, the toggle: a native checkbox drawn as a switch), then the plan in
 * words in a highlighted strip and the note under it.
 */
export function mountEditor(container: HTMLElement, world: WorldConfig, preset: RewardPreset): Editor {
  let current: RewardPreset = structuredClone(preset);
  let plan: RewardSpec = structuredClone(preset.spec);
  let enabled = true;

  const list = el('div', 'kpi-rows');
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'The measures in the bonus plan');
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
    const amount = el('span', 'kpi-amount');
    const value = el('span', 'kpi-value');
    value.id = `kpi-${info.key}-value`;
    value.setAttribute('aria-hidden', 'true'); // the slider's own value is what a screen reader announces
    const per = el('span', 'kpi-per', info.per);
    per.setAttribute('aria-hidden', 'true');
    amount.append(value, ' ', per);
    // Read-only rounds (Round 1) show the measure's state as a pill and its amount as text; the toggle and the slider
    // stay in the page, disabled and visually hidden, so the plan reads as set rather than as a broken form.
    const state = el('span', 'kpi-state');
    state.setAttribute('aria-hidden', 'true'); // the checkbox carries the state for a screen reader
    row.append(icon(info.key), name, state, amount, slider, toggle);
    list.appendChild(row);

    toggle.addEventListener('change', () => {
      const next = toggleKpi(plan, info.key, current.maxActive);
      // A toggle past the limit is disabled, so null should not happen; if it does, render() puts the box back.
      if (next === null) render();
      else change(next);
    });
    slider.addEventListener('input', () => change(setWeight(plan, info.key, Number(slider.value))));
    return { key: info.key, row, toggle, slider, value, state };
  });

  const limit = el('p', 'plan-limit');
  limit.id = 'limit';
  const strip = el('div', 'plan-strip');
  const stripIcon = el('span', 'plan-strip-icon');
  stripIcon.setAttribute('aria-hidden', 'true');
  stripIcon.innerHTML = iconSvg(BONUS_ICON_PATHS);
  const stripText = el('div', 'plan-strip-text');
  // Shown after the week, when the plan card stands beside the scorecard (G5c).
  const stripLabel = el('p', 'plan-strip-label', 'The plan it worked to');
  const words = el('p', 'plan-words');
  words.id = 'plan-words';
  words.setAttribute('aria-live', 'polite');
  stripText.append(stripLabel, words);
  strip.append(stripIcon, stripText);
  const note = el('p', 'plan-note');
  note.id = 'plan-note';
  container.append(limit, list, strip, note);

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
      r.slider.style.setProperty('--fill', `${((setting.weight + 10) / 20) * 100}%`); // the track's filled part
      r.slider.disabled = !enabled || locked || !setting.on;
      r.value.textContent = signedDollars(setting.weight);
      r.slider.setAttribute('aria-valuetext', spokenAmount(r.key, setting.weight, world));
      r.state.textContent = setting.on ? 'On' : 'Off';
      r.row.classList.toggle('off', !setting.on);
    }
    if (locked) {
      limit.textContent = `${roundName(current)}: the plan is set. Predict what the GM will do, then put it to work.`;
    } else {
      const stillOff = on < rows.length;
      limit.textContent = `${on} of ${current.maxActive} measures on.${full && stillOff ? ' Turn one off to turn another on.' : ''}`;
    }
    words.textContent = describeBonusPlan(plan, world);
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
