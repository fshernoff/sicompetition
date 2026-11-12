// The page's layout rules that G6 fixed (the look's round 4 findings, `.claude/docs/plans/g6-fixes.md`), read off the
// stylesheet and the page's HTML: what the eye checks in the shots, pinned so a later change cannot undo it quietly.
// The window's own checks (the 640 window, D72) are Playwright's, in e2e/smoke.spec.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8');

/** Every rule in the stylesheet, its selector and its body, in order (comments dropped; at-rules' bodies flattened). */
function rules(): { selector: string; body: string }[] {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return Array.from(plain.matchAll(/([^{}]+)\{([^{}]*)\}/g), (m) => ({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' }));
}

/** The rules whose selector contains `part`. */
function rulesFor(part: string): { selector: string; body: string }[] {
  return rules().filter((r) => r.selector.includes(part));
}

/** A declaration's value in a rule body, or undefined. */
function declared(body: string, property: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|;|\\s)${property.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+)`));
  return m?.[1]?.trim();
}

describe('the bar (G6, row 7)', () => {
  it('is one height, 40 px, in every phase: --bar-h is set once, on :root', () => {
    const sets = rules().filter((r) => declared(r.body, '--bar-h') !== undefined);
    expect(sets.map((r) => `${r.selector} { --bar-h: ${declared(r.body, '--bar-h')} }`)).toEqual([':root { --bar-h: 40px }']);
  });

  it("keeps the Teacher button and the round's tag one size in every phase (no phase's own sizes)", () => {
    const phased = rules().filter((r) => /html\[data-phase/.test(r.selector) && /\.(teacher-key|round-badge|topbar)\b/.test(r.selector));
    expect(phased.map((r) => r.selector)).toEqual([]);
  });
});

describe("the sliders' zero (G6, row 5)", () => {
  const px = (v: string | undefined): number => Number((v ?? '').replace(/px$/, ''));

  it("stands 4 px taller than the track on every row, in --ink-2, in Chrome's track and Firefox's", () => {
    const track = rulesFor('.kpi-weight::-webkit-slider-runnable-track')[0];
    const mozTrack = rulesFor('.kpi-weight::-moz-range-track')[0];
    expect(track).toBeDefined();
    expect(mozTrack).toBeDefined();
    const trackH = px(declared(track?.body ?? '', 'height'));
    expect(px(declared(mozTrack?.body ?? '', 'height'))).toBe(trackH);
    expect(trackH).toBeGreaterThan(0);
    // The tick over the track, on the slider's own box (the same in both engines), centred on the track's zero.
    const tick = rulesFor('.kpi-scale::before');
    expect(tick, 'one rule draws the tick').toHaveLength(1);
    const body = tick[0]?.body ?? '';
    expect(px(declared(body, 'height'))).toBe(trackH + 4);
    expect(declared(body, 'background')).toBe('var(--ink-2)');
    expect(declared(body, 'left')).toMatch(/50%/);
  });
});

describe('"What happens next" (G6, row 13)', () => {
  it('lists its three steps with plain dots, not numerals: the console holds the screen\'s one numbered sequence', () => {
    const card = html.match(/<div class="next-card">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(card).toContain('What happens next');
    expect(card).toMatch(/<ul class="next-steps">/);
    expect(card).not.toMatch(/<ol/);
    for (const r of rulesFor('.next-steps')) {
      expect(r.body, r.selector).not.toMatch(/counter\(/);
      expect(r.body, r.selector).not.toMatch(/counter-(reset|increment)/);
    }
  });
});

describe('getting ready (G6, row 15b)', () => {
  it('shows "What happens next" under the yard while the GM gets ready, as on the load screen', () => {
    const shown = rules().filter((r) => r.selector.includes('.next-card') && declared(r.body, 'display') === 'block');
    expect(shown.map((r) => r.selector).join(' ')).toMatch(/data-gm='preparing'\] \.next-card/);
  });
});
