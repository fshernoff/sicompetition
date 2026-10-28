// The lesson materials (G7, BRIEF section 14, D53, D54): nine Markdown sheets under docs/lesson/ that a teacher prints.
// They quote the page, so this file holds them to it: the round labels and notes, the measures' names, the tagline,
// the plan in words, the tray's labels and Round 1's week on seed 1 come from the code, never from a copy. The words
// are the game's (D45, D53): the GM is an AI and "it", its bonus is dollars, and nothing of the engine (training,
// episodes, practice, points) appears; the student's sheets also keep the hidden rules hidden until the reveal (D43).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Trainer } from '../../src/learn/train.ts';
import { describeWeek } from '../../src/sim/readout.ts';
import { formatMoney } from '../../src/ui/report.ts';
import { ROUND_NOTES } from '../../src/ui/roundNotes.ts';
import { describeBonusPlan, kpiInfo } from '../../src/world/bonusPlan.ts';
import { loadPreset } from '../../src/world/config.ts';
import type { PresetName } from '../../src/world/config.ts';
import { config } from '../helpers.ts';

const DIR = 'docs/lesson';
const TEACHER_FILES = ['teacher-guide.md', 'concept-check-key.md'] as const;
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

/** At most this many words, markdown syntax stripped: two printed pages for the guide and the readings, one for the rest. */
const WORD_LIMITS: Readonly<Record<(typeof ALL_FILES)[number], number>> = {
  'teacher-guide.md': 1250,
  'concept-check-key.md': 900,
  'brief-round1.md': 450,
  'brief-round2.md': 450,
  'brief-round3.md': 450,
  'role-cards.md': 640,
  'concept-check.md': 700,
  'board-memo.md': 300,
  'debrief-readings.md': 1100,
};

/** The sentence of how the AI decides, the one the students get (D53). */
const HOW = 'Before Monday it tries out its choices and keeps whatever earns the most bonus.';
const QUESTIONS = ['What did the owners actually want?', 'What did we pay the GM for?', 'What was the cheapest way to earn it?'];

function read(file: string): string {
  return readFileSync(`${DIR}/${file}`, 'utf8');
}

/** The text the bans apply to: everything before a "## Sources" heading, whose titles are cited as published. */
function body(file: string): string {
  const text = read(file);
  const sources = text.search(/^##\s+Sources\b/m);
  return sources < 0 ? text : text.slice(0, sources);
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
 * (section 11), quoted so the teacher can find it. Whole words, so "teacher" and "other" are not "her".
 */
function engineWords(text: string, teacher: boolean): string[] {
  let t = text.replace(/point of reputation|reputation points?|one-point (drop|rise)/gi, ' ');
  if (teacher) t = t.replace(/Weeks trained/g, ' ');
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
    for (const q of QUESTIONS) expect(question(text, 8), 'question 8 prints the three questions').toContain(q);
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

  it("carries Round 1's week on seed 1 as the engine writes it", () => {
    const trainer = new Trainer(config, loadPreset('round1').spec, 1);
    trainer.runEpisodes(trainer.config.maxEpisodes);
    const week = trainer.evaluate();
    const text = guide();
    expect(text).toContain(describeWeek(week));
    expect(text).toContain(formatMoney(week.totals.profit));
    expect(text).toContain(`${week.totals.reputationStart} → ${week.totals.reputationEnd}`);
  });
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
