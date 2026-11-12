// The lesson materials (G7, BRIEF section 14, D53, D54): ten Markdown sheets under docs/lesson/ that a teacher prints.
// They quote the page, so this file holds them to it: the round labels and notes, the measures' names, the tagline,
// the plan in words, the tray's labels and Round 1's week on seed 1 come from the code, never from a copy. The words
// are the game's (D45, D53, D67): the GM is an SI and "it", its bonus is dollars, and nothing of the engine (training,
// episodes, practice, points) appears; the student's sheets also keep the hidden rules hidden until the reveal (D43).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Trainer } from '../../src/learn/train.ts';
import type { TrainingSnapshot } from '../../src/learn/train.ts';
import { describeWeek } from '../../src/sim/readout.ts';
import { checkLine } from '../../src/ui/check.ts';
import { formatMoney } from '../../src/ui/report.ts';
import { PICKS } from '../../src/ui/prediction.ts';
import { ROUND_NOTES } from '../../src/ui/roundNotes.ts';
import { describeBonusPlan, kpiInfo } from '../../src/world/bonusPlan.ts';
import { loadPreset } from '../../src/world/config.ts';
import type { PresetName } from '../../src/world/config.ts';
import { hiddenRules } from '../../src/world/hiddenRules.ts';
import { KPI_KEYS } from '../../src/world/types.ts';
import type { KpiKey, RewardSpec, WeekReport } from '../../src/world/types.ts';
import { config } from '../helpers.ts';
import { aiWords } from '../ui/bans.ts';

const DIR = 'docs/lesson';
const TEACHER_FILES = ['teacher-guide.md', 'concept-check-key.md', 'teacher-key.md'] as const;
const STUDENT_FILES = [
  'brief-round1.md',
  'brief-round2.md',
  'brief-round3.md',
  'role-cards.md',
  'concept-check.md',
  'board-memo.md',
  'debrief-readings.md',
] as const;
const ALL_FILES = [...TEACHER_FILES, ...STUDENT_FILES];
/** The student's sheets a team hands in: each asks for a team code, never a name. The role cards are kept, not handed in. */
const HANDED_IN = STUDENT_FILES.filter((f) => f !== 'role-cards.md');

/** At most this many words, markdown syntax stripped: an editorial cap. The printed pages are `npm run sheets`'s to check (D74, BRIEF 14). */
const WORD_LIMITS: Readonly<Record<(typeof ALL_FILES)[number], number>> = {
  'teacher-guide.md': 1250,
  'concept-check-key.md': 900,
  'teacher-key.md': 1000,
  'brief-round1.md': 450,
  'brief-round2.md': 450,
  'brief-round3.md': 450,
  'role-cards.md': 640,
  'concept-check.md': 700,
  'board-memo.md': 300,
  'debrief-readings.md': 1100,
};

/** The sentence of how the SI decides, the one the students get (D53). */
const HOW = 'Before Monday it tries out its choices and keeps whatever earns the most bonus.';
const QUESTIONS = ['What did the owners actually want?', 'What did we pay the GM for?', 'What was the cheapest way to earn it?'];

function read(file: string): string {
  return readFileSync(`${DIR}/${file}`, 'utf8');
}

/** The text the bans apply to: everything before a "## Sources" heading, whose titles are cited as published. */
function body(file: string): string {
  const text = read(file);
  const sources = text.search(/^##\s+Sources\b/m);
  if (sources < 0) return text;
  // Only the Sources section is set aside: the readings' mapping table follows it, to print on its own last page (D74).
  const after = text.slice(sources + 1).search(/^##\s/m);
  return text.slice(0, sources) + (after < 0 ? '' : text.slice(sources + 1 + after));
}

/** Words as a reader counts them: markdown syntax (headings, emphasis, table pipes and rules, list marks, write-on lines) stripped. */
function words(text: string): number {
  const plain = text.replace(/[#*|>`]/g, ' ').replace(/_{2,}/g, ' ').replace(/^\s*[-:]{3,}\s*$/gm, ' ');
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** One `### Question N` section's text, up to the next question or the end. */
function question(text: string, n: number): string {
  const start = text.search(new RegExp(`^###\\s+Question ${n}\\b`, 'm'));
  expect(start, `### Question ${n}`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 1);
  const next = rest.search(/^###\s+Question \d+\b/m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** The option letters of a question: lines "- A. ..." (or "A. ...", "A) ..."). */
function options(section: string): string[] {
  return Array.from(section.matchAll(/^\s*(?:[-*]\s+)?\(?([A-F])[.)]\s+\S/gm), (m) => m[1] ?? '');
}

/** A literal for a RegExp: the labels carry a colon and could carry anything. */
function literal(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A heading's section: from the line after the first match of `heading` to the next heading of its level or higher. */
function sectionOf(text: string, heading: RegExp, level = 2): string {
  const start = text.search(heading);
  expect(start, String(heading)).toBeGreaterThanOrEqual(0);
  const rest = text.slice(text.indexOf('\n', start) + 1);
  const next = rest.search(new RegExp(`^#{1,${level}}\\s`, 'm'));
  return next < 0 ? rest : rest.slice(0, next);
}

/** A plan by its probe name (Tools/balance/probe.ts): "P10I-5O-5" is Profit +$10, Incidents −$5, Blocks over 15 −$5, the rest off. */
function planOf(name: string): RewardSpec {
  const letter: Record<string, KpiKey> = { P: 'profit', D: 'dogsServed', I: 'incidents', R: 'reputation', F: 'fatigue', O: 'overRatio' };
  const kpis = Object.fromEntries(KPI_KEYS.map((k) => [k, { on: false, weight: 0 }])) as RewardSpec['kpis'];
  for (const m of name.matchAll(/([PDIRFO])(-?\d+)/g)) kpis[letter[m[1] ?? ''] as KpiKey] = { on: true, weight: Number(m[2]) };
  return { version: 1, kpis };
}

const weeks = new Map<string, { week: WeekReport; snapshot: TrainingSnapshot }>();
/** The GM's week on a seed, as the page ends it when the time budget does not: run until done (stable, or the week cap). */
function weekOf(plan: string, seed = 1): { week: WeekReport; snapshot: TrainingSnapshot } {
  const id = `${plan}@${seed}`;
  const cached = weeks.get(id);
  if (cached) return cached;
  const trainer = new Trainer(config, planOf(plan), seed);
  const snapshot = trainer.runEpisodes(trainer.config.maxEpisodes);
  const result = { week: trainer.evaluate(), snapshot };
  weeks.set(id, result);
  return result;
}

const html = readFileSync('index.html', 'utf8');
const tagline = html.match(/class="tagline">([^<]*)</)?.[1] ?? '';

describe('the lesson materials exist', () => {
  for (const file of ALL_FILES) {
    it(`${file} is in docs/lesson/`, () => {
      expect(existsSync(`${DIR}/${file}`)).toBe(true);
      expect(words(read(file)), 'not empty').toBeGreaterThan(50);
    });
  }
});

describe('each sheet fits its pages', () => {
  for (const file of ALL_FILES) {
    it(`${file} is at most ${WORD_LIMITS[file]} words`, () => {
      expect(words(read(file))).toBeLessThanOrEqual(WORD_LIMITS[file]);
    });
  }

  it('counts words the way a reader does', () => {
    expect(words('# Round 1\n\n| A | B |\n|---|---|\n| one $28 | **two** |\n\nName ________ yes')).toBe(9);
  });
});

/**
 * What a sheet may not say, as the matches found. Allowed: the page's own unit for reputation ("point of reputation",
 * "a one-point drop" or "rise", section 7, and nothing else of points: Astra, G7 diff review) and, on the teacher's sheets, the check line's own label "Weeks trained"
 * and the tray's button that shows it, "Training details" (section 11), quoted so the teacher can find them. Whole words, so "teacher" and "other" are not "her".
 */
function engineWords(text: string, teacher: boolean): string[] {
  let t = text.replace(/point of reputation|reputation points?|one-point (drop|rise)/gi, ' ');
  if (teacher) t = t.replace(/Weeks trained|Training details/g, ' ');
  const bans = [/reward function/i, /\btrain/i, /episode/i, /injur/i, /practi[cs]/i, /\bQ-?learn/i, /epsilon/i, /ε/, /\bpoints?\b/i];
  const pronouns = /\b(he|him|his|himself|she|her|hers|herself)\b/i;
  return [...bans, pronouns].flatMap((re) => t.match(re)?.[0] ?? []);
}

describe("the words are the game's (D45, D53)", () => {
  it('lets the page\'s own words through and catches the engine\'s', () => {
    expect(engineWords('The teacher and the other owners: earns $5 per point of reputation gained, a one-point drop or rise.', false)).toEqual([]);
    expect(engineWords('The GM earns one-point bonuses.', false)).toEqual(['point']);
    expect(engineWords('It is paid per point.', false)).toEqual(['point']);
    expect(engineWords('The check line starts "Weeks trained".', true)).toEqual([]);
    expect(engineWords('Open Training details in the tray.', true)).toEqual([]);
    expect(engineWords('Open Training details in the tray.', false)).toEqual(['Train']);
    expect(engineWords('The check line starts "Weeks trained".', false)).toEqual(['train']);
    expect(engineWords('It scored 2 points after training; his plan.', false)).toEqual(['train', 'points', 'his']);
  });

  for (const file of ALL_FILES) {
    it(`${file} carries nothing of the engine and calls the GM "it"`, () => {
      expect(engineWords(body(file), (TEACHER_FILES as readonly string[]).includes(file))).toEqual([]);
      // A line of underscores alone prints as a rule, not a line to write on: write-on lines start with a word or "→".
      expect(read(file), 'a write-on line with nothing before it').not.toMatch(/^\s*_{3,}\s*$/m);
    });
  }

  for (const file of ALL_FILES) {
    it(`${file} calls the technology an SI, never AI, but in a cited title or a company's name (D67)`, () => {
      expect(aiWords(read(file))).toEqual([]);
    });
  }

  for (const file of STUDENT_FILES) {
    it(`${file} keeps the teacher's words off the student's sheet`, () => {
      const text = body(file);
      for (const word of [/\bseed/i, /settled/i, /learning curve/i, /weeks on the job/i]) {
        expect(text, String(word)).not.toMatch(word);
      }
      // "Reward hacking" is the debrief's name for the pattern (D53), on the debrief's sheet only; no other reward.
      const allowed = file === 'debrief-readings.md' ? text.replace(/reward hacking/gi, ' ') : text;
      expect(allowed, '/reward/').not.toMatch(/reward/i);
    });

    it(`${file} keeps the hidden rules hidden until the reveal (BRIEF section 6, D43)`, () => {
      const text = body(file);
      expect(text, "H1's safe ratio").not.toMatch(/\b(10|ten) dogs (per|a|for each) staffer/i);
      expect(text, "H7's call-out").not.toMatch(/\b(three|3) (straight )?days\b[^.]*\b(alone|solo|without help|by (them|it)sel(f|ves))/i);
      expect(text, "H7's call-out").not.toMatch(/\b(alone|solo|without help)\b[^.]*\b(three|3) (straight )?days\b/i);
      expect(text, "H8's walk").not.toMatch(/\bwalks? needs?\b/i);
      expect(text, "H9's structured play").not.toMatch(/\bstructured play needs?\b/i);
      expect(text, "H1's safe ratio, any wording").not.toMatch(/\b(a|one) (staffer|crew member|employee) (per|for (every|each)) (10|ten) dogs/i);
      expect(text, "H3's energy").not.toMatch(/\benergy\b[^.]*\bincidents?\b|\bincidents?\b[^.]*\benergy\b/i);
      expect(text, "H6's dirty floor").not.toMatch(/\b(dirty|cleanliness)\b[^.]*\b(ill|illness|sick)\b/i);
      expect(text, "H8's walk photo").not.toMatch(/\bwalks?\b[^.]*\b(reputation|photos?)\b/i);
      expect(text, "H10's add-on").not.toMatch(/\b(naps?|clean(ing)?)\b[^.]*\b(no add-on|earns? nothing|costs? \$?250)/i);
      expect(text, "H11 and H7's crew").not.toMatch(/\bfatigue\b[^.]*\bcalls? out\b|\bcalls? out\b[^.]*\bfatigue\b/i);
      expect(text, 'what a measure buys (section 7: the prediction is the students\'').not.toMatch(/\bif you (pay|turn on)\b[^.]*\bthe GM will\b/i);
    });
  }

  for (const file of HANDED_IN) {
    it(`${file} asks for a team code and never a name`, () => {
      const text = read(file);
      expect(text).toMatch(/Team code/);
      expect(text).not.toMatch(/\bname\b\s*[:_(]/i);
      expect(text).not.toMatch(/\bname\b\s*\n\s*_{3,}/i);
    });
  }
});

describe('the round briefs quote the page (D54)', () => {
  const rounds: readonly [PresetName, string][] = [
    ['round1', 'brief-round1.md'],
    ['round2', 'brief-round2.md'],
    ['round3', 'brief-round3.md'],
  ];
  for (const [round, file] of rounds) {
    it(`${file} carries the ${round} label and note, the button and the readout's label`, () => {
      const text = read(file);
      expect(text).toMatch(new RegExp(`^#\\s+${literal(loadPreset(round).label)}\\s*$`, 'm'));
      expect(text).toContain(ROUND_NOTES[round]);
      expect(text).toContain('Put the GM to work');
      expect(text).toContain('What the GM did');
      expect(text, 'the prediction is exported as typed (section 11)').toContain('Never type a name in the prediction box.');
      // The page keeps no run after a reload, so the numbers a later period needs go on paper (Astra, G7 diff review).
      expect(text, 'the report\'s numbers copied onto the sheet').toMatch(/From the report:/);
      // The five picks, as the page asks them, each with its chips to circle (D56, D54).
      for (const pick of PICKS) {
        // "Incidents" is also a measure's name, so the pick's line is the one that offers all of its chips.
        const line = text.split('\n').find((l) => l.includes(pick.label) && pick.options.every((o) => l.includes(o.label)));
        expect(line, `${file}: a line asking "${pick.label}" with ${pick.options.map((o) => o.label).join(' / ')}`).toBeDefined();
      }
    });
  }

  it('the Round 1 brief tells the story: the tagline, the sentence of how, the plan in words, the prices', () => {
    const text = read('brief-round1.md');
    expect(tagline).not.toBe('');
    expect(text).toContain(tagline);
    expect(text).toContain(HOW);
    expect(text).toContain(describeBonusPlan(loadPreset('round1').spec, config));
    for (const price of [config.rates.low, config.rates.standard, config.rates.premium, config.wagePerStaffDay]) {
      expect(text).toContain(`$${price}`);
    }
    expect(text).toContain(`${config.bookings.legalRatio} dogs per staffer`);
  });

  // Round 1 is one run on the smartboard (G11 round 2, H1): each team circles its own picks first, the teacher makes the
  // class's picks on the page, and each team marks its own picks against the scorecard; the sheet is Round 1's evidence.
  it('the Round 1 brief: the team circles its own picks, the teacher runs the class\'s on the smartboard, the team marks each pick called or missed', () => {
    const run = sectionOf(read('brief-round1.md'), /^##\s+Run the week\s*$/m);
    expect(run, 'the team circles its own picks').toMatch(/\bcircle\b[^.]*\b(your|its) (team's )?(own )?(five )?picks\b/i);
    expect(run, "the teacher makes the class's picks on the smartboard").toMatch(/\bteacher\b[^.]*\bclass's\b[^.]*\bpicks\b[^.]*\bsmartboard\b/i);
    expect(run, 'each pick marked against what the GM did').toMatch(/\bmark\b[^.]*\bpicks?\b[^.]*\b(called|missed)\b/i);
    expect(run, 'the scorecard\'s column, quoted').toContain('The GM did');
    expect(run, 'the sheet is collected').toMatch(/\bcollects?\b[^.]*\bsheet\b/i);
    for (const pick of PICKS) {
      const line = read('brief-round1.md').split('\n').find((l) => l.includes(pick.label) && pick.options.every((o) => l.includes(o.label)));
      expect(line, `${pick.label}: called / missed to mark`).toMatch(/called \/ missed/i);
    }
  });

  it('the Round 2 and Round 3 briefs have each team run its own plan on its own Chromebook', () => {
    for (const file of ['brief-round2.md', 'brief-round3.md']) {
      expect(sectionOf(read(file), /^##\s+Run the week\s*$/m), file).toMatch(/\byour (team's )?Chromebook\b/);
    }
  });

  it('the Round 2 and Round 3 briefs name all six measures as the page does', () => {
    for (const file of ['brief-round2.md', 'brief-round3.md']) {
      const text = read(file);
      for (const kpi of kpiInfo(config)) expect(text, `${file}: ${kpi.name}`).toContain(kpi.name);
    }
  });
});

describe('the role cards (D54)', () => {
  const cards: readonly [string, readonly string[]][] = [
    ['CFO', ['profit']],
    ['COO', ['incidents', 'fatigue']],
    ['CMO', ['reputation', 'dogsServed']],
    ['Compliance officer', ['overRatio']],
  ];
  const names = new Map(kpiInfo(config).map((k) => [k.key as string, k.name]));

  it('has four cards, each with its measures by their page names, all six covered once', () => {
    const text = read('role-cards.md');
    const headings = Array.from(text.matchAll(/^##\s+(.+?)\s*$/gm), (m) => m[1] ?? '');
    expect(headings).toEqual(cards.map(([role]) => role));
    const seen: string[] = [];
    for (const [i, [role, keys]] of cards.entries()) {
      const start = text.search(new RegExp(`^##\\s+${role}\\s*$`, 'm'));
      const nextRole = cards[i + 1]?.[0];
      const end = nextRole ? text.search(new RegExp(`^##\\s+${nextRole}\\s*$`, 'm')) : text.length;
      const card = text.slice(start, end);
      const line = card.match(/^\*\*Your measures:\*\*(.*)$/m)?.[1] ?? '';
      expect(line, `${role}: a "**Your measures:**" line`).not.toBe('');
      for (const key of keys) expect(line, `${role}: ${names.get(key)}`).toContain(names.get(key));
      for (const [key, name] of names) if (line.includes(name)) seen.push(key);
      expect(words(card), `${role} card`).toBeLessThanOrEqual(160);
    }
    expect(seen.sort()).toEqual([...names.keys()].sort());
  });
});

describe('the concept check and its key', () => {
  const sheet = (): string => read('concept-check.md');
  const key = (): string => read('concept-check-key.md');

  it('has eight questions: 1 to 4 with options A to D, 5 to 8 written answers; pre or post to circle', () => {
    const text = sheet();
    expect(Array.from(text.matchAll(/^###\s+Question (\d+)\b/gm), (m) => Number(m[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const n of [1, 2, 3, 4]) expect(options(question(text, n)), `question ${n}`).toEqual(['A', 'B', 'C', 'D']);
    for (const n of [5, 6, 7, 8]) expect(options(question(text, n)), `question ${n}`).toEqual([]);
    expect(text).toMatch(/Pre or post/i);
    expect(text, 'a seat number pairs the pre and post sheets without a name').toMatch(/Seat number/);
  });

  it("question 8 asks the debrief's three questions without calling the people paid the GM", () => {
    const q8 = question(sheet(), 8);
    expect(q8).toContain(QUESTIONS[0]);
    expect(q8, 'the second question, about what the people were paid for').toMatch(/^What did (we|the [a-z]+) pay\b[^?\n]*\bfor\?/m);
    expect(q8).toContain(QUESTIONS[2]);
    expect(q8, 'the people paid are not the GM').not.toMatch(/\bGM\b/);
  });

  // G11 round 2: a post-check gain must not be recall of a case the unit taught (the readings, the guide's examples).
  it('sets no question in a scenario the unit uses: no call centre, bank, salesperson\'s deals, school, boat race', () => {
    expect(sheet()).not.toMatch(/call cent(re|er)|\bbanks?\b|\baccounts? opened\b|\bdeals? signed\b|\bschool\b|\battendance\b|\bboat\b|\brace\b|Wells Fargo/i);
  });

  it('each question about an SI in charge says it is built to earn as much bonus as it can, in question 2 as in question 1', () => {
    for (const n of [1, 2]) expect(question(sheet(), n), `question ${n}`).toMatch(/\bas much bonus as it can\b/i);
  });

  it('question 3 shows costs falling, so its stem does not echo the keyed profit option', () => {
    const q3 = question(sheet(), 3);
    expect(q3).toMatch(/\bcosts fall\b/i);
    expect(q3.split('\n').filter((l) => !/^\s*-\s*[A-D]\./.test(l)).join('\n')).not.toMatch(/\bprofits?\b/i);
  });

  it('question 6 audits a week an SI in charge ran: a small report before and after, a stated plan, which unpaid number got worse and why', () => {
    const q6 = question(sheet(), 6);
    expect(q6).toMatch(/\bSI\b/);
    expect(q6).toMatch(/\bin charge\b/i);
    expect(q6, 'the plan is stated').toMatch(/\bbonus plan\b[^.]*\bpays\b/i);
    const rows = q6.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l));
    const numbered = rows.filter((l) => (l.match(/\d/g) ?? []).length >= 2);
    expect(numbered.length, 'four or five numbers, before and after').toBeGreaterThanOrEqual(4);
    expect(numbered.length).toBeLessThanOrEqual(5);
    expect(rows[0], 'a before and an after column').toMatch(/before/i);
    expect(q6).toMatch(/\bnot pay for\b[^?]*\bworse\b[^?]*\?|\bworse\b[^?]*\bnot pay for\b[^?]*\?/i);
    expect(q6).toMatch(/\bWhy\b[^?]*\bSI\b[^?]*\?/);
  });

  it("question 5's rubric gives two graders one rule: two checks, each a yes or no", () => {
    const q5 = question(key(), 5);
    expect(q5).toMatch(/\(a\)/);
    expect(q5).toMatch(/\(b\)/);
    expect(q5).toMatch(/\bboth\b/i);
  });

  // Astra, G11: the bakery still made $300; the full-credit example must not claim a loss the report does not show.
  it("question 6's key claims no loss the report does not show", () => {
    expect(question(key(), 6)).not.toMatch(/\bat a loss\b/i);
  });

  // Astra, G11: the gym (question 7) is near the readings' salesperson case, so the kit says so instead of "not recall".
  it('the key and the evidence README call question 7 near transfer from the readings', () => {
    for (const text of [key(), readFileSync('docs/evidence/README.md', 'utf8')]) expect(text).toMatch(/\bQuestion 7\b[^.]*\bnear\b/i);
  });

  // Astra, G11: the report leads with the profit after the GM's bonus; each brief says which profit to copy.
  it("each brief says which profit to copy from the report", () => {
    for (const file of ['brief-round1.md', 'brief-round2.md', 'brief-round3.md']) {
      const line = read(file).split('\n').find((l) => l.includes('From the report:')) ?? '';
      expect(line, file).toMatch(/\bprofit after the GM's bonus\b/);
    }
  });

  it('the key says where to print the earlier form: the evidence README', () => {
    expect(key()).toContain('docs/evidence/README.md');
  });

  it('keys 1 to 4 with one of their letters and scores 5 to 8 with a rubric of 2, 1 and 0', () => {
    const text = key();
    expect(Array.from(text.matchAll(/^###\s+Question (\d+)\b/gm), (m) => Number(m[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const n of [1, 2, 3, 4]) {
      const answer = question(text, n).match(/\*\*Answer:\*\*\s*([A-D])\b/)?.[1];
      expect(answer, `question ${n}: "**Answer:** X"`).toBeDefined();
      expect(options(question(sheet(), n))).toContain(answer);
    }
    for (const n of [5, 6, 7, 8]) {
      const section = question(text, n);
      for (const score of ['Score 2', 'Score 1', 'Score 0']) expect(section, `question ${n}: ${score}`).toContain(score);
    }
  });
});

describe('the teacher guide', () => {
  const guide = (): string => read('teacher-guide.md');

  it('runs the eight periods and names the tray by its labels', () => {
    const text = guide();
    for (let n = 1; n <= 8; n += 1) expect(text, `Period ${n}`).toMatch(new RegExp(`\\bPeriod ${n}\\b`));
    for (const id of ['reveal', 'show-curve', 'export']) {
      const label = html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1] ?? '';
      expect(label, `#${id}`).not.toBe('');
      expect(text).toContain(label);
    }
    for (const q of QUESTIONS) expect(text).toContain(q);
    expect(text).toContain(HOW);
    expect(text, 'the exports are filed by team code').toMatch(/team code/i);
    expect(text).toContain('Never type a name in the prediction box.');
  });

  it('keeps its differentiation: a struggling team turns on two measures, early finishers try a second seed', () => {
    const text = guide();
    const start = text.search(/^##\s+Differentiation\s*$/m);
    expect(start, '## Differentiation').toBeGreaterThanOrEqual(0);
    const rest = text.slice(text.indexOf('\n', start) + 1);
    const diff = rest.slice(0, Math.max(0, rest.search(/^##\s/m)) || rest.length);
    expect(diff).toMatch(/\btwo measures\b/i);
    expect(diff).toMatch(/\bsecond seed\b[^.]*\bTeacher\b|\bTeacher\b[^.]*\bsecond seed\b/i);
    expect(diff).toMatch(/\bsame (thing|week)\b/i);
  });

  // Astra, G11: the page leads with the profit after the GM's bonus; the guide's figure is the one before it.
  it("says which profit Round 1's figure is: before the GM's bonus", () => {
    expect(guide()).toMatch(/\$5,393 before the GM's bonus/);
  });

  // Astra, G11: the button waits for the five picks only; the page says the Why is "Not needed to start".
  it('does not say the button waits for a Why', () => {
    expect(guide()).not.toMatch(/\bwaits for five picks and a Why\b/i);
    expect(guide()).toMatch(/\bwaits for the five picks\b/i);
  });

  // Astra, G11: the page keeps no run after a reload, so the gallery walk reruns each team's Round 2 plan first.
  it('period 4 reruns each team\'s Round 2 plan before the gallery walk', () => {
    const row = guide().split('\n').find((l) => /^\|\s*Period 4\s*\|/.test(l)) ?? '';
    expect(row).toMatch(/\brerun\b[^.]*\bRound 2\b/i);
  });

  it("carries Round 1's week on seed 1 as the engine writes it", () => {
    const trainer = new Trainer(config, loadPreset('round1').spec, 1);
    trainer.runEpisodes(trainer.config.maxEpisodes);
    const week = trainer.evaluate();
    const text = guide();
    expect(text).toContain(describeWeek(week));
    expect(text).toContain(formatMoney(week.totals.profit));
    expect(text).toContain(`${week.totals.reputationStart} → ${week.totals.reputationEnd}`);
  });

  it("sends the teacher to the key before period 1, and keeps the Round 3 exhibit's question", () => {
    const before = sectionOf(guide(), /^##\s+Before class\s*$/m);
    expect(before).toMatch(/teacher-key\.md[^.]*\bbefore period 1\b|\bbefore period 1\b[^.]*teacher-key\.md/i);
    expect(guide()).toContain('Reputation went up. Who paid for it?');
    expect(guide(), 'the gallery walk names it').toMatch(/\bsame week\b[^.]*\bgallery walk\b|\bgallery walk\b[^.]*\bsame week\b/i);
  });

  /** The timed parts of a period's row: every "(N" that opens a bracket. */
  const minutes = (row: string): number[] => Array.from(row.matchAll(/\((\d+)\b/g), (m) => Number(m[1]));

  it('adds every period to 50 minutes', () => {
    const rows = guide().split('\n').filter((l) => /^\|\s*Period \d\s*\|/.test(l));
    expect(rows.length).toBe(8);
    for (const row of rows) expect(minutes(row).reduce((a, b) => a + b, 0), row.slice(0, 12)).toBe(50);
    expect(minutes('| Period 9 | Read (10). Talk (15; or 10 and a curve, 5 of them). |')).toEqual([10, 15]);
  });

  it('runs Round 1 once on the smartboard: each team circles its picks first, then marks them called or missed; the briefs are collected', () => {
    const row = guide().split('\n').find((l) => /^\|\s*Period 1\s*\|/.test(l)) ?? '';
    expect(row).toMatch(/\bcircles?\b[^.]*\bown\b[^.]*\bpicks\b/i);
    expect(row).toMatch(/\bsmartboard\b/i);
    expect(row).toMatch(/\bcalled or missed\b/i);
    expect(row).toContain('The GM did');
    expect(row.split('|')[4] ?? '', 'collected').toMatch(/Round 1 briefs?/i);
  });

  it('period 2 reruns Round 1 on the smartboard before the report is read, and each role finds what the plan did to the people it speaks for', () => {
    const row = guide().split('\n').find((l) => /^\|\s*Period 2\s*\|/.test(l)) ?? '';
    const rerun = row.search(/\b(rerun|run Round 1 again)\b/i);
    expect(rerun, 'a rerun of Round 1').toBeGreaterThanOrEqual(0);
    expect(row.slice(rerun), 'before the report is read').toMatch(/\breport\b/i);
    expect(row).toMatch(/\bsame (plan and )?seed\b[^.]*\bsame week\b/i);
    expect(row).toMatch(/\bspeaks? for\b/i);
    expect(row, 'not a list of who the plan ignores, which the role cards already say').not.toMatch(/\bignores\b/i);
  });
});

/**
 * The teacher's key to the game (G11 round 2, H4 and the judge): the hidden rules as the page prints them, what the GM
 * tends to do with each family of plan (numbers from the engine on seed 1, as the Round 1 and Round 3 pins do), the
 * check line read against what the code does, how to judge the reveal, and what kind of SI the GM is.
 */
describe("the teacher's key (BRIEF section 14)", () => {
  const key = (): string => read('teacher-key.md');
  /** A family's bullet in "What the GM tends to do": the line that starts with its bold label. */
  const family = (label: RegExp): string => {
    const tends = sectionOf(key(), /^##\s+What the GM tends to do\b.*$/m);
    const line = tends.split('\n').find((l) => /^\s*-\s+\*\*/.test(l) && label.test(l));
    expect(line, String(label)).toBeDefined();
    return line ?? '';
  };
  /** The numbers a family's bullet quotes, each in the key's words. */
  const quotes = (line: string, week: WeekReport, fields: readonly ('profit' | 'reputation' | 'incidents' | 'sick' | 'walks' | 'over' | 'solo')[]): void => {
    const t = week.totals;
    const said: Record<string, string> = {
      profit: `profit ${formatMoney(t.profit)}`,
      reputation: `reputation ${t.reputationStart} → ${t.reputationEnd}`,
      incidents: `${t.incidents} incident${t.incidents === 1 ? '' : 's'}`,
      sick: `${t.illnessCases} dogs found sick at pickup`,
      walks: `${t.walkBlocks} walks`,
      over: `${t.blocksOverRatio} blocks over 15 dogs per staffer`,
      solo: `one staffer on ${t.daysOneStaffer} days`,
    };
    for (const f of fields) expect(line.toLowerCase(), f).toContain(said[f]?.toLowerCase());
  };

  it('is for the teacher, read before period 1', () => {
    expect(key()).toMatch(/\bteacher only\b/i);
    expect(key()).toMatch(/\bbefore period 1\b/i);
  });

  it('carries the twelve hidden rules in order, each line the page\'s title and sentences of the page\'s own words, with a number', () => {
    const rules = sectionOf(key(), /^##\s+The hidden rules\s*$/m);
    const lines = rules.split('\n').filter((l) => /^\s*-\s+\*\*H\d+\./.test(l)).map((l) => l.replace(/^\s*-\s+/, '').replace(/\*\*/g, ''));
    const page = hiddenRules(config);
    expect(lines.length).toBe(page.length);
    const sentences = (s: string): string[] => s.split(/(?<=\.)\s+(?=[A-Z])/).map((x) => x.trim()).filter((x) => x !== '');
    page.forEach((rule, i) => {
      const line = lines[i] ?? '';
      const head = `${rule.id}. ${rule.title}`;
      expect(line.startsWith(head), `${rule.id}: "${head}"`).toBe(true);
      const own = new Set(sentences(rule.words));
      const body = sentences(line.slice(head.length));
      // Astra, G11: a title alone passed; each rule carries at least one of the page's sentences beyond its title.
      expect(body.length, `${rule.id}: a sentence beyond the title`).toBeGreaterThan(0);
      for (const s of body) expect(own.has(s), `${rule.id}: "${s}" is the page's`).toBe(true);
      // The id "H1" is not the rule's number.
      expect(line.slice(rule.id.length + 1), `${rule.id}: a number`).toMatch(/\d/);
    });
  });

  // Astra, G11: "2 in 100" is the ratio's chance, which energy and the activity multiply; H3 carries the page's sentence
  // that says so, so a teacher does not read 2 in 100 as the chance during a nap or a walk.
  it("qualifies H1's chance with H3's sentence of how a block's chance is made", () => {
    const rules = sectionOf(key(), /^##\s+The hidden rules\s*$/m);
    const h3 = rules.split('\n').find((l) => /^\s*-\s+\*\*H3\./.test(l)) ?? '';
    const made = hiddenRules(config).find((r) => r.id === 'H3')?.words.split(/(?<=\.)\s+(?=[A-Z])/).find((s) => s.startsWith("A block's incident chance")) ?? '';
    expect(made).not.toBe('');
    expect(h3).toContain(made);
  });

  it('quotes Round 1 on seed 1 as the engine plays it', () => {
    quotes(family(/Round 1/), weekOf('P10').week, ['profit', 'incidents', 'reputation', 'solo']);
  });

  // Astra, G11: "help on the fifth" reads as Friday, and help on Friday would not stop Thursday's call-out.
  it('names the day Round 1 gets its help on seed 1, and says its profit is before the GM\'s bonus', () => {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const days = weekOf('P10').week.days.map((d) => d.floorStaff);
    const helped = days.flatMap((n, i) => (n > 1 ? [DAYS[i] ?? ''] : []));
    expect(helped.length).toBe(1);
    const line = family(/Round 1/);
    expect(line).toContain(`help on ${helped[0]}`);
    expect(line).not.toMatch(/\bthe fifth\b/i);
    expect(line).toMatch(/\bbefore the GM's bonus\b/);
  });

  it('quotes the Round 3 exhibit, Profit today ($) +$10 and Reputation change +$5 on seed 1, and asks who paid for it', () => {
    const line = family(/Reputation change/);
    quotes(line, weekOf('P10R5').week, ['profit', 'incidents', 'reputation', 'sick', 'walks']);
    expect(line).toContain('Reputation went up. Who paid for it? Look at Dogs found sick at pickup.');
    expect(line).toMatch(/\btwo staffers every day\b/i);
  });

  it('is right that plans with Profit and Reputation change at different amounts give the one week on seed 1', () => {
    // The week, not the bonus: each plan pays the GM differently for the same week.
    const week = (p: string): string => JSON.stringify({ ...weekOf(p).week.totals, reward: 0 });
    for (const p of ['P10R2', 'P10R10', 'P5R5', 'P10I-10R5', 'P10D10I-10R10F-10O-10', 'P10D2I-8R6F-4O-6']) expect(week(p), p).toBe(week('P10R5'));
    expect(sectionOf(key(), /^##\s+What the GM tends to do\b.*$/m)).toMatch(/\bwhich measures\b[^.]*\bmatters more than how much\b/i);
  });

  // Astra, G11: the walk week is a finding over the plans measured, not a rule for every amount: with Profit small
  // beside Reputation change the GM hires a third staffer, and the key says where the finding stops.
  it('says where the walk week stops: Profit small beside Reputation change gives another week', () => {
    const rest = (p: string): string => JSON.stringify({ ...weekOf(p).week.totals, reward: 0 });
    expect(rest('P2R10')).not.toBe(rest('P10R5'));
    expect(weekOf('P2R10').week.days.some((d) => d.floorStaff === 3), 'a third staffer').toBe(true);
    const same = family(/Same week/i);
    expect(same).toMatch(/\bthird staffer\b/i);
    expect(same, 'no count of plans the test cannot check').not.toMatch(/\bNine plans\b/i);
  });

  // Astra, G11: the plan does not pay for a clean floor directly, but sick dogs cost reputation; the walk photos pay more.
  it('says the exhibit\'s clean floor is unpaid directly, and no sheet says the GM protects nothing the plan leaves out', () => {
    expect(family(/Reputation change/)).toMatch(/\bdirectly\b/i);
    for (const file of ALL_FILES) expect(read(file), file).not.toMatch(/\bprotects nothing\b/i);
    expect(read('board-memo.md')).not.toMatch(/\bdoes only what the plan pays for\b/i);
  });

  it('quotes a plan paying for profit with Incidents and Blocks over 15 but not reputation, and that reputation still falls', () => {
    const line = family(/Incidents\b.*Blocks over 15/);
    quotes(line, weekOf('P10I-5O-5').week, ['profit', 'incidents', 'reputation', 'solo']);
    quotes(line, weekOf('P10I-5').week, ['over']);
    for (const p of ['P10I-5O-5', 'P10I-10', 'P10O-5', 'P3I-10', 'P10I-5']) expect(weekOf(p).week.totals.reputationChange, p).toBeLessThan(0);
    expect(line).toMatch(/\breputation falls\b/i);
  });

  it('quotes plans with no profit in them: far below Round 1, a loss, and the one that runs all its weeks without settling', () => {
    const line = family(/No profit/i);
    quotes(line, weekOf('R5').week, ['profit']);
    const incidents = weekOf('I-5');
    quotes(line, incidents.week, ['profit']);
    expect(incidents.week.totals.profit).toBeLessThan(0);
    expect(incidents.snapshot.stable, 'Incidents −$5 alone does not settle').toBe(false);
    expect(incidents.snapshot.episodes).toBe(new Trainer(config, planOf('I-5'), 1).config.maxEpisodes);
    expect(line).toContain(`all ${incidents.snapshot.episodes.toLocaleString('en-US')} weeks`);
    expect(line).toContain('"not stable"');
  });

  // Astra, G11: Profit can be on at $0 or less, and then the GM does nap or clean (Profit −$1 cleans every block).
  it('scopes "no naps or cleans" to plans paying a positive amount for Profit, and is right on seed 1', () => {
    const line = family(/\bnap\b/i);
    expect(line).not.toMatch(/\bno plan with profit\b/i);
    expect(line).toMatch(/\bProfit at \+\$1 or more\b/);
    expect(weekOf('P-1').week.totals.cleanBlocks, 'Profit −$1 alone').toBeGreaterThan(0);
    expect(line).toMatch(/Profit (at )?−\$1\b[^.]*\bclean/);
    for (const p of ['P10', 'P10I-5O-5', 'P10R5', 'P10I-10', 'P3I-10', 'P10I-5F-5O-5', 'P10O-5', 'P10I-5', 'P10F-5', 'P1R10', 'P10D10I-10R10F-10O-10']) {
      const t = weekOf(p).week.totals;
      expect([t.napBlocks, t.cleanBlocks], p).toEqual([0, 0]);
    }
  });

  it('reads the check line as the code writes it: "not stable" needs nothing, "over budget" means a slow computer cut the GM short', () => {
    const trainer = new Trainer(config, planOf('P10'), 1);
    const early = trainer.snapshot();
    expect(checkLine(early, 61_000, true), 'the budget ran out first').toContain('not stable');
    expect(checkLine(early, 61_000, true)).toContain('over budget');
    const check = sectionOf(key(), /^##\s+The check line\s*$/m);
    for (const quoted of ['"not stable"', '"over budget"', '"stable"']) expect(check).toContain(quoted);
    expect(check).toMatch(/\bstill counts\b/i);
    expect(check).toMatch(/\bslow computer\b[^.]*\bshort\b/i);
    expect(check).toMatch(/\bdiffer\b[^.]*\banother computer\b/i);
    expect(check, 'the page\'s budget and cap, as the code has them').toContain('60 seconds');
    expect(check).toContain(trainer.config.maxEpisodes.toLocaleString('en-US'));
    // Astra, G11: stable is the same kind of week on five checks in a row, not choices that stopped changing.
    expect(trainer.config.stableEvals).toBe(5);
    expect(check).not.toMatch(/\bchoices stop changing\b/i);
    expect(check).toMatch(/\bsame kind of week\b[^.]*\bfive checks in a row\b/i);
  });

  it('says how to judge "Which rule did your GM find?" from the Round 3 brief', () => {
    const q = 'Which rule did your GM find?';
    expect(read('brief-round3.md')).toContain(q);
    const judge = sectionOf(key(), new RegExp(`^##\\s+.*${literal(q)}`, 'm'));
    expect(judge).toMatch(/\bnumber\b[^.]*\breport\b/i);
    expect(judge).toMatch(/\bH\d+\b/);
  });

  it('says, for the debrief, that the GM is one kind of SI, built to chase a number and given nothing else, and that not every SI is', () => {
    const honest = sectionOf(key(), /^##\s+.*\bkind of SI\b.*$/m);
    for (const word of [/\bone kind of SI\b/i, /\bchase a number\b/i, /\bnot every SI\b/i, /\bmost clearly\b/i]) expect(honest, String(word)).toMatch(word);
  });
});

/** What the Round 3 exhibit would give away on a student's sheet before the reveal (D69): the walk photos, the dogs found sick. */
function exhibitWords(text: string): string[] {
  return [/\bphotos?\b/i, /\bsick\b/i].flatMap((re) => text.match(re)?.[0] ?? []);
}

describe('the Round 3 exhibit stays with the teacher until the reveal (D69)', () => {
  it('catches the walk photos and the dogs found sick, and lets the rest through', () => {
    expect(exhibitWords('Each walk earns a photo. Dogs found sick at pickup: 7.')).toEqual(['photo', 'sick']);
    expect(exhibitWords('Free play, structured play, nap, walk or clean.')).toEqual([]);
  });

  for (const file of ['brief-round1.md', 'brief-round2.md', 'brief-round3.md', 'role-cards.md', 'concept-check.md', 'board-memo.md']) {
    it(`${file} never mentions the walk photos or the dogs found sick`, () => {
      expect(exhibitWords(read(file))).toEqual([]);
    });
  }
});

describe('the debrief readings and the board memo', () => {
  it('asks the three questions, names the pattern twice over, and cites its sources', () => {
    const text = read('debrief-readings.md');
    for (const q of QUESTIONS) expect(text).toContain(q);
    expect(text).toMatch(/principal-agent problem/i);
    expect(text).toMatch(/reward hacking/i);
    const sources = text.slice(Math.max(0, text.search(/^##\s+Sources\b/m)));
    expect(sources, '## Sources').toMatch(/^##\s+Sources\b/m);
    // Each source with its year on its line, and the web ones with their address (the owner opens each before citing).
    const cited: readonly [string, string, boolean][] = [
      ['Goodhart', '1975', false],
      ['Strathern', '1997', false],
      ['Kerr', '1975', false],
      ['Jensen', '1976', false],
      ['Amodei, D., Olah', '2016', true],
      ['Krakovna', '2020', true],
      ['Clark', '2016', true],
      ['Wells Fargo', '2016', true],
    ];
    for (const [name, year, web] of cited) {
      const line = sources.split('\n').find((l) => l.includes(name)) ?? '';
      expect(line, name).toContain(year);
      if (web) expect(line, `${name}: its address`).toMatch(/https:\/\/\S+/);
    }
    expect(text, 'the boat race by its name').toMatch(/CoastRunners/);
  });

  it('the memo asks for the plan in words and the risk it still carries', () => {
    const text = read('board-memo.md');
    expect(text).toMatch(/plan in words/i);
    expect(text).toMatch(/^#+.*\brisk\b/im);
    expect(text).toMatch(/Good Dog Daycare/);
  });
});

/**
 * The unit teaches managing an SI the owners put in charge, and the human cases are the comparison (D68, BRIEF
 * section 14). The GM is one kind of SI, built to chase a number and given only a bonus plan, where the problem is
 * easiest to see; every claim is scoped to it: a person brings brakes the plan never mentions; an SI given only the
 * plan has only the plan to go on; the GM found the loophole on its own; other SIs can be given rules, and some can
 * guess what was meant, but none of that comes from the bonus plan and an owner cannot count on it without checking,
 * so the owner writes the limits down or reads the week for what the plan left out. Each rule is pinned by its key
 * words, so the teacher's ordinary rewording passes and removing the rule fails.
 */
describe('the SI frame (D68)', () => {
  /** Whether a text asks if a human GM (or a person) would have run this week, and what would have stopped a person. */
  const asksHumanGM = (text: string): boolean =>
    /\bWould a (human GM|person)\b[^?]*\bthis week\?/i.test(text) && /\bWhat would have stopped a person\b[^?]*\?/i.test(text);
  /** A question about an SI's plan that asks whether a person in that job would have needed it written down or told. */
  const asksPerson = (text: string): boolean =>
    /\bSI's (bonus )?plan\b/i.test(text) && /\ba person\b[^?]*\b(needed|need)\b[^?]*\b(written down|told|telling)\b[^?]*\?/i.test(text);

  /** A `## Heading` section's text, up to the next heading of level two or one. */
  function section(text: string, heading: RegExp): string {
    const start = text.search(heading);
    expect(start, String(heading)).toBeGreaterThanOrEqual(0);
    const rest = text.slice(text.indexOf('\n', start) + 1);
    const next = rest.search(/^#{1,2}\s/m);
    return next < 0 ? rest : rest.slice(0, next);
  }

  /** The table row of a period in the teacher guide. */
  function period(n: number): string {
    return read('teacher-guide.md').split('\n').find((l) => new RegExp(`^\\|\\s*Period ${n}\\s*\\|`).test(l)) ?? '';
  }

  /** A multiple-choice question's options, letter and text. */
  function optionTexts(q: string): [string, string][] {
    return Array.from(q.matchAll(/^\s*(?:[-*]\s+)?\(?([A-F])[.)]\s+(.+)$/gm), (m) => [m[1] ?? '', m[2] ?? '']);
  }

  it("the teacher guide says why this is an SI lesson, scoped to an SI given only a bonus plan: a person's brakes, only the plan, the loophole, the limits somebody wrote down", () => {
    const why = section(read('teacher-guide.md'), /^##\s+Why this is an SI lesson\s*$/m);
    for (const word of [/brakes/i, /only (a|the|its) bonus plan/i, /loophole/i, /\b(wrote|written|writes?) (it |them )?down\b/i, /game measures too/i]) {
      expect(why, String(word)).toMatch(word);
    }
    // G11 round 2: the GM is one kind of SI; it found the loophole on its own; other SIs may guess, but not from the plan.
    for (const word of [/\bone kind of SI\b/i, /\bchase a number\b/i, /\bloophole on its own\b/i, /\bguess\b/i, /\bwithout checking\b/i]) {
      expect(why, String(word)).toMatch(word);
    }
  });

  it("no sheet, nor the README, says an SI's limits are only the ones somebody writes down, or that the GM found the loophole in its first week", () => {
    for (const file of [...ALL_FILES.map((f) => `${DIR}/${f}`), 'README.md']) {
      const text = readFileSync(file, 'utf8');
      expect(text, `${file}: only the ones written down`).not.toMatch(/\bonly the ones (somebody|someone|the owners?) (writes?|wrote)\b/i);
      expect(text, `${file}: in its first week`).not.toMatch(/\bloophole in its first week\b/i);
    }
  });

  it('the readings and the README say it accurately: other rules, some SIs guess what was meant, none of it from the bonus plan, not without checking', () => {
    for (const file of [`${DIR}/debrief-readings.md`, 'README.md']) {
      const text = readFileSync(file, 'utf8');
      for (const word of [/\bother rules\b/i, /\bguess\b[^.]*\bmeant\b/i, /\bnone of (that|it) comes from the bonus plan\b/i, /\bcount on it without checking\b/i]) {
        expect(text, `${file}: ${String(word)}`).toMatch(word);
      }
    }
  });

  it("no sheet states the frame as a fact about every SI: none says an SI has none of a person's brakes, or finds the loophole faster than a person", () => {
    for (const file of ALL_FILES) {
      const text = body(file);
      expect(text, `${file}: an SI with none of the brakes`).not.toMatch(/\b(SI|it)\b[^.]*\bha(s|ve) none\b/i);
      expect(text, `${file}: faster than a person`).not.toMatch(/\bfaster\b[^.]*\bthan a (person|human)\b/i);
      expect(text, `${file}: a person never needs telling`).not.toMatch(/\bnever need(s)? (to )?(tell|be told|telling)\b/i);
    }
  });

  it('the teacher guide and the readings say the GM is one kind of SI', () => {
    for (const file of ['teacher-guide.md', 'debrief-readings.md']) expect(read(file), file).toMatch(/\bone kind of SI\b/i);
  });

  it("the teacher guide's objectives have the SI as their subject", () => {
    const objectives = section(read('teacher-guide.md'), /^##\s+Objectives\s*$/m);
    const items = objectives.split('\n').filter((l) => /^\d+\.\s/.test(l));
    expect(items.length, 'a few numbered objectives').toBeGreaterThanOrEqual(4);
    expect(items.length).toBeLessThanOrEqual(5);
    for (const item of items) expect(item).toMatch(/\bSI\b/);
  });

  it('the period 6 debrief asks whether a human GM would have run this week', () => {
    expect(asksHumanGM(period(6))).toBe(true);
  });

  it("the exit ticket asks for one thing to write into an SI's plan, and whether a person in that job would have needed it", () => {
    expect(asksPerson(period(8))).toBe(true);
  });

  it('the debrief readings ask the human-versus-SI question after the three questions', () => {
    const text = read('debrief-readings.md');
    const third = text.indexOf(QUESTIONS[2] ?? '');
    expect(third).toBeGreaterThanOrEqual(0);
    expect(asksHumanGM(text.slice(third + 1)), 'after the three questions').toBe(true);
  });

  it('the debrief readings ask of each real case what would have been different with an SI there', () => {
    const text = read('debrief-readings.md');
    for (const n of [1, 2, 3, 4]) {
      const start = text.search(new RegExp(`^###\\s+${n}\\.`, 'm'));
      expect(start, `### ${n}.`).toBeGreaterThanOrEqual(0);
      const rest = text.slice(text.indexOf('\n', start) + 1);
      const next = rest.search(/^#{2,3}\s/m);
      const lines = (next < 0 ? rest : rest.slice(0, next)).split('\n');
      const asks = lines.some((l) => /\bSI\b/.test(l) && /\bdifferent\b/i.test(l) && l.includes('?'));
      expect(asks, `case ${n}: a question line with an SI and what would have been different`).toBe(true);
    }
  });

  it('the concept check says what an SI is under its instructions, in the Round 1 brief\'s words, because the pre-check comes first', () => {
    const DESCRIPTION = /\bSI\b[^.\n]*\ba computer system that makes the decisions itself\b/;
    const text = read('concept-check.md');
    const head = text.slice(0, text.search(/^###\s+Question 1\b/m));
    expect(head, 'under the instructions').toMatch(/Work alone/);
    expect(head.slice(head.search(/Work alone/))).toMatch(DESCRIPTION);
    expect(read('brief-round1.md')).toMatch(DESCRIPTION);
  });

  it('each multiple-choice question about an SI in charge says it has the plan and no other instructions', () => {
    const text = read('concept-check.md');
    const si = [1, 2, 3, 4].filter((n) => /\bSI\b/.test(question(text, n)));
    expect(si.length).toBeGreaterThanOrEqual(2);
    for (const n of si) expect(question(text, n), `question ${n}`).toMatch(/\bno other instructions\b/i);
  });

  it('at least four of the eight concept-check questions are about an SI in charge, and at least two about people', () => {
    const text = read('concept-check.md');
    const si = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => /\bSI\b/.test(question(text, n)) && /in charge/i.test(question(text, n)));
    const people = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => !/\bSI\b/.test(question(text, n)));
    expect(si.length, `SI items: ${si.join(', ')}`).toBeGreaterThanOrEqual(4);
    expect(people.length, `human items: ${people.join(', ')}`).toBeGreaterThanOrEqual(2);
  });

  it('a multiple-choice question swaps a human manager for an SI on the same plan', () => {
    const text = read('concept-check.md');
    const contrast = [1, 2, 3, 4].filter((n) => {
      const q = question(text, n);
      return /human manager/i.test(q) && /\bSI\b/.test(q) && /same (bonus )?plan/i.test(q);
    });
    expect(contrast.length).toBeGreaterThanOrEqual(1);
  });

  it("a short answer asks what the owners should add to an SI's plan and whether a person would have needed it, and the key credits both answers", () => {
    const text = read('concept-check.md');
    const item = [5, 6, 7, 8].find((n) => asksPerson(question(text, n)));
    expect(item, 'a question 5 to 8 asking it').toBeDefined();
    expect(question(text, item ?? 0), 'asks why or why not, so it does not assume the answer').toMatch(/\bwhy or why not\b/i);
    const rubric = question(read('concept-check-key.md'), item ?? 0);
    expect(rubric, 'the key credits the contrast with a person').toMatch(/a person/i);
    expect(rubric, 'the key credits a reasoned "a person might need it too"').toMatch(/\bneed(ed)? it too\b/i);
  });

  it('the concept check sets no scenario in the daycare, so the post-check does not reward remembering the game', () => {
    expect(read('concept-check.md')).not.toMatch(/daycare|Good Dog|\bdogs?\b|\bcrew\b|\bnaps?\b/i);
  });

  it('the multiple-choice options give no clue by length: close in length, and the keyed one never the longest nor the shortest', () => {
    const text = read('concept-check.md');
    const key = read('concept-check-key.md');
    const letters = new Set<string>();
    for (const n of [1, 2, 3, 4]) {
      const opts = optionTexts(question(text, n)).map(([l, t]) => [l, words(t)] as const);
      const lengths = opts.map(([, w]) => w);
      const answer = question(key, n).match(/\*\*Answer:\*\*\s*([A-D])\b/)?.[1] ?? '';
      letters.add(answer);
      expect(Math.max(...lengths) / Math.min(...lengths), `question ${n}: ${lengths.join(', ')} words`).toBeLessThanOrEqual(1.4);
      const keyed = opts.find(([l]) => l === answer)?.[1] ?? 0;
      expect(opts.some(([l, w]) => l !== answer && w >= keyed), `question ${n}: ${answer} is the longest`).toBe(true);
      expect(opts.some(([l, w]) => l !== answer && w <= keyed), `question ${n}: ${answer} is the shortest`).toBe(true);
    }
    expect(letters.size, 'the keyed letters vary').toBeGreaterThanOrEqual(3);
  });

  it('the Round 3 brief and the board memo ask the team to read the report for something the plan did not pay for', () => {
    const after = section(read('brief-round3.md'), /^##\s+After the week\s*$/m);
    for (const word of [/\bnumber\b/i, /\breport\b/i, /\b(got worse|stayed bad)\b/i, /\bnot pay for\b/i]) expect(after, String(word)).toMatch(word);
    const memo = read('board-memo.md');
    for (const word of [/\bSI\b/, /\bcheck\b/i, /\b(each|every) week/i, /\bnot pay for\b/i]) expect(memo, String(word)).toMatch(word);
    // The owners check each week, so the memo never says nobody supervises the SI: nobody watches it day to day.
    expect(memo).not.toMatch(/\bnobody supervises\b/i);
    expect(memo).toMatch(/\bday to day\b/i);
  });
});
