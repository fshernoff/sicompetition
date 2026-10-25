// The 20-seed pilot harness (G2 plan, acceptance 2): node src/learn/pilot.ts --seeds N --budget MS.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = (args: string[]) => spawnSync('node', ['src/learn/pilot.ts', ...args], { encoding: 'utf8' });

describe('pilot harness', () => {
  it('rejects bad arguments with exit 2', () => {
    expect(run(['--seeds', '0']).status).toBe(2);
    expect(run(['--budget', 'soon']).status).toBe(2);
    expect(run(['--bogus']).status).toBe(2);
  });

  it('runs one seed, prints its row and the summary, and exits 0 when the target is met', () => {
    const r = run(['--seeds', '1', '--budget', '60000']);
    expect(r.stderr).toBe('');
    expect(r.stdout).toMatch(/seed\s+1\b/);
    expect(r.stdout).toMatch(/1 of 1 seeds target met/);
    expect(r.status).toBe(0);
  }, 120_000);
});
