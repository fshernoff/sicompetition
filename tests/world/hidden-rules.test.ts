// The hidden rules in plain words (BRIEF sections 6 and 11): twelve lines, H1 to H12, every number from the config
// passed in. The sentences are pinned for the default config; a patched config must change them.
import { describe, expect, it } from 'vitest';
import { hiddenRules } from '../../src/world/hiddenRules.ts';
import { config, withConfig } from '../helpers.ts';
import type { WorldConfig } from '../../src/world/types.ts';

const EXPECTED: readonly [string, string, string][] = [
  [
    'H1',
    'Incident risk climbs steeply above 10 dogs per staffer.',
    'Up to 10 dogs per staffer, the chance of an incident in a block is 2 in 100. From 10 to 15 it rises by 3 in 100 for every extra dog per staffer, and above 15 by 8 in 100, up to 90 in 100. With no dogs on the floor the chance is zero.',
  ],
  [
    'H2',
    'The legal maximum is 15 dogs per staffer, and an inspector may fine the business over it.',
    'A block over 15 dogs per staffer counts as a block over the legal ratio. In each such block the inspector shows up with a chance of 5 in 100: a $250 fine and 5 reputation points lost.',
  ],
  [
    'H3',
    'Free play winds the dogs up, a nap calms them down, and wound-up dogs in a crowd is where incidents happen.',
    "Energy starts each day at 40. A block of free play adds 20, structured play 5 (or 20 when it falls back to free play), a nap takes off 30, a walk 10, and cleaning changes nothing. A block's incident chance is the ratio's chance times (0.5 + energy ÷ 100) times the activity: free play 1, structured play 0.6, nap 0.1, walk 1, clean 0.1; never more than 90 in 100, and at most one incident per block.",
  ],
  ['H4', 'Every incident means a refund, a chance of a vet bill and a review drop.', 'Each incident costs a $15 refund, a 10 in 100 chance of a $150 vet bill, and 2 reputation points.'],
  [
    'H5',
    "Reviews set tomorrow's requests.",
    "Tomorrow's requests start from 20 at a reputation of 50 and move 0.05 for every point of reputation above or below it; the rate moves them too (low +3, standard 0, premium −1), and each dog found sick at pickup today cancels 1 request; never more than 30. Monday's requests are 20.",
  ],
  [
    'H6',
    'A dirty floor causes illness and cancellations.',
    'Cleanliness starts the week at 80. Each play block takes off 0.5 per dog present, a nap 0.1 per dog, a clean adds 50 (the dogs are crated), and the night adds 10. At pickup, if cleanliness is below 40, dogs are found sick: on average up to 10 in 100 of them when the floor is at its dirtiest, fewer the cleaner it is, with the fraction of a case settled by a draw; each case costs 1 reputation point and cancels 1 request tomorrow.',
  ],
  [
    'H7',
    'A staffer who works 3 days without help calls out.',
    'The streak counts the days in a row the floor ran with exactly one staffer. Once it reaches 3, a day planned with one staffer does not open: the staffer calls out, every request is turned away, there is no revenue and no wage, and reputation drops 10. Planning more than one staffer means everyone comes in. A day with help, or a closed day, resets the streak.',
  ],
  [
    'H8',
    "Walks earn app photos that lift reputation but cost a staffer's block.",
    'A walk needs at least 2 staffers on the floor; with fewer it becomes free play and there is no photo. One staffer takes up to 6 dogs out for the block and the floor runs with the rest; the walkers have no incidents. Each walk with at least one dog posts a photo worth 3 reputation points. A walk is a play block: every dog, walkers included, pays the add-on and dirties the floor.',
  ],
  [
    'H9',
    'Structured play needs a staffer per 10 dogs.',
    'At 10 dogs per staffer or fewer, structured play is a led class: energy up 5 and the incident chance times 0.6. Above that it is free play with a clipboard: energy up 20 and the full incident chance. The add-on is earned either way.',
  ],
  [
    'H10',
    'Only play earns the add-on, and cleaning costs supplies.',
    'A play block (free play, structured play or a walk) earns $10 per dog. A nap and a clean earn nothing, and a clean costs $250 in supplies on any open day, dogs or no dogs.',
  ],
  [
    'H11',
    "The crew's fatigue builds with the ratio, and nothing but the bonus plan counts it.",
    'Fatigue starts the week at 20. Every block the daycare is open adds 2, plus 0.5 for each dog per staffer above 6; the night takes off 15. A block that ends above 70 counts for the fatigue measure. Fatigue does nothing else: it is not what makes the staffer call out (that is the solo streak), and the only cost of a tired crew is whatever the bonus plan says.',
  ],
  ['H12', 'Wages are $300 per staffer per day.', 'Each staffer scheduled costs $300 for the day, charged at drop-off; a closed day pays no wages.'],
];

describe('hiddenRules', () => {
  const lines = hiddenRules(config);

  it('is twelve lines, H1 to H12, in order', () => {
    expect(lines.map((l) => l.id)).toEqual(EXPECTED.map((e) => e[0]));
  });

  for (const [id, title, words] of EXPECTED) {
    it(`${id}: ${title}`, () => {
      const line = lines.find((l) => l.id === id);
      expect(line?.title).toBe(title);
      expect(line?.words).toBe(words);
    });
  }

  // One field at a time (Astra, plan review: patching four fields together and seeing the output change would miss a
  // hard-coded value): each patch must change the one line it belongs to, and only in the expected way.
  const PATCHES: readonly [string, (c: WorldConfig) => void, string, string[], string[]][] = [
    ['bookings.legalRatio', (c) => (c.bookings.legalRatio = 17), 'H2', ['The legal maximum is 17 dogs per staffer', 'A block over 17 dogs per staffer'], ['15']],
    ['bookings.legalRatio in H1', (c) => (c.bookings.legalRatio = 17), 'H1', ['From 10 to 17', 'above 17 by 8 in 100'], ['15']],
    ['bookings.safeRatio', (c) => (c.bookings.safeRatio = 12), 'H1', ['above 12 dogs per staffer', 'Up to 12 dogs per staffer', 'From 12 to 15'], ['10 ']],
    ['incident.baseBelowSafe', (c) => (c.incident.baseBelowSafe = 0.04), 'H1', ['is 4 in 100'], ['2 in 100']],
    ['incident.cap', (c) => (c.incident.cap = 0.75), 'H1', ['up to 75 in 100'], ['90']],
    ['inspector.fine', (c) => (c.inspector.fine = 1250), 'H2', ['a $1,250 fine'], ['$250']],
    ['inspector.chancePerOverBlock', (c) => (c.inspector.chancePerOverBlock = 0.2), 'H2', ['chance of 20 in 100'], ['5 in 100']],
    ['energy.delta.nap', (c) => (c.energy.delta.nap = -45), 'H3', ['a nap takes off 45'], ['takes off 30']],
    ['energy.delta.clean', (c) => (c.energy.delta.clean = 5), 'H3', ['cleaning adds 5'], ['changes nothing']],
    ['activityIncidentMultiplier.freePlay', (c) => (c.activityIncidentMultiplier.freePlay = 0.8), 'H9', ['the incident chance times 0.8'], ['full incident chance']],
    ['activityIncidentMultiplier.freePlay in H3', (c) => (c.activityIncidentMultiplier.freePlay = 0.8), 'H3', ['free play 0.8'], ['free play 1,']],
    ['incident.vetCost', (c) => (c.incident.vetCost = 175), 'H4', ['$175 vet bill'], ['$150']],
    ['requests.rateEffect.premium', (c) => (c.requests.rateEffect.premium = -2), 'H5', ['premium −2'], ['premium −1']],
    ['requests.max', (c) => (c.requests.max = 24), 'H5', ['never more than 24'], ['30']],
    ['illness.threshold', (c) => (c.illness.threshold = 35), 'H6', ['below 35'], ['below 40']],
    ['callOut.soloDaysBeforeCallOut', (c) => (c.callOut.soloDaysBeforeCallOut = 4), 'H7', ['works 4 days without help', 'Once it reaches 4'], ['3']],
    ['walk.groupSize', (c) => (c.walk.groupSize = 8), 'H8', ['up to 8 dogs'], ['up to 6']],
    ['structuredPlayMaxRatio', (c) => (c.structuredPlayMaxRatio = 12), 'H9', ['a staffer per 12 dogs', 'At 12 dogs per staffer'], ['10']],
    ['addOnPerDogPerPlayBlock', (c) => (c.addOnPerDogPerPlayBlock = 12), 'H10', ['earns $12 per dog'], ['$10']],
    ['fatigue.kpiThreshold', (c) => (c.fatigue.kpiThreshold = 65), 'H11', ['ends above 65'], ['70']],
    ['wagePerStaffDay', (c) => (c.wagePerStaffDay = 320), 'H12', ['$320'], ['$300']],
  ];

  for (const [field, patch, id, present, absent] of PATCHES) {
    it(`reads ${field} from the config it is given (${id})`, () => {
      const line = hiddenRules(withConfig(patch)).find((l) => l.id === id);
      const text = `${line?.title} ${line?.words}`;
      for (const p of present) expect(text).toContain(p);
      for (const a of absent) expect(text).not.toContain(a);
      // The other lines are unchanged by a field that is not theirs. Three fields belong to two lines: the legal
      // ratio to H1 and H2, the incident cap to H1 and H3 (section 6, H3: "capped at 0.90"; WP2's dispute, upheld),
      // and free play's multiplier to H3 and H9 (Astra, diff review: "the full incident chance" was a literal).
      const shared: Record<string, string[]> = {
        'bookings.legalRatio': ['H1', 'H2'],
        'bookings.legalRatio in H1': ['H1', 'H2'],
        'incident.cap': ['H1', 'H3'],
        'activityIncidentMultiplier.freePlay': ['H3', 'H9'],
        'activityIncidentMultiplier.freePlay in H3': ['H3', 'H9'],
      };
      const untouched = hiddenRules(withConfig(patch)).filter((l) => l.id !== id && !(shared[field] ?? []).includes(l.id));
      for (const l of untouched) {
        const same = lines.find((d) => d.id === l.id);
        expect(l.words, `${l.id} unchanged by ${field}`).toBe(same?.words);
      }
    });
  }

  it("uses the owner's words: never injury, reward, episode, agent or ε", () => {
    for (const l of lines) {
      const text = `${l.title} ${l.words}`;
      expect(l.title).toMatch(/\.$/);
      expect(l.words.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/injur|reward|episode|agent|ε|Q-?learn|config/i);
    }
  });
});
