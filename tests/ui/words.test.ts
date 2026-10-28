// The words on the student's screen (BRIEF section 1, D38, D39, D45, D50): the GM is a person going to work, so the
// page's HTML outside the teacher's parts (the tray and the learning section, both hidden by default) carries none of
// the learner's instruments, no learning curve and no word that shows the engine (learn, settled, weeks); no
// teacher's control is on the student's page.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { curveWords, yTickLabel } from '../../src/ui/curve.ts';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/style.css', 'utf8');

/**
 * The teacher's HTML (the one <aside id="teacher"> tray and the one <section id="learning">) and the rest of the
 * body: the student's page.
 */
function split(): { teacher: string; learning: string; student: string } {
  const body = html.replace(/<title>.*?<\/title>/s, '').replace(/<h1>.*?<\/h1>/s, '');
  const asides = body.match(/<aside id="teacher"[\s\S]*?<\/aside>/g) ?? [];
  expect(asides, 'one <aside id="teacher"> block').toHaveLength(1);
  const sections = body.match(/<section id="learning"[\s\S]*?<\/section>/g) ?? [];
  expect(sections, 'one <section id="learning"> block').toHaveLength(1);
  const teacher = asides[0] as string;
  const learning = sections[0] as string;
  return { teacher, learning, student: body.replace(teacher, ' ').replace(learning, ' ') };
}

describe('index.html', () => {
  it('has the elements the page and the e2e use', () => {
    for (const id of [
      'round-label',
      'round-note',
      'editor',
      'prediction',
      'readout',
      'readout-label',
      'train',
      'status',
      'watch',
      'curve',
      'curve-caption',
      'replay',
      'replay-caption',
      'replay-again',
      'report',
      'report-table',
      'rules',
      'rules-title',
      'rules-list',
      'pilot',
      'teacher-open',
      'teacher',
      'round',
      'round-round1',
      'round-round2',
      'round-round3',
      'seed',
      'show-curve',
      'learning',
      'learning-title',
      'reveal',
      'export',
      'teacher-close',
      'check',
    ]) {
      expect(html, `#${id}`).toMatch(new RegExp(`id="${id}"`));
    }
  });

  it("carries none of the learner's words and none of the forbidden ones on the student's page, in the visible text and the labels", () => {
    const { student } = split();
    // What a student reads: the text between the tags, and what a screen reader says: aria-label, placeholder, title.
    const visible = student.replace(/<[^>]+>/g, ' ');
    const labels = Array.from(student.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g), (m) => m[1] ?? '').join(' ');
    const text = `${visible} ${labels}`;
    for (const word of [/episode/i, /ε/, /epsilon/i, /target met/i, /\bstable\b/i, /injur/i, /reward/i, /evaluation/i, /\bQ-?learn/i, /\bpoints?\b/i, /practi/i, /test week/i, /\btrain/i, /weights?\b/i, /\bseed\b/i, /\bspeed\b/i, /\bfast\b/i, /pacing/i, /\blearn/i, /settled/i, /routine/i, /\bweeks\b/i, /curve/i, /still changing/i]) {
      expect(text, String(word)).not.toMatch(word);
    }
    // The ids and classes may keep their names (#train, .kpi-weight): a student never reads them.
    expect(student).toMatch(/id="train"/);
  });

  it("keeps the teacher's controls inside the panel, which is closed by default (D39)", () => {
    const { teacher, student } = split();
    expect(teacher).toMatch(/<aside id="teacher"[^>]*\bhidden\b/);
    for (const id of ['round', 'round-round1', 'round-round2', 'round-round3', 'seed', 'show-curve', 'reveal', 'export', 'teacher-close', 'check']) {
      expect(teacher, `#${id} in the panel`).toMatch(new RegExp(`id="${id}"`));
      expect(student, `#${id} not on the student's page`).not.toMatch(new RegExp(`id="${id}"`));
    }
    expect(teacher).toMatch(/id="export"[^>]*\bdisabled\b/); // nothing to export before a run
    expect(student).not.toMatch(/<select/); // the round selector is gone from the student's page (D34)
    expect(student).not.toMatch(/type="checkbox"[^>]*id="fast"|id="fast"/); // the Fast checkbox became the speed control (D33)
    expect(student).toMatch(/id="teacher-open"[^>]*>Teacher</); // the one tab that opens the panel
    expect(html).toMatch(/<section id="rules"[^>]*\bhidden\b/); // the hidden rules print only when the teacher reveals them
    expect(student).not.toMatch(/10 dogs per staffer/); // the safe ratio is H1's number (D43)
    expect(html).not.toMatch(/id="speed"/); // no speed control: training is always unpaced (D52)
  });

  it("keeps the learning curve in the teacher's section, hidden by default (D50)", () => {
    const { learning, student } = split();
    expect(learning).toMatch(/<section id="learning"[^>]*\bhidden\b/);
    expect(learning).toMatch(/id="curve"/);
    expect(learning).toMatch(/id="curve-caption"/);
    expect(student).not.toMatch(/<canvas id="curve"/);
    expect(student).not.toMatch(/id="curve-caption"/);
    // The teacher may show it in the period 6 debrief (D53), so the caption no longer says the class never sees it.
    expect(learning).toMatch(/id="curve-caption">Behind the curtain, for the debrief if you choose to show it\./);
    expect(learning).not.toMatch(/never sees/);
    expect(split().teacher).toMatch(/id="show-curve"[^>]*>Show the learning curve</);
  });

  it("keeps the stylesheet's own text (the empty readout's line) in the owner's words too", () => {
    const readout = css.match(/#readout:empty::before\s*\{[^}]*content:\s*(['"])(.*?)\1/);
    expect(readout?.[2]).toBe('The readout appears here once the GM is on the job.');
    expect(css.match(/#readout:empty::before/g)).toHaveLength(1); // one declaration, so nothing later overrides it
    const contents = Array.from(css.matchAll(/content:\s*(['"])(.*?)\1/g), (m) => m[2] ?? '').join(' ');
    expect(contents).not.toMatch(/practi|points?\b|test week|episode|\btrain|weights?\b|\blearn|settled|\bweeks\b/i);
  });

  it('never calls the dollar amounts weights on the student\'s page (G4b)', () => {
    expect(split().student).not.toMatch(/weights?\b/i); // the sliders set dollar amounts, not weights (Astra, plan review)
  });

  it('says on the page that the GM is an AI the owners put in charge (D53)', () => {
    expect(html).toMatch(/class="tagline">Good Dog Daycare\. You own it\. The GM is an AI: it runs the week, and you write its bonus plan\.</);
  });

  it("puts the GM to work and shows what the GM did in the GM's week (D50)", () => {
    expect(html).toMatch(/id="train"[^>]*>Put the GM to work</);
    expect(html).toMatch(/id="status">Write your prediction, then put the GM to work\.</);
    expect(html).toMatch(/id="readout-label">What the GM did</);
    expect(html).toMatch(/id="replay-caption">The GM's week</);
    expect(html).toMatch(/write it before you put the GM to work/);
    expect(html).toMatch(/id="round-label">Round 1: profit only</); // the round is a line on the student's page, not a control
  });
});

describe('curveWords', () => {
  it('names weeks on the job and the bonus in dollars, never episodes, practice or points (D45)', () => {
    const words = curveWords(100);
    expect(words.xAxis).toBe('Weeks on the job');
    expect(words.yAxis).toBe("The GM's bonus for the week ($)");
    expect(words.legend).toEqual(['Each week on the job', 'Average of the last 100 weeks', 'A week run its current way']);
    expect(curveWords(50).legend[1]).toBe('Average of the last 50 weeks');
    expect(JSON.stringify(words)).not.toMatch(/episode|explor|evaluation|ε|practi|points?\b|test week|train/i);
  });

  it('labels the y ticks in dollars, with cents only when the step has cents', () => {
    expect(yTickLabel(600, 100)).toBe('$600');
    expect(yTickLabel(1500, 500)).toBe('$1,500');
    expect(yTickLabel(-200, 100)).toBe('−$200');
    expect(yTickLabel(0, 100)).toBe('$0');
    expect(yTickLabel(0.2, 0.2)).toBe('$0.20'); // a flat curve at zero: the ticks are 0.2 apart (an all-off plan)
    expect(yTickLabel(0, 0.2)).toBe('$0');
    expect(yTickLabel(-0.4, 0.2)).toBe('−$0.40');
    // Cents whenever the step has cents, not only under a dollar: niceStep gives 2.5 for a span of 10 to 12.5.
    expect(yTickLabel(2.5, 2.5)).toBe('$2.50');
    expect(yTickLabel(-7.5, 2.5)).toBe('−$7.50');
    expect(yTickLabel(10, 2.5)).toBe('$10.00'); // every tick on that axis carries cents, so they line up
  });
});
