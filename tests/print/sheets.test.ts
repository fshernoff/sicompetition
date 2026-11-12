// The sheets print one way (D74, BRIEF section 14): `npm run sheets` holds each sheet in docs/lesson/ to a page count.
// This file, with no browser, holds the script's counts to BRIEF 14's table and to the files that exist, and the
// renderer to the Markdown the sheets use.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHEET_LIMITS } from '../../Tools/print/sheets.ts';
import { renderMarkdown } from '../../Tools/print/markdown.ts';

/** BRIEF 14's table of page counts: each row "| `file.md` | N ... |". */
function briefCounts(): Map<string, number> {
  const brief = readFileSync('docs/BRIEF.md', 'utf8');
  const start = brief.search(/^## 14\. /m);
  const rest = brief.slice(start);
  const section = rest.slice(0, rest.slice(1).search(/^## \d+\. /m) + 1 || rest.length);
  const rows = Array.from(section.matchAll(/^\|\s*`([a-z0-9-]+\.md)`\s*\|\s*(\d+)\b/gm));
  return new Map(rows.map((m) => [m[1] ?? '', Number(m[2])]));
}

describe('npm run sheets (D74)', () => {
  it("has a page count for every sheet in docs/lesson/, and for nothing else", () => {
    const files = readdirSync('docs/lesson').filter((f) => f.endsWith('.md')).sort();
    expect(Object.keys(SHEET_LIMITS).sort()).toEqual(files);
  });

  it("uses BRIEF 14's page counts", () => {
    const counts = briefCounts();
    expect(counts.size, 'BRIEF 14 has a table of page counts').toBe(Object.keys(SHEET_LIMITS).length);
    for (const [file, pages] of Object.entries(SHEET_LIMITS)) expect(pages, file).toBe(counts.get(file));
  });
});

describe('the print renderer', () => {
  it('nests an indented list item under its numbered step, as the round briefs write it', () => {
    const html = renderMarkdown('1. Copy the plan:\n   - Plan: → ____\n2. Circle your picks.');
    expect(html).toBe('<ol><li>Copy the plan:<ul><li>Plan: → <span class="write" style="--n:4"></span></li></ul></li><li>Circle your picks.</li></ol>');
  });

  it('turns a run of underscores into a line to write on, and leaves a lone underscore alone', () => {
    expect(renderMarkdown('Team code: ______')).toBe('<p>Team code: <span class="write" style="--n:6"></span></p>');
    expect(renderMarkdown('snake_case')).toBe('<p>snake_case</p>');
    // An arrow and a line alone is an answer line, which the print sheet runs across the page.
    expect(renderMarkdown('→ ______')).toBe('<p class="answer">→ <span class="write" style="--n:6"></span></p>');
  });

  it('gives each heading an id, and keeps a question with what follows it', () => {
    const html = renderMarkdown('## Mapping table\n\nFill in.\n\n### Question 1\n\nWhat?\n\n- A. Yes\n\n### Question 2\n\nWhy?');
    expect(html).toContain('<h2 id="mapping-table">Mapping table</h2>');
    expect(html).toContain('<section class="block"><h3 id="question-1">Question 1</h3><p>What?</p><ul><li>A. Yes</li></ul></section>');
    expect(html).toContain('<section class="block"><h3 id="question-2">Question 2</h3><p>Why?</p></section>');
  });

  it('escapes HTML and renders bold, code, links and tables', () => {
    expect(renderMarkdown('**Bold** `code` <b> [a](https://x.org)')).toBe('<p><strong>Bold</strong> <code>code</code> &lt;b&gt; <a href="https://x.org">a</a></p>');
    expect(renderMarkdown('| A | B |\n|---|---|\n| 1 | |')).toBe('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td></td></tr></tbody></table>');
  });
});
