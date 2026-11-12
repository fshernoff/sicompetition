// The Markdown the lesson sheets use, to HTML for print (D74). A subset of our own, after the narrative's renderer on
// the `submission` branch (Tools/Submission/narrative.ts), with what the sheets need beyond it: lists nested by
// indentation (a round brief's "   - Plan:" under its numbered step), a run of three or more underscores as a line to
// write on (a span the print sheet draws, its length from the run's), and each `###` heading wrapped with what follows
// it up to the next heading, so a question or a case is kept together on the page. Headings carry an id (their text,
// lower case, hyphens), so the print sheet can place one: the readings' mapping table opens a page. HTML comments are
// stripped; everything else is escaped. Node 24 native TypeScript: erasable syntax only.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A heading's id: lower case, every run of other characters one hyphen. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// A bare URL ends before a space, a bracket or a quote, and never on trailing punctuation.
const BARE_URL = /https?:\/\/[^\s<>()[\]"]*[^\s<>()[\]".,;:!?']/g;

/** One line of inline Markdown: code spans, links, bare URLs and write-on lines set aside first, then escaped, then emphasis. */
export function renderInline(text: string, autolink = true): string {
  const kept: string[] = [];
  const keep = (html: string): string => `${kept.push(html) - 1}`;
  let s = text;
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => keep(`<code>${escapeHtml(c)}</code>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => keep(`<a href="${escapeHtml(u)}">${renderInline(t, false)}</a>`));
  if (autolink) s = s.replace(BARE_URL, (u) => keep(`<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`));
  s = s.replace(/_{3,}/g, (run) => keep(`<span class="write" style="--n:${run.length}"></span>`));
  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?![*\w])/g, '$1<em>$2</em>');
  while (/\d+/.test(s)) s = s.replace(/(\d+)/g, (_m, n: string) => kept[Number(n)] ?? '');
  return s;
}

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const LIST_ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function indentOf(line: string): number {
  return (/^\s*/.exec(line)?.[0] ?? '').length;
}

function isBlockStart(line: string, next: string | undefined): boolean {
  return /^#{1,4}\s/.test(line) || LIST_ITEM.test(line) || /^>/.test(line) || (/^\s*\|/.test(line) && next !== undefined && TABLE_SEPARATOR.test(next));
}

function tableCells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** A list starting at `start`, whose items sit at `indent`; returns its HTML and the line after it. */
function renderList(lines: readonly string[], start: number, indent: number): { html: string; next: number } {
  const first = LIST_ITEM.exec(lines[start] as string);
  const ordered = /\d/.test(first?.[2] ?? '');
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i] as string);
    if (!m || (m[1] ?? '').length !== indent || /\d/.test(m[2] ?? '') !== ordered) break;
    let text = m[3] ?? '';
    let nested = '';
    i++;
    while (i < lines.length) {
      const l = lines[i] as string;
      const sub = LIST_ITEM.exec(l);
      if (/^\s*$/.test(l)) {
        // A blank line ends the list unless the next line carries on this item or this list.
        const after = lines[i + 1];
        const subAfter = after === undefined ? null : LIST_ITEM.exec(after);
        if (subAfter && (subAfter[1] ?? '').length >= indent) {
          i++;
          continue;
        }
        break;
      }
      if (sub && (sub[1] ?? '').length > indent) {
        const inner = renderList(lines, i, (sub[1] ?? '').length);
        nested += inner.html;
        i = inner.next;
        continue;
      }
      if (sub || isBlockStart(l, lines[i + 1]) || indentOf(l) < indent) break;
      text += ' ' + l.trim();
      i++;
    }
    items.push(`<li>${renderInline(text.trim())}${nested}</li>`);
  }
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.join('')}</${tag}>`, next: i };
}

/** The sheet's Markdown to HTML, block by block; a `###` heading and what follows it, to the next heading, are one section. */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let open = false;
  const close = (): void => {
    if (open) out.push('</section>');
    open = false;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const level = (heading[1] as string).length;
      const text = heading[2] as string;
      close();
      if (level >= 3) {
        out.push('<section class="block">');
        open = true;
      }
      out.push(`<h${level} id="${slug(text)}">${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line) && TABLE_SEPARATOR.test(lines[i + 1] ?? '')) {
      const head = tableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i] as string)) rows.push(tableCells(lines[i++] as string));
      out.push(
        '<table><thead><tr>' +
          head.map((c) => `<th>${renderInline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + head.map((_h, k) => `<td>${renderInline(r[k] ?? '')}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>',
      );
      continue;
    }
    if (/^>/.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^>/.test(lines[i] as string)) inner.push((lines[i++] as string).replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(inner.join('\n'))}</blockquote>`);
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const list = renderList(lines, i, (item[1] ?? '').length);
      out.push(list.html);
      i = list.next;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !/^\s*$/.test(lines[i] as string) && !(para.length > 0 && isBlockStart(lines[i] as string, lines[i + 1]))) {
      para.push((lines[i] as string).trim());
      i++;
    }
    // A paragraph that is only an arrow and a line is an answer line: the print sheet runs it across the page.
    const text = para.join(' ');
    out.push(/^→\s*_{3,}$/.test(text) ? `<p class="answer">${renderInline(text)}</p>` : `<p>${renderInline(text)}</p>`);
  }
  close();
  return out.join('');
}
