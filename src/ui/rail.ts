// The yard's rail (G5d, D59): what the GM is doing this block and what it is costing, as text beside the yard instead
// of drawn on the canvas, so a screen reader and the page's word checks read it too. A pure function of one
// ReplayFrame; WP2 renders it, WP3's canvas draws only the yard.
import type { WorldConfig } from '../world/types.ts';
import type { ReplayFrame } from './replay.ts';

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

export function railModel(frame: ReplayFrame, world: WorldConfig): RailModel {
  void frame;
  void world;
  throw new Error('railModel: not built yet (G5d WP2)');
}
