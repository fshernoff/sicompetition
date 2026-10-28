// The words a student never reads (CLAUDE.md, D45, D50, D53): none of the learner's words and none of the forbidden
// ones. One list for the static page (tests/ui/words.test.ts) and for everything the page shows while it runs, the
// canvas included (e2e/smoke.spec.ts).
export const STUDENT_BANS: readonly RegExp[] = [
  /episode/i, /ε/, /epsilon/i, /target met/i, /\bstable\b/i, /injur/i, /reward/i, /evaluation/i, /\bQ-?learn/i,
  /\bpoints?\b/i, /practi/i, /test week/i, /\btrain/i, /weights?\b/i, /\bseed\b/i, /\bspeed\b/i, /\bfast\b/i,
  /pacing/i, /\blearn/i, /settled/i, /routine/i, /\bweeks\b/i, /curve/i, /still changing/i,
];

/**
 * Phrases a ban would catch that a student may read: the product's name (the static test drops the <h1> for the
 * same reason) and the reputation measure's unit, dollars per point of reputation (the editor's words since G3; the
 * points ban is about the GM's bonus, which is dollars, D45). Removed from the text before the bans are checked.
 */
export const STUDENT_ALLOWED: readonly RegExp[] = [/Reward the Pack/g, /per point( of reputation gained)?/g];
