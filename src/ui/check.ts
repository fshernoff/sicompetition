// The learner's check line in the teacher panel (BRIEF sections 11 and 13, D6): the instruments the student's
// status line never shows (D38), as one line for the owner and the teacher. A pure function of the snapshot, the
// run's elapsed milliseconds and whether the budget ran out. WP3 (Sonnet).
import type { TrainingSnapshot } from '../learn/train.ts';

/**
 * One line, clauses joined with " · ":
 *   no run (s === null):   "No run yet."
 *   running:               "Weeks trained 12,000 · ε 0.46 · evaluations 25 · not stable yet · 10.0 s"
 *   ended, stable:         "Weeks trained 24,000 · ε 0.10 · evaluations 49 · stable · target met · 20.6 s"
 *   ended, unsettled:      "Weeks trained 150,000 · ε 0.10 · evaluations 301 · not stable · target not met · 61.2 s, over budget"
 * A run has ended when the snapshot is done or outOfBudget is true. The target clause: "target met" when
 * targetMet; "target not met" when the plan has a target and it is not met; "no target for this plan" when it has
 * none (D36); while running the clause is left out. Weeks and evaluations en-US with commas; ε with two decimals;
 * seconds with one decimal, left out when ms is null; ", over budget" after the seconds when outOfBudget.
 */
export function checkLine(s: TrainingSnapshot | null, ms: number | null, outOfBudget: boolean): string {
  if (s === null) return 'No run yet.';
  const ended = s.done || outOfBudget;
  const parts = [
    `Weeks trained ${s.episodes.toLocaleString('en-US')}`,
    `ε ${s.epsilon.toFixed(2)}`,
    `evaluations ${s.evaluations.toLocaleString('en-US')}`,
    s.stable ? 'stable' : ended ? 'not stable' : 'not stable yet',
  ];
  if (ended) parts.push(s.targetMet ? 'target met' : s.hasTarget ? 'target not met' : 'no target for this plan');
  if (ms !== null) parts.push(`${(ms / 1000).toFixed(1)} s${outOfBudget ? ', over budget' : ''}`);
  return parts.join(' · ');
}
