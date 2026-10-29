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
// incident's pulse move, and neither under reduced motion. If any image fails, the schematic yard is the fallback.
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
  /** 'free play', 'structured play', 'nap', 'walk', 'clean', 'closed'; a fallback as what ran with what was asked,
   * 'free play (walk asked)', as the table writes it (BRIEF 10.1, 10.2). */
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
  /** The engine's cash after the step (display only, BRIEF section 3); the page shows it less bonusSoFar (section 5). */
  cash: number;
  /** The GM's bonus earned through this block under the plan: the steps' rewards summed over 0..t (G5d, D62). */
  bonusSoFar: number;
  /** Counters over steps 0..t. */
  incidentsSoFar: number;
  finesSoFar: number;
  sickSoFar: number;
  dogsServedSoFar: number;
  /** This block's events, as the world reported them. */
  events: WorldEvent[];
  /**
   * The events in business words, in the order they happened, as events and never as rules (BRIEF section 3: the
   * state is visible, the rules are hidden): 'Incident', 'Vet bill $150', 'Inspector: $250 fine', '2 dogs sick at
   * pickup' ('1 dog sick at pickup': illness is found at pickup, BRIEF section 6), 'The staffer called out: closed
   * today' (for the callOut event; the closed event adds nothing), 'Walk photo posted'. A fallback (walkFellBack,
   * structuredFellBack) gets no caption: activityWords already read 'free play (walk asked)'. The dollar amounts come
   * from the event's amount.
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

/** An activity's name on the page: "free play", "structured play", "nap", "walk", "clean". */
export function activityName(activity: FloorActivity): string {
  return ACTIVITY_WORDS[activity];
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
      return n === 1 ? '1 dog sick at pickup' : `${n} dogs sick at pickup`;
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
        ? `${ACTIVITY_WORDS[activity]} (${ACTIVITY_WORDS[requested]} asked)`
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
  let bonusSoFar = 0;
  for (let i = 0; i <= t; i++) {
    const step = steps[i] as StepRecord;
    bonusSoFar += step.reward;
    const r = step.result;
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
    bonusSoFar,
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
   * Without a frame: when omitted, the default line ("The GM's week plays here once it is on the job."); given (''
   * before the week, the getting-ready line while the GM gets ready), the GM's orb waits over the roof with its label,
   * and the line itself is not drawn, since the page's status line says it (round 1, finding 20; round 2, finding 18).
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

/** The cap in words, named only on a day it turned dogs away (BRIEF 10.2, G5d): never the number behind it (D44). */
const CAP_WORDS: Readonly<Record<Bookings, string>> = {
  all: '',
  legal: ', capped at the legal ratio',
  safe: ', capped at a safe ratio',
};

/** "1 staffer" and "2 staff". */
const staffWords = (n: number): string => `${n} ${n === 1 ? 'staffer' : 'staff'}`;

/**
 * Today's plan, scoped to today (BRIEF 10.2, G5d), in two parts so a narrow line can break before the crew:
 * "Today: 18 asked · all 18 accepted · premium rate" and "1 staffer scheduled" (", 1 called out" when the crew came in
 * short); a cap is named only on a day it turned dogs away ("Today: 20 asked · 15 accepted, capped at the legal
 * ratio · standard rate"); a closed day "Today: 16 asked · closed" and "1 staffer scheduled, called out".
 */
export function planParts(frame: ReplayFrame): { first: string; crew: string } {
  const scheduled = `${staffWords(frame.scheduledStaff)} scheduled`;
  if (frame.closed) return { first: `Today: ${frame.requests} asked · closed`, crew: `${scheduled}, called out` };
  const out = frame.scheduledStaff - frame.staff;
  const crew = out > 0 ? `${scheduled}, ${out} called out` : scheduled;
  const turnedAway = frame.accepted < frame.requests;
  const accepted = turnedAway
    ? `${frame.accepted} accepted${frame.bookings === null ? '' : CAP_WORDS[frame.bookings]}`
    : `all ${frame.accepted} accepted`;
  const rate = frame.rate === null ? 'no rate' : RATE_WORDS[frame.rate];
  return { first: `Today: ${frame.requests} asked · ${accepted} · ${rate}`, crew };
}

/** The whole plan line, as the rail shows it. */
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
 * Without a frame (before the week, and while the GM gets ready): the canvas cleared to transparent, so the page's
 * board shows behind it in the same camera as the week's, and the GM's orb waiting on the clubhouse's roof in its
 * getting-ready state with its label (round 2, finding 18: the first frame has life; nothing else, D60: no dogs or
 * crew before the week). Never the page's status line, which the page says (round 1, finding 20). The e2e holds these
 * drawn pixels under 2% of the canvas. If the art could not load at all, the schematic plan is drawn under the orb,
 * since the page's board cannot show either. Called without options.placeholder: the default line in the middle.
 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number, options: ReplayOptions, art: ArtSet | null): void {
  lastIdle = { ctx, width, height, options };
  idleFull = options.placeholder !== undefined && options.placeholder !== '';
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.clearRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;
  const tokens = readTokens(options.fonts);
  if (options.placeholder !== undefined) {
    if (art !== null) {
      const s = stageFor(width, height, options.pixelRatio, art);
      drawGm(ctx, s, gmDrawn(s, 'ready'), 0);
      ctx.setTransform(s.ratio, 0, 0, s.ratio, 0, 0);
      drawGmLabel(ctx, tokens, s.fs, s.label);
    } else {
      const s = plainScene(width, height);
      if (artFailed) drawPlan(ctx, s, tokens);
      drawSchematicGm(ctx, s, 'ready', 0, tokens);
      drawGmLabel(ctx, tokens, s.fs, s.label);
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
// The schematic yard: the fallback while the art loads or if an image fails (round 2, finding 12). The same scene and
// the same placement as the drawn yard, drawn as a plan in the page's palette: the board's isometric diamond in two
// greens with its soil edge, the set's front path, the plantings, the clubhouse as a block, the fence on the two back
// sides with its gate; the dogs as round tokens in their coats' colours (flat when asleep, in crates during a clean),
// the crew as taller navy tokens with an amber ring, the GM as its orb over the roof; a Closed sign on a closed day;
// the label, the chips and the incident's ring as on the drawn yard. No anatomy anywhere.

const PLAN = {
  lawn: ['#D7E6C3', '#CCDDB6'] as const,
  lawnEdge: '#A9C08C',
  soilLeft: '#B49B74',
  soilRight: '#9A825D',
  path: '#E8DFCC',
  pathJoint: 'rgba(120, 100, 70, 0.28)',
  planting: '#B5CF9A',
  plantingEdge: '#8FAF72',
  fence: '#A9895C',
  roof: '#8E979F',
  roofEdge: '#6E7780',
  wallLeft: '#E6DFD1',
  wallRight: '#D2C9B8',
  door: '#5B6670',
} as const;
/** The dogs' coats, by breed and coat; a coat the cast adds later takes the breed's first, then a warm tan. */
const COAT_COLOURS: Readonly<Record<string, string>> = {
  'golden|gold': '#D9A35B',
  'golden|red': '#B5652E',
  'lab|black': '#302C2A',
  'lab|chocolate': '#62402B',
  'lab|yellow': '#E4C88E',
  'poodle|brown': '#8C5B3D',
  'poodle|black': '#292625',
  'poodle|cream': '#ECDFC2',
  'corgi|red': '#C97A3B',
  'corgi|mahogany': '#7C3B23',
  'collie|black': '#2D2B2B',
  'collie|red': '#9C512E',
  'beagle|tricolour': '#B9834D',
};
/** A dog token's radius in metres, by breed (a corgi smallest, the retrievers largest), and its height. */
const TOKEN_R: Readonly<Record<string, number>> = { corgi: 0.21, beagle: 0.23, collie: 0.26, poodle: 0.26, lab: 0.28, golden: 0.28 };
const DOG_TOKEN_H = 0.16;
const CREW_TOKEN = { r: 0.3, h: 0.62 } as const;
/** The clubhouse block under the GM's spot (its roof is where the GM hovers): footprint and height in metres. */
const CLUB = { w: 3.9, d: 2.1, h: 2.72 } as const;
const FENCE_H = 1.0;
/** The gate in the right-back fence (set.json's notes: y from 1.3 to 2.6). */
const GATE: readonly [number, number] = [1.3, 2.6];

function coatColour(breed: string | undefined, coat: string | undefined): string {
  const exact = COAT_COLOURS[`${breed ?? ''}|${coat ?? ''}`];
  if (exact !== undefined) return exact;
  const first = Object.entries(COAT_COLOURS).find(([k]) => k.startsWith(`${breed ?? ''}|`));
  return first?.[1] ?? '#B9834D';
}

/** A polygon of world points on the ground, `up` CSS px raised. */
function worldPoly(ctx: CanvasRenderingContext2D, s: Scene, pts: readonly (readonly [number, number])[], up = 0): void {
  ctx.beginPath();
  pts.forEach(([mx, my], i) => {
    const [x, y] = ground(s, mx, my);
    if (i === 0) ctx.moveTo(x, y - up);
    else ctx.lineTo(x, y - up);
  });
  ctx.closePath();
}

/** A vertical face standing on the ground edge a→b, `h` CSS px tall. */
function face(ctx: CanvasRenderingContext2D, s: Scene, a: readonly [number, number], b: readonly [number, number], h: number, fill: string, down = false): void {
  const [ax, ay] = ground(s, a[0], a[1]);
  const [bx, by] = ground(s, b[0], b[1]);
  const d = down ? h : -h;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx, by + d);
  ctx.lineTo(ax, ay + d);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** The plan: the board's soil edge, the front path, the lawn's tiles, the plantings, the clubhouse and the fence. */
function drawPlan(ctx: CanvasRenderingContext2D, s: Scene, tokens: Tokens): void {
  const [lx, ly] = s.set.map.lawn;
  const pathEnd = Math.max(lx, s.set.walk[0] + s.set.walk[2]);
  const soil = 0.38 * s.hpm;
  // The clubhouse's plot behind the lawn's left-back side, part of the board.
  const [, , clubX1, clubY1] = clubFootprint(s);
  const plot: [number, number] = [Math.min(lx, clubX1 + 0.25), Math.max(ly, clubY1 + 0.2)];
  // The soil edge under the two front sides: the board's front-left side, the path's outer side and its end.
  face(ctx, s, [0, 0], [0, plot[1]], soil, PLAN.soilLeft, true);
  face(ctx, s, [0, -1], [0, 0], soil, PLAN.soilLeft, true);
  face(ctx, s, [0, -1], [pathEnd, -1], soil, PLAN.soilRight, true);
  // The path: flagstones a metre long.
  worldPoly(ctx, s, [[0, -1], [pathEnd, -1], [pathEnd, 0], [0, 0]]);
  ctx.fillStyle = PLAN.path;
  ctx.fill();
  ctx.strokeStyle = PLAN.pathJoint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < pathEnd; x += 1) {
    ctx.moveTo(...ground(s, x, -1));
    ctx.lineTo(...ground(s, x, 0));
  }
  ctx.moveTo(...ground(s, 0, -0.5));
  ctx.lineTo(...ground(s, pathEnd, -0.5));
  ctx.stroke();
  worldPoly(ctx, s, [[0, ly], [plot[0], ly], [plot[0], plot[1]], [0, plot[1]]]);
  ctx.fillStyle = PLAN.lawn[1];
  ctx.fill();
  // The lawn in tiles of 1.2 m, two greens.
  const tile = lx / Math.max(1, Math.round(lx / 1.2));
  for (let i = 0; i * tile < lx - 1e-6; i++) {
    for (let j = 0; j * tile < ly - 1e-6; j++) {
      worldPoly(ctx, s, [[i * tile, j * tile], [(i + 1) * tile, j * tile], [(i + 1) * tile, (j + 1) * tile], [i * tile, (j + 1) * tile]]);
      ctx.fillStyle = PLAN.lawn[(i + j) % 2] as string;
      ctx.fill();
    }
  }
  worldPoly(ctx, s, [[0, 0], [lx, 0], [lx, ly], [0, ly]]);
  ctx.strokeStyle = PLAN.lawnEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // The plantings and props: the blocked footprints, soft rounded beds.
  for (const [rx, ry, rw, rh] of s.set.map.blocked) {
    const inset = Math.min(0.12, rw / 4, rh / 4);
    worldPoly(ctx, s, [[rx + inset, ry + inset], [rx + rw - inset, ry + inset], [rx + rw - inset, ry + rh - inset], [rx + inset, ry + rh - inset]]);
    ctx.fillStyle = PLAN.planting;
    ctx.fill();
    ctx.strokeStyle = PLAN.plantingEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  drawFence(ctx, s, lx, ly);
  drawClubhouse(ctx, s, tokens);
}

/** The clubhouse's footprint in world metres [x0, y0, x1, y1]: centred under the GM's spot, CLUB.h below its roof. */
function clubFootprint(s: Scene): [number, number, number, number] {
  const hpmImg = s.hpm / s.k;
  const [cx, cy] = world(s, s.bx + s.set.gmSpot[0] * s.k, s.by + (s.set.gmSpot[1] + CLUB.h * hpmImg) * s.k);
  return [cx - CLUB.w / 2, cy - CLUB.d / 2, cx + CLUB.w / 2, cy + CLUB.d / 2];
}

/** The clubhouse as a block: its two faces toward the camera (a door on the one facing the lawn) and its roof. */
function drawClubhouse(ctx: CanvasRenderingContext2D, s: Scene, tokens: Tokens): void {
  const [x0, y0, x1, y1] = clubFootprint(s);
  const h = CLUB.h * s.hpm;
  face(ctx, s, [x0, y0], [x0, y1], h, PLAN.wallLeft);
  face(ctx, s, [x0, y0], [x1, y0], h, PLAN.wallRight);
  // The door on the face toward the lawn, a little off centre.
  const dx = x0 + (x1 - x0) * 0.62;
  const [d0x, d0y] = ground(s, dx - 0.42, y0);
  const [d1x, d1y] = ground(s, dx + 0.42, y0);
  const dh = 2.0 * s.hpm;
  ctx.beginPath();
  ctx.moveTo(d0x, d0y);
  ctx.lineTo(d1x, d1y);
  ctx.lineTo(d1x, d1y - dh);
  ctx.lineTo(d0x, d0y - dh);
  ctx.closePath();
  ctx.fillStyle = PLAN.door;
  ctx.fill();
  worldPoly(ctx, s, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], h);
  ctx.fillStyle = PLAN.roof;
  ctx.fill();
  ctx.strokeStyle = PLAN.roofEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // The block's vertical edges and its foot, so it reads as one solid.
  ctx.strokeStyle = tokens.ink;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [mx, my] of [[x0, y1], [x0, y0], [x1, y0]] as const) {
    const [x, y] = ground(s, mx, my);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
  }
  ctx.moveTo(...ground(s, x0, y1));
  ctx.lineTo(...ground(s, x0, y0));
  ctx.lineTo(...ground(s, x1, y0));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The fence on the two back sides: posts every 1.2 m and two rails, with the gate in the right-back side. */
function drawFence(ctx: CanvasRenderingContext2D, s: Scene, lx: number, ly: number): void {
  const h = FENCE_H * s.hpm;
  const [, , clubX1] = clubFootprint(s);
  const runs: { from: [number, number]; to: [number, number] }[] = [
    { from: [Math.min(lx, Math.max(0, clubX1)), ly], to: [lx, ly] },
    { from: [lx, 0], to: [lx, GATE[0]] },
    { from: [lx, GATE[1]], to: [lx, ly] },
  ];
  ctx.strokeStyle = PLAN.fence;
  ctx.lineCap = 'round';
  for (const { from, to } of runs) {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (len < 0.05) continue;
    const n = Math.max(1, Math.round(len / 1.2));
    ctx.lineWidth = Math.max(1.5, s.fs * 0.12);
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const [x, y] = ground(s, from[0] + ((to[0] - from[0]) * k) / n, from[1] + ((to[1] - from[1]) * k) / n);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - h);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s.fs * 0.08);
    ctx.beginPath();
    for (const rail of [0.45, 0.85]) {
      const [ax, ay] = ground(s, from[0], from[1]);
      const [bx, by] = ground(s, to[0], to[1]);
      ctx.moveTo(ax, ay - rail * h);
      ctx.lineTo(bx, by - rail * h);
    }
    ctx.stroke();
  }
  // The gate: a lighter panel with a diagonal brace between its two posts.
  const [g0x, g0y] = ground(s, lx, GATE[0]);
  const [g1x, g1y] = ground(s, lx, GATE[1]);
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = Math.max(1, s.fs * 0.07);
  ctx.beginPath();
  ctx.moveTo(g0x, g0y - 0.15 * h);
  ctx.lineTo(g1x, g1y - 0.15 * h);
  ctx.lineTo(g1x, g1y - 0.9 * h);
  ctx.lineTo(g0x, g0y - 0.9 * h);
  ctx.closePath();
  ctx.moveTo(g0x, g0y - 0.15 * h);
  ctx.lineTo(g1x, g1y - 0.9 * h);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * A token standing on the ground at (mx, my): a disc `rM` metres across on the ground, `hM` metres tall, its side in
 * `side`, its top in `top`, with a soft contact shadow; `ring` strokes the top's edge.
 */
function puck(ctx: CanvasRenderingContext2D, s: Scene, mx: number, my: number, rM: number, hM: number, top: string, side: string, ring: string, ringW: number): void {
  const [x, y] = ground(s, mx, my);
  const P = s.set.map.ppm * s.k;
  const rx = 1.265 * rM * P;
  const ry = 0.632 * rM * P;
  const h = hM * s.hpm;
  ctx.fillStyle = 'rgba(19, 33, 47, 0.16)';
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.18, y + ry * 0.08, rx * 1.12, ry * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(x - rx, y - h);
  ctx.lineTo(x + rx, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(x, y - h, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = ringW;
  ctx.stroke();
}

/** A shade of a hex colour: `f` below 1 darker. */
function shade(hex: string, f: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

/** A crate around (mx, my) during a clean: a wire box 0.64 m square, its back edges, then (after the dog) its front. */
function crate(ctx: CanvasRenderingContext2D, s: Scene, mx: number, my: number, tokens: Tokens, front: boolean): void {
  const half = 0.32;
  const h = 0.45 * s.hpm;
  const c = [
    [mx - half, my - half],
    [mx + half, my - half],
    [mx + half, my + half],
    [mx - half, my + half],
  ] as const;
  const p = c.map(([x, y]) => ground(s, x, y));
  ctx.strokeStyle = tokens.ink;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = front ? 0.7 : 0.35;
  ctx.beginPath();
  // Back: the far corner's two edges and its post; front: the near corner's two faces, with bars.
  const [p0, p1, p2, p3] = p as [[number, number], [number, number], [number, number], [number, number]];
  if (!front) {
    ctx.moveTo(p3[0], p3[1] - h);
    ctx.lineTo(p2[0], p2[1] - h);
    ctx.lineTo(p1[0], p1[1] - h);
    ctx.moveTo(p2[0], p2[1]);
    ctx.lineTo(p2[0], p2[1] - h);
    ctx.moveTo(p3[0], p3[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p1[0], p1[1]);
  } else {
    ctx.moveTo(p3[0], p3[1]);
    ctx.lineTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p1[0], p1[1] - h);
    ctx.lineTo(p0[0], p0[1] - h);
    ctx.lineTo(p3[0], p3[1] - h);
    ctx.closePath();
    for (let b = 1; b < 4; b++) {
      for (const [a, z] of [[p3, p0], [p0, p1]] as const) {
        const x = a[0] + ((z[0] - a[0]) * b) / 4;
        const y = a[1] + ((z[1] - a[1]) * b) / 4;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - h);
      }
    }
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p0[0], p0[1] - h);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** One figure as a token: a dog in its coat (flat when asleep, crated during a clean), or the crew in navy and amber. */
function drawToken(ctx: CanvasRenderingContext2D, s: Scene, f: Fig, tokens: Tokens, crated: boolean): void {
  const src = f.look.art.src;
  if (src.kind === 'crew') {
    puck(ctx, s, f.mx, f.my, CREW_TOKEN.r, CREW_TOKEN.h, tokens.ink, shade(TOKEN_DEFAULTS.ink, 1.6), tokens.amber, Math.max(2, s.fs * 0.16));
    return;
  }
  const colour = coatColour(src.breed, src.coat);
  const r = TOKEN_R[src.breed ?? ''] ?? 0.25;
  if (crated) crate(ctx, s, f.mx, f.my, tokens, false);
  const asleep = src.pose === 'asleep';
  puck(ctx, s, f.mx, f.my, r, asleep ? 0.04 : DOG_TOKEN_H, colour, shade(colour, 0.72), asleep ? 'rgba(19, 33, 47, 0.45)' : 'rgba(255, 255, 255, 0.75)', 1.5);
  if (crated) crate(ctx, s, f.mx, f.my, tokens, true);
}

/** The GM as its orb, over the roof: a dark sphere with one band (dim getting ready, amber at work, white when done). */
function drawSchematicGm(ctx: CanvasRenderingContext2D, s: Scene, state: GmState, hover: number, tokens: Tokens): void {
  const g = s.set.gm[state];
  const r = ((g.orb[2] - g.orb[0]) / 2) * s.k;
  const [gx, gy] = [s.bx + s.set.gmSpot[0] * s.k, s.by + s.set.gmSpot[1] * s.k];
  const cy = gy - s.hoverImg * s.k - r + hover;
  ctx.fillStyle = 'rgba(19, 33, 47, 0.22)';
  ctx.beginPath();
  ctx.ellipse(gx, gy, r * 0.8, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(gx - r * 0.35, cy - r * 0.4, r * 0.1, gx, cy, r);
  body.addColorStop(0, '#5B6670');
  body.addColorStop(1, '#23292F');
  ctx.fillStyle = body;
  circle(ctx, gx, cy, r);
  ctx.fill();
  ctx.strokeStyle = state === 'ready' ? shade(TOKEN_DEFAULTS.amber, 0.62) : state === 'done' ? '#F4F1E8' : tokens.amber;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.beginPath();
  ctx.ellipse(gx, cy + r * 0.05, r * 0.98, r * 0.26, 0, 0, Math.PI);
  ctx.stroke();
}

/** A Closed sign on a post in the middle of the empty lawn. */
function drawClosedSign(ctx: CanvasRenderingContext2D, s: Scene, tokens: Tokens): void {
  const [lx, ly] = s.set.map.lawn;
  const [x, y] = ground(s, lx * 0.45, ly * 0.45);
  const post = 1.5 * s.hpm;
  const px = Math.max(MIN_LABEL_PX, s.fs * 1.15);
  ctx.font = uiFont(tokens, px, 800);
  const w = ctx.measureText('Closed').width + px * 1.4;
  const h = px * 1.9;
  ctx.fillStyle = 'rgba(19, 33, 47, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y, px * 0.6, px * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PLAN.fence;
  ctx.fillRect(x - 2, y - post, 4, post);
  ctx.fillStyle = tokens.ink;
  roundRectPath(ctx, x - w / 2, y - post - h, w, h, 6);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Closed', x, y - post - h / 2 + px * 0.04);
}

/** The schematic frame: the plan, the incident's ring, the GM, the tokens back to front, the sign, the label, the chips. */
function drawVectorReplay(ctx: CanvasRenderingContext2D, width: number, height: number, frame: ReplayFrame, options: ReplayOptions): void {
  lastIdle = null;
  const R = options.pixelRatio;
  ctx.setTransform(R, 0, 0, R, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.setLineDash([]);
  ctx.clearRect(0, 0, width, height);
  if (!(width > 0 && height > 0)) return;
  const s = plainScene(width, height);
  const tokens = readTokens(options.fonts);
  const motion = !reducedMotion(options);
  const progress = clamp(options.progress, 0, 1);
  const figs = figuresOf(s, frame).sort((a, b) => a.y - b.y || a.x - b.x);
  drawPlan(ctx, s, tokens);
  if (frame.events.some((e) => e.type === 'incident')) drawPulse(ctx, s, R, tokens, figs, motion ? progress : null);
  ctx.setTransform(R, 0, 0, R, 0, 0);
  const state: GmState = options.gm ?? 'running';
  drawSchematicGm(ctx, s, state, gmHover(s, frame, progress, motion, state), tokens);
  const crated = frame.activity === 'clean';
  for (const f of figs) drawToken(ctx, s, f, tokens, crated);
  if (frame.closed) drawClosedSign(ctx, s, tokens);
  drawGmLabel(ctx, tokens, s.fs, s.label);
  drawBlockChips(ctx, s, tokens, frame, state);
}

// --- Before the week: the GM waiting on the roof; drawn again once the art arrives. ------------------------------

/** The last placeholder drawn and not yet replaced by a frame: drawn again when the art finishes loading. */
let lastIdle: { ctx: CanvasRenderingContext2D; width: number; height: number; options: ReplayOptions } | null = null;

function redrawIdle(): void {
  const l = lastIdle;
  if (l !== null) drawPlaceholder(l.ctx, l.width, l.height, l.options, artSet);
}

// ===============================================================================================================
// The yard's data: the set and the cast as their two JSON files give them (src/assets/art/set.json, cast.json, in
// manifest.ts's shapes), usable with or without their images. With the images, each sprite's silhouette is measured
// on its pixels; without them (the schematic yard, and the tests), it is the ellipse inside the sprite's box. The
// images are found by Vite at build time (every WebP or PNG under src/assets/art/cast/ and set/); a file the JSON
// names and the build does not have is a failed load, and the schematic yard stands in.

const ART_URLS: Record<string, string> = import.meta.glob<string>('../assets/art/{cast,set}/*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const CAST = castJson as unknown as CastManifest;
const SET = setJson as unknown as SetManifest;

/** The board's width over its height: a yard box of this shape shows the board with no surround (for the page). */
export const YARD_ASPECT = SET.board.size[0] / SET.board.size[1];

/** The yard's size at 1366 × 768 while the week plays (WP2's column, measured Oct 29): the scale the rules are set at. */
export const REFERENCE_YARD: readonly [number, number] = [784, 690];
/**
 * The spacing rules (round 2, finding 9), in CSS px of REFERENCE_YARD, scaled with the board's drawn size: the same
 * sprite (breed, coat and pose, either facing) never within SAME_SPRITE_PX of itself, the same breed in the same pose
 * (any coat) never within SAME_BREED_POSE_PX, measured between their feet after the camera's projection.
 */
const SAME_SPRITE_PX = 160;
const SAME_BREED_POSE_PX = 110;

/** Gate 5: the cast is mirrored at run time for the other facing (manifest.ts); false draws every sprite as drawn. */
const MIRROR_CAST = true;
/** The silhouette's band height for the spacing test, in image pixels; and the alpha that counts as solid. */
const BAND = 8;
const ALPHA_SOLID = 96;
/** Where a figure's anchor keeps away from a blocked footprint, and how tall a prop is taken to be for hiding. */
const BLOCK_PAD = 0.12;
const PROP_H = 2.0;
/** The GM's hover over the roof, in metres between the orb's lowest point and its shadow (round 1, finding 27). */
const GM_HOVER_M = 0.32;
/** The shadow spec (gate 3) when set.json gives none, in the board image's pixels (2× the set's 1× numbers). */
const SHADOW_DEFAULT: ShadowSpec = { throw: [0.72, -0.184], blur: 3.2, alpha: 0.3, contactBlur: 5.2, contactAlpha: 0.42, tint: '12, 30, 18' };

interface Shape {
  /** The first band's index: band j covers [j × BAND, (j + 1) × BAND) image px from the anchor, downward. */
  j0: number;
  /** Each band's opaque span, left and right in image px from the anchor (NaN for an empty band). */
  l: Float64Array;
  r: Float64Array;
  /** The bounds in image px from the anchor: left, top, right, bottom. */
  box: [number, number, number, number];
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

/** One cast sprite: its manifest entry, its silhouette as drawn and mirrored, and its image when there is one. */
interface CastEntry {
  src: CastSprite;
  shape: Shape;
  mirrored: Shape;
  img: HTMLImageElement | null;
}

/** The cast by who and what: the dogs by identity (breed and coat) and pose, the crew by person and pose. */
interface CastIndex {
  dogs: Map<string, Partial<Record<DogPose, CastEntry[]>>>;
  /** Each breed's identities ('golden|gold', 'golden|red'), sorted. */
  breeds: Map<string, string[]>;
  /** The crew by person ('crew', 'crew2': different staff), then by pose. */
  crew: Map<string, Partial<Record<CrewPose, CastEntry[]>>>;
  people: string[];
  /** The days' arrangements, by day, dogs and staff, in world metres (the same at every size of the yard), and those
   * begun in idle time and not finished yet. */
  plans: Map<string, DayPlan>;
  pendingPlans: Map<string, Generator<void, DayPlan, void>>;
}

/** The set as data: the board's size and map, the walk strip, the GM's spot, states and orb boxes, the shadow spec. */
interface SetData {
  boardSize: [number, number];
  map: BoardMap;
  /** Where the walking group stands: a strip on the set's own path, in world metres [x, y, w, h]. */
  walk: [number, number, number, number];
  gmSpot: [number, number];
  /** Each state's image size and anchor, and its orb's opaque box (left, top, right, bottom) in the image's pixels. */
  gm: Record<GmState, { size: [number, number]; anchor: [number, number]; orb: [number, number, number, number] }>;
  shadow: ShadowSpec;
}

interface ArtSet {
  board: HTMLImageElement;
  set: SetData;
  cast: CastIndex;
  gm: Record<GmState, HTMLImageElement>;
}

const GM_STATES: readonly GmState[] = ['ready', 'running', 'done'];

/** The set's data; the orbs' boxes measured on their images when given, otherwise the orb taken as the image's top square. */
function setData(orbs?: Record<GmState, [number, number, number, number]>): SetData {
  const lx = SET.board.map.lawn[0];
  const s = SET.shadow;
  const gm = {} as SetData['gm'];
  for (const state of GM_STATES) {
    const g = SET.gm[state];
    gm[state] = { size: g.size, anchor: g.anchor, orb: orbs?.[state] ?? [0, 0, g.size[0], g.size[0]] };
  }
  return {
    boardSize: SET.board.size,
    map: SET.board.map,
    // Without a strip in set.json, a band just outside the lawn's front-right edge.
    walk: Array.isArray(SET.walk) && SET.walk.length === 4 ? SET.walk : [0.4, -0.65, lx - 0.4, 0.3],
    gmSpot: SET.gmSpot,
    gm,
    shadow:
      s === undefined
        ? SHADOW_DEFAULT
        : { throw: s.throw, blur: s.blur * 2, alpha: s.alpha, contactBlur: s.contactBlur * 2, contactAlpha: s.contactAlpha, tint: s.tint.join(', ') },
  };
}

function indexCast(entries: readonly CastEntry[]): CastIndex {
  const dogs = new Map<string, Partial<Record<DogPose, CastEntry[]>>>();
  const crew = new Map<string, Partial<Record<CrewPose, CastEntry[]>>>();
  const breeds = new Map<string, string[]>();
  for (const e of entries) {
    const { src } = e;
    const [map, key] = src.kind === 'dog' ? [dogs, `${src.breed ?? 'dog'}|${src.coat ?? ''}`] : [crew, src.id.split('-')[0] ?? 'crew'];
    const poses = (map.get(key) ?? {}) as Record<string, CastEntry[] | undefined>;
    (poses[src.pose] ??= []).push(e);
    map.set(key, poses);
    if (src.kind === 'dog') {
      const breed = src.breed ?? 'dog';
      const ids = breeds.get(breed) ?? [];
      if (!ids.includes(key)) ids.push(key);
      breeds.set(breed, ids);
    }
  }
  if (dogs.size === 0 || crew.size === 0) throw new Error('replay: the cast needs a dog and the crew');
  for (const ids of breeds.values()) ids.sort();
  return { dogs, breeds, crew, people: [...crew.keys()].sort(), plans: new Map(), pendingPlans: new Map() };
}

/** A sprite's silhouette without its pixels: the ellipse inside its box (the schematic yard and the tests). */
function ellipseShape(src: CastSprite): Shape {
  const [w, h] = src.size;
  const [ax, ay] = src.anchor;
  const j0 = Math.floor(-ay / BAND);
  const n = Math.floor((h - 1 - ay) / BAND) - j0 + 1;
  const l = new Float64Array(n).fill(Number.NaN);
  const r = new Float64Array(n).fill(Number.NaN);
  for (let j = 0; j < n; j++) {
    const t = ((j0 + j + 0.5) * BAND + ay - h / 2) / (h / 2);
    if (Math.abs(t) >= 1) continue;
    const half = (w / 2) * Math.sqrt(1 - t * t) * 0.92;
    l[j] = w / 2 - half - ax;
    r[j] = w / 2 + half - ax;
  }
  return withBox({ j0, l, r, box: [0, 0, 0, 0] });
}

let plainCast: CastIndex | null = null;
/** The cast without images: each sprite's ellipse (memoised). */
function castWithoutImages(): CastIndex {
  plainCast ??= indexCast(
    CAST.sprites.map((src) => {
      const shape = ellipseShape(src);
      return { src, shape, mirrored: mirrorShape(shape), img: null };
    }),
  );
  return plainCast;
}

let artLoad: Promise<void> | null = null;
let artSet: ArtSet | null = null;
let artFailed = false;

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
 * rejects: if a file is missing or an image fails, the yard is the schematic one.
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
      // The schematic's scenes and cast are not needed again (until a test asks): let them go.
      plainCast = null;
      schematicScenes.clear();
      warmUp(art);
      redrawIdle();
    },
    () => {
      artSet = null; // the schematic yard is the fallback
      artFailed = true;
      redrawIdle();
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
  if (!Array.isArray(CAST.sprites) || SET.board === undefined || SET.gm === undefined) throw new Error('replay: the art manifests are malformed');
  const [board, ready, running, done, images] = await Promise.all([
    loadImage(artUrl(SET.board.file)),
    loadImage(artUrl(SET.gm.ready.file)),
    loadImage(artUrl(SET.gm.running.file)),
    loadImage(artUrl(SET.gm.done.file)),
    Promise.all(CAST.sprites.map((s) => loadImage(artUrl(s.file)))),
  ]);
  const probe = newCanvas(1, 1, true);
  const cast = indexCast(
    CAST.sprites.map((src, i) => {
      const img = images[i] as HTMLImageElement;
      const shape = shapeOf(img, src, probe);
      return { src, img, shape, mirrored: mirrorShape(shape) };
    }),
  );
  const gm = { ready, running, done };
  const orbs = {} as Record<GmState, [number, number, number, number]>;
  for (const state of GM_STATES) orbs[state] = orbBox(gm[state], SET.gm[state].size, probe);
  return { board, set: setData(orbs), cast, gm };
}

/** The GM's orb: its opaque box in a state's image, in the manifest's pixels (the image also holds its hover gap). */
function orbBox(img: HTMLImageElement, size: [number, number], probe: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }): [number, number, number, number] {
  const w = img.naturalWidth || size[0];
  const h = img.naturalHeight || size[1];
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
  const k = size[0] / w;
  return x1 > x0 ? [x0 * k, y0 * k, x1 * k, y1 * k] : [0, 0, size[0], size[0]];
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

// ===============================================================================================================
// The scene: the set fitted to the canvas (one camera in every state, round 2, finding 30), as plain geometry. No DOM.

interface Label {
  x: number;
  y: number;
  w: number;
  h: number;
  lineFrom: number;
  lineTo: number;
}

interface Scene {
  set: SetData;
  cast: CastIndex;
  width: number;
  height: number;
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
  /** The GM orb's box (any state, as it hovers) and its label's, in CSS px; figures keep clear of both. */
  orb: Box;
  label: Label;
  /** The corner the event chips use, kept clear of figures. */
  chips: Box;
  /** The blocked footprints on screen: each one's four ground corners (CSS px) and its horizontal extent. */
  props: { corners: [number, number][]; x0: number; x1: number }[];
  /** Each blocked footprint raised PROP_H, as its screen outline (cut out of the shadows' clip). */
  propHulls: [number, number][][];
  /** The spacing rules at this size, in CSS px (round 2, finding 9). */
  sameSprite: number;
  sameBreedPose: number;
}

/**
 * The set fitted to a canvas of `width` × `height` CSS px: the board image fitted whole and centred (`center /
 * contain`), exactly as the page fits it behind the canvas before the week, so the yard has one camera in every state
 * and only its size changes with its column; the GM's orb GM_HOVER_M over the roof; its label beside it; the chips'
 * corner.
 */
function sceneFor(width: number, height: number, set: SetData, cast: CastIndex): Scene {
  const map = set.map;
  const [bw, bh] = set.boardSize;
  const P = map.ppm;
  const exImg: [number, number] = [(2 / Math.sqrt(5)) * P, (-1 / Math.sqrt(5)) * P];
  const eyImg: [number, number] = [(-2 / Math.sqrt(5)) * P, (-1 / Math.sqrt(5)) * P];
  const k = Math.max(0.01, Math.min(width / bw, height / bh));
  const bx = (width - bw * k) / 2;
  const by = (height - bh * k) / 2;
  const pad = Math.max(10, Math.min(width, height) * 0.02);
  const fs = clamp(Math.round(width / 52), MIN_LABEL_PX, 22);
  const origin: [number, number] = [bx + map.origin[0] * k, by + map.origin[1] * k];
  const el = (CAMERA.elevationDeg * Math.PI) / 180;
  const groundLen = Math.hypot(Math.SQRT1_2, Math.SQRT1_2 * Math.sin(el));
  const hpmImg = (P * Math.cos(el)) / groundLen; // image px per metre of height
  const refK = Math.min(REFERENCE_YARD[0] / bw, REFERENCE_YARD[1] / bh);

  // The GM (round 1, finding 27): its orb's lowest point GM_HOVER_M over the roof at gmSpot, its shadow under its
  // centre; the box it may take in any state, with room for its hover.
  const hoverImg = GM_HOVER_M * hpmImg;
  const [gx, gy] = [bx + set.gmSpot[0] * k, by + set.gmSpot[1] * k];
  let ox0 = Infinity;
  let oy0 = Infinity;
  let ox1 = -Infinity;
  for (const g of Object.values(set.gm)) {
    const half = ((g.orb[2] - g.orb[0]) / 2) * k;
    ox0 = Math.min(ox0, gx - half);
    ox1 = Math.max(ox1, gx + half);
    oy0 = Math.min(oy0, gy - (hoverImg + g.orb[3] - g.orb[1]) * k);
  }
  const orb: Box = { x: ox0, y: oy0 - 4, w: ox1 - ox0, h: gy - oy0 + 4 };
  const run = set.gm.running;
  const orbMidY = gy - (hoverImg + (run.orb[3] - run.orb[1]) / 2) * k;

  // "The GM" on a pill beside the orb, on the side with room; its width from the label's words at this size.
  const labelW = fs * LABEL_EM;
  const labelH = Math.round(fs * 1.85);
  const lead = fs * 1.6;
  const onRight = ox1 + lead + labelW <= width - pad;
  const lx = onRight ? ox1 + lead : Math.max(pad, ox0 - lead - labelW);
  const label: Label = {
    x: lx,
    y: clamp(orbMidY - labelH / 2, pad, height - pad - labelH),
    w: labelW,
    h: labelH,
    lineFrom: onRight ? ox1 + 3 : ox0 - 3,
    lineTo: onRight ? lx : lx + labelW,
  };

  const s: Scene = {
    set,
    cast,
    width,
    height,
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
    orb,
    label,
    // The block's events go in the top right corner, the empty sky above the far fence (the clubhouse is top left).
    chips: { x: width * 0.42, y: 0, w: width * 0.58, h: pad + 2 * Math.round(fs * 1.95) + fs * 0.4 },
    props: [],
    propHulls: [],
    sameSprite: (SAME_SPRITE_PX * k) / refK,
    sameBreedPose: (SAME_BREED_POSE_PX * k) / refK,
  };
  s.props = map.blocked.map(([rx, ry, rw, rh]) => {
    const corners = [ground(s, rx, ry), ground(s, rx + rw, ry), ground(s, rx + rw, ry + rh), ground(s, rx, ry + rh)];
    return { corners, x0: Math.min(...corners.map((c) => c[0])), x1: Math.max(...corners.map((c) => c[0])) };
  });
  const lift = PROP_H * s.hpm;
  s.propHulls = s.props.map(({ corners }) => hull([...corners, ...corners.map(([x, y]): [number, number] => [x, y - lift])]));
  return s;
}

/** "The GM" in the page's bold face, as em: its words (about 3.4 em) and the pill's padding and light (1.9 em). */
const LABEL_EM = 5.4;

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
function ground(s: Scene, mx: number, my: number): [number, number] {
  return [s.origin[0] + mx * s.ex[0] + my * s.ey[0], s.origin[1] + mx * s.ex[1] + my * s.ey[1]];
}

/** A CSS point back to the ground (metres). */
function world(s: Scene, x: number, y: number): [number, number] {
  const dx = x - s.origin[0];
  const dy = y - s.origin[1];
  const det = s.ex[0] * s.ey[1] - s.ey[0] * s.ex[1];
  return [(dx * s.ey[1] - dy * s.ey[0]) / det, (s.ex[0] * dy - s.ex[1] * dx) / det];
}

const schematicScenes = new Map<string, Scene>();
/** The scene without images, for the schematic yard and the tests (a few sizes kept). */
function plainScene(width: number, height: number): Scene {
  const key = `${Math.round(width)}|${Math.round(height)}`;
  let s = schematicScenes.get(key);
  if (s === undefined) {
    s = sceneFor(width, height, setData(), castWithoutImages());
    schematicScenes.set(key, s);
    while (schematicScenes.size > 4) schematicScenes.delete(schematicScenes.keys().next().value as string);
  }
  return s;
}

/** One figure of the yard as arrangeYard returns it: the sprite (its id names breed, coat and pose) and its feet. */
export interface YardFigure {
  id: string;
  kind: 'dog' | 'crew';
  breed: string | null;
  coat: string | null;
  pose: string;
  /** The foot anchor in CSS px of a yard `width` × `height`. */
  x: number;
  y: number;
}

/**
 * Where everyone stands in a frame on a yard of `width` × `height` CSS px, and `scale`, the board's drawn size against
 * its size in REFERENCE_YARD: the yard's own placement, from the set's map and the cast's sizes alone (each sprite's
 * silhouette taken as the ellipse in its box, as the schematic yard takes it). For the tests (round 2, finding 9).
 */
export function arrangeYard(frame: ReplayFrame, width: number, height: number): { figures: YardFigure[]; scale: number } {
  const s = plainScene(width, height);
  const [bw, bh] = s.set.boardSize;
  const refK = Math.min(REFERENCE_YARD[0] / bw, REFERENCE_YARD[1] / bh);
  const figures = figuresOf(s, frame).map((f): YardFigure => {
    const src = f.look.art.src;
    return { id: src.id, kind: src.kind, breed: src.breed ?? null, coat: src.coat ?? null, pose: src.pose, x: f.x, y: f.y };
  });
  return { figures, scale: s.k / refK };
}

// ===============================================================================================================
// Where everyone stands: a day's arrangement, from the yard's own seeded generator (D60), in world metres. Pure: a
// Scene and a frame in, figures out. Two rules hold in screen space (round 2, finding 9), before any overlap: the same
// sprite never within scene.sameSprite of itself, the same breed in the same pose never within scene.sameBreedPose.

/** One look of a figure: a sprite and whether it is drawn mirrored. */
interface Look {
  art: CastEntry;
  mirror: boolean;
}

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
  breed: string;
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
  /** The organised arrangements, made the first time the day needs one: structured play, a clean, a walk, a nap. */
  more: Map<string, { look: Look; mx: number; my: number }[]>;
}

/** A placed figure for the spacing tests: its silhouette at its anchor (CSS px), bounds, sprite and breed-in-pose. */
interface Placed {
  shape: Shape;
  alt: number;
  x: number;
  y: number;
  box: [number, number, number, number];
  /** The sprite (breed, coat, pose; or the staffer in a pose), and the dog's breed in its pose ('' for the crew). */
  sprite: string;
  breedPose: string;
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
  /** The looks the figure may take here (a pose and a facing each); the placer takes the first that fits best. */
  looks: Look[];
  region: Region;
  /** A spot to stand as near as the room allows (an organised activity); null to spread out (free play). */
  target: [number, number] | null;
}

const lawnRegion = (s: Scene): Region => {
  const [lx, ly] = s.set.map.lawn;
  const m = s.set.map.margin;
  return { x0: m, x1: lx - m, y0: m, y1: ly - m, path: false };
};
/** The walking group's strip on the set's own path (set.json's walk), where their anchors stand. */
const pathRegion = (s: Scene): Region => {
  const [x, y, w, h] = s.set.walk;
  return { x0: x, x1: x + w, y0: y, y1: y + h, path: true };
};
/** The path's whole width around the strip (where feet and shadows may fall): set.json's path runs y from -1 to 0. */
const pathGround = (s: Scene): Region => {
  const [x, y, w, h] = s.set.walk;
  return { x0: x - 0.4, x1: x + w + 0.3, y0: y - 0.35, y1: Math.min(0, y + h + 0.35), path: true };
};

function lookShape(look: Look): Shape {
  return look.mirror ? look.art.mirrored : look.art.shape;
}

/** The sprite list's look for a facing: the one drawn that way, or another mirrored (gate 5). */
function faceLook(list: CastEntry[], facing: Facing): Look {
  const exact = list.find((a) => a.src.facing === facing);
  if (exact !== undefined) return { art: exact, mirror: false };
  const other = list[0] as CastEntry;
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
const other = (f: Facing): Facing => (f === 'right' ? 'left' : 'right');

function dogLook(cast: CastIndex, id: string, pose: DogPose, facing: Facing): Look {
  const poses = cast.dogs.get(id) ?? (cast.dogs.values().next().value as Partial<Record<DogPose, CastEntry[]>>);
  for (const p of DOG_FALLBACK[pose]) {
    const list = poses[p];
    if (list !== undefined && list.length > 0) return faceLook(list, facing);
  }
  throw new Error(`replay: no sprite for ${id}`);
}

/** A dog's looks in the given poses, each facing its own way first and then the other: the placer's choices. */
const dogLooks = (cast: CastIndex, d: DogCard, poses: readonly DogPose[], facing: Facing = d.facing): Look[] =>
  poses.flatMap((p) => [dogLook(cast, d.id, p, facing), dogLook(cast, d.id, p, other(facing))]);

/** Staffer k's person: the cast's staff in turn ('crew', 'crew2'), so two staffers on the floor are two people. */
const personOf = (cast: CastIndex, k: number): string => cast.people[k % cast.people.length] ?? 'crew';

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

function crewLook(cast: CastIndex, person: string, pose: CrewPose, facing: Facing): Look {
  const poses = cast.crew.get(person) ?? (cast.crew.values().next().value as Partial<Record<CrewPose, CastEntry[]>>);
  for (const p of CREW_FALLBACK[pose]) {
    const list = poses[p];
    if (list !== undefined && list.length > 0) return faceLook(list, facing);
  }
  const any = Object.values(poses).find((l) => l !== undefined && l.length > 0) as CastEntry[];
  return faceLook(any, facing);
}

/** The rules' keys for a look: its sprite, and a dog's breed in its pose. */
const spriteKey = (look: Look): string => look.art.src.id;
const breedPoseKey = (look: Look): string => (look.art.src.kind === 'dog' ? `${look.art.src.breed ?? ''}|${look.art.src.pose}` : '');

/** The bounds in CSS px of a shape whose anchor is at (x, y). */
function boxAt(s: Scene, shape: Shape, x: number, y: number): [number, number, number, number] {
  const k = s.k;
  return [x + shape.box[0] * k, y + shape.box[1] * k, x + shape.box[2] * k, y + shape.box[3] * k];
}

/** How much two placed silhouettes overlap, in CSS px², counting `gap` px of air around each as overlap. */
function overlapArea(s: Scene, a: Placed, b: Placed, gap: number): number {
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
function hiddenBehindProps(s: Scene, box: [number, number, number, number], y: number): number {
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
function standable(s: Scene, region: Region, mx: number, my: number): boolean {
  if (mx < region.x0 || mx > region.x1 || my < region.y0 || my > region.y1) return false;
  if (region.path) return true;
  for (const [rx, ry, rw, rh] of s.set.map.blocked) {
    if (mx > rx - BLOCK_PAD && mx < rx + rw + BLOCK_PAD && my > ry - BLOCK_PAD && my < ry + rh + BLOCK_PAD) return false;
  }
  return true;
}

/** True when the silhouette's lowest band (the feet) lies on its ground: no paw over the board's edge or the path's. */
function feetOnGround(s: Scene, region: Region, shape: Shape, x: number, y: number): boolean {
  let last = shape.l.length - 1;
  while (last >= 0 && Number.isNaN(shape.l[last] as number)) last--;
  if (last < 0) return true;
  const fy = y + (shape.j0 + last + 0.5) * BAND * s.k;
  const [lx, ly] = s.set.map.lawn;
  for (const fx of [x + (shape.l[last] as number) * s.k, x + (shape.r[last] as number) * s.k]) {
    const [mx, my] = world(s, fx, fy);
    if (region.path) {
      const g = pathGround(s);
      if (mx < g.x0 || mx > g.x1 || my < g.y0 || my > g.y1) return false;
    } else if (mx < 0.04 || my < 0.04 || mx > lx - 0.04 || my > ly - 0.04) return false;
  }
  return true;
}

/** [rule breaches, overlap cost, spread or distance to target]: lower is better, compared in that order. */
type Score = [number, number, number];
const better = (a: Score, b: Score): boolean => a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])));

/**
 * Places each item in turn: of a few dozen candidate spots on its ground (seeded) and each of its looks, the one that
 * breaks neither spacing rule against the figures already placed, then overlaps nothing (those figures with a little
 * air, the GM, the event chips, the canvas's edges, a prop that would hide it), then spreads out most (free play) or
 * stands nearest its target (an organised activity). Then up to three passes move each figure that still breaks a
 * rule or overlaps to the best of a grid over its ground. Every item is placed: where the yard is too full for both
 * rules and clear air, the fewest breaches, then the least overlap. `fixed` figures (a walk's group, placed first) are
 * obstacles that do not move.
 */
function placeAll(s: Scene, items: readonly Item[], rand: () => number, fixed: readonly Placed[] = []): Placed[] {
  return drain(placeSteps(s, items, rand, fixed));
}

/** Runs a resumable computation to its end. */
function drain<T>(gen: Generator<void, T, void>): T {
  let r = gen.next();
  while (r.done !== true) r = gen.next();
  return r.value;
}

/** placeAll as a resumable computation: it pauses after each figure, so the work can be spread over idle time. */
function* placeSteps(s: Scene, items: readonly Item[], rand: () => number, fixed: readonly Placed[] = []): Generator<void, Placed[], void> {
  const gap = Math.max(1.5, 0.05 * s.set.map.ppm * s.k);
  const keepClear: Box[] = [s.orb, { x: s.label.x - gap, y: s.label.y - gap, w: s.label.w + 2 * gap, h: s.label.h + 2 * gap }, s.chips];
  const out: (Placed | null)[] = items.map(() => null);
  const shapes = items.map((item) => item.looks.map(lookShape));
  const sprites = items.map((item) => item.looks.map(spriteKey));
  const breedPoses = items.map((item) => item.looks.map(breedPoseKey));
  // The search shrinks as the yard fills, so a full day's arrangement stays a short task on a Chromebook.
  const crowd = items.length + fixed.length;
  const spread = clamp(Math.round(1500 / Math.max(1, crowd)), 32, 64);
  const passes = crowd > 24 ? 2 : 3;
  const r1 = s.sameSprite ** 2;
  const r2 = s.sameBreedPose ** 2;
  const others = (i: number): Placed[] => {
    const list: Placed[] = [...fixed];
    out.forEach((q, j) => {
      if (q !== null && j !== i) list.push(q);
    });
    return list;
  };

  /** Look `alt` of item i at screen (x, y): how many figures among `near` it breaks a rule with. */
  const breaches = (i: number, alt: number, near: readonly { q: Placed; d2: number }[]): number => {
    const sprite = (sprites[i] as string[])[alt] as string;
    const bp = (breedPoses[i] as string[])[alt] as string;
    let n = 0;
    for (const { q, d2 } of near) {
      if (q.sprite === sprite && d2 < r1) n += 1;
      if (bp !== '' && q.breedPose === bp && d2 < r2) n += 1;
    }
    return n;
  };

  /**
   * Item i's best look at (mx, my) among the others, or null where it cannot stand or cannot beat `bound`. The spread
   * or the distance to the target is the same for every look; the breaches and the overlaps are each look's own. With
   * `only`, that look alone.
   */
  const evaluate = (i: number, mx: number, my: number, bound: Score, list: readonly Placed[], only = -1): { p: Placed; score: Score } | null => {
    const item = items[i] as Item;
    const { region, target } = item;
    if (!standable(s, region, mx, my)) return null;
    const [x, y] = ground(s, mx, my);
    let nearest2 = Infinity;
    const near: { q: Placed; d2: number }[] = [];
    for (const q of list) {
      const d2w = (q.mx - mx) ** 2 + (q.my - my) ** 2;
      if (d2w < nearest2) nearest2 = d2w;
      const d2 = (q.x - x) ** 2 + (q.y - y) ** 2;
      if (d2 < r1) near.push({ q, d2 });
    }
    const third =
      target === null
        ? -Math.min(Math.sqrt(nearest2), 2 * Math.min(mx - region.x0, region.x1 - mx, my - region.y0, region.y1 - my) + 0.6)
        : Math.sqrt((mx - target[0]) ** 2 + (my - target[1]) ** 2);
    let best: { p: Placed; score: Score } | null = null;
    const alts = shapes[i] as Shape[];
    for (let alt = 0; alt < alts.length; alt++) {
      if (only >= 0 && alt !== only) continue;
      const limitScore = best === null ? bound : better(best.score, bound) ? best.score : bound;
      const viol = breaches(i, alt, near);
      if (viol > limitScore[0]) continue;
      const shape = alts[alt] as Shape;
      if (!feetOnGround(s, region, shape, x, y)) continue;
      const box = boxAt(s, shape, x, y);
      const p: Placed = { shape, alt, x, y, box, sprite: (sprites[i] as string[])[alt] as string, breedPose: (breedPoses[i] as string[])[alt] as string, mx, my };
      const limit = viol < limitScore[0] ? Infinity : limitScore[1] + 0.5;
      let cost = 0;
      for (const zone of keepClear) cost += boxOverlap(box, zone) * 4;
      if (box[0] < 0 || box[1] < 0 || box[2] > s.width || box[3] > s.height) cost += 1e6;
      if (!region.path) cost += hiddenBehindProps(s, box, y) * 1e4;
      if (region.prefer !== undefined && !region.prefer(mx, my)) cost += 50;
      for (let j = 0; j < list.length && cost <= limit; j++) cost += overlapArea(s, p, list[j] as Placed, gap);
      if (cost > limit) continue;
      const score: Score = [viol, Math.round(cost), third];
      if (best === null || better(score, best.score)) best = { p, score };
      if (viol === 0 && score[1] === 0) break; // clear: a later look cannot do better here
    }
    return best;
  };

  /**
   * Item i's best spot among fresh candidates (and its current one, if it has one): seeded random spots near its target
   * or over its ground, or, for the few figures a pass is still moving, the best points of a jittered grid over its
   * whole ground (those clear of the rules first, then the most open), which finds the narrow gaps.
   */
  const settle = (i: number, thorough = false): Score => {
    const item = items[i] as Item;
    const { region, target } = item;
    const list = others(i);
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
      const step = 0.3;
      const grid: [number, number, number, number][] = [];
      const alts = (shapes[i] as Shape[]).length;
      for (let gx = region.x0; gx <= region.x1; gx += step) {
        for (let gy = region.y0; gy <= region.y1; gy += step) {
          const mx = gx + (rand() - 0.5) * step;
          const my = gy + (rand() - 0.5) * step;
          const [x, y] = ground(s, mx, my);
          let d2 = Infinity;
          const near: { q: Placed; d2: number }[] = [];
          for (const q of list) {
            d2 = Math.min(d2, (q.mx - mx) ** 2 + (q.my - my) ** 2);
            const ds = (q.x - x) ** 2 + (q.y - y) ** 2;
            if (ds < r1) near.push({ q, d2: ds });
          }
          let viol = Infinity;
          for (let alt = 0; alt < alts; alt++) viol = Math.min(viol, breaches(i, alt, near));
          grid.push([mx, my, viol, d2]);
        }
      }
      grid.sort((a, b) => a[2] - b[2] || b[3] - a[3]);
      for (const [mx, my] of grid.slice(0, 80)) candidates.push([mx, my]);
    } else {
      for (let c = 0; c < (target === null ? spread : 12); c++) {
        candidates.push([region.x0 + rand() * (region.x1 - region.x0), region.y0 + rand() * (region.y1 - region.y0)]);
      }
    }
    let best: Placed | null = null;
    let bestScore: Score = [Infinity, Infinity, Infinity];
    for (const [mx, my] of candidates) {
      const e = evaluate(i, mx, my, bestScore, list);
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
      const sp = (sprites[i] as string[])[0] as string;
      best = { shape, alt: 0, x, y, box: boxAt(s, shape, x, y), sprite: sp, breedPose: (breedPoses[i] as string[])[0] as string, mx, my };
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
      const now = evaluate(i, current.mx, current.my, [Infinity, Infinity, Infinity], others(i), current.alt);
      if (now === null || (now.score[0] === 0 && now.score[1] === 0)) continue;
      if (better(settle(i, true), now.score)) moved = true;
      yield;
    }
    if (!moved) break;
  }
  return out as Placed[];
}

/**
 * The day's cast and where each stands in free play, in world metres, kept all day: the dogs dealt so the breeds come
 * evenly (the breeds in a shuffled turn, each breed's coats in turn), each with a facing and a free-play pose (moving
 * or sitting) the placer may change, the other pose or facing, where the spacing rules need it; the crew first, near
 * the middle. Cached on the cast by day, dogs and staff.
 */
function dayPlan(s: Scene, day: number, dogCount: number, staffCount: number): DayPlan {
  const key = `${day}|${dogCount}|${staffCount}`;
  const cached = s.cast.plans.get(key);
  if (cached !== undefined) return cached;
  // Started ahead of time and not done yet: finish it here rather than start again.
  const started = s.cast.pendingPlans.get(key);
  s.cast.pendingPlans.delete(key);
  return drain(started ?? daySteps(s, day, dogCount, staffCount));
}

/** dayPlan's work, resumable; it files the plan under its key when it is done. */
function* daySteps(s: Scene, day: number, dogCount: number, staffCount: number): Generator<void, DayPlan, void> {
  const key = `${day}|${dogCount}|${staffCount}`;
  const cast = s.cast;
  const rand = seeded(day, dogCount, staffCount, 1);
  const breedOrder = shuffle([...cast.breeds.keys()].sort(), rand);
  const coats = new Map(breedOrder.map((b) => [b, shuffle([...(cast.breeds.get(b) ?? [])], rand)] as const));
  const ids: string[] = [];
  for (let turn = 0; ids.length < dogCount; turn++) {
    for (const b of breedOrder) {
      if (ids.length >= dogCount) break;
      const list = coats.get(b) ?? [];
      if (list.length > 0) ids.push(list[turn % list.length] as string);
    }
  }
  const face = (): Facing => (rand() < 0.5 ? 'right' : 'left');
  const dogs: DogCard[] = ids.map((id) => ({
    id,
    breed: id.split('|')[0] ?? id,
    facing: face(),
    play: (rand() < 0.62 ? 'moving' : 'sitting') as DogPose,
    mx: 0,
    my: 0,
  }));
  // The crew face alternate ways, so two staffers drawn from the one model never stand as copies.
  const first = face();
  const crew: CrewCard[] = Array.from({ length: staffCount }, (_, k) => ({ facing: k % 2 === 0 ? first : other(first), mx: 0, my: 0 }));
  const [lx, ly] = s.set.map.lawn;
  const CREW_AT: readonly [number, number][] = [
    [0.4, 0.38],
    [0.66, 0.3],
    [0.2, 0.5],
  ];
  const region = lawnRegion(s);
  const playPoses = (d: DogCard): DogPose[] => (d.play === 'moving' ? ['moving', 'sitting'] : ['sitting', 'moving']);
  const items: Item[] = [
    ...crew.map((c, k): Item => {
      const at = CREW_AT[k % CREW_AT.length] as [number, number];
      return { looks: [crewLook(cast, personOf(cast, k), crewPose('free', k), c.facing)], region, target: [at[0] * lx, at[1] * ly] };
    }),
    ...dogs.map((d): Item => ({ looks: dogLooks(cast, d, playPoses(d)), region, target: null })),
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
    // The look the placer took: its pose and its facing (dogLooks' order: each pose, its own facing then the other).
    d.play = (playPoses(d)[Math.floor(p.alt / 2)] ?? d.play) as DogPose;
    if (p.alt % 2 === 1) d.facing = other(d.facing);
  });
  const plan: DayPlan = { dogs, crew, more: new Map() };
  cast.plans.set(key, plan);
  return plan;
}

function fig(s: Scene, look: Look, mx: number, my: number): Fig {
  const [x, y] = ground(s, mx, my);
  return { look, mx, my, x, y };
}

const placedOf = (s: Scene, f: Fig): Placed => {
  const shape = lookShape(f.look);
  return { shape, alt: 0, x: f.x, y: f.y, box: boxAt(s, shape, f.x, f.y), sprite: spriteKey(f.look), breedPose: breedPoseKey(f.look), mx: f.mx, my: f.my };
};

/** An arrangement made once for the day and kept on its plan in world metres, as figures at this scene's size. */
function cachedFigs(s: Scene, plan: DayPlan, key: string, make: () => Fig[]): Fig[] {
  const cached = plan.more.get(key);
  if (cached !== undefined) return cached.map((c) => fig(s, c.look, c.mx, c.my));
  const figs = make();
  plan.more.set(key, figs.map(({ look, mx, my }) => ({ look, mx, my })));
  return figs;
}

/** The figures for placed items: each item in the look the placer took. */
const figsOf = (s: Scene, items: readonly Item[], spots: readonly Placed[]): Fig[] =>
  spots.map((p, i) => fig(s, (items[i] as Item).looks[p.alt] as Look, p.mx, p.my));

/**
 * Hands `dogs` to `slots` (world points) so that the same breed sits as far apart as it can: each slot in turn takes
 * the dog whose nearest same-breed neighbour (and same-identity neighbour, weighted by the stricter rule) is farthest
 * away on screen. All sit in one pose, so the breed is what the rules see.
 */
function dealToSlots(s: Scene, dogs: readonly DogCard[], slots: readonly [number, number][]): DogCard[] {
  const left = [...dogs];
  const placed: { d: DogCard; x: number; y: number }[] = [];
  for (const [mx, my] of slots) {
    const [x, y] = ground(s, mx, my);
    let bestK = 0;
    let bestScore = -Infinity;
    left.forEach((d, k) => {
      let score = Infinity;
      for (const p of placed) {
        const dist = Math.hypot(p.x - x, p.y - y);
        if (p.d.id === d.id) score = Math.min(score, dist / s.sameSprite);
        else if (p.d.breed === d.breed) score = Math.min(score, dist / s.sameBreedPose);
      }
      if (score > bestScore) {
        bestScore = score;
        bestK = k;
      }
    });
    const d = left.splice(bestK, 1)[0] as DogCard;
    placed.push({ d, x, y });
  }
  return placed.map((p) => p.d);
}

/**
 * Structured play: each staffer on the floor with a ball, their dogs sitting in short rows either side of them, every
 * dog facing its staffer (the rows to the screen's left face right, those to its right face left). The groups stand
 * side by side across the lawn; the dogs are dealt to the rows so the same breed sits apart.
 */
function structured(s: Scene, plan: DayPlan, frame: ReplayFrame): Fig[] {
  return cachedFigs(s, plan, `structured|${frame.floorDogs}|${frame.floorStaff}`, () => {
    const cast = s.cast;
    const rand = seeded(frame.day, frame.dogs, frame.staff, 2);
    const [lx, ly] = s.set.map.lawn;
    const groups = Math.max(1, frame.floorStaff);
    const side: [number, number] = [-Math.SQRT1_2, Math.SQRT1_2]; // one metre toward the screen's left
    const back: [number, number] = [Math.SQRT1_2, Math.SQRT1_2]; // one metre away from the viewer
    const centre: [number, number] = [lx * 0.43, ly * 0.43];
    const spread = Math.min(3.4, (Math.hypot(lx, ly) * 0.8) / groups);
    const region = lawnRegion(s);
    const crewItems: Item[] = [];
    const slots: { at: [number, number]; facing: Facing }[] = [];
    for (let g = 0; g < groups; g++) {
      const off = (g - (groups - 1) / 2) * spread;
      const cx = centre[0] - side[0] * off;
      const cy = centre[1] - side[1] * off;
      if (frame.floorStaff > 0) crewItems.push({ looks: [crewLook(cast, personOf(cast, g), crewPose('structured', g), g % 2 === 0 ? 'right' : 'left')], region, target: [cx, cy] });
      const first = Math.floor((g * frame.floorDogs) / groups);
      const m = Math.floor(((g + 1) * frame.floorDogs) / groups) - first;
      const perSide = Math.ceil(m / 2);
      const rows = Math.max(1, Math.ceil(Math.sqrt(perSide * 1.3)));
      const cols = Math.max(1, Math.ceil(perSide / rows));
      for (let j = 0; j < m; j++) {
        const leftSide = j % 2 === 0;
        const n = Math.floor(j / 2);
        const dist = 0.95 + (n % cols) * 0.85;
        const depth = (Math.floor(n / cols) - (rows - 1) / 2) * 0.75;
        const sign = leftSide ? 1 : -1;
        slots.push({ at: [cx + sign * side[0] * dist + back[0] * depth, cy + sign * side[1] * dist + back[1] * depth], facing: leftSide ? 'right' : 'left' });
      }
    }
    const dealt = dealToSlots(s, plan.dogs.slice(0, frame.floorDogs), slots.map((sl) => sl.at));
    const items: Item[] = [
      ...crewItems,
      ...dealt.map((d, j): Item => {
        const slot = slots[j] as { at: [number, number]; facing: Facing };
        return { looks: [dogLook(cast, d.id, 'sitting', slot.facing)], region, target: slot.at };
      }),
    ];
    return figsOf(s, items, placeAll(s, items, rand));
  });
}

/**
 * A clean: the crew with the mop on the open floor at the screen's left, the dogs settled out of the way at its right,
 * sitting or asleep (a dog that moved in free play rests asleep, one that sat stays sitting, unless the rules need the
 * other).
 */
function cleaning(s: Scene, plan: DayPlan, frame: ReplayFrame): Fig[] {
  return cachedFigs(s, plan, `clean|${frame.floorDogs}|${frame.floorStaff}`, () => {
    const cast = s.cast;
    const rand = seeded(frame.day, frame.dogs, frame.staff, 3);
    const [lx, ly] = s.set.map.lawn;
    const lawn = lawnRegion(s);
    const right: Region = { ...lawn, prefer: (mx, my) => mx - my > -0.4 };
    const CREW_AT: readonly [number, number][] = [
      [0.22, 0.6],
      [0.18, 0.32],
      [0.38, 0.78],
    ];
    const items: Item[] = [];
    for (let k = 0; k < frame.floorStaff; k++) {
      const at = CREW_AT[k % CREW_AT.length] as [number, number];
      items.push({ looks: [crewLook(cast, personOf(cast, k), crewPose('clean', k), (plan.crew[k] as CrewCard).facing)], region: lawn, target: [at[0] * lx, at[1] * ly] });
    }
    for (const d of plan.dogs.slice(0, frame.floorDogs)) {
      const poses: DogPose[] = d.play === 'moving' ? ['asleep', 'sitting'] : ['sitting', 'asleep'];
      items.push({ looks: dogLooks(cast, d, poses), region: right, target: null });
    }
    return figsOf(s, items, placeAll(s, items, rand));
  });
}

/**
 * A walk: the walking group on the set's own path (set.json's walk strip, along the lawn's front-right edge), the
 * staffer in front with the leash and the dogs behind in single file, all heading along the path toward the lawn's
 * front corner (the camera-facing diagonal down and left, so every sprite faces left); placed first, in formation. The
 * walkers are chosen breed by breed, so no two in the file are the same breed. Then the floor makes room for it: each
 * dog and staffer left behind stands as near its free-play spot as it can, in its own pose or the other where the
 * rules need it.
 */
function walking(s: Scene, plan: DayPlan, frame: ReplayFrame): Fig[] {
  return cachedFigs(s, plan, `walk|${frame.floorDogs}|${frame.floorStaff}|${frame.walkingDogs}|${frame.walkingStaff}`, () => {
    const cast = s.cast;
    const rand = seeded(frame.day, frame.dogs, frame.staff, 4);
    const path = pathRegion(s);
    const mid = (path.y0 + path.y1) / 2;
    // The walkers: in a seeded order, a dog of a breed not yet walking, until the group is full.
    const order = shuffle(plan.dogs.map((_, i) => i), rand);
    const walkers: number[] = [];
    const breedsWalking = new Set<string>();
    for (const i of order) {
      const d = plan.dogs[i] as DogCard;
      if (walkers.length < frame.walkingDogs && !breedsWalking.has(d.breed)) {
        walkers.push(i);
        breedsWalking.add(d.breed);
      }
    }
    for (const i of order) if (walkers.length < frame.walkingDogs && !walkers.includes(i)) walkers.push(i);
    const group: Item[] = [];
    if (frame.walkingStaff > 0) group.push({ looks: [crewLook(cast, personOf(cast, frame.staff - 1), 'leash', 'left')], region: path, target: [path.x0 + 0.25, mid] });
    walkers.forEach((i, j) => {
      const d = plan.dogs[i] as DogCard;
      group.push({ looks: [dogLook(cast, d.id, 'moving', 'left')], region: path, target: [path.x0 + 1.05 + j * 0.95, mid + (j % 2 === 0 ? -0.05 : 0.05)] });
    });
    const walked = placeAll(s, group, rand);
    const lawn = lawnRegion(s);
    const floor: Item[] = [];
    plan.dogs.forEach((d, i) => {
      if (walkers.includes(i)) return;
      const poses: DogPose[] = d.play === 'moving' ? ['moving', 'sitting'] : ['sitting', 'moving'];
      floor.push({ looks: dogLooks(cast, d, poses), region: lawn, target: [d.mx, d.my] });
    });
    for (let k = 0; k < frame.floorStaff; k++) {
      const c = plan.crew[k] as CrewCard;
      floor.push({ looks: [crewLook(cast, personOf(cast, k), crewPose('free', k), c.facing)], region: lawn, target: [c.mx, c.my] });
    }
    const stay = placeAll(s, floor, rand, walked);
    return [...figsOf(s, group, walked), ...figsOf(s, floor, stay)];
  });
}

/** A nap: every dog lies down as near its free-play spot as the rules and the room allow; the crew stay where they stood. */
function napping(s: Scene, plan: DayPlan, frame: ReplayFrame): Fig[] {
  return cachedFigs(s, plan, `nap|${frame.floorDogs}|${frame.floorStaff}`, () => {
    const cast = s.cast;
    const rand = seeded(frame.day, frame.dogs, frame.staff, 5);
    const region = lawnRegion(s);
    const items: Item[] = [];
    for (let k = 0; k < frame.floorStaff; k++) {
      const c = plan.crew[k] as CrewCard;
      items.push({ looks: [crewLook(cast, personOf(cast, k), crewPose('nap', k), c.facing)], region, target: [c.mx, c.my] });
    }
    for (const d of plan.dogs.slice(0, frame.floorDogs)) items.push({ looks: dogLooks(cast, d, ['asleep']), region, target: [d.mx, d.my] });
    return figsOf(s, items, placeAll(s, items, rand));
  });
}

/** Everyone on the yard in this block: the floor as the activity has it (a walk's group on the path beside it). */
function figuresOf(s: Scene, frame: ReplayFrame): Fig[] {
  if (frame.closed || frame.activity === null) return [];
  const plan = dayPlan(s, frame.day, frame.dogs, frame.staff);
  const cast = s.cast;
  if (frame.activity === 'structuredPlay') return structured(s, plan, frame);
  if (frame.activity === 'clean') return cleaning(s, plan, frame);
  if (frame.activity === 'nap') return napping(s, plan, frame);
  if (frame.walkingStaff > 0 || frame.walkingDogs > 0) return walking(s, plan, frame);
  const floor: Fig[] = [];
  for (const d of plan.dogs.slice(0, frame.floorDogs)) floor.push(fig(s, dogLook(cast, d.id, d.play, d.facing), d.mx, d.my));
  for (let k = 0; k < frame.floorStaff; k++) {
    const c = plan.crew[k] as CrewCard;
    floor.push(fig(s, crewLook(cast, personOf(cast, k), crewPose('free', k), c.facing), c.mx, c.my));
  }
  return floor;
}

// ===============================================================================================================
// The stage: a scene of the set with its images, and everything drawn at that size (the board, each sprite and its
// shadow, the GM), kept per size; prepared in idle time where it can be.

/** A sprite (or the GM) scaled for the stage, in device pixels, with its anchor and its shadow. */
interface Drawn {
  img: HTMLCanvasElement;
  ax: number;
  ay: number;
  shadow: HTMLCanvasElement | null;
  sx: number;
  sy: number;
}

interface Stage extends Scene {
  key: string;
  art: ArtSet;
  ratio: number;
  tokens: Tokens;
  /** The board, at this size. */
  layer: HTMLCanvasElement;
  drawn: Map<string, Drawn>;
  gmShadow: HTMLCanvasElement | null;
  /** The stage's preparation (startWarm): the job running, the level it is doing, the level reached, the level asked. */
  warmWork: Generator<void, number, void> | null;
  warmDoing: number;
  warmLevel: number;
  warmTarget: number;
}

/** The stages made lately, by size (the page shows the yard at a few sizes: on load, while the week plays, after it). */
const stages = new Map<string, Stage>();
const STAGES_KEPT = 3;
let pendingSize: { width: number; height: number; ratio: number } | null = null;
let warmTimer: ReturnType<typeof setTimeout> | null = null;
/** True while the page shows the GM getting ready (the last placeholder had its line): the week plays at this size. */
let idleFull = false;

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
  if (known !== undefined && known.art === art && known.warmTarget >= (idleFull ? 2 : 1)) return;
  warmTimer = setTimeout(() => {
    warmTimer = null;
    startWarm(stageFor(size.width, size.height, size.ratio, art));
  }, 0);
}

/**
 * Starts the stage's preparation in idle time, most needed first. Level 1: the GM in its three states and the default
 * Monday's arrangement (in world metres, good at every size). Level 2, `full`: that Monday's looks, then every other
 * look of the cast (each sprite and its shadow, as drawn and mirrored) at this size: asked for while the GM gets
 * ready (the week plays at the getting-ready size) or once a frame is drawn at this size, not on the load screen,
 * whose size the week does not play at. A getting-ready redraw also advances it a little (advanceWarm), in case the
 * browser has no idle time.
 */
function startWarm(s: Stage, full = idleFull): void {
  const target = full ? 2 : 1;
  if (s.warmLevel >= target) return;
  s.warmTarget = Math.max(s.warmTarget, target);
  if (s.warmWork !== null) return; // the job running goes on to the new target when it finishes (warmDone)
  const work = prepare(s, s.warmLevel, s.warmTarget);
  s.warmWork = work;
  idle(s, work, () => s.warmWork === work, () => warmDone(s, work));
}

/** A preparation finished: the stage is at its target, and starts the next level if one was asked for meanwhile. */
function warmDone(s: Stage, work: Generator<void, number, void>): void {
  if (s.warmWork !== work) return;
  s.warmWork = null;
  s.warmLevel = Math.max(s.warmLevel, s.warmDoing);
  if (s.warmTarget > s.warmLevel) startWarm(s, true);
}

function* prepare(s: Stage, from: number, to: number): Generator<void, number, void> {
  s.warmDoing = to;
  const cast = s.cast;
  const key = `0|${WARM_DAY.dogs}|${WARM_DAY.staff}`;
  if (from < 1) {
    for (const state of GM_STATES) gmDrawn(s, state);
    yield;
    if (!cast.plans.has(key)) {
      const gen = cast.pendingPlans.get(key) ?? daySteps(s, 0, WARM_DAY.dogs, WARM_DAY.staff);
      cast.pendingPlans.set(key, gen);
      // A frame may finish it first (dayPlan); then the next step reports done at once.
      for (let r = gen.next(); r.done !== true; r = gen.next()) yield;
      cast.pendingPlans.delete(key);
    }
  }
  if (to < 2) return to;
  const plan = cast.plans.get(key);
  if (plan !== undefined) {
    for (const [k, c] of plan.crew.entries()) drawnOf(s, crewLook(cast, personOf(cast, k), crewPose('free', k), c.facing));
    for (const d of plan.dogs) {
      drawnOf(s, dogLook(cast, d.id, d.play, d.facing));
      yield;
    }
  }
  for (const look of allLooks(cast)) {
    drawnOf(s, look);
    yield;
  }
  return to;
}

/** Advances the stage's preparation for up to `ms` milliseconds now. */
function advanceWarm(s: Stage, ms: number): void {
  const work = s.warmWork;
  if (work === null) return;
  const t0 = performance.now();
  let r = work.next();
  while (r.done !== true && performance.now() - t0 < ms) r = work.next();
  if (r.done === true) warmDone(s, work);
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
  const cast = s.cast;
  if (cast.plans.has(key) || cast.pendingPlans.has(key)) return;
  const gen = daySteps(s, day, dogs, staff);
  cast.pendingPlans.set(key, gen);
  idle(s, gen, () => cast.pendingPlans.get(key) === gen, () => cast.pendingPlans.delete(key));
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
function allLooks(cast: CastIndex): Look[] {
  const looks: Look[] = [];
  const add = (list: CastEntry[] | undefined): void => {
    for (const a of list ?? []) {
      looks.push({ art: a, mirror: false });
      if (MIRROR_CAST) looks.push({ art: a, mirror: true });
    }
  };
  for (const poses of cast.dogs.values()) for (const list of Object.values(poses)) add(list);
  for (const poses of cast.crew.values()) for (const list of Object.values(poses)) add(list);
  return looks;
}

function stageFor(width: number, height: number, ratio: number, art: ArtSet): Stage {
  const key = stageKey(width, height, ratio);
  const known = stages.get(key);
  if (known !== undefined && known.art === art) return known;
  const s: Stage = {
    ...sceneFor(width, height, art.set, art.cast),
    key,
    art,
    ratio,
    tokens: readTokens(undefined),
    layer: newCanvas(width * ratio, height * ratio).canvas,
    drawn: new Map(),
    gmShadow: null,
    warmWork: null,
    warmDoing: 0,
    warmLevel: 0,
    warmTarget: 0,
  };
  paintLayer(s);
  stages.delete(key);
  stages.set(key, s);
  while (stages.size > STAGES_KEPT) stages.delete(stages.keys().next().value as string);
  return s;
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
  const [bw, bh] = art.set.boardSize;
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
    startWarm(s, true);
    return { d, scale: (s.k * s.ratio) / (other.k * other.ratio) };
  }
  return { d: drawnOf(s, look), scale: 1 };
}

function drawnOf(s: Stage, look: Look): Drawn {
  const key = lookKey(look);
  const cached = s.drawn.get(key);
  if (cached !== undefined) return cached;
  const { src, img } = look.art;
  if (img === null) throw new Error(`replay: no image for ${src.id}`);
  const f = s.k * s.ratio;
  const nw = img.naturalWidth || src.size[0];
  const nh = img.naturalHeight || src.size[1];
  const canvas = scaled(img, nw, nh, (src.size[0] * f) / nw, look.mirror);
  const fx = canvas.width / src.size[0];
  const fy = canvas.height / src.size[1];
  const ax = (look.mirror ? src.size[0] - src.anchor[0] : src.anchor[0]) * fx;
  const ay = src.anchor[1] * fy;
  const shadow = castShadow(canvas, ax, ay, f, s.set.shadow);
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
  const g = s.set.gm[state];
  const img = s.art.gm[state];
  const f = s.k * s.ratio;
  const nw = img.naturalWidth || g.size[0];
  const nh = img.naturalHeight || g.size[1];
  const canvas = scaled(img, nw, nh, (g.size[0] * f) / nw, false);
  const ax = ((g.orb[0] + g.orb[2]) / 2) * (canvas.width / g.size[0]);
  const drawn: Drawn = { img: canvas, ax, ay: (g.orb[3] + s.hoverImg) * (canvas.height / g.size[1]), shadow: null, sx: 0, sy: 0 };
  s.drawn.set(key, drawn);
  if (s.gmShadow === null) s.gmShadow = roofShadow(s.set.shadow, (g.orb[2] - g.orb[0]) * f, f);
  return drawn;
}

/** The GM's soft shadow on the roof under its centre, for an orb `wide` device px across (`f` device px per image px). */
function roofShadow(spec: ShadowSpec, wide: number, f: number): HTMLCanvasElement {
  const rx = wide * 0.4;
  const ry = rx * 0.45; // a disc on the flat roof, foreshortened by the camera
  const blur = spec.contactBlur * f;
  const c = newCanvas(rx * 2 + blur * 6, ry * 2 + blur * 6);
  if (typeof c.ctx.filter === 'string') c.ctx.filter = `blur(${blur.toFixed(2)}px)`;
  c.ctx.fillStyle = `rgba(${spec.tint}, ${spec.contactAlpha * 0.85})`;
  c.ctx.beginPath();
  c.ctx.ellipse(c.canvas.width / 2, c.canvas.height / 2, rx, ry, 0, 0, Math.PI * 2);
  c.ctx.fill();
  return c.canvas;
}

// ===============================================================================================================
// The frame on the set.

function drawYard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReplayFrame,
  options: ReplayOptions,
  art: ArtSet,
  motion: boolean,
): void {
  lastIdle = null;
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
  if (frame.events.some((e) => e.type === 'incident')) drawPulse(ctx, s, R, tokens, figs, motion ? progress : null);

  // The GM over the clubhouse: its soft shadow on the roof, then the orb, hovering gently while the week plays.
  const state: GmState = options.gm ?? 'running';
  drawGm(ctx, s, gmDrawn(s, state), gmHover(s, frame, progress, motion, state));

  // The figures: every shadow first, so none falls across another figure, and only on the ground (the lawn and the
  // set's path: a shadow thrown past the fence would land on the page); then the figures back to front.
  const drawn = figs.map((f) => drawnFor(s, f.look));
  ctx.save();
  clipToGround(ctx, s, R);
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
  drawBlockChips(ctx, s, tokens, frame, state);
}

/** The GM's hover while the week plays: a slow bob over the roof, none under reduced motion or in its other states. */
const gmHover = (s: Scene, frame: ReplayFrame, progress: number, motion: boolean, state: GmState): number =>
  motion && state === 'running' ? Math.sin(((frame.day * 4 + frame.block + progress) / 8) * Math.PI * 2) * 2.5 * s.k * 2 : 0;

/** The block's events while the week plays; none once it is over (round 1, finding 5: a stale event reads as current). */
function drawBlockChips(ctx: CanvasRenderingContext2D, s: Scene, tokens: Tokens, frame: ReplayFrame, state: GmState): void {
  if (state === 'done') return;
  const captions = frame.closed && !frame.captions.some((c) => /closed/i.test(c)) ? ['Closed', ...frame.captions] : frame.captions;
  drawChips(ctx, tokens, s.fs, s.width - s.pad, s.pad, s.chips.w - s.pad, captions);
}

/**
 * Clips to the ground a shadow may fall on: the lawn and the set's path, less the scenery standing on the lawn (each
 * blocked footprint raised PROP_H), each its own clip (the canvas with that outline cut out), since clips intersect.
 */
function clipToGround(ctx: CanvasRenderingContext2D, s: Scene, R: number): void {
  const [lx, ly] = s.set.map.lawn;
  const pg = pathGround(s);
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
  for (const outline of s.propHulls) {
    ctx.beginPath();
    ctx.rect(0, 0, s.width, s.height);
    outline.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.clip('evenodd');
  }
}

/** Development only (stripped from the build): overlapping pairs, and pairs that break a spacing rule. */
function yardStats(s: Scene, figs: readonly Fig[]): { figures: number; overlaps: number; worst: number; breaches: number } {
  const placed = figs.map((f) => placedOf(s, f));
  let overlaps = 0;
  let worst = 0;
  let breaches = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i] as Placed;
      const b = placed[j] as Placed;
      const o = overlapArea(s, a, b, 0);
      if (o > 4) overlaps += 1;
      worst = Math.max(worst, o);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if ((a.sprite === b.sprite && d < s.sameSprite) || (a.breedPose !== '' && a.breedPose === b.breedPose && d < s.sameBreedPose)) breaches += 1;
    }
  }
  return { figures: figs.length, overlaps, worst: Math.round(worst), breaches };
}

/**
 * The incident's pulse: a ring on the lawn round the dogs on the floor (their middle, wide enough to take them in),
 * clipped to the lawn, growing and fading through the block; a steady ring under reduced motion (`progress` null).
 */
function drawPulse(ctx: CanvasRenderingContext2D, s: Scene, R: number, tokens: Tokens, figs: readonly Fig[], progress: number | null): void {
  const [lx, ly] = s.set.map.lawn;
  const onLawn = figs.filter((f) => f.mx >= 0 && f.my >= 0);
  let cx = lx * 0.45;
  let cy = ly * 0.45;
  let radius = Math.min(lx, ly) * 0.3;
  if (onLawn.length > 0) {
    cx = onLawn.reduce((t, f) => t + f.mx, 0) / onLawn.length;
    cy = onLawn.reduce((t, f) => t + f.my, 0) / onLawn.length;
    const rms = Math.sqrt(onLawn.reduce((t, f) => t + (f.mx - cx) ** 2 + (f.my - cy) ** 2, 0) / onLawn.length);
    radius = clamp(rms * 1.35, 1.1, Math.min(lx, ly) * 0.48);
  }
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
  const [gx, gy] = [s.bx + s.set.gmSpot[0] * s.k, s.by + s.set.gmSpot[1] * s.k];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (s.gmShadow !== null) ctx.drawImage(s.gmShadow, Math.round(gx * R - s.gmShadow.width / 2), Math.round(gy * R - s.gmShadow.height / 2));
  ctx.drawImage(gm.img, Math.round(gx * R - gm.ax), Math.round((gy + hover) * R - gm.ay));
}

/** "The GM" on a navy pill with the amber light, a short line to the orb (Floor's callout). */
function drawGmLabel(ctx: CanvasRenderingContext2D, tokens: Tokens, fs: number, label: Label): void {
  const { x, y, h, lineFrom, lineTo } = label;
  ctx.font = uiFont(tokens, fs, 800);
  const w = Math.max(label.w, ctx.measureText('The GM').width + fs * 1.9);
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
