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
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
    const name = el('label', 'kpi-name');
    const toggle = el('input');
    toggle.type = 'checkbox';
    toggle.id = `kpi-${info.key}-on`;
    name.append(toggle, el('span', undefined, info.name));
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
    row.append(name, slider, value, per);
    list.appendChild(row);

    toggle.addEventListener('change', () => {
      const next = toggleKpi(plan, info.key, current.maxActive);
      // A toggle past the limit is disabled, so null should not happen; if it does, render() puts the box back.
      if (next === null) render();
      else change(next);
    });
    slider.addEventListener('input', () => change(setWeight(plan, info.key, Number(slider.value))));
    return { key: info.key, row, toggle, slider, value };
  });

  const limit = el('p', 'plan-limit');
  limit.id = 'limit';
  const words = el('p', 'plan-words');
  words.id = 'plan-words';
  words.setAttribute('aria-live', 'polite');
  const note = el('p', 'plan-note');
  note.id = 'plan-note';
  container.append(list, limit, words, note);

  function render(): void {
    const locked = planLocked(current);
    const on = activeCount(plan);
    const full = on >= current.maxActive;
    for (const r of rows) {
      const setting = plan.kpis[r.key];
      r.toggle.checked = setting.on;
      r.toggle.disabled = !enabled || locked || (!setting.on && full);
      r.slider.value = String(setting.weight);
      r.slider.disabled = !enabled || locked || !setting.on;
      r.value.textContent = signedDollars(setting.weight);
      r.slider.setAttribute('aria-valuetext', signedDollars(setting.weight));
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
