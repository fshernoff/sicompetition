// The week replay: one greedy week played block by block on a canvas (the yard, the dogs, the crew, the
// dogs-per-staffer gauge, the incident counter, the reputation meter, the cash counter). An incident is an icon
// and a counter, never an injury. `replayFrame` and `replayClock` are pure functions from the 20 StepRecords and the
// elapsed time; `drawReplay` is a pure drawing function. The replay keeps no state: the page holds the trace and
// the start time (G4 plan, "What a frame shows for step t"; BRIEF section 10.2). No DOM access at module top level.
// Seam written by the main thread; WP1 (Opus) builds it.
import type {
  Bookings,
  FloorActivity,
  Rate,
  State,
  StepRecord,
  WorldConfig,
  WorldEvent,
} from '../world/types.ts';

/** One block of the week on screen. 20 blocks: 6 s a week. */
export const STEP_MS = 300;
/** Friday's pickup stays on screen this long before the week is over. */
export const HOLD_MS = 1500;

/** Five days of four blocks. */
const WEEK_STEPS = 20;

export interface ReplayClock {
  step: number; // 0..19
  progress: number; // 0..1 inside the step (1 while holding on the last)
  done: boolean; // the hold has passed
}

/**
 * Where a replay that started `elapsedMs` ago stands: step = floor(elapsed / stepMs) capped at 19, progress the
 * fraction inside it (1 once the 20 steps have played), done once 20 × stepMs + holdMs has passed. A negative
 * elapsed is step 0 at progress 0.
 */
export function replayClock(elapsedMs: number, stepMs: number = STEP_MS, holdMs: number = HOLD_MS): ReplayClock {
  const weekMs = WEEK_STEPS * stepMs;
  if (!(elapsedMs > 0)) return { step: 0, progress: 0, done: false }; // negative, zero or not a number
  if (elapsedMs >= weekMs) return { step: WEEK_STEPS - 1, progress: 1, done: elapsedMs >= weekMs + holdMs };
  const step = Math.min(WEEK_STEPS - 1, Math.floor(elapsedMs / stepMs));
  return { step, progress: Math.min(1, (elapsedMs - step * stepMs) / stepMs), done: false };
}

export interface ReplayFrame {
  day: number; // 0..4
  block: number; // 0..3
  dayName: string; // Monday .. Friday
  blockName: string; // 'drop-off' | 'late morning' | 'afternoon' | 'pickup'
  closed: boolean;
  calledOut: boolean;
  /** The activity the floor ran after fallbacks (freePlay at drop-off); null on a closed day. */
  activity: FloorActivity | null;
  /** What the GM asked for; null at drop-off. */
  requested: FloorActivity | null;
  /** 'free play', 'structured play', 'nap', 'walk', 'clean', 'closed'; a fallback as 'walk → free play'. */
  activityWords: string;
  /** The day's dogs and crew (present today); 0 on a closed day. */
  dogs: number;
  staff: number;
  /** The crew the GM asked for today (1..3; also on a closed day, where nobody came in). */
  scheduledStaff: number;
  /** The walking group during a resolved walk (min(walk.groupSize, dogs) dogs and one staffer); 0 otherwise. */
  walkingDogs: number;
  walkingStaff: number;
  /** Inside the fence during this block: dogs − walkingDogs, staff − walkingStaff. */
  floorDogs: number;
  floorStaff: number;
  /** Dogs per staffer on the floor after the walking group has left: result.floorRatio (0 with no dogs or closed). */
  ratio: number;
  /** Today's plan; null on a closed day. */
  rate: Rate | null;
  bookings: Bookings | null;
  requests: number; // owners asking today
  accepted: number; // = dogs
  /** Tomorrow's requests: the projection after this block; at pickup the final figure. */
  requestsTomorrow: number;
  /** Consecutive days the floor ran with exactly one staffer, counting through yesterday. */
  soloStreak: number;
  energy: number;
  cleanliness: number;
  fatigue: number;
  reputation: number;
  cash: number;
  /** Counters over steps 0..t. */
  incidentsSoFar: number;
  finesSoFar: number;
  sickSoFar: number;
  dogsServedSoFar: number;
  /** This block's events, as the world reported them. */
  events: WorldEvent[];
  /**
   * The events in business words, in the order they happened, as events and never as rules (BRIEF section 3: the
   * state is visible, the rules are hidden): 'Incident', 'Vet bill $150', 'Inspector: $250 fine', '2 dogs sent home
   * sick' ('1 dog sent home sick'), 'The staffer called out: closed today' (for the callOut event; the closed event
   * adds nothing), 'Walk photo posted'. A fallback (walkFellBack, structuredFellBack) gets no caption: the header's
   * activityWords already read 'walk → free play'. The dollar amounts come from the event's amount.
   */
  captions: string[];
}

const DAY_NAMES: readonly string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const BLOCK_NAMES: readonly string[] = ['drop-off', 'late morning', 'afternoon', 'pickup'];
const ACTIVITY_WORDS: Readonly<Record<FloorActivity, string>> = {
  freePlay: 'free play',
  structuredPlay: 'structured play',
  nap: 'nap',
  walk: 'walk',
  clean: 'clean',
};
const RATE_WORDS: Readonly<Record<Rate, string>> = { low: 'low rate', standard: 'standard rate', premium: 'premium rate' };

/** Whole dollars with commas and a typographic minus: "$3,130", "−$120". */
function dollars(v: number): string {
  const whole = Math.round(v);
  const text = `$${Math.abs(whole).toLocaleString('en-US')}`;
  return whole < 0 ? `−${text}` : text;
}

/** One event in business words, or null for the events that get no caption (closed, the two fallbacks). */
function captionOf(e: WorldEvent): string | null {
  switch (e.type) {
    case 'incident':
      return 'Incident';
    case 'vetBill':
      return `Vet bill ${dollars(e.amount ?? 0)}`;
    case 'inspection':
      return `Inspector: ${dollars(e.amount ?? 0)} fine`;
    case 'illness': {
      const n = e.amount ?? 0;
      return n === 1 ? '1 dog sent home sick' : `${n} dogs sent home sick`;
    }
    case 'callOut':
      return 'The staffer called out: closed today';
    case 'walkPhoto':
      return 'Walk photo posted';
    case 'closed':
    case 'walkFellBack':
    case 'structuredFellBack':
      return null;
  }
}

/**
 * What the canvas shows for step t of a 20-step week. Let dayState be the step's result.state at drop-off (block 0)
 * and the step's state (before the action) in blocks 1..3: it carries the day as resolved at drop-off and still
 * holds it at pickup (the state after pickup is already the next morning's). From dayState: dogs, staff,
 * scheduledStaff, closed, calledOut, and the plan's rate and bookings (null when closed). From the step's state:
 * day, block, requests (requestsToday), soloStreak. accepted = dogs. Energy, cleanliness and fatigue: after the
 * block (result.state), except at pickup where result.pickup is used. Reputation and cash: result.state.
 * requestsTomorrow: result.state.requestsTomorrow, and at pickup result.state.requestsToday. Throws on t outside
 * 0..19 or a week that is not 20 steps.
 */
export function replayFrame(steps: readonly StepRecord[], t: number, world: WorldConfig): ReplayFrame {
  if (steps.length !== WEEK_STEPS) throw new Error(`replayFrame: a week is ${WEEK_STEPS} steps, got ${steps.length}`);
  if (!Number.isInteger(t) || t < 0 || t >= WEEK_STEPS) throw new Error(`replayFrame: step ${t} is outside the week`);
  const record = steps[t] as StepRecord;
  const before = record.state;
  const result = record.result;
  const after = result.state;
  const isDropOff = before.block === 0;
  const isPickup = before.block === world.blocksPerDay - 1;
  const dayState: State = isDropOff ? after : before;

  const closed = dayState.closed;
  const dogs = dayState.dogsOnFloor;
  const staff = dayState.floorStaff;
  const plan = closed ? null : dayState.plan;
  const activity = result.activity;
  const requested = record.action.kind === 'floor' ? record.action.activity : null;

  let activityWords = 'closed';
  if (!closed && activity !== null) {
    activityWords =
      requested !== null && requested !== activity
        ? `${ACTIVITY_WORDS[requested]} → ${ACTIVITY_WORDS[activity]}`
        : ACTIVITY_WORDS[activity];
  }

  // The walking group leaves the fence with one staffer; the floor inside runs on the rest (the gauge's population).
  const walking = !closed && activity === 'walk';
  const walkingDogs = walking ? Math.min(world.walk.groupSize, dogs) : 0;
  const walkingStaff = walking ? 1 : 0;

  // Energy, cleanliness and fatigue after the block; at pickup the snapshot, before the night resets them.
  const pickup = isPickup ? result.pickup : undefined;

  let incidentsSoFar = 0;
  let finesSoFar = 0;
  let sickSoFar = 0;
  let dogsServedSoFar = 0;
  for (let i = 0; i <= t; i++) {
    const r = (steps[i] as StepRecord).result;
    incidentsSoFar += r.deltas.incidents;
    dogsServedSoFar += r.deltas.dogsServed;
    for (const e of r.events) {
      if (e.type === 'inspection') finesSoFar += 1;
      else if (e.type === 'illness') sickSoFar += e.amount ?? 0;
    }
  }

  const captions: string[] = [];
  for (const e of result.events) {
    const caption = captionOf(e);
    if (caption !== null) captions.push(caption);
  }

  return {
    day: before.day,
    block: before.block,
    dayName: DAY_NAMES[before.day] ?? `Day ${before.day + 1}`,
    blockName: BLOCK_NAMES[before.block] ?? `block ${before.block + 1}`,
    closed,
    calledOut: dayState.calledOut,
    activity: closed ? null : activity,
    requested,
    activityWords,
    dogs,
    staff,
    scheduledStaff: dayState.scheduledStaff,
    walkingDogs,
    walkingStaff,
    floorDogs: dogs - walkingDogs,
    floorStaff: staff - walkingStaff,
    ratio: result.floorRatio,
    rate: plan === null ? null : plan.rate,
    bookings: plan === null ? null : plan.bookings,
    requests: before.requestsToday,
    accepted: dogs,
    requestsTomorrow: isPickup ? after.requestsToday : after.requestsTomorrow,
    soloStreak: before.soloStreak,
    energy: pickup?.energy ?? after.energy,
    cleanliness: pickup?.cleanliness ?? after.cleanliness,
    fatigue: pickup?.fatigue ?? after.fatigue,
    reputation: after.reputation,
    cash: after.cash,
    incidentsSoFar,
    finesSoFar,
    sickSoFar,
    dogsServedSoFar,
    events: [...result.events],
    captions,
  };
}

export interface ReplayColors {
  background: string;
  ink: string;
  muted: string;
  grass: string;
  fence: string;
  dog: string[]; // three coat colours
  crew: string;
  incident: string;
  reputation: string;
  cash: string;
  gaugeOver: string; // the band above the legal ratio
}

export interface ReplayOptions {
  pixelRatio: number;
  colors: ReplayColors;
  /** 0..1 inside the step, for the incident pulse. */
  progress: number;
  /** The legal ratio mark on the gauge (world.bookings.legalRatio) and the gauge's top (world.requests.max). */
  legalRatio: number;
  gaugeMax: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing. Everything is measured in `fs`, the body text size, which scales with the canvas so the back row of a
// classroom can read it, and shrinks when the HUD would not fit. Nothing is kept between calls.

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const PLACEHOLDER = "The GM's week plays here once it is on the job.";
/** The widest plan line, measured once per layout so the header does not jump from frame to frame. */
const PLAN_TEMPLATE = '30 asked · 30 accepted, capped at the legal ratio · standard rate · crew 3 scheduled, 3 in';
/** The widest HUD lines, for the same reason. */
const HUD_TEMPLATES = ['Days the crew ran solo: 5', 'Tomorrow: 30 asking', 'Inspector visits 10', 'Sent home sick 10'];
const CASH_TEMPLATE = 'Cash −$10,000';
/** The meters' scale (BRIEF section 3: reputation, energy, cleanliness and fatigue run 0 to 100). */
const METER_MAX = 100;

const fontOf = (px: number, bold = false): string =>
  `${bold ? '600 ' : ''}${Math.max(1, Math.round(px * 10) / 10)}px ${FONT_FAMILY}`;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A small integer hash to [0, 1): the jitter and the coat of dog i, the same on every frame. No randomness. */
function hash01(n: number): number {
  let x = Math.imul(n ^ 0x5bd1e995, 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sets the font and returns the size at which `text` fits in `maxW` (never larger than `px`). */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, bold = false): number {
  ctx.font = fontOf(px, bold);
  const w = ctx.measureText(text).width;
  if (w <= maxW || w <= 0) return px;
  const fitted = Math.max(1, px * (maxW / w));
  ctx.font = fontOf(fitted, bold);
  return fitted;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
}

function formatRatio(ratio: number): string {
  return Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1);
}

/** The sizes and boxes of one frame, from the canvas size and the text size. */
interface Layout {
  fs: number;
  pad: number;
  titlePx: number;
  planPx: number;
  planLines: 1 | 2;
  headerH: number;
  yard: Box;
  path: Box;
  captions: Box;
  hud: Box;
  /** What the layout needs: the full height, and the HUD's widest line against the room it has. */
  neededH: number;
  hudOverflow: number; // > 1 when the HUD's lines are wider than its column may be
}

// The HUD's rows, in units of fs, top to bottom.
const HUD_ROWS = {
  dogsCrew: 1.6,
  gauge: 4.3,
  incidents: 2,
  reputation: 2.45,
  cash: 1.95,
  meter: 1.3,
  meterGap: 0.35,
  line: 1.35,
} as const;
const HUD_UNITS =
  HUD_ROWS.dogsCrew +
  HUD_ROWS.gauge +
  HUD_ROWS.incidents +
  HUD_ROWS.reputation +
  HUD_ROWS.cash +
  3 * HUD_ROWS.meter +
  HUD_ROWS.meterGap +
  4 * HUD_ROWS.line; // tomorrow, solo, sick, inspector: the last two rows are kept even when empty, so nothing jumps

function layoutFor(ctx: CanvasRenderingContext2D, width: number, height: number, fs: number): Layout {
  const pad = fs * 0.7;
  const titlePx = fs * 1.2;
  const planPx = fs;
  ctx.font = fontOf(planPx);
  const planLines: 1 | 2 = ctx.measureText(PLAN_TEMPLATE).width <= width - 2 * pad ? 1 : 2;
  const headerH = pad + titlePx * 1.3 + planLines * planPx * 1.35 + fs * 0.45;

  // The HUD column: as wide as its widest line, between 30% and 46% of the canvas.
  ctx.font = fontOf(fs * 0.95);
  let widest = 0;
  for (const text of HUD_TEMPLATES) widest = Math.max(widest, ctx.measureText(text).width);
  ctx.font = fontOf(fs * 1.25, true);
  widest = Math.max(widest, ctx.measureText(CASH_TEMPLATE).width);
  const hudMax = width * 0.46;
  const hudW = clamp(widest + fs * 0.3, width * 0.3, hudMax);
  const gap = fs * 0.9;

  const bodyTop = headerH;
  const bodyBottom = height - pad * 0.7;
  const hud: Box = { x: width - pad - hudW, y: bodyTop, w: hudW, h: bodyBottom - bodyTop };

  // The left column: the yard, the walk path outside the fence, the captions under them.
  const leftW = Math.max(1, hud.x - gap - pad);
  const capH = 2 * fs * 1.3;
  const pathH = fs * 3.2;
  const pathGap = fs * 0.35;
  const yardH = Math.max(1, bodyBottom - bodyTop - pathGap - pathH - fs * 0.3 - capH);
  const yard: Box = { x: pad, y: bodyTop, w: leftW, h: yardH };
  const path: Box = { x: pad, y: yard.y + yardH + pathGap, w: leftW, h: pathH };
  const captions: Box = { x: pad, y: path.y + pathH + fs * 0.3, w: leftW, h: capH };

  const yardMin = fs * 7;
  const leftNeeded = yardMin + pathGap + pathH + fs * 0.3 + capH;
  const neededH = headerH + Math.max(HUD_UNITS * fs, leftNeeded) + pad * 0.7;
  return {
    fs,
    pad,
    titlePx,
    planPx,
    planLines,
    headerH,
    yard,
    path,
    captions,
    hud,
    neededH,
    hudOverflow: (widest + fs * 0.3) / hudMax,
  };
}

/** The layout at the largest text size that fits: scaled with the width and the height, 11 to 24 px. */
function fitLayout(ctx: CanvasRenderingContext2D, width: number, height: number): Layout {
  let fs = clamp(Math.min(width / 34, height / 28), 11, 24);
  let layout = layoutFor(ctx, width, height, fs);
  for (let i = 0; i < 4; i++) {
    const shrink = Math.min(1, height / layout.neededH, 1 / layout.hudOverflow);
    if (shrink >= 0.995 || fs <= 7) break;
    fs = Math.max(7, fs * shrink * 0.99);
    layout = layoutFor(ctx, width, height, fs);
  }
  return layout;
}

/**
 * Draws one frame into `ctx` (a canvas of `width` × `height` CSS pixels at options.pixelRatio). With a null frame
 * it draws the placeholder "The GM's week plays here once it is on the job." Pure: reads the frame, keeps nothing. The
 * picture is the G4 plan's "The replay's picture": the header with the day, the block and the activity, the plan
 * line ("20 asked · 20 accepted · premium rate · crew 1 scheduled, 1 in"), the yard with floorDogs and floorStaff
 * inside the fence and the walking group on a path outside it, the HUD (dogs and crew, the gauge with its one mark
 * at legalRatio and the band above it tinted, the incident counter and its pulsing icon, the reputation meter, the
 * cash counter, the small energy, cleanliness and fatigue meters, "Tomorrow: N asking", "Days the crew ran solo:
 * N", the sick and fines counters when above 0) and the captions under the yard.
 */
export function drawReplay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReplayFrame | null,
  options: ReplayOptions,
): void {
  const { colors } = options;
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;

  if (frame === null) {
    const fs = clamp(Math.min(width / 34, height / 20), 11, 24);
    fitFont(ctx, PLACEHOLDER, width * 0.9, fs);
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PLACEHOLDER, width / 2, height / 2);
    return;
  }

  const layout = fitLayout(ctx, width, height);
  drawHeader(ctx, width, frame, layout, colors);
  drawYard(ctx, frame, layout, options);
  drawCaptions(ctx, frame.captions, layout, colors);
  drawHud(ctx, frame, layout, options);
}

/** "Monday · late morning · free play" and the day's plan under it. */
/** The booking choice in business words: what the GM did with the day's requests, never the number behind it. */
const BOOKING_WORDS: Readonly<Record<Bookings, string>> = {
  all: 'every booking',
  legal: 'capped at the legal ratio',
  safe: 'capped at a safe ratio',
};

/**
 * The day's plan under the header, in two parts so a narrow canvas can break the line before the crew:
 * "20 asked · 20 accepted, every booking · premium rate" and "crew 1 scheduled, 1 in"; on a closed day
 * "16 asked · closed" and "crew 1 scheduled, nobody in".
 */
export function planParts(frame: ReplayFrame): { first: string; crew: string } {
  const crew = `crew ${frame.scheduledStaff} scheduled, ${frame.closed ? 'nobody' : String(frame.staff)} in`;
  if (frame.closed) return { first: `${frame.requests} asked · closed`, crew };
  const bookings = frame.bookings === null ? '' : `, ${BOOKING_WORDS[frame.bookings]}`;
  const rate = frame.rate === null ? 'no rate' : RATE_WORDS[frame.rate];
  return { first: `${frame.requests} asked · ${frame.accepted} accepted${bookings} · ${rate}`, crew };
}

/** The whole plan line, as the header shows it on one line. */
export function planWords(frame: ReplayFrame): string {
  const { first, crew } = planParts(frame);
  return `${first} · ${crew}`;
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  frame: ReplayFrame,
  layout: Layout,
  colors: ReplayColors,
): void {
  const { pad, titlePx, planPx } = layout;
  const maxW = width - 2 * pad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const title = `${frame.dayName} · ${frame.blockName} · ${frame.activityWords}`;
  fitFont(ctx, title, maxW, titlePx, true);
  ctx.fillStyle = colors.ink;
  let y = pad + (titlePx * 1.3) / 2;
  ctx.fillText(title, pad, y);

  const { first, crew } = planParts(frame);
  const lines = layout.planLines === 1 ? [`${first} · ${crew}`] : [first, crew];
  ctx.fillStyle = colors.muted;
  y += (titlePx * 1.3) / 2;
  for (const line of lines) {
    fitFont(ctx, line, maxW, planPx);
    ctx.fillText(line, pad, y + (planPx * 1.35) / 2);
    y += planPx * 1.35;
  }
}

/** The events of the block under the yard, joined with " · " and wrapped onto two lines at most. */
function drawCaptions(ctx: CanvasRenderingContext2D, captions: readonly string[], layout: Layout, colors: ReplayColors): void {
  if (captions.length === 0) return;
  const box = layout.captions;
  let px = layout.fs * 1.05;
  let lines = packLines(ctx, captions, box.w, px);
  for (let i = 0; i < 6 && lines.length > 2; i++) {
    px *= 0.9;
    lines = packLines(ctx, captions, box.w, px);
  }
  const lineH = Math.min(px * 1.3, box.h / Math.max(1, lines.length));
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    fitFont(ctx, line, box.w, px, true);
    ctx.fillText(line, box.x, box.y + lineH * (i + 0.5));
  });
}

/** Greedy lines of captions joined with " · ", at `px` bold. */
function packLines(ctx: CanvasRenderingContext2D, captions: readonly string[], maxW: number, px: number): string[] {
  ctx.font = fontOf(px, true);
  const lines: string[] = [];
  let current = '';
  for (const caption of captions) {
    const joined = current === '' ? caption : `${current} · ${caption}`;
    if (current !== '' && ctx.measureText(joined).width > maxW) {
      lines.push(current);
      current = caption;
    } else {
      current = joined;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------------------------------------------
// The yard.

type Pose = 'stand' | 'lie';

/**
 * A dog: a body circle and a head circle with two dark ears, an eye, a nose, a tail and two legs. (x, y) is the
 * body's centre, r the body's radius; the figure spans about 3.3 r wide and 2.7 r tall. `dir` is the way it faces.
 */
function drawDog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  dir: 1 | -1,
  coat: string,
  colors: ReplayColors,
  pose: Pose,
): void {
  const line = Math.max(1, r * 0.22);
  ctx.lineCap = 'round';
  if (pose === 'stand') {
    // Legs and tail first, so the body covers their ends.
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.moveTo(x - 0.45 * r, y + 0.5 * r);
    ctx.lineTo(x - 0.5 * r, y + 1.25 * r);
    ctx.moveTo(x + 0.45 * r, y + 0.5 * r);
    ctx.lineTo(x + 0.5 * r, y + 1.25 * r);
    ctx.stroke();
    ctx.strokeStyle = coat;
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.beginPath();
    ctx.moveTo(x - dir * 0.75 * r, y - 0.2 * r);
    ctx.quadraticCurveTo(x - dir * 1.45 * r, y - 0.3 * r, x - dir * 1.5 * r, y - 0.95 * r);
    ctx.stroke();
  }

  const bodyY = pose === 'lie' ? y + 0.45 * r : y;
  const headR = (pose === 'lie' ? 0.55 : 0.62) * r;
  const hx = x + dir * (pose === 'lie' ? 1.05 : 0.95) * r;
  const hy = pose === 'lie' ? y + 0.4 * r : y - 0.6 * r;

  ctx.fillStyle = coat;
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = Math.max(0.75, r * 0.08);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  if (pose === 'lie') ctx.ellipse(x, bodyY, 1.1 * r, 0.55 * r, 0, 0, Math.PI * 2);
  else ctx.arc(x, bodyY, 0.88 * r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;
  circle(ctx, hx, hy, headR);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Ears: two dark drops on the head, flat when the dog is lying down.
  ctx.fillStyle = colors.ink;
  ctx.globalAlpha = 0.65;
  const earTilt = pose === 'lie' ? dir * 1.1 : dir * 0.35;
  ctx.beginPath();
  ctx.ellipse(hx - dir * 0.38 * r, hy - 0.3 * r, 0.18 * r, 0.36 * r, earTilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + dir * 0.12 * r, hy - 0.45 * r, 0.16 * r, 0.32 * r, earTilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // An eye (closed while napping) and a nose.
  if (pose === 'lie') {
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = Math.max(0.75, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(hx + dir * 0.1 * r, hy - 0.05 * r);
    ctx.lineTo(hx + dir * 0.32 * r, hy - 0.05 * r);
    ctx.stroke();
  } else {
    circle(ctx, hx + dir * 0.25 * r, hy - 0.1 * r, Math.max(0.6, r * 0.09));
    ctx.fill();
  }
  circle(ctx, hx + dir * headR * 0.95, hy + 0.05 * r, Math.max(0.6, r * 0.11));
  ctx.fill();
}

/**
 * A crew member, about 1.6 times a dog's height: legs, a rounded body and a head in the crew colour, arms down.
 * (x, feet) is where it stands. With `broom` the right hand holds a broom swung by that angle.
 */
function drawCrew(
  ctx: CanvasRenderingContext2D,
  x: number,
  feet: number,
  r: number,
  colors: ReplayColors,
  broom: number | null,
): void {
  const hips = feet - 1.2 * r;
  const shoulders = feet - 3.0 * r;
  ctx.lineCap = 'round';
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = Math.max(1, r * 0.3);
  ctx.beginPath();
  ctx.moveTo(x - 0.25 * r, hips);
  ctx.lineTo(x - 0.32 * r, feet);
  ctx.moveTo(x + 0.25 * r, hips);
  ctx.lineTo(x + 0.32 * r, feet);
  ctx.stroke();

  ctx.strokeStyle = colors.crew;
  ctx.lineWidth = Math.max(1, r * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - 0.55 * r, shoulders + 0.2 * r);
  ctx.lineTo(x - 0.9 * r, feet - 1.6 * r);
  ctx.moveTo(x + 0.55 * r, shoulders + 0.2 * r);
  ctx.lineTo(x + 0.9 * r, feet - 1.6 * r);
  ctx.stroke();

  ctx.fillStyle = colors.crew;
  roundRectPath(ctx, x - 0.6 * r, shoulders, 1.2 * r, hips - shoulders + 0.15 * r, 0.4 * r);
  ctx.fill();
  circle(ctx, x, shoulders - 0.68 * r, 0.55 * r);
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = Math.max(0.75, r * 0.08);
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (broom !== null) {
    // The stick from the hand to the floor, the head of the broom at its foot.
    const hx = x + 0.9 * r;
    const hy = feet - 1.6 * r;
    const len = 2.2 * r;
    const angle = 0.45 + broom; // from straight down, towards the figure's right
    const bx = hx + Math.sin(angle) * len;
    const by = hy + Math.cos(angle) * len;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(hx - Math.sin(angle) * 0.6 * r, hy - Math.cos(angle) * 0.6 * r);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.fillStyle = colors.fence;
    ctx.beginPath();
    ctx.moveTo(bx - 0.5 * r, by + 0.45 * r);
    ctx.lineTo(bx + 0.5 * r, by + 0.45 * r);
    ctx.lineTo(bx + 0.22 * r, by - 0.05 * r);
    ctx.lineTo(bx - 0.22 * r, by - 0.05 * r);
    ctx.closePath();
    ctx.fill();
  }
}

const coatOf = (i: number, colors: ReplayColors): string => {
  const n = colors.dog.length;
  return n === 0 ? colors.ink : (colors.dog[Math.floor(hash01(i * 3 + 11) * n)] ?? colors.ink);
};
const dirOf = (i: number): 1 | -1 => (hash01(i * 5 + 2) < 0.5 ? -1 : 1);

/** The free-play spots: a grid sized for the most dogs the yard ever holds, its cells in a fixed scattered order. */
interface Spots {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  order: number[];
  r: number; // the dog's body radius that fits a cell
}

function spotsFor(inner: Box, capacity: number): Spots {
  const cap = Math.max(1, capacity);
  const cols = Math.max(1, Math.round(Math.sqrt((cap * inner.w) / Math.max(1, inner.h))));
  const rows = Math.max(1, Math.ceil(cap / cols));
  const cellW = inner.w / cols;
  const cellH = inner.h / rows;
  const order = Array.from({ length: cols * rows }, (_, s) => s).sort((a, b) => hash01(a + 7919) - hash01(b + 7919));
  return { cols, rows, cellW, cellH, order, r: Math.max(1, Math.min(cellW / 3.9, cellH / 3.3)) };
}

/** Dog i's spot in free play: its cell in the scattered order, jittered by its index, inside the yard. */
function spotOf(i: number, spots: Spots, inner: Box, r: number): { x: number; y: number } {
  const slot = spots.order[i % spots.order.length] ?? i;
  const col = slot % spots.cols;
  const row = Math.floor(slot / spots.cols);
  const jx = (hash01(i * 2 + 101) - 0.5) * spots.cellW * 0.35;
  const jy = (hash01(i * 2 + 202) - 0.5) * spots.cellH * 0.3;
  return {
    x: clamp(inner.x + (col + 0.5) * spots.cellW + jx, inner.x + 1.6 * r, inner.x + inner.w - 1.6 * r),
    y: clamp(inner.y + (row + 0.5) * spots.cellH + jy, inner.y + 1.5 * r, inner.y + inner.h - 1.3 * r),
  };
}

function drawYard(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layout: Layout, options: ReplayOptions): void {
  const { colors } = options;
  const { yard, fs } = layout;

  // Grass, then the fence: a rail around the yard and a post every couple of text lines.
  ctx.fillStyle = colors.grass;
  roundRectPath(ctx, yard.x, yard.y, yard.w, yard.h, fs * 0.35);
  ctx.fill();
  const fw = Math.max(2, fs * 0.18);
  ctx.strokeStyle = colors.fence;
  ctx.lineWidth = fw;
  roundRectPath(ctx, yard.x + fw / 2, yard.y + fw / 2, yard.w - fw, yard.h - fw, fs * 0.3);
  ctx.stroke();
  ctx.fillStyle = colors.fence;
  const post = fw * 1.8;
  const spacing = fs * 2.4;
  const nx = Math.max(1, Math.round(yard.w / spacing));
  const ny = Math.max(1, Math.round(yard.h / spacing));
  for (let i = 0; i <= nx; i++) {
    const px = yard.x + fw / 2 + ((yard.w - fw) * i) / nx - post / 2;
    ctx.fillRect(px, yard.y, post, post);
    ctx.fillRect(px, yard.y + yard.h - post, post, post);
  }
  for (let j = 1; j < ny; j++) {
    const py = yard.y + fw / 2 + ((yard.h - fw) * j) / ny - post / 2;
    ctx.fillRect(yard.x, py, post, post);
    ctx.fillRect(yard.x + yard.w - post, py, post, post);
  }

  drawPath(ctx, frame, layout, options);

  const inset = fw + fs * 0.35;
  const inner: Box = { x: yard.x + inset, y: yard.y + inset, w: yard.w - 2 * inset, h: yard.h - 2 * inset };
  if (inner.w <= 4 || inner.h <= 4) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  if (frame.closed || frame.activity === null) drawClosedSign(ctx, inner, fs, colors);
  else {
    const spots = spotsFor(inner, Math.max(options.gaugeMax, frame.dogs, 1));
    if (frame.activity === 'structuredPlay') drawStructured(ctx, frame, inner, spots, colors);
    else if (frame.activity === 'clean') drawClean(ctx, frame, inner, spots, options);
    else drawScattered(ctx, frame, inner, spots, colors, frame.activity === 'nap' ? 'lie' : 'stand', fs);
  }
  ctx.restore();
}

/** Free play, a nap, and the floor left behind by a walk: every dog on its own spot, the crew among them. */
function drawScattered(
  ctx: CanvasRenderingContext2D,
  frame: ReplayFrame,
  inner: Box,
  spots: Spots,
  colors: ReplayColors,
  pose: Pose,
  fs: number,
): void {
  const r = spots.r;
  const placed = Array.from({ length: frame.floorDogs }, (_, i) => ({ i, ...spotOf(i, spots, inner, r) }));
  placed.sort((a, b) => a.y - b.y); // farther dogs first
  for (const d of placed) drawDog(ctx, d.x, d.y, r, dirOf(d.i), coatOf(d.i, colors), colors, pose);

  if (pose === 'lie') {
    // A small "zz" over each sleeping dog.
    ctx.fillStyle = colors.ink;
    ctx.globalAlpha = 0.75;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const zPx = Math.max(fs * 0.7, r * 0.95);
    ctx.font = fontOf(zPx, true);
    for (const d of placed) {
      const dir = dirOf(d.i);
      ctx.fillText('z', d.x + dir * 1.15 * r, d.y - 0.1 * r);
      ctx.font = fontOf(zPx * 0.75, true);
      ctx.fillText('z', d.x + dir * 1.6 * r, d.y - 0.75 * r);
      ctx.font = fontOf(zPx, true);
    }
    ctx.globalAlpha = 1;
  }

  // The crew stand across the middle of the yard.
  const n = frame.floorStaff;
  const crewR = Math.min(r, inner.h / 5.2);
  for (let k = 0; k < n; k++) {
    const x = inner.x + (inner.w * (k + 1)) / (n + 1);
    const feet = Math.min(inner.y + inner.h - 0.2 * crewR, inner.y + inner.h * 0.5 + 2.2 * crewR);
    drawCrew(ctx, x, feet, crewR, colors, null);
  }
}

/** Structured play: the crew on the left, the dogs in rows facing them. */
function drawStructured(ctx: CanvasRenderingContext2D, frame: ReplayFrame, inner: Box, spots: Spots, colors: ReplayColors): void {
  const n = frame.floorDogs;
  const crewR = Math.min(spots.r, inner.h / 5.2);
  const leftW = Math.max(2.6 * crewR, inner.w * 0.18);
  const area: Box = { x: inner.x + leftW, y: inner.y, w: Math.max(1, inner.w - leftW), h: inner.h };
  const cols = Math.max(1, Math.ceil(Math.sqrt((Math.max(1, n) * area.w) / Math.max(1, area.h))));
  const rows = Math.max(1, Math.ceil(Math.max(1, n) / cols));
  const cellW = area.w / cols;
  const cellH = area.h / rows;
  const r = Math.max(1, Math.min(spots.r, cellW / 3.6, cellH / 3.1));
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawDog(ctx, area.x + (col + 0.5) * cellW, area.y + (row + 0.5) * cellH, r, -1, coatOf(i, colors), colors, 'stand');
  }
  const staff = frame.floorStaff;
  for (let k = 0; k < staff; k++) {
    const centre = inner.y + (inner.h * (k + 1)) / (staff + 1);
    const feet = clamp(centre + 2.2 * crewR, inner.y + 4.4 * crewR, inner.y + inner.h - 0.2 * crewR);
    drawCrew(ctx, inner.x + leftW / 2, feet, crewR, colors, null);
  }
}

/** Cleaning: the dogs in a row of crates at the side, the crew sweeping the open floor. */
function drawClean(ctx: CanvasRenderingContext2D, frame: ReplayFrame, inner: Box, spots: Spots, options: ReplayOptions): void {
  const { colors } = options;
  const n = frame.floorDogs;
  // Crates in columns from the left, as large as fits in at most 60% of the width.
  let cs = Math.min(spots.cellW, spots.cellH) * 0.9;
  let perCol = Math.max(1, Math.floor(inner.h / cs));
  for (let i = 0; i < 40 && n > 0 && Math.ceil(n / perCol) * cs > inner.w * 0.6; i++) {
    cs *= 0.95;
    perCol = Math.max(1, Math.floor(inner.h / cs));
  }
  const colsUsed = n > 0 ? Math.ceil(n / perCol) : 0;
  const top = inner.y + (inner.h - Math.min(n, perCol) * cs) / 2;
  for (let i = 0; i < n; i++) {
    const x = inner.x + Math.floor(i / perCol) * cs;
    const y = top + (i % perCol) * cs;
    const gap = cs * 0.08;
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x + gap, y + gap, cs - 2 * gap, cs - 2 * gap);
    ctx.globalAlpha = 1;
    drawDog(ctx, x + cs * 0.52, y + cs * 0.55, cs / 4.3, dirOf(i), coatOf(i, colors), colors, 'stand');
    // The crate's frame and bars, in front of the dog.
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = Math.max(1, cs * 0.05);
    ctx.strokeRect(x + gap, y + gap, cs - 2 * gap, cs - 2 * gap);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(0.75, cs * 0.03);
    ctx.beginPath();
    for (let b = 1; b <= 3; b++) {
      const bx = x + gap + ((cs - 2 * gap) * b) / 4;
      ctx.moveTo(bx, y + gap);
      ctx.lineTo(bx, y + cs - gap);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const openX = inner.x + colsUsed * cs;
  const openW = Math.max(1, inner.x + inner.w - openX);
  const staff = frame.floorStaff;
  const crewR = Math.min(spots.r, inner.h / 5.2, openW / (3.4 * Math.max(1, staff)));
  const swing = Math.sin(clamp(options.progress, 0, 1) * Math.PI * 2) * 0.35;
  for (let k = 0; k < staff; k++) {
    const x = openX + (openW * (k + 1)) / (staff + 1) - 0.6 * crewR;
    const feet = Math.min(inner.y + inner.h - 0.7 * crewR, inner.y + inner.h * 0.55 + 2.2 * crewR);
    drawCrew(ctx, x, feet, crewR, colors, k % 2 === 0 ? swing : -swing);
  }
}

/** A closed day: the yard empty and a "Closed" sign on a post. */
function drawClosedSign(ctx: CanvasRenderingContext2D, inner: Box, fs: number, colors: ReplayColors): void {
  const px = clamp(Math.min(inner.w / 6, inner.h / 4), fs, fs * 2.4);
  ctx.font = fontOf(px, true);
  const textW = ctx.measureText('Closed').width;
  const boardW = Math.min(inner.w * 0.9, textW + px * 1.2);
  const boardH = px * 1.7;
  const cx = inner.x + inner.w / 2;
  const boardY = inner.y + inner.h / 2 - boardH * 0.8;
  ctx.fillStyle = colors.fence;
  ctx.fillRect(cx - px * 0.15, boardY + boardH * 0.5, px * 0.3, Math.min(inner.y + inner.h - boardY - boardH * 0.5, boardH * 1.4));
  ctx.fillStyle = colors.background;
  roundRectPath(ctx, cx - boardW / 2, boardY, boardW, boardH, px * 0.25);
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = Math.max(1.5, px * 0.08);
  ctx.stroke();
  fitFont(ctx, 'Closed', boardW - px * 0.4, px, true);
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Closed', cx, boardY + boardH / 2);
}

/** The path outside the fence; during a walk it carries the walking group, the staffer leading on the leashes. */
function drawPath(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layout: Layout, options: ReplayOptions): void {
  const { colors } = options;
  const { path, fs } = layout;
  ctx.fillStyle = colors.muted;
  ctx.globalAlpha = 0.16;
  roundRectPath(ctx, path.x, path.y, path.w, path.h, path.h / 2);
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([fs * 0.5, fs * 0.4]);
  ctx.beginPath();
  ctx.moveTo(path.x + path.h / 2, path.y + path.h * 0.88);
  ctx.lineTo(path.x + path.w - path.h / 2, path.y + path.h * 0.88);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // The staffer walks whenever a walk went ahead, with or without dogs (a week with no requests has empty leashes).
  const n = frame.walkingDogs;
  if (frame.walkingStaff <= 0) return;
  const usable = path.w - path.h; // keep clear of the rounded ends
  const r = Math.max(1, Math.min(path.h / 4.7, usable / (3.4 * n + 2.6)));
  const spacing = 3.4 * r;
  const groupW = n * spacing + 2.6 * r;
  const feet = path.y + path.h * 0.94;
  const start = path.x + path.h / 2 + (usable - groupW) / 2;
  const crewX = start + groupW - 1.2 * r;
  const handX = crewX - 0.9 * r;
  const handY = feet - 1.6 * r;
  const step = clamp(options.progress, 0, 1);

  const dogs: { x: number; y: number; i: number }[] = [];
  for (let k = 0; k < n; k++) {
    const i = frame.floorDogs + k; // the dogs that left the yard keep their coats
    const bob = Math.abs(Math.sin((step * 2 + k * 0.37) * Math.PI)) * 0.18 * r;
    dogs.push({ i, x: start + 1.6 * r + k * spacing, y: feet - 1.3 * r - bob });
  }
  // Leashes from the staffer's hand to each dog.
  ctx.strokeStyle = colors.ink;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(0.75, r * 0.1);
  ctx.beginPath();
  for (const d of dogs) {
    ctx.moveTo(handX, handY);
    ctx.lineTo(d.x + 0.95 * r, d.y - 0.35 * r);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (const d of dogs) drawDog(ctx, d.x, d.y, r, 1, coatOf(d.i, colors), colors, 'stand');
  drawCrew(ctx, crewX, feet, r, colors, null);
}

// ---------------------------------------------------------------------------------------------------------------
// The HUD down the right.

/** A horizontal meter: a faint track and a fill for value / max. */
function drawMeter(ctx: CanvasRenderingContext2D, box: Box, value: number, max: number, fill: string, colors: ReplayColors): void {
  const f = clamp(max > 0 ? value / max : 0, 0, 1);
  ctx.fillStyle = colors.muted;
  ctx.globalAlpha = 0.22;
  roundRectPath(ctx, box.x, box.y, box.w, box.h, box.h / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (f > 0) {
    ctx.fillStyle = fill;
    roundRectPath(ctx, box.x, box.y, Math.max(box.h, box.w * f), box.h, box.h / 2);
    ctx.fill();
  }
}

/** Text at the left of the column and a number at its right, on one row centred at y. */
function labelRow(
  ctx: CanvasRenderingContext2D,
  hud: Box,
  y: number,
  label: string,
  value: string,
  px: number,
  colors: ReplayColors,
  valueColor: string,
): void {
  ctx.textBaseline = 'middle';
  ctx.font = fontOf(px * 1.05, true);
  const valueW = ctx.measureText(value).width;
  ctx.textAlign = 'right';
  ctx.fillStyle = valueColor;
  ctx.fillText(value, hud.x + hud.w, y);
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.muted;
  fitFont(ctx, label, Math.max(1, hud.w - valueW - px * 0.5), px * 0.9);
  ctx.fillText(label, hud.x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layout: Layout, options: ReplayOptions): void {
  const { colors } = options;
  const { hud, fs } = layout;
  const text = (s: string, y: number, px: number, color: string, bold = false): void => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    fitFont(ctx, s, hud.w, px, bold);
    ctx.fillText(s, hud.x, y);
  };
  let y = hud.y;

  // Dogs and crew inside the fence.
  text(`Dogs ${frame.floorDogs} · Crew ${frame.floorStaff}`, y + (HUD_ROWS.dogsCrew * fs) / 2, fs * 1.1, colors.ink, true);
  y += HUD_ROWS.dogsCrew * fs;

  // The dogs-per-staffer gauge: 0 to gaugeMax, one mark at the legal ratio, the band above it tinted.
  labelRow(ctx, hud, y + 0.7 * fs, 'Dogs per staffer', formatRatio(frame.ratio), fs, colors, colors.ink);
  const top = Math.max(1, options.gaugeMax);
  const bar: Box = { x: hud.x, y: y + 1.95 * fs, w: hud.w, h: 0.85 * fs };
  const xOf = (v: number): number => bar.x + (clamp(v, 0, top) / top) * bar.w;
  ctx.fillStyle = colors.muted;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.globalAlpha = 1;
  const legalX = xOf(options.legalRatio);
  ctx.fillStyle = colors.gaugeOver;
  ctx.fillRect(legalX, bar.y, bar.x + bar.w - legalX, bar.h);
  if (frame.ratio > 0) {
    ctx.fillStyle = colors.ink;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(bar.x, bar.y + bar.h * 0.25, xOf(frame.ratio) - bar.x, bar.h * 0.5);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(bar.x + 0.5, bar.y + 0.5, bar.w - 1, bar.h - 1);
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = Math.max(1.5, fs * 0.1);
  ctx.beginPath();
  ctx.moveTo(legalX, bar.y - 0.15 * fs);
  ctx.lineTo(legalX, bar.y + bar.h + 0.15 * fs);
  ctx.stroke();
  ctx.fillStyle = colors.muted;
  ctx.font = fontOf(fs * 0.8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(formatRatio(options.legalRatio), clamp(legalX, hud.x + fs, hud.x + hud.w - fs), bar.y + bar.h + 0.2 * fs);
  // The marker: a pointer above the bar and a line through it at the ratio.
  const mx = xOf(frame.ratio);
  ctx.fillStyle = colors.ink;
  ctx.beginPath();
  ctx.moveTo(mx - 0.4 * fs, bar.y - 0.55 * fs);
  ctx.lineTo(mx + 0.4 * fs, bar.y - 0.55 * fs);
  ctx.lineTo(mx, bar.y - 0.05 * fs);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(mx - Math.max(1, fs * 0.08), bar.y, Math.max(2, fs * 0.16), bar.h);
  y += HUD_ROWS.gauge * fs;

  // The incident counter: a rounded "!" badge that pulses in a block with an incident.
  const incidentNow = frame.events.some((e) => e.type === 'incident');
  const pulse = incidentNow ? Math.sin(clamp(options.progress, 0, 1) * Math.PI) : 0;
  const badge = fs * 1.3;
  const bcx = hud.x + badge * 0.7;
  const bcy = y + (HUD_ROWS.incidents * fs) / 2;
  if (pulse > 0) {
    ctx.fillStyle = colors.incident;
    ctx.globalAlpha = 0.3 * pulse;
    const halo = badge * (0.6 + 0.35 * pulse);
    roundRectPath(ctx, bcx - halo, bcy - halo, halo * 2, halo * 2, halo * 0.45);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const size = badge * (1 + 0.18 * pulse);
  ctx.fillStyle = colors.incident;
  roundRectPath(ctx, bcx - size / 2, bcy - size / 2, size, size, size * 0.3);
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.font = fontOf(size * 0.75, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', bcx, bcy + size * 0.03);
  ctx.textAlign = 'left';
  ctx.fillStyle = incidentNow ? colors.incident : colors.ink;
  const incidentText = `Incidents ${frame.incidentsSoFar}`;
  const textX = hud.x + badge * 1.6;
  fitFont(ctx, incidentText, Math.max(1, hud.x + hud.w - textX), fs * 1.1, true);
  ctx.fillText(incidentText, textX, bcy);
  y += HUD_ROWS.incidents * fs;

  // Reputation: a meter from 0 to 100.
  labelRow(ctx, hud, y + 0.65 * fs, 'Reputation', String(Math.round(frame.reputation)), fs, colors, colors.reputation);
  drawMeter(ctx, { x: hud.x, y: y + 1.4 * fs, w: hud.w, h: 0.6 * fs }, frame.reputation, METER_MAX, colors.reputation, colors);
  y += HUD_ROWS.reputation * fs;

  // Cash.
  text(`Cash ${dollars(frame.cash)}`, y + (HUD_ROWS.cash * fs) / 2, fs * 1.25, colors.cash, true);
  y += HUD_ROWS.cash * fs;

  // Energy, cleanliness and crew fatigue: small meters with their numbers.
  const meters: [string, number][] = [
    ['Energy', frame.energy],
    ['Cleanliness', frame.cleanliness],
    ['Crew fatigue', frame.fatigue],
  ];
  const smallPx = fs * 0.85;
  ctx.font = fontOf(smallPx);
  const labelW = ctx.measureText('Crew fatigue').width + fs * 0.4;
  ctx.font = fontOf(smallPx, true);
  const numberW = ctx.measureText('100').width + fs * 0.3;
  for (const [label, value] of meters) {
    const cy = y + (HUD_ROWS.meter * fs) / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.muted;
    fitFont(ctx, label, labelW - fs * 0.2, smallPx);
    ctx.fillText(label, hud.x, cy);
    const meterW = Math.max(fs, hud.w - labelW - numberW);
    drawMeter(ctx, { x: hud.x + labelW, y: cy - 0.25 * fs, w: meterW, h: 0.5 * fs }, value, METER_MAX, colors.ink, colors);
    ctx.font = fontOf(smallPx, true);
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.ink;
    ctx.fillText(String(Math.round(value)), hud.x + hud.w, cy);
    y += HUD_ROWS.meter * fs;
  }
  y += HUD_ROWS.meterGap * fs;

  // The state that is visible though the rules are not (section 3), and the counters when they have counted.
  const lines = [`Tomorrow: ${frame.requestsTomorrow} asking`, `Days the crew ran solo: ${frame.soloStreak}`];
  if (frame.sickSoFar > 0) lines.push(`Sent home sick ${frame.sickSoFar}`);
  if (frame.finesSoFar > 0) lines.push(`Inspector visits ${frame.finesSoFar}`);
  for (const line of lines) {
    text(line, y + (HUD_ROWS.line * fs) / 2, fs * 0.95, colors.ink);
    y += HUD_ROWS.line * fs;
  }
}
