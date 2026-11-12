// The lesson sheets as print-ready PDFs (D74, BRIEF section 14):
//
//   node Tools/print/sheets.ts [--out DIR] [sheet.md ...]        (npm run sheets)
//
// Each sheet in docs/lesson/ is rendered by Tools/print/markdown.ts into one HTML page with the print sheet
// Tools/print/sheets.css (Letter, 1 in margins, 11 pt Arial or Helvetica), printed by Playwright's Chromium with
// page.pdf() in an offline context that lets nothing but the page itself load, and checked, the way
// `npm run submission:pdf` makes the narrative: the pages against the sheet's count below (BRIEF 14's, held by
// tests/print/sheets.test.ts), and nothing wider than the text block. It prints a table (sheet, pages, limit, how full
// the last page is) and exits 0 when every sheet passes, 1 when one fails (named), 2 on bad arguments. The PDFs and
// the HTML they were printed from go to Temp/sheets/ (Temp is git-ignored). Node 24 native TypeScript.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderMarkdown } from './markdown.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LESSON = resolve(ROOT, 'docs/lesson');

/** Each sheet's printed pages at most: BRIEF section 14's table. */
export const SHEET_LIMITS: Readonly<Record<string, number>> = {
  'teacher-guide.md': 4,
  'teacher-key.md': 2,
  'concept-check-key.md': 2,
  'brief-round1.md': 1,
  'brief-round2.md': 1,
  'brief-round3.md': 1,
  'role-cards.md': 1,
  'concept-check.md': 2,
  'board-memo.md': 1,
  'debrief-readings.md': 3,
};

/** The text block: Letter less the 1 in margins, in CSS pixels (96 to the inch). */
const BLOCK = { width: 6.5 * 96, height: 9 * 96 };
/** A last page fuller than this, on a sheet at its limit, is reported as tight: one more line may spill. */
const TIGHT = 0.95;

interface Options {
  out: string;
  files: string[];
}

function parseArgs(argv: readonly string[]): Options {
  const o: Options = { out: resolve(ROOT, 'Temp/sheets'), files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--out' && argv[i + 1] !== undefined) o.out = resolve(argv[++i] as string);
    else if (a === '--help') {
      console.log('Usage: node Tools/print/sheets.ts [--out DIR] [sheet.md ...]');
      process.exit(0);
    } else if (a.endsWith('.md') && SHEET_LIMITS[basename(a)] !== undefined) o.files.push(basename(a));
    else {
      console.error(`sheets: unknown argument ${a}`);
      process.exit(2);
    }
  }
  return o;
}

/** The page Chromium prints: the sheet's HTML with the print sheet inlined, nothing else. */
export function sheetPage(md: string, title: string, css: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
<body class="sheet-${title}"><main>${renderMarkdown(md)}</main><div id="probe" style="display:none;break-inside:avoid"></div></body></html>
`;
}

/** Pages in a PDF Chromium wrote: its page objects (it writes plain objects, no object streams). */
export function pdfPages(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
}

interface Row {
  sheet: string;
  pages: number;
  limit: number;
  lastPage: string;
  status: string;
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  const css = readFileSync(resolve(ROOT, 'Tools/print/sheets.css'), 'utf8');
  const files = o.files.length > 0 ? o.files : readdirSync(LESSON).filter((f) => f.endsWith('.md')).sort();
  mkdirSync(o.out, { recursive: true });
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const rows: Row[] = [];
  const blocked: string[] = [];
  let failed = false;
  try {
    const context = await browser.newContext({ viewport: { width: Math.round(8.5 * 96), height: 11 * 96 }, offline: true });
    const tab = await context.newPage();
    await tab.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
      blocked.push(url);
      return route.abort();
    });
    await tab.emulateMedia({ media: 'print' });
    for (const file of files) {
      const limit = SHEET_LIMITS[file];
      if (limit === undefined) {
        rows.push({ sheet: file, pages: 0, limit: 0, lastPage: '', status: 'NO COUNT in SHEET_LIMITS' });
        failed = true;
        continue;
      }
      const name = file.replace(/\.md$/, '');
      const htmlPath = resolve(o.out, `${name}.html`);
      writeFileSync(htmlPath, sheetPage(readFileSync(resolve(LESSON, file), 'utf8'), name, css));
      await tab.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
      // Nothing may stick out of the text block (a URL, a table): it would be cut at the page's edge.
      const overflow = await tab.evaluate((width: number) => {
        const main = document.querySelector('main') as HTMLElement;
        const right = main.getBoundingClientRect().left + width;
        return [...main.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > right + 2)
          .map((el) => `<${el.tagName.toLowerCase()}> ${(el.textContent ?? '').trim().slice(0, 40)}`);
      }, BLOCK.width);
      const pdf = await tab.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true });
      writeFileSync(resolve(o.out, `${name}.pdf`), pdf);
      const pages = pdfPages(pdf);
      // How full the last page is: the tallest unbreakable block that still fits after the text, found by halving.
      const pagesWith = async (px: number): Promise<number> => {
        await tab.evaluate((h: number) => {
          const probe = document.getElementById('probe') as HTMLElement;
          probe.style.display = h > 0 ? 'block' : 'none';
          probe.style.height = `${h}px`;
        }, px);
        return pdfPages(await tab.pdf({ preferCSSPageSize: true }));
      };
      let lo = 0;
      let hi = BLOCK.height;
      for (let k = 0; k < 8; k++) {
        const mid = (lo + hi) / 2;
        if ((await pagesWith(mid)) === pages) lo = mid;
        else hi = mid;
      }
      await pagesWith(0);
      const full = 1 - lo / BLOCK.height;
      const notes: string[] = [];
      if (pages > limit) notes.push(`OVER by ${pages - limit}`);
      if (overflow.length > 0) notes.push(`WIDER than the page: ${overflow.slice(0, 2).join('; ')}`);
      if (notes.length > 0) failed = true;
      else if (pages === limit && full > TIGHT) notes.push('ok, tight');
      rows.push({ sheet: file, pages, limit, lastPage: `${Math.round(full * 100)}% full`, status: notes.join('; ') || 'ok' });
    }
  } finally {
    await browser.close();
  }
  if (blocked.length > 0) {
    failed = true;
    console.error(`blocked requests: ${blocked.join(', ')}`);
  }
  const w = (s: string | number, n: number): string => String(s).padEnd(n);
  console.log(`${w('sheet', 22)} ${w('pages', 5)} ${w('limit', 5)} ${w('last page', 10)} status`);
  for (const r of rows) console.log(`${w(r.sheet, 22)} ${w(r.pages, 5)} ${w(r.limit, 5)} ${w(r.lastPage, 10)} ${r.status}`);
  console.log(`\nPDFs in ${o.out}`);
  if (failed) {
    const bad = rows.filter((r) => !r.status.startsWith('ok')).map((r) => r.sheet);
    console.error(`sheets: ${bad.join(', ') || 'a request left the page'} failed`);
    process.exit(1);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
