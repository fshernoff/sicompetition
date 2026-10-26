// The 20-seed pilot harness (G2 plan, acceptance 2): node src/learn/pilot.ts --seeds N --budget MS.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPreset } from '../../src/world/config.ts';

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

  // G3: the harness measures any plan (--reward as the sim CLI reads it); a plan without a target is judged on stable.
  it('measures a plan without a target: target n/a, the outcome key, exit 0 when every seed is stable in budget', () => {
    const r = run(['--seeds', '1', '--budget', '60000', '--reward', 'balanced']);
    expect(r.stderr).toBe('');
    expect(r.stdout).toMatch(/seed\s+1\b.*stable yes.*target n\/a.*key acceptAll=\d/);
    expect(r.stdout).toMatch(/1 of 1 seeds stable within budget/);
    expect(r.status).toBe(0);
  }, 120_000);

  it('still ends a Round 1 row with its outcome key', () => {
    const r = run(['--seeds', '1', '--budget', '60000', '--reward', 'round1']);
    expect(r.stdout).toMatch(/seed\s+1\b.*target yes.*key acceptAll=5 staff1=4 staff2=1/);
    expect(r.stdout).toMatch(/1 of 1 seeds target met/);
    expect(r.status).toBe(0);
  }, 120_000);

  it('reads a plan from a JSON file exactly as the sim CLI does', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rtp-pilot-'));
    const file = join(dir, 'plan.json');
    writeFileSync(file, JSON.stringify(loadPreset('balanced').spec));
    const fromFile = run(['--seeds', '1', '--reward', file]);
    const fromPreset = run(['--seeds', '1', '--reward', 'balanced']);
    expect(fromFile.status).toBe(0);
    expect(fromPreset.status).toBe(0);
    // The elapsed seconds are the machine's, not the plan's: compared without them (Astra, G3 diff review).
    const row = (out: string): string => (out.split('\n').find((l) => /^seed\s+1\b/.test(l)) ?? '').replace(/seconds\s+[\d.]+/, 'seconds -');
    expect(row(fromFile.stdout)).toMatch(/^seed\s+1\s+episodes\s+\d+\s+seconds -\s+stable yes\s+target n\/a\s+key acceptAll=/);
    expect(row(fromFile.stdout)).toBe(row(fromPreset.stdout));
    writeFileSync(file, JSON.stringify({ version: 1, kpis: { profit: { on: true, weight: 12 } } }));
    const invalid = run(['--seeds', '1', '--reward', file]);
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toMatch(/reward/);
    writeFileSync(file, '{ not json');
    expect(run(['--seeds', '1', '--reward', file]).status).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  }, 120_000);

  it('exits 1 when a plan without a target is not stable within its budget', () => {
    const r = run(['--seeds', '1', '--budget', '1', '--reward', 'balanced']);
    expect(r.stdout).toMatch(/seed\s+1\b.*stable no.*target n\/a/);
    expect(r.stdout).toMatch(/0 of 1 seeds stable within budget/);
    expect(r.status).toBe(1);
  }, 120_000);

  it('rejects an unknown reward, and a --reward with no value, with exit 2', () => {
    const r = run(['--reward', 'nosuch']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/nosuch/);
    expect(run(['--reward']).status).toBe(2);
  });
});
