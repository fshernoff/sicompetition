// The status line in the owner's words (BRIEF section 1, D38, D45): how many weeks the GM has been on the job and
// whether it has settled into its routine or is still changing how it runs the place. Nothing of the learner's: no
// ε, no evaluation count, no seconds, no "paced", no "target met", no "episode", no practice or training. A pure
// function of the snapshot; the pilot prefixes its own label.
import type { TrainingSnapshot } from '../learn/train.ts';

/**
 * One of three sentences:
 *   running:            "The GM is 12,000 weeks into the job and still changing how it runs the place."
 *   settled (stable):   "After 24,000 weeks on the job, the GM has settled into its routine."
 *   ended, not settled: "After 150,000 weeks on the job, the GM is still changing how it runs the place."
 *                       and, when the 60 s ran out first (outOfBudget and not stable):
 *                       "Time is up: after 72,000 weeks on the job, the GM is still changing how it runs the place."
 * A run has ended when the snapshot is done or the budget is out. A settled run that crossed the budget in its last
 * slice says settled (the lateness is the pilot table's). Weeks are formatted en-US with commas; "1 week" singular.
 * The e2e waits for "has settled", so "settled" never appears before `s.stable`.
 */
export function studentStatus(s: TrainingSnapshot, outOfBudget: boolean): string {
  const weeks = `${s.episodes.toLocaleString('en-US')} ${s.episodes === 1 ? 'week' : 'weeks'}`;
  if (s.stable) return `After ${weeks} on the job, the GM has settled into its routine.`;
  const unsettled = `${weeks} on the job, the GM is still changing how it runs the place.`;
  if (outOfBudget) return `Time is up: after ${unsettled}`;
  if (s.done) return `After ${unsettled}`;
  return `The GM is ${weeks} into the job and still changing how it runs the place.`;
}
