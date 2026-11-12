/**
 * The technology's word is SI, the Challenge's, never "AI" (D67): on the whole page (the teacher's parts too) and on
 * every lesson sheet. Whole words in any case, so "OpenAI", "said" and "Thai" pass; "AI's", "AIs", "ai" and "Ai" do not.
 */
export const AI_WORDS: readonly RegExp[] = [/\bAIs?\b/i, /\bA\.I\b/i, /\bartificial intelligence\b/i];

/** What may keep the word: titles of cited works (and the address that carries one) and company or product names, as published (D67). Nothing else. */
export const AI_ALLOWED: readonly RegExp[] = [
  /Concrete Problems in AI Safety/g,
  /the flip side of AI ingenuity/gi,
  /specification-gaming-the-flip-side-of-ai-ingenuity/g,
  /\bOpenAI\b/g,
];

/** The banned words a text uses, as the matches found, with the allowed titles and names taken out first. */
export function aiWords(text: string): string[] {
  const t = AI_ALLOWED.reduce((acc, phrase) => acc.replace(phrase, ' '), text);
  return AI_WORDS.flatMap((word) => Array.from(t.matchAll(new RegExp(word.source, `${word.flags}g`)), (m) => m[0]));
}

// The words a student never reads (CLAUDE.md, D45, D50, D53, D67): none of the learner's words, none of the forbidden
// ones and never "AI". One list for the static page (tests/ui/words.test.ts) and for everything the page shows while
// it runs, the canvas included (e2e/smoke.spec.ts).
export const STUDENT_BANS: readonly RegExp[] = [
  ...AI_WORDS,
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
