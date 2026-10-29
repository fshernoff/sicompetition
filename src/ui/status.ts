// The status line (BRIEF section 1, D50): the GM is a person going to work, so the line says where the GM is in its
// week and nothing about the engine underneath: no number, no weeks count, no "settled", nothing of the learner's.
// A pure function of the phase; the pilot prefixes its own label. WP2 (Sonnet).

/** Where the student's run stands: before a run, while the GM gets ready (the learner trains, out of sight), while
 * the week plays, after it, and after a plan edit cleared a run. */
export type StudentPhase = 'idle' | 'preparing' | 'playing' | 'done' | 'changed';

/**
 * One fixed sentence per phase:
 *   idle:      "Write your prediction, then put the GM to work."
 *   preparing: "The GM is getting ready for Monday."
 *   playing:   "The GM is running the week."
 *   done:      "The week is over." (G5d: the line says where the GM is, never narrates the layout)
 *   changed:   "The plan changed. Put the GM to work to see what it does with this one."
 */
export function studentStatus(phase: StudentPhase): string {
  switch (phase) {
    case 'idle':
      return 'Write your prediction, then put the GM to work.';
    case 'preparing':
      return 'The GM is getting ready for Monday.';
    case 'playing':
      return 'The GM is running the week.';
    case 'done':
      return 'The week is over.';
    case 'changed':
      return 'The plan changed. Put the GM to work to see what it does with this one.';
  }
}
