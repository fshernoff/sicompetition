// The words on the student's screen (BRIEF section 1, D38): business words only. The page's HTML carries none of the
// learner's instruments and none of the forbidden words; the curve's text is the GM getting better at earning its
// bonus, not a chart about episodes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { curveWords } from '../../src/ui/curve.ts';

const html = readFileSync('index.html', 'utf8');

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

  it("carries none of the learner's words and none of the forbidden ones", () => {
    const body = html.replace(/<title>.*?<\/title>/s, '').replace(/<h1>.*?<\/h1>/s, '');
    for (const word of [/episode/i, /ε/, /epsilon/i, /target met/i, /\bstable\b/i, /injur/i, /reward/i, /evaluation/i, /\bQ-?learn/i]) {
      expect(body, String(word)).not.toMatch(word);
    }
  });

  it('captions the curve as the GM getting better at earning its bonus', () => {
    expect(html).toMatch(/id="curve-caption"[^>]*>\s*Watch the GM get better at earning its bonus\./);
  });
});

describe('curveWords', () => {
  it('names weeks of practice and test weeks, never episodes or exploring', () => {
    const words = curveWords(100);
    expect(words.xAxis).toBe('Weeks of practice');
    expect(words.yAxis).toBe('Bonus points per week');
    expect(words.legend).toEqual(['Each practice week', 'Average of the last 100 weeks', 'Test week']);
    expect(curveWords(50).legend[1]).toBe('Average of the last 50 weeks');
    expect(JSON.stringify(words)).not.toMatch(/episode|explor|evaluation|ε/i);
  });
});
