import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D58: no image ships without three clean figure-by-figure passes on its exact bytes (the main thread, Astra, a fresh
// Sonnet agent) in docs/art-provenance/qa.md, and a provenance entry in docs/art-provenance/README.md.
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

const shipped = readdirSync(ART).filter((name) => /\.(webp|png|jpg|jpeg|svg|avif)$/.test(name));

describe('the art QA (D58)', () => {
  it('ships at least one image', () => {
    expect(shipped.length).toBeGreaterThan(0);
  });

  it.each(shipped)('%s has a clean pass on its exact bytes from each of the three readers', (name) => {
    const sha = sha12(`${ART}/${name}`);
    const clean = ledger().filter((p) => p.file === name && p.sha === sha && p.verdict === 'clean');
    expect(READERS.filter((reader) => !clean.some((p) => p.reader === reader))).toEqual([]);
  });

  it.each(shipped)('%s has no open defect on its exact bytes', (name) => {
    const sha = sha12(`${ART}/${name}`);
    expect(ledger().filter((p) => p.file === name && p.sha === sha && p.verdict.startsWith('defect'))).toEqual([]);
  });

  it.each(shipped)('%s is in the provenance record', (name) => {
    const stem = name.replace(/\.[a-z]+$/, '');
    expect(readFileSync('docs/art-provenance/README.md', 'utf8')).toContain(stem);
  });
});
