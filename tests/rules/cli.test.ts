// BRIEF section 12: the headless sim CLI.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function run(args: string[]) {
  return spawnSync('node', ['src/sim/cli.ts', ...args], { encoding: 'utf8' });
}

describe('sim CLI', () => {
  it('prints one JSON document for N episodes under a preset', () => {
    const out = execFileSync('node', ['src/sim/cli.ts', '--episodes', '3', '--seed', '1', '--reward', 'round1', '--policy', 'random'], { encoding: 'utf8' });
    const doc = JSON.parse(out);
    expect(doc.episodes).toBe(3);
    expect(doc.seed).toBe(1);
    expect(doc.policy).toBe('random');
    expect(doc.reward.kpis.profit).toEqual({ on: true, weight: 10 });
    expect(doc.config.name).toBe('default');
    expect(doc.summary.episodes).toBe(3);
    expect(typeof doc.summary.mean.profit).toBe('number');
    expect(doc.last.days.length).toBe(5);
  });

  it('is reproducible for a seed', () => {
    const a = run(['--episodes', '2', '--seed', '5', '--reward', 'round1']).stdout;
    const b = run(['--episodes', '2', '--seed', '5', '--reward', 'round1']).stdout;
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(100);
  });

  it('accepts a reward spec from a JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rtp-'));
    const file = join(dir, 'plan.json');
    writeFileSync(file, JSON.stringify({ version: 1, kpis: { profit: { on: true, weight: 10 }, dogsServed: { on: false, weight: 0 }, incidents: { on: true, weight: -6 }, reputation: { on: false, weight: 0 }, fatigue: { on: false, weight: 0 }, overRatio: { on: true, weight: -4 } } }));
    const r = run(['--episodes', '2', '--seed', '1', '--reward', file]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).reward.kpis.incidents.weight).toBe(-6);
  });

  it('defaults to 200 episodes, seed 1, round1, random', () => {
    const r = run([]);
    expect(r.status).toBe(0);
    const doc = JSON.parse(r.stdout);
    expect(doc.episodes).toBe(200);
    expect(doc.seed).toBe(1);
    expect(doc.policy).toBe('random');
  });

  it('rejects bad arguments with exit 2 and a message on stderr', () => {
    expect(run(['--reward', 'nope']).status).toBe(2);
    expect(run(['--reward', 'nope']).stderr).toMatch(/reward/);
    expect(run(['--episodes', '0']).status).toBe(2);
    expect(run(['--policy', 'lazy']).status).toBe(2);
    expect(run(['--bogus']).status).toBe(2);
  });

  it('prints usage on --help', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/--episodes/);
  });
});
