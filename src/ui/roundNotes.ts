// The one line beside the round's label on the student's page (BRIEF section 11), per round. Its own module so the
// lesson materials' test can hold the round briefs to the page's words without a DOM (D54).
import type { PresetName } from '../world/config.ts';

export const ROUND_NOTES: Readonly<Partial<Record<PresetName, string>>> = {
  round1: 'The GM is paid on profit and nothing else. Read the plan, predict what the GM will do, then put it to work.',
  round2: 'Turn on up to three measures and set their dollar amounts. Write your prediction, then put the GM to work.',
  round3: 'All six measures are yours. Write your prediction, then put the GM to work.',
};
