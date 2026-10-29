// The yard's rail (G5d, D59): what the GM is doing this block and what it is costing, as text beside the yard instead
// of drawn on the canvas, so a screen reader and the page's word checks read it too. A pure function of one
// ReplayFrame; WP2 renders it, WP3's canvas draws only the yard.
import type { WorldConfig } from '../world/types.ts';
import { planWords } from './replay.ts';
import type { ReplayFrame } from './replay.ts';
import { formatMoney } from './report.ts';

export interface RailModel {
  /** "Wednesday · late morning". */
  when: string;
  /** The floor's activity as the frame words it ("free play", "walk → free play", "closed"). */
  activity: string;
  /** The GM's choices today, as planWords says them ("18 asked · 18 accepted, every booking · premium rate · crew 1 scheduled, 1 in"). */
  choices: string;
  /** Where the block sits in the week (0..4, 0..3), for the timeline. */
  day: number;
  block: number;
  closed: boolean;
  /** Dogs per staffer on the floor now, against the legal limit. */
  perStaffer: { now: number; dogs: number; staff: number; limit: number; over: boolean };
  /** Incidents this week so far, and in this block. */
  incidents: { week: number; thisBlock: number };
  /** Cash now and at the week's start, as the report writes dollars ("$5,024", "$2,000"). */
  cash: { now: string; start: string };
  /** Reputation now, and the change since Monday in words: "Down 10 this week", "Up 3 this week", "No change this week". */
  reputation: { now: number; change: string };
  /** The three meters, 0 to 100, whole numbers. */
  energy: number;
  cleanliness: number;
  fatigue: number;
  /** Owners asking for tomorrow; days in a row the crew ran solo; dogs sent home sick this week and in this block. */
  tomorrow: number;
  soloDays: number;
  sick: { week: number; thisBlock: number };
  /** This block's events in business words (the frame's captions). */
  captions: string[];
}

/** The reputation change since Monday's start in words: "Down 10 this week", "Up 3 this week", "No change this week". */
function reputationChange(change: number): string {
  if (change < 0) return `Down ${-change} this week`;
  if (change > 0) return `Up ${change} this week`;
  return 'No change this week';
}

/**
 * The rail's values for one block (G5d WP2): every count says its scope ("this week", "this block"), the money is
 * written as the report writes it, and the words are the frame's own (activityWords, planWords, captions).
 */
export function railModel(frame: ReplayFrame, world: WorldConfig): RailModel {
  const reputation = Math.round(frame.reputation);
  const sickThisBlock = frame.events.filter((e) => e.type === 'illness').reduce((n, e) => n + (e.amount ?? 0), 0);
  return {
    when: `${frame.dayName} · ${frame.blockName}`,
    activity: frame.activityWords,
    choices: planWords(frame),
    day: frame.day,
    block: frame.block,
    closed: frame.closed,
    perStaffer: {
      now: Math.round(frame.ratio),
      dogs: frame.floorDogs,
      staff: frame.floorStaff,
      limit: world.bookings.legalRatio,
      over: frame.ratio > world.bookings.legalRatio,
    },
    incidents: { week: frame.incidentsSoFar, thisBlock: frame.events.filter((e) => e.type === 'incident').length },
    cash: { now: formatMoney(frame.cash), start: formatMoney(world.cash.weekStart) },
    reputation: { now: reputation, change: reputationChange(reputation - world.reputation.weekStart) },
    energy: Math.round(frame.energy),
    cleanliness: Math.round(frame.cleanliness),
    fatigue: Math.round(frame.fatigue),
    tomorrow: frame.requestsTomorrow,
    soloDays: frame.soloStreak,
    sick: { week: frame.sickSoFar, thisBlock: sickThisBlock },
    captions: [...frame.captions],
  };
}

const DAY_SHORT: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** "18 dogs, 1 staffer on the floor" (and "1 dog", "2 staffers"). */
export function floorWords(dogs: number, staff: number): string {
  return `${dogs} ${dogs === 1 ? 'dog' : 'dogs'}, ${staff} ${staff === 1 ? 'staffer' : 'staffers'} on the floor`;
}

/** Updates the rail in place; null empties it (no week on the yard). */
export type RailView = (model: RailModel | null) => void;

/** The rail's icons, by name (icons.ts supplies the markup). */
export type RailIcon = 'overRatio' | 'incidents' | 'cash' | 'reputation';

/**
 * Builds the rail's nodes once inside `container` and returns the function that writes a block's values into them
 * (text and a few style properties, never new nodes, so a block costs a handful of writes). `gaugeMax` is the gauge's
 * top (world.requests.max); `icon` returns an icon's markup (icons.ts). DOM only when called: nothing here runs at
 * module load, so the model above is tested under node.
 */
export function mountRail(container: HTMLElement, gaugeMax: number, icon: (name: RailIcon) => string): RailView {
  const doc = container.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (cls !== undefined) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const glyph = (name: RailIcon): HTMLElement => {
    const i = el('span', 'stat-icon');
    i.setAttribute('aria-hidden', 'true');
    i.innerHTML = icon(name);
    return i;
  };
  const label = (name: RailIcon, text: string): HTMLElement => {
    const lab = el('p', 'stat-lab');
    lab.append(glyph(name), el('span', undefined, text));
    return lab;
  };
  /** A line of words with one bold number in it: "Tomorrow: <b>19</b> asking". */
  const fact = (before: string, after: string): { line: HTMLElement; num: HTMLElement } => {
    const line = el('p');
    const num = el('b');
    line.append(before, num, after);
    return { line, num };
  };

  // When: the day and block, the floor's activity, the GM's choices, the week's twenty blocks.
  const whenBox = el('div', 'live-when');
  const whenLine = el('p', 'when-line');
  const when = el('span', 'when');
  const activity = el('span', 'activity');
  whenLine.append(when, activity);
  const choices = el('p', 'choices');
  const timeline = el('div', 'timeline');
  timeline.setAttribute('aria-hidden', 'true');
  const cells: HTMLElement[] = [];
  const dayNames: HTMLElement[] = [];
  for (let d = 0; d < 5; d++) {
    const day = el('div', 'tl-day');
    const blocks = el('span', 'tl-blocks');
    for (let b = 0; b < 4; b++) {
      const cell = el('i');
      blocks.appendChild(cell);
      cells.push(cell);
    }
    const name = el('span', 'tl-name', DAY_SHORT[d]);
    dayNames.push(name);
    day.append(blocks, name);
    timeline.appendChild(day);
  }
  whenBox.append(whenLine, choices, timeline);

  // The crowding: dogs per staffer now against the legal limit, the part over it hatched.
  const crowd = el('div', 'live-crowd');
  const big = el('p', 'crowd-big');
  const crowdBody = el('div', 'crowd-body');
  const gauge = el('div', 'gauge');
  gauge.setAttribute('aria-hidden', 'true');
  const fill = el('span', 'gauge-fill');
  const over = el('span', 'gauge-over');
  const mark = el('span', 'gauge-mark');
  gauge.append(fill, over, mark);
  const gaugeLines = el('p', 'gauge-lines');
  const floor = el('span', 'gauge-floor');
  const limitText = el('span', 'gauge-limit');
  const limitNum = el('b');
  limitText.append(limitNum, ' legal limit');
  gaugeLines.append(floor, limitText);
  crowdBody.append(label('overRatio', 'Dogs per staffer now'), gauge, gaugeLines);
  crowd.append(big, crowdBody);

  // What it is costing: incidents, cash, reputation, each with its scope.
  const trio = el('div', 'live-trio');
  const incBox = el('div', 'stat stat-incidents');
  const incVal = el('p', 'stat-val');
  const incSub = el('p', 'stat-sub');
  const incBadge = el('span', 'badge-warn');
  const incBadgeText = el('span');
  incBadge.append(glyph('incidents'), incBadgeText);
  incSub.appendChild(incBadge);
  incBox.append(label('incidents', 'Incidents this week'), incVal, incSub);
  const cashBox = el('div', 'stat stat-cash');
  const cashVal = el('p', 'stat-val');
  const cashSub = el('p', 'stat-sub');
  cashBox.append(label('cash', 'Cash'), cashVal, cashSub);
  const repBox = el('div', 'stat stat-rep');
  const repVal = el('p', 'stat-val');
  const repSub = el('p', 'stat-sub');
  repBox.append(label('reputation', 'Reputation'), repVal, repSub);
  trio.append(incBox, cashBox, repBox);

  // The meters, then the rest in words. This block's events are the yard's own chips (WP3): the rail does not repeat them.
  const meters = el('div', 'live-meters');
  const meterRow = (name: string): { bar: HTMLElement; num: HTMLElement } => {
    const track = el('span', 'meter');
    track.setAttribute('aria-hidden', 'true');
    const bar = el('i');
    track.appendChild(bar);
    const num = el('b', 'meter-num');
    meters.append(el('span', 'meter-name', name), track, num);
    return { bar, num };
  };
  const energy = meterRow('Energy');
  const clean = meterRow('Cleanliness');
  const tired = meterRow('Crew fatigue');
  const facts = el('div', 'live-facts');
  const tomorrow = fact('Tomorrow: ', ' asking');
  const solo = fact('Days the crew ran solo: ', '');
  const sickLine = el('p', 'fact-wide');
  const sickWeek = el('b');
  const sickBlock = el('b');
  sickLine.append('Dogs sent home sick: ', sickWeek, ' this week, ', sickBlock, ' this block');
  facts.append(tomorrow.line, solo.line, sickLine);
  container.replaceChildren(whenBox, crowd, trio, meters, facts);

  const scale = (v: number): number => (Math.max(0, Math.min(gaugeMax, v)) / gaugeMax) * 100;
  return (m) => {
    container.hidden = m === null;
    if (m === null) return;
    when.textContent = m.when;
    activity.textContent = m.activity;
    // The crew's part ("crew 1 scheduled, 1 in") on a line of its own, as planParts splits it, so no line ends on half
    // a choice; the dot between them stays in the text for a screen reader, and the words are the choices line's own.
    const crewAt = m.choices.lastIndexOf(' · crew ');
    if (crewAt < 0) choices.textContent = m.choices;
    else choices.replaceChildren(m.choices.slice(0, crewAt), el('span', 'visually-hidden', ' · '), el('span', 'choices-crew', m.choices.slice(crewAt + 3)));
    const now = m.day * 4 + m.block;
    cells.forEach((cell, t) => {
      const cls = t < now ? 'done' : t === now ? 'now' : '';
      if (cell.className !== cls) cell.className = cls;
    });
    dayNames.forEach((name, d) => name.classList.toggle('now', d === m.day));

    const p = m.perStaffer;
    big.textContent = String(p.now);
    crowd.classList.toggle('over', p.over);
    crowd.classList.toggle('closed', m.closed);
    const ratio = p.staff > 0 ? p.dogs / p.staff : 0;
    fill.style.width = `${scale(Math.min(ratio, p.limit))}%`;
    over.style.left = `${scale(p.limit)}%`;
    over.style.width = p.over ? `${scale(ratio) - scale(p.limit)}%` : '0%';
    mark.style.left = `${scale(p.limit)}%`;
    floor.textContent = floorWords(p.dogs, p.staff);
    limitNum.textContent = String(p.limit);

    incVal.textContent = String(m.incidents.week);
    incBadgeText.textContent = `${m.incidents.thisBlock} this block`;
    incSub.classList.toggle('quiet', m.incidents.thisBlock === 0);
    incBox.classList.toggle('hurt', m.incidents.week > 0);
    cashVal.textContent = m.cash.now;
    cashSub.textContent = `Started the week at ${m.cash.start}`;
    cashBox.classList.toggle('loss', m.cash.now.startsWith('−'));
    repVal.textContent = String(m.reputation.now);
    repSub.textContent = m.reputation.change;
    repBox.classList.toggle('hurt', m.reputation.change.startsWith('Down'));

    for (const [meter, v] of [
      [energy, m.energy],
      [clean, m.cleanliness],
      [tired, m.fatigue],
    ] as const) {
      meter.bar.style.width = `${Math.max(0, Math.min(100, v))}%`;
      meter.num.textContent = String(v);
    }
    tomorrow.num.textContent = String(m.tomorrow);
    solo.num.textContent = String(m.soloDays);
    sickWeek.textContent = String(m.sick.week);
    sickBlock.textContent = String(m.sick.thisBlock);
  };
}
