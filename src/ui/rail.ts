// The yard's rail (G5d, D59): what the GM is doing this block and what it is costing, as text beside the yard instead
// of drawn on the canvas, so a screen reader and the page's word checks read it too. A pure function of one
// ReplayFrame; WP2 renders it, WP3's canvas draws only the yard.
import type { WorldConfig } from '../world/types.ts';
import { activityName, planWords } from './replay.ts';
import type { ReplayFrame } from './replay.ts';
import { formatBonus, formatDollars, formatMoney, withCents } from './report.ts';

export interface RailModel {
  /** "Wednesday · late morning". */
  when: string;
  /** The floor's activity as the frame words it ("free play", "free play (walk asked)", "closed"). */
  activity: string;
  /** The GM's choices today, as planWords says them ("Today: 18 asked · all 18 accepted · premium rate · 1 staffer scheduled"). */
  choices: string;
  /** This block in one line: the activity as it ran, the crew and the dogs on the floor ("This block: free play ·
   * 1 staffer · 18 dogs"; "This block: closed"). */
  thisBlock: string;
  /** Where the block sits in the week (0..4, 0..3), for the timeline. */
  day: number;
  block: number;
  closed: boolean;
  /** Dogs per staffer on the floor now, against the legal limit. */
  perStaffer: { now: number; dogs: number; staff: number; limit: number; over: boolean };
  /** Incidents this week so far, and in this block. */
  incidents: { week: number; thisBlock: number };
  /**
   * The page's cash now, paying the GM as it earns (BRIEF section 5, D62: the engine's cash less the bonus so far, as
   * the report writes the bottom line: "$5,045.60"), at the week's start ("$2,000"), and today's change so far
   * ("+$869.40", "−$120", "$0"; empty when the day's opening cash was not given).
   */
  cash: { now: string; start: string; today: string };
  /** The GM's bonus earned through this block, in the bonus cells' format ("+$338.40", "−$35", "$0"). */
  bonusSoFar: string;
  /** Reputation now, and the change since Monday in words: "Down 10 this week", "Up 3 this week", "No change this week". */
  reputation: { now: number; change: string };
  /** The three meters, 0 to 100, whole numbers, and the crew fatigue the bonus plan's measure counts above (70). */
  energy: number;
  cleanliness: number;
  fatigue: number;
  fatigueLimit: number;
  /** Owners asking for tomorrow; days in a row with one staffer, before today; dogs sent home sick this week and in this block. */
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

/** A change of cash with its sign: "+$575", "−$120.40", "$0". */
function signedDollars(dollars: number): string {
  const text = formatDollars(dollars);
  return text === '$0' || text.startsWith('−') ? text : `+${text}`;
}

/** "1 staffer", "2 staffers" (a count of crew is "staffer" or "staffers" everywhere, BRIEF 10.2); "1 dog", "18 dogs". */
const staffWords = (n: number): string => `${n} ${n === 1 ? 'staffer' : 'staffers'}`;
const dogWords = (n: number): string => `${n} ${n === 1 ? 'dog' : 'dogs'}`;

/** "This block: free play · 1 staffer · 18 dogs" (the activity as it ran, the floor after a walking group left). */
export function thisBlockWords(frame: ReplayFrame): string {
  if (frame.closed || frame.activity === null) return 'This block: closed';
  return `This block: ${activityName(frame.activity)} · ${staffWords(frame.floorStaff)} · ${dogWords(frame.floorDogs)}`;
}

/**
 * The rail's values for one block (G5d WP2): every count says its scope ("this week", "this block"), the money is
 * written as the report writes it, and the words are the frame's own (activityWords, planWords, captions). The cash
 * is the page's: the engine's less the GM's bonus so far (D62). `dayStartCash` is the page's cash when the day opened
 * (the week's start on Monday, the last pickup's after), for today's change; the page reads it from the trace.
 */
export function railModel(frame: ReplayFrame, world: WorldConfig, dayStartCash?: number): RailModel {
  const reputation = Math.round(frame.reputation);
  const sickThisBlock = frame.events.filter((e) => e.type === 'illness').reduce((n, e) => n + (e.amount ?? 0), 0);
  return {
    when: `${frame.dayName} · ${frame.blockName}`,
    activity: frame.activityWords,
    choices: planWords(frame),
    thisBlock: thisBlockWords(frame),
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
    cash: {
      now: formatDollars(frame.cash - frame.bonusSoFar),
      start: formatMoney(world.cash.weekStart),
      today: dayStartCash === undefined ? '' : signedDollars(frame.cash - frame.bonusSoFar - dayStartCash),
    },
    bonusSoFar: formatBonus(frame.bonusSoFar),
    reputation: { now: reputation, change: reputationChange(reputation - world.reputation.weekStart) },
    energy: Math.round(frame.energy),
    cleanliness: Math.round(frame.cleanliness),
    fatigue: Math.round(frame.fatigue),
    fatigueLimit: world.fatigue.kpiThreshold,
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
export type RailIcon = 'overRatio' | 'incidents' | 'cash' | 'bonus' | 'reputation';

/**
 * Builds the rail's nodes once inside `container` and returns the function that writes a block's values into them
 * (text and a few style properties, never new nodes, so a block costs a handful of writes). `gaugeMax` is the gauge's
 * top (world.requests.max); `icon` returns an icon's markup (icons.ts). DOM only when called: nothing here runs at
 * module load, so the model above is tested under node. The block's events are the yard's own chips (WP3): the rail
 * does not repeat them.
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

  // When: the day and the block ("Wednesday · pickup block", round 3, row 8), today's plan with its prices and wages
  // ("Today: …", BRIEF 10.2), the week's twenty blocks.
  const whenBox = el('div', 'live-when');
  const when = el('p', 'when');
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
  whenBox.append(when, choices, timeline);

  // This block in one bold line, the most prominent words after the gauge's number (round 2, row 10): the activity as
  // it ran (a fallback with what was asked, muted), the crew and the dogs on the floor.
  const blockLine = el('p', 'this-block');

  // The crowding: dogs per staffer now against the legal limit, the part over it hatched, the limit's label under
  // its own mark (round 1, row 25).
  const crowd = el('div', 'live-crowd');
  const big = el('p', 'crowd-big');
  const crowdBody = el('div', 'crowd-body');
  const gauge = el('div', 'gauge');
  gauge.setAttribute('aria-hidden', 'true');
  const fill = el('span', 'gauge-fill');
  const over = el('span', 'gauge-over');
  const mark = el('span', 'gauge-mark');
  const limitText = el('span', 'gauge-limit');
  const limitNum = el('b');
  limitText.append(limitNum, ' legal limit');
  gauge.append(fill, over, mark, limitText);
  const floor = el('p', 'gauge-floor');
  crowdBody.append(label('overRatio', 'Dogs per staffer now'), gauge, floor);
  crowd.append(big, crowdBody);

  // The money and the costs in one block of four (BRIEF 10.2; round 3, rows 2 and 7): the page's cash now, which pays the
  // GM as it earns (D62), and today's profit so far after that pay; the GM's bonus this week so far beside it; then
  // incidents and reputation, each with its scope. Every money figure with its cents (D66).
  const stats = el('div', 'live-stats');
  const cashBox = el('div', 'stat stat-cash');
  const cashVal = el('p', 'stat-val');
  const cashToday = el('p', 'stat-sub stat-today');
  const cashTodayVal = el('b');
  cashToday.append("Today's profit so far, after the GM's pay: ", cashTodayVal);
  const cashSub = el('p', 'stat-sub');
  cashBox.append(label('cash', "Cash now, after the GM's pay"), cashVal, cashToday, cashSub);
  const bonusBox = el('div', 'stat stat-bonus');
  const bonusVal = el('p', 'stat-val');
  const bonusSub = el('p', 'stat-sub', 'Paid out of the cash as it is earned');
  bonusBox.append(label('bonus', "The GM's bonus this week so far"), bonusVal, bonusSub);
  const incBox = el('div', 'stat stat-incidents');
  const incVal = el('p', 'stat-val');
  const incSub = el('p', 'stat-sub');
  const incBadge = el('span', 'badge-warn');
  const incBadgeText = el('span');
  incBadge.append(glyph('incidents'), incBadgeText);
  const incQuiet = el('span', 'stat-quiet', 'None this block');
  incSub.append(incBadge, incQuiet);
  incBox.append(label('incidents', 'Incidents this week'), incVal, incSub);
  const repBox = el('div', 'stat stat-rep');
  const repVal = el('p', 'stat-val');
  const repSub = el('p', 'stat-sub');
  repBox.append(label('reputation', 'Reputation'), repVal, repSub);
  stats.append(cashBox, bonusBox, incBox, repBox);

  // The meters, each named for whose it is, each value in percent (BRIEF 10.2). Energy and cleanliness are plain bars:
  // where they start to cost is a hidden rule (H3, H6; D65). The crew's fatigue carries the plan's public 70% mark, the
  // part above it hatched and the value in the warning colour past it. Every row keeps the same room above its bar, so
  // the three are evenly spaced. Then the rest in words.
  const meters = el('div', 'live-meters');
  const meterRow = (name: string): { track: HTMLElement; bar: HTMLElement; num: HTMLElement } => {
    const track = el('span', 'meter');
    track.setAttribute('aria-hidden', 'true');
    const bar = el('i');
    track.appendChild(bar);
    const num = el('b', 'meter-num');
    meters.append(el('span', 'meter-name', name), track, num);
    return { track, bar, num };
  };
  const energy = meterRow("Dogs' energy");
  const clean = meterRow('Cleanliness');
  const tired = meterRow('Crew fatigue');
  const tiredOver = el('span', 'meter-over');
  const tiredMark = el('span', 'meter-mark');
  const tiredLimit = el('span', 'meter-limit');
  tired.track.append(tiredOver, tiredMark, tiredLimit);
  const facts = el('div', 'live-facts');
  const tomorrow = fact('Tomorrow: ', ' asking');
  const solo = fact('Days in a row with one staffer, before today: ', '');
  // "Found sick at pickup: 3 this week", when above 0 (BRIEF 10.2: illness is found at pickup; one event, one phrasing).
  const sick = fact('Found sick at pickup: ', ' this week');
  facts.append(tomorrow.line, sick.line, solo.line); // Tomorrow and the sick dogs share a line where there is room

  container.replaceChildren(whenBox, blockLine, crowd, stats, meters, facts);

  const scale = (v: number): number => (Math.max(0, Math.min(gaugeMax, v)) / gaugeMax) * 100;
  return (m) => {
    container.hidden = m === null;
    if (m === null) return;
    when.textContent = `${m.when} block`;
    // Today's plan and its crew on a line of their own, as planParts splits them, so no line ends on half a choice;
    // the dot between them stays in the text for a screen reader, and the words are the choices line's own.
    const crewAt = m.choices.lastIndexOf(' · ');
    if (crewAt < 0) choices.textContent = m.choices;
    else choices.replaceChildren(m.choices.slice(0, crewAt), el('span', 'visually-hidden', ' · '), el('span', 'choices-crew', m.choices.slice(crewAt + 3)));
    const now = m.day * 4 + m.block;
    cells.forEach((cell, t) => {
      const cls = t < now ? 'done' : t === now ? 'now' : '';
      if (cell.className !== cls) cell.className = cls;
    });
    dayNames.forEach((name, d) => name.classList.toggle('now', d === m.day));

    // "This block: free play (walk asked) · 1 staffer · 18 dogs": the model's line, a fallback's ask set in muted ink.
    const asked = m.activity.indexOf(' (');
    const cut = m.thisBlock.indexOf(' · ');
    if (asked < 0 || cut < 0) blockLine.textContent = m.thisBlock;
    else blockLine.replaceChildren(m.thisBlock.slice(0, cut), el('span', 'asked', m.activity.slice(asked)), m.thisBlock.slice(cut));

    const p = m.perStaffer;
    big.textContent = String(p.now);
    crowd.classList.toggle('over', p.over);
    crowd.classList.toggle('closed', m.closed);
    const ratio = p.staff > 0 ? p.dogs / p.staff : 0;
    fill.style.width = `${scale(Math.min(ratio, p.limit))}%`;
    over.style.left = `${scale(p.limit)}%`;
    over.style.width = p.over ? `${scale(ratio) - scale(p.limit)}%` : '0%';
    mark.style.left = `${scale(p.limit)}%`;
    limitText.style.left = `${scale(p.limit)}%`;
    limitNum.textContent = String(p.limit);
    floor.textContent = floorWords(p.dogs, p.staff);

    cashVal.textContent = withCents(m.cash.now);
    cashTodayVal.textContent = withCents(m.cash.today);
    cashToday.hidden = m.cash.today === '';
    cashToday.classList.toggle('loss', m.cash.today.startsWith('−'));
    cashSub.textContent = `Started the week at ${withCents(m.cash.start)}`;
    cashBox.classList.toggle('loss', m.cash.now.startsWith('−'));
    bonusVal.textContent = withCents(m.bonusSoFar);

    incVal.textContent = String(m.incidents.week);
    incBadgeText.textContent = `${m.incidents.thisBlock} this block`;
    incBadge.hidden = m.incidents.thisBlock === 0; // the badge only when the block had one (round 1, row 18)
    incQuiet.hidden = m.incidents.thisBlock > 0;
    incBox.classList.toggle('hurt', m.incidents.week > 0);
    repVal.textContent = String(m.reputation.now);
    repSub.textContent = m.reputation.change;
    repBox.classList.toggle('hurt', m.reputation.change.startsWith('Down'));

    for (const [meter, v] of [
      [energy, m.energy],
      [clean, m.cleanliness],
      [tired, m.fatigue],
    ] as const) {
      meter.bar.style.width = `${Math.max(0, Math.min(100, v))}%`;
      meter.num.textContent = `${v}%`;
    }
    const limit = Math.max(0, Math.min(100, m.fatigueLimit));
    const tiredHigh = m.fatigue > limit;
    tired.bar.style.width = `${Math.min(Math.max(0, m.fatigue), limit)}%`;
    tiredOver.style.left = `${limit}%`;
    tiredOver.style.width = tiredHigh ? `${Math.min(100, m.fatigue) - limit}%` : '0%';
    tiredMark.style.left = `${limit}%`;
    tiredLimit.style.left = `${limit}%`;
    tiredLimit.textContent = `${limit}%`;
    tired.num.classList.toggle('high', tiredHigh);
    tomorrow.num.textContent = String(m.tomorrow);
    solo.num.textContent = m.soloDays === 0 ? 'None' : String(m.soloDays);
    sick.num.textContent = String(m.sick.week);
    sick.line.hidden = m.sick.week === 0;
  };
}
