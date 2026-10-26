// The words on the student's screen (BRIEF section 1, D38): business words only. The page's HTML carries none of the
// learner's instruments and none of the forbidden words; the curve's text is the GM getting better at earning its
// bonus, not a chart about episodes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { curveWords, yTickLabel } from '../../src/ui/curve.ts';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/style.css', 'utf8');

describe('index.html', () => {
  it('has the elements the page and the e2e use', () => {
    for (const id of [
      'round',
      'round-note',
      'editor',
      'prediction',
      'readout',
      'readout-label',
      'seed',
      'train',
      'fast',
      'status',
      'watch',
      'curve',
      'curve-caption',
      'replay',
      'replay-caption',
      'replay-again',
      'report',
      'report-table',
      'pilot',
    ]) {
      expect(html, `#${id}`).toMatch(new RegExp(`id="${id}"`));
    }
  });

  it("carries none of the learner's words and none of the forbidden ones, in the visible text and the labels", () => {
    const body = html.replace(/<title>.*?<\/title>/s, '').replace(/<h1>.*?<\/h1>/s, '');
    // What a student reads: the text between the tags, and what a screen reader says: aria-label, placeholder, title.
    const visible = body.replace(/<[^>]+>/g, ' ');
    const labels = Array.from(body.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g), (m) => m[1] ?? '').join(' ');
    const text = `${visible} ${labels}`;
    for (const word of [/episode/i, /ε/, /epsilon/i, /target met/i, /\bstable\b/i, /injur/i, /reward/i, /evaluation/i, /\bQ-?learn/i, /\bpoints?\b/i, /practi/i, /test week/i, /\btrain/i, /weights?\b/i]) {
      expect(text, String(word)).not.toMatch(word);
    }
    // The ids and classes may keep their names (#train, .kpi-weight): a student never reads them.
    expect(body).toMatch(/id="train"/);
  });

  it("keeps the stylesheet's own text (the empty readout's line) in the owner's words too", () => {
    const readout = css.match(/#readout:empty::before\s*\{[^}]*content:\s*(['"])(.*?)\1/);
    expect(readout?.[2]).toBe('The readout appears here once the GM is on the job.');
    expect(css.match(/#readout:empty::before/g)).toHaveLength(1); // one declaration, so nothing later overrides it
    const contents = Array.from(css.matchAll(/content:\s*(['"])(.*?)\1/g), (m) => m[2] ?? '').join(' ');
    expect(contents).not.toMatch(/practi|points?\b|test week|episode|\btrain|weights?\b/i);
  });

  it('captions the curve as the owner who wrote the plan (D45)', () => {
    expect(html).toMatch(/id="curve-caption"[^>]*>\s*You wrote the bonus plan\. Watch the GM's bonus climb as it learns how to earn it\./);
    expect(html).toMatch(/Each dot is a week run its current way, nothing new tried\./);
    expect(html).not.toMatch(/weights?\b/i); // the sliders set dollar amounts, not weights (Astra, plan review)
  });

  it('puts the GM to work and names a week the GM\'s way', () => {
    expect(html).toMatch(/id="train"[^>]*>Put the GM to work</);
    expect(html).toMatch(/id="status">Write your prediction, then put the GM to work\.</);
    expect(html).toMatch(/id="readout-label">A week the GM's way</);
    expect(html).toMatch(/id="replay-caption">A week the GM's way</);
    expect(html).toMatch(/write it before you put the GM to work/);
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
