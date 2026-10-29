// The week replay: one greedy week played block by block on a canvas. An incident is an icon and a counter, never an
// injury. `replayFrame` and `replayClock` are pure functions from the 20 StepRecords and the elapsed time; `drawReplay`
// draws one frame. The replay keeps no state of the week: the page holds the trace and the start time (G4 plan, "What a
// frame shows for step t"; BRIEF section 10.2). No DOM access at module top level.
//
// G5d (WP3; D59, D60): the canvas draws only the yard, in Floor's one camera. The set's board (src/assets/art/set.json)
// with a walk path beside its front-left edge; the cast (cast.json) standing on the board's world map as the frame has
// them: the floor's dogs and crew, the walking group on the path, the naps, a clean, a closed day; the GM orb in its
// state over the clubhouse; an incident as a pulse on the floor, never on a dog; the block's events as chips in the top
// left corner (the Incident chip is the badge). The numbers are the page's rail (src/ui/rail.ts), not the canvas's.
// Every figure stands on its foot anchor at the set's one scale, drawn in the order of its ground point with a contact
// shadow drawn in code (one spec: the silhouette thrown along the key light, and a contact ellipse), and kept clear of
// every other figure where the lawn has room. D60: nothing moves to show an action the trace does not record. A day's
// arrangement comes from its own seeded generator (never the engine's) and holds all day; only the GM's hover and the
// incident's pulse move, and neither under reduced motion. If any image fails, the G4 vector drawing is the fallback.
import type { Bookings, FloorActivity, Rate, State, StepRecord, WorldConfig, WorldEvent } from '../world/types.ts';
import { CAMERA } from '../assets/art/manifest.ts';
import type { BoardMap, CastManifest, CastSprite, CrewPose, DogPose, Facing, SetManifest } from '../assets/art/manifest.ts';
import castJson from '../assets/art/cast.json' with { type: 'json' };
import setJson from '../assets/art/set.json' with { type: 'json' };

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
  /** G5c's illustrated palette; the G5d yard reads the page's canvas tokens (--c-ink and the rest) instead. */
  heading?: string;
  card?: string;
  shadow?: string;
  accent?: string;
  highlight?: string;
  path?: string;
}

/** The fonts of the design (CSS font-family lists): `display` for the header and the numerals, `body` for the rest. */
export interface ReplayFonts {
  display: string;
  body: string;
}

/** The GM's three states, as the status line says them: getting ready, running the week, the week is over. */
export type GmState = 'ready' | 'running' | 'done';

export interface ReplayOptions {
  pixelRatio: number;
  colors: ReplayColors;
  /** 0..1 inside the step, for the incident pulse. */
  progress: number;
  /** The legal ratio (world.bookings.legalRatio) and the most dogs a day can hold (world.requests.max). */
  legalRatio: number;
  gaugeMax: number;
  /** The line drawn without a frame, in place of the default placeholder (the page's "getting ready" line, D50). */
  placeholder?: string;
  /** The page's fonts; when omitted the yard uses the page's --font-ui. Load them (document.fonts) before the first frame. */
  fonts?: ReplayFonts;
  /**
   * No pulse and no hover (prefers-reduced-motion: reduce); the same frame block by block. When omitted, read from
   * matchMedia('(prefers-reduced-motion: reduce)').
   */
  reducedMotion?: boolean;
  /** The GM orb's state on the yard; 'running' when omitted (the page passes 'done' once the week is over). */
  gm?: GmState;
}

/** The page's face when it passes none and has no --font-ui: Archivo as WP2 bundles it, then the system's. */
export const DEFAULT_FONTS: ReplayFonts = {
  display: "'Archivo Variable', 'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif",
  body: "'Archivo Variable', 'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

// ---------------------------------------------------------------------------------------------------------------
// Shared helpers.

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const PLACEHOLDER = "The GM's week plays here once it is on the job.";
/** Canvas text is never smaller than this at 1366 × 768 (G5d acceptance 6). */
const MIN_LABEL_PX = 16;

const fontOf = (px: number, bold = false): string =>
  `${bold ? '600 ' : ''}${Math.max(1, Math.round(px * 10) / 10)}px ${FONT_FAMILY}`;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A small integer hash to [0, 1): the vector yard's jitter and coats, the same on every frame. No randomness. */
function hash01(n: number): number {
  let x = Math.imul(n ^ 0x5bd1e995, 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * The yard's own generator (D60): a seeded mulberry32 for the arrangement, the breeds and the facings, from the day's
 * numbers alone. It never touches the engine's generator, so the picture cannot change what the week does.
 */
function seeded(...parts: number[]): () => number {
  let h = 0x9e3779b9;
  for (const p of parts) h = Math.imul(h ^ (Math.round(p) | 0), 0x85ebca6b) ^ (h >>> 13);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = xs[i] as T;
    xs[i] = xs[j] as T;
    xs[j] = t;
  }
  return xs;
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

function newCanvas(w: number, h: number, readBack = false): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d', readBack ? { willReadFrequently: true } : undefined);
  if (ctx === null) throw new Error('replay: no 2D context for the yard cache');
  return { canvas, ctx };
}

// ---------------------------------------------------------------------------------------------------------------
// The frame.

/**
 * Draws one frame into `ctx` (a canvas of `width` × `height` CSS pixels at options.pixelRatio). With a null frame it
 * clears the canvas and draws one line, the placeholder ("The GM's week plays here once it is on the job.", or the
 * page's own), so the page's stage shows behind it. With a frame: the yard as the frame has it (see the module's
 * header), or the G4 vector yard while the art loads or if an image failed. Reads the frame; keeps only caches of
 * the drawing (the board at this size, the sprites at this size, a day's arrangement).
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
    // The yard is prepared at this size in idle time, so the week's first frame does not pay for it.
    pendingSize = { width, height, ratio: options.pixelRatio };
    if (art !== null) warmUp(art);
    return;
  }
  // The motion policy, for both renderers: under reduced motion the progress inside a block is frozen at 0, so the
  // pulse and the hover stand still and every frame of a block is the same picture.
  const still = reducedMotion(options);
  const opts: ReplayOptions = still && options.progress !== 0 ? { ...options, progress: 0, reducedMotion: true } : options;
  if (art === null || !(width > 0 && height > 0)) {
    drawVectorReplay(ctx, width, height, frame, opts);
    return;
  }
  drawYard(ctx, width, height, frame, opts, art, !still);
}

/** The booking choice in business words: what the GM did with the day's requests, never the number behind it. */
const BOOKING_WORDS: Readonly<Record<Bookings, string>> = {
  all: 'every booking',
  legal: 'capped at the legal ratio',
  safe: 'capped at a safe ratio',
};

/**
 * The day's plan in two parts so a narrow line can break before the crew: "20 asked · 20 accepted, every booking ·
 * premium rate" and "crew 1 scheduled, 1 in"; on a closed day "16 asked · closed" and "crew 1 scheduled, nobody in".
 */
export function planParts(frame: ReplayFrame): { first: string; crew: string } {
  const crew = `crew ${frame.scheduledStaff} scheduled, ${frame.closed ? 'nobody' : String(frame.staff)} in`;
  if (frame.closed) return { first: `${frame.requests} asked · closed`, crew };
  const bookings = frame.bookings === null ? '' : `, ${BOOKING_WORDS[frame.bookings]}`;
  const rate = frame.rate === null ? 'no rate' : RATE_WORDS[frame.rate];
  return { first: `${frame.requests} asked · ${frame.accepted} accepted${bookings} · ${rate}`, crew };
}

/** The whole plan line, as the rail shows it on one line. */
export function planWords(frame: ReplayFrame): string {
  const { first, crew } = planParts(frame);
  return `${first} · ${crew}`;
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

// --- The page's canvas tokens (WP2 sets them on :root). ----------------------------------------------------------

interface Tokens {
  ink: string;
  muted: string;
  surface: string;
  amber: string;
  danger: string;
  ok: string;
  font: string;
}

/** Floor's values (Temp/direction/floor/brand.css), for a page that has not set the tokens. */
const TOKEN_DEFAULTS: Tokens = {
  ink: '#13212F',
  muted: '#44515E',
  surface: '#FFFFFF',
  amber: '#F4A51C',
  danger: '#D23F2A',
  ok: '#2E8B57',
  font: DEFAULT_FONTS.body,
};

function readTokens(fonts: ReplayFonts | undefined): Tokens {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return TOKEN_DEFAULTS;
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: get('--c-ink', TOKEN_DEFAULTS.ink),
    muted: get('--c-muted', TOKEN_DEFAULTS.muted),
    surface: get('--c-surface', TOKEN_DEFAULTS.surface),
    amber: get('--c-amber', TOKEN_DEFAULTS.amber),
    danger: get('--c-danger', TOKEN_DEFAULTS.danger),
    ok: get('--c-ok', TOKEN_DEFAULTS.ok),
    font: fonts?.body ?? get('--font-ui', TOKEN_DEFAULTS.font),
  };
}

const uiFont = (tokens: Tokens, px: number, weight: number): string =>
  `${weight} ${Math.max(1, Math.round(px * 10) / 10)}px ${tokens.font}`;

// --- The placeholder. -------------------------------------------------------------------------------------------------

/**
 * The placeholder (before a run, and while the GM gets ready): the canvas cleared to transparent, so the page's stage
 * shows behind it, and one line of text with a soft white outline so it reads on whatever is behind. Nothing else: the
 * e2e holds the drawn pixels under 2% of the canvas while the GM gets ready.
 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number, options: ReplayOptions): void {
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.clearRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;
  const tokens = readTokens(options.fonts);
  const line = options.placeholder ?? PLACEHOLDER;
  // The page's own line (the GM getting ready) is a caption near the bottom; the default line sits in the middle.
  const caption = options.placeholder !== undefined;
  let px = caption ? clamp(Math.min(width / 46, height / 36), MIN_LABEL_PX, 18) : clamp(Math.min(width / 36, height / 22), MIN_LABEL_PX, 22);
  ctx.font = uiFont(tokens, px, 600);
  const w = ctx.measureText(line).width;
  if (w > width * 0.9) {
    px = Math.max(1, (px * width * 0.9) / w);
    ctx.font = uiFont(tokens, px, 600);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = caption ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = caption ? Math.max(1.5, px * 0.14) : Math.max(2, px * 0.24);
  const y = caption ? height - px * 1.9 : height / 2;
  ctx.strokeText(line, width / 2, y);
  ctx.fillStyle = tokens.ink;
  ctx.fillText(line, width / 2, y);
}

// ===============================================================================================================
// The G4 vector yard: the fallback while the art loads or if an image fails. The yard, the walk path under it and
// the block's events under that, laid out in `fs`, the text size, which scales with the canvas. The HUD is the rail's.

interface Layout {
  fs: number;
  pad: number;
  yard: Box;
  path: Box;
  captions: Box;
}

function vectorLayout(width: number, height: number): Layout {
  const fs = clamp(Math.min(width / 34, height / 26), 15.5, 24);
  const pad = fs * 0.7;
  const capH = 2 * Math.max(fs * 1.05, MIN_LABEL_PX) * 1.3;
  const pathH = fs * 3.2;
  const pathGap = fs * 0.35;
  const yardH = Math.max(1, height - 2 * pad - pathGap - pathH - fs * 0.3 - capH);
  const yard: Box = { x: pad, y: pad, w: Math.max(1, width - 2 * pad), h: yardH };
  const path: Box = { x: pad, y: yard.y + yardH + pathGap, w: yard.w, h: pathH };
  const captions: Box = { x: pad, y: path.y + pathH + fs * 0.3, w: yard.w, h: capH };
  return { fs, pad, yard, path, captions };
}

/** The G4 drawing: the vector yard, the fallback while the art loads or if an image fails. */
function drawVectorReplay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReplayFrame,
  options: ReplayOptions,
): void {
  const { colors } = options;
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.setLineDash([]);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;
  const layout = vectorLayout(width, height);
  drawVectorYard(ctx, frame, layout, options);
  drawCaptions(ctx, frame.captions, layout, colors);
}

/** The events of the block under the yard, joined with " · " and wrapped onto two lines, never under 16 px. */
function drawCaptions(ctx: CanvasRenderingContext2D, captions: readonly string[], layout: Layout, colors: ReplayColors): void {
  if (captions.length === 0) return;
  const box = layout.captions;
  let px = Math.max(layout.fs * 1.05, MIN_LABEL_PX);
  let lines = packLines(ctx, captions, box.w, px);
  for (let i = 0; i < 6 && lines.length > 2 && px * 0.9 >= MIN_LABEL_PX; i++) {
    px *= 0.9;
    lines = packLines(ctx, captions, box.w, px);
  }
  const lineH = Math.min(px * 1.3, box.h / Math.max(1, Math.min(2, lines.length)));
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  lines.slice(0, 2).forEach((line, i) => {
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

function drawVectorYard(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layout: Layout, options: ReplayOptions): void {
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

  drawVectorPath(ctx, frame, layout, options);

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
function drawVectorPath(ctx: CanvasRenderingContext2D, frame: ReplayFrame, layout: Layout, options: ReplayOptions): void {
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

// ===============================================================================================================
// G5d: the yard on the set. The art is two JSON files in manifest.ts's shapes and the images they name, found by
// Vite at build time (every WebP or PNG under src/assets/art/cast/ and set/); a file the JSON names and the build does
// not have is a failed load, and the vector yard stands in.

const ART_URLS: Record<string, string> = import.meta.glob<string>('../assets/art/{cast,set}/*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Gate 5: the cast is mirrored at run time for the other facing (manifest.ts); false draws every sprite as drawn. */
const MIRROR_CAST = true;
/** The silhouette's band height for the spacing test, in image pixels; and the alpha that counts as solid. */
const BAND = 8;
const ALPHA_SOLID = 96;
/** The walk path beside the lawn's front-left edge (world metres: x from −WALK_W to 0, y along the lawn). */
const WALK_W = 0.95;
/** Where a figure's anchor keeps away from a blocked footprint, and how tall a prop is taken to be for hiding. */
const BLOCK_PAD = 0.12;
const PROP_H = 2.0;
/** Same-breed-and-coat dogs closer than this (metres) are neighbours for the clone rule. */
const CLONE_R = 1.7;
/** The shadow spec (gate 3), in the board image's pixels: the key light from the upper left (spike B's KEY), so a
 * point h px above the ground throws its shadow h × shear to the side and up; the blur and tint of the set's own. */
const SHADOW = {
  shearX: 0.72,
  shearY: -0.184,
  castBlur: 3.2,
  castAlpha: 0.3,
  contactBlur: 5.2,
  contactAlpha: 0.42,
  tint: '12, 30, 18',
} as const;
/** The board's slab when the image does not show one, and the path's stone. */
const SLAB_DEFAULT = { depth: 0, left: '#6E5236', right: '#5A4129' } as const;
const PATH_STONE = [214, 202, 176] as const;

interface Shape {
  /** The first band's index: band j covers [j × BAND, (j + 1) × BAND) image px from the anchor, downward. */
  j0: number;
  /** Each band's opaque span, left and right in image px from the anchor (NaN for an empty band). */
  l: Float64Array;
  r: Float64Array;
  /** The bounds in image px from the anchor: left, top, right, bottom. */
  box: [number, number, number, number];
}

interface SpriteArt {
  src: CastSprite;
  img: HTMLImageElement;
  shape: Shape;
  mirrored: Shape;
}

interface GmArt {
  img: HTMLImageElement;
  size: [number, number];
  anchor: [number, number];
}

interface ArtSet {
  board: HTMLImageElement;
  boardSize: [number, number];
  map: BoardMap;
  gm: Record<GmState, GmArt>;
  gmSpot: [number, number];
  /** The dogs by identity (breed and coat), then by pose: every facing drawn. */
  dogs: Map<string, Partial<Record<DogPose, SpriteArt[]>>>;
  identities: string[];
  crew: Partial<Record<CrewPose, SpriteArt[]>>;
  /** The board's slab under its front edges, sampled from the image: its depth (image px) and its two faces' colours. */
  slab: { depth: number; left: string; right: string };
}

let artLoad: Promise<void> | null = null;
let artSet: ArtSet | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => img);
}

function artUrl(file: string): string {
  const url = ART_URLS[`../assets/art/${file}`];
  if (url === undefined) throw new Error(`replay: the build has no ${file}`);
  return url;
}

/**
 * Loads and decodes the set and the cast once (memoised): the page awaits it before the first week plays. It never
 * rejects: if a file is missing or an image fails, the yard stays the G4 vector drawing.
 */
export function replayArtReady(): Promise<void> {
  if (artLoad !== null) return artLoad;
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    artLoad = Promise.resolve();
    return artLoad;
  }
  artLoad = loadArt().then(
    (art) => {
      artSet = art;
      warmUp(art);
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

async function loadArt(): Promise<ArtSet> {
  const cast = castJson as unknown as CastManifest;
  const set = setJson as unknown as SetManifest;
  if (!Array.isArray(cast.sprites) || set.board === undefined || set.gm === undefined) throw new Error('replay: the art manifests are malformed');
  const [board, ready, running, done, images] = await Promise.all([
    loadImage(artUrl(set.board.file)),
    loadImage(artUrl(set.gm.ready.file)),
    loadImage(artUrl(set.gm.running.file)),
    loadImage(artUrl(set.gm.done.file)),
    Promise.all(cast.sprites.map((s) => loadImage(artUrl(s.file)))),
  ]);
  const probe = newCanvas(1, 1, true);
  const dogs = new Map<string, Partial<Record<DogPose, SpriteArt[]>>>();
  const crew: Partial<Record<CrewPose, SpriteArt[]>> = {};
  cast.sprites.forEach((src, i) => {
    const img = images[i] as HTMLImageElement;
    const shape = shapeOf(img, src, probe);
    const art: SpriteArt = { src, img, shape, mirrored: mirrorShape(shape) };
    if (src.kind === 'dog') {
      const id = `${src.breed ?? 'dog'}|${src.coat ?? ''}`;
      const poses = dogs.get(id) ?? {};
      const pose = src.pose as DogPose;
      (poses[pose] ??= []).push(art);
      dogs.set(id, poses);
    } else {
      (crew[src.pose as CrewPose] ??= []).push(art);
    }
  });
  if (dogs.size === 0 || Object.keys(crew).length === 0) throw new Error('replay: the cast needs a dog and the crew');
  const gm = { ready: gmArt(ready, set.gm.ready), running: gmArt(running, set.gm.running), done: gmArt(done, set.gm.done) };
  return {
    board,
    boardSize: set.board.size,
    map: set.board.map,
    gm,
    gmSpot: set.gmSpot,
    dogs,
    identities: [...dogs.keys()].sort(),
    crew,
    slab: sampleSlab(board, set.board.map, probe),
  };
}

const gmArt = (img: HTMLImageElement, spec: { size: [number, number]; anchor: [number, number] }): GmArt => ({
  img,
  size: spec.size,
  anchor: spec.anchor,
});

/** A sprite's silhouette in bands of BAND image px, measured on its own pixels. */
function shapeOf(img: HTMLImageElement, src: CastSprite, probe: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }): Shape {
  const w = img.naturalWidth || src.size[0];
  const h = img.naturalHeight || src.size[1];
  // The manifest's size is the image's; if the file differs, its anchor scales with it.
  const ax = (src.anchor[0] * w) / src.size[0];
  const ay = (src.anchor[1] * h) / src.size[1];
  probe.canvas.width = w;
  probe.canvas.height = h;
  probe.ctx.clearRect(0, 0, w, h);
  probe.ctx.drawImage(img, 0, 0);
  const data = probe.ctx.getImageData(0, 0, w, h).data;
  const sx = src.size[0] / w;
  const sy = src.size[1] / h;
  const j0 = Math.floor(-ay / BAND);
  const n = Math.floor((h - 1 - ay) / BAND) - j0 + 1;
  const l = new Float64Array(n).fill(Number.NaN);
  const r = new Float64Array(n).fill(Number.NaN);
  for (let y = 0; y < h; y++) {
    let lo = -1;
    let hi = -1;
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if ((data[row + x * 4 + 3] ?? 0) >= ALPHA_SOLID) {
        if (lo < 0) lo = x;
        hi = x;
      }
    }
    if (lo < 0) continue;
    const j = Math.floor((y - ay) / BAND) - j0;
    const left = (lo - ax) * sx;
    const right = (hi + 1 - ax) * sx;
    const cl = l[j] as number;
    l[j] = Number.isNaN(cl) ? left : Math.min(cl, left);
    r[j] = Number.isNaN(r[j] as number) ? right : Math.max(r[j] as number, right);
  }
  return withBox({ j0, l, r, box: [0, 0, 0, 0] }, sy);
}

/** Fills the shape's bounds from its bands (`sy` scales the band grid when the file's size differs). */
function withBox(shape: Shape, sy = 1): Shape {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < shape.l.length; i++) {
    const l = shape.l[i] as number;
    if (Number.isNaN(l)) continue;
    left = Math.min(left, l);
    right = Math.max(right, shape.r[i] as number);
    top = Math.min(top, (shape.j0 + i) * BAND * sy);
    bottom = Math.max(bottom, (shape.j0 + i + 1) * BAND * sy);
  }
  shape.box = Number.isFinite(left) ? [left, top, right, bottom] : [0, 0, 0, 0];
  return shape;
}

function mirrorShape(s: Shape): Shape {
  const l = new Float64Array(s.l.length);
  const r = new Float64Array(s.r.length);
  for (let i = 0; i < s.l.length; i++) {
    l[i] = -(s.r[i] as number);
    r[i] = -(s.l[i] as number);
  }
  return { j0: s.j0, l, r, box: [-s.box[2], s.box[1], -s.box[0], s.box[3]] };
}

/**
 * The board's slab under its front edges, read from the image: how deep it hangs below the lawn's front corner, and the
 * colours of its front-left and front-right faces, so the walk path beside it is built of the same soil.
 */
function sampleSlab(board: HTMLImageElement, map: BoardMap, probe: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }): ArtSet['slab'] {
  const [ox, oy] = map.origin;
  const span = Math.round(map.ppm * 1.2);
  probe.canvas.width = 1;
  probe.canvas.height = span;
  probe.ctx.clearRect(0, 0, 1, span);
  probe.ctx.drawImage(board, Math.round(ox), Math.round(oy), 1, span, 0, 0, 1, span);
  const column = probe.ctx.getImageData(0, 0, 1, span).data;
  let depth = 0;
  while (depth < span && (column[depth * 4 + 3] ?? 0) >= 128) depth++;
  if (depth < 4) return { ...SLAB_DEFAULT };
  const at = (x: number, y: number, fallback: string): string => {
    probe.canvas.width = 1;
    probe.canvas.height = 1;
    probe.ctx.clearRect(0, 0, 1, 1);
    probe.ctx.drawImage(board, Math.round(x), Math.round(y), 1, 1, 0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 0] = probe.ctx.getImageData(0, 0, 1, 1).data;
    return a >= 200 ? `rgb(${r}, ${g}, ${b})` : fallback;
  };
  // A point a third of the way along each front edge, two thirds of the way down its face.
  const along = (map.lawn[1] / 3) * map.ppm;
  const down = depth * 0.66;
  const ux = (2 / Math.sqrt(5)) * along;
  const uy = (1 / Math.sqrt(5)) * along;
  return {
    depth,
    left: at(ox - ux, oy - uy + down, SLAB_DEFAULT.left),
    right: at(ox + ux, oy - uy + down, SLAB_DEFAULT.right),
  };
}

// --- The stage: the set fitted to the canvas, and everything drawn at that size. ------------------------------------

/** One look of a figure: a sprite and whether it is drawn mirrored. */
interface Look {
  art: SpriteArt;
  mirror: boolean;
}

/** A sprite (or the GM) scaled for the stage, in device pixels, with its anchor and its shadow. */
interface Drawn {
  img: HTMLCanvasElement;
  ax: number;
  ay: number;
  shadow: HTMLCanvasElement | null;
  sx: number;
  sy: number;
}

interface Stage {
  key: string;
  art: ArtSet;
  width: number;
  height: number;
  ratio: number;
  /** CSS px per board-image px, and the CSS position of the board image's top left. */
  k: number;
  bx: number;
  by: number;
  /** The lawn's front corner and one world metre along x and along y, in CSS px; CSS px per metre of height. */
  origin: [number, number];
  ex: [number, number];
  ey: [number, number];
  hpm: number;
  fs: number;
  pad: number;
  tokens: Tokens;
  /** The board and the walk path, at this size. */
  layer: HTMLCanvasElement;
  /** The GM orb's box (its largest state) and its label's, in CSS px; figures keep clear of both. */
  orb: Box;
  label: { x: number; y: number; w: number; h: number; lineFrom: number; lineTo: number };
  /** The corner the event chips use, kept clear of figures. */
  chips: Box;
  /** The blocked footprints on screen: each one's four ground corners (CSS px) and its horizontal extent. */
  props: { corners: [number, number][]; x0: number; x1: number }[];
  /** Each blocked footprint raised PROP_H, as its screen outline (cut out of the shadows' clip). */
  propHulls: [number, number][][];
  drawn: Map<string, Drawn>;
  gmShadow: HTMLCanvasElement | null;
  days: Map<string, DayPlan>;
  /** Day plans begun in idle time and not finished yet, by key. */
  pending: Map<string, Generator<void, DayPlan, void>>;
  warm: boolean;
}

let stage: Stage | null = null;
let pendingSize: { width: number; height: number; ratio: number } | null = null;
let warmTimer: ReturnType<typeof setTimeout> | null = null;

const stageKey = (width: number, height: number, ratio: number): string => `${Math.round(width)}|${Math.round(height)}|${ratio}`;

/** The default week's Monday (config requests.day1, one staffer): arranged while the page is idle, which also warms
 * the placer's code, so a Round 1 week's first frame only draws. Any other Monday is arranged when it comes. */
const WARM_DAY = { dogs: 20, staff: 1 } as const;

/**
 * Prepares the yard at the size the page last drew its placeholder at, in idle time: the board, the path and every
 * sprite and shadow at that size, and the default Monday's arrangement, so the week's first frame only draws.
 */
function warmUp(art: ArtSet): void {
  const size = pendingSize;
  if (size === null || warmTimer !== null || !(size.width > 0 && size.height > 0)) return;
  if (stage !== null && stage.art === art && stage.warm && stage.key === stageKey(size.width, size.height, size.ratio)) return;
  warmTimer = setTimeout(() => {
    warmTimer = null;
    const s = stageFor(size.width, size.height, size.ratio, art);
    if (s.warm) return;
    s.warm = true;
    function* prepare(): Generator<void, void, void> {
      for (const state of ['ready', 'running', 'done'] as const) gmDrawn(s, state);
      for (const look of allLooks(art)) {
        drawnOf(s, look);
        yield;
      }
      inIdleTime(s, 0, WARM_DAY.dogs, WARM_DAY.staff);
    }
    idle(s, prepare(), () => true);
  }, 0);
}

/**
 * During a day's pickup, tomorrow's arrangement in idle time, when tomorrow is easy to foresee (the GM took every
 * booking today, so tomorrow's dogs are tomorrow's requests; the same crew): a guess that only fills the cache, so the
 * next day's first frame only draws. The arrangement is the same whenever it is made; a wrong guess costs idle time.
 */
function planAhead(s: Stage, frame: ReplayFrame): void {
  if (frame.block !== 3 || frame.closed || frame.bookings !== 'all' || frame.day >= 4) return;
  inIdleTime(s, frame.day + 1, frame.requestsTomorrow, frame.scheduledStaff);
}

/** Starts a day's arrangement in idle time; a frame that needs it before it is done finishes what is left (dayPlan). */
function inIdleTime(s: Stage, day: number, dogs: number, staff: number): void {
  const key = `${day}|${dogs}|${staff}`;
  if (s.days.has(key) || s.pending.has(key)) return;
  const gen = daySteps(s, day, dogs, staff);
  s.pending.set(key, gen);
  idle(s, gen, () => s.pending.get(key) === gen, () => s.pending.delete(key));
}

/**
 * Runs `work` a little at a time in the browser's idle time (a few milliseconds a slice, between frames), so it never
 * holds up a frame, while the yard keeps its size and `wanted` holds; `done` when it finishes.
 */
function idle(s: Stage, work: Generator<void, unknown, void>, wanted: () => boolean, done?: () => void): void {
  const later = (fn: (left: () => number) => void): void => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback((d) => fn(() => d.timeRemaining()), { timeout: 400 });
    else
      setTimeout(() => {
        const t0 = performance.now();
        fn(() => 3 - (performance.now() - t0));
      }, 0);
  };
  const slice = (left: () => number): void => {
    if (stage !== s || !wanted()) return; // finished by a frame, or the yard was resized
    let r = work.next();
    while (r.done !== true && left() > 1) r = work.next();
    if (r.done === true) done?.();
    else later(slice);
  };
  later(slice);
}

/** Every look the cast can be drawn in: each sprite as drawn and, if the cast mirrors, mirrored. */
function allLooks(art: ArtSet): Look[] {
  const looks: Look[] = [];
  const add = (list: SpriteArt[] | undefined): void => {
    for (const a of list ?? []) {
      looks.push({ art: a, mirror: false });
      if (MIRROR_CAST) looks.push({ art: a, mirror: true });
    }
  };
  for (const poses of art.dogs.values()) for (const list of Object.values(poses)) add(list);
  for (const list of Object.values(art.crew)) add(list);
  return looks;
}

function stageFor(width: number, height: number, ratio: number, art: ArtSet): Stage {
  const key = stageKey(width, height, ratio);
  if (stage !== null && stage.key === key && stage.art === art) return stage;
  const map = art.map;
  const [bw, bh] = art.boardSize;
  const P = map.ppm;
  const exImg: [number, number] = [(2 / Math.sqrt(5)) * P, (-1 / Math.sqrt(5)) * P];
  const eyImg: [number, number] = [(-2 / Math.sqrt(5)) * P, (-1 / Math.sqrt(5)) * P];
  const groundImg = (mx: number, my: number): [number, number] => [
    map.origin[0] + mx * exImg[0] + my * eyImg[0],
    map.origin[1] + mx * exImg[1] + my * eyImg[1],
  ];
  // The scene's bounds in image px: the board, the walk path with its slab, the GM in any state.
  let x0 = 0;
  let y0 = 0;
  let x1 = bw;
  let y1 = bh;
  for (const [mx, my] of [[-WALK_W, 0], [0, 0], [-WALK_W, map.lawn[1]]] as const) {
    const [x, y] = groundImg(mx, my);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y + art.slab.depth);
  }
  for (const g of Object.values(art.gm)) {
    x0 = Math.min(x0, art.gmSpot[0] - g.anchor[0]);
    y0 = Math.min(y0, art.gmSpot[1] - g.anchor[1]);
    x1 = Math.max(x1, art.gmSpot[0] - g.anchor[0] + g.size[0]);
  }
  const pad = Math.max(10, Math.min(width, height) * 0.02);
  const fs = clamp(Math.round(width / 52), MIN_LABEL_PX, 22);
  const k = Math.max(0.05, Math.min((width - 2 * pad) / (x1 - x0), (height - 2 * pad) / (y1 - y0), 1));
  const bx = (width - (x1 - x0) * k) / 2 - x0 * k;
  const by = (height - (y1 - y0) * k) / 2 - y0 * k;
  const origin: [number, number] = [bx + map.origin[0] * k, by + map.origin[1] * k];
  const el = (CAMERA.elevationDeg * Math.PI) / 180;
  const groundLen = Math.hypot(Math.SQRT1_2, Math.SQRT1_2 * Math.sin(el));
  const tokens = readTokens(undefined);

  // The GM's box and its label: "The GM" on a pill beside the orb, on the side with room.
  const run = art.gm.running;
  let ox0 = Infinity;
  let oy0 = Infinity;
  let ox1 = -Infinity;
  let oy1 = -Infinity;
  for (const g of Object.values(art.gm)) {
    ox0 = Math.min(ox0, bx + (art.gmSpot[0] - g.anchor[0]) * k);
    oy0 = Math.min(oy0, by + (art.gmSpot[1] - g.anchor[1]) * k);
    ox1 = Math.max(ox1, bx + (art.gmSpot[0] - g.anchor[0] + g.size[0]) * k);
    oy1 = Math.max(oy1, by + (art.gmSpot[1] - g.anchor[1] + g.size[1]) * k);
  }
  const orbMidY = by + (art.gmSpot[1] - run.anchor[1] + run.size[1] / 2) * k;
  const runRight = bx + (art.gmSpot[0] - run.anchor[0] + run.size[0]) * k;
  const runLeft = bx + (art.gmSpot[0] - run.anchor[0]) * k;
  const probe = newCanvas(1, 1);
  probe.ctx.font = uiFont(tokens, fs, 800);
  const labelW = probe.ctx.measureText('The GM').width + fs * 1.9;
  const labelH = Math.round(fs * 1.85);
  const lead = fs * 1.6;
  const onRight = runRight + lead + labelW <= width - pad;
  const lx = onRight ? runRight + lead : Math.max(pad, runLeft - lead - labelW);
  const label = {
    x: lx,
    y: clamp(orbMidY - labelH / 2, pad, height - pad - labelH),
    w: labelW,
    h: labelH,
    lineFrom: onRight ? runRight + 2 : runLeft - 2,
    lineTo: onRight ? lx : lx + labelW,
  };

  const s: Stage = {
    key,
    art,
    width,
    height,
    ratio,
    k,
    bx,
    by,
    origin,
    ex: [exImg[0] * k, exImg[1] * k],
    ey: [eyImg[0] * k, eyImg[1] * k],
    hpm: ((P * Math.cos(el)) / groundLen) * k,
    fs,
    pad,
    tokens,
    layer: newCanvas(width * ratio, height * ratio).canvas,
    orb: { x: ox0, y: oy0, w: ox1 - ox0, h: oy1 - oy0 },
    label,
    chips: { x: 0, y: 0, w: width * 0.62, h: pad + 2 * Math.round(fs * 1.95) + fs * 0.4 },
    props: [],
    propHulls: [],
    drawn: new Map(),
    gmShadow: null,
    days: new Map(),
    pending: new Map(),
    warm: false,
  };
  s.props = map.blocked.map(([rx, ry, rw, rh]) => {
    const corners = [ground(s, rx, ry), ground(s, rx + rw, ry), ground(s, rx + rw, ry + rh), ground(s, rx, ry + rh)];
    return { corners, x0: Math.min(...corners.map((c) => c[0])), x1: Math.max(...corners.map((c) => c[0])) };
  });
  const lift = PROP_H * s.hpm;
  s.propHulls = s.props.map(({ corners }) => hull([...corners, ...corners.map(([x, y]): [number, number] => [x, y - lift])]));
  paintLayer(s);
  stage = s;
  return s;
}

/** The convex hull of a few points, counter-clockwise on screen (Andrew's monotone chain). */
function hull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]): [number, number][] => {
    const h: [number, number][] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2] as [number, number], h[h.length - 1] as [number, number], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** A world point on the ground (metres) to CSS px. */
function ground(s: Stage, mx: number, my: number): [number, number] {
  return [s.origin[0] + mx * s.ex[0] + my * s.ey[0], s.origin[1] + mx * s.ex[1] + my * s.ey[1]];
}

/** A CSS point back to the ground (metres). */
function world(s: Stage, x: number, y: number): [number, number] {
  const dx = x - s.origin[0];
  const dy = y - s.origin[1];
  const det = s.ex[0] * s.ey[1] - s.ey[0] * s.ex[1];
  return [(dx * s.ey[1] - dy * s.ey[0]) / det, (s.ex[0] * dy - s.ex[1] * dx) / det];
}

/** `src` (w × h px) at w·f × h·f device px, halving first so a big downscale stays smooth; mirrored if asked. */
function scaled(src: CanvasImageSource, w: number, h: number, f: number, mirror: boolean): HTMLCanvasElement {
  const pw = Math.max(1, Math.round(w * f));
  const ph = Math.max(1, Math.round(h * f));
  let cur: CanvasImageSource = src;
  let cw = w;
  let ch = h;
  while (cw > pw * 2 && ch > ph * 2) {
    const half = newCanvas(Math.round(cw / 2), Math.round(ch / 2));
    half.ctx.imageSmoothingQuality = 'high';
    half.ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, half.canvas.width, half.canvas.height);
    cur = half.canvas;
    cw = half.canvas.width;
    ch = half.canvas.height;
  }
  const out = newCanvas(pw, ph);
  out.ctx.imageSmoothingQuality = 'high';
  if (mirror) {
    out.ctx.translate(pw, 0);
    out.ctx.scale(-1, 1);
  }
  out.ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, pw, ph);
  return out.canvas;
}

/** The static layer: the board, and the walk path built against its front-left edge from the slab's own soil. */
function paintLayer(s: Stage): void {
  const { art, ratio, k } = s;
  const ctx = s.layer.getContext('2d');
  if (ctx === null) throw new Error('replay: no 2D context for the yard cache');
  const [bw, bh] = art.boardSize;
  const board = scaled(art.board, art.board.naturalWidth || bw, art.board.naturalHeight || bh, (bw * k * ratio) / (art.board.naturalWidth || bw), false);
  ctx.drawImage(board, Math.round(s.bx * ratio), Math.round(s.by * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  paintWalkPath(ctx, s);
}

/**
 * The walk path: a strip of pale stone the width of a walking pair, level with the lawn and as deep as its slab, laid
 * against the lawn's front-left edge, faceted like the lawn (each cell two triangles a shade apart) and lit like it
 * (its left face in the slab's lit soil, its end in the shaded soil).
 */
function paintWalkPath(ctx: CanvasRenderingContext2D, s: Stage): void {
  const L = s.art.map.lawn[1];
  const depth = s.art.slab.depth * s.k;
  const g = (mx: number, my: number): [number, number] => ground(s, mx, my);
  const poly = (pts: [number, number][], fill: string): void => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const down = ([x, y]: [number, number]): [number, number] => [x, y + depth];
  if (depth > 0) {
    poly([g(-WALK_W, 0), g(-WALK_W, L), down(g(-WALK_W, L)), down(g(-WALK_W, 0))], s.art.slab.left);
    poly([g(0, 0), g(-WALK_W, 0), down(g(-WALK_W, 0)), down(g(0, 0))], s.art.slab.right);
  }
  // The top, in facets: cells of about 0.32 m along the path and two across it.
  const rand = seeded(7, Math.round(L * 100));
  const along = Math.max(1, Math.round(L / 0.32));
  const across = 2;
  const [r0, g0, b0] = PATH_STONE;
  const tone = (t: number): string => `rgb(${Math.round(r0 * t)}, ${Math.round(g0 * t)}, ${Math.round(b0 * t)})`;
  ctx.lineJoin = 'round';
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < across; j++) {
      const y0 = (L * i) / along;
      const y1 = (L * (i + 1)) / along;
      const x0 = -WALK_W + (WALK_W * j) / across;
      const x1 = -WALK_W + (WALK_W * (j + 1)) / across;
      const a = g(x0, y0);
      const b = g(x1, y0);
      const c = g(x1, y1);
      const d = g(x0, y1);
      const t1 = 0.965 + rand() * 0.05;
      const t2 = 0.965 + rand() * 0.05;
      const flip = rand() < 0.5;
      // Each triangle filled and stroked in its own tone, so no hairline shows between facets.
      for (const [pts, t] of (flip ? [[[a, b, c], t1], [[a, c, d], t2]] : [[[a, b, d], t1], [[b, c, d], t2]]) as [[number, number][], number][]) {
        poly(pts, tone(t));
        ctx.strokeStyle = tone(t);
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
  }
  // The path's outer edge, a shade darker, where the stone meets its side.
  ctx.strokeStyle = 'rgba(70, 52, 30, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(...g(-WALK_W, L));
  ctx.lineTo(...g(-WALK_W, 0));
  ctx.lineTo(...g(0, 0));
  ctx.stroke();
}

/** A look at this stage's size: the sprite scaled (and mirrored), its anchor, and its shadow. Made once, then reused. */
function drawnOf(s: Stage, look: Look): Drawn {
  const key = `${look.art.src.id}|${look.mirror ? 'm' : ''}`;
  const cached = s.drawn.get(key);
  if (cached !== undefined) return cached;
  const { src, img } = look.art;
  const f = s.k * s.ratio;
  const nw = img.naturalWidth || src.size[0];
  const nh = img.naturalHeight || src.size[1];
  const canvas = scaled(img, nw, nh, (src.size[0] * f) / nw, look.mirror);
  const fx = canvas.width / src.size[0];
  const fy = canvas.height / src.size[1];
  const ax = (look.mirror ? src.size[0] - src.anchor[0] : src.anchor[0]) * fx;
  const ay = src.anchor[1] * fy;
  const shadow = castShadow(canvas, ax, ay, f);
  const drawn: Drawn = { img: canvas, ax, ay, shadow: shadow.canvas, sx: shadow.ax, sy: shadow.ay };
  s.drawn.set(key, drawn);
  return drawn;
}

/**
 * The contact shadow (gate 3, one spec for every figure): the sprite's silhouette thrown along the key light (a point
 * h px up lands h × shearX to the right and h × shearY up), blurred and tinted as the set's own shadows, under a soft
 * contact ellipse at the feet. `f` is device px per image px. Without canvas filters the two are drawn unblurred.
 */
function castShadow(sprite: HTMLCanvasElement, ax: number, ay: number, f: number): { canvas: HTMLCanvasElement | null; ax: number; ay: number } {
  const w = sprite.width;
  const h = sprite.height;
  const A = SHADOW.shearX;
  const B = SHADOW.shearY;
  const blur = SHADOW.contactBlur * f;
  const pad = Math.ceil(blur * 2.5 + 2);
  const erx = w * 0.42;
  const ery = Math.max(1, w * 0.11);
  const ecx = (w / 2 - ax) * 0.5; // from the anchor
  // Where the anchor sits in the shadow canvas, with room for the throw and the ellipse.
  const sx = Math.ceil(pad + Math.max(ax - A * (ay - h), erx - ecx, 0));
  const sy = Math.ceil(pad + Math.max(-B * ay, ery));
  const W = Math.ceil(sx + Math.max(w - ax + A * ay, ecx + erx) + pad);
  const H = Math.ceil(sy + Math.max(-B * (h - ay), ery) + pad);
  const sil = newCanvas(W, H);
  sil.ctx.setTransform(1, 0, -A, -B, sx - ax + A * ay, sy + B * ay);
  sil.ctx.drawImage(sprite, 0, 0);
  sil.ctx.setTransform(1, 0, 0, 1, 0, 0);
  sil.ctx.globalCompositeOperation = 'source-in';
  sil.ctx.fillStyle = `rgb(${SHADOW.tint})`;
  sil.ctx.fillRect(0, 0, W, H);
  const out = newCanvas(W, H);
  const filters = typeof out.ctx.filter === 'string';
  if (filters) out.ctx.filter = `blur(${(SHADOW.castBlur * f).toFixed(2)}px)`;
  out.ctx.globalAlpha = SHADOW.castAlpha;
  out.ctx.drawImage(sil.canvas, 0, 0);
  if (filters) out.ctx.filter = `blur(${blur.toFixed(2)}px)`;
  out.ctx.globalAlpha = SHADOW.contactAlpha;
  out.ctx.fillStyle = `rgb(${SHADOW.tint})`;
  out.ctx.beginPath();
  out.ctx.ellipse(sx + ecx, sy - f, erx, ery, 0, 0, Math.PI * 2);
  out.ctx.fill();
  return { canvas: out.canvas, ax: sx, ay: sy };
}

/** The GM in a state at this stage's size (no cast shadow: it hovers; its shadow is a soft disc on the roof). */
function gmDrawn(s: Stage, state: GmState): Drawn {
  const key = `gm|${state}`;
  const cached = s.drawn.get(key);
  if (cached !== undefined) return cached;
  const g = s.art.gm[state];
  const f = s.k * s.ratio;
  const nw = g.img.naturalWidth || g.size[0];
  const nh = g.img.naturalHeight || g.size[1];
  const canvas = scaled(g.img, nw, nh, (g.size[0] * f) / nw, false);
  const drawn: Drawn = { img: canvas, ax: g.anchor[0] * (canvas.width / g.size[0]), ay: g.anchor[1] * (canvas.height / g.size[1]), shadow: null, sx: 0, sy: 0 };
  s.drawn.set(key, drawn);
  if (s.gmShadow === null) {
    const rx = g.size[0] * f * 0.36;
    const ry = rx * 0.38;
    const blur = 4 * f;
    const c = newCanvas(rx * 2 + blur * 6, ry * 2 + blur * 6);
    if (typeof c.ctx.filter === 'string') c.ctx.filter = `blur(${blur.toFixed(2)}px)`;
    c.ctx.fillStyle = `rgba(${SHADOW.tint}, 0.32)`;
    c.ctx.beginPath();
    c.ctx.ellipse(c.canvas.width / 2, c.canvas.height / 2, rx, ry, 0, 0, Math.PI * 2);
    c.ctx.fill();
    s.gmShadow = c.canvas;
  }
  return drawn;
}

// --- Where everyone stands: a day's arrangement, from the yard's own generator. ----------------------------------

/** A figure standing somewhere: its look, its ground point in metres and its anchor in CSS px. */
interface Fig {
  look: Look;
  mx: number;
  my: number;
  x: number;
  y: number;
}

/** One dog of the day: who it is (breed and coat), the way it faces, its pose in free play, and where it stands. */
interface DogCard {
  id: string;
  facing: Facing;
  play: DogPose;
  mx: number;
  my: number;
}

interface CrewCard {
  facing: Facing;
  mx: number;
  my: number;
}

interface DayPlan {
  dogs: DogCard[];
  crew: CrewCard[];
  /** The organised arrangements, made the first time the day needs one: structured play, a clean, a walk. */
  more: Map<string, Fig[]>;
}

/** A placed figure for the spacing test: its silhouette at its anchor (CSS px), its bounds, and which look it took. */
interface Placed {
  shape: Shape;
  alt: number;
  x: number;
  y: number;
  box: [number, number, number, number];
  clone: string;
  mx: number;
  my: number;
}

/** Where a figure may stand: a world rectangle on the lawn or on the walk path, and an optional preference. */
interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  path: boolean;
  prefer?: (mx: number, my: number) => boolean;
}

interface Item {
  /** The looks the figure may take here (one, or a facing each way); the placer picks the one that fits. */
  looks: Look[];
  clone: string;
  region: Region;
  /** A spot to stand as near as the room allows (an organised activity); null to spread out (free play). */
  target: [number, number] | null;
}

const lawnRegion = (s: Stage): Region => {
  const [lx, ly] = s.art.map.lawn;
  const m = s.art.map.margin;
  return { x0: m, x1: lx - m, y0: m, y1: ly - m, path: false };
};
const pathRegion = (s: Stage): Region => ({ x0: -WALK_W + 0.2, x1: -0.2, y0: 0.4, y1: s.art.map.lawn[1] - 0.3, path: true });

function lookShape(look: Look): Shape {
  return look.mirror ? look.art.mirrored : look.art.shape;
}

/** The sprite list's look for a facing: the one drawn that way, or another mirrored (gate 5). */
function faceLook(list: SpriteArt[], facing: Facing): Look {
  const exact = list.find((a) => a.src.facing === facing);
  if (exact !== undefined) return { art: exact, mirror: false };
  const other = list[0] as SpriteArt;
  return { art: other, mirror: MIRROR_CAST && other.src.facing !== facing };
}

const DOG_FALLBACK: Readonly<Record<DogPose, DogPose[]>> = {
  moving: ['moving', 'sitting', 'asleep'],
  sitting: ['sitting', 'moving', 'asleep'],
  asleep: ['asleep', 'sitting', 'moving'],
};
const CREW_FALLBACK: Readonly<Record<CrewPose, CrewPose[]>> = {
  ball: ['ball', 'leash', 'mop'],
  leash: ['leash', 'ball', 'mop'],
  mop: ['mop', 'ball', 'leash'],
};

function dogLook(art: ArtSet, id: string, pose: DogPose, facing: Facing): Look {
  const poses = art.dogs.get(id) ?? (art.dogs.values().next().value as Partial<Record<DogPose, SpriteArt[]>>);
  for (const p of DOG_FALLBACK[pose]) {
    const list = poses[p];
    if (list !== undefined && list.length > 0) return faceLook(list, facing);
  }
  throw new Error(`replay: no sprite for ${id}`);
}

function crewLook(art: ArtSet, pose: CrewPose, facing: Facing): Look {
  for (const p of CREW_FALLBACK[pose]) {
    const list = art.crew[p];
    if (list !== undefined && list.length > 0) return faceLook(list, facing);
  }
  const any = Object.values(art.crew).find((l) => l !== undefined && l.length > 0) as SpriteArt[];
  return faceLook(any, facing);
}

/** The bounds in CSS px of a shape whose anchor is at (x, y). */
function boxAt(s: Stage, shape: Shape, x: number, y: number): [number, number, number, number] {
  const k = s.k;
  return [x + shape.box[0] * k, y + shape.box[1] * k, x + shape.box[2] * k, y + shape.box[3] * k];
}

/** How much two placed silhouettes overlap, in CSS px², counting `gap` px of air around each as overlap. */
function overlapArea(s: Stage, a: Placed, b: Placed, gap: number): number {
  if (a.box[2] + gap <= b.box[0] || b.box[2] + gap <= a.box[0] || a.box[3] + gap <= b.box[1] || b.box[3] + gap <= a.box[1]) return 0;
  const k = s.k;
  const bh = BAND * k;
  const A = a.shape;
  const B = b.shape;
  let area = 0;
  for (let i = 0; i < A.l.length; i++) {
    const la = A.l[i] as number;
    if (Number.isNaN(la)) continue;
    const top = a.y + (A.j0 + i) * bh;
    const jb0 = Math.max(0, Math.floor((top - gap - b.y) / bh) - B.j0);
    const jb1 = Math.min(B.l.length - 1, Math.floor((top + bh + gap - b.y) / bh) - B.j0);
    const ax0 = a.x + la * k;
    const ax1 = a.x + (A.r[i] as number) * k;
    let widest = 0;
    for (let j = jb0; j <= jb1; j++) {
      const lb = B.l[j] as number;
      if (Number.isNaN(lb)) continue;
      const o = Math.min(ax1, b.x + (B.r[j] as number) * k) - Math.max(ax0, b.x + lb * k) + gap;
      if (o > widest) widest = o;
    }
    area += widest * bh;
  }
  return area;
}

function boxOverlap(a: [number, number, number, number], b: Box): number {
  const w = Math.min(a[2], b.x + b.w) - Math.max(a[0], b.x);
  const h = Math.min(a[3], b.y + b.h) - Math.max(a[1], b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * How much of a figure standing at (x, y) a prop would hide: the screen width of the figure that a blocked footprint
 * (taken PROP_H tall) covers from in front. A figure the set's scenery should hide must not stand there, since the
 * board is one image drawn under every figure.
 */
function hiddenBehindProps(s: Stage, box: [number, number, number, number], y: number): number {
  let hidden = 0;
  for (const { corners, x0, x1 } of s.props) {
    const xa = Math.max(box[0], x0);
    const xb = Math.min(box[2], x1);
    if (xb <= xa) continue;
    // The footprint's nearest ground point (the largest screen y) within the figure's columns.
    let nearest = -Infinity;
    for (let i = 0; i < 4; i++) {
      const p = corners[i] as [number, number];
      const q = corners[(i + 1) % 4] as [number, number];
      if (p[0] >= xa && p[0] <= xb) nearest = Math.max(nearest, p[1]);
      for (const xe of [xa, xb]) {
        if ((p[0] - xe) * (q[0] - xe) <= 0 && p[0] !== q[0]) nearest = Math.max(nearest, p[1] + ((q[1] - p[1]) * (xe - p[0])) / (q[0] - p[0]));
      }
    }
    if (nearest > y && nearest - PROP_H * s.hpm < y) hidden += xb - xa;
  }
  return hidden;
}

/** True when the anchor is on its ground (the lawn inside its margin and off the blocked footprints, or the path). */
function standable(s: Stage, region: Region, mx: number, my: number): boolean {
  if (mx < region.x0 || mx > region.x1 || my < region.y0 || my > region.y1) return false;
  if (region.path) return true;
  for (const [rx, ry, rw, rh] of s.art.map.blocked) {
    if (mx > rx - BLOCK_PAD && mx < rx + rw + BLOCK_PAD && my > ry - BLOCK_PAD && my < ry + rh + BLOCK_PAD) return false;
  }
  return true;
}

/** True when the silhouette's lowest band (the feet) lies on its ground: no paw over the board's edge or the path's. */
function feetOnGround(s: Stage, region: Region, shape: Shape, x: number, y: number): boolean {
  let last = shape.l.length - 1;
  while (last >= 0 && Number.isNaN(shape.l[last] as number)) last--;
  if (last < 0) return true;
  const fy = y + (shape.j0 + last + 0.5) * BAND * s.k;
  const [lx, ly] = s.art.map.lawn;
  for (const fx of [x + (shape.l[last] as number) * s.k, x + (shape.r[last] as number) * s.k]) {
    const [mx, my] = world(s, fx, fy);
    if (region.path) {
      if (mx < -WALK_W + 0.04 || mx > 0 || my < 0.04 || my > ly - 0.04) return false;
    } else if (mx < 0.04 || my < 0.04 || mx > lx - 0.04 || my > ly - 0.04) return false;
  }
  return true;
}

type Score = [number, number, number];
const better = (a: Score, b: Score): boolean => a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])));

/**
 * Places each item in turn: of a few dozen candidate spots on its ground (seeded), the one that overlaps nothing (the
 * figures already placed with a little air, the GM, the event chips, the canvas's edges, a prop that would hide it),
 * then has the fewest same-sprite neighbours (the clone rule), then spreads out most (free play) or stands nearest
 * its target (an organised activity). Then up to three passes move each figure that still overlaps another to the
 * most open spots of a grid over its ground. Every item is placed: in a yard too full for clear air, the least
 * overlap. `fixed` figures (a walk's group, placed first) are obstacles that do not move.
 */
function placeAll(s: Stage, items: readonly Item[], rand: () => number, fixed: readonly Placed[] = []): Placed[] {
  return drain(placeSteps(s, items, rand, fixed));
}

/** Runs a resumable computation to its end. */
function drain<T>(gen: Generator<void, T, void>): T {
  let r = gen.next();
  while (r.done !== true) r = gen.next();
  return r.value;
}

/** placeAll as a resumable computation: it pauses after each figure, so the work can be spread over idle time. */
function* placeSteps(s: Stage, items: readonly Item[], rand: () => number, fixed: readonly Placed[] = []): Generator<void, Placed[], void> {
  const gap = Math.max(1.5, 0.05 * s.art.map.ppm * s.k);
  const keepClear: Box[] = [s.orb, { x: s.label.x - gap, y: s.label.y - gap, w: s.label.w + 2 * gap, h: s.label.h + 2 * gap }, s.chips];
  const out: (Placed | null)[] = items.map(() => null);
  const shapes = items.map((item) => item.looks.map(lookShape));
  // The search shrinks as the yard fills, so a full day's arrangement stays a short task on a Chromebook.
  const crowd = items.length + fixed.length;
  const spread = clamp(Math.round(1500 / Math.max(1, crowd)), 32, 64);
  const passes = crowd > 24 ? 2 : 3;
  const cloneR2 = CLONE_R * CLONE_R;

  /**
   * Item i's best look at (mx, my) among everyone else placed, or null where it cannot stand or cannot beat `bound`.
   * The position's own terms (the clone rule, the spread or the target) are the same for every look; each look adds
   * its overlaps, and a later look is tried only while the first still overlaps something.
   */
  const evaluate = (i: number, mx: number, my: number, bound: number, only = -1): { p: Placed; score: Score } | null => {
    const item = items[i] as Item;
    const { region, target } = item;
    if (!standable(s, region, mx, my)) return null;
    const [x, y] = ground(s, mx, my);
    let clones = 0;
    let nearest2 = Infinity;
    for (let j = 0; j < fixed.length + out.length; j++) {
      const q = j < fixed.length ? (fixed[j] as Placed) : out[j - fixed.length];
      if (q == null || j - fixed.length === i) continue;
      const dx = q.mx - mx;
      const dy = q.my - my;
      const d2 = dx * dx + dy * dy;
      if (item.clone !== '' && q.clone === item.clone && d2 < cloneR2) clones += 1;
      if (d2 < nearest2) nearest2 = d2;
    }
    const third =
      target === null
        ? -Math.min(Math.sqrt(nearest2), 2 * Math.min(mx - region.x0, region.x1 - mx, my - region.y0, region.y1 - my) + 0.6)
        : Math.sqrt((mx - target[0]) ** 2 + (my - target[1]) ** 2);
    let best: { p: Placed; score: Score } | null = null;
    const alts = shapes[i] as Shape[];
    for (let alt = 0; alt < alts.length; alt++) {
      if (only >= 0 && alt !== only) continue;
      const shape = alts[alt] as Shape;
      if (!feetOnGround(s, region, shape, x, y)) continue;
      const box = boxAt(s, shape, x, y);
      const p: Placed = { shape, alt, x, y, box, clone: item.clone, mx, my };
      const limit = Math.min(bound, best === null ? Infinity : best.score[0]) + 0.5;
      let cost = 0;
      for (const zone of keepClear) cost += boxOverlap(box, zone) * 4;
      if (box[0] < 0 || box[1] < 0 || box[2] > s.width || box[3] > s.height) cost += 1e6;
      if (!region.path) cost += hiddenBehindProps(s, box, y) * 1e4;
      if (region.prefer !== undefined && !region.prefer(mx, my)) cost += 50;
      for (let j = 0; j < fixed.length + out.length && cost <= limit; j++) {
        const q = j < fixed.length ? (fixed[j] as Placed) : out[j - fixed.length];
        if (q == null || j - fixed.length === i) continue;
        cost += overlapArea(s, p, q, gap);
      }
      if (cost > limit) continue;
      const score: Score = [Math.round(cost), clones, third];
      if (best === null || better(score, best.score)) best = { p, score };
      if (score[0] === 0) break; // clear air: the other facing cannot do better here
    }
    return best;
  };

  /**
   * Item i's best spot among fresh candidates (and its current one, if it has one): seeded random spots, or, for the
   * few figures a pass is still moving, a jittered grid over its whole ground, which finds the narrow gaps.
   */
  const settle = (i: number, thorough = false): Score => {
    const item = items[i] as Item;
    const { region, target } = item;
    const candidates: [number, number][] = [];
    const current = out[i];
    if (current != null) candidates.push([current.mx, current.my]);
    if (target !== null) {
      candidates.push(target);
      for (const r of [0.15, 0.3, 0.45, 0.6, 0.8, 1.05, 1.35, 1.7, 2.1]) {
        const turn = rand() * Math.PI * 2;
        for (let a = 0; a < 6; a++) {
          const t = turn + (a * Math.PI) / 3;
          candidates.push([target[0] + r * Math.cos(t), target[1] + r * Math.sin(t)]);
        }
      }
    }
    if (thorough) {
      // The grid's 80 most open points (farthest from every other figure's feet) are the ones worth scoring.
      const step = 0.3;
      const open: [number, number, number][] = [];
      for (let gx = region.x0; gx <= region.x1; gx += step) {
        for (let gy = region.y0; gy <= region.y1; gy += step) {
          const mx = gx + (rand() - 0.5) * step;
          const my = gy + (rand() - 0.5) * step;
          let d2 = Infinity;
          for (let j = 0; j < fixed.length + out.length; j++) {
            const q = j < fixed.length ? (fixed[j] as Placed) : out[j - fixed.length];
            if (q == null || j - fixed.length === i) continue;
            d2 = Math.min(d2, (q.mx - mx) ** 2 + (q.my - my) ** 2);
          }
          open.push([mx, my, d2]);
        }
      }
      open.sort((a, b) => b[2] - a[2]);
      for (const [mx, my] of open.slice(0, 80)) candidates.push([mx, my]);
    } else {
      for (let c = 0; c < (target === null ? spread : 12); c++) {
        candidates.push([region.x0 + rand() * (region.x1 - region.x0), region.y0 + rand() * (region.y1 - region.y0)]);
      }
    }
    let best: Placed | null = null;
    let bestScore: Score = [Infinity, Infinity, Infinity];
    for (const [mx, my] of candidates) {
      const e = evaluate(i, mx, my, bestScore[0]);
      if (e !== null && better(e.score, bestScore)) {
        best = e.p;
        bestScore = e.score;
      }
    }
    if (best === null) {
      // Nothing standable among the candidates (a cramped board): the region's middle.
      const mx = (region.x0 + region.x1) / 2;
      const my = (region.y0 + region.y1) / 2;
      const [x, y] = ground(s, mx, my);
      const shape = (shapes[i] as Shape[])[0] as Shape;
      best = { shape, alt: 0, x, y, box: boxAt(s, shape, x, y), clone: item.clone, mx, my };
    }
    out[i] = best;
    return bestScore;
  };

  for (let i = 0; i < items.length; i++) {
    settle(i);
    yield;
  }
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      const current = out[i] as Placed;
      const now = evaluate(i, current.mx, current.my, Infinity, current.alt);
      if (now === null || (now.score[0] === 0 && now.score[1] === 0)) continue;
      if (better(settle(i, true), now.score)) moved = true;
      yield;
    }
    if (!moved) break;
  }
  return out as Placed[];
}

/**
 * The day's cast and where each stands in free play: the dogs' breeds and coats dealt evenly from the cast (shuffled),
 * each dog's facing and its free-play pose (moving or sitting), and its spot, kept all day (a walk's floor too). The
 * crew stand first, near the middle.
 */
function dayPlan(s: Stage, day: number, dogCount: number, staffCount: number): DayPlan {
  const key = `${day}|${dogCount}|${staffCount}`;
  const cached = s.days.get(key);
  if (cached !== undefined) return cached;
  // Started ahead of time and not done yet: finish it here rather than start again.
  const started = s.pending.get(key);
  s.pending.delete(key);
  return drain(started ?? daySteps(s, day, dogCount, staffCount));
}

/** dayPlan's work, resumable; it files the plan under its key when it is done. */
function* daySteps(s: Stage, day: number, dogCount: number, staffCount: number): Generator<void, DayPlan, void> {
  const key = `${day}|${dogCount}|${staffCount}`;
  const art = s.art;
  const rand = seeded(day, dogCount, staffCount, 1);
  const ids: string[] = [];
  while (ids.length < dogCount) ids.push(...shuffle([...art.identities], rand));
  const face = (): Facing => (rand() < 0.5 ? 'right' : 'left');
  const dogs: DogCard[] = Array.from({ length: dogCount }, (_, i) => ({
    id: ids[i] as string,
    facing: face(),
    play: (rand() < 0.62 ? 'moving' : 'sitting') as DogPose,
    mx: 0,
    my: 0,
  }));
  // The crew face alternate ways, so two staffers drawn from the one model never stand as copies.
  const first = face();
  const crew: CrewCard[] = Array.from({ length: staffCount }, (_, k) => ({ facing: k % 2 === 0 ? first : first === 'right' ? 'left' : 'right', mx: 0, my: 0 }));
  const [lx, ly] = art.map.lawn;
  const CREW_AT: readonly [number, number][] = [
    [0.4, 0.38],
    [0.66, 0.3],
    [0.2, 0.5],
  ];
  const region = lawnRegion(s);
  // Each dog may face either way; the placer takes the facing that fits (the seeded one first, when both do).
  const facings = dogs.map((d): Facing[] => (d.facing === 'right' ? ['right', 'left'] : ['left', 'right']));
  const items: Item[] = [
    ...crew.map((c, k): Item => {
      const at = CREW_AT[k % CREW_AT.length] as [number, number];
      return { looks: [crewLook(art, 'ball', c.facing)], clone: '', region, target: [at[0] * lx, at[1] * ly] };
    }),
    ...dogs.map((d, i): Item => ({ looks: (facings[i] as Facing[]).map((f) => dogLook(art, d.id, d.play, f)), clone: d.id, region, target: null })),
  ];
  const spots = yield* placeSteps(s, items, rand);
  crew.forEach((c, k) => {
    const p = spots[k] as Placed;
    c.mx = p.mx;
    c.my = p.my;
  });
  dogs.forEach((d, i) => {
    const p = spots[crew.length + i] as Placed;
    d.mx = p.mx;
    d.my = p.my;
    d.facing = (facings[i] as Facing[])[p.alt] as Facing;
  });
  const plan: DayPlan = { dogs, crew, more: new Map() };
  s.days.set(key, plan);
  return plan;
}

function fig(s: Stage, look: Look, mx: number, my: number): Fig {
  const [x, y] = ground(s, mx, my);
  return { look, mx, my, x, y };
}

const placedOf = (s: Stage, f: Fig, clone = ''): Placed => {
  const shape = lookShape(f.look);
  return { shape, alt: 0, x: f.x, y: f.y, box: boxAt(s, shape, f.x, f.y), clone, mx: f.mx, my: f.my };
};

/**
 * Structured play: each staffer on the floor with a ball, their dogs sitting in short rows either side of them, every
 * dog facing its staffer (the rows to the screen's left face right, those to its right face left). The groups stand
 * side by side across the lawn.
 */
function structured(s: Stage, plan: DayPlan, frame: ReplayFrame): Fig[] {
  const key = `structured|${frame.floorDogs}|${frame.floorStaff}`;
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached;
  const art = s.art;
  const rand = seeded(frame.day, frame.dogs, frame.staff, 2);
  const [lx, ly] = art.map.lawn;
  const groups = Math.max(1, frame.floorStaff);
  const side: [number, number] = [-Math.SQRT1_2, Math.SQRT1_2]; // one metre toward the screen's left
  const back: [number, number] = [Math.SQRT1_2, Math.SQRT1_2]; // one metre away from the viewer
  const centre: [number, number] = [lx * 0.43, ly * 0.43];
  const spread = Math.min(3.4, (Math.hypot(lx, ly) * 0.8) / groups);
  const region = lawnRegion(s);
  const items: Item[] = [];
  for (let g = 0; g < groups; g++) {
    const off = (g - (groups - 1) / 2) * spread;
    const cx = centre[0] - side[0] * off;
    const cy = centre[1] - side[1] * off;
    if (frame.floorStaff > 0) items.push({ looks: [crewLook(art, 'ball', g % 2 === 0 ? 'right' : 'left')], clone: '', region, target: [cx, cy] });
    const first = Math.floor((g * frame.floorDogs) / groups);
    const m = Math.floor(((g + 1) * frame.floorDogs) / groups) - first;
    const perSide = Math.ceil(m / 2);
    const rows = Math.max(1, Math.ceil(Math.sqrt(perSide * 1.3)));
    const cols = Math.max(1, Math.ceil(perSide / rows));
    for (let j = 0; j < m; j++) {
      const d = plan.dogs[first + j] as DogCard;
      const left = j % 2 === 0;
      const n = Math.floor(j / 2);
      const c = n % cols;
      const r = Math.floor(n / cols);
      const dist = 0.95 + c * 0.85;
      const depth = (r - (rows - 1) / 2) * 0.75;
      const sign = left ? 1 : -1;
      items.push({
        looks: [dogLook(art, d.id, 'sitting', left ? 'right' : 'left')],
        clone: d.id,
        region,
        target: [cx + sign * side[0] * dist + back[0] * depth, cy + sign * side[1] * dist + back[1] * depth],
      });
    }
  }
  const spots = placeAll(s, items, rand);
  const figs = spots.map((p, i) => fig(s, (items[i] as Item).looks[p.alt] as Look, p.mx, p.my));
  plan.more.set(key, figs);
  return figs;
}

/**
 * A clean: the crew with the mop on the open floor at the screen's left, the dogs settled out of the way at its right,
 * sitting or asleep.
 */
function cleaning(s: Stage, plan: DayPlan, frame: ReplayFrame): Fig[] {
  const key = `clean|${frame.floorDogs}|${frame.floorStaff}`;
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached;
  const art = s.art;
  const rand = seeded(frame.day, frame.dogs, frame.staff, 3);
  const [lx, ly] = art.map.lawn;
  const lawn = lawnRegion(s);
  const right: Region = { ...lawn, prefer: (mx, my) => mx - my > -0.4 };
  const items: Item[] = [];
  const CREW_AT: readonly [number, number][] = [
    [0.22, 0.6],
    [0.18, 0.32],
    [0.38, 0.78],
  ];
  for (let k = 0; k < frame.floorStaff; k++) {
    const at = CREW_AT[k % CREW_AT.length] as [number, number];
    items.push({ looks: [crewLook(art, 'mop', (plan.crew[k] as CrewCard).facing)], clone: '', region: lawn, target: [at[0] * lx, at[1] * ly] });
  }
  for (let i = 0; i < frame.floorDogs; i++) {
    const d = plan.dogs[i] as DogCard;
    const pose: DogPose = rand() < 0.5 ? 'asleep' : 'sitting';
    const other: Facing = d.facing === 'right' ? 'left' : 'right';
    items.push({ looks: [dogLook(art, d.id, pose, d.facing), dogLook(art, d.id, pose, other)], clone: d.id, region: right, target: null });
  }
  const spots = placeAll(s, items, rand);
  const figs = spots.map((p, i) => fig(s, (items[i] as Item).looks[p.alt] as Look, p.mx, p.my));
  plan.more.set(key, figs);
  return figs;
}

/**
 * A walk: the walking group on the path beside the lawn, the staffer in front with the leash and the dogs behind in
 * pairs, all heading along the path toward the lawn's front corner (the camera-facing diagonal, so every sprite faces
 * right); placed first, in formation. Then the floor makes room for it: each dog and staffer left behind stands as near
 * its free-play spot as it can without crowding the group, so the group reads as its own.
 */
function walking(s: Stage, plan: DayPlan, frame: ReplayFrame): Fig[] {
  const key = `walk|${frame.floorDogs}|${frame.floorStaff}|${frame.walkingDogs}|${frame.walkingStaff}`;
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached;
  const art = s.art;
  const rand = seeded(frame.day, frame.dogs, frame.staff, 4);
  const path = pathRegion(s);
  const mid = (path.x0 + path.x1) / 2;
  const group: Item[] = [];
  if (frame.walkingStaff > 0) group.push({ looks: [crewLook(art, 'leash', 'right')], clone: '', region: path, target: [mid, path.y0 + 0.2] });
  for (let j = 0; j < frame.walkingDogs; j++) {
    const d = plan.dogs[frame.floorDogs + j] as DogCard;
    const lane = j % 2 === 0 ? -0.16 : 0.16;
    group.push({ looks: [dogLook(art, d.id, 'moving', 'right')], clone: d.id, region: path, target: [mid + lane, path.y0 + 1.1 + Math.floor(j / 2) * 1.0 + (j % 2) * 0.45] });
  }
  const walkers = placeAll(s, group, rand);
  const lawn = lawnRegion(s);
  const floor: Item[] = [];
  for (let i = 0; i < frame.floorDogs; i++) {
    const d = plan.dogs[i] as DogCard;
    floor.push({ looks: [dogLook(art, d.id, d.play, d.facing)], clone: d.id, region: lawn, target: [d.mx, d.my] });
  }
  for (let k = 0; k < frame.floorStaff; k++) {
    const c = plan.crew[k] as CrewCard;
    floor.push({ looks: [crewLook(art, 'ball', c.facing)], clone: '', region: lawn, target: [c.mx, c.my] });
  }
  const stay = placeAll(s, floor, rand, walkers);
  const figs = [
    ...walkers.map((p, i) => fig(s, (group[i] as Item).looks[p.alt] as Look, p.mx, p.my)),
    ...stay.map((p, i) => fig(s, (floor[i] as Item).looks[p.alt] as Look, p.mx, p.my)),
  ];
  plan.more.set(key, figs);
  return figs;
}

/** A nap: every dog lies down as near its free-play spot as the room allows; the crew stay where they stood. */
function napping(s: Stage, plan: DayPlan, frame: ReplayFrame): Fig[] {
  const key = `nap|${frame.floorDogs}|${frame.floorStaff}`;
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached;
  const art = s.art;
  const rand = seeded(frame.day, frame.dogs, frame.staff, 5);
  const region = lawnRegion(s);
  const items: Item[] = [];
  for (let k = 0; k < frame.floorStaff; k++) {
    const c = plan.crew[k] as CrewCard;
    items.push({ looks: [crewLook(art, 'leash', c.facing)], clone: '', region, target: [c.mx, c.my] });
  }
  for (let i = 0; i < frame.floorDogs; i++) {
    const d = plan.dogs[i] as DogCard;
    const other: Facing = d.facing === 'right' ? 'left' : 'right';
    items.push({ looks: [dogLook(art, d.id, 'asleep', d.facing), dogLook(art, d.id, 'asleep', other)], clone: d.id, region, target: [d.mx, d.my] });
  }
  const spots = placeAll(s, items, rand);
  const figs = spots.map((p, i) => fig(s, (items[i] as Item).looks[p.alt] as Look, p.mx, p.my));
  plan.more.set(key, figs);
  return figs;
}

/** Everyone on the yard in this block: the floor as the activity has it (a walk's group on the path beside it). */
function figuresOf(s: Stage, frame: ReplayFrame): Fig[] {
  if (frame.closed || frame.activity === null) return [];
  const plan = dayPlan(s, frame.day, frame.dogs, frame.staff);
  const art = s.art;
  if (frame.activity === 'structuredPlay') return structured(s, plan, frame);
  if (frame.activity === 'clean') return cleaning(s, plan, frame);
  if (frame.activity === 'nap') return napping(s, plan, frame);
  if (frame.walkingStaff > 0 || frame.walkingDogs > 0) return walking(s, plan, frame);
  const floor: Fig[] = [];
  for (let i = 0; i < frame.floorDogs; i++) {
    const d = plan.dogs[i] as DogCard;
    floor.push(fig(s, dogLook(art, d.id, d.play, d.facing), d.mx, d.my));
  }
  for (let k = 0; k < frame.floorStaff; k++) {
    const c = plan.crew[k] as CrewCard;
    floor.push(fig(s, crewLook(art, 'ball', c.facing), c.mx, c.my));
  }
  return floor;
}

// --- The frame on the set. ------------------------------------------------------------------------------------------

function drawYard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReplayFrame,
  options: ReplayOptions,
  art: ArtSet,
  motion: boolean,
): void {
  const s = stageFor(width, height, options.pixelRatio, art);
  const tokens = options.fonts === undefined ? s.tokens : { ...s.tokens, font: options.fonts.body };
  const R = s.ratio;
  const progress = clamp(options.progress, 0, 1);
  const t0 = import.meta.env.DEV ? performance.now() : 0;
  const figs = figuresOf(s, frame).sort((a, b) => a.y - b.y || a.x - b.x);
  if (import.meta.env.DEV) (globalThis as { __yard?: unknown }).__yard = { ms: Math.round((performance.now() - t0) * 10) / 10, ...yardStats(s, figs) };
  planAhead(s, frame);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.setLineDash([]);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(s.layer, 0, 0);

  // The incident: a ring on the lawn around the floor, never on a dog (D60).
  if (frame.events.some((e) => e.type === 'incident')) drawPulse(ctx, s, tokens, figs, motion ? progress : null);

  // The GM over the clubhouse: its soft shadow on the roof, then the orb, hovering gently while the week plays.
  const state: GmState = options.gm ?? 'running';
  const gm = gmDrawn(s, state);
  const [gx, gy] = [s.bx + s.art.gmSpot[0] * s.k, s.by + s.art.gmSpot[1] * s.k];
  if (s.gmShadow !== null) ctx.drawImage(s.gmShadow, Math.round(gx * R - s.gmShadow.width / 2), Math.round(gy * R - s.gmShadow.height / 2));
  const hover = motion && state === 'running' ? Math.sin(((frame.day * 4 + frame.block + progress) / 8) * Math.PI * 2) * 2.5 * s.k * 2 : 0;
  ctx.drawImage(gm.img, Math.round(gx * R - gm.ax), Math.round((gy + hover) * R - gm.ay));

  // The figures: every shadow first, so none falls across another figure, and only on the ground (the lawn and the
  // path: a shadow thrown past the fence would land on the page); then the figures back to front.
  const drawn = figs.map((f) => drawnOf(s, f.look));
  const [lx, ly] = s.art.map.lawn;
  ctx.save();
  ctx.setTransform(R, 0, 0, R, 0, 0);
  ctx.beginPath();
  for (const quad of [[[0, 0], [lx, 0], [lx, ly], [0, ly]], [[-WALK_W, 0], [0, 0], [0, ly], [-WALK_W, ly]]] as const) {
    quad.forEach(([mx, my], i) => (i === 0 ? ctx.moveTo(...ground(s, mx, my)) : ctx.lineTo(...ground(s, mx, my))));
    ctx.closePath();
  }
  ctx.clip();
  // Less the scenery standing on the lawn (each blocked footprint raised PROP_H): no shadow on a wall or a bush. Each is
  // its own clip (the canvas with that outline cut out), since clips intersect.
  for (const outline of s.propHulls) {
    ctx.beginPath();
    ctx.rect(0, 0, s.width, s.height);
    outline.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.clip('evenodd');
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  figs.forEach((f, i) => {
    const d = drawn[i] as Drawn;
    if (d.shadow !== null) ctx.drawImage(d.shadow, Math.round(f.x * R - d.sx), Math.round(f.y * R - d.sy));
  });
  ctx.restore();
  figs.forEach((f, i) => {
    const d = drawn[i] as Drawn;
    ctx.drawImage(d.img, Math.round(f.x * R - d.ax), Math.round(f.y * R - d.ay));
  });

  ctx.setTransform(R, 0, 0, R, 0, 0);
  drawGmLabel(ctx, s, tokens);
  const captions = frame.closed && !frame.captions.some((c) => /closed/i.test(c)) ? ['Closed', ...frame.captions] : frame.captions;
  drawChips(ctx, s, tokens, captions);
}

/** Development only (stripped from the build): how many pairs of figures overlap, and how many clone neighbours. */
function yardStats(s: Stage, figs: readonly Fig[]): { figures: number; overlaps: number; worst: number; clones: number } {
  const placed = figs.map((f) => placedOf(s, f, f.look.art.src.kind === 'dog' ? `${f.look.art.src.breed}|${f.look.art.src.coat}|${f.look.art.src.pose}` : ''));
  let overlaps = 0;
  let worst = 0;
  let clones = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i] as Placed;
      const b = placed[j] as Placed;
      const o = overlapArea(s, a, b, 0);
      if (o > 4) overlaps += 1;
      worst = Math.max(worst, o);
      if (a.clone !== '' && a.clone === b.clone && Math.hypot(a.mx - b.mx, a.my - b.my) < CLONE_R) clones += 1;
    }
  }
  return { figures: figs.length, overlaps, worst: Math.round(worst), clones };
}

/**
 * The incident's pulse: a ring on the lawn round the dogs on the floor (their middle, wide enough to take them in),
 * clipped to the lawn, growing and fading through the block; a steady ring under reduced motion (`progress` null).
 */
function drawPulse(ctx: CanvasRenderingContext2D, s: Stage, tokens: Tokens, figs: readonly Fig[], progress: number | null): void {
  const [lx, ly] = s.art.map.lawn;
  const onLawn = figs.filter((f) => f.mx >= 0);
  let cx = lx * 0.45;
  let cy = ly * 0.45;
  let radius = Math.min(lx, ly) * 0.3;
  if (onLawn.length > 0) {
    cx = onLawn.reduce((t, f) => t + f.mx, 0) / onLawn.length;
    cy = onLawn.reduce((t, f) => t + f.my, 0) / onLawn.length;
    const rms = Math.sqrt(onLawn.reduce((t, f) => t + (f.mx - cx) ** 2 + (f.my - cy) ** 2, 0) / onLawn.length);
    radius = clamp(rms * 1.35, 1.1, Math.min(lx, ly) * 0.48);
  }
  const R = s.ratio;
  ctx.save();
  ctx.setTransform(R, 0, 0, R, 0, 0);
  ctx.beginPath();
  for (const [mx, my] of [[0, 0], [lx, 0], [lx, ly], [0, ly]] as const) ctx.lineTo(...ground(s, mx, my));
  ctx.closePath();
  ctx.clip();
  const ring = (r: number, alpha: number, width: number, fill: number): void => {
    ctx.beginPath();
    for (let a = 0; a <= 48; a++) {
      const t = (a / 48) * Math.PI * 2;
      const [x, y] = ground(s, cx + r * Math.cos(t), cy + r * Math.sin(t));
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = fill;
    ctx.fillStyle = tokens.danger;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = tokens.danger;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const w = Math.max(2, s.fs * 0.17);
  if (progress === null) ring(radius, 0.7, w, 0.1);
  else {
    const fade = (1 - progress) ** 0.8;
    ring(radius * (0.7 + 0.35 * progress), 0.85 * fade, w, 0.12 * fade);
  }
  ctx.restore();
}

/** "The GM" on a navy pill with the amber light, a short line to the orb (Floor's callout). */
function drawGmLabel(ctx: CanvasRenderingContext2D, s: Stage, tokens: Tokens): void {
  const { x, y, w, h, lineFrom, lineTo } = s.label;
  const mid = y + h / 2;
  ctx.strokeStyle = tokens.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lineFrom, mid);
  ctx.lineTo(lineTo, mid);
  ctx.stroke();
  ctx.fillStyle = tokens.ink;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = tokens.amber;
  circle(ctx, x + h * 0.52, mid, s.fs * 0.26);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = uiFont(tokens, s.fs, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('The GM', x + h * 0.52 + s.fs * 0.62, mid + s.fs * 0.04);
}

/** How a chip looks: the Incident chip is the badge (white on the danger red); the rest are white with a mark. */
function chipLook(caption: string, tokens: Tokens): { fill: string; ink: string; mark: string | null; warn: boolean } {
  if (caption === 'Incident') return { fill: tokens.danger, ink: '#FFFFFF', mark: null, warn: true };
  if (caption === 'Closed') return { fill: tokens.ink, ink: '#FFFFFF', mark: null, warn: false };
  if (caption.startsWith('Walk photo')) return { fill: tokens.surface, ink: tokens.ink, mark: tokens.ok, warn: false };
  if (caption.startsWith('The staffer')) return { fill: tokens.surface, ink: tokens.ink, mark: tokens.ink, warn: false };
  return { fill: tokens.surface, ink: tokens.ink, mark: tokens.amber, warn: false }; // money and sickness
}

/** The block's events, as the frame words them, on chips in the top left corner; a full row continues below. */
function drawChips(ctx: CanvasRenderingContext2D, s: Stage, tokens: Tokens, captions: readonly string[]): void {
  if (captions.length === 0) return;
  const fs = s.fs;
  const h = Math.round(fs * 1.95);
  const padX = fs * 0.7;
  const gap = fs * 0.4;
  const maxRight = Math.max(s.width * 0.62, Math.min(s.width - s.pad, s.pad + fs * 16));
  let x = s.pad;
  let y = s.pad;
  ctx.font = uiFont(tokens, fs, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const caption of captions) {
    const look = chipLook(caption, tokens);
    const lead = look.warn ? fs * 1.05 + fs * 0.4 : look.mark !== null ? fs * 0.5 + fs * 0.45 : 0;
    const w = Math.min(s.width - 2 * s.pad, ctx.measureText(caption).width + 2 * padX + lead);
    if (x > s.pad && x + w > maxRight) {
      x = s.pad;
      y += h + gap;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(19, 33, 47, 0.18)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = look.fill;
    roundRectPath(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.restore();
    const cy = y + h / 2;
    let tx = x + padX;
    if (look.warn) {
      warnIcon(ctx, tx, cy, fs * 1.05, look.ink);
      tx += fs * 1.05 + fs * 0.4;
    } else if (look.mark !== null) {
      ctx.fillStyle = look.mark;
      circle(ctx, tx + fs * 0.25, cy, fs * 0.25);
      ctx.fill();
      tx += fs * 0.5 + fs * 0.45;
    }
    ctx.fillStyle = look.ink;
    ctx.fillText(caption, tx, cy + fs * 0.04);
    x += w + gap;
  }
}

/** The warning triangle (the editor's incident icon, 24 units), stroked at `size` px with its left edge at x. */
const WARN_PATHS = ['M12 3.5l9.5 16.5h-19z', 'M12 10v4.5', 'M12 17.4v.1'] as const;
let warnPaths: Path2D[] | null = null;
function warnIcon(ctx: CanvasRenderingContext2D, x: number, cy: number, size: number, color: string): void {
  warnPaths ??= WARN_PATHS.map((d) => new Path2D(d));
  const k = size / 24;
  ctx.save();
  ctx.translate(x, cy - 12 * k);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of warnPaths) ctx.stroke(p);
  ctx.restore();
}
