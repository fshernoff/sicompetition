// The week replay: one greedy week played block by block on a canvas (the yard, the dogs, the crew, the
// dogs-per-staffer gauge, the incident counter, the reputation meter, the cash counter). An incident is an icon
// and a counter, never an injury. `replayFrame` and `replayClock` are pure functions from the 20 StepRecords and the
// elapsed time; `drawReplay` is a pure drawing function. The replay keeps no state: the page holds the trace and
// the start time (G4 plan, "What a frame shows for step t"; BRIEF section 10.2). No DOM access at module top level.
// Seam written by the main thread; WP1 (Opus) builds it.
//
// G5c (WP2): the yard is drawn on the illustrated art (src/assets/art/, D55): the empty yard, four breeds playing or
// asleep, the crew with a ball or a mop. `replayArtReady` loads and decodes the images once; until they are ready,
// or if any fails, the G4 vector drawing below is the fallback. The static parts of a frame (the yard art, the cards
// and their labels) are drawn once per size into an offscreen canvas and blitted each frame; the sprites are scaled
// once per size. The drawing's state is that cache only: the frame is still a function of the trace and the time.
import type {
  Bookings,
  FloorActivity,
  Rate,
  State,
  StepRecord,
  WorldConfig,
  WorldEvent,
} from '../world/types.ts';
import crewBallUrl from '../assets/art/crew-ball.webp';
import crewMopUrl from '../assets/art/crew-mop.webp';
import collieNapUrl from '../assets/art/dog-collie-nap.webp';
import collieUrl from '../assets/art/dog-collie.webp';
import corgiNapUrl from '../assets/art/dog-corgi-nap.webp';
import corgiUrl from '../assets/art/dog-corgi.webp';
import goldenNapUrl from '../assets/art/dog-golden-nap.webp';
import goldenUrl from '../assets/art/dog-golden.webp';
import poodleNapUrl from '../assets/art/dog-poodle-nap.webp';
import poodleUrl from '../assets/art/dog-poodle.webp';
import yardUrl from '../assets/art/yard.webp';

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
  /** G5c, the illustrated yard's palette (defaults in ART_COLORS): headings and the gauge (deep teal). */
  heading?: string;
  /** The cards on the canvas (white) and their shadow. */
  card?: string;
  shadow?: string;
  /** Coral, for the incident icon and the band's marker over the legal ratio; sunny yellow for the highlights. */
  accent?: string;
  highlight?: string;
  /** The path outside the fence. */
  path?: string;
}

/** The fonts of the design (CSS font-family lists): `display` for the header and the numerals, `body` for the rest. */
export interface ReplayFonts {
  display: string;
  body: string;
}

export interface ReplayOptions {
  pixelRatio: number;
  colors: ReplayColors;
  /** 0..1 inside the step, for the incident pulse. */
  progress: number;
  /** The legal ratio mark on the gauge (world.bookings.legalRatio) and the gauge's top (world.requests.max). */
  legalRatio: number;
  gaugeMax: number;
  /** The line drawn without a frame, in place of the default placeholder (the page's "getting ready" line, D50). */
  placeholder?: string;
  /** The page's fonts; DEFAULT_FONTS when omitted. Load them (document.fonts) before the first frame. */
  fonts?: ReplayFonts;
  /**
   * No pulse, hop or walking tween (prefers-reduced-motion: reduce); the same frame block by block. When omitted,
   * read from matchMedia('(prefers-reduced-motion: reduce)').
   */
  reducedMotion?: boolean;
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
  const art = artOrStartLoading();
  if (frame === null) {
    drawPlaceholder(ctx, width, height, options);
    return;
  }
  // The motion policy, for both renderers: under reduced motion the progress inside a block is frozen at 0, so the
  // pulse, the hops, the walk and the mop stand still and every frame of a block is the same picture.
  const still = reducedMotion(options);
  const opts: ReplayOptions = still && options.progress !== 0 ? { ...options, progress: 0, reducedMotion: true } : options;
  if (art === null) {
    drawVectorReplay(ctx, width, height, frame, opts);
    return;
  }
  drawArtReplay(ctx, width, height, frame, opts, art);
}

/** The G4 drawing: the vector yard and its HUD, the fallback while the art loads or if an image fails. */
function drawVectorReplay(
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
    const line = options.placeholder ?? PLACEHOLDER;
    fitFont(ctx, line, width * 0.9, fs);
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line, width / 2, height / 2);
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

// ===============================================================================================================
// G5c: the illustrated yard (D55). The frame is laid out in `fs` units like G4's: the header card across the top,
// the yard (the art and the path outside its front fence) on the left with the captions as pills under it, and the
// HUD's cards down the right. Everything that does not change between frames is in the static layer.

/** The art direction's palette, for the colours the page does not pass (ReplayColors' optional fields). */
export const ART_COLORS = {
  heading: '#0F5257',
  card: '#FFFFFF',
  shadow: 'rgba(15, 82, 87, 0.16)',
  accent: '#F2665A',
  highlight: '#F6C344',
  path: '#EADBBB',
} as const;

/** The display and body faces when the page passes none: the page's (--font-display, --font-body in style.css). */
export const DEFAULT_FONTS: ReplayFonts = {
  display: "'Fredoka', ui-rounded, 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif",
  body: "'Nunito', ui-rounded, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

interface Palette {
  bg: string;
  ink: string;
  muted: string;
  heading: string;
  card: string;
  shadow: string;
  accent: string;
  accentInk: string; // coral text: the page's incident colour, dark enough to read
  highlight: string;
  path: string;
  reputation: string;
  cash: string;
  gaugeOver: string;
  fence: string;
}

function paletteOf(c: ReplayColors): Palette {
  return {
    bg: c.background,
    ink: c.ink,
    muted: c.muted,
    heading: c.heading ?? ART_COLORS.heading,
    card: c.card ?? ART_COLORS.card,
    shadow: c.shadow ?? ART_COLORS.shadow,
    accent: c.accent ?? ART_COLORS.accent,
    accentInk: c.incident,
    highlight: c.highlight ?? ART_COLORS.highlight,
    path: c.path ?? ART_COLORS.path,
    reputation: c.reputation,
    cash: c.cash,
    gaugeOver: c.gaugeOver,
    fence: c.fence,
  };
}

// --- The art: loaded and decoded once. ---------------------------------------------------------------------------

/** The four breeds, in the order of their sprites; a dog's breed is fixed by its index for the whole week. */
const PLAY_URLS: readonly string[] = [goldenUrl, collieUrl, corgiUrl, poodleUrl];
const NAP_URLS: readonly string[] = [goldenNapUrl, collieNapUrl, corgiNapUrl, poodleNapUrl];

interface ArtSet {
  yard: HTMLImageElement;
  play: HTMLImageElement[];
  nap: HTMLImageElement[];
  crewBall: HTMLImageElement;
  crewMop: HTMLImageElement;
}

let artLoad: Promise<void> | null = null;
let artSet: ArtSet | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => img);
}

/**
 * Loads and decodes every image of the yard once (memoised): the page awaits it before the first week plays. It
 * never rejects: if an image fails, the yard stays the G4 vector drawing.
 */
export function replayArtReady(): Promise<void> {
  if (artLoad !== null) return artLoad;
  if (typeof Image === 'undefined') {
    artLoad = Promise.resolve();
    return artLoad;
  }
  artLoad = Promise.all([
    loadImage(yardUrl),
    Promise.all(PLAY_URLS.map(loadImage)),
    Promise.all(NAP_URLS.map(loadImage)),
    loadImage(crewBallUrl),
    loadImage(crewMopUrl),
  ]).then(
    ([yard, play, nap, crewBall, crewMop]) => {
      artSet = { yard, play, nap, crewBall, crewMop };
    },
    () => {
      artSet = null; // the vector yard is the fallback
    },
  );
  return artLoad;
}

/** The art if it is ready; starts loading it on the first call, so a page that never awaits it still gets it. */
function artOrStartLoading(): ArtSet | null {
  if (artLoad === null && typeof document !== 'undefined') void replayArtReady();
  return artSet;
}

// --- Reduced motion. ------------------------------------------------------------------------------------------------

let motionQuery: MediaQueryList | null | undefined;
function reducedMotion(options: ReplayOptions): boolean {
  if (options.reducedMotion !== undefined) return options.reducedMotion;
  if (motionQuery === undefined) {
    motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  }
  return motionQuery?.matches ?? false;
}

// --- The layout. ----------------------------------------------------------------------------------------------------

/** The HUD's cards, top to bottom, and their heights in fs. */
const CARD_UNITS = { gauge: 7.0, incidents: 3.2, reputation: 3.6, cash: 3.2, meters: 5.3, info: 5.9 } as const;
type CardName = keyof typeof CARD_UNITS;
const CARD_ORDER: readonly CardName[] = ['gauge', 'incidents', 'reputation', 'cash', 'meters', 'info'];
const CARD_GAP = 0.5;
const HUD_NEED = CARD_ORDER.reduce((s, k) => s + CARD_UNITS[k], 0) + (CARD_ORDER.length - 1) * CARD_GAP;
const INFO_TEMPLATES = ['Days the crew ran solo: 5', 'Tomorrow: 30 asking', 'Inspector visits 10', 'Sent home sick 10'];
const METER_LABELS = ['Energy', 'Cleanliness', 'Crew fatigue'] as const;

/** The yard art's crop: the gate at its right stays in view. */
const CROP_ALIGN_X = 0.85;
const CROP_ALIGN_Y = 0.55;
/** Where the dogs' feet may go on the yard art (fractions of the image): the grass inside the fences. */
const FLOOR_ON_ART = { x0: 0.08, x1: 0.88, y0: 0.2, y1: 0.85 } as const;
/** A dog at the back of the yard is drawn at DEPTH_MIN, at the front at DEPTH_MAX. */
const DEPTH_MIN = 0.8;
const DEPTH_MAX = 1.08;

interface ArtLayout {
  fs: number;
  pad: number;
  gap: number;
  radius: number;
  cardPad: number;
  header: Box;
  titlePx: number;
  planPx: number;
  planLines: 1 | 2;
  progress: Box;
  scene: Box;
  art: Box;
  path: Box;
  captions: Box;
  /** The source rectangle of the yard image and its scale onto `art`. */
  crop: Box;
  floor: Box;
  dogH: number; // a dog's height at depth 1
  crewH: number;
  hud: Box;
  cards: Record<CardName, Box>;
  neededH: number;
  hudOverflow: number;
}

const displayFont = (fonts: ReplayFonts, px: number, weight = 600): string =>
  `${weight} ${Math.max(1, Math.round(px * 10) / 10)}px ${fonts.display}`;
const bodyFont = (fonts: ReplayFonts, px: number, weight = 800): string =>
  `${weight} ${Math.max(1, Math.round(px * 10) / 10)}px ${fonts.body}`;

function artLayoutFor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fs: number,
  fonts: ReplayFonts,
  yardW: number,
  yardH: number,
): ArtLayout {
  const pad = fs * 0.75;
  const gap = fs * 0.6;
  const radius = fs * 1.05;
  const cardPad = fs * 0.75;
  const titlePx = fs * 1.4;
  const planPx = fs;

  ctx.font = bodyFont(fonts, planPx);
  const innerW = width - 2 * pad - 2 * cardPad;
  const planLines: 1 | 2 = ctx.measureText(PLAN_TEMPLATE).width <= innerW ? 1 : 2;
  const progressH = fs * 0.42;
  const headerH = cardPad * 1.6 + titlePx * 1.2 + planLines * planPx * 1.35 + fs * 0.35 + progressH;
  const header: Box = { x: pad, y: pad, w: width - 2 * pad, h: headerH };
  const progress: Box = {
    x: header.x + cardPad,
    y: header.y + header.h - cardPad * 0.8 - progressH,
    w: header.w - 2 * cardPad,
    h: progressH,
  };

  // The HUD column: as wide as its widest line, between 28% and 42% of the canvas.
  ctx.font = bodyFont(fonts, fs);
  let widest = 0;
  for (const text of INFO_TEMPLATES) widest = Math.max(widest, ctx.measureText(text).width + fs * 1.3);
  ctx.font = displayFont(fonts, fs * 1.9);
  const cashW = ctx.measureText('−$10,000').width;
  ctx.font = bodyFont(fonts, fs, 800);
  widest = Math.max(
    widest,
    cashW + ctx.measureText('Cash').width + fs * 2.9,
    ctx.measureText('Dogs per staffer').width + fs * 4.3,
    ctx.measureText('Crew fatigue').width + fs * 5.5,
  );
  widest += 2 * cardPad;
  const hudMax = width * 0.42;
  const hudW = clamp(widest, width * 0.28, hudMax);

  const bodyTop = header.y + header.h + gap;
  const bodyBottom = height - pad;
  const hud: Box = { x: width - pad - hudW, y: bodyTop, w: hudW, h: bodyBottom - bodyTop };

  // The cards share the column's height; spare room goes to the cards (at most a quarter more) and the gaps.
  const need = HUD_NEED * fs;
  const grow = clamp(hud.h / need, 0, 1.25);
  const used = (need - (CARD_ORDER.length - 1) * CARD_GAP * fs) * grow;
  const cardGap = Math.max(CARD_GAP * fs * Math.min(1, grow), (hud.h - used) / (CARD_ORDER.length - 1));
  const cards = {} as Record<CardName, Box>;
  let y = hud.y;
  for (const name of CARD_ORDER) {
    const h = CARD_UNITS[name] * fs * grow;
    cards[name] = { x: hud.x, y, w: hud.w, h };
    y += h + Math.min(cardGap, fs * 1.4);
  }

  // The left column: the yard art, the path outside its front fence, the captions under them.
  const leftW = Math.max(1, hud.x - gap - pad);
  const capH = fs * 2.05;
  const pathH = fs * 3.3;
  const sceneH = Math.max(1, bodyBottom - bodyTop - capH - gap * 0.4);
  const scene: Box = { x: pad, y: bodyTop, w: leftW, h: sceneH };
  const art: Box = { x: scene.x, y: scene.y, w: scene.w, h: Math.max(1, sceneH - pathH) };
  const path: Box = { x: scene.x, y: art.y + art.h, w: scene.w, h: scene.h - art.h };
  const captions: Box = { x: pad, y: scene.y + scene.h + gap * 0.4, w: leftW, h: capH };

  // Cover the art box with the yard image, its gate kept in view.
  const s = Math.max(art.w / yardW, art.h / yardH);
  const sw = art.w / s;
  const sh = art.h / s;
  const crop: Box = { x: (yardW - sw) * CROP_ALIGN_X, y: (yardH - sh) * CROP_ALIGN_Y, w: sw, h: sh };
  const toX = (u: number): number => art.x + (u * yardW - crop.x) * s;
  const toY = (v: number): number => art.y + (v * yardH - crop.y) * s;
  const dogH = Math.max(4, Math.min(art.h * 0.155, art.w * 0.144));
  const fx0 = Math.max(toX(FLOOR_ON_ART.x0), art.x + dogH * 0.75);
  const fx1 = Math.min(toX(FLOOR_ON_ART.x1), art.x + art.w - dogH * 0.75);
  const fy0 = Math.max(toY(FLOOR_ON_ART.y0), art.y + dogH * 1.05);
  const fy1 = Math.min(toY(FLOOR_ON_ART.y1), art.y + art.h - dogH * 0.15);
  const floor: Box = { x: fx0, y: fy0, w: Math.max(1, fx1 - fx0), h: Math.max(1, fy1 - fy0) };

  const leftNeeded = fs * 8 + pathH + capH + gap * 0.4;
  return {
    fs,
    pad,
    gap,
    radius,
    cardPad,
    header,
    titlePx,
    planPx,
    planLines,
    progress,
    scene,
    art,
    path,
    captions,
    crop,
    floor,
    dogH,
    crewH: dogH * 1.45, // 1.45 times a standing dog at the same depth (both scale by depth): the adult in the yard
    hud,
    cards,
    neededH: header.y + header.h + gap + Math.max(need, leftNeeded) + pad,
    hudOverflow: widest / hudMax,
  };
}

/** The largest text size that fits: scaled with the canvas, 10 to 26 px, smaller when the cards would not fit. */
function fitArtLayout(ctx: CanvasRenderingContext2D, width: number, height: number, fonts: ReplayFonts, art: ArtSet): ArtLayout {
  const yw = art.yard.naturalWidth || 1400;
  const yh = art.yard.naturalHeight || 875;
  let fs = clamp(Math.min(width / 46, height / 38.5), 10, 26);
  let layout = artLayoutFor(ctx, width, height, fs, fonts, yw, yh);
  for (let i = 0; i < 5; i++) {
    const shrink = Math.min(1, height / layout.neededH, 1 / layout.hudOverflow);
    if (shrink >= 0.995 || fs <= 7) break;
    fs = Math.max(7, fs * shrink * 0.99);
    layout = artLayoutFor(ctx, width, height, fs, fonts, yw, yh);
  }
  return layout;
}

// --- Sprites, scaled once per size. ---------------------------------------------------------------------------------

/** A sprite pre-scaled for one size: the bitmap holds it at DEPTH_MAX; w and h are its CSS size at depth 1. */
interface Sprite {
  img: HTMLCanvasElement;
  w: number;
  h: number;
}
/** A sprite facing right [0] and left [1]. */
type Facing = readonly [Sprite, Sprite];

interface SpriteSet {
  play: Facing[];
  nap: Facing[];
  crewBall: Facing;
  crewMop: Facing;
}

function newCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('replay: no 2D context for the yard cache');
  return { canvas, ctx };
}

/** The image scaled to `cssH` tall at DEPTH_MAX × ratio, halving in steps so the downscale stays smooth. */
function prerender(img: HTMLImageElement, cssH: number, ratio: number): Facing {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const w = (sw * cssH) / sh;
  const pw = Math.max(1, Math.round(w * DEPTH_MAX * ratio));
  const ph = Math.max(1, Math.round(cssH * DEPTH_MAX * ratio));
  let src: CanvasImageSource = img;
  let cw = sw;
  let ch = sh;
  while (cw > pw * 2 && ch > ph * 2) {
    const half = newCanvas(Math.round(cw / 2), Math.round(ch / 2));
    half.ctx.imageSmoothingQuality = 'high';
    half.ctx.drawImage(src, 0, 0, cw, ch, 0, 0, half.canvas.width, half.canvas.height);
    src = half.canvas;
    cw = half.canvas.width;
    ch = half.canvas.height;
  }
  // The sprite with a 1 px warm, darker outline (its silhouette stamped round it) and its colours a touch muted.
  const o = Math.max(1, Math.round(ratio));
  const sil = newCanvas(pw, ph);
  sil.ctx.imageSmoothingQuality = 'high';
  sil.ctx.drawImage(src, 0, 0, cw, ch, 0, 0, pw, ph);
  sil.ctx.globalCompositeOperation = 'source-in';
  sil.ctx.fillStyle = 'rgba(88, 52, 24, 0.55)';
  sil.ctx.fillRect(0, 0, pw, ph);
  const right = newCanvas(pw + 2 * o, ph + 2 * o);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    right.ctx.drawImage(sil.canvas, o + dx * o, o + dy * o);
  }
  right.ctx.imageSmoothingQuality = 'high';
  right.ctx.filter = 'saturate(0.9)';
  right.ctx.drawImage(src, 0, 0, cw, ch, o, o, pw, ph);
  const left = newCanvas(pw + 2 * o, ph + 2 * o);
  left.ctx.translate(pw + 2 * o, 0);
  left.ctx.scale(-1, 1);
  left.ctx.drawImage(right.canvas, 0, 0);
  const scale = DEPTH_MAX * ratio;
  const sprite = (c: HTMLCanvasElement): Sprite => ({ img: c, w: c.width / scale, h: c.height / scale });
  return [sprite(right.canvas), sprite(left.canvas)];
}

function spritesFor(art: ArtSet, layout: ArtLayout, ratio: number): SpriteSet {
  // One scale for every dog (the golden's height is the reference), so a corgi stays smaller than a collie.
  const ref = art.play[0]?.naturalHeight || 160;
  const dogScale = layout.dogH / ref;
  const crewRef = art.crewBall.naturalHeight || 205;
  return {
    play: art.play.map((img) => prerender(img, (img.naturalHeight || ref) * dogScale, ratio)),
    nap: art.nap.map((img) => prerender(img, (img.naturalHeight || ref * 0.65) * dogScale, ratio)),
    crewBall: prerender(art.crewBall, layout.crewH, ratio),
    crewMop: prerender(art.crewMop, (layout.crewH * (art.crewMop.naturalHeight || crewRef)) / crewRef, ratio),
  };
}

// --- The static layer: drawn once per size. -------------------------------------------------------------------------

interface Spot {
  x: number;
  y: number;
}

interface StaticLayer {
  key: string;
  colors: ReplayColors;
  art: ArtSet;
  canvas: HTMLCanvasElement;
  layout: ArtLayout;
  palette: Palette;
  fonts: ReplayFonts;
  sprites: SpriteSet;
  /** The free-play spots, one per dog the yard can hold, in a fixed scattered order. */
  spots: Spot[];
  /** The spots for n dogs, spread apart by their drawn size: computed once per count, then reused. */
  spotsByCount: Map<number, Spot[]>;
  meterLabelW: number;
}

let staticLayer: StaticLayer | null = null;

function staticFor(
  width: number,
  height: number,
  options: ReplayOptions,
  fonts: ReplayFonts,
  art: ArtSet,
  probe: CanvasRenderingContext2D,
): StaticLayer {
  const ratio = options.pixelRatio;
  // The fonts' status is in the key: labels drawn in a fallback face are redrawn once the page's faces have loaded.
  const fontStatus = typeof document !== 'undefined' && document.fonts !== undefined ? document.fonts.status : '';
  const key = `${width}|${height}|${ratio}|${fonts.display}|${fonts.body}|${options.gaugeMax}|${options.legalRatio}|${fontStatus}`;
  const cached = staticLayer;
  if (cached !== null && cached.key === key && cached.colors === options.colors && cached.art === art) return cached;

  probe.setTransform(1, 0, 0, 1, 0, 0);
  const layout = fitArtLayout(probe, width, height, fonts, art);
  const palette = paletteOf(options.colors);
  const { canvas, ctx } = newCanvas(width * ratio, height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.font = bodyFont(fonts, layout.fs);
  const meterLabelW = Math.max(...METER_LABELS.map((l) => ctx.measureText(l).width)) + layout.fs * 0.6;
  paintStatic(ctx, width, height, layout, palette, fonts, art, options, meterLabelW);
  const layer: StaticLayer = {
    key,
    colors: options.colors,
    art,
    canvas,
    layout,
    palette,
    fonts,
    sprites: spritesFor(art, layout, ratio),
    spots: spotsOn(layout.floor, Math.max(1, options.gaugeMax)),
    spotsByCount: new Map(),
    meterLabelW,
  };
  staticLayer = layer;
  return layer;
}

/** Where the crew stand in free play and a nap, as fractions of the floor: the first, second and third staffer. */
const CREW_SPOTS: readonly (readonly [number, number])[] = [
  [0.3, 0.52],
  [0.7, 0.4],
  [0.5, 0.82],
];

/**
 * The free-play spots, one per dog the yard can hold: best-candidate sampling (each spot the farthest of 40 hashed
 * candidates from the spots before it and from the crew's places), so the first 16 to 20 are evenly spread and the
 * later ones fill the gaps. Distances weigh the vertical by 1.4: dogs are wider than they are deep.
 */
function spotsOn(floor: Box, capacity: number): Spot[] {
  const taken: Spot[] = CREW_SPOTS.map(([u, v]) => ({ x: floor.x + u * floor.w, y: floor.y + v * floor.h }));
  const spots: Spot[] = [];
  for (let n = 0; n < capacity; n++) {
    let best: Spot = { x: floor.x + floor.w / 2, y: floor.y + floor.h / 2 };
    let bestD = -1;
    for (let c = 0; c < 40; c++) {
      const x = floor.x + hash01(n * 977 + c * 31 + 1) * floor.w;
      const y = floor.y + hash01(n * 977 + c * 31 + 2) * floor.h;
      let d = Infinity;
      for (const t of taken) d = Math.min(d, Math.hypot(x - t.x, (y - t.y) * 1.4));
      if (d > bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    taken.push(best);
    spots.push(best);
  }
  return spots;
}

/**
 * The free-play spots for `n` dogs: the first n spots, then pushed apart (80 rounds of pairwise separation inside the
 * floor, the crew's places held fixed) until no two dogs' drawn boxes overlap much. A dog's box is its drawn width
 * (about 1.1 dogH at its depth, 1.25 with a margin for tails and ears) by its height (0.95 dogH); a pair that overlaps in both is moved apart
 * along the axis where it overlaps less. With 25 or more the floor cannot hold that and they settle as evenly as it
 * allows. Memoised per count on the layer, so a frame never recomputes it.
 */
function spreadSpots(layer: StaticLayer, n: number): Spot[] {
  const cached = layer.spotsByCount.get(n);
  if (cached !== undefined) return cached;
  const L = layer.layout;
  const f = L.floor;
  const crowd = crowding(L, n);
  const pts = layer.spots.slice(0, n).map((sp) => ({ x: sp.x, y: sp.y }));
  const crew = CREW_SPOTS.map(([u, v]) => ({ x: f.x + u * f.w, y: f.y + v * f.h }));
  const wOf = (sp: Spot): number => L.dogH * 1.25 * depthAt(L, sp.y) * crowd;
  const hOf = (sp: Spot): number => L.dogH * 0.95 * depthAt(L, sp.y) * crowd;
  /** Moves a (and b, unless b is held) apart when their boxes overlap; `share` is a's part of the move. */
  const separate = (a: Spot, b: Spot, share: number, k: number): void => {
    const w = (wOf(a) + wOf(b)) / 2;
    const h = Math.max(hOf(a), hOf(b));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const ox = w - Math.abs(dx);
    const oy = h - Math.abs(dy);
    if (ox <= 0 || oy <= 0) return;
    if (ox / w < oy / h) {
      const sx = dx === 0 ? (hash01(k) < 0.5 ? -1 : 1) : Math.sign(dx);
      a.x -= sx * ox * share;
      b.x += sx * ox * (1 - share);
    } else {
      const sy = dy === 0 ? (hash01(k + 1) < 0.5 ? -1 : 1) : Math.sign(dy);
      a.y -= sy * oy * share;
      b.y += sy * oy * (1 - share);
    }
  };
  for (let round = 0; round < 80; round++) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i] as Spot;
      for (let j = i + 1; j < pts.length; j++) separate(a, pts[j] as Spot, 0.5, i * 131 + j);
      for (const c of crew) separate(a, { x: c.x, y: c.y }, 1, i * 17);
    }
    for (const sp of pts) {
      sp.x = clamp(sp.x, f.x, f.x + f.w);
      sp.y = clamp(sp.y, f.y, f.y + f.h);
    }
  }
  layer.spotsByCount.set(n, pts);
  return pts;
}

/** A rounded card with a soft layered shadow and a hairline edge. */
function card(ctx: CanvasRenderingContext2D, box: Box, radius: number, palette: Palette, fs: number, fill = palette.card): void {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = fs * 1.1;
  ctx.shadowOffsetY = fs * 0.25;
  roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.fill();
  ctx.shadowColor = 'rgba(15, 82, 87, 0.10)';
  ctx.shadowBlur = fs * 0.2;
  ctx.shadowOffsetY = fs * 0.06;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(15, 82, 87, 0.10)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, radius);
  ctx.stroke();
}

function paintStatic(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  L: ArtLayout,
  P: Palette,
  fonts: ReplayFonts,
  art: ArtSet,
  options: ReplayOptions,
  meterLabelW: number,
): void {
  const { fs, cardPad } = L;
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, width, height);

  // The header card and its week track (20 blocks, a gap between days).
  card(ctx, L.header, L.radius, P, fs);
  forEachBlock(L.progress, (x, w) => {
    ctx.fillStyle = 'rgba(15, 82, 87, 0.12)';
    roundRectPath(ctx, x, L.progress.y, w, L.progress.h, L.progress.h / 2);
    ctx.fill();
  });

  // The yard: a soft shadow under the scene, the art, the path outside the front fence.
  const sc = L.scene;
  ctx.save();
  ctx.shadowColor = P.shadow;
  ctx.shadowBlur = fs * 1.1;
  ctx.shadowOffsetY = fs * 0.25;
  ctx.fillStyle = P.path;
  roundRectPath(ctx, sc.x, sc.y, sc.w, sc.h, L.radius);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, sc.x, sc.y, sc.w, sc.h, L.radius);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art.yard, L.crop.x, L.crop.y, L.crop.w, L.crop.h, L.art.x, L.art.y, L.art.w, L.art.h);
  paintPath(ctx, L, art);
  ctx.restore();
  ctx.strokeStyle = 'rgba(15, 82, 87, 0.18)';
  ctx.lineWidth = Math.max(1, fs * 0.08);
  roundRectPath(ctx, sc.x + 0.5, sc.y + 0.5, sc.w - 1, sc.h - 1, L.radius);
  ctx.stroke();

  // The cards' shells and the labels that never change.
  for (const name of CARD_ORDER) card(ctx, L.cards[name], L.radius * 0.85, P, fs);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = bodyFont(fonts, fs, 800);
  const badge = fs * 1.5;
  const labelX = (box: Box): number => box.x + cardPad + badge + fs * 0.45;
  const g = L.cards.gauge;
  const rep = L.cards.reputation;
  const cash = L.cards.cash;
  const gy = g.y + cardPad + fs * 0.875;
  const ry = rep.y + cardPad + fs * 0.7;
  const cy = cash.y + cash.h / 2;
  // The editor's icon for the measure each card shows: the crew against the legal ratio, reputation, profit.
  measureTile(ctx, 'overRatio', g.x + cardPad, gy, badge);
  measureTile(ctx, 'reputation', rep.x + cardPad, ry, badge);
  measureTile(ctx, 'profit', cash.x + cardPad, cy, badge);
  ctx.font = bodyFont(fonts, fs, 800);
  ctx.fillStyle = P.muted;
  ctx.fillText('Dogs per staffer', labelX(g), gy);
  ctx.fillText('Reputation', labelX(rep), ry);
  ctx.fillText('Cash', labelX(cash), cy);

  // The gauge's track, the band above the legal ratio, the one mark and its number.
  const bar = gaugeBar(L);
  const top = Math.max(1, options.gaugeMax);
  const legalX = bar.x + (clamp(options.legalRatio, 0, top) / top) * bar.w;
  ctx.fillStyle = 'rgba(15, 82, 87, 0.10)';
  roundRectPath(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2);
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2);
  ctx.clip();
  ctx.fillStyle = P.gaugeOver;
  ctx.fillRect(legalX, bar.y, bar.x + bar.w - legalX, bar.h);
  ctx.restore();
  ctx.fillStyle = P.heading;
  ctx.fillRect(legalX - Math.max(1, fs * 0.09), bar.y - fs * 0.25, Math.max(2, fs * 0.18), bar.h + fs * 0.5);
  ctx.font = bodyFont(fonts, fs, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = P.heading;
  ctx.fillText(formatRatio(options.legalRatio), clamp(legalX, bar.x + fs, bar.x + bar.w - fs), bar.y + bar.h + fs * 0.3);

  // Reputation's track.
  const repBar = reputationBar(L);
  ctx.fillStyle = 'rgba(15, 82, 87, 0.10)';
  roundRectPath(ctx, repBar.x, repBar.y, repBar.w, repBar.h, repBar.h / 2);
  ctx.fill();

  // The small meters' labels and tracks.
  const m = L.cards.meters;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = bodyFont(fonts, fs);
  METER_LABELS.forEach((label, k) => {
    const row = meterRow(L, k, meterLabelW);
    ctx.fillStyle = P.muted;
    ctx.fillText(label, m.x + cardPad, row.cy);
    ctx.fillStyle = 'rgba(15, 82, 87, 0.10)';
    roundRectPath(ctx, row.bar.x, row.bar.y, row.bar.w, row.bar.h, row.bar.h / 2);
    ctx.fill();
  });
}

/**
 * The measures' icons as the bonus plan's editor draws them (24-unit line drawings, stroked white on a coloured tile):
 * the same picture for the same measure on the yard. Copied from editor.ts's ICONS until src/ui/icons.ts exports them.
 */
const MEASURE_ICONS = {
  incidents: { tile: '#EC5A4C', d: ['M12 3.5l9.5 16.5h-19z', 'M12 10v4.5', 'M12 17.4v.1'] },
  reputation: { tile: '#3A7FD5', d: ['M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z'] },
  overRatio: {
    tile: '#F08A3C',
    d: [
      'M15 8a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
      'M6.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5',
      'M7.3 10a2.1 2.1 0 1 1-4.2 0a2.1 2.1 0 1 1 4.2 0',
      'M1.8 18c.4-2.1 1.7-3.4 3.4-3.6',
      'M20.9 10a2.1 2.1 0 1 1-4.2 0a2.1 2.1 0 1 1 4.2 0',
      'M22.2 18c-.4-2.1-1.7-3.4-3.4-3.6',
    ],
  },
  profit: { tile: '#1F9D74', d: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'] },
} as const;
type MeasureIcon = keyof typeof MEASURE_ICONS;
const iconPaths = new Map<MeasureIcon, Path2D[]>();

/** The measure's tile, `size` square with its top left at (x, y − size / 2), and its white line drawing. */
function measureTile(ctx: CanvasRenderingContext2D, key: MeasureIcon, x: number, y: number, size: number): void {
  const spec = MEASURE_ICONS[key];
  ctx.fillStyle = spec.tile;
  roundRectPath(ctx, x, y - size / 2, size, size, size * 0.3);
  ctx.fill();
  let paths = iconPaths.get(key);
  if (paths === undefined) {
    paths = spec.d.map((d) => new Path2D(d));
    iconPaths.set(key, paths);
  }
  const k = (size * 0.64) / 24;
  ctx.save();
  ctx.translate(x + size / 2 - 12 * k, y - 12 * k);
  ctx.scale(k, k);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const path of paths) ctx.stroke(path);
  ctx.restore();
}

/** The 20 blocks of the week along `box`, a wider gap between days. */
function forEachBlock(box: Box, fn: (x: number, w: number, step: number) => void): void {
  const blockGap = box.h * 0.45;
  const dayGap = box.h * 1.6;
  const w = (box.w - 4 * dayGap - 15 * blockGap) / 20;
  let x = box.x;
  for (let step = 0; step < WEEK_STEPS; step++) {
    fn(x, w, step);
    x += w + (step % 4 === 3 ? dayGap : blockGap);
  }
}

/** The walkers' feet on the strip outside the fence, as a fraction of its height. */
const PATH_FEET = 0.78;

/**
 * The strip outside the yard's front fence, where the walking group goes: a band of the yard art's own lawn, a touch
 * darker and greyer than the yard, the fence's shadow across its top and a worn track along it.
 */
function paintPath(ctx: CanvasRenderingContext2D, L: ArtLayout, art: ArtSet): void {
  const p = L.path;
  const yh = art.yard.naturalHeight || 875;
  // The lawn band starts `feather` above the seam and fades in over the yard's bottom foliage, so there is no line.
  const feather = clamp(L.fs * 1.1, 10, 20);
  const ratio = ctx.getTransform().a || 1;
  const band = newCanvas((p.w) * ratio, (p.h + feather) * ratio);
  const scale = L.crop.w / p.w; // source pixels per CSS pixel, as in the yard above
  band.ctx.filter = 'saturate(0.82) brightness(0.88)';
  band.ctx.drawImage(art.yard, L.crop.x, yh * 0.47 - feather * scale, L.crop.w, (p.h + feather) * scale, 0, 0, band.canvas.width, band.canvas.height);
  band.ctx.filter = 'none';
  band.ctx.globalCompositeOperation = 'destination-in';
  const mask = band.ctx.createLinearGradient(0, 0, 0, feather * 2 * ratio);
  mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
  mask.addColorStop(1, 'rgba(0, 0, 0, 1)');
  band.ctx.fillStyle = mask;
  band.ctx.fillRect(0, 0, band.canvas.width, band.canvas.height);
  ctx.drawImage(band.canvas, p.x, p.y - feather, p.w, p.h + feather);
  const track = ctx.createLinearGradient(0, p.y + p.h * 0.5, 0, p.y + p.h);
  track.addColorStop(0, 'rgba(206, 180, 128, 0)');
  track.addColorStop(0.55, 'rgba(206, 180, 128, 0.32)');
  track.addColorStop(1, 'rgba(206, 180, 128, 0)');
  ctx.fillStyle = track;
  ctx.fillRect(p.x, p.y + p.h * 0.5, p.w, p.h * 0.5);
  // The fence's shadow on the ground beyond it, soft at both edges.
  const shade = ctx.createLinearGradient(0, p.y - feather * 0.5, 0, p.y + p.h * 0.45);
  shade.addColorStop(0, 'rgba(40, 50, 20, 0)');
  shade.addColorStop(0.25, 'rgba(40, 50, 20, 0.26)');
  shade.addColorStop(1, 'rgba(40, 50, 20, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(p.x, p.y - feather * 0.5, p.w, p.h * 0.45 + feather * 0.5);
}

function gaugeBar(L: ArtLayout): Box {
  const g = L.cards.gauge;
  const h = L.fs * 0.8;
  return { x: g.x + L.cardPad, y: g.y + g.h - L.cardPad - L.fs * 1.35 - h, w: g.w - 2 * L.cardPad, h };
}

function reputationBar(L: ArtLayout): Box {
  const r = L.cards.reputation;
  const h = L.fs * 0.7;
  return { x: r.x + L.cardPad, y: r.y + r.h - L.cardPad - h, w: r.w - 2 * L.cardPad, h };
}

function meterRow(L: ArtLayout, k: number, labelW: number): { cy: number; bar: Box; numberX: number } {
  const m = L.cards.meters;
  const rowH = (m.h - L.cardPad * 1.2) / 3;
  const cy = m.y + L.cardPad * 0.6 + rowH * (k + 0.5);
  const numberW = L.fs * 2;
  const x = m.x + L.cardPad + labelW;
  const h = L.fs * 0.55;
  return { cy, bar: { x, y: cy - h / 2, w: Math.max(L.fs, m.x + m.w - L.cardPad - numberW - x), h }, numberX: m.x + m.w - L.cardPad };
}

// --- The frame. -----------------------------------------------------------------------------------------------------

/**
 * The placeholder (before a run, and while the GM gets ready): the canvas cleared to transparent, so the page's stage
 * shows behind it, and one line of text with a soft cream outline so it reads on whatever is behind. Nothing else.
 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number, options: ReplayOptions): void {
  const { colors } = options;
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.clearRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;
  const fonts = options.fonts ?? DEFAULT_FONTS;
  const line = options.placeholder ?? PLACEHOLDER;
  // The page's own line (the GM getting ready) is a caption near the bottom: the speech bubble beside the yard carries
  // the message. The default line sits in the middle. The size and the outline keep the drawn pixels under 2% of the
  // canvas (the e2e's placeholder check).
  const caption = options.placeholder !== undefined;
  let px = caption ? clamp(Math.min(width / 52, height / 40), 11, 15) : clamp(Math.min(width / 36, height / 22), 11, 22);
  ctx.font = displayFont(fonts, px, 600);
  const w = ctx.measureText(line).width;
  if (w > width * 0.9) {
    px = Math.max(1, (px * width * 0.9) / w);
    ctx.font = displayFont(fonts, px, 600);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = caption ? 'rgba(251, 246, 236, 0.6)' : 'rgba(251, 246, 236, 0.92)';
  ctx.lineWidth = caption ? Math.max(1.5, px * 0.14) : Math.max(2, px * 0.24);
  const y = caption ? height - px * 1.9 : height / 2;
  ctx.strokeText(line, width / 2, y);
  ctx.fillStyle = colors.heading ?? ART_COLORS.heading;
  ctx.fillText(line, width / 2, y);
}

/** One figure on the yard, depth-sorted by its feet. Reused from frame to frame. */
interface Actor {
  x: number;
  y: number; // the feet
  sprite: Sprite | null;
  depth: number;
  lift: number; // a hop, in CSS px
  shadow: boolean;
}
const actorPool: Actor[] = [];
const actorOrder: Actor[] = [];
function actor(i: number): Actor {
  let a = actorPool[i];
  if (a === undefined) {
    a = { x: 0, y: 0, sprite: null, depth: 1, lift: 0, shadow: true };
    actorPool[i] = a;
  }
  return a;
}
const byFeet = (a: Actor, b: Actor): number => a.y - b.y;

/** Dog i's breed: the four in turn, so any 16 dogs show four of each (the facing and the spot come from the hash). */
const breedOf = (i: number): number => i % PLAY_URLS.length;
const facingOf = (i: number): 0 | 1 => (hash01(i * 5 + 2) < 0.5 ? 1 : 0);

function drawArtReplay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReplayFrame,
  options: ReplayOptions,
  art: ArtSet,
): void {
  if (!(width > 0 && height > 0)) return;
  const fonts = options.fonts ?? DEFAULT_FONTS;
  const layer = staticFor(width, height, options, fonts, art, ctx);
  const L = layer.layout;
  const motion = !reducedMotion(options);
  const progress = clamp(options.progress, 0, 1);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.setLineDash([]);
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);

  drawArtHeader(ctx, frame, layer);
  ctx.save();
  roundRectPath(ctx, L.scene.x, L.scene.y, L.scene.w, L.scene.h, L.radius);
  ctx.clip();
  if (frame.closed || frame.activity === null) drawClosedYard(ctx, layer);
  else drawFloor(ctx, frame, layer, motion ? progress : 0, motion);
  ctx.restore();
  drawPills(ctx, frame.captions, layer);
  drawArtHud(ctx, frame, layer, options, motion ? progress : 0, motion);
}

function drawArtHeader(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layer: StaticLayer): void {
  const { layout: L, palette: P, fonts } = layer;
  const x = L.header.x + L.cardPad;
  const maxW = L.header.w - 2 * L.cardPad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const title = `${frame.dayName} · ${frame.blockName} · ${frame.activityWords}`;
  fitWith(ctx, title, maxW, L.titlePx, (px) => displayFont(fonts, px));
  ctx.fillStyle = P.heading;
  let y = L.header.y + L.cardPad * 0.8 + (L.titlePx * 1.2) / 2;
  ctx.fillText(title, x, y);
  y += (L.titlePx * 1.2) / 2;
  const { first, crew } = planParts(frame);
  ctx.fillStyle = P.muted;
  if (L.planLines === 1) {
    const line = `${first} · ${crew}`;
    fitWith(ctx, line, maxW, L.planPx, (px) => bodyFont(fonts, px));
    ctx.fillText(line, x, y + (L.planPx * 1.35) / 2);
  } else {
    for (const line of [first, crew]) {
      fitWith(ctx, line, maxW, L.planPx, (px) => bodyFont(fonts, px));
      ctx.fillText(line, x, y + (L.planPx * 1.35) / 2);
      y += L.planPx * 1.35;
    }
  }
  // Where the week stands: the blocks played in teal, this one in coral.
  const now = frame.day * 4 + frame.block;
  const p = L.progress;
  forEachBlock(p, (bx, bw, step) => {
    if (step > now) return;
    ctx.fillStyle = step === now ? P.accent : P.heading;
    roundRectPath(ctx, bx, p.y, bw, p.h, p.h / 2);
    ctx.fill();
  });
}

/** Sets the font at the size where `text` fits `maxW` (never above `px`). */
function fitWith(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, font: (px: number) => string): number {
  ctx.font = font(px);
  const w = ctx.measureText(text).width;
  if (w <= maxW || w <= 0) return px;
  const fitted = Math.max(1, (px * maxW) / w);
  ctx.font = font(fitted);
  return fitted;
}

/** Below 1 only when the yard is crowded: the dogs shrink so that 30 still fit without heavy overlap. */
const crowding = (L: ArtLayout, dogs: number): number =>
  clamp(Math.sqrt((L.floor.w * L.floor.h) / Math.max(1, dogs) / (L.dogH * L.dogH * 0.95)), 0.72, 1);

const depthAt = (L: ArtLayout, y: number): number =>
  DEPTH_MIN + (DEPTH_MAX - DEPTH_MIN) * clamp((y - L.floor.y) / Math.max(1, L.floor.h), 0, 1);

/** The floor of an open day: the activity's dogs and crew, depth-sorted, and the walking group on the path. */
function drawFloor(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layer: StaticLayer, progress: number, motion: boolean): void {
  const { layout: L, sprites: S } = layer;
  let n = 0;
  const activity = frame.activity;
  if (activity === 'clean') {
    drawCrates(ctx, frame, layer);
  } else if (activity === 'structuredPlay') {
    n = placeStructured(frame, layer);
  } else {
    // Free play, a nap, and the floor a walk leaves: each dog on its spot.
    const napping = activity === 'nap';
    const crowd = crowding(L, frame.floorDogs);
    const spots = spreadSpots(layer, frame.floorDogs);
    for (let i = 0; i < frame.floorDogs; i++) {
      const spot = spots[i] as Spot;
      const a = actor(n++);
      a.x = spot.x;
      a.y = spot.y;
      a.depth = depthAt(L, spot.y) * crowd;
      const facing = facingOf(i);
      a.sprite = ((napping ? S.nap : S.play)[breedOf(i)] as Facing)[facing];
      a.lift = !napping && motion && hash01(i * 13 + 5) < 0.6 ? Math.abs(Math.sin(Math.PI * (2 * progress + hash01(i + 77)))) * L.dogH * 0.14 : 0;
      a.shadow = true;
    }
    for (let k = 0; k < frame.floorStaff; k++) {
      const a = actor(n++);
      const [u, v] = CREW_SPOTS[k % CREW_SPOTS.length] ?? [0.5, 0.5];
      a.x = L.floor.x + u * L.floor.w;
      a.y = L.floor.y + v * L.floor.h;
      a.depth = depthAt(L, a.y);
      a.sprite = S.crewBall[a.x < L.floor.x + L.floor.w / 2 ? 0 : 1];
      a.lift = 0;
      a.shadow = true;
    }
  }
  drawActors(ctx, n);
  if (activity === 'nap') drawSnores(ctx, frame, layer, progress, motion);
  if (frame.walkingStaff > 0) drawWalk(ctx, frame, layer, progress, motion);
}

/**
 * Structured play: each staffer with a ball, their dogs in neat rows in front of them, every dog facing them. The
 * groups share the floor side by side, or in two rows when side by side would leave each too narrow for its rows.
 */
function placeStructured(frame: ReplayFrame, layer: StaticLayer): number {
  const { layout: L, sprites: S } = layer;
  const groups = Math.max(1, frame.floorStaff);
  const dogs = frame.floorDogs;
  const crewW = S.crewBall[0].w * DEPTH_MAX * 1.05;
  const crowd = crowding(L, dogs);
  const dogH = L.dogH * crowd; // the dogs' height as drawn
  const tiers = groups > 1 && L.floor.w / groups < crewW + dogH * 2.2 ? 2 : 1;
  const perTier = Math.ceil(groups / tiers);
  const tierH = L.floor.h / tiers;
  let n = 0;
  for (let k = 0; k < groups; k++) {
    const tier = Math.floor(k / perTier);
    const inTier = tier === tiers - 1 ? groups - perTier * (tiers - 1) : perTier;
    const cellW = L.floor.w / inTier;
    const x0 = L.floor.x + cellW * (k - tier * perTier);
    const y0 = L.floor.y + tierH * tier + (tiers > 1 ? dogH * 0.25 : 0);
    const h0 = tiers > 1 ? tierH - dogH * 0.25 : tierH;
    const first = Math.floor((k * dogs) / groups);
    const m = Math.floor(((k + 1) * dogs) / groups) - first;
    // The rows: as square as the room allows, at most a dog's width apart.
    const availW = Math.max(1, cellW - crewW);
    let cols = 1;
    let best = 0;
    for (let c = 1; c <= Math.max(1, m); c++) {
      const rows = Math.ceil(m / c);
      const fit = Math.min(availW / c / (dogH * 0.85), h0 / Math.max(1, rows) / (dogH * 0.6));
      if (fit > best) {
        best = fit;
        cols = c;
      }
    }
    const rows = Math.max(1, Math.ceil(m / cols));
    const dx = Math.min(availW / cols, dogH * 1.2);
    const dy = rows > 1 ? Math.min(h0 / (rows - 0.4), dogH * 0.78) : 0;
    const gridW = dx * cols;
    const gridH = dy * (rows - 1);
    const gx = x0 + crewW + (availW - gridW) / 2;
    const gy = y0 + (h0 - gridH) / 2;
    if (frame.floorStaff > 0) {
      const a = actor(n++);
      a.x = gx - crewW * 0.55;
      a.y = gy + gridH / 2 + dogH * 0.1;
      a.depth = depthAt(L, a.y);
      a.sprite = S.crewBall[0];
      a.lift = 0;
      a.shadow = true;
    }
    for (let j = 0; j < m; j++) {
      const i = first + j;
      const a = actor(n++);
      a.x = gx + dx * ((j % cols) + 0.5);
      a.y = gy + dy * Math.floor(j / cols);
      a.depth = depthAt(L, a.y) * crowd;
      a.sprite = (S.play[breedOf(i)] as Facing)[1];
      a.lift = 0;
      a.shadow = true;
    }
  }
  return n;
}

function drawActors(ctx: CanvasRenderingContext2D, n: number): void {
  actorOrder.length = 0;
  for (let k = 0; k < n; k++) actorOrder.push(actorPool[k] as Actor);
  actorOrder.sort(byFeet);
  // The shadows first, in one path, so no figure stands in another's shadow.
  // The light comes from the upper left, as in the yard art: each shadow falls a little to the right.
  ctx.fillStyle = 'rgba(28, 52, 16, 0.3)';
  ctx.beginPath();
  for (const a of actorOrder) {
    if (!a.shadow || a.sprite === null) continue;
    const rx = a.sprite.w * a.depth * 0.38 * (a.sprite.h > a.sprite.w * 1.3 ? 0.7 : 1);
    const sx = a.x + rx * 0.18;
    const sy = a.y - rx * 0.04;
    ctx.moveTo(sx + rx, sy);
    ctx.ellipse(sx, sy, rx, rx * 0.24, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  for (const a of actorOrder) {
    const s = a.sprite;
    if (s === null) continue;
    const w = s.w * a.depth;
    const h = s.h * a.depth;
    ctx.drawImage(s.img, a.x - w / 2, a.y - h - a.lift + h * 0.04, w, h);
  }
}

/** A small "z z" over some of the sleeping dogs, rising gently with the block. */
function drawSnores(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layer: StaticLayer, progress: number, motion: boolean): void {
  const { layout: L, palette: P, fonts } = layer;
  ctx.fillStyle = P.heading;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const px = Math.max(10, L.dogH * 0.32);
  const spots = spreadSpots(layer, frame.floorDogs);
  for (let i = 0; i < frame.floorDogs; i += 2) {
    const spot = spots[i] as Spot;
    const rise = motion ? progress * L.dogH * 0.15 : 0;
    const x = spot.x + L.dogH * 0.25;
    const y = spot.y - L.dogH * 0.62 - rise;
    ctx.globalAlpha = 0.85;
    ctx.font = displayFont(fonts, px);
    ctx.fillText('z', x, y);
    ctx.globalAlpha = 0.6;
    ctx.font = displayFont(fonts, px * 0.75);
    ctx.fillText('z', x + px * 0.6, y - px * 0.55);
  }
  ctx.globalAlpha = 1;
}

/** Cleaning: the dogs in neat wire crates along the back of the yard, the crew mopping the front. */
function drawCrates(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layer: StaticLayer): void {
  const { layout: L, sprites: S } = layer;
  const n = frame.floorDogs;
  let rows = 1;
  let cols = Math.max(1, n);
  let cw = 0;
  for (let r = 1; r <= 6; r++) {
    const c = Math.max(1, Math.ceil(n / r));
    const w = Math.min(L.dogH * 1.5, (L.floor.w * 1.04) / c, (L.floor.h * 0.5) / r / (0.74 * 1.18));
    if (w > cw + 0.5) {
      cw = w;
      rows = r;
      cols = c;
    }
  }
  const ch = cw * 0.74;
  const rowGap = ch * 0.18;
  const top = L.floor.y - L.dogH * 0.35;
  const line = Math.max(1, cw * 0.04);
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols);
    if (inRow <= 0) break;
    const y = top + r * (ch + rowGap);
    const x0 = L.floor.x + (L.floor.w - inRow * cw) / 2;
    for (let c = 0; c < inRow; c++) {
      const i = r * cols + c;
      const x = x0 + c * cw;
      const inset = cw * 0.05;
      const bx = x + inset;
      const bw = cw - 2 * inset;
      // The crate's back and its cushion.
      ctx.fillStyle = 'rgba(255, 250, 238, 0.62)';
      roundRectPath(ctx, bx, y, bw, ch, cw * 0.08);
      ctx.fill();
      ctx.fillStyle = '#F6C344';
      roundRectPath(ctx, bx + bw * 0.06, y + ch * 0.72, bw * 0.88, ch * 0.2, ch * 0.08);
      ctx.fill();
      // The dog, curled up.
      const sprite = (S.nap[breedOf(i)] as Facing)[facingOf(i)];
      const scale = Math.min((bw * 0.86) / sprite.w, (ch * 0.62) / sprite.h);
      const w = sprite.w * scale;
      const h = sprite.h * scale;
      ctx.drawImage(sprite.img, x + cw / 2 - w / 2, y + ch * 0.86 - h, w, h);
      // The wire front.
      ctx.strokeStyle = '#1F5E62';
      ctx.lineWidth = line * 1.4;
      roundRectPath(ctx, bx, y, bw, ch, cw * 0.08);
      ctx.stroke();
      ctx.lineWidth = line;
      ctx.beginPath();
      for (let b = 1; b <= 5; b++) {
        const xb = bx + (bw * b) / 6;
        ctx.moveTo(xb, y);
        ctx.lineTo(xb, y + ch);
      }
      ctx.moveTo(bx + bw * 0.38, y - ch * 0.07);
      ctx.lineTo(bx + bw * 0.62, y - ch * 0.07);
      ctx.stroke();
    }
  }
  // The crew mopping the open floor in front.
  const staff = frame.floorStaff;
  let n2 = 0;
  for (let k = 0; k < staff; k++) {
    const a = actor(n2++);
    a.x = L.floor.x + (L.floor.w * (k + 1)) / (staff + 1);
    a.y = L.floor.y + L.floor.h * 0.97;
    a.depth = DEPTH_MAX;
    a.sprite = S.crewMop[k % 2 === 0 ? 0 : 1];
    a.lift = 0;
    a.shadow = true;
  }
  drawActors(ctx, n2);
}

/** The walking group on the path outside the fence: the staffer leading, the dogs on their leashes behind. */
function drawWalk(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layer: StaticLayer, progress: number, motion: boolean): void {
  const { layout: L, sprites: S } = layer;
  const p = L.path;
  const feet = p.y + p.h * PATH_FEET;
  const crew = S.crewBall[0];
  const crewScale = Math.min(1, (p.h * 1.9) / crew.h);
  const cw = crew.w * crewScale;
  const chh = crew.h * crewScale;
  const dogScale = Math.min(0.85, (p.h * 0.9) / L.dogH);
  const spacing = L.dogH * 1.05 * dogScale;
  const n = frame.walkingDogs;
  const groupW = n * spacing + cw;
  const drift = motion ? progress * spacing * 0.9 : 0;
  const start = p.x + Math.max(L.fs, (p.w - groupW) / 2 - spacing * 0.45) + drift;
  const crewX = start + n * spacing + cw * 0.5;
  const handX = crewX - cw * 0.3;
  const handY = feet - chh * 0.5;
  const dogsAt: number[] = [];
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.65)';
  ctx.lineWidth = Math.max(1, L.fs * 0.08);
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const x = start + k * spacing + spacing * 0.5;
    dogsAt.push(x);
    const sprite = (S.play[breedOf(frame.floorDogs + k)] as Facing)[0];
    const h = sprite.h * dogScale;
    ctx.moveTo(handX, handY);
    ctx.quadraticCurveTo((handX + x) / 2, handY + h * 0.4, x + sprite.w * dogScale * 0.32, feet - h * 0.72);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(70, 50, 20, 0.22)';
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const x = dogsAt[k] as number;
    ctx.moveTo(x + spacing * 0.4, feet);
    ctx.ellipse(x, feet, spacing * 0.4, spacing * 0.1, 0, 0, Math.PI * 2);
  }
  ctx.moveTo(crewX + cw * 0.35, feet);
  ctx.ellipse(crewX, feet, cw * 0.35, cw * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 0; k < n; k++) {
    const i = frame.floorDogs + k;
    const sprite = (S.play[breedOf(i)] as Facing)[0];
    const w = sprite.w * dogScale;
    const h = sprite.h * dogScale;
    const bob = motion ? Math.abs(Math.sin(Math.PI * (2 * progress + k * 0.37))) * h * 0.1 : 0;
    ctx.drawImage(sprite.img, (dogsAt[k] as number) - w / 2, feet - h - bob, w, h);
  }
  ctx.drawImage(crew.img, crewX - cw / 2, feet - chh, cw, chh);
}

/** The closed sign's board: a deep coral that white text reads on at 5.8:1 (the art's coral is 3.1:1). */
const CLOSED_SIGN = '#B8382A';

/** A closed day: the yard empty and quiet, a "Closed" sign on a post in the middle. */
function drawClosedYard(ctx: CanvasRenderingContext2D, layer: StaticLayer): void {
  const { layout: L, fonts } = layer;
  ctx.fillStyle = 'rgba(251, 246, 236, 0.32)';
  ctx.fillRect(L.art.x, L.art.y, L.art.w, L.art.h);
  const px = clamp(Math.min(L.art.w / 7, L.art.h / 6), L.fs * 1.3, L.fs * 3.2);
  ctx.font = displayFont(fonts, px);
  const textW = ctx.measureText('Closed').width;
  const boardW = textW + px * 1.3;
  const boardH = px * 1.75;
  const cx = L.art.x + L.art.w / 2;
  const ground = L.floor.y + L.floor.h * 0.72;
  const boardY = ground - boardH - px * 1.6;
  // The post and its shadow.
  ctx.fillStyle = 'rgba(30, 60, 20, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, ground, px * 0.9, px * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9A6A3C';
  roundRectPath(ctx, cx - px * 0.16, boardY + boardH * 0.5, px * 0.32, ground - boardY - boardH * 0.5, px * 0.08);
  ctx.fill();
  // The board, tilted a touch.
  ctx.save();
  ctx.translate(cx, boardY + boardH / 2);
  ctx.rotate(-0.035);
  ctx.fillStyle = 'rgba(60, 30, 20, 0.25)';
  roundRectPath(ctx, -boardW / 2, -boardH / 2 + px * 0.12, boardW, boardH, px * 0.32);
  ctx.fill();
  ctx.fillStyle = CLOSED_SIGN; // white on it at 5.8:1
  roundRectPath(ctx, -boardW / 2, -boardH / 2, boardW, boardH, px * 0.32);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1.5, px * 0.07);
  roundRectPath(ctx, -boardW / 2 + px * 0.16, -boardH / 2 + px * 0.16, boardW - px * 0.32, boardH - px * 0.32, px * 0.2);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Closed', 0, px * 0.04);
  ctx.restore();
}

// --- Captions as pills. ---------------------------------------------------------------------------------------------

interface PillStyle {
  fill: string;
  ink: string;
  dot: string;
  glyph: string;
}
const PILL_INCIDENT: PillStyle = { fill: '#FDE4E0', ink: '#9E2B20', dot: '#D2402F', glyph: '!' };
const PILL_MONEY: PillStyle = { fill: '#FDF1CC', ink: '#6E4B00', dot: '#9A6400', glyph: '$' };
const PILL_SICK: PillStyle = { fill: '#E2F0EF', ink: '#0F5257', dot: '#237570', glyph: '+' };
const PILL_CLOSED: PillStyle = { fill: '#ECE6DA', ink: '#3B3A35', dot: '#6A645B', glyph: '×' };
const PILL_PHOTO: PillStyle = { fill: '#E2F0EF', ink: '#0F5257', dot: '#237570', glyph: '★' };

function pillStyle(caption: string): PillStyle {
  if (caption === 'Incident') return PILL_INCIDENT;
  if (caption.startsWith('Vet bill') || caption.startsWith('Inspector')) return PILL_MONEY;
  if (caption.includes('sent home sick')) return PILL_SICK;
  if (caption.startsWith('Walk photo')) return PILL_PHOTO;
  return PILL_CLOSED;
}

/** The block's events under the yard, one pill each; a row that runs out of room continues above it. */
function drawPills(ctx: CanvasRenderingContext2D, captions: readonly string[], layer: StaticLayer): void {
  if (captions.length === 0) return;
  const { layout: L, fonts } = layer;
  const box = L.captions;
  let px = L.fs * 1.02;
  const widthAt = (text: string, size: number): number => {
    ctx.font = bodyFont(fonts, size, 800);
    return ctx.measureText(text).width + size * 2.6;
  };
  const total = (size: number): number => captions.reduce((s, c) => s + widthAt(c, size), 0) + (captions.length - 1) * L.fs * 0.45;
  if (total(px) > box.w) px = Math.max(L.fs * 0.9, (px * box.w) / total(px));
  const h = Math.min(box.h * 0.92, px * 1.85);
  const gapX = L.fs * 0.45;
  let x = box.x;
  let y = box.y + (box.h - h) / 2;
  for (const caption of captions) {
    const style = pillStyle(caption);
    let w = widthAt(caption, px);
    if (x > box.x && x + w > box.x + box.w) {
      x = box.x;
      y -= h + L.fs * 0.35; // the next row sits above, over the path
    }
    w = Math.min(w, box.w);
    ctx.fillStyle = 'rgba(15, 82, 87, 0.16)';
    roundRectPath(ctx, x, y + px * 0.12, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = style.fill;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    const r = h * 0.32;
    const dotX = x + h * 0.5;
    const cy = y + h / 2;
    if (style === PILL_INCIDENT) {
      measureTile(ctx, 'incidents', dotX - r * 1.05, cy, r * 2.1); // the HUD's and the editor's warning triangle
    } else {
      ctx.fillStyle = style.dot;
      circle(ctx, dotX, cy, r);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = bodyFont(fonts, r * 1.45, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.glyph, dotX, cy + r * 0.06);
    }
    ctx.fillStyle = style.ink;
    ctx.textAlign = 'left';
    fitWith(ctx, caption, w - px * 2.2, px, (size) => bodyFont(fonts, size, 800));
    ctx.fillText(caption, dotX + r + px * 0.45, cy + px * 0.04);
    x += w + gapX;
  }
}

// --- The HUD. -------------------------------------------------------------------------------------------------------

function drawArtHud(
  ctx: CanvasRenderingContext2D,
  frame: ReplayFrame,
  layer: StaticLayer,
  options: ReplayOptions,
  progress: number,
  motion: boolean,
): void {
  const { layout: L, palette: P, fonts } = layer;
  const { fs, cardPad } = L;
  ctx.textBaseline = 'middle';

  // The dogs-per-staffer gauge: the big number, the floor's dogs and crew, the fill and the marker.
  const g = L.cards.gauge;
  const over = frame.ratio > options.legalRatio;
  const bar = gaugeBar(L);
  ctx.textAlign = 'right';
  ctx.fillStyle = over ? P.accentInk : P.heading;
  ctx.font = displayFont(fonts, fs * 2);
  ctx.fillText(formatRatio(frame.ratio), g.x + g.w - cardPad, g.y + cardPad + fs * 0.875);
  ctx.textAlign = 'left';
  ctx.fillStyle = P.ink;
  const crewLine = `Dogs ${frame.floorDogs} · Crew ${frame.floorStaff}`;
  fitWith(ctx, crewLine, g.w - 2 * cardPad, fs, (px) => bodyFont(fonts, px));
  ctx.fillText(crewLine, g.x + cardPad, g.y + cardPad + fs * 2.4);
  const top = Math.max(1, options.gaugeMax);
  const mx = bar.x + (clamp(frame.ratio, 0, top) / top) * bar.w;
  if (frame.ratio > 0) {
    ctx.fillStyle = P.heading;
    ctx.globalAlpha = 0.85;
    roundRectPath(ctx, bar.x, bar.y + bar.h * 0.2, Math.max(bar.h * 0.6, mx - bar.x), bar.h * 0.6, bar.h * 0.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, mx, bar.y + bar.h / 2, bar.h * 0.78);
  ctx.fill();
  ctx.strokeStyle = over ? P.accent : P.heading;
  ctx.lineWidth = Math.max(2, fs * 0.2);
  ctx.stroke();

  // Incidents: the icon, pulsing in a block with an incident (a steady highlight under reduced motion).
  const inc = L.cards.incidents;
  const incidentNow = frame.events.some((e) => e.type === 'incident');
  if (incidentNow) {
    ctx.fillStyle = 'rgba(242, 102, 90, 0.12)';
    roundRectPath(ctx, inc.x + 1, inc.y + 1, inc.w - 2, inc.h - 2, L.radius * 0.85);
    ctx.fill();
  }
  const icon = fs * 1.75;
  const icx = inc.x + cardPad + icon / 2;
  const icy = inc.y + inc.h / 2;
  const pulse = incidentNow && motion ? Math.sin(progress * Math.PI) : 0;
  if (pulse > 0) {
    ctx.save();
    roundRectPath(ctx, inc.x, inc.y, inc.w, inc.h, L.radius * 0.85);
    ctx.clip();
    ctx.fillStyle = P.accent;
    ctx.globalAlpha = 0.28 * pulse;
    circle(ctx, icx, icy, icon * (0.6 + 0.32 * pulse));
    ctx.fill();
    ctx.restore();
  }
  const size = icon * (1 + 0.12 * pulse);
  measureTile(ctx, 'incidents', icx - size / 2, icy, size);
  ctx.textAlign = 'left';
  ctx.fillStyle = P.muted;
  ctx.font = bodyFont(fonts, fs, 800);
  ctx.fillText('Incidents', icx + icon / 2 + fs * 0.55, icy);
  ctx.textAlign = 'right';
  ctx.fillStyle = incidentNow ? P.accentInk : P.heading;
  ctx.font = displayFont(fonts, fs * 2);
  ctx.fillText(String(frame.incidentsSoFar), inc.x + inc.w - cardPad, icy + fs * 0.05);

  // Reputation: the number and the meter.
  const rep = L.cards.reputation;
  ctx.fillStyle = P.heading;
  ctx.font = displayFont(fonts, fs * 1.5);
  ctx.fillText(String(Math.round(frame.reputation)), rep.x + rep.w - cardPad, rep.y + cardPad + fs * 0.7);
  const repBar = reputationBar(L);
  const rf = clamp(frame.reputation / METER_MAX, 0, 1);
  if (rf > 0) {
    ctx.fillStyle = P.highlight;
    roundRectPath(ctx, repBar.x, repBar.y, Math.max(repBar.h, repBar.w * rf), repBar.h, repBar.h / 2);
    ctx.fill();
  }

  // Cash, in bold numerals.
  const cash = L.cards.cash;
  ctx.fillStyle = P.cash;
  ctx.font = bodyFont(fonts, fs, 800);
  const cashLabelW = ctx.measureText('Cash').width;
  fitWith(ctx, dollars(frame.cash), cash.w - 2 * cardPad - cashLabelW - fs * 2.75, fs * 1.9, (px) => displayFont(fonts, px));
  ctx.fillText(dollars(frame.cash), cash.x + cash.w - cardPad, cash.y + cash.h / 2 + fs * 0.05);

  // Energy, cleanliness and crew fatigue.
  const values = [frame.energy, frame.cleanliness, frame.fatigue];
  const fills = [P.highlight, '#3BA39C', P.accent];
  for (let k = 0; k < 3; k++) {
    const row = meterRow(L, k, layer.meterLabelW);
    const v = values[k] ?? 0;
    const f = clamp(v / METER_MAX, 0, 1);
    if (f > 0) {
      ctx.fillStyle = fills[k] ?? P.heading;
      roundRectPath(ctx, row.bar.x, row.bar.y, Math.max(row.bar.h, row.bar.w * f), row.bar.h, row.bar.h / 2);
      ctx.fill();
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = P.ink;
    ctx.font = displayFont(fonts, fs);
    ctx.fillText(String(Math.round(v)), row.numberX, row.cy);
  }

  // Tomorrow's requests, the solo days, and the sick and inspector counters once they have counted.
  const info = L.cards.info;
  const lines = infoLines;
  lines[0] = `Tomorrow: ${frame.requestsTomorrow} asking`;
  lines[1] = `Days the crew ran solo: ${frame.soloStreak}`;
  let count = 2;
  if (frame.sickSoFar > 0) lines[count++] = `Sent home sick ${frame.sickSoFar}`;
  if (frame.finesSoFar > 0) lines[count++] = `Inspector visits ${frame.finesSoFar}`;
  const rowH = (info.h - cardPad * 1.2) / 4;
  ctx.textAlign = 'left';
  for (let k = 0; k < count; k++) {
    const cy = info.y + cardPad * 0.6 + rowH * (k + 0.5);
    const text = lines[k] ?? '';
    ctx.fillStyle = k < 2 ? P.heading : P.accent;
    circle(ctx, info.x + cardPad + fs * 0.3, cy, fs * 0.28);
    ctx.fill();
    ctx.fillStyle = P.ink;
    fitWith(ctx, text, info.w - 2 * cardPad - fs * 1.1, fs, (px) => bodyFont(fonts, px));
    ctx.fillText(text, info.x + cardPad + fs * 1.0, cy);
  }
}
const infoLines: string[] = ['', '', '', ''];
