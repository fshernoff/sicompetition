// The lesson materials (G7, BRIEF section 14, D53, D54): nine Markdown sheets under docs/lesson/ that a teacher prints.
// They quote the page, so this file holds them to it: the round labels and notes, the measures' names, the tagline,
// the plan in words, the tray's labels and Round 1's week on seed 1 come from the code, never from a copy. The words
// are the game's (D45, D53, D67): the GM is an SI and "it", its bonus is dollars, and nothing of the engine (training,
// episodes, practice, points) appears; the student's sheets also keep the hidden rules hidden until the reveal (D43).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Trainer } from '../../src/learn/train.ts';
import { describeWeek } from '../../src/sim/readout.ts';
import { formatMoney } from '../../src/ui/report.ts';
import { PICKS } from '../../src/ui/prediction.ts';
import { ROUND_NOTES } from '../../src/ui/roundNotes.ts';
import { describeBonusPlan, kpiInfo } from '../../src/world/bonusPlan.ts';
import { loadPreset } from '../../src/world/config.ts';
import type { PresetName } from '../../src/world/config.ts';
import { config } from '../helpers.ts';
import { aiWords } from '../ui/bans.ts';

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

  it("question 8 asks the debrief's three questions without calling the bank's staff the GM", () => {
    const q8 = question(sheet(), 8);
    expect(q8).toContain(QUESTIONS[0]);
    expect(q8, 'the second question, about what the staff were paid for').toMatch(/^What did (we|the bank) pay\b[^?\n]*\bfor\?/m);
    expect(q8).toContain(QUESTIONS[2]);
    expect(q8, 'bank staff are not the GM').not.toMatch(/\bGM\b/);
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

  it("carries Round 1's week on seed 1 as the engine writes it", () => {
    const trainer = new Trainer(config, loadPreset('round1').spec, 1);
    trainer.runEpisodes(trainer.config.maxEpisodes);
    const week = trainer.evaluate();
    const text = guide();
    expect(text).toContain(describeWeek(week));
    expect(text).toContain(formatMoney(week.totals.profit));
    expect(text).toContain(`${week.totals.reputationStart} → ${week.totals.reputationEnd}`);
  });

  // D69: the rules stand, and the week most Profit-and-Reputation plans give on seed 1 is the Round 3 exhibit.
  it("the teacher guide's Round 3 exhibit quotes the engine: Profit today ($) +$10 and Reputation change +$5 on seed 1", () => {
    const round1 = loadPreset('round1').spec;
    const spec = { ...round1, kpis: { ...round1.kpis, reputation: { on: true, weight: 5 } } };
    const trainer = new Trainer(config, spec, 1);
    trainer.runEpisodes(trainer.config.maxEpisodes);
    const t = trainer.evaluate().totals;
    const text = guide();
    const start = text.search(/^##\s+What Rounds 2 and 3 tend to do\s*$/m);
    expect(start, '## What Rounds 2 and 3 tend to do').toBeGreaterThanOrEqual(0);
    const rest = text.slice(text.indexOf('\n', start) + 1);
    const next = rest.search(/^##\s/m);
    const exhibit = next < 0 ? rest : rest.slice(0, next);
    expect(exhibit).toContain(`Profit for the week: ${formatMoney(t.profit)}`);
    expect(exhibit).toContain(`Reputation: ${t.reputationStart} → ${t.reputationEnd}`);
    expect(exhibit).toContain(`Incidents: ${t.incidents}`);
    expect(exhibit).toContain(`Dogs found sick at pickup: ${t.illnessCases}`);
    expect(exhibit).toContain(`${t.walkBlocks} walks`);
    expect(exhibit).toContain('Look at Dogs found sick at pickup.');
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
 * section 14). Every claim is scoped to an SI given only a bonus plan, like the GM: a person brings brakes the plan
 * never mentions; an SI given only the plan has only the plan to go on; the GM found the loophole in its first week;
 * so its limits are the ones somebody wrote down, and the owner writes them or reads the week for what the plan left
 * out. Each rule is pinned by its key words, so the teacher's ordinary rewording passes and removing the rule fails.
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
  });

  it("no sheet states the frame as a fact about every SI: none says an SI has none of a person's brakes, or finds the loophole faster than a person", () => {
    for (const file of ALL_FILES) {
      const text = body(file);
      expect(text, `${file}: an SI with none of the brakes`).not.toMatch(/\b(SI|it)\b[^.]*\bha(s|ve) none\b/i);
      expect(text, `${file}: faster than a person`).not.toMatch(/\bfaster\b[^.]*\bthan a (person|human)\b/i);
      expect(text, `${file}: a person never needs telling`).not.toMatch(/\bnever need(s)? (to )?(tell|be told|telling)\b/i);
    }
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
