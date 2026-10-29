// The week replay: one greedy week played block by block on a canvas. An incident is an icon and a counter, never an
// injury. `replayFrame` and `replayClock` are pure functions from the 20 StepRecords and the elapsed time; `drawReplay`
// draws one frame. The replay keeps no state of the week: the page holds the trace and the start time (G4 plan, "What a
// frame shows for step t"; BRIEF section 10.2). No DOM access at module top level.
//
// G5d (WP3; D59, D60): the canvas draws only the yard, in Floor's one camera. The set's board (src/assets/art/set.json),
// fitted to the canvas exactly as the page fits it behind the canvas before the week (one scale in every state); the
// cast (cast.json) standing on the board's world map as the frame has them: the floor's dogs and two different staff,
// the walking group on the set's own path (set.json's walk strip), the naps, a clean, a closed day; the GM orb in its
// state hovering over the clubhouse's roof, its shadow under it (and alone over the board while the GM gets ready); an
// incident as a pulse on the floor, never on a dog; the block's events as chips under "This block" in the top right
// corner while the week plays (the Incident chip is the badge). The numbers are the page's rail (src/ui/rail.ts).
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
  /**
   * Without a frame: when omitted, the default line ("The GM's week plays here once it is on the job."); '' draws
   * nothing (the page shows the board behind the canvas); any other line means the GM is getting ready: the orb waits
   * over the roof with its label, and the line itself is not drawn, since the page's status line says it (round 1,
   * finding 20).
   */
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

const PLACEHOLDER = "The GM's week plays here once it is on the job.";
/** Canvas text is never smaller than this at 1366 × 768 (G5d acceptance 6). */
const MIN_LABEL_PX = 16;

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
 * clears the canvas, so the page's board shows behind it, and draws what options.placeholder asks (see there). With a
 * frame: the yard as the frame has it (see the module's header), or the vector yard while the art loads or if an
 * image failed. Reads the frame; keeps only caches of
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
    drawPlaceholder(ctx, width, height, options, art);
    // The yard is prepared at this size in idle time, so the week's first frame does not pay for it; while the GM gets
    // ready (its stage is up), each redraw also advances that a little, in case the browser has no idle time.
    pendingSize = { width, height, ratio: options.pixelRatio };
    if (art !== null) {
      warmUp(art);
      const s = stages.get(stageKey(width, height, options.pixelRatio));
      if (s !== undefined && s.art === art) {
        startWarm(s);
        advanceWarm(s, 4);
      }
    }
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
function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number, options: ReplayOptions, art: ArtSet | null): void {
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.clearRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;
  const tokens = readTokens(options.fonts);
  if (options.placeholder !== undefined) {
    // The page's own line names the state it is in (the GM getting ready): the page's status line already says it, so
    // the canvas does not (round 1, finding 20). While the GM gets ready, the orb waits over the roof of the board the
    // page shows behind the canvas, in its getting-ready state, at the scale the week will play at.
    if (options.placeholder !== '' && art !== null) {
      const s = stageFor(width, height, options.pixelRatio, art);
      drawGm(ctx, s, gmDrawn(s, 'ready'), 0);
      ctx.setTransform(s.ratio, 0, 0, s.ratio, 0, 0);
      drawGmLabel(ctx, options.fonts === undefined ? s.tokens : { ...s.tokens, font: options.fonts.body }, s.fs, s.label);
    }
    return;
  }
  const line = PLACEHOLDER;
  let px = clamp(Math.min(width / 36, height / 22), MIN_LABEL_PX, 22);
  ctx.font = uiFont(tokens, px, 600);
  const w = ctx.measureText(line).width;
  if (w > width * 0.9) {
    px = Math.max(1, (px * width * 0.9) / w);
    ctx.font = uiFont(tokens, px, 600);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = Math.max(2, px * 0.24);
  ctx.strokeText(line, width / 2, height / 2);
  ctx.fillStyle = tokens.ink;
  ctx.fillText(line, width / 2, height / 2);
}

// ===============================================================================================================
// The vector yard: the fallback while the art loads or if an image fails (round 1, finding 4). Drawn in code in the
// page's tokens: a fenced lawn seen from the side, the dogs in profile (a muzzle and a dog's ears, floppy or pointed,
// a tail, four legs), in varied sizes and coats, each in a cell of its own so none overlaps another; adult crew; the
// GM's orb in the corner with its label; the block's events on the same chips as the set's yard; and a path along the
// front of the fence where a walk's group goes. The numbers are the page's rail.

interface Layout {
  fs: number;
  pad: number;
  /** The band over the yard: the orb and its label at the left, the chips at the right. */
  head: Box;
  yard: Box;
  path: Box;
}

function vectorLayout(width: number, height: number): Layout {
  const fs = clamp(Math.round(width / 52), MIN_LABEL_PX, 22);
  const pad = Math.max(10, Math.min(width, height) * 0.025);
  const headH = Math.round(fs * 1.95) * 2 + fs * 0.4;
  const pathH = Math.max(fs * 3, height * 0.12);
  const head: Box = { x: pad, y: pad, w: width - 2 * pad, h: headH };
  const yardY = head.y + head.h + fs * 0.5;
  const yard: Box = { x: pad, y: yardY, w: width - 2 * pad, h: Math.max(1, height - yardY - pathH - pad) };
  const path: Box = { x: pad, y: yard.y + yard.h, w: yard.w, h: pathH };
  return { fs, pad, head, yard, path };
}

/** The dogs' coats (a body and a darker shade for the ears), sizes and ear shapes, dealt by a dog's number. */
const COATS: readonly (readonly [string, string])[] = [
  ['#D9A35B', '#B07A3A'], // golden
  ['#EBD9B4', '#C9B285'], // cream
  ['#34302E', '#1F1C1B'], // black
  ['#74503A', '#523525'], // chocolate
  ['#B9693D', '#8C4A27'], // red
  ['#A3ABB0', '#6F777C'], // grey
  ['#F1ECE3', '#B9A98F'], // white with tan ears
];
interface DogLook {
  coat: readonly [string, string];
  size: number; // 0.8 small to 1.15 large
  floppy: boolean;
}
function dogLookOf(i: number): DogLook {
  return {
    coat: COATS[Math.floor(hash01(i * 3 + 11) * COATS.length)] ?? (COATS[0] as readonly [string, string]),
    size: [0.8, 0.95, 1.05, 1.15][Math.floor(hash01(i * 7 + 5) * 4)] ?? 1,
    floppy: hash01(i * 11 + 3) < 0.6,
  };
}
const dirOf = (i: number): 1 | -1 => (hash01(i * 5 + 2) < 0.5 ? -1 : 1);

/**
 * A dog in profile, its feet at (x, y), `u` its body length, facing `dir`: standing (four legs, the tail up) or lying
 * (the legs tucked, the chin on its paws, the eye closed). It is about 1.4 u long and 1.25 u tall standing.
 */
function drawVDog(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, dir: 1 | -1, look: DogLook, ink: string, lying: boolean): void {
  const [coat, shade] = look.coat;
  const line = Math.max(1, u * 0.035);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const outline = (): void => {
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = ink;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const by = lying ? y - 0.22 * u : y - 0.6 * u; // the body's middle
  const hx = x + dir * (lying ? 0.62 : 0.6) * u; // the head
  const hy = lying ? y - 0.3 * u : y - 0.98 * u;
  // The tail, behind the body.
  ctx.strokeStyle = coat;
  ctx.lineWidth = Math.max(1.5, 0.1 * u);
  ctx.beginPath();
  if (lying) {
    ctx.moveTo(x - dir * 0.48 * u, y - 0.12 * u);
    ctx.quadraticCurveTo(x - dir * 0.75 * u, y - 0.05 * u, x - dir * 0.6 * u, y - 0.02 * u);
  } else {
    ctx.moveTo(x - dir * 0.48 * u, by - 0.12 * u);
    ctx.quadraticCurveTo(x - dir * 0.78 * u, by - 0.3 * u, x - dir * 0.72 * u, by - 0.58 * u);
  }
  ctx.stroke();
  if (!lying) {
    // Four legs: the far pair a shade darker, then the near pair.
    for (const [lx, c] of [[0.3, shade], [-0.36, shade], [0.4, coat], [-0.26, coat]] as const) {
      ctx.fillStyle = c;
      roundRectPath(ctx, x + dir * lx * u - 0.065 * u, by, 0.13 * u, y - by, 0.05 * u);
      ctx.fill();
    }
  } else {
    // The front paws, out in front under the chin.
    ctx.fillStyle = coat;
    roundRectPath(ctx, Math.min(x + dir * 0.35 * u, x + dir * 0.85 * u), y - 0.1 * u, 0.5 * u, 0.1 * u, 0.05 * u);
    ctx.fill();
  }
  // The body.
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(x, by, 0.55 * u, lying ? 0.22 * u : 0.27 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  outline();
  // The neck, joining the body to the head.
  if (!lying) {
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(x + dir * 0.3 * u, by - 0.18 * u);
    ctx.lineTo(hx - dir * 0.1 * u, hy - 0.05 * u);
    ctx.lineTo(hx + dir * 0.05 * u, hy + 0.15 * u);
    ctx.lineTo(x + dir * 0.48 * u, by + 0.05 * u);
    ctx.closePath();
    ctx.fill();
  }
  // The head and the muzzle, the nose at its tip.
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.arc(hx, hy, 0.2 * u, 0, Math.PI * 2);
  ctx.fill();
  outline();
  const mx = hx + dir * 0.24 * u;
  const my = hy + 0.06 * u;
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(mx, my, 0.16 * u, 0.09 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  outline();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(mx + dir * 0.14 * u, my - 0.02 * u, Math.max(1, 0.045 * u), 0, Math.PI * 2);
  ctx.fill();
  // The ears: a floppy one hanging at the back of the head, or a pointed one standing up.
  ctx.fillStyle = shade;
  ctx.beginPath();
  if (look.floppy) {
    ctx.ellipse(hx - dir * 0.08 * u, hy + 0.05 * u, 0.08 * u, 0.17 * u, dir * 0.25, 0, Math.PI * 2);
  } else {
    ctx.moveTo(hx - dir * 0.15 * u, hy - 0.1 * u);
    ctx.lineTo(hx - dir * 0.06 * u, hy - 0.42 * u);
    ctx.lineTo(hx + dir * 0.04 * u, hy - 0.14 * u);
    ctx.closePath();
  }
  ctx.fill();
  // The eye, open, or closed in a nap.
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  if (lying) {
    ctx.lineWidth = Math.max(1, 0.03 * u);
    ctx.beginPath();
    ctx.moveTo(hx + dir * 0.02 * u, hy - 0.04 * u);
    ctx.lineTo(hx + dir * 0.12 * u, hy - 0.04 * u);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(hx + dir * 0.08 * u, hy - 0.05 * u, Math.max(0.8, 0.035 * u), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A crew member, an adult (the head about a seventh of the height): shoes, trousers, a shirt in the page's teal, arms,
 * the head and hair; (x, y) is where the feet stand, `h` the height. With `broom`, a broom in the leading hand.
 */
function drawVCrew(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, dir: 1 | -1, broom: boolean): void {
  const legW = h * 0.085;
  ctx.fillStyle = '#2E3A46';
  roundRectPath(ctx, x - legW * 1.2, y - h * 0.47, legW, h * 0.47, legW * 0.4);
  ctx.fill();
  roundRectPath(ctx, x + legW * 0.2, y - h * 0.47, legW, h * 0.47, legW * 0.4);
  ctx.fill();
  ctx.fillStyle = '#1C232B';
  roundRectPath(ctx, x - legW * 1.4, y - h * 0.035, legW * 1.4, h * 0.035, h * 0.015);
  ctx.fill();
  roundRectPath(ctx, x + legW * 0.1, y - h * 0.035, legW * 1.4, h * 0.035, h * 0.015);
  ctx.fill();
  const torsoTop = y - h * 0.82;
  ctx.fillStyle = '#1F7A8C';
  roundRectPath(ctx, x - h * 0.14, torsoTop, h * 0.28, h * 0.38, h * 0.06);
  ctx.fill();
  ctx.strokeStyle = '#1F7A8C';
  ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.06;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.12, torsoTop + h * 0.05);
  ctx.lineTo(x - h * 0.16, torsoTop + h * 0.3);
  ctx.moveTo(x + h * 0.12, torsoTop + h * 0.05);
  ctx.lineTo(x + h * 0.16 * (broom ? 1.3 : 1), torsoTop + h * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#E2B58F';
  ctx.beginPath();
  ctx.arc(x, torsoTop - h * 0.075, h * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5A3A26';
  ctx.beginPath();
  ctx.arc(x - dir * h * 0.01, torsoTop - h * 0.095, h * 0.07, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  if (broom) {
    const hx = x + h * 0.2;
    const hy = torsoTop + h * 0.32;
    ctx.strokeStyle = '#8A6A46';
    ctx.lineWidth = Math.max(1.5, h * 0.025);
    ctx.beginPath();
    ctx.moveTo(hx - h * 0.05, hy - h * 0.15);
    ctx.lineTo(hx + h * 0.12, y - h * 0.03);
    ctx.stroke();
    ctx.fillStyle = '#C9A15A';
    roundRectPath(ctx, hx + h * 0.04, y - h * 0.06, h * 0.18, h * 0.06, h * 0.02);
    ctx.fill();
  }
}

/** The GM's orb in code: a dark sphere with one amber band and a soft shadow under it. */
function drawVOrb(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, tokens: Tokens): void {
  ctx.fillStyle = 'rgba(19, 33, 47, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 1.55, r * 0.8, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#5B6670');
  g.addColorStop(1, '#23292F');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tokens.amber;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.05, r * 0.98, r * 0.24, 0, 0, Math.PI);
  ctx.stroke();
}

/** The vector frame: the head band (the orb, its label and the chips), the yard, the path in front of it. */
function drawVectorReplay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReplayFrame,
  options: ReplayOptions,
): void {
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.setLineDash([]);
  ctx.clearRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;
  const tokens = readTokens(options.fonts);
  const L = vectorLayout(width, height);
  drawVectorYard(ctx, frame, L, options, tokens);

  // The GM at the head's left with its label; the block's events at its right (none once the week is over).
  const r = L.fs * 0.95;
  const ocx = L.head.x + r;
  const ocy = L.head.y + r + 2;
  drawVOrb(ctx, ocx, ocy, r, tokens);
  const labelH = Math.round(L.fs * 1.85);
  ctx.font = uiFont(tokens, L.fs, 800);
  const labelW = ctx.measureText('The GM').width + L.fs * 1.9;
  const lx = ocx + r + L.fs * 1.2;
  drawGmLabel(ctx, tokens, L.fs, { x: lx, y: ocy - labelH / 2, w: labelW, h: labelH, lineFrom: ocx + r + 3, lineTo: lx });
  if (options.gm !== 'done') {
    const captions = frame.closed && !frame.captions.some((c) => /closed/i.test(c)) ? ['Closed', ...frame.captions] : frame.captions;
    const left = lx + labelW + L.fs;
    drawChips(ctx, tokens, L.fs, L.head.x + L.head.w, L.head.y, Math.max(L.fs * 8, L.head.x + L.head.w - left), captions);
  }
}

/** The yard's cells: a grid sized for the most figures it ever holds, in a fixed scattered order. */
interface Cells {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  order: number[];
}
function cellsFor(inner: Box, capacity: number): Cells {
  const cap = Math.max(1, capacity);
  // Cells about 1.5 times as wide as tall: a dog in profile is long.
  const cols = Math.max(1, Math.round(Math.sqrt((cap * inner.w) / (1.5 * Math.max(1, inner.h)))));
  const rows = Math.max(1, Math.ceil(cap / cols));
  const order = Array.from({ length: cols * rows }, (_, c) => c).sort((a, b) => hash01(a + 7919) - hash01(b + 7919));
  return { cols, rows, cw: inner.w / cols, ch: inner.h / rows, order };
}
/** A dog's body length for these cells (its whole profile, head to tail, is about 1.9 of it), and a staffer's height:
 * an adult about 1.9 times a standing dog. */
const vUnit = (cells: Cells): number => Math.max(4, Math.min(cells.cw / 2.25, cells.ch / 1.6));
const vCrewH = (u: number, cells: Cells): number => Math.min(u * 2.4, cells.ch * 1.85);

/** The feet of whoever stands in cell `slot`: the cell's lower middle, jittered a little inside it (by `n`). */
function cellFeet(cells: Cells, inner: Box, slot: number, n: number): { x: number; y: number } {
  const col = slot % cells.cols;
  const row = Math.floor(slot / cells.cols);
  return {
    x: inner.x + (col + 0.5 + (hash01(n * 2 + 101) - 0.5) * 0.15) * cells.cw,
    y: inner.y + (row + 0.95 - hash01(n * 2 + 202) * 0.05) * cells.ch,
  };
}

function drawVectorYard(ctx: CanvasRenderingContext2D, frame: ReplayFrame, L: Layout, options: ReplayOptions, tokens: Tokens): void {
  const { colors } = options;
  const { yard, path, fs } = L;
  // The lawn, a rail fence on posts round it, and the path along its front.
  ctx.fillStyle = colors.grass;
  roundRectPath(ctx, yard.x, yard.y, yard.w, yard.h, fs * 0.3);
  ctx.fill();
  ctx.fillStyle = '#E3D5B8';
  ctx.fillRect(path.x, path.y + path.h * 0.3, path.w, path.h * 0.7);
  ctx.fillStyle = 'rgba(19, 33, 47, 0.12)';
  ctx.fillRect(path.x, path.y + path.h * 0.3, path.w, Math.max(1, fs * 0.08));
  for (let jx = path.x + fs * 2.6; jx < path.x + path.w; jx += fs * 2.6) ctx.fillRect(jx, path.y + path.h * 0.3, 1, path.h * 0.7);
  const fw = Math.max(2, fs * 0.16);
  ctx.strokeStyle = colors.fence;
  ctx.lineWidth = fw;
  roundRectPath(ctx, yard.x + fw / 2, yard.y + fw / 2, yard.w - fw, yard.h - fw, fs * 0.25);
  ctx.stroke();
  ctx.fillStyle = colors.fence;
  const post = fw * 1.8;
  const nx = Math.max(1, Math.round(yard.w / (fs * 2.6)));
  for (let i = 0; i <= nx; i++) {
    const px = yard.x + ((yard.w - post) * i) / nx;
    ctx.fillRect(px, yard.y, post, post);
    ctx.fillRect(px, yard.y + yard.h - post, post, post);
  }

  const inset = fw + fs * 0.4;
  const inner: Box = { x: yard.x + inset, y: yard.y + inset, w: yard.w - 2 * inset, h: yard.h - 2 * inset };
  if (inner.w > 4 && inner.h > 4) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(yard.x, yard.y, yard.w, yard.h);
    ctx.clip();
    if (frame.closed || frame.activity === null) drawClosedSign(ctx, inner, fs, colors, tokens);
    else if (frame.activity === 'clean') drawVClean(ctx, frame, inner, tokens, options);
    else drawVFloor(ctx, frame, inner, tokens, options);
    ctx.restore();
  }
  // A walk's group on the path: the staffer leading, the dogs following in single file.
  if (frame.walkingStaff > 0) {
    const n = frame.walkingDogs;
    // The staffer no taller than the path, so the group stays on it.
    const u = Math.min((path.h * 0.9) / 2.4, (path.w - fs * 4) / Math.max(1, n * 2.2 + 1.6));
    const feet = path.y + path.h * 0.92;
    const step = u * 2.2;
    const x0 = path.x + (path.w - (n * step + u * 1.2)) / 2;
    drawVCrew(ctx, x0 + u * 0.4, feet, u * 2.4, -1, false);
    for (let k = 0; k < n; k++) {
      const look = dogLookOf(frame.floorDogs + k);
      drawVDog(ctx, x0 + u * 1.9 + k * step, feet, u * Math.min(1, look.size), -1, look, tokens.ink, false);
    }
  }
}

/** Free play, a nap, structured play and the floor a walk leaves: every dog and staffer in a cell of its own. */
function drawVFloor(ctx: CanvasRenderingContext2D, frame: ReplayFrame, inner: Box, tokens: Tokens, options: ReplayOptions): void {
  const staff = frame.floorStaff;
  const cells = cellsFor(inner, Math.max(options.gaugeMax, frame.dogs) + 2 * Math.max(3, frame.staff));
  const u = vUnit(cells);
  const lying = frame.activity === 'nap';
  const structured = frame.activity === 'structuredPlay';
  const figs: { x: number; y: number; draw: () => void }[] = [];
  // The crew first: a staffer is taller than a cell, so each takes a cell below the top row and the one above it.
  // The dogs take the free cells in the scattered order; in structured play every dog faces the nearest staffer.
  const taken = new Set<number>();
  const crewAt: { x: number; y: number }[] = [];
  for (const slot of cells.order) {
    if (crewAt.length >= staff) break;
    if (slot < cells.cols || taken.has(slot) || taken.has(slot - cells.cols)) continue;
    taken.add(slot);
    taken.add(slot - cells.cols);
    const k = crewAt.length;
    const p = cellFeet(cells, inner, slot, k);
    crewAt.push(p);
    figs.push({ ...p, draw: () => drawVCrew(ctx, p.x, p.y, vCrewH(u, cells), k % 2 === 0 ? 1 : -1, false) });
  }
  const free = cells.order.filter((slot) => !taken.has(slot));
  for (let i = 0; i < frame.floorDogs; i++) {
    const p = cellFeet(cells, inner, free[i % Math.max(1, free.length)] ?? i, staff + i);
    let dir = dirOf(i);
    if (structured && crewAt.length > 0) {
      const near = crewAt.reduce((a, c) => (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) < Math.abs(a.x - p.x) + Math.abs(a.y - p.y) ? c : a));
      dir = near.x >= p.x ? 1 : -1;
    }
    const look = dogLookOf(i);
    // Centred on its cell: a dog in profile reaches further forward (the head) than back (the tail).
    const du = u * look.size;
    figs.push({ ...p, draw: () => drawVDog(ctx, p.x - dir * 0.15 * du, p.y, du, dir, look, tokens.ink, lying) });
  }
  figs.sort((a, b) => a.y - b.y);
  for (const f of figs) f.draw();
}

/** A clean: the dogs settled in a row of crates along the left, the crew sweeping the open floor. */
function drawVClean(ctx: CanvasRenderingContext2D, frame: ReplayFrame, inner: Box, tokens: Tokens, options: ReplayOptions): void {
  const n = frame.floorDogs;
  const cells = cellsFor(inner, Math.max(options.gaugeMax, frame.dogs) + 3);
  let cs = Math.min(cells.cw, cells.ch) * 0.95;
  let perCol = Math.max(1, Math.floor(inner.h / cs));
  for (let i = 0; i < 40 && n > 0 && Math.ceil(n / perCol) * cs * 1.3 > inner.w * 0.62; i++) {
    cs *= 0.95;
    perCol = Math.max(1, Math.floor(inner.h / cs));
  }
  const cw = cs * 1.3;
  const colsUsed = n > 0 ? Math.ceil(n / perCol) : 0;
  for (let i = 0; i < n; i++) {
    const x = inner.x + Math.floor(i / perCol) * cw;
    const y = inner.y + (i % perCol) * cs;
    const gap = cs * 0.08;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x + gap, y + gap, cw - 2 * gap, cs - 2 * gap);
    const look = dogLookOf(i);
    drawVDog(ctx, x + cw / 2, y + cs - gap * 1.5, cs * 0.62 * look.size, dirOf(i), look, tokens.ink, true);
    ctx.strokeStyle = tokens.ink;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, cs * 0.03);
    ctx.strokeRect(x + gap, y + gap, cw - 2 * gap, cs - 2 * gap);
    ctx.beginPath();
    for (let b = 1; b <= 4; b++) {
      const bx = x + gap + ((cw - 2 * gap) * b) / 5;
      ctx.moveTo(bx, y + gap);
      ctx.lineTo(bx, y + cs - gap);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const openX = inner.x + colsUsed * cw + cs * 0.3;
  const openW = Math.max(1, inner.x + inner.w - openX);
  const staff = frame.floorStaff;
  const h = Math.min(vCrewH(vUnit(cells), cells), (openW / Math.max(1, staff)) * 1.6);
  for (let k = 0; k < staff; k++) drawVCrew(ctx, openX + (openW * (k + 0.5)) / Math.max(1, staff), inner.y + inner.h * 0.72, h, k % 2 === 0 ? 1 : -1, true);
}

/** A closed day: the lawn empty and a "Closed" sign on a post. */
function drawClosedSign(ctx: CanvasRenderingContext2D, inner: Box, fs: number, colors: ReplayColors, tokens: Tokens): void {
  const px = clamp(Math.min(inner.w / 6, inner.h / 4), fs, fs * 2.4);
  ctx.font = uiFont(tokens, px, 800);
  const textW = ctx.measureText('Closed').width;
  const boardW = Math.min(inner.w * 0.9, textW + px * 1.2);
  const boardH = px * 1.7;
  const cx = inner.x + inner.w / 2;
  const boardY = inner.y + inner.h / 2 - boardH * 0.8;
  ctx.fillStyle = colors.fence;
  ctx.fillRect(cx - px * 0.15, boardY + boardH * 0.5, px * 0.3, Math.min(inner.y + inner.h - boardY - boardH * 0.5, boardH * 1.4));
  ctx.fillStyle = tokens.ink;
  roundRectPath(ctx, cx - boardW / 2, boardY, boardW, boardH, px * 0.2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Closed', cx, boardY + boardH / 2);
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
/** Where a figure's anchor keeps away from a blocked footprint, and how tall a prop is taken to be for hiding. */
const BLOCK_PAD = 0.12;
const PROP_H = 2.0;
/**
 * The clone rule (round 1, finding 7): the same sprite in the same pose (mirrored or not) never stands within about
 * 150 CSS px of another at the 1366 × 768 yard, where the board is drawn at about 0.33 CSS px per image px; so the
 * distance is kept in image px and scales with the board.
 */
const CLONE_IMAGE_PX = 450;
/** The GM's hover over the roof, in metres between the orb's lowest point and its shadow (round 1, finding 27). */
const GM_HOVER_M = 0.32;
/** The shadow spec (gate 3) when set.json gives none, in the board image's pixels (2× the set's 1× numbers). */
const SHADOW_DEFAULT = { throw: [0.72, -0.184], blur: 3.2, alpha: 0.3, contactBlur: 5.2, contactAlpha: 0.42, tint: '12, 30, 18' } as const;

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
  /** The orb's opaque box in the image's pixels: left, top, right, bottom (the image also holds its hover gap). */
  orb: [number, number, number, number];
}

/** The shadow spec in the board image's pixels: the throw per px of height, blurs, alphas and the tint. */
interface ShadowSpec {
  throw: readonly [number, number];
  blur: number;
  alpha: number;
  contactBlur: number;
  contactAlpha: number;
  tint: string;
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
  /** The crew by person ('crew', 'crew2': different staff), then by pose. */
  crew: Map<string, Partial<Record<CrewPose, SpriteArt[]>>>;
  people: string[];
  /** Where the walking group stands: a strip on the set's own path, in world metres [x, y, w, h]. */
  walk: [number, number, number, number];
  shadow: ShadowSpec;
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
  const crew = new Map<string, Partial<Record<CrewPose, SpriteArt[]>>>();
  cast.sprites.forEach((src, i) => {
    const img = images[i] as HTMLImageElement;
    const shape = shapeOf(img, src, probe);
    const art: SpriteArt = { src, img, shape, mirrored: mirrorShape(shape) };
    const [map, key] = src.kind === 'dog' ? [dogs, `${src.breed ?? 'dog'}|${src.coat ?? ''}`] : [crew, src.id.split('-')[0] ?? 'crew'];
    const poses = (map.get(key) ?? {}) as Record<string, SpriteArt[] | undefined>;
    (poses[src.pose] ??= []).push(art);
    map.set(key, poses);
  });
  if (dogs.size === 0 || crew.size === 0) throw new Error('replay: the cast needs a dog and the crew');
  const gm = {
    ready: gmArt(ready, set.gm.ready, probe),
    running: gmArt(running, set.gm.running, probe),
    done: gmArt(done, set.gm.done, probe),
  };
  const lx = set.board.map.lawn[0];
  const s = set.shadow;
  return {
    board,
    boardSize: set.board.size,
    map: set.board.map,
    gm,
    gmSpot: set.gmSpot,
    dogs,
    identities: [...dogs.keys()].sort(),
    crew,
    people: [...crew.keys()].sort(),
    // Without a strip in set.json, a band just outside the lawn's front-right edge.
    walk: Array.isArray(set.walk) && set.walk.length === 4 ? set.walk : [0.4, -0.65, lx - 0.4, 0.3],
    shadow:
      s === undefined
        ? SHADOW_DEFAULT
        : { throw: s.throw, blur: s.blur * 2, alpha: s.alpha, contactBlur: s.contactBlur * 2, contactAlpha: s.contactAlpha, tint: s.tint.join(', ') },
  };
}

/** The GM in a state, and its orb's opaque box measured on its pixels. */
function gmArt(img: HTMLImageElement, spec: { size: [number, number]; anchor: [number, number] }, probe: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }): GmArt {
  const w = img.naturalWidth || spec.size[0];
  const h = img.naturalHeight || spec.size[1];
  probe.canvas.width = w;
  probe.canvas.height = h;
  probe.ctx.clearRect(0, 0, w, h);
  probe.ctx.drawImage(img, 0, 0);
  const data = probe.ctx.getImageData(0, 0, w, h).data;
  let [x0, y0, x1, y1] = [w, h, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + 3] ?? 0) < ALPHA_SOLID) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
  }
  const k = spec.size[0] / w;
  const orb: [number, number, number, number] = x1 > x0 ? [x0 * k, y0 * k, x1 * k, y1 * k] : [0, 0, spec.size[0], spec.size[1]];
  return { img, size: spec.size, anchor: spec.anchor, orb };
}

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
  /** The GM's hover over the roof, in image px between its orb's lowest point and gmSpot. */
  hoverImg: number;
  fs: number;
  pad: number;
  tokens: Tokens;
  /** The board, at this size. */
  layer: HTMLCanvasElement;
  /** The GM orb's box (any state, as it hovers) and its label's, in CSS px; figures keep clear of both. */
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
  /** The stage's preparation while it runs (startWarm), and whether it has finished. */
  warmWork: Generator<void, void, void> | null;
  warm: boolean;
}

/** The stages made lately, by size (the page shows the yard at a few sizes: on load, while the week plays, after it). */
const stages = new Map<string, Stage>();
const STAGES_KEPT = 3;
/**
 * The days' arrangements, by day, dogs and staff, in world metres: the same at every size of the yard, so the week
 * keeps its places when the page shows it smaller after the week; and those begun in idle time, not finished yet.
 */
const plans = new Map<string, DayPlan>();
const pendingPlans = new Map<string, Generator<void, DayPlan, void>>();
let pendingSize: { width: number; height: number; ratio: number } | null = null;
let warmTimer: ReturnType<typeof setTimeout> | null = null;

const stageKey = (width: number, height: number, ratio: number): string => `${Math.round(width)}|${Math.round(height)}|${ratio}`;

/** The default week's Monday (config requests.day1, one staffer): arranged while the page is idle, which also warms
 * the placer's code, so a Round 1 week's first frame only draws. Any other Monday is arranged when it comes. */
const WARM_DAY = { dogs: 20, staff: 1 } as const;

/**
 * Prepares the yard at the size the page last drew its placeholder at, in idle time (see startWarm), so the week's
 * first frame only draws.
 */
function warmUp(art: ArtSet): void {
  const size = pendingSize;
  if (size === null || warmTimer !== null || !(size.width > 0 && size.height > 0)) return;
  const known = stages.get(stageKey(size.width, size.height, size.ratio));
  if (known !== undefined && known.art === art && (known.warm || known.warmWork !== null)) return;
  warmTimer = setTimeout(() => {
    warmTimer = null;
    startWarm(stageFor(size.width, size.height, size.ratio, art));
  }, 0);
}

/**
 * Starts the stage's preparation in idle time, most needed first: the GM in its three states; the default Monday's
 * arrangement; the looks that Monday shows; then every other look of the cast (each sprite and its shadow, as drawn
 * and mirrored). A getting-ready redraw also advances it a little (advanceWarm), in case the browser has no idle time.
 */
function startWarm(s: Stage): void {
  if (s.warm || s.warmWork !== null) return;
  const work = prepare(s);
  s.warmWork = work;
  idle(s, work, () => s.warmWork === work, () => {
    s.warmWork = null;
    s.warm = true;
  });
}

function* prepare(s: Stage): Generator<void, void, void> {
  for (const state of ['ready', 'running', 'done'] as const) gmDrawn(s, state);
  yield;
  const key = `0|${WARM_DAY.dogs}|${WARM_DAY.staff}`;
  if (!plans.has(key)) {
    const gen = pendingPlans.get(key) ?? daySteps(s, 0, WARM_DAY.dogs, WARM_DAY.staff);
    pendingPlans.set(key, gen);
    // A frame may finish it first (dayPlan); then the next step reports done at once.
    for (let r = gen.next(); r.done !== true; r = gen.next()) yield;
    pendingPlans.delete(key);
  }
  const plan = plans.get(key);
  if (plan !== undefined) {
    for (const [k, c] of plan.crew.entries()) drawnOf(s, crewLook(s.art, personOf(s.art, k), crewPose('free', k), c.facing));
    for (const d of plan.dogs) {
      drawnOf(s, dogLook(s.art, d.id, d.play, d.facing));
      yield;
    }
  }
  for (const look of allLooks(s.art)) {
    drawnOf(s, look);
    yield;
  }
}

/** Advances the stage's preparation for up to `ms` milliseconds now. */
function advanceWarm(s: Stage, ms: number): void {
  const work = s.warmWork;
  if (work === null) return;
  const t0 = performance.now();
  let r = work.next();
  while (r.done !== true && performance.now() - t0 < ms) r = work.next();
  if (r.done === true && s.warmWork === work) {
    s.warmWork = null;
    s.warm = true;
  }
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
  if (plans.has(key) || pendingPlans.has(key)) return;
  const gen = daySteps(s, day, dogs, staff);
  pendingPlans.set(key, gen);
  idle(s, gen, () => pendingPlans.get(key) === gen, () => pendingPlans.delete(key));
}

/**
 * Runs `work` a little at a time in the browser's idle time (a few milliseconds a slice, between frames), so it never
 * holds up a frame, while the stage is kept and `wanted` holds; `done` when it finishes.
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
    if (stages.get(s.key) !== s || !wanted()) return; // finished elsewhere, or the stage was dropped
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
  const known = stages.get(key);
  if (known !== undefined && known.art === art) return known;
  const map = art.map;
  const [bw, bh] = art.boardSize;
  const P = map.ppm;
  const exImg: [number, number] = [(2 / Math.sqrt(5)) * P, (-1 / Math.sqrt(5)) * P];
  const eyImg: [number, number] = [(-2 / Math.sqrt(5)) * P, (-1 / Math.sqrt(5)) * P];
  // One scale in every state (round 1, finding 19): the board image fitted to the canvas exactly as the page's CSS fits
  // it behind the canvas while the GM is idle or getting ready (`center / contain`), so the yard never jumps.
  const k = Math.max(0.01, Math.min(width / bw, height / bh));
  const bx = (width - bw * k) / 2;
  const by = (height - bh * k) / 2;
  const pad = Math.max(10, Math.min(width, height) * 0.02);
  const fs = clamp(Math.round(width / 52), MIN_LABEL_PX, 22);
  const origin: [number, number] = [bx + map.origin[0] * k, by + map.origin[1] * k];
  const el = (CAMERA.elevationDeg * Math.PI) / 180;
  const groundLen = Math.hypot(Math.SQRT1_2, Math.SQRT1_2 * Math.sin(el));
  const hpmImg = (P * Math.cos(el)) / groundLen; // image px per metre of height
  const tokens = readTokens(undefined);

  // The GM (round 1, finding 27): its orb's lowest point GM_HOVER_M over the roof at gmSpot, its shadow under its
  // centre; the box it may take in any state, with room for its hover.
  const hoverImg = GM_HOVER_M * hpmImg;
  const [gx, gy] = [bx + art.gmSpot[0] * k, by + art.gmSpot[1] * k];
  let ox0 = Infinity;
  let oy0 = Infinity;
  let ox1 = -Infinity;
  for (const g of Object.values(art.gm)) {
    ox0 = Math.min(ox0, gx + (g.orb[0] - g.anchor[0]) * k);
    ox1 = Math.max(ox1, gx + (g.orb[2] - g.anchor[0]) * k);
    oy0 = Math.min(oy0, gy - (hoverImg + g.orb[3] - g.orb[1]) * k);
  }
  const orb: Box = { x: ox0, y: oy0 - 4, w: ox1 - ox0, h: gy - oy0 + 4 };
  const run = art.gm.running;
  const orbMidY = gy - (hoverImg + (run.orb[3] - run.orb[1]) / 2) * k;

  // "The GM" on a pill beside the orb, on the side with room.
  const probe = newCanvas(1, 1);
  probe.ctx.font = uiFont(tokens, fs, 800);
  const labelW = probe.ctx.measureText('The GM').width + fs * 1.9;
  const labelH = Math.round(fs * 1.85);
  const lead = fs * 1.6;
  const onRight = ox1 + lead + labelW <= width - pad;
  const lx = onRight ? ox1 + lead : Math.max(pad, ox0 - lead - labelW);
  const label = {
    x: lx,
    y: clamp(orbMidY - labelH / 2, pad, height - pad - labelH),
    w: labelW,
    h: labelH,
    lineFrom: onRight ? ox1 + 3 : ox0 - 3,
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
    hpm: hpmImg * k,
    hoverImg,
    fs,
    pad,
    tokens,
    layer: newCanvas(width * ratio, height * ratio).canvas,
    orb,
    label,
    // The block's events go in the top right corner, the empty sky above the far fence (the clubhouse is top left).
    chips: { x: width * 0.42, y: 0, w: width * 0.58, h: pad + 2 * Math.round(fs * 1.95) + fs * 0.4 },
    props: [],
    propHulls: [],
    drawn: new Map(),
    gmShadow: null,
    warmWork: null,
    warm: false,
  };
  s.props = map.blocked.map(([rx, ry, rw, rh]) => {
    const corners = [ground(s, rx, ry), ground(s, rx + rw, ry), ground(s, rx + rw, ry + rh), ground(s, rx, ry + rh)];
    return { corners, x0: Math.min(...corners.map((c) => c[0])), x1: Math.max(...corners.map((c) => c[0])) };
  });
  const lift = PROP_H * s.hpm;
  s.propHulls = s.props.map(({ corners }) => hull([...corners, ...corners.map(([x, y]): [number, number] => [x, y - lift])]));
  paintLayer(s);
  stages.delete(key);
  stages.set(key, s);
  while (stages.size > STAGES_KEPT) stages.delete(stages.keys().next().value as string);
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

let boardHalf: { art: ArtSet; canvas: HTMLCanvasElement } | null = null;

/** The static layer: the board (with its own front path, where a walk goes). */
function paintLayer(s: Stage): void {
  const { art, ratio, k } = s;
  const ctx = s.layer.getContext('2d');
  if (ctx === null) throw new Error('replay: no 2D context for the yard cache');
  const [bw, bh] = art.boardSize;
  const nw = art.board.naturalWidth || bw;
  const nh = art.board.naturalHeight || bh;
  const target = bw * k * ratio; // device px wide
  // Most sizes draw the board at under half its pixels: they start from a half-size copy made once.
  if (target * 2 <= nw) {
    if (boardHalf === null || boardHalf.art !== art) boardHalf = { art, canvas: scaled(art.board, nw, nh, 0.5, false) };
    const half = boardHalf.canvas;
    ctx.drawImage(scaled(half, half.width, half.height, target / half.width, false), Math.round(s.bx * ratio), Math.round(s.by * ratio));
    return;
  }
  ctx.drawImage(scaled(art.board, nw, nh, target / nw, false), Math.round(s.bx * ratio), Math.round(s.by * ratio));
}

/** A look at this stage's size: the sprite scaled (and mirrored), its anchor, and its shadow. Made once, then reused. */
/** Draws a pre-rendered canvas with its anchor (ax, ay) at device point (x, y): pixel for pixel, or scaled. */
function blit(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, ax: number, ay: number, scale: number): void {
  if (scale === 1) ctx.drawImage(img, Math.round(x - ax), Math.round(y - ay));
  else ctx.drawImage(img, x - ax * scale, y - ay * scale, img.width * scale, img.height * scale);
}

const lookKey = (look: Look): string => `${look.art.src.id}|${look.mirror ? 'm' : ''}`;

/**
 * A look for a frame: this stage's own, or, when the page has just shown the yard at a new size (the scorecard's, after
 * the week) and this stage has not made it yet, another stage's scaled to this one, while this stage makes its own in
 * idle time: so a change of size never holds up a frame.
 */
function drawnFor(s: Stage, look: Look): { d: Drawn; scale: number } {
  const key = lookKey(look);
  const own = s.drawn.get(key);
  if (own !== undefined) return { d: own, scale: 1 };
  for (const other of stages.values()) {
    const d = other === s || other.art !== s.art ? undefined : other.drawn.get(key);
    if (d === undefined) continue;
    startWarm(s);
    return { d, scale: (s.k * s.ratio) / (other.k * other.ratio) };
  }
  return { d: drawnOf(s, look), scale: 1 };
}

function drawnOf(s: Stage, look: Look): Drawn {
  const key = lookKey(look);
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
  const shadow = castShadow(canvas, ax, ay, f, s.art.shadow);
  const drawn: Drawn = { img: canvas, ax, ay, shadow: shadow.canvas, sx: shadow.ax, sy: shadow.ay };
  s.drawn.set(key, drawn);
  return drawn;
}

/**
 * The contact shadow (gate 3, one spec for every figure, set.json's): the sprite's silhouette thrown along the key
 * light (a point h px up lands h × throw[0] to the right and h × throw[1] down), blurred and tinted as the set's own
 * shadows, under a soft contact ellipse at the feet. `f` is device px per image px. Without canvas filters the two
 * are drawn unblurred.
 */
function castShadow(sprite: HTMLCanvasElement, ax: number, ay: number, f: number, spec: ShadowSpec): { canvas: HTMLCanvasElement | null; ax: number; ay: number } {
  const w = sprite.width;
  const h = sprite.height;
  const [A, B] = spec.throw;
  const blur = spec.contactBlur * f;
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
  sil.ctx.fillStyle = `rgb(${spec.tint})`;
  sil.ctx.fillRect(0, 0, W, H);
  const out = newCanvas(W, H);
  const filters = typeof out.ctx.filter === 'string';
  if (filters) out.ctx.filter = `blur(${(spec.blur * f).toFixed(2)}px)`;
  out.ctx.globalAlpha = spec.alpha;
  out.ctx.drawImage(sil.canvas, 0, 0);
  if (filters) out.ctx.filter = `blur(${blur.toFixed(2)}px)`;
  out.ctx.globalAlpha = spec.contactAlpha;
  out.ctx.fillStyle = `rgb(${spec.tint})`;
  out.ctx.beginPath();
  out.ctx.ellipse(sx + ecx, sy - f, erx, ery, 0, 0, Math.PI * 2);
  out.ctx.fill();
  return { canvas: out.canvas, ax: sx, ay: sy };
}

/**
 * The GM in a state at this stage's size, its anchor moved up to the point it hovers over: the orb's lowest point is
 * hoverImg above gmSpot (no cast shadow: it hovers; its shadow is a soft disc on the roof, under its centre).
 */
function gmDrawn(s: Stage, state: GmState): Drawn {
  const key = `gm|${state}`;
  const cached = s.drawn.get(key);
  if (cached !== undefined) return cached;
  const g = s.art.gm[state];
  const f = s.k * s.ratio;
  const nw = g.img.naturalWidth || g.size[0];
  const nh = g.img.naturalHeight || g.size[1];
  const canvas = scaled(g.img, nw, nh, (g.size[0] * f) / nw, false);
  const ax = ((g.orb[0] + g.orb[2]) / 2) * (canvas.width / g.size[0]);
  const drawn: Drawn = { img: canvas, ax, ay: (g.orb[3] + s.hoverImg) * (canvas.height / g.size[1]), shadow: null, sx: 0, sy: 0 };
  s.drawn.set(key, drawn);
  if (s.gmShadow === null) {
    const spec = s.art.shadow;
    const rx = (g.orb[2] - g.orb[0]) * f * 0.4;
    const ry = rx * 0.45; // a disc on the flat roof, foreshortened by the camera
    const blur = spec.contactBlur * f;
    const c = newCanvas(rx * 2 + blur * 6, ry * 2 + blur * 6);
    if (typeof c.ctx.filter === 'string') c.ctx.filter = `blur(${blur.toFixed(2)}px)`;
    c.ctx.fillStyle = `rgba(${spec.tint}, ${spec.contactAlpha * 0.85})`;
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
  more: Map<string, { look: Look; mx: number; my: number }[]>;
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
/** The walking group's strip on the set's own path (set.json's walk), where their anchors stand. */
const pathRegion = (s: Stage): Region => {
  const [x, y, w, h] = s.art.walk;
  return { x0: x, x1: x + w, y0: y, y1: y + h, path: true };
};
/** The path's whole width around the strip (where feet and shadows may fall): set.json's path runs y from -1 to 0. */
const pathGround = (s: Stage): Region => {
  const [x, y, w, h] = s.art.walk;
  return { x0: x - 0.4, x1: x + w + 0.3, y0: y - 0.35, y1: Math.min(0, y + h + 0.35), path: true };
};

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

/** Staffer k's person: the cast's staff in turn ('crew', 'crew2'), so two staffers on the floor are two people. */
const personOf = (art: ArtSet, k: number): string => art.people[k % art.people.length] ?? 'crew';

/**
 * Staffer k's pose in an activity (round 1, finding 7): chosen so no two staffers are the same sprite in the same pose
 * (the third staffer is the first person again, in another pose).
 */
const CREW_POSES: Readonly<Record<'free' | 'nap' | 'structured' | 'clean', readonly CrewPose[]>> = {
  free: ['ball', 'leash', 'leash'],
  nap: ['leash', 'leash', 'ball'],
  structured: ['ball', 'ball', 'leash'],
  clean: ['mop', 'mop', 'leash'],
};
const crewPose = (activity: keyof typeof CREW_POSES, k: number): CrewPose => CREW_POSES[activity][k % 3] ?? 'leash';

function crewLook(art: ArtSet, person: string, pose: CrewPose, facing: Facing): Look {
  const poses = art.crew.get(person) ?? (art.crew.values().next().value as Partial<Record<CrewPose, SpriteArt[]>>);
  for (const p of CREW_FALLBACK[pose]) {
    const list = poses[p];
    if (list !== undefined && list.length > 0) return faceLook(list, facing);
  }
  const any = Object.values(poses).find((l) => l !== undefined && l.length > 0) as SpriteArt[];
  return faceLook(any, facing);
}

/** The clone rule's key: the sprite in its pose, whichever way it faces. */
const cloneKey = (look: Look): string => look.art.src.id;

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
      const g = pathGround(s);
      if (mx < g.x0 || mx > g.x1 || my < g.y0 || my > g.y1) return false;
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
  const cloneR2 = (CLONE_IMAGE_PX * s.k) ** 2; // on screen, CSS px

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
      if (item.clone !== '' && q.clone === item.clone && (q.x - x) ** 2 + (q.y - y) ** 2 < cloneR2) clones += 1;
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
  const cached = plans.get(key);
  if (cached !== undefined) return cached;
  // Started ahead of time and not done yet: finish it here rather than start again.
  const started = pendingPlans.get(key);
  pendingPlans.delete(key);
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
  // A breed and coat the day deals twice plays in the other pose the second time, so no two dogs are the same sprite
  // in free play (round 1, finding 7); a dog dealt once moves or sits by chance.
  const firstPose = new Map<string, DogPose>();
  const dogs: DogCard[] = Array.from({ length: dogCount }, (_, i) => {
    const id = ids[i] as string;
    const chance: DogPose = rand() < 0.62 ? 'moving' : 'sitting';
    const before = firstPose.get(id);
    const play: DogPose = before === undefined ? chance : before === 'moving' ? 'sitting' : 'moving';
    if (before === undefined) firstPose.set(id, play);
    return { id, facing: face(), play, mx: 0, my: 0 };
  });
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
      const look = crewLook(art, personOf(art, k), crewPose('free', k), c.facing);
      return { looks: [look], clone: cloneKey(look), region, target: [at[0] * lx, at[1] * ly] };
    }),
    ...dogs.map((d, i): Item => {
      const looks = (facings[i] as Facing[]).map((f) => dogLook(art, d.id, d.play, f));
      return { looks, clone: cloneKey(looks[0] as Look), region, target: null };
    }),
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
  plans.set(key, plan);
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
  if (cached !== undefined) return cached.map((c) => fig(s, c.look, c.mx, c.my));
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
    if (frame.floorStaff > 0) {
      const look = crewLook(art, personOf(art, g), crewPose('structured', g), g % 2 === 0 ? 'right' : 'left');
      items.push({ looks: [look], clone: cloneKey(look), region, target: [cx, cy] });
    }
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
      const look = dogLook(art, d.id, 'sitting', left ? 'right' : 'left');
      items.push({
        looks: [look],
        clone: cloneKey(look),
        region,
        target: [cx + sign * side[0] * dist + back[0] * depth, cy + sign * side[1] * dist + back[1] * depth],
      });
    }
  }
  const spots = placeAll(s, items, rand);
  const figs = spots.map((p, i) => fig(s, (items[i] as Item).looks[p.alt] as Look, p.mx, p.my));
  plan.more.set(key, figs.map(({ look, mx, my }) => ({ look, mx, my })));
  return figs;
}

/**
 * A clean: the crew with the mop on the open floor at the screen's left, the dogs settled out of the way at its right,
 * sitting or asleep.
 */
function cleaning(s: Stage, plan: DayPlan, frame: ReplayFrame): Fig[] {
  const key = `clean|${frame.floorDogs}|${frame.floorStaff}`;
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached.map((c) => fig(s, c.look, c.mx, c.my));
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
    const look = crewLook(art, personOf(art, k), crewPose('clean', k), (plan.crew[k] as CrewCard).facing);
    items.push({ looks: [look], clone: cloneKey(look), region: lawn, target: [at[0] * lx, at[1] * ly] });
  }
  for (let i = 0; i < frame.floorDogs; i++) {
    const d = plan.dogs[i] as DogCard;
    // As in free play, a breed and coat dealt twice rests in the other pose the second time.
    const pose: DogPose = d.play === 'moving' ? 'asleep' : 'sitting';
    const other: Facing = d.facing === 'right' ? 'left' : 'right';
    const looks = [dogLook(art, d.id, pose, d.facing), dogLook(art, d.id, pose, other)];
    items.push({ looks, clone: cloneKey(looks[0] as Look), region: right, target: null });
  }
  const spots = placeAll(s, items, rand);
  const figs = spots.map((p, i) => fig(s, (items[i] as Item).looks[p.alt] as Look, p.mx, p.my));
  plan.more.set(key, figs.map(({ look, mx, my }) => ({ look, mx, my })));
  return figs;
}

/**
 * A walk: the walking group on the set's own path (set.json's walk strip, along the lawn's front-right edge), the
 * staffer in front with the leash and the dogs behind in single file, all heading along the path toward the lawn's
 * front corner (the camera-facing diagonal down and left, so every sprite faces left); placed first, in formation. Then
 * the floor makes room for it: each dog and staffer left behind stands as near its free-play spot as it can without
 * crowding the group, so the group reads as its own.
 */
function walking(s: Stage, plan: DayPlan, frame: ReplayFrame): Fig[] {
  const key = `walk|${frame.floorDogs}|${frame.floorStaff}|${frame.walkingDogs}|${frame.walkingStaff}`;
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached.map((c) => fig(s, c.look, c.mx, c.my));
  const art = s.art;
  const rand = seeded(frame.day, frame.dogs, frame.staff, 4);
  const path = pathRegion(s);
  const mid = (path.y0 + path.y1) / 2;
  const group: Item[] = [];
  const walker = frame.staff - 1; // the staffer the walk takes off the floor
  if (frame.walkingStaff > 0) {
    const look = crewLook(art, personOf(art, walker), 'leash', 'left');
    group.push({ looks: [look], clone: cloneKey(look), region: path, target: [path.x0 + 0.25, mid] });
  }
  for (let j = 0; j < frame.walkingDogs; j++) {
    const d = plan.dogs[frame.floorDogs + j] as DogCard;
    const look = dogLook(art, d.id, 'moving', 'left');
    group.push({ looks: [look], clone: cloneKey(look), region: path, target: [path.x0 + 1.05 + j * 0.95, mid + (j % 2 === 0 ? -0.05 : 0.05)] });
  }
  const walkers = placeAll(s, group, rand);
  const lawn = lawnRegion(s);
  const floor: Item[] = [];
  for (let i = 0; i < frame.floorDogs; i++) {
    const d = plan.dogs[i] as DogCard;
    const look = dogLook(art, d.id, d.play, d.facing);
    floor.push({ looks: [look], clone: cloneKey(look), region: lawn, target: [d.mx, d.my] });
  }
  for (let k = 0; k < frame.floorStaff; k++) {
    const c = plan.crew[k] as CrewCard;
    const look = crewLook(art, personOf(art, k), crewPose('free', k), c.facing);
    floor.push({ looks: [look], clone: cloneKey(look), region: lawn, target: [c.mx, c.my] });
  }
  const stay = placeAll(s, floor, rand, walkers);
  const figs = [
    ...walkers.map((p, i) => fig(s, (group[i] as Item).looks[p.alt] as Look, p.mx, p.my)),
    ...stay.map((p, i) => fig(s, (floor[i] as Item).looks[p.alt] as Look, p.mx, p.my)),
  ];
  plan.more.set(key, figs.map(({ look, mx, my }) => ({ look, mx, my })));
  return figs;
}

/** A nap: every dog lies down as near its free-play spot as the room allows; the crew stay where they stood. */
function napping(s: Stage, plan: DayPlan, frame: ReplayFrame): Fig[] {
  const key = `nap|${frame.floorDogs}|${frame.floorStaff}`;
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached.map((c) => fig(s, c.look, c.mx, c.my));
  const art = s.art;
  const rand = seeded(frame.day, frame.dogs, frame.staff, 5);
  const region = lawnRegion(s);
  const items: Item[] = [];
  for (let k = 0; k < frame.floorStaff; k++) {
    const c = plan.crew[k] as CrewCard;
    const look = crewLook(art, personOf(art, k), crewPose('nap', k), c.facing);
    items.push({ looks: [look], clone: cloneKey(look), region, target: [c.mx, c.my] });
  }
  for (let i = 0; i < frame.floorDogs; i++) {
    const d = plan.dogs[i] as DogCard;
    const other: Facing = d.facing === 'right' ? 'left' : 'right';
    const looks = [dogLook(art, d.id, 'asleep', d.facing), dogLook(art, d.id, 'asleep', other)];
    items.push({ looks, clone: cloneKey(looks[0] as Look), region, target: [d.mx, d.my] });
  }
  const spots = placeAll(s, items, rand);
  const figs = spots.map((p, i) => fig(s, (items[i] as Item).looks[p.alt] as Look, p.mx, p.my));
  plan.more.set(key, figs.map(({ look, mx, my }) => ({ look, mx, my })));
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
    floor.push(fig(s, crewLook(art, personOf(art, k), crewPose('free', k), c.facing), c.mx, c.my));
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
  const hover = motion && state === 'running' ? Math.sin(((frame.day * 4 + frame.block + progress) / 8) * Math.PI * 2) * 2.5 * s.k * 2 : 0;
  drawGm(ctx, s, gm, hover);

  // The figures: every shadow first, so none falls across another figure, and only on the ground (the lawn and the
  // set's path: a shadow thrown past the fence would land on the page); then the figures back to front.
  const drawn = figs.map((f) => drawnFor(s, f.look));
  const [lx, ly] = s.art.map.lawn;
  const pg = pathGround(s);
  ctx.save();
  ctx.setTransform(R, 0, 0, R, 0, 0);
  ctx.beginPath();
  const quads: [number, number][][] = [
    [[0, 0], [lx, 0], [lx, ly], [0, ly]],
    [[pg.x0, pg.y0], [pg.x1, pg.y0], [pg.x1, pg.y1], [pg.x0, pg.y1]],
  ];
  for (const quad of quads) {
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
    const { d, scale } = drawn[i] as { d: Drawn; scale: number };
    if (d.shadow !== null) blit(ctx, d.shadow, f.x * R, f.y * R, d.sx, d.sy, scale);
  });
  ctx.restore();
  figs.forEach((f, i) => {
    const { d, scale } = drawn[i] as { d: Drawn; scale: number };
    blit(ctx, d.img, f.x * R, f.y * R, d.ax, d.ay, scale);
  });

  ctx.setTransform(R, 0, 0, R, 0, 0);
  drawGmLabel(ctx, tokens, s.fs, s.label);
  // The block's events while the week plays; none once it is over (round 1, finding 5: a stale event reads as current).
  if (state !== 'done') {
    const captions = frame.closed && !frame.captions.some((c) => /closed/i.test(c)) ? ['Closed', ...frame.captions] : frame.captions;
    drawChips(ctx, tokens, s.fs, s.width - s.pad, s.pad, s.chips.w - s.pad, captions);
  }
}

/** Development only (stripped from the build): how many pairs of figures overlap, and how many clone neighbours. */
function yardStats(s: Stage, figs: readonly Fig[]): { figures: number; overlaps: number; worst: number; clones: number } {
  const placed = figs.map((f) => placedOf(s, f, cloneKey(f.look)));
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
      if (a.clone !== '' && a.clone === b.clone && Math.hypot(a.x - b.x, a.y - b.y) < CLONE_IMAGE_PX * s.k) clones += 1;
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

/** The GM over the roof: its soft shadow at gmSpot, under the orb's centre, then the orb, `hover` CSS px off its place. */
function drawGm(ctx: CanvasRenderingContext2D, s: Stage, gm: Drawn, hover: number): void {
  const R = s.ratio;
  const [gx, gy] = [s.bx + s.art.gmSpot[0] * s.k, s.by + s.art.gmSpot[1] * s.k];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (s.gmShadow !== null) ctx.drawImage(s.gmShadow, Math.round(gx * R - s.gmShadow.width / 2), Math.round(gy * R - s.gmShadow.height / 2));
  ctx.drawImage(gm.img, Math.round(gx * R - gm.ax), Math.round((gy + hover) * R - gm.ay));
}

/** "The GM" on a navy pill with the amber light, a short line to the orb (Floor's callout). */
function drawGmLabel(ctx: CanvasRenderingContext2D, tokens: Tokens, fs: number, label: Stage['label']): void {
  const { x, y, w, h, lineFrom, lineTo } = label;
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
  circle(ctx, x + h * 0.52, mid, fs * 0.26);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = uiFont(tokens, fs, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('The GM', x + h * 0.52 + fs * 0.62, mid + fs * 0.04);
}

/** How a chip looks: the Incident chip is the badge (white on the danger red); the rest are white with a mark. */
function chipLook(caption: string, tokens: Tokens): { fill: string; ink: string; mark: string | null; warn: boolean } {
  if (caption === 'Incident') return { fill: tokens.danger, ink: '#FFFFFF', mark: null, warn: true };
  if (caption === 'Closed') return { fill: tokens.ink, ink: '#FFFFFF', mark: null, warn: false };
  if (caption.startsWith('Walk photo')) return { fill: tokens.surface, ink: tokens.ink, mark: tokens.ok, warn: false };
  if (caption.startsWith('The staffer')) return { fill: tokens.surface, ink: tokens.ink, mark: tokens.ink, warn: false };
  return { fill: tokens.surface, ink: tokens.ink, mark: tokens.amber, warn: false }; // money and sickness
}

/**
 * The block's events, as the frame words them, on chips under a "This block" label (round 1, finding 5: an event's
 * scope said), right-aligned in the top right corner with their right edge at `right`; a full row continues below.
 */
function drawChips(ctx: CanvasRenderingContext2D, tokens: Tokens, fs: number, right: number, top: number, maxW: number, captions: readonly string[]): void {
  if (captions.length === 0) return;
  const h = Math.round(fs * 1.95);
  const padX = fs * 0.7;
  const gap = fs * 0.4;
  ctx.font = uiFont(tokens, fs, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const LABEL = 'This block';
  // The items in reading order: the label, then each chip; rows filled left to right, then set flush right.
  const items = [{ text: LABEL, w: ctx.measureText(LABEL).width + fs * 0.2, chip: false }];
  for (const caption of captions) {
    const look = chipLook(caption, tokens);
    const lead = look.warn ? fs * 1.45 : look.mark !== null ? fs * 0.95 : 0;
    items.push({ text: caption, w: Math.min(maxW, ctx.measureText(caption).width + 2 * padX + lead), chip: true });
  }
  const rows: (typeof items)[] = [[]];
  let used = 0;
  for (const item of items) {
    const row = rows[rows.length - 1] as typeof items;
    if (row.length > 0 && used + gap + item.w > maxW) {
      rows.push([item]);
      used = item.w;
    } else {
      used += (row.length > 0 ? gap : 0) + item.w;
      row.push(item);
    }
  }
  rows.forEach((row, r) => {
    const width = row.reduce((t, it, i) => t + it.w + (i > 0 ? gap : 0), 0);
    let x = right - width;
    const y = top + r * (h + gap);
    const cy = y + h / 2;
    for (const item of row) {
      if (!item.chip) {
        ctx.fillStyle = tokens.muted;
        ctx.fillText(item.text, x, cy + fs * 0.04);
        x += item.w + gap;
        continue;
      }
      const look = chipLook(item.text, tokens);
      ctx.save();
      ctx.shadowColor = 'rgba(19, 33, 47, 0.18)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = look.fill;
      roundRectPath(ctx, x, y, item.w, h, 6);
      ctx.fill();
      ctx.restore();
      let tx = x + padX;
      if (look.warn) {
        warnIcon(ctx, tx, cy, fs * 1.05, look.ink);
        tx += fs * 1.45;
      } else if (look.mark !== null) {
        ctx.fillStyle = look.mark;
        circle(ctx, tx + fs * 0.25, cy, fs * 0.25);
        ctx.fill();
        tx += fs * 0.95;
      }
      ctx.fillStyle = look.ink;
      ctx.fillText(item.text, tx, cy + fs * 0.04);
      x += item.w + gap;
    }
  });
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
