// The status line in the student's words (BRIEF section 1, D38): how many weeks the GM has practised and whether it
// has settled or is still changing its mind. Nothing of the learner's: no ε, no evaluation count, no seconds, no
// "paced", no "target met", no "episode". A pure function of the snapshot; the pilot prefixes its own label.
import type { TrainingSnapshot } from '../learn/train.ts';

/**
 * One of three sentences:
 *   running:            "The GM has practised 12,000 weeks so far and is still changing its mind."
 *   settled (stable):   "The GM practised 24,000 weeks and has settled on how it runs the week."
 *   ended, not settled: "The GM practised 150,000 weeks and is still changing its mind."
 *                       and, when the 60 s ran out first (outOfBudget and not stable):
 *                       "Time is up: the GM practised 72,000 weeks and is still changing its mind."
 * A run has ended when the snapshot is done or the budget is out. A settled run that crossed the budget in its last
 * slice says settled (the lateness is the pilot table's). Weeks are formatted en-US with commas; "1 week" singular.
 * The e2e waits for "has settled", so "settled" never appears before `s.stable`.
 */
export function studentStatus(s: TrainingSnapshot, outOfBudget: boolean): string {
  const weeks = `${s.episodes.toLocaleString('en-US')} ${s.episodes === 1 ? 'week' : 'weeks'}`;
  if (s.stable) return `The GM practised ${weeks} and has settled on how it runs the week.`;
  if (outOfBudget) return `Time is up: the GM practised ${weeks} and is still changing its mind.`;
  if (s.done) return `The GM practised ${weeks} and is still changing its mind.`;
  return `The GM has practised ${weeks} so far and is still changing its mind.`;
}
