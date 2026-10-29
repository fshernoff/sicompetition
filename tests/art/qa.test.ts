import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D58: no image ships without three clean figure-by-figure passes on its exact bytes (the main thread, Astra, a fresh
// Sonnet agent) in docs/art-provenance/qa.md, and a provenance entry in docs/art-provenance/README.md or set.md.
const ART = 'src/assets/art';
const READERS = ['main thread', 'Astra', 'Sonnet'];

interface Pass {
  file: string;
  sha: string;
  reader: string;
  verdict: string;
}

function ledger(): Pass[] {
  const rows = readFileSync('docs/art-provenance/qa.md', 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.startsWith('|---') && !line.startsWith('| file '));
  return rows.map((line) => {
    const [file = '', sha = '', reader = '', , verdict = ''] = line.split('|').slice(1).map((cell) => cell.trim());
    return { file, sha, reader, verdict };
  });
}

function sha12(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
}

// Every image under src/assets/art, in subfolders too (the cast and the set live in cast/ and set/), by its path from ART.
const shipped = (readdirSync(ART, { recursive: true }) as string[]).filter((name) => /\.(webp|png|jpg|jpeg|svg|avif)$/.test(name)).sort();

describe('the art QA (D58)', () => {
  it('ships at least one image', () => {
    expect(shipped.length).toBeGreaterThan(0);
  });

  it.each(shipped)('%s has a clean pass on its exact bytes from each of the three readers', (name) => {
    const sha = sha12(`${ART}/${name}`);
    const clean = ledger().filter((p) => p.file === name && p.sha === sha && p.verdict === 'clean');
    expect(READERS.filter((reader) => !clean.some((p) => p.reader === reader))).toEqual([]);
  });

  // A defect stays open until the reader who found it records a clean pass on the same bytes after it (a regenerated
  // or repaired file has new bytes and needs its own three passes; a re-check against a measurement is the one way
  // the same bytes clear).
  it.each(shipped)('%s has no open defect on its exact bytes', (name) => {
    const sha = sha12(`${ART}/${name}`);
    const rows = ledger().filter((p) => p.file === name && p.sha === sha);
    const open = rows.filter((p, i) => p.verdict.startsWith('defect') && !rows.slice(i + 1).some((q) => q.reader === p.reader && q.verdict === 'clean'));
    expect(open).toEqual([]);
  });

  it.each(shipped)('%s is in the provenance record', (name) => {
    const stem = name.replace(/\.[a-z]+$/, '').split('/').pop() ?? name;
    const record = ['docs/art-provenance/README.md', 'docs/art-provenance/set.md'].map((f) => (existsSync(f) ? readFileSync(f, 'utf8') : '')).join('\n');
    expect(record).toContain(stem);
  });
});
